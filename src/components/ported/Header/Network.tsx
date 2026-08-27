'use client';
/**
 * つないでいるネットワークの表示。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 出どころ: cliox/src/components/Header/NetworkMenu/{index,Network}.tsx
 *
 * DOM とクラス名は本家と同じ (.networkMenu > .network > .name + .badge)。
 *
 * ── 本家との違い ────────────────────────────────────────────────
 * 1. 押しても何も起きない。本家はここからネットワークを選び直せるが、
 *    こちらは Sepolia 1 本しか使わないので、切り替え先が無い。
 * 2. **ウォレットを繋いでいなくても出す。** 本家はここが「あなたのウォレットが
 *    いま繋がっている先」なので、繋いでいなければ何も出さない。こちらでは
 *    「この目録が載っているチェーン」を先に知らせたい。読むだけならウォレットは
 *    要らないので、繋ぐ前に出しておかないと伝える機会が無い。
 *    ウォレットが別のチェーンに繋がっているときは、そちらを隠さず出す。
 */
import { CHAIN } from '@/lib/chain';
import styles from './Network.module.css';

export default function Network({ chainId }: { chainId: number | null }) {
  // 繋いでいないとき (null) は、この目録が載っているチェーンを出す
  const id = chainId ?? CHAIN.id;
  const known = id === CHAIN.id;

  return (
    <div className={styles.networkMenu}>
      <div className={`${styles.network} ${styles.static}`}>
        <span className={`${styles.name} ${styles.static}`}>
          {known ? CHAIN.name : `Chain ${id}`}
        </span>
        {known && CHAIN.testnet && <span className={styles.badge}>Test</span>}
      </div>
    </div>
  );
}
