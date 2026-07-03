import { useEffect } from "react";
import { createLogger } from "../../../core/logger";
import { enableTcpipAuto } from "../data/wifi-api";
import { useWifiStore } from "./stores/wifi.store";

const logger = createLogger("auto-tcpip");

/**
 * Silently enable tcpip on a newly detected USB device (once per serial per session).
 * Persists the detected IP/hostname so it can be auto-reconnected at startup.
 */
export function useAutoTcpip(serial: string | null, isWifiSerial: boolean): void {
  useEffect(() => {
    if (!serial || isWifiSerial) return;

    const already = useWifiStore.getState().tcpipEnabledSerials.has(serial);
    if (already) return;

    let cancelled = false;

    (async () => {
      try {
        const info = await enableTcpipAuto(serial);
        if (cancelled) return;
        useWifiStore.getState().markTcpipEnabled(serial, info);
        await useWifiStore.getState().rememberDevice(info);
        logger.info(`tcpip enabled for ${serial} (ip=${info.ip ?? "?"})`);
      } catch (err) {
        logger.debug("tcpip auto-enable failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serial, isWifiSerial]);
}

/** An ADB serial is a WiFi address when it contains a colon followed by digits (host:port). */
export function isWifiSerial(serial: string): boolean {
  return /:\d+$/.test(serial);
}
