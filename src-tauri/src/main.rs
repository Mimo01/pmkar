#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;
use pmkar_lib::{
    audit::AuditDb,
    fixtures::build_fixtures,
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

            app.manage(Mutex::new(audit_db));
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
