/**
 * ページが開くか。**過去にリンク切れとフッタ位置で実際に壊れた**ので固定する。
 */
import { test, expect } from '@playwright/test';

const PAGES = [
  '/ja', '/en',
  '/ja/search', '/en/search',
  '/ja/about', '/en/about',
  '/ja/asset/01', '/ja/asset/all',
  '/ja/contract/0x8197bd3d263b9dcf68df1e2629459f01e0cfcab9',
];

for (const path of PAGES) {
  test(`${path} が 200 で開く`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status(), `${path} の応答`).toBe(200);
    // Next のエラー画面が出ていないこと
    await expect(page.locator('text=Build Error')).toHaveCount(0);
    await expect(page.locator('text=Module not found')).toHaveCount(0);
    await expect(page.locator('text=INVALID_MESSAGE')).toHaveCount(0);
    await expect(page.locator('text=MISSING_MESSAGE')).toHaveCount(0);
  });
}

test('/ は既定の言語へ送られる', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ja(\/|$)/);
});

test('一覧のリンクに言語接頭辞が付いている', async ({ page }) => {
  // localePrefix を as-needed から always に変えたとき、
  // 「既定の ja には接頭辞を付けない」という古い分岐が残ってリンクが切れた
  await page.goto('/ja/search');
  const hrefs = await page.locator('a[href*="/asset/"]').evaluateAll(
    (as) => as.map((a) => a.getAttribute('href') ?? '')
  );
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(h, `リンク ${h}`).toMatch(/^\/(ja|en)\/asset\//);
});

test('一覧から詳細へ実際に辿れる', async ({ page }) => {
  await page.goto('/ja/search');
  const first = page.locator('a[href*="/asset/"]').first();
  await first.click();
  await expect(page).toHaveURL(/\/ja\/asset\//);
  await expect(page.locator('h1')).toBeVisible();
});
