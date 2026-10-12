import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Modal, Button } from "../../../../core/components";
import { useSettingsStore } from "../../../settings/presentation/stores/settings.store";

const CAPTURE_CONSENT_EVENT = "mcp-capture-consent-required";

/**
 * Asks the user before any MCP client can read the phone screen. Raised by
 * the backend the first time a screenshot or UI tree request is refused.
 */
export function CaptureConsentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  useEffect(() => {
    const unlisten = listen(CAPTURE_CONSENT_EVENT, () => setIsOpen(true));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const allow = useCallback(async () => {
    await updateSettings({ mcpCaptureAllowed: true });
    setIsOpen(false);
  }, [updateSettings]);

  if (!isOpen) return null;

  return (
    <Modal
      title="Allow screen capture?"
      onClose={close}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={close}>
            Not now
          </Button>
          <Button variant="primary" fullWidth onClick={allow}>
            Allow
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-zinc-300">
        <p>
          An MCP client (such as Claude Code) asked to read your phone screen: screenshots and the
          on-screen text and layout.
        </p>
        <p className="text-xs text-zinc-500">
          Anything visible on the phone is sent to that client. You can turn this off at any time in
          Settings. The request that triggered this prompt was refused: ask again after allowing.
        </p>
      </div>
    </Modal>
  );
}
