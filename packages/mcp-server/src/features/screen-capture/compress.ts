import sharp from "sharp";
import { logger } from "../../core/logger.js";

const MAX_WIDTH = 720;
const JPEG_QUALITY = 75;

/**
 * Compress a base64 PNG screenshot to a smaller JPEG for sending to Claude.
 * Reduces ~4MB PNG to ~200KB JPEG while keeping enough quality for vision.
 */
export async function compressForClaude(
  base64Png: string,
  width: number,
  height: number,
): Promise<{ base64: string; mimeType: "image/jpeg" }> {
  const buffer = Buffer.from(base64Png, "base64");

  if (width <= MAX_WIDTH) {
    const jpeg = await sharp(buffer).jpeg({ quality: JPEG_QUALITY }).toBuffer();
    return { base64: jpeg.toString("base64"), mimeType: "image/jpeg" };
  }

  const ratio = MAX_WIDTH / width;
  const newHeight = Math.round(height * ratio);

  const jpeg = await sharp(buffer)
    .resize(MAX_WIDTH, newHeight, { fit: "inside" })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  logger.info(`Compressed: ${width}x${height} → ${MAX_WIDTH}x${newHeight} (${(jpeg.length / 1024).toFixed(0)}KB)`);

  return { base64: jpeg.toString("base64"), mimeType: "image/jpeg" };
}
