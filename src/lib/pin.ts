// Digits-only secrets, for services that accept nothing else (bank codes,
// SIM PINs, phone locks). Deliberately weak by construction — the strength
// meter says so — but a real requirement, so it gets a real mode.

import { CLASS_CHARS } from './charset'
import { generatePasswords } from './generator'

/** Derived from charset.ts so the pool stays defined in exactly one place. */
export const PIN_POOL_SIZE = CLASS_CHARS.digits.length

/** Uniform over 10^length: no pattern filtering (no rejecting 1234 or 0000),
 *  so the displayed `length × log2(10)` stays exactly the real entropy. */
export function generatePins(length: number, count: number): string[] {
  return generatePasswords(
    {
      length,
      uppercase: false,
      lowercase: false,
      digits: true,
      symbols: false,
      // Excluding "similar" glyphs would drop 0 1 2 5 8 and leave five digits;
      // meaningless on a numeric keypad, so neither exclusion is exposed.
      excludeSimilar: false,
      excludeCustom: '',
    },
    count,
  )
}
