import { useState } from "react";
import { Modal } from "../../../../core/components/Modal";
import { Button } from "../../../../core/components/Button";
import { createLogger } from "../../../../core/logger";
import { connectWifiDevice, enableTcpipAuto } from "../../data/wifi-api";
import { useWifiStore } from "../stores/wifi.store";
import type { WifiDeviceInfo } from "../../domain/wifi.types";

const logger = createLogger("wifi-connect");

interface WifiConnectModalProps {
  readonly usbSerial: string;
  readonly onClose: () => void;
  readonly onConnected: (wifiAddress: string, info: WifiDeviceInfo) => void;
}

/**
 * Modal that confirms switching the current USB device to WiFi mode.
 * Shows the detected IP + mDNS hostname and a LAN exposure warning.
 */
export function WifiConnectModal({ usbSerial, onClose, onConnected }: WifiConnectModalProps) {
  const [info, setInfo] = useState<WifiDeviceInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "probing" | "connecting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rememberDevice = useWifiStore((s) => s.rememberDevice);

  const probe = async () => {
    setStatus("probing");
    setErrorMessage(null);
    try {
      const result = await enableTcpipAuto(usbSerial);
      setInfo(result);
      setStatus("idle");
    } catch (err) {
      logger.warn("probe failed", err);
      setErrorMessage(String(err));
      setStatus("error");
    }
  };

  const handleConnect = async () => {
    if (!info?.ip) return;
    setStatus("connecting");
    setErrorMessage(null);
    const host = info.hostname ? `${info.hostname}.local` : info.ip;
    const address = `${host}:${info.port}`;
    try {
      const serial = await connectWifiDevice(address);
      await rememberDevice(info);
      onConnected(serial, info);
    } catch (err) {
      // Fall back to raw IP if mDNS failed
      if (host !== info.ip) {
        try {
          const fallback = `${info.ip}:${info.port}`;
          const serial = await connectWifiDevice(fallback);
          await rememberDevice(info);
          onConnected(serial, info);
          return;
        } catch (err2) {
          logger.warn("fallback connect failed", err2);
          setErrorMessage(String(err2));
        }
      } else {
        setErrorMessage(String(err));
      }
      setStatus("error");
    }
  };

  return (
    <Modal title="Switch to WiFi mode" onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm text-zinc-300">
        {!info && status !== "probing" && (
          <>
            <p>Probe the phone to detect its IP address and hostname.</p>
            <Button variant="primary" onClick={probe}>Detect address</Button>
          </>
        )}

        {status === "probing" && <p className="text-zinc-400">Probing device...</p>}

        {info && (
          <div className="rounded border border-zinc-700 bg-zinc-900/60 p-3 text-xs space-y-1">
            <div><span className="text-zinc-500">IP:</span> {info.ip ?? "not detected"}</div>
            <div><span className="text-zinc-500">Hostname:</span> {info.hostname ?? "—"}</div>
            <div><span className="text-zinc-500">Port:</span> {info.port}</div>
          </div>
        )}

        <p className="text-[11px] text-amber-300/90">
          ⚠ Your phone will be reachable on the local network (port {info?.port ?? 5555}).
          Use &quot;Return to USB&quot; when you are done.
        </p>

        {errorMessage && (
          <p className="text-xs text-red-400 break-words">{errorMessage}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleConnect}
            disabled={!info?.ip || status === "connecting"}
          >
            {status === "connecting" ? "Connecting..." : "Connect over WiFi"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
