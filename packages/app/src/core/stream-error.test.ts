import { describe, it, expect } from "vitest";
import { formatStreamError } from "./stream-error";

describe("formatStreamError", () => {
  it("should return the unlock hint when the device name cannot be read", () => {
    expect(formatStreamError("Failed to read device name: timed out")).toBe(
      "The phone did not respond in time. Unlock the screen and try again.",
    );
  });

  it("should return the authorization hint when the device is unauthorized", () => {
    expect(formatStreamError("error: device unauthorized")).toContain("has not authorized this computer");
  });

  it("should return the raw message when it is short and unknown", () => {
    expect(formatStreamError("something odd")).toBe("something odd");
  });

  it("should truncate the raw message when it is long and unknown", () => {
    const formatted = formatStreamError("x".repeat(300));
    expect(formatted).toBe(`${"x".repeat(120)}...`);
  });
});
