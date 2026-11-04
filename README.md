# Zellij Workbench

A local, offline app for composing Zellij bar styles, separators, and colors. Open `index.html` directly in a browser; no build or network access is needed. Keep `assets/` beside it for the bundled Nerd Font and wallpaper. Settings are saved in this browser's local storage and restored on refresh.

Choose a style in **Set both**, then mix mode badges, Git branch badges, active tabs, and separators independently in **Compose the pieces**. Six preview themes are included: Moonlit Sands, Outpost, Greek Noir, Everforest, Glacier, and Paper.

The **Git branch style** menu offers the same choices as mode and active tabs, including **Flag**, **Inset flag**, and **Rounded** from the layouts. It applies on the left or bottom right, persists across refreshes, and exports through the command widget. Filled branches use the branch color for their fill and **Badge fill text** for text. “Set both” changes mode and active tabs; the branch remains independently selected.

All 14 Zellij modes use the NORMAL color by default. Open **Mode colors** to override each mode using a terminal palette slot or a fixed hex color. NORMAL follows **Terminal foreground** for plain labels and **Accent fill** for badges; other modes inherit NORMAL until overridden. Overrides are saved separately for terminal slots and fixed colors. **Reset mode colors** clears overrides in the current color mode. Use the **Mode** selector above the preview to inspect any mode.

## Colors

The **Colors** selector above the preview offers two modes:

- **Theme agnostic** (the default for new sessions): assign each role to `palette0` through `palette15`. KDL exports the chosen ANSI indices, so the terminal supplies the actual colors. Labels show actual theme slots, such as `palette6 · cyan · #4B7172` for Moonlit Sands. Each control separately shows its Workbench role, assignment, and preview hex value, for example `$accent = palette6`. Workbench roles are independent assignments; `$accent` and `$warning` are not names defined by Ghostty.
- **Specific theme**: select a preset and tune each role with a hex color picker. KDL exports fixed colors. Quick branch swatches load each preset's branch color.

Terminal palette assignments and fixed-color edits are saved separately when switching color modes. Changing the preview theme in theme-agnostic mode preserves assignments; selecting a preset in specific-theme mode resets fixed colors to that preset. **Reset palette assignments** and **Reset colors to theme** reset the current mode only. Existing saved color-mode choices are retained.

Moonlit Sands, Greek Noir, Everforest, and Outpost bundle complete 16-color snapshots resolved from the installed Omarchy `colors.toml` definitions and Ghostty template. The reference configs are in `assets/palettes/`. Moonlit Sands was checked against the active generated `ghostty.conf`. The palette strip and selectors use all 16 actual colors, without replacing slot colors with bar-role colors. Glacier and Paper are explicitly labeled Workbench samples.

Ghostty's terminal palette is separate from Workbench roles. Omarchy's current template maps 1→red, 2→green, 3→yellow, 4→blue, 5→magenta, 6→cyan, 7→foreground, and 8→muted, with bright variants in 9–15. Workbench defaults assign background and filled-label text → 0, warning → 3, branch → 4, accent → 6, foreground → 7, and muted roles → 8. Assigning `$accent` to 6 therefore uses the theme's cyan, even when an Omarchy theme's separate UI accent is another color.

The browser does not automatically monitor terminal theme changes. Use **Import Ghostty theme…** to load the generated `~/.local/state/omarchy/current/theme/ghostty.conf`, or another complete Ghostty theme. Imports stay in local browser storage and preserve the selected slot assignments. The importer requires explicit six-digit hex values for background, foreground, and all slots 0–15; it does not follow `config-file` includes or resolve named colors. Ghostty background and foreground are read separately from slots 0 and 7, since custom themes may define them differently. Theme-agnostic export still writes indices; specific-theme export uses the imported colors as fixed role defaults.

Three additional color controls independently set the **mode → branch**, **branch → tabs**, and **between tabs** separator icons. Each has its own KDL color role and supports either palette indices or fixed hex values. All three boundaries offer the same separator choices, including space and none.

## Bottom-right content

Under **Bottom right**, select a clock, Git branch, session name, custom text, or hide the area. Clock controls include time/date formats, an IANA timezone (such as `America/Denver` or `UTC`), and an optional icon. The initial timezone follows the browser. Invalid timezone input keeps the last valid setting in the preview and export.

The clock preview samples the time when settings change. Session preview text is illustrative; exported KDL uses the actual Zellij session name. The **Secondary text** color (`$muted`) controls clock, session, and custom text colors. Choosing **Git branch** enables the branch and moves it from the left to the right, using the **Git branch** color (`$branch`). Its branch → tabs separator is omitted on the right. The **Git branch** checkbox above the preview controls its visibility; choosing another right-hand content returns a visible branch to the left.

## Export

Use **Copy KDL** and save the result under `~/.config/zellij/layouts/`. Install [zjstatus](https://github.com/dj95/zjstatus) at `~/.config/zellij/plugins/zjstatus.wasm`, or edit the plugin location in the export. Branch output uses the [command widget](https://github.com/dj95/zjstatus/blob/main/src/widgets/command.rs) with `hideonemptystdout` so its separator disappears when there is no branch.

The generated layout follows the selected styles, branch visibility, separators, colors, and right-hand content. Check font alignment and default-background resets in Zellij before regular use. Slant preview caps use CSS triangles aligned to the fill height; KDL retains the Powerline glyphs `` and ``.

Boxcar needs two content rows. Half-cell Hatch uses browser color blends that zjstatus does not calculate automatically. The browser simulates glass; it is not a terminal screenshot. Terminal output, branch, and session names are sample data. The bundled JetBrains Mono Nerd Font retains its OFL license in `assets/OFL.txt`.

## Browser checks

With Node.js installed, install the optional test dependency and browser:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/workbench.cjs
```

To use an existing Chromium, set `CHROMIUM_PATH=/path/to/chromium`. The checks compare every bundled theme slot with its reference config, exercise Ghostty import and persistence, all 16 slot choices, separator exports, color-mode switching, per-mode colors, branch styles, persistence, Slant geometry, right-hand content, timezone validation, and mobile width. They do not launch Zellij.

The original source projects remain available in `../zellij-bar-designs/` and `../zellij_color_lab/` on the original author's machine.
