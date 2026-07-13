import { describe, expect, it } from 'vitest'
import { formatPaymentAmount } from '@/components/payment/currency'
import { batchImageCostLabel } from '../batchImageCost'

describe('batchImageCostLabel', () => {
  it.each([
    {
      name: 'legacy USD actual cost',
      job: { status: 'completed', hold_amount: 9, actual_cost: 8, currency: 'USD' },
      want: formatPaymentAmount(8, 'USD'),
    },
    {
      name: 'MYR actual cost',
      job: { status: 'completed', hold_amount: 9, actual_cost: 8, currency: 'MYR' },
      want: formatPaymentAmount(8, 'MYR'),
    },
    {
      name: 'legacy USD terminal zero',
      job: { status: 'failed', hold_amount: 9, actual_cost: null, currency: 'USD' },
      want: formatPaymentAmount(0, 'USD'),
    },
    {
      name: 'MYR active hold',
      job: { status: 'running', hold_amount: 9, actual_cost: null, currency: 'MYR' },
      want: `冻结 ${formatPaymentAmount(9, 'MYR')}`,
    },
  ])('$name', ({ job, want }) => {
    expect(batchImageCostLabel(job)).toBe(want)
  })
})
