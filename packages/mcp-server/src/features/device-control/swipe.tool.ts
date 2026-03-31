import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

export function registerSwipeTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_swipe",
    "Swipe on the phone screen from start to end coordinates. Coordinates are PERCENTAGES (0-100) of the screen dimensions. For example, to scroll down, swipe from (50, 70) to (50, 30).",
    {
      startX: z.number().min(0).max(100).describe("Start X as percentage of screen width (0-100)"),
      startY: z.number().min(0).max(100).describe("Start Y as percentage of screen height (0-100)"),
      endX: z.number().min(0).max(100).describe("End X as percentage of screen width (0-100)"),
      endY: z.number().min(0).max(100).describe("End Y as percentage of screen height (0-100)"),
      durationMs: z.number().optional().default(300).describe("Swipe duration in ms (default 300)"),
      deviceId: z.string().optional().describe("Device serial (optional)"),
    },
    async ({ startX, startY, endX, endY, durationMs, deviceId }) => {
      logger.info(`Swipe from (${startX}%,${startY}%) to (${endX}%,${endY}%)`);

      try {
        // Use display size (not screenshot dimensions) because adb input swipe
        // uses display coordinates. Screenshot returns physical pixels which
        // differ from display pixels when the user changes screen resolution.
        const display = await bridge.displaySize(deviceId);
        const w = display.width;
        const h = display.height;
        const nStartX = Math.round((startX / 100) * w);
        const nStartY = Math.round((startY / 100) * h);
        const nEndX = Math.round((endX / 100) * w);
        const nEndY = Math.round((endY / 100) * h);
        logger.info(`Converted to display pixels: (${nStartX},${nStartY}) → (${nEndX},${nEndY}) on ${w}x${h}`);

        const result = await bridge.swipe({
          startX: nStartX, startY: nStartY,
          endX: nEndX, endY: nEndY,
          durationMs, deviceId,
        });
        return { content: [{ type: "text" as const, text: `Swiped from (${startX}%,${startY}%) to (${endX}%,${endY}%) in ${durationMs}ms` }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Swipe failed: ${msg}` }],
        };
      }
    },
  );
}
