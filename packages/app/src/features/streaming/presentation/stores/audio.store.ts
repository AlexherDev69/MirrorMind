import { create } from "zustand";

interface AudioStore {
  readonly audioMuted: boolean;
  readonly audioAvailable: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  setAudioAvailable: (available: boolean) => void;
}

/**
 * Store for phone audio forwarding state (mute toggle + device support flag).
 * Audio is ON by default when the stream starts; switched off only on explicit
 * user action or when the device does not support the scrcpy audio protocol
 * (Android < 11).
 */
export const useAudioStore = create<AudioStore>((set) => ({
  audioMuted: false,
  audioAvailable: true,
  toggleMute: () => set((s) => ({ audioMuted: !s.audioMuted })),
  setMuted: (muted) => set({ audioMuted: muted }),
  setAudioAvailable: (available) => set({ audioAvailable: available }),
}));
