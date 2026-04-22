import { invoke } from "@tauri-apps/api/core";
import type { MdnsDevice, WifiDevice, WifiDeviceInfo } from "../domain/wifi.types";

export function enableTcpipAuto(serial: string): Promise<WifiDeviceInfo> {
  return invoke<WifiDeviceInfo>("enable_tcpip_auto", { serial });
}

export function connectWifiDevice(address: string): Promise<string> {
  return invoke<string>("connect_wifi_device", { address });
}

export function disconnectWifiDevice(address: string): Promise<void> {
  return invoke<void>("disconnect_wifi_device", { address });
}

export function returnToUsb(serial: string): Promise<void> {
  return invoke<void>("return_to_usb", { serial });
}

export function wifiPair(address: string, pairingCode: string): Promise<void> {
  return invoke<void>("wifi_pair", { address, pairingCode });
}

export function discoverMdnsDevices(): Promise<MdnsDevice[]> {
  return invoke<MdnsDevice[]>("discover_mdns_devices");
}

export function listKnownWifiDevices(): Promise<WifiDevice[]> {
  return invoke<WifiDevice[]>("list_known_wifi_devices");
}

export interface SaveWifiDeviceArgs {
  readonly serialUsb: string;
  readonly lastIp?: string | null;
  readonly hostname?: string | null;
  readonly label?: string | null;
}

export function saveWifiDevice(args: SaveWifiDeviceArgs): Promise<void> {
  return invoke<void>("save_wifi_device", {
    serialUsb: args.serialUsb,
    lastIp: args.lastIp ?? null,
    hostname: args.hostname ?? null,
    label: args.label ?? null,
  });
}

export function removeWifiDevice(serialUsb: string): Promise<void> {
  return invoke<void>("remove_wifi_device", { serialUsb });
}
