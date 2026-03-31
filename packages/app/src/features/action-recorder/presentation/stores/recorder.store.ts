import { create } from "zustand";
import type { RecordedAction, ActionParams } from "../../domain/recorder.types";

interface SwipeAccumulator {
  readonly startX: number;
  readonly startY: number;
  readonly startTime: number;
  endX: number;
  endY: number;
}

interface RecorderStore {
  readonly isRecording: boolean;
  readonly actions: RecordedAction[];
  readonly startTime: number | null;
  readonly swipeAcc: SwipeAccumulator | null;

  startRecording: () => void;
  stopRecording: () => void;
  addAction: (type: RecordedAction["type"], params: ActionParams) => void;
  beginSwipe: (x: number, y: number) => void;
  updateSwipe: (x: number, y: number) => void;
  endSwipe: (x: number, y: number) => void;
  clear: () => void;
}

let nextId = 0;

export const useRecorderStore = create<RecorderStore>((set, get) => ({
  isRecording: false,
  actions: [],
  startTime: null,
  swipeAcc: null,

  startRecording: () => {
    nextId = 0;
    set({ isRecording: true, actions: [], startTime: Date.now(), swipeAcc: null });
  },

  stopRecording: () => {
    set({ isRecording: false, swipeAcc: null });
  },

  addAction: (type, params) => {
    const { isRecording, startTime, actions } = get();
    if (!isRecording || !startTime) return;

    const action: RecordedAction = {
      id: nextId++,
      timestamp: Date.now() - startTime,
      type,
      params,
    };
    set({ actions: [...actions, action] });
  },

  beginSwipe: (x, y) => {
    if (!get().isRecording) return;
    set({
      swipeAcc: {
        startX: x,
        startY: y,
        startTime: Date.now(),
        endX: x,
        endY: y,
      },
    });
  },

  updateSwipe: (x, y) => {
    const { swipeAcc } = get();
    if (!swipeAcc) return;
    set({
      swipeAcc: { ...swipeAcc, endX: x, endY: y },
    });
  },

  endSwipe: (x, y) => {
    const { swipeAcc, isRecording, startTime } = get();
    if (!swipeAcc || !isRecording || !startTime) {
      set({ swipeAcc: null });
      return;
    }

    const endX = x;
    const endY = y;
    const durationMs = Date.now() - swipeAcc.startTime;

    // Only record as swipe if the movement is significant (> 2%)
    const dx = Math.abs(endX - swipeAcc.startX);
    const dy = Math.abs(endY - swipeAcc.startY);

    if (dx > 2 || dy > 2) {
      get().addAction("swipe", {
        startX: Math.round(swipeAcc.startX),
        startY: Math.round(swipeAcc.startY),
        endX: Math.round(endX),
        endY: Math.round(endY),
        durationMs,
      });
    } else {
      // Small movement = tap
      get().addAction("tap", {
        x: Math.round(swipeAcc.startX),
        y: Math.round(swipeAcc.startY),
      });
    }

    set({ swipeAcc: null });
  },

  clear: () => {
    set({ actions: [], startTime: null, isRecording: false, swipeAcc: null });
  },
}));
