import { describe, expect, it } from 'vitest'
import enAdminAccounts from '../locales/en/admin/accounts'
import enAdminOverview from '../locales/en/admin/overview'
import enAdminResources from '../locales/en/admin/resources'
import zhAdminAccounts from '../locales/zh/admin/accounts'
import zhAdminOverview from '../locales/zh/admin/overview'
import zhAdminResources from '../locales/zh/admin/resources'

describe('admin product currency copy', () => {
  it('labels redeem and promo product amounts in MYR', () => {
    expect(enAdminResources.redeem.amount).toBe('Amount (RM)')
    expect(zhAdminResources.redeem.amount).toBe('金额 (RM)')
    expect(enAdminResources.promo.bonusAmount).toBe('Bonus Amount (RM)')
    expect(zhAdminResources.promo.bonusAmount).toBe('赠送金额 (RM)')
  })

  it('labels subscription limits in MYR without USD or dollar symbols', () => {
    const copy = [
      enAdminOverview.groups.subscription.dailyLimit,
      enAdminOverview.groups.subscription.weeklyLimit,
      enAdminOverview.groups.subscription.monthlyLimit,
      zhAdminOverview.groups.subscription.dailyLimit,
      zhAdminOverview.groups.subscription.weeklyLimit,
      zhAdminOverview.groups.subscription.monthlyLimit,
    ]

    copy.forEach((value) => {
      expect(value).toContain('MYR')
      expect(value).not.toMatch(/USD|\$/)
    })
  })

  it('describes video prices in MYR and RM without USD or dollar symbols', () => {
    const copy = [
      enAdminOverview.groups.videoPricing.description,
      zhAdminOverview.groups.videoPricing.description,
    ]

    copy.forEach((value) => {
      expect(value).toContain('MYR')
      expect(value).toContain('RM')
      expect(value).not.toMatch(/USD|\$/)
    })
  })

  it('describes account quota limits in MYR without USD or dollar symbols', () => {
    const copy = [
      enAdminAccounts.accounts.quotaLimitHint,
      zhAdminAccounts.accounts.quotaLimitHint,
    ]

    copy.forEach((value) => {
      expect(value).toContain('MYR')
      expect(value).not.toMatch(/USD|\$/)
    })
  })
})
