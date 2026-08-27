/**
 * 「生の値」の一覧。**Ocean Market / Pontus-X Portal (Clio-X) からの移植**
 * (Apache-2.0)。由来: cliox/src/components/Asset/AssetContent/MetaFull.tsx
 *
 * 本家は div.metaFull の中に MetaItem を並べるだけで、段組は CSS
 * (repeat(auto-fit, minmax(12rem, 1fr))) が決める。DOM は本家のまま。
 *
 * 中身だけ差し替えている。本家は作者・所有者・DID・Docker イメージを出すが、
 * こちらは「この 1 帖を DDO だけで検証できる材料」が主役なので、
 * 葉ハッシュ・root・刻んだ場所を同じ枠に入れた。
 * 以前は自前の <Row> で 1 列の表にしていたが、幅の広い画面で間延びしていた。
 */
import { MetaItem, type MetaSource } from './MetaItem';
import styles from './MetaFull.module.css';

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
};

/** アドレスは 42 字ある。折り返すと読みにくいので頭と尻だけ見せる */
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;

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

  return (
    <div className={styles.metaFull}>
      {/*
        **出どころの印を項目ごとに付ける。**
        ここには性質の違う値が混ざっている。DDO は公開者の申告、
        チェーンの値は申告ではない、TEI から数えた値はチェーンに無い。
        印が無いと、どれも同じ重みの「事実」に見えてしまう。
      */}
      {author && <MetaItem title={labels.author} content={author} source="ddo" sourceLabel={labels.sources.ddo} />}
      {/* 所有者は ERC-721 の owner。DDO ではなくチェーンが持っている */}
      <MetaItem title={labels.owner} content={link(publisher, short(publisher))} source="chain" sourceLabel={labels.sources.chain} />
      {/* DID は nftAddress と chainId から決まる。DDO にも書いてあるが出どころはチェーン */}
      <MetaItem title={labels.did} content={<code>{asset.did}</code>} source="chain" sourceLabel={labels.sources.chain} />
      <MetaItem title={labels.nft} content={link(asset.nft)} source="chain" sourceLabel={labels.sources.chain} />
      <MetaItem title={labels.datatoken} content={link(asset.datatoken)} source="chain" sourceLabel={labels.sources.chain} />
      {/* 行数・バイト数・葉ハッシュは DDO から外した。本文があれば誰でも計算できる */}
      {asset.lines != null && (
        <MetaItem title={labels.lines} content={asset.lines.toLocaleString()} source="tei" sourceLabel={labels.sources.tei} />
      )}
      {asset.bytes != null && (
        <MetaItem title={labels.bytes} content={asset.bytes.toLocaleString()} source="tei" sourceLabel={labels.sources.tei} />
      )}
      {asset.waka != null && (
        <MetaItem title={labels.waka} content={asset.waka.toLocaleString()} source="tei" sourceLabel={labels.sources.tei} />
      )}
      <MetaItem
        title={labels.ddo}
        content={fill(labels.ddoValue, { n: asset.ddoBytes })}
        source="chain"
        sourceLabel={labels.sources.chain}
      />
      {asset.proof && (
        <>
          <MetaItem title={labels.leaf} content={<code>{asset.proof.leafHash}</code>} source="tei" sourceLabel={labels.sources.tei} />
          {/* root は CorpusAnchor が持っている。DDO の写しではない */}
          <MetaItem title={labels.root} content={<code>{asset.proof.chapterRoot}</code>} source="chain" sourceLabel={labels.sources.chain} />
          <MetaItem
            title={labels.anchor}
            source="chain"
            sourceLabel={labels.sources.chain}
            content={
              <>
                {link(asset.proof.corpusAnchor)}
                <span className={styles.anchorCount}>
                  {fill(labels.anchorCount, {
                    n: anchors.records,
                    people: anchors.observers,
                  })}
                </span>
              </>
            }
          />
        </>
      )}
    </div>
  );
}
