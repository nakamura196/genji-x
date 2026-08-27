/**
 * 「この記録を公開した鍵」の画面。
 *
 * この画面の値打ちは**区別**にある。チェーンが保証した値と、こちらが名乗って
 * いるだけの値が、見た目でも文言でも分かれていること。混ざったら意味がない。
 */
import { test, expect } from '@playwright/test';

const NAME = '中村';
const ADDR = '0xA787b1285d7D0Cf5284167Ce278774371946A3aA';

test.describe('公開した鍵', () => {
  test('両方の言語で開き、アドレスが出る', async ({ page }) => {
    for (const locale of ['ja', 'en']) {
      const res = await page.goto(`/${locale}/publisher`);
      expect(res?.status()).toBe(200);
      await expect(page.getByText(ADDR).first()).toBeVisible();
    }
  });

  test('氏名は「名乗っているだけ」の節にしか出ない', async ({ page }) => {
    await page.goto('/ja/publisher');
    const claim = page.locator('section[class*="claim"]');
    await expect(claim).toBeVisible();
    await expect(claim.getByText(NAME).first()).toBeVisible();

    /**
     * **チェーンの節に氏名があってはいけない。** そこに出ていると
     * 「チェーンにそう書いてある」と読めてしまう。実際チェーンには無い
     */
    const sections = page.locator('main section');
    for (let i = 0; i < await sections.count(); i++) {
      const s = sections.nth(i);
      const isClaim = (await s.getAttribute('class'))?.includes('claim');
      if (isClaim) continue;
      expect(await s.locator(`text=${NAME}`).count(),
        'チェーンの節に氏名が出ている').toBe(0);
    }
  });

  test('申告の節が見た目でも区別されている', async ({ page }) => {
    await page.goto('/ja/publisher');
    const claim = page.locator('section[class*="claim"]');
    // 左の線。文言だけでなく形でも分かるようにしてある
    const border = await claim.evaluate((e) => {
      const s = getComputedStyle(e);
      return { w: parseFloat(s.borderLeftWidth), color: s.borderLeftColor };
    });
    expect(border.w, '申告の節に区切りの線が無い').toBeGreaterThanOrEqual(2);

    // 断り書きが地の文に埋もれていないこと（背景が付いている）
    const warn = claim.locator('p').first();
    const bg = await warn.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    await expect(warn).toContainText('チェーンにありません');
  });

  test('宣言のファイルが配信されていて、画面の署名と一致する', async ({ page, request }) => {
    const res = await request.get('/.well-known/genji-witness.json');
    expect(res.status()).toBe(200);
    const d = await res.json();
    expect(d.address).toBe(ADDR);
    expect(d.signature).toMatch(/^0x[0-9a-f]{130}$/);

    await page.goto('/ja/publisher');
    // 画面には頭だけ出す。その頭がファイルと一致していること
    await expect(page.getByText(d.signature.slice(0, 22), { exact: false }).first()).toBeVisible();
  });

  test('フッタから辿れる', async ({ page }) => {
    // たどり着けない場所に置いた名乗りは、名乗っていないのと同じ
    await page.goto('/ja/search');
    const link = page.locator('footer a[href$="/publisher"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/ja\/publisher$/);
  });

  test('検証の手順が画面に出ている', async ({ page }) => {
    await page.goto('/ja/publisher');
    const cmd = page.locator('pre');
    await expect(cmd).toContainText('cast wallet verify');
    await expect(cmd).toContainText(ADDR);
    // 横に長いので、この箱の中だけで流す（本文ごと横に流れない）
    expect(await cmd.evaluate((e) => getComputedStyle(e).overflowX)).toBe('auto');
  });
});
