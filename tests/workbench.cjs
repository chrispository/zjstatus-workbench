// Run with a local Playwright install; no server or network is used by the app.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.WORKBENCH_PLAYWRIGHT || 'playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const code = () => page.locator('#layout-code').textContent();
    const slot = role => page.locator(`[data-theme-color-role="${role}"]`);
    const kdlValue = (text, key) => JSON.parse(text.split('\n').find(line => line.trimStart().startsWith(key + ' ')).trim().slice(key.length + 1));
    const zone = name => page.locator(`#zone-editor [data-zone="${name}"] [data-widget]`).evaluateAll(nodes => nodes.map(n => n.dataset.widget));
    const removeWidget = id => page.locator(`#zone-editor [data-widget="${id}"] [data-remove]`).click();
    const addWidget = (name, id) => page.locator(`[data-add-zone="${name}"]`).selectOption(id);
    const setZone = async (name, ids) => { for (const id of await zone(name)) await removeWidget(id); for (const id of ids) await addWidget(name, id); };
    const widget = id => page.locator(`#hero-bar [data-inspect="w-${id}"]`);
    const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const clearStorage = async () => { await page.evaluate(() => localStorage.clear()); await page.goto(url); await page.evaluate(() => document.fonts.ready); };

    assert.equal(await page.locator('#color-mode').inputValue(), 'agnostic');
    assert.equal(await page.locator('.palette-color-select').count(), 15);
    for (const select of await page.locator('.palette-color-select').all()) {
      assert.equal(await select.locator('option').count(), 16);
    }
    assert.deepEqual(await zone('left'), ['mode', 'branch', 'tabs']);
    assert.deepEqual(await zone('center'), []);
    assert.deepEqual(await zone('right'), ['clock']);
    // Compare every bundled slot with its traceable Ghostty snapshot.
    for (const [key, name] of [['moonlit','moonlit-sands'],['greek','greek-noir'],['forest','everforest'],['outpost','outpost']]) {
      await page.locator('#palette').selectOption(key);
      const snapshot = fs.readFileSync(path.resolve(__dirname, `../assets/palettes/${name}.conf`), 'utf8');
      for (const [, index, hex] of snapshot.matchAll(/^palette = (\d+)=(#[\da-f]{6})$/gm)) {
        await slot('a').selectOption(index);
        assert.ok((await slot('a').locator('option:checked').textContent()).endsWith(hex.toUpperCase()));
        assert.equal(await page.locator('[data-color-role="a"]').inputValue(), hex);
      }
    }
    await page.locator('#palette').selectOption('moonlit');
    assert.equal(await slot('a').locator('option[value="6"]').textContent(), 'palette6 · cyan · #4B7172');
    assert.equal(await slot('a').locator('option[value="4"]').textContent(), 'palette4 · blue · #4E6F91');
    for (let i = 0; i < 16; i++) {
      await slot('a').selectOption(String(i));
      assert.match(await code(), new RegExp(`color_accent "${i}"`));
    }
    await slot('modeSeparatorColor').selectOption('1');
    await slot('branchSeparatorColor').selectOption('2');
    await slot('tabSeparatorColor').selectOption('5');
    await slot('widgetSeparatorColor').selectOption('9');
    await slot('border').selectOption('10');
    await page.locator('#branch-separator').selectOption('diamond');
    let kdl = await code();
    assert.match(kdl, /color_mode_separator "1"/);
    assert.match(kdl, /color_branch_separator "2"/);
    assert.match(kdl, /color_tab_separator "5"/);
    assert.match(kdl, /color_widget_separator "9"/);
    assert.match(kdl, /color_border "10"/);
    assert.match(kdl, /format_left .*\$mode_separator/);
    assert.match(kdl, /command_git_branch_format .*\$branch_separator.*◆/);
    assert.match(kdl, /command_git_branch_hideonemptystdout "true"/);
    assert.match(kdl, /tab_separator .*\$tab_separator/);
    assert.equal(await page.locator('#hero-bar .joiner-mode').evaluate(el => getComputedStyle(el).color), 'rgb(172, 85, 57)');
    await page.reload();
    assert.equal(await slot('tabSeparatorColor').inputValue(), '5');
    await page.locator('#palette').selectOption('forest');
    assert.equal(await slot('a').inputValue(), '15');
    await page.locator('#color-mode').selectOption('specific');
    const fixed = page.locator('[data-color-role="branchSeparatorColor"]');
    await fixed.fill('#123456');
    assert.match(await code(), /color_branch_separator "#123456"/);
    await page.locator('#color-mode').selectOption('agnostic');
    assert.equal(await slot('branchSeparatorColor').inputValue(), '2');
    await page.locator('#color-mode').selectOption('specific');
    assert.equal(await fixed.inputValue(), '#123456');
    await page.locator('#tab-style').selectOption('stencil');
    assert.match(await code(), /tab_separator .*\$tab_separator,bg=\$accent/);
    await page.locator('#tab-separator').selectOption('none');
    assert.match(await code(), /tab_separator ""/);
    await removeWidget('branch');
    assert.doesNotMatch(await code(), /command_git_branch/);
    await page.locator('#color-mode').selectOption('agnostic');
    await page.locator('#reset-colors').click();
    assert.equal(await slot('a').inputValue(), '6');
    await page.locator('#mode-style').selectOption('slant');
    await page.locator('#tab-style').selectOption('slant');
    for (const target of ['.mode', '.token.active']) {
      const metrics = await page.locator('#hero-bar ' + target).evaluate(el => {
        const edges = [...el.querySelectorAll('.edge')];
        return { heights: [...edges, el.querySelector('.fill')].map(x => x.getBoundingClientRect().height), clips: edges.map(x => getComputedStyle(x).clipPath) };
      });
      assert.equal(new Set(metrics.heights).size, 1);
      assert.ok(metrics.clips.every(x => x.startsWith('polygon(')));
    }

    // Clock, session, and custom text widgets.
    await page.locator('#clock-format').selectOption('%Y-%m-%d %H:%M');
    await page.locator('#clock-timezone').fill('utc');
    await page.locator('#clock-icon').fill('');
    assert.match(await code(), /datetime_format "%Y-%m-%d %H:%M"/);
    assert.match(await code(), /datetime_timezone "UTC"/);
    assert.equal(kdlValue(await code(), 'datetime'), '#[fg=$muted]{format}');
    assert.match(await widget('clock').textContent(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    await page.locator('#clock-timezone').fill('Invalid/Timezone');
    assert.equal(await page.locator('#clock-timezone').getAttribute('aria-invalid'), 'true');
    assert.match(await code(), /datetime_timezone "UTC"/);
    await setZone('right', ['session']);
    await page.locator('#session-name').fill('Sample session');
    assert.match(await code(), /format_right "#\[fg=\$muted\]\{session\}"/);
    assert.doesNotMatch(await code(), /datetime_format/);
    assert.equal(await widget('session').textContent(), 'Sample session');
    await setZone('right', ['text']);
    await page.locator('#right-text').fill('<workspace> "alpha"');
    assert.equal(await widget('text').textContent(), '<workspace> "alpha"');
    assert.equal(kdlValue(await code(), 'format_right'), '#[fg=$muted]<workspace> "alpha"');
    await page.reload();
    assert.deepEqual(await zone('right'), ['text']);
    assert.equal(await page.locator('#right-text').inputValue(), '<workspace> "alpha"');
    await setZone('right', []);
    assert.match(await code(), /format_right ""/);
    assert.equal(await page.locator('#hero-bar .zone-right').evaluate(el => el.children.length), 0);

    // The Git branch can live in any section; the separator travels with it.
    await addWidget('right', 'branch');
    await slot('branch').selectOption('10');
    assert.equal(await page.locator('#hero-bar .zone-left .branch').count(), 0);
    assert.equal(await page.locator('#hero-bar .zone-right .branch').textContent(), 'main');
    assert.equal(await page.locator('#hero-bar .zone-right .branch').evaluate(el => getComputedStyle(el).color), 'rgb(167, 192, 128)');
    assert.equal(await page.locator('#branch-separator').isDisabled(), true);
    kdl = await code();
    assert.match(kdl, /color_branch "10"/);
    assert.match(kdl, /format_right "\{command_git_branch\}"/);
    assert.doesNotMatch(kdlValue(kdl, 'format_left'), /command_git_branch/);
    assert.equal(kdlValue(kdl, 'command_git_branch_format'), '#[fg=$branch,italic]{stdout}');
    await page.locator('#color-mode').selectOption('specific');
    await page.locator('[data-color-role="branch"]').fill('#123abc');
    assert.match(await code(), /color_branch "#123abc"/);
    assert.equal(await page.locator('#hero-bar .zone-right .branch').evaluate(el => getComputedStyle(el).color), 'rgb(18, 58, 188)');
    await page.locator('#color-mode').selectOption('agnostic');
    await page.reload();
    assert.deepEqual(await zone('right'), ['branch']);
    // Outside a repository the branch disappears from the preview but stays in the export.
    await page.locator('#in-repo').uncheck();
    assert.equal(await page.locator('#hero-bar .branch').count(), 0);
    assert.match(await code(), /format_right "\{command_git_branch\}"/);
    await page.reload();
    assert.equal(await page.locator('#in-repo').isChecked(), false);
    await page.locator('#in-repo').check();
    await removeWidget('branch');
    assert.equal(await page.locator('#in-repo').isVisible(), false);
    await page.locator('[data-add-zone="left"]').selectOption('branch');
    // Move branch before the tabs with the arrow buttons.
    await page.locator('#zone-editor [data-widget="branch"] [data-move="prev"]').click();
    assert.deepEqual(await zone('left'), ['mode', 'branch', 'tabs']);
    assert.equal(await page.locator('#hero-bar .zone-left .branch').count(), 1);
    assert.equal(await page.locator('#branch-separator').isDisabled(), false);
    assert.match(await code(), /command_git_branch_format .*\$branch_separator.*◆/);
    // Branch extras.
    await page.locator('#branch-dirty').check();
    await page.locator('#branch-ahead').check();
    await page.locator('#branch-icon').fill('');
    assert.equal(await page.locator('#hero-bar .branch').textContent(), 'main* ↑1');
    const branchCmd = kdlValue(await code(), 'command_git_branch_command');
    assert.ok(branchCmd.startsWith("bash -c '") && branchCmd.endsWith("'"));
    assert.ok(!branchCmd.slice(9, -1).includes("'"), 'inner script must not contain single quotes');
    assert.ok(!branchCmd.includes('\\'), 'zjstatus keeps backslashes, so commands must not use them');
    assert.match(branchCmd, /git status --porcelain/);
    assert.match(branchCmd, /rev-list --left-right --count HEAD\.\.\.@\{u\}/);
    assert.match(kdlValue(await code(), 'command_git_branch_format'), /\{stdout\}/);
    await page.locator('#branch-dirty').uncheck();
    await page.locator('#branch-ahead').uncheck();
    await page.locator('#branch-icon').fill('');
    assert.equal(kdlValue(await code(), 'command_git_branch_command'), 'git branch --show-current');

    // Import exact Ghostty colors, including a background different from palette0.
    const importedConfig = 'background = #101010\nforeground = #ededed\n' + Array.from({length:16}, (_,i) => `palette = ${i}=#${i.toString(16).repeat(6)}`).join('\n');
    await page.locator('#theme-file').setInputFiles({name:'Custom "theme".conf',mimeType:'text/plain',buffer:Buffer.from(importedConfig)});
    await page.waitForFunction(() => document.querySelector('#palette').value === 'imported');
    assert.equal(await slot('a').inputValue(), '6');
    assert.equal(await page.locator('[data-color-role="a"]').inputValue(), '#666666');
    assert.match(await code(), /color_accent "6"/);
    await page.reload();
    assert.equal(await page.locator('#palette').inputValue(), 'imported');
    assert.equal(await page.locator('[data-color-role="a"]').inputValue(), '#666666');
    await page.locator('#color-mode').selectOption('specific');
    assert.match(await code(), /color_background "#101010"/);
    assert.match(await code(), /color_foreground "#ededed"/);
    assert.equal(await page.locator('.branch-choice').last().getAttribute('title'), 'Custom "theme".conf: #444444');
    await page.locator('#theme-file').setInputFiles({name:'Incomplete.conf',mimeType:'text/plain',buffer:Buffer.from('palette = 0=#000000')});
    await page.waitForFunction(() => document.querySelector('#theme-import-error').textContent.includes('all palette0'));
    assert.equal(await page.locator('#palette').inputValue(), 'imported');
    await page.locator('#theme-import-error').evaluate(el => el.hidden = true);

    // Every component has the same styles, and branch shapes work on both sides.
    const styles = await page.locator('#branch-style option').evaluateAll(nodes => nodes.map(n => n.value));
    for (const kind of ['mode', 'tab', 'widget']) {
      assert.deepEqual(await page.locator(`#${kind}-style option`).evaluateAll(nodes => nodes.map(n => n.value)), styles);
    }
    for (const style of ['flag', 'flaginset', 'baseline']) assert.ok(styles.includes(style));
    await page.locator('#mode-style').selectOption('plain');
    await page.locator('#tab-style').selectOption('plain');
    const filledStyles = ['flag','flaginset','baseline','slant','dovetail','tickets','hatch','hatchhalf','hatchcompact'];
    for (const position of ['left', 'right']) {
      await removeWidget('branch');
      if (position === 'left') { await addWidget('left', 'branch'); await page.locator('#zone-editor [data-widget="branch"] [data-move="prev"]').click(); }
      else await setZone('right', ['branch']);
      for (const style of styles) {
        await page.locator('#branch-style').selectOption(style);
        const branch = page.locator('#hero-bar .branch');
        assert.equal(await branch.count(), 1);
        assert.match(await branch.textContent(), /main/);
        assert.ok(await branch.evaluate(el => el.scrollWidth <= el.clientWidth + 1), style + ' must not clip');
        const format = kdlValue(await code(), 'command_git_branch_format');
        assert.ok(format.includes('{stdout}'), style);
        assert.ok(format.includes('$branch'), style);
        assert.equal(format.includes('$branch_separator'), position === 'left');
        assert.equal(await page.locator('#hero-bar .bar').evaluate(el => el.classList.contains('row2')), style === 'boxcar');
        assert.match(await code(), new RegExp(`pane size=${style === 'boxcar' ? 3 : 2} borderless`));
        if (filledStyles.includes(style)) {
          assert.match(format, /bg=\$branch/);
          assert.equal(await branch.locator('.fill').evaluate(el => getComputedStyle(el).backgroundColor), await branch.evaluate(el => getComputedStyle(el).color));
        }
        if (style === 'slant') {
          const heights = await branch.evaluate(el => [...el.children].map(child => child.getBoundingClientRect().height));
          assert.equal(new Set(heights).size, 1);
          assert.ok(await branch.locator('.edge').evaluateAll(nodes => nodes.every(n => getComputedStyle(n).clipPath.startsWith('polygon('))));
        }
      }
    }
    await page.locator('#branch-style').selectOption('baseline');
    await page.reload();
    assert.equal(await page.locator('#branch-style').inputValue(), 'baseline');
    assert.equal(await page.locator('#hero-bar .zone-right .branch .edge').first().textContent(), '\ue0b6');
    await page.locator('#branch-style').selectOption('boxcar');
    await removeWidget('branch');
    assert.match(await code(), /pane size=2 borderless/);
    await addWidget('left', 'branch');
    await page.locator('#branch-style').selectOption('plain');

    // Mode colors.
    await page.locator('#color-mode').selectOption('agnostic');
    const modeColor = key => page.locator(`[data-mode-color="${key}"]`);
    const modes = await page.locator('[data-mode-color]').evaluateAll(nodes => nodes.map(n => n.dataset.modeColor));
    assert.equal(modes.length, 14);
    for (const style of ['plain','slant']) {
      await page.locator('#mode-style').selectOption(style);
      const expected = await slot(style === 'plain' ? 'fg' : 'modeFill').inputValue();
      for (const key of modes) assert.equal(kdlValue(await code(), 'color_mode_' + key), expected);
      const colors = new Set();
      for (const label of await page.locator('#preview-mode option').evaluateAll(nodes => nodes.map(n => n.value))) {
        await page.locator('#preview-mode').selectOption(label);
        colors.add(await page.locator('#hero-bar .mode').evaluate(el => getComputedStyle(el).color));
      }
      assert.equal(colors.size, 1);
    }
    await modeColor('normal').selectOption('11');
    await modeColor('pane').selectOption('4');
    for (const key of modes) assert.equal(kdlValue(await code(), 'color_mode_' + key), key === 'pane' ? '4' : '11');
    await page.locator('#preview-mode').selectOption('PANE');
    assert.equal(await page.locator('#hero-bar .mode').evaluate(el => getComputedStyle(el).color), 'rgb(68, 68, 68)');
    await page.locator('#color-mode').selectOption('specific');
    await modeColor('pane').selectOption('custom');
    await page.locator('[data-mode-hex="pane"]').fill('#abcdef');
    assert.equal(kdlValue(await code(), 'color_mode_pane'), '#abcdef');
    assert.equal(await page.locator('#hero-bar .mode').evaluate(el => getComputedStyle(el).color), 'rgb(171, 205, 239)');
    await page.locator('#color-mode').selectOption('agnostic');
    assert.equal(await modeColor('pane').inputValue(), '4');
    await page.reload();
    assert.equal(await page.locator('#preview-mode').inputValue(), 'PANE');
    assert.equal(await modeColor('normal').inputValue(), '11');
    assert.equal(await modeColor('pane').inputValue(), '4');
    await page.locator('#reset-mode-colors').click();
    assert.equal(await modeColor('normal').inputValue(), 'inherit');
    assert.equal(await modeColor('pane').inputValue(), 'inherit');
    await page.locator('#color-mode').selectOption('specific');
    assert.equal(await modeColor('pane').inputValue(), 'custom');
    assert.equal(await page.locator('[data-mode-hex="pane"]').inputValue(), '#abcdef');
    await page.locator('#reset-mode-colors').click();
    assert.equal(await modeColor('pane').inputValue(), 'inherit');
    await page.locator('#color-mode').selectOption('agnostic');

    // Old (v2) settings migrate to sections, keep the color mode, and drop invalid values.
    await page.evaluate(() => localStorage.setItem('zellij-workbench-settings-v1', JSON.stringify({modeColorOverrides:{normal:{slot:99,hex:'invalid'},pane:{slot:-1},scroll:'invalid'},branchDesign:'invalid',themeAgnostic:false,paletteOverrides:{branch:'#abcdef'},paletteSlots:{a:99,bg:-1,fg:'3'},rightContent:'branch',showBranch:true,crowded:true})));
    await page.reload();
    assert.equal(await page.locator('#color-mode').inputValue(), 'specific');
    assert.equal(await page.locator('[data-color-role="branch"]').inputValue(), '#abcdef');
    assert.deepEqual(await zone('left'), ['mode', 'tabs']);
    assert.deepEqual(await zone('right'), ['branch']);
    assert.equal(await page.locator('#tab-count').inputValue(), '8');
    await page.locator('#color-mode').selectOption('agnostic');
    assert.equal(await slot('a').inputValue(), '6');
    assert.equal(await page.locator('#branch-style').inputValue(), 'plain');
    assert.equal(await modeColor('normal').inputValue(), 'inherit');
    assert.equal(await modeColor('pane').inputValue(), 'inherit');
    await page.evaluate(() => localStorage.setItem('zellij-workbench-settings-v1', JSON.stringify({showBranch:false,rightContent:'hidden',zones:'bad'})));
    await page.reload();
    assert.deepEqual(await zone('left'), ['mode', 'tabs']);
    assert.deepEqual(await zone('right'), []);
    await page.evaluate(() => localStorage.setItem('zellij-workbench-settings-v1', JSON.stringify({zones:{left:['tabs','tabs','bogus'],right:['tabs','clock']},precedence:'llr',borderChar:'X',tabLabel:'{evil}',customInterval:-4})));
    await page.reload();
    assert.deepEqual(await zone('left'), ['tabs']);
    assert.deepEqual(await zone('right'), ['clock']);
    assert.match(await code(), /format_precedence "lcr"/);
    assert.match(await code(), /border_char " "/);
    assert.match(await code(), /tab_active .*\{index\} \{name\}/);

    // ───── Layout: sections, position, border, gap fill ─────
    await clearStorage();
    await page.locator('#zone-editor [data-widget="tabs"] [data-move="down"]').click();
    assert.deepEqual(await zone('center'), ['tabs']);
    kdl = await code();
    assert.equal(kdlValue(kdl, 'format_center'), '{tabs}');
    assert.equal(kdlValue(kdl, 'format_left'), '{mode}#[fg=$mode_separator] ⣿ {command_git_branch}');
    assert.equal(kdlValue(kdl, 'command_git_branch_format'), '#[fg=$branch,italic]{stdout}', 'last widget in a section has no separator');
    assert.equal(await page.locator('#hero-bar .zone-center .tabs').count(), 1);
    // Drag the clock from the right section to the start of the left one.
    await page.locator('#zone-editor [data-widget="clock"]').dragTo(page.locator('#zone-editor [data-widget="mode"]'), { targetPosition: { x: 4, y: 8 } });
    assert.deepEqual(await zone('left'), ['clock', 'mode', 'branch']);
    assert.equal(kdlValue(await code(), 'format_left').startsWith('{datetime}#[fg=$widget_separator] · {mode}'), true);
    assert.equal(await page.locator('#hero-bar .zone-left .joiner-widget').count(), 1);
    await page.locator('#bar-position').selectOption('top');
    kdl = await code();
    assert.ok(kdl.indexOf('pane size=') < kdl.indexOf('children'), 'top bar comes before children');
    assert.match(kdl, /border_position "bottom"/);
    assert.equal(await page.locator('.terminal').evaluate(el => el.classList.contains('bar-top')), true);
    assert.equal(await page.locator('#hero-bar .bar-frame > :last-child').evaluate(el => el.className), 'border-row');
    await page.locator('#border').selectOption('off');
    assert.match(await code(), /border_enabled "false"/);
    assert.match(await code(), /pane size=1 borderless/);
    assert.equal(await page.locator('#hero-bar .border-row').count(), 0);
    await page.locator('#border').selectOption('top');
    await page.locator('#border-char').selectOption('─');
    assert.match(await code(), /border_char "─"/);
    assert.match(await page.locator('#hero-bar .border-row').textContent(), /^─+$/);
    await page.locator('#gap-fill').selectOption('background');
    assert.equal(kdlValue(await code(), 'format_space'), '#[bg=$background]');
    await page.locator('#precedence').selectOption('crl');
    assert.match(await code(), /format_precedence "crl"/);
    await page.locator('#hide-overlength').uncheck();
    assert.match(await code(), /format_hide_on_overlength "false"/);
    assert.equal(await page.locator('#precedence').isDisabled(), true);

    // Overlength: the port of zjstatus trim_output.
    const trim = (w, cols, p) => page.evaluate(([w, cols, p]) => trimSections(w, cols, p), [w, cols, p]);
    assert.deepEqual(await trim({left:70,center:0,right:20}, 80, 'lcr'), ['center', 'right'], 'an empty center is also emptied, as in zjstatus');
    assert.deepEqual(await trim({left:70,center:0,right:20}, 80, 'rlc'), ['center', 'left']);
    assert.deepEqual(await trim({left:30,center:30,right:10}, 80, 'lcr'), ['center']);
    assert.deepEqual(await trim({left:20,center:10,right:20}, 80, 'lcr'), []);
    await clearStorage();
    await page.locator('#tab-count').selectOption('16');
    for (const id of ['session', 'battery', 'load', 'host']) await addWidget('right', id);
    await page.locator('#preview-width').selectOption('80');
    await settle();
    assert.equal(await page.locator('#cols-readout').textContent(), '80 columns');
    assert.equal(await page.locator('#hero-bar .zone-right').isHidden(), true);
    assert.match(await page.locator('#overflow-hint').textContent(), /hides the right section/);
    await page.locator('#hide-overlength').uncheck();
    await settle();
    assert.equal(await page.locator('#hero-bar .zone-right').isHidden(), false);
    assert.match(await page.locator('#overflow-hint').textContent(), /cuts it off at 80/);
    await page.locator('#preview-width').selectOption('fit');

    // ───── Tabs: labels, inactive shapes, indicators, overflow ─────
    await clearStorage();
    await page.locator('#tab-label').selectOption('{index}:{name}');
    await page.locator('#tab-icon').fill('>');
    assert.match(await page.locator('#hero-bar .token.active').textContent(), /^.? > 2:editor .?$/);
    assert.match(kdlValue(await code(), 'tab_active'), /> \{index\}:\{name\}\{fullscreen_indicator\}\{sync_indicator\}\{floating_indicator\}/);
    await page.locator('#zero-index').check();
    assert.match(await page.locator('#hero-bar .token.active').textContent(), /1:editor/);
    assert.match(await code(), /tab_zero_based_index "true"/);
    await page.locator('#inactive-style').selectOption('brackets');
    assert.equal(kdlValue(await code(), 'tab_normal'), '#[fg=$dim,bold][ > {index}:{name}{fullscreen_indicator}{sync_indicator}{floating_indicator} ]');
    assert.equal(await page.locator('#hero-bar .token.shaped').count(), 3);
    assert.match(await page.locator('#hero-bar .token.shaped').first().textContent(), /^\[ > 0:shell \]$/);
    await page.locator('#inactive-style').selectOption('flag');
    assert.equal(await page.locator('#hero-bar .token.shaped .fill').first().evaluate(el => getComputedStyle(el).backgroundColor), await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dim').trim()).then(hex => `rgb(${[1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`));
    assert.match(kdlValue(await code(), 'tab_normal'), /bg=\$dim/);
    await page.locator('#inactive-style').selectOption('auto');
    await page.locator('[data-indicator="fullscreen"]').fill(' [Z]');
    await page.locator('#tab-state').selectOption('fullscreen');
    assert.match(await page.locator('#hero-bar .token.active').textContent(), /editor \[Z\]/);
    assert.match(await code(), /tab_fullscreen_indicator " \[Z\]"/);
    await page.locator('#tab-state').selectOption('normal');
    await page.locator('#tab-label').selectOption('{index} {name}');
    await page.locator('#tab-icon').fill('');
    await page.locator('#zero-index').uncheck();
    await page.locator('#tab-count').selectOption('12');
    await page.locator('#display-count').selectOption('4');
    assert.equal(await page.locator('#hero-bar .token').count(), 4);
    assert.equal(await page.locator('#hero-bar .trunc-start').count(), 0);
    assert.equal(await page.locator('#hero-bar .trunc-end').textContent(), ' +8 →');
    await page.locator('#hero-bar [data-tab="3"]').click();
    assert.equal(await page.locator('#hero-bar .trunc-start').textContent(), '← +2 ');
    assert.equal(await page.locator('#hero-bar .trunc-end').textContent(), ' +6 →');
    kdl = await code();
    assert.match(kdl, /tab_display_count "4"/);
    assert.equal(kdlValue(kdl, 'tab_truncate_start_format'), '#[fg=$dim]← +{count} ');
    await page.evaluate(() => { state.active = 11; render(); });
    assert.equal(await page.locator('#hero-bar .trunc-start').textContent(), '← +8 ');
    assert.equal(await page.locator('#hero-bar .trunc-end').count(), 0);

    // ───── Modes: label styles, custom labels, hiding NORMAL ─────
    await clearStorage();
    await page.locator('[data-label-style="short"]').click();
    assert.equal(await page.locator('#hero-bar .mode').textContent(), 'NOR');
    assert.equal(kdlValue(await code(), 'mode_locked'), '#[fg=$mode_locked,bold]LCK');
    await page.locator('[data-label-style="custom"]').click();
    assert.equal(await page.locator('[data-mode-label="locked"]').inputValue(), 'LCK');
    await page.locator('[data-mode-label="normal"]').fill('λ');
    assert.equal(await page.locator('#hero-bar .mode').textContent(), 'λ');
    assert.equal(kdlValue(await code(), 'mode_normal'), '#[fg=$mode_normal,bold]λ');
    await page.locator('#hide-normal').check();
    assert.equal(await page.locator('#hero-bar .mode').count(), 0);
    assert.equal(await page.locator('#hero-bar .joiner-mode').count(), 0);
    kdl = await code();
    assert.equal(kdlValue(kdl, 'mode_normal'), '');
    assert.equal(kdlValue(kdl, 'mode_locked'), '#[fg=$mode_locked,bold]LCK#[fg=$mode_separator] ⣿ ');
    assert.ok(kdlValue(kdl, 'format_left').startsWith('{mode}{command_git_branch}'));
    await page.locator('#preview-mode').selectOption('LOCKED');
    assert.equal(await page.locator('#hero-bar .mode').textContent(), 'LCK');
    assert.equal(await page.locator('#hero-bar .joiner-mode').count(), 1);

    // ───── Widgets ─────
    await clearStorage();
    await addWidget('right', 'battery');
    await addWidget('right', 'notify');
    await addWidget('center', 'cmd');
    kdl = await code();
    assert.equal(kdlValue(kdl, 'format_right'), '{datetime}#[fg=$widget_separator] · {command_battery}{notifications}');
    assert.match(kdlValue(kdl, 'command_battery_command'), /power_supply/);
    assert.equal(kdlValue(kdl, 'command_battery_format'), '#[fg=$muted] {stdout}#[fg=$widget_separator] · ');
    assert.equal(kdlValue(kdl, 'notification_format_unread'), '#[fg=$warning] {message}');
    for (const id of ['battery', 'load', 'host', 'kube']) {
      const cmd = (await page.evaluate(id => widgetDefs[id].command, id));
      assert.ok(!cmd.includes('\\'), id + ' must not use backslashes');
      if (cmd.startsWith('bash')) assert.ok(!cmd.slice(9, -1).includes("'"), id);
    }
    assert.match(await widget('battery').textContent(), /87%/);
    assert.equal(await widget('notify').count(), 0);
    await page.locator('#preview-notify').check();
    assert.match(await widget('notify').textContent(), /build finished/);
    assert.equal(await page.locator('#hero-bar .zone-right .joiner-widget').count(), 2);
    await page.locator('#custom-command').fill('bash -c \'uptime -p\'');
    await page.locator('#custom-interval').fill('30');
    await page.locator('#custom-preview').fill('up 3 hours');
    kdl = await code();
    assert.equal(kdlValue(kdl, 'command_cmd_command'), "bash -c 'uptime -p'");
    assert.equal(kdlValue(kdl, 'command_cmd_interval'), '30');
    assert.equal(await widget('cmd').textContent(), 'up 3 hours');
    await page.locator('#custom-interval').fill('x');
    assert.equal(await page.locator('#custom-interval').getAttribute('aria-invalid'), 'true');
    assert.equal(kdlValue(await code(), 'command_cmd_interval'), '30');
    await page.locator('[data-widget-icon="battery"]').fill('BAT');
    assert.equal(await widget('battery').textContent(), 'BAT 87%');
    // Per-widget shapes via Shapes → Widgets.
    await page.locator('#piece-tabs [data-piece="widget"]').click();
    await page.locator('#widget-target').selectOption('battery');
    await page.locator('[data-pick="widget"][data-value="brackets"]').click();
    assert.equal(await widget('battery').textContent(), '[ BAT 87% ]');
    assert.match(kdlValue(await code(), 'command_battery_format'), /^#\[fg=\$muted,bold\]\[ BAT \{stdout\} \]/);
    assert.equal(kdlValue(await code(), 'datetime'), '#[fg=$muted]◷ {format}');
    await page.locator('#widget-target').selectOption('notify');
    await page.locator('[data-pick="widget"][data-value="flag"]').click();
    assert.match(kdlValue(await code(), 'notification_format_unread'), /bg=\$warning/);
    // Clicking a widget in the preview targets it in Shapes.
    await widget('clock').click();
    assert.equal(await page.locator('#widget-target').inputValue(), 'clock');

    // ───── Share links, embedded state, KDL import ─────
    const exported = await code();
    const shared = await page.evaluate(() => shareUrl());
    assert.match(shared, /#s=[A-Za-z0-9_-]+$/);
    await clearStorage();
    assert.deepEqual(await zone('right'), ['clock']);
    await page.goto(shared);
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(await zone('right'), ['clock', 'battery', 'notify']);
    assert.deepEqual(await zone('center'), ['cmd']);
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.equal(await code(), exported);
    await page.reload();
    assert.equal(await code(), exported, 'shared settings persist');
    await clearStorage();
    await page.locator('#kdl-file').setInputFiles({ name: 'bar.kdl', mimeType: 'text/plain', buffer: Buffer.from(exported) });
    await page.waitForFunction(() => document.querySelector('#zone-editor [data-zone="center"] [data-widget]'));
    assert.equal(await code(), exported, 'import restores the exact export');
    const handWritten = `layout {
  default_tab_template {
    pane size=1 borderless=true {
      plugin location="file:zjstatus.wasm" {
        color_accent "#ff8800"
        color_branch "#00ff88"
        format_left "{mode} {tabs}"
        format_center "{command_git_branch}"
        format_right "{session} {command_weather} {datetime}"
        format_precedence "rlc"
        border_enabled "false"
        mode_normal "#[bg=$accent,fg=#000000,bold] NORMAL #[fg=$accent]\ue0b0"
        tab_active "#[fg=$accent,bold][ {index}:{name} ]"
        tab_display_count "6"
        command_weather_command "curl -s wttr.in?format=1"
        command_weather_interval "600"
        datetime_format "%H:%M:%S"
      }
    }
    children
  }
}`;
    await page.locator('#kdl-file').setInputFiles({ name: 'mine.kdl', mimeType: 'text/plain', buffer: Buffer.from(handWritten) });
    await page.waitForFunction(() => document.querySelector('#toast').textContent.startsWith('Imported'));
    assert.deepEqual(await zone('left'), ['mode', 'tabs']);
    assert.deepEqual(await zone('center'), ['branch']);
    assert.deepEqual(await zone('right'), ['session', 'cmd', 'clock']);
    assert.equal(await page.locator('#color-mode').inputValue(), 'specific');
    assert.equal(await page.locator('[data-color-role="a"]').inputValue(), '#ff8800');
    assert.equal(await page.locator('#tab-style').inputValue(), 'brackets');
    assert.equal(await page.locator('#mode-style').inputValue(), 'flag');
    assert.equal(await page.locator('#tab-label').inputValue(), '{index}:{name}');
    assert.equal(await page.locator('#display-count').inputValue(), '6');
    assert.equal(await page.locator('#border').inputValue(), 'off');
    assert.equal(await page.locator('#bar-position').inputValue(), 'top');
    assert.equal(await page.locator('#precedence').inputValue(), 'rlc');
    assert.equal(await page.locator('#clock-format').inputValue(), '%H:%M:%S');
    assert.equal(await page.locator('#custom-command').inputValue(), 'curl -s wttr.in?format=1');
    assert.equal(await page.locator('#custom-interval').inputValue(), '600');
    await page.locator('#kdl-file').setInputFiles({ name: 'nope.kdl', mimeType: 'text/plain', buffer: Buffer.from('layout { pane }') });
    await page.waitForFunction(() => document.querySelector('#toast').textContent.startsWith('No zjstatus'));
    assert.deepEqual(await zone('right'), ['session', 'cmd', 'clock'], 'a failed import changes nothing');

    // ───── Shuffle respects locks ─────
    await clearStorage();
    await page.locator('#locks summary').click();
    await page.locator('[data-lock="colors"]').check();
    await page.locator('[data-lock="layout"]').check();
    const before = await page.evaluate(() => JSON.stringify([state.paletteSlots, state.zones, state.tabLabel]));
    const shapesSeen = new Set();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Escape');
      await page.locator('#shuffle').click();
      shapesSeen.add(await page.evaluate(() => state.modeDesign + '/' + state.tabDesign));
      assert.equal(await page.evaluate(() => JSON.stringify([state.paletteSlots, state.zones, state.tabLabel])), before);
    }
    assert.ok(shapesSeen.size > 1, 'unlocked shapes change');
    await page.reload();
    assert.equal(await page.locator('[data-lock="colors"]').isChecked(), true);

    assert.deepEqual(errors, []);
    console.log('Passed: theme palettes, Ghostty import, slots, separators, persistence and migration, mode colors and labels, Slant geometry, clock and timezones, sections and drag-and-drop, bar position and borders, overlength trimming, tab labels, inactive shapes, indicators, tab windows, branch shapes and extras, status widgets, per-widget shapes, share links, KDL round-trip and import, and shuffle locks.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
