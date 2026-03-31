import { invoke } from "@tauri-apps/api/core";

export async function startLogcat(serial: string): Promise<void> {
  return invoke("start_logcat", { serial });
}

export async function stopLogcat(): Promise<void> {
  return invoke("stop_logcat");
}

export async function clearLogcat(serial: string): Promise<void> {
  return invoke("clear_logcat", { serial });
}
