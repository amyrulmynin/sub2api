import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BaseDialog from '../BaseDialog.vue'

describe('BaseDialog', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.body.classList.remove('modal-open')
  })

  it('traps Tab and Shift+Tab among enabled visible controls and restores focus', async () => {
    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    outsideButton.focus()

    const wrapper = mount(BaseDialog, {
      props: { show: true, title: 'Focus trap', showCloseButton: false },
      slots: {
        default: `
          <button data-test="first">First</button>
          <button data-test="disabled" disabled>Disabled</button>
          <button data-test="hidden" hidden>Hidden</button>
          <button data-test="last">Last</button>
        `,
      },
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })

    await flushPromises()

    const first = document.querySelector<HTMLElement>('[data-test="first"]')
    const last = document.querySelector<HTMLElement>('[data-test="last"]')
    if (!first || !last) throw new Error('Expected dialog focus controls')
    expect(document.activeElement).toBe(first)

    first.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }))
    expect(document.activeElement).toBe(last)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    expect(document.activeElement).toBe(first)

    await wrapper.setProps({ show: false })
    await flushPromises()
    expect(document.activeElement).toBe(outsideButton)

    wrapper.unmount()
  })

  it('focuses and contains focus on the dialog panel when no controls exist', async () => {
    const wrapper = mount(BaseDialog, {
      props: { show: true, title: 'No controls', showCloseButton: false },
      attachTo: document.body,
    })

    await flushPromises()

    const panel = document.querySelector<HTMLElement>('.modal-content')
    if (!panel) throw new Error('Expected dialog panel')
    expect(panel.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(panel)

    document.body.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    expect(document.activeElement).toBe(panel)

    wrapper.unmount()
  })
})
