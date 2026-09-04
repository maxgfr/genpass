/**
 * Rasterise the first page of a PDF, so the preview shows the user's actual
 * document rather than a blank page outline.
 *
 * This is the one job pdf-lib cannot do — it writes PDFs, it does not draw
 * them — so it costs a second, heavier library. pdf.js is therefore loaded by
 * dynamic `import()` and only when a PDF is previewed: a user who never opens
 * the Watermark tab, or who only watermarks images, never downloads a byte of
 * it. Watermarking a PDF does not need it either; only looking at one does.
 */

/** The preview failed to draw. The file may still watermark perfectly well. */
export class PdfPreviewError extends Error {
  constructor() {
    super('This PDF could not be drawn for the preview.')
    this.name = 'PdfPreviewError'
  }
}

type PdfJs = typeof import('pdfjs-dist')

let pdfjs: PdfJs | null = null

async function load(): Promise<PdfJs> {
  if (pdfjs) return pdfjs
  const lib = await import('pdfjs-dist')
  // Vite emits this as a same-origin asset, so `worker-src 'self'` covers it.
  lib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href
  pdfjs = lib
  return lib
}

export interface PdfPage {
  bitmap: ImageBitmap
  width: number
  height: number
}

/**
 * Draw page `pageNumber` (1-based) at up to `maxEdge` pixels on its long side.
 *
 * The bytes are copied before being handed over: pdf.js takes ownership of the
 * buffer it is given and detaches it, which would leave the caller holding an
 * empty array when it later goes to watermark the same file.
 */
export async function renderPdfPage(
  bytes: Uint8Array,
  pageNumber: number,
  maxEdge: number,
): Promise<PdfPage> {
  const lib = await load()
  const task = lib.getDocument({
    data: bytes.slice(),
    // The 14 standard fonts are not embedded in most simple PDFs; without
    // these the text silently fails to draw. Copied into the build by the
    // `genpass:pdfjs-fonts` plugin in vite.config.ts.
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
    isOffscreenCanvasSupported: true,
  })

  try {
    const doc = await task.promise
    try {
      const page = await doc.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const scale = maxEdge / Math.max(base.width, base.height)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new PdfPreviewError()

      // A PDF page is paper: anything the page does not paint is white, not
      // transparent.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvas, canvasContext: ctx, viewport }).promise

      const bitmap = await createImageBitmap(canvas)
      canvas.width = 1
      canvas.height = 1
      return { bitmap, width: viewport.width, height: viewport.height }
    } finally {
      // Shuts down the worker too, so a batch of previews does not accumulate
      // one background thread per document looked at.
      await task.destroy()
    }
  } catch (err) {
    if (err instanceof PdfPreviewError) throw err
    throw new PdfPreviewError()
  }
}
