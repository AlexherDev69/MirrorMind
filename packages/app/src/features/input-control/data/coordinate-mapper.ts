interface ScreenDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Maps mouse coordinates on the canvas element to device screen coordinates.
 * The canvas displays the phone screen with object-fit: contain,
 * so we need to account for letterboxing/pillarboxing.
 */
export function mapCanvasToDevice(
  mouseX: number,
  mouseY: number,
  canvas: HTMLCanvasElement,
  device: ScreenDimensions,
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();

  // Canvas display size (CSS pixels)
  const displayWidth = rect.width;
  const displayHeight = rect.height;

  // Device aspect ratio
  const deviceAspect = device.width / device.height;
  const displayAspect = displayWidth / displayHeight;

  // Calculate the actual rendered area within the canvas element
  let renderWidth: number;
  let renderHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (deviceAspect > displayAspect) {
    // Device is wider than display → pillarboxing (bars top/bottom)
    renderWidth = displayWidth;
    renderHeight = displayWidth / deviceAspect;
    offsetX = 0;
    offsetY = (displayHeight - renderHeight) / 2;
  } else {
    // Device is taller than display → letterboxing (bars left/right)
    renderHeight = displayHeight;
    renderWidth = displayHeight * deviceAspect;
    offsetX = (displayWidth - renderWidth) / 2;
    offsetY = 0;
  }

  // Mouse position relative to the canvas element
  const relX = mouseX - rect.left;
  const relY = mouseY - rect.top;

  // Check if click is within the rendered area
  if (
    relX < offsetX ||
    relX > offsetX + renderWidth ||
    relY < offsetY ||
    relY > offsetY + renderHeight
  ) {
    return null; // Click outside the rendered phone screen
  }

  // Map to device coordinates
  const x = ((relX - offsetX) / renderWidth) * device.width;
  const y = ((relY - offsetY) / renderHeight) * device.height;

  return {
    x: Math.round(Math.max(0, Math.min(x, device.width - 1))),
    y: Math.round(Math.max(0, Math.min(y, device.height - 1))),
  };
}
