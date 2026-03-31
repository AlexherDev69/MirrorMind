use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;

use super::settings::SettingsState;

const MACROS_DIR: &str = "macros";

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MacroInfo {
    pub name: String,
    pub description: String,
    pub recorded_at: String,
    pub duration: u64,
    pub action_count: usize,
}

fn get_macros_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let state = app
        .try_state::<SettingsState>()
        .ok_or("Settings not loaded")?;
    let recording_path = {
        let guard = match state.0.lock() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };
        guard.recording_path.clone()
    };

    let dir = std::path::PathBuf::from(&recording_path).join(MACROS_DIR);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create macros directory: {}", e))?;
    Ok(dir)
}

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

#[tauri::command]
pub async fn save_macro(app: AppHandle, macro_json: String) -> Result<String, String> {
    let session: serde_json::Value =
        serde_json::from_str(&macro_json).map_err(|e| format!("Invalid JSON: {}", e))?;

    let name = session
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("Missing macro name")?;
    let safe_name = sanitize_name(name);

    if safe_name.is_empty() {
        return Err("Macro name cannot be empty".to_string());
    }

    let dir = get_macros_dir(&app)?;
    let path = dir.join(format!("{}.json", safe_name));

    let formatted = serde_json::to_string_pretty(&session)
        .map_err(|e| format!("Cannot serialize: {}", e))?;

    std::fs::write(&path, &formatted).map_err(|e| format!("Cannot write macro: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

/// Internal version callable from handlers (no #[tauri::command]).
pub fn list_macros_internal(app: &AppHandle) -> Result<Vec<MacroInfo>, String> {
    let dir = get_macros_dir(app)?;
    let mut macros = Vec::new();

    let entries = std::fs::read_dir(&dir).map_err(|e| format!("Cannot read macros dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(true, |ext| ext != "json") {
            continue;
        }
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let session: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let actions = session.get("actions").and_then(|v| v.as_array()).map(|a| a.len()).unwrap_or(0);
        macros.push(MacroInfo {
            name: session.get("name").and_then(|v| v.as_str()).unwrap_or("unnamed").to_string(),
            description: session.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            recorded_at: session.get("recordedAt").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            duration: session.get("duration").and_then(|v| v.as_u64()).unwrap_or(0),
            action_count: actions,
        });
    }

    Ok(macros)
}

/// Internal version callable from handlers.
pub fn load_macro_internal(app: &AppHandle, name: &str) -> Result<String, String> {
    let dir = get_macros_dir(app)?;
    let safe_name = sanitize_name(name);
    let path = dir.join(format!("{}.json", safe_name));

    if !path.exists() {
        return Err(format!("Macro '{}' not found", name));
    }

    std::fs::read_to_string(&path).map_err(|e| format!("Cannot read macro: {}", e))
}

#[tauri::command]
pub async fn list_macros(app: AppHandle) -> Result<Vec<MacroInfo>, String> {
    list_macros_internal(&app)
}

#[tauri::command]
pub async fn load_macro(app: AppHandle, name: String) -> Result<String, String> {
    load_macro_internal(&app, &name)
}

#[tauri::command]
pub async fn delete_macro(app: AppHandle, name: String) -> Result<(), String> {
    let dir = get_macros_dir(&app)?;
    let safe_name = sanitize_name(&name);
    let path = dir.join(format!("{}.json", safe_name));

    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Cannot delete macro: {}", e))?;
    }

    Ok(())
}
