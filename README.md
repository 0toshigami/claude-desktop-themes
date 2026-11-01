# desktop-themes

Themes for Claude Desktop, applied live. Pick one from a strip above the prompt with `/themes`.

- **Color themes:** Sunset Cloud, Sakura, Terminal, Night Sea and Old Paper. Each theme changes colors, fonts, corner
  shapes and shadows, and some react to tool calls (a glow while a tool runs, a shake on an error).
- **Live ASCII wallpapers:** Moonlit, Clawd, Cloud Drift, Honu Lagoon, Koi Pond, Jellyfish, Lantern Night, Fireflies
  and Neon Rain. An animated scene, drawn in characters, moves behind the chat. You can set its motion (smooth or cell
  by cell), its speed, its cell size and a backdrop behind the chat that keeps the text easy to read.
- **Make your own:** ask Claude to "make me a theme", with a text idea, a picture, or both. The `make-theme` skill
  asks which kind you want, drafts it as an Artifact for you to approve, and then builds it.

Windows only for now. The mod works in the Claude Desktop app's Code tab.

This is a community mod. It is not made or endorsed by Anthropic. Claude, Claude Desktop, Claude Code and Clawd
belong to Anthropic.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install desktop-themes --marketplace 0toshigami/claude-desktop-themes
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```bash
claude plugin install desktop-themes --marketplace 0toshigami/claude-desktop-themes
```

## First use

1. In a Claude Code session in Claude Desktop, type `/themes`. The theme strip opens above the prompt.
2. The first time, the strip shows an **Install extension** button. Press it. It copies the extension that paints
   the themes into `%APPDATA%\Claude\extensions` and sets `REACT_PROFILE=1` for your Windows account, which makes
   Claude Desktop load it.
3. Restart Claude Desktop.
4. Type `/themes` again and press a theme's name to put it on. Press **Claude** to go back to Claude's own colors.

## Your own themes

- **Simple themes** go into `%USERPROFILE%\.claude\desktop-themes\` as `<id>.json`, with an optional `<id>.css`.
  They show in the strip's "Your themes" row, and an update of the mod does not remove them.
- **Live wallpapers** are code, so the skill adds them to the mod's own files. An update of the mod replaces those
  files: keep a copy of yours.

## Safety

A theme's stylesheet goes on your logged-in Claude page, so the extension refuses any stylesheet that loads something
from outside it: no `@import`, and no `url()` except `data:`. Theme files are data only. Only the extension's own
code draws the live wallpapers.

## License

MIT
