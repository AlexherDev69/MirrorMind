import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";
import { DEEP_LINKS_DB, resolveDeepLink } from "./deep-links.js";

export function registerDeepLinkTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  // Build available links list for the description
  const appList = Object.entries(DEEP_LINKS_DB)
    .map(([name, app]) => `${name}: ${Object.keys(app.links).join(", ")}`)
    .join("\n");

  server.tool(
    "phone_deep_link",
    `Open a deep link on the phone. Accepts either a raw URI (e.g., "twitter://messages") or a shorthand (e.g., "twitter:messages").

Available shorthands:
${appList}

For links ending with a parameter placeholder, append the value: "whatsapp:send:33612345678", "youtube:video:dQw4w9WgXcQ"`,
    {
      link: z.string().describe("Deep link URI or shorthand (e.g., 'twitter:messages', 'spotify:search', 'tel:0612345678')"),
      deviceId: z.string().optional(),
    },
    async ({ link, deviceId }) => {
      const uri = resolveDeepLink(link);
      if (!uri) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Unknown deep link: "${link}". Use a raw URI (xxx://...) or a shorthand (app:action).` }],
        };
      }

      logger.info(`Deep link: ${link} → ${uri}`);

      try {
        await bridge.deepLink(uri, deviceId);
        return {
          content: [{ type: "text" as const, text: `Opened: ${uri}` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Deep link failed: ${msg}` }],
        };
      }
    },
  );
}
