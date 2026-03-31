import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal, Button } from "../../../../core/components";
import { useRecorderStore } from "../stores/recorder.store";
import { buildMacroSession, formatBatchForClipboard } from "../../data/recorder-export";
import { useToastStore } from "../../../../core/components/Toast";

interface SaveMacroModalProps {
  readonly onClose: () => void;
}

export function SaveMacroModal({ onClose }: SaveMacroModalProps) {
  const { actions, startTime, clear } = useRecorderStore();
  const showToast = useToastStore((s) => s.addToast);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !startTime) return;
    setSaving(true);
    try {
      const session = buildMacroSession(name.trim(), description.trim(), actions, startTime);
      await invoke("save_macro", { macroJson: JSON.stringify(session) });
      showToast(`Macro "${name}" saved (${actions.length} actions)`, "success");
      clear();
      onClose();
    } catch (err) {
      showToast(`Failed to save macro: ${err}`, "error");
    }
    setSaving(false);
  }, [name, description, actions, startTime, clear, onClose, showToast]);

  const handleCopyBatch = useCallback(async () => {
    const batch = formatBatchForClipboard(actions);
    await navigator.clipboard.writeText(batch);
    showToast("MCP batch copied to clipboard", "success");
  }, [actions, showToast]);

  const handleDiscard = useCallback(() => {
    clear();
    onClose();
  }, [clear, onClose]);

  return (
    <Modal title="Save Macro" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-zinc-400 text-center">
          {actions.length} actions recorded
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. login-flow"
              className="w-full text-sm px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-purple-600"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Opens app and logs in"
              className="w-full text-sm px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="primary" fullWidth onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving..." : "Save Macro"}
          </Button>
          <Button variant="secondary" fullWidth onClick={handleCopyBatch}>
            Copy as MCP Batch
          </Button>
          <Button variant="ghost" fullWidth onClick={handleDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </Modal>
  );
}
