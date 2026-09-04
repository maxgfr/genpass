import { describe, expect, it } from 'vitest'
import {
  ANGLE_RANGE,
  DEFAULT_WATERMARK,
  OPACITY_RANGE,
  SCALE_RANGE,
  clampConfig,
  fontSizeFor,
  rotatedBounds,
  tileStep,
  watermarkPlacements,
  type Placement,
  type WatermarkConfig,
} from './watermark'

const PAGE = { width: 595, height: 842 } // A4 in points

function config(overrides: Partial<WatermarkConfig> = {}): WatermarkConfig {
  return { ...DEFAULT_WATERMARK, ...overrides }
}

/**
 * A stand-in for `ctx.measureText` / `font.widthOfTextAtSize`: both are linear
 * in the font size, which is the only property the geometry relies on.
 */
function measure(cfg: WatermarkConfig, page = PAGE) {
  const fontSize = fontSizeFor(cfg, page.width, page.height)
  return { width: cfg.text.length * 0.55 * fontSize, height: fontSize }
}

const CORNERS = (page = PAGE) => [
  { x: 0, y: 0 },
  { x: page.width, y: 0 },
  { x: 0, y: page.height },
  { x: page.width, y: page.height },
]

/**
 * Does the tiling reach `point`?
 *
 * A tiled watermark is a pattern with gutters, so no tiling puts glyphs on an
 * arbitrary point — that is as true of the page centre as of a corner. The
 * property that matters is that the pattern is as dense at the edges as in the
 * middle: every point must fall inside some tile cell.
 *
 * Cells are measured along the text's own axes, because that is how the
 * lattice is laid. Measuring them on the page's axes instead is precisely the
 * bug this replaced: it leaves two opposite corners bald at 45°.
 */
function inSomeCell(
  placements: Placement[],
  point: { x: number; y: number },
  step: { width: number; height: number },
  angleDeg: number,
  page = PAGE,
): boolean {
  const radians = (angleDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const epsilon = 1e-9
  return placements.some((p) => {
    const dx = p.x * page.width - point.x
    const dy = p.y * page.height - point.y
    const u = dx * cos + dy * sin
    const v = -dx * sin + dy * cos
    return Math.abs(u) <= step.width / 2 + epsilon && Math.abs(v) <= step.height / 2 + epsilon
  })
}

describe('fontSizeFor', () => {
  it('scales against the short side, so orientation does not change the look', () => {
    const cfg = config({ scale: 0.1 })
    expect(fontSizeFor(cfg, 595, 842)).toBeCloseTo(59.5)
    expect(fontSizeFor(cfg, 842, 595)).toBeCloseTo(59.5)
  })

  it('clamps a config that arrived out of bounds', () => {
    expect(fontSizeFor(config({ scale: 10 }), 100, 100)).toBeCloseTo(SCALE_RANGE.max * 100)
  })
})

describe('rotatedBounds', () => {
  it('is the identity at 0°', () => {
    expect(rotatedBounds({ width: 100, height: 20 }, 0)).toEqual({ width: 100, height: 20 })
  })

  it('swaps the axes at 90°', () => {
    const box = rotatedBounds({ width: 100, height: 20 }, 90)
    expect(box.width).toBeCloseTo(20)
    expect(box.height).toBeCloseTo(100)
  })

  it('grows both axes at 45°', () => {
    const box = rotatedBounds({ width: 100, height: 20 }, 45)
    expect(box.width).toBeCloseTo((100 + 20) / Math.SQRT2)
    expect(box.height).toBeCloseTo((100 + 20) / Math.SQRT2)
  })

  it('treats mirrored angles alike', () => {
    expect(rotatedBounds({ width: 80, height: 12 }, 30)).toEqual(
      rotatedBounds({ width: 80, height: 12 }, -30),
    )
  })
})

describe('watermarkPlacements — single', () => {
  it('places exactly one stamp at the centre of the page', () => {
    const cfg = config({ layout: 'single' })
    expect(watermarkPlacements(cfg, PAGE, measure(cfg))).toEqual([{ x: 0.5, y: 0.5 }])
  })

  it('centres regardless of angle or page shape', () => {
    const cfg = config({ layout: 'single', angleDeg: -37 })
    const wide = { width: 2000, height: 100 }
    expect(watermarkPlacements(cfg, wide, measure(cfg, wide))).toEqual([{ x: 0.5, y: 0.5 }])
  })
})

describe('watermarkPlacements — tiled', () => {
  it('reaches every corner of the page at 45°', () => {
    const cfg = config({ angleDeg: 45 })
    const text = measure(cfg)
    const placements = watermarkPlacements(cfg, PAGE, text)
    const step = tileStep(cfg, PAGE, text)
    for (const corner of CORNERS()) {
      expect(inSomeCell(placements, corner, step, cfg.angleDeg)).toBe(true)
    }
  })

  it('reaches the corners at every angle a user can pick', () => {
    for (let angle = ANGLE_RANGE.min; angle <= ANGLE_RANGE.max; angle += 5) {
      const cfg = config({ angleDeg: angle })
      const text = measure(cfg)
      const placements = watermarkPlacements(cfg, PAGE, text)
      const step = tileStep(cfg, PAGE, text)
      for (const corner of CORNERS()) {
        expect(
          inSomeCell(placements, corner, step, angle),
          `angle ${angle}° leaves a corner short of the tiling`,
        ).toBe(true)
      }
    }
  })

  it('reaches the corners of an extreme aspect ratio', () => {
    const page = { width: 2400, height: 200 }
    const cfg = config({ angleDeg: 30 })
    const text = measure(cfg, page)
    const placements = watermarkPlacements(cfg, page, text)
    const step = tileStep(cfg, page, text)
    for (const corner of CORNERS(page)) {
      expect(inSomeCell(placements, corner, step, cfg.angleDeg, page)).toBe(true)
    }
  })

  it('brackets the page: stamps sit outside every edge, not just inside it', () => {
    const cfg = config({ angleDeg: 45 })
    const placements = watermarkPlacements(cfg, PAGE, measure(cfg))
    expect(Math.min(...placements.map((p) => p.x))).toBeLessThan(0)
    expect(Math.max(...placements.map((p) => p.x))).toBeGreaterThan(1)
    expect(Math.min(...placements.map((p) => p.y))).toBeLessThan(0)
    expect(Math.max(...placements.map((p) => p.y))).toBeGreaterThan(1)
  })

  /**
   * The regression a browser pixel count caught and every assertion above had
   * missed: with a page-axis grid, 45° text left the top-left and bottom-right
   * corners of the page almost bare while the other two were fully covered.
   *
   * Counting stamp *centres* near a corner cannot see this — the centres stay
   * symmetric; it is the text's orientation inside each tile that starves two
   * corners. So this samples actual ink: does a point fall inside some rotated
   * glyph box?
   */
  it('puts ink in all four corners, not two of them', () => {
    for (const angle of [30, 45, 60, -45, -60]) {
      const cfg = config({ angleDeg: angle })
      const text = measure(cfg)
      const placements = watermarkPlacements(cfg, PAGE, text)
      const radians = (angle * Math.PI) / 180

      const inked = (px: number, py: number) =>
        placements.some((p) => {
          const dx = px - p.x * PAGE.width
          const dy = py - p.y * PAGE.height
          const u = dx * Math.cos(radians) + dy * Math.sin(radians)
          const v = -dx * Math.sin(radians) + dy * Math.cos(radians)
          return Math.abs(u) <= text.width / 2 && Math.abs(v) <= text.height / 2
        })

      // Sample a square at each corner, the way the browser check counted
      // pixels there.
      const box = Math.min(PAGE.width, PAGE.height) * 0.18
      const coverage = CORNERS().map((corner) => {
        let hit = 0
        let total = 0
        for (let i = 0; i < 12; i++) {
          for (let j = 0; j < 12; j++) {
            const px = corner.x + ((corner.x === 0 ? 1 : -1) * box * i) / 11
            const py = corner.y + ((corner.y === 0 ? 1 : -1) * box * j) / 11
            total += 1
            if (inked(px, py)) hit += 1
          }
        }
        return hit / total
      })

      expect(
        Math.min(...coverage),
        `angle ${angle}° starves a corner: ${coverage.map((c) => c.toFixed(2)).join(', ')}`,
      ).toBeGreaterThan(0.1)
    }
  })

  it('keeps its density when the angle changes — no sparse patch at 45°', () => {
    const counts = [0, 30, 45, 60, 90].map((angleDeg) => {
      const cfg = config({ angleDeg })
      return watermarkPlacements(cfg, PAGE, measure(cfg)).length
    })
    // A bounding-box grid collapses to a third of the stamps at 45°; a lattice
    // laid along the text keeps the count within a modest band.
    expect(Math.max(...counts) / Math.min(...counts)).toBeLessThan(3)
  })

  it('produces more stamps as the text shrinks', () => {
    const counts = [0.3, 0.15, 0.08, 0.04].map((scale) => {
      const cfg = config({ scale })
      return watermarkPlacements(cfg, PAGE, measure(cfg)).length
    })
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!).toBeGreaterThan(counts[i - 1]!)
    }
  })

  it('is symmetric about the page centre on even rows', () => {
    const cfg = config({ angleDeg: 0, scale: 0.1 })
    const placements = watermarkPlacements(cfg, PAGE, measure(cfg))
    const xs = [...new Set(placements.map((p) => Number(p.x.toFixed(6))))].sort((a, b) => a - b)
    // Staggered rows add half-step columns; the unstaggered ones straddle 0.5.
    expect(Math.min(...xs)).toBeLessThan(0)
    expect(Math.max(...xs)).toBeGreaterThan(1)
  })

  it('is deterministic', () => {
    const cfg = config()
    expect(watermarkPlacements(cfg, PAGE, measure(cfg))).toEqual(
      watermarkPlacements(cfg, PAGE, measure(cfg)),
    )
  })
})

describe('watermarkPlacements — degenerate input', () => {
  it('returns nothing for empty or whitespace-only text', () => {
    for (const text of ['', '   ', '\n\t']) {
      const cfg = config({ text })
      expect(watermarkPlacements(cfg, PAGE, measure(cfg))).toEqual([])
    }
  })

  it('returns nothing for a zero-sized page or unmeasurable text', () => {
    const cfg = config()
    expect(watermarkPlacements(cfg, { width: 0, height: 100 }, measure(cfg))).toEqual([])
    expect(watermarkPlacements(cfg, PAGE, { width: 0, height: 0 })).toEqual([])
  })
})

describe('clampConfig', () => {
  it('pulls every numeric field inside its range', () => {
    const clamped = clampConfig(config({ opacity: 4, angleDeg: 400, scale: -1 }))
    expect(clamped.opacity).toBe(OPACITY_RANGE.max)
    expect(clamped.angleDeg).toBe(ANGLE_RANGE.max)
    expect(clamped.scale).toBe(SCALE_RANGE.min)
  })

  it('replaces NaN with the low end rather than propagating it', () => {
    const clamped = clampConfig(config({ opacity: Number.NaN, scale: Number.NaN }))
    expect(clamped.opacity).toBe(OPACITY_RANGE.min)
    expect(clamped.scale).toBe(SCALE_RANGE.min)
  })

  it('leaves an in-range config alone', () => {
    const cfg = config()
    expect(clampConfig(cfg)).toEqual(cfg)
  })
})
