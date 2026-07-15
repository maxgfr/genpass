import { useMemo } from 'react'
import { qrMatrix, qrSvgPath } from '../../lib/qr'

const QUIET_ZONE = 3

interface QrCodeProps {
  text: string
  label: string
}

export function QrCode({ text, label }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const matrix = qrMatrix(text)
    return { size: matrix.size, path: qrSvgPath(matrix) }
  }, [text])

  return (
    <div className="share__qr-card">
      <svg
        viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${size + QUIET_ZONE * 2} ${size + QUIET_ZONE * 2}`}
        role="img"
        aria-label={label}
        shapeRendering="crispEdges"
      >
        <path d={path} fill="#000000" />
      </svg>
    </div>
  )
}

/** Standalone SVG document for downloads. */
export function qrSvgDocument(text: string): string {
  const matrix = qrMatrix(text)
  const total = matrix.size + QUIET_ZONE * 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-QUIET_ZONE} ${-QUIET_ZONE} ${total} ${total}">` +
    `<rect x="${-QUIET_ZONE}" y="${-QUIET_ZONE}" width="${total}" height="${total}" fill="#ffffff"/>` +
    `<path d="${qrSvgPath(matrix)}" fill="#000000"/></svg>`
  )
}

/** Rasterize to a PNG blob via canvas (browser only). */
export async function qrPngBlob(text: string, scale = 12): Promise<Blob> {
  const matrix = qrMatrix(text)
  const total = (matrix.size + QUIET_ZONE * 2) * scale
  const canvas = document.createElement('canvas')
  canvas.width = total
  canvas.height = total
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, total, total)
  ctx.fillStyle = '#000000'
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.isDark(x, y)) {
        ctx.fillRect((x + QUIET_ZONE) * scale, (y + QUIET_ZONE) * scale, scale, scale)
      }
    }
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png')
  })
}
