import { invoke } from "@tauri-apps/api/core";
import type { PhoneBrand } from "@phone-stream/shared";

const BRAND_MAP: Record<string, PhoneBrand> = {
  samsung: "samsung",
  xiaomi: "xiaomi",
  redmi: "xiaomi",
  poco: "xiaomi",
  google: "google",
  oneplus: "oneplus",
  huawei: "huawei",
  honor: "huawei",
  oppo: "oppo",
  realme: "realme",
};

export async function isDeviceOnboarded(serial: string): Promise<boolean> {
  try {
    const devices = await invoke<string[]>("get_onboarded_devices");
    return devices.includes(serial);
  } catch {
    return false;
  }
}

export async function markDeviceAsOnboarded(serial: string): Promise<void> {
  await invoke("mark_device_onboarded", { serial });
}

export async function fetchDeviceBrand(serial: string): Promise<PhoneBrand> {
  try {
    const raw = await invoke<string>("get_device_brand", { serial });
    return BRAND_MAP[raw] ?? "generic";
  } catch {
    return "generic";
  }
}
