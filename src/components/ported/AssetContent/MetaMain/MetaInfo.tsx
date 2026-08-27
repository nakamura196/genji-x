/**
 * 帯の下段。種別と日付。
 * **移植** (Apache-2.0)。由来: cliox/.../MetaMain/MetaInfo.tsx
 *
 * 本家は AssetType (dataset / algorithm と access / compute) を出す。
 * こちらは翻刻テキスト 1 種で、しかも取得に関所が無いので、
 * 同じ枠に「翻刻テキスト | ダウンロード」を入れて格を合わせた。
 *
 * 日付はサーバ側だけで組み立てる。クライアント側でも書式を作ると、
 * 端末の時間帯によって描き直しでずれる (hydration mismatch)。
 */
import styles from './MetaInfo.module.css';

export function MetaInfo({
  created,
  updated,
  locale,
  labels,
}: {
  created: string | null;
  updated: string | null;
  locale: string;
  labels: { type: string; access: string; published: string; updated: string };
}) {
  const format = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(iso));

  return (
    <div className={styles.wrapper}>
      <span className={styles.assetType}>
        {labels.type} · {labels.access}
      </span>
      <div className={styles.byline}>
        {created && (
          <>
            {labels.published} <time dateTime={created}>{format(created)}</time>
          </>
        )}
        {created && updated && updated !== created && (
          <>
            {' — '}
            <span className={styles.updated}>
              {labels.updated} <time dateTime={updated}>{format(updated)}</time>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
