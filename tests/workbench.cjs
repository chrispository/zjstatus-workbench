// Run with a local Playwright install; no server or network is used by the app.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
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
    assert.equal(await page.locator('#color-mode').inputValue(), 'agnostic');
    assert.equal(await page.locator('.palette-color-select').count(), 13);
    for (const select of await page.locator('.palette-color-select').all()) {
      assert.equal(await select.locator('option').count(), 16);
    }
    // Compare every bundled slot with its traceable Ghostty snapshot.
    const fs = require('node:fs');
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
    await page.locator('#branch-separator').selectOption('diamond');
    let kdl = await code();
    assert.match(kdl, /color_mode_separator "1"/);
    assert.match(kdl, /color_branch_separator "2"/);
    assert.match(kdl, /color_tab_separator "5"/);
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
    await page.locator('#show-branch').uncheck();
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
    await page.locator('#clock-format').selectOption('%Y-%m-%d %H:%M');
    await page.locator('#clock-timezone').fill('utc');
    await page.locator('#clock-icon').fill('');
    assert.match(await code(), /datetime_format "%Y-%m-%d %H:%M"/);
    assert.match(await code(), /datetime_timezone "UTC"/);
    assert.equal(await page.locator('#hero-bar .clock-glyph').count(), 0);
    assert.match(await page.locator('#hero-bar .clock').textContent(), /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    await page.locator('#clock-timezone').fill('Invalid/Timezone');
    assert.equal(await page.locator('#clock-timezone').getAttribute('aria-invalid'), 'true');
    assert.match(await code(), /datetime_timezone "UTC"/);
    await page.locator('#right-content').selectOption('session');
    await page.locator('#right-text').fill('Sample session');
    assert.match(await code(), /format_right "#\[fg=\$muted\]\{session\}"/);
    assert.equal(await page.locator('#hero-bar .clock').textContent(), 'Sample session');
    await page.locator('#right-content').selectOption('custom');
    await page.locator('#right-text').fill('<workspace> "alpha"');
    assert.equal(await page.locator('#hero-bar .clock').textContent(), '<workspace> "alpha"');
    await page.reload();
    assert.equal(await page.locator('#right-content').inputValue(), 'custom');
    assert.equal(await page.locator('#right-text').inputValue(), '<workspace> "alpha"');
    await page.locator('#right-content').selectOption('hidden');
    assert.match(await code(), /format_right ""/);
    assert.doesNotMatch(await code(), /datetime_format/);
    assert.equal(await page.locator('#hero-bar .clock').count(), 0);
    // Moving the branch to the right must update both preview and export once.
    await page.locator('#right-content').selectOption('branch');
    await slot('branch').selectOption('10');
    assert.equal(await page.locator('#show-branch').isChecked(), true);
    assert.equal(await page.locator('#hero-bar .bar-left .branch').count(), 0);
    assert.equal(await page.locator('#hero-bar .clock .branch').textContent(), 'main');
    assert.equal(await page.locator('#hero-bar .clock .branch').evaluate(el => getComputedStyle(el).color), 'rgb(167, 192, 128)');
    assert.equal(await page.locator('#branch-separator').isDisabled(), true);
    kdl = await code();
    assert.match(kdl, /color_branch "10"/);
    assert.match(kdl, /format_right "\{command_git_branch\}"/);
    assert.doesNotMatch(kdl.split('\n').find(line => line.trimStart().startsWith('format_left ')), /command_git_branch/);
    assert.match(kdl, /command_git_branch_format "#\[fg=\$branch,italic\]\{stdout\}"/);
    assert.match(kdl, /command_git_branch_hideonemptystdout "true"/);
    await page.locator('#color-mode').selectOption('specific');
    await page.locator('[data-color-role="branch"]').fill('#123abc');
    assert.match(await code(), /color_branch "#123abc"/);
    assert.equal(await page.locator('#hero-bar .clock .branch').evaluate(el => getComputedStyle(el).color), 'rgb(18, 58, 188)');
    await page.locator('#color-mode').selectOption('agnostic');
    await page.reload();
    assert.equal(await page.locator('#right-content').inputValue(), 'branch');
    assert.equal(await page.locator('#hero-bar .clock .branch').count(), 1);
    await page.locator('#show-branch').uncheck();
    assert.equal(await page.locator('#hero-bar .branch').count(), 0);
    assert.doesNotMatch(await code(), /command_git_branch/);
    assert.match(await code(), /format_right ""/);
    await page.reload();
    assert.equal(await page.locator('#right-content').inputValue(), 'branch');
    assert.equal(await page.locator('#show-branch').isChecked(), false);
    await page.locator('#show-branch').check();
    await page.locator('#right-content').selectOption('hidden');
    assert.equal(await page.locator('#hero-bar .bar-left .branch').count(), 1);
    assert.equal(await page.locator('#hero-bar .clock .branch').count(), 0);
    assert.equal(await page.locator('#branch-separator').isDisabled(), false);
    assert.match(await code(), /command_git_branch_format .*\$branch_separator.*◆/);
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
    // Every component has the same styles, including the original layout shapes.
    await page.locator('#theme-import-error').evaluate(el => el.hidden = true);
    const styles = await page.locator('#branch-style option').evaluateAll(nodes => nodes.map(n => n.value));
    for (const kind of ['mode', 'tab']) {
      assert.deepEqual(await page.locator(`#${kind}-style option`).evaluateAll(nodes => nodes.map(n => n.value)), styles);
    }
    for (const style of ['flag', 'flaginset', 'baseline']) assert.ok(styles.includes(style));
    await page.locator('#show-branch').check();
    await page.locator('#mode-style').selectOption('plain');
    await page.locator('#tab-style').selectOption('plain');
    await page.locator('#branch-separator').selectOption('diamond');
    const kdlValue = (text, key) => JSON.parse(text.split('\n').find(line => line.trimStart().startsWith(key + ' ')).trim().slice(key.length + 1));
    const filledStyles = ['flag','flaginset','baseline','slant','dovetail','tickets','hatch','hatchhalf','hatchcompact'];
    for (const position of ['hidden', 'branch']) {
      await page.locator('#right-content').selectOption(position);
      for (const style of styles) {
        await page.locator('#branch-style').selectOption(style);
        const branch = page.locator('#hero-bar .branch');
        assert.equal(await branch.count(), 1);
        assert.match(await branch.textContent(), /main/);
        assert.ok(await branch.evaluate(el => el.scrollWidth <= el.clientWidth + 1), style + ' must not clip');
        const format = kdlValue(await code(), 'command_git_branch_format');
        assert.ok(format.includes('{stdout}'), style);
        assert.ok(format.includes('$branch'), style);
        assert.equal(format.includes('$branch_separator'), position !== 'branch');
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
    assert.equal(await page.locator('#hero-bar .clock .branch .edge').first().textContent(), '');
    await page.locator('#branch-style').selectOption('boxcar');
    await page.locator('#show-branch').uncheck();
    assert.match(await code(), /pane size=2 borderless/);
    await page.locator('#show-branch').check();
    await page.locator('#branch-style').selectOption('plain');
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
    // Old settings retain the explicitly selected color mode and valid hex overrides.
    await page.evaluate(() => localStorage.setItem('zellij-workbench-settings-v1', JSON.stringify({modeColorOverrides:{normal:{slot:99,hex:'invalid'},pane:{slot:-1},scroll:'invalid'},branchDesign:'invalid',themeAgnostic:false,paletteOverrides:{branch:'#abcdef'},paletteSlots:{a:99,bg:-1,fg:'3'}})));
    await page.reload();
    assert.equal(await page.locator('#color-mode').inputValue(), 'specific');
    assert.equal(await page.locator('[data-color-role="branch"]').inputValue(), '#abcdef');
    await page.locator('#color-mode').selectOption('agnostic');
    assert.equal(await slot('a').inputValue(), '6');
    assert.equal(await page.locator('#branch-style').inputValue(), 'plain');
    assert.equal(await modeColor('normal').inputValue(), 'inherit');
    assert.equal(await modeColor('pane').inputValue(), 'inherit');
    assert.deepEqual(errors, []);
    console.log('Passed: exact theme palettes, Ghostty import, slots, exports, separators, persistence, mode switching, Slant geometry, right-hand content, timezones, branch shapes on both sides, all 14 mode colors, and settings validation.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
