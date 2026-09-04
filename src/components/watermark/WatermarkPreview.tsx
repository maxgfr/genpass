import { useEffect, useRef, useState } from 'react'
import { decodeImage, drawWatermark } from '../../lib/imageWatermark'
import { decodeHeic } from '../../lib/heic'
import { renderPdfPage } from '../../lib/pdfPreview'
import { readPdfInfo } from '../../lib/pdfWatermark'
import type { WatermarkConfig } from '../../lib/watermark'
import type { WatermarkJob } from './useWatermarkQueue'

/** Longest edge of the preview canvas. Big enough to judge, cheap to redraw. */
const PREVIEW_EDGE = 560

function describe(cfg: WatermarkConfig, subject: string): string {
  const pattern = cfg.layout === 'tiled' ? 'Tiled' : 'A single centred'
  return (
    `${pattern} watermark reading “${cfg.text}” on ${subject}, ` +
    `at ${Math.round(cfg.opacity * 100)}% opacity, rotated ${Math.round(cfg.angleDeg)} degrees, ` +
    `sized ${Math.round(cfg.scale * 100)}% of the page.`
  )
}

/** What the preview is drawing, once the file has been decoded. */
type Source =
  | { kind: 'image'; bitmap: ImageBitmap }
  | { kind: 'pdf'; bitmap: ImageBitmap; pages: number }
  /** The PDF opened, but pdf.js could not draw it — fall back to its shape. */
  | { kind: 'pdf-outline'; pages: number; width: number; height: number }

interface WatermarkPreviewProps {
  job: WatermarkJob | null
  config: WatermarkConfig
}

export function WatermarkPreview({ job, config }: WatermarkPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Decode once per file, not once per slider tick: a 12 MP photo or a PDF
  // page would otherwise be re-rendered on every frame of a drag.
  useEffect(() => {
    let cancelled = false
    setError(null)
    setSource(null)
    if (!job?.kind) return
    setLoading(true)

    const load = async () => {
      if (job.kind === 'pdf') {
        const bytes = new Uint8Array(await job.file.arrayBuffer())
        // Read the shape first: it validates the file, gives the page count,
        // and leaves something to draw even if rasterising fails.
        const info = await readPdfInfo(bytes)
        try {
          const page = await renderPdfPage(bytes, 1, PREVIEW_EDGE)
          if (cancelled) {
            page.bitmap.close?.()
            return
          }
          setSource({ kind: 'pdf', bitmap: page.bitmap, pages: info.pageCount })
        } catch {
          // The document is watermarkable even when it is not drawable, so
          // degrade to the page outline rather than failing the whole preview.
          if (!cancelled) {
            setSource({ kind: 'pdf-outline', pages: info.pageCount, ...info.first })
          }
        }
        return
      }

      const bitmap = job.kind === 'heic' ? await decodeHeic(job.file) : await decodeImage(job.file)
      if (cancelled) {
        bitmap.close?.()
        return
      }
      setSource({ kind: 'image', bitmap })
    }

    void load()
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'This file could not be previewed.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [job])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !source) return

    const page =
      source.kind === 'pdf-outline'
        ? { width: source.width, height: source.height }
        : source.bitmap
    const scale = PREVIEW_EDGE / Math.max(page.width, page.height)
    const width = Math.max(1, Math.round(page.width * scale))
    const height = Math.max(1, Math.round(page.height * scale))
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    // Paper, and the ground under an image with transparency.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    if (source.kind !== 'pdf-outline') ctx.drawImage(source.bitmap, 0, 0, width, height)

    // The same function that writes the downloaded file, on the same geometry
    // scaled down — so this is the output, not an impression of it.
    drawWatermark(ctx, config, width, height)
  }, [source, config])

  if (!job) {
    return <p className="wm__preview-caption">Add a document to see the watermark on it.</p>
  }

  if (error) {
    return (
      <p className="wm__row-error" role="alert">
        {error}
      </p>
    )
  }

  if (loading && !source) {
    return (
      <p className="wm__preview-caption" role="status">
        Opening {job.name}…
      </p>
    )
  }

  const subject =
    source?.kind === 'pdf'
      ? `page 1 of “${job.name}”`
      : source?.kind === 'pdf-outline'
        ? `a blank outline of page 1 of “${job.name}”`
        : `“${job.name}”`

  return (
    <>
      <div className="wm__preview-frame">
        <canvas ref={canvasRef} role="img" aria-label={describe(config, subject)} />
      </div>
      <p className="wm__preview-caption">
        {source?.kind === 'pdf' &&
          `Page 1 of ${source.pages}. The watermark is applied to ${source.pages === 1 ? 'it' : `all ${source.pages} pages`}.`}
        {source?.kind === 'pdf-outline' &&
          `This PDF could not be drawn, so this is a blank page of the same shape. The watermark is still applied to all ${source.pages} ${source.pages === 1 ? 'page' : 'pages'}.`}
        {source?.kind === 'image' && 'Live preview of the file you will download.'}
      </p>
    </>
  )
}
