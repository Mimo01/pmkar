#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use pmkar_lib::{
    audit::AuditDb, commands, field_mapping_db::FieldMappingDb, fixtures::build_fixtures,
    poll_engine::PollFrequency, snapshot_db::SnapshotDb, triage_db::TriageDb,
};
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use tauri::Manager;
use tokio::sync::watch;

#[allow(clippy::too_many_lines)]
fn main() {
    let fixtures = build_fixtures();

    tauri::Builder::default()
        .setup(move |app| {
            // Register desktop-only plugins
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
                app.handle().plugin(tauri_plugin_notification::init())?;
            }

            // Build custom application menu with About item that opens frontend modal
            {
                let about_item =
                    MenuItem::with_id(app, "about", "About pmkar", true, None::<&str>)?;
                let separator = PredefinedMenuItem::separator(app)?;

                #[cfg(target_os = "macos")]
                let app_submenu = {
                    let services = PredefinedMenuItem::services(app, None::<&str>)?;
                    let hide = PredefinedMenuItem::hide(app, None::<&str>)?;
                    let hide_others = PredefinedMenuItem::hide_others(app, None::<&str>)?;
                    let show_all = PredefinedMenuItem::show_all(app, None::<&str>)?;
                    let quit = PredefinedMenuItem::quit(app, None::<&str>)?;
                    let sep2 = PredefinedMenuItem::separator(app)?;
                    let sep3 = PredefinedMenuItem::separator(app)?;
                    Submenu::with_items(
                        app,
                        "pmkar",
                        true,
                        &[
                            &about_item,
                            &separator,
                            &services,
                            &sep2,
                            &hide,
                            &hide_others,
                            &show_all,
                            &sep3,
                            &quit,
                        ],
                    )?
                };

                #[cfg(not(target_os = "macos"))]
                let app_submenu = {
                    let quit = PredefinedMenuItem::quit(app, None::<&str>)?;
                    Submenu::with_items(app, "pmkar", true, &[&about_item, &separator, &quit])?
                };

                // Edit submenu
                let undo = PredefinedMenuItem::undo(app, None::<&str>)?;
                let redo = PredefinedMenuItem::redo(app, None::<&str>)?;
                let edit_sep = PredefinedMenuItem::separator(app)?;
                let cut = PredefinedMenuItem::cut(app, None::<&str>)?;
                let copy_item = PredefinedMenuItem::copy(app, None::<&str>)?;
                let paste = PredefinedMenuItem::paste(app, None::<&str>)?;
                let select_all = PredefinedMenuItem::select_all(app, None::<&str>)?;
                let edit_submenu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &undo,
                        &redo,
                        &edit_sep,
                        &cut,
                        &copy_item,
                        &paste,
                        &select_all,
                    ],
                )?;

                // Window submenu
                let minimize = PredefinedMenuItem::minimize(app, None::<&str>)?;
                let close_window = PredefinedMenuItem::close_window(app, None::<&str>)?;
                let window_submenu =
                    Submenu::with_items(app, "Window", true, &[&minimize, &close_window])?;

                let menu = Menu::with_items(app, &[&app_submenu, &edit_submenu, &window_submenu])?;
                app.set_menu(menu)?;

                app.on_menu_event(|app, event| {
                    if event.id() == "about" {
                        let _ = app.emit("show-about", ());
                    }
                });
            }

            // Open audit database in app data directory
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("audit.db");
            let audit_db = AuditDb::open(&db_path).expect("Failed to open audit database");

            // Retention: delete entries older than 30 days
            if let Err(e) = audit_db.prune_old_entries(30) {
                eprintln!("Audit prune failed: {e}");
            }
            // Drop response bodies older than 7 days
            if let Err(e) = audit_db.prune_response_bodies(7) {
                eprintln!("Audit body prune failed: {e}");
            }
            // Reclaim disk space
            if let Err(e) = audit_db.vacuum() {
                eprintln!("Audit vacuum failed: {e}");
            }

            app.manage(Arc::new(Mutex::new(audit_db)));

            let triage_db_path = app_dir.join("triage.db");
            let triage_db =
                TriageDb::open(&triage_db_path).expect("Failed to open triage database");
            app.manage(Arc::new(Mutex::new(triage_db)));

            let snapshot_db_path = app_dir.join("snapshots.db");
            let snapshot_db =
                SnapshotDb::open(&snapshot_db_path).expect("Failed to open snapshot database");
            app.manage(Arc::new(Mutex::new(snapshot_db)));

            let mapping_db_path = app_dir.join("mapping.db");
            let mapping_db =
                FieldMappingDb::open(&mapping_db_path).expect("Failed to open mapping database");
            app.manage(Arc::new(Mutex::new(mapping_db)));

            app.manage(fixtures.clone());

            // Poll engine: create watch channel and spawn background loop
            let (poll_tx, poll_rx) = watch::channel(PollFrequency::Off);
            let poll_tx = Arc::new(Mutex::new(poll_tx));

            // Read saved frequency from DB and send initial value
            {
                let tdb = app.state::<Arc<Mutex<TriageDb>>>();
                let freq_str = tdb
                    .lock()
                    .unwrap()
                    .get_poll_frequency()
                    .unwrap_or_else(|_| "off".to_string());
                let initial_freq = PollFrequency::from_str(&freq_str);
                let _ = poll_tx.lock().unwrap().send(initial_freq);
            }

            app.manage(poll_tx); // type: Arc<Mutex<watch::Sender<PollFrequency>>>

            {
                let app_handle = app.handle().clone();
                let triage_state = Arc::clone(app.state::<Arc<Mutex<TriageDb>>>().inner());
                let snapshot_state = Arc::clone(app.state::<Arc<Mutex<SnapshotDb>>>().inner());

                tauri::async_runtime::spawn(pmkar_lib::poll_engine::run_poll_loop(
                    poll_rx,
                    app_handle,
                    triage_state,
                    snapshot_state,
                ));
            }

            // Start mock servers in dev mode
            #[cfg(feature = "mock-server")]
            {
                let fixtures_clone = fixtures.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = pmkar_lib::mock_server::start_mock_servers(fixtures_clone).await
                    {
                        eprintln!("Failed to start mock servers: {e}");
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::store_credential,
            commands::get_credential,
            commands::delete_credential,
            commands::start_mock_servers_cmd,
            commands::get_audit_logs,
            commands::get_audit_logs_page,
            commands::clear_audit_logs,
            commands::ping_mock_servers,
            commands::ping_keychain,
            commands::test_jira_server_connection,
            commands::test_jira_cloud_connection,
            commands::open_external_url,
            commands::fetch_tickets,
            commands::fetch_ticket_detail,
            commands::fetch_worklog,
            commands::fetch_changelog,
            commands::fetch_jira_image,
            commands::get_triage_state,
            commands::set_triage_state,
            commands::delete_done_triage,
            commands::get_fetch_config,
            commands::set_fetch_config,
            commands::search_jira_users,
            commands::search_jira_users_by_domain,
            commands::set_connection_meta,
            commands::get_all_connection_meta,
            commands::fetch_cloud_meta,
            commands::copy_ticket_v2,
            commands::get_mapping_audit_log_page,
            commands::get_os_locale,
            commands::get_app_language,
            commands::set_app_language,
            commands::fetch_server_projects,
            commands::fetch_cloud_projects,
            commands::get_project_config,
            commands::set_project_config,
            commands::check_ticket_changes,
            commands::get_poll_watermark,
            commands::get_poll_frequency,
            commands::set_poll_frequency,
            commands::trigger_manual_poll,
            commands::get_notification_prefs,
            commands::set_notification_prefs,
            commands::get_unseen_change_keys,
            commands::get_ticket_changes,
            commands::mark_changes_seen,
            commands::discover_source_fields,
            commands::get_target_field_schema_for_issuetype,
            commands::probe_createmeta,
            commands::pre_warm_target_issue_types,
            commands::refresh_field_schema_cache,
            commands::get_field_mapping,
            commands::set_field_mapping,
            commands::delete_field_mapping,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
