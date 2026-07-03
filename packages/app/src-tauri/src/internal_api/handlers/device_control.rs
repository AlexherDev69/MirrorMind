use axum::{extract::State, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::internal_api::auth::ApiState;
use crate::internal_api::screenshot;
use base64::Engine;
use super::common::*;

// ── Screenshot ──────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotRequest {
    pub device_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotData {
    pub base64: String,
    pub mime_type: String,
    pub width: u32,
    pub height: u32,
}

pub async fn screenshot_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<ScreenshotRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;
    let png_data = screenshot::capture_screenshot(&serial).map_err(ApiError::from)?;
    let (width, height) = screenshot::parse_png_dimensions(&png_data).map_err(ApiError::from)?;

    let encoder = base64::engine::general_purpose::STANDARD;
    let b64 = encoder.encode(&png_data);

    Ok(ok_json(ScreenshotData {
        base64: b64,
        mime_type: "image/png".to_string(),
        width,
        height,
    }))
}

// ── Tap ─────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TapPayload {
    pub x: f64,
    pub y: f64,
    pub device_id: Option<String>,
}

pub async fn tap_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<TapPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;
    adb_input_tap(&serial, body.x, body.y).map_err(ApiError::from)?;
    Ok(ok_json(format!("Tapped at ({}, {})", body.x, body.y)))
}

// ── Swipe ───────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwipePayload {
    pub start_x: f64,
    pub start_y: f64,
    pub end_x: f64,
    pub end_y: f64,
    pub duration_ms: Option<u32>,
    pub device_id: Option<String>,
}

pub async fn swipe_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<SwipePayload>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;
    let duration = body.duration_ms.unwrap_or(300);
    adb_input_swipe(&serial, body.start_x, body.start_y, body.end_x, body.end_y, duration)
        .map_err(ApiError::from)?;
    Ok(ok_json(format!(
        "Swiped from ({},{}) to ({},{}) in {}ms",
        body.start_x, body.start_y, body.end_x, body.end_y, duration
    )))
}

// ── Type text ───────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeTextPayload {
    pub text: String,
    pub device_id: Option<String>,
}

pub async fn type_text_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<TypeTextPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;

    if try_scrcpy_text(&state.app_handle, &body.text) {
        return Ok(ok_json(format!("Typed: {}", body.text)));
    }

    adb_input_text(&serial, &body.text).map_err(ApiError::from)?;
    Ok(ok_json(format!("Typed via adb: {}", body.text)))
}

// ── Key press ───────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyPressPayload {
    pub key_code: i32,
    pub device_id: Option<String>,
}

pub async fn key_press_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<KeyPressPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;

    if try_scrcpy_keycode(&state.app_handle, body.key_code) {
        return Ok(ok_json(format!("Key pressed: {}", body.key_code)));
    }

    adb_input_keyevent(&serial, body.key_code).map_err(ApiError::from)?;
    Ok(ok_json(format!("Key pressed via adb: {}", body.key_code)))
}

// ── Display size ────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySizeRequest {
    pub device_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplaySizeData {
    pub width: u32,
    pub height: u32,
}

pub async fn display_size_handler(
    State(state): State<Arc<ApiState>>,
    Json(body): Json<DisplaySizeRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let serial = resolve_device_serial(&state, body.device_id).await?;
    let output = crate::commands::process_utils::hidden_command("adb")
        .args(["-s", &serial, "shell", "wm", "size"])
        .output()
        .map_err(|e| format!("Failed to get display size: {}", e))?;

    if !output.status.success() {
        return Err(ApiError::from(format!(
            "adb wm size failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let (width, height) = parse_wm_size_output(&stdout).map_err(ApiError::from)?;
    Ok(ok_json(DisplaySizeData { width, height }))
}
