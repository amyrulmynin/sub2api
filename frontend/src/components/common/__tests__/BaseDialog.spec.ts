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

  it('gives keyboard ownership to highest z-index regardless of registration order', async () => {
    const high = mount(BaseDialog, {
      props: { show: true, title: 'High', showCloseButton: false, zIndex: 80 },
      slots: { default: '<button data-test="high-z">High action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const low = mount(BaseDialog, {
      props: { show: true, title: 'Low', showCloseButton: false, zIndex: 40 },
      slots: { default: '<button data-test="low-z">Low action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const highButton = document.querySelector<HTMLElement>('[data-test="high-z"]')
    if (!highButton) throw new Error('Expected high-z dialog control')
    expect(document.activeElement).toBe(highButton)

    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    highButton.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(highButton)

    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    highButton.dispatchEvent(escape)
    expect(high.emitted('close')).toHaveLength(1)
    expect(low.emitted('close')).toBeUndefined()

    low.unmount()
    high.unmount()
  })

  it('uses later registration as keyboard owner when z-index values match', async () => {
    const first = mount(BaseDialog, {
      props: { show: true, title: 'First', showCloseButton: false, zIndex: 60 },
      slots: { default: '<button data-test="equal-first">First action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const second = mount(BaseDialog, {
      props: { show: true, title: 'Second', showCloseButton: false, zIndex: 60 },
      slots: { default: '<button data-test="equal-second">Second action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const secondButton = document.querySelector<HTMLElement>('[data-test="equal-second"]')
    if (!secondButton) throw new Error('Expected later equal-z dialog control')
    secondButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    expect(second.emitted('close')).toHaveLength(1)
    expect(first.emitted('close')).toBeUndefined()

    second.unmount()
    first.unmount()
  })

  it('falls back to the next visual owner when captured focus is disconnected', async () => {
    const outer = mount(BaseDialog, {
      props: { show: true, title: 'Outer', showCloseButton: false, zIndex: 40 },
      slots: { default: '<button data-test="fallback-outer">Outer action</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    const outerButton = document.querySelector<HTMLElement>('[data-test="fallback-outer"]')
    if (!outerButton) throw new Error('Expected fallback outer control')

    const middle = mount(BaseDialog, {
      props: { show: true, title: 'Middle', showCloseButton: false, zIndex: 50 },
      slots: { default: '<button data-test="fallback-middle">Middle action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const top = mount(BaseDialog, {
      props: { show: true, title: 'Top', showCloseButton: false, zIndex: 60 },
      slots: { default: '<button data-test="fallback-top">Top action</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    const topButton = document.querySelector<HTMLElement>('[data-test="fallback-top"]')
    if (!topButton) throw new Error('Expected fallback top control')
    expect(document.activeElement).toBe(topButton)

    await middle.setProps({ show: false })
    await flushPromises()
    expect(document.activeElement).toBe(topButton)

    await top.setProps({ show: false })
    await flushPromises()
    expect(document.activeElement).toBe(outerButton)

    top.unmount()
    middle.unmount()
    outer.unmount()
  })

  it('consumes Escape at the top dialog even when Escape close is disabled', async () => {
    const wrapper = mount(BaseDialog, {
      props: {
        show: true,
        title: 'Required',
        showCloseButton: false,
        closeOnEscape: false,
      },
      slots: { default: '<button data-test="required-action">Required action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const button = document.querySelector<HTMLElement>('[data-test="required-action"]')
    if (!button) throw new Error('Expected required dialog control')
    let reachedTarget = false
    button.addEventListener('keydown', () => { reachedTarget = true })

    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
    button.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(true)
    expect(reachedTarget).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()

    wrapper.unmount()
  })

  it('keeps first-legend controls and links focusable inside a disabled fieldset', async () => {
    const wrapper = mount(BaseDialog, {
      props: { show: true, title: 'Fieldset', showCloseButton: false },
      slots: {
        default: `
          <fieldset disabled>
            <legend><button data-test="legend-control">Legend control</button></legend>
            <button data-test="fieldset-control">Fieldset control</button>
            <a href="#" data-test="fieldset-link">Fieldset link</a>
          </fieldset>
        `,
      },
      attachTo: document.body,
    })
    await flushPromises()

    const legendControl = document.querySelector<HTMLElement>('[data-test="legend-control"]')
    const fieldsetLink = document.querySelector<HTMLElement>('[data-test="fieldset-link"]')
    if (!legendControl || !fieldsetLink) throw new Error('Expected fieldset focus controls')
    expect(document.activeElement).toBe(legendControl)

    legendControl.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }))
    expect(document.activeElement).toBe(fieldsetLink)

    fieldsetLink.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    expect(document.activeElement).toBe(legendControl)

    wrapper.unmount()
  })
})
