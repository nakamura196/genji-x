/**
 * アクセシビリティ。**axe で機械的に見る。**
 *
 * 「リンクが本文と区別できない」という指摘を受けて入れた。
 * 色だけで区別するのは WCAG 1.4.1（色だけに頼らない）違反で、
 * axe の link-in-text-block がまさにこれを検出する。
 * 自分で基準を書くより、確立した検査を通したほうが漏れが少ない。
 *
 * ── 見ているもの ────────────────────────────────────────────────
 * 色の対比 / 代替テキスト / フォームのラベル / 見出しの階層 /
 * ランドマーク / リンクの識別可能性 / 言語の指定 など WCAG 2.1 AA
 *
 * ── 明るい表示と暗い表示の両方で見る ────────────────────────────
 * 対比は表示によって変わる。片方だけ見ても意味がない。
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/ja', '/ja/search', '/ja/asset/01', '/ja/about', '/en'];

const analyze = (page: import('@playwright/test').Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

const format = (violations: Awaited<ReturnType<typeof analyze>>['violations']) =>
  violations.map((v) =>
    `[${v.impact}] ${v.id}: ${v.help}\n` +
    v.nodes.slice(0, 3).map((n) => `    ${n.html.slice(0, 110)}`).join('\n')
  ).join('\n');

for (const path of PAGES) {
  test(`${path} が WCAG 2.1 AA を満たす`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(600);
    const { violations } = await analyze(page);
    expect(violations.length, `\n${format(violations)}`).toBe(0);
  });
}

test('暗い表示でも WCAG 2.1 AA を満たす', async ({ page }) => {
  await page.goto('/ja');
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  for (const path of ['/ja', '/ja/search', '/ja/asset/01']) {
    await page.goto(path);
    await page.waitForTimeout(600);
    const { violations } = await analyze(page);
    expect(violations.length, `${path}（暗い表示）\n${format(violations)}`).toBe(0);
  }
});

test('本文中のリンクが色だけで区別されていない', async ({ page }) => {
  // WCAG 1.4.1。axe の link-in-text-block がこれを見る規則
  await page.goto('/ja/asset/01');
  await page.waitForTimeout(600);
  const { violations } = await new AxeBuilder({ page })
    .withRules(['link-in-text-block'])
    .analyze();
  expect(violations.length, `\n${format(violations)}`).toBe(0);
});

test('キーボードだけでヘッダを操作できる', async ({ page, browserName }) => {
  /**
   * **WebKit では走らせない。** macOS の Safari / WebKit は既定で
   * 「Tab ですべての項目を選ぶ」が切ってあり、Tab はフォームの入力欄にしか
   * 止まらない（実測: ヘッダに 8 個の a / button があるのに、Tab で辿れたのは
   * 検索欄と pre だけだった）。これはこちらの作りではなくブラウザの設定なので、
   * ここで落としても直しようがない。Chromium 側で見る。
   */
  test.skip(browserName === 'webkit',
    'WebKit は既定でリンクやボタンを Tab の対象にしない（ブラウザの設定）');
  await page.goto('/ja');
  // Tab で辿れて、フォーカスが見えること
  const focusable: string[] = [];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const inHeader = !!e.closest('header');
      return {
        tag: e.tagName, inHeader,
        outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
        shadow: s.boxShadow !== 'none',
        label: (e.getAttribute('aria-label') || e.textContent || '').slice(0, 20),
      };
    });
    if (!info) continue;
    if (info.inHeader) {
      focusable.push(info.label);
      expect(info.outline || info.shadow,
        `ヘッダの「${info.label}」にフォーカスの表示が無い`).toBe(true);
    }
  }
  expect(focusable.length, 'ヘッダで Tab で辿れる要素').toBeGreaterThan(2);
});
