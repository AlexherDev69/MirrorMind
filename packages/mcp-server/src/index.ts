#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION, DEFAULT_API_PORT } from "@phone-stream/shared";
import { TauriBridgeClient } from "./tauri-bridge/index.js";
import { logger } from "./core/logger.js";
import { registerScreenCaptureTool } from "./features/screen-capture/screen-capture.tool.js";
import { registerTapTool, registerSwipeTool, registerTypeTextTool, registerPressKeyTool, registerBatchTool } from "./features/device-control/index.js";
import { registerListDevicesTool, registerGetInfoTool } from "./features/device-info/index.js";
import { registerWaitForChangeTool } from "./features/screen-capture/wait-for-change.tool.js";
import { registerScreenshotGridTool } from "./features/screen-capture/screenshot-grid.tool.js";
import { registerFindTextTool, registerWaitForTextTool } from "./features/ocr/index.js";
import { registerCurrentActivityTool, registerRunAppTool, registerUiTreeTool, registerDeepLinkTool } from "./features/navigation/index.js";
import { registerListMacrosTool, registerReplayMacroTool } from "./features/macros/macros.tools.js";

function parseArgs(): { token: string; port: number } {
  const args = process.argv.slice(2);
  let token = process.env["MIRROR_MIND_TOKEN"] ?? "";
  let port = parseInt(process.env["MIRROR_MIND_PORT"] ?? String(DEFAULT_API_PORT), 10);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--token" && args[i + 1]) {
      token = args[i + 1]!;
      i++;
    } else if (args[i] === "--port" && args[i + 1]) {
      port = parseInt(args[i + 1]!, 10);
      i++;
    }
  }

  if (!token) {
    logger.error("No auth token provided. Use --token <token> or set MIRROR_MIND_TOKEN env var.");
    process.exit(1);
  }

  return { token, port };
}

async function main(): Promise<void> {
  const { token, port } = parseArgs();

  logger.info(`Starting ${MCP_SERVER_NAME} v${MCP_SERVER_VERSION}`);
  // Create bridge to Tauri internal API — try port range to find the running instance
  let bridge: TauriBridgeClient | null = null;
  const portsToTry = [port, ...Array.from({ length: 5 }, (_, i) => DEFAULT_API_PORT + i).filter(p => p !== port)];

  for (const p of portsToTry) {
    const candidate = new TauriBridgeClient(token, p);
    try {
      const health = await candidate.health(2000);
      logger.info(`Connected to PhoneStream app v${health.version} on port ${p}`);
      bridge = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!bridge) {
    logger.warn("PhoneStream app is not running yet. Using default port, tools will fail until the app starts.");
    bridge = new TauriBridgeClient(token, port);
  }

  // Create MCP server
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  // Register all tools
  registerScreenCaptureTool(server, bridge);
  registerTapTool(server, bridge);
  registerSwipeTool(server, bridge);
  registerTypeTextTool(server, bridge);
  registerPressKeyTool(server, bridge);
  registerListDevicesTool(server, bridge);
  registerGetInfoTool(server, bridge);
  registerWaitForChangeTool(server, bridge);
  registerScreenshotGridTool(server, bridge);
  registerFindTextTool(server, bridge);
  registerWaitForTextTool(server, bridge);
  registerCurrentActivityTool(server, bridge);
  registerRunAppTool(server, bridge);
  registerUiTreeTool(server, bridge);
  registerDeepLinkTool(server, bridge);
  registerListMacrosTool(server, bridge);
  registerReplayMacroTool(server, bridge);
  registerBatchTool(server, bridge);

  logger.info("18 tools registered");

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP server connected via stdio — ready for Claude Code");
}

main().catch((err) => {
  logger.error(`Fatal error: ${err}`);
  process.exit(1);
});
