---
name: verify
description: How to run and drive genpass end-to-end to verify a change (build/launch/drive recipe, known gotchas)
---

# Verifying genpass end-to-end

## Launch

- **Do NOT use `npm run dev` for verification**: the app crashes on load under
  React StrictMode's double-effect invocation (`Invalid vault transition:
  INITIALIZED while uninitialized` from `VaultProvider`'s init effect) and
  renders a blank page. Pre-existing, dev-only.
- Use the production build instead: `npm run build && npm run preview` →
  http://localhost:4173/genpass/ (base path `/genpass/` matters).

## Drive (Playwright)

- The repo has no Playwright dep. Install it in the session scratchpad
  (`npm i playwright`); cached Chromium builds under
  `~/Library/Caches/ms-playwright` are picked up, no download.
- Useful selectors: tabs are `role=tab` (name "Share & QR"); share mode toggle
  is `role=radio` ("Encrypted link" / "QR code"); fields by label (`Secret`,
  `Passphrase`, `Link expires`); share dialog secret renders in
  `.share__secret`; errors/expired state have `role=alert`.
- Opening any URL with `#s=…` triggers the share-open dialog.
- To simulate share-link expiry, `page.clock.install({ time: Date.now() + N })`
  **before goto, once per BrowserContext** — a second install in the same
  context hangs; use a fresh context per clock scenario.
