import { describe, it, expect, beforeEach, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../domain/settings.types";
import { saveSettings } from "../../data/settings-persistence";
import { useSettingsStore } from "./settings.store";

vi.mock("../../data/settings-persistence", () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  setAlwaysOnTop: vi.fn(),
}));

const saveSettingsMock = vi.mocked(saveSettings);

describe("useSettingsStore volume", () => {
  beforeEach(() => {
    saveSettingsMock.mockReset();
    saveSettingsMock.mockResolvedValue(undefined);
    useSettingsStore.setState({ settings: DEFAULT_SETTINGS, streamSettingsChanged: false });
  });

  it("should change the volume without saving when setAudioVolume is called", () => {
    useSettingsStore.getState().setAudioVolume(40);

    expect(useSettingsStore.getState().settings.audioVolume).toBe(40);
    expect(saveSettingsMock).not.toHaveBeenCalled();
  });

  it("should save the current settings once when persist is called", async () => {
    useSettingsStore.getState().setAudioVolume(10);
    useSettingsStore.getState().setAudioVolume(25);
    await useSettingsStore.getState().persist();

    expect(saveSettingsMock).toHaveBeenCalledTimes(1);
    expect(saveSettingsMock).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, audioVolume: 25 });
  });

  it("should keep the in-memory volume when the save fails", async () => {
    saveSettingsMock.mockRejectedValue(new Error("disk full"));
    useSettingsStore.getState().setAudioVolume(60);
    await useSettingsStore.getState().persist();

    expect(useSettingsStore.getState().settings.audioVolume).toBe(60);
  });

  it("should not flag a stream restart when only the volume changes", () => {
    useSettingsStore.getState().setAudioVolume(5);

    expect(useSettingsStore.getState().streamSettingsChanged).toBe(false);
  });
});
