/**
 * RFC 6962 の包含証明を **ブラウザの中で**検証する。
 *
 * ── なぜブラウザでやるのか ──────────────────────────────────────
 * サーバが「検証しました」と表示するだけなら、読者はそのサーバを信じることになる。
 * それではこの試作の主張が崩れる。読者自身のブラウザが、
 * 公開 IPFS ゲートウェイから本文を取り、自分でハッシュして、自分で畳む。
 * **私たちのサーバを一切信用せずに済む。**
 *
 * 使うのは Web Crypto の SHA-256 だけ。追加のライブラリは要らない。
 *
 * ── 葉と節に別の前置きを付ける理由 ──────────────────────────────
 * 葉は 0x00、節は 0x01 を前に付けてからハッシュする。これが無いと、
 * ある節のハッシュを葉として提出する攻撃 (second-preimage) が通ってしまう。
 */
const LEAF = new Uint8Array([0x00]);
const NODE = new Uint8Array([0x01]);

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

const sha256 = async (data: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));

export const leafHash = (entry: Uint8Array) => sha256(concat(LEAF, entry));
export const nodeHash = (l: Uint8Array, r: Uint8Array) => sha256(concat(NODE, l, r));

export const toHex = (b: Uint8Array) =>
  '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export const fromHex = (h: string) => {
  const s = h.replace(/^0x/, '');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const equal = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * 包含証明の検証。lib/merkle.mjs（Node 側）と同じ手順。
 *
 * **treeSize を証明から推測しない。** index 0 の証明では経路が全部「右の兄弟」に
 * なるので、treeSize が 5 でも 8 でも計算が 1 バイトも変わらない。
 * 証明が示すのは (root, index, entry) の 3 つ組だけで、treeSize は含まれない。
 * だから treeSize は DDO の記載から取る。
 */
export async function verifyInclusion(
  entry: Uint8Array,
  index: number,
  treeSize: number,
  path: string[],
  expectedRoot: string
): Promise<boolean> {
  if (index >= treeSize) return false;
  let fn = index;
  let sn = treeSize - 1;
  let r = await leafHash(entry);
  for (const hex of path) {
    if (sn === 0) return false; // 証明が長すぎる
    const sibling = fromHex(hex);
    if (fn % 2 === 1 || fn === sn) {
      r = await nodeHash(sibling, r);
      while (fn !== 0 && fn % 2 === 0) {
        fn = Math.floor(fn / 2);
        sn = Math.floor(sn / 2);
      }
    } else {
      r = await nodeHash(r, sibling);
    }
    fn = Math.floor(fn / 2);
    sn = Math.floor(sn / 2);
  }
  return sn === 0 && equal(r, fromHex(expectedRoot));
}

/**
 * 公開ゲートウェイ。1 つ落ちても次を試す。
 *
 * ── dweb.link を外している理由 ──────────────────────────────────
 * dweb.link は `/ipfs/<CID>` を **`<CID>.ipfs.dweb.link` へ 301 で飛ばす**。
 * オリジンを分けるためで、設計としては正しい (同じホストに置くと、ある CID の
 * JavaScript が別の CID の Cookie を読めてしまう)。
 *
 * ただし副作用がある。`*.ipfs.dweb.link` という形のサブドメインが無数に生えるので、
 * **組織のネットワークがワイルドカードで遮断していると全部落ちる**。
 * 実際に ERR_CONNECTION_REFUSED を踏んだ (inbrowser.link も同じ形だった)。
 *
 * ── ipfs.io を先頭から外した (2026-08-26 の再実測) ──────────────
 * **curl では 200 なのに、本物のブラウザでは 403 が返る。**
 * Cloudflare の「Just a moment...」が挟まる。dweb.link と w3s.link も同じ
 * (w3s.link は dweb.link へ飛ばされる)。curl だけで確かめて「使える」と
 * 判断していたのが誤りだった。**人が見る条件で測らないと分からない。**
 *
 * 実測 (Chromium で実際に開いた):
 *
 *   ipfs.io               403  ボット判定
 *   dweb.link             403  ボット判定
 *   w3s.link              403  dweb.link へ飛ばされてボット判定
 *   gateway.pinata.cloud  200  TEI が出た
 *   ipfs.filebase.io      200  TEI が出た
 *   flk-ipfs.xyz          接続拒否
 *   4everland.io          接続拒否
 *
 * filebase はこの資料を実際に固定してある先なので、いちばん確実。
 * ただし 1 社に寄せると落ちたときに全部止まるので、pinata を先に置いて
 * filebase を控えにする。
 */
export const GATEWAYS = [
  'https://gateway.pinata.cloud',
  'https://ipfs.filebase.io',
];

/** 画面のリンクに使う既定のゲートウェイ。**ここ 1 か所から配る** */
export const gatewayUrl = (cid: string) => `${GATEWAYS[0]}/ipfs/${cid}`;

export async function fetchFromIpfs(cid: string, signal?: AbortSignal) {
  const errors: string[] = [];
  for (const g of GATEWAYS) {
    try {
      const res = await fetch(`${g}/ipfs/${cid}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { bytes: new Uint8Array(await res.arrayBuffer()), gateway: new URL(g).host };
    } catch (e) {
      errors.push(`${new URL(g).host}: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.join(' / '));
}
