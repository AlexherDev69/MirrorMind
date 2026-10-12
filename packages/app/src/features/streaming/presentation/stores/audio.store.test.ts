import { describe, it, expect, beforeEach } from "vitest";
import { useAudioStore } from "./audio.store";

describe("useAudioStore", () => {
  beforeEach(() => {
    useAudioStore.getState().setAudioAvailable();
  });

  it("should keep the reason when the audio becomes unavailable", () => {
    useAudioStore.getState().setAudioUnavailable("requires-android-13");

    expect(useAudioStore.getState().audioAvailable).toBe(false);
    expect(useAudioStore.getState().unavailableReason).toBe("requires-android-13");
  });

  it("should clear the reason when the audio becomes available again", () => {
    useAudioStore.getState().setAudioUnavailable("phone-only");
    useAudioStore.getState().setAudioAvailable();

    expect(useAudioStore.getState().audioAvailable).toBe(true);
    expect(useAudioStore.getState().unavailableReason).toBeNull();
  });
});
