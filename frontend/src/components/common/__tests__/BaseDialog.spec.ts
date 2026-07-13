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

    const preventedTab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    preventedTab.preventDefault()
    document.dispatchEvent(preventedTab)
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

  it('makes only the visual owner modal and hides stacked non-owners', async () => {
    const low = mount(BaseDialog, {
      props: { show: true, title: 'Low', showCloseButton: false, zIndex: 40 },
      slots: { default: '<button data-test="aria-low">Low action</button>' },
      attachTo: document.body,
    })
    const high = mount(BaseDialog, {
      props: { show: true, title: 'High', showCloseButton: false, zIndex: 80 },
      slots: { default: '<button data-test="aria-high">High action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const lowOverlay = document.querySelector<HTMLElement>('[data-test="aria-low"]')?.closest('.modal-overlay')
    const highOverlay = document.querySelector<HTMLElement>('[data-test="aria-high"]')?.closest('.modal-overlay')
    if (!lowOverlay || !highOverlay) throw new Error('Expected stacked overlays')
    expect({
      inert: lowOverlay.hasAttribute('inert'),
      ariaHidden: lowOverlay.getAttribute('aria-hidden'),
      ariaModal: lowOverlay.getAttribute('aria-modal'),
    }).toEqual({ inert: true, ariaHidden: 'true', ariaModal: null })
    expect({
      inert: highOverlay.hasAttribute('inert'),
      ariaHidden: highOverlay.getAttribute('aria-hidden'),
      ariaModal: highOverlay.getAttribute('aria-modal'),
    }).toEqual({ inert: false, ariaHidden: null, ariaModal: 'true' })

    high.unmount()
    await flushPromises()
    expect(lowOverlay.hasAttribute('inert')).toBe(false)
    expect(lowOverlay.getAttribute('aria-hidden')).toBeNull()
    expect(lowOverlay.getAttribute('aria-modal')).toBe('true')
    low.unmount()
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

  it('preserves external focus across non-LIFO visual closes', async () => {
    const outsideButton = document.createElement('button')
    document.body.appendChild(outsideButton)
    outsideButton.focus()

    const high = mount(BaseDialog, {
      props: { show: true, title: 'High chain', showCloseButton: false, zIndex: 80 },
      slots: { default: '<button data-test="chain-high">High action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const low = mount(BaseDialog, {
      props: { show: true, title: 'Low chain', showCloseButton: false, zIndex: 40 },
      slots: { default: '<button data-test="chain-low">Low action</button>' },
      attachTo: document.body,
    })
    await flushPromises()
    const lowButton = document.querySelector<HTMLElement>('[data-test="chain-low"]')
    if (!lowButton) throw new Error('Expected low chain control')

    await high.setProps({ show: false })
    await flushPromises()
    expect(document.activeElement).toBe(lowButton)

    await low.setProps({ show: false })
    await flushPromises()
    expect(document.activeElement).toBe(outsideButton)

    low.unmount()
    high.unmount()
  })

  it('uses live equal-z overlay paint order after reopening an earlier dialog', async () => {
    const first = mount(BaseDialog, {
      props: { show: true, title: 'Reopen first', showCloseButton: false, zIndex: 60 },
      slots: { default: '<button data-test="reopen-first">First action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const second = mount(BaseDialog, {
      props: { show: true, title: 'Reopen second', showCloseButton: false, zIndex: 60 },
      slots: { default: '<button data-test="reopen-second">Second action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    await first.setProps({ show: false })
    await flushPromises()
    await first.setProps({ show: true })
    await flushPromises()

    const firstOverlay = document.querySelector<HTMLElement>('[data-test="reopen-first"]')?.closest('.modal-overlay')
    const secondButton = document.querySelector<HTMLElement>('[data-test="reopen-second"]')
    if (!secondButton) throw new Error('Expected later-painted second control')
    const secondOverlay = secondButton.closest('.modal-overlay')
    if (!firstOverlay || !secondOverlay) throw new Error('Expected equal-z overlays')
    expect(firstOverlay.compareDocumentPosition(secondOverlay) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)

    secondButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }))
    expect(second.emitted('close')).toHaveLength(1)
    expect(first.emitted('close')).toBeUndefined()

    second.unmount()
    first.unmount()
  })

  it('isolates Escape after an earlier capture listener prevents default', async () => {
    const preventFirst = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault()
    }
    let backgroundCalls = 0
    const backgroundListener = () => { backgroundCalls++ }
    document.addEventListener('keydown', preventFirst, true)

    try {
      const wrapper = mount(BaseDialog, {
        props: { show: true, title: 'Escape isolation', showCloseButton: false },
        slots: { default: '<button data-test="escape-isolation">Action</button>' },
        attachTo: document.body,
      })
      await flushPromises()
      document.addEventListener('keydown', backgroundListener, true)

      const button = document.querySelector<HTMLElement>('[data-test="escape-isolation"]')
      if (!button) throw new Error('Expected Escape isolation control')
      const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true })
      button.dispatchEvent(escape)

      expect(escape.defaultPrevented).toBe(true)
      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(backgroundCalls).toBe(0)
      wrapper.unmount()
    } finally {
      document.removeEventListener('keydown', preventFirst, true)
      document.removeEventListener('keydown', backgroundListener, true)
    }
  })

  it('includes contenteditable and orders positive tabindex before implicit controls', async () => {
    const wrapper = mount(BaseDialog, {
      props: { show: true, title: 'Tab order', showCloseButton: false },
      slots: {
        default: `
          <button data-test="implicit">Implicit</button>
          <div contenteditable data-test="editable">Editable</div>
          <button tabindex="2" data-test="tab-two">Two</button>
          <button tabindex="1" data-test="tab-one">One</button>
        `,
      },
      attachTo: document.body,
    })
    await flushPromises()

    const tabOne = document.querySelector<HTMLElement>('[data-test="tab-one"]')
    const editable = document.querySelector<HTMLElement>('[data-test="editable"]')
    if (!tabOne || !editable) throw new Error('Expected ordered focus controls')
    expect(document.activeElement).toBe(tabOne)

    tabOne.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }))
    expect(document.activeElement).toBe(editable)

    editable.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    expect(document.activeElement).toBe(tabOne)

    wrapper.unmount()
  })

  it('contains Tab from the panel and programmatic negative-tabindex descendants', async () => {
    const wrapper = mount(BaseDialog, {
      props: { show: true, title: 'Programmatic focus', showCloseButton: false },
      slots: {
        default: `
          <button data-test="programmatic-first">First</button>
          <div tabindex="-1" data-test="programmatic-negative">Negative</div>
          <button data-test="programmatic-last">Last</button>
        `,
      },
      attachTo: document.body,
    })
    await flushPromises()

    const panel = document.querySelector<HTMLElement>('.modal-content')
    const first = document.querySelector<HTMLElement>('[data-test="programmatic-first"]')
    const negative = document.querySelector<HTMLElement>('[data-test="programmatic-negative"]')
    const last = document.querySelector<HTMLElement>('[data-test="programmatic-last"]')
    if (!panel || !first || !negative || !last) throw new Error('Expected programmatic focus controls')

    panel.focus()
    const panelTab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    document.dispatchEvent(panelTab)
    expect(panelTab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    panel.focus()
    const panelShiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
    document.dispatchEvent(panelShiftTab)
    expect(panelShiftTab.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    negative.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    expect(document.activeElement).toBe(first)

    negative.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }))
    expect(document.activeElement).toBe(last)

    wrapper.unmount()
  })

  it('models a named radio group as one checked sequential stop', async () => {
    const wrapper = mount(BaseDialog, {
      props: { show: true, title: 'Radio group', showCloseButton: false },
      slots: {
        default: `
          <input type="radio" name="choice" data-test="radio-one" />
          <input type="radio" name="choice" data-test="radio-two" checked />
          <input type="radio" name="choice" data-test="radio-three" />
        `,
      },
      attachTo: document.body,
    })
    await flushPromises()

    const one = document.querySelector<HTMLElement>('[data-test="radio-one"]')
    const checked = document.querySelector<HTMLElement>('[data-test="radio-two"]')
    const three = document.querySelector<HTMLElement>('[data-test="radio-three"]')
    if (!one || !checked || !three) throw new Error('Expected radio group controls')

    one.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    expect(document.activeElement).toBe(checked)

    three.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }))
    expect(document.activeElement).toBe(checked)

    checked.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }))
    expect(document.activeElement).toBe(checked)

    checked.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }))
    expect(document.activeElement).toBe(checked)

    wrapper.unmount()
  })

  it('uses the first enabled visible radio when a group has no checked member', async () => {
    const wrapper = mount(BaseDialog, {
      props: { show: true, title: 'Unchecked radio group', showCloseButton: false },
      slots: {
        default: `
          <input type="radio" name="unchecked" data-test="unchecked-one" />
          <input type="radio" name="unchecked" data-test="unchecked-two" />
        `,
      },
      attachTo: document.body,
    })
    await flushPromises()

    const first = document.querySelector<HTMLElement>('[data-test="unchecked-one"]')
    if (!first) throw new Error('Expected unchecked radio group control')
    expect(document.activeElement).toBe(first)

    for (const shiftKey of [false, true]) {
      const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true })
      document.dispatchEvent(tab)
      expect(tab.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(first)
    }

    wrapper.unmount()
  })

  it('redirects pointer or programmatic focus to the current visual owner', async () => {
    const background = document.createElement('button')
    document.body.appendChild(background)

    const low = mount(BaseDialog, {
      props: { show: true, title: 'Low focus owner', showCloseButton: false, zIndex: 40 },
      slots: { default: '<button data-test="focus-low">Low action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const high = mount(BaseDialog, {
      props: { show: true, title: 'High focus owner', showCloseButton: false, zIndex: 80 },
      slots: { default: '<button data-test="focus-high">High action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const highButton = document.querySelector<HTMLElement>('[data-test="focus-high"]')
    if (!highButton) throw new Error('Expected high visual owner control')

    background.focus()
    expect(document.activeElement).toBe(highButton)

    const lowButton = document.querySelector<HTMLElement>('[data-test="focus-low"]')
    if (!lowButton) throw new Error('Expected low visual owner control')
    lowButton.focus()
    expect(document.activeElement).toBe(highButton)

    high.unmount()
    low.unmount()
  })

  it('moves focus when reactive z-index changes visual ownership', async () => {
    const first = mount(BaseDialog, {
      props: { show: true, title: 'Reactive first', showCloseButton: false, zIndex: 80 },
      slots: { default: '<button data-test="reactive-first">First action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const second = mount(BaseDialog, {
      props: { show: true, title: 'Reactive second', showCloseButton: false, zIndex: 40 },
      slots: { default: '<button data-test="reactive-second">Second action</button>' },
      attachTo: document.body,
    })
    await flushPromises()

    const firstButton = document.querySelector<HTMLElement>('[data-test="reactive-first"]')
    const secondButton = document.querySelector<HTMLElement>('[data-test="reactive-second"]')
    if (!firstButton || !secondButton) throw new Error('Expected reactive z-index controls')
    expect(document.activeElement).toBe(firstButton)

    await first.setProps({ zIndex: 20 })
    await flushPromises()
    expect(document.activeElement).toBe(secondButton)

    await first.setProps({ zIndex: 100 })
    await flushPromises()
    expect(document.activeElement).toBe(firstButton)

    second.unmount()
    first.unmount()
  })
})
