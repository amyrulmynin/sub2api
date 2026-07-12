import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const pollOrderStatus = vi.hoisted(() => vi.fn())
const cancelOrder = vi.hoisted(() => vi.fn())
const verifyOrder = vi.hoisted(() => vi.fn())
const showError = vi.hoisted(() => vi.fn())
const toCanvas = vi.hoisted(() => vi.fn())

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        const values = params ? Object.values(params) : []
        return values.length ? `${key} ${values.join(' ')}` : key
      },
    }),
  }
})

vi.mock('@/stores/payment', () => ({
  usePaymentStore: () => ({
    pollOrderStatus,
  }),
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    showError,
  }),
}))

vi.mock('@/api/payment', () => ({
  paymentAPI: {
    cancelOrder,
    verifyOrder,
  },
}))

vi.mock('qrcode', () => ({
  default: {
    toCanvas,
  },
}))

import PaymentStatusPanel from '../PaymentStatusPanel.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'

const orderFactory = (status: string) => ({
  id: 42,
  user_id: 9,
  amount: 88,
  pay_amount: 88,
  fee_rate: 0,
  payment_type: 'alipay',
  out_trade_no: 'sub2_20260420abcd1234',
  status,
  order_type: 'balance',
  created_at: '2026-04-20T12:00:00Z',
  expires_at: '2099-01-01T12:30:00Z',
  refund_amount: 0,
})

describe('PaymentStatusPanel', () => {
  const exactAmountProps = {
    orderId: 42,
    qrCode: 'duitnow-qr',
    expiresAt: '2099-01-01T12:30:00Z',
    paymentType: 'mudahpay',
    currency: 'MYR',
    amount: 10,
    payAmount: 10.01,
    exactAmountAcknowledged: false,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    pollOrderStatus.mockReset()
    cancelOrder.mockReset()
    verifyOrder.mockReset()
    showError.mockReset()
    toCanvas.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats RECHARGING as a successful terminal state', async () => {
    pollOrderStatus.mockResolvedValue(orderFactory('RECHARGING'))

    const wrapper = mount(PaymentStatusPanel, {
      props: {
        orderId: 42,
        qrCode: 'https://pay.example.com/qr/42',
        expiresAt: '2099-01-01T12:30:00Z',
        paymentType: 'alipay',
        orderType: 'balance',
      },
      global: {
        stubs: {
          Icon: true,
        },
      },
    })

    await flushPromises()
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()

    expect(pollOrderStatus).toHaveBeenCalledWith(42)
    expect(wrapper.text()).toContain('payment.result.success')
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('shows reopen button in QR mode when payUrl is also available', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window)

    const wrapper = mount(PaymentStatusPanel, {
      props: {
        orderId: 42,
        qrCode: 'https://pay.example.com/qr/42',
        payUrl: 'https://pay.example.com/session/42',
        expiresAt: '2099-01-01T12:30:00Z',
        paymentType: 'alipay',
        orderType: 'balance',
      },
      global: {
        stubs: {
          Icon: true,
        },
      },
    })

    await flushPromises()
    expect(wrapper.text()).toContain('payment.qr.openPayWindow')

    await wrapper.get('button.btn.btn-secondary.text-sm').trigger('click')
    expect(openSpy).toHaveBeenCalledWith(
      'https://pay.example.com/session/42',
      'paymentPopup',
      expect.any(String),
    )

    openSpy.mockRestore()
  })

  it('uses generic QR copy for custom methods that contain built-in names', async () => {
    const wrapper = mount(PaymentStatusPanel, {
      props: {
        orderId: 42,
        qrCode: 'https://pay.example.com/qr/42',
        expiresAt: '2099-01-01T12:30:00Z',
        paymentType: 'card_alipay',
        orderType: 'balance',
      },
      global: {
        stubs: {
          Icon: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('payment.qr.scanToPay')
    expect(wrapper.text()).not.toContain('payment.qr.scanAlipay')
  })

  it('blocks MudahPay QR until exact amount is acknowledged', async () => {
    const wrapper = mount(PaymentStatusPanel, {
      props: { ...exactAmountProps, payUrl: 'https://pay.example.com/session/42' },
      attachTo: document.body,
      global: { stubs: { Icon: true, teleport: true } },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('payment.qr.exactAmountTitle')
    expect(wrapper.text()).toMatch(/RM\s?10\.01/)
    expect(wrapper.text()).toMatch(/RM\s?10\.00/)
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(toCanvas).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('payment.qr.payInNewWindowHint')
    expect(wrapper.text()).not.toContain('payment.qr.openPayWindow')
    expect(wrapper.text()).not.toContain('payment.qr.cancelOrder')

    const acknowledgeButton = wrapper.get('[data-test="acknowledge-exact-amount"]')
    expect(document.activeElement).toBe(acknowledgeButton.element)
    await acknowledgeButton.trigger('click')
    expect(wrapper.emitted('exactAmountAcknowledged')).toEqual([[42]])

    await wrapper.setProps({ exactAmountAcknowledged: true })
    await flushPromises()

    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(toCanvas).toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toMatch(/RM\s?10\.01/)

    wrapper.unmount()
  })

  it('renders acknowledged MudahPay QR with a persistent exact amount warning', async () => {
    const wrapper = mount(PaymentStatusPanel, {
      props: { ...exactAmountProps, exactAmountAcknowledged: true },
      global: { stubs: { Icon: true, teleport: true } },
    })

    await flushPromises()

    const warning = wrapper.get('[role="alert"]')
    expect(warning.text()).toContain('payment.qr.exactAmountPay')
    expect(warning.text()).toMatch(/RM\s?10\.01/)
    expect(warning.text()).toContain('payment.qr.exactAmountNotCheck')
    expect(warning.text()).toMatch(/RM\s?10\.00/)
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(toCanvas).toHaveBeenCalled()
  })

  it('uses the equal-amount persistent warning after acknowledgement', async () => {
    const wrapper = mount(PaymentStatusPanel, {
      props: {
        ...exactAmountProps,
        amount: 10.004,
        payAmount: 10.001,
        exactAmountAcknowledged: true,
      },
      global: { stubs: { Icon: true, teleport: true } },
    })

    await flushPromises()

    const warning = wrapper.get('[role="alert"]')
    expect(warning.text()).toContain('payment.qr.exactAmountCheck')
    expect(warning.text()).not.toContain('payment.qr.exactAmountNotCheck')
  })

  it('closes the exact amount gate when payment becomes terminal before acknowledgement', async () => {
    pollOrderStatus.mockResolvedValue(orderFactory('COMPLETED'))

    const wrapper = mount(PaymentStatusPanel, {
      props: exactAmountProps,
      global: { stubs: { Icon: true, teleport: true } },
    })

    await flushPromises()
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()

    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('payment.result.success')
    expect(wrapper.find('canvas').exists()).toBe(false)
  })

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not show a misleading exact amount modal for invalid payAmount %s',
    async (payAmount) => {
      const wrapper = mount(PaymentStatusPanel, {
        props: { ...exactAmountProps, payAmount },
        global: { stubs: { Icon: true, teleport: true } },
      })

      await flushPromises()

      expect(wrapper.text()).not.toContain('payment.qr.exactAmountTitle')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(wrapper.find('canvas').exists()).toBe(true)
      expect(toCanvas).toHaveBeenCalled()
    },
  )

  it('defaults missing MudahPay currency to MYR', async () => {
    const wrapper = mount(PaymentStatusPanel, {
      props: { ...exactAmountProps, currency: undefined },
      global: { stubs: { Icon: true, teleport: true } },
    })

    await flushPromises()

    expect(wrapper.text()).toMatch(/RM\s?10\.01/)
    expect(wrapper.text()).toMatch(/RM\s?10\.00/)
  })

  it.each(['alipay', 'custom_mudahpay'])(
    'renders non-MudahPay type %s immediately without an exact amount warning',
    async (paymentType) => {
      const wrapper = mount(PaymentStatusPanel, {
        props: { ...exactAmountProps, paymentType },
        global: { stubs: { Icon: true, teleport: true } },
      })

      await flushPromises()

      expect(wrapper.text()).not.toContain('payment.qr.exactAmountTitle')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(wrapper.find('canvas').exists()).toBe(true)
      expect(toCanvas).toHaveBeenCalled()
    },
  )

  it('normalizes MudahPay type before applying the exact amount gate', async () => {
    const wrapper = mount(PaymentStatusPanel, {
      props: { ...exactAmountProps, paymentType: ' MudahPay ' },
      global: { stubs: { Icon: true, teleport: true } },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('payment.qr.exactAmountTitle')
    expect(toCanvas).not.toHaveBeenCalled()
  })

  it('has no close, Escape, or backdrop dismissal route', async () => {
    const wrapper = mount(PaymentStatusPanel, {
      props: exactAmountProps,
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })

    await flushPromises()

    const dialog = wrapper.getComponent(BaseDialog)
    expect(document.querySelector('[aria-label="Close modal"]')).toBeNull()
    const overlay = document.querySelector<HTMLElement>('.modal-overlay')
    if (!overlay) throw new Error('Expected exact amount dialog overlay')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    overlay.click()
    await flushPromises()

    expect(dialog.emitted('close')).toBeUndefined()
    expect(document.querySelector('[data-test="acknowledge-exact-amount"]')).not.toBeNull()

    wrapper.unmount()
  })

  it('actively verifies a stuck pending order and settles it when upstream confirms payment', async () => {
    pollOrderStatus.mockResolvedValue(orderFactory('PENDING'))
    verifyOrder.mockResolvedValue({
      data: orderFactory('COMPLETED'),
    })

    const wrapper = mount(PaymentStatusPanel, {
      props: {
        orderId: 42,
        qrCode: 'https://pay.example.com/qr/42',
        expiresAt: '2099-01-01T12:30:00Z',
        paymentType: 'wxpay',
        orderType: 'balance',
      },
      global: {
        stubs: {
          Icon: true,
        },
      },
    })

    await flushPromises()
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()

    expect(pollOrderStatus).toHaveBeenCalledWith(42)
    expect(verifyOrder).toHaveBeenCalledWith('sub2_20260420abcd1234')
    expect(wrapper.text()).toContain('payment.result.success')
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
})
