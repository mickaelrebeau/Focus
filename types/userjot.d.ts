export interface UserjotIdentifyPayload {
  id: string
  email: string
  firstName?: string
  lastName?: string
  avatar?: string
  signature?: string
}

export interface UserjotInitOptions {
  widget?: boolean
  position?: 'left' | 'right'
  theme?: 'auto' | 'light' | 'dark'
  trigger?: 'default' | 'custom'
}

export interface UserjotWidgetState {
  isOpen: boolean
  section: string | null
}

export interface UserjotSDK {
  init: (projectId: string, options?: UserjotInitOptions) => void
  identify: (user: UserjotIdentifyPayload | null) => void
  showWidget: (options?: { section?: string }) => void
  hideWidget: () => void
  getWidgetState: () => UserjotWidgetState
  enableWidget: () => void
  disableWidget: () => void
  destroy: () => void
}

declare global {
  interface Window {
    uj: UserjotSDK
    $ujq: Array<[string, ...unknown[]]>
  }
}

export {}
