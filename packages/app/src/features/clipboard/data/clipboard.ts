import { invoke } from "@tauri-apps/api/core";

const MAX_CLIPBOARD_LENGTH = 10_000;

/**
 * Read the PC clipboard text and send it to the phone via scrcpy set_phone_clipboard.
 * The scrcpy control message also triggers a paste on the phone automatically.
 *
 * @throws If the clipboard is empty, too long, or the stream is not active.
 */
export async function pasteClipboardToPhone(): Promise<void> {
  const text = await navigator.clipboard.readText();

  if (!text) {
    throw new Error("Clipboard is empty");
  }

  if (text.length > MAX_CLIPBOARD_LENGTH) {
    throw new Error(`Clipboard text exceeds ${MAX_CLIPBOARD_LENGTH} characters`);
  }

  // paste=true triggers an automatic paste on the phone after clipboard is set
  await invoke("set_phone_clipboard", { text, paste: true });
}
