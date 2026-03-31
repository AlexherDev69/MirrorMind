import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../domain/settings.types";

export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function setAlwaysOnTop(enabled: boolean): Promise<void> {
  return invoke("set_always_on_top", { enabled });
}

export async function resetOnboarding(): Promise<void> {
  return invoke("reset_onboarding");
}
