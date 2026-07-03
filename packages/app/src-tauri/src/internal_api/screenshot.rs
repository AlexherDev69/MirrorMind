use crate::commands::process_utils::hidden_command;

/// Capture a PNG screenshot from the phone via ADB.
/// Returns raw PNG bytes.
pub fn capture_screenshot(serial: &str) -> Result<Vec<u8>, String> {
    let output = hidden_command("adb")
        .args(["-s", serial, "exec-out", "screencap", "-p"])
        .output()
        .map_err(|e| format!("Failed to execute adb screencap: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "adb screencap failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    if output.stdout.len() < 24 {
        return Err("Screenshot data too small".to_string());
    }

    Ok(output.stdout)
}

/// Extract width and height from PNG header bytes.
/// PNG IHDR chunk: bytes 16-19 = width (BE u32), bytes 20-23 = height (BE u32).
pub fn parse_png_dimensions(png_data: &[u8]) -> Result<(u32, u32), String> {
    if png_data.len() < 24 {
        return Err("PNG data too short for header".to_string());
    }

    let width = u32::from_be_bytes(
        png_data[16..20]
            .try_into()
            .map_err(|_| "Invalid PNG width bytes")?,
    );
    let height = u32::from_be_bytes(
        png_data[20..24]
            .try_into()
            .map_err(|_| "Invalid PNG height bytes")?,
    );

    Ok((width, height))
}
