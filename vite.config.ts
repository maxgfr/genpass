/// <reference types="vitest/config" />
import { cpSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// CSP is injected at build time only: the dev server needs inline scripts and
// websockets for HMR, while the deployed app must allow neither.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "manifest-src 'self'",
  // blob: is here for exactly one reason: the HEIC decoder (heic-to) starts
  // libheif in a worker built from an inline Blob, and worker-src 'self' alone
  // blocks that. The code inside is same-origin code from our own bundle — no
  // external host is reachable, and connect-src 'self' still stops anything
  // inside that worker from calling out. child-src repeats it for Safari < 15.5,
  // which ignores worker-src. Note what is deliberately NOT here: no
  // 'unsafe-eval' (we import heic-to/csp, which has no `new Function`), and no
  // 'wasm-unsafe-eval' (heic-to is an asm.js build of libheif, not WASM).
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ')

function cspPlugin() {
  return {
    name: 'genpass:csp',
    apply: 'build' as const,
    transformIndexHtml(html: string) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

/**
 * pdf.js needs the 14 standard PDF fonts on disk to draw a document that does
 * not embed its own — which most simple PDFs do not. Copying them here beats
 * committing 816 KB of .pfb binaries into the repository, and beats a build
 * dependency for a `cp -r`.
 */
function pdfjsFontsPlugin() {
  return {
    name: 'genpass:pdfjs-fonts',
    apply: 'build' as const,
    writeBundle(options: { dir?: string }) {
      const require = createRequire(import.meta.url)
      const root = dirname(require.resolve('pdfjs-dist/package.json'))
      const from = join(root, 'standard_fonts')
      if (!existsSync(from) || !options.dir) return
      cpSync(from, join(options.dir, 'pdfjs', 'standard_fonts'), { recursive: true })
    },
  }
}

export default defineConfig({
  base: '/genpass/',
  plugins: [
    react(),
    cspPlugin(),
    pdfjsFontsPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'genpass',
        short_name: 'genpass',
        description: 'Offline password generator and encrypted vault. Everything stays on your device.',
        start_url: '/genpass/',
        scope: '/genpass/',
        display: 'standalone',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The HEIC decoder is a ~3 MB asm.js build of libheif. Precaching it
        // would weigh down every install and every service-worker update for a
        // format most people never drop on the app — and it is over Workbox's
        // 2 MiB precache cap anyway, so it would be dropped with a warning
        // rather than cached. Cached on first use instead: HEIC therefore
        // needs one online use before it works offline, which the UI says.
        //
        // pdf.js is here for the same reason: ~1.7 MB of renderer and fonts
        // that only a *preview* of a PDF needs. Watermarking a PDF uses
        // pdf-lib, which stays precached, so the feature itself keeps working
        // offline — it is only the picture of the page that needs one online
        // use. The worker alone is over the 2 MiB cap anyway.
        globIgnores: ['**/heic-decoder-*.js', '**/pdf-renderer-*.js', '**/pdf.worker*.js', '**/pdf.worker*.mjs'],
        runtimeCaching: [
          {
            urlPattern: /heic-decoder-.*\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'heic-decoder', expiration: { maxEntries: 2 } },
          },
          {
            urlPattern: /(pdf-renderer-.*\.js|pdf\.worker.*\.m?js)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pdf-renderer', expiration: { maxEntries: 4 } },
          },
          {
            urlPattern: /\/pdfjs\/standard_fonts\//,
            handler: 'CacheFirst',
            options: { cacheName: 'pdfjs-fonts', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      // Keep the decoder in a chunk with a predictable name so the service
      // worker rules above can single it out.
      output: {
        manualChunks: (id: string) => {
          if (id.includes('heic-to')) return 'heic-decoder'
          if (id.includes('pdfjs-dist')) return 'pdf-renderer'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
})
