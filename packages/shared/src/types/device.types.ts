export type DeviceConnectionState =
  | "disconnected"
  | "connecting"
  | "unauthorized"
  | "connected";

export type PhoneBrand =
  | "samsung"
  | "xiaomi"
  | "google"
  | "oneplus"
  | "huawei"
  | "oppo"
  | "realme"
  | "generic";

export interface DeviceInfo {
  readonly serial: string;
  readonly model: string;
  readonly brand: PhoneBrand;
  readonly androidVersion: string;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly connectionState: DeviceConnectionState;
}
