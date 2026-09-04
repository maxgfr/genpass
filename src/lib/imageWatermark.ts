import { mimeFor, type OutputFormat } from './fileKind'
import { fontSizeFor, watermarkPlacements, type WatermarkConfig } from './watermark'

/**
 * Canvas renderer. Browser only.
 *
 * `drawWatermark` is what the live preview calls, and it is also what produces
 * the downloaded image — the same function on the same geometry, so the
 * preview is the output rather than an impression of it.
 */

/**
 * Helvetica first, because a PDF written by this app uses Helvetica: a user
 * switching a file's output format between image and PDF should not watch the
 * watermark change shape.
 */
const FONT_STACK = 'Helvetica, Arial, sans-serif'

/**
 * The text box handed to the geometry is `measureText().width × fontSize`.
 * Using the em size as the height (rather than canvas's ascent/descent, which
 * pdf-lib has no equivalent of) is the one convention both renderers share, so
 * both lay out identical grids.
 */
export function measureWatermarkText(
  ctx: CanvasRenderingContext2D,
  cfg: WatermarkConfig,
  width: number,
  height: number,
): { fontSize: number; width: number; height: number } {
  const fontSize = fontSizeFor(cfg, width, height)
  ctx.font = `bold ${fontSize}px ${FONT_STACK}`
  return { fontSize, width: ctx.measureText(cfg.text).width, height: fontSize }
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  cfg: WatermarkConfig,
  width: number,
  height: number,
): void {
  if (!cfg.text.trim()) return

  ctx.save()
  const text = measureWatermarkText(ctx, cfg, width, height)
  const placements = watermarkPlacements(cfg, { width, height }, text)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = Math.min(1, Math.max(0, cfg.opacity))
  ctx.fillStyle = cfg.color
  const radians = (cfg.angleDeg * Math.PI) / 180

  for (const placement of placements) {
    ctx.save()
    ctx.translate(placement.x * width, placement.y * height)
    ctx.rotate(radians)
    ctx.fillText(cfg.text, 0, 0)
    ctx.restore()
  }
  ctx.restore()
}

/**
 * Browsers cap canvas area, and past the cap Safari quietly hands back a blank
 * canvas instead of throwing. Refusing loudly beats writing a blank file.
 */
export const MAX_CANVAS_PIXELS = 64_000_000
export const MAX_CANVAS_EDGE = 16_384

export class ImageTooLargeError extends Error {
  readonly width: number
  readonly height: number

  constructor(width: number, height: number) {
    super(`Image is ${width} × ${height} pixels, beyond what the browser can process.`)
    this.name = 'ImageTooLargeError'
    this.width = width
    this.height = height
  }
}

export class EncodeError extends Error {
  constructor(message = 'The browser could not encode this image.') {
    super(message)
    this.name = 'EncodeError'
  }
}

/** JPEG/WebP quality. High enough that re-encoding a photo is not visible. */
export const IMAGE_QUALITY = 0.92

function encode(canvas: HTMLCanvasElement, format: OutputFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new EncodeError())),
      mimeFor(format),
      IMAGE_QUALITY,
    )
  })
}

/**
 * Draw the bitmap, stamp the watermark, hand back the encoded image.
 *
 * The result's `type` is worth reading rather than assuming: `toBlob` falls
 * back to PNG when the browser cannot encode the requested format (Safari and
 * WebP, historically), and a file named `.webp` holding PNG bytes is a bug
 * report waiting to happen.
 */
export async function watermarkImage(
  bitmap: ImageBitmap,
  cfg: WatermarkConfig,
  out: Exclude<OutputFormat, 'pdf'>,
): Promise<Blob> {
  const { width, height } = bitmap
  if (width * height > MAX_CANVAS_PIXELS || Math.max(width, height) > MAX_CANVAS_EDGE) {
    throw new ImageTooLargeError(width, height)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new EncodeError('This browser did not provide a 2D canvas context.')

  // JPEG has no alpha: without this a transparent PNG comes out on black.
  if (out === 'jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0)
  drawWatermark(ctx, cfg, width, height)

  try {
    return await encode(canvas, out)
  } finally {
    // Drop the backing store now rather than waiting for GC — a batch of 12 MP
    // photos is otherwise several hundred megabytes of live canvases.
    canvas.width = 1
    canvas.height = 1
  }
}

/**
 * Decode a file to a bitmap.
 *
 * `createImageBitmap` and not `<img src={URL.createObjectURL(…)}>`: the app's
 * CSP is `img-src 'self' data:`, which blocks a blob: URL in an <img> outright.
 */
export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file)
}
