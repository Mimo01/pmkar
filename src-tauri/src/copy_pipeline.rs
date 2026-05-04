//! Phase 23 — Copy pipeline shared seam.
//!
//! Owns `CopyContext` and the five extracted helpers (`copy_attachments`,
//! `copy_comments`, `copy_worklogs`, `copy_subtasks`, `add_remote_link`) used
//! by both the legacy `copy_ticket` command (during Phase 23 cutover) and the
//! new `copy_ticket_v2` command (Plan 23-03).
//!
//! All helpers are FREE async functions taking `&CopyContext`. `CopyContext` is
//! a thin credentials + client + keys carrier — NO business logic, NO mapping
//! pipeline types (D-09).
//!
//! `target_project_key` flows through `CopyContext` so the previously-hardcoded
//! `MYPROJ` debt is parameterized end-to-end (CUTV-04).

use crate::commands::CopyStepResult;
use serde_json::Value;

/// Thin credentials + client + keys carrier passed by reference to every helper.
/// (D-09 — no methods, no business logic.)
pub struct CopyContext {
    /// Audited HTTP client built via `build_audited_client(audit_db)`. Used for
    /// every source/target API call inside helpers EXCEPT multipart attachment
    /// uploads (which use a plain `reqwest::Client::new()` per existing pattern
    /// at commands.rs:1900 — `reqwest_middleware::ClientWithMiddleware` does
    /// not expose `.multipart()`).
    pub client: reqwest_middleware::ClientWithMiddleware,
    /// Pre-formatted `"Basic <base64(email:token)>"` header value for Cloud auth.
    pub cloud_auth: String,
    /// Plain Server PAT string. Helpers wrap as `"Bearer {server_pat}"` themselves.
    pub server_pat: String,
    /// Source base URL with trailing slash already stripped.
    pub source_base_url: String,
    /// Target base URL with trailing slash already stripped.
    pub target_base_url: String,
    pub source_key: String,
    /// Target Cloud issue key created by the create-issue step (e.g. "PROJ-123").
    pub target_key: String,
    /// Target Cloud project key (e.g. "MYPROJ" or "ACME"). Replaces the previous
    /// hardcoded literal — CUTV-04 parameterization seam.
    pub target_project_key: String,
}

/// Create the "copied from" remote link on the target Cloud issue.
/// Returns ONE `CopyStepResult` (step name `"add_remotelink"`).
/// Extracted from commands.rs lines 1828-1865.
pub async fn add_remote_link(ctx: &CopyContext, source_summary: &str) -> CopyStepResult {
    let encoded_source_url = urlencoding::encode(&ctx.source_base_url).to_string();
    let remote_link_body = serde_json::json!({
        "globalId": format!("pmkar-source={}&key={}", encoded_source_url, ctx.source_key),
        "object": {
            "url": format!("{}/browse/{}", ctx.source_base_url, ctx.source_key),
            "title": format!("{}: {}", ctx.source_key, source_summary)
        },
        "relationship": "copied from"
    });
    let remote_link_body_str = match serde_json::to_string(&remote_link_body) {
        Ok(s) => s,
        Err(e) => {
            return CopyStepResult {
                step: "add_remotelink".to_string(),
                success: false,
                detail: Some(format!("Failed to serialize remotelink body: {e}")),
            };
        }
    };

    let resp = ctx
        .client
        .post(format!(
            "{}/rest/api/3/issue/{}/remotelink",
            ctx.target_base_url, ctx.target_key
        ))
        .header("Authorization", &ctx.cloud_auth)
        .header("Content-Type", "application/json")
        .body(remote_link_body_str)
        .send()
        .await;

    match resp {
        Ok(r) => {
            let status = r.status().as_u16();
            let success = status < 300;
            CopyStepResult {
                step: "add_remotelink".to_string(),
                success,
                detail: if success {
                    None
                } else {
                    Some(format!("Remote link creation returned status {status}"))
                },
            }
        }
        Err(e) => CopyStepResult {
            step: "add_remotelink".to_string(),
            success: false,
            detail: Some(format!("Network error creating remote link: {e}")),
        },
    }
}

/// Copy attachments from source to target. Returns one `CopyStepResult` per
/// attachment (step names `"attach:<filename>"`).
/// Extracted verbatim from commands.rs lines 1867-1975. Uses `ctx.client` for the
/// download (audited) and a fresh `reqwest::Client::new()` for the multipart
/// upload (existing pattern: `ClientWithMiddleware` lacks `.multipart()`).
#[allow(clippy::too_many_lines)]
pub async fn copy_attachments(ctx: &CopyContext, source_body: &Value) -> Vec<CopyStepResult> {
    let mut out: Vec<CopyStepResult> = Vec::new();
    let attachments = source_body["fields"]["attachment"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    for att in &attachments {
        let download_url = att["content"].as_str().unwrap_or("");
        let filename = att["filename"].as_str().unwrap_or("file").to_string();
        let mime = att["mimeType"]
            .as_str()
            .unwrap_or("application/octet-stream")
            .to_string();

        if download_url.is_empty() {
            out.push(CopyStepResult {
                step: format!("attach:{filename}"),
                success: false,
                detail: Some("No download URL".to_string()),
            });
            continue;
        }

        // Security: validate attachment URL is from the same origin as source.
        let same_origin = url::Url::parse(&ctx.source_base_url)
            .ok()
            .zip(url::Url::parse(download_url).ok())
            .is_some_and(|(b, d)| {
                b.scheme() == d.scheme() && b.host() == d.host() && b.port() == d.port()
            });
        if !same_origin {
            out.push(CopyStepResult {
                step: format!("attach:{filename}"),
                success: false,
                detail: Some(
                    "Attachment URL is not from the configured source instance".to_string(),
                ),
            });
            continue;
        }

        // Download from source
        let dl_resp = ctx
            .client
            .get(download_url)
            .header("Authorization", format!("Bearer {}", ctx.server_pat))
            .send()
            .await;

        match dl_resp {
            Ok(resp) if resp.status().is_success() => match resp.bytes().await {
                Ok(file_bytes) => {
                    let plain_client = reqwest::Client::new();
                    let part = reqwest::multipart::Part::bytes(file_bytes.to_vec())
                        .file_name(filename.clone())
                        .mime_str(&mime)
                        .unwrap_or_else(|_| {
                            reqwest::multipart::Part::bytes(file_bytes.to_vec())
                                .file_name(filename.clone())
                        });
                    let form = reqwest::multipart::Form::new().part("file", part);

                    let up_resp = plain_client
                        .post(format!(
                            "{}/rest/api/3/issue/{}/attachments",
                            ctx.target_base_url, ctx.target_key
                        ))
                        .header("Authorization", &ctx.cloud_auth)
                        .header("X-Atlassian-Token", "no-check")
                        .multipart(form)
                        .send()
                        .await;

                    match up_resp {
                        Ok(r) if r.status().is_success() => {
                            out.push(CopyStepResult {
                                step: format!("attach:{filename}"),
                                success: true,
                                detail: None,
                            });
                        }
                        Ok(r) => {
                            let status = r.status().as_u16();
                            out.push(CopyStepResult {
                                step: format!("attach:{filename}"),
                                success: false,
                                detail: Some(format!("{status} upload error")),
                            });
                        }
                        Err(e) => {
                            out.push(CopyStepResult {
                                step: format!("attach:{filename}"),
                                success: false,
                                detail: Some(format!("Network error during upload: {e}")),
                            });
                        }
                    }
                }
                Err(_) => {
                    out.push(CopyStepResult {
                        step: format!("attach:{filename}"),
                        success: false,
                        detail: Some("Failed to read attachment bytes".to_string()),
                    });
                }
            },
            Ok(resp) => {
                let status = resp.status().as_u16();
                let detail = if status == 302 {
                    "Failed to download attachment (server may require Jira Server 8.17+)"
                        .to_string()
                } else {
                    format!("Download returned status {status}")
                };
                out.push(CopyStepResult {
                    step: format!("attach:{filename}"),
                    success: false,
                    detail: Some(detail),
                });
            }
            Err(e) => {
                out.push(CopyStepResult {
                    step: format!("attach:{filename}"),
                    success: false,
                    detail: Some(format!("Network error downloading attachment: {e}")),
                });
            }
        }
    }

    out
}

/// Copy comments. Step names `"comment:<n>"`.
/// Extracted from commands.rs lines 1977-2083.
pub async fn copy_comments(ctx: &CopyContext, source_body: &Value) -> Vec<CopyStepResult> {
    let mut out: Vec<CopyStepResult> = Vec::new();

    let rendered_comments = source_body["renderedFields"]["comment"]["comments"]
        .as_array()
        .cloned();
    let raw_comments = source_body["fields"]["comment"]["comments"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let mut comments_to_copy: Vec<&serde_json::Value> = raw_comments.iter().collect();
    // Sort by created field (ISO 8601 — lexicographic = chronological per D-04)
    comments_to_copy.sort_by(|a, b| {
        let a_date = a["created"].as_str().unwrap_or("");
        let b_date = b["created"].as_str().unwrap_or("");
        a_date.cmp(b_date)
    });

    for (idx, raw_comment) in comments_to_copy.iter().enumerate() {
        let author_name = raw_comment["author"]["displayName"]
            .as_str()
            .unwrap_or("Unknown");
        let created = raw_comment["created"].as_str().unwrap_or("");
        // Format: take YYYY-MM-DDTHH:MM -> YYYY-MM-DD HH:MM
        let date_formatted = if created.len() >= 16 {
            format!("{} {}", &created[..10], &created[11..16])
        } else {
            created.to_string()
        };
        let attribution = format!("{author_name} \u{2014} {date_formatted}");

        // Get HTML body from renderedFields if available, otherwise use raw body as text
        let comment_id = raw_comment["id"].as_str().unwrap_or("");
        let html_body: Option<String> = rendered_comments.as_ref().and_then(|rendered| {
            rendered
                .iter()
                .find(|rc| rc["id"].as_str() == Some(comment_id))
                .and_then(|rc| rc["body"].as_str().map(std::string::ToString::to_string))
        });

        let mut adf_doc: serde_json::Value = if let Some(html) = html_body {
            let adf_str = htmltoadf::convert_html_str_to_adf_str(html);
            serde_json::from_str(&adf_str).unwrap_or(serde_json::json!({
                "version": 1, "type": "doc", "content": []
            }))
        } else {
            // Fallback: wrap raw text as plain ADF paragraph
            let body_text = raw_comment["body"].as_str().unwrap_or("");
            serde_json::json!({
                "version": 1,
                "type": "doc",
                "content": [{
                    "type": "paragraph",
                    "content": [{ "type": "text", "text": body_text }]
                }]
            })
        };

        // Prepend attribution paragraph with bold mark
        let attribution_node = serde_json::json!({
            "type": "paragraph",
            "content": [{
                "type": "text",
                "text": attribution,
                "marks": [{ "type": "strong" }]
            }]
        });
        if let Some(content) = adf_doc["content"].as_array_mut() {
            content.insert(0, attribution_node);
        }

        // POST comment to Cloud
        let comment_body_str = serde_json::json!({ "body": adf_doc }).to_string();
        let comment_resp = ctx
            .client
            .post(format!(
                "{}/rest/api/3/issue/{}/comment",
                ctx.target_base_url, ctx.target_key
            ))
            .header("Authorization", &ctx.cloud_auth)
            .header("Content-Type", "application/json")
            .body(comment_body_str)
            .send()
            .await;

        match comment_resp {
            Ok(r) if r.status().is_success() => {
                out.push(CopyStepResult {
                    step: format!("comment:{}", idx + 1),
                    success: true,
                    detail: None,
                });
            }
            Ok(r) => {
                let status = r.status().as_u16();
                out.push(CopyStepResult {
                    step: format!("comment:{}", idx + 1),
                    success: false,
                    detail: Some(format!("Comment POST returned {status}")),
                });
            }
            Err(e) => {
                out.push(CopyStepResult {
                    step: format!("comment:{}", idx + 1),
                    success: false,
                    detail: Some(format!("Network error posting comment: {e}")),
                });
            }
        }
    }

    out
}

/// Copy worklogs. Step names `"worklog:<n>"`.
/// Extracted from commands.rs lines 2085-2168.
#[allow(clippy::too_many_lines)]
pub async fn copy_worklogs(ctx: &CopyContext) -> Vec<CopyStepResult> {
    let mut out: Vec<CopyStepResult> = Vec::new();

    let worklog_url = format!(
        "{}/rest/api/2/issue/{}/worklog",
        ctx.source_base_url, ctx.source_key
    );
    let wl_resp = ctx
        .client
        .get(&worklog_url)
        .header("Authorization", format!("Bearer {}", ctx.server_pat))
        .send()
        .await;

    let wl_response = match wl_resp {
        Ok(r) => r,
        Err(e) => {
            out.push(CopyStepResult {
                step: "worklog:fetch".to_string(),
                success: false,
                detail: Some(format!("Network error fetching worklogs from source: {e}")),
            });
            return out;
        }
    };
    if !wl_response.status().is_success() {
        out.push(CopyStepResult {
            step: "worklog:fetch".to_string(),
            success: false,
            detail: Some(format!(
                "Worklog fetch returned status {}",
                wl_response.status().as_u16()
            )),
        });
        return out;
    }
    let wl_body = match wl_response.json::<serde_json::Value>().await {
        Ok(b) => b,
        Err(e) => {
            out.push(CopyStepResult {
                step: "worklog:fetch".to_string(),
                success: false,
                detail: Some(format!("Failed to parse worklog response: {e}")),
            });
            return out;
        }
    };

    let worklogs = wl_body["worklogs"].as_array().cloned().unwrap_or_default();

    for (idx, wl) in worklogs.iter().enumerate() {
        let author_name = wl["author"]["displayName"].as_str().unwrap_or("Unknown");
        let started = wl["started"].as_str().unwrap_or("");
        let started_date = if started.len() >= 10 {
            &started[..10]
        } else {
            started
        };
        let time_spent = wl["timeSpent"].as_str().unwrap_or("?");
        let time_spent_seconds = wl["timeSpentSeconds"].as_i64().unwrap_or(0);

        let attribution = format!("{author_name} \u{2014} {started_date} ({time_spent})");

        let wl_comment_adf = serde_json::json!({
            "version": 1,
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": attribution,
                    "marks": [{ "type": "strong" }]
                }]
            }]
        });

        let wl_post_body = serde_json::json!({
            "timeSpentSeconds": time_spent_seconds,
            "started": started,
            "comment": wl_comment_adf
        });

        let wl_post_resp = ctx
            .client
            .post(format!(
                "{}/rest/api/3/issue/{}/worklog",
                ctx.target_base_url, ctx.target_key
            ))
            .header("Authorization", &ctx.cloud_auth)
            .header("Content-Type", "application/json")
            .body(wl_post_body.to_string())
            .send()
            .await;

        match wl_post_resp {
            Ok(r) if r.status().is_success() => {
                out.push(CopyStepResult {
                    step: format!("worklog:{}", idx + 1),
                    success: true,
                    detail: None,
                });
            }
            Ok(r) => {
                let status = r.status().as_u16();
                out.push(CopyStepResult {
                    step: format!("worklog:{}", idx + 1),
                    success: false,
                    detail: Some(format!("Worklog POST returned {status}")),
                });
            }
            Err(e) => {
                out.push(CopyStepResult {
                    step: format!("worklog:{}", idx + 1),
                    success: false,
                    detail: Some(format!("Network error posting worklog: {e}")),
                });
            }
        }
    }

    out
}

/// Copy sub-tasks as new child issues parented to `ctx.target_key`.
/// Step names `"subtask:<source_key>"` (success or failure).
/// Extracted from commands.rs lines 2170-2221.
///
/// CRITICAL CUTV-04: the inner POST body uses `ctx.target_project_key` — NOT a
/// literal — for the `"project": { "key": ... }` field.
pub async fn copy_subtasks(ctx: &CopyContext, subtasks: &[Value]) -> Vec<CopyStepResult> {
    let mut out: Vec<CopyStepResult> = Vec::new();
    for st in subtasks {
        let st_summary = st["fields"]["summary"].as_str().unwrap_or("Sub-task");
        let st_source_key = st["key"].as_str().unwrap_or("?");

        let st_create_body = serde_json::json!({
            "fields": {
                "project": { "key": ctx.target_project_key },  // CUTV-04 — was a parameter, now ctx
                "issuetype": { "name": "Sub-task" },
                "summary": st_summary,
                "parent": { "key": ctx.target_key }
            }
        });

        let st_create_resp = ctx
            .client
            .post(format!("{}/rest/api/3/issue", ctx.target_base_url))
            .header("Authorization", &ctx.cloud_auth)
            .header("Content-Type", "application/json")
            .body(serde_json::to_string(&st_create_body).unwrap_or_default())
            .send()
            .await;

        match st_create_resp {
            Ok(r) if r.status().is_success() => {
                let resp_text = r.text().await.unwrap_or_default();
                let resp_json: Value =
                    serde_json::from_str(&resp_text).unwrap_or(serde_json::json!({}));
                let child_key = resp_json["key"].as_str().unwrap_or("?");
                out.push(CopyStepResult {
                    step: format!("subtask:{st_source_key}"),
                    success: true,
                    detail: Some(format!("Created as {child_key}")),
                });
            }
            Ok(r) => {
                let status = r.status().as_u16();
                out.push(CopyStepResult {
                    step: format!("subtask:{st_source_key}"),
                    success: false,
                    detail: Some(format!("Sub-task creation returned {status}")),
                });
            }
            Err(e) => {
                out.push(CopyStepResult {
                    step: format!("subtask:{st_source_key}"),
                    success: false,
                    detail: Some(format!("Network error creating sub-task: {e}")),
                });
            }
        }
    }
    out
}
