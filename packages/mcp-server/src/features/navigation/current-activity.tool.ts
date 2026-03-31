import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

export function registerCurrentActivityTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_get_current_activity",
    "Get the currently active app and activity on the phone. Returns the package name and activity name. Useful to know which app/screen is currently displayed.",
    {
      deviceId: z.string().optional(),
    },
    async ({ deviceId }) => {
      logger.info("Getting current activity");

      try {
        const result = await bridge.currentActivity(deviceId);
        return {
          content: [{
            type: "text" as const,
            text: `Current app: ${result.packageName}\nActivity: ${result.activityName}`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Failed to get current activity: ${msg}` }],
        };
      }
    },
  );
}
