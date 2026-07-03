import { create } from "zustand";
import type { ConnectionMode, WifiDevice, WifiDeviceInfo } from "../../domain/wifi.types";
import {
  listKnownWifiDevices,
  saveWifiDevice,
  removeWifiDevice as removeWifiDeviceApi,
} from "../../data/wifi-api";

interface WifiStore {
  readonly knownDevices: ReadonlyArray<WifiDevice>;
  readonly currentMode: ConnectionMode;
  readonly lastTcpipInfo: WifiDeviceInfo | null;
  /** Serials for which tcpip was already enabled this session (avoid spam). */
  readonly tcpipEnabledSerials: ReadonlySet<string>;

  loadKnown: () => Promise<void>;
  rememberDevice: (info: WifiDeviceInfo) => Promise<void>;
  forgetDevice: (serialUsb: string) => Promise<void>;
  markTcpipEnabled: (serial: string, info: WifiDeviceInfo) => void;
  setMode: (mode: ConnectionMode) => void;
}

export const useWifiStore = create<WifiStore>((set, get) => ({
  knownDevices: [],
  currentMode: "usb",
  lastTcpipInfo: null,
  tcpipEnabledSerials: new Set<string>(),

  loadKnown: async () => {
    try {
      const devices = await listKnownWifiDevices();
      set({ knownDevices: devices });
    } catch {
      /* ignore */
    }
  },

  rememberDevice: async (info) => {
    try {
      await saveWifiDevice({
        serialUsb: info.serialUsb,
        lastIp: info.ip,
        hostname: info.hostname,
      });
      await get().loadKnown();
    } catch {
      /* ignore */
    }
  },

  forgetDevice: async (serialUsb) => {
    try {
      await removeWifiDeviceApi(serialUsb);
      await get().loadKnown();
    } catch {
      /* ignore */
    }
  },

  markTcpipEnabled: (serial, info) => {
    const next = new Set(get().tcpipEnabledSerials);
    next.add(serial);
    set({ tcpipEnabledSerials: next, lastTcpipInfo: info });
  },

  setMode: (mode) => set({ currentMode: mode }),
}));
