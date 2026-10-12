const MAX_RAW_ERROR_LENGTH = 120;

/** Convert technical error messages into user-friendly descriptions. */
export function formatStreamError(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("port forwarding failed"))
    return "Could not connect to the device. Try unplugging and re-plugging the USB cable.";
  if (lower.includes("failed to push scrcpy"))
    return "Could not install the screen mirror component on the phone. Check USB debugging is enabled.";
  if (lower.includes("failed to connect to scrcpy"))
    return "Connection to the phone timed out. Make sure the phone screen is unlocked and try again.";
  if (lower.includes("failed to read device name") || lower.includes("failed to fill whole buffer"))
    return "The phone did not respond in time. Unlock the screen and try again.";
  if (lower.includes("failed to read codec"))
    return "Could not start the video stream. Try reconnecting the phone.";
  if (lower.includes("adb not found"))
    return "ADB is not installed. Install Android SDK Platform Tools and restart the app.";
  if (lower.includes("device not authorized") || lower.includes("unauthorized"))
    return "The phone has not authorized this computer. Check for a permission popup on your phone.";

  return raw.length > MAX_RAW_ERROR_LENGTH ? `${raw.slice(0, MAX_RAW_ERROR_LENGTH)}...` : raw;
}
