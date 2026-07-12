import { describe, expect, it } from 'vitest'

import { formatScaled } from '@/utils/pricing'
import { formatTokenPricePerMillion } from '@/utils/usagePricing'

describe('product price formatting', () => {
  it('formats scaled prices in RM', () => {
    expect(formatScaled(0.000003, 1_000_000)).toBe('RM3')
    expect(formatScaled(0.5, 1)).toBe('RM0.5')
    expect(formatScaled(null, 1_000_000)).toBe('-')
  })

  it('formats per-million token prices in RM', () => {
    expect(formatTokenPricePerMillion(0.03, 10_000)).toBe('RM3.0000')
    expect(formatTokenPricePerMillion(0.03, 10_000, { withCurrencySymbol: false })).toBe('3.0000')
    expect(formatTokenPricePerMillion(1, 0)).toBe('-')
  })
})
