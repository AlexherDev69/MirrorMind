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
// Require this many consecutive empty polls before declaring a device lost.
// A single empty poll is often a transient adb hiccup (e.g. adbd restarting),
// not a real unplug — debouncing avoids false "reconnect the cable" prompts.
const DEVICE_LOST_THRESHOLD = 2;

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

  // Counts consecutive polls with no connected device (for debounced loss).
  const emptyPollsRef = useRef(0);

  useEffect(() => {
    if (!adbAvailable) return;

    const pollDevices = async () => {
      try {
        const devices = await invoke<AdbDevice[]>("list_devices");
        const authorizedDevice = devices.find((d) => d.state === "device");
        const unauthorizedDevice = devices.find((d) => d.state === "unauthorized");
        const currentState = appStateRef.current;

        if (authorizedDevice) {
          emptyPollsRef.current = 0;
          if (currentState === "no-device") {
            const onboarded = await isDeviceOnboarded(authorizedDevice.serial);
            callbacksRef.current.onAuthorizedDevice(authorizedDevice, onboarded);
          } else if (currentState === "disconnected") {
            callbacksRef.current.onReconnect(authorizedDevice);
          } else if (currentState === "onboarding") {
            callbacksRef.current.onAuthorizedDevice(authorizedDevice, false);
          }
        } else if (unauthorizedDevice) {
          emptyPollsRef.current = 0;
          if (currentState === "no-device" || currentState === "onboarding") {
            callbacksRef.current.onUnauthorizedDevice(unauthorizedDevice);
          }
        } else {
          const currentState2 = appStateRef.current;
          const relevant =
            currentState2 === "streaming" ||
            currentState2 === "connecting" ||
            currentState2 === "error";
          if (relevant) {
            emptyPollsRef.current += 1;
            // Only declare loss after several consecutive empty polls to ride
            // out transient adb hiccups (adbd restart, USB re-enumeration).
            if (emptyPollsRef.current >= DEVICE_LOST_THRESHOLD) {
              emptyPollsRef.current = 0;
              callbacksRef.current.onDeviceLost();
            }
          } else {
            emptyPollsRef.current = 0;
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
