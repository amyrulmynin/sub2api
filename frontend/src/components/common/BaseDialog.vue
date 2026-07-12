<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="modal-overlay"
        :style="zIndexStyle"
        :aria-labelledby="dialogId"
        role="dialog"
        aria-modal="true"
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
  closeOnEscape: () => boolean
  emitClose: () => void
  focusDialog: () => void
  contains: (element: HTMLElement) => boolean
  handleTab: (event: KeyboardEvent) => void
}

const dialogStack: DialogStackEntry[] = []
let keydownListening = false

function getTopDialog(): DialogStackEntry | undefined {
  return dialogStack.reduce<DialogStackEntry | undefined>((top, entry) => {
    if (!top || entry.zIndex > top.zIndex || (entry.zIndex === top.zIndex && entry.sequence > top.sequence)) {
      return entry
    }
    return top
  }, undefined)
}

function handleStackKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return
  const top = getTopDialog()
  if (!top) return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (top.closeOnEscape()) top.emitClose()
    return
  }

  if (event.key === 'Tab') top.handleTab(event)
}

function syncBodyScrollLock() {
  document.body.classList.toggle('modal-open', dialogStack.length > 0)
  if (dialogStack.length > 0 && !keydownListening) {
    document.addEventListener('keydown', handleStackKeydown, true)
    keydownListening = true
  } else if (dialogStack.length === 0 && keydownListening) {
    document.removeEventListener('keydown', handleStackKeydown, true)
    keydownListening = false
  }
}
</script>

<script setup lang="ts">
import { computed, watch, onUnmounted, ref, nextTick } from 'vue'
import Icon from '@/components/icons/Icon.vue'

// 生成唯一ID以避免多个对话框时ID冲突
const dialogId = `modal-title-${++dialogIdCounter}`
const dialogToken = Symbol(dialogId)

// 焦点管理
const dialogRef = ref<HTMLElement | null>(null)
let previousActiveElement: HTMLElement | null = null
let stackEntry: DialogStackEntry | null = null

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
  '[tabindex]'
].join(',')

function isSequentiallyFocusable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[inert]')) {
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
  return Array.from(dialogRef.value.querySelectorAll<HTMLElement>(focusableSelector))
    .filter(isSequentiallyFocusable)
}

function focusDialog() {
  if (!dialogRef.value) return
  const focusTarget = getFocusableElements()[0] || dialogRef.value
  focusTarget.focus()
}

function registerDialog() {
  if (stackEntry) return
  stackEntry = {
    token: dialogToken,
    zIndex: props.zIndex,
    sequence: ++dialogSequence,
    closeOnEscape: () => props.closeOnEscape,
    emitClose: () => emit('close'),
    focusDialog,
    contains: element => dialogRef.value?.contains(element) === true,
    handleTab,
  }
  dialogStack.push(stackEntry)
  syncBodyScrollLock()
}

function unregisterDialog(): boolean {
  if (!stackEntry) return false
  const wasTopmost = getTopDialog()?.token === dialogToken
  const index = dialogStack.indexOf(stackEntry)
  if (index >= 0) dialogStack.splice(index, 1)
  stackEntry = null
  syncBodyScrollLock()
  return wasTopmost
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

function restorePreviousFocus(wasTopmost: boolean) {
  const focusTarget = previousActiveElement
  previousActiveElement = null
  if (!wasTopmost) return
  const nextTop = getTopDialog()
  if (focusTarget && canRestoreFocus(focusTarget) && (!nextTop || nextTop.contains(focusTarget))) {
    focusTarget.focus()
    if (document.activeElement === focusTarget) return
  }
  nextTop?.focusDialog()
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
  if (event.shiftKey && (active === first || !dialogRef.value.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !dialogRef.value.contains(active))) {
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
      if (props.show && getTopDialog()?.token === dialogToken) focusDialog()
    } else {
      restorePreviousFocus(unregisterDialog())
    }
  },
  { immediate: true }
)

watch(() => props.zIndex, zIndex => {
  if (!stackEntry) return
  stackEntry.zIndex = zIndex
  if (getTopDialog()?.token === dialogToken) focusDialog()
})

onUnmounted(() => {
  restorePreviousFocus(unregisterDialog())
})
</script>
