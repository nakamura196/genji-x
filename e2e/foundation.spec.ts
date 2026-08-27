/**
 * 土台（色・寸法・書体）が崩れていないかを、**計算後の値で**確かめる。
 *
 * 1 周目に踏んだのは次の 4 つ。どれも「CSS を読んだだけ」では見つからず、
 * ブラウザで測って初めて分かった。だからここでは測る。
 *
 *   - 設計トークンが 2 系統あり (@nakamura196/dh-ui の --dh-* と本家の変数)、
 *     ページごとに背景が 3 色に割れていた
 *   - Tailwind の preflight が 2 回当たり、h1 が本文と同じ 15px で出ていた
 *   - 移植した IBM Plex Sans が next/font の Inter に負けて一度も出ていなかった
 *   - 暗い表示で、明るい地の前提の黒い文字が #141414 の上に乗っていた
 *   - 54 帖まとめた 1 件 (/asset/all) が帖のカードに 55 件目として混ざり、
 *     しかも行数が 0 と出ていた
 */
import { test, expect, type Page } from '@playwright/test';

const PAGES = ['/ja', '/ja/search', '/ja/about', '/ja/asset/01', '/ja/asset/all', '/en'];

/** 計算後の色を rgb に直す */
const parse = (c: string) => {
  const m = c.match(/(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
};

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.goto('/ja');
  await page.evaluate((t) => localStorage.setItem('theme', t), theme);
}

test.describe('土台', () => {
  test('設計トークンが本家の 1 系統だけになっている', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const r = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        // dh-ui の代表的なトークン。1 つでも値を持っていたら 2 系統ある
        const dh = ['--dh-surface', '--dh-ink', '--dh-ink-muted', '--dh-line',
          '--dh-accent', '--dh-radius', '--dh-font-mono']
          .map((n) => [n, s.getPropertyValue(n).trim()] as const)
          .filter(([, v]) => v !== '');
        return {
          dh,
          // 本家の変数は必ず値を持っている
          base: ['--background-content', '--font-color-text', '--border-color',
            '--color-primary', '--border-radius']
            .map((n) => [n, s.getPropertyValue(n).trim()] as const)
            .filter(([, v]) => v === ''),
        };
      });
      expect(r.dh, `${path} に dh-ui のトークンが残っている`).toEqual([]);
      expect(r.base, `${path} で本家の変数が空`).toEqual([]);
    }
  });

  test('地の色がページごとに割れていない', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      const seen = new Set<string>();
      for (const path of PAGES) {
        await page.goto(path);
        seen.add(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
      }
      expect([...seen], `${theme} で body の地色が複数ある`).toHaveLength(1);
    }
  });

  test('見出しが本文より大きい（preflight が 2 回当たっていない）', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const r = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1
          ? {
              h1: parseFloat(getComputedStyle(h1).fontSize),
              body: parseFloat(getComputedStyle(document.body).fontSize),
              // preflight の 2 回目は a に color:inherit を当てて移植の指定を消す
              link: getComputedStyle(document.documentElement).getPropertyValue('--link-font-color').trim(),
            }
          : null;
      });
      expect(r, `${path} に h1 が無い`).not.toBeNull();
      expect(r!.h1 / r!.body, `${path} の h1 が本文の ${(r!.h1 / r!.body).toFixed(2)} 倍しかない`)
        .toBeGreaterThanOrEqual(1.5);
      expect(r!.link, `${path} の --link-font-color が空`).not.toBe('');
    }
  });

  test('移植した書体が実際に読み込まれて当たっている', async ({ page }) => {
    const fontResponses: number[] = [];
    page.on('response', (r) => {
      if (/\.(ttf|woff2?)(\?|$)/.test(r.url())) fontResponses.push(r.status());
    });
    await page.goto('/ja');
    const r = await page.evaluate(async () => {
      await document.fonts.ready;
      const base = getComputedStyle(document.documentElement)
        .getPropertyValue('--font-family-base');
      return {
        plex: document.fonts.check('600 16px "IBM Plex Sans"'),
        libre: document.fonts.check('16px "Libre Baskerville"'),
        bodyFamily: getComputedStyle(document.body).fontFamily,
        base,
      };
    });
    expect(r.plex, 'IBM Plex Sans が読み込まれていない').toBe(true);
    expect(r.libre, 'Libre Baskerville が読み込まれていない').toBe(true);
    expect(r.bodyFamily, 'body に IBM Plex Sans が当たっていない').toContain('IBM Plex Sans');
    // 日本語の書体が指定から抜けると、どの字で出るかが端末任せになる
    expect(r.base, '日本語のフォールバックが無い').toMatch(/Hiragino|Noto Sans JP|Yu Gothic|Meiryo/);
    expect(fontResponses.filter((s) => s !== 200), 'フォントの取得に失敗した')
      .toEqual([]);
  });

  /**
   * **地の上に乗る文字を全部測る。**
   * h1 とフッタだけを見ていたので、箱の中の小見出しを取りこぼしていた。
   * 対象は本家の 3 種類の地 (--background-body / -content / -highlight) の上に
   * 乗る文字すべて。
   *
   * 求める対比は 2 通りにしてある。
   *   - ふつうの文字            4.5:1 (WCAG AA)
   *   - ブランド色 (--color-primary) の文字  3:1
   *
   * 後者を下げているのは、本家 Clio-X のクレイ (#c8794d) が白地で 3.33:1 しか
   * 出ないため。**忠実に移植した結果であって、直せていないだけである。**
   * AA 適合値 (#95612b, 5.22:1) への差し替えは決まっているが、
   * 本家からずらす変更なので TODO.md の「アクセント色を AA 適合値に差し替える」
   * として別に持っている。ここでは、それより悪くならないことだけを守る。
   */
  for (const theme of ['dark', 'light'] as const) {
    test(`${theme === 'dark' ? '暗い' : '明るい'}表示で、地の上の文字が全部読める`, async ({ page }) => {
      await setTheme(page, theme);
      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForTimeout(300);
        const bad = await page.evaluate(() => {
          const px = (c: string) => {
            const m = c.match(/(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
            return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
          };
          const lum = (c: { r: number; g: number; b: number }) => {
            const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
            return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
          };
          const ratio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
            const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
            return (x + 0.05) / (y + 0.05);
          };
          const s = getComputedStyle(document.documentElement);
          const grounds = ['--background-body', '--background-content', '--background-highlight']
            .map((n) => s.getPropertyValue(n).trim());
          const accent = s.getPropertyValue('--color-primary').trim();
          // 変数の値を実際の rgb に直す（#fff のような短縮形が来る）
          const probe = document.createElement('span');
          document.body.appendChild(probe);
          const asRgb = (v: string) => { probe.style.color = v; return getComputedStyle(probe).color; };
          const groundSet = new Set(grounds.map(asRgb));
          const accentRgb = asRgb(accent);
          probe.remove();

          const effBg = (el: Element) => {
            let e: Element | null = el;
            while (e) {
              const cs = getComputedStyle(e);
              if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
              const c = px(cs.backgroundColor);
              if (c && c.a > 0.9) return cs.backgroundColor;
              e = e.parentElement;
            }
            return 'rgb(255, 255, 255)';
          };

          const out: string[] = [];
          for (const el of Array.from(document.querySelectorAll('body *'))) {
            if (el.closest('nextjs-portal')) continue;           // 開発ツールの吹き出し
            const text = Array.from(el.childNodes)
              .filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
            if (!text) continue;
            const box = el.getBoundingClientRect();
            if (box.width < 2 || box.height < 2) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.1) continue;
            const bgStr = effBg(el);
            if (bgStr === null || !groundSet.has(bgStr)) continue;  // 地が中間色の場所だけ見る
            const bg = px(bgStr)!, fg = px(cs.color);
            if (!fg) continue;
            const mixed = {
              r: fg.r * fg.a + bg.r * (1 - fg.a),
              g: fg.g * fg.a + bg.g * (1 - fg.a),
              b: fg.b * fg.a + bg.b * (1 - fg.a),
            };
            const c = ratio(mixed, bg);
            const size = parseFloat(cs.fontSize);
            const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
            // ブランド色の文字は 3:1 まで許す（上のコメントの通り、差し替え待ち）
            const need = large || cs.color === accentRgb ? 3 : 4.5;
            if (c < need) {
              out.push(`${el.tagName.toLowerCase()} "${text.slice(0, 24)}" ${cs.color} on ${bgStr} = ${c.toFixed(2)}:1 (${size}px)`);
            }
          }
          return out;
        });
        expect(bad, `${path} (${theme}) で読めない文字`).toEqual([]);
      }
    });
  }

  test('54 帖まとめた 1 件は帖の一覧に混ざらない', async ({ page }) => {
    // 帖のカードが並ぶのは一覧 (/search) だけ。トップは役割の 3 枚しか置かない
    await page.goto('/ja/search');
    const hrefs = await page.locator('article a[href*="/asset/"]').evaluateAll(
      (els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? '')
    );
    // 0 件だと下の 2 つがどちらも素通りするので、まず並んでいることを確かめる
    expect(hrefs.length, '帖のカードが 54 枚ない').toBe(54);
    expect(hrefs.filter((h) => h.endsWith('/asset/all')),
      '帖のカードに全体版が混ざっている').toEqual([]);
  });

  test('54 帖まとめた 1 件へ、別の入口から辿れる', async ({ page }) => {
    for (const path of ['/ja', '/ja/about', '/ja/search']) {
      await page.goto(path);
      const link = page.locator('a[href="/ja/asset/all"]').first();
      await expect(link, `${path} に全体版への入口が無い`).toHaveCount(1);
      const box = await link.boundingBox();
      expect(box, `${path} の入口が描かれていない`).not.toBeNull();
    }
  });

  test('54 帖まとめた 1 件の行数が 0 でない', async ({ page }) => {
    await page.goto('/ja/asset/all');
    // DDO は行数を lines ではなく itemTreeSize (25,065) で持っている
    await expect(page.locator('body')).toContainText('25,065');
    await expect(page.locator('body')).not.toContainText(/(^|[^\d,])0 行/);
  });
});
