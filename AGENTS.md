# genpass

Offline password generator and encrypted vault (React + Vite, deployed to GitHub Pages under
`/genpass/`). See `README.md` for features and the development commands; CI runs
`node scripts/check-wordlist.mjs`, `npm run lint`, `npm run typecheck`, `npm test` and
`npm run build`.

## Verifying a change

- **Don't verify with `npm run dev`**: under React StrictMode's double-effect invocation the app
  crashes on load (`Invalid vault transition: INITIALIZED while uninitialized` from
  `VaultProvider`'s init effect) and renders a blank page. Pre-existing, dev-only.
- Use the production build: `npm run build && npm run preview` → http://localhost:4173/genpass/
  (the `/genpass/` base path matters).
- Drive it with Playwright, which is not a repo dependency: `npm i playwright` in a scratch
  directory; cached Chromium builds under `~/Library/Caches/ms-playwright` are reused, no download.
- Selectors: tabs are `role=tab` (e.g. "Share & QR"); the share mode toggle is `role=radio`
  ("Encrypted link" / "QR code"); fields by label (`Secret`, `Passphrase`, `Link expires`); the
  share dialog's secret renders in `.share__secret`; errors and the expired state are `role=alert`.
- Opening any URL with `#s=…` triggers the share-open dialog.
- To simulate share-link expiry, call `page.clock.install({ time: Date.now() + N })` **before
  `goto`, once per BrowserContext** — a second install in the same context hangs, so use a fresh
  context per clock scenario.

## Skills

This repo ships no skills of its own. Generic process skills (`verify`, `build`, `blueprint`) come
from maxgfr/skills and are installed once for your agent with `npx skills add maxgfr/skills -g`;
use them only when the user asks for them, with the facts above for the verification step.
