/**
 * 題の下に敷く帯。**Ocean Market / Pontus-X Portal (Clio-X) からの移植**
 * (Apache-2.0)。由来: cliox/src/components/Asset/AssetContent/MetaMain/index.tsx
 *
 * 入れ子は本家のまま (aside.meta > header.asset + div.publisherInfo)。
 * .meta が左右に負の余白を持っていて、箱 (.content) の縁いっぱいまで
 * 帯を広げる作りになっている。ここを書き直すと帯が箱の中で浮くので触らない。
 *
 * 本家は header.asset の先頭に <Nft /> (NFT の画像) を置くが、こちらは
 * 画像を持たないので外した。MetaAsset 側の padding-left はそのまま効く。
 */
import styles from './index.module.css';
import { MetaAsset } from './MetaAsset';
import { MetaInfo } from './MetaInfo';

export function MetaMain({
  datatoken,
  publisher,
  explorer,
  symbol,
  created,
  updated,
  locale,
  labels,
}: {
  datatoken: string;
  publisher: string;
  explorer: string;
  symbol: string | null;
  created: string | null;
  updated: string | null;
  locale: string;
  labels: {
    ownedBy: string;
    accessedWith: string;
    type: string;
    access: string;
    published: string;
    updated: string;
  };
}) {
  return (
    <aside className={styles.meta}>
      <header className={styles.asset}>
        <MetaAsset
          datatoken={datatoken}
          publisher={publisher}
          explorer={explorer}
          symbol={symbol}
          labels={labels}
        />
      </header>
      <div className={styles.publisherInfo}>
        <MetaInfo
          created={created}
          updated={updated}
          locale={locale}
          labels={labels}
        />
      </div>
    </aside>
  );
}
