/** Runtime info returned after enabling tcpip on a USB-connected device. */
export interface WifiDeviceInfo {
  readonly serialUsb: string;
  readonly ip: string | null;
  readonly hostname: string | null;
  readonly port: number;
}

/** Persisted record for a device known to be reachable over WiFi. */
export interface WifiDevice {
  readonly serialUsb: string;
  readonly lastIp: string | null;
  readonly hostname: string | null;
  readonly label: string | null;
  readonly addedAt: number;
  readonly lastSeen: number;
}

export interface MdnsDevice {
  readonly name: string;
  readonly serviceType: string;
  readonly address: string;
}

export type ConnectionMode = "usb" | "wifi";

export type PairingState = "idle" | "pairing" | "connecting" | "success" | "error";
