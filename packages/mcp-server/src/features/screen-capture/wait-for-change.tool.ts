import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";
import { compressForClaude } from "./compress.js";

const DEFAULT_TIMEOUT_MS = 10000;
const POLL_INTERVAL_MS = 500;

function compareImages(base64A: string, base64B: string): number {
  const bufA = Buffer.from(base64A, "base64");
  const bufB = Buffer.from(base64B, "base64");

  if (bufA.length !== bufB.length) return 0;

  let same = 0;
  let total = 0;
  const step = Math.max(1, Math.floor(bufA.length / 1000));
  for (let i = 0; i < bufA.length; i += step) {
    total++;
    if (bufA[i] === bufB[i]) same++;
  }

  return total > 0 ? same / total : 1;
}

export function registerWaitForChangeTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_wait_for_change",
    "Wait until the phone screen changes. Takes a reference screenshot, then polls until the screen looks different (useful after tapping a button). Returns the new screenshot.",
    {
      timeoutMs: z.number().optional().describe("Max wait time in ms (default 10000)"),
      threshold: z.number().min(0).max(1).optional().describe("Similarity threshold below which we consider the screen changed (default 0.95)"),
      deviceId: z.string().optional(),
    },
    async ({ timeoutMs, threshold, deviceId }) => {
      const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const thresh = threshold ?? 0.95;

      logger.info(`Waiting for screen change (timeout=${timeout}ms, threshold=${thresh})`);

      try {
        const ref = await bridge.screenshot(deviceId);
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

          const current = await bridge.screenshot(deviceId);
          const similarity = compareImages(ref.base64, current.base64);

          if (similarity < thresh) {
            logger.info(`Screen changed (similarity=${similarity.toFixed(2)})`);
            const compressed = await compressForClaude(current.base64, current.width, current.height);
            return {
              content: [
                { type: "text" as const, text: `Screen changed after ${Date.now() - startTime}ms (similarity: ${similarity.toFixed(2)})` },
                { type: "image" as const, data: compressed.base64, mimeType: compressed.mimeType },
              ],
            };
          }
        }

        const last = await bridge.screenshot(deviceId);
        const compressed = await compressForClaude(last.base64, last.width, last.height);
        return {
          content: [
            { type: "text" as const, text: `Timeout: screen did not change within ${timeout}ms` },
            { type: "image" as const, data: compressed.base64, mimeType: compressed.mimeType },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Wait failed: ${msg}` }],
        };
      }
    },
  );
}
