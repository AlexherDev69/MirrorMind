// Build a self-contained MirrorMind MCP server bundle for the installer.
//
// The dev workflow runs the MCP server from the monorepo (resolving deps via the
// workspace node_modules). The installed app has no such tree, so we stage a
// standalone folder here: the tsup-built entry point, a package.json listing only
// the runtime dependencies (workspace package already inlined by tsup), a real
// node_modules produced by `npm install`, and the OCR trained data. Tauri bundles
// this folder as a resource; at runtime `node mcp-server/index.js` resolves its
// dependencies from the co-located node_modules.
//
// Note: the produced node_modules is platform-specific (e.g. sharp native binary),
// which is fine because we build the Windows installer on Windows.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoRoot = join(appDir, "..", "..");
const mcpDir = join(repoRoot, "packages", "mcp-server");
const stageDir = join(appDir, "src-tauri", "mcp-bundle");

const entry = join(mcpDir, "dist", "index.js");
const trainedData = join(mcpDir, "eng.traineddata");

function log(msg) {
  process.stdout.write(`[bundle-mcp] ${msg}\n`);
}

if (!existsSync(entry)) {
  throw new Error(`MCP entry not found at ${entry}. Run "pnpm build:mcp" first.`);
}

// Fresh staging folder.
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

// Standalone manifest: keep runtime deps, drop the workspace package (inlined by tsup).
const mcpPkg = JSON.parse(readFileSync(join(mcpDir, "package.json"), "utf8"));
const deps = { ...mcpPkg.dependencies };
delete deps["@mirror-mind/shared"];

const standalonePkg = {
  name: "mirror-mind-mcp",
  version: mcpPkg.version ?? "0.0.0",
  private: true,
  type: "module",
  dependencies: deps,
};
writeFileSync(join(stageDir, "package.json"), JSON.stringify(standalonePkg, null, 2));

// Install production dependencies into the staging folder.
log("installing production dependencies (npm)...");
execSync("npm install --omit=dev --no-audit --no-fund", { cwd: stageDir, stdio: "inherit" });

// Copy the built entry point and OCR data next to node_modules.
copyFileSync(entry, join(stageDir, "index.js"));
if (existsSync(trainedData)) {
  copyFileSync(trainedData, join(stageDir, "eng.traineddata"));
}

log(`bundle ready at ${stageDir}`);
