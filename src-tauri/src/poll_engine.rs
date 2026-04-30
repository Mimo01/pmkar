use crate::jira_client;
use crate::keychain;
use crate::notification_dispatcher;
use crate::snapshot_db::{self, FieldChange, SnapshotDb};
use crate::triage_db::{FetchConfig, TriageDb, WatchedUser};
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

/// Bundle of values pulled out of the locked DB state for one poll cycle.
/// Held in its own struct so we can extend it (e.g. with `source_project_key`)
/// without churning every call site / clippy threshold.
struct PollParams {
    watermark: Option<String>,
    base_url: String,
    username: String,
    fetch_config: FetchConfig,
    /// Configured source project key (or None if user has not selected one).
    /// Used to scope JQL to the selected project so that broadened "mine"
    /// clauses (`comment ~ me`, `description ~ me`, `watchedIssues()`) cannot match
    /// foreign-project tickets. See debug session: fetched-tasks-wrong-project.
    source_project_key: Option<String>,
}

/// Extract connection info, watermark, and project scope from locked state
/// before any async call. Returns `None` on lock failure or missing server
/// connection.
fn extract_poll_params(
    triage_db: &Arc<Mutex<TriageDb>>,
    snapshot_db: &Arc<Mutex<SnapshotDb>>,
) -> Option<PollParams> {
    let tdb = triage_db.lock().ok()?;
    let sdb = snapshot_db.lock().ok()?;
    let watermark = sdb.get_watermark().ok().flatten();
    let conn_meta = tdb.get_all_connection_meta().ok().unwrap_or_default();
    let fetch_config = tdb.get_fetch_config().ok()?;
    // get_project_keys returns (source_key, target_key, source_name, target_name).
    let source_project_key = tdb
        .get_project_keys()
        .ok()
        .and_then(|(src, _, _, _)| src);
    drop(sdb);
    let server_meta = conn_meta
        .into_iter()
        .find(|m| m.connection_type == "server")?;
    let base_url = server_meta.base_url.clone();
    let username = server_meta.username.clone();
    drop(tdb);
    Some(PollParams {
        watermark,
        base_url,
        username,
        fetch_config,
        source_project_key,
    })
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
    let Some(PollParams {
        watermark,
        base_url,
        username,
        fetch_config,
        source_project_key,
    }) = extract_poll_params(triage_db, snapshot_db)
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
        source_project_key.as_deref(),
    );
    let jql = if let Some(ref wm) = watermark {
        format!("({base_jql}) AND updated >= \"{wm}\"")
    } else {
        base_jql
    };

    // Step 2: Fetch tickets via HTTP (async — no locks held)
    // search_tickets paginates internally; on partial-page failure it returns Err,
    // so the watermark guarantee (advance only on fully-successful fetch) is preserved.
    let (tickets, truncated) = match jira_client::search_tickets(&base_url, &jql, &pat).await {
        Ok(result) => result,
        Err(e) => {
            eprintln!("[poll] fetch error: {e}");
            return PollCompletePayload::error(now);
        }
    };

    if truncated {
        eprintln!(
            "[poll] WARNING: pagination cap hit at {} issues — some matching tickets were not fetched. Tighten your JQL.",
            jira_client::MAX_PAGINATION_ITEMS
        );
    }

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
                let cumulative_changes = if let Ok(Some(seen_json)) = sdb.get_seen_snapshot(key) {
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

fn build_mine_clauses(username: &str) -> Vec<String> {
    vec![
        format!("assignee = \"{username}\""),
        format!("comment ~ \"{username}\""),
        format!("description ~ \"{username}\""),
        "issueKey in watchedIssues()".to_string(),
    ]
}

/// Wrap an OR'd people clause with `project = "<key>" AND (...)` when a source
/// project is configured. Without this scope the broadened "mine" clauses
/// match across every Jira project the user has touched, leaking foreign-
/// project tickets into the source list. See debug session:
/// fetched-tasks-wrong-project.
fn wrap_with_project(people_or_clause: &str, source_project_key: Option<&str>) -> String {
    match source_project_key {
        Some(key) if !key.is_empty() => {
            format!(
                "project = \"{key}\" AND ({people_or_clause}) ORDER BY updated DESC"
            )
        }
        _ => format!("({people_or_clause}) ORDER BY updated DESC"),
    }
}

fn build_poll_jql(
    preset: &str,
    custom: Option<&str>,
    watched_users: &[WatchedUser],
    username: &str,
    source_project_key: Option<&str>,
) -> String {
    match preset {
        // `custom` is intentionally NOT scoped — the user wrote raw JQL and may
        // already have a project clause (or want a deliberate cross-project query).
        "custom" => custom.map_or_else(
            || format!("assignee = \"{username}\" ORDER BY updated DESC"),
            str::to_string,
        ),
        "all_watched" => {
            let mine = build_mine_clauses(username);
            if watched_users.is_empty() {
                return wrap_with_project(&mine.join(" OR "), source_project_key);
            }
            let watched: Vec<String> = watched_users
                .iter()
                .flat_map(|u| {
                    vec![
                        format!("assignee = \"{}\"", u.identifier),
                        format!("comment ~ \"{}\"", u.identifier),
                        format!("description ~ \"{}\"", u.identifier),
                    ]
                })
                .collect();
            let all: Vec<String> = mine.into_iter().chain(watched).collect();
            wrap_with_project(&all.join(" OR "), source_project_key)
        }
        // "mine", "assigned", "mentioned" and unknown presets: current user criteria
        _ => {
            let mine = build_mine_clauses(username);
            wrap_with_project(&mine.join(" OR "), source_project_key)
        }
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

    // ── build_poll_jql project-scope tests ─────────────────────────────────────
    // Regression coverage for debug session: fetched-tasks-wrong-project.

    #[test]
    fn test_build_poll_jql_mine_no_project() {
        let jql = build_poll_jql("mine", None, &[], "alice", None);
        assert!(
            !jql.contains("project ="),
            "no source project key => no project clause"
        );
        assert!(jql.contains("assignee = \"alice\""));
        assert!(jql.contains("comment ~ \"alice\""));
        assert!(jql.contains("description ~ \"alice\""));
        assert!(jql.contains("watchedIssues()"));
        assert!(jql.contains("ORDER BY updated DESC"));
    }

    #[test]
    fn test_build_poll_jql_mine_with_project_scope() {
        let jql = build_poll_jql("mine", None, &[], "alice", Some("XYZ"));
        // Project clause must be the prefix and AND'd with the people clause
        assert!(
            jql.starts_with("project = \"XYZ\" AND ("),
            "project clause must scope the people clause: got {jql}"
        );
        assert!(jql.contains("assignee = \"alice\""));
        assert!(jql.contains("comment ~ \"alice\""));
        assert!(jql.contains("description ~ \"alice\""));
        assert!(jql.contains("watchedIssues()"));
        assert!(jql.ends_with("ORDER BY updated DESC"));
    }

    #[test]
    fn test_build_poll_jql_all_watched_with_project_scope() {
        let watched = vec![WatchedUser {
            identifier: "bob".to_string(),
            display_name: "Bob".to_string(),
            email: None,
        }];
        let jql = build_poll_jql("all_watched", None, &watched, "alice", Some("XYZ"));
        assert!(jql.starts_with("project = \"XYZ\" AND ("));
        assert!(jql.contains("assignee = \"alice\""));
        assert!(jql.contains("assignee = \"bob\""));
        assert!(jql.contains("comment ~ \"bob\""));
        assert!(jql.contains("description ~ \"bob\""));
    }

    #[test]
    fn test_build_poll_jql_custom_not_wrapped() {
        // Custom JQL is left untouched even when a source project is selected,
        // because the user may have written their own project clause or want
        // a deliberate cross-project query.
        let jql = build_poll_jql(
            "custom",
            Some("project = ABC AND status = Open"),
            &[],
            "alice",
            Some("XYZ"),
        );
        assert_eq!(jql, "project = ABC AND status = Open");
    }

    #[test]
    fn test_build_poll_jql_empty_project_key_treated_as_none() {
        // Defensive: if the source project key is the empty string, treat it
        // as if no project was selected rather than emitting `project = ""`.
        let jql = build_poll_jql("mine", None, &[], "alice", Some(""));
        assert!(!jql.contains("project ="));
    }
}
