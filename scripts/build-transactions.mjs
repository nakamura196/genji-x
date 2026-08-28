/**
 * この資料に関わる取引を集める。**ビルド時に 1 回だけ。**
 *
 *   node scripts/build-transactions.mjs
 *
 * ── なぜ集めるのか ──────────────────────────────────────────────
 * Etherscan の取引画面は、この資料の文脈では読めない。実際につまずいたもの:
 *
 *   Value 0 ETH        「無料」ではない。資料の代金が 0 なだけで手数料は別
 *   Holders が空        壊れていない。datatoken が同じ取引でバーンされる設計だから
 *   ProviderFee 全部 0  たまたまではない。**これが効いて配信業者が要らない**
 *   Internal Txns 15    お金は 1 円も動いていない
 *   OrderStarted の添字  2 つ目は payer ではなく publishMarketAddress
 *
 * どれも「知っていれば読める」類で、知らないと誤読する。
 * **勝てるのは文脈だけ**なので、汎用の探索機を作り直すのではなく、
 * この 55 件に関わる取引だけを、意味の分かる形で出す。
 *
 * ── 集める範囲 ──────────────────────────────────────────────────
 *   参照の記録   OrderStarted。「誰がいつどの版を参照したか」
 *   root の記録  CorpusAnchored。資料のハッシュを記録したもの
 *   メタデータ    MetadataCreated / MetadataUpdated。DDO を載せた/書き直した
 *
 * 任意のアドレスの検索や残高の一覧はやらない。無理に広げると
 * 「劣化した Etherscan」になる。
 */
import { createPublicClient, http, decodeEventLog } from 'viem';
import { sepolia } from 'viem/chains';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/registry.json'), 'utf8'));

const RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL
  || 'https://ethereum-sepolia-rpc.publicnode.com';
const client = createPublicClient({ chain: sepolia, transport: http(RPC, { retryCount: 3 }) });

/** 無料 RPC の上限 (実測)。1 回の eth_getLogs で 50,000 ブロックまで */
const MAX_RANGE = 49_000n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TOPIC = {
  order:    '0xe1c4fa794edfa8f619b8257a077398950357b9c6398528f94480307352f9afcc',
  anchored: '0x8f7e4d4b3e2d2b5f9b6f0e2c9b1a0f7d4e8c3a6b5d2f1e0c9a8b7d6e5f4c3b2a',
  transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
};

/**
 * CorpusAnchored の topic0 は abi から作る（手で書くと間違える）。
 * 実際、上の定数を手書きしていて別のイベントを拾っていたことがある。
 */
import { keccak256, toHex } from 'viem';
TOPIC.anchored = keccak256(toHex(
  'CorpusAnchored(bytes32,bytes32,address,uint64,uint32,string,string)'));
/*
 * 説明書き (DDO) の記録。最初に載せるときと書き直すときで**別のイベント**が出る。
 * **metaDataHash は bytes ではなく bytes32。** ここを間違えると署名が変わり、
 * topic0 が一致せず 1 件も取れない (実際に 0 件で返ってきて気づいた)。
 */
const META_ARGS = '(address,uint8,string,bytes,bytes,bytes32,uint256,uint256)';
TOPIC.metaCreated = keccak256(toHex('MetadataCreated' + META_ARGS));
TOPIC.metaUpdated = keccak256(toHex('MetadataUpdated' + META_ARGS));

const EV = {
  order: {
    type: 'event', name: 'OrderStarted',
    inputs: [
      { name: 'consumer', type: 'address', indexed: true },
      { name: 'payer', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'serviceIndex', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'publishMarketAddress', type: 'address', indexed: true },
      { name: 'blockNumber', type: 'uint256' },
    ],
  },
  metaCreated: {
    type: 'event', name: 'MetadataCreated',
    inputs: [
      { name: 'createdBy', type: 'address', indexed: true },
      { name: 'state', type: 'uint8' },
      { name: 'decryptorUrl', type: 'string' },
      { name: 'flags', type: 'bytes' },
      { name: 'data', type: 'bytes' },
      { name: 'metaDataHash', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'blockNumber', type: 'uint256' },
    ],
  },
  metaUpdated: {
    type: 'event', name: 'MetadataUpdated',
    inputs: [
      { name: 'updatedBy', type: 'address', indexed: true },
      { name: 'state', type: 'uint8' },
      { name: 'decryptorUrl', type: 'string' },
      { name: 'flags', type: 'bytes' },
      { name: 'data', type: 'bytes' },
      { name: 'metaDataHash', type: 'bytes32' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'blockNumber', type: 'uint256' },
    ],
  },
  anchored: {
    type: 'event', name: 'CorpusAnchored',
    inputs: [
      { name: 'corpusId', type: 'bytes32', indexed: true },
      { name: 'root', type: 'bytes32', indexed: true },
      { name: 'observer', type: 'address', indexed: true },
      { name: 'capturedAt', type: 'uint64' },
      { name: 'treeSize', type: 'uint32' },
      { name: 'sourceUri', type: 'string' },
      { name: 'spec', type: 'string' },
    ],
  },
};

/** 範囲を割って読む。公開 RPC は一度に 50,000 ブロックまで */
/**
 * **アドレスは 8 件までまとめて渡せる。**
 *
 * ここには「publicnode はまとめ読みを拒否する」と書いてあったが、**誤り**だった。
 * 測り直すと 8 件までは通り、15 件で Invalid parameters になる
 * (2026-08-27 実測。UsageCounts.tsx が「9 件が上限」と測っていたのと合う)。
 *
 * 1 アドレスずつ引いていたので、55 帖 × 3 種類で 165 回叩いていた。
 * その結果、**締め出されて空が返り、取引を取りこぼした**
 * (参照 2 → 1 件、root 6 → 2 件)。まとめれば 22 回で済む。
 */
const ADDRESS_CHUNK = 8;

async function logsOf(address, topic0, fromBlock, latest) {
  const out = [];
  for (let b = BigInt(fromBlock); b <= latest; b += MAX_RANGE) {
    const to = b + MAX_RANGE > latest ? latest : b + MAX_RANGE;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const got = await client.request({
          method: 'eth_getLogs',
          params: [{
            address,
            fromBlock: '0x' + b.toString(16),
            toBlock: '0x' + to.toString(16),
            ...(topic0 ? { topics: [topic0] } : {}),
          }],
        });
        out.push(...got);
        break;
      } catch (e) {
        if (attempt === 2) throw e;
        await sleep(1200 * (attempt + 1));
      }
    }
    /* 締め出されると空が返る。急がない。実測で 120ms は足りなかった */
    await sleep(400);
  }
  return out;
}

/**
 * **前回の結果を読んでおく。**
 *
 * 公開 RPC は締め出すとき、エラーではなく**空を返す**。
 * 実際に、説明書きの記録を足した回に取りこぼしが起きた
 * (参照 2 → 1 件、root 6 → 2 件)。エラーが出ないので気づかないまま
 * 悪くなったファイルを書いてしまった。
 *
 * **チェーンの履歴は増えるだけで、消えることはない。**
 * 前にあった取引が今回見つからないのは、消えたのではなく読めなかったということ。
 * だから前回の分と足し合わせ、減っていたら声を上げる。
 */
const OUT = path.join(ROOT, 'src/data/transactions.json');
const prev = new Map(
  (fs.existsSync(OUT)
    ? JSON.parse(fs.readFileSync(OUT, 'utf8')).transactions ?? []
    : []
  ).map((t) => [t.hash, t])
);
if (prev.size) console.log(`前回の ${prev.size} 件を土台にします`);

const latest = await client.getBlockNumber();
const from = registry.corpusAnchorFromBlock;
console.log(`取引を集めます (block ${from} → ${latest})`);

/** hash → 取引 1 件。同じ取引に複数の記録が入ることがあるので、まとめる */
const found = new Map();
const add = (hash, kind, detail) => {
  const t = found.get(hash) ?? { hash, kinds: [], details: [] };
  if (!t.kinds.includes(kind)) t.kinds.push(kind);
  t.details.push(detail);
  found.set(hash, t);
};

// ── 参照の記録 ──────────────────────────────────────────────────
// 8 アドレスずつまとめて読む (上限の測り直しは logsOf のコメントに書いた)
const bySlug = new Map(registry.assets.map((a) => [a.datatoken.toLowerCase(), a]));
for (let i = 0; i < registry.assets.length; i += ADDRESS_CHUNK) {
  const chunk = registry.assets.slice(i, i + ADDRESS_CHUNK);
  const got = await logsOf(chunk.map((a) => a.datatoken), TOPIC.order, from, latest);
  for (const l of got) {
    const a = bySlug.get(l.address.toLowerCase());
    if (!a) continue;
    const d = decodeEventLog({ abi: [EV.order], data: l.data, topics: l.topics });
    add(l.transactionHash, 'order', {
      slug: a.slug,
      datatoken: a.datatoken,
      consumer: d.args.consumer,
      payer: d.args.payer,
      serviceIndex: Number(d.args.serviceIndex),
      publishMarket: d.args.publishMarketAddress,
    });
  }
  process.stdout.write(`  参照 ${Math.min(i + ADDRESS_CHUNK, registry.assets.length)}/${registry.assets.length}\r`);
}
console.log(`  参照の記録   ${[...found.values()].filter(t => t.kinds.includes('order')).length} 件`);

// ── 説明書き (DDO) の記録 ───────────────────────────────────────
// **これが 55 件の書き直しに当たる。** 氏名を DDO から外した取引が、
// どの帖についても 1 件ずつ残っている。来歴としてはここがいちばん重い。
const byNft = new Map(registry.assets.map((a) => [a.nft.toLowerCase(), a]));
for (let i = 0; i < registry.assets.length; i += ADDRESS_CHUNK) {
  const chunk = registry.assets.slice(i, i + ADDRESS_CHUNK).map((x) => x.nft);
  for (const [topic, kind] of [[TOPIC.metaCreated, 'created'], [TOPIC.metaUpdated, 'updated']]) {
    const got = await logsOf(chunk, topic, from, latest);
    for (const l of got) {
      const a = byNft.get(l.address.toLowerCase());
      if (!a) continue;
      /* 引数の形は同じだが名前が違う。viem は署名で照合するので両方渡す */
      const d = decodeEventLog({
        abi: [EV.metaCreated, EV.metaUpdated], data: l.data, topics: l.topics,
      });
      add(l.transactionHash, 'metadata', {
        slug: a.slug,
        nft: a.nft,
        change: kind,
        /* 何バイト書いたか。0x を除いて 2 文字 = 1 バイト */
        ddoBytes: (d.args.data.length - 2) / 2,
        /* 0x00 は「暗号化していない」。読む側にサーバが要らない理由 */
        flags: d.args.flags,
        metaDataHash: d.args.metaDataHash,
      });
    }
  }
  process.stdout.write(`  説明書き ${Math.min(i + ADDRESS_CHUNK, registry.assets.length)}/${registry.assets.length}\r`);
}
console.log(`  説明書きの記録 ${[...found.values()].filter(t => t.kinds.includes('metadata')).length} 件`);

// ── root の記録 ─────────────────────────────────────────────────
{
  const got = await logsOf(registry.corpusAnchor, TOPIC.anchored, from, latest);
  for (const l of got) {
    let d;
    try { d = decodeEventLog({ abi: [EV.anchored], data: l.data, topics: l.topics }); }
    catch { continue; }
    add(l.transactionHash, 'anchor', {
      root: d.args.root,
      treeSize: Number(d.args.treeSize),
      spec: d.args.spec,
      sourceUri: d.args.sourceUri,
      observer: d.args.observer,
    });
  }
  console.log(`  root の記録  ${[...found.values()].filter(t => t.kinds.includes('anchor')).length} 件`);
}

// ── 中身を埋める ────────────────────────────────────────────────
console.log(`  取引 ${found.size} 件の中身を読みます`);
const txs = [];
let skipped = 0;
for (const t of found.values()) {
  /**
   * **取れないものは飛ばす。**
   * 記録 (ログ) は返ってくるのに、その取引の receipt が「まだ無い」と言われることがある。
   * 公開 RPC が複数のノードに分かれていて、こちらは追いついていない、という状態。
   * ここで落ちると 1 件のために全部が作れなくなるので、警告して次へ進む。
   */
  let tx, r, block;
  try {
    [tx, r] = await Promise.all([
      client.getTransaction({ hash: t.hash }),
      client.getTransactionReceipt({ hash: t.hash }),
    ]);
    block = await client.getBlock({ blockNumber: r.blockNumber });
  } catch (e) {
    await sleep(1500);
    try {
      [tx, r] = await Promise.all([
        client.getTransaction({ hash: t.hash }),
        client.getTransactionReceipt({ hash: t.hash }),
      ]);
      block = await client.getBlock({ blockNumber: r.blockNumber });
    } catch {
      const old = prev.get(t.hash);
      if (old) {
        /* 前に読めているなら、その中身は今も正しい。取引は書き換わらない */
        txs.push(old);
        console.warn(`  前回の分を使いました ${t.hash.slice(0, 14)}… (receipt が取れない)`);
      } else {
        console.warn(`  飛ばしました ${t.hash.slice(0, 14)}… (receipt が取れない)`);
      }
      skipped++;
      continue;
    }
  }
  txs.push({
    hash: t.hash,
    kinds: t.kinds,
    details: t.details,
    from: tx.from,
    to: tx.to,
    block: Number(r.blockNumber),
    timestamp: Number(block.timestamp),
    status: r.status,
    gasUsed: Number(r.gasUsed),
    gasLimit: Number(tx.gas),
    // 実際に払った単価。type 2 は effectiveGasPrice が入る
    gasPrice: String(r.effectiveGasPrice ?? tx.gasPrice ?? 0n),
    feeWei: String((r.effectiveGasPrice ?? tx.gasPrice ?? 0n) * r.gasUsed),
    value: String(tx.value),
    nonce: tx.nonce,
    type: tx.type,
    /** 呼んだ関数の 4 バイト。名前は画面側の表で引く */
    selector: (tx.input ?? '0x').slice(0, 10),
    /** 記録の並び。datatoken の発行からバーンまでが読める */
    logs: r.logs.map((l) => ({
      index: Number(l.logIndex),
      address: l.address,
      topic0: l.topics[0],
      topics: l.topics.slice(1),
      dataBytes: (l.data.length - 2) / 2,
      /** Transfer なら、誰から誰へ何枚か */
      transfer: l.topics[0] === TOPIC.transfer && l.topics.length === 3
        ? {
            from: '0x' + l.topics[1].slice(26),
            to: '0x' + l.topics[2].slice(26),
            value: String(BigInt(l.data || '0x0')),
          }
        : null,
    })),
  });
  await sleep(250);   /* receipt も急がない */
}
/* 今回見つからなかったものを足し戻す。読めなかっただけなので落とさない */
const seen = new Set(txs.map((t) => t.hash));
let restored = 0;
for (const [h, t] of prev) if (!seen.has(h)) { txs.push(t); restored++; }
if (restored) {
  console.warn(`  ！ 前回あった ${restored} 件が今回は読めませんでした。足し戻しています`);
  console.warn('    公開 RPC の締め出しが疑われます。NEXT_PUBLIC_SEPOLIA_RPC_URL を指すか、時間をおいて再実行してください');
}

const count = (list, k) => list.filter((t) => t.kinds.includes(k)).length;
for (const k of ['order', 'anchor', 'metadata']) {
  const now = count(txs, k), before = count([...prev.values()], k);
  if (before && now < before) {
    console.error(`  ！ ${k} が ${before} → ${now} 件に減っています`);
    process.exitCode = 1;
  }
}

txs.sort((a, b) => b.block - a.block);

fs.writeFileSync(
  path.join(ROOT, 'src/data/transactions.json'),
  JSON.stringify({
    $comment: 'この資料に関わる取引。scripts/build-transactions.mjs が'
      + ' チェーンから集める。任意の取引は扱わない',
    generatedAt: new Date().toISOString(),
    atBlock: Number(latest),
    transactions: txs,
  }, null, 2) + '\n'
);
console.log(`  書き出し src/data/transactions.json  ${txs.length} 件`
  + (skipped ? `  (${skipped} 件は receipt が取れず飛ばしました)` : ''));
