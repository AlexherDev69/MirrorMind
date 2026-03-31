import { useEffect, useState } from "react";
import { useRecorderStore } from "../stores/recorder.store";

export function RecorderIndicator() {
  const { isRecording, actions, startTime, stopRecording } = useRecorderStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [isRecording, startTime]);

  if (!isRecording) return null;

  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-red-950/50 border-b border-red-800/30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-medium text-red-400">REC</span>
        </div>
        <span className="text-xs text-zinc-400 font-mono">{timeStr}</span>
        <span className="text-xs text-zinc-500">{actions.length} actions</span>
      </div>
      <button
        onClick={stopRecording}
        className="text-xs px-2 py-0.5 rounded bg-red-900/50 hover:bg-red-800/50 text-red-300 transition-colors"
      >
        Stop
      </button>
    </div>
  );
}
