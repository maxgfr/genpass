/**
 * HEIC decoding, behind one dynamic import.
 *
 * Everything the app knows about `heic-to` lives here: one module to mock in
 * tests, one module to delete if the dependency is ever dropped.
 *
 * Two deliberate choices:
 *
 * - `heic-to/csp`, never the default entry. The default bundle contains two
 *   `new Function` call sites, which would need `script-src 'unsafe-eval'` —
 *   the single worst directive to add to an app that encrypts things. The csp
 *   build has none. Neither build touches WebAssembly, so no `wasm-unsafe-eval`
 *   is needed either.
 * - `type: 'bitmap'`, so libheif's pixels come back as an `ImageBitmap`
 *   directly, skipping an intermediate lossy JPEG round-trip inside the
 *   library before we re-encode anyway.
 *
 * The decoder is ~3 MB, so it is not precached (see `vite.config.ts`): HEIC
 * needs one online load before it works offline. The UI says so.
 */

export class HeicDecodeError extends Error {
  constructor() {
    super('This HEIC image could not be decoded.')
    this.name = 'HeicDecodeError'
  }
}

export class HeicUnavailableError extends Error {
  constructor() {
    super('The HEIC decoder is not downloaded yet — connect once to enable HEIC.')
    this.name = 'HeicUnavailableError'
  }
}

/** Decode a HEIC/HEIF file to a bitmap the canvas renderer can draw. */
export async function decodeHeic(file: Blob): Promise<ImageBitmap> {
  let heicTo: typeof import('heic-to/csp').heicTo
  try {
    ;({ heicTo } = await import('heic-to/csp'))
  } catch {
    // A failed dynamic import here means the chunk could not be fetched —
    // almost always an offline first use, not a broken file.
    throw new HeicUnavailableError()
  }

  try {
    return await heicTo({ blob: file, type: 'bitmap' })
  } catch {
    throw new HeicDecodeError()
  }
}
