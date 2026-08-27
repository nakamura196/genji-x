/**
 * **「ある」ではなく「見える」を確かめる。**
 *
 * Hero の検索欄が枠も背景も無く、暗い背景に白い文字が浮くだけの状態だったのに、
 * `toBeVisible()` は通っていた。DOM にあるかしか見ていなかったのが原因。
 * ここでは計算後の色と寸法を測る。
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

type RGBA = { r: number; g: number; b: number; a: number };

/**
 * 計算後の色を rgb に直す。
 *
 * **oklab() も受ける。** Chrome は ::placeholder の既定色を
 * `oklab(0.999 0.00004 0.00002 / 0.5)` の形で返す。rgb() だけを見ていたときは
 * ここで解析に失敗し、`if (f && b)` の中に入らず**判定ごと素通りしていた**。
 * その裏で、トップの検索欄は白地に白い文字（1.00:1）だった。
 * 「測れなかった」を「合格」にしない。
 */
const parse = (c: string): RGBA | null => {
  const ok = c.match(/^oklab\(\s*([\d.]+%?)\s+(-?[\d.]+%?)\s+(-?[\d.]+%?)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
  if (ok) {
    const num = (v: string, scale: number) =>
      v.endsWith('%') ? (parseFloat(v) / 100) * scale : parseFloat(v);
    const L = num(ok[1], 1), A = num(ok[2], 0.4), B = num(ok[3], 0.4);
    const a = ok[4] === undefined ? 1 : num(ok[4], 1);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map((v) => {
      const x = Math.min(1, Math.max(0, v));
      return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
    });
    return { r: lin[0], g: lin[1], b: lin[2], a };
  }
  const m = c.match(/(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
};

/** 半透明の文字は、実際に見える色（下地と混ぜた色）で判定する */
const over = (fg: RGBA, bg: RGBA): RGBA => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});
const lum = (c: { r: number; g: number; b: number }) => {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const contrast = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/**
 * 背景が透明なら、祖先をたどって実際に見える背景を探す。
 *
 * **背景画像・グラデーションも見る。** 最初は backgroundColor しか見ておらず、
 * Hero（グラデーション）の上の白い文字を body の白と比べて
 * 「対比 1.08:1」と誤判定していた。テスト自体の不備だった。
 * グラデーションのときは代表色が取れないので、判定を飛ばす。
 */
async function effectiveBg(el: Locator): Promise<string | null> {
  return el.evaluate((node) => {
    let e: Element | null = node;
    while (e) {
      const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null; // 画像/グラデーション
      const bg = s.backgroundColor;
      const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
      if (m && (m[4] === undefined || +m[4] > 0.5)) return bg;
      e = e.parentElement;
    }
    return 'rgb(255, 255, 255)';
  });
}

async function assertReadable(page: Page, sel: string, label: string) {
  const el = page.locator(sel).first();
  if (!(await el.count())) return;
  const fg = parse(await el.evaluate((e) => getComputedStyle(e).color));
  const bgStr = await effectiveBg(el);
  if (bgStr === null) return;   // グラデーション等。代表色が取れないので判定しない
  const bg = parse(bgStr);
  if (!fg || !bg) return;
  const ratio = contrast(fg, bg);
  expect(ratio, `${label} の文字と背景の対比 (${ratio.toFixed(2)}:1)`).toBeGreaterThanOrEqual(3);
}

test.describe('見えているか（存在ではなく）', () => {
  test('入力欄には枠か背景がある', async ({ page }) => {
    /**
     * トップは対象から外した。**Hero から検索欄を外したため**
     * （本家 Clio-X の Hero も背景画像・見出し・説明・ボタンだけで、
     *  検索はヘッダの虫めがねに任せている）。
     * ヘッダの検索欄は押して開く形なので、開いた状態は別の検査で見る。
     */
    for (const path of ['/ja/search']) {
      await page.goto(path);
      const inputs = page.locator('input:not([type=checkbox]):not([type=hidden])');
      const n = await inputs.count();
      expect(n, `${path} の入力欄`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const el = inputs.nth(i);
        const s = await el.evaluate((e) => {
          const c = getComputedStyle(e);
          return { bg: c.backgroundColor, bw: c.borderTopWidth, bs: c.borderTopStyle };
        });
        const bgVisible = !!parse(s.bg) && (parse(s.bg)!.a > 0.05);
        const hasBorder = parseFloat(s.bw) > 0 && s.bs !== 'none';
        // どちらも無いと「入力欄がそこにある」と分からない
        expect(bgVisible || hasBorder,
          `${path} の入力欄[${i}] に背景も枠も無い (bg=${s.bg} border=${s.bw} ${s.bs})`).toBe(true);
      }
    }
  });

  test('入力欄のプレースホルダが読める', async ({ page }) => {
    await page.goto('/ja/search');
    const el = page.locator('main input[type=search]').first();
    const ph = await el.evaluate((e) => {
      // ::placeholder の色は getComputedStyle の第 2 引数で取る
      return getComputedStyle(e, '::placeholder').color || getComputedStyle(e).color;
    });
    const bgStr = await effectiveBg(el);
    if (bgStr === null) return;
    const f = parse(ph), b = parse(bgStr);
    // 解析できなかったら見逃さず落とす（以前ここで素通りしていた）
    expect(f, `プレースホルダの色を解析できない (${ph})`).not.toBeNull();
    expect(b, `入力欄の背景色を解析できない (${bgStr})`).not.toBeNull();
    const r = contrast(over(f!, b!), b!);
    expect(r, `プレースホルダの対比 (${r.toFixed(2)}:1, 文字=${ph} 地=${bgStr})`)
      .toBeGreaterThanOrEqual(3);
  });

  test('入力欄に打った字が見える', async ({ page }) => {
    // **白地に白い文字だった。** プレースホルダだけでなく、打った字も測る
    for (const path of ['/ja/search']) {
      await page.goto(path);
      const inputs = page.locator('input[type=search], input[type=text]');
      const n = await inputs.count();
      for (let i = 0; i < n; i++) {
        const el = inputs.nth(i);
        const fg = parse(await el.evaluate((e) => getComputedStyle(e).color));
        const bgStr = await effectiveBg(el);
        if (bgStr === null) continue;
        const bg = parse(bgStr);
        if (!fg || !bg) continue;
        const r = contrast(over(fg, bg), bg);
        expect(r, `${path} の入力欄[${i}] の文字の対比 (${r.toFixed(2)}:1)`)
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('主要な文字が読める', async ({ page }) => {
    for (const path of ['/ja', '/ja/search', '/ja/about', '/ja/asset/01']) {
      await page.goto(path);
      await assertReadable(page, 'h1', `${path} の見出し`);
      await assertReadable(page, 'footer', `${path} のフッタ`);
    }
  });

  test('暗い表示でも読める', async ({ page }) => {
    await page.goto('/ja');
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    for (const path of ['/ja', '/ja/search', '/ja/about']) {
      await page.goto(path);
      await assertReadable(page, 'h1', `${path} の見出し(暗)`);
      await assertReadable(page, 'footer', `${path} のフッタ(暗)`);
    }
  });

  test('押せるものは十分な大きさがある', async ({ page }) => {
    await page.goto('/ja');
    const btns = page.locator('header button, header a');
    const n = await btns.count();
    for (let i = 0; i < n; i++) {
      const box = await btns.nth(i).boundingBox();
      if (!box) continue;
      expect(Math.min(box.width, box.height),
        `ヘッダの操作[${i}] が小さすぎる (${Math.round(box.width)}x${Math.round(box.height)})`)
        .toBeGreaterThanOrEqual(20);
    }
  });
});

test('目視用の画面を残す', async ({ page }, testInfo) => {
  for (const [path, name] of [['/ja', 'home'], ['/ja/search', 'search'],
    ['/ja/asset/01', 'asset'], ['/ja/about', 'about']]) {
    await page.goto(path);
    await page.waitForTimeout(600);
    await testInfo.attach(`${name}-light`, {
      body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
    });
  }
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  await page.goto('/ja');
  await page.waitForTimeout(600);
  await testInfo.attach('home-dark', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
});
