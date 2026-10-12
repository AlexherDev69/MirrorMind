import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { AudioStreamDecoder } from "../../features/streaming/data/audio-decoder";
import { useAudioStore } from "../../features/streaming/presentation/stores/audio.store";
import { useSettingsStore } from "../../features/settings/presentation/stores/settings.store";
import { AUDIO_VOLUME_MAX } from "../../features/settings/domain/settings.types";
import { createLogger } from "../logger";

const logger = createLogger("AudioStream");

const currentVolume = (): number =>
  useSettingsStore.getState().settings.audioVolume / AUDIO_VOLUME_MAX;

interface AudioFrameEvent {
  readonly pts: number;
  readonly isConfig: boolean;
  readonly isKey: boolean;
  readonly data: string;
}

interface AudioInfoEvent {
  readonly codec: string;
}

/**
 * Listens for audio-* Tauri events emitted by the scrcpy Rust backend and
 * routes them through an AudioStreamDecoder. Mute state is kept in sync with
 * the audio store.
 */
export function useAudioStream(): void {
  const decoderRef = useRef<AudioStreamDecoder | null>(null);

  useEffect(() => {
    const unlistenInfo = listen<AudioInfoEvent>("audio-info", (event) => {
      logger.info(`Audio stream started (codec=${event.payload.codec})`);
      useAudioStore.getState().setAudioAvailable();

      if (!decoderRef.current) {
        const dec = new AudioStreamDecoder();
        dec.setMuted(useAudioStore.getState().audioMuted);
        dec.setVolume(currentVolume());
        dec.start();
        decoderRef.current = dec;
      }
    });

    const unlistenUnavailable = listen<string>("audio-unavailable", (event) => {
      logger.warn(`Audio unavailable: ${event.payload}`);
      useAudioStore.getState().setAudioUnavailable(event.payload);
    });

    const unlistenFrame = listen<AudioFrameEvent>("audio-frame", (event) => {
      const dec = decoderRef.current;
      if (!dec) return;
      dec.decodeFrame({
        pts: event.payload.pts,
        isConfig: event.payload.isConfig,
        isKey: event.payload.isKey,
        dataBase64: event.payload.data,
      });
    });

    const unlistenStatus = listen<string>("audio-status", async (event) => {
      if (event.payload === "stopped") {
        const dec = decoderRef.current;
        decoderRef.current = null;
        if (dec) await dec.stop();
      }
    });

    // Sync mute state with store
    const unsubStore = useAudioStore.subscribe((state) => {
      decoderRef.current?.setMuted(state.audioMuted);
    });

    const unsubSettings = useSettingsStore.subscribe(() => {
      decoderRef.current?.setVolume(currentVolume());
    });

    return () => {
      unsubSettings();
      unlistenInfo.then((fn) => fn());
      unlistenUnavailable.then((fn) => fn());
      unlistenFrame.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
      unsubStore();
      const dec = decoderRef.current;
      decoderRef.current = null;
      if (dec) dec.stop().catch(() => {});
    };
  }, []);
}
