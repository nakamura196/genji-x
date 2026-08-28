/**
 * 「生の値」の一覧。**Ocean Market / Pontus-X Portal (Clio-X) からの移植**
 * (Apache-2.0)。由来: cliox/src/components/Asset/AssetContent/MetaFull.tsx
 *
 * 本家は div.metaFull の中に MetaItem を並べるだけで、段組は CSS
 * (repeat(auto-fit, minmax(12rem, 1fr))) が決める。DOM は本家のまま。
 *
 * ── 本家に無い追加: 3 つに分ける ────────────────────────────
 * 以前は 12 項目を 1 つの枠に横並びにしていた。**性質のまるで違うものが
 * 同じ重みで並び、どれが確かめられてどれが確かめられないのかが読めなかった。**
 *
 *   本文について   手元のファイルから計算し直して突き合わせられる
 *   目録としての記載 Ocean の書式に合わせた申告。確かめる相手がいない
 *   参照の記録     記録があるだけ。誰でも無料で残せるので数に意味がない
 *
 * 項目ごとの印 (ddo / chain / tei) は**値の出どころ**を言う。
 * こちらの 3 分けは**その値が何についての主張か**を言う。別の軸なので両方出す。
 */
import { MetaItem, type MetaSource } from './MetaItem';
import styles from './MetaFull.module.css';

export type MetaGroupLabels = { title: string; note: string };

export type MetaFullLabels = {
  author: string;
  owner: string;
  did: string;
  nft: string;
  datatoken: string;
  lines: string;
  bytes: string;
  waka: string;
  ddo: string;
  ddoValue: string;
  leaf: string;
  root: string;
  anchor: string;
  anchorCount: string;
  /** 出どころの印。ddo / chain / tei の 3 つ */
  sources: Record<MetaSource, { short: string; help: string }>;
  /** 3 つの束。それぞれ何についての主張かを見出しで言う */
  groups: Record<'text' | 'catalogue' | 'usage', MetaGroupLabels>;
};

/** アドレスは 42 字ある。折り返すと読みにくいので頭と尻だけ見せる */
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;

function Group({
  labels,
  children,
}: {
  labels: MetaGroupLabels;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{labels.title}</h3>
      <p className={styles.groupNote}>{labels.note}</p>
      <div className={styles.metaFull}>{children}</div>
    </section>
  );
}

export function MetaFull({
  asset,
  author,
  publisher,
  explorer,
  anchors,
  labels,
}: {
  asset: {
    did: string;
    waka?: number | null;
    nft: string;
    datatoken: string;
    lines: number | null;
    bytes: number | null;
    ddoBytes: number;
    proof: { leafHash: string; chapterRoot: string; corpusAnchor: string } | null;
  };
  author: string | null;
  publisher: string;
  explorer: string;
  anchors: { records: number; observers: number };
  labels: MetaFullLabels;
}) {
  const fill = (t: string, v: Record<string, string | number>) =>
    Object.entries(v).reduce((s, [k, x]) => s.replaceAll(`{${k}}`, String(x)), t);

  const link = (address: string, text?: string) => (
    <a
      className={styles.explorerLink}
      href={`${explorer}/address/${address}`}
      target="_blank"
      rel="noreferrer"
    >
      <code>{text ?? address}</code>
    </a>
  );

  const src = (s: MetaSource) => ({ source: s, sourceLabel: labels.sources[s] });

  return (
    <>
      {/*
        ① 本文について。**この束だけが、外から確かめられる。**
        行数もバイト数も葉ハッシュも、本文があれば誰でも計算し直せる。
        root はチェーンにあり、計算した値と突き合わせられる。
      */}
      <Group labels={labels.groups.text}>
        {asset.lines != null && (
          <MetaItem title={labels.lines} content={asset.lines.toLocaleString()} {...src('tei')} />
        )}
        {asset.bytes != null && (
          <MetaItem title={labels.bytes} content={asset.bytes.toLocaleString()} {...src('tei')} />
        )}
        {asset.waka != null && (
          <MetaItem title={labels.waka} content={asset.waka.toLocaleString()} {...src('tei')} />
        )}
        {asset.proof && (
          <>
            <MetaItem title={labels.leaf} content={<code>{asset.proof.leafHash}</code>} {...src('tei')} />
            {/* root は CorpusAnchor が持っている。DDO の写しではない */}
            <MetaItem title={labels.root} content={<code>{asset.proof.chapterRoot}</code>} {...src('chain')} />
            <MetaItem
              title={labels.anchor}
              {...src('chain')}
              content={
                <>
                  {link(asset.proof.corpusAnchor)}
                  <span className={styles.anchorCount}>
                    {fill(labels.anchorCount, { n: anchors.records, people: anchors.observers })}
                  </span>
                </>
              }
            />
          </>
        )}
      </Group>

      {/*
        ③ 目録としての記載。Ocean の書式に合わせたもの。
        DID の作り方も data NFT の形も Ocean が決めている。
      */}
      <Group labels={labels.groups.catalogue}>
        {author && <MetaItem title={labels.author} content={author} {...src('ddo')} />}
        {/* 所有者は ERC-721 の owner。DDO ではなくチェーンが持っている */}
        <MetaItem title={labels.owner} content={link(publisher, short(publisher))} {...src('chain')} />
        {/* DID は nftAddress と chainId から決まる。DDO にも書いてあるが出どころはチェーン */}
        <MetaItem title={labels.did} content={<code>{asset.did}</code>} {...src('chain')} />
        <MetaItem title={labels.nft} content={link(asset.nft)} {...src('chain')} />
        <MetaItem
          title={labels.ddo}
          content={fill(labels.ddoValue, { n: asset.ddoBytes })}
          {...src('chain')}
        />
      </Group>

      {/*
        ② 参照の記録。**確かめようがない束。**
        datatoken だけを置く。回数そのものは右の操作パネルが数えている。
      */}
      <Group labels={labels.groups.usage}>
        <MetaItem title={labels.datatoken} content={link(asset.datatoken)} {...src('chain')} />
      </Group>
    </>
  );
}
