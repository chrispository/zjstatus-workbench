# zjstatus Workbench

Design a [zjstatus](https://github.com/dj95/zjstatus) bar for [Zellij](https://zellij.dev) in the browser, then copy or download a ready-to-use KDL layout.

It's a single static page with no build step and no network requests. Open `index.html` directly, or serve the folder from any static host (GitHub Pages works). Keep `assets/` beside it for the bundled Nerd Font, wallpaper, and palette snapshots. Settings are saved in the browser's local storage.

## Using it

The left side is a live terminal preview with the generated KDL beneath it. It stays in view while you scroll the settings on the right. **Hover any preset, shape, or separator to preview it in the bar; click to apply.**

- **Presets.** 19 starting looks for the mode badge, active tab, and separators. Cycle them with `[` / `]`, or the arrows in the top bar.
- **Shapes.** Choose a piece (mode badge, Git branch, active tab) and browse a gallery of 23 shapes, rendered in your current colors. Filter by quiet, geometric, or expressive.
- **Separators.** Glyphs for the mode → branch, branch → tabs, and between-tabs boundaries. Each boundary has its own color role.
- **Colors.** Every role can be set on its own, including separate fills for the mode badge and the active tab. Two modes:
  - *Terminal palette:* each role points at an ANSI slot (0–15), so the exported bar follows whatever theme your terminal uses. Click the slot swatches or use the dropdown.
  - *Fixed hex colors:* exact colors, set with a color picker or by typing hex.
  - **Import Ghostty theme…** loads a complete Ghostty config, with explicit `background`, `foreground`, and `palette = 0..15` values, as the preview palette.
- **Mode colors.** All 14 Zellij modes inherit NORMAL unless overridden. Click a badge to preview that mode, or press `M` to cycle.
- **Right side.** Clock (format, IANA timezone, icon), Git branch, session name, custom text, or nothing.

Press `C` or use **Copy KDL** / **↓ .kdl** to export.

## Installing the result

1. Download `zjstatus.wasm` from the [zjstatus releases](https://github.com/dj95/zjstatus/releases) to `~/.config/zellij/plugins/zjstatus.wasm`, or edit the plugin location in the export.
2. Save the export to `~/.config/zellij/layouts/<name>.kdl`.
3. Run `zellij --layout <name>`, or set `default_layout "<name>"` in `config.kdl`.

The Git branch uses the zjstatus [command widget](https://github.com/dj95/zjstatus/blob/main/src/widgets/command.rs) with `hideonemptystdout`, so the branch and its separator disappear outside a repository.

## Caveats

- The browser simulates a translucent terminal; it isn't a screenshot. Powerline and block glyph joins depend on your font and line height, so check the result at your real font size.
- Boxcar needs two content rows, so the export uses `pane size=3`.
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

The tests check the bundled palettes against their reference configs, Ghostty import, slot assignment, separators, persistence, per-mode colors, branch shapes, Slant geometry, right-side content, and timezone validation. They don't launch Zellij.
