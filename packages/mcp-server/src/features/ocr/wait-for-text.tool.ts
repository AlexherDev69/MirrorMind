import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";
import { ocrScreenshot } from "./find-text.tool.js";
import { compressForClaude } from "../screen-capture/compress.js";

const DEFAULT_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 1000;

export function registerWaitForTextTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_wait_for_text",
    "Wait until specific text appears on the phone screen (OCR polling). Useful after navigation or loading. Returns the screenshot when text is found, or an error on timeout.",
    {
      text: z.string().describe("Text to wait for (case-insensitive)"),
      timeoutMs: z.number().optional().describe("Max wait time in ms (default 15000)"),
      deviceId: z.string().optional(),
    },
    async ({ text, timeoutMs, deviceId }) => {
      const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const search = text.toLowerCase();

      logger.info(`Waiting for text "${text}" (timeout=${timeout}ms)`);

      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        try {
          const screenshot = await bridge.screenshot(deviceId);
          const matches = await ocrScreenshot(screenshot.base64, screenshot.width, screenshot.height);

          const found = matches.find((m) => m.text.toLowerCase().includes(search));

          if (found) {
            const centerX = Math.round(found.x + found.width / 2);
            const centerY = Math.round(found.y + found.height / 2);
            const elapsed = Date.now() - startTime;

            logger.info(`Text "${text}" found after ${elapsed}ms at (${centerX}%, ${centerY}%)`);

            const compressed = await compressForClaude(screenshot.base64, screenshot.width, screenshot.height);
            return {
              content: [
                { type: "text" as const, text: `Text "${text}" found at (${centerX}%, ${centerY}%) after ${elapsed}ms` },
                { type: "image" as const, data: compressed.base64, mimeType: compressed.mimeType },
              ],
            };
          }
        } catch {
          // OCR or screenshot failed — retry
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      // Timeout
      try {
        const last = await bridge.screenshot(deviceId);
        const compressed = await compressForClaude(last.base64, last.width, last.height);
        return {
          content: [
            { type: "text" as const, text: `Timeout: text "${text}" not found within ${timeout}ms` },
            { type: "image" as const, data: compressed.base64, mimeType: compressed.mimeType },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Wait for text failed: ${msg}` }],
        };
      }
    },
  );
}
