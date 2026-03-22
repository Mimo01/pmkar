#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::Manager;
use pmkar_lib::{
    audit::AuditDb,
    fixtures::build_fixtures,
    triage_db::TriageDb,
    commands,
};

fn main() {
    let fixtures = build_fixtures();

    tauri::Builder::default()
        .setup(move |app| {
            // Open audit database in app data directory
            let app_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_dir).ok();
            let db_path = app_dir.join("audit.db");
            let audit_db = AuditDb::open(&db_path)
                .expect("Failed to open audit database");

            app.manage(Arc::new(Mutex::new(audit_db)));

            let triage_db_path = app_dir.join("triage.db");
            let triage_db = TriageDb::open(&triage_db_path)
                .expect("Failed to open triage database");
            app.manage(Arc::new(Mutex::new(triage_db)));

            app.manage(fixtures.clone());

            // Start mock servers in dev mode
            #[cfg(feature = "mock-server")]
            {
                let fixtures_clone = fixtures.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = pmkar_lib::mock_server::start_mock_servers(fixtures_clone).await {
                        eprintln!("Failed to start mock servers: {}", e);
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
            commands::get_fetch_config,
            commands::set_fetch_config,
            commands::set_connection_meta,
            commands::get_all_connection_meta,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
