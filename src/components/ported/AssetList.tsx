'use client';
/**
 * 検索ページの本体。**Ocean Market / Pontus-X Portal / Clio-X の 2 段組をそのまま使う**
 * （Apache-2.0。由来: cliox/src/components/Search/index.tsx +
 *  cliox/src/components/@shared/AssetList/index.tsx）。
 *
 * 左が絞り込み (15rem・65rem 未満では上に回り込む)、右が一覧。
 * 一覧の列は 20rem 以上で自動的に折り返す。**この数字は本家のまま。**
 * 以前ここで minmax(15rem, 1fr) を直接書いていて、本家より 1 列多く並んでいた。
 *
 * 件数は **一覧の頭に見出しとして出す**。本家は pages/search.tsx が件数を
 * Page の title に渡していて、画面では h1 として出る（「54 件」）。
 * こちらは見出しに作品名を出したいので、件数はその下、一覧の直前に置いた。
 * 大きさ・太さ・下の余白は本家の .resultsCount の値そのまま。
 * 以前は絞り込みの脇に 12px の小さな字で出していて、目に入らなかった。
 *
 * 本家との違いは中身の出どころだけ。あちらは Aquarius に問い合わせてページ送りするが、
 * こちらは 55 件が全部手元にあるので、ページ送りも読み込み表示も要らない。
 * 参照回数だけはチェーンから live に数えるので、ここでまとめて 1 回だけ問い合わせる。
 */
import { useUsageCounts } from '../UsageCounts';
import { useAssetFilter, SearchBar, type SearchLabels } from './SearchBar';
import { AssetTeaser, type AssetTeaserLabels } from './AssetTeaser';
import styles from './AssetList.module.css';
import type { Asset } from '@/lib/catalog';

export function AssetList({
  assets, basePath, fromBlock, teaserLabels, searchLabels,
}: {
  assets: Asset[];
  basePath: string;
  fromBlock: number;
  teaserLabels: AssetTeaserLabels;
  searchLabels: SearchLabels;
}) {
  const { counts } = useUsageCounts(assets.map((a) => a.datatoken), fromBlock);
  const f = useAssetFilter(assets, counts);

  return (
    <div className={styles.container}>
      <div className={styles.filterContainer}>
        <SearchBar
          q={f.q} setQ={f.setQ}
          onlyProof={f.onlyProof} setOnlyProof={f.setOnlyProof}
          waka={f.waka} setWaka={f.setWaka} wakaCounts={f.wakaCounts}
          sort={f.sort} setSort={f.setSort}
          isDirty={f.isDirty} clear={f.clear}
          labels={searchLabels}
        />
      </div>

      <div className={styles.results}>
        {/* 本家が件数を h1 で出しているのに合わせる。中身の書式は
            「絞り込んだ数 / 全体の数」で、絞ると前の数だけが動く */}
        <h1 className={styles.resultsCount}>
          {searchLabels.count
            .replace('{shown}', String(f.filtered.length))
            .replace('{total}', String(assets.length))}
        </h1>

        <div className={styles.assetList}>
          {f.filtered.length > 0 ? (
            f.filtered.map((a) => (
              <AssetTeaser
                key={a.nft}
                asset={a}
                href={`${basePath}/asset/${a.slug}`}
                orders={counts?.[a.datatoken.toLowerCase()]?.orders ?? null}
                labels={teaserLabels}
              />
            ))
          ) : (
            /* 本家も空のときは同じ位置に 1 行だけ出す */
            <div className={styles.empty}>{searchLabels.noResults}</div>
          )}
        </div>
      </div>
    </div>
  );
}
