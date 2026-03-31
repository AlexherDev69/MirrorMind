import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";
import { compressForClaude } from "./compress.js";

export function registerScreenCaptureTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_screenshot",
    "Take a screenshot of the phone screen. Returns the current screen as a compressed JPEG image.",
    {
      deviceId: z.string().optional().describe("Device serial (optional, uses first connected device)"),
    },
    async ({ deviceId }) => {
      logger.info("Taking screenshot...");

      try {
        const result = await bridge.screenshot(deviceId);
        const compressed = await compressForClaude(result.base64, result.width, result.height);

        return {
          content: [
            {
              type: "text" as const,
              text: `Screen resolution: ${result.width}x${result.height}px. Use percentage coordinates (0-100) for phone_tap and phone_swipe.`,
            },
            {
              type: "image" as const,
              data: compressed.base64,
              mimeType: compressed.mimeType,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Screenshot failed: ${msg}`);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Screenshot failed: ${msg}` }],
        };
      }
    },
  );
}
