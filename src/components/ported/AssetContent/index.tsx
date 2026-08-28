/**
 * 詳細ページの中身。**Ocean Market / Pontus-X Portal (Clio-X) の DOM と
 * クラス名をそのまま使う** (Apache-2.0)。
 * 由来: cliox/src/components/Asset/AssetContent/index.tsx
 *
 * ── 本家の骨格 (この入れ子も本家のまま) ────────────────────────
 *   div.networkWrap        ネットワーク名
 *   article.grid           60rem 以上で 1.5fr / 1fr の 2 カラム
 *     div > div.content      左: 帯 → 説明 → 本文への入口 → 生の値
 *     div.actions            右: 操作パネル (AssetActions)
 *
 * これまで 1 カラムの縦積みだったので、右側の操作パネルが本文の
 * ずっと下に流れ、幅の広い画面で右半分が空いていた。本家に戻す。
 *
 * 左右の役割は本家と同じ。**左は動かない事実、右は読者が起こす行為**。
 * 本家の右が「値段と購入」なのに対し、こちらは「参照された回数と取得」。
 * 買うものが無いだけで、位置の意味は変えていない。
 *
 * サーバ側で描ける。回数と検証は右の AssetActions (client) が持つ。
 */
import styles from './index.module.css';
/* 印の見た目は MetaItem 側が持っている。凡例でも同じ見た目を使う */
import meta from './MetaItem.module.css';
import { MetaMain } from './MetaMain';
import { MetaSecondary } from './MetaSecondary';
import { MetaFull, type MetaFullLabels } from './MetaFull';
import { AssetActions } from '../AssetActions';

export function AssetContent({
  asset,
  ddo,
  publisher,
  explorer,
  network,
  gateway,
  anchors,
  locale,
  txs,
  actions,
  labels,
}: {
  asset: {
    slug: string;
    did: string;
    nft: string;
    datatoken: string;
    symbol: string | null;
    lines: number | null;
    bytes: number | null;
    /** 和歌の数。TEI から数えた値で、チェーンには無い */
    waka: number | null;
    ddoBytes: number;
    ipfsCid: string;
    proof: {
      leafHash: string;
      leafIndex: number;
      treeSize: number;
      inclusionProof: string[];
      chapterRoot: string;
      corpusAnchor: string;
    } | null;
  };
  ddo: {
    description: string | null;
    author: string | null;
    created: string | null;
    updated: string | null;
    tags: string[];
  };
  publisher: string;
  explorer: string;
  network: string;
  gateway: string;
  anchors: { records: number; observers: number };
  locale: string;
  /** この帖に関わる取引。目録が把握しているものだけ */
  txs: { hash: string; kind: string; change: string | null; block: number }[];
  actions: React.ComponentProps<typeof AssetActions>;
  labels: {
    meta: React.ComponentProps<typeof MetaMain>['labels'];
    sample: React.ComponentProps<typeof MetaSecondary>['labels'];
    raw: MetaFullLabels;
    rawTitle: string;
    /** 印の読み方。1 行の凡例として出す */
    rawLegend: { chain: string; ddo: string; tei: string };
    txs: { title: string; note: string; kind: Record<string, string>; change: Record<string, string> };
    caveat: string;
  };
}) {
  return (
    <>
      <div className={styles.networkWrap}>
        <span className={styles.network}>{network}</span>
      </div>

      <article className={styles.grid}>
        <div>
          <div className={styles.content}>
            <MetaMain
              datatoken={asset.datatoken}
              publisher={publisher}
              explorer={explorer}
              symbol={asset.symbol}
              created={ddo.created}
              updated={ddo.updated}
              locale={locale}
              labels={labels.meta}
            />

            {ddo.description && (
              <p className={styles.description}>{ddo.description}</p>
            )}

            <MetaSecondary
              gateway={gateway}
              ipfsUri={`ipfs://${asset.ipfsCid}`}
              fileName={`${asset.slug}.xml`}
              tags={ddo.tags}
              labels={labels.sample}
            />

            <h2 className={styles.sectionTitle}>{labels.rawTitle}</h2>
            {/*
              **印の読み方を先に書く。** 印だけ置いて説明を title 属性に隠すと、
              触れない人には届かない。1 行で 3 つの意味を出しておく。
            */}
            <p className={styles.sourceLegend}>
              <span className={styles.legendItem}>
                <span className={`${meta.source} ${meta.chain}`}>{labels.raw.sources.chain.short}</span>
                {labels.rawLegend.chain}
              </span>
              <span className={styles.legendItem}>
                <span className={`${meta.source} ${meta.ddo}`}>{labels.raw.sources.ddo.short}</span>
                {labels.rawLegend.ddo}
              </span>
              <span className={styles.legendItem}>
                <span className={`${meta.source} ${meta.tei}`}>{labels.raw.sources.tei.short}</span>
                {labels.rawLegend.tei}
              </span>
            </p>
            <MetaFull
              asset={asset}
              author={ddo.author}
              publisher={publisher}
              explorer={explorer}
              anchors={anchors}
              labels={labels.raw}
            />

            {/*
              **この帖に関わる取引。**
              「生の値」で葉ハッシュや root を見せた直後に、
              その値が実際にチェーンへ入った取引へ行けるようにする。
              Etherscan へ直に飛ばすと文脈が切れるので、まず目録の中の説明に送る。
            */}
            {txs.length > 0 && (
              <section className={styles.txSection}>
                <h2 className={styles.sectionTitle}>{labels.txs.title}</h2>
                <p className={styles.txNote}>{labels.txs.note}</p>
                <ul className={styles.txList}>
                  {txs.map((tx) => (
                    <li key={tx.hash}>
                      <a href={`/${locale}/tx/${tx.hash}`}>
                        <code>{tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}</code>
                      </a>
                      <span className={styles.txKind}>
                        {tx.change ? labels.txs.change[tx.change] : labels.txs.kind[tx.kind]}
                      </span>
                      <span className={styles.txBlock}>{tx.block.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className={styles.caveat}>{labels.caveat}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <AssetActions {...actions} />
        </div>
      </article>
    </>
  );
}
