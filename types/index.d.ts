export type Theme = {
  id: string
  name: string
  tagline: string
  // #rrggbb; left out (the Claude one), Claude's own colors show
  bg?: string
  text?: string
  accent?: string
  // a font installed on this computer, as CSS font-family
  font?: string
  // other custom properties of Claude's, without the leading --: its shape (cds-radius, cds-radius-composer,
  // cds-panel-radius), shadows (cds-shadow-sm/md/lg), motion (cds-dur-base, cds-ease-out), ...
  vars?: Record<string, string>
  // the status line while the theme is on: {tool} is the tool's name
  status?: { idle: string; tool: string; error: string; done: string }
  // drawn into its preview, over the small window: SVG markup in a 240×140 box
  deco?: string
  // a live ASCII wallpaper behind the window, by name: one of the scenes built into the extension (moonlit)
  wallpaper?: string
  // a person's own theme (from their themes folder): its stylesheet, read with it; built-in ones keep theirs in themes/
  css?: string
}

declare module 'claude-code' {
  interface PluginState {
    // motion: how a live wallpaper's shapes move, gliding between cells (smooth) or stepping cell by cell (grid);
    // speed: how fast its scene runs, 1 its own pace; cell: its cells' size in pixels (14, 18 or 22)
    'desktop-themes': { current: string; isInstalled: boolean; motion: 'smooth' | 'grid'; speed: number; cell: number; veil: number; isStripOpen: boolean }
  }
}
