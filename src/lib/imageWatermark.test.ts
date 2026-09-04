// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_WATERMARK, watermarkPlacements, type WatermarkConfig } from './watermark'
import {
  ImageTooLargeError,
  MAX_CANVAS_EDGE,
  drawWatermark,
  measureWatermarkText,
  watermarkImage,
} from './imageWatermark'
import { installCanvasMock, type CanvasMock } from '../test/helpers'

let canvas: CanvasMock

beforeEach(() => {
  canvas = installCanvasMock()
})

afterEach(() => {
  canvas.restore()
})

function config(overrides: Partial<WatermarkConfig> = {}): WatermarkConfig {
  return { ...DEFAULT_WATERMARK, ...overrides }
}

function bitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: () => {} } as unknown as ImageBitmap
}

describe('drawWatermark', () => {
  it('stamps exactly the placements the geometry asked for', () => {
    const cfg = config()
    const text = measureWatermarkText(canvas.ctx as never, cfg, 800, 600)
    const expected = watermarkPlacements(cfg, { width: 800, height: 600 }, text)

    drawWatermark(canvas.ctx as never, cfg, 800, 600)

    expect(canvas.fillTextCalls()).toHaveLength(expected.length)
    expect(expected.length).toBeGreaterThan(1)
  })

  it('draws once, at the origin of a translated frame, for the single layout', () => {
    drawWatermark(canvas.ctx as never, config({ layout: 'single' }), 800, 600)
    expect(canvas.fillTextCalls()).toEqual([{ text: 'CONFIDENTIAL', x: 0, y: 0 }])
    expect(canvas.ctx.translate).toHaveBeenCalledWith(400, 300)
  })

  it('rotates by the configured angle, in radians', () => {
    drawWatermark(canvas.ctx as never, config({ layout: 'single', angleDeg: 45 }), 800, 600)
    expect(canvas.ctx.rotate).toHaveBeenCalledWith(Math.PI / 4)
  })

  it('draws nothing when the text is blank', () => {
    drawWatermark(canvas.ctx as never, config({ text: '   ' }), 800, 600)
    expect(canvas.fillTextCalls()).toHaveLength(0)
  })

  it('centres each stamp on its own placement', () => {
    drawWatermark(canvas.ctx as never, config({ layout: 'single' }), 800, 600)
    expect(canvas.ctx.textAlign).toBe('center')
    expect(canvas.ctx.textBaseline).toBe('middle')
  })
})

describe('watermarkImage', () => {
  it('paints the source and the watermark, then encodes to the requested type', async () => {
    const blob = await watermarkImage(bitmap(800, 600), config(), 'png')
    expect(canvas.ctx.drawImage).toHaveBeenCalled()
    expect(canvas.fillTextCalls().length).toBeGreaterThan(0)
    expect(blob.type).toBe('image/png')
  })

  it('lays a white ground under JPEG, which has no alpha channel', async () => {
    await watermarkImage(bitmap(400, 400), config(), 'jpeg')
    expect(canvas.ctx.fillRect).toHaveBeenCalledWith(0, 0, 400, 400)
  })

  it('does not add a ground under PNG, so transparency survives', async () => {
    await watermarkImage(bitmap(400, 400), config(), 'png')
    expect(canvas.ctx.fillRect).not.toHaveBeenCalled()
  })

  it('refuses an image beyond the browser canvas limits rather than writing a blank file', async () => {
    await expect(watermarkImage(bitmap(MAX_CANVAS_EDGE + 1, 10), config(), 'png')).rejects.toThrow(
      ImageTooLargeError,
    )
    await expect(watermarkImage(bitmap(20_000, 20_000), config(), 'png')).rejects.toThrow(
      ImageTooLargeError,
    )
  })
})
