# Product

## Register

product

## Platform

web

## Users

Privacy-conscious individuals who need a strong password right now — while signing up for a service, rotating a credential, or setting up a device — and want a small number of generated secrets kept close at hand. They use it in the browser, sometimes offline, on desktop and phone. They are skeptical of cloud password tools by default; the reason they open this one is precisely that it has no server side.

## Product Purpose

genpass generates cryptographically strong passwords and passphrases and optionally stores them in a vault encrypted with a master password — entirely on the user's device. There is no backend, no account, no telemetry, no network call. Success means: a user can generate, copy, save, lock, and later retrieve a password with the network cable unplugged, and nothing readable ever touches disk.

## Positioning

A password generator and vault that never talks to a server — everything happens, and stays, on your device.

## Brand Personality

Trustworthy, precise, calm. The interface speaks plainly about security (exact entropy bits, a stated threat model, "unrecoverable by design") and never dramatizes it. Confidence comes from clarity, not from lock icons and scare copy.

## Anti-references

- Ad-laden "online password generator" sites with fake meters and upsells.
- Hacker-aesthetic green-on-black terminal theming and security theater.
- Enterprise password-manager marketing surfaces (testimonials, trust badges, gradient heroes).

## Design Principles

- Trust through transparency: show the real numbers (entropy bits, iteration counts) and state limits honestly (clipboard clearing is best-effort, a forgotten master password is unrecoverable).
- The tool disappears into the task: generate in one click, copy in one click, save in two.
- Security state is first-class UI: locked vs. unlocked is always visible, never ambiguous.
- Familiar affordances only: standard toggles, sliders, tabs, and dialogs — no invented controls.
- Offline is the baseline, not a degraded mode.

## Accessibility & Inclusion

WCAG 2.2 AA. Full keyboard operability, visible focus, `aria-live` announcements for copy/lock feedback, ≥7:1 body-text contrast, `prefers-reduced-motion` respected, touch targets ≥44px on mobile.
