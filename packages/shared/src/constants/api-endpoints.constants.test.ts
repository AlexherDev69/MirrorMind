import { describe, it, expect } from "vitest";
import { API_ENDPOINTS, DEFAULT_API_PORT } from "./api-endpoints.constants.js";

describe("DEFAULT_API_PORT", () => {
  it("should be a valid non-privileged port number", () => {
    expect(DEFAULT_API_PORT).toBeGreaterThan(1023);
    expect(DEFAULT_API_PORT).toBeLessThanOrEqual(65535);
  });

  it("should equal 17395", () => {
    expect(DEFAULT_API_PORT).toBe(17395);
  });
});

describe("API_ENDPOINTS", () => {
  it("should have all endpoint values starting with /api/", () => {
    for (const [key, value] of Object.entries(API_ENDPOINTS)) {
      expect(value, `${key} should start with /api/`).toMatch(/^\/api\//);
    }
  });

  it("should expose a HEALTH endpoint", () => {
    expect(API_ENDPOINTS.HEALTH).toBe("/api/health");
  });

  it("should expose stream control endpoints", () => {
    expect(API_ENDPOINTS.STREAM_START).toBe("/api/stream/start");
    expect(API_ENDPOINTS.STREAM_STOP).toBe("/api/stream/stop");
    expect(API_ENDPOINTS.STREAM_STATUS).toBe("/api/stream/status");
  });

  it("should expose all required MCP tool endpoints", () => {
    const required = [
      "SCREENSHOT",
      "TAP",
      "SWIPE",
      "TYPE",
      "KEY",
      "DEVICES",
      "DEVICE_INFO",
    ] as const;
    for (const key of required) {
      expect(API_ENDPOINTS[key], `${key} must be defined`).toBeTruthy();
    }
  });
});
