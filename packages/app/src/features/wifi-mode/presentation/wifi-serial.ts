/** An ADB serial is a WiFi address when it contains a colon followed by digits (host:port). */
export function isWifiSerial(serial: string): boolean {
  return /:\d+$/.test(serial);
}
