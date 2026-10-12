use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;
use std::sync::Arc;

use tauri::{Emitter, Manager};

use crate::commands::adb;
use crate::commands::settings::SettingsState;
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
        version: env!("CARGO_PKG_VERSION").to_string(),
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

/// Quote `value` so the phone shell reads it as one literal argument.
/// `adb shell` joins its arguments and hands them to a shell on the device,
/// so anything left unquoted is re-parsed there.
pub fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// Run an adb command and fail when adb or the device reports an error, so
/// callers never report success for an action that did not happen.
fn run_adb(args: &[&str], action: &str) -> Result<(), String> {
    let output = crate::commands::process_utils::hidden_command("adb")
        .args(args)
        .output()
        .map_err(|e| format!("adb {} failed: {}", action, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("adb {} failed: {}", action, stderr.trim()));
    }
    Ok(())
}

pub fn adb_input_tap(serial: &str, x: f64, y: f64) -> Result<(), String> {
    run_adb(
        &["-s", serial, "shell", "input", "tap", &(x.round() as i32).to_string(), &(y.round() as i32).to_string()],
        "input tap",
    )
}

pub fn adb_input_swipe(serial: &str, sx: f64, sy: f64, ex: f64, ey: f64, duration: u32) -> Result<(), String> {
    run_adb(
        &[
            "-s", serial, "shell", "input", "swipe",
            &(sx as i32).to_string(), &(sy as i32).to_string(),
            &(ex as i32).to_string(), &(ey as i32).to_string(),
            &duration.to_string(),
        ],
        "input swipe",
    )
}

/// Build the argument for `input text`: control characters cannot be typed
/// and are dropped, spaces use the `%s` escape of the `input` tool, and the
/// result is quoted so every other character reaches the phone unchanged.
fn build_input_text_argument(text: &str) -> Option<String> {
    let typed: String = text.chars().filter(|c| !c.is_control()).collect();
    if typed.is_empty() {
        return None;
    }
    Some(shell_single_quote(&typed.replace(' ', "%s")))
}

pub fn adb_input_text(serial: &str, text: &str) -> Result<(), String> {
    let Some(argument) = build_input_text_argument(text) else {
        return Ok(());
    };
    run_adb(&["-s", serial, "shell", "input", "text", &argument], "input text")
}

pub fn adb_input_keyevent(serial: &str, keycode: i32) -> Result<(), String> {
    run_adb(
        &["-s", serial, "shell", "input", "keyevent", &keycode.to_string()],
        "input keyevent",
    )
}

// ── Screen capture consent ──────────────────────────────────────

/// Event asking the UI to prompt the user for screen capture consent.
const CAPTURE_CONSENT_EVENT: &str = "mcp-capture-consent-required";

/// Screen content only leaves the app once the user allowed it, either in the
/// settings or through the prompt raised by the first refused request.
pub fn ensure_capture_consent(state: &ApiState) -> Result<(), ApiError> {
    let allowed = state
        .app_handle
        .try_state::<SettingsState>()
        .map(|settings| settings.0.lock().unwrap_or_else(|e| e.into_inner()).mcp_capture_allowed)
        .unwrap_or(false);

    if allowed {
        return Ok(());
    }

    let _ = state.app_handle.emit(CAPTURE_CONSENT_EVENT, ());
    Err(ApiError(
        StatusCode::FORBIDDEN,
        "Screen capture via MCP is not authorized yet. Approve it in the MirrorMind window, then retry."
            .to_string(),
    ))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_wrap_value_in_single_quotes_when_quoting_for_shell() {
        assert_eq!(shell_single_quote("a b&c"), "'a b&c'");
    }

    #[test]
    fn should_escape_single_quote_when_quoting_for_shell() {
        assert_eq!(shell_single_quote("it's"), "'it'\\''s'");
    }

    #[test]
    fn should_keep_special_characters_when_building_input_text() {
        assert_eq!(build_input_text_argument("a&b;c"), Some("'a&b;c'".to_string()));
    }

    #[test]
    fn should_encode_spaces_when_building_input_text() {
        assert_eq!(build_input_text_argument("hello world"), Some("'hello%sworld'".to_string()));
    }

    #[test]
    fn should_return_none_when_text_has_only_control_characters() {
        assert_eq!(build_input_text_argument("\n\t"), None);
    }
}
