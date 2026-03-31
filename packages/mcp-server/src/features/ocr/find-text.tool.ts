import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createWorker, type Worker } from "tesseract.js";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

interface TextMatch {
  readonly text: string;
  readonly confidence: number;
  readonly x: number;   // percentage
  readonly y: number;   // percentage
  readonly width: number;  // percentage
  readonly height: number; // percentage
}

/** Singleton OCR worker (reused across calls for speed). */
let ocrWorker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!ocrWorker) {
    ocrWorker = await createWorker("eng");
  }
  return ocrWorker;
}

/**
 * Run OCR on a screenshot and find all text occurrences.
 */
async function ocrScreenshot(
  base64Png: string,
  imgWidth: number,
  imgHeight: number,
): Promise<TextMatch[]> {
  const buffer = Buffer.from(base64Png, "base64");
  const worker = await getWorker();
  const result = await worker.recognize(buffer);

  const matches: TextMatch[] = [];

  for (const word of result.data.words) {
    if (!word.text.trim()) continue;
    matches.push({
      text: word.text,
      confidence: word.confidence,
      x: (word.bbox.x0 / imgWidth) * 100,
      y: (word.bbox.y0 / imgHeight) * 100,
      width: ((word.bbox.x1 - word.bbox.x0) / imgWidth) * 100,
      height: ((word.bbox.y1 - word.bbox.y0) / imgHeight) * 100,
    });
  }

  return matches;
}

export { ocrScreenshot, getWorker };

export function registerFindTextTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_find_text",
    "Find text on the phone screen using OCR. Returns all matching words with their coordinates as percentages (ready to use with phone_tap). If searchText is provided, only returns matches containing that text.",
    {
      searchText: z.string().optional().describe("Text to search for (case-insensitive). If omitted, returns all detected text."),
      deviceId: z.string().optional(),
    },
    async ({ searchText, deviceId }) => {
      logger.info(`OCR find_text: searching for "${searchText ?? "*"}"`);

      try {
        const screenshot = await bridge.screenshot(deviceId);
        const allMatches = await ocrScreenshot(screenshot.base64, screenshot.width, screenshot.height);

        let filtered = allMatches;
        if (searchText) {
          const search = searchText.toLowerCase();
          filtered = allMatches.filter((m) => m.text.toLowerCase().includes(search));
        }

        if (filtered.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: searchText
                ? `Text "${searchText}" not found on screen. ${allMatches.length} words detected total.`
                : "No text detected on screen.",
            }],
          };
        }

        // Format results
        const results = filtered.map((m) => ({
          text: m.text,
          confidence: Math.round(m.confidence),
          centerX: Math.round(m.x + m.width / 2),
          centerY: Math.round(m.y + m.height / 2),
        }));

        const summary = results
          .map((r) => `"${r.text}" at (${r.centerX}%, ${r.centerY}%) [${r.confidence}% conf]`)
          .join("\n");

        return {
          content: [{
            type: "text" as const,
            text: `Found ${results.length} match${results.length > 1 ? "es" : ""}:\n${summary}\n\nUse phone_tap with these percentage coordinates to tap on an element.`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `OCR failed: ${msg}` }],
        };
      }
    },
  );
}
