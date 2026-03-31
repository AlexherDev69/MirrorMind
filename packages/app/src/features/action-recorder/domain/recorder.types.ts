export interface TapParams {
  readonly x: number; // percentage 0-100
  readonly y: number;
}

export interface SwipeParams {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly durationMs: number;
}

export interface ScrollParams {
  readonly x: number;
  readonly y: number;
  readonly scrollV: number;
  readonly scrollH: number;
}

export interface KeyParams {
  readonly keycode: number;
  readonly metaState?: number;
}

export interface TypeParams {
  readonly text: string;
}

export type ActionParams = TapParams | SwipeParams | ScrollParams | KeyParams | TypeParams;

export interface RecordedAction {
  readonly id: number;
  readonly timestamp: number; // ms since recording start
  readonly type: "tap" | "swipe" | "scroll" | "key" | "type";
  readonly params: ActionParams;
}

export interface MacroSession {
  readonly version: 1;
  readonly name: string;
  readonly description: string;
  readonly recordedAt: string; // ISO date
  readonly duration: number;   // ms
  readonly actions: RecordedAction[];
}

export interface MacroInfo {
  readonly name: string;
  readonly description: string;
  readonly recordedAt: string;
  readonly duration: number;
  readonly actionCount: number;
}
