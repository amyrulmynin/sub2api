import { describe, expect, it } from 'vitest'
import enCommon from '../locales/en/common'
import enDashboard from '../locales/en/dashboard'
import zhCommon from '../locales/zh/common'
import zhDashboard from '../locales/zh/dashboard'

describe('product currency copy', () => {
  it('formats reset quota confirmation values as RM', () => {
    expect(enDashboard.keys.resetQuotaConfirmMessage).toBe(
      'Are you sure you want to reset the used quota (RM{used}) for key "{name}" to 0? This action cannot be undone.',
    )
    expect(zhDashboard.keys.resetQuotaConfirmMessage).toBe(
      '确定要将密钥 "{name}" 的已用额度（RM{used}）重置为 0 吗？此操作不可撤销。',
    )
  })

  it('formats bare promo bonus values as RM', () => {
    expect(enCommon.auth.promoCodeValid).toBe('Valid! You will receive RM{amount} bonus balance')
    expect(zhCommon.auth.promoCodeValid).toBe('有效！注册后将获得 RM{amount} 赠送余额')
  })
})
