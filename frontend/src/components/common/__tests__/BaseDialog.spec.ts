import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import BaseDialog from '../BaseDialog.vue'

enableAutoUnmount(afterEach)

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

  it('gives only the topmost dialog keyboard ownership and shares body lock', async () => {
    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    outsideButton.focus()

    const outer = mount(BaseDialog, {
      props: { show: true, title: 'Outer', showCloseButton: false },
      slots: { default: '<button data-test="outer">Outer action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const outerButton = document.querySelector<HTMLElement>('[data-test="outer"]')
    if (!outerButton) throw new Error('Expected outer dialog control')
    expect(document.activeElement).toBe(outerButton)

    const inner = mount(BaseDialog, {
      props: { show: true, title: 'Inner', showCloseButton: false },
      slots: { default: '<button data-test="inner">Inner action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const innerButton = document.querySelector<HTMLElement>('[data-test="inner"]')
    if (!innerButton) throw new Error('Expected inner dialog control')
    expect(document.activeElement).toBe(innerButton)
    expect(document.body.classList.contains('modal-open')).toBe(true)

    const preventedEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    preventedEscape.preventDefault()
    document.dispatchEvent(preventedEscape)
    expect(inner.emitted('close')).toBeUndefined()
    expect(outer.emitted('close')).toBeUndefined()

    let outerFocusCount = 0
    outerButton.addEventListener('focus', () => { outerFocusCount++ })
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    document.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(innerButton)
    expect(outerFocusCount).toBe(0)

    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    document.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(true)
    expect(inner.emitted('close')).toHaveLength(1)
    expect(outer.emitted('close')).toBeUndefined()

    await inner.setProps({ show: false })
    await flushPromises()
    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(document.activeElement).toBe(outerButton)

    await outer.setProps({ show: false })
    await flushPromises()
    expect(document.body.classList.contains('modal-open')).toBe(false)
    expect(document.activeElement).toBe(outsideButton)

    inner.unmount()
    outer.unmount()
  })

  it('cleans up visible stacked dialogs on unmount without stealing newer focus', async () => {
    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    outsideButton.focus()

    const outer = mount(BaseDialog, {
      props: { show: true, title: 'Outer', showCloseButton: false },
      slots: { default: '<button data-test="outer-unmount">Outer action</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    const outerButton = document.querySelector<HTMLElement>('[data-test="outer-unmount"]')
    if (!outerButton) throw new Error('Expected outer dialog control')

    const inner = mount(BaseDialog, {
      props: { show: true, title: 'Inner', showCloseButton: false },
      slots: { default: '<button data-test="inner-unmount">Inner action</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    const innerButton = document.querySelector<HTMLElement>('[data-test="inner-unmount"]')
    if (!innerButton) throw new Error('Expected inner dialog control')

    await outer.setProps({ show: false })
    await flushPromises()
    expect(document.activeElement).toBe(innerButton)
    expect(document.body.classList.contains('modal-open')).toBe(true)

    outer.unmount()
    expect(document.activeElement).toBe(innerButton)
    expect(document.body.classList.contains('modal-open')).toBe(true)

    inner.unmount()
    expect(document.body.classList.contains('modal-open')).toBe(false)
    expect(document.activeElement).not.toBe(innerButton)
  })

  it('restores outer dialog focus when a visible top dialog unmounts', async () => {
    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    outsideButton.focus()

    const outer = mount(BaseDialog, {
      props: { show: true, title: 'Outer', showCloseButton: false },
      slots: { default: '<button data-test="outer-restore">Outer action</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    const outerButton = document.querySelector<HTMLElement>('[data-test="outer-restore"]')
    if (!outerButton) throw new Error('Expected outer dialog control')

    const inner = mount(BaseDialog, {
      props: { show: true, title: 'Inner', showCloseButton: false },
      slots: { default: '<button data-test="inner-restore">Inner action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    inner.unmount()
    expect(document.activeElement).toBe(outerButton)
    expect(document.body.classList.contains('modal-open')).toBe(true)

    outer.unmount()
    expect(document.activeElement).toBe(outsideButton)
    expect(document.body.classList.contains('modal-open')).toBe(false)
  })

  it('excludes non-sequential and structurally disabled controls from focus order', async () => {
    const wrapper = mount(BaseDialog, {
      props: { show: true, title: 'Focus candidates', showCloseButton: false },
      slots: {
        default: `
          <button data-test="negative" tabindex="-1">Negative</button>
          <div inert><button data-test="inert">Inert</button></div>
          <fieldset disabled><button data-test="fieldset">Fieldset</button></fieldset>
          <button data-test="valid">Valid</button>
          <details>
            <summary data-test="summary">Summary</summary>
            <button data-test="closed-details">Closed details</button>
            <details>
              <summary data-test="nested-summary">Nested summary</summary>
            </details>
          </details>
        `,
      },
      attachTo: document.body,
    })

    await flushPromises()

    const summary = document.querySelector<HTMLElement>('[data-test="summary"]')
    const valid = document.querySelector<HTMLElement>('[data-test="valid"]')
    if (!summary || !valid) throw new Error('Expected sequential dialog controls')
    expect(document.activeElement).toBe(valid)

    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
    document.dispatchEvent(shiftTab)
    expect(document.activeElement).toBe(summary)

    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    document.dispatchEvent(tab)
    expect(document.activeElement).toBe(valid)

    wrapper.unmount()
  })
})
