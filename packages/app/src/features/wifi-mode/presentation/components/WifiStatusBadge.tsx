import { useWifiStore } from "../stores/wifi.store";

/**
 * Compact badge showing whether the active device is connected via USB or WiFi.
 */
export function WifiStatusBadge() {
  const mode = useWifiStore((s) => s.currentMode);
  const isWifi = mode === "wifi";

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
        isWifi
          ? "bg-emerald-900/60 text-emerald-300"
          : "bg-zinc-800 text-zinc-400"
      }`}
      title={isWifi ? "Connected over WiFi" : "Connected over USB"}
      aria-label={isWifi ? "WiFi mode" : "USB mode"}
    >
      <span aria-hidden>{isWifi ? "◈" : "⎘"}</span>
      {isWifi ? "WiFi" : "USB"}
    </span>
  );
}
