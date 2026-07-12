import type { InjectionKey } from 'vue'

export interface DialogPortalContext {
  registerPortal: (portal: HTMLElement) => void
  unregisterPortal: (portal: HTMLElement) => void
}

export const dialogPortalKey: InjectionKey<DialogPortalContext> = Symbol('dialogPortal')
