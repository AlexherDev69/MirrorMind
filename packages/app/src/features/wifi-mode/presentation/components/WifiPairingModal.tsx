import { useState } from "react";
import { Modal } from "../../../../core/components/Modal";
import { Button } from "../../../../core/components/Button";
import { createLogger } from "../../../../core/logger";
import { connectWifiDevice, wifiPair } from "../../data/wifi-api";

const logger = createLogger("wifi-pair");

interface WifiPairingModalProps {
  readonly onClose: () => void;
  readonly onPaired: (serial: string) => void;
}

/**
 * Modal for Android 11+ Wireless Debugging pairing flow.
 * Requires user to enter pairing IP:port and the 6-digit code shown on the phone.
 */
export function WifiPairingModal({ onClose, onPaired }: WifiPairingModalProps) {
  const [pairAddress, setPairAddress] = useState("");
  const [connectAddress, setConnectAddress] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [status, setStatus] = useState<"idle" | "pairing" | "connecting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit =
    pairAddress.trim().length > 0 &&
    connectAddress.trim().length > 0 &&
    pairingCode.trim().length >= 4 &&
    status === "idle";

  const handleSubmit = async () => {
    setErrorMessage(null);
    setStatus("pairing");
    try {
      await wifiPair(pairAddress.trim(), pairingCode.trim());
    } catch (err) {
      logger.warn("pair failed", err);
      setErrorMessage(String(err));
      setStatus("error");
      return;
    }

    setStatus("connecting");
    try {
      const serial = await connectWifiDevice(connectAddress.trim());
      onPaired(serial);
    } catch (err) {
      logger.warn("connect after pair failed", err);
      setErrorMessage(String(err));
      setStatus("error");
    }
  };

  return (
    <Modal title="Pair with Wireless Debugging (Android 11+)" onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm text-zinc-300">
        <p className="text-xs text-zinc-400">
          On your phone: Settings → Developer options → Wireless debugging → Pair device with
          pairing code. Enter the values shown there below.
        </p>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-400">Pairing address (host:port)</span>
          <input
            type="text"
            value={pairAddress}
            onChange={(e) => setPairAddress(e.target.value)}
            placeholder="192.168.1.42:37845"
            className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-sm outline-none focus:border-purple-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-400">Pairing code</span>
          <input
            type="text"
            inputMode="numeric"
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            maxLength={12}
            className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-sm outline-none focus:border-purple-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-400">Connection address (host:5555)</span>
          <input
            type="text"
            value={connectAddress}
            onChange={(e) => setConnectAddress(e.target.value)}
            placeholder="192.168.1.42:5555"
            className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-sm outline-none focus:border-purple-500"
          />
        </label>

        {errorMessage && (
          <p className="text-xs text-red-400 break-words">{errorMessage}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            {status === "pairing"
              ? "Pairing..."
              : status === "connecting"
                ? "Connecting..."
                : "Pair & connect"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
