import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AmountInput from '../AmountInput.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

describe('AmountInput', () => {
  it('shows selected payment currency symbol', async () => {
    const wrapper = mount(AmountInput, {
      props: {
        modelValue: null,
        currency: 'MYR',
      },
    })

    expect(wrapper.text()).toContain('RM')
    expect(wrapper.text()).not.toContain('$')
    expect(wrapper.get('input').classes()).toContain('pl-14')

    await wrapper.setProps({ currency: 'USD' })
    expect(wrapper.text()).toContain('$')
    expect(wrapper.text()).not.toContain('RM')
  })
})
