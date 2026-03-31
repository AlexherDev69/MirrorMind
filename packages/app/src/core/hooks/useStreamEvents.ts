import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { createLogger } from "../logger";
import { useSettingsStore } from "../../features/settings/presentation/stores/settings.store";
import type { AppState } from "./useDevicePolling";

const logger = createLogger("Stream");

const HEADER_FOOTER_HEIGHT = 72;
const TARGET_HEIGHT = 850;

interface UseStreamEventsParams {
  readonly appStateRef: React.RefObject<AppState>;
  readonly onStreaming: () => void;
  readonly onDisconnected: () => void;
  readonly onStopped: () => void;
  readonly onError: (message: string) => void;
}

/**
 * Listens for Tauri stream events (status, error, device-name, stream-info)
 * and auto-resizes the window to match the phone screen ratio.
 */
export function useStreamEvents({
  appStateRef,
  onStreaming,
  onDisconnected,
  onStopped,
  onError,
}: UseStreamEventsParams): void {
  useEffect(() => {
    const unlistenStatus = listen<string>("stream-status", (event) => {
      const current = appStateRef.current;
      if (event.payload === "streaming") {
        onStreaming();
      } else if (event.payload === "disconnected") {
        onDisconnected();
      } else if (event.payload === "stopped" && current !== "disconnected") {
        onStopped();
      }
    });

    const unlistenError = listen<string>("stream-error", (event) => {
      onError(event.payload);
    });

    const unlistenDeviceName = listen<string>("device-name", (event) => {
      logger.info(`Connected to: ${event.payload}`);
    });

    const unlistenStreamInfo = listen<{ width: number; height: number }>(
      "stream-info",
      async (event) => {
        const { width, height } = event.payload;
        if (width <= 0 || height <= 0) return;

        // Only auto-resize if no saved window geometry (first launch)
        const { settings } = useSettingsStore.getState();
        if (settings.windowWidth && settings.windowHeight) {
          return; // User has a saved size — don't override
        }

        const phoneRatio = width / height;
        const contentHeight = TARGET_HEIGHT - HEADER_FOOTER_HEIGHT;
        const contentWidth = contentHeight * phoneRatio;
        const windowWidth = Math.round(Math.max(contentWidth + 2, 320));

        try {
          const window = getCurrentWindow();
          await window.setSize(new LogicalSize(windowWidth, TARGET_HEIGHT));
        } catch {
          // Silently ignore resize errors
        }
      },
    );

    return () => {
      unlistenStatus.then((fn) => fn());
      unlistenError.then((fn) => fn());
      unlistenDeviceName.then((fn) => fn());
      unlistenStreamInfo.then((fn) => fn());
    };
  }, [appStateRef, onStreaming, onDisconnected, onStopped, onError]);
}
