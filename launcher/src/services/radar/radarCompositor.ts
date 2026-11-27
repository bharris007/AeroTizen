import type { RadarTile } from "./rainViewer";

// Cap radar composite canvases so a 4K TV panel stays well under GPU/RAM budgets (~2 MB/frame).
export const MAX_RADAR_CANVAS_WIDTH = 960;
export const MAX_RADAR_CANVAS_HEIGHT = 540;
export const MAX_CACHED_RADAR_FRAMES = 16;

export type RadarCompositeSource = "nexrad" | "rainviewer";

export interface BoundedRadarCanvasSize {
  readonly height: number;
  readonly scale: number;
  readonly width: number;
}

export interface RadarDrawableTile {
  readonly image: HTMLImageElement;
  readonly tile: RadarTile;
}

export interface RadarScratchBuffers {
  readonly glow: HTMLCanvasElement;
  readonly raw: HTMLCanvasElement;
  readonly soft: HTMLCanvasElement;
}

interface SoftBlendProfile {
  readonly bodyAlpha: number;
  readonly bodyScale: number;
  readonly glowAlpha: number;
  readonly glowScale: number;
}

// Two-pass bilinear softening removes tile seams and radar grain, giving Apple Weather-style
// luminous precipitation clouds with zero per-frame CSS filter overhead on Tizen TVs.
const BLEND_PROFILES: Readonly<Record<RadarCompositeSource, SoftBlendProfile>> = {
  nexrad: { bodyAlpha: 0.82, bodyScale: 0.54, glowAlpha: 0.48, glowScale: 0.32 },
  rainviewer: { bodyAlpha: 0.88, bodyScale: 0.72, glowAlpha: 0.52, glowScale: 0.36 },
};

// RainViewer scheme 2 renders very light drizzle as warm khaki-gray (#606060..#e0d090).
// Convert only those low-saturation warm-neutral mist pixels into translucent Apple Weather
// ice-blue while leaving vivid rain, snow, yellow, orange, red, and pink untouched.
const refineRainViewerDrizzle = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  if (typeof ctx.getImageData !== "function" || typeof ctx.putImageData !== "function") {
    return;
  }
  try {
    const frame = ctx.getImageData(0, 0, width, height);
    const pixels = frame.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha < 6) {
        continue;
      }
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      // Warm neutral khaki-beige drizzle: R >= G >= B, moderate chroma, blue not near zero (unlike yellow/red).
      if (b >= 64 && r >= b - 4 && g >= b - 4 && r - b <= 118 && Math.abs(r - g) <= 38) {
        const luma = (r * 3 + g * 4 + b) / 8;
        const t = Math.max(0, Math.min(1, (luma - 76) / 145));
        pixels[i] = Math.round(72 + 52 * t);
        pixels[i + 1] = Math.round(174 + 54 * t);
        pixels[i + 2] = Math.round(238 + 17 * t);
        pixels[i + 3] = Math.round(alpha * (0.4 + 0.42 * t));
      }
    }
    ctx.putImageData(frame, 0, 0);
  } catch {
    // Keep original colors if pixel readback is restricted.
  }
};

export const boundedRadarCanvasSize = (width: number, height: number): BoundedRadarCanvasSize => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { height: 0, scale: 0, width: 0 };
  }
  const scale = Math.min(1, MAX_RADAR_CANVAS_WIDTH / width, MAX_RADAR_CANVAS_HEIGHT / height);
  return {
    height: Math.max(1, Math.round(height * scale)),
    scale,
    width: Math.max(1, Math.round(width * scale)),
  };
};

export const resizeCanvasElement = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const nextWidth = Math.max(0, Math.round(width));
  const nextHeight = Math.max(0, Math.round(height));
  if (canvas.width !== nextWidth) {
    canvas.setAttribute("width", String(nextWidth));
  }
  if (canvas.height !== nextHeight) {
    canvas.setAttribute("height", String(nextHeight));
  }
};

export const releaseRadarCanvas = (canvas: HTMLCanvasElement | null | undefined) => {
  if (!canvas) {
    return;
  }
  resizeCanvasElement(canvas, 0, 0);
};

export const createRadarScratchBuffers = (createCanvas: () => HTMLCanvasElement): RadarScratchBuffers => ({
  glow: createCanvas(),
  raw: createCanvas(),
  soft: createCanvas(),
});

export const releaseRadarScratchBuffers = (buffers: RadarScratchBuffers | null | undefined) => {
  if (!buffers) {
    return;
  }
  releaseRadarCanvas(buffers.raw);
  releaseRadarCanvas(buffers.glow);
  releaseRadarCanvas(buffers.soft);
};

export const compositeRadarTiles = ({
  createCanvas,
  height,
  scale,
  scratch,
  source,
  tiles,
  width,
}: {
  createCanvas: () => HTMLCanvasElement;
  height: number;
  scale: number;
  scratch: RadarScratchBuffers;
  source: RadarCompositeSource;
  tiles: readonly RadarDrawableTile[];
  width: number;
}): HTMLCanvasElement | null => {
  if (width <= 0 || height <= 0 || scale <= 0) {
    return null;
  }
  const output = createCanvas();
  resizeCanvasElement(output, width, height);
  const outCtx = output.getContext("2d");
  if (!outCtx) {
    releaseRadarCanvas(output);
    return null;
  }
  if (tiles.length === 0) {
    return output;
  }
  resizeCanvasElement(scratch.raw, width, height);
  const rawCtx = scratch.raw.getContext("2d");
  if (!rawCtx) {
    releaseRadarCanvas(output);
    return null;
  }
  const profile = BLEND_PROFILES[source];
  const glowWidth = Math.max(1, Math.round(width * profile.glowScale));
  const glowHeight = Math.max(1, Math.round(height * profile.glowScale));
  const softWidth = Math.max(1, Math.round(width * profile.bodyScale));
  const softHeight = Math.max(1, Math.round(height * profile.bodyScale));
  resizeCanvasElement(scratch.glow, glowWidth, glowHeight);
  resizeCanvasElement(scratch.soft, softWidth, softHeight);
  const glowCtx = scratch.glow.getContext("2d");
  const softCtx = scratch.soft.getContext("2d");
  if (!glowCtx || !softCtx) {
    releaseRadarCanvas(output);
    return null;
  }
  try {
    rawCtx.clearRect(0, 0, width, height);
    rawCtx.imageSmoothingEnabled = true;
    tiles.forEach(({ image, tile }) => {
      const left = Math.floor(tile.left * scale);
      const top = Math.floor(tile.top * scale);
      const right = Math.ceil((tile.left + tile.size) * scale);
      const bottom = Math.ceil((tile.top + tile.size) * scale);
      const drawWidth = Math.max(1, right - left);
      const drawHeight = Math.max(1, bottom - top);
      rawCtx.drawImage(image, left, top, drawWidth, drawHeight);
    });
    softCtx.clearRect(0, 0, softWidth, softHeight);
    softCtx.imageSmoothingEnabled = true;
    softCtx.drawImage(scratch.raw, 0, 0, softWidth, softHeight);
    if (source === "rainviewer") {
      refineRainViewerDrizzle(softCtx, softWidth, softHeight);
    }

    glowCtx.clearRect(0, 0, glowWidth, glowHeight);
    glowCtx.imageSmoothingEnabled = true;
    glowCtx.drawImage(scratch.soft, 0, 0, glowWidth, glowHeight);

    outCtx.clearRect(0, 0, width, height);
    outCtx.imageSmoothingEnabled = true;
    outCtx.globalAlpha = profile.glowAlpha;
    outCtx.drawImage(scratch.glow, 0, 0, width, height);
    outCtx.globalAlpha = profile.bodyAlpha;
    outCtx.drawImage(scratch.soft, 0, 0, width, height);
    outCtx.globalAlpha = 1;
    return output;
  } catch {
    releaseRadarCanvas(output);
    return null;
  }
};
