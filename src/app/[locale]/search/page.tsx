/**
 * 一覧（検索）。**構成は Ocean Market / Pontus-X Portal / Clio-X の検索ページに合わせる。**
 * あちらは検索と一覧が主役で、説明は前に出さない。
 *
 * 幅と見出しは移植済みの atoms/Container と Page/PageHeader に任せる。
 * ここで独自に幅を書くと、他のページと数 rem ずれる（実際ずれていた）。
 *
 * 裏側（仕組み）を知りたい人向けの入口は、一覧の下に控えめに置く。
 */
import { Suspense } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { AssetList } from '@/components/ported/AssetList';
import { Page } from '@/components/ported/Page';
import Link from 'next/link';
import box from '@/components/ported/atoms/Box.module.css';
import { listVolumes, getWhole, registry, snapshot } from '@/lib/catalog';
import styles from './page.module.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function CatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('catalog');
  /**
   * **帖だけを並べる（54 件）。**
   * registry には 54 帖まとめた「全体版」も入っているが、粒度が違うので
   * ここには混ぜない。一覧の直後に別の入口として 1 枚置く。
   */
  const assets = listVolumes();
  const whole = getWhole();

  return (
    /*
      **Page を使う（Container + PageHeader を自分で並べない）。**

      以前はここで Container と PageHeader を直に置いていた。そのため
      **この画面には `<main>` が無かった**。見た目には出ないが、2 つ壊れていた:

        1. 「本文の区画どうしが詰まりすぎていないか」を測るテストが
           `main > *` を探しており、**何も見つからないまま通っていた**。
           空の配列に対する expect は必ず通る
        2. main の目印（ランドマーク）が無く、読み上げで本文へ飛べない

      同じことが詳細ページ (asset/[slug]) でも起きていた。
    */
    <Page title={t('title')} className={styles.page}>
      <p className={styles.lead}>{t('lead')}</p>

      {/*
        **Suspense で包む。** 中の絞り込みが `useSearchParams()` で `?q=` を読む。
        静的に書き出すページでこれを使うと、境界が無い場合に
        ページ全体が動的扱いに落ちる（ビルドが警告で止まる）。
        ここで区切っておけば、外側は静的なままでいられる。
      */}
      <Suspense fallback={null}>
      <AssetList
        assets={assets}
        basePath={`/${locale}`}
        fromBlock={registry.corpusAnchorFromBlock}
        teaserLabels={{
          type: t('teaser.type'), typeWhole: t('teaser.typeWhole'),
          orders: t.raw('teaser.orders') as string, loading: t('teaser.loading'),
          lines: t.raw('teaser.linesLong') as string,
          waka: t.raw('teaser.waka') as string,
          network: 'Sepolia',
          verifiable: t('teaser.verifiable'),
        }}
        searchLabels={{
          filters: t('search.filters'),
          placeholder: t('search.placeholder'), onlyProof: t('search.onlyProof'),
          sortBy: t('search.sortBy'), volume: t('search.volume'),
          orders: t('search.orders'), lines: t('search.lines'),
          waka: t('search.waka'),
          wakaTitle: t('search.wakaTitle'), wakaNote: t('search.wakaNote'),
          wakaAny: t('search.wakaAny'),
          wakaBands: t.raw('search.wakaBands') as Record<string, string>,
          count: t.raw('search.count') as string,
          clear: t('search.clearFilters'),
          noResults: t('search.noResults'),
        }}
      />
      </Suspense>

      {/*
        54 帖をまとめた 1 件への入口。帖のカードとは粒度が違うので列に混ぜない。

        **next/link で張る。** ここだけ素の <a> で、押すたびにページ全体を
        取り直していた（一覧のカードは AssetTeaser が next/link を使っている）。
        見た目は本家の Box.module.css の .box をそのまま当てて揃える
        （a.box:hover の少し浮く動きもこれで効く）。
      */}
      {whole && (
        <Link href={`/${locale}/asset/${whole.slug}`} className={`${box.box} ${styles.whole}`}>
          <h2 className={styles.wholeTitle}>{t('whole.title')}</h2>
          <p className={styles.wholeBody}>
            {t('whole.body', { lines: (whole.lines ?? 0).toLocaleString() })}
          </p>
        </Link>
      )}

      {/* 裏側への入口。表の画面を壊さないよう、一覧の下に控えめに置く */}
      <section className={styles.lineage}>
        <h2 className={styles.lineageTitle}>{t('lineage.title')}</h2>
        {/* 横にはみ出してスクロールする箱は、キーボードでも動かせるようにする
            （axe: scrollable-region-focusable。狭い画面でだけ出る） */}
        <pre className={styles.lineageTree} tabIndex={0} role="group" aria-label={t('lineage.title')}>{`oceanprotocol/market            2020-06 〜
  └─ deltaDAO/mvg-portal        Pontus-X Portal
       └─ ClioX-mvg-portal      Clio-X
            └─ Genji-X          ${t('lineage.this')}`}</pre>
        <p className={styles.lineageNote}>{t('lineage.note')}</p>
        <p className={styles.readAt}>
          {t('readAt', { block: snapshot.atBlock.toLocaleString() })}
        </p>
      </section>
    </Page>
  );
}
