use axum::{extract::{Path, State}, http::StatusCode, response::IntoResponse};
use serde::Serialize;
use std::sync::Arc;

use crate::commands::adb;
use crate::commands::scrcpy::StreamState;
use crate::internal_api::auth::ApiState;
use super::common::*;

// ── Devices list ────────────────────────────────────────────────

pub async fn devices_handler() -> Result<impl IntoResponse, ApiError> {
    let devices = adb::list_devices().await.map_err(ApiError::from)?;
    Ok(ok_json(devices))
}

// ── Device info ─────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfoData {
    pub serial: String,
    pub model: String,
    pub brand: String,
    pub android_version: String,
    pub screen_size: String,
}

pub async fn device_info_handler(
    Path(serial): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    adb::validate_serial(&serial)
        .map_err(|e| ApiError(StatusCode::BAD_REQUEST, e))?;

    let output = std::process::Command::new("adb")
        .args(["-s", &serial, "shell", "getprop ro.product.model"])
        .output()
        .map_err(|e| format!("Failed to get device info: {}", e))?;
    let model = String::from_utf8_lossy(&output.stdout).trim().to_string();

    let output = std::process::Command::new("adb")
        .args(["-s", &serial, "shell", "getprop ro.product.brand"])
        .output()
        .map_err(|e| format!("Failed to get brand: {}", e))?;
    let brand = String::from_utf8_lossy(&output.stdout).trim().to_string();

    let output = std::process::Command::new("adb")
        .args(["-s", &serial, "shell", "getprop ro.build.version.release"])
        .output()
        .map_err(|e| format!("Failed to get android version: {}", e))?;
    let android_version = String::from_utf8_lossy(&output.stdout).trim().to_string();

    let output = std::process::Command::new("adb")
        .args(["-s", &serial, "shell", "wm", "size"])
        .output()
        .map_err(|e| format!("Failed to get screen size: {}", e))?;
    let screen_size = String::from_utf8_lossy(&output.stdout).trim().to_string();

    Ok(ok_json(DeviceInfoData {
        serial: serial.to_string(),
        model: if model.is_empty() { "Unknown".to_string() } else { model },
        brand: if brand.is_empty() { "Unknown".to_string() } else { brand },
        android_version: if android_version.is_empty() { "Unknown".to_string() } else { android_version },
        screen_size: if screen_size.is_empty() { "Unknown".to_string() } else { screen_size },
    }))
}

// ── Stream status ───────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamStatusData {
    pub state: String,
    pub width: u32,
    pub height: u32,
}

pub async fn stream_status_handler(
    State(state): State<Arc<ApiState>>,
) -> impl IntoResponse {
    use tauri::Manager;

    if let Some(stream_state) = state.app_handle.try_state::<StreamState>() {
        let width = *stream_state.screen_width.lock().unwrap_or_else(|e| e.into_inner());
        let height = *stream_state.screen_height.lock().unwrap_or_else(|e| e.into_inner());
        let is_streaming = !stream_state.stop_flag.load(std::sync::atomic::Ordering::Relaxed)
            && width > 0
            && height > 0;

        ok_json(StreamStatusData {
            state: if is_streaming { "streaming" } else { "idle" }.to_string(),
            width,
            height,
        })
    } else {
        ok_json(StreamStatusData {
            state: "idle".to_string(),
            width: 0,
            height: 0,
        })
    }
}
