use crate::snapshot_db::FieldChange;
use serde::{Deserialize, Serialize};
use tauri_plugin_notification::NotificationExt;

/// Notification preferences stored per-user in `SQLite`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(clippy::struct_excessive_bools)]
pub struct NotificationPrefs {
    pub notify_new_ticket: bool,
    pub notify_status_change: bool,
    pub notify_priority_change: bool,
    pub notify_new_comment: bool,
    pub quiet_hours_enabled: bool,
    pub quiet_start: Option<String>,
    pub quiet_end: Option<String>,
    pub quiet_days: Vec<String>,
}

impl Default for NotificationPrefs {
    fn default() -> Self {
        Self {
            notify_new_ticket: true,
            notify_status_change: true,
            notify_priority_change: true,
            notify_new_comment: true,
            quiet_hours_enabled: false,
            quiet_start: None,
            quiet_end: None,
            quiet_days: vec![
                "Mon".to_string(),
                "Tue".to_string(),
                "Wed".to_string(),
                "Thu".to_string(),
                "Fri".to_string(),
            ],
        }
    }
}

/// Build a notification body string for a field change.
/// Returns `None` for fields that don't produce per-field notifications.
pub fn build_body(change: &FieldChange) -> Option<String> {
    match change.field.as_str() {
        "status" => {
            let old = change.old_value.as_deref().unwrap_or("?");
            let new = change.new_value.as_deref().unwrap_or("?");
            Some(format!("Status: {old} \u{2192} {new}"))
        }
        "priority" => {
            let old = change.old_value.as_deref().unwrap_or("?");
            let new = change.new_value.as_deref().unwrap_or("?");
            Some(format!("Priority: {old} \u{2192} {new}"))
        }
        // comment_count handled separately via build_comment_body
        // All other fields do not produce notifications per NOTIF-07 scope
        _ => None,
    }
}

/// Build a notification body for a new comment event.
/// Parses the ticket's full detail JSON to extract the last comment.
pub fn build_comment_body(new_json: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(new_json).ok()?;
    let comments = value.pointer("/fields/comment/comments")?.as_array()?;
    let last = comments.last()?;
    let author = last
        .pointer("/author/displayName")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown");
    let body_text = last.get("body").and_then(|v| v.as_str()).unwrap_or("");
    let snippet = if body_text.len() > 60 {
        &body_text[..60]
    } else {
        body_text
    };
    Some(format!("Comment by {author} \u{2014} '{snippet}'"))
}

/// Check whether we should send notifications right now given quiet hours settings.
/// Delegates to `should_notify_now_at` with the current local time.
pub fn should_notify_now(prefs: &NotificationPrefs) -> bool {
    should_notify_now_at(prefs, chrono::Local::now())
}

/// Testable version of `should_notify_now` that accepts an explicit time.
fn should_notify_now_at(prefs: &NotificationPrefs, now: chrono::DateTime<chrono::Local>) -> bool {
    if !prefs.quiet_hours_enabled {
        return true;
    }
    let (Some(ref start), Some(ref end)) = (&prefs.quiet_start, &prefs.quiet_end) else {
        return true;
    };
    // Get day name
    let weekday = now.weekday();
    // num_days_from_sunday: Sun=0, Mon=1, ..., Sat=6
    let day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let day_name = day_names[weekday.num_days_from_sunday() as usize];
    if !prefs.quiet_days.iter().any(|d| d == day_name) {
        // Not a quiet day
        return true;
    }
    let current_hhmm = format!("{:02}:{:02}", now.hour(), now.minute());
    // Handle midnight wrap: if start > end, the quiet window crosses midnight
    if start <= end {
        // Normal window: quiet when start <= current < end
        !(*start <= current_hhmm && current_hhmm < *end)
    } else {
        // Midnight-crossing window: quiet when current >= start OR current < end
        !(current_hhmm >= *start || current_hhmm < *end)
    }
}

/// Check whether an event type should fire a notification given the current prefs.
pub fn should_filter_event(
    change_field: &str,
    is_new_ticket: bool,
    prefs: &NotificationPrefs,
) -> bool {
    if is_new_ticket {
        return prefs.notify_new_ticket;
    }
    match change_field {
        "status" => prefs.notify_status_change,
        "priority" => prefs.notify_priority_change,
        "comment_count" => prefs.notify_new_comment,
        _ => false,
    }
}

/// Dispatch OS notifications for all relevant changes to a ticket.
/// Called from `do_poll` in `poll_engine.rs` after `process_tickets`.
pub fn dispatch_notifications(
    app_handle: &tauri::AppHandle,
    ticket_key: &str,
    changes: &[FieldChange],
    new_json: &str,
    is_new_ticket: bool,
    prefs: &NotificationPrefs,
) {
    if !should_notify_now(prefs) {
        return;
    }
    if is_new_ticket && prefs.notify_new_ticket {
        app_handle
            .notification()
            .builder()
            .title(ticket_key)
            .body("New ticket matched watch criteria")
            .show()
            .unwrap_or_else(|e| eprintln!("[notify] send failed: {e}"));
    }
    for change in changes {
        if !should_filter_event(&change.field, false, prefs) {
            continue;
        }
        if change.field == "comment_count" {
            if let Some(body) = build_comment_body(new_json) {
                app_handle
                    .notification()
                    .builder()
                    .title(ticket_key)
                    .body(&body)
                    .show()
                    .unwrap_or_else(|e| eprintln!("[notify] send failed: {e}"));
            }
        } else if let Some(body) = build_body(change) {
            app_handle
                .notification()
                .builder()
                .title(ticket_key)
                .body(&body)
                .show()
                .unwrap_or_else(|e| eprintln!("[notify] send failed: {e}"));
        }
    }
}

// ─── Private helper imports ────────────────────────────────────────────────────
use chrono::Datelike as _;
use chrono::Timelike as _;

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Local, TimeZone as _};

    fn make_change(field: &str, old: Option<&str>, new: Option<&str>) -> FieldChange {
        FieldChange {
            field: field.to_string(),
            old_value: old.map(str::to_string),
            new_value: new.map(str::to_string),
        }
    }

    fn make_prefs_quiet(start: &str, end: &str, days: Vec<&str>) -> NotificationPrefs {
        NotificationPrefs {
            quiet_hours_enabled: true,
            quiet_start: Some(start.to_string()),
            quiet_end: Some(end.to_string()),
            quiet_days: days.into_iter().map(str::to_string).collect(),
            ..Default::default()
        }
    }

    // ── NotificationPrefs::default() ──────────────────────────────────────────

    #[test]
    fn test_default_notify_new_ticket_true() {
        assert!(NotificationPrefs::default().notify_new_ticket);
    }

    #[test]
    fn test_default_notify_status_change_true() {
        assert!(NotificationPrefs::default().notify_status_change);
    }

    #[test]
    fn test_default_notify_priority_change_true() {
        assert!(NotificationPrefs::default().notify_priority_change);
    }

    #[test]
    fn test_default_notify_new_comment_true() {
        assert!(NotificationPrefs::default().notify_new_comment);
    }

    #[test]
    fn test_default_quiet_hours_disabled() {
        assert!(!NotificationPrefs::default().quiet_hours_enabled);
    }

    #[test]
    fn test_default_quiet_days_mon_to_fri() {
        let prefs = NotificationPrefs::default();
        assert_eq!(
            prefs.quiet_days,
            vec!["Mon", "Tue", "Wed", "Thu", "Fri"],
            "default quiet_days should be Mon-Fri"
        );
    }

    // ── build_body ─────────────────────────────────────────────────────────────

    #[test]
    fn test_build_body_status_change() {
        let change = make_change("status", Some("Open"), Some("In Progress"));
        assert_eq!(
            build_body(&change).as_deref(),
            Some("Status: Open \u{2192} In Progress")
        );
    }

    #[test]
    fn test_build_body_priority_change() {
        let change = make_change("priority", Some("Medium"), Some("High"));
        assert_eq!(
            build_body(&change).as_deref(),
            Some("Priority: Medium \u{2192} High")
        );
    }

    #[test]
    fn test_build_body_comment_count_returns_none() {
        let change = make_change("comment_count", Some("1"), Some("2"));
        assert!(
            build_body(&change).is_none(),
            "comment_count uses separate build_comment_body path"
        );
    }

    #[test]
    fn test_build_body_assignee_returns_none() {
        let change = make_change("assignee", Some("Alice"), Some("Bob"));
        assert!(
            build_body(&change).is_none(),
            "assignee changes do not produce notifications"
        );
    }

    // ── build_comment_body ────────────────────────────────────────────────────

    #[test]
    fn test_build_comment_body_extracts_last_comment() {
        let json = serde_json::json!({
            "fields": {
                "comment": {
                    "comments": [
                        {
                            "author": {"displayName": "Alice"},
                            "body": "First comment"
                        },
                        {
                            "author": {"displayName": "Bob"},
                            "body": "Second comment reply"
                        }
                    ]
                }
            }
        })
        .to_string();
        let body = build_comment_body(&json).expect("should produce body");
        assert!(body.contains("Bob"), "should use the last comment's author");
        assert!(
            body.contains("Second comment reply"),
            "should contain the comment body"
        );
    }

    #[test]
    fn test_build_comment_body_truncates_at_60_chars() {
        let long_body = "A".repeat(80);
        let json = serde_json::json!({
            "fields": {
                "comment": {
                    "comments": [
                        {
                            "author": {"displayName": "Alice"},
                            "body": long_body
                        }
                    ]
                }
            }
        })
        .to_string();
        let body = build_comment_body(&json).expect("should produce body");
        // The snippet should be exactly 60 A's
        assert!(
            body.contains(&"A".repeat(60)),
            "body should contain 60-char truncated snippet"
        );
        assert!(
            !body.contains(&"A".repeat(61)),
            "body should not contain 61+ A chars"
        );
    }

    #[test]
    fn test_build_comment_body_default_author_when_missing() {
        let json = serde_json::json!({
            "fields": {
                "comment": {
                    "comments": [
                        {"body": "orphan comment"}
                    ]
                }
            }
        })
        .to_string();
        let body = build_comment_body(&json).expect("should produce body");
        assert!(
            body.contains("Unknown"),
            "missing author defaults to Unknown"
        );
    }

    // ── should_notify_now_at ──────────────────────────────────────────────────

    #[test]
    fn test_should_notify_now_quiet_disabled_always_true() {
        let prefs = NotificationPrefs::default(); // quiet_hours_enabled = false
                                                  // Construct any time — Wed 19:00
        let dt = Local.with_ymd_and_hms(2026, 3, 25, 19, 0, 0).unwrap(); // Wed
        assert!(should_notify_now_at(&prefs, dt));
    }

    #[test]
    fn test_quiet_window_blocks_notification_at_1900_wed() {
        // Quiet 18:00-08:00 Mon-Fri; at 19:00 Wed should be blocked
        let prefs = make_prefs_quiet("18:00", "08:00", vec!["Mon", "Tue", "Wed", "Thu", "Fri"]);
        let dt = Local.with_ymd_and_hms(2026, 3, 25, 19, 0, 0).unwrap(); // Wed
        assert!(
            !should_notify_now_at(&prefs, dt),
            "19:00 Wed inside quiet window"
        );
    }

    #[test]
    fn test_quiet_window_allows_notification_at_0900_wed() {
        // Quiet 18:00-08:00 Mon-Fri; at 09:00 Wed should be allowed (after end)
        let prefs = make_prefs_quiet("18:00", "08:00", vec!["Mon", "Tue", "Wed", "Thu", "Fri"]);
        let dt = Local.with_ymd_and_hms(2026, 3, 25, 9, 0, 0).unwrap(); // Wed
        assert!(
            should_notify_now_at(&prefs, dt),
            "09:00 Wed outside quiet window"
        );
    }

    #[test]
    fn test_quiet_window_saturday_not_a_quiet_day() {
        // Quiet 18:00-08:00 Mon-Fri; at 19:00 Sat should be allowed (weekend)
        let prefs = make_prefs_quiet("18:00", "08:00", vec!["Mon", "Tue", "Wed", "Thu", "Fri"]);
        let dt = Local.with_ymd_and_hms(2026, 3, 28, 19, 0, 0).unwrap(); // Sat
        assert!(should_notify_now_at(&prefs, dt), "Sat not a quiet day");
    }

    #[test]
    fn test_quiet_window_midnight_wrap_at_0030_wed() {
        // Quiet 18:00-08:00 Mon-Fri; at 00:30 Wed should be blocked (midnight wrap)
        let prefs = make_prefs_quiet("18:00", "08:00", vec!["Mon", "Tue", "Wed", "Thu", "Fri"]);
        let dt = Local.with_ymd_and_hms(2026, 3, 25, 0, 30, 0).unwrap(); // Wed
        assert!(
            !should_notify_now_at(&prefs, dt),
            "00:30 Wed inside midnight-wrap quiet window"
        );
    }

    // ── should_filter_event ───────────────────────────────────────────────────

    #[test]
    fn test_filter_event_status_true_when_enabled() {
        let prefs = NotificationPrefs::default();
        assert!(should_filter_event("status", false, &prefs));
    }

    #[test]
    fn test_filter_event_status_false_when_disabled() {
        let prefs = NotificationPrefs {
            notify_status_change: false,
            ..Default::default()
        };
        assert!(!should_filter_event("status", false, &prefs));
    }

    #[test]
    fn test_filter_event_priority_true_when_enabled() {
        let prefs = NotificationPrefs::default();
        assert!(should_filter_event("priority", false, &prefs));
    }

    #[test]
    fn test_filter_event_comment_false_when_disabled() {
        let prefs = NotificationPrefs {
            notify_new_comment: false,
            ..Default::default()
        };
        assert!(!should_filter_event("comment_count", false, &prefs));
    }

    #[test]
    fn test_filter_event_new_ticket_true_when_enabled() {
        let prefs = NotificationPrefs::default();
        assert!(should_filter_event("", true, &prefs));
    }

    #[test]
    fn test_filter_event_new_ticket_false_when_disabled() {
        let prefs = NotificationPrefs {
            notify_new_ticket: false,
            ..Default::default()
        };
        assert!(!should_filter_event("", true, &prefs));
    }
}
