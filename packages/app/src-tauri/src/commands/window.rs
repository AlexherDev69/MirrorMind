use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};
use std::sync::Mutex;

const MINI_WIDTH: u32 = 280;
const MINI_HEIGHT: u32 = 500;

/// Stores the normal window geometry and decoration state to restore after mini-player mode.
pub struct NormalWindowGeometry(pub Mutex<Option<(PhysicalPosition<i32>, PhysicalSize<u32>)>>);

#[tauri::command]
pub async fn enter_mini_player(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;

    // Save current geometry
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;

    if let Some(state) = app.try_state::<NormalWindowGeometry>() {
        let mut guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some((position, size));
    }

    // Remove decorations (title bar) and shrink
    let _ = window.set_decorations(false);
    let _ = window.set_always_on_top(true);
    let _ = window.set_min_size(Some(PhysicalSize::new(200u32, 300u32)));
    let _ = window.set_size(PhysicalSize::new(MINI_WIDTH, MINI_HEIGHT));

    Ok(())
}

#[tauri::command]
pub async fn exit_mini_player(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;

    // Restore decorations
    let _ = window.set_decorations(true);

    // Restore always-on-top from settings
    if let Some(settings) = app.try_state::<super::settings::SettingsState>() {
        let guard = settings.0.lock().unwrap_or_else(|e| e.into_inner());
        let _ = window.set_always_on_top(guard.always_on_top);
    }

    // Restore min size
    let _ = window.set_min_size(Some(PhysicalSize::new(320u32, 568u32)));

    // Restore saved geometry
    if let Some(state) = app.try_state::<NormalWindowGeometry>() {
        let guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
        if let Some((pos, size)) = *guard {
            let _ = window.set_size(size);
            let _ = window.set_position(pos);
        }
    }

    Ok(())
}
