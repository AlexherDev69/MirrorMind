#!/usr/bin/env node

/**
 * Setup script for MirrorMind MCP server.
 * Generates the configuration to add to Claude Code settings.
 */

import path from "node:path";
import { MCP_SERVER_NAME } from "@phone-stream/shared";

function main(): void {
  const token = process.argv[2];

  if (!token) {
    console.log("\n  Usage: pnpm setup:mcp <token>\n");
    console.log("  Get the token from the PhoneStream app header (click 'Token' button).\n");
    process.exit(1);
  }

  const serverPath = path.resolve(
    import.meta.dirname ?? __dirname,
    "../../dist/index.js",
  );

  const config = {
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: "node",
        args: [serverPath],
        env: {
          MIRROR_MIND_TOKEN: token,
        },
      },
    },
  };

  console.log("\n  Add this to your Claude Code settings (~/.claude.json or project .claude/settings.json):\n");
  console.log("  " + JSON.stringify(config, null, 2).split("\n").join("\n  "));
  console.log("\n  Or run Claude Code with:\n");
  console.log(`  claude --mcp-config '${JSON.stringify(config.mcpServers[MCP_SERVER_NAME])}'`);
  console.log("");
}

main();
