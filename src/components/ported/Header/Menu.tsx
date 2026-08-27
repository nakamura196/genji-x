'use client';
/**
 * メニュー。**Ocean Market / Pontus-X Portal の DOM とクラス名をそのまま使う。**
 *
 * 本家との違いは 2 つだけ。
 *   1. Pages Router (`next/router`) → App Router (`usePathname`)
 *   2. 出品・編集・Compute・プロフィールが無いので、その項目を置かない
 *
 * 右側の並び (actions) も本家と同じ順序にしてある:
 *   言語 → 検索 → ネットワーク → ウォレット
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Menu.module.css';
import { Logo } from './Logo';
import { Actions, type ActionsLabels } from './Actions';

export type MenuItem = { name: string; link: string };

export default function Menu({
  locale, items, labels,
}: {
  locale: string;
  items?: MenuItem[];
  labels: ActionsLabels;
}) {
  const pathname = usePathname();
  const base = `/${locale}`;
  const nav = items ?? [];

  return (
    <nav className={styles.menu}>
      {/*
        **図案の下に GENJI-X の文字を置く。**
        本家 (Clio-X) のロゴは、マークの下に CLIO-X の文字が入った 1 枚の SVG で、
        狭い画面ではマークだけの正方形に差し替わる（実サイトで確認: 53x53）。
        こちらは図案を SVG で描いているので、文字は別の要素にして
        同じ見え方にする。**源氏香の図だけでは何のサイトか分からない。**
      */}
      <Link href={base} className={styles.logo} aria-label="Genji-X">
        <Logo />
        <span className={styles.wordmark} aria-hidden="true">GENJI-X</span>
      </Link>

      <ul className={styles.navigation}>
        {nav.map((item) => {
          const href = `${base}${item.link}`;
          const active = pathname === href || (item.link !== '/' && pathname?.startsWith(href));
          return (
            <li key={item.link}>
              <Link href={href} className={`${styles.link} ${active ? styles.active : ''}`}>
                {item.name}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.actions}>
        <Actions locale={locale} labels={labels} />
      </div>
    </nav>
  );
}
