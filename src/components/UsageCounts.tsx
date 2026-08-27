'use client';
/**
 * 参照回数を **クライアント側で live に数える。**
 *
 * ── なぜ写しに焼き込まないのか ──────────────────────────────────
 * 回数は増える。ビルド時の値を焼き込むと、誰かが取得した直後に古くなる。
 * メタデータ（変わらない）は写しから、回数（増える）はその場で、という分担にしている。
 *
 * ── アドレスはまとめて引くが、まとめすぎない ────────────────────
 * 素直に 55 回問い合わせると、無料の公開 RPC に締め出される
 * (実測: 150 回ほどで拒否され、しかもエラーではなく空を返す)。
 * eth_getLogs は **アドレスの配列**を受けるので、まとめて引く。
 *
 * ただし **上限は 100 件ではない。2026-08-26 に実測し直したところ、
 * publicnode は 10 件以上のアドレスを並べると `Request blocked`
 * (JSON-RPC -32602 / HTTP 403) を返した**。9 件までは通る。
 * 以前ここは 55 件を 1 回で投げていて、そのため一覧の参照回数が
 * ずっと「数えています…」のまま止まっていた。
 * 上限いっぱいを狙わず 8 件ずつに割る (55 件で 7 回)。
 *
 * ── 数えているのは所有ではない ──────────────────────────────────
 * 券の残高は常に 0 である (注文の瞬間に出て同じ取引で焼かれる)。
 * だから残高ではなく **注文のログ**を数える。数えているのは利用の回数。
 */
import { useEffect, useState } from 'react';
import { publicClient, ORDER_EVENT } from '@/lib/chain';

export type Counts = Record<string, { orders: number; consumers: number }>;

/** 1 回の eth_getLogs に載せるアドレスの数。実測の上限は 9 件 (10 件で拒否される) */
const ADDRESS_CHUNK = 8;

/**
 * 無料の公開 RPC は混むと 429 / 403 を返す。**数え損ねた分を 0 として出さない。**
 * 途中の 1 回が落ちたら少し待って引き直し、それでも駄目なら例外のまま上へ返す
 * (呼び出し側は「数えています…」のまま止める)。少なく出すより出さないほうがよい。
 */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}

/** datatoken アドレス → 回数 */
export function useUsageCounts(datatokens: string[], fromBlock: number) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const from = BigInt(fromBlock);
        const acc: Counts = {};
        for (const a of datatokens) acc[a.toLowerCase()] = { orders: 0, consumers: 0 };
        const seen = new Map<string, Set<string>>();
        // アドレスを 8 件ずつに割る (9 件が実測の上限。余裕を見て 8)
        for (let i = 0; i < datatokens.length; i += ADDRESS_CHUNK) {
          const chunk = datatokens.slice(i, i + ADDRESS_CHUNK) as `0x${string}`[];
          // 1 回 50,000 ブロックまで (実測)。窓を刻んで、足りない分だけ足す
          for (let b = from; b <= latest; b += 49_000n) {
            const to = b + 48_999n > latest ? latest : b + 48_999n;
            const logs = await withRetry(() =>
              publicClient.getLogs({
                address: chunk,
                event: ORDER_EVENT,
                fromBlock: b,
                toBlock: to,
              }));
            for (const l of logs) {
              const key = l.address.toLowerCase();
              const consumer = String((l.args as { consumer?: string }).consumer ?? '').toLowerCase();
              acc[key] ??= { orders: 0, consumers: 0 };
              acc[key].orders += 1;
              if (!seen.has(key)) seen.set(key, new Set());
              seen.get(key)!.add(consumer);
            }
          }
        }
        for (const [k, set] of seen) acc[k].consumers = set.size;
        if (alive) setCounts(acc);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => { alive = false; };
  }, [datatokens.join(','), fromBlock]); // eslint-disable-line react-hooks/exhaustive-deps

  return { counts, error };
}
