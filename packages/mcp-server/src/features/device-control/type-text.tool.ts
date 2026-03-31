import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

export function registerTypeTextTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_type_text",
    "Type text on the phone. The text will be entered at the current cursor position.",
    {
      text: z.string().describe("The text to type on the phone"),
      deviceId: z.string().optional().describe("Device serial (optional)"),
    },
    async ({ text, deviceId }) => {
      logger.info(`Type text: "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`);

      try {
        const result = await bridge.typeText({ text, deviceId });
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Type text failed: ${msg}` }],
        };
      }
    },
  );
}
