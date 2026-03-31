import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

export function registerTapTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_tap",
    "Tap on the phone screen at the given coordinates. Coordinates are PERCENTAGES (0-100) of the screen dimensions. For example, the center of the screen is (50, 50). Top-left is (0, 0), bottom-right is (100, 100). Estimate the visual position as a percentage of the screen width/height.",
    {
      x: z.number().min(0).max(100).describe("X position as percentage of screen width (0-100)"),
      y: z.number().min(0).max(100).describe("Y position as percentage of screen height (0-100)"),
      deviceId: z.string().optional().describe("Device serial (optional)"),
    },
    async ({ x, y, deviceId }) => {
      logger.info(`Tap at (${x}%, ${y}%)`);

      try {
        // Use display size (not screenshot dimensions) because adb input tap
        // uses display coordinates. Screenshot returns physical pixels which
        // differ from display pixels when the user changes screen resolution.
        const display = await bridge.displaySize(deviceId);
        const nativeX = Math.round((x / 100) * display.width);
        const nativeY = Math.round((y / 100) * display.height);
        logger.info(`Converted to display pixels: (${nativeX}, ${nativeY}) on ${display.width}x${display.height}`);

        const result = await bridge.tap({ x: nativeX, y: nativeY, deviceId });
        return { content: [{ type: "text" as const, text: `Tapped at (${x}%, ${y}%) → native (${nativeX}, ${nativeY})` }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Tap failed: ${msg}` }],
        };
      }
    },
  );
}
