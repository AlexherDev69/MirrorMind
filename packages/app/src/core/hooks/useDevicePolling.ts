import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isDeviceOnboarded } from "../../features/onboarding/data/onboarding-persistence";

export interface AdbDevice {
  readonly serial: string;
  readonly state: string;
  readonly model: string;
}

export type AppState = "no-device" | "onboarding" | "connecting" | "streaming" | "disconnected" | "error";

const DEVICE_POLL_INTERVAL_MS = 2000;

interface UseDevicePollingParams {
  readonly adbAvailable: boolean | null;
  readonly appStateRef: React.RefObject<AppState>;
  readonly onAuthorizedDevice: (device: AdbDevice, isOnboarded: boolean) => void;
  readonly onUnauthorizedDevice: (device: AdbDevice) => void;
  readonly onDeviceLost: () => void;
  readonly onReconnect: (device: AdbDevice) => void;
}

/**
 * Polls for connected ADB devices every 2 seconds and triggers callbacks
 * based on device state changes.
 */
export function useDevicePolling({
  adbAvailable,
  appStateRef,
  onAuthorizedDevice,
  onUnauthorizedDevice,
  onDeviceLost,
  onReconnect,
}: UseDevicePollingParams): void {
  // Stabilize callbacks with refs to avoid re-triggering the effect
  const callbacksRef = useRef({
    onAuthorizedDevice,
    onUnauthorizedDevice,
    onDeviceLost,
    onReconnect,
  });
  callbacksRef.current = {
    onAuthorizedDevice,
    onUnauthorizedDevice,
    onDeviceLost,
    onReconnect,
  };

  useEffect(() => {
    if (!adbAvailable) return;

    const pollDevices = async () => {
      try {
        const devices = await invoke<AdbDevice[]>("list_devices");
        const authorizedDevice = devices.find((d) => d.state === "device");
        const unauthorizedDevice = devices.find((d) => d.state === "unauthorized");
        const currentState = appStateRef.current;

        if (authorizedDevice) {
          if (currentState === "no-device") {
            const onboarded = await isDeviceOnboarded(authorizedDevice.serial);
            callbacksRef.current.onAuthorizedDevice(authorizedDevice, onboarded);
          } else if (currentState === "disconnected") {
            callbacksRef.current.onReconnect(authorizedDevice);
          } else if (currentState === "onboarding") {
            callbacksRef.current.onAuthorizedDevice(authorizedDevice, false);
          }
        } else if (unauthorizedDevice) {
          if (currentState === "no-device" || currentState === "onboarding") {
            callbacksRef.current.onUnauthorizedDevice(unauthorizedDevice);
          }
        } else {
          const currentState2 = appStateRef.current;
          if (currentState2 === "streaming" || currentState2 === "connecting") {
            callbacksRef.current.onDeviceLost();
          } else if (currentState2 === "error") {
            callbacksRef.current.onDeviceLost();
          }
        }
      } catch {
        // Silently retry
      }
    };

    pollDevices();
    const interval = setInterval(pollDevices, DEVICE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [adbAvailable, appStateRef]);
}
