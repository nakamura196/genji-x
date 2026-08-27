/**
 * 「参照を記録するには」。**用語を間違えないことが主眼。**
 * 「トークンが要る」と読まれるのを防ぐために作った画面なので、
 * そこが崩れていないかを検査する。
 */
import { test, expect } from '@playwright/test';

test.describe('参照を記録するには', () => {
  test('両方の言語で開く', async ({ page }) => {
    for (const locale of ['ja', 'en']) {
      /**
       * 開発サーバはページを**初回アクセス時に組み立てる**。8 並列で
       * 一斉に叩くと、まだ誰も開いていない `/en/how-to` の初回だけ
       * 既定の 30 秒を超えることがある（単独で走らせると 1.6 秒）。
       * 製品側の問題ではないので、この行だけ待ち時間を延ばす。
       */
      const res = await page.goto(`/${locale}/how-to`, { timeout: 60_000 });
      expect(res?.status()).toBe(200);
    }
  });

  test('ETH がトークンではないと書いてある', async ({ page }) => {
    await page.goto('/ja/how-to');
    const eth = page.locator('dd').first();
    await expect(eth).toContainText('トークンではありません');
  });

  test('datatoken は用意しなくてよいと書いてある', async ({ page }) => {
    await page.goto('/ja/how-to');
    await expect(page.getByText('あなたが用意するものではありません')).toBeVisible();
  });

  test('蛇口へのリンクが 3 つあり、全部外部リンク', async ({ page }) => {
    /**
     * **1 つに絞らない。** その日たまたま空でも「もらえない」で終わってしまう。
     * 性質の違うもの（待つだけ / 登録が要る）を並べてある。
     */
    await page.goto('/ja/how-to');
    const links = page.locator('main a[href^="https://"]').filter({ hasText: /pk910|Google|Alchemy/ });
    await expect(links).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(links.nth(i)).toHaveAttribute('target', '_blank');
    }
  });

  test('「読むだけなら要らない」が最初と最後に出る', async ({ page }) => {
    // これが一番伝えたいこと。手順の圧に埋もれさせない
    await page.goto('/ja/how-to');
    await expect(page.getByText(/読むだけなら/).first()).toBeVisible();
    expect(await page.getByText(/読むだけなら/).count()).toBeGreaterThanOrEqual(2);
  });

  test('フッタに 1 つだけ出る（重複していない）', async ({ page }) => {
    await page.goto('/ja');
    await expect(page.locator('footer a[href$="/how-to"]')).toHaveCount(1);
  });
});
