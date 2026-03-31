import { describe, it, expect } from "vitest";
import { mapCanvasToDevice } from "./coordinate-mapper";

/** Create a mock canvas with a fixed bounding rect. */
function mockCanvas(rectLeft: number, rectTop: number, rectWidth: number, rectHeight: number) {
  return {
    getBoundingClientRect: () => ({
      left: rectLeft,
      top: rectTop,
      width: rectWidth,
      height: rectHeight,
      right: rectLeft + rectWidth,
      bottom: rectTop + rectHeight,
      x: rectLeft,
      y: rectTop,
      toJSON: () => {},
    }),
  } as unknown as HTMLCanvasElement;
}

describe("mapCanvasToDevice", () => {
  // Device: 1080x1920 (portrait phone)
  // Canvas display: 400x800 (matching aspect ratio = no letterbox)
  const device = { width: 1080, height: 1920 };

  describe("perfect aspect ratio match (no letterbox)", () => {
    const canvas = mockCanvas(0, 0, 400, 711); // 1080/1920 ≈ 0.5625, 400/711 ≈ 0.5625

    it("should map center click to center of device", () => {
      const result = mapCanvasToDevice(200, 355.5, canvas, device);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(540, 0);
      expect(result!.y).toBeCloseTo(960, 0);
    });

    it("should map top-left area click to near (0, 0)", () => {
      const result = mapCanvasToDevice(1, 1, canvas, device);
      expect(result).not.toBeNull();
      expect(result!.x).toBeLessThan(10);
      expect(result!.y).toBeLessThan(10);
    });

    it("should map bottom-right area click to near max device coords", () => {
      const result = mapCanvasToDevice(399, 710, canvas, device);
      expect(result).not.toBeNull();
      expect(result!.x).toBeGreaterThan(1070);
      expect(result!.y).toBeGreaterThan(1910);
    });
  });

  describe("letterboxing (device taller than display)", () => {
    // Canvas is 500x500 (square), device is 1080x1920 (tall)
    // Device aspect: 0.5625, Display aspect: 1.0
    // → letterboxing: renderWidth = 500 * 0.5625 = 281.25, offsetX = (500-281.25)/2 ≈ 109
    const canvas = mockCanvas(0, 0, 500, 500);

    it("should return null for click in left letterbox bar", () => {
      const result = mapCanvasToDevice(50, 250, canvas, device);
      expect(result).toBeNull();
    });

    it("should return null for click in right letterbox bar", () => {
      const result = mapCanvasToDevice(450, 250, canvas, device);
      expect(result).toBeNull();
    });

    it("should map click in center of rendered area", () => {
      const result = mapCanvasToDevice(250, 250, canvas, device);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(540, 0);
      expect(result!.y).toBeCloseTo(960, 0);
    });
  });

  describe("pillarboxing (device wider than display)", () => {
    // Landscape device: 1920x1080
    // Canvas: 400x400 (square)
    // Device aspect: 1.778, Display aspect: 1.0
    // → pillarboxing: renderHeight = 400/1.778 = 225, offsetY = (400-225)/2 = 87.5
    const landscapeDevice = { width: 1920, height: 1080 };
    const canvas = mockCanvas(0, 0, 400, 400);

    it("should return null for click in top pillarbox bar", () => {
      const result = mapCanvasToDevice(200, 40, canvas, landscapeDevice);
      expect(result).toBeNull();
    });

    it("should map click in center of rendered area", () => {
      const result = mapCanvasToDevice(200, 200, canvas, landscapeDevice);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(960, 0);
      expect(result!.y).toBeCloseTo(540, 0);
    });
  });

  describe("canvas with offset (not at 0,0)", () => {
    // Canvas starts at (100, 50) on the page
    const canvas = mockCanvas(100, 50, 400, 711);

    it("should account for canvas offset in mouse coordinates", () => {
      // Click at page (300, 405.5) = canvas-relative (200, 355.5) = center
      const result = mapCanvasToDevice(300, 405.5, canvas, device);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(540, 0);
      expect(result!.y).toBeCloseTo(960, 0);
    });

    it("should return null for click outside canvas bounds", () => {
      // Click at (50, 50) = before canvas left edge
      const result = mapCanvasToDevice(50, 50, canvas, device);
      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    const canvas = mockCanvas(0, 0, 400, 711);

    it("should clamp coordinates to device bounds", () => {
      const result = mapCanvasToDevice(399, 710, canvas, device);
      expect(result).not.toBeNull();
      expect(result!.x).toBeLessThanOrEqual(1079);
      expect(result!.y).toBeLessThanOrEqual(1919);
      expect(result!.x).toBeGreaterThanOrEqual(0);
      expect(result!.y).toBeGreaterThanOrEqual(0);
    });

    it("should return rounded integer coordinates", () => {
      const result = mapCanvasToDevice(123, 456, canvas, device);
      expect(result).not.toBeNull();
      expect(Number.isInteger(result!.x)).toBe(true);
      expect(Number.isInteger(result!.y)).toBe(true);
    });
  });
});
