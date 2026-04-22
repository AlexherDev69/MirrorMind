import { createLogger } from "../../../core/logger";
import { base64ToUint8Array } from "./video-decoder";

const logger = createLogger("AudioDecoder");

const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const MAX_LAG_SECONDS = 0.1; // drop frames older than 100ms behind playback head

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

  async start(): Promise<void> {
    if (this.context) return;

    this.context = new AudioContext({
      latencyHint: "interactive",
      sampleRate: SAMPLE_RATE,
    });
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = this.muted ? 0 : 1;
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
        type: payload.isKey ? "key" : "delta",
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
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 1;
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
