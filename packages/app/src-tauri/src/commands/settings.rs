use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Manager;

const SETTINGS_FILE: &str = "settings.json";
const ONBOARDED_DEVICES_FILE: &str = "onboarded_devices.json";

/// Application settings, persisted to disk.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub max_resolution: u32,
    pub bitrate: u32,
    pub max_fps: u32,
    pub always_on_top: bool,
    pub minimize_to_tray: bool,
    pub scroll_sensitivity: f32,
    pub screenshot_path: String,
    pub recording_path: String,
    pub window_x: Option<i32>,
    pub window_y: Option<i32>,
    pub window_width: Option<u32>,
    pub window_height: Option<u32>,
}

impl Default for AppSettings {
    fn default() -> Self {
        let pictures = dirs_next::picture_dir()
            .unwrap_or_else(|| dirs_next::home_dir().unwrap_or_else(|| std::path::PathBuf::from(".")));

        let screenshot_dir = pictures.join("MirrorMind").join("Screen");
        let recording_dir = pictures.join("MirrorMind").join("Video");

        // Create directories eagerly so they exist by default
        let _ = std::fs::create_dir_all(&screenshot_dir);
        let _ = std::fs::create_dir_all(&recording_dir);

        Self {
            max_resolution: 0,
            bitrate: 8_000_000,
            max_fps: 60,
            always_on_top: true,
            minimize_to_tray: true,
            scroll_sensitivity: 10.0,
            screenshot_path: screenshot_dir.to_string_lossy().to_string(),
            recording_path: recording_dir.to_string_lossy().to_string(),
            window_x: None,
            window_y: None,
            window_width: None,
            window_height: None,
        }
    }
}

/// Managed Tauri state holding the current settings.
pub struct SettingsState(pub Mutex<AppSettings>);

fn get_settings_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create app data dir: {}", e))?;
    Ok(dir.join(SETTINGS_FILE))
}

/// Load settings from disk. Returns defaults if file doesn't exist.
pub fn load_settings_from_disk(app: &AppHandle) -> AppSettings {
    let path = match get_settings_path(app) {
        Ok(p) => p,
        Err(_) => return AppSettings::default(),
    };

    if !path.exists() {
        return AppSettings::default();
    }

    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

/// Save settings to disk (public for use from lib.rs window geometry save).
pub fn save_settings_to_disk_from(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    save_settings_to_disk(app, settings)
}

fn save_settings_to_disk(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path(app)?;
    let content =
        serde_json::to_string_pretty(settings).map_err(|e| format!("Serialize error: {}", e))?;
    std::fs::write(&path, &content).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let state = app
        .try_state::<SettingsState>()
        .ok_or("Settings state not available")?;
    let settings = state.0.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    // Update managed state
    let state = app
        .try_state::<SettingsState>()
        .ok_or("Settings state not available")?;
    {
        let mut current = state.0.lock().map_err(|e| e.to_string())?;
        *current = settings.clone();
    }

    // Persist to disk
    save_settings_to_disk(&app, &settings)?;

    // Apply always_on_top immediately
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(settings.always_on_top);
    }

    Ok(())
}

#[tauri::command]
pub async fn set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    // Update state
    let state = app
        .try_state::<SettingsState>()
        .ok_or("Settings state not available")?;
    {
        let mut current = state.0.lock().map_err(|e| e.to_string())?;
        current.always_on_top = enabled;
        save_settings_to_disk(&app, &current)?;
    }

    // Apply immediately
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_always_on_top(enabled)
            .map_err(|e| format!("Failed to set always on top: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn reset_onboarding(app: AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot get app data dir: {}", e))?;
    let path = dir.join(ONBOARDED_DEVICES_FILE);

    if path.exists() {
        std::fs::write(&path, "[]").map_err(|e| format!("Failed to reset onboarding: {}", e))?;
    }

    Ok(())
}

/// Take a screenshot of the phone and save it to the configured path.
/// Returns the full file path of the saved screenshot.
#[tauri::command]
pub async fn take_screenshot(app: AppHandle) -> Result<String, String> {
    let save_dir = {
        let state = app
            .try_state::<SettingsState>()
            .ok_or("Settings not available")?;
        let settings = state.0.lock().map_err(|e| e.to_string())?;
        if settings.screenshot_path.is_empty() {
            dirs_next::desktop_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
        } else {
            std::path::PathBuf::from(&settings.screenshot_path)
        }
    };

    std::fs::create_dir_all(&save_dir)
        .map_err(|e| format!("Cannot create screenshot directory: {}", e))?;

    // Find first connected device
    let serial = super::adb::find_first_connected_device()?;

    // Capture via adb screencap
    let output = std::process::Command::new("adb")
        .args(["-s", &serial, "exec-out", "screencap", "-p"])
        .output()
        .map_err(|e| format!("Screenshot failed: {}", e))?;

    if !output.status.success() || output.stdout.is_empty() {
        return Err("Screenshot capture returned empty data".to_string());
    }

    // Save with timestamp filename
    let now = chrono::Local::now();
    let filename = format!("PhoneStream_{}.png", now.format("%Y%m%d_%H%M%S"));
    let filepath = save_dir.join(&filename);

    std::fs::write(&filepath, &output.stdout)
        .map_err(|e| format!("Failed to save screenshot: {}", e))?;

    Ok(filepath.to_string_lossy().to_string())
}

/// Start recording by capturing scrcpy H.264 frames to a local file.
/// The recording taps into the existing scrcpy stream — no extra adb process needed.
#[tauri::command]
pub async fn start_recording(app: AppHandle) -> Result<String, String> {
    use super::scrcpy::StreamState;

    let stream_state = app
        .try_state::<StreamState>()
        .ok_or("Stream not active. Connect a device first.")?;

    // Check if already recording
    {
        let guard = stream_state.recording_file.lock().map_err(|e| e.to_string())?;
        if guard.is_some() {
            return Err("Already recording".to_string());
        }
    }

    let save_dir = {
        let state = app
            .try_state::<SettingsState>()
            .ok_or("Settings not available")?;
        let settings = state.0.lock().map_err(|e| e.to_string())?;
        if settings.recording_path.is_empty() {
            dirs_next::picture_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("MirrorMind")
                .join("Video")
        } else {
            std::path::PathBuf::from(&settings.recording_path)
        }
    };

    std::fs::create_dir_all(&save_dir)
        .map_err(|e| format!("Cannot create recording directory: {}", e))?;

    let now = chrono::Local::now();
    let filename = format!("PhoneStream_{}.h264", now.format("%Y%m%d_%H%M%S"));
    let filepath = save_dir.join(&filename);

    let file = std::fs::File::create(&filepath)
        .map_err(|e| format!("Cannot create recording file: {}", e))?;

    let filepath_str = filepath.to_string_lossy().to_string();

    {
        let mut guard = stream_state.recording_file.lock().map_err(|e| e.to_string())?;
        *guard = Some((file, filepath_str.clone()));
    }

    Ok(filepath_str)
}

/// Stop recording, remux to MP4, and return the file path.
#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> Result<String, String> {
    use super::scrcpy::StreamState;

    let stream_state = app
        .try_state::<StreamState>()
        .ok_or("Stream not active")?;

    let h264_path = {
        let mut guard = stream_state.recording_file.lock().map_err(|e| e.to_string())?;
        let (file, path) = guard.take().ok_or("Not recording")?;
        drop(file);
        path
    };

    // Remux H.264 → MP4 via ffmpeg
    let mp4_path = h264_path.replace(".h264", ".mp4");

    let output = std::process::Command::new("ffmpeg")
        .args([
            "-y",                    // overwrite
            "-f", "h264",            // input format
            "-i", &h264_path,        // input file
            "-c:v", "copy",          // no re-encoding
            "-movflags", "+faststart", // streaming-friendly
            &mp4_path,
        ])
        .output();

    match output {
        Ok(result) if result.status.success() => {
            // Remove the raw .h264 file
            let _ = std::fs::remove_file(&h264_path);
            Ok(mp4_path)
        }
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            eprintln!("[recording] ffmpeg remux failed: {}", stderr);
            // Return the h264 file as fallback
            Ok(h264_path)
        }
        Err(_) => {
            // ffmpeg not available — return raw h264
            Ok(h264_path)
        }
    }
}

