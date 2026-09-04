/**
 * Watermark geometry — the one place that decides where the text goes.
 *
 * No DOM, no pdf-lib, no rendering. Both renderers (the canvas preview and the
 * pdf-lib writer) call `watermarkPlacements` with extents they measured with
 * their own font machinery, and lay the same stamps down in the same places.
 * That shared call is what keeps the preview honest: it is not an
 * approximation of the output, it is the same layout drawn twice.
 */

export interface WatermarkConfig {
  text: string
  /** 0..1 */
  opacity: number
  /** -90..90, clockwise-positive in screen space (y grows downwards). */
  angleDeg: number
  /** Font size as a fraction of the page's short side, so portrait and
   *  landscape pages get a watermark of the same visual weight. */
  scale: number
  /** '#rrggbb' */
  color: string
  layout: 'tiled' | 'single'
}

export const DEFAULT_WATERMARK: WatermarkConfig = {
  text: 'CONFIDENTIAL',
  opacity: 0.3,
  angleDeg: 45,
  scale: 0.08,
  color: '#ff0000',
  layout: 'tiled',
}

export const OPACITY_RANGE = { min: 0.05, max: 1 } as const
export const ANGLE_RANGE = { min: -90, max: 90 } as const
export const SCALE_RANGE = { min: 0.02, max: 0.4 } as const

/** Gap between tiles, as a fraction of the font size. */
const TILE_GUTTER = 0.6

/** Normalized 0..1 position of the centre of one stamp, y measured downwards. */
export interface Placement {
  x: number
  y: number
}

export interface PageSize {
  width: number
  height: number
}

/** Extents of the unrotated text at `fontSizeFor(...)`, in page units. */
export interface TextExtents {
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Bring a config from the UI (or from storage) inside its documented bounds. */
export function clampConfig(cfg: WatermarkConfig): WatermarkConfig {
  return {
    ...cfg,
    opacity: clamp(cfg.opacity, OPACITY_RANGE.min, OPACITY_RANGE.max),
    angleDeg: clamp(cfg.angleDeg, ANGLE_RANGE.min, ANGLE_RANGE.max),
    scale: clamp(cfg.scale, SCALE_RANGE.min, SCALE_RANGE.max),
  }
}

export function fontSizeFor(cfg: WatermarkConfig, width: number, height: number): number {
  return clamp(cfg.scale, SCALE_RANGE.min, SCALE_RANGE.max) * Math.min(width, height)
}

/** Axis-aligned bounding box of a `width × height` box rotated by `angleDeg`. */
export function rotatedBounds(text: TextExtents, angleDeg: number): TextExtents {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  return {
    width: text.width * cos + text.height * sin,
    height: text.width * sin + text.height * cos,
  }
}

/**
 * Distance between neighbouring tiles, measured **along the text's own axes** —
 * `width` runs with the text, `height` across it.
 *
 * Not the rotated bounding box: a box-based step lays the grid on the page's
 * axes, and rotated text fills only the diagonal band of its own bounding box.
 * The empty corners of every tile then line up into bald patches — at 45° that
 * leaves two opposite corners of the page visibly barer than the other two.
 */
export function tileStep(cfg: WatermarkConfig, page: PageSize, text: TextExtents): PageSize {
  const gutter = TILE_GUTTER * fontSizeFor(cfg, page.width, page.height)
  return { width: text.width + gutter, height: text.height + gutter }
}

/** Rotate an offset from text space into page space (y down, clockwise). */
function toPage(u: number, v: number, radians: number): { x: number; y: number } {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: u * cos - v * sin, y: u * sin + v * cos }
}

/** Rotate an offset from page space into text space. */
function toText(x: number, y: number, radians: number): { u: number; v: number } {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { u: x * cos + y * sin, v: -x * sin + y * cos }
}

/**
 * Where to stamp the watermark, as normalized page coordinates.
 *
 * `single` centres one stamp. `tiled` lays a staggered grid whose step is the
 * rotated text's bounding box plus a gutter, extended a full step past every
 * edge so that rotation cannot leave a bald corner.
 */
export function watermarkPlacements(
  cfg: WatermarkConfig,
  page: PageSize,
  text: TextExtents,
): Placement[] {
  if (!cfg.text.trim()) return []
  if (page.width <= 0 || page.height <= 0) return []
  if (cfg.layout === 'single') return [{ x: 0.5, y: 0.5 }]
  if (text.width <= 0 || text.height <= 0) return []

  const { width: stepU, height: stepV } = tileStep(cfg, page, text)
  if (stepU <= 0 || stepV <= 0) return []

  const radians = (cfg.angleDeg * Math.PI) / 180
  const cx = page.width / 2
  const cy = page.height / 2

  // Work out how far the lattice has to run by projecting the page's own
  // corners into text space. A page is not square and the text is not axis
  // aligned, so the extent differs per axis and per angle — deriving it beats
  // guessing a margin that is too small at one angle and wasteful at another.
  let maxU = 0
  let maxV = 0
  for (const [x, y] of [
    [0, 0],
    [page.width, 0],
    [0, page.height],
    [page.width, page.height],
  ] as const) {
    const { u, v } = toText(x - cx, y - cy, radians)
    maxU = Math.max(maxU, Math.abs(u))
    maxV = Math.max(maxV, Math.abs(v))
  }

  // One extra step past the far corner: a stamp centred just outside the page
  // still paints into it, and the half-step stagger borrows from that margin.
  const cols = Math.ceil(maxU / stepU) + 1
  const rows = Math.ceil(maxV / stepV) + 1

  const placements: Placement[] = []
  for (let row = -rows; row <= rows; row++) {
    // Brick stagger: offset every other line so the gaps between words do not
    // line up into visible corridors running across the page.
    const stagger = row % 2 === 0 ? 0 : stepU / 2
    for (let col = -cols; col <= cols; col++) {
      const offset = toPage(col * stepU + stagger, row * stepV, radians)
      placements.push({ x: (cx + offset.x) / page.width, y: (cy + offset.y) / page.height })
    }
  }
  return placements
}
