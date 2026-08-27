/**
 * ヘッダ。**本家 (Ocean Market / Pontus-X) の actions を全部持っているか。**
 *
 * 本家の並び: 言語 → 検索 → ネットワーク → ウォレット → 設定(テーマ)
 * 逐次で作っていたとき、言語・検索・設定が丸ごと抜けていた。それを固定する。
 */
import { test, expect } from '@playwright/test';

test.describe('ヘッダの操作', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/ja'); });

  test('本家と同じ 5 つが揃っている', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header, 'ヘッダ自体').toBeVisible();
    // 言語 (ja / en の 2 つのボタン)
    await expect(page.getByRole('button', { name: 'ja', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'en', exact: true })).toBeVisible();
    // 検索
    await expect(page.getByRole('button', { name: '検索' })).toBeVisible();
    // ネットワーク
    await expect(header.getByText('Sepolia')).toBeVisible();
    // ウォレット（環境により「接続」か「未検出」）
    await expect(header.getByText(/ウォレット/)).toBeVisible();
    // 設定
    await expect(page.getByRole('button', { name: '設定' })).toBeVisible();
  });

  test('ヘッダが上に貼り付く', async ({ page }) => {
    const pos = await page.locator('header').first()
      .evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe('sticky');
  });

  test('検索ボタンで一覧へ行く', async ({ page }) => {
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page).toHaveURL(/\/ja\/search/);
  });

  test('言語を変えても同じページに留まる', async ({ page }) => {
    await page.goto('/ja/search');
    await page.getByRole('button', { name: 'en', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/search/);
    // 中身も英語になっていること
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  });

  test('テーマを暗いに変えると、実際に色が変わる', async ({ page }) => {
    const bgBefore = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor);
    await page.getByRole('button', { name: '設定' }).click();
    await page.getByRole('button', { name: '暗い' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect.poll(async () => page.evaluate(
      () => getComputedStyle(document.body).backgroundColor)).not.toBe(bgBefore);
  });
});
