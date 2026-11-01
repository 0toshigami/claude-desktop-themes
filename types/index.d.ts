export type Theme = {
  id: string
  name: string
  tagline: string
  bg?: string
  text?: string
  accent?: string
  font?: string
  vars?: Record<string, string>
  status?: { idle: string; tool: string; error: string; done: string }
  deco?: string
  wallpaper?: string
  css?: string
}

declare module 'claude-code' {
  interface PluginState {
    'desktop-themes': { current: string; isInstalled: boolean; motion: 'smooth' | 'grid'; speed: number; cell: number; veil: number; isStripOpen: boolean }
  }
}
