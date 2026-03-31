import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

export function registerGetInfoTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_get_info",
    "Get detailed information about a connected phone (model, brand, Android version, screen size).",
    {
      deviceId: z.string().optional().describe("Device serial (optional, uses first connected device)"),
    },
    async ({ deviceId }) => {
      logger.info(`Getting device info${deviceId ? ` for ${deviceId}` : ""}...`);

      try {
        // Get the serial first if not provided
        let serial = deviceId;
        if (!serial) {
          const devices = await bridge.listDevices();
          const connected = devices.find((d) => d.serial);
          if (!connected) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: "No device connected." }],
            };
          }
          serial = connected.serial;
        }

        const info = await bridge.getDeviceInfo(serial);

        const text = [
          `Device: ${info.model}`,
          `Brand: ${info.brand}`,
          `Android: ${info.androidVersion}`,
          `Screen: ${info.screenSize}`,
          `Serial: ${info.serial}`,
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Get info failed: ${msg}` }],
        };
      }
    },
  );
}
