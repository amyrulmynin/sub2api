import { PRODUCT_CURRENCY_SYMBOL } from '@/utils/format'

/**
 * formatScaled formats a per-token (or per-request) product price scaled by `scale`.
 *
 *   formatScaled(0.000003, 1_000_000) → "RM3"        // per 1M tokens
 *   formatScaled(0.5,        1)        → "RM0.5"      // per request
 *   formatScaled(null,       1_000_000) → "-"
 *
 * Uses toPrecision(10) then strips trailing zeros to avoid IEEE 754 display noise.
 */
export function formatScaled(value: number | null, scale: number): string {
  if (value == null) return '-'
  return `${PRODUCT_CURRENCY_SYMBOL}${(value * scale).toPrecision(10).replace(/\.?0+$/, '')}`
}
