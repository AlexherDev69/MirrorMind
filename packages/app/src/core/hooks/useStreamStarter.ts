import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enableTcpipAuto } from "../../features/wifi-mode/data/wifi-api";
import { isWifiSerial } from "../../features/wifi-mode/presentation/wifi-serial";
import { useWifiStore } from "../../features/wifi-mode/presentation/stores/wifi.store";
import { formatStreamError } from "../stream-error";
import type { AdbDevice, AppState } from "./useDevicePolling";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [0, 2000, 4000];
const DEFAULT_RETRY_DELAY_MS = 4000;
// adbd needs a moment to come back after `adb tcpip` restarts it.
const TCPIP_SETTLE_MS = 1500;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface UseStreamStarterParams {
  readonly setAppState: (state: AppState) => void;
  readonly setErrorMessage: (message: string | null) => void;
}

/**
 * Enable WiFi tcpip before the stream opens, once per USB serial per session.
 * `adb tcpip` restarts adbd, which would drop a running stream: doing it
 * first means there is no stream yet to break.
 */
async function enableTcpipOnce(serial: string): Promise<void> {
  if (isWifiSerial(serial)) return;
  const wifi = useWifiStore.getState();
  if (wifi.tcpipEnabledSerials.has(serial)) return;

  try {
    const info = await enableTcpipAuto(serial);
    wifi.markTcpipEnabled(serial, info);
    await wifi.rememberDevice(info);
    await wait(TCPIP_SETTLE_MS);
  } catch {
    // tcpip is best-effort; the stream can still run over USB.
  }
}

/** Returns a function that starts the scrcpy stream for a device, with retries. */
export function useStreamStarter({
  setAppState,
  setErrorMessage,
}: UseStreamStarterParams): (device: AdbDevice) => Promise<void> {
  return useCallback(
    async (device: AdbDevice) => {
      setAppState("connecting");
      setErrorMessage(null);

      await enableTcpipOnce(device.serial);

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          setErrorMessage(`Connection failed. Retrying... (${attempt + 1}/${MAX_RETRIES})`);
          await wait(RETRY_DELAYS_MS[attempt] ?? DEFAULT_RETRY_DELAY_MS);
        }

        try {
          await invoke("push_scrcpy_server", { serial: device.serial });
          await invoke("start_stream", { serial: device.serial });
          return;
        } catch (err) {
          if (attempt === MAX_RETRIES - 1) {
            setAppState("error");
            setErrorMessage(formatStreamError(String(err)));
          }
        }
      }
    },
    [setAppState, setErrorMessage],
  );
}
