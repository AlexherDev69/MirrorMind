/**
 * Android AKEYCODE values for common keys.
 * Full list: https://developer.android.com/reference/android/view/KeyEvent
 */
export const ANDROID_KEYCODE = {
  BACK: 4,
  HOME: 3,
  APP_SWITCH: 187,  // Recent apps
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  POWER: 26,
  ENTER: 66,
  DEL: 67,           // Backspace
  FORWARD_DEL: 112,  // Delete
  TAB: 61,
  ESCAPE: 111,
  DPAD_UP: 19,
  DPAD_DOWN: 20,
  DPAD_LEFT: 21,
  DPAD_RIGHT: 22,
  SPACE: 62,
  MOVE_HOME: 122,    // Home key (text cursor)
  MOVE_END: 123,     // End key (text cursor)
  PAGE_UP: 92,
  PAGE_DOWN: 93,
} as const;

/**
 * Android META_* state flags for modifier keys.
 */
export const ANDROID_META = {
  SHIFT: 1,
  CTRL: 0x1000,
  ALT: 0x02,
} as const;

interface KeyMapping {
  readonly keycode: number;
  readonly metaState?: number;
}

/**
 * Maps browser KeyboardEvent.code to Android keycode.
 * Returns null if the key should be handled as text input instead.
 */
export function mapKeyToAndroid(e: KeyboardEvent): KeyMapping | null {
  let metaState = 0;
  if (e.shiftKey) metaState |= ANDROID_META.SHIFT;
  if (e.ctrlKey) metaState |= ANDROID_META.CTRL;
  if (e.altKey) metaState |= ANDROID_META.ALT;

  // Special keys that map to Android keycodes
  const codeMap: Record<string, number> = {
    Backspace: ANDROID_KEYCODE.DEL,
    Delete: ANDROID_KEYCODE.FORWARD_DEL,
    Enter: ANDROID_KEYCODE.ENTER,
    NumpadEnter: ANDROID_KEYCODE.ENTER,
    Tab: ANDROID_KEYCODE.TAB,
    Escape: ANDROID_KEYCODE.ESCAPE,
    ArrowUp: ANDROID_KEYCODE.DPAD_UP,
    ArrowDown: ANDROID_KEYCODE.DPAD_DOWN,
    ArrowLeft: ANDROID_KEYCODE.DPAD_LEFT,
    ArrowRight: ANDROID_KEYCODE.DPAD_RIGHT,
    Home: ANDROID_KEYCODE.MOVE_HOME,
    End: ANDROID_KEYCODE.MOVE_END,
    PageUp: ANDROID_KEYCODE.PAGE_UP,
    PageDown: ANDROID_KEYCODE.PAGE_DOWN,
    Space: ANDROID_KEYCODE.SPACE,
  };

  const mapped = codeMap[e.code];
  if (mapped !== undefined) {
    return { keycode: mapped, metaState };
  }

  // Ctrl+key shortcuts → send as keycode
  if (e.ctrlKey && e.key.length === 1) {
    const letterCode = e.key.toLowerCase().charCodeAt(0);
    // Android keycodes for A-Z are 29-54
    if (letterCode >= 97 && letterCode <= 122) {
      return { keycode: letterCode - 97 + 29, metaState };
    }
  }

  // Modifier-only keys: ignore (they are sent via metaState)
  if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
    return null;
  }

  // Printable characters: handle as text input (return null)
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
    return null;
  }

  return null;
}
