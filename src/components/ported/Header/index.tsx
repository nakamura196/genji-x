/**
 * ヘッダ。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * CSS はそのまま。DOM とクラス名も同じにして、中身だけ App Router 向けに書き直した。
 * 本家は Pages Router (`next/router`) と `@loadable/component` を使っていて、
 * そのままでは動かないため。
 *
 * 文言はここ（サーバ側）でまとめて解決し、下の client 部品に渡す。
 * こうすると next-intl の messages をブラウザに送らずに済む。
 */
import Menu from './Menu';
import { getTranslations } from 'next-intl/server';
import styles from './index.module.css';

export default async function Header({ locale }: { locale: string }) {
  const t = await getTranslations('site');
  const nav = [
    { name: t('nav.catalog'), link: '/search' },
    { name: t('nav.about'), link: '/about' },
  ];
  return (
    <header className={styles.header}>
      <Menu
        locale={locale}
        items={nav}
        labels={{
          connect: t('wallet.connect'),
          connecting: t('wallet.connecting'),
          wrongChain: t('wallet.wrongChain'),
          noWallet: t('wallet.noWallet'),
          // 繋いだあとに開く吹き出し（本家 Details.tsx にあたる）
          copy: t('wallet.copy'),
          copied: t('wallet.copied'),
          explorer: t('wallet.explorer'),
          disconnect: t('wallet.disconnect'),
          disconnectNote: t('wallet.disconnectNote'),
          searchLabel: t('nav.searchLabel'),
          languageLabel: t('nav.languageLabel'),
          prefsLabel: t('prefs.label'),
          appearance: t('prefs.appearance'),
          // まだ ja.json / en.json に入っていない場合がある。無ければ出さない
          // （t() は無いキーで MISSING_MESSAGE を投げ、キー名がそのまま画面に出る）
          appearanceHelp: t.has('prefs.appearanceHelp') ? t('prefs.appearanceHelp') : undefined,
          light: t('prefs.light'),
          dark: t('prefs.dark'),
          system: t('prefs.system'),
        }}
      />
    </header>
  );
}
