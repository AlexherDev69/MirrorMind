import { describe, it, expect } from "vitest";
import {
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  AUTH_TOKEN_BYTE_LENGTH,
  RATE_LIMIT_MAX_PER_SECOND,
  INTERNAL_API_HOST,
} from "./mcp.constants.js";

describe("MCP_SERVER_NAME", () => {
  it("should be a non-empty string", () => {
    expect(typeof MCP_SERVER_NAME).toBe("string");
    expect(MCP_SERVER_NAME.length).toBeGreaterThan(0);
  });
});

describe("MCP_SERVER_VERSION", () => {
  it("should follow semver format", () => {
    expect(MCP_SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("AUTH_TOKEN_BYTE_LENGTH", () => {
  it("should be at least 32 bytes for sufficient entropy", () => {
    expect(AUTH_TOKEN_BYTE_LENGTH).toBeGreaterThanOrEqual(32);
  });
});

describe("RATE_LIMIT_MAX_PER_SECOND", () => {
  it("should be a positive number", () => {
    expect(RATE_LIMIT_MAX_PER_SECOND).toBeGreaterThan(0);
  });
});

describe("INTERNAL_API_HOST", () => {
  it("should bind only to localhost to prevent external access", () => {
    expect(INTERNAL_API_HOST).toBe("127.0.0.1");
  });
});
