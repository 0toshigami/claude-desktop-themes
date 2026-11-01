# Claude Desktop Themes

Themes for Claude Desktop, applied live. Pick one from a strip above the prompt with `/themes`.

https://github.com/user-attachments/assets/32f4bfa8-eecc-4993-8b02-3a0960ac27c3

## Live ASCII wallpapers

An animated scene, drawn in characters, moves behind the chat. You can set its motion (smooth or cell by cell), its
speed, its cell size and a backdrop behind the chat that keeps the text easy to read.

| | | |
|:-:|:-:|:-:|
| <img src="docs/moonlit.gif" alt="Moonlit"><br>**Moonlit** | <img src="docs/clawd.gif" alt="Clawd"><br>**Clawd** | <img src="docs/cloud-drift.gif" alt="Cloud Drift"><br>**Cloud Drift** |
| <img src="docs/honu-lagoon.gif" alt="Honu Lagoon"><br>**Honu Lagoon** | <img src="docs/koi-pond.gif" alt="Koi Pond"><br>**Koi Pond** | <img src="docs/jellyfish.gif" alt="Jellyfish"><br>**Jellyfish** |
| <img src="docs/lantern-night.gif" alt="Lantern Night"><br>**Lantern Night** | <img src="docs/fireflies.gif" alt="Fireflies"><br>**Fireflies** | <img src="docs/neon-rain.gif" alt="Neon Rain"><br>**Neon Rain** |
| <img src="docs/sakura-dusk.gif" alt="Sakura Dusk"><br>**Sakura Dusk** | <img src="docs/snow-cabin.gif" alt="Snow Cabin"><br>**Snow Cabin** | <img src="docs/star-voyage.gif" alt="Star Voyage"><br>**Star Voyage** |

## Color themes

Each theme changes colors, fonts, corner shapes and shadows. Some react to tool calls: a glow while a tool runs, a
shake on an error.

| | | | | |
|:-:|:-:|:-:|:-:|:-:|
| <img src="docs/sunset-cloud.svg" width="160" alt="Sunset Cloud"><br>**Sunset Cloud** | <img src="docs/sakura.svg" width="160" alt="Sakura"><br>**Sakura** | <img src="docs/terminal.svg" width="160" alt="Terminal"><br>**Terminal** | <img src="docs/night-sea.svg" width="160" alt="Night Sea"><br>**Night Sea** | <img src="docs/old-paper.svg" width="160" alt="Old Paper"><br>**Old Paper** |

## Make your own

Ask Claude to "make me a theme", with a text idea, a picture, or both. The `make-theme` skill asks which kind you
want, drafts it as an Artifact for you to approve, and then builds it.

https://github.com/user-attachments/assets/128fd8a4-7061-43d6-8a54-7e9948964825

## Before you install

The mod works in the Claude Desktop app's Code tab.

> **Unofficial.** This mod is built on the mods, extensions and other parts that Claude Desktop already has. It is
> not a supported theming feature, so a future update of Claude Desktop can break it.
>
> **Windows only for now.** I tested it only on Windows. macOS and Linux are not done yet, and I do not have a Mac
> or a Linux machine to test on. Help from the community is welcome: issues and pull requests for those platforms.

This is a community mod. It is not made or endorsed by Anthropic. Claude, Claude Desktop, Claude Code and Clawd
belong to Anthropic.

## Install

In Claude Desktop: open **Settings → Plugins**, press **Add → Add marketplace**, enter
`https://github.com/0toshigami/claude-desktop-themes.git`, then install **themes-for-claude** from it.

Or, at the prompt of a Claude Code terminal session:

```
/plugin install themes-for-claude --marketplace 0toshigami/claude-desktop-themes
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```bash
claude plugin install themes-for-claude --marketplace 0toshigami/claude-desktop-themes
```

## First use

1. If `/themes` does not show in the command list (often only `/make-theme` shows just after the install), type
   `/reload-plugins` and then `/reload-skills`.
2. In a Claude Code session in Claude Desktop, type `/themes`. The theme strip opens above the prompt.
   `/themes` works only inside a session. On the start page of **+ New**, typing `/themes` only starts a new
   session; type `/themes` again in that session to open the strip.
3. The first time, the strip shows only an **Install extension** button. Press it. It copies the extension that
   paints the themes into `%APPDATA%\Claude\extensions` and sets `REACT_PROFILE=1` for your Windows account, which
   makes Claude Desktop load it.
4. Quit Claude Desktop fully (also from the system tray) and open it again.
5. Type `/themes` again and press a theme's name to put it on. Press **Claude** to go back to Claude's own colors.

## Your own themes

- **Simple themes** go into `%USERPROFILE%\.claude\themes-for-claude\` as `<id>.json`, with an optional `<id>.css`.
  They show in the strip's "Your themes" row, and an update of the mod does not remove them.
- **Live wallpapers** go into the same folder: `<id>.json` with `"wallpaper": "<id>"`, and the scene as `<id>.js`.
  Pick it in `/themes` and it shows at once, with no restart.

## Uninstall

Uninstalling the plugin removes only its commands. The extension in `%APPDATA%` stays, so remove it first:

1. Type `/themes` and press **Remove extension**. It takes the mod's files and entries out of
   `%APPDATA%\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi`. If no other mod uses that folder, it also removes
   the folder and the `REACT_PROFILE` variable. If another mod uses the folder, it keeps both.
2. Restart Claude Desktop.
3. Uninstall the plugin: in **Settings → Plugins**, or with `claude plugin uninstall themes-for-claude`.
4. Optional: remove the marketplace too, which deletes its copy in `%USERPROFILE%\.claude\plugins\marketplaces`. Use
   **Settings → Plugins → Add → Manage marketplaces**, or `claude plugin marketplace remove claude-desktop-themes`.

Your own themes in `%USERPROFILE%\.claude\themes-for-claude\` stay. Delete that folder if you do not want them.

If you uninstalled the plugin first, remove the extension by hand in PowerShell. The folder can hold other mods
too, so this deletes the folder and the variable only when the folder holds this mod alone:

```powershell
$d = "$env:APPDATA\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi"
if (((Get-Content "$d\manifest.json" -Raw | ConvertFrom-Json).content_scripts.js -join ',') -eq 'theme.js') {
  Remove-Item -Recurse $d; [Environment]::SetEnvironmentVariable('REACT_PROFILE', $null, 'User')
} else { "Another mod shares $d. Delete only theme.js, theme.json and event.json, and their manifest entries." }
```

## Safety

A theme's stylesheet goes on your logged-in Claude page, so the extension refuses any stylesheet that loads something
from outside it: no `@import`, and no `url()` except `data:`. A theme's `.json` and `.css` are data only.

A live wallpaper's scene (`<id>.js`) is code, and it runs on your logged-in Claude page. Keep only scene files that
you made or that you trust, the same as any other code you run.

## Thanks

Thanks to [@handsher_NGU](https://x.com/handsher_NGU/status/2115618341675319417/video/1), whose post gave the idea
for this mod.

## License

MIT
