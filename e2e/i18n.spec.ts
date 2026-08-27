/**
 * 多言語。**メッセージに山括弧を書いて ICU の解析が落ちたことがある。**
 * 対訳の抜けも、画面に出る前に見つける。
 */
import { test, expect } from '@playwright/test';
import ja from '../src/messages/ja.json';
import en from '../src/messages/en.json';

const flatten = (o: unknown, p = ''): string[] => {
  if (typeof o !== 'object' || o === null) return [p];
  return Object.entries(o as Record<string, unknown>)
    .flatMap(([k, v]) => flatten(v, p ? `${p}.${k}` : k));
};

test('ja と en のキーが一致する', () => {
  const a = new Set(flatten(ja));
  const b = new Set(flatten(en));
  const onlyJa = [...a].filter((k) => !b.has(k));
  const onlyEn = [...b].filter((k) => !a.has(k));
  expect(onlyJa, 'ja にしか無いキー').toEqual([]);
  expect(onlyEn, 'en にしか無いキー').toEqual([]);
});

test('メッセージに山括弧を書いていない', () => {
  // next-intl は ICU の書式指定を解釈するので、< はタグとみなされて落ちる
  const bad: string[] = [];
  const walk = (o: unknown, p = '') => {
    if (typeof o === 'string') { if (o.includes('<')) bad.push(`${p}: ${o}`); return; }
    if (typeof o === 'object' && o) {
      for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
    }
  };
  walk(ja); walk(en);
  expect(bad, '山括弧を含むメッセージ').toEqual([]);
});

test('翻訳の抜けが画面に出ていない', async ({ page }) => {
  for (const path of ['/ja', '/en', '/ja/search', '/en/search', '/ja/about', '/en/about']) {
    await page.goto(path);
    const text = await page.locator('body').innerText();
    expect(text, `${path} に生のキーが出ている`).not.toMatch(/\b[a-z]+\.[a-z]+\.[a-zA-Z]+\b(?![\/.])/);
    expect(text, `${path} の MISSING_MESSAGE`).not.toContain('MISSING_MESSAGE');
  }
});
