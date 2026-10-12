import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  connectWifiDevice,
  disconnectWifiDevice,
  returnToUsb as returnToUsbApi,
} from "../../features/wifi-mode/data/wifi-api";
import { isWifiSerial } from "../../features/wifi-mode/presentation/wifi-serial";
import { useWifiStore } from "../../features/wifi-mode/presentation/stores/wifi.store";
import { showToast } from "../components/Toast";
import type { AdbDevice } from "./useDevicePolling";

const ADB_WIFI_PORT = 5555;

/** Try the mDNS hostname first, then the last known IP. */
async function reconnectKnownDevice(hostname: string | null | undefined, lastIp: string): Promise<boolean> {
  const candidates = hostname ? [`${hostname}.local`, lastIp] : [lastIp];
  for (const host of candidates) {
    try {
      await connectWifiDevice(`${host}:${ADB_WIFI_PORT}`);
      return true;
    } catch {
      // unreachable on this address, try the next one
    }
  }
  return false;
}

interface WifiSession {
  readonly handleReturnToUsb: () => Promise<void>;
}

/**
 * WiFi side of a device session: keeps the store mode in sync with the active
 * serial, reconnects known WiFi devices once adb is available, and exposes
 * the "return to USB" action.
 */
export function useWifiSession(device: AdbDevice | null, adbAvailable: boolean | null): WifiSession {
  const setWifiMode = useWifiStore((s) => s.setMode);
  const loadKnownWifi = useWifiStore((s) => s.loadKnown);
  const knownWifiDevices = useWifiStore((s) => s.knownDevices);
  const isWifi = isWifiSerial(device?.serial ?? "");

  useEffect(() => {
    setWifiMode(isWifi ? "wifi" : "usb");
  }, [isWifi, setWifiMode]);

  useEffect(() => {
    loadKnownWifi();
  }, [loadKnownWifi]);

  useEffect(() => {
    if (adbAvailable !== true) return;
    let cancelled = false;
    (async () => {
      let anyConnected = false;
      for (const known of knownWifiDevices) {
        if (cancelled || !known.lastIp) continue;
        if (await reconnectKnownDevice(known.hostname, known.lastIp)) {
          anyConnected = true;
        }
      }
      if (!cancelled && !anyConnected && knownWifiDevices.length > 0) {
        showToast("Could not reconnect over WiFi. Plug the USB cable.", "info");
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only run once per adb-availability flip; knownWifiDevices snapshot is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adbAvailable]);

  const handleReturnToUsb = useCallback(async () => {
    if (!device) return;
    const wifiAddress = device.serial;
    // The USB serial is unknown once we are on a WiFi serial: look it up.
    try {
      const devices = await invoke<AdbDevice[]>("list_devices");
      const usbDevice = devices.find((d) => d.state === "device" && !isWifiSerial(d.serial));
      if (usbDevice) {
        await returnToUsbApi(usbDevice.serial);
      }
      if (isWifiSerial(wifiAddress)) {
        await disconnectWifiDevice(wifiAddress).catch(() => {});
      }
      showToast("Returned to USB mode. Plug the cable if needed.", "success");
    } catch (err) {
      showToast(`Return-to-USB failed: ${String(err)}`, "error");
    }
  }, [device]);

  return { handleReturnToUsb };
}
