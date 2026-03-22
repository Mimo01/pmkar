use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// --- Shared field types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraUser {
    pub name: Option<String>, // Server v2 uses "name"
    #[serde(rename = "accountId")]
    pub account_id: Option<String>, // Cloud v3 uses "accountId"
    #[serde(rename = "displayName")]
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraStatus {
    pub name: String,
    pub id: Option<String>, // Server v2
    #[serde(rename = "statusCategory")]
    pub status_category: Option<StatusCategory>, // Cloud v3
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusCategory {
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraPriority {
    pub name: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraAttachment {
    pub id: String,
    pub filename: String,
    pub size: u64,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub content: String, // Download URL
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraComment {
    pub id: String,
    pub author: JiraUser,
    pub body: serde_json::Value, // String for v2, ADF object for v3
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraIssueLink {
    pub id: String,
    #[serde(rename = "type")]
    pub link_type: IssueLinkType,
    #[serde(rename = "outwardIssue")]
    pub outward_issue: Option<LinkedIssue>,
    #[serde(rename = "inwardIssue")]
    pub inward_issue: Option<LinkedIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssueLinkType {
    pub name: String,
    pub inward: String,
    pub outward: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedIssue {
    pub key: String,
    pub fields: LinkedIssueFields,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkedIssueFields {
    pub summary: String,
    pub status: JiraStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubTask {
    pub key: String,
    pub fields: SubTaskFields,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubTaskFields {
    pub summary: String,
    pub status: JiraStatus,
}

// --- ADF types (Cloud v3 description/comment format) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdfDoc {
    pub version: u8, // MUST be 1 — per Pitfall 5
    #[serde(rename = "type")]
    pub doc_type: String, // Always "doc"
    pub content: Vec<AdfNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdfNode {
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<Vec<AdfNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attrs: Option<serde_json::Value>,
}

impl AdfDoc {
    pub fn paragraph(text: &str) -> Self {
        AdfDoc {
            version: 1,
            doc_type: "doc".into(),
            content: vec![AdfNode {
                node_type: "paragraph".into(),
                content: Some(vec![AdfNode {
                    node_type: "text".into(),
                    content: None,
                    text: Some(text.into()),
                    attrs: None,
                }]),
                text: None,
                attrs: None,
            }],
        }
    }
}

// --- Issue struct and fixture state ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraIssue {
    pub id: String,
    pub key: String,
    pub fields: serde_json::Value, // Flexible to support both v2 and v3 shapes
}

#[derive(Debug, Clone)]
pub struct FixtureState {
    pub server_v2_issues: HashMap<String, JiraIssue>,
    pub cloud_v3_issues: HashMap<String, JiraIssue>,
    pub next_issue_id: u32,
}

pub type SharedFixtures = Arc<Mutex<FixtureState>>;

// Helper to create v2 user
fn v2_user(name: &str, display_name: &str) -> serde_json::Value {
    json!({ "name": name, "displayName": display_name })
}

// Helper to create v3 user
fn v3_user(account_id: &str, display_name: &str) -> serde_json::Value {
    json!({ "accountId": account_id, "displayName": display_name })
}

// Helper to create v2 status
fn v2_status(name: &str, id: &str) -> serde_json::Value {
    json!({ "name": name, "id": id })
}

// Helper to create v3 status
fn v3_status(name: &str, category_key: &str) -> serde_json::Value {
    json!({ "name": name, "statusCategory": { "key": category_key } })
}

// Helper to create v2 priority
fn priority(name: &str, id: &str) -> serde_json::Value {
    json!({ "name": name, "id": id })
}

// Helper to create ADF paragraph as serde_json::Value
fn adf_paragraph(text: &str) -> serde_json::Value {
    let doc = AdfDoc::paragraph(text);
    serde_json::to_value(doc).expect("AdfDoc serialization failed")
}

// Helper to create v2 comment body (plain text)
fn v2_comment(id: &str, author_name: &str, author_display: &str, body: &str, created: &str) -> serde_json::Value {
    json!({
        "id": id,
        "author": { "name": author_name, "displayName": author_display },
        "body": body,
        "created": created
    })
}

// Helper to create v3 comment body (ADF)
fn v3_comment(id: &str, account_id: &str, author_display: &str, body: &str, created: &str) -> serde_json::Value {
    json!({
        "id": id,
        "author": { "accountId": account_id, "displayName": author_display },
        "body": adf_paragraph(body),
        "created": created
    })
}

pub fn build_fixtures() -> SharedFixtures {
    let mut v2: HashMap<String, JiraIssue> = HashMap::new();
    let mut v3: HashMap<String, JiraIssue> = HashMap::new();

    // Users
    // v2: name-based, v3: accountId-based
    // jdoe -> acc-jdoe, csmith -> acc-csmith, bwilson -> acc-bwilson

    // PROJ-1: In Progress, High priority, with comments, attachment, subtasks
    {
        let key = "PROJ-1";
        let id = "10001";
        let summary = "Customer reported login failure after recent update";
        let desc_text = "Steps to reproduce:\n1. Navigate to login page\n2. Enter valid credentials\n3. Click Sign In\n4. Observe error 500 response";

        let subtasks = json!([
            { "key": "PROJ-7", "fields": { "summary": "Investigate session token expiry", "status": { "name": "In Progress", "id": "3" } } },
            { "key": "PROJ-8", "fields": { "summary": "Write regression test for login flow", "status": { "name": "Open", "id": "1" } } }
        ]);
        let subtasks_v3 = json!([
            { "key": "PROJ-7", "fields": { "summary": "Investigate session token expiry", "status": { "name": "In Progress", "statusCategory": { "key": "indeterminate" } } } },
            { "key": "PROJ-8", "fields": { "summary": "Write regression test for login flow", "status": { "name": "Open", "statusCategory": { "key": "new" } } } }
        ]);

        let attachment = json!([{
            "id": "10100",
            "filename": "screenshot.png",
            "size": 45231,
            "mimeType": "image/png",
            "content": "http://localhost:8080/secure/attachment/10100/screenshot.png"
        }]);
        let attachment_v3 = json!([{
            "id": "10100",
            "filename": "screenshot.png",
            "size": 45231,
            "mimeType": "image/png",
            "content": "http://localhost:8081/secure/attachment/10100/screenshot.png"
        }]);

        let comments_v2 = json!([
            v2_comment("20001", "jdoe", "Jane Doe", "I can reproduce this on build 4.2.1", "2026-01-15T10:30:00.000+0000"),
            v2_comment("20002", "csmith", "Chris Smith", "Confirmed. The session token has a 0-second TTL in the new config.", "2026-01-15T14:00:00.000+0000")
        ]);
        let comments_v3 = json!([
            v3_comment("20001", "acc-jdoe", "Jane Doe", "I can reproduce this on build 4.2.1", "2026-01-15T10:30:00.000+0000"),
            v3_comment("20002", "acc-csmith", "Chris Smith", "Confirmed. The session token has a 0-second TTL in the new config.", "2026-01-15T14:00:00.000+0000")
        ]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("In Progress", "3"),
                "priority": priority("High", "2"),
                "assignee": v2_user("jdoe", "Jane Doe"),
                "reporter": v2_user("csmith", "Chris Smith"),
                "description": desc_text,
                "comment": { "comments": comments_v2 },
                "attachment": attachment,
                "subtasks": subtasks,
                "issuelinks": [],
                "labels": ["bug"],
                "components": [{"name": "Backend"}],
                "fixVersions": [{"name": "4.3.0"}],
                "updated": "2026-02-28T10:00:00.000+0000",
                "worklog": { "worklogs": [
                    { "id": "40001", "author": {"name":"jdoe","displayName":"Jane Doe"}, "comment": "Investigated session config", "started": "2026-01-15T10:00:00.000+0000", "timeSpent": "2h", "timeSpentSeconds": 7200 }
                ]}
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("In Progress", "indeterminate"),
                "priority": priority("High", "2"),
                "assignee": v3_user("acc-jdoe", "Jane Doe"),
                "reporter": v3_user("acc-csmith", "Chris Smith"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": comments_v3 },
                "attachment": attachment_v3,
                "subtasks": subtasks_v3,
                "issuelinks": [],
                "labels": ["bug"],
                "components": [{"name": "Backend"}],
                "fixVersions": [{"name": "4.3.0"}],
                "updated": "2026-02-28T10:00:00.000+0000",
                "worklog": { "worklogs": [
                    { "id": "40001", "author": {"accountId":"acc-jdoe","displayName":"Jane Doe"}, "comment": "Investigated session config", "started": "2026-01-15T10:00:00.000+0000", "timeSpent": "2h", "timeSpentSeconds": 7200 }
                ]}
            }),
        });
    }

    // PROJ-2: Open, Critical priority, with issue links (blocks PROJ-3)
    {
        let key = "PROJ-2";
        let id = "10002";
        let summary = "Database connection pool exhausted under load";
        let desc_text = "Under load testing, the database connection pool is fully exhausted causing all API endpoints to return 503.";

        let issuelinks = json!([{
            "id": "30001",
            "type": { "name": "Blocks", "inward": "is blocked by", "outward": "blocks" },
            "outwardIssue": {
                "key": "PROJ-3",
                "fields": {
                    "summary": "API endpoints returning 503 in production",
                    "status": { "name": "Open", "id": "1" }
                }
            }
        }]);
        let issuelinks_v3 = json!([{
            "id": "30001",
            "type": { "name": "Blocks", "inward": "is blocked by", "outward": "blocks" },
            "outwardIssue": {
                "key": "PROJ-3",
                "fields": {
                    "summary": "API endpoints returning 503 in production",
                    "status": { "name": "Open", "statusCategory": { "key": "new" } }
                }
            }
        }]);

        let comments_v2 = json!([
            v2_comment("20003", "bwilson", "Bob Wilson", "Pool size is hardcoded to 5 in the Docker config. Need to increase.", "2026-02-01T09:00:00.000+0000"),
            v2_comment("20004", "jdoe", "Jane Doe", "Increasing pool size to 50 and adding connection timeout logic.", "2026-02-01T11:30:00.000+0000"),
            v2_comment("20005", "csmith", "Chris Smith", "PR #442 addresses this. Review requested.", "2026-02-02T08:15:00.000+0000")
        ]);
        let comments_v3 = json!([
            v3_comment("20003", "acc-bwilson", "Bob Wilson", "Pool size is hardcoded to 5 in the Docker config. Need to increase.", "2026-02-01T09:00:00.000+0000"),
            v3_comment("20004", "acc-jdoe", "Jane Doe", "Increasing pool size to 50 and adding connection timeout logic.", "2026-02-01T11:30:00.000+0000"),
            v3_comment("20005", "acc-csmith", "Chris Smith", "PR #442 addresses this. Review requested.", "2026-02-02T08:15:00.000+0000")
        ]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("Open", "1"),
                "priority": priority("Critical", "1"),
                "assignee": v2_user("bwilson", "Bob Wilson"),
                "reporter": v2_user("jdoe", "Jane Doe"),
                "description": desc_text,
                "comment": { "comments": comments_v2 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": issuelinks,
                "labels": ["bug"],
                "components": [{"name": "Backend"}],
                "fixVersions": [{"name": "4.3.0"}],
                "updated": "2026-02-27T09:00:00.000+0000",
                "worklog": { "worklogs": [
                    { "id": "40002", "author": {"name":"bwilson","displayName":"Bob Wilson"}, "comment": "Profiled connection pool under load", "started": "2026-02-01T09:00:00.000+0000", "timeSpent": "3h", "timeSpentSeconds": 10800 }
                ]}
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("Open", "new"),
                "priority": priority("Critical", "1"),
                "assignee": v3_user("acc-bwilson", "Bob Wilson"),
                "reporter": v3_user("acc-jdoe", "Jane Doe"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": comments_v3 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": issuelinks_v3,
                "labels": ["bug"],
                "components": [{"name": "Backend"}],
                "fixVersions": [{"name": "4.3.0"}],
                "updated": "2026-02-27T09:00:00.000+0000",
                "worklog": { "worklogs": [
                    { "id": "40002", "author": {"accountId":"acc-bwilson","displayName":"Bob Wilson"}, "comment": "Profiled connection pool under load", "started": "2026-02-01T09:00:00.000+0000", "timeSpent": "3h", "timeSpentSeconds": 10800 }
                ]}
            }),
        });
    }

    // PROJ-3: Open, High priority, blocked by PROJ-2
    {
        let key = "PROJ-3";
        let id = "10003";
        let summary = "API endpoints returning 503 in production";
        let desc_text = "Multiple API endpoints are returning HTTP 503 Service Unavailable during peak hours. Root cause appears to be database exhaustion (see PROJ-2).";

        let issuelinks = json!([{
            "id": "30002",
            "type": { "name": "Blocks", "inward": "is blocked by", "outward": "blocks" },
            "inwardIssue": {
                "key": "PROJ-2",
                "fields": {
                    "summary": "Database connection pool exhausted under load",
                    "status": { "name": "Open", "id": "1" }
                }
            }
        }]);
        let issuelinks_v3 = json!([{
            "id": "30002",
            "type": { "name": "Blocks", "inward": "is blocked by", "outward": "blocks" },
            "inwardIssue": {
                "key": "PROJ-2",
                "fields": {
                    "summary": "Database connection pool exhausted under load",
                    "status": { "name": "Open", "statusCategory": { "key": "new" } }
                }
            }
        }]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("Open", "1"),
                "priority": priority("High", "2"),
                "assignee": v2_user("csmith", "Chris Smith"),
                "reporter": v2_user("bwilson", "Bob Wilson"),
                "description": desc_text,
                "comment": { "comments": [] },
                "attachment": [],
                "subtasks": [],
                "issuelinks": issuelinks,
                "labels": ["bug"],
                "components": [{"name": "Backend"}],
                "fixVersions": [{"name": "4.3.0"}],
                "updated": "2026-02-26T08:00:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("Open", "new"),
                "priority": priority("High", "2"),
                "assignee": v3_user("acc-csmith", "Chris Smith"),
                "reporter": v3_user("acc-bwilson", "Bob Wilson"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": [] },
                "attachment": [],
                "subtasks": [],
                "issuelinks": issuelinks_v3,
                "labels": ["bug"],
                "components": [{"name": "Backend"}],
                "fixVersions": [{"name": "4.3.0"}],
                "updated": "2026-02-26T08:00:00.000+0000"
            }),
        });
    }

    // PROJ-4: Resolved, Medium priority, with attachment
    {
        let key = "PROJ-4";
        let id = "10004";
        let summary = "Export to CSV produces malformed output for special characters";
        let desc_text = "When exporting tickets containing UTF-8 special characters (accented letters, CJK), the CSV output is corrupted. Affected: ticket summaries, descriptions, comment bodies.";

        let attachment = json!([{
            "id": "10101",
            "filename": "malformed-export.csv",
            "size": 8192,
            "mimeType": "text/csv",
            "content": "http://localhost:8080/secure/attachment/10101/malformed-export.csv"
        }]);
        let attachment_v3 = json!([{
            "id": "10101",
            "filename": "malformed-export.csv",
            "size": 8192,
            "mimeType": "text/csv",
            "content": "http://localhost:8081/secure/attachment/10101/malformed-export.csv"
        }]);

        let comments_v2 = json!([
            v2_comment("20006", "jdoe", "Jane Doe", "Fixed by forcing UTF-8 BOM in CSV header. PR #401 merged.", "2026-01-20T16:00:00.000+0000")
        ]);
        let comments_v3 = json!([
            v3_comment("20006", "acc-jdoe", "Jane Doe", "Fixed by forcing UTF-8 BOM in CSV header. PR #401 merged.", "2026-01-20T16:00:00.000+0000")
        ]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("Resolved", "5"),
                "priority": priority("Medium", "3"),
                "assignee": v2_user("jdoe", "Jane Doe"),
                "reporter": v2_user("csmith", "Chris Smith"),
                "description": desc_text,
                "comment": { "comments": comments_v2 },
                "attachment": attachment,
                "subtasks": [],
                "issuelinks": [],
                "labels": ["maintenance"],
                "components": [{"name": "Frontend"}],
                "fixVersions": [{"name": "4.2.1"}],
                "updated": "2026-01-20T16:00:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("Resolved", "done"),
                "priority": priority("Medium", "3"),
                "assignee": v3_user("acc-jdoe", "Jane Doe"),
                "reporter": v3_user("acc-csmith", "Chris Smith"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": comments_v3 },
                "attachment": attachment_v3,
                "subtasks": [],
                "issuelinks": [],
                "labels": ["maintenance"],
                "components": [{"name": "Frontend"}],
                "fixVersions": [{"name": "4.2.1"}],
                "updated": "2026-01-20T16:00:00.000+0000"
            }),
        });
    }

    // PROJ-5: Closed, Low priority, minimal fields
    {
        let key = "PROJ-5";
        let id = "10005";
        let summary = "Update footer copyright year to 2026";
        let desc_text = "The footer displays copyright 2024. Update to 2026.";

        let comments_v2 = json!([
            v2_comment("20007", "bwilson", "Bob Wilson", "Done in commit a3f9b2c.", "2026-01-02T10:00:00.000+0000")
        ]);
        let comments_v3 = json!([
            v3_comment("20007", "acc-bwilson", "Bob Wilson", "Done in commit a3f9b2c.", "2026-01-02T10:00:00.000+0000")
        ]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("Closed", "6"),
                "priority": priority("Low", "4"),
                "assignee": v2_user("bwilson", "Bob Wilson"),
                "reporter": v2_user("jdoe", "Jane Doe"),
                "description": desc_text,
                "comment": { "comments": comments_v2 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["maintenance"],
                "components": [],
                "fixVersions": [{"name": "4.2.1"}],
                "updated": "2026-01-02T10:00:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("Closed", "done"),
                "priority": priority("Low", "4"),
                "assignee": v3_user("acc-bwilson", "Bob Wilson"),
                "reporter": v3_user("acc-jdoe", "Jane Doe"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": comments_v3 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["maintenance"],
                "components": [],
                "fixVersions": [{"name": "4.2.1"}],
                "updated": "2026-01-02T10:00:00.000+0000"
            }),
        });
    }

    // PROJ-6: Reopened, High priority, with attachment and comments
    {
        let key = "PROJ-6";
        let id = "10006";
        let summary = "Search results do not respect permission filters";
        let desc_text = "Users with restricted access can see ticket summaries in search results even when they lack read permission on the project. This is a security regression from v3.8.";

        let attachment = json!([{
            "id": "10102",
            "filename": "error-log.txt",
            "size": 12048,
            "mimeType": "text/plain",
            "content": "http://localhost:8080/secure/attachment/10102/error-log.txt"
        }]);
        let attachment_v3 = json!([{
            "id": "10102",
            "filename": "error-log.txt",
            "size": 12048,
            "mimeType": "text/plain",
            "content": "http://localhost:8081/secure/attachment/10102/error-log.txt"
        }]);

        let comments_v2 = json!([
            v2_comment("20008", "csmith", "Chris Smith", "The permission check was removed in PR #389 by mistake.", "2026-02-10T09:30:00.000+0000"),
            v2_comment("20009", "jdoe", "Jane Doe", "Fix verified in staging. Reopening because prod deployment failed.", "2026-02-15T17:00:00.000+0000")
        ]);
        let comments_v3 = json!([
            v3_comment("20008", "acc-csmith", "Chris Smith", "The permission check was removed in PR #389 by mistake.", "2026-02-10T09:30:00.000+0000"),
            v3_comment("20009", "acc-jdoe", "Jane Doe", "Fix verified in staging. Reopening because prod deployment failed.", "2026-02-15T17:00:00.000+0000")
        ]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("Reopened", "4"),
                "priority": priority("High", "2"),
                "assignee": v2_user("csmith", "Chris Smith"),
                "reporter": v2_user("bwilson", "Bob Wilson"),
                "description": desc_text,
                "comment": { "comments": comments_v2 },
                "attachment": attachment,
                "subtasks": [],
                "issuelinks": [],
                "labels": ["bug"],
                "components": [{"name": "Frontend"}],
                "fixVersions": [],
                "updated": "2026-02-15T17:00:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("Reopened", "new"),
                "priority": priority("High", "2"),
                "assignee": v3_user("acc-csmith", "Chris Smith"),
                "reporter": v3_user("acc-bwilson", "Bob Wilson"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": comments_v3 },
                "attachment": attachment_v3,
                "subtasks": [],
                "issuelinks": [],
                "labels": ["bug"],
                "components": [{"name": "Frontend"}],
                "fixVersions": [],
                "updated": "2026-02-15T17:00:00.000+0000"
            }),
        });
    }

    // PROJ-7: In Progress (subtask of PROJ-1)
    {
        let key = "PROJ-7";
        let id = "10007";
        let summary = "Investigate session token expiry";
        let desc_text = "Track down why session tokens are expiring immediately. Check auth service config and JWT TTL settings.";

        let comments_v2 = json!([
            v2_comment("20010", "jdoe", "Jane Doe", "JWT_TTL env var is set to 0 in prod config. This is the bug.", "2026-01-16T09:00:00.000+0000")
        ]);
        let comments_v3 = json!([
            v3_comment("20010", "acc-jdoe", "Jane Doe", "JWT_TTL env var is set to 0 in prod config. This is the bug.", "2026-01-16T09:00:00.000+0000")
        ]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("In Progress", "3"),
                "priority": priority("High", "2"),
                "assignee": v2_user("jdoe", "Jane Doe"),
                "reporter": v2_user("jdoe", "Jane Doe"),
                "description": desc_text,
                "comment": { "comments": comments_v2 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": [],
                "components": [{"name": "Backend"}],
                "fixVersions": [],
                "updated": "2026-01-16T09:00:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("In Progress", "indeterminate"),
                "priority": priority("High", "2"),
                "assignee": v3_user("acc-jdoe", "Jane Doe"),
                "reporter": v3_user("acc-jdoe", "Jane Doe"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": comments_v3 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": [],
                "components": [{"name": "Backend"}],
                "fixVersions": [],
                "updated": "2026-01-16T09:00:00.000+0000"
            }),
        });
    }

    // PROJ-8: Open (subtask of PROJ-1)
    {
        let key = "PROJ-8";
        let id = "10008";
        let summary = "Write regression test for login flow";
        let desc_text = "Add integration test that covers the full login flow including session token validation to prevent regression of PROJ-1.";

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("Open", "1"),
                "priority": priority("Medium", "3"),
                "assignee": v2_user("csmith", "Chris Smith"),
                "reporter": v2_user("jdoe", "Jane Doe"),
                "description": desc_text,
                "comment": { "comments": [] },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["maintenance"],
                "components": [],
                "fixVersions": [],
                "updated": "2026-01-15T08:00:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("Open", "new"),
                "priority": priority("Medium", "3"),
                "assignee": v3_user("acc-csmith", "Chris Smith"),
                "reporter": v3_user("acc-jdoe", "Jane Doe"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": [] },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["maintenance"],
                "components": [],
                "fixVersions": [],
                "updated": "2026-01-15T08:00:00.000+0000"
            }),
        });
    }

    // PROJ-9: Open, Medium priority, with subtasks
    {
        let key = "PROJ-9";
        let id = "10009";
        let summary = "Migrate CI pipeline from Jenkins to GitHub Actions";
        let desc_text = "Jenkins license expires in Q1 2026. Migrate all CI/CD pipelines to GitHub Actions. Covers: build, test, lint, deploy-staging, deploy-prod.";

        let subtasks_v2 = json!([
            { "key": "PROJ-10", "fields": { "summary": "Migrate build and test jobs", "status": { "name": "In Progress", "id": "3" } } },
            { "key": "PROJ-11", "fields": { "summary": "Migrate deploy-staging job", "status": { "name": "Open", "id": "1" } } }
        ]);
        let subtasks_v3 = json!([
            { "key": "PROJ-10", "fields": { "summary": "Migrate build and test jobs", "status": { "name": "In Progress", "statusCategory": { "key": "indeterminate" } } } },
            { "key": "PROJ-11", "fields": { "summary": "Migrate deploy-staging job", "status": { "name": "Open", "statusCategory": { "key": "new" } } } }
        ]);

        let comments_v2 = json!([
            v2_comment("20011", "bwilson", "Bob Wilson", "Using reusable workflow pattern for deploy jobs to avoid duplication.", "2026-02-20T10:00:00.000+0000")
        ]);
        let comments_v3 = json!([
            v3_comment("20011", "acc-bwilson", "Bob Wilson", "Using reusable workflow pattern for deploy jobs to avoid duplication.", "2026-02-20T10:00:00.000+0000")
        ]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("In Progress", "3"),
                "priority": priority("Medium", "3"),
                "assignee": v2_user("bwilson", "Bob Wilson"),
                "reporter": v2_user("csmith", "Chris Smith"),
                "description": desc_text,
                "comment": { "comments": comments_v2 },
                "attachment": [],
                "subtasks": subtasks_v2,
                "issuelinks": [],
                "labels": ["enhancement"],
                "components": [{"name": "Frontend"}],
                "fixVersions": [],
                "updated": "2026-02-25T10:00:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("In Progress", "indeterminate"),
                "priority": priority("Medium", "3"),
                "assignee": v3_user("acc-bwilson", "Bob Wilson"),
                "reporter": v3_user("acc-csmith", "Chris Smith"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": comments_v3 },
                "attachment": [],
                "subtasks": subtasks_v3,
                "issuelinks": [],
                "labels": ["enhancement"],
                "components": [{"name": "Frontend"}],
                "fixVersions": [],
                "updated": "2026-02-25T10:00:00.000+0000"
            }),
        });
    }

    // PROJ-10: In Progress (subtask of PROJ-9)
    {
        let key = "PROJ-10";
        let id = "10010";
        let summary = "Migrate build and test jobs";
        let desc_text = "Set up GitHub Actions workflow for build (Rust + frontend) and test (cargo test + vitest) stages.";

        let comments_v2 = json!([
            v2_comment("20012", "bwilson", "Bob Wilson", "Build job done. Tests failing due to missing env vars in Actions secrets.", "2026-02-22T14:00:00.000+0000"),
            v2_comment("20013", "csmith", "Chris Smith", "Added JIRA_TOKEN and DB_URL to repo secrets. Tests should pass now.", "2026-02-23T09:30:00.000+0000")
        ]);
        let comments_v3 = json!([
            v3_comment("20012", "acc-bwilson", "Bob Wilson", "Build job done. Tests failing due to missing env vars in Actions secrets.", "2026-02-22T14:00:00.000+0000"),
            v3_comment("20013", "acc-csmith", "Chris Smith", "Added JIRA_TOKEN and DB_URL to repo secrets. Tests should pass now.", "2026-02-23T09:30:00.000+0000")
        ]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("In Progress", "3"),
                "priority": priority("Medium", "3"),
                "assignee": v2_user("bwilson", "Bob Wilson"),
                "reporter": v2_user("bwilson", "Bob Wilson"),
                "description": desc_text,
                "comment": { "comments": comments_v2 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["enhancement"],
                "components": [{"name": "Backend"}],
                "fixVersions": [],
                "updated": "2026-02-23T09:30:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("In Progress", "indeterminate"),
                "priority": priority("Medium", "3"),
                "assignee": v3_user("acc-bwilson", "Bob Wilson"),
                "reporter": v3_user("acc-bwilson", "Bob Wilson"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": comments_v3 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["enhancement"],
                "components": [{"name": "Backend"}],
                "fixVersions": [],
                "updated": "2026-02-23T09:30:00.000+0000"
            }),
        });
    }

    // PROJ-11: Open (subtask of PROJ-9)
    {
        let key = "PROJ-11";
        let id = "10011";
        let summary = "Migrate deploy-staging job";
        let desc_text = "Create GitHub Actions workflow for deploy-staging that triggers on merge to main. Must include smoke test after deploy.";

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("Open", "1"),
                "priority": priority("Medium", "3"),
                "assignee": v2_user("csmith", "Chris Smith"),
                "reporter": v2_user("bwilson", "Bob Wilson"),
                "description": desc_text,
                "comment": { "comments": [] },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["enhancement"],
                "components": [{"name": "Frontend"}],
                "fixVersions": [],
                "updated": "2026-02-20T08:00:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("Open", "new"),
                "priority": priority("Medium", "3"),
                "assignee": v3_user("acc-csmith", "Chris Smith"),
                "reporter": v3_user("acc-bwilson", "Bob Wilson"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": [] },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["enhancement"],
                "components": [{"name": "Frontend"}],
                "fixVersions": [],
                "updated": "2026-02-20T08:00:00.000+0000"
            }),
        });
    }

    // PROJ-12: Closed, Low priority, with multiple comments
    {
        let key = "PROJ-12";
        let id = "10012";
        let summary = "Add rate limiting to public API endpoints";
        let desc_text = "Public API endpoints have no rate limiting. Add 100 req/min per API key limit to prevent abuse. Use token bucket algorithm.";

        let comments_v2 = json!([
            v2_comment("20014", "csmith", "Chris Smith", "Implemented with tower middleware. Rate limit: 100/min sliding window.", "2026-01-28T11:00:00.000+0000"),
            v2_comment("20015", "jdoe", "Jane Doe", "Load test confirms limits are enforced correctly. Closing.", "2026-01-29T16:30:00.000+0000")
        ]);
        let comments_v3 = json!([
            v3_comment("20014", "acc-csmith", "Chris Smith", "Implemented with tower middleware. Rate limit: 100/min sliding window.", "2026-01-28T11:00:00.000+0000"),
            v3_comment("20015", "acc-jdoe", "Jane Doe", "Load test confirms limits are enforced correctly. Closing.", "2026-01-29T16:30:00.000+0000")
        ]);

        v2.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v2_status("Closed", "6"),
                "priority": priority("Low", "4"),
                "assignee": v2_user("csmith", "Chris Smith"),
                "reporter": v2_user("jdoe", "Jane Doe"),
                "description": desc_text,
                "comment": { "comments": comments_v2 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["maintenance"],
                "components": [],
                "fixVersions": [],
                "updated": "2026-01-29T16:30:00.000+0000"
            }),
        });
        v3.insert(key.to_string(), JiraIssue {
            id: id.to_string(),
            key: key.to_string(),
            fields: json!({
                "summary": summary,
                "status": v3_status("Closed", "done"),
                "priority": priority("Low", "4"),
                "assignee": v3_user("acc-csmith", "Chris Smith"),
                "reporter": v3_user("acc-jdoe", "Jane Doe"),
                "description": adf_paragraph(desc_text),
                "comment": { "comments": comments_v3 },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "labels": ["maintenance"],
                "components": [],
                "fixVersions": [],
                "updated": "2026-01-29T16:30:00.000+0000"
            }),
        });
    }

    Arc::new(Mutex::new(FixtureState {
        server_v2_issues: v2,
        cloud_v3_issues: v3,
        next_issue_id: 10013,
    }))
}
