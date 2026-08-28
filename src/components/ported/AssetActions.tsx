'use client';
/**
 * 詳細ページの右カラム。**本家 AssetActions の位置と役割をそのまま引き継ぐ。**
 * (Apache-2.0。由来: cliox/src/components/Asset/AssetActions/index.tsx)
 *
 * 本家はここに価格・購入ボタン・Compute の設定が入る。
 * こちらは買うものが無いので、次の 3 つを入れる。
 *
 *   1. 参照された回数（本家の価格の位置）
 *   2. 取得ボタン（押すと参照記録がチェーンに残る）
 *   3. 裏側への入口（自分で確かめる / 仕組みを見る）
 *
 * 3 は本家に無い層。表の画面を壊さないよう、パネルの下に積む。
 *
 * 以前はここを素の style={{}} で組んでいて、箱の角の丸みも余白も
 * 本家とずれていた。CSS は移植した AssetActions.module.css（本家の
 * `composes: box` をそのまま使う）に寄せてある。
 */
import { GetButton } from '../GetButton';
import { VerifyPanel } from '../VerifyPanel';
import { useUsageCounts } from '../UsageCounts';
import styles from './AssetContent/AssetActions.module.css';
import type { Address } from 'viem';

export function AssetActions({
  datatoken, fromBlock, proof, cid, links, fallbackOrders, labels,
}: {
  datatoken: Address;
  fromBlock: number;
  cid: string;
  /**
   * 写しに入っている参照回数。**数え直しが届くまでの間に出す。**
   * 公開 RPC はときどき 403 を返す (一覧の 54 件まとめ読みは実際に塞がれた)。
   * 数え直しだけに頼ると、失敗したとき「数えています…」が永久に残る。
   * 写しの値を先に出し、届いたら live の値で置き換える。
   */
  fallbackOrders: number | null;
  proof: {
    leafHash: string; leafIndex: number; treeSize: number;
    inclusionProof: string[]; chapterRoot: string;
  } | null;
  links: { nft: string; datatoken: string; anchor: string | null };
  labels: {
    count: string; countLoading: string; countCaveat: string;
    get: React.ComponentProps<typeof GetButton>['labels'];
    verify: React.ComponentProps<typeof VerifyPanel>['labels'];
    verifyTitle: string; verifyLead: string;
    behind: string; behindNft: string; behindDt: string; behindAnchor: string;
  };
}) {
  const { counts } = useUsageCounts([datatoken], fromBlock);
  const live = counts?.[datatoken.toLowerCase()]?.orders;
  const orders = live ?? fallbackOrders;

  return (
    <>
      <div className={styles.actions}>
        {/* 本家が価格を出す位置。数えているのは所有ではなく利用の回数 */}
        <p className={styles.countLabel}>{labels.count}</p>
        <p className={styles.count}>
          {orders != null ? (
            orders
          ) : (
            /* 数え終わるまで場所だけ確保する。数字が入っても行がずれない */
            <span className={styles.countLoading}>{labels.countLoading}</span>
          )}
        </p>

        {/* 数字のすぐ下に断りを置く。束の説明文にも書いてあるが、
            数字を先に見る人はそこまで読まない */}
        <p className={styles.countCaveat}>{labels.countCaveat}</p>

        <GetButton
          datatoken={datatoken}
          fromBlock={fromBlock}
          countLabel=""
          labels={labels.get}
          hideCount
        />
      </div>

      {/* ── ここから裏側の層。本家に無い ────────────────────────── */}
      {proof && (
        <div className={`${styles.actions} ${styles.panel}`}>
          <h3 className={styles.panelTitle}>{labels.verifyTitle}</h3>
          <p className={styles.panelLead}>{labels.verifyLead}</p>
          <VerifyPanel
            cid={cid}
            leafHash={proof.leafHash}
            leafIndex={proof.leafIndex}
            treeSize={proof.treeSize}
            inclusionProof={proof.inclusionProof}
            chapterRoot={proof.chapterRoot}
            labels={labels.verify}
          />
        </div>
      )}

      <div className={`${styles.actions} ${styles.panel}`}>
        <h3 className={styles.panelTitle}>{labels.behind}</h3>
        <ul className={styles.links}>
          {[
            [labels.behindNft, links.nft],
            [labels.behindDt, links.datatoken],
            ...(links.anchor ? [[labels.behindAnchor, links.anchor]] : []),
          ].map(([label, href]) => (
            <li key={href as string}>
              <a href={href as string} target="_blank" rel="noreferrer">
                {label} →
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
