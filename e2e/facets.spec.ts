/**
 * 絞り込み（ファセット）。**「効く」ことまで測る。**
 *
 * 「和歌の有無」で作ろうとして、全 54 帖が 1 首以上持っていることに後で気づいた。
 * 有無のチェックだと**押しても件数が 1 つも動かない**。DOM に checkbox があることを
 * 確かめるだけのテストは、この状態でも通ってしまう。
 * だからここでは **押す前と後の件数が変わること**を必ず測る。
 */
import { test, expect } from '@playwright/test';

const count = async (page: import('@playwright/test').Page) => {
  const h = await page.locator('h1').filter({ hasText: '/' }).first().textContent();
  const m = h?.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) throw new Error(`件数の見出しが読めない: ${h}`);
  return { shown: Number(m[1]), total: Number(m[2]) };
};

test.describe('絞り込み', () => {
  test('和歌の数で絞ると件数が減り、カードの中身も条件を満たす', async ({ page }) => {
    await page.goto('/ja/search');
    const before = await count(page);
    expect(before.shown).toBe(54);

    await page.locator('#waka-20\\+').check();
    const after = await count(page);

    // 押しても動かない絞り込みは、絞り込みではない
    expect(after.shown).toBeLessThan(before.shown);
    expect(after.total).toBe(before.total);

    // 出ているカードが本当に 20 首以上か、字を読んで確かめる
    const texts = await page.locator('article p').allTextContents();
    expect(texts.length).toBe(after.shown);
    for (const t of texts) {
      const m = t.match(/和歌\s*([\d,]+)\s*首/);
      expect(m, `和歌の数が出ていない: ${t}`).not.toBeNull();
      expect(Number(m![1].replace(/,/g, ''))).toBeGreaterThanOrEqual(20);
    }
  });

  test('帯ごとの件数の合計が全件と一致する', async ({ page }) => {
    await page.goto('/ja/search');
    const nums: number[] = [];
    for (const band of ['1-4', '5-9', '10-19', '20+']) {
      const label = page.locator(`label[for="waka-${band.replace('+', '\\+')}"]`);
      const t = await label.locator('span').textContent();
      nums.push(Number(t?.trim()));
    }
    // 全 54 帖がどれかの帯に必ず入る（0 首の帖は無い）
    expect(nums.reduce((a, b) => a + b, 0)).toBe(54);
  });

  test('「条件をすべて外す」で元に戻る', async ({ page }) => {
    await page.goto('/ja/search');
    await page.locator('#waka-1-4').check();
    expect((await count(page)).shown).toBeLessThan(54);
    await page.getByRole('button', { name: /外す|Clear/ }).click();
    expect((await count(page)).shown).toBe(54);
  });

  test('絞り込みの見出しが 1 行に収まる（ボタンが出ても折れない）', async ({ page }) => {
    await page.goto('/ja/search');
    const title = page.locator('h3').filter({ hasText: '絞り込み' }).first();
    const one = (await title.boundingBox())!.height;
    await page.locator('#waka-1-4').check();          // 「条件をすべて外す」が出る
    const after = (await title.boundingBox())!.height;
    expect(after).toBeCloseTo(one, 0);
  });

  test('TEI 由来だと画面に断ってある', async ({ page }) => {
    await page.goto('/ja/search');
    // チェーンの記録と混ざらないよう、出どころを必ず書く
    const note = page.locator('p').filter({ hasText: /TEI/ }).first();
    await expect(note).toBeVisible();
    const size = await note.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size, '小さすぎて読めない').toBeGreaterThanOrEqual(12);
  });

  test('公開者の欄を言語で訳していない（チェーンの値をそのまま出す）', async ({ page }) => {
    /**
     * カタログはデータを映す場所であって、値を訳す場所ではない。
     *
     * **中身が何かは問わない。** DDO の author はいま氏名だが、
     * 個人情報をチェーンに残さない方針でアドレスだけに変わる。
     * テストが確かめるのは「**日英で同じ文字列が出る**」ことだけ。
     * 具体的な値を書くと、正しい変更のたびにテストが落ちる。
     */
    const read = async (locale: string) => {
      await page.goto(`/${locale}/search`);
      const card = page.locator('article').first();
      return (await card.locator('header > div').first().textContent())?.trim();
    };
    const ja = await read('ja');
    const en = await read('en');
    expect(ja, '公開者の欄が空').toBeTruthy();
    expect(ja).toBe(en);
  });
});
