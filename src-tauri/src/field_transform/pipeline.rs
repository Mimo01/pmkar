//! Phase 18 — pipeline.rs: `apply_mapping` two-phase entry point.
//! Phase 1: pre-scan + batch user resolution (TRAN-06).
//! Phase 2: per-row dispatch by `FieldSchemaType`, write-shape correct (Pitfall 4).
//! Output: `Ok(ResolvedFields { fields, gaps })` — never `Err` for business gaps (D-01).
//! Returns `Err(TransformError::DuplicateTargetField)` when the mapping slice
//! contains two rows targeting the same `target_field_id` (T-525-02 guard).

use crate::field_discovery::FieldSchemaType;
use crate::field_transform::{identity, wiki_to_adf, FieldMappingRow};
use crate::field_transform::{
    user::extract_usernames_from_field, user::is_user_field, GapVariant, ResolvedFields,
    TransformContext, TransformError, UnresolvedComponent, UnresolvedPerson, UnresolvedVersion,
};
use serde_json::{json, Map, Value};
use std::collections::HashSet;

pub async fn apply_mapping(
    source_issue: &Value,
    mapping: &[FieldMappingRow],
    ctx: &TransformContext<'_>,
) -> Result<ResolvedFields, TransformError> {
    // PHASE 1 already complete — `ctx.user_map` is the pre-built map populated
    // by the caller via `ctx.user_resolver.resolve_batch(source_issue, mapping)`.
    // (We accept the map as part of the context so callers can reuse a single
    //  batch across multiple apply_mapping invocations if needed.)

    // PHASE 2: per-row dispatch.
    let mut fields: Map<String, Value> = Map::new();
    let mut gaps: Vec<GapVariant> = Vec::new();

    // Guard: reject mappings with duplicate target_field_ids before any insert.
    // Empty-sentinel rows (target_field_id="") are excluded — they represent
    // "no target selected yet" and do not write to the fields map.
    let mut seen_targets: HashSet<&str> = HashSet::new();
    for row in mapping {
        if row.target_field_id.is_empty() {
            continue;
        }
        if !seen_targets.insert(row.target_field_id.as_str()) {
            return Err(TransformError::DuplicateTargetField(
                row.target_field_id.clone(),
            ));
        }
    }

    for row in mapping {
        let path = format!("/fields/{}", row.source_field_id);
        let src_val = source_issue.pointer(&path).cloned().unwrap_or(Value::Null);

        // Description gets renderedFields preference per Pitfall C — the wiki_to_adf
        // module handles raw vs rendered, but here we hand it the right string.
        if is_description_row(&row.source_schema) {
            // Prefer rendered HTML (commands.rs:1640-1660 pattern). Fall back to raw.
            let html = source_issue
                .pointer(&format!("/renderedFields/{}", row.source_field_id))
                .and_then(|v| v.as_str())
                .map(str::to_string)
                .or_else(|| src_val.as_str().map(str::to_string))
                .unwrap_or_default();
            let adf = wiki_to_adf::convert_and_postprocess(&html, ctx.user_map);
            fields.insert(row.target_field_id.clone(), adf);
            continue;
        }

        // User / Array<user>
        if is_user_field(&row.source_schema) {
            match row.transformer_kind.as_str() {
                "user_name" => dispatch_user_name(row, &src_val, &mut fields),
                "user" | "auto" | "" => dispatch_user(row, &src_val, ctx, &mut fields, &mut gaps),
                other => {
                    // Unknown kind: log and fall back rather than silently using the wrong path.
                    eprintln!(
                        "field_transform: unknown transformer_kind {:?} for user field {:?}",
                        other, row.source_field_id
                    );
                    dispatch_user(row, &src_val, ctx, &mut fields, &mut gaps);
                }
            }
            continue;
        }

        // Array<version>
        if is_array_of(&row.source_schema, "version") {
            dispatch_version_array(row, &src_val, ctx, &mut fields, &mut gaps).await;
            continue;
        }

        // Array<component>
        if is_array_of(&row.source_schema, "component") {
            dispatch_component_array(row, &src_val, ctx, &mut fields, &mut gaps).await;
            continue;
        }

        // Priority — intentionally excluded from apply_mapping output.
        // Source priority IDs (e.g. Jira Server "3") are namespace-local and have no
        // meaning on Cloud Jira. Priority is always resolved client-side via
        // startPreview (name-matched from fetch_cloud_meta.availablePriorities) and
        // emitted as an override_values entry in confirmCopy. Forwarding the source ID
        // here would cause Cloud Jira to silently ignore the field and set it to null.
        if is_priority_row(&row.target_schema) {
            continue;
        }

        // Everything else → identity (write-shape stripping per Pitfall 4 lives there).
        let v = identity::transform_identity(&src_val, &row.target_schema);
        if !v.is_null() {
            fields.insert(row.target_field_id.clone(), v);
        }
        // Null result means "not applicable / unsupported" — silently skip.
    }

    Ok(ResolvedFields { fields, gaps })
}

fn is_description_row(s: &FieldSchemaType) -> bool {
    matches!(s, FieldSchemaType::String { system: Some(name), .. } if name == "description")
}

fn is_array_of(s: &FieldSchemaType, item_kind: &str) -> bool {
    matches!(s, FieldSchemaType::Array { items, .. } if items == item_kind)
}

fn is_priority_row(s: &FieldSchemaType) -> bool {
    matches!(s, FieldSchemaType::Priority)
}

/// Extracts the display name (or username fallback) from a source user field and
/// writes it as a plain string. Used when `transformer_kind` == `"user_name"` and
/// the target field is a text type.
///
/// For single user: writes the displayName string (falls back to name, then empty).
/// For array<user>: joins all display names with ", ".
fn dispatch_user_name(row: &FieldMappingRow, src_val: &Value, fields: &mut Map<String, Value>) {
    let extract_name = |obj: &Value| -> String {
        if let Some(n) = obj.get("displayName").and_then(|x| x.as_str()) {
            if !n.is_empty() {
                return n.to_string();
            }
        }
        if let Some(n) = obj.get("name").and_then(|x| x.as_str()) {
            if !n.is_empty() {
                return n.to_string();
            }
        }
        String::new()
    };

    let result = if let Some(arr) = src_val.as_array() {
        let names: Vec<String> = arr
            .iter()
            .map(extract_name)
            .filter(|n| !n.is_empty())
            .collect();
        if names.is_empty() {
            return;
        }
        names.join(", ")
    } else if src_val.is_object() {
        let name = extract_name(src_val);
        if name.is_empty() {
            return;
        }
        name
    } else {
        return;
    };

    fields.insert(row.target_field_id.clone(), Value::String(result));
}

fn dispatch_user(
    row: &FieldMappingRow,
    src_val: &Value,
    ctx: &TransformContext<'_>,
    fields: &mut Map<String, Value>,
    gaps: &mut Vec<GapVariant>,
) {
    // Single user shape vs Array<user> shape.
    let is_array = matches!(&row.source_schema, FieldSchemaType::Array { .. });
    if is_array {
        // Partial resolution per D-03.
        let mut resolved: Vec<Value> = Vec::new();
        if let Some(arr) = src_val.as_array() {
            for entry in arr {
                let username = entry
                    .get("name")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();
                let email = entry
                    .get("emailAddress")
                    .and_then(|x| x.as_str())
                    .map(str::to_string);
                let key = entry
                    .get("key")
                    .and_then(|x| x.as_str())
                    .map(str::to_string);
                match ctx.user_map.get(&username).and_then(|v| v.as_ref()) {
                    Some(account_id) => {
                        resolved.push(json!({ "accountId": account_id.as_str() }));
                    }
                    None => {
                        gaps.push(GapVariant::Person(UnresolvedPerson {
                            target_field_id: row.target_field_id.clone(),
                            source_username: if username.is_empty() {
                                None
                            } else {
                                Some(username)
                            },
                            source_key: key,
                            source_email: email,
                        }));
                    }
                }
            }
        }
        // Insert ONLY if at least one resolution succeeded; otherwise omit field
        // (writing an empty array is still a valid operation, but Phase 22's
        //  required-field gating should drive whether to demand the field).
        if !resolved.is_empty() {
            fields.insert(row.target_field_id.clone(), Value::Array(resolved));
        }
    } else {
        // Single user.
        let names = extract_usernames_from_field(src_val);
        let username = names.into_iter().next().unwrap_or_default();
        let email = src_val
            .get("emailAddress")
            .and_then(|x| x.as_str())
            .map(str::to_string);
        let key = src_val
            .get("key")
            .and_then(|x| x.as_str())
            .map(str::to_string);
        if username.is_empty() {
            // Field is null/missing — emit a gap so Phase 22 prompts the user.
            // Only emit if target requires it. Phase 18 doesn't read required-ness;
            // emit regardless and let Phase 22 filter via target schema.
            gaps.push(GapVariant::Person(UnresolvedPerson {
                target_field_id: row.target_field_id.clone(),
                source_username: None,
                source_key: key,
                source_email: email,
            }));
            return;
        }
        match ctx.user_map.get(&username).and_then(|v| v.as_ref()) {
            Some(account_id) => {
                fields.insert(
                    row.target_field_id.clone(),
                    json!({ "accountId": account_id.as_str() }),
                );
            }
            None => {
                gaps.push(GapVariant::Person(UnresolvedPerson {
                    target_field_id: row.target_field_id.clone(),
                    source_username: Some(username),
                    source_key: key,
                    source_email: email,
                }));
            }
        }
    }
}

async fn dispatch_version_array(
    row: &FieldMappingRow,
    src_val: &Value,
    ctx: &TransformContext<'_>,
    fields: &mut Map<String, Value>,
    gaps: &mut Vec<GapVariant>,
) {
    let mut resolved: Vec<Value> = Vec::new();
    if let Some(arr) = src_val.as_array() {
        for entry in arr {
            let name = entry
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            if name.is_empty() {
                continue;
            }
            match ctx
                .version_resolver
                .resolve_name(ctx.target_project_key, &name)
                .await
            {
                Some(id) => resolved.push(json!({ "id": id })),
                None => gaps.push(GapVariant::Version(UnresolvedVersion {
                    target_field_id: row.target_field_id.clone(),
                    source_name: name,
                    target_project_key: ctx.target_project_key.to_string(),
                })),
            }
        }
    }
    if !resolved.is_empty() {
        fields.insert(row.target_field_id.clone(), Value::Array(resolved));
    }
}

async fn dispatch_component_array(
    row: &FieldMappingRow,
    src_val: &Value,
    ctx: &TransformContext<'_>,
    fields: &mut Map<String, Value>,
    gaps: &mut Vec<GapVariant>,
) {
    let mut resolved: Vec<Value> = Vec::new();
    if let Some(arr) = src_val.as_array() {
        for entry in arr {
            let name = entry
                .get("name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            if name.is_empty() {
                continue;
            }
            match ctx
                .component_resolver
                .resolve_name(ctx.target_project_key, &name)
                .await
            {
                Some(id) => resolved.push(json!({ "id": id })),
                None => gaps.push(GapVariant::Component(UnresolvedComponent {
                    target_field_id: row.target_field_id.clone(),
                    source_name: name,
                    target_project_key: ctx.target_project_key.to_string(),
                })),
            }
        }
    }
    if !resolved.is_empty() {
        fields.insert(row.target_field_id.clone(), Value::Array(resolved));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::field_transform::{ComponentResolver, UserResolver, VersionResolver};
    use serde_json::json;
    use std::collections::HashMap;

    // ── Test fixtures + mocks ───────────────────────────────────────────────

    fn s_str_summary() -> FieldSchemaType {
        FieldSchemaType::String {
            system: Some("summary".into()),
            custom: None,
            custom_id: None,
        }
    }
    fn s_str_description() -> FieldSchemaType {
        FieldSchemaType::String {
            system: Some("description".into()),
            custom: None,
            custom_id: None,
        }
    }
    fn s_user() -> FieldSchemaType {
        FieldSchemaType::User {
            system: None,
            custom: None,
            custom_id: None,
        }
    }
    fn s_array(items: &str) -> FieldSchemaType {
        FieldSchemaType::Array {
            items: items.into(),
            system: None,
            custom: None,
            custom_id: None,
        }
    }

    fn row(src: &str, dst: &str, schema: FieldSchemaType) -> FieldMappingRow {
        FieldMappingRow {
            source_field_id: src.into(),
            target_field_id: dst.into(),
            transformer_kind: "auto".into(),
            source_schema: schema.clone(),
            target_schema: schema,
        }
    }

    fn row_with_kind(
        src: &str,
        dst: &str,
        src_schema: FieldSchemaType,
        dst_schema: FieldSchemaType,
        kind: &str,
    ) -> FieldMappingRow {
        FieldMappingRow {
            source_field_id: src.into(),
            target_field_id: dst.into(),
            transformer_kind: kind.into(),
            source_schema: src_schema,
            target_schema: dst_schema,
        }
    }

    /// Builds a TransformContext + populates user_map directly. Bypasses the
    /// real UserResolver by providing a pre-built map (which is what
    /// `apply_mapping` actually consumes — Plan 03 covers the batched HTTP).
    fn ctx_with_map<'a>(
        client: &'a reqwest::Client,
        user_resolver: &'a UserResolver,
        version_resolver: &'a VersionResolver,
        component_resolver: &'a ComponentResolver,
        user_map: &'a HashMap<String, Option<String>>,
        target_project_key: &'a str,
        cloud_base_url: &'a str,
    ) -> TransformContext<'a> {
        TransformContext {
            client,
            cloud_auth: "Basic Zm9vOmJhcg==",
            cloud_base_url,
            target_project_key,
            user_resolver,
            version_resolver,
            component_resolver,
            user_map,
        }
    }

    fn make_resolvers() -> (UserResolver, VersionResolver, ComponentResolver) {
        let c = reqwest::Client::new();
        (
            UserResolver::new(c.clone(), "Basic x".into(), "http://127.0.0.1:1".into()),
            VersionResolver::new(c.clone(), "Basic x".into(), "http://127.0.0.1:1".into()),
            ComponentResolver::new(c, "Basic x".into(), "http://127.0.0.1:1".into()),
        )
    }

    // ── Unit tests (dispatch logic) ─────────────────────────────────────────

    #[tokio::test]
    async fn apply_mapping_returns_resolved_fields_for_text_only_mapping() {
        let issue = json!({"fields":{"summary":"Hello"}});
        let mapping = vec![row("summary", "summary", s_str_summary())];
        let (u, v, c) = make_resolvers();
        let map = HashMap::new();
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        assert_eq!(out.fields.get("summary"), Some(&json!("Hello")));
        assert!(out.gaps.is_empty());
    }

    #[tokio::test]
    async fn apply_mapping_resolves_assignee_to_account_id() {
        let issue = json!({"fields":{"assignee":{"name":"alice","emailAddress":"alice@acme.com"}}});
        let mapping = vec![row("assignee", "assignee", s_user())];
        let (u, v, c) = make_resolvers();
        let mut map = HashMap::new();
        map.insert("alice".into(), Some("AID-A".into()));
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        assert_eq!(
            out.fields.get("assignee"),
            Some(&json!({"accountId":"AID-A"}))
        );
        assert!(out.gaps.is_empty());
    }

    #[tokio::test]
    async fn apply_mapping_unresolvable_assignee_emits_unresolved_person_gap() {
        let issue = json!({"fields":{"assignee":{"name":"alice","emailAddress":"alice@acme.com","key":"JU100"}}});
        let mapping = vec![row("assignee", "assignee", s_user())];
        let (u, v, c) = make_resolvers();
        let mut map = HashMap::new();
        map.insert("alice".into(), None);
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        assert!(!out.fields.contains_key("assignee"));
        assert_eq!(out.gaps.len(), 1);
        match &out.gaps[0] {
            GapVariant::Person(p) => {
                assert_eq!(p.target_field_id, "assignee");
                assert_eq!(p.source_username.as_deref(), Some("alice"));
                assert_eq!(p.source_email.as_deref(), Some("alice@acme.com"));
                assert_eq!(p.source_key.as_deref(), Some("JU100"));
            }
            _ => panic!("expected Person gap"),
        }
    }

    #[tokio::test]
    async fn apply_mapping_array_users_partial_resolution_d3() {
        let issue = json!({"fields":{"customfield_10010":[
            {"name":"alice","emailAddress":"alice@acme.com"},
            {"name":"bob","emailAddress":"bob@acme.com"},
            {"name":"ghost","emailAddress":"ghost@acme.com"}
        ]}});
        let mapping = vec![row(
            "customfield_10010",
            "customfield_10010",
            s_array("user"),
        )];
        let (u, v, c) = make_resolvers();
        let mut map = HashMap::new();
        map.insert("alice".into(), Some("AID-A".into()));
        map.insert("bob".into(), Some("AID-B".into()));
        map.insert("ghost".into(), None);
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        assert_eq!(
            out.fields.get("customfield_10010"),
            Some(&json!([{"accountId":"AID-A"},{"accountId":"AID-B"}]))
        );
        assert_eq!(out.gaps.len(), 1);
        if let GapVariant::Person(p) = &out.gaps[0] {
            assert_eq!(p.source_username.as_deref(), Some("ghost"));
        } else {
            panic!("expected ghost as Person gap");
        }
    }

    #[tokio::test]
    async fn apply_mapping_priority_excluded_from_output() {
        // Priority fields are intentionally excluded from apply_mapping output.
        // Source priority IDs (e.g. Server "3") are namespace-local and invalid on
        // Cloud Jira. Priority is always managed client-side via targetPriorityId and
        // emitted as an override_values entry in confirmCopy.
        let issue = json!({"fields":{"priority":{"id":"3","name":"Medium","self":"http://x/3"}}});
        let mapping = vec![row("priority", "priority", FieldSchemaType::Priority)];
        let (u, v, c) = make_resolvers();
        let map = HashMap::new();
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        // priority must NOT appear in resolved.fields — it is managed via override_values
        assert!(!out.fields.contains_key("priority"), "priority must not appear in apply_mapping output (managed via override_values)");
    }

    // ── Integration tests against a spawned axum mock ───────────────────────

    use axum::response::IntoResponse;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc as StdArc;

    /// Tiny mock that serves /versions, /components, /user/search.
    /// Returns (base_url, user_search_counter, shutdown).
    async fn spawn_full_mock() -> (String, StdArc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        use axum::extract::Query;
        use axum::{routing::get, Json, Router};
        use std::collections::BTreeMap;
        use std::net::SocketAddr;
        let counter = StdArc::new(AtomicUsize::new(0));
        let counter_c = StdArc::clone(&counter);

        let app: Router = Router::new()
            .route(
                "/rest/api/3/project/{key}/versions",
                get(|| async {
                    Json(vec![
                        json!({"id":"20010","name":"1.2.0"}),
                        json!({"id":"20011","name":"1.3.0"}),
                    ])
                    .into_response()
                }),
            )
            .route(
                "/rest/api/3/project/{key}/components",
                get(|| async {
                    Json(vec![
                        json!({"id":"30001","name":"API"}),
                        json!({"id":"30002","name":"Frontend"}),
                    ])
                    .into_response()
                }),
            )
            .route(
                "/rest/api/3/user/search",
                get(move |Query(q): Query<BTreeMap<String, String>>| {
                    let cc = StdArc::clone(&counter_c);
                    async move {
                        cc.fetch_add(1, Ordering::SeqCst);
                        let qs = q.get("query").cloned().unwrap_or_default();
                        if qs.contains("@acme.com") {
                            return Json(vec![
                                json!({"accountId":"AID-A","displayName":"Alice","emailAddress":"alice@acme.com"}),
                                json!({"accountId":"AID-J","displayName":"John","emailAddress":"jdoe@acme.com"}),
                            ])
                            .into_response();
                        }
                        Json(Vec::<serde_json::Value>::new()).into_response()
                    }
                }),
            );
        let listener = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        (format!("http://{addr}"), counter, handle)
    }

    #[tokio::test]
    async fn apply_mapping_version_resolves_to_id() {
        let (base, _c, h) = spawn_full_mock().await;
        let client = reqwest::Client::new();
        let u = UserResolver::new(client.clone(), "Basic x".into(), base.clone());
        let v = VersionResolver::new(client.clone(), "Basic x".into(), base.clone());
        let comp = ComponentResolver::new(client.clone(), "Basic x".into(), base);

        let issue = json!({"fields":{"fixVersions":[{"name":"1.2.0"}]}});
        let mapping = vec![row("fixVersions", "fixVersions", s_array("version"))];
        let map = HashMap::new();
        let ctx = ctx_with_map(&client, &u, &v, &comp, &map, "MYPROJ", "unused");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        assert_eq!(
            out.fields.get("fixVersions"),
            Some(&json!([{"id":"20010"}]))
        );
        h.abort();
    }

    #[tokio::test]
    async fn apply_mapping_unresolvable_version_emits_gap() {
        let (base, _c, h) = spawn_full_mock().await;
        let client = reqwest::Client::new();
        let u = UserResolver::new(client.clone(), "Basic x".into(), base.clone());
        let v = VersionResolver::new(client.clone(), "Basic x".into(), base.clone());
        let comp = ComponentResolver::new(client.clone(), "Basic x".into(), base);

        let issue = json!({"fields":{"fixVersions":[{"name":"9.9.9"}]}});
        let mapping = vec![row("fixVersions", "fixVersions", s_array("version"))];
        let map = HashMap::new();
        let ctx = ctx_with_map(&client, &u, &v, &comp, &map, "MYPROJ", "MYPROJ");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        assert!(!out.fields.contains_key("fixVersions"));
        assert_eq!(out.gaps.len(), 1);
        if let GapVariant::Version(g) = &out.gaps[0] {
            assert_eq!(g.source_name, "9.9.9");
            assert_eq!(g.target_project_key, "MYPROJ");
        } else {
            panic!("expected Version gap");
        }
        h.abort();
    }

    #[tokio::test]
    async fn apply_mapping_component_resolves_to_id() {
        let (base, _c, h) = spawn_full_mock().await;
        let client = reqwest::Client::new();
        let u = UserResolver::new(client.clone(), "Basic x".into(), base.clone());
        let v = VersionResolver::new(client.clone(), "Basic x".into(), base.clone());
        let comp = ComponentResolver::new(client.clone(), "Basic x".into(), base);

        let issue = json!({"fields":{"components":[{"name":"API"}]}});
        let mapping = vec![row("components", "components", s_array("component"))];
        let map = HashMap::new();
        let ctx = ctx_with_map(&client, &u, &v, &comp, &map, "MYPROJ", "unused");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        assert_eq!(out.fields.get("components"), Some(&json!([{"id":"30001"}])));
        h.abort();
    }

    #[tokio::test]
    async fn apply_mapping_array_of_versions_partial_resolution() {
        let (base, _c, h) = spawn_full_mock().await;
        let client = reqwest::Client::new();
        let u = UserResolver::new(client.clone(), "Basic x".into(), base.clone());
        let v = VersionResolver::new(client.clone(), "Basic x".into(), base.clone());
        let comp = ComponentResolver::new(client.clone(), "Basic x".into(), base);

        let issue = json!({"fields":{"fixVersions":[
            {"name":"1.2.0"},
            {"name":"1.3.0"},
            {"name":"9.9.9"}
        ]}});
        let mapping = vec![row("fixVersions", "fixVersions", s_array("version"))];
        let map = HashMap::new();
        let ctx = ctx_with_map(&client, &u, &v, &comp, &map, "MYPROJ", "unused");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        assert_eq!(
            out.fields.get("fixVersions"),
            Some(&json!([{"id":"20010"},{"id":"20011"}]))
        );
        assert_eq!(out.gaps.len(), 1);
        if let GapVariant::Version(g) = &out.gaps[0] {
            assert_eq!(g.source_name, "9.9.9");
        } else {
            panic!("expected Version gap");
        }
        h.abort();
    }

    #[tokio::test]
    async fn apply_mapping_description_runs_through_wiki_to_adf() {
        let issue = json!({
            "fields": {"description":"<p>Hi [~jdoe]</p>"},
            "renderedFields": {"description":"<p>Hi [~jdoe]</p>"}
        });
        let mapping = vec![row("description", "description", s_str_description())];
        let (u, v, c) = make_resolvers();
        let mut map = HashMap::new();
        map.insert("jdoe".into(), Some("AID-J".into()));
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");
        let adf = out.fields.get("description").expect("description present");
        assert_eq!(adf["type"], "doc");
        let s = serde_json::to_string(adf).unwrap();
        assert!(s.contains("\"type\":\"mention\""));
        assert!(s.contains("AID-J"));
    }

    // ── Round-trip integration tests (Task 2) ──────────────────────────────

    #[tokio::test]
    async fn apply_mapping_round_trip_four_custom_fields() {
        let (base, user_search_counter, h) = spawn_full_mock().await;
        let client = reqwest::Client::new();
        let u = UserResolver::new(client.clone(), "Basic x".into(), base.clone());
        let v = VersionResolver::new(client.clone(), "Basic x".into(), base.clone());
        let comp = ComponentResolver::new(client.clone(), "Basic x".into(), base.clone());

        // Synthetic source issue exercising 8 distinct field types.
        let issue = json!({
            "fields": {
                "customfield_10001": 5,
                "customfield_10006": [{"id":"sev1","value":"Blocker","self":"http://x/sev1"}],
                "customfield_10003": {"name":"alice","emailAddress":"alice@acme.com"},
                "customfield_10004": "2026-04-27",
                "description": "<p>Done by [~alice]</p>",
                "fixVersions": [{"name":"1.2.0"}, {"name":"missing"}],
                "components": [{"name":"API"}],
                "priority": {"id":"3","name":"Medium","self":"http://x/3"}
            },
            "renderedFields": {
                "description": "<p>Done by [~alice]</p>"
            }
        });

        let mapping = vec![
            row(
                "customfield_10001",
                "customfield_10001",
                FieldSchemaType::Number {
                    system: None,
                    custom: Some("com.atlassian.jira.plugin.system.customfieldtypes:float".into()),
                    custom_id: Some(10001),
                },
            ),
            row("customfield_10006", "customfield_10006", s_array("option")),
            row("customfield_10003", "customfield_10003", s_user()),
            row(
                "customfield_10004",
                "customfield_10004",
                FieldSchemaType::Date {
                    system: None,
                    custom: None,
                    custom_id: Some(10004),
                },
            ),
            row("description", "description", s_str_description()),
            row("fixVersions", "fixVersions", s_array("version")),
            row("components", "components", s_array("component")),
            row("priority", "priority", FieldSchemaType::Priority),
        ];

        // Phase 1: build the user_map by calling resolve_batch (real network call).
        let user_map = u.resolve_batch(&issue, &mapping).await;
        // The mock returns alice for @acme.com — alice should resolve.
        assert_eq!(
            user_map.get("alice").cloned().flatten().as_deref(),
            Some("AID-A"),
            "Phase 1 should resolve alice to AID-A"
        );

        // Phase 2: apply mapping.
        let ctx = ctx_with_map(&client, &u, &v, &comp, &user_map, "MYPROJ", &base);
        let out = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");

        // ── Assertions: each field type emits the right write shape ──────────
        // 1. Number — passthrough.
        assert_eq!(out.fields.get("customfield_10001"), Some(&json!(5)));
        // 2. Multi-select — strip to [{value}].
        assert_eq!(
            out.fields.get("customfield_10006"),
            Some(&json!([{"value":"Blocker"}]))
        );
        // 3. Single-user — {accountId}.
        assert_eq!(
            out.fields.get("customfield_10003"),
            Some(&json!({"accountId":"AID-A"}))
        );
        // 4. Date — passthrough.
        assert_eq!(
            out.fields.get("customfield_10004"),
            Some(&json!("2026-04-27"))
        );
        // 5. Description — ADF doc with mention.
        let desc = out.fields.get("description").expect("description present");
        assert_eq!(desc["type"], "doc");
        let desc_str = serde_json::to_string(desc).unwrap();
        assert!(
            desc_str.contains("AID-A"),
            "description mention should reference AID-A: {desc_str}"
        );
        // 6. fixVersions partial resolution — only 1.2.0 resolves, missing emits gap.
        assert_eq!(
            out.fields.get("fixVersions"),
            Some(&json!([{"id":"20010"}]))
        );
        // 7. components — API resolves.
        assert_eq!(out.fields.get("components"), Some(&json!([{"id":"30001"}])));
        // 8. priority — excluded from apply_mapping output (managed via override_values).
        assert!(!out.fields.contains_key("priority"), "priority must not appear in apply_mapping output (managed via override_values)");

        // ── Gap assertions ───────────────────────────────────────────────────
        assert_eq!(
            out.gaps.len(),
            1,
            "exactly one gap (UnresolvedVersion for 'missing')"
        );
        match &out.gaps[0] {
            GapVariant::Version(g) => {
                assert_eq!(g.source_name, "missing");
                assert_eq!(g.target_field_id, "fixVersions");
                assert_eq!(g.target_project_key, "MYPROJ");
            }
            other => panic!("expected Version gap, got {other:?}"),
        }

        // ── TRAN-06 invariant: ONE user-search HTTP call across all person fields ─
        assert_eq!(
            user_search_counter.load(Ordering::SeqCst),
            1,
            "TRAN-06: resolve_batch must use exactly one HTTP call per domain"
        );

        h.abort();
    }

    #[tokio::test]
    async fn apply_mapping_user_resolver_called_exactly_once() {
        // Two person fields + one description mention all feeding one batch.
        let (base, user_search_counter, h) = spawn_full_mock().await;
        let client = reqwest::Client::new();
        let u = UserResolver::new(client.clone(), "Basic x".into(), base.clone());
        let v = VersionResolver::new(client.clone(), "Basic x".into(), base.clone());
        let comp = ComponentResolver::new(client.clone(), "Basic x".into(), base.clone());

        let issue = json!({
            "fields": {
                "assignee": {"name":"alice","emailAddress":"alice@acme.com"},
                "reporter": {"name":"jdoe","emailAddress":"jdoe@acme.com"},
                "description": "ping [~alice] and [~jdoe]"
            },
            "renderedFields": {
                "description": "ping [~alice] and [~jdoe]"
            }
        });
        let mapping = vec![
            row("assignee", "assignee", s_user()),
            row("reporter", "reporter", s_user()),
            row("description", "description", s_str_description()),
        ];

        // Phase 1: ONE call.
        let user_map = u.resolve_batch(&issue, &mapping).await;
        // Phase 2.
        let ctx = ctx_with_map(&client, &u, &v, &comp, &user_map, "MYPROJ", &base);
        let _ = apply_mapping(&issue, &mapping, &ctx)
            .await
            .expect("apply_mapping ok");

        // TRAN-06: exactly one HTTP call on @acme.com.
        assert_eq!(user_search_counter.load(Ordering::SeqCst), 1);
        h.abort();
    }

    #[tokio::test]
    async fn apply_mapping_rejects_duplicate_target_field_ids() {
        let issue = json!({"fields":{"src_a":"v1","src_b":"v2"}});
        let mapping = vec![
            row("src_a", "tgt_shared", s_str_summary()),
            row("src_b", "tgt_shared", s_str_summary()),
        ];
        let (u, v, c) = make_resolvers();
        let map = HashMap::new();
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let result = apply_mapping(&issue, &mapping, &ctx).await;
        assert!(
            matches!(result, Err(TransformError::DuplicateTargetField(ref id)) if id == "tgt_shared"),
            "expected DuplicateTargetField(\"tgt_shared\"), got {result:?}",
        );
    }

    // ── user_name transformer tests ─────────────────────────────────────────

    #[tokio::test]
    async fn user_name_transformer_extracts_display_name() {
        let issue = json!({"fields":{"assignee":{"name":"alice","displayName":"Alice Smith","emailAddress":"alice@acme.com"}}});
        let mapping = vec![row_with_kind(
            "assignee",
            "cf_reporter_name",
            s_user(),
            s_str_summary(),
            "user_name",
        )];
        let (u, v, c) = make_resolvers();
        let map = HashMap::new();
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx).await.expect("ok");
        assert_eq!(
            out.fields.get("cf_reporter_name"),
            Some(&json!("Alice Smith"))
        );
        assert!(out.gaps.is_empty());
    }

    #[tokio::test]
    async fn user_name_transformer_falls_back_to_name_when_no_display_name() {
        let issue = json!({"fields":{"assignee":{"name":"alice.smith"}}});
        let mapping = vec![row_with_kind(
            "assignee",
            "cf_reporter_name",
            s_user(),
            s_str_summary(),
            "user_name",
        )];
        let (u, v, c) = make_resolvers();
        let map = HashMap::new();
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx).await.expect("ok");
        assert_eq!(
            out.fields.get("cf_reporter_name"),
            Some(&json!("alice.smith"))
        );
    }

    #[tokio::test]
    async fn user_name_transformer_array_joins_display_names() {
        let issue = json!({"fields":{"watchers":[
            {"name":"alice","displayName":"Alice Smith"},
            {"name":"bob","displayName":"Bob Jones"}
        ]}});
        let mapping = vec![row_with_kind(
            "watchers",
            "cf_watcher_names",
            s_array("user"),
            s_str_summary(),
            "user_name",
        )];
        let (u, v, c) = make_resolvers();
        let map = HashMap::new();
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx).await.expect("ok");
        assert_eq!(
            out.fields.get("cf_watcher_names"),
            Some(&json!("Alice Smith, Bob Jones"))
        );
    }

    #[tokio::test]
    async fn user_name_transformer_skips_null_user() {
        let issue = json!({"fields":{"assignee":null}});
        let mapping = vec![row_with_kind(
            "assignee",
            "cf_reporter_name",
            s_user(),
            s_str_summary(),
            "user_name",
        )];
        let (u, v, c) = make_resolvers();
        let map = HashMap::new();
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx).await.expect("ok");
        assert!(!out.fields.contains_key("cf_reporter_name"));
        assert!(out.gaps.is_empty());
    }

    #[tokio::test]
    async fn user_transformer_still_resolves_account_id_when_kind_is_user() {
        // Regression: user_name check must not affect standard user transformer
        let issue = json!({"fields":{"assignee":{"name":"alice","emailAddress":"alice@acme.com"}}});
        let mapping = vec![row("assignee", "assignee", s_user())];
        let (u, v, c) = make_resolvers();
        let mut map = HashMap::new();
        map.insert("alice".into(), Some("AID-A".into()));
        let client = reqwest::Client::new();
        let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
        let out = apply_mapping(&issue, &mapping, &ctx).await.expect("ok");
        assert_eq!(
            out.fields.get("assignee"),
            Some(&json!({"accountId":"AID-A"}))
        );
    }
}
