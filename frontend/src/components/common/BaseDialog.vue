<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        ref="overlayRef"
        class="modal-overlay"
        :style="zIndexStyle"
        :aria-labelledby="dialogId"
        role="dialog"
        :aria-modal="isVisualOwner ? 'true' : undefined"
        :aria-hidden="isVisualOwner ? undefined : 'true'"
        :inert="!isVisualOwner || undefined"
        @click.self="handleClose"
      >
        <!-- Modal panel -->
        <div ref="dialogRef" :class="['modal-content', widthClasses]" tabindex="-1" @click.stop>
          <!-- Header -->
          <div class="modal-header">
            <h3 :id="dialogId" class="modal-title">
              {{ title }}
            </h3>
            <button
              v-if="showCloseButton"
              @click="emit('close')"
              class="-mr-2 rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-2 dark:text-dark-500 dark:hover:bg-dark-700 dark:hover:text-dark-300 dark:focus-visible:ring-offset-dark-900"
              aria-label="Close modal"
            >
              <Icon name="x" size="md" />
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <slot></slot>
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
let dialogIdCounter = 0
let dialogSequence = 0

interface DialogStackEntry {
  token: symbol
  zIndex: number
  sequence: number
  restorationRoot: HTMLElement | null
  closeOnEscape: () => boolean
  emitClose: () => void
  focusDialog: () => void
  contains: (element: HTMLElement) => boolean
  getOverlay: () => HTMLElement | null
  getEscapePortal: () => HTMLElement | undefined
  handleTab: (event: KeyboardEvent) => void
  setVisualOwner: (isOwner: boolean) => void
}

const dialogStack: DialogStackEntry[] = []
let keydownListening = false
let focusinListening = false

function getTopDialog(): DialogStackEntry | undefined {
  const connected = dialogStack.filter(entry => entry.getOverlay()?.isConnected)
  const candidates = connected.length > 0 ? connected : dialogStack
  return candidates.reduce<DialogStackEntry | undefined>((top, entry) => {
    if (!top || entry.zIndex > top.zIndex) return entry
    if (entry.zIndex < top.zIndex) return top

    const topOverlay = top.getOverlay()
    const entryOverlay = entry.getOverlay()
    if (topOverlay?.isConnected && entryOverlay?.isConnected) {
      const position = topOverlay.compareDocumentPosition(entryOverlay)
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return entry
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return top
    }
    return entry.sequence > top.sequence ? entry : top
  }, undefined)
}

function handleStackKeydown(event: KeyboardEvent) {
  const top = getTopDialog()
  if (!top) return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    // Other capture listeners can share document; immediate stop keeps Escape inside top modal.
    event.stopImmediatePropagation()
    const portal = top.getEscapePortal()
    if (portal) {
      portal.dispatchEvent(new Event('dialog-escape'))
      return
    }
    if (top.closeOnEscape()) top.emitClose()
    return
  }

  if (!event.defaultPrevented && event.key === 'Tab') top.handleTab(event)
}

function handleStackFocusin(event: FocusEvent) {
  const top = getTopDialog()
  const target = event.target
  if (top && target instanceof HTMLElement && !top.contains(target)) top.focusDialog()
}

function syncBodyScrollLock() {
  document.body.classList.toggle('modal-open', dialogStack.length > 0)
  if (dialogStack.length > 0 && !keydownListening) {
    document.addEventListener('keydown', handleStackKeydown, true)
    keydownListening = true
    document.addEventListener('focusin', handleStackFocusin, true)
    focusinListening = true
  } else if (dialogStack.length === 0 && keydownListening) {
    document.removeEventListener('keydown', handleStackKeydown, true)
    keydownListening = false
    if (focusinListening) {
      document.removeEventListener('focusin', handleStackFocusin, true)
      focusinListening = false
    }
  }
}

function syncDialogOwnership() {
  const top = getTopDialog()
  for (const entry of dialogStack) entry.setVisualOwner(entry === top)
  syncBodyScrollLock()
}
</script>

<script setup lang="ts">
import { computed, watch, onUnmounted, ref, nextTick, provide, readonly } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import { dialogPortalKey } from './dialogPortal'

// 生成唯一ID以避免多个对话框时ID冲突
const dialogId = `modal-title-${++dialogIdCounter}`
const dialogToken = Symbol(dialogId)

// 焦点管理
const dialogRef = ref<HTMLElement | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const isVisualOwner = ref(false)
const ownedPortals = new Set<HTMLElement>()
let previousActiveElement: HTMLElement | null = null
let stackEntry: DialogStackEntry | null = null

provide(dialogPortalKey, {
  isVisualOwner: readonly(isVisualOwner),
  registerPortal: portal => ownedPortals.add(portal),
  unregisterPortal: portal => ownedPortals.delete(portal),
})

type DialogWidth = 'narrow' | 'normal' | 'wide' | 'extra-wide' | 'full'

interface Props {
  show: boolean
  title: string
  width?: DialogWidth
  closeOnEscape?: boolean
  closeOnClickOutside?: boolean
  showCloseButton?: boolean
  zIndex?: number
}

interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  width: 'normal',
  closeOnEscape: true,
  closeOnClickOutside: false,
  showCloseButton: true,
  zIndex: 50
})

const emit = defineEmits<Emits>()

// Custom z-index style (overrides the default z-50 from CSS)
const zIndexStyle = computed(() => {
  return props.zIndex !== 50 ? { zIndex: props.zIndex } : undefined
})

const widthClasses = computed(() => {
  // Width guidance: narrow=confirm/short prompts, normal=standard forms,
  // wide=multi-section forms or rich content, extra-wide=analytics/tables,
  // full=full-screen or very dense layouts.
  const widths: Record<DialogWidth, string> = {
    narrow: 'max-w-md',
    normal: 'max-w-lg',
    wide: 'w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl',
    'extra-wide': 'w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl',
    full: 'w-full sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl'
  }
  return widths[props.width]
})

const handleClose = () => {
  if (props.closeOnClickOutside) {
    emit('close')
  }
}

const focusableSelector = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[tabindex]',
  '[contenteditable]:not([contenteditable="false"])'
].join(',')

function isSequentiallyFocusable(element: HTMLElement): boolean {
  const hasEditableFocus = element.matches('[contenteditable]:not([contenteditable="false"])')
  if ((!hasEditableFocus && element.tabIndex < 0) || Number(element.getAttribute('tabindex')) < 0
    || element.matches(':disabled') || element.closest('[inert]')) {
    return false
  }

  let current: HTMLElement | null = element
  while (current && current !== dialogRef.value) {
    if (current.tagName === 'DETAILS' && !(current as HTMLDetailsElement).open
      && !(element.tagName === 'SUMMARY' && element.parentElement === current)) {
      return false
    }
    const style = window.getComputedStyle(current)
    if (current.hidden || current.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') {
      return false
    }
    current = current.parentElement
  }
  return true
}

function getFocusableElements(): HTMLElement[] {
  if (!dialogRef.value) return []
  const roots = [dialogRef.value, ...Array.from(ownedPortals).filter(portal => portal.isConnected)]
  const ordered = roots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)))
    .filter(isSequentiallyFocusable)
    .map((element, index) => ({ element, index, tabIndex: Math.max(0, element.tabIndex) }))
    .sort((a, b) => {
      if (a.tabIndex > 0 && b.tabIndex > 0) return a.tabIndex - b.tabIndex || a.index - b.index
      if (a.tabIndex > 0) return -1
      if (b.tabIndex > 0) return 1
      return a.index - b.index
    })
    .map(item => item.element)

  const radioStops: Array<{ form: HTMLFormElement | null; name: string; stop: HTMLInputElement }> = []
  for (const element of ordered) {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) continue
    const group = radioStops.find(item => item.form === element.form && item.name === element.name)
    if (!group) radioStops.push({ form: element.form, name: element.name, stop: element })
    else if (element.checked) group.stop = element
  }

  return ordered.filter(element => {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) return true
    return radioStops.find(item => item.form === element.form && item.name === element.name)?.stop === element
  })
}

function focusDialog() {
  if (!dialogRef.value) return
  const focusTarget = getFocusableElements()[0] || dialogRef.value
  if (document.activeElement !== focusTarget) focusTarget.focus()
}

function registerDialog() {
  if (stackEntry) return
  const restorationRoot = getTopDialog()?.restorationRoot || previousActiveElement
  stackEntry = {
    token: dialogToken,
    zIndex: props.zIndex,
    sequence: ++dialogSequence,
    restorationRoot,
    closeOnEscape: () => props.closeOnEscape,
    emitClose: () => emit('close'),
    focusDialog,
    contains: element => dialogRef.value?.contains(element) === true
      || Array.from(ownedPortals).some(portal => portal.isConnected && portal.contains(element)),
    getOverlay: () => overlayRef.value,
    getEscapePortal: () => Array.from(ownedPortals).find(portal =>
      portal.isConnected && portal.matches('[data-dialog-escape-owner]')
      && !portal.hasAttribute('inert') && portal.getAttribute('aria-hidden') !== 'true'),
    handleTab,
    setVisualOwner: isOwner => {
      isVisualOwner.value = isOwner
      const overlay = overlayRef.value
      if (!overlay) return
      overlay.toggleAttribute('inert', !isOwner)
      if (isOwner) {
        overlay.removeAttribute('aria-hidden')
        overlay.setAttribute('aria-modal', 'true')
      } else {
        overlay.setAttribute('aria-hidden', 'true')
        overlay.removeAttribute('aria-modal')
      }
    },
  }
  dialogStack.push(stackEntry)
  syncDialogOwnership()
}

function unregisterDialog(): { wasTopmost: boolean; restorationRoot: HTMLElement | null } | null {
  if (!stackEntry) return null
  const wasTopmost = isVisualOwner.value
  const restorationRoot = stackEntry.restorationRoot
  const index = dialogStack.indexOf(stackEntry)
  if (index >= 0) dialogStack.splice(index, 1)
  stackEntry.setVisualOwner(false)
  stackEntry = null
  syncDialogOwnership()
  return { wasTopmost, restorationRoot }
}

function canRestoreFocus(element: HTMLElement): boolean {
  if (!element.isConnected || element.matches(':disabled') || element.closest('[inert]')) return false
  let current: HTMLElement | null = element
  while (current) {
    const style = window.getComputedStyle(current)
    if (current.hidden || current.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') {
      return false
    }
    current = current.parentElement
  }
  return true
}

function restorePreviousFocus(result: { wasTopmost: boolean; restorationRoot: HTMLElement | null } | null) {
  const focusTarget = previousActiveElement
  previousActiveElement = null
  if (!result?.wasTopmost) return
  const nextTop = getTopDialog()
  if (nextTop) {
    if (focusTarget && canRestoreFocus(focusTarget) && nextTop.contains(focusTarget)) {
      focusTarget.focus()
      if (document.activeElement === focusTarget) return
    }
    nextTop.focusDialog()
    return
  }
  if (result.restorationRoot && canRestoreFocus(result.restorationRoot)) {
    result.restorationRoot.focus()
  } else if (focusTarget && canRestoreFocus(focusTarget)) {
    focusTarget.focus()
  }
}

function handleTab(event: KeyboardEvent) {
  if (!dialogRef.value) return
  const focusable = getFocusableElements()
  if (focusable.length === 0) {
    event.preventDefault()
    dialogRef.value.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !focusable.includes(active)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  } else if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

// Prevent body scroll when modal is open and manage focus
watch(
  () => props.show,
  async (isOpen) => {
    if (isOpen) {
      // 保存当前焦点元素
      previousActiveElement = document.activeElement as HTMLElement
      registerDialog()

      // 等待DOM更新后设置焦点到对话框
      await nextTick()
      syncDialogOwnership()
      if (props.show && getTopDialog()?.token === dialogToken) focusDialog()
    } else {
      restorePreviousFocus(unregisterDialog())
    }
  },
  { immediate: true }
)

watch(() => props.zIndex, zIndex => {
  if (!stackEntry) return
  const previousTop = getTopDialog()
  stackEntry.zIndex = zIndex
  syncDialogOwnership()
  const nextTop = getTopDialog()
  if (nextTop && nextTop.token !== previousTop?.token) nextTop.focusDialog()
})

watch(overlayRef, overlay => {
  if (overlay?.isConnected) syncDialogOwnership()
}, { flush: 'post' })

onUnmounted(() => {
  ownedPortals.clear()
  restorePreviousFocus(unregisterDialog())
})
</script>
