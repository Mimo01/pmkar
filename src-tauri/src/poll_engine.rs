use crate::jira_client;
use crate::keychain;
use crate::notification_dispatcher;
use crate::snapshot_db::{self, FieldChange, SnapshotDb};
use crate::triage_db::{FetchConfig, TriageDb};
use chrono::Utc;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tokio::sync::watch;
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone, PartialEq)]
pub enum PollFrequency {
    Off,
    Secs(u64),
}

impl PollFrequency {
    /// Parse a frequency string into a `PollFrequency` variant.
    /// Accepts "5m", "15m", "30m", "1h". Anything else maps to `Off`.
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "5m" => PollFrequency::Secs(300),
            "15m" => PollFrequency::Secs(900),
            "30m" => PollFrequency::Secs(1800),
            "1h" => PollFrequency::Secs(3600),
            _ => PollFrequency::Off,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PollCompletePayload {
    pub changed_keys: Vec<String>,
    pub checked_at: String,
    pub had_error: bool,
}

impl PollCompletePayload {
    fn error(checked_at: String) -> Self {
        Self {
            changed_keys: vec![],
            checked_at,
            had_error: true,
        }
    }

    fn ok_no_changes(checked_at: String) -> Self {
        Self {
            changed_keys: vec![],
            checked_at,
            had_error: false,
        }
    }
}

/// Main poll loop. Runs as a long-lived tokio task.
/// Uses `tokio::select!` on sleep + `rx.changed()` for immediate restart on frequency change.
/// Parks on `rx.changed()` when frequency is Off (does NOT return — resume requirement).
pub async fn run_poll_loop(
    mut rx: watch::Receiver<PollFrequency>,
    app_handle: tauri::AppHandle,
    triage_db: Arc<Mutex<TriageDb>>,
    snapshot_db: Arc<Mutex<SnapshotDb>>,
) {
    loop {
        let freq = rx.borrow().clone();
        match freq {
            PollFrequency::Off => {
                // Park until a non-Off frequency arrives
                if rx.changed().await.is_err() {
                    break; // Sender dropped — app shutting down
                }
            }
            PollFrequency::Secs(secs) => {
                tokio::select! {
                    () = sleep(Duration::from_secs(secs)) => {
                        let payload = do_poll(&app_handle, &triage_db, &snapshot_db).await;
                        let _ = app_handle.emit("poll-complete", payload);
                    }
                    result = rx.changed() => {
                        if result.is_err() {
                            break; // Sender dropped
                        }
                        // Frequency changed — loop restarts with new value
                    }
                }
            }
        }
    }
}

/// Extract connection info and watermark from locked state before any async call.
/// Returns `(watermark, base_url, username, fetch_config)` or `None` on lock failure.
fn extract_poll_params(
    triage_db: &Arc<Mutex<TriageDb>>,
    snapshot_db: &Arc<Mutex<SnapshotDb>>,
) -> Option<(Option<String>, String, String, FetchConfig)> {
    let tdb = triage_db.lock().ok()?;
    let sdb = snapshot_db.lock().ok()?;
    let watermark = sdb.get_watermark().ok().flatten();
    let conn_meta = tdb.get_all_connection_meta().ok().unwrap_or_default();
    let fetch_config = tdb.get_fetch_config().ok()?;
    drop(sdb);
    let server_meta = conn_meta
        .into_iter()
        .find(|m| m.connection_type == "server")?;
    let base_url = server_meta.base_url.clone();
    let username = server_meta.username.clone();
    drop(tdb);
    Some((watermark, base_url, username, fetch_config))
}

/// Execute one poll cycle. Fetches tickets updated since watermark, runs change detection.
/// On any error: logs, returns `had_error=true`, does NOT advance watermark.
async fn do_poll(
    app_handle: &tauri::AppHandle,
    triage_db: &Arc<Mutex<TriageDb>>,
    snapshot_db: &Arc<Mutex<SnapshotDb>>,
) -> PollCompletePayload {
    let now = Utc::now().to_rfc3339();

    // Step 1: Extract connection info and watermark (lock, extract, drop before await)
    let Some((watermark, base_url, username, fetch_config)) =
        extract_poll_params(triage_db, snapshot_db)
    else {
        // No server connection configured or lock failure — nothing to poll
        return PollCompletePayload::ok_no_changes(now);
    };

    // Determine if this is the first poll (no watermark existed before)
    let is_first_poll = watermark.is_none();

    // Retrieve PAT from keychain
    let pat = match keychain::get_credential("jira-server", &username) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[poll] keychain error: {e}");
            return PollCompletePayload::error(now);
        }
    };

    // Build JQL with watermark filter
    let base_jql = build_poll_jql(
        &fetch_config.jql_preset,
        fetch_config.jql_custom.as_deref(),
        &fetch_config.watched_users,
        &username,
    );
    let jql = if let Some(ref wm) = watermark {
        format!("({base_jql}) AND updated >= \"{wm}\"")
    } else {
        base_jql
    };

    // Step 2: Fetch tickets via HTTP (async — no locks held)
    let tickets = match jira_client::search_tickets(&base_url, &jql, &pat).await {
        Ok(t) => t,
        Err(e) => {
            eprintln!("[poll] fetch error: {e}");
            return PollCompletePayload::error(now);
        }
    };

    // Step 3: For each ticket, fetch detail and run change detection (enriched)
    let results = process_tickets(&tickets, &base_url, &pat, snapshot_db).await;

    // Step 4: Read notification prefs and dispatch OS notifications
    let prefs = {
        let Ok(tdb) = triage_db.lock() else {
            return PollCompletePayload::error(now);
        };
        tdb.get_notification_prefs().unwrap_or_default()
    };

    let mut changed_keys = Vec::new();
    for (key, changes, detail_json, is_new_ticket) in &results {
        changed_keys.push(key.clone());

        // Persist unseen changes for frontend indicator (D-11)
        // Compute cumulative diff from seen baseline (D-12): show original→current, not steps
        if !changes.is_empty() {
            if let Ok(sdb) = snapshot_db.lock() {
                let cumulative_changes =
                    if let Ok(Some(seen_json)) = sdb.get_seen_snapshot(key) {
                        // Diff from last-seen baseline to current
                        crate::snapshot_db::detect_changes(&seen_json, detail_json)
                            .unwrap_or_else(|_| changes.clone())
                    } else {
                        // No seen baseline — use the changes as-is (first time)
                        changes.clone()
                    };
                let _ = sdb.set_unseen_changes(key, &cumulative_changes);
            }
        }

        // Skip new-ticket notifications on the very first poll to avoid flood
        let effective_new = *is_new_ticket && !is_first_poll;
        notification_dispatcher::dispatch_notifications(
            app_handle,
            key,
            changes,
            detail_json,
            effective_new,
            &prefs,
        );
    }

    PollCompletePayload {
        changed_keys,
        checked_at: now,
        had_error: false,
    }
}

/// Fetch detail for each ticket and detect changes.
/// Returns enriched tuples: `(ticket_key, field_changes, detail_json, is_new_ticket)`.
async fn process_tickets(
    tickets: &[serde_json::Value],
    base_url: &str,
    pat: &str,
    snapshot_db: &Arc<Mutex<SnapshotDb>>,
) -> Vec<(String, Vec<FieldChange>, String, bool)> {
    let mut results = Vec::new();
    for ticket in tickets {
        let Some(key) = ticket.get("key").and_then(|v| v.as_str()) else {
            continue;
        };
        let key = key.to_string();

        let detail = match jira_client::fetch_ticket_detail_raw(base_url, &key, pat).await {
            Ok(d) => d,
            Err(e) => {
                eprintln!("[poll] detail fetch error for {key}: {e}");
                continue;
            }
        };

        let detail_json = detail.to_string();

        // Check if snapshot already exists BEFORE calling check_for_changes (which stores it)
        let is_new_ticket = {
            let Ok(sdb) = snapshot_db.lock() else {
                continue;
            };
            sdb.get_snapshot(&key).ok().flatten().is_none()
        };

        let changes = {
            let Ok(sdb) = snapshot_db.lock() else {
                continue;
            };
            snapshot_db::check_for_changes(&sdb, &key, &detail_json).unwrap_or_default()
        };

        // Include ticket if it has field changes OR is new (for new-ticket notifications)
        if !changes.is_empty() || is_new_ticket {
            results.push((key, changes, detail_json, is_new_ticket));
        }
    }
    results
}

fn build_poll_jql(
    preset: &str,
    custom: Option<&str>,
    watched_users: &[String],
    username: &str,
) -> String {
    match preset {
        "custom" => custom.map_or_else(
            || format!("assignee = \"{username}\" ORDER BY updated DESC"),
            str::to_string,
        ),
        "mentioned" => format!("text ~ \"{username}\" ORDER BY updated DESC"),
        "all_watched" => {
            let all: Vec<String> = std::iter::once(format!("\"{username}\""))
                .chain(watched_users.iter().map(|u| format!("\"{u}\"")))
                .collect();
            format!("assignee in ({}) ORDER BY updated DESC", all.join(", "))
        }
        // "assigned" and unknown presets both use assignee filter
        _ => format!("assignee = \"{username}\" ORDER BY updated DESC"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── PollFrequency::from_str tests ──────────────────────────────────────────

    #[test]
    fn test_poll_frequency_5m() {
        assert_eq!(PollFrequency::from_str("5m"), PollFrequency::Secs(300));
    }

    #[test]
    fn test_poll_frequency_15m() {
        assert_eq!(PollFrequency::from_str("15m"), PollFrequency::Secs(900));
    }

    #[test]
    fn test_poll_frequency_30m() {
        assert_eq!(PollFrequency::from_str("30m"), PollFrequency::Secs(1800));
    }

    #[test]
    fn test_poll_frequency_1h() {
        assert_eq!(PollFrequency::from_str("1h"), PollFrequency::Secs(3600));
    }

    #[test]
    fn test_poll_frequency_off() {
        assert_eq!(PollFrequency::from_str("off"), PollFrequency::Off);
    }

    #[test]
    fn test_poll_frequency_bogus_fallback() {
        assert_eq!(PollFrequency::from_str("bogus"), PollFrequency::Off);
    }

    // ── PollCompletePayload serialization tests ────────────────────────────────

    #[test]
    fn test_poll_payload_serializes_camel_case() {
        let payload = PollCompletePayload {
            changed_keys: vec!["PROJ-1".to_string()],
            checked_at: "2026-01-01T00:00:00Z".to_string(),
            had_error: false,
        };
        let json = serde_json::to_string(&payload).expect("serialize failed");
        assert!(
            json.contains("\"changedKeys\""),
            "should use camelCase changedKeys"
        );
        assert!(
            json.contains("\"checkedAt\""),
            "should use camelCase checkedAt"
        );
        assert!(
            json.contains("\"hadError\""),
            "should use camelCase hadError"
        );
    }
}
