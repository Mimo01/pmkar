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
}

impl Default for NotificationPrefs {
    fn default() -> Self {
        Self {
            notify_new_ticket: true,
            notify_status_change: true,
            notify_priority_change: true,
            notify_new_comment: true,
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
    let snippet = body_text
        .char_indices()
        .take(60)
        .last()
        .map_or(body_text, |(i, c)| &body_text[..i + c.len_utf8()]);
    Some(format!("Comment by {author} \u{2014} '{snippet}'"))
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_change(field: &str, old: Option<&str>, new: Option<&str>) -> FieldChange {
        FieldChange {
            field: field.to_string(),
            old_value: old.map(str::to_string),
            new_value: new.map(str::to_string),
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
