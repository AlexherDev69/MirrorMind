import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

const KEY_MAP: Record<string, number> = {
  back: 4,
  home: 3,
  recent: 187,
  power: 26,
  volume_up: 24,
  volume_down: 25,
  enter: 66,
  delete: 67,
  tab: 61,
  escape: 111,
  menu: 82,
} as const;

const KNOWN_KEYS = Object.keys(KEY_MAP).join(", ");

export function registerPressKeyTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_press_key",
    `Press a key on the phone. Known keys: ${KNOWN_KEYS}. You can also pass a raw Android keycode number.`,
    {
      key: z.string().describe(`Key name (${KNOWN_KEYS}) or Android keycode number`),
      deviceId: z.string().optional().describe("Device serial (optional)"),
    },
    async ({ key, deviceId }) => {
      const keyCode = KEY_MAP[key.toLowerCase()] ?? parseInt(key, 10);

      if (isNaN(keyCode)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Unknown key: "${key}". Known keys: ${KNOWN_KEYS}` }],
        };
      }

      logger.info(`Press key: ${key} (keyCode=${keyCode})`);

      try {
        const result = await bridge.pressKey({ keyCode, deviceId });
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Key press failed: ${msg}` }],
        };
      }
    },
  );
}
