---
name: make-theme
description: Make a new Claude Desktop theme for the Claude Desktop Themes mod, in the style of its own themes, from a text idea, a reference image, or both. Use when the person asks to create, design or make their own theme, color scheme or live ASCII wallpaper for Claude Desktop. Drafts the idea as an Artifact for the person to approve before anything is built.
---

# Make a theme

This skill makes a theme for the Claude Desktop Themes mod. The mod's root is two folders up from this file (`../..`).
Before you start, read `hooks/themes.ts` there: its themes are the style to follow.

## 1. Find out which kind of theme

There are two kinds. If the person did not say which kind, explain both and ask with `AskUserQuestion`. Do not guess.

- **Simple theme.** Colors, a font, corner shapes, shadows, a status line, and optionally a stylesheet with
  decorations and reactions (a glow while a tool runs, a shake on an error). It is data only. It goes into the
  person's own themes folder, shows in the `/themes` strip at once, and a mod update never removes it.
- **Live wallpaper.** All of the above, plus an animated ASCII scene behind the window, drawn by the extension (like
  Moonlit, Koi Pond or Lantern Night). It also goes into the person's own themes folder, with its scene as a `.js`
  file beside it, and a mod update never removes it. Tell the person two things: the scene is code that runs on their Claude page, so they should only add scene files they trust; and it takes longer to make, with a few rounds of review.

## 2. Read the references

The person can give text, an image, or both.

- **Text:** take the mood, the motifs, the colors and the place it names.
- **Image:** read it with the Read tool. Take its palette (5 to 8 colors: a background, a text color with strong
  contrast against it, one accent), its mood, and its main motifs. For a live wallpaper, also take its shapes and
  composition: what moves, where it sits, and what stays still.

If a reference does not give you enough, ask one short question. Do not ask about things you can choose well
yourself.

## 3. Draft it as an Artifact, and wait for a yes

Do not build before the person sees a draft and approves it.

1. Write the theme as JSON in your scratchpad, for example `draft/theme.json`. The fields are in
   [The theme file](#the-theme-file). For a simple theme with a stylesheet, also write `draft/theme.css`.
2. For a live wallpaper, write the scene as `draft/<id>.js` in your scratchpad, in the same form as a file in the
   mod's `extension/src/scenes/`. Read [Live wallpaper scenes](#live-wallpaper-scenes) first.
3. Build the draft page with this skill's script:
   ```bash
   node "<this skill's folder>/draft.mjs" --theme draft/theme.json [--css draft/theme.css] [--scene draft/<id>.js] [--start 20] --out draft/<id>-draft.html
   ```
   The page is a small Claude Desktop mock painted by the mod's real extension, with the draft scene built in, so it
   shows the theme as it will look. `--start` sets how many seconds into the scene the page starts.
4. Publish the page as an Artifact. Load the artifact skills first, as the Artifact tool asks. In your reply, name
   the colors you chose and why, and the motifs you took from the references.
5. Change the draft until the person says yes. Publish each new version to the same Artifact.

If the person wants to compare versions, make a page with tabs that switch between them, each tab an iframe of one
draft.

## 4. Build it

### A simple theme

1. Write `<id>.json`, and `<id>.css` if the theme has a stylesheet, to the person's themes folder:
   `%USERPROFILE%\.claude\themes-for-claude\` on Windows. Create the folder if it is not there.
2. Tell the person to run `/themes`. The strip reads the folder each time it opens, and the theme shows in the
   "Your themes" row. A press on its name puts it on, with no restart.

The mod refuses a file with a bad `id`, a missing name, or colors that are not `#rrggbb`. It also refuses an `id`
that a built-in theme uses. Check these before you write the file.

### A live wallpaper

Do not change the mod's own files: the theme belongs to the person, not to the mod.

1. Copy the approved scene to `<id>.js` in the person's themes folder (see [A simple theme](#a-simple-theme)). A
   scene file holds its own pictures and
   helpers, and ends with `SCENES['<id>'] = { ... }`. It can use the helpers that `KIT` in `tools/assemble.mjs` names (they are in `extension/src/core.js`), and no others. The entry has `cell(x, y, cols, rows, t)`, which returns a tile `{ bg, fg, a }`, a loose
   character `{ fg, a, ch? }`, or nothing. It also has `sprites(cols, rows, t)`, which returns
   `[{ x, y, key, art, pal }]` or `[{ x, y, key, field, w, h }]`. A sprite can also have `a`, `shadow` and
   `glow: { r, color, a }`. Only an `art` sprite can have `halo`. A cell can have `floor`: the least brightness it
   keeps in the chat column. A scene can have `size`: the largest cell size in pixels.
2. Write the theme as `<id>.json` beside it, with `"wallpaper": "<id>"` (the theme's own id: the mod refuses any
   other) and the `wall-*` vars that `live()` in `hooks/themes.ts` sets.
3. Make its strip tile, a picture of the scene, as `<id>.jpg` beside it (without it the tile is drawn from the
   theme's colors and `deco`, and does not show the scene). Use the same `--start` as the approved draft:
   ```bash
   node "<this skill's folder>/draft.mjs" --theme "<themes folder>/<id>.json" --scene "<themes folder>/<id>.js" --start 20 --bare --out draft/<id>-tile.html
   powershell -NoProfile -File "<the mod's root>/tools/thumbs/capture.ps1" -Page draft/<id>-tile.html -Out "<themes folder>/<id>.jpg"
   ```
   Read the picture to check it shows the scene's main motifs. If the capture fails (no browser found, `no shot`,
   or a picture that does not show the scene), delete any `<id>.jpg` and go on: the tile then falls back to the
   theme's colors and `deco`, so give the theme a `deco` that hints at the scene, and tell the person.
4. Tell the person to run `/themes` and pick the theme in the "Your themes" row. The mod copies the scene into the extension and it shows at once, with no restart.

## The theme file

```json
{
  "id": "rainy-cafe",
  "name": "Rainy Cafe",
  "tagline": "Warm lamplight, rain on the glass, a slow evening",
  "bg": "#2a211c", "text": "#f2e6d8", "accent": "#e0a458",
  "font": "Georgia, serif",
  "vars": {
    "cds-radius": "10px", "cds-radius-composer": "18px", "cds-panel-radius": "14px",
    "cds-shadow-md": "0 6px 22px rgba(224, 164, 88, .14)"
  },
  "status": { "idle": "☕", "tool": "☕ {tool}…", "error": "☔ {tool} failed", "done": "☕ done" },
  "deco": "<circle cx=\"200\" cy=\"30\" r=\"20\" fill=\"#e0a458\" opacity=\".2\"/>"
}
```

- `id`: lowercase letters, digits and dashes, 2 to 41 characters, starting with a letter.
- `bg`, `text`, `accent`: `#rrggbb` only. The extension builds all of Claude's colors from these three. Keep the
  text readable on the background: a contrast ratio of at least 7:1 for text, and 3:1 for the accent.
- `font`: a font that is on the computer, as a CSS font family. Leave it out to keep Claude's font.
- `vars`: Claude's other design tokens, without the leading `--`. The themes in `hooks/themes.ts` use the corner trio
  (`cds-radius`, `cds-radius-composer`, `cds-panel-radius`), the shadows (`cds-shadow-sm`, `-md`, `-lg`) and
  motion (`cds-dur-base`, `cds-ease-out`). No `;`, `{`, `}`, `<`, `>`, and no `url()` except `data:`.
- `status`: the status line. `{tool}` is the tool's name. Keep each one short; one emoji plus a few words.
- `deco`: SVG markup drawn over a 240×140 preview of a Claude window, for the theme's tile. Keep it light.
- A live wallpaper also has `wallpaper` (its scene's name) and the `wall-*` vars that `live()` in `hooks/themes.ts`
  sets: `wall-sky`, `wall-halo`, `wall-glass`, `wall-rim`, `wall-greet`.

### The stylesheet

The theme's stylesheet goes on Claude's logged-in page, so the extension refuses a stylesheet that loads anything:
no `@import`, no `url()` except `data:`, no backslashes (write the character itself), no `image-set()`.
Look at `themes/*.css` in the mod for the parts a theme can style:
- `[data-cds=AssistantMessage]`, `[data-cds=UserMessage]`, `[data-cds=ChatComposer] > .bg-surface-3`, `.dframe-sidebar`.
- `html[data-theme-event=tool]`, `=error` and `=done` for 1.2 seconds after each, and
  `html[data-theme-state=thinking]` or `=waiting` while that lasts: the theme's reactions.
- Respect `prefers-reduced-motion`: put every animation inside
  `@media (prefers-reduced-motion: no-preference)`.

## Live wallpaper scenes

Read the scenes in `extension/src/scenes/` and the helpers in `extension/src/core.js` before you write one. The person liked
these rules for the built-in scenes:

- **A clear idea and a few big motifs**, not a full picture. Two or three kinds of things, each easy to recognize.
  A busy, tiled background was too much.
- **Draw shapes by hand** with `sketch()` or a picture as rows of characters, with clear cues: eyes, fins, a forked
  tail, a roof, a flame. Shapes made from ellipse math looked like blobs that nobody could recognize.
- **Things move their bodies**, not only slide: tails beat, fins paddle, flames flicker, a few frames each
  (`frame()`, or a `field` sprite worked out each frame). Check each draft in cell-by-cell motion as well as smooth.
- **Keep the middle calm.** The chat is written over the middle of the window: put the big things at the sides and
  corners, and let the chat backdrop handle the rest. Size big things by the window's width, so a small window is not
  filled by them.
- **Depth and light:** a darker drop `shadow`, a soft `glow` for lights, a `halo` of loose characters around a shape,
  far things smaller and dimmer than near ones.
- **A living background** in the scene's `cell` layer: twinkles, rising specks, rings, ripples. A scene without one
  looked empty.
- Keep the visible words in English. Draw nothing that copies a real brand or another person's art.
