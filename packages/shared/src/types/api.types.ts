export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

export interface ScreenshotRequest {
  readonly deviceId?: string;
}

export interface ScreenshotResponse {
  readonly base64: string;
  readonly mimeType: "image/jpeg" | "image/png";
  readonly width: number;
  readonly height: number;
  readonly deviceName: string;
}

export interface TapRequest {
  readonly x: number;
  readonly y: number;
  readonly deviceId?: string;
}

export interface SwipeRequest {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly durationMs?: number;
  readonly deviceId?: string;
}

export interface DisplaySizeRequest {
  readonly deviceId?: string;
}

export interface DisplaySizeResponse {
  readonly width: number;
  readonly height: number;
}

export interface TypeTextRequest {
  readonly text: string;
  readonly deviceId?: string;
}

export interface KeyPressRequest {
  readonly keyCode: number;
  readonly deviceId?: string;
}

export interface HealthResponse {
  readonly version: string;
  readonly uptimeMs: number;
}

export interface CurrentActivityResponse {
  readonly packageName: string;
  readonly activityName: string;
}

export interface RunAppRequest {
  readonly packageName: string;
  readonly deviceId?: string;
}

export type StreamState = "idle" | "starting" | "streaming" | "stopping" | "error";

export interface StreamStatus {
  readonly state: StreamState;
  readonly width: number;
  readonly height: number;
}
