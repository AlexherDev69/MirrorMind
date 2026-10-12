import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLogcatStore } from "../../features/logcat/presentation/stores/logcat.store";

interface WindowModes {
  readonly isMiniPlayer: boolean;
  readonly isFullscreen: boolean;
  readonly toggleMiniPlayer: () => Promise<void>;
  readonly toggleFullscreen: () => Promise<void>;
}

/**
 * Mini-player and fullscreen state, with the global shortcuts that drive them
 * (F11, Ctrl+Shift+M) and the logcat panel shortcut (Ctrl+L).
 */
export function useWindowModes(): WindowModes {
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleMiniPlayer = useCallback(async () => {
    try {
      if (isMiniPlayer) {
        await invoke("exit_mini_player");
        setIsMiniPlayer(false);
      } else {
        await invoke("enter_mini_player");
        setIsMiniPlayer(true);
      }
    } catch {
      /* ignore */
    }
  }, [isMiniPlayer]);

  const toggleFullscreen = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const current = await win.isFullscreen();
      await win.setFullscreen(!current);
      setIsFullscreen(!current);
    } catch {
      // Fallback: CSS-only
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (document.querySelector("[data-modal]")) return;

      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.ctrlKey && e.shiftKey && e.key === "M") {
        e.preventDefault();
        toggleMiniPlayer();
      } else if (e.ctrlKey && !e.shiftKey && e.key === "l") {
        e.preventDefault();
        useLogcatStore.getState().toggleOpen();
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [toggleFullscreen, toggleMiniPlayer]);

  return { isMiniPlayer, isFullscreen, toggleMiniPlayer, toggleFullscreen };
}
