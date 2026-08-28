/**
 * 取引の画面。**Etherscan と同じものを、この資料の文脈で読ませる。**
 *
 * 見るのは 3 つ。
 *   1. 6 件の記録が全部出ていて、目的の 1 行だけが目立っていること
 *   2. 契約・帖・取引が互いに行き来できること
 *   3. 本物へ出る口があること（劣化した Etherscan で終わらせない）
 *
 * 「ある」ではなく「見える」を見る。DOM にあるだけでは確認にならない。
 */
import { test, expect } from '@playwright/test';
import txData from '../src/data/transactions.json';

const ORDER = txData.transactions.find((t) => t.kinds.includes('order'))!;
const ANCHOR = txData.transactions.find((t) => t.kinds.includes('anchor'))!;

test('参照の記録: 6 件の記録が順番どおりに出る', async ({ page }) => {
  await page.goto(`/ja/tx/${ORDER.hash}`);

  const logs = page.locator('main ol li');
  await expect(logs).toHaveCount(ORDER.logs.length);

  // 左の数字はブロック内の通し番号。Etherscan と突き合わせられる値なので、順序ごと見る
  const shown = await logs.locator('> div').first().allTextContents();
  expect(shown.length).toBeGreaterThan(0);
  const idx = await page.locator('main ol li > div:first-child').allInnerTexts();
  expect(idx.map(Number)).toEqual(ORDER.logs.map((l) => l.index));
});

test('参照の記録: OrderStarted だけが目立つ', async ({ page }) => {
  await page.goto(`/ja/tx/${ORDER.hash}`);

  const point = page.locator('main ol li').filter({ hasText: 'OrderStarted' });
  await expect(point).toHaveCount(1);

  /*
    **「印が付いている」ではなく「見た目が他と違う」を測る。**
    class 名を見ると、CSS が外れていても通ってしまう。
  */
  const border = await point.evaluate((el) => getComputedStyle(el).borderLeftWidth);
  const plain = await page.locator('main ol li').filter({ hasText: 'ProviderFee' })
    .evaluate((el) => getComputedStyle(el).borderLeftWidth);
  expect(parseFloat(border)).toBeGreaterThan(parseFloat(plain));
});

test('root の記録: 記録した root と作り方が出る', async ({ page }) => {
  await page.goto(`/ja/tx/${ANCHOR.hash}`);
  const d = ANCHOR.details[0] as { root: string; spec: string };
  await expect(page.getByText(d.root, { exact: false })).toBeVisible();
  await expect(page.getByText(d.spec, { exact: false })).toBeVisible();
});

test('帖 → 取引 → 契約 → 取引 と行き来できる', async ({ page }) => {
  const slug = (ORDER.details.find((x) => (x as { slug?: string }).slug) as { slug: string }).slug;

  await page.goto(`/ja/asset/${slug}`);
  const toTx = page.locator(`main a[href="/ja/tx/${ORDER.hash}"]`);
  await expect(toTx).toBeVisible();
  await toTx.click();
  await expect(page).toHaveURL(new RegExp(`/ja/tx/${ORDER.hash}$`));

  // 取引 → 契約
  const toContract = page.locator('main a[href^="/ja/contract/"]').first();
  await expect(toContract).toBeVisible();
  await toContract.click();
  await expect(page).toHaveURL(/\/ja\/contract\/0x/);

  // 契約 → 取引（戻れる）
  const backToTx = page.locator(`main a[href="/ja/tx/${ORDER.hash}"]`);
  await expect(backToTx).toBeVisible();
});

test('本物へ出る口がある', async ({ page }) => {
  await page.goto(`/ja/tx/${ORDER.hash}`);
  const out = page.locator(`main a[href*="etherscan.io/tx/${ORDER.hash}"]`);
  await expect(out).toBeVisible();
  await expect(out).toHaveAttribute('target', '_blank');
});

test('ゼロアドレスは 16 進ではなく語で出す', async ({ page }) => {
  await page.goto(`/ja/tx/${ORDER.hash}`);
  // 42 字の 0 が並んでいても、読者には何も伝わらない
  await expect(page.locator('main')).not.toContainText('0x0000000000');
  await expect(page.locator('main ol').getByText('ゼロアドレス').first()).toBeVisible();
});

/**
 * **16 進を手で書かない。**
 *
 * イベントと関数の名前を引く表に、当てずっぽうで書いた値が 2 つ入っていた
 * (anchor を 0xd1a2d40b、setMetaData を 0x36c6dcd6 としていた。どちらも別物)。
 * 見た目では正しさが分からないので、間違いに気づけないまま画面に出ていた。
 *
 * 表は署名から計算する形に変えた。ここでは
 * **実際に集めた取引に出てくる値が、全部その表で引けるか**を見る。
 * 署名が違えば計算結果も変わるので、これが崩れる。
 */
test('記録と関数の名前が、集めた取引の全部で引ける', async () => {
  const { TOPIC_NAME, SELECTOR_NAME } = await import('../src/lib/tx-signatures');

  const topics = [...new Set(txData.transactions.flatMap((t) => t.logs.map((l) => l.topic0)))];
  expect(topics.filter((x) => !TOPIC_NAME[x]), '名前の引けない topic0').toEqual([]);
  expect(topics.length, '記録の種類').toBeGreaterThanOrEqual(6);

  const sels = [...new Set(txData.transactions.map((t) => t.selector))];
  expect(sels.filter((x) => !SELECTOR_NAME[x]), '名前の引けない selector').toEqual([]);
});

test('画面に 16 進のままの関数名が出ない', async ({ page }) => {
  for (const t of [ORDER, ANCHOR]) {
    await page.goto(`/ja/tx/${t.hash}`);
    // 「呼んだ関数」の欄に 0x… が出ていたら、表に無いということ
    const row = page.locator('main').getByText('呼んだ関数').locator('..');
    await expect(row).not.toContainText(t.selector);
  }
});
