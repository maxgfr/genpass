# genpass

**Offline password generator and encrypted vault — everything happens, and stays, on your device.**

Live app: **https://maxgfr.github.io/genpass/**

genpass generates cryptographically strong passwords and passphrases, optionally stores them in a
vault encrypted with a master password, and can share a secret through an encrypted link or a QR
code. There is no backend, no account, no telemetry, and no network call: the app is a static page
that works fully offline once loaded (installable as a PWA).

## Features

- **Generator** — uppercase / lowercase / digits / symbols toggles, length slider (8–64),
  "exclude similar characters" (`0O o 1l I| 2Z 5S 8B`), custom excluded characters, batch
  generation (×1 / ×10), one-click copy with optional clipboard auto-clear.
- **Passphrases** — 3–10 words from the EFF large wordlist (7,776 words, bundled), separator
  choice, capitalization, optional digit.
- **PIN codes** — digits only, 4–12 digits (8 by default), for the services that accept nothing
  else. Drawn uniformly with no pattern filtering, so the meter tells the truth rather than
  flattering it: 8 digits is 26.6 bits and falls instantly to an offline attack. Only safe where
  the service itself caps failed attempts.
- **Exact strength meter** — because sampling is uniform, the displayed entropy
  (`length × log2(pool size)`) is the real number, with a crack-time estimate at a stated
  10¹⁰ guesses/s offline-attack rate.
- **Encrypted vault** — AES-256-GCM, key derived from your master password with PBKDF2-SHA256
  (1,000,000 iterations, random per-vault salt). Auto-locks after inactivity. Encrypted
  export/import for backups and moving browsers. Master password can be changed (full re-encrypt
  under a fresh salt).
- **Share a secret** — the encrypted secret travels inside the link's `#fragment` (never sent to
  any server). Optionally protected by a passphrase communicated over a separate channel, with a
  configurable expiry carried inside the encrypted payload.
- **QR codes** — for any text, for generated passwords, and for share links; SVG and PNG export.
- **Watermark** — stamp text across a PDF or an image (PNG, JPEG, WebP, HEIC) without uploading
  it anywhere. Text, size, opacity, angle, colour, tiled or centred, with a live preview driven by
  the same code that writes the output. In a PDF the watermark is real vector text on every page,
  so the file stays small and the document's own text stays selectable. Several files at once,
  downloaded individually or as a ZIP. A watermark is a visible marking, not protection — it can
  be cropped or edited out, and the app says so rather than implying otherwise.
- **Theming** — light / dark / auto (follows the OS live), WCAG-conscious OKLCH palette.

## Security model

- **What is protected:** the vault at rest. It is stored in `localStorage` only as
  `{version, kdf, iterations, salt, iv, ciphertext}`; without the master password it is
  computationally unreadable. Every save re-encrypts with a fresh random IV. Integrity is
  guaranteed by GCM: tampered data fails to decrypt.
- **Randomness:** all generation uses `crypto.getRandomValues` with rejection sampling (no modulo
  bias); one character of each selected class is guaranteed via a secure shuffle (no positional
  bias).
- **No recovery, by design.** There is no server, no reset email, no backdoor. A forgotten master
  password means the vault is gone. Export a backup.
- **Share links** carry the encrypted secret in the URL fragment. Fragments are not sent to the
  web server, but links persist in browser history and messengers: prefer the passphrase mode and
  a private channel. An optional expiry travels *inside* the encrypted payload — it cannot be
  stripped without breaking decryption, and the app refuses to reveal an expired secret. This is
  soft expiry, enforced by the opening device's clock: without a server there is still **no
  revocation and no one-time view** — the app says so rather than pretending otherwise.
- **Honest limits:** JavaScript strings cannot be zeroed from memory; an unlocked vault is
  readable by anyone with access to your unlocked device/session (that is the threat model of any
  password manager while open); clipboard auto-clear is best-effort (browsers block clipboard
  writes from unfocused tabs); `localStorage` is per-origin, so it is namespaced under
  `genpass.*` — and the vault blob within it is encrypted.
- **Supply chain:** three runtime dependencies beyond React. `qrcode` (MIT) for QR module-matrix
  encoding; `pdf-lib` (MIT) and `heic-to` (LGPL-3.0) for the Watermark tab only, both loaded by
  dynamic `import()` so neither is in the initial bundle and neither is reachable from the
  generator, the vault, or the share flow. Web Crypto for everything cryptographic — still no
  crypto libraries. ZIP writing and file-type sniffing are ~250 lines in `src/lib/`, not a
  dependency.
- **The CSP** (`default-src 'none'`, injected at build time, still **no external hosts**) gained
  exactly one relaxation for the Watermark tab: `worker-src 'self' blob:` (plus `child-src` for
  Safari < 15.5). `heic-to` starts its libheif decoder in a worker built from an inline Blob, and
  `worker-src 'self'` blocks that outright. Deliberately *not* added: `'unsafe-eval'` — the app
  imports `heic-to/csp`, the build with no `new Function` — and `'wasm-unsafe-eval'`, which is
  simply unnecessary: `heic-to` ships an asm.js build of libheif, not WebAssembly. `script-src`
  is untouched, and `connect-src 'self'` still means nothing inside that worker can call out.
  Dropping HEIC support would revert the directive and nothing else.
- **Licensing:** the project is MIT. `heic-to` is LGPL-3.0 (it embeds libheif and libde265). It
  ships as a separate, unmodified, dynamically-imported chunk — the standard arrangement that
  keeps the LGPL's relinking right meaningful for a JavaScript bundle.
- **Watermark privacy:** the file never leaves the device — there is no upload, and no network
  call is made to produce it. Re-encoding an image strips its EXIF metadata, including GPS
  location; PDFs keep their own metadata, and the app does not add any (it does not stamp itself
  as the Producer). The ~3 MB HEIC decoder is the one asset not precached, so HEIC needs one
  online use before it works offline; everything else, PDFs included, works offline from the
  first load.

## Development

```bash
npm ci
npm run dev        # dev server
npm test           # vitest: crypto round-trips, bias properties, UI flows
npm run typecheck  # tsc
npm run lint       # oxlint (no-console enforced)
npm run build      # production build + PWA
npm run preview    # serve the build at /genpass/
```

Pure logic lives in `src/lib/` (no React imports, unit-tested in Node against real Web Crypto);
React state glue in `src/state/`; components in `src/components/`. Deployed to GitHub Pages by
`.github/workflows/deploy.yml` on every push to `main` (tests + typecheck + lint + build must pass
first).

## License

MIT
