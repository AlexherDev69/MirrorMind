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
    let output = std::process::Command::new("adb")
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

    let output = std::process::Command::new("adb")
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

pub async fn deep_link_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<DeepLinkPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;

    let uri_lower = body.uri.to_lowercase();
    let has_valid_scheme = ALLOWED_URI_SCHEMES.iter().any(|s| uri_lower.starts_with(s));
    if !has_valid_scheme {
        return Err(ApiError(StatusCode::BAD_REQUEST, format!(
            "Invalid URI scheme. Got: {}",
            body.uri.chars().take(30).collect::<String>()
        )));
    }

    if body.uri.chars().any(|c| matches!(c, ';' | '&' | '|' | '`' | '$' | '(' | ')' | '\n' | '\r')) {
        return Err(ApiError(StatusCode::BAD_REQUEST, "URI contains invalid characters".to_string()));
    }

    let output = std::process::Command::new("adb")
        .args(["-s", &serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", &body.uri])
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
    let serial = resolve_device_serial(&state, body.device_id).await?;

    let output = std::process::Command::new("adb")
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
        let _ = std::process::Command::new("adb")
            .args(["-s", &serial, "shell", "uiautomator", "dump", "/data/local/tmp/ps_ui.xml"])
            .output();
        let cat = std::process::Command::new("adb")
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
