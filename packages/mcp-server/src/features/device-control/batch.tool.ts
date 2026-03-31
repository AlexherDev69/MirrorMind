import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";
import { compressForClaude } from "../screen-capture/compress.js";
import { resolveDeepLink } from "../navigation/deep-links.js";
import { parseUiTree, formatUiTree, type ParsedUiNode } from "../../core/ui-tree-parser.js";

// ── Smart wait: compare screenshots ────────────

function compareImages(a: string, b: string): number {
  const bufA = Buffer.from(a, "base64");
  const bufB = Buffer.from(b, "base64");
  if (bufA.length !== bufB.length) return 0;
  let same = 0;
  let total = 0;
  const step = Math.max(1, Math.floor(bufA.length / 500));
  for (let i = 0; i < bufA.length; i += step) {
    total++;
    if (bufA[i] === bufB[i]) same++;
  }
  return total > 0 ? same / total : 1;
}

// ── Action schemas ────────────

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("tap"), x: z.number().min(0).max(100), y: z.number().min(0).max(100) }),
  z.object({ action: z.literal("swipe"), startX: z.number(), startY: z.number(), endX: z.number(), endY: z.number(), durationMs: z.number().optional() }),
  z.object({ action: z.literal("type"), text: z.string() }),
  z.object({ action: z.literal("key"), key: z.string() }),
  z.object({ action: z.literal("wait"), ms: z.number().min(0).max(30000) }),
  z.object({ action: z.literal("screenshot") }),
  z.object({ action: z.literal("back") }),
  z.object({ action: z.literal("home") }),
  // New smart actions:
  z.object({ action: z.literal("ui_tree") }),
  z.object({ action: z.literal("wait_screen_change"), timeoutMs: z.number().optional(), threshold: z.number().optional() }),
  z.object({ action: z.literal("tap_by_text"), text: z.string(), index: z.number().optional() }),
  z.object({ action: z.literal("tap_by_id"), id: z.string() }),
  z.object({ action: z.literal("tap_by_desc"), desc: z.string() }),
  z.object({ action: z.literal("run_app"), packageName: z.string() }),
  z.object({ action: z.literal("deep_link"), uri: z.string() }),
  z.object({ action: z.literal("assert_text"), text: z.string() }),
  z.object({ action: z.literal("wait_for_text"), text: z.string(), timeoutMs: z.number().optional() }),
]);

const KEY_MAP: Record<string, number> = {
  back: 4, home: 3, recent: 187, power: 26,
  volume_up: 24, volume_down: 25,
  enter: 66, delete: 67, tab: 61, escape: 111, menu: 82,
};

export function registerBatchTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_batch",
    `Execute multiple phone actions in a single call for maximum speed. Actions run sequentially server-side with zero round-trip overhead between them.

Available actions:
- tap: { action: "tap", x: %, y: % }
- swipe: { action: "swipe", startX, startY, endX, endY, durationMs? }
- type: { action: "type", text: "hello" }
- key: { action: "key", key: "enter" }
- wait: { action: "wait", ms: 1000 }
- screenshot: { action: "screenshot" } — takes a screenshot at this point
- back: { action: "back" }
- home: { action: "home" }
- ui_tree: { action: "ui_tree" } — returns the accessibility tree at this point
- wait_screen_change: { action: "wait_screen_change", timeoutMs?: 5000 } — smart wait until screen changes
- tap_by_text: { action: "tap_by_text", text: "Login" } — finds element by text and taps it
- tap_by_id: { action: "tap_by_id", id: "submit_btn" } — finds element by resource-id and taps it
- tap_by_desc: { action: "tap_by_desc", desc: "Search" } — finds element by content-desc and taps it
- run_app: { action: "run_app", packageName: "com.twitter.android" } — launches an app
- deep_link: { action: "deep_link", uri: "twitter://messages" } — opens a deep link
- assert_text: { action: "assert_text", text: "Login" } — checks text is visible, STOPS batch if not (allows AI fallback)
- wait_for_text: { action: "wait_for_text", text: "Welcome", timeoutMs: 10000 } — waits until text appears on screen

Example: [{"action":"run_app","packageName":"com.twitter.android"},{"action":"wait_screen_change"},{"action":"tap_by_desc","desc":"Chat"},{"action":"wait_screen_change"},{"action":"tap_by_text","text":"zakouni"},{"action":"wait_screen_change"},{"action":"tap_by_text","text":"Message"},{"action":"type","text":"hello"}]`,
    {
      actions: z.array(actionSchema).min(1).max(50).describe("Array of actions to execute sequentially"),
      deviceId: z.string().optional(),
    },
    async ({ actions, deviceId }) => {
      logger.info(`Batch: ${actions.length} actions`);

      const results: string[] = [];
      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: "image/jpeg" }> = [];
      let uiTreeText = "";

      try {
        const display = await bridge.displaySize(deviceId);

        for (let i = 0; i < actions.length; i++) {
          const act = actions[i]!;

          switch (act.action) {
            case "tap": {
              const nX = Math.round((act.x / 100) * display.width);
              const nY = Math.round((act.y / 100) * display.height);
              await bridge.tap({ x: nX, y: nY, deviceId });
              results.push(`[${i}] tap (${act.x}%, ${act.y}%)`);
              break;
            }
            case "swipe": {
              const sX = Math.round((act.startX / 100) * display.width);
              const sY = Math.round((act.startY / 100) * display.height);
              const eX = Math.round((act.endX / 100) * display.width);
              const eY = Math.round((act.endY / 100) * display.height);
              await bridge.swipe({ startX: sX, startY: sY, endX: eX, endY: eY, durationMs: act.durationMs, deviceId });
              results.push(`[${i}] swipe`);
              break;
            }
            case "type": {
              await bridge.typeText({ text: act.text, deviceId });
              results.push(`[${i}] typed "${act.text.length > 20 ? act.text.slice(0, 20) + "..." : act.text}"`);
              break;
            }
            case "key": {
              const keyCode = KEY_MAP[act.key] ?? parseInt(act.key, 10);
              if (!isNaN(keyCode)) await bridge.pressKey({ keyCode, deviceId });
              results.push(`[${i}] key ${act.key}`);
              break;
            }
            case "wait": {
              await new Promise((r) => setTimeout(r, act.ms));
              results.push(`[${i}] waited ${act.ms}ms`);
              break;
            }
            case "screenshot": {
              const shot = await bridge.screenshot(deviceId);
              const compressed = await compressForClaude(shot.base64, shot.width, shot.height);
              content.push({ type: "image" as const, data: compressed.base64, mimeType: compressed.mimeType });
              results.push(`[${i}] screenshot taken`);
              break;
            }
            case "back": {
              await bridge.pressKey({ keyCode: 4, deviceId });
              results.push(`[${i}] back`);
              break;
            }
            case "home": {
              await bridge.pressKey({ keyCode: 3, deviceId });
              results.push(`[${i}] home`);
              break;
            }
            case "ui_tree": {
              const xml = await bridge.uiTree(deviceId);
              const nodes = parseUiTree(xml, display.width, display.height);
              uiTreeText = `\n\nUI Tree (${nodes.length} elements):\n${formatUiTree(nodes)}`;
              results.push(`[${i}] ui_tree: ${nodes.length} elements`);
              break;
            }
            case "wait_screen_change": {
              const timeout = act.timeoutMs ?? 5000;
              const thresh = act.threshold ?? 0.95;
              const ref = await bridge.screenshot(deviceId);
              const start = Date.now();
              let changed = false;

              while (Date.now() - start < timeout) {
                await new Promise((r) => setTimeout(r, 200));
                const cur = await bridge.screenshot(deviceId);
                if (compareImages(ref.base64, cur.base64) < thresh) {
                  changed = true;
                  break;
                }
              }
              results.push(`[${i}] wait_screen_change: ${changed ? `changed in ${Date.now() - start}ms` : `timeout ${timeout}ms`}`);
              break;
            }
            case "tap_by_text": {
              const xml = await bridge.uiTree(deviceId);
              const nodes = parseUiTree(xml, display.width, display.height);
              const search = act.text.toLowerCase();
              const matches = nodes.filter((n) =>
                n.text.toLowerCase().includes(search) || n.contentDesc.toLowerCase().includes(search)
              );
              const target = matches[act.index ?? 0];
              if (target) {
                const nX = Math.round((target.centerX / 100) * display.width);
                const nY = Math.round((target.centerY / 100) * display.height);
                await bridge.tap({ x: nX, y: nY, deviceId });
                results.push(`[${i}] tap_by_text "${act.text}" → (${target.centerX}%, ${target.centerY}%)`);
              } else {
                results.push(`[${i}] tap_by_text "${act.text}" — NOT FOUND (${nodes.length} elements scanned)`);
              }
              break;
            }
            case "tap_by_id": {
              const xml = await bridge.uiTree(deviceId);
              const nodes = parseUiTree(xml, display.width, display.height);
              const target = nodes.find((n) => n.resourceId.includes(act.id));
              if (target) {
                const nX = Math.round((target.centerX / 100) * display.width);
                const nY = Math.round((target.centerY / 100) * display.height);
                await bridge.tap({ x: nX, y: nY, deviceId });
                results.push(`[${i}] tap_by_id "${act.id}" → (${target.centerX}%, ${target.centerY}%)`);
              } else {
                results.push(`[${i}] tap_by_id "${act.id}" — NOT FOUND`);
              }
              break;
            }
            case "tap_by_desc": {
              const xml = await bridge.uiTree(deviceId);
              const nodes = parseUiTree(xml, display.width, display.height);
              const search = act.desc.toLowerCase();
              const target = nodes.find((n) => n.contentDesc.toLowerCase().includes(search));
              if (target) {
                const nX = Math.round((target.centerX / 100) * display.width);
                const nY = Math.round((target.centerY / 100) * display.height);
                await bridge.tap({ x: nX, y: nY, deviceId });
                results.push(`[${i}] tap_by_desc "${act.desc}" → (${target.centerX}%, ${target.centerY}%)`);
              } else {
                results.push(`[${i}] tap_by_desc "${act.desc}" — NOT FOUND`);
              }
              break;
            }
            case "run_app": {
              await bridge.runApp({ packageName: act.packageName, deviceId });
              results.push(`[${i}] run_app ${act.packageName}`);
              break;
            }
            case "deep_link": {
              const resolved = resolveDeepLink(act.uri) ?? act.uri;
              await bridge.deepLink(resolved, deviceId);
              results.push(`[${i}] deep_link ${resolved}`);
              break;
            }
            case "assert_text": {
              // Check if text is visible on screen using UI tree
              const xml = await bridge.uiTree(deviceId);
              const found = xml.toLowerCase().includes(act.text.toLowerCase());
              if (found) {
                results.push(`[${i}] assert_text "${act.text}" ✓ PASS`);
              } else {
                results.push(`[${i}] assert_text "${act.text}" ✗ FAIL — text not found on screen`);
                // Stop batch and report — allows AI to take over
                content.unshift({
                  type: "text" as const,
                  text: `Batch STOPPED at step ${i}: assert_text failed — "${act.text}" not found on screen. The AI should inspect the screen and decide how to proceed.`,
                });
                return { content };
              }
              break;
            }
            case "wait_for_text": {
              const timeout = act.timeoutMs ?? 10000;
              const searchText = act.text.toLowerCase();
              const start = Date.now();
              let found = false;
              while (Date.now() - start < timeout) {
                const xml = await bridge.uiTree(deviceId);
                if (xml.toLowerCase().includes(searchText)) {
                  found = true;
                  break;
                }
                await new Promise((r) => setTimeout(r, 500));
              }
              if (found) {
                results.push(`[${i}] wait_for_text "${act.text}" found in ${Date.now() - start}ms`);
              } else {
                results.push(`[${i}] wait_for_text "${act.text}" TIMEOUT after ${timeout}ms`);
              }
              break;
            }
          }
        }

        content.unshift({
          type: "text" as const,
          text: `Batch completed: ${actions.length} actions\n${results.join("\n")}${uiTreeText}`,
        });

        return { content };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Batch failed at step: ${msg}\nCompleted: ${results.join("\n")}` }],
        };
      }
    },
  );
}
