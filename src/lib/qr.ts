// Thin, sync wrapper around the qrcode package: we only take the module
// matrix and render SVG ourselves (no canvas, works in node and browser).

import QRCode from 'qrcode'

export interface QrMatrix {
  size: number
  isDark(x: number, y: number): boolean
}

/** Byte-mode capacity of a version-40 QR code at error-correction level M. */
export const QR_MAX_BYTES = 2331

/** UI seam: check before calling qrMatrix — beyond capacity, encoding throws. */
export function canEncodeQr(text: string): boolean {
  return new TextEncoder().encode(text).length <= QR_MAX_BYTES
}

export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const { size, data } = qr.modules
  return {
    size,
    isDark: (x, y) => data[y * size + x] === 1,
  }
}

/** One 1×1 square per dark module; render inside viewBox "0 0 size size". */
export function qrSvgPath(matrix: QrMatrix): string {
  const parts: string[] = []
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.isDark(x, y)) parts.push(`M${x} ${y}h1v1h-1z`)
    }
  }
  return parts.join('')
}
