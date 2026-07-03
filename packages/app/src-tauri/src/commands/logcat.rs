use serde::Serialize;
use std::io::BufRead;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

use super::process_utils::hidden_command;

/// Managed state for the logcat process.
pub struct LogcatState {
    pub stop_flag: Arc<AtomicBool>,
    pub is_running: Arc<AtomicBool>,
    pub serial: Mutex<String>,
}

impl LogcatState {
    pub fn new() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
            is_running: Arc::new(AtomicBool::new(false)),
            serial: Mutex::new(String::new()),
        }
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub timestamp: String,
    pub pid: String,
    pub tid: String,
    pub level: String,
    pub tag: String,
    pub message: String,
}

/// Parse a logcat threadtime line into a LogEntry.
fn parse_logcat_line(line: &str) -> Option<LogEntry> {
    let line = line.trim();
    if line.is_empty() || line.starts_with('-') {
        return None;
    }
    if line.len() < 33 {
        return None;
    }

    let timestamp = line.get(0..18)?.trim().to_string();
    let rest = line.get(18..)?.trim_start();

    let mut parts = rest.splitn(2, ' ');
    let pid = parts.next()?.trim().to_string();
    let rest = parts.next()?.trim_start();

    let mut parts = rest.splitn(2, ' ');
    let tid = parts.next()?.trim().to_string();
    let rest = parts.next()?.trim_start();

    let level = rest.get(0..1)?.to_string();
    let rest = rest.get(1..)?.trim_start();

    if let Some(colon_pos) = rest.find(": ") {
        Some(LogEntry {
            timestamp,
            pid,
            tid,
            level,
            tag: rest[..colon_pos].trim().to_string(),
            message: rest[colon_pos + 2..].to_string(),
        })
    } else {
        Some(LogEntry {
            timestamp,
            pid,
            tid,
            level,
            tag: String::new(),
            message: rest.to_string(),
        })
    }
}

#[tauri::command]
pub async fn start_logcat(app: AppHandle, serial: String) -> Result<(), String> {
    super::adb::validate_serial(&serial)?;

    let state = app
        .try_state::<LogcatState>()
        .ok_or("Logcat state not available")?;

    // Stop existing if running
    state.stop_flag.store(true, Ordering::Relaxed);
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Reset flags
    state.stop_flag.store(false, Ordering::Relaxed);
    state.is_running.store(true, Ordering::Relaxed);
    *state.serial.lock().unwrap_or_else(|e| e.into_inner()) = serial.clone();

    let mut child = hidden_command("adb")
        .args(["-s", &serial, "logcat", "-v", "threadtime"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start logcat: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture logcat stdout")?;
    let stop_flag = state.stop_flag.clone();
    let is_running = state.is_running.clone();
    let app_clone = app.clone();

    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines() {
            if stop_flag.load(Ordering::Relaxed) {
                break;
            }
            let Ok(line) = line else { break };
            if let Some(entry) = parse_logcat_line(&line) {
                let _ = app_clone.emit("logcat-line", entry);
            }
        }
        let _ = child.kill();
        let _ = child.wait();
        is_running.store(false, Ordering::Relaxed);
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_logcat(app: AppHandle) -> Result<(), String> {
    let state = app
        .try_state::<LogcatState>()
        .ok_or("Logcat state not available")?;
    state.stop_flag.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn clear_logcat(serial: String) -> Result<(), String> {
    super::adb::validate_serial(&serial)?;
    hidden_command("adb")
        .args(["-s", &serial, "logcat", "-c"])
        .output()
        .map_err(|e| format!("Failed to clear logcat: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_info() {
        let entry = parse_logcat_line("03-26 01:23:45.678  1234  5678 I MyTag   : Hello world").unwrap();
        assert_eq!(entry.timestamp, "03-26 01:23:45.678");
        assert_eq!(entry.pid, "1234");
        assert_eq!(entry.level, "I");
        assert_eq!(entry.tag, "MyTag");
        assert_eq!(entry.message, "Hello world");
    }

    #[test]
    fn test_parse_error_level() {
        let entry = parse_logcat_line("03-26 01:23:45.678  1234  5678 E Crash: NPE").unwrap();
        assert_eq!(entry.level, "E");
        assert_eq!(entry.tag, "Crash");
    }

    #[test]
    fn test_parse_empty() { assert!(parse_logcat_line("").is_none()); }

    #[test]
    fn test_parse_separator() { assert!(parse_logcat_line("--------- beginning of main").is_none()); }

    #[test]
    fn test_parse_short() { assert!(parse_logcat_line("too short").is_none()); }
}
