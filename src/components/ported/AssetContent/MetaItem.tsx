/**
 * 見出し + 中身の 1 組。**Ocean Market / Pontus-X Portal (Clio-X) からの移植**
 * (Apache-2.0)。由来: cliox/src/components/Asset/AssetContent/MetaItem.tsx
 *
 * DOM の入れ子とクラス名は本家のまま (div.metaItem > h3.title + div.content)。
 * 本家は `title: string` だが、こちらは「行数」のように単位を添える場面があるので
 * ReactNode を許した。それ以外は変えていない。
 */
import styles from './MetaItem.module.css';

/**
 * 値の出どころ。**本家に無いこの試作の追加。**
 *
 * この画面には性質のまるで違う値が並んでいる。
 *
 *   ddo     チェーンに記録された DDO に書いてある値。公開者が申告したもの
 *   chain   チェーンが持っている値。契約やイベントから読む。申告ではない
 *   tei     手元の TEI を数えた値。チェーンには無い。誰でも数え直せる
 *
 * 混ぜて出すと、読者は目の前の数字が「検証された事実」なのか
 * 「公開者がそう書いただけ」なのかを判断できない。
 * 参照回数を「チェーン由来だから改竄できない」と言えるのは chain のときだけで、
 * 行数を同じ調子で言うと嘘になる。
 */
export type MetaSource = 'ddo' | 'chain' | 'tei';

export function MetaItem({
  title,
  content,
  source,
  sourceLabel,
}: {
  title: React.ReactNode;
  content: React.ReactNode;
  /** 省略すると印を出さない（出どころが 1 つに定まらない項目） */
  source?: MetaSource;
  /** 印に出す短い語と、その説明（title 属性）。言語ごとに変わるので外から渡す */
  sourceLabel?: { short: string; help: string };
}) {
  return (
    <div className={styles.metaItem}>
      <h3 className={styles.title}>
        {title}
        {source && sourceLabel && (
          /* 見出しの右に小さく置く。中身の側に置くと値と混ざって読めなくなる */
          <span
            className={`${styles.source} ${styles[source]}`}
            title={sourceLabel.help}
          >
            {sourceLabel.short}
          </span>
        )}
      </h3>
      <div className={styles.content}>{content}</div>
    </div>
  );
}
