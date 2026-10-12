use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::internal_api::auth::ApiState;
use super::common::*;
use super::device_control::ScreenshotRequest;

// ── Current Activity ────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentActivityData {
    pub package_name: String,
    pub activity_name: String,
}

pub async fn current_activity_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<ScreenshotRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;
    let output = crate::commands::process_utils::hidden_command("adb")
        .args(["-s", &serial, "shell", "dumpsys", "activity", "activities"])
        .output()
        .map_err(|e| format!("adb dumpsys failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.contains("topResumedActivity") || trimmed.contains("mResumedActivity") {
            if let Some(start) = trimmed.find(" u0 ") {
                let rest = &trimmed[start + 4..];
                let end = rest.find(|c: char| c == ' ' || c == '}').unwrap_or(rest.len());
                let component = &rest[..end];
                if let Some(slash_pos) = component.find('/') {
                    let package = &component[..slash_pos];
                    let activity = &component[slash_pos + 1..];
                    return Ok(ok_json(CurrentActivityData {
                        package_name: package.to_string(),
                        activity_name: activity.to_string(),
                    }));
                }
            }
        }
    }

    Err(ApiError::from("Could not determine current activity".to_string()))
}

// ── Run App ─────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAppPayload {
    pub package_name: String,
    pub device_id: Option<String>,
}

pub async fn run_app_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<RunAppPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;

    if !body.package_name.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '_') {
        return Err(ApiError::from("Invalid package name".to_string()));
    }

    let output = crate::commands::process_utils::hidden_command("adb")
        .args(["-s", &serial, "shell", "monkey", "-p", &body.package_name, "-c", "android.intent.category.LAUNCHER", "1"])
        .output()
        .map_err(|e| format!("adb monkey failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.contains("No activities found") {
        return Err(ApiError::from(format!("App '{}' not found or has no launcher activity", body.package_name)));
    }

    Ok(ok_json(format!("Launched {}", body.package_name)))
}

// ── Deep Link ───────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepLinkPayload {
    pub uri: String,
    pub device_id: Option<String>,
}

const ALLOWED_URI_SCHEMES: &[&str] = &[
    "http://", "https://", "tel:", "sms:", "smsto:", "mailto:", "geo:",
    "market://", "intent://",
    "twitter://", "instagram://", "whatsapp://", "tg://", "fb://",
    "fb-messenger://", "snapchat://", "spotify://", "youtube://",
    "nflx://", "twitch://", "reddit://", "linkedin://", "discord://",
    "barcelona://", "googlechrome://", "googlemail://", "google.navigation://",
    "amzn://", "uber://", "github://", "chatgpt://", "claude://",
    "snssdk1233://", "content://",
    "android.settings://",
];

/// Characters refused in a deep link. The URI is single-quoted for the phone
/// shell, so this is defence in depth: none of them belongs in a valid URI.
const FORBIDDEN_URI_CHARS: [char; 9] = ['\'', '"', '`', '$', ';', '|', '<', '>', '\\'];

/// Check that `uri` uses an allowed scheme and can only ever be one argument
/// of `am start`. Whitespace is the important case: unquoted, it would let a
/// caller append options such as `-n <component>`.
fn validate_deep_link_uri(uri: &str) -> Result<(), String> {
    let uri_lower = uri.to_lowercase();
    if !ALLOWED_URI_SCHEMES.iter().any(|scheme| uri_lower.starts_with(scheme)) {
        return Err(format!(
            "Invalid URI scheme. Got: {}",
            uri.chars().take(30).collect::<String>()
        ));
    }

    let has_invalid_char = uri
        .chars()
        .any(|c| c.is_whitespace() || c.is_control() || FORBIDDEN_URI_CHARS.contains(&c));
    if has_invalid_char {
        return Err("URI contains invalid characters".to_string());
    }
    Ok(())
}

pub async fn deep_link_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<DeepLinkPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;

    validate_deep_link_uri(&body.uri).map_err(|e| ApiError(StatusCode::BAD_REQUEST, e))?;

    let quoted_uri = shell_single_quote(&body.uri);
    let output = crate::commands::process_utils::hidden_command("adb")
        .args(["-s", &serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", &quoted_uri])
        .output()
        .map_err(|e| format!("adb am start failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.contains("Error") {
        return Err(ApiError::from(format!("Deep link failed: {}", stdout.trim())));
    }

    Ok(ok_json(format!("Opened {}", body.uri)))
}

// ── UI Tree ─────────────────────────────────────────────────────

pub async fn ui_tree_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<ScreenshotRequest>,
) -> Result<impl IntoResponse, ApiError> {
    ensure_capture_consent(&state)?;
    let serial = resolve_device_serial(&state, body.device_id).await?;

    let output = crate::commands::process_utils::hidden_command("adb")
        .args(["-s", &serial, "exec-out", "uiautomator", "dump", "/dev/tty"])
        .output()
        .map_err(|e| format!("uiautomator dump failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    let xml = if let Some(pos) = stdout.find("<?xml") {
        &stdout[pos..]
    } else {
        stdout.trim()
    };

    if xml.is_empty() || !xml.contains("node") {
        let _ = crate::commands::process_utils::hidden_command("adb")
            .args(["-s", &serial, "shell", "uiautomator", "dump", "/data/local/tmp/ps_ui.xml"])
            .output();
        let cat = crate::commands::process_utils::hidden_command("adb")
            .args(["-s", &serial, "exec-out", "cat", "/data/local/tmp/ps_ui.xml"])
            .output()
            .map_err(|e| format!("Failed to read UI dump: {}", e))?;
        let fallback = String::from_utf8_lossy(&cat.stdout);
        if fallback.is_empty() || !fallback.contains("node") {
            return Err(ApiError::from("uiautomator dump returned empty result. Screen may be locked.".to_string()));
        }
        return Ok(ok_json(fallback.to_string()));
    }

    Ok(ok_json(xml.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_accept_uri_with_query_ampersand() {
        assert!(validate_deep_link_uri("https://example.com/search?q=a&page=2").is_ok());
    }

    #[test]
    fn should_reject_uri_when_it_contains_whitespace() {
        assert!(validate_deep_link_uri("https://x -n com.app/.ExportedActivity").is_err());
    }

    #[test]
    fn should_reject_uri_when_it_contains_redirection() {
        assert!(validate_deep_link_uri("https://x>/sdcard/f").is_err());
    }

    #[test]
    fn should_reject_uri_when_it_contains_single_quote() {
        assert!(validate_deep_link_uri("https://x'y").is_err());
    }

    #[test]
    fn should_reject_uri_when_scheme_is_not_allowed() {
        assert!(validate_deep_link_uri("file:///sdcard/secret").is_err());
    }
}
