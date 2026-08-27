/**
 * カタログの読み取り。**サーバ側で動く（SSR）。**
 *
 * ── なぜクライアント側で全部やらないのか ────────────────────────
 * 書き込み（注文）は MetaMask が署名するので必ずクライアント側になる。
 * 読み取りは技術的にはどちらでもできるが、全部クライアント側にすると:
 *
 *   1. 無料の公開 RPC は続けて叩くと締め出され、**エラーではなく空を返す**。
 *      全訪問者のブラウザから直接叩くと、混んだときに「0 件」の画面が出る。
 *      Ocean Market が 0 件になっているのと同じ絵になる
 *   2. 検索エンジンが中身を読めない。「桐壺」で検索して辿り着けなくなる
 *   3. 引用の宛先として弱い。開いた人に確実に中身が見えてほしい
 *
 * だから **メタデータはサーバ側でキャッシュ付きで取り、参照回数と注文は
 * クライアント側で live に取る**という分担にしている。
 * サーバといっても鍵は持たない。読むだけなので「誰かのサーバに依存しない」は保たれる。
 */
import { decodeEventLog, parseAbiItem } from 'viem';
import {
  publicClient, OCEAN, METADATA_EVENT, ORDER_EVENT, CORPUS_ANCHORED_EVENT,
  ERC721_ABI, ERC20_ABI,
} from './chain';
import registry from '@/data/registry.json';
import snapshot from '@/data/snapshot.json';
import teiFacets from '@/data/tei-facets.json';

/** 無料 RPC の上限 (実測)。1 回の eth_getLogs で 50,000 ブロックまで */
const MAX_RANGE = 49_000n;

export type Ddo = {
  id: string;
  metadata: {
    name: string;
    description: string;
    author: string;
    license: string;
    tags?: string[];
    created: string;
    updated: string;
    additionalInformation: Record<string, unknown>;
  };
  services: { serviceEndpoint: string; datatokenAddress: string }[];
};

export type Asset = {
  slug: string;
  nft: `0x${string}`;
  datatoken: `0x${string}`;
  did: string;
  name: string;
  /**
   * ここから 5 つは DDO の metadata そのもの。**詳細ページが出す。**
   * 以前は Asset 型に載っておらず、詳細ページが snapshot.json を自分で開き直して
   * 拾っていた。写しの形（assets[].ddo.metadata）を知っている場所が 2 つに割れ、
   * 片方だけ直すと静かにずれる。読み取りは catalog.ts に 1 本化する。
   */
  description: string | null;
  author: string | null;
  /** ISO 8601 の文字列のまま渡す。書式は locale を知っている描画側で作る */
  created: string | null;
  updated: string | null;
  tags: string[];
  volumeNumber: number | null;
  volumeTitle: string | null;
  lines: number | null;
  bytes: number | null;
  /**
   * 和歌の数。**チェーンには入っていない。** 手元の TEI を数えた値で、
   * 出どころは `src/data/tei-facets.json`（`scripts/build-tei-facets.mjs` が作る）。
   *
   * チェーンに載せていないのは、載せる必要が無いから。root が固定されていれば
   * TEI も固定され、TEI が固定されていれば和歌の数も一意に決まる。
   * **すでに証明の下にある値**なので、重ねて刻むと費用と訂正できない値が増えるだけ。
   *
   * この区別は画面にも出す。混ぜて出すと、読者が
   * 「チェーンが保証した数」と「こちらが数えた数」を見分けられなくなる。
   */
  waka: number | null;
  license: string;
  symbol: string | null;
  ipfsCid: string;
  encrypted: boolean;
  ddoBytes: number;
  /** DDO 単体で検証できるための材料 */
  proof: { leafHash: string; leafIndex: number; treeSize: number; inclusionProof: string[];
    chapterRoot: string; corpusAnchor: string; corpusAnchorFromBlock: number | null } | null;
  fromBlock: number;
  /**
   * 参照回数。**写しから読む。**
   *
   * 最初はブラウザから 55 件をまとめて数えていたが、publicnode が
   * 複数アドレスのまとめ読みを「Request blocked」で拒否するようになった
   * (2026-08-26 実測。以前は 100 件まで通った)。1 件ずつだと訪問者ごとに
   * 55 回叩くことになるので成り立たない。
   * ビルド時（および定期実行時）に 1 回だけ数え、詳細ページでだけ数え直す。
   */
  usage: { orders: number; consumers: number } | null;
};

/** flags の bit 1 が立っていたら暗号化。復号できるのは decryptorUrl のノードだけ */
const isEncrypted = (flags: `0x${string}`) =>
  flags.length >= 4 && (parseInt(flags.slice(2, 4), 16) & 2) !== 0;

/**
 * メタデータは **ビルド時に作った写し**から取る。ここでは RPC を叩かない。
 *
 * 最初はページごとにチェーンを読んでいたが、120 ページが同じ公開 RPC を
 * 9 並列で叩いてビルドが 2 分近くかかり、一部がタイムアウトした。
 * 無料の公開 RPC は続けて叩くと締め出され、しかもエラーではなく空を返す。
 *
 * 写しは scripts/build-snapshot.mjs が作る。Aquarius との違いは、
 * **誰かが動かし続けるサーバではなく、チェーンから何度でも作り直せる静的ファイル**
 * であること。写しが古くなってもチェーン側の記録は失われない。
 */
const snapshotByNft = new Map(
  (snapshot.assets as {
    nft: string; encrypted: boolean; ddo: Ddo | null; ddoBytes: number;
    usage?: { orders: number; consumers: number } | null;
  }[])
    .map((a) => [a.nft.toLowerCase(), a])
);

type RegistryEntry = (typeof registry.assets)[number];

/** 1 件ぶんを組み立てる。DDO の読み取りは 1 回だけ */
/**
 * 帖ツリーの root。**チェーンに刻まれたもののうち、いちばん新しいものを採る。**
 *
 * 素材の版が変わるたびに、同じ CorpusAnchor へ追記していく。だから 54 葉の
 * root は 1 つとは限らない（いまは 2 つある。巻名の漢字表記を TEI に足す前と後）。
 *
 * 最初に見つかったものを採っていたので、**古い版の root を出していた**。
 * 前の記録が残ることは仕組みとして正しいので、消すのではなく選び方を直す。
 * ブロック番号の大きいものが新しい。
 *
 * 行ツリー (25,065 葉) の root は、版が変わっても同じ値のまま刻まれている。
 * ヘッダを触っても seg には届かないため。
 */
const latestChapterRoot = (snapshot.anchoredRoots ?? [])
  .filter((r) => r.treeSize === 54)
  .sort((a, b) => b.block - a.block)[0]?.root ?? null;

/**
 * 索引側の控え。**チェーンから外した値をここから拾う。**
 *
 * lines / bytes / leafHash は本文があれば計算できるので DDO から外した
 * (genji-witness の scripts/19-reattribute.mjs)。だが一覧に「328 行」と
 * 出すために毎回 77 KB を取りに行くのは無駄なので、ビルド時に数えてある。
 *
 * **ここを信じる必要はない。** 検証する人は本文から作り直せる。
 * これは速く出すための控えであって、根拠ではない。
 */
const facetOf = (slug: string) =>
  (teiFacets.volumes as Record<string, {
    waka: number; lines: number; bytes: number; leafHash: string;
  }>)[slug] ?? null;

function toAsset(a: RegistryEntry): Asset {
  const res = snapshotByNft.get(a.nft.toLowerCase()) ?? null;
  const ai = (res?.ddo?.metadata?.additionalInformation ?? {}) as Record<string, unknown>;
  const tei = facetOf(a.slug);
  /**
   * 帖ツリーの root。**DDO ではなく CorpusAnchor から読む。**
   * 以前は帖ごとの DDO が写しを持っていたが、写しが 2 つあると
   * 片方だけ古くなっても気づけない。出どころは 1 か所にする。
   */
  const chapterRoot = latestChapterRoot ?? (ai.chapterRoot as string) ?? null;
  return {
    slug: a.slug,
    nft: a.nft as `0x${string}`,
    datatoken: a.datatoken as `0x${string}`,
    did: a.did,
    name: res?.ddo?.metadata?.name ?? a.label.ja,
    description: res?.ddo?.metadata?.description ?? null,
    author: res?.ddo?.metadata?.author ?? null,
    created: res?.ddo?.metadata?.created ?? null,
    updated: res?.ddo?.metadata?.updated ?? null,
    tags: res?.ddo?.metadata?.tags ?? [],
    volumeNumber: (ai.volumeNumber as number) ?? null,
    /**
     * 巻名。DDO からは外した (name の「校異源氏物語 きりつぼ（第1帖）」に入っている)。
     * registry の label はデータ側が日英で持っているので、こちらは出し分けてよい。
     */
    /**
     * 巻名だけ。**「（第1帖）」は落とす。**
     * カードには既に「帖」の札と「KG01」が出ているので、題に巻次を重ねると
     * 3 か所で同じことを言うことになる。registry の label は
     * 「きりつぼ（第1帖）」の形なので、括弧書きを取る。
     */
    volumeTitle: (ai.volumeTitle as string)
      ?? (a.slug === 'all' ? null : a.label.ja.replace(/（第\d+帖）$/, '')),
    /**
     * 行数。**全体版だけ名前が違う。**
     * 帖の DDO は additionalInformation.lines を持つが、全 54 帖まとめた
     * DDO はそれを持たず、行ツリーの葉の数 itemTreeSize (25,065) に入っている。
     * 素直に lines だけ見ていたので、全体版が「0 行」と表示されていた。
     */
    lines: (ai.lines as number) ?? tei?.lines ?? (ai.itemTreeSize as number)
      ?? (a.slug === 'all' ? teiFacets.totals.lines : null),
    bytes: (ai.bytes as number) ?? tei?.bytes
      ?? (a.slug === 'all' ? teiFacets.totals.bytes : null),
    // 帖ごとの値。全体版 (slug='all') は合計を持つ
    waka: a.slug === 'all' ? teiFacets.totals.waka : tei?.waka ?? null,
    license: res?.ddo?.metadata?.license ?? 'CC0-1.0',
    // datatoken の記号 (KG05 など)。Ocean のカードは右上に出す
    symbol: (ai.volumeNumber as number)
      ? `KG${String(ai.volumeNumber).padStart(2, '0')}` : 'KGACCESS',
    ipfsCid: (ai.ipfsCid as string) ?? a.ipfsCid,
    encrypted: res?.encrypted ?? false,
    ddoBytes: res?.ddoBytes ?? 0,
    proof: ai.inclusionProof
  ? {
      leafHash: (ai.leafHash as string) ?? tei?.leafHash ?? '',
      leafIndex: ai.leafIndex as number,
      treeSize: ai.treeSize as number,
      inclusionProof: ai.inclusionProof as string[],
      chapterRoot: chapterRoot ?? '',
      corpusAnchor: ai.corpusAnchor as string,
      corpusAnchorFromBlock: (ai.corpusAnchorFromBlock as number) ?? null,
    }
  : null,
    fromBlock: a.fromBlock,
    usage: res?.usage ?? null,
  } satisfies Asset;
}

/** 一覧。registry に載っているアドレスだけを引く（全体を舐めない） */
export function listAssets(): Asset[] {
  return registry.assets
    .map(toAsset)
    .sort((x, y) => (x.volumeNumber ?? 999) - (y.volumeNumber ?? 999));
}

/**
 * 帖だけの一覧（54 件）。**全体版を混ぜない。**
 *
 * registry には 55 件あり、うち 1 件は 54 帖をまとめた「全体版」(slug: all)。
 * これを帖のカードと同じ列に並べると、桐壺・帚木…と続いた最後に
 * 56 件目のような顔で出てきて、第 55 帖があるように見える。
 * 粒度が違うものなので、一覧からは外して別の入口にしてある
 * （トップの「まとめて 1 件で扱う」と、一覧の下の案内から辿れる）。
 */
export function listVolumes(): Asset[] {
  return listAssets().filter((a) => a.volumeNumber != null);
}

/** 全 54 帖をまとめた 1 件。無ければ null */
export function getWhole(): Asset | null {
  return listAssets().find((a) => a.volumeNumber == null) ?? null;
}

/**
 * 1 件だけ取る。**一覧を作ってから探すことをしない。**
 * 55 ページ × 55 件 = 3,025 回の RPC になり、ビルドがタイムアウトした。
 * registry から該当の 1 件を選び、その DDO だけ読む。
 */
export function getAsset(slug: string): Asset | null {
  const entry = registry.assets.find((a) => a.slug === slug);
  return entry ? toAsset(entry) : null;
}

/**
 * 参照回数。**datatoken の残高ではなく、注文のログを数える。**
 * datatoken は注文と同じ取引でバーンされるので、残高は常に 0。
 * 数えているのは所有ではなく利用の回数である。
 */
export async function countOrders(datatoken: `0x${string}`, fromBlock: number) {
  const latest = await publicClient.getBlockNumber();
  const from = BigInt(fromBlock);
  const logs = await publicClient.getLogs({
    address: datatoken,
    event: ORDER_EVENT,
    fromBlock: from,
    toBlock: from + MAX_RANGE > latest ? latest : from + MAX_RANGE,
  });
  const consumers = new Set(
    logs.map((l) => ((l.args as { consumer?: string }).consumer ?? '').toLowerCase())
  );
  return {
    orders: logs.length,
    consumers: consumers.size,
    records: logs.map((l) => ({
      consumer: (l.args as { consumer?: string }).consumer ?? '',
      block: Number(l.blockNumber),
      tx: l.transactionHash,
    })),
  };
}

/**
 * root がチェーンに記録されているか。誰が記録したかも数える。
 *
 * **toBlock は必ず今のブロックで頭打ちにする。** ここは
 * `fromBlock + MAX_RANGE` をそのまま渡していて、その値がまだ存在しない
 * ブロック番号だったため、publicnode が `Invalid params` を返していた。
 * 呼び出し側が `.catch(() => 0 件)` で握りつぶしていたので、
 * 詳細ページに「記録 0 件 / 記録した人 0 人」と出ていた。
 * **実際にはチェーン上に 2 件・1 人ある**（生の eth_getLogs で確認）。
 * countOrders は最初からこの頭打ちをしていた。同じ形に揃える。
 */
export async function readAnchors(root: string, contract: string, fromBlock: number) {
  const latest = await publicClient.getBlockNumber();
  const from = BigInt(fromBlock);
  const logs = await publicClient.getLogs({
    address: contract as `0x${string}`,
    event: CORPUS_ANCHORED_EVENT,
    args: { root: root as `0x${string}` },
    fromBlock: from,
    toBlock: from + MAX_RANGE > latest ? latest : from + MAX_RANGE,
  });
  const observers = new Set(
    logs.map((l) => ((l.args as { observer?: string }).observer ?? '').toLowerCase())
  );
  return {
    records: logs.map((l) => ({
      observer: (l.args as { observer?: string }).observer ?? '',
      sourceUri: (l.args as { sourceUri?: string }).sourceUri ?? '',
      block: Number(l.blockNumber),
      tx: l.transactionHash,
    })),
    observers: observers.size,
  };
}

export { registry, snapshot };
