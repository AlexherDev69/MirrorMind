import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal, Button, Icon } from "../../../../core/components";
import { showToast } from "../../../../core/components/Toast";
import { formatBatchForClipboard } from "../../data/recorder-export";
import type { MacroInfo, MacroSession } from "../../domain/recorder.types";

interface MacrosLibraryModalProps {
  readonly onClose: () => void;
}

export function MacrosLibraryModal({ onClose }: MacrosLibraryModalProps) {
  const [macros, setMacros] = useState<MacroInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadMacros = useCallback(async () => {
    try {
      const list = await invoke<MacroInfo[]>("list_macros");
      setMacros(list);
    } catch {
      showToast("Failed to load macros", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMacros();
  }, [loadMacros]);

  const handleDeleteConfirm = useCallback((name: string) => {
    if (confirmDelete === name) {
      // Second click — actually delete
      invoke("delete_macro", { name })
        .then(() => {
          showToast(`Macro "${name}" deleted`, "success");
          setConfirmDelete(null);
          return loadMacros();
        })
        .catch((err) => showToast(`Delete failed: ${err}`, "error"));
    } else {
      // First click — ask for confirmation
      setConfirmDelete(name);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  }, [confirmDelete, loadMacros]);

  const handleCopyBatch = useCallback(async (name: string) => {
    try {
      const json = await invoke<string>("load_macro", { name });
      const session: MacroSession = JSON.parse(json);
      const batch = formatBatchForClipboard(session.actions);
      await navigator.clipboard.writeText(batch);
      showToast("MCP batch copied to clipboard", "success");
    } catch (err) {
      showToast(`Copy failed: ${err}`, "error");
    }
  }, []);

  const handleReplay = useCallback(async (name: string) => {
    setReplaying(name);
    try {
      const json = await invoke<string>("load_macro", { name });
      const session: MacroSession = JSON.parse(json);

      for (let i = 0; i < session.actions.length; i++) {
        const action = session.actions[i]!;

        // Wait between actions based on timestamps
        if (i > 0) {
          const prev = session.actions[i - 1]!;
          const delay = action.timestamp - prev.timestamp;
          if (delay > 50) {
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        switch (action.type) {
          case "tap": {
            const p = action.params as { x: number; y: number };
            // Convert percentage to device coords using canvas dimensions
            const canvas = document.querySelector("canvas");
            if (canvas) {
              const x = (p.x / 100) * canvas.width;
              const y = (p.y / 100) * canvas.height;
              await invoke("inject_touch", { action: 0, x, y });
              await invoke("inject_touch", { action: 1, x, y });
            }
            break;
          }
          case "swipe": {
            const p = action.params as { startX: number; startY: number; endX: number; endY: number; durationMs: number };
            const canvas = document.querySelector("canvas");
            if (canvas) {
              const sx = (p.startX / 100) * canvas.width;
              const sy = (p.startY / 100) * canvas.height;
              const ex = (p.endX / 100) * canvas.width;
              const ey = (p.endY / 100) * canvas.height;
              // Simulate swipe: down → move → up
              await invoke("inject_touch", { action: 0, x: sx, y: sy });
              const steps = 5;
              for (let s = 1; s <= steps; s++) {
                const frac = s / steps;
                await new Promise((r) => setTimeout(r, p.durationMs / steps));
                await invoke("inject_touch", {
                  action: 2,
                  x: sx + (ex - sx) * frac,
                  y: sy + (ey - sy) * frac,
                });
              }
              await invoke("inject_touch", { action: 1, x: ex, y: ey });
            }
            break;
          }
          case "type": {
            const p = action.params as { text: string };
            await invoke("inject_text", { text: p.text });
            break;
          }
          case "key": {
            const p = action.params as { keycode: number; metaState?: number };
            await invoke("inject_keycode", { keycode: p.keycode, metaState: p.metaState });
            break;
          }
          case "scroll": {
            const p = action.params as { x: number; y: number; scrollV: number; scrollH: number };
            const canvas = document.querySelector("canvas");
            if (canvas) {
              const x = (p.x / 100) * canvas.width;
              const y = (p.y / 100) * canvas.height;
              await invoke("inject_scroll", { x, y, scrollV: p.scrollV, scrollH: p.scrollH });
            }
            break;
          }
        }
      }

      showToast(`Macro "${name}" replayed (${session.actions.length} actions)`, "success");
    } catch (err) {
      showToast(`Replay failed: ${err}`, "error");
    }
    setReplaying(null);
  }, []);

  const formatDuration = (ms: number) => {
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;
  };

  return (
    <Modal title="Macros Library" onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Icon name="spinner" className="w-6 h-6 text-purple-500" />
        </div>
      ) : macros.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-500">No macros yet</p>
          <p className="text-xs text-zinc-600 mt-1">Record actions and save them as macros</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {macros.map((macro) => (
            <div
              key={macro.name}
              className="border border-zinc-800 rounded-lg p-3 bg-zinc-950"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium text-zinc-200">{macro.name}</h3>
                <span className="text-xs text-zinc-600">
                  {macro.actionCount} actions &middot; {formatDuration(macro.duration)}
                </span>
              </div>
              {macro.description && (
                <p className="text-xs text-zinc-500 mb-2">{macro.description}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  className="text-xs px-2 py-1"
                  onClick={() => handleReplay(macro.name)}
                  disabled={replaying !== null}
                >
                  {replaying === macro.name ? "Replaying..." : "Replay"}
                </Button>
                <Button
                  variant="secondary"
                  className="text-xs px-2 py-1"
                  onClick={() => handleCopyBatch(macro.name)}
                >
                  Copy MCP
                </Button>
                <Button
                  variant={confirmDelete === macro.name ? "danger" : "ghost"}
                  className="text-xs px-2 py-1 text-red-400 hover:text-red-300"
                  onClick={() => handleDeleteConfirm(macro.name)}
                >
                  {confirmDelete === macro.name ? "Confirm?" : "Delete"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
