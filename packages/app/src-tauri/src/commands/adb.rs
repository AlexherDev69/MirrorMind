use serde::Serialize;
use std::process::Command;
use tauri::{AppHandle, Manager};

const ONBOARDED_DEVICES_FILE: &str = "onboarded_devices.json";

/// Validate that a device serial contains only safe characters (alphanumeric, hyphens, colons, dots).
/// Prevents ADB command injection.
pub fn validate_serial(serial: &str) -> Result<(), String> {
    if serial.is_empty() {
        return Err("Device serial is empty".to_string());
    }
    if serial.len() > 64 {
        return Err("Device serial is too long".to_string());
    }
    if !serial.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == ':' || c == '.') {
        return Err(format!("Invalid device serial: {}", serial));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct AdbDevice {
    pub serial: String,
    pub state: String,
    pub model: String,
}

/// Find the first connected device serial (sync, for use in non-async contexts).
pub fn find_first_connected_device() -> Result<String, String> {
    let output = Command::new("adb")
        .args(["devices"])
        .output()
        .map_err(|e| format!("adb failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .skip(1)
        .filter_map(|l| {
            let parts: Vec<&str> = l.split('\t').collect();
            if parts.len() >= 2 && parts[1] == "device" {
                Some(parts[0].to_string())
            } else {
                None
            }
        })
        .next()
        .ok_or_else(|| "No connected device found".to_string())
}

#[tauri::command]
pub async fn list_devices() -> Result<Vec<AdbDevice>, String> {
    let output = Command::new("adb")
        .args(["devices", "-l"])
        .output()
        .map_err(|e| format!("Failed to run adb: {}. Is adb installed and on PATH?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "adb devices failed (exit {:?}): stderr={}, stdout={}",
            output.status.code(),
            stderr,
            stdout
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let devices: Vec<AdbDevice> = stdout
        .lines()
        .skip(1) // skip "List of devices attached"
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| parse_device_line(line))
        .collect();

    Ok(devices)
}

fn parse_device_line(line: &str) -> Option<AdbDevice> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }

    let serial = parts[0].to_string();
    let state = parts[1].to_string();

    let model = parts
        .iter()
        .find(|p| p.starts_with("model:"))
        .map(|p| p.trim_start_matches("model:").to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    Some(AdbDevice {
        serial,
        state,
        model,
    })
}

#[tauri::command]
pub async fn check_adb_available() -> Result<String, String> {
    let output = Command::new("adb")
        .arg("version")
        .output()
        .map_err(|e| format!("adb not found: {}. Please install Android SDK Platform Tools.", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout);
        let first_line = version.lines().next().unwrap_or("unknown");
        Ok(first_line.to_string())
    } else {
        Err("adb found but returned an error".to_string())
    }
}

#[tauri::command]
pub async fn get_device_brand(serial: String) -> Result<String, String> {
    validate_serial(&serial)?;
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "getprop", "ro.product.brand"])
        .output()
        .map_err(|e| format!("Failed to get brand: {}", e))?;

    if !output.status.success() {
        return Err("Device not authorized or not found".to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_lowercase().to_string())
}

#[tauri::command]
pub async fn get_onboarded_devices(app: AppHandle) -> Result<Vec<String>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = app_data_dir.join(ONBOARDED_DEVICES_FILE);

    if !path.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read onboarded devices: {}", e))?;
    let devices: Vec<String> = serde_json::from_str(&content).unwrap_or_default();
    Ok(devices)
}

#[tauri::command]
pub async fn mark_device_onboarded(app: AppHandle, serial: String) -> Result<(), String> {
    validate_serial(&serial)?;
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data_dir).ok();
    let path = app_data_dir.join(ONBOARDED_DEVICES_FILE);

    let mut devices: Vec<String> = if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        vec![]
    };

    if !devices.contains(&serial) {
        devices.push(serial);
    }

    let content = serde_json::to_string_pretty(&devices)
        .map_err(|e| format!("Cannot serialize: {}", e))?;
    std::fs::write(&path, &content)
        .map_err(|e| format!("Cannot write: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_serial_valid() {
        assert!(validate_serial("867b47f7").is_ok());
        assert!(validate_serial("R5CT50ABCDE").is_ok());
        assert!(validate_serial("192.168.1.1:5555").is_ok());
        assert!(validate_serial("emulator-5554").is_ok());
    }

    #[test]
    fn test_validate_serial_empty() {
        assert!(validate_serial("").is_err());
    }

    #[test]
    fn test_validate_serial_too_long() {
        let long = "a".repeat(65);
        assert!(validate_serial(&long).is_err());
    }

    #[test]
    fn test_validate_serial_injection() {
        assert!(validate_serial("abc; rm -rf /").is_err());
        assert!(validate_serial("abc && echo pwned").is_err());
        assert!(validate_serial("$(whoami)").is_err());
        assert!(validate_serial("abc\nshell").is_err());
    }
}
