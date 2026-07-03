use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;
use std::sync::Arc;

use tauri::Manager;

use crate::commands::adb;
use crate::internal_api::auth::ApiState;

// ── Response types ───────────────────────────────────────────────

#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub struct ApiError(pub StatusCode, pub String);

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let body = serde_json::json!({ "success": false, "error": self.1 });
        (self.0, Json(body)).into_response()
    }
}

impl From<String> for ApiError {
    fn from(msg: String) -> Self {
        ApiError(StatusCode::INTERNAL_SERVER_ERROR, msg)
    }
}

pub fn ok_json<T: Serialize>(data: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse {
        success: true,
        data: Some(data),
        error: None,
    })
}

// ── Health ───────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthData {
    pub version: String,
    pub uptime_ms: u64,
}

pub async fn health_handler(
    axum::extract::State(state): axum::extract::State<Arc<ApiState>>,
) -> impl IntoResponse {
    let uptime = state.start_time.elapsed().as_millis() as u64;
    ok_json(HealthData {
        version: "0.1.0".to_string(),
        uptime_ms: uptime,
    })
}

// ── Shared helpers ──────────────────────────────────────────────

pub async fn resolve_device_serial(
    _state: &Arc<ApiState>,
    device_id: Option<String>,
) -> Result<String, ApiError> {
    if let Some(id) = device_id {
        adb::validate_serial(&id)
            .map_err(|e| ApiError(StatusCode::BAD_REQUEST, e))?;
        return Ok(id);
    }

    let devices = adb::list_devices().await.map_err(ApiError::from)?;

    devices
        .iter()
        .find(|d| d.state == "device")
        .map(|d| d.serial.clone())
        .ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "No connected device found".to_string()))
}

/// Parse `adb shell wm size` output.
pub fn parse_wm_size_output(output: &str) -> Result<(u32, u32), String> {
    let mut physical: Option<(u32, u32)> = None;
    let mut override_size: Option<(u32, u32)> = None;

    for line in output.lines() {
        let trimmed = line.trim();
        if let Some(dims) = trimmed.strip_prefix("Override size:") {
            if let Some(parsed) = parse_wxh(dims.trim()) {
                override_size = Some(parsed);
            }
        } else if let Some(dims) = trimmed.strip_prefix("Physical size:") {
            if let Some(parsed) = parse_wxh(dims.trim()) {
                physical = Some(parsed);
            }
        }
    }

    override_size
        .or(physical)
        .ok_or_else(|| format!("Could not parse display size from: {}", output))
}

fn parse_wxh(s: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = s.split('x').collect();
    if parts.len() == 2 {
        if let (Ok(w), Ok(h)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
            return Some((w, h));
        }
    }
    None
}

// ── ADB command helpers ─────────────────────────────────────────

pub fn adb_input_tap(serial: &str, x: f64, y: f64) -> Result<(), String> {
    crate::commands::process_utils::hidden_command("adb")
        .args(["-s", serial, "shell", "input", "tap", &(x.round() as i32).to_string(), &(y.round() as i32).to_string()])
        .output()
        .map_err(|e| format!("adb input tap failed: {}", e))?;
    Ok(())
}

pub fn adb_input_swipe(serial: &str, sx: f64, sy: f64, ex: f64, ey: f64, duration: u32) -> Result<(), String> {
    crate::commands::process_utils::hidden_command("adb")
        .args([
            "-s", serial, "shell", "input", "swipe",
            &(sx as i32).to_string(), &(sy as i32).to_string(),
            &(ex as i32).to_string(), &(ey as i32).to_string(),
            &duration.to_string(),
        ])
        .output()
        .map_err(|e| format!("adb input swipe failed: {}", e))?;
    Ok(())
}

pub fn adb_input_text(serial: &str, text: &str) -> Result<(), String> {
    let mut escaped = String::with_capacity(text.len() * 2);
    for c in text.chars() {
        match c {
            ' ' => escaped.push_str("%s"),
            '\'' | '"' | '\\' | '`' | '$' | '(' | ')' | '!' | '&' | '|' | ';' | '<' | '>' | '{' | '}' | '[' | ']' | '*' | '?' | '#' | '~' | '\n' | '\r' | '\t' => {}
            c if c.is_ascii_control() => {}
            _ => escaped.push(c),
        }
    }

    if escaped.is_empty() {
        return Ok(());
    }

    crate::commands::process_utils::hidden_command("adb")
        .args(["-s", serial, "shell", "input", "text", &escaped])
        .output()
        .map_err(|e| format!("adb input text failed: {}", e))?;
    Ok(())
}

pub fn adb_input_keyevent(serial: &str, keycode: i32) -> Result<(), String> {
    crate::commands::process_utils::hidden_command("adb")
        .args(["-s", serial, "shell", "input", "keyevent", &keycode.to_string()])
        .output()
        .map_err(|e| format!("adb input keyevent failed: {}", e))?;
    Ok(())
}

// ── Scrcpy control socket helpers ───────────────────────────────

use crate::commands::scrcpy::{self, StreamState, AKEY_EVENT_ACTION_DOWN, AKEY_EVENT_ACTION_UP};

pub fn try_scrcpy_text(app: &tauri::AppHandle, text: &str) -> bool {
    let Some(stream_state) = app.try_state::<StreamState>() else { return false };
    let msg = scrcpy::build_text_message(text);
    scrcpy::send_control_message(&stream_state, &msg).is_ok()
}

pub fn try_scrcpy_keycode(app: &tauri::AppHandle, keycode: i32) -> bool {
    let Some(stream_state) = app.try_state::<StreamState>() else { return false };
    let down = scrcpy::build_keycode_message(AKEY_EVENT_ACTION_DOWN, keycode, 0, 0);
    let up = scrcpy::build_keycode_message(AKEY_EVENT_ACTION_UP, keycode, 0, 0);
    scrcpy::send_control_message(&stream_state, &down).is_ok()
        && scrcpy::send_control_message(&stream_state, &up).is_ok()
}
