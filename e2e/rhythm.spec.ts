/**
 * 余白と重なり。**「詰まりすぎ」は機械で出せる。**
 *
 * 検索画面で、説明文の下端とカードの上端の間隔が 11px しかなく、
 * さらに説明文が左の絞り込み列に食い込んでいた。
 * 見れば分かるが、それまでのテスト（存在・色・対比）では出なかった。
 *
 * ── 何を基準にするか ────────────────────────────────────────────
 * 本家 (Ocean Market) は余白を calc(var(--spacer) / N) でしか作らない。
 * --spacer は 2rem = 32px。だから区画の間隔は 32 / 1,2,3,4,6,8,12,24 のいずれか、
 * または その整数倍になる。**体系から外れた半端な値は設計の破れ**である。
 *
 * 「美しいか」は判定できない。判定できるのは
 *   - 詰まりすぎ（下限を割っている）
 *   - 重なっている
 *   - 画面からはみ出している
 * の 3 つ。ここではそれを見る。
 */
import { test, expect, type Page } from '@playwright/test';

const SPACER = 32; // --spacer: 2rem

async function rect(page: Page, sel: string) {
  const el = page.locator(sel).first();
  if (!(await el.count())) return null;
  return el.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right,
      w: r.width, h: r.height };
  });
}

test.describe('余白のリズム', () => {
  test('見出しの下の説明と、その次の区画が詰まりすぎていない', async ({ page }) => {
    for (const path of ['/ja', '/ja/search', '/ja/about']) {
      await page.goto(path);
      await page.waitForTimeout(400);
      const gaps = await page.evaluate((spacer) => {
        // 本文の直下にある主要な区画どうしの縦の間隔を測る。
        //
        // **測るのは枠の距離ではなく、中身の距離。** 最初は
        // getBoundingClientRect の bottom と top をそのまま引いていて、
        // トップの Hero と次の区画が「0px」と出ていた。実際には Hero が
        // padding-bottom 80px、次の区画が padding-top 48px を持っていて、
        // 目に見える隙間は 128px ある。**margin で空けるか padding で空けるかは
        // 設計の自由**で、そこを間違いにすると直しようがない指摘になる。
        // 自分の縦 padding を差し引いた「中身の端」どうしで測る。
        const edges = (e: Element) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return {
            top: r.top + parseFloat(s.paddingTop),
            bottom: r.bottom - parseFloat(s.paddingBottom),
            rawTop: r.top, rawBottom: r.bottom,
          };
        };
        const out: { a: string; b: string; gap: number }[] = [];
        const blocks = [...document.querySelectorAll('main > *, main section, main header')]
          .filter((e) => (e as HTMLElement).offsetHeight > 8);
        for (let i = 0; i < blocks.length - 1; i++) {
          const a = edges(blocks[i]);
          const b = edges(blocks[i + 1]);
          // 横に並んでいるものは対象外（縦に積まれているものだけ見る）
          if (b.rawTop < a.rawBottom - 4) continue;
          // 入れ子（外側の枠と、その中身）は対象外。同じ帯を 2 回数えてしまう
          if (blocks[i].contains(blocks[i + 1]) || blocks[i + 1].contains(blocks[i])) continue;
          out.push({
            a: blocks[i].tagName + '.' + (blocks[i].className || '').toString().slice(0, 24),
            b: blocks[i + 1].tagName + '.' + (blocks[i + 1].className || '').toString().slice(0, 24),
            gap: Math.round(b.top - a.bottom),
          });
        }
        return out;
      }, SPACER);

      /**
       * **測る対象が 0 件なら落とす。**
       *
       * これが無くて実際に取りこぼした。`/ja/search` と `/ja/asset/01` は
       * `<main>` を持っておらず、`main > *` が 1 つも当たらなかった。
       * gaps が空配列だと下の for が 1 度も回らず、**画面の余白が 7px でも通る**。
       * 空に対する expect は「全部が条件を満たす」で必ず真になる。
       */
      expect(gaps.length, `${path}: 測る区画が 1 つも見つからない（main が無い？）`)
        .toBeGreaterThan(0);

      for (const g of gaps) {
        // spacer/3 (約 11px) は本家でも使う値だが、大きな区画どうしには狭すぎる。
        // 区画の間は spacer/2 (16px) を下限にする
        expect(g.gap, `${path}: ${g.a} と ${g.b} の間隔が ${g.gap}px と狭い`)
          .toBeGreaterThanOrEqual(SPACER / 2 - 1);
      }
    }
  });

  test('操作の箱が、すぐ上の文字にくっついていない', async ({ page }) => {
    /**
     * **区画どうしの間隔しか測っていなかった。**
     *
     * 上の検査は `main > *` と `main section` を見ている。つまり
     * **区画の中は一度も見ていない**。「この記録を公開した鍵」の画面で
     * ボタンが直前の行に隙間 0px でくっついていたのに、全部通っていた。
     *
     * 原因は CSS の写し方にもあった。契約の説明画面から `.links` を
     * そのまま持ってきたが、あちらは直前が必ず下 margin を持つ段落で、
     * **たまたま**空いていただけ。隣に何が来るかに頼った余白は、
     * 置き場所が変わると崩れる。
     */
    for (const path of ['/ja/publisher', '/ja/contract/0x8197bd3d263b9dcf68df1e2629459f01e0cfcab9',
      '/ja/asset/01', '/ja/about', '/ja']) {
      await page.goto(path);
      const r = await page.evaluate(() => {
        const found: string[] = [];
        const measured: { label: string; gap: number }[] = [];
        for (const el of document.querySelectorAll('main a[class*="button"], main button[class*="button"]')) {
          if (!(el as HTMLElement).getBoundingClientRect().height) continue;
          const label = (el.textContent || '').trim().slice(0, 20);
          found.push(label);
          const box = (el.closest('[class*="links"]') as HTMLElement) ?? (el as HTMLElement);
          // 直前に置かれている、見えている兄弟
          let prev = box.previousElementSibling as HTMLElement | null;
          while (prev && prev.getBoundingClientRect().height === 0) {
            prev = prev.previousElementSibling as HTMLElement | null;
          }
          // 箱の最初の子なら、上との間は親の padding が持つ。ここでは測らない
          if (!prev) continue;
          /**
           * **横に並んでいるものは測らない。** トップの「検証してみる」は
           * 隣のボタンと同じ行にいる（flex-direction: row）。上下の距離を
           * 引くと -55px という意味のない数字が出る。
           * 縦に積まれているときだけ、間隔を問題にする。
           */
          const pr = prev.getBoundingClientRect();
          const br = box.getBoundingClientRect();
          if (br.top < pr.bottom - 4) continue;
          measured.push({ label, gap: Math.round(br.top - pr.bottom) });
        }
        return { found, measured };
      });
      /**
       * **「押せるものが 1 つも無い」と「測れる位置に無い」を分ける。**
       * 最初は一緒くたに 0 件として落としていたが、詳細ページのボタンは
       * どれも箱の最初の子で、上に兄弟がいなかっただけだった。
       * 見つからないことと、測る必要がないことは違う。
       */
      expect(r.found.length, `${path}: 押せるものが 1 つも見つからない`).toBeGreaterThan(0);
      for (const b of r.measured) {
        expect(b.gap, `${path}: 「${b.label}」が上に ${b.gap}px しか空いていない`)
          .toBeGreaterThanOrEqual(SPACER / 2 - 1);
      }
    }
  });

  test('見出しと、そのすぐ下の要素が詰まっていない', async ({ page }) => {
    /**
     * **区画の中の見出しも見る。**
     *
     * 上の 2 つの検査は「区画どうし」と「押せるもの」しか見ていない。
     * 詳細ページの「生の値」の見出しと、その下の凡例が **0px** で
     * くっついていたのに、どちらも通っていた。
     *
     * 見出しは h2 / h3 を対象にする。直後の兄弟が縦に積まれているときだけ測る。
     */
    for (const path of ['/ja/asset/01', '/ja/publisher', '/ja/how-to', '/ja/search', '/ja/about']) {
      await page.goto(path);
      const r = await page.evaluate(() => {
        const found: { h: string; gap: number }[] = [];
        for (const h of document.querySelectorAll('main h2, main h3')) {
          const el = h as HTMLElement;
          if (!el.getBoundingClientRect().height) continue;
          let next = el.nextElementSibling as HTMLElement | null;
          while (next && !next.getBoundingClientRect().height) {
            next = next.nextElementSibling as HTMLElement | null;
          }
          if (!next) continue;
          const a = el.getBoundingClientRect();
          const b = next.getBoundingClientRect();
          // 横に並んでいるものは対象外
          if (b.top < a.bottom - 4) continue;
          found.push({ h: (el.textContent || '').trim().slice(0, 16), gap: Math.round(b.top - a.bottom) });
        }
        return found;
      });
      expect(r.length, `${path}: 見出しが 1 つも見つからない`).toBeGreaterThan(0);
      for (const x of r) {
        // 見出しと中身の間は spacer/4 (8px) を下限にする
        expect(x.gap, `${path}: 見出し「${x.h}」の下が ${x.gap}px しか空いていない`)
          .toBeGreaterThanOrEqual(SPACER / 4 - 1);
      }
    }
  });

  test('文章の塊と次の区画が重なっていない', async ({ page }) => {
    for (const path of ['/ja', '/ja/search', '/ja/about', '/ja/asset/01']) {
      await page.goto(path);
      await page.waitForTimeout(400);
      const overlaps = await page.evaluate(() => {
        const out: string[] = [];
        const nodes = [...document.querySelectorAll('main p, main h1, main h2, main h3')];
        for (const n of nodes) {
          const r = n.getBoundingClientRect();
          if (r.height === 0) continue;
          // 同じ縦位置にあって、横に重なっているものを探す
          for (const m of nodes) {
            if (m === n) continue;
            if (n.contains(m) || m.contains(n)) continue;
            const s = m.getBoundingClientRect();
            if (s.height === 0) continue;
            const vOverlap = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
            const hOverlap = Math.min(r.right, s.right) - Math.max(r.left, s.left);
            if (vOverlap > 4 && hOverlap > 4) {
              out.push(`${n.tagName}"${(n.textContent || '').slice(0, 18)}" と ` +
                `${m.tagName}"${(m.textContent || '').slice(0, 18)}"`);
            }
          }
        }
        return [...new Set(out)];
      });
      expect(overlaps, `${path} で文字が重なっている`).toEqual([]);
    }
  });

  test('本文が画面からはみ出していない', async ({ page }) => {
    for (const w of [1440, 768, 390]) {
      await page.setViewportSize({ width: w, height: 900 });
      for (const path of ['/ja', '/ja/search', '/ja/asset/01', '/ja/about']) {
        await page.goto(path);
        await page.waitForTimeout(300);
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${w}px の ${path} で ${over}px 横にあふれている`).toBeLessThanOrEqual(1);
      }
    }
  });

  test('見出しが本文より大きい', async ({ page }) => {
    // Tailwind の preflight が 2 回出て、見出しの大きさが打ち消されていた
    for (const path of ['/ja', '/ja/search', '/ja/about']) {
      await page.goto(path);
      const sizes = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return {
          h1: h1 ? parseFloat(getComputedStyle(h1).fontSize) : null,
          body: parseFloat(getComputedStyle(document.body).fontSize),
        };
      });
      if (sizes.h1 === null) continue;
      expect(sizes.h1, `${path} の h1 (${sizes.h1}px) が本文 (${sizes.body}px) に対して小さい`)
        .toBeGreaterThan(sizes.body * 1.5);
    }
  });

  test('ドロップダウンが画面の外に出ない', async ({ page }) => {
    await page.goto('/ja');
    const cog = page.getByRole('button', { name: '設定' });
    if (!(await cog.count())) return;
    await cog.click();
    await page.waitForTimeout(400);
    const vw = page.viewportSize()!.width;
    const panels = await page.evaluate(() => {
      const out: { right: number; left: number; bottom: number }[] = [];
      for (const e of document.querySelectorAll('header *')) {
        const s = getComputedStyle(e);
        if (s.position !== 'absolute' && s.position !== 'fixed') continue;
        const r = e.getBoundingClientRect();
        if (r.width < 40 || r.height < 20) continue;
        out.push({ right: Math.round(r.right), left: Math.round(r.left), bottom: Math.round(r.bottom) });
      }
      return out;
    });
    for (const p of panels) {
      expect(p.right, `開いたパネルの右端 ${p.right} が画面幅 ${vw} を超えている`)
        .toBeLessThanOrEqual(vw);
      expect(p.left, `開いたパネルの左端 ${p.left} が画面の外`).toBeGreaterThanOrEqual(0);
    }
  });

  test('ヘッダの枠つきの箱の高さが揃っている', async ({ page }) => {
    /**
     * 設定（歯車）だけ 36px で、隣の 39px より 3px 低かった。
     * 中身が SVG だけで文字が無いため line-height がそのまま高さになっていた。
     * **外側の入れ物を測ると 39px で揃って見えるので、気づかない。**
     * 枠が見えている要素だけを測る必要がある。
     */
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ja');
    await page.waitForTimeout(500);
    const boxes = await page.evaluate(() => {
      const out: { label: string; h: number; top: number }[] = [];
      for (const el of document.querySelectorAll('header [class*="actions"] *')) {
        const s = getComputedStyle(el);
        if (parseFloat(s.borderTopWidth) <= 0 || s.borderTopStyle === 'none') continue;
        const r = el.getBoundingClientRect();
        out.push({ label: (el.textContent || 'アイコン').trim().slice(0, 12) || 'アイコン',
          h: Math.round(r.height), top: Math.round(r.top) });
      }
      return out;
    });
    if (boxes.length < 2) return;
    const hs = boxes.map((b) => b.h);
    const spread = Math.max(...hs) - Math.min(...hs);
    expect(spread,
      `枠つきの箱の高さがばらついている: ${boxes.map((b) => `${b.label}=${b.h}px`).join(' / ')}`)
      .toBeLessThanOrEqual(1);
  });

  test('ヘッダの操作が 1 行に収まっている', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ja');
    const tops = await page.evaluate(() => {
      const acts = document.querySelector('header [class*="actions"]');
      if (!acts) return [];
      return [...acts.children].map((c) => Math.round(c.getBoundingClientRect().top));
    });
    if (tops.length < 2) return;
    const spread = Math.max(...tops) - Math.min(...tops);
    expect(spread, `ヘッダ右側の要素の縦位置が ${spread}px ばらついている`).toBeLessThanOrEqual(12);
  });
});
