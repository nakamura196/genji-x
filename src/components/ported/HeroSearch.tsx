'use client';
/**
 * Hero の検索。**Ocean Market / Pontus-X の SearchBar の CSS をそのまま使う。**
 *
 * ── なぜ作り直したか ────────────────────────────────────────────
 * 最初は自前で style を書いていた。移植した styles.css が input の背景を
 * 透明にしているのに、こちらで背景を指定していなかったため、
 * **枠も背景も無い入力欄**になり、暗い Hero の上に白い文字が浮くだけの
 * 「見えない検索フォーム」になっていた。
 *
 * DOM にはあるので Playwright の存在確認は通っていた。**見えているかは
 * 計算後の色と枠を測らないと分からない。** その反省から e2e/visual.spec.ts で
 * 背景と文字の対比を測っている。
 *
 * 本家の入力欄は --input-background / --input-border-color / --input-font-color を
 * 使う。移植した _variables.css にこれらがあるので、それに載せる。
 */
import { useState } from 'react';
import styles from './Header/SearchBar.module.css';

export function HeroSearch({
  action, placeholder, label,
}: {
  action: string;
  placeholder: string;
  label?: string;
}) {
  const [q, setQ] = useState('');

  return (
    <form action={action} method="get" className={styles.search} role="search">
      <button type="submit" className={styles.button} aria-label={label ?? placeholder}>
        <svg viewBox="0 0 24 24" className={styles.searchIcon} aria-hidden="true"
             fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      </button>
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
        aria-label={label ?? placeholder}
      />
    </form>
  );
}
