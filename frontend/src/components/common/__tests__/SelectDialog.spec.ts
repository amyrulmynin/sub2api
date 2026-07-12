import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, inject, ref, watch } from 'vue'
import BaseDialog from '../BaseDialog.vue'
import CommonSelect from '../Select.vue'
import { dialogPortalKey } from '../dialogPortal'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

enableAutoUnmount(afterEach)

const options = Array.from({ length: 6 }, (_, index) => ({
  value: index + 1,
  label: `Option ${index + 1}`,
}))

function ownerProbe(onChange: (isOwner: boolean) => void) {
  return defineComponent({
    setup() {
      const dialogPortal = inject(dialogPortalKey)
      if (!dialogPortal) throw new Error('Expected dialog portal context')
      watch(dialogPortal.isVisualOwner, onChange, { flush: 'sync' })
      return () => h('span')
    },
  })
}

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

  it('closes an outer Select while an inner dialog owns interaction', async () => {
    const showInner = ref(false)
    const value = ref<number | null>(null)
    mount(defineComponent({
      components: { BaseDialog, CommonSelect },
      setup: () => ({ options, value, showInner }),
      template: `
        <BaseDialog :show="true" title="Outer" :show-close-button="false">
          <CommonSelect v-model="value" :options="options" />
          <BaseDialog :show="showInner" title="Inner" :show-close-button="false" :z-index="60">
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
    const staleOption = document.querySelector<HTMLElement>('.select-option')
    if (!staleOption) throw new Error('Expected outer Select option')

    showInner.value = true
    await flushPromises()
    const innerAction = document.querySelector<HTMLButtonElement>('[data-test="inner-action"]')
    if (!innerAction) throw new Error('Expected inner dialog action')
    expect(document.activeElement).toBe(innerAction)

    const outerDropdown = document.querySelector<HTMLElement>('.select-dropdown-portal')
    if (outerDropdown) {
      expect(outerDropdown.classList.contains('select-dropdown-inactive')).toBe(true)
      expect({
        ariaHidden: outerDropdown.getAttribute('aria-hidden'),
        optionPointerEvents: getComputedStyle(staleOption).pointerEvents,
        pointerEvents: getComputedStyle(outerDropdown).pointerEvents,
      }).toEqual({ ariaHidden: 'true', optionPointerEvents: 'none', pointerEvents: 'none' })
    }
    staleOption.click()
    expect(value.value).toBeNull()
    trigger.click()
    await flushPromises()
    expect(document.querySelectorAll('.select-dropdown-portal')).toHaveLength(outerDropdown ? 1 : 0)
    expect(document.querySelector<HTMLElement>('.select-dropdown-portal')?.getAttribute('aria-hidden')).toBe('true')

    search.focus()
    expect(document.activeElement).toBe(innerAction)

    showInner.value = false
    await flushPromises()
    trigger.click()
    await flushPromises()
    const reopenedDropdown = document.querySelector<HTMLElement>('.select-dropdown-portal')
    if (!reopenedDropdown) throw new Error('Expected outer Select to reopen')
    expect(reopenedDropdown.hasAttribute('inert')).toBe(false)
    expect(reopenedDropdown.getAttribute('aria-hidden')).toBeNull()
    expect(reopenedDropdown.style.pointerEvents).not.toBe('none')
    reopenedDropdown.querySelector<HTMLElement>('.select-option')?.click()
    expect(value.value).toBe(1)
  })

  it('keeps the painted owner active during an equal-z dialog reopen', async () => {
    const showFirst = ref(true)
    const ownerStates: boolean[] = []
    const OwnerProbe = ownerProbe(isOwner => ownerStates.push(isOwner))
    mount(defineComponent({
      components: { BaseDialog, CommonSelect, OwnerProbe },
      setup: () => ({ options, showFirst, value: ref(null) }),
      template: `
        <BaseDialog :show="showFirst" title="First" :show-close-button="false">
          <button data-test="first-action">First action</button>
        </BaseDialog>
        <BaseDialog :show="true" title="Second" :show-close-button="false">
          <CommonSelect v-model="value" :options="options" />
          <OwnerProbe />
        </BaseDialog>
      `,
    }), {
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })
    await flushPromises()

    const trigger = document.querySelector<HTMLButtonElement>('.select-trigger')
    if (!trigger) throw new Error('Expected painted owner Select trigger')
    trigger.click()
    await flushPromises()
    expect(document.querySelector('.select-dropdown-portal')).not.toBeNull()

    const firstOverlay = document.querySelector<HTMLElement>('[data-test="first-action"]')?.closest('.modal-overlay')
    if (!firstOverlay) throw new Error('Expected first dialog overlay')
    showFirst.value = false
    await flushPromises()
    firstOverlay.remove()
    expect(firstOverlay.isConnected).toBe(false)

    ownerStates.length = 0
    showFirst.value = true
    await flushPromises()

    expect(ownerStates).not.toContain(false)
    expect(document.querySelector('.select-dropdown-portal')).not.toBeNull()
  })

  it('transfers ownership when a disconnected higher-z dialog connects', async () => {
    const showInner = ref(false)
    const ownerLossOverlayStates: boolean[] = []
    const OwnerProbe = ownerProbe(isOwner => {
      if (!isOwner) {
        const highOverlay = document.querySelector<HTMLElement>('[data-test="high-action"]')?.closest('.modal-overlay')
        ownerLossOverlayStates.push(highOverlay?.isConnected === true)
      }
    })
    mount(defineComponent({
      components: { BaseDialog, CommonSelect, OwnerProbe },
      setup: () => ({ options, showInner, value: ref(null) }),
      template: `
        <BaseDialog :show="true" title="Outer" :show-close-button="false">
          <CommonSelect v-model="value" :options="options" />
          <OwnerProbe />
        </BaseDialog>
        <BaseDialog :show="showInner" title="Inner" :show-close-button="false" :z-index="80">
          <button data-test="high-action">High action</button>
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
    expect(document.querySelector('.select-dropdown-portal')).not.toBeNull()

    showInner.value = true
    await flushPromises()

    const highAction = document.querySelector<HTMLButtonElement>('[data-test="high-action"]')
    if (!highAction) throw new Error('Expected connected high-z dialog')
    expect(document.activeElement).toBe(highAction)
    expect(ownerLossOverlayStates).toEqual([true])
    const staleDropdown = document.querySelector<HTMLElement>('.select-dropdown-portal')
    if (staleDropdown) {
      expect(staleDropdown.getAttribute('aria-hidden')).toBe('true')
      expect(getComputedStyle(staleDropdown).pointerEvents).toBe('none')
    }
  })
})
