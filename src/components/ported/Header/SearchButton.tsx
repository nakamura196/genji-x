'use client';
/**
 * 検索ボタン。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 出どころ: cliox/src/components/Header/SearchButton.tsx
 *
 * DOM とクラス名は本家と同じ (.search > button.button > svg.searchIcon)。
 *
 * 押したときの動きだけ違う。本家はヘッダの下に検索欄を開いたり閉じたりする
 * （SearchBarStatus という状態を全画面で共有している）。こちらは一覧が 55 件で、
 * 一覧の画面に絞り込みが常に出ているので、そこへ移動するだけにした。
 * 状態を共有する仕掛けを 1 つ減らせる。
 */
import { useRouter } from 'next/navigation';
import { SearchIcon } from './Icons';
import styles from './SearchButton.module.css';

export default function SearchButton({ locale, label }: { locale: string; label: string }) {
  const router = useRouter();

  return (
    <div className={styles.search}>
      <button
        type="button"
        aria-label={label}
        onClick={() => router.push(`/${locale}/search`)}
        className={styles.button}
      >
        <SearchIcon className={styles.searchIcon} aria-hidden />
      </button>
    </div>
  );
}
