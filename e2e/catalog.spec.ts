/**
 * 一覧。**カードの DOM が本家と同じか、検索と並べ替えが効くか。**
 */
import { test, expect } from '@playwright/test';

test.describe('一覧', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ja/search');
    /**
     * **React が繋がるのを待つ。** サーバが描いた HTML の時点でも入力欄は
     * 見えているが、繋がるまで打っても何も起きない。待たずに打つと、
     * 狭い画面でだけ入力が捨てられて落ちる（実際に落ちた）。
     */
    await expect(page.locator('[data-filter-ready="true"]')).toBeVisible();
  });

  /**
   * **帖だけが並ぶ（54 件）。**
   * 以前は 54 帖をまとめた「全体版」もカードとして同じ列に入っていて、
   * 桐壺・帚木…と続いた最後に 56 件目の顔で出ていた（しかも「0 行」だった）。
   * 粒度が違うので一覧からは外し、一覧の直後に別の入口を 1 枚置いてある。
   */
  test('54 帖が並ぶ（全体版は混ざらない）', async ({ page }) => {
    await expect(page.locator('article')).toHaveCount(54);
  });

  test('全体版への入口が一覧の下にある', async ({ page }) => {
    const link = page.locator('a[href$="/asset/all"]');
    await expect(link).toHaveCount(1);
    // 「0 行」ではなく実際の行数が出ていること（DDO は itemTreeSize で持っている）
    await expect(link).toContainText('25,065');
  });

  test('カードが本家の DOM を保っている', async ({ page }) => {
    const card = page.locator('article').first();
    // article.teaser > a.link > aside / header / .content / .price / footer
    await expect(card.locator('a')).toHaveCount(1);
    await expect(card.locator('aside')).toHaveCount(1);
    await expect(card.locator('header h1')).toHaveCount(1);
    await expect(card.locator('footer')).toHaveCount(1);
    // 本家の CSS Modules が当たっていること（クラス名にモジュール名が入る）
    const cls = await card.getAttribute('class');
    expect(cls, 'カードのクラス').toMatch(/teaser/);
  });

  test('題が 3 行で切られる（本家と同じ）', async ({ page }) => {
    const clamp = await page.locator('article header h1').first()
      .evaluate((el) => getComputedStyle(el).webkitLineClamp);
    expect(clamp).toBe('3');
  });

  test('巻名で絞り込める', async ({ page }) => {
    await page.getByPlaceholder(/巻名/).fill('きりつぼ');
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.locator('article').first()).toContainText('きりつぼ');
  });

  test('巻次でも絞り込める', async ({ page }) => {
    await page.getByPlaceholder(/巻名/).fill('05');
    await expect(page.locator('article')).toHaveCount(1);
  });

  test('証明つきだけに絞れる', async ({ page }) => {
    await page.getByLabel(/証明つきのみ/).check();
    // 帖 54 件にはすべて包含証明があるので、件数は変わらない
    await expect(page.locator('article')).toHaveCount(54);
  });

  test('並べ替えが効く', async ({ page }) => {
    const firstBefore = await page.locator('article header h1').first().textContent();
    await page.getByLabel(/並べ替え/).selectOption('lines');
    await expect.poll(async () =>
      page.locator('article header h1').first().textContent()).not.toBe(firstBefore);
  });

  test('件数の表示が絞り込みに追従する', async ({ page }) => {
    await expect(page.getByText('54 / 54 件')).toBeVisible();
    await page.getByPlaceholder(/巻名/).fill('きりつぼ');
    await expect(page.getByText('1 / 54 件')).toBeVisible();
  });

  test('参照回数がチェーンから入る', async ({ page }) => {
    // ビルド時に焼き込まず、開いたときに数え直している
    await expect(page.locator('article').first()).toContainText(/参照 \d+ 回/, { timeout: 30_000 });
  });
});
