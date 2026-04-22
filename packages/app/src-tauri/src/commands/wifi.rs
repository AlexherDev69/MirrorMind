use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::process::Command as TokioCommand;
use tokio::time::timeout;

use super::adb::validate_serial;

const WIFI_DEVICES_FILE: &str = "wifi_devices.json";
const ADB_TIMEOUT: Duration = Duration::from_secs(5);
const ADB_TIMEOUT_SHORT: Duration = Duration::from_secs(3);
const DEFAULT_TCPIP_PORT: u16 = 5555;

/// Runtime info returned after enabling tcpip on a USB-connected device.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WifiDeviceInfo {
    pub serial_usb: String,
    pub ip: Option<String>,
    pub hostname: Option<String>,
    pub port: u16,
}

/// Persisted record for a device known to be reachable over WiFi.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WifiDevice {
    pub serial_usb: String,
    pub last_ip: Option<String>,
    pub hostname: Option<String>,
    pub label: Option<String>,
    pub added_at: i64,
    pub last_seen: i64,
}

/// mDNS service entry discovered via `adb mdns services`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MdnsDevice {
    pub name: String,
    pub service_type: String,
    pub address: String,
}

/// Validate an IPv4 address or a mDNS `.local` hostname.
fn validate_host(host: &str) -> Result<(), String> {
    if host.is_empty() || host.len() > 253 {
        return Err("Invalid host".to_string());
    }
    let is_ipv4 = {
        let parts: Vec<&str> = host.split('.').collect();
        parts.len() == 4
            && parts
                .iter()
                .all(|p| !p.is_empty() && p.len() <= 3 && p.chars().all(|c| c.is_ascii_digit()))
            && parts
                .iter()
                .all(|p| p.parse::<u8>().is_ok())
    };
    let is_mdns = host.ends_with(".local")
        && host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.');
    if is_ipv4 || is_mdns {
        Ok(())
    } else {
        Err(format!("Invalid host: {}", host))
    }
}

/// Validate a "host:port" pair.
fn validate_address(address: &str) -> Result<(), String> {
    let (host, port) = address
        .rsplit_once(':')
        .ok_or_else(|| "Address must be host:port".to_string())?;
    validate_host(host)?;
    port.parse::<u16>()
        .map_err(|_| "Invalid port".to_string())?;
    Ok(())
}

/// Run an adb command with a timeout. Returns (stdout, stderr) on success.
async fn run_adb(args: &[&str], dur: Duration) -> Result<(String, String), String> {
    let mut cmd = TokioCommand::new("adb");
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let future = cmd.output();
    let output = timeout(dur, future)
        .await
        .map_err(|_| format!("adb {:?} timed out", args))?
        .map_err(|e| format!("adb spawn failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() {
        return Err(format!(
            "adb {:?} failed: {}",
            args,
            if stderr.is_empty() { &stdout } else { &stderr }
        ));
    }
    Ok((stdout, stderr))
}

fn wifi_devices_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot get app data dir: {}", e))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create app data dir: {}", e))?;
    Ok(dir.join(WIFI_DEVICES_FILE))
}

fn read_wifi_devices(app: &AppHandle) -> Vec<WifiDevice> {
    let path = match wifi_devices_path(app) {
        Ok(p) => p,
        Err(_) => return vec![],
    };
    if !path.exists() {
        return vec![];
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn write_wifi_devices(app: &AppHandle, devices: &[WifiDevice]) -> Result<(), String> {
    let path = wifi_devices_path(app)?;
    let content = serde_json::to_string_pretty(devices)
        .map_err(|e| format!("Serialize failed: {}", e))?;
    std::fs::write(&path, &content).map_err(|e| format!("Write failed: {}", e))
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Parse `ip -f inet addr show wlan0` output to extract the IPv4 address.
fn parse_ip_from_addr(stdout: &str) -> Option<String> {
    for line in stdout.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("inet ") {
            if let Some(cidr) = rest.split_whitespace().next() {
                if let Some((ip, _)) = cidr.split_once('/') {
                    if !ip.starts_with("127.") {
                        return Some(ip.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Enable `tcpip 5555` on a USB-connected device and capture its IP/hostname.
/// Idempotent: returns Ok even if tcpip was already enabled.
#[tauri::command]
pub async fn enable_tcpip_auto(serial: String) -> Result<WifiDeviceInfo, String> {
    validate_serial(&serial)?;

    // Enable tcpip (idempotent on adb side)
    let _ = run_adb(
        &["-s", &serial, "tcpip", &DEFAULT_TCPIP_PORT.to_string()],
        ADB_TIMEOUT,
    )
    .await;

    // Read wlan0 IPv4
    let ip = match run_adb(
        &["-s", &serial, "shell", "ip", "-f", "inet", "addr", "show", "wlan0"],
        ADB_TIMEOUT_SHORT,
    )
    .await
    {
        Ok((stdout, _)) => parse_ip_from_addr(&stdout),
        Err(_) => None,
    };

    // Read hostname (for mDNS .local lookup)
    let hostname = match run_adb(
        &["-s", &serial, "shell", "getprop", "net.hostname"],
        ADB_TIMEOUT_SHORT,
    )
    .await
    {
        Ok((stdout, _)) => {
            let h = stdout.trim().to_string();
            if h.is_empty() {
                None
            } else {
                Some(h)
            }
        }
        Err(_) => None,
    };

    Ok(WifiDeviceInfo {
        serial_usb: serial,
        ip,
        hostname,
        port: DEFAULT_TCPIP_PORT,
    })
}

/// Connect to a device over WiFi. `address` must be `host:port`.
#[tauri::command]
pub async fn connect_wifi_device(address: String) -> Result<String, String> {
    validate_address(&address)?;
    let (stdout, stderr) = run_adb(&["connect", &address], ADB_TIMEOUT).await?;
    let combined = format!("{}{}", stdout, stderr).to_lowercase();
    if combined.contains("connected to") || combined.contains("already connected") {
        Ok(address)
    } else {
        Err(format!("adb connect failed: {}", stdout.trim()))
    }
}

/// Disconnect a previously connected WiFi device.
#[tauri::command]
pub async fn disconnect_wifi_device(address: String) -> Result<(), String> {
    validate_address(&address)?;
    run_adb(&["disconnect", &address], ADB_TIMEOUT).await?;
    Ok(())
}

/// Force a device back into USB-only mode (closes port 5555).
#[tauri::command]
pub async fn return_to_usb(serial: String) -> Result<(), String> {
    validate_serial(&serial)?;
    run_adb(&["-s", &serial, "usb"], ADB_TIMEOUT).await?;
    Ok(())
}

/// Pair with an Android 11+ device using wireless-debugging pairing code.
#[tauri::command]
pub async fn wifi_pair(address: String, pairing_code: String) -> Result<(), String> {
    validate_address(&address)?;
    if pairing_code.len() < 4
        || pairing_code.len() > 12
        || !pairing_code.chars().all(|c| c.is_ascii_digit())
    {
        return Err("Invalid pairing code".to_string());
    }
    let (stdout, stderr) = run_adb(&["pair", &address, &pairing_code], ADB_TIMEOUT).await?;
    let combined = format!("{}{}", stdout, stderr).to_lowercase();
    if combined.contains("successfully paired") || combined.contains("already paired") {
        Ok(())
    } else {
        Err(format!("adb pair failed: {}", stdout.trim()))
    }
}

/// Discover devices broadcasting via mDNS (`adb mdns services`).
#[tauri::command]
pub async fn discover_mdns_devices() -> Result<Vec<MdnsDevice>, String> {
    let (stdout, _) = run_adb(&["mdns", "services"], ADB_TIMEOUT).await?;
    let mut results: Vec<MdnsDevice> = Vec::new();
    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            results.push(MdnsDevice {
                name: parts[0].to_string(),
                service_type: parts[1].to_string(),
                address: parts[2].to_string(),
            });
        }
    }
    Ok(results)
}

#[tauri::command]
pub async fn list_known_wifi_devices(app: AppHandle) -> Result<Vec<WifiDevice>, String> {
    Ok(read_wifi_devices(&app))
}

#[tauri::command]
pub async fn save_wifi_device(
    app: AppHandle,
    serial_usb: String,
    last_ip: Option<String>,
    hostname: Option<String>,
    label: Option<String>,
) -> Result<(), String> {
    validate_serial(&serial_usb)?;
    if let Some(ip) = &last_ip {
        validate_host(ip)?;
    }
    let mut devices = read_wifi_devices(&app);
    let now = now_unix();

    if let Some(existing) = devices.iter_mut().find(|d| d.serial_usb == serial_usb) {
        existing.last_ip = last_ip.or_else(|| existing.last_ip.clone());
        existing.hostname = hostname.or_else(|| existing.hostname.clone());
        existing.label = label.or_else(|| existing.label.clone());
        existing.last_seen = now;
    } else {
        devices.push(WifiDevice {
            serial_usb,
            last_ip,
            hostname,
            label,
            added_at: now,
            last_seen: now,
        });
    }

    write_wifi_devices(&app, &devices)
}

#[tauri::command]
pub async fn remove_wifi_device(app: AppHandle, serial_usb: String) -> Result<(), String> {
    validate_serial(&serial_usb)?;
    let mut devices = read_wifi_devices(&app);
    devices.retain(|d| d.serial_usb != serial_usb);
    write_wifi_devices(&app, &devices)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_host_ipv4() {
        assert!(validate_host("192.168.1.10").is_ok());
        assert!(validate_host("10.0.0.1").is_ok());
        assert!(validate_host("300.1.1.1").is_err());
        assert!(validate_host("1.2.3").is_err());
    }

    #[test]
    fn test_validate_host_mdns() {
        assert!(validate_host("pixel-6.local").is_ok());
        assert!(validate_host("my-phone.local").is_ok());
        assert!(validate_host("bad;host.local").is_err());
    }

    #[test]
    fn test_validate_address() {
        assert!(validate_address("192.168.1.10:5555").is_ok());
        assert!(validate_address("pixel-6.local:5555").is_ok());
        assert!(validate_address("192.168.1.10").is_err());
        assert!(validate_address("192.168.1.10:abc").is_err());
    }

    #[test]
    fn test_parse_ip_from_addr() {
        let sample = "2: wlan0: <BROADCAST>\n    inet 192.168.1.42/24 brd 192.168.1.255 scope global wlan0\n       valid_lft forever";
        assert_eq!(parse_ip_from_addr(sample), Some("192.168.1.42".to_string()));
    }

    #[test]
    fn test_parse_ip_skips_loopback() {
        let sample = "    inet 127.0.0.1/8 scope host lo";
        assert_eq!(parse_ip_from_addr(sample), None);
    }
}
