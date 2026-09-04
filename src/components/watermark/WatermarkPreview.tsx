import { useEffect, useRef, useState } from 'react'
import { decodeImage, drawWatermark } from '../../lib/imageWatermark'
import { decodeHeic } from '../../lib/heic'
import { readPdfInfo } from '../../lib/pdfWatermark'
import type { WatermarkConfig } from '../../lib/watermark'
import type { WatermarkJob } from './useWatermarkQueue'

/** Longest edge of the preview canvas. Big enough to judge, cheap to redraw. */
const PREVIEW_EDGE = 560

/** A4 in points, the fallback shape before a PDF's real size is known. */
const A4 = { width: 595, height: 842 }

function describe(cfg: WatermarkConfig, subject: string): string {
  const pattern = cfg.layout === 'tiled' ? 'Tiled' : 'A single centred'
  return (
    `${pattern} watermark reading “${cfg.text}” on ${subject}, ` +
    `at ${Math.round(cfg.opacity * 100)}% opacity, rotated ${Math.round(cfg.angleDeg)} degrees, ` +
    `sized ${Math.round(cfg.scale * 100)}% of the page.`
  )
}

interface WatermarkPreviewProps {
  job: WatermarkJob | null
  config: WatermarkConfig
}

export function WatermarkPreview({ job, config }: WatermarkPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState<
    { kind: 'image'; bitmap: ImageBitmap } | { kind: 'pdf'; pages: number; size: typeof A4 } | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  // Decode once per file, not once per slider tick: a 12 MP photo would
  // otherwise be re-decoded on every frame of a drag.
  useEffect(() => {
    let cancelled = false
    setError(null)
    setSource(null)
    if (!job?.kind) return

    const load = async () => {
      if (job.kind === 'pdf') {
        const bytes = new Uint8Array(await job.file.arrayBuffer())
        const info = await readPdfInfo(bytes)
        if (!cancelled) setSource({ kind: 'pdf', pages: info.pageCount, size: info.first })
        return
      }
      const bitmap = job.kind === 'heic' ? await decodeHeic(job.file) : await decodeImage(job.file)
      if (cancelled) {
        bitmap.close?.()
        return
      }
      setSource({ kind: 'image', bitmap })
    }

    void load().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'This file could not be previewed.')
    })

    return () => {
      cancelled = true
    }
  }, [job])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !source) return

    const page = source.kind === 'image' ? source.bitmap : source.size
    const scale = PREVIEW_EDGE / Math.max(page.width, page.height)
    const width = Math.max(1, Math.round(page.width * scale))
    const height = Math.max(1, Math.round(page.height * scale))
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    // A PDF page is white in every reader; an image supplies its own ground.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    if (source.kind === 'image') ctx.drawImage(source.bitmap, 0, 0, width, height)

    // The same function that writes the downloaded image, on the same geometry
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

  const subject =
    source?.kind === 'pdf' ? `a blank ${source.pages}-page page outline` : `“${job.name}”`

  return (
    <>
      <div className="wm__preview-frame">
        <canvas ref={canvasRef} role="img" aria-label={describe(config, subject)} />
      </div>
      <p className="wm__preview-caption">
        {source?.kind === 'pdf'
          ? `Settings preview on a blank page the shape of page 1 — not the document itself. The watermark is applied to all ${source.pages} ${source.pages === 1 ? 'page' : 'pages'}.`
          : 'Live preview of the file you will download.'}
      </p>
    </>
  )
}
