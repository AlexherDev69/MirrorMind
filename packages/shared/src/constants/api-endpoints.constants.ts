export const DEFAULT_API_PORT = 17395;

export const API_ENDPOINTS = {
  HEALTH: "/api/health",
  SCREENSHOT: "/api/screenshot",
  DISPLAY_SIZE: "/api/display-size",
  TAP: "/api/tap",
  SWIPE: "/api/swipe",
  TYPE: "/api/type",
  KEY: "/api/key",
  DEVICES: "/api/devices",
  DEVICE_INFO: "/api/device",
  CURRENT_ACTIVITY: "/api/current-activity",
  RUN_APP: "/api/run-app",
  UI_TREE: "/api/ui-tree",
  DEEP_LINK: "/api/deep-link",
  MACROS: "/api/macros",
  MACRO: "/api/macros",
  STREAM_STATUS: "/api/stream/status",
  STREAM_START: "/api/stream/start",
  STREAM_STOP: "/api/stream/stop",
} as const;
