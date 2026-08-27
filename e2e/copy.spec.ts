/**
 * 文面の質。**造語とテンプレートの残骸を機械的に弾く。**
 *
 * 「利用の券」「刻む」「工場」のような、辞書にも他の資料にも無い日本語を
 * 作ってしまっていた。読者は研究者で、英語の技術用語のほうが通じる。
 * GUIDELINES.md の用語表に沿っているかを確かめる。
 */
import { test, expect } from '@playwright/test';
import ja from '../src/messages/ja.json';
import en from '../src/messages/en.json';

const flat = (o: unknown, p = ''): [string, string][] => {
  if (typeof o === 'string') return [[p, o]];
  if (typeof o !== 'object' || o === null) return [];
  return Object.entries(o as Record<string, unknown>)
    .flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k));
};

/** 作ってはいけない語 → 使うべき語 */
const FORBIDDEN: [RegExp, string][] = [
  [/利用の券/, 'datatoken'],
  [/(?<!時)刻む|刻ん[だでみ]|刻ま[れな]/, '記録する'],
  [/指紋/, 'ハッシュ'],
  [/関所/, 'アクセス制限'],
  [/(?<!相談)窓口/, 'コントラクト'],
  [/工場/, 'ファクトリ'],
  [/(?<!貝)殻/, 'プロキシ'],
  [/畳む|畳ん/, '経路をたどって計算する'],
  [/受領書/, '参照記録'],
  [/(?<!振り)焼く|焼かれ/, 'バーンする'],
];

test('作ってはいけない日本語が入っていない', () => {
  const bad: string[] = [];
  for (const [k, v] of flat(ja)) {
    for (const [re, better] of FORBIDDEN) {
      if (re.test(v)) bad.push(`${k}: 「${v.match(re)![0]}」→「${better}」に  (${v.slice(0, 50)}…)`);
    }
  }
  expect(bad, '造語').toEqual([]);
});

test('メッセージに山括弧が無い', () => {
  // next-intl は ICU の書式指定を解釈するので、< はタグとみなされて落ちる
  const bad = [...flat(ja), ...flat(en)].filter(([, v]) => v.includes('<'));
  expect(bad.map(([k, v]) => `${k}: ${v}`), '山括弧').toEqual([]);
});

test('ja と en のキーが一致する', () => {
  const a = new Set(flat(ja).map(([k]) => k));
  const b = new Set(flat(en).map(([k]) => k));
  expect([...a].filter((k) => !b.has(k)), 'ja にしか無い').toEqual([]);
  expect([...b].filter((k) => !a.has(k)), 'en にしか無い').toEqual([]);
});

test('テンプレートの残骸が無い', () => {
  const all = flat(ja).map(([, v]) => v).join('\n') + flat(en).map(([, v]) => v).join('\n');
  for (const word of ['Next.js 国際化テンプレート', 'Next.js i18n Template',
    'yoursite', 'yourcreator', 'Example Page', 'テンプレート']) {
    expect(all, `テンプレート由来の文言「${word}」`).not.toContain(word);
  }
});

test('画面に生のキーや未訳が出ていない', async ({ page }) => {
  for (const path of ['/ja', '/en', '/ja/search', '/en/search', '/ja/about', '/en/about',
    '/ja/asset/01', '/en/asset/01']) {
    await page.goto(path);
    const text = await page.locator('body').innerText();
    expect(text, `${path}`).not.toContain('MISSING_MESSAGE');
    expect(text, `${path}`).not.toContain('INVALID_MESSAGE');
    // ja のページに英語の定型文が残っていないか（逆も）
    if (path.startsWith('/ja')) {
      expect(text, `${path} に英語の定型文`).not.toMatch(/\bLorem ipsum\b/);
    }
  }
});
