/**
 * 暗い表示。**Clio-X が Footer に色を直書きしていて、暗くしても白いまま残った。**
 * 部品ごとに、実際の計算後の色を見て確かめる。
 */
import { test, expect } from '@playwright/test';

/** rgb(r,g,b) の明るさ。0=黒 1=白 */
async function luminance(page: import('@playwright/test').Page, selector: string, prop: string) {
  return page.locator(selector).first().evaluate((el, p) => {
    const v = getComputedStyle(el).getPropertyValue(p);
    const m = v.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }, prop);
}

const PAGES = ['/ja', '/ja/search', '/ja/about', '/ja/asset/01'];

for (const path of PAGES) {
  test(`${path} が暗い表示に追従する`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // 背景が暗いこと
    const body = await luminance(page, 'body', 'background-color');
    expect(body, `${path} の背景の明るさ`).not.toBeNull();
    expect(body!, `${path} の背景`).toBeLessThan(0.35);

    // フッタも暗いこと（ここが実際に壊れていた）
    if (await page.locator('footer').count()) {
      const footer = await luminance(page, 'footer', 'background-color');
      if (footer !== null) expect(footer, `${path} のフッタ背景`).toBeLessThan(0.4);
      const footerText = await luminance(page, 'footer', 'color');
      if (footerText !== null) expect(footerText, `${path} のフッタ文字`).toBeGreaterThan(0.4);
    }

    // ヘッダも暗いこと
    const header = await luminance(page, 'header', 'background-color');
    if (header !== null) expect(header, `${path} のヘッダ背景`).toBeLessThan(0.4);
  });
}

test('明るい表示に戻せる', async ({ page }) => {
  await page.goto('/ja');
  await page.evaluate(() => {
    localStorage.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');
  });
  await page.reload();
  const body = await luminance(page, 'body', 'background-color');
  expect(body!).toBeGreaterThan(0.8);
});
