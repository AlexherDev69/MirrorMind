import { describe, it, expect } from "vitest";
import { mapKeyToAndroid, ANDROID_KEYCODE, ANDROID_META } from "./keyboard-mapper";

/** Create a minimal KeyboardEvent-like object. */
function mockKeyEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    code: "",
    key: "",
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...overrides,
  } as KeyboardEvent;
}

describe("mapKeyToAndroid", () => {
  describe("special keys", () => {
    it("should map Backspace to AKEYCODE_DEL", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "Backspace", key: "Backspace" }));
      expect(result).toEqual({ keycode: ANDROID_KEYCODE.DEL, metaState: 0 });
    });

    it("should map Delete to AKEYCODE_FORWARD_DEL", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "Delete", key: "Delete" }));
      expect(result).toEqual({ keycode: ANDROID_KEYCODE.FORWARD_DEL, metaState: 0 });
    });

    it("should map Enter to AKEYCODE_ENTER", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "Enter", key: "Enter" }));
      expect(result).toEqual({ keycode: ANDROID_KEYCODE.ENTER, metaState: 0 });
    });

    it("should map NumpadEnter to AKEYCODE_ENTER", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "NumpadEnter", key: "Enter" }));
      expect(result).toEqual({ keycode: ANDROID_KEYCODE.ENTER, metaState: 0 });
    });

    it("should map Tab to AKEYCODE_TAB", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "Tab", key: "Tab" }));
      expect(result).toEqual({ keycode: ANDROID_KEYCODE.TAB, metaState: 0 });
    });

    it("should map Escape to AKEYCODE_ESCAPE", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "Escape", key: "Escape" }));
      expect(result).toEqual({ keycode: ANDROID_KEYCODE.ESCAPE, metaState: 0 });
    });

    it("should map arrow keys", () => {
      expect(mapKeyToAndroid(mockKeyEvent({ code: "ArrowUp" }))).toEqual({ keycode: ANDROID_KEYCODE.DPAD_UP, metaState: 0 });
      expect(mapKeyToAndroid(mockKeyEvent({ code: "ArrowDown" }))).toEqual({ keycode: ANDROID_KEYCODE.DPAD_DOWN, metaState: 0 });
      expect(mapKeyToAndroid(mockKeyEvent({ code: "ArrowLeft" }))).toEqual({ keycode: ANDROID_KEYCODE.DPAD_LEFT, metaState: 0 });
      expect(mapKeyToAndroid(mockKeyEvent({ code: "ArrowRight" }))).toEqual({ keycode: ANDROID_KEYCODE.DPAD_RIGHT, metaState: 0 });
    });

    it("should map Home/End/PageUp/PageDown", () => {
      expect(mapKeyToAndroid(mockKeyEvent({ code: "Home" }))).toEqual({ keycode: ANDROID_KEYCODE.MOVE_HOME, metaState: 0 });
      expect(mapKeyToAndroid(mockKeyEvent({ code: "End" }))).toEqual({ keycode: ANDROID_KEYCODE.MOVE_END, metaState: 0 });
      expect(mapKeyToAndroid(mockKeyEvent({ code: "PageUp" }))).toEqual({ keycode: ANDROID_KEYCODE.PAGE_UP, metaState: 0 });
      expect(mapKeyToAndroid(mockKeyEvent({ code: "PageDown" }))).toEqual({ keycode: ANDROID_KEYCODE.PAGE_DOWN, metaState: 0 });
    });

    it("should map Space to AKEYCODE_SPACE", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "Space", key: " " }));
      expect(result).toEqual({ keycode: ANDROID_KEYCODE.SPACE, metaState: 0 });
    });
  });

  describe("modifier keys", () => {
    it("should include Shift in metaState", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "Enter", key: "Enter", shiftKey: true }));
      expect(result!.metaState).toBe(ANDROID_META.SHIFT);
    });

    it("should include Ctrl in metaState", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "Enter", key: "Enter", ctrlKey: true }));
      expect(result!.metaState).toBe(ANDROID_META.CTRL);
    });

    it("should include Alt in metaState", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ code: "Enter", key: "Enter", altKey: true }));
      expect(result!.metaState).toBe(ANDROID_META.ALT);
    });

    it("should combine multiple modifiers", () => {
      const result = mapKeyToAndroid(mockKeyEvent({
        code: "Enter", key: "Enter", shiftKey: true, ctrlKey: true,
      }));
      expect(result!.metaState).toBe(ANDROID_META.SHIFT | ANDROID_META.CTRL);
    });

    it("should return null for modifier-only keys", () => {
      expect(mapKeyToAndroid(mockKeyEvent({ key: "Shift" }))).toBeNull();
      expect(mapKeyToAndroid(mockKeyEvent({ key: "Control" }))).toBeNull();
      expect(mapKeyToAndroid(mockKeyEvent({ key: "Alt" }))).toBeNull();
      expect(mapKeyToAndroid(mockKeyEvent({ key: "Meta" }))).toBeNull();
    });
  });

  describe("Ctrl+letter shortcuts", () => {
    it("should map Ctrl+A to AKEYCODE_A (29) with CTRL meta", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ key: "a", ctrlKey: true }));
      expect(result).toEqual({ keycode: 29, metaState: ANDROID_META.CTRL });
    });

    it("should map Ctrl+Z to AKEYCODE_Z (54) with CTRL meta", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ key: "z", ctrlKey: true }));
      expect(result).toEqual({ keycode: 54, metaState: ANDROID_META.CTRL });
    });

    it("should handle uppercase Ctrl+A", () => {
      const result = mapKeyToAndroid(mockKeyEvent({ key: "A", ctrlKey: true }));
      expect(result).toEqual({ keycode: 29, metaState: ANDROID_META.CTRL });
    });
  });

  describe("printable characters (should return null for text input)", () => {
    it("should return null for single characters", () => {
      expect(mapKeyToAndroid(mockKeyEvent({ key: "a", code: "KeyA" }))).toBeNull();
      expect(mapKeyToAndroid(mockKeyEvent({ key: "1", code: "Digit1" }))).toBeNull();
      expect(mapKeyToAndroid(mockKeyEvent({ key: "@", code: "Digit2" }))).toBeNull();
    });

    it("should return null for shifted characters", () => {
      expect(mapKeyToAndroid(mockKeyEvent({ key: "A", code: "KeyA", shiftKey: true }))).toBeNull();
    });
  });
});
