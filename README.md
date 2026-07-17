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
- **Supply chain:** a single runtime dependency beyond React (`qrcode`, for QR module-matrix
  encoding). Web Crypto for everything cryptographic — no crypto libraries. A strict CSP
  (`default-src 'none'`, no external hosts) is injected at build time.

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
