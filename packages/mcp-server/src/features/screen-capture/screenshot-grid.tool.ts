import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import sharp from "sharp";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

/**
 * Draw a percentage grid overlay on a screenshot to help Claude
 * estimate tap coordinates more precisely.
 */
async function addGridOverlay(base64Png: string, width: number, height: number): Promise<string> {
  const imgBuffer = Buffer.from(base64Png, "base64");

  // Create SVG grid overlay
  const gridLines: string[] = [];
  const gridStep = 10; // Every 10%

  for (let pct = gridStep; pct < 100; pct += gridStep) {
    const x = Math.round((pct / 100) * width);
    const y = Math.round((pct / 100) * height);

    // Vertical line
    gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255,0,0,0.3)" stroke-width="1"/>`);
    // Horizontal line
    gridLines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255,0,0,0.3)" stroke-width="1"/>`);

    // Labels
    if (pct % 20 === 0) {
      gridLines.push(`<text x="${x + 2}" y="14" font-size="12" fill="rgba(255,0,0,0.7)" font-family="monospace">${pct}%</text>`);
      gridLines.push(`<text x="2" y="${y - 2}" font-size="12" fill="rgba(255,0,0,0.7)" font-family="monospace">${pct}%</text>`);
    }
  }

  const svgOverlay = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${gridLines.join("")}</svg>`
  );

  const result = await sharp(imgBuffer)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return result.toString("base64");
}

export function registerScreenshotGridTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_screenshot_grid",
    "Take a screenshot with a percentage coordinate grid overlay. The grid shows 10% increments with labels at 20%, 40%, 60%, 80%. Use this to precisely estimate tap coordinates as percentages.",
    {
      deviceId: z.string().optional(),
    },
    async ({ deviceId }) => {
      logger.info("Taking screenshot with grid overlay");

      try {
        const screenshot = await bridge.screenshot(deviceId);
        const gridBase64 = await addGridOverlay(screenshot.base64, screenshot.width, screenshot.height);

        return {
          content: [
            { type: "text" as const, text: `Screenshot with grid: ${screenshot.width}x${screenshot.height}px. Grid lines at every 10%, labels at 20/40/60/80%.` },
            { type: "image" as const, data: gridBase64, mimeType: "image/png" as const },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Screenshot grid failed: ${msg}` }],
        };
      }
    },
  );
}
