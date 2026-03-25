#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use pmkar_lib::{audit::AuditDb, commands, fixtures::build_fixtures, triage_db::TriageDb};
use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use tauri::Manager;

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

            app.manage(fixtures.clone());

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
            commands::set_connection_meta,
            commands::get_all_connection_meta,
            commands::fetch_cloud_meta,
            commands::copy_ticket,
            commands::get_os_locale,
            commands::get_app_language,
            commands::set_app_language,
            commands::fetch_server_projects,
            commands::fetch_cloud_projects,
            commands::get_project_config,
            commands::set_project_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
