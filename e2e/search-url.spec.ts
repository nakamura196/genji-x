/**
 * 検索の URL 同期と、漢字での引き当て。
 *
 * どちらも TODO に書いてあったのに長く残っていた。**書いただけでは直らない。**
 */
import { test, expect } from '@playwright/test';

const count = async (page: import('@playwright/test').Page) => {
  const t = await page.locator('h1[class*="resultsCount"]').first().textContent();
  const m = t?.match(/(\d+)\s*(?:\/|of)\s*(\d+)/);
  if (!m) throw new Error(`件数が読めない: ${t}`);
  return { shown: Number(m[1]), total: Number(m[2]) };
};

test.describe('検索', () => {
  test('?q= を読む（開いた時点で絞られている）', async ({ page }) => {
    await page.goto('/ja/search?q=' + encodeURIComponent('きり'));
    const c = await count(page);
    expect(c.shown).toBeLessThan(c.total);
    // 入力欄にも入っていること。空だと「なぜ絞られているか」が分からない
    await expect(page.locator('main input[type=search]')).toHaveValue('きり');
    for (const t of await page.locator('article h1').allTextContents()) {
      expect(t).toContain('きり');
    }
  });

  test('漢字の巻名で引ける（データは仮名しか持っていない）', async ({ page }) => {
    /**
     * 表記は東京大学附属図書館の一覧に合わせてある
     * (https://genji.lib.u-tokyo.ac.jp/data/info.json)。
     * 空白や括弧を落とした形でも引けること（若菜上 / 槿）まで確かめる。
     */
    for (const [kanji, kana] of [
      ['桐壺', 'きりつぼ'], ['若紫', 'わかむらさき'], ['須磨', 'すま'],
      ['朝顔', 'あさかほ'], ['槿', 'あさかほ'],
      ['若菜 上', 'わかな上'], ['若菜上', 'わかな上'],
    ]) {
      await page.goto('/ja/search?q=' + encodeURIComponent(kanji));
      expect((await count(page)).shown, `${kanji} で引けない`).toBe(1);
      // **画面に出るのは元の仮名。** 漢字に置き換えて表示してはいけない
      const title = await page.locator('article h1').first().textContent();
      expect(title?.trim()).toBe(kana);
    }
  });

  test('打ち込むと URL に載る（絞った状態を人に渡せる）', async ({ page }) => {
    await page.goto('/ja/search');
    /**
     * **React が繋がるのを待ってから打つ。**
     * 待たずに打つと、狭い画面でだけ入力が捨てられて落ちていた。
     * 服の見た目では分からない差なので、DOM に目印を出してある。
     */
    await expect(page.locator('[data-filter-ready="true"]')).toBeVisible();
    await page.locator('main input[type=search]').fill('須磨');
    await expect(page).toHaveURL(/[?&]q=/);
    expect((await count(page)).shown).toBe(1);
    // 空にしたら URL からも消える
    await page.locator('main input[type=search]').fill('');
    await expect(page).toHaveURL((u) => !u.searchParams.has('q'));
  });

  test('主要なページに main がある', async ({ page }) => {
    // main が無いと、余白を測るテストが対象を 1 つも見つけられず空で通る。
    // 読み上げで本文へ飛ぶ目印でもある
    for (const path of ['/ja', '/ja/search', '/ja/about', '/ja/asset/01']) {
      await page.goto(path);
      await expect(page.locator('main'), `${path} に main が無い`).toHaveCount(1);
    }
  });

  test('IPFS のリンクがボット判定で弾かれる先を指していない', async ({ page }) => {
    // ipfs.io と dweb.link は本物のブラウザに 403 (Cloudflare の判定) を返す。
    // curl では 200 が返るので、コマンドラインだけで確かめると気づけない
    await page.goto('/ja/asset/01');
    const bad = await page.locator('a[href*="ipfs.io"], a[href*="dweb.link"], a[href*="w3s.link"]').count();
    expect(bad, 'ブラウザを弾くゲートウェイを指している').toBe(0);
    await expect(page.locator('a[href*="/ipfs/"]').first()).toBeVisible();
  });
});
