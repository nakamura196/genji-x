/**
 * 一覧の 1 件。**Ocean Market / Pontus-X Portal / Clio-X の DOM とクラス名をそのまま使う**
 * （Apache-2.0。由来: cliox/src/components/@shared/AssetTeaser/index.tsx）。
 * CSS も同じファイルを移植している。
 *
 * ── 本家の並び（入れ子もこの順のまま）──────────────────────────
 *   aside.detailLine   種別 + datatoken の記号
 *   header             題（3 行で切る）+ 公開者
 *   div.content        説明（3 行で切る）
 *   div.price          値段
 *   footer.footer      数字 + ネットワーク名
 *
 * ── 本家と変えた点は 2 つだけ ───────────────────────────────────
 * 1. **price の位置に「参照された回数」を置く。** 買うものが無いのに値段の枠を
 *    残すと嘘になるし、この仕組みが数えているのは所有ではなく利用の回数だから。
 *    位置・大きさ・余白は本家のまま。
 * 2. 3 行で切るのを react-dotdotdot（JS）ではなく CSS でやる。依存を 1 つ減らせて
 *    見た目は変わらない。
 *
 * サーバ側で描ける（回数だけ親からもらう）ので 'use client' は付けない。
 */
import Link from 'next/link';
import styles from './index.module.css';
import type { Asset } from '@/lib/catalog';

export type AssetTeaserLabels = {
  type: string;
  typeWhole: string;
  orders: string;
  loading: string;
  lines: string;
  /** 「和歌 {n} 首」。TEI から数えた値 */
  waka: string;
  network: string;
  verifiable: string;
};

/**
 * 公開者の欄。**チェーンの値をそのまま出すが、アドレスだけは縮める。**
 *
 * DDO の author は 0x… の 42 文字で、カードの幅では途中で切れて
 * 「0xA787b1285d7D0Cf5284167Ce27877437…」という読めない形になっていた。
 * 先頭 6 文字と末尾 4 文字にするのは Ocean Market / Clio-X と同じ作法。
 *
 * **訳しはしない。** アドレス以外の値（氏名など）が入っていれば素通しする。
 */
const shortenIfAddress = (v: string | null) =>
  v && /^0x[0-9a-fA-F]{40}$/.test(v) ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;

/** `{n}` のような差し込みを埋める。next-intl の t.raw() で生文字列を受けているため */
const fill = (t: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((s, [k, x]) => s.replaceAll(`{${k}}`, String(x)), t);

export function AssetTeaser({
  asset, href, orders, labels,
}: {
  asset: Asset;
  href: string;
  /** 数え終わっていないときは null。0 と区別する */
  orders: number | null;
  labels: AssetTeaserLabels;
}) {
  return (
    <article className={styles.teaser}>
      <Link href={href} className={styles.link}>
        <aside className={styles.detailLine}>
          <span className={styles.typeLabel}>
            {asset.volumeNumber ? labels.type : labels.typeWhole}
          </span>
          <span className={styles.typeLabel}>{asset.symbol}</span>
          {asset.proof && <span className={styles.typeLabel}>{labels.verifiable}</span>}
        </aside>

        <header>
          <h1 className={`${styles.title} ${styles.clamp3}`}>
            {asset.volumeTitle ?? asset.name}
          </h1>
          {/*
            **DDO の author をそのまま出す。翻訳しない。**
            以前はここが messages の "teaser.publisher" で、ja では「中村 覚」、
            en では「Satoru Nakamura」と出し分けていた。これは誤り。
            カタログはデータの中身を映す場所であって、訳す場所ではない。
            チェーンに記録されている値は 'Satoru Nakamura / 中村 覚' という
            1 本の文字列で、日英に分かれていない。片方だけ出すと、
            「チェーンにそう書いてある」と読めてしまう。
            データ側が多言語で持っていれば言語ごとに出せるが、単一言語なら
            そのまま出すのが正しい (schema.org でも値の翻訳は別プロパティ)。
          */}
          <div className={styles.publisher}>{shortenIfAddress(asset.author)}</div>
        </header>

        <div className={styles.content}>
          <p className={styles.clamp3}>
            {fill(labels.lines, {
              v: asset.volumeNumber ?? '—',
              n: (asset.lines ?? 0).toLocaleString(),
            })}
            {/* 和歌の数は TEI から数えた値。チェーンの行数と並ぶので、
                出どころの断りは絞り込みの側と詳細ページに書く */}
            {asset.waka != null && (
              <> · {fill(labels.waka, { n: asset.waka.toLocaleString() })}</>
            )}
          </p>
        </div>

        {/* 本家が値段を出す位置。ここに参照された回数を出す */}
        <div className={styles.price}>
          {orders != null ? (
            <span className={styles.orders}>{fill(labels.orders, { n: orders })}</span>
          ) : (
            <span className={styles.ordersLoading}>{labels.loading}</span>
          )}
        </div>

        <footer className={styles.footer}>
          <div>
            <span className={styles.typeLabel}>{asset.license}</span>
            {asset.bytes != null && (
              <span className={styles.typeLabel}>{asset.bytes.toLocaleString()} B</span>
            )}
          </div>
          <span className={styles.networkName}>{labels.network}</span>
        </footer>
      </Link>
    </article>
  );
}
