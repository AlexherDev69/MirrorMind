import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

export function registerRunAppTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_run_app",
    "Launch an app on the phone by its package name (e.g., 'com.android.settings', 'com.spotify.music'). Opens the app's main/launcher activity.",
    {
      packageName: z.string().describe("Android package name (e.g., 'com.android.settings')"),
      deviceId: z.string().optional(),
    },
    async ({ packageName, deviceId }) => {
      logger.info(`Launching app: ${packageName}`);

      try {
        const result = await bridge.runApp({ packageName, deviceId });
        return {
          content: [{ type: "text" as const, text: result }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Failed to launch app: ${msg}` }],
        };
      }
    },
  );
}
