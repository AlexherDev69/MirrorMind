import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";
import { parseUiTree, formatUiTree } from "../../core/ui-tree-parser.js";

export function registerUiTreeTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_get_ui_tree",
    "Get the accessibility tree of the phone screen. Returns all visible UI elements with their text, type, bounds (as percentages), and clickable state. Much more reliable than OCR for finding and interacting with elements. Use the centerX/centerY of bounds with phone_tap to click elements precisely.",
    {
      deviceId: z.string().optional(),
    },
    async ({ deviceId }) => {
      logger.info("Getting UI tree");

      try {
        const [xml, display] = await Promise.all([
          bridge.uiTree(deviceId),
          bridge.displaySize(deviceId),
        ]);

        const nodes = parseUiTree(xml, display.width, display.height);

        if (nodes.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No UI elements found. Screen may be locked or showing a system overlay." }],
          };
        }

        const formatted = formatUiTree(nodes);

        return {
          content: [{
            type: "text" as const,
            text: `UI Tree — ${nodes.length} elements:\n\n${formatted}\n\nUse phone_tap with the percentage coordinates to interact with any element.`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `UI tree failed: ${msg}` }],
        };
      }
    },
  );
}
