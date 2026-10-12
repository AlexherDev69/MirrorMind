import { Icon } from "../../../../core/components";
import { useSettingsStore } from "../../../settings/presentation/stores/settings.store";
import { AUDIO_VOLUME_MAX } from "../../../settings/domain/settings.types";
import { useAudioStore } from "../stores/audio.store";

const DEFAULT_UNAVAILABLE_LABEL = "Phone audio is not available on the PC";

/** Explanations for the reasons the backend sends with `audio-unavailable`. */
const UNAVAILABLE_LABELS: Readonly<Record<string, string>> = {
  "phone-only": "Sound stays on the phone (Audio output is set to Phone only)",
  "requires-android-13": "Phone + PC audio needs Android 13 or newer: sound stays on the phone",
  "capture-failed": "The phone could not start audio capture",
};

/** Mute toggle for the phone audio played on the PC, with a volume slider on hover. */
export function AudioControl() {
  const audioMuted = useAudioStore((s) => s.audioMuted);
  const audioAvailable = useAudioStore((s) => s.audioAvailable);
  const unavailableReason = useAudioStore((s) => s.unavailableReason);
  const toggleMute = useAudioStore((s) => s.toggleMute);
  const audioVolume = useSettingsStore((s) => s.settings.audioVolume);
  const setAudioVolume = useSettingsStore((s) => s.setAudioVolume);
  const persistSettings = useSettingsStore((s) => s.persist);

  if (!audioAvailable) {
    const label =
      (unavailableReason && UNAVAILABLE_LABELS[unavailableReason]) ?? DEFAULT_UNAVAILABLE_LABEL;
    return (
      <button
        disabled
        className="flex items-center justify-center w-7 h-7 rounded opacity-40 cursor-not-allowed"
        title={label}
        aria-label={label}
      >
        <Icon name="volume-x" className="w-4 h-4 text-zinc-500" />
      </button>
    );
  }

  return (
    <div className="relative group/volume">
      <button
        onClick={toggleMute}
        className="flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800 transition-colors group"
        title={audioMuted ? "Unmute phone audio" : "Mute phone audio"}
        aria-label={audioMuted ? "Unmute" : "Mute"}
      >
        <Icon
          name={audioMuted ? "volume-off" : "volume-up"}
          className={`w-4 h-4 ${audioMuted ? "text-zinc-500" : "text-zinc-400 group-hover:text-zinc-200"}`}
        />
      </button>
      <div className="absolute left-1/2 top-full z-50 hidden -translate-x-1/2 pt-1 group-hover/volume:block">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 shadow-lg">
          {/* The volume applies live while dragging and is saved once on release. */}
          <input
            type="range"
            min={0}
            max={AUDIO_VOLUME_MAX}
            value={audioVolume}
            onChange={(e) => setAudioVolume(Number(e.target.value))}
            onPointerUp={persistSettings}
            onKeyUp={persistSettings}
            aria-label="PC audio volume"
            className="w-24 h-1.5 rounded-full appearance-none bg-zinc-700 accent-purple-600"
          />
          <span className="w-7 text-right text-xs text-zinc-400 tabular-nums">{audioVolume}</span>
        </div>
      </div>
    </div>
  );
}
