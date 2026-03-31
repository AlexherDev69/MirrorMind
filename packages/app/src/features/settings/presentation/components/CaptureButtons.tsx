import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../../../../core/components/Toast";
import { Icon } from "../../../../core/components";
import { useRecorderStore } from "../../../action-recorder/presentation/stores/recorder.store";
import { SaveMacroModal } from "../../../action-recorder/presentation/components/SaveMacroModal";

export function CaptureButtons() {
  const [screenshotting, setScreenshotting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const { isRecording, startRecording, stopRecording } = useRecorderStore();

  const handleScreenshot = useCallback(async () => {
    if (screenshotting) return;
    setScreenshotting(true);
    try {
      const path = await invoke<string>("take_screenshot");
      const filename = path.split(/[/\\]/).pop() ?? "screenshot";
      showToast(`Saved: ${filename}`, "success");
    } catch (err) {
      showToast(`Screenshot failed: ${err}`, "error");
    }
    setScreenshotting(false);
  }, [screenshotting]);

  const handleRecordToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
      // Check actions from store directly (not from closure)
      const currentActions = useRecorderStore.getState().actions;
      if (currentActions.length > 0) {
        setShowSaveModal(true);
      } else {
        showToast("No actions recorded", "info");
      }
    } else {
      startRecording();
      showToast("Recording started", "info");
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={handleScreenshot}
          disabled={screenshotting}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800 transition-colors disabled:opacity-50 group"
          title="Take screenshot"
          aria-label="Take screenshot"
        >
          <Icon name="camera" className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
        </button>

        <button
          onClick={handleRecordToggle}
          className={`flex items-center justify-center w-7 h-7 rounded transition-colors group ${
            isRecording ? "bg-red-900/50" : "hover:bg-zinc-800"
          }`}
          title={isRecording ? "Stop recording" : "Record actions"}
          aria-label={isRecording ? "Stop recording" : "Record actions"}
        >
          {isRecording ? (
            <div className="w-3 h-3 rounded-sm bg-red-500 animate-pulse" />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-400 group-hover:border-red-400 transition-colors" />
          )}
        </button>
      </div>

      {showSaveModal && (
        <SaveMacroModal onClose={() => setShowSaveModal(false)} />
      )}
    </>
  );
}
