import { useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { H264Decoder } from "../../data/video-decoder";
import { mapCanvasToDevice } from "../../../input-control/data/coordinate-mapper";
import { mapKeyToAndroid } from "../../../input-control/data/keyboard-mapper";
import { useSettingsStore } from "../../../settings/presentation/stores/settings.store";
import { useRecorderStore } from "../../../action-recorder/presentation/stores/recorder.store";
import { showToast } from "../../../../core/components/Toast";
import { createLogger } from "../../../../core/logger";

const logger = createLogger("VideoCanvas");

interface VideoFramePayload {
  readonly pts: number;
  readonly size: number;
  readonly data: string;
  readonly isConfig: boolean;
  readonly isKeyFrame: boolean;
}

const ACTION_DOWN = 0;
const ACTION_UP = 1;
const ACTION_MOVE = 2;

export function VideoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const decoderRef = useRef<H264Decoder | null>(null);
  const isDraggingRef = useRef(false);

  const renderFrame = useCallback((frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      frame.close();
      return;
    }

    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
      logger.debug(`Canvas resized to ${frame.displayWidth}x${frame.displayHeight}`);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      frame.close();
      return;
    }

    ctx.drawImage(frame, 0, 0);
    frame.close();
  }, []);

  // Setup decoder and frame listener
  useEffect(() => {
    const decoder = new H264Decoder(renderFrame);
    decoder.init();
    decoderRef.current = decoder;

    const unlisten = listen<VideoFramePayload>("video-frame", (event) => {
      decoder.decodeFrame(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
      decoder.destroy();
      decoderRef.current = null;
    };
  }, [renderFrame]);

  // Native mouse/touch event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getDeviceCoords = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) return null;

      // Use canvas.width/height as device dimensions (set by WebCodecs frames)
      const deviceSize = { width: canvas.width, height: canvas.height };
      return mapCanvasToDevice(clientX, clientY, canvas, deviceSize);
    };

    const toPercent = (coords: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
      return {
        x: (coords.x / canvas.width) * 100,
        y: (coords.y / canvas.height) * 100,
      };
    };

    const sendTouch = (action: number, clientX: number, clientY: number) => {
      const coords = getDeviceCoords(clientX, clientY);
      if (!coords) return;

      invoke("inject_touch", { action, x: coords.x, y: coords.y }).catch((err) => {
        logger.error(`Touch failed: ${err}`);
      });

      // Record action
      const pct = toPercent(coords);
      if (pct) {
        const rec = useRecorderStore.getState();
        if (rec.isRecording) {
          if (action === ACTION_DOWN) rec.beginSwipe(pct.x, pct.y);
          else if (action === ACTION_MOVE) rec.updateSwipe(pct.x, pct.y);
          else if (action === ACTION_UP) rec.endSwipe(pct.x, pct.y);
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      sendTouch(ACTION_DOWN, e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      sendTouch(ACTION_MOVE, e.clientX, e.clientY);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      sendTouch(ACTION_UP, e.clientX, e.clientY);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const coords = getDeviceCoords(e.clientX, e.clientY);
      if (!coords) return;

      const sensitivity = useSettingsStore.getState().settings.scrollSensitivity;
      const scrollV: number = e.deltaY > 0 ? -sensitivity : sensitivity;
      const scrollH: number = e.deltaX > 0 ? -sensitivity : e.deltaX < 0 ? sensitivity : 0;

      invoke("inject_scroll", { x: coords.x, y: coords.y, scrollV, scrollH }).catch((err) => {
        logger.error(`Scroll failed: ${err}`);
      });

      // Record scroll
      const pct = toPercent(coords);
      if (pct) {
        const rec = useRecorderStore.getState();
        if (rec.isRecording) {
          rec.addAction("scroll", { x: pct.x, y: pct.y, scrollV, scrollH });
        }
      }
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseup", onMouseUp);
    container.addEventListener("mouseleave", onMouseUp);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("contextmenu", (e) => e.preventDefault());

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("mouseleave", onMouseUp);
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Keyboard event listeners (global, since canvas can't receive keyboard focus)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in a native input or a modal is open
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (document.querySelector("[data-modal]")) {
        return;
      }

      // Ctrl+V → paste Windows clipboard to phone
      if (e.ctrlKey && e.key === "v") {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (text) {
            invoke("set_phone_clipboard", { text, paste: true })
              .then(() => showToast("Pasted to phone", "success"))
              .catch(() => showToast("Failed to paste to phone", "error"));
          }
        }).catch(() => showToast("Cannot read clipboard", "error"));
        return;
      }

      // Ctrl+C → copy phone clipboard to Windows
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        invoke("inject_keycode", { keycode: 31, metaState: 4096 })
          .then(() => {
            setTimeout(() => {
              invoke<string>("get_phone_clipboard")
                .then((text) => {
                  if (text) {
                    navigator.clipboard.writeText(text)
                      .then(() => showToast("Copied from phone", "success"))
                      .catch(() => {});
                  } else {
                    showToast("Phone clipboard is empty", "info");
                  }
                })
                .catch(() => showToast("Failed to read phone clipboard", "error"));
            }, 300);
          })
          .catch(() => showToast("Failed to send Ctrl+C", "error"));
        return;
      }

      const mapping = mapKeyToAndroid(e);

      if (mapping) {
        // Special key → send as keycode
        e.preventDefault();
        invoke("inject_keycode", {
          keycode: mapping.keycode,
          metaState: mapping.metaState,
        }).catch((err) => logger.error(`Key failed: ${err}`));
        // Record
        const rec = useRecorderStore.getState();
        if (rec.isRecording) {
          rec.addAction("key", { keycode: mapping.keycode, metaState: mapping.metaState });
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Printable character → send as text
        e.preventDefault();
        invoke("inject_text", { text: e.key }).catch((err) =>
          logger.error(`Text failed: ${err}`),
        );
        // Record
        const rec = useRecorderStore.getState();
        if (rec.isRecording) {
          rec.addAction("type", { text: e.key });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center cursor-pointer"
    >
      <canvas
        ref={canvasRef}
        className="max-h-full max-w-full object-contain"
        style={{ imageRendering: "auto" }}
      />
    </div>
  );
}
