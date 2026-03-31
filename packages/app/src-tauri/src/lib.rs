mod commands;
mod internal_api;
mod mcp_config;
mod tray;

use commands::adb;
use commands::logcat::{self, LogcatState};
use commands::macros;
use commands::scrcpy;
use commands::settings::{self, SettingsState};
use commands::window::{self, NormalWindowGeometry};
use internal_api::auth::{self, ApiState};
use internal_api::server;
use mcp_config::{ConfiguredProjects, McpToken};
use std::sync::Arc;
use tauri::Manager;

/// Holds the shutdown signal sender for the internal API server.
pub struct ShutdownSignal(pub std::sync::Mutex<Option<tokio::sync::watch::Sender<bool>>>);

/// Save the current window position and size to settings.
fn save_window_geometry(app: &tauri::AppHandle) {
    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => return,
    };
    let position = window.outer_position().ok();
    let size = window.outer_size().ok();

    let state = match app.try_state::<SettingsState>() {
        Some(s) => s,
        None => return,
    };

    let updated = {
        let mut guard = match state.0.lock() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };
        if let Some(pos) = position {
            guard.window_x = Some(pos.x);
            guard.window_y = Some(pos.y);
        }
        if let Some(sz) = size {
            guard.window_width = Some(sz.width);
            guard.window_height = Some(sz.height);
        }
        guard.clone()
    };

    let _ = settings::save_settings_to_disk_from(app, &updated);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            adb::list_devices,
            adb::check_adb_available,
            adb::get_device_brand,
            adb::get_onboarded_devices,
            adb::mark_device_onboarded,
            scrcpy::push_scrcpy_server,
            scrcpy::start_stream,
            scrcpy::stop_stream,
            scrcpy::inject_touch,
            scrcpy::inject_scroll,
            scrcpy::inject_keycode,
            scrcpy::inject_text,
            scrcpy::press_back,
            scrcpy::set_phone_clipboard,
            scrcpy::get_phone_clipboard,
            mcp_config::get_mcp_token,
            mcp_config::setup_mcp_for_project,
            mcp_config::get_configured_projects,
            mcp_config::remove_configured_project,
            mcp_config::check_mcp_installed,
            mcp_config::check_mcp_installed_at,
            settings::load_settings,
            settings::save_settings,
            settings::set_always_on_top,
            settings::reset_onboarding,
            settings::take_screenshot,
            settings::start_recording,
            settings::stop_recording,
            logcat::start_logcat,
            logcat::stop_logcat,
            logcat::clear_logcat,
            window::enter_mini_player,
            window::exit_mini_player,
            macros::save_macro,
            macros::list_macros,
            macros::load_macro,
            macros::delete_macro,
        ])
        .setup(|app| {
            // Load and apply settings
            let app_settings = settings::load_settings_from_disk(&app.handle());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(app_settings.always_on_top);

                // Restore saved window geometry before showing
                let has_saved_position = app_settings.window_x.is_some() && app_settings.window_y.is_some();

                if let (Some(w), Some(h)) = (app_settings.window_width, app_settings.window_height) {
                    if w >= 320 && h >= 400 {
                        let _ = window.set_size(tauri::PhysicalSize::new(w, h));
                    }
                }
                if let (Some(x), Some(y)) = (app_settings.window_x, app_settings.window_y) {
                    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                }

                if !has_saved_position {
                    let _ = window.center();
                }

                // Now show the window at the correct position
                let _ = window.show();
                let _ = window.set_focus();
            }
            app.manage(SettingsState(std::sync::Mutex::new(app_settings)));
            app.manage(LogcatState::new());
            app.manage(NormalWindowGeometry(std::sync::Mutex::new(None)));

            // Setup system tray
            tray::setup_tray(app)?;

            // Load auth token and sync to configured projects
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let token = auth::load_or_create_token(&app_data_dir);
            eprintln!("[internal-api] Auth token loaded ({}...)", &token[..8]);

            let projects = mcp_config::load_configured_projects(&app.handle());
            mcp_config::update_token_in_all_projects(&token, &projects);

            if let Ok(exe_path) = std::env::current_exe() {
                if let Some(root) = mcp_config::find_project_root(&exe_path) {
                    mcp_config::update_token_in_file(&token, &root.join(".mcp.json"));
                }
            }

            app.manage(McpToken(token.clone()));
            app.manage(ConfiguredProjects(std::sync::Mutex::new(projects)));

            // Start internal HTTP API
            let api_state = Arc::new(ApiState {
                token: token.clone(),
                app_handle: app.handle().clone(),
                start_time: std::time::Instant::now(),
            });

            let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
            app.manage(ShutdownSignal(std::sync::Mutex::new(Some(shutdown_tx))));

            tauri::async_runtime::spawn(async move {
                if let Err(e) = server::start_internal_api(api_state, shutdown_rx).await {
                    eprintln!("[internal-api] Failed to start: {}", e);
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            match event {
                tauri::RunEvent::WindowEvent {
                    label,
                    event: tauri::WindowEvent::CloseRequested { api, .. },
                    ..
                } => {
                    if label == "main" {
                        // Save window geometry before hiding/closing
                        save_window_geometry(app);

                        let minimize = app
                            .try_state::<SettingsState>()
                            .map(|s| s.0.lock().map(|s| s.minimize_to_tray).unwrap_or(true))
                            .unwrap_or(true);

                        if minimize {
                            api.prevent_close();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                    }
                }
                tauri::RunEvent::ExitRequested { .. } => {
                    if let Some(signal) = app.try_state::<ShutdownSignal>() {
                        if let Ok(mut guard) = signal.0.lock() {
                            if let Some(tx) = guard.take() {
                                let _ = tx.send(true);
                            }
                        }
                    }
                }
                _ => {}
            }
        });
}
