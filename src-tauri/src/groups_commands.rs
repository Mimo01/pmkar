#![allow(clippy::needless_pass_by_value)]
//! Tauri commands for custom groups.
//!
//! Lock rule (D-21): the triage lock is always released before the groups lock
//! is acquired; the two are never held together. The scope is always derived
//! in Rust from the server `connection_meta` base URL and is never accepted
//! from the frontend (D-01, D-02).

use crate::groups_db::{
    normalize_scope, Group, GroupError, GroupErrorCode, GroupMember, GroupMembership, GroupResult,
    GroupsDb, MoveDirection, NewMember,
};
use crate::triage_db::TriageDb;
use std::sync::{Arc, Mutex, MutexGuard};

fn internal(msg: &str) -> GroupError {
    GroupError {
        code: GroupErrorCode::Internal,
        message: Some(msg.to_string()),
    }
}

/// Resolve the active scope from the server connection. The triage lock is
/// held only inside the inner block and dropped before returning.
pub(crate) fn resolve_scope(triage_db: &Arc<Mutex<TriageDb>>) -> GroupResult<Option<String>> {
    let base_url = {
        let db = triage_db
            .lock()
            .map_err(|_| internal("Triage DB lock poisoned"))?;
        let metas = db.get_all_connection_meta()?;
        metas
            .iter()
            .find(|m| m.connection_type == "server")
            .map(|m| m.base_url.clone())
    };
    Ok(base_url.and_then(|u| normalize_scope(&u)))
}

fn require_scope(triage_db: &Arc<Mutex<TriageDb>>) -> GroupResult<String> {
    resolve_scope(triage_db)?.ok_or_else(|| GroupError::new(GroupErrorCode::NoScope))
}

fn lock_groups(groups_db: &Arc<Mutex<GroupsDb>>) -> GroupResult<MutexGuard<'_, GroupsDb>> {
    groups_db
        .lock()
        .map_err(|_| internal("Groups DB lock poisoned"))
}

pub fn list_groups_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
) -> GroupResult<Vec<Group>> {
    let Some(scope) = resolve_scope(triage_db)? else {
        return Ok(Vec::new());
    };
    lock_groups(groups_db)?.list_groups(&scope)
}

pub fn list_group_memberships_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
) -> GroupResult<Vec<GroupMembership>> {
    let Some(scope) = resolve_scope(triage_db)? else {
        return Ok(Vec::new());
    };
    lock_groups(groups_db)?.list_memberships(&scope)
}

pub fn get_group_members_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
    group_id: i64,
) -> GroupResult<Vec<GroupMember>> {
    let scope = require_scope(triage_db)?;
    lock_groups(groups_db)?.get_group_members(&scope, group_id)
}

pub fn create_group_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
    name: &str,
    color: Option<&str>,
) -> GroupResult<Group> {
    let scope = require_scope(triage_db)?;
    lock_groups(groups_db)?.create_group(&scope, name, color)
}

pub fn rename_group_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
    group_id: i64,
    name: &str,
) -> GroupResult<Group> {
    let scope = require_scope(triage_db)?;
    lock_groups(groups_db)?.rename_group(&scope, group_id, name)
}

pub fn set_group_color_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
    group_id: i64,
    color: &str,
) -> GroupResult<Group> {
    let scope = require_scope(triage_db)?;
    lock_groups(groups_db)?.set_group_color(&scope, group_id, color)
}

pub fn move_group_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
    group_id: i64,
    direction: MoveDirection,
) -> GroupResult<Vec<Group>> {
    let scope = require_scope(triage_db)?;
    lock_groups(groups_db)?.move_group(&scope, group_id, direction)
}

pub fn delete_group_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
    group_id: i64,
) -> GroupResult<()> {
    let scope = require_scope(triage_db)?;
    lock_groups(groups_db)?.delete_group(&scope, group_id)
}

pub fn add_issues_to_group_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
    group_id: i64,
    issues: &[NewMember],
) -> GroupResult<usize> {
    let scope = require_scope(triage_db)?;
    lock_groups(groups_db)?.add_members(&scope, group_id, issues)
}

pub fn remove_issues_from_group_inner(
    triage_db: &Arc<Mutex<TriageDb>>,
    groups_db: &Arc<Mutex<GroupsDb>>,
    group_id: i64,
    issue_keys: &[String],
) -> GroupResult<usize> {
    let scope = require_scope(triage_db)?;
    lock_groups(groups_db)?.remove_members(&scope, group_id, issue_keys)
}

#[tauri::command]
pub fn list_groups(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
) -> Result<Vec<Group>, GroupError> {
    list_groups_inner(&triage_db, &groups_db)
}

#[tauri::command]
pub fn list_group_memberships(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
) -> Result<Vec<GroupMembership>, GroupError> {
    list_group_memberships_inner(&triage_db, &groups_db)
}

#[tauri::command]
pub fn get_group_members(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
    group_id: i64,
) -> Result<Vec<GroupMember>, GroupError> {
    get_group_members_inner(&triage_db, &groups_db, group_id)
}

#[tauri::command]
pub fn create_group(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
    name: String,
    color: Option<String>,
) -> Result<Group, GroupError> {
    create_group_inner(&triage_db, &groups_db, &name, color.as_deref())
}

#[tauri::command]
pub fn rename_group(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
    group_id: i64,
    name: String,
) -> Result<Group, GroupError> {
    rename_group_inner(&triage_db, &groups_db, group_id, &name)
}

#[tauri::command]
pub fn set_group_color(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
    group_id: i64,
    color: String,
) -> Result<Group, GroupError> {
    set_group_color_inner(&triage_db, &groups_db, group_id, &color)
}

#[tauri::command]
pub fn move_group(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
    group_id: i64,
    direction: MoveDirection,
) -> Result<Vec<Group>, GroupError> {
    move_group_inner(&triage_db, &groups_db, group_id, direction)
}

#[tauri::command]
pub fn delete_group(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
    group_id: i64,
) -> Result<(), GroupError> {
    delete_group_inner(&triage_db, &groups_db, group_id)
}

#[tauri::command]
pub fn add_issues_to_group(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
    group_id: i64,
    issues: Vec<NewMember>,
) -> Result<usize, GroupError> {
    add_issues_to_group_inner(&triage_db, &groups_db, group_id, &issues)
}

#[tauri::command]
pub fn remove_issues_from_group(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
    group_id: i64,
    issue_keys: Vec<String>,
) -> Result<usize, GroupError> {
    remove_issues_from_group_inner(&triage_db, &groups_db, group_id, &issue_keys)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::triage_db::ConnectionMeta;

    fn dbs() -> (Arc<Mutex<TriageDb>>, Arc<Mutex<GroupsDb>>) {
        (
            Arc::new(Mutex::new(TriageDb::open_in_memory().unwrap())),
            Arc::new(Mutex::new(GroupsDb::open_in_memory().unwrap())),
        )
    }

    fn set_meta(t: &Arc<Mutex<TriageDb>>, kind: &str, url: &str, user: &str) {
        t.lock()
            .unwrap()
            .set_connection_meta(&ConnectionMeta {
                connection_type: kind.into(),
                base_url: url.into(),
                username: user.into(),
                server_version: "9.0".into(),
                last_tested_at: "2026-01-01T00:00:00Z".into(),
                status: "ok".into(),
            })
            .unwrap();
    }

    #[test]
    fn resolve_scope_none_without_meta_or_with_cloud_only() {
        let (t, _) = dbs();
        assert_eq!(resolve_scope(&t).unwrap(), None);
        set_meta(&t, "cloud", "https://x.atlassian.net", "u");
        assert_eq!(resolve_scope(&t).unwrap(), None);
    }

    #[test]
    fn resolve_scope_normalizes_and_releases_triage_lock() {
        let (t, _) = dbs();
        set_meta(&t, "server", "HTTPS://Jira.Example.com/", "u");
        assert_eq!(
            resolve_scope(&t).unwrap(),
            Some("https://jira.example.com".to_string())
        );
        assert!(t.try_lock().is_ok(), "triage lock must be released");
    }

    #[test]
    fn no_scope_behaviour() {
        let (t, g) = dbs();
        assert!(list_groups_inner(&t, &g).unwrap().is_empty());
        assert!(list_group_memberships_inner(&t, &g).unwrap().is_empty());
        let err = create_group_inner(&t, &g, "A", None).unwrap_err();
        assert_eq!(err.code, GroupErrorCode::NoScope);
        let err = get_group_members_inner(&t, &g, 1).unwrap_err();
        assert_eq!(err.code, GroupErrorCode::NoScope);
    }

    #[test]
    fn scope_switch_hides_and_restores_groups() {
        let (t, g) = dbs();
        set_meta(&t, "server", "https://a.example.com", "u");
        create_group_inner(&t, &g, "Same", None).unwrap();
        set_meta(&t, "server", "https://b.example.com", "u");
        assert!(list_groups_inner(&t, &g).unwrap().is_empty());
        create_group_inner(&t, &g, "Same", None).unwrap();
        set_meta(&t, "server", "https://a.example.com", "u");
        let groups = list_groups_inner(&t, &g).unwrap();
        assert_eq!(groups.len(), 1);
    }

    #[test]
    fn username_change_keeps_groups_visible() {
        let (t, g) = dbs();
        set_meta(&t, "server", "https://a.example.com", "alice");
        create_group_inner(&t, &g, "Mine", None).unwrap();
        set_meta(&t, "server", "https://a.example.com", "bob");
        assert_eq!(list_groups_inner(&t, &g).unwrap().len(), 1);
    }

    #[test]
    fn duplicate_error_serialises_as_code() {
        let v = serde_json::to_value(GroupError::new(GroupErrorCode::Duplicate)).unwrap();
        assert_eq!(v, serde_json::json!({"code": "duplicate"}));
        let (t, g) = dbs();
        set_meta(&t, "server", "https://a.example.com", "u");
        create_group_inner(&t, &g, "Dup", None).unwrap();
        let err = create_group_inner(&t, &g, "dup", None).unwrap_err();
        assert_eq!(err.code, GroupErrorCode::Duplicate);
    }

    #[test]
    fn poisoned_groups_mutex_returns_internal() {
        let (t, g) = dbs();
        set_meta(&t, "server", "https://a.example.com", "u");
        let g2 = Arc::clone(&g);
        let _ = std::thread::spawn(move || {
            let _guard = g2.lock().unwrap();
            panic!("poison");
        })
        .join();
        let err = list_groups_inner(&t, &g).unwrap_err();
        assert_eq!(err.code, GroupErrorCode::Internal);
    }

    #[test]
    fn poisoned_triage_mutex_returns_internal() {
        let (t, _) = dbs();
        let t2 = Arc::clone(&t);
        let _ = std::thread::spawn(move || {
            let _guard = t2.lock().unwrap();
            panic!("poison");
        })
        .join();
        let err = resolve_scope(&t).unwrap_err();
        assert_eq!(err.code, GroupErrorCode::Internal);
    }
}
