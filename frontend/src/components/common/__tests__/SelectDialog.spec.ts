import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import BaseDialog from '../BaseDialog.vue'
import CommonSelect from '../Select.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

enableAutoUnmount(afterEach)

const options = Array.from({ length: 6 }, (_, index) => ({
  value: index + 1,
  label: `Option ${index + 1}`,
}))

describe('Select in BaseDialog', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.classList.remove('modal-open')
  })

  it('keeps searchable portal focus and Tab inside its dialog', async () => {
    mount(defineComponent({
      components: { BaseDialog, CommonSelect },
      setup: () => ({ options, value: ref(null) }),
      template: `
        <BaseDialog :show="true" title="Choose" :show-close-button="false">
          <CommonSelect v-model="value" :options="options" />
          <button data-test="dialog-action">Continue</button>
        </BaseDialog>
      `,
    }), {
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })
    await flushPromises()

    const trigger = document.querySelector<HTMLButtonElement>('.select-trigger')
    if (!trigger) throw new Error('Expected Select trigger')
    trigger.click()
    await flushPromises()

    const search = document.querySelector<HTMLInputElement>('.select-search-input')
    if (!search) throw new Error('Expected searchable Select input')
    expect(document.activeElement).toBe(search)

    search.value = 'Option 6'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(search.value).toBe('Option 6')
    expect(document.querySelectorAll('.select-option')).toHaveLength(1)

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    search.dispatchEvent(tab)
    await flushPromises()
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(trigger)
  })

  it('does not treat an outer dialog Select portal as owned by an inner dialog', async () => {
    const showInner = ref(false)
    mount(defineComponent({
      components: { BaseDialog, CommonSelect },
      setup: () => ({ options, value: ref(null), showInner }),
      template: `
        <BaseDialog :show="true" title="Outer" :show-close-button="false">
          <CommonSelect v-model="value" :options="options" />
          <BaseDialog :show="showInner" title="Inner" :show-close-button="false">
            <button data-test="inner-action">Inner action</button>
          </BaseDialog>
        </BaseDialog>
      `,
    }), {
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })
    await flushPromises()

    const trigger = document.querySelector<HTMLButtonElement>('.select-trigger')
    if (!trigger) throw new Error('Expected outer Select trigger')
    trigger.click()
    await flushPromises()
    const search = document.querySelector<HTMLInputElement>('.select-search-input')
    if (!search) throw new Error('Expected outer Select search input')

    showInner.value = true
    await flushPromises()
    const innerAction = document.querySelector<HTMLButtonElement>('[data-test="inner-action"]')
    if (!innerAction) throw new Error('Expected inner dialog action')
    expect(document.activeElement).toBe(innerAction)

    search.focus()
    expect(document.activeElement).toBe(innerAction)
  })
})
