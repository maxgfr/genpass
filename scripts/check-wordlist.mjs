// CI guard: the bundled EFF wordlist must contain exactly 7776 unique words.
// A silently truncated or duplicated list would reduce real passphrase entropy
// while the UI keeps displaying log2(7776) per word.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const path = fileURLToPath(new URL('../src/assets/eff-large-wordlist.txt', import.meta.url))
const words = readFileSync(path, 'utf8')
  .split('\n')
  .map((w) => w.trim())
  .filter(Boolean)

const unique = new Set(words)
if (words.length !== 7776 || unique.size !== 7776) {
  console.error(`wordlist check FAILED: ${words.length} lines, ${unique.size} unique (expected 7776/7776)`)
  process.exit(1)
}
// The official list contains four hyphenated words (drop-down, felt-tip, t-shirt, yo-yo).
if (words.some((w) => !/^[a-z-]+$/.test(w))) {
  console.error('wordlist check FAILED: unexpected characters in entries')
  process.exit(1)
}
console.log('wordlist ok: 7776 unique words')
