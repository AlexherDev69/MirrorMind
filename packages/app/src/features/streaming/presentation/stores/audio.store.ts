import { create } from "zustand";

interface AudioStore {
  readonly audioMuted: boolean;
  readonly audioAvailable: boolean;
  /** Reason sent by the backend when the audio is not forwarded to the PC. */
  readonly unavailableReason: string | null;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  setAudioAvailable: () => void;
  setAudioUnavailable: (reason: string) => void;
}

/**
 * Store for phone audio forwarding state (mute toggle + availability flag).
 * Audio is ON by default when the stream starts; it is unavailable when the
 * backend does not forward it (audio mode, Android version, capture failure).
 */
export const useAudioStore = create<AudioStore>((set) => ({
  audioMuted: false,
  audioAvailable: true,
  unavailableReason: null,
  toggleMute: () => set((s) => ({ audioMuted: !s.audioMuted })),
  setMuted: (muted) => set({ audioMuted: muted }),
  setAudioAvailable: () => set({ audioAvailable: true, unavailableReason: null }),
  setAudioUnavailable: (reason) => set({ audioAvailable: false, unavailableReason: reason }),
}));
