import { describe, expect, it } from 'vitest'
import enAdminResources from '../locales/en/admin/resources'
import zhAdminResources from '../locales/zh/admin/resources'

describe('admin product currency copy', () => {
  it('labels redeem and promo product amounts in MYR', () => {
    expect(enAdminResources.redeem.amount).toBe('Amount (RM)')
    expect(zhAdminResources.redeem.amount).toBe('金额 (RM)')
    expect(enAdminResources.promo.bonusAmount).toBe('Bonus Amount (RM)')
    expect(zhAdminResources.promo.bonusAmount).toBe('赠送金额 (RM)')
  })
})
