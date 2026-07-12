import type { InjectionKey, Ref } from 'vue'

export interface DialogPortalContext {
  isVisualOwner: Readonly<Ref<boolean>>
  registerPortal: (portal: HTMLElement) => void
  unregisterPortal: (portal: HTMLElement) => void
}

export const dialogPortalKey: InjectionKey<DialogPortalContext> = Symbol('dialogPortal')
