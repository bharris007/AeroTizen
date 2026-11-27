import { expect, test, vi } from "vitest";

import {
  boundedRadarCanvasSize,
  compositeRadarTiles,
  createRadarScratchBuffers,
  MAX_RADAR_CANVAS_HEIGHT,
  MAX_RADAR_CANVAS_WIDTH,
  releaseRadarCanvas,
  releaseRadarScratchBuffers,
} from "./radarCompositor";

interface FakeCanvasContext {
  readonly clearRect: ReturnType<typeof vi.fn>;
  readonly drawImage: ReturnType<typeof vi.fn>;
  globalAlpha: number;
  imageSmoothingEnabled: boolean;
}

const createFakeCanvas = ({
  failContext = false,
  throwOnDraw = false,
}: {
  failContext?: boolean;
  throwOnDraw?: boolean;
} = {}) => {
  const ctx: FakeCanvasContext = {
    clearRect: vi.fn(),
    drawImage: vi.fn(() => {
      if (throwOnDraw) {
        throw new Error("tainted canvas");
      }
    }),
    globalAlpha: 1,
    imageSmoothingEnabled: false,
  };
  const canvas = {
    ctx,
    getContext: vi.fn(() => (failContext ? null : ctx)),
    height: 0,
    setAttribute(name: string, value: string) {
      if (name === "width") {
        this.width = Number(value);
      }
      if (name === "height") {
        this.height = Number(value);
      }
    },
    width: 0,
  };
  return canvas;
};

test("caps 1080p and 4K radar canvases to TV-safe dimensions while preserving aspect ratio", () => {
  expect(boundedRadarCanvasSize(0, 600)).toEqual({ height: 0, scale: 0, width: 0 });
  expect(boundedRadarCanvasSize(800, 500)).toEqual({ height: 500, scale: 1, width: 800 });

  const hd = boundedRadarCanvasSize(1920, 1080);
  expect(hd).toEqual({ height: MAX_RADAR_CANVAS_HEIGHT, scale: 0.5, width: MAX_RADAR_CANVAS_WIDTH });

  const uhd = boundedRadarCanvasSize(3840, 2160);
  expect(uhd).toEqual({ height: MAX_RADAR_CANVAS_HEIGHT, scale: 0.25, width: MAX_RADAR_CANVAS_WIDTH });
});

test("composites tiles through two soft bilinear passes and releases canvases to 0x0", () => {
  const created: ReturnType<typeof createFakeCanvas>[] = [];
  const createCanvas = () => {
    const next = createFakeCanvas();
    created.push(next);
    return next as unknown as HTMLCanvasElement;
  };
  const scratch = createRadarScratchBuffers(createCanvas);
  const output = compositeRadarTiles({
    createCanvas,
    height: 540,
    scale: 0.5,
    scratch,
    source: "rainviewer",
    tiles: [
      {
        image: {} as HTMLImageElement,
        tile: { left: 10, size: 256, top: 20, x: 32, y: 50 },
      },
      {
        image: {} as HTMLImageElement,
        tile: { left: 266, size: 256, top: 20, x: 33, y: 50 },
      },
    ],
    width: 960,
  });

  expect(output).not.toBeNull();
  const outFake = output as unknown as ReturnType<typeof createFakeCanvas>;
  expect(outFake.width).toBe(960);
  expect(outFake.height).toBe(540);
  // Raw pass stitches both tiles; output blends glow + soft body passes.
  expect((scratch.raw as unknown as ReturnType<typeof createFakeCanvas>).ctx.drawImage).toHaveBeenCalledTimes(2);
  expect(outFake.ctx.drawImage).toHaveBeenCalledTimes(2);
  expect(outFake.ctx.globalAlpha).toBe(1);

  releaseRadarCanvas(output);
  releaseRadarScratchBuffers(scratch);
  expect(outFake.width).toBe(0);
  expect(outFake.height).toBe(0);
  expect(scratch.raw.width).toBe(0);
  expect(scratch.glow.width).toBe(0);
  expect(scratch.soft.width).toBe(0);
});

test("refines warm khaki RainViewer drizzle into translucent cool sky-blue while preserving heavy cells", () => {
  // 2 pixels: pixel 0 = khaki drizzle (160, 148, 112, 220); pixel 1 = heavy orange-red (242, 64, 0, 255).
  const data = new Uint8ClampedArray([160, 148, 112, 220, 242, 64, 0, 255]);
  const putImageData = vi.fn();
  const makeCtx = () => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data, height: 1, width: 2 })),
    globalAlpha: 1,
    imageSmoothingEnabled: false,
    putImageData,
  });
  const createCanvas = () => {
    const ctx = makeCtx();
    const canvas = {
      getContext: () => ctx,
      height: 0,
      setAttribute(name: string, value: string) {
        if (name === "width") {
          canvas.width = Number(value);
        }
        if (name === "height") {
          canvas.height = Number(value);
        }
      },
      width: 0,
    };
    return canvas as unknown as HTMLCanvasElement;
  };
  const scratch = createRadarScratchBuffers(createCanvas);
  const output = compositeRadarTiles({
    createCanvas,
    height: 100,
    scale: 1,
    scratch,
    source: "rainviewer",
    tiles: [{ image: {} as HTMLImageElement, tile: { left: 0, size: 100, top: 0, x: 1, y: 1 } }],
    width: 100,
  });
  expect(output).not.toBeNull();
  expect(putImageData).toHaveBeenCalledTimes(1);
  // Pixel 0 shifted to cool luminous blue (B > G > R) with softer alpha.
  expect(data[2]).toBeGreaterThan(data[1]);
  expect(data[1]).toBeGreaterThan(data[0]);
  expect(data[3]).toBeLessThan(220);
  // Pixel 1 (heavy orange-red rain) preserved verbatim.
  expect([data[4], data[5], data[6], data[7]]).toEqual([242, 64, 0, 255]);
});

test("returns null and frees output when 2D context is missing or drawImage throws", () => {
  const missingCtxScratch = createRadarScratchBuffers(
    () => createFakeCanvas({ failContext: true }) as unknown as HTMLCanvasElement,
  );
  const noCtx = compositeRadarTiles({
    createCanvas: () => createFakeCanvas({ failContext: true }) as unknown as HTMLCanvasElement,
    height: 300,
    scale: 1,
    scratch: missingCtxScratch,
    source: "nexrad",
    tiles: [{ image: {} as HTMLImageElement, tile: { left: 0, size: 256, top: 0, x: 1, y: 2 } }],
    width: 400,
  });
  expect(noCtx).toBeNull();

  const outputs: ReturnType<typeof createFakeCanvas>[] = [];
  const throwingScratch = createRadarScratchBuffers(
    () => createFakeCanvas({ throwOnDraw: true }) as unknown as HTMLCanvasElement,
  );
  const failed = compositeRadarTiles({
    createCanvas: () => {
      const next = createFakeCanvas();
      outputs.push(next);
      return next as unknown as HTMLCanvasElement;
    },
    height: 300,
    scale: 1,
    scratch: throwingScratch,
    source: "rainviewer",
    tiles: [{ image: {} as HTMLImageElement, tile: { left: 0, size: 256, top: 0, x: 1, y: 2 } }],
    width: 400,
  });
  expect(failed).toBeNull();
  expect(outputs[0]?.width).toBe(0);
  expect(outputs[0]?.height).toBe(0);
});
