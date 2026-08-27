/**
 * 全体の骨格。**内容の短いページでフッタが画面の途中に止まっていた。**
 */
import { test, expect } from '@playwright/test';

const SHORT_PAGES = ['/ja/about', '/en/about'];

for (const path of SHORT_PAGES) {
  test(`${path} でフッタが最下部にある`, async ({ page }) => {
    await page.goto(path);
    const viewport = page.viewportSize()!.height;
    const box = await page.locator('footer').first().boundingBox();
    expect(box, 'フッタの位置').not.toBeNull();
    // スクロールが無い（＝短い）ページでは、フッタの下端が画面の底に接していること
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 2);
    if (!scrollable) {
      expect(box!.y + box!.height, `${path} のフッタ下端`).toBeGreaterThan(viewport - 4);
    }
  });
}

test('本文の幅が本家と同じ上限に収まる', async ({ page }) => {
  // 本家の Container は --break-point--huge (1400px)。narrow は 62rem
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/ja/search');
  const width = await page.locator('main, .page-body > *').first()
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(width, '本文の幅').toBeLessThanOrEqual(1920);
  expect(width, '本文の幅').toBeGreaterThan(600);
});

test('横スクロールが出ない', async ({ page }) => {
  for (const path of ['/ja', '/ja/search', '/ja/asset/01']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} の横あふれ`).toBeLessThanOrEqual(1);
  }
});
