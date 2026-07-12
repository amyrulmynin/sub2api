import { describe, expect, it } from 'vitest'
import enAdminAccounts from '../locales/en/admin/accounts'
import enAdminOverview from '../locales/en/admin/overview'
import enAdminResources from '../locales/en/admin/resources'
import enAdminSettings from '../locales/en/admin/settings'
import zhAdminAccounts from '../locales/zh/admin/accounts'
import zhAdminOverview from '../locales/zh/admin/overview'
import zhAdminResources from '../locales/zh/admin/resources'
import zhAdminSettings from '../locales/zh/admin/settings'

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

  it('labels user and settings platform quotas in MYR', () => {
    expect(enAdminOverview.users.platformQuota.subtitle).toBe(
      'Configure daily / weekly / monthly MYR usage limits for each upstream platform for user {email}',
    )
    expect(enAdminOverview.users.platformQuota.columns.daily).toBe('Daily (MYR)')
    expect(enAdminOverview.users.platformQuota.columns.weekly).toBe('Weekly (MYR)')
    expect(enAdminOverview.users.platformQuota.columns.monthly).toBe('Monthly (MYR, 30-day rolling)')
    expect(zhAdminOverview.users.platformQuota.subtitle).toBe(
      '为用户 {email} 配置各上游平台的日 / 周 / 月 MYR 用量上限',
    )
    expect(zhAdminOverview.users.platformQuota.columns.daily).toBe('日 (MYR)')
    expect(zhAdminOverview.users.platformQuota.columns.weekly).toBe('周 (MYR)')
    expect(zhAdminOverview.users.platformQuota.columns.monthly).toBe('月 (MYR, 30天滚动)')
    expect(enAdminSettings.settings.platformQuota.daily).toBe('Daily (MYR)')
    expect(enAdminSettings.settings.platformQuota.weekly).toBe('Weekly (MYR)')
    expect(enAdminSettings.settings.platformQuota.monthly).toBe('Monthly (MYR, 30d rolling)')
    expect(zhAdminSettings.settings.platformQuota.daily).toBe('日限额 (MYR)')
    expect(zhAdminSettings.settings.platformQuota.weekly).toBe('周限额 (MYR)')
    expect(zhAdminSettings.settings.platformQuota.monthly).toBe('月限额 (MYR, 30天滚动)')
  })

  it('describes recharge credit and legacy plan conversion keys using MYR product money', () => {
    expect(enAdminSettings.settings.payment.balanceRechargeMultiplierHint).toBe(
      'How much MYR product balance the user receives for each 1 CNY paid',
    )
    expect(enAdminSettings.settings.payment.balanceRechargePreview).toBe('Preview: 1 CNY = {usd} MYR')
    expect(enAdminSettings.settings.payment.subscriptionUsdToCnyRate).toBe('MYR Plan Price to CNY Payment Rate')
    expect(enAdminSettings.settings.payment.subscriptionUsdToCnyRateHint).toBe(
      'CNY provider payment amount per 1 MYR of plan price (e.g. 1.55). 0 or empty = disabled; CNY channels charge the plan price value as-is. When enabled, all plan prices must be set in MYR',
    )
    expect(zhAdminSettings.settings.payment.balanceRechargeMultiplierHint).toBe(
      '用户每支付 1 CNY 可获得多少 MYR 产品余额',
    )
    expect(zhAdminSettings.settings.payment.balanceRechargePreview).toBe('预览：1 CNY = {usd} MYR')
    expect(zhAdminSettings.settings.payment.subscriptionUsdToCnyRate).toBe('MYR 套餐价格转 CNY 支付汇率')
    expect(zhAdminSettings.settings.payment.subscriptionUsdToCnyRateHint).toBe(
      'CNY 支付通道按每 1 MYR 套餐价格收取的 CNY 支付金额（如 1.55）。0 或留空 = 不换算，CNY 通道按套餐 price 数值直接收款。启用后所有套餐 price 必须按 MYR 定价',
    )
  })
})
