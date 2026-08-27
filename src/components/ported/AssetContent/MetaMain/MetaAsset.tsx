/**
 * 帯の上段。所有者と、利用に使う datatoken。
 * **移植** (Apache-2.0)。由来: cliox/.../MetaMain/MetaAsset.tsx
 *
 * 本家は @shared/Publisher でアドレスを名前に引き当て、MetaMask 用の
 * 「ウォレットに追加」も出す。こちらは公開者が 1 者しかおらず、datatoken も
 * 注文と同じ取引でバーンされて残高が常に 0 なので、どちらも意味を持たない。
 * 出すのは所有者のアドレスと、datatoken の記号への外部リンクだけにした。
 */
import styles from './MetaAsset.module.css';

const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;

export function MetaAsset({
  datatoken,
  publisher,
  explorer,
  symbol,
  labels,
}: {
  datatoken: string;
  publisher: string;
  explorer: string;
  symbol: string | null;
  labels: { ownedBy: string; accessedWith: string };
}) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.owner}>
        {labels.ownedBy}&nbsp;
        <a
          className={styles.publisher}
          href={`${explorer}/address/${publisher}`}
          target="_blank"
          rel="noreferrer"
        >
          {short(publisher)}
        </a>
      </span>
      <span>
        <a
          className={styles.datatoken}
          href={`${explorer}/token/${datatoken}`}
          target="_blank"
          rel="noreferrer"
        >
          {labels.accessedWith.replaceAll('{symbol}', symbol ?? '')}
        </a>
      </span>
    </div>
  );
}
