export interface AppSettings {
  readonly maxResolution: number;
  readonly bitrate: number;
  readonly maxFps: number;
  readonly alwaysOnTop: boolean;
  readonly minimizeToTray: boolean;
  readonly scrollSensitivity: number;
  readonly screenshotPath: string;
  readonly recordingPath: string;
  readonly windowX: number | null;
  readonly windowY: number | null;
  readonly windowWidth: number | null;
  readonly windowHeight: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxResolution: 0,
  bitrate: 8_000_000,
  maxFps: 60,
  alwaysOnTop: true,
  minimizeToTray: true,
  scrollSensitivity: 10,
  screenshotPath: "", // loaded from Rust (Pictures/MirrorMind/Screen)
  recordingPath: "",  // loaded from Rust (Pictures/MirrorMind/Video)
  windowX: null,
  windowY: null,
  windowWidth: null,
  windowHeight: null,
};

export const SCROLL_SENSITIVITY_MIN = 1;
export const SCROLL_SENSITIVITY_MAX = 20;

export const RESOLUTION_OPTIONS = [
  { value: 720, label: "720p" },
  { value: 1080, label: "1080p" },
  { value: 1920, label: "1920p" },
  { value: 0, label: "Native (no limit)" },
] as const;

export const BITRATE_OPTIONS = [
  { value: 2_000_000, label: "2 Mbps (Low)" },
  { value: 4_000_000, label: "4 Mbps" },
  { value: 8_000_000, label: "8 Mbps (Default)" },
  { value: 16_000_000, label: "16 Mbps (High)" },
] as const;

export const FPS_OPTIONS = [
  { value: 30, label: "30 FPS" },
  { value: 60, label: "60 FPS" },
] as const;
