import { createLogger } from "../../../core/logger";

const logger = createLogger("H264Decoder");

type OnFrameCallback = (frame: VideoFrame) => void;

interface VideoFramePayload {
  readonly pts: number;
  readonly size: number;
  readonly data: string;
  readonly isConfig: boolean;
  readonly isKeyFrame: boolean;
}

export class H264Decoder {
  private decoder: VideoDecoder | null = null;
  private onFrame: OnFrameCallback;
  private frameCount = 0;
  private configReceived = false;

  constructor(onFrame: OnFrameCallback) {
    this.onFrame = onFrame;
  }

  init(): void {
    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        this.frameCount++;
        this.onFrame(frame);
      },
      error: (error: DOMException) => {
        logger.error(`Decoder error: ${error.message}`);
      },
    });
  }

  decodeFrame(payload: VideoFramePayload): void {
    if (!this.decoder) {
      this.init();
    }

    const bytes = base64ToUint8Array(payload.data);

    if (payload.isConfig) {
      // Config packet contains SPS + PPS in Annex B format
      // We need to extract them to build the avcC description for WebCodecs
      this.configureFromSPSPPS(bytes);
      return;
    }

    if (!this.configReceived) {
      // Drop frames until we have config
      return;
    }

    // Convert from Annex B (start codes) to avcC (length-prefixed) format
    const avcCData = annexBToAvcC(bytes);

    try {
      const chunk = new EncodedVideoChunk({
        type: payload.isKeyFrame ? "key" : "delta",
        timestamp: payload.pts,
        data: avcCData,
      });
      this.decoder!.decode(chunk);
    } catch (error) {
      logger.error("Failed to decode frame", error);
    }
  }

  private configureFromSPSPPS(configData: Uint8Array): void {
    if (!this.decoder) return;

    // Parse Annex B NALUs from config data
    const nalus = parseAnnexBNalus(configData);

    let sps: Uint8Array | null = null;
    let pps: Uint8Array | null = null;

    for (const nalu of nalus) {
      const naluType = nalu[0]! & 0x1f;
      if (naluType === 7) sps = nalu; // SPS
      if (naluType === 8) pps = nalu; // PPS
    }

    if (!sps || !pps) {
      logger.error("Config packet missing SPS or PPS");
      return;
    }

    // Build avcC box (ISO 14496-15)
    const avcC = buildAvcC(sps, pps);

    // Extract codec string from SPS
    const profileIdc = sps[1]!;
    const profileCompat = sps[2]!;
    const levelIdc = sps[3]!;
    const codecString = `avc1.${toHex(profileIdc)}${toHex(profileCompat)}${toHex(levelIdc)}`;

    logger.info(`Configuring: ${codecString}, SPS=${sps.length}B, PPS=${pps.length}B`);

    try {
      this.decoder.configure({
        codec: codecString,
        description: avcC,
        optimizeForLatency: true,
      });
      this.configReceived = true;
      logger.info("Decoder configured successfully");
    } catch (error) {
      logger.error("Failed to configure", error);
    }
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  destroy(): void {
    if (this.decoder && this.decoder.state !== "closed") {
      this.decoder.close();
    }
    this.decoder = null;
    this.configReceived = false;
  }
}

/** Parse Annex B byte stream into individual NAL units (without start codes) */
export function parseAnnexBNalus(data: Uint8Array): Uint8Array[] {
  const nalus: Uint8Array[] = [];
  let i = 0;

  while (i < data.length) {
    // Find start code: 0x00 0x00 0x01 or 0x00 0x00 0x00 0x01
    let startCodeLen = 0;
    if (i + 2 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
      startCodeLen = 3;
    } else if (i + 3 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
      startCodeLen = 4;
    } else {
      i++;
      continue;
    }

    const naluStart = i + startCodeLen;

    // Find next start code or end of data
    let naluEnd = data.length;
    for (let j = naluStart + 1; j < data.length - 2; j++) {
      if (data[j] === 0 && data[j + 1] === 0 && (data[j + 2] === 1 || (data[j + 2] === 0 && j + 3 < data.length && data[j + 3] === 1))) {
        naluEnd = j;
        break;
      }
    }

    nalus.push(data.slice(naluStart, naluEnd));
    i = naluEnd;
  }

  return nalus;
}

/** Build an avcC (AVCDecoderConfigurationRecord) from SPS and PPS */
export function buildAvcC(sps: Uint8Array, pps: Uint8Array): Uint8Array {
  // avcC format (ISO 14496-15):
  // - configurationVersion: 1 byte (always 1)
  // - AVCProfileIndication: 1 byte (from SPS)
  // - profile_compatibility: 1 byte (from SPS)
  // - AVCLevelIndication: 1 byte (from SPS)
  // - lengthSizeMinusOne: 1 byte (0xFC | 3 = 0xFF -> 4-byte length)
  // - numOfSequenceParameterSets: 1 byte (0xE0 | 1 = 0xE1)
  // - sequenceParameterSetLength: 2 bytes (big-endian)
  // - sequenceParameterSetNALUnit: N bytes
  // - numOfPictureParameterSets: 1 byte (1)
  // - pictureParameterSetLength: 2 bytes (big-endian)
  // - pictureParameterSetNALUnit: N bytes

  const totalSize = 11 + sps.length + pps.length;
  const buf = new Uint8Array(totalSize);
  let offset = 0;

  buf[offset++] = 1;           // configurationVersion
  buf[offset++] = sps[1]!;     // AVCProfileIndication
  buf[offset++] = sps[2]!;     // profile_compatibility
  buf[offset++] = sps[3]!;     // AVCLevelIndication
  buf[offset++] = 0xff;        // lengthSizeMinusOne (3 -> 4-byte NALU lengths)
  buf[offset++] = 0xe1;        // numOfSequenceParameterSets (1)

  // SPS length (big-endian 16-bit)
  buf[offset++] = (sps.length >> 8) & 0xff;
  buf[offset++] = sps.length & 0xff;
  // SPS data
  buf.set(sps, offset);
  offset += sps.length;

  buf[offset++] = 1;           // numOfPictureParameterSets

  // PPS length (big-endian 16-bit)
  buf[offset++] = (pps.length >> 8) & 0xff;
  buf[offset++] = pps.length & 0xff;
  // PPS data
  buf.set(pps, offset);

  return buf;
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/** Convert Annex B NALUs (start code prefixed) to avcC (4-byte length prefixed) */
export function annexBToAvcC(data: Uint8Array): Uint8Array {
  const nalus = parseAnnexBNalus(data);
  // Calculate total size: 4 bytes length prefix per NALU + NALU data
  let totalSize = 0;
  for (const nalu of nalus) {
    totalSize += 4 + nalu.length;
  }

  const result = new Uint8Array(totalSize);
  let offset = 0;

  for (const nalu of nalus) {
    // Write 4-byte big-endian length
    result[offset++] = (nalu.length >> 24) & 0xff;
    result[offset++] = (nalu.length >> 16) & 0xff;
    result[offset++] = (nalu.length >> 8) & 0xff;
    result[offset++] = nalu.length & 0xff;
    // Write NALU data
    result.set(nalu, offset);
    offset += nalu.length;
  }

  return result;
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
