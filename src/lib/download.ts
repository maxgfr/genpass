/**
 * Hand a Blob to the browser's download machinery.
 *
 * The object URL is revoked right after the synthetic click: the browser has
 * already taken its own reference by then, and keeping the URL alive would pin
 * the blob (a watermarked PDF can be tens of megabytes) for the page's lifetime.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
