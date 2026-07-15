import { randomInt } from './random'

export type PassphraseSeparator = '-' | ' ' | '.' | '_' | ''

export interface PassphraseOptions {
  /** 3-10 in the UI. */
  wordCount: number
  separator: PassphraseSeparator
  /** Capitalize the first letter of every word. */
  capitalize: boolean
  /** Append one random digit to one randomly chosen word. */
  includeDigit: boolean
}

export function generatePassphrase(options: PassphraseOptions, wordlist: readonly string[]): string {
  const words: string[] = []
  for (let i = 0; i < options.wordCount; i++) {
    let word = wordlist[randomInt(wordlist.length)]!
    if (options.capitalize) word = word[0]!.toUpperCase() + word.slice(1)
    words.push(word)
  }
  if (options.includeDigit) {
    const position = randomInt(options.wordCount)
    words[position] += String(randomInt(10))
  }
  return words.join(options.separator)
}
