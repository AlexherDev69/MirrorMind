import { useEffect } from "react";
import { createLogger } from "../../../core/logger";
import { showToast } from "../../../core/components/Toast";
import { pasteClipboardToPhone } from "../data/clipboard";

const logger = createLogger("clipboard");

/**
 * Registers a global Ctrl+Shift+V shortcut that reads the PC clipboard
 * and sends it to the connected phone via the scrcpy control socket.
 *
 * Only active when the stream is running (isStreaming=true).
 */
export function useClipboardShortcut(isStreaming: boolean): void {
  useEffect(() => {
    if (!isStreaming) return;

    const handleKeyDown = async (e: KeyboardEvent): Promise<void> => {
      if (!e.ctrlKey || !e.shiftKey || e.key !== "V") return;

      e.preventDefault();

      try {
        await pasteClipboardToPhone();
        showToast("Clipboard sent to phone", "success");
        logger.info("Clipboard pasted to phone");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        showToast(`Clipboard error: ${message}`, "error");
        logger.error("Failed to paste clipboard to phone", err);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStreaming]);
}
