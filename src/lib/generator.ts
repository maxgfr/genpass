import { analyzePool, type CharsetOptions } from './charset'
import { randomInt, secureShuffle } from './random'

export interface GeneratePasswordOptions extends CharsetOptions {
  length: number
}

export type GeneratorErrorCode = 'NO_CLASS_SELECTED' | 'EMPTY_POOL' | 'LENGTH_TOO_SHORT'

export class GeneratorError extends Error {
  readonly code: GeneratorErrorCode
  constructor(code: GeneratorErrorCode, message: string) {
    super(message)
    this.name = 'GeneratorError'
    this.code = code
  }
}

function generateOne(options: GeneratePasswordOptions): string {
  const analysis = analyzePool(options)
  if (analysis.noClassSelected) {
    throw new GeneratorError('NO_CLASS_SELECTED', 'Select at least one character class.')
  }
  if (analysis.poolEmpty) {
    throw new GeneratorError('EMPTY_POOL', 'Every character has been excluded.')
  }
  if (options.length < analysis.guaranteedClasses.length) {
    throw new GeneratorError(
      'LENGTH_TOO_SHORT',
      `Length ${options.length} cannot include one character from each of the ${analysis.guaranteedClasses.length} selected classes.`,
    )
  }

  // One guaranteed pick per surviving class, remainder from the union pool,
  // then a secure shuffle so guaranteed characters carry no positional bias.
  const chars: string[] = analysis.guaranteedClasses.map(
    ({ chars }) => chars[randomInt(chars.length)]!,
  )
  while (chars.length < options.length) {
    chars.push(analysis.pool[randomInt(analysis.pool.length)]!)
  }
  return secureShuffle(chars).join('')
}

/** Generate `count` independent passwords (batch +1 / +10 in the UI). */
export function generatePasswords(options: GeneratePasswordOptions, count: number): string[] {
  return Array.from({ length: count }, () => generateOne(options))
}

export function generatePassword(options: GeneratePasswordOptions): string {
  return generateOne(options)
}
