import { create } from "zustand";
import type { AppSettings } from "../../domain/settings.types";
import { DEFAULT_SETTINGS } from "../../domain/settings.types";
import {
  loadSettings,
  saveSettings,
  setAlwaysOnTop as setAlwaysOnTopPersist,
} from "../../data/settings-persistence";

interface SettingsStore {
  readonly settings: AppSettings;
  readonly isLoaded: boolean;
  readonly streamSettingsChanged: boolean;
  load: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  toggleAlwaysOnTop: () => Promise<void>;
  acknowledgeStreamChange: () => void;
}

const STREAM_KEYS: ReadonlyArray<keyof AppSettings> = [
  "maxResolution",
  "bitrate",
  "maxFps",
];

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  streamSettingsChanged: false,

  load: async () => {
    try {
      const settings = await loadSettings();
      set({ settings, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  updateSettings: async (partial) => {
    const current = get().settings;
    const updated: AppSettings = { ...current, ...partial };

    // Check if stream-related settings changed
    const streamChanged = STREAM_KEYS.some(
      (key) => current[key] !== updated[key],
    );

    set({
      settings: updated,
      streamSettingsChanged: streamChanged || get().streamSettingsChanged,
    });

    try {
      await saveSettings(updated);
    } catch {
      // Revert on save failure
      set({ settings: current });
    }
  },

  toggleAlwaysOnTop: async () => {
    const newValue = !get().settings.alwaysOnTop;
    set({ settings: { ...get().settings, alwaysOnTop: newValue } });
    await setAlwaysOnTopPersist(newValue);
  },

  acknowledgeStreamChange: () => {
    set({ streamSettingsChanged: false });
  },
}));
