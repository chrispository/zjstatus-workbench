# zjstatus Workbench

Design a [zjstatus](https://github.com/dj95/zjstatus) bar for [Zellij](https://zellij.dev) in the browser, then copy or download a ready-to-use KDL layout.

It's a single static page with no build step and no network requests. Open `index.html` directly, or serve the folder from any static host (GitHub Pages works). Keep `assets/` beside it for the bundled Nerd Font, wallpaper, and palette snapshots. Settings are saved in the browser's local storage.

## Using it

The left side is a live terminal preview with the generated KDL beneath it. It stays in view while you scroll the settings on the right. **Hover any preset, shape, or separator to preview it in the bar; click to apply.** Click any piece of the preview bar to jump to its settings.

- **Presets.** 19 starting looks for the mode badge, active tab, and separators. Cycle them with `[` / `]`, or the arrows in the top bar.
- **Layout.** Place widgets in the left, center, and right sections. Drag the chips, or use the arrow buttons. Put the bar at the top or bottom, and choose the border side, border line, and gap fill. Choose which section zjstatus hides first when the bar is too wide (`format_precedence`).
- **Shapes.** Choose a piece (mode badge, Git branch, active tab, inactive tabs, or any status widget) and browse a gallery of 23 shapes, rendered in your current colors. Filter by quiet, geometric, or expressive.
- **Separators.** Glyphs after the mode badge, after the Git branch, between tabs, and between widgets. Each kind has its own color role. A separator only appears when something follows it in the same section.
- **Tabs.** Label template (`{index} {name}`, `{index}:{name}`, and others), an icon prefix, zero-based numbering, fullscreen, sync, and floating indicators, and a visible-tab limit with “+N hidden” markers.
- **Colors.** Every role can be set on its own, including separate fills for the mode badge and the active tab. Two modes:
  - *Terminal palette:* each role points at an ANSI slot (0–15), so the exported bar follows whatever theme your terminal uses. Click the slot swatches or use the dropdown.
  - *Fixed hex colors:* exact colors, set with a color picker or by typing hex.
  - **Import Ghostty theme…** loads a complete Ghostty config, with explicit `background`, `foreground`, and `palette = 0..15` values, as the preview palette.
- **Modes.** Full (`NORMAL`), short (`NOR`), icon, or custom labels, and an option to hide the badge in NORMAL. All 14 modes inherit NORMAL's color unless overridden. Click a badge to preview that mode, or press `M` to cycle.
- **Widgets.** Clock (format, IANA timezone, icon), Git branch (icon, uncommitted-changes marker, ahead/behind counts), session name, custom text, swap layout, notifications, battery, load average, hostname, Kubernetes context, and a custom command.

The toolbar under the preview controls what the preview shows without changing the export: the mode, the terminal width in columns, the number of tabs, the active tab's state, whether the shell is inside a Git repository, and whether a notification is unread.

- **Shuffle** (`R`) randomizes everything except the groups you lock.
- **Share link** copies a URL that carries your settings. Opening it replaces the settings in that browser.
- **Import KDL…** restores the exact settings from any Workbench export (each export embeds them in a `// workbench-state:` comment). For a hand-written zjstatus layout it recovers the colors, the widgets in each section, the clock, the tab overflow and border settings, and the mode and tab shapes when they match a Workbench shape.

Press `C` or use **Copy KDL** / **↓ .kdl** to export.

## Installing the result

1. Download `zjstatus.wasm` from the [zjstatus releases](https://github.com/dj95/zjstatus/releases) to `~/.config/zellij/plugins/zjstatus.wasm`, or edit the plugin location in the export.
2. Save the export to `~/.config/zellij/layouts/<name>.kdl`.
3. Run `zellij --layout <name>`, or set `default_layout "<name>"` in `config.kdl`.

The Git branch, battery, load, hostname, Kubernetes, and custom-command widgets use the zjstatus [command widget](https://github.com/dj95/zjstatus/blob/main/src/widgets/command.rs) with `hideonemptystdout`, so each one and its separator disappear when it has nothing to show (outside a repository, on a machine without a battery, and so on). zjstatus doesn't run commands through a shell, so the ones that need pipes are wrapped in `bash -c '…'`.

## Caveats

- The browser simulates a translucent terminal; it isn't a screenshot. Powerline and block glyph joins depend on your font and line height, so check the result at your real font size.
- Boxcar needs two content rows, so the export makes the status pane one row taller.
- The overlength preview ports zjstatus's section-hiding rules, but measures widths in the browser. Wide glyphs can measure differently in your terminal.
- Battery uses `/sys/class/power_supply` (Linux) or `pmset` (macOS); load uses `/proc/loadavg` or `sysctl`.
- Half-cell Hatch previews use color blends that zjstatus doesn't calculate.
- Glacier and Paper are sample palettes. Moonlit Sands, Greek Noir, Everforest, and Outpost are snapshots of Omarchy themes (see `assets/palettes/`).
- The page is designed for desktop browsers.

The bundled JetBrains Mono Nerd Font is distributed under the OFL (`assets/OFL.txt`).

## Tests

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium   # or set CHROMIUM_PATH=/path/to/chromium
node tests/workbench.cjs
```

The tests check the bundled palettes against their reference configs, Ghostty import, slot assignment, separators, persistence and migration of older settings, per-mode colors and labels, branch shapes and extras, Slant geometry, sections and drag-and-drop, bar position and borders, the overlength rules, tab labels, inactive shapes, indicators, tab windowing, status widgets, share links, KDL round-trip and import, and shuffle locks. They don't launch Zellij.
