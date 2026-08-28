/**
 * 取引の「何が起きたか」を組み立てる。
 *
 * Etherscan は汎用なので、この資料の文脈では読めない表示になる。
 * ここでは逆に、**この資料の文脈で何を意味するか**だけを組み立てる。
 * 生の値へはその後で送る（各画面に Etherscan への出口を置く）。
 *
 * 扱うのは `src/data/transactions.json` にある 8 件だけ。
 * 任意の取引は扱わない。無理に広げると「劣化した Etherscan」になる。
 */
import txData from '@/data/transactions.json';
import { getContract } from './contracts';

export type TxKind = 'order' | 'anchor' | 'metadata';

/** 参照の記録。画面側で文字列を直書きしないための定数 */
export const TX_KIND_ORDER: TxKind = 'order';

/** 記録 1 件。datatoken の出入りは transfer に入る */
export type TxLog = {
  index: number;
  address: string;
  topic0: string;
  topics: string[];
  dataBytes: number;
  transfer: { from: string; to: string; value: string } | null;
};

export type Tx = {
  hash: string;
  kinds: TxKind[];
  details: Record<string, unknown>[];
  from: string;
  to: string | null;
  block: number;
  timestamp: number;
  status: string;
  gasUsed: number;
  gasLimit: number;
  gasPrice: string;
  feeWei: string;
  value: string;
  nonce: number;
  type: string;
  selector: string;
  logs: TxLog[];
};

const ZERO = '0x0000000000000000000000000000000000000000';

export { TOPIC_NAME, SELECTOR_NAME } from './tx-signatures';
import { TOPIC_NAME } from './tx-signatures';


/** datatoken の出入りの別。画面では形（枠の色）でも区別する */
export type Move = 'mint' | 'burn' | 'move';
export const moveOf = (t: { from: string; to: string }): Move =>
  t.from.toLowerCase() === ZERO ? 'mint'
    : t.to.toLowerCase() === ZERO ? 'burn' : 'move';

export const transactions = (txData.transactions as unknown as Tx[]);

export const allTxHashes = () => transactions.map((t) => t.hash);

export const getTx = (hash: string): Tx | null =>
  transactions.find((t) => t.hash.toLowerCase() === hash.toLowerCase()) ?? null;

/** ある契約に関わる取引。契約のページから辿れるように */
export const txOfContract = (address: string): Tx[] =>
  transactions.filter((t) =>
    t.to?.toLowerCase() === address.toLowerCase()
    || t.logs.some((l) => l.address.toLowerCase() === address.toLowerCase()));

/** ある帖に関わる取引。帖のページから辿れるように */
export const txOfSlug = (slug: string): Tx[] =>
  transactions.filter((t) =>
    t.details.some((d) => (d as { slug?: string }).slug === slug));

/**
 * この取引に出てくるアドレスを、**役どころつき**で並べる。
 * 画面では、こちらが説明を持っているものだけリンクにする。
 */
export function actorsOf(tx: Tx) {
  const seen = new Map<string, { address: string; role: string }>();
  const put = (addr: string | null | undefined, role: string) => {
    if (!addr || addr.toLowerCase() === ZERO) return;
    const k = addr.toLowerCase();
    if (!seen.has(k)) seen.set(k, { address: addr, role });
  };
  put(tx.from, 'sender');
  put(tx.to, 'called');
  for (const l of tx.logs) {
    put(l.address, 'emitter');
    if (l.transfer) { put(l.transfer.from, 'transfer'); put(l.transfer.to, 'transfer'); }
  }
  return [...seen.values()].map((a) => ({
    ...a,
    /** こちらに説明があるか。無ければ Etherscan へ送るだけにする */
    known: getContract(a.address) != null,
  }));
}

/** 1e18 を「1 枚」と読む。18 桁で 1 枚と数える約束 */
export const asTickets = (wei: string) => {
  const v = BigInt(wei);
  const one = 10n ** 18n;
  return v % one === 0n ? String(v / one) : (Number(v) / 1e18).toString();
};

/** wei を ETH の文字列に。指数表記にしない */
export function formatEth(wei: string, digits = 18) {
  const v = BigInt(wei);
  const one = 10n ** 18n;
  const i = v / one;
  const f = (v % one).toString().padStart(18, '0').slice(0, digits).replace(/0+$/, '');
  return f ? `${i}.${f}` : String(i);
}

/** Gwei 表示。単価はここでしか使わない */
export const formatGwei = (wei: string) => {
  const v = Number(BigInt(wei)) / 1e9;
  return v.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
};
