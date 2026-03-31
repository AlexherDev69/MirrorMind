import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

export function registerListDevicesTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_list_devices",
    "List all connected Android devices via ADB.",
    {},
    async () => {
      logger.info("Listing devices...");

      try {
        const devices = await bridge.listDevices();

        if (devices.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No devices connected." }],
          };
        }

        const lines = devices.map(
          (d) => `- ${d.model} (${d.serial}) [${d.brand}]`,
        );
        return {
          content: [{ type: "text" as const, text: `Connected devices:\n${lines.join("\n")}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `List devices failed: ${msg}` }],
        };
      }
    },
  );
}
