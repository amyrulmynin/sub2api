import { describe, expect, it } from 'vitest'
import { formatCurrency, PRODUCT_CURRENCY, PRODUCT_CURRENCY_SYMBOL } from '../format'

describe('product currency', () => {
  it('uses MYR at a 1:1 numeric value', () => {
    expect(PRODUCT_CURRENCY).toBe('MYR')
    expect(PRODUCT_CURRENCY_SYMBOL).toBe('RM')
    expect(formatCurrency(10)).toMatch(/^RM\s?10\.00$/)
  })

  it('keeps tiny product costs visible', () => {
    expect(formatCurrency(0.001234)).toMatch(/^RM\s?0\.001234$/)
  })

  it('formats null and invalid values safely', () => {
    expect(formatCurrency(null)).toMatch(/^RM\s?0\.00$/)
    expect(formatCurrency(Number.NaN)).toMatch(/^RM\s?0\.00$/)
  })

  it('preserves explicit provider currencies', () => {
    expect(formatCurrency(10, 'USD')).toContain('$')
  })
})
