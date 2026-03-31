import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TauriBridgeClient } from "../../tauri-bridge/index.js";
import { logger } from "../../core/logger.js";

interface MacroAction {
  readonly timestamp: number;
  readonly type: string;
  readonly params: Record<string, unknown>;
}

interface MacroSession {
  readonly name: string;
  readonly actions: MacroAction[];
}

export function registerListMacrosTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_list_macros",
    "List all saved macros (recorded action sequences). Returns macro names, descriptions, action counts and durations.",
    {},
    async () => {
      logger.info("Listing macros");

      try {
        const macros = await bridge.listMacros();

        if (macros.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No macros saved yet." }],
          };
        }

        const lines = macros.map((m) => {
          const duration = m.duration < 60000
            ? `${Math.round(m.duration / 1000)}s`
            : `${Math.floor(m.duration / 60000)}m${Math.round((m.duration % 60000) / 1000)}s`;
          return `- **${m.name}** (${m.actionCount} actions, ${duration})${m.description ? ` — ${m.description}` : ""}`;
        });

        return {
          content: [{
            type: "text" as const,
            text: `${macros.length} macros:\n${lines.join("\n")}\n\nUse phone_replay_macro to replay one.`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `List macros failed: ${msg}` }],
        };
      }
    },
  );
}

export function registerReplayMacroTool(
  server: McpServer,
  bridge: TauriBridgeClient,
): void {
  server.tool(
    "phone_replay_macro",
    "Replay a saved macro by name. Executes all recorded actions (taps, swipes, text, keys) with original timing.",
    {
      name: z.string().describe("Name of the macro to replay"),
    },
    async ({ name }) => {
      logger.info(`Replaying macro: ${name}`);

      try {
        const json = await bridge.loadMacro(name);
        const session: MacroSession = JSON.parse(json);

        if (!session.actions || session.actions.length === 0) {
          return {
            content: [{ type: "text" as const, text: `Macro "${name}" has no actions.` }],
          };
        }

        // Convert macro actions to batch format
        const batchActions: Array<Record<string, unknown>> = [];
        const display = await bridge.displaySize();

        for (let i = 0; i < session.actions.length; i++) {
          const act = session.actions[i]!;

          // Insert wait between actions
          if (i > 0) {
            const prev = session.actions[i - 1]!;
            const delay = act.timestamp - prev.timestamp;
            if (delay > 100) {
              batchActions.push({ action: "wait", ms: delay });
            }
          }

          switch (act.type) {
            case "tap": {
              const p = act.params as { x: number; y: number };
              const nX = Math.round((p.x / 100) * display.width);
              const nY = Math.round((p.y / 100) * display.height);
              await bridge.tap({ x: nX, y: nY });
              break;
            }
            case "swipe": {
              const p = act.params as { startX: number; startY: number; endX: number; endY: number; durationMs: number };
              const sx = Math.round((p.startX / 100) * display.width);
              const sy = Math.round((p.startY / 100) * display.height);
              const ex = Math.round((p.endX / 100) * display.width);
              const ey = Math.round((p.endY / 100) * display.height);
              await bridge.swipe({ startX: sx, startY: sy, endX: ex, endY: ey, durationMs: p.durationMs });
              break;
            }
            case "type": {
              const p = act.params as { text: string };
              await bridge.typeText({ text: p.text });
              break;
            }
            case "key": {
              const p = act.params as { keycode: number; metaState?: number };
              await bridge.pressKey({ keyCode: p.keycode });
              break;
            }
            case "scroll": {
              // Scroll as swipe approximation
              const p = act.params as { x: number; y: number; scrollV: number };
              const sx = Math.round((p.x / 100) * display.width);
              const sy = Math.round((p.y / 100) * display.height);
              const dist = Math.round(p.scrollV > 0 ? -200 : 200);
              await bridge.swipe({ startX: sx, startY: sy, endX: sx, endY: sy + dist, durationMs: 200 });
              break;
            }
          }

          // Wait between actions (timing from recording)
          if (i < session.actions.length - 1) {
            const next = session.actions[i + 1]!;
            const delay = next.timestamp - act.timestamp;
            if (delay > 100) {
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: `Macro "${name}" replayed: ${session.actions.length} actions executed.`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Replay failed: ${msg}` }],
        };
      }
    },
  );
}
