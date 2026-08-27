'use client';
/**
 * 言語の切り替え。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 出どころ: cliox/src/components/Header/LanguageSwitcher.tsx
 *
 * DOM とクラス名は本家と同じ (.switcher > button.button)。変えたのは 2 点だけ。
 *   1. Pages Router の router.push({ locale }) → App Router なので URL の
 *      先頭の言語名を差し替える
 *   2. 選んでいない側を薄くする指定を、JSX の style 直書きから CSS に移した
 *
 * 表示は言語コード（ja / en）。CSS 側の text-transform で JA / EN と見える。
 * **ここだけ本家と違う。** 本家は「日本語 / EN」と呼び名で出しているが、
 * 呼び名だと幅が揃わず、狭い画面で行が折れる。コードなら 2 文字で揃う。
 * 翻訳しないのは本家と同じ（いま読めない言語で書かれていたら選べないため）。
 */
import { usePathname, useRouter } from 'next/navigation';
import styles from './LanguageSwitcher.module.css';

const LOCALES = ['ja', 'en'] as const;

export default function LanguageSwitcher({
  locale,
  label,
}: {
  locale: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? `/${locale}`;

  /** 言語を変えても同じページに留まる（本家と同じ挙動） */
  function switchTo(next: string) {
    const rest = pathname.replace(new RegExp(`^/(${LOCALES.join('|')})(?=/|$)`), '');
    router.push(`/${next}${rest}`);
  }

  return (
    <div className={styles.switcher} aria-label={label}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={styles.button}
          onClick={() => switchTo(l)}
          aria-current={l === locale}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
