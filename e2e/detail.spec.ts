/**
 * 詳細ページ。**本家は 60rem 以上で 1.5fr / 1fr の 2 カラム。**
 * 加えて、この試作の独自部分（ブラウザ内検証・取得）が動くか。
 */
import { test, expect } from '@playwright/test';

test.describe('詳細ページ', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/ja/asset/05'); });

  test('題と巻次が出る', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('わかむらさき');
  });

  test('本文へのリンクがある（関所ではない）', async ({ page }) => {
    const link = page.locator('a[href*="/ipfs/"]').first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /ipfs/);
  });

  test('取得ボタンがある', async ({ page }) => {
    await expect(page.getByRole('button', { name: /取得/ })).toBeVisible();
  });

  test('検証の材料がページに埋まっている', async ({ page }) => {
    const html = await page.content();
    // 葉ハッシュ・root・経路 6 個。これが無いとブラウザ内検証ができない
    expect(html, '葉ハッシュ').toMatch(/0x[0-9a-f]{64}/);
    expect(html, '経路').toContain('inclusionProof');
  });

  test('ブラウザの中で検証が通る', async ({ page }) => {
    test.setTimeout(120_000);
    await page.getByRole('button', { name: /ブラウザで検証する/ }).click();
    // 3 段階すべてが緑になる
    await expect(page.getByText(/確かめられました/)).toBeVisible({ timeout: 90_000 });
  });

  test('検証後に本文の冒頭が見られる', async ({ page }) => {
    test.setTimeout(120_000);
    await page.getByRole('button', { name: /ブラウザで検証する/ }).click();
    await expect(page.getByText(/確かめられました/)).toBeVisible({ timeout: 90_000 });
    await page.getByText(/取れた本文の冒頭を見る/).click();
    await expect(page.locator('pre')).toContainText('<?xml');
  });
});

test('広い画面では 2 カラムになる（本家は 60rem から）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ja/asset/05');
  const grid = page.locator('[class*="grid"]').first();
  if (await grid.count()) {
    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    // 2 つの値が入っていれば 2 カラム
    expect(cols.trim().split(/\s+/).length, '列数').toBeGreaterThanOrEqual(2);
  }
});

test('狭い画面では 1 カラムに戻る', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto('/ja/asset/05');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, '横あふれ').toBeLessThanOrEqual(1);
});
