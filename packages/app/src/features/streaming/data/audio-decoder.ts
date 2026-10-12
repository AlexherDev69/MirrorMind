import { createLogger } from "../../../core/logger";
import { base64ToUint8Array } from "./video-decoder";

const logger = createLogger("AudioDecoder");

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const MAX_LAG_SECONDS = 0.1; // drop frames older than 100ms behind playback head
// Upper bound on audio queued ahead of the playback head. Packets arrive in
// bursts (notably the backlog captured while the sockets connect); queueing
// them all back to back would turn that burst into permanent latency.
const MAX_QUEUED_SECONDS = 0.08;

interface AudioFramePayload {
  readonly pts: number;
  readonly isConfig: boolean;
  readonly isKey: boolean;
  readonly dataBase64: string;
}

/**
 * Decodes Opus audio packets coming from scrcpy and plays them through the
 * WebAudio graph with minimal latency. Uses WebCodecs AudioDecoder (Chrome/
 * Edge 94+, available in Tauri's WebView2).
 */
export class AudioStreamDecoder {
  private decoder: AudioDecoder | null = null;
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private nextStartTime = 0;
  private configured = false;
  private muted = false;
  private volume = 1;

  start(): void {
    if (this.context) return;

    this.context = new AudioContext({
      latencyHint: "interactive",
      sampleRate: SAMPLE_RATE,
    });
    this.gainNode = this.context.createGain();
    this.applyGain();
    this.gainNode.connect(this.context.destination);

    this.decoder = new AudioDecoder({
      output: (audioData) => this.playAudioData(audioData),
      error: (error) => logger.error(`Audio decoder error: ${error.message}`),
    });

    try {
      this.decoder.configure({
        codec: "opus",
        sampleRate: SAMPLE_RATE,
        numberOfChannels: CHANNELS,
      });
      this.configured = true;
      this.nextStartTime = this.context.currentTime;
      logger.info("Audio decoder configured (opus 48kHz stereo)");
    } catch (error) {
      logger.error("Failed to configure audio decoder", error);
    }

    // A context created outside a user gesture can start suspended. Not
    // awaited: packets must not be dropped while the context resumes.
    if (this.context.state === "suspended") {
      this.context.resume().catch((error: unknown) => {
        logger.error("Failed to resume audio context", error);
      });
    }
  }

  decodeFrame(payload: AudioFramePayload): void {
    if (!this.decoder || !this.configured) return;
    if (payload.isConfig) {
      // Opus config is handled via configure(); data payload not needed here.
      return;
    }

    const bytes = base64ToUint8Array(payload.dataBase64);
    try {
      const chunk = new EncodedAudioChunk({
        // scrcpy never sets the key flag on Opus packets, yet every Opus
        // packet decodes on its own, and the decoder rejects delta chunks
        // until it has seen a key one.
        type: "key",
        timestamp: payload.pts,
        data: bytes,
      });
      this.decoder.decode(chunk);
    } catch (error) {
      logger.error("Failed to decode audio frame", error);
    }
  }

  private playAudioData(audioData: AudioData): void {
    const ctx = this.context;
    const gain = this.gainNode;
    if (!ctx || !gain) {
      audioData.close();
      return;
    }

    if (this.nextStartTime - ctx.currentTime > MAX_QUEUED_SECONDS) {
      audioData.close();
      return;
    }

    const frames = audioData.numberOfFrames;
    const channels = audioData.numberOfChannels;
    const buffer = ctx.createBuffer(channels, frames, audioData.sampleRate);

    for (let c = 0; c < channels; c++) {
      const channelData = new Float32Array(frames);
      audioData.copyTo(channelData, { planeIndex: c, format: "f32-planar" });
      buffer.copyToChannel(channelData, c);
    }
    audioData.close();

    // Drop late frames to prevent build-up and keep latency low.
    const now = ctx.currentTime;
    if (this.nextStartTime < now - MAX_LAG_SECONDS) {
      this.nextStartTime = now;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    const startAt = Math.max(this.nextStartTime, now);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  /** Sets the playback volume, from 0 (silent) to 1 (full). */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyGain();
  }

  private applyGain(): void {
    if (this.gainNode) {
      this.gainNode.gain.value = this.muted ? 0 : this.volume;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.decoder && this.decoder.state !== "closed") {
        this.decoder.close();
      }
    } catch {
      // ignore close errors
    }
    this.decoder = null;
    this.configured = false;

    if (this.context && this.context.state !== "closed") {
      try {
        await this.context.close();
      } catch {
        // ignore close errors
      }
    }
    this.context = null;
    this.gainNode = null;
    this.nextStartTime = 0;
  }
}
