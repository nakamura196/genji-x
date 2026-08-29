/**
 * ビルド前に **1 回だけ**チェーンを読み、メタデータの写しを作る。
 *
 *   node scripts/build-snapshot.mjs      (npm run build が prebuild で自動実行)
 *
 * ── なぜ写しを作るのか ──────────────────────────────────────────
 * 最初はページごとにチェーンを読んでいた。120 ページが 9 並列で同じ公開 RPC を
 * 叩き、**ビルドが 2 分近くかかって一部がタイムアウトした**。
 * 無料の公開 RPC は続けて叩くと締め出され、しかもエラーではなく空を返す。
 *
 * ここで読むのは 55 件ぶん 1 回だけ。あとはページがこの JSON を読む。
 *
 * ── 「索引サーバを使わない」と矛盾しないか ──────────────────────
 * しない。Aquarius との違いは 2 つある。
 *
 *   Aquarius   誰かが動かし続けるサーバ。落ちるとカタログが 0 件になる (実際なった)
 *   この写し    ビルド時に作る静的ファイル。**チェーンから何度でも作り直せる**
 *
 * 写しが古くなっても、チェーン側の記録は失われない。読者が自分で検証するときは
 * この写しを経由せず、ブラウザから直接 IPFS とチェーンに当たる。
 *
 * ── 参照回数はここに入れない ────────────────────────────────────
 * 回数は増えるので、写しに焼き込むと古くなる。**クライアント側で live に取る**。
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

/**
 * OrderStarted。topics[1] が利用者。
 * **注意**: 送信者と利用者は別にできる（実測済み）。誰でも他人を利用者として
 * 記録できるので、「本人が申告した」ことを示すには tx.from と突き合わせる必要がある。
 */
const ORDER_TOPIC = '0xe1c4fa794edfa8f619b8257a077398950357b9c6398528f94480307352f9afcc';

/** CorpusAnchor が出すイベント。root の出どころはここ 1 か所 */
const CORPUS_ANCHORED_EVENT = {
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
};

/**
 * **更新は別のイベントで出る。**
 *
 * 最初に載せるときは `MetadataCreated`、書き直すときは `MetadataUpdated`。
 * MetadataCreated だけを読んでいたため、**55 件を書き直した直後に
 * スナップショットを作り直しても、古い（氏名入りの）DDO が返ってきた**。
 * 送信は成功していたのに「変わっていない」ように見えた。
 *
 * 引数の形は 2 つとも同じなので、同じ ABI を名前だけ変えて使う。
 */
const METADATA_UPDATED_EVENT = {
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
};

const METADATA_EVENT = {
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
};

const MAX_RANGE = 49_000n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 締め出しを避けるため、少しずつ順番に読む */
async function readOne(a, latest) {
  const from = BigInt(a.fromBlock);
  const to = from + MAX_RANGE > latest ? latest : from + MAX_RANGE;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      /**
       * 作成と更新の両方を読み、**いちばん新しいものを採る**。
       * viem の getLogs はイベントごとにしか引けないので 2 回引いて並べ直す。
       */
      const [created, updated] = await Promise.all([
        client.getLogs({ address: a.nft, event: METADATA_EVENT, fromBlock: from, toBlock: to }),
        client.getLogs({ address: a.nft, event: METADATA_UPDATED_EVENT, fromBlock: from, toBlock: to }),
      ]);
      const logs = [...created, ...updated].sort((x, y) =>
        x.blockNumber === y.blockNumber
          ? Number(x.logIndex) - Number(y.logIndex)
          : Number(x.blockNumber - y.blockNumber));
      if (!logs.length) throw new Error('メタデータのログが 0 件');
      const last = logs[logs.length - 1];
      const flags = last.args.flags;
      const encrypted = flags.length >= 4 && (parseInt(flags.slice(2, 4), 16) & 2) !== 0;
      const bytes = (last.args.data.length - 2) / 2;
      if (encrypted) return { ...a, encrypted: true, ddo: null, ddoBytes: bytes };
      const ddo = JSON.parse(Buffer.from(last.args.data.slice(2), 'hex').toString('utf8'));
      return { ...a, encrypted: false, ddo, ddoBytes: bytes,
        /** どの記録を読んだか。作成のままなのか書き直し後なのかが画面から分かる */
        ddoFrom: { event: last.eventName, block: Number(last.blockNumber),
          revisions: logs.length, tx: last.transactionHash } };
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(1500 * (attempt + 1));   // 締め出されたら間を空けて再試行
    }
  }
}

/**
 * 参照回数を数える。**1 アドレスずつ**。
 *
 * 最初は 55 件をアドレスの配列で 1 回にまとめていた。以前は 100 件まで通ったが、
 * 2026-08-26 時点の publicnode は **2 件以上を「Request blocked」で拒否する**。
 * ブラウザから毎回数える設計だと、訪問者ごとに 55 回叩くことになって成り立たない。
 *
 * そこでここで（ビルド時・定期実行時）に 1 回だけ数え、写しに入れる。
 * 詳細ページでは、その 1 件だけをブラウザが数え直す（1 アドレスなら通る）。
 */
async function countOrders(datatoken, fromBlock, latest) {
  let orders = 0;
  const consumers = new Set();
  for (let b = BigInt(fromBlock); b <= latest; b += MAX_RANGE) {
    const to = b + MAX_RANGE > latest ? latest : b + MAX_RANGE;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        /**
         * **生の RPC を使う。** viem の getLogs に topics をそのまま渡しても
         * 絞り込みが効かず、datatoken が発行時に出す 7 種類のイベント
         * (Transfer / AddedMinter / NewPaymentCollector など計 10 件) まで
         * 数えてしまった。どの帖も同じ「5 件」になったのが手がかりだった。
         * 生の RPC なら 1 件（実際の注文数）が返る。
         */
        const logs = await client.request({
          method: 'eth_getLogs',
          params: [{
            address: datatoken,
            fromBlock: '0x' + b.toString(16),
            toBlock: '0x' + to.toString(16),
            topics: [ORDER_TOPIC],
          }],
        });
        for (const l of logs) {
          orders++;
          if (l.topics[1]) consumers.add('0x' + l.topics[1].slice(26).toLowerCase());
        }
        break;
      } catch (e) {
        if (attempt === 2) throw e;
        await sleep(1200 * (attempt + 1));
      }
    }
  }
  return { orders, consumers: consumers.size };
}

const latest = await client.getBlockNumber();
console.log(`チェーンから ${registry.assets.length} 件のメタデータを読みます (block ${latest})`);
const out = [];
for (const [i, a] of registry.assets.entries()) {
  const got = await readOne(a, latest);
  // 参照回数も同じ流れで数える（1 アドレスずつ）
  try {
    got.usage = await countOrders(a.datatoken, registry.corpusAnchorFromBlock, latest);
  } catch {
    got.usage = null;   // 数えられなくても写し自体は作る
  }
  out.push(got);
  if ((i + 1) % 10 === 0 || i === registry.assets.length - 1) {
    process.stdout.write(`\r  ${i + 1}/${registry.assets.length}`);
  }
  await sleep(150);
}
console.log('');

/**
 * **CorpusAnchor に記録された root を読む。**
 *
 * 以前は帖ごとの DDO が chapterRoot を持っていたが、それは
 * **チェーンの別の場所にある値の写し**だった。DDO から外したので
 * （scripts/19-reattribute.mjs）、ここで出どころから直接読む。
 * 写しが 2 つあると、片方だけ古くなっても気づけない。
 */
/**
 * **前回の写しを土台にする。**
 *
 * 公開 RPC は締め出すとき、エラーではなく**空を返す**。実際に、
 * root が 3 件から 2 件に減った写しを書いてしまったことがある。
 * チェーンの履歴は増えるだけなので、**前にあった root が今回見つからないのは
 * 「消えた」ではなく「読めなかった」**。前回の分と足し合わせ、減っていたら声を上げる。
 *
 * なお root が 3 件なのは正しい。記録は 6 回あるが、
 * **同じ root を 3 回記録している**ので、値としては
 * 帖の木 2 種類 + 行の木 1 種類 = 3 種類になる。
 */
const OUT_PATH = path.join(ROOT, 'src/data/snapshot.json');
const prev = fs.existsSync(OUT_PATH)
  ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'))
  : { anchoredRoots: [], assets: [] };
const prevAssets = new Map((prev.assets ?? []).map((a) => [a.slug, a]));

const anchored = [];
try {
  const logs = await client.request({
    method: 'eth_getLogs',
    params: [{
      address: registry.corpusAnchor,
      fromBlock: '0x' + BigInt(registry.corpusAnchorFromBlock).toString(16),
      toBlock: '0x' + latest.toString(16),
    }],
  });
  for (const l of logs) {
    let d;
    try { d = decodeEventLog({ abi: [CORPUS_ANCHORED_EVENT], data: l.data, topics: l.topics }); }
    catch { continue; }   // 別のイベントは黙って飛ばす
    const root = d.args.root;
    if (anchored.some((a) => a.root === root)) continue;
    anchored.push({
      root,
      corpusId: d.args.corpusId,
      treeSize: Number(d.args.treeSize),
      spec: d.args.spec,
      sourceUri: d.args.sourceUri,
      block: Number(l.blockNumber),
    });
  }
  /* 読めなかった分を足し戻す。値そのものは変わらないので、古くならない */
  let restored = 0;
  for (const old of prev.anchoredRoots ?? []) {
    if (!anchored.some((a) => a.root === old.root)) { anchored.push(old); restored++; }
  }
  anchored.sort((a, b) => a.block - b.block);
  if (restored) {
    console.warn(`  ！ 前回あった root ${restored} 件が今回は読めませんでした。足し戻しています`);
    console.warn('    公開 RPC の締め出しが疑われます。時間をおくか、NEXT_PUBLIC_SEPOLIA_RPC_URL を指してください');
  }
  console.log(`  記録された root ${anchored.length} 種類 (CorpusAnchor から直接)`);
  for (const a of anchored) {
    console.log(`    ${a.root.slice(0, 18)}…  ${String(a.treeSize).padStart(6)} 葉  ${a.spec}`);
  }
} catch (e) {
  console.warn(`  ${'root の読み取りに失敗: ' + e.message}`);
}

/*
 * DDO も同じ。読めなかった帖は前回の写しを使う。
 * 空のまま書き出すと、画面から説明も葉ハッシュも消える。
 */
let keptAssets = 0;
let keptNewer = 0;
for (let i = 0; i < out.length; i++) {
  const o = out[i];
  const old = prevAssets.get(o.slug);

  // 読めなかった帖は前回の写しをそのまま使う
  if (!o.ddo && !o.encrypted) {
    if (old?.ddo) { out[i] = { ...old, usage: o.usage ?? old.usage }; keptAssets++; }
    continue;
  }

  /*
   * **古い版に化けていないか見る。**
   * ログが一部しか返らないと、書き直しを見落として作成時の DDO を採ってしまう。
   * 作成時の DDO には氏名が入っているので、これは黙って起きると
   * 「消したはずの氏名が写しに戻る」ことになる (実際に 18 帖で起きた)。
   * 前回より古いものを読んだときは、前回のほうを採る。
   */
  if (old?.ddoFrom && o.ddoFrom && old.ddoFrom.block > o.ddoFrom.block) {
    out[i] = { ...old, usage: o.usage ?? old.usage };
    keptNewer++;
  }
}
if (keptAssets) console.warn(`  ！ ${keptAssets} 帖は今回読めませんでした。前回の写しを使っています`);
if (keptNewer) {
  console.warn(`  ！ ${keptNewer} 帖で、前回より古い記録しか読めませんでした。前回のほうを使っています`);
  console.warn('    ログの取りこぼしです。放っておくと、書き直す前の DDO に戻ります');
}

/*
 * **最後の関所。氏名が入っていたら書き出さない。**
 * DDO からは 55 件すべて外してある (scripts/19-reattribute.mjs)。
 * 写しに氏名が現れたら、それは古い記録を読んだということなので、
 * ここで止める。配布の workflow にも同じ点検があるが、手元でも止める。
 */
const named = out.filter((o) => /中村|Nakamura/.test(JSON.stringify(o.ddo ?? {})));
if (named.length) {
  console.error(`  ！ ${named.length} 帖の DDO に氏名が入っています: ${named.map((o) => o.slug).join(', ')}`);
  console.error('    書き直す前の記録を読んでいます。時間をおいて実行し直してください');
  process.exit(1);
}

const encrypted = out.filter((o) => o.encrypted).length;
const withProof = out.filter((o) => o.ddo?.metadata?.additionalInformation?.inclusionProof).length;
console.log(`  暗号化なし ${out.length - encrypted} / 暗号化あり ${encrypted}`);
console.log(`  包含証明つき ${withProof}`);
const totalOrders = out.reduce((n, o) => n + (o.usage?.orders ?? 0), 0);
const counted = out.filter((o) => o.usage).length;
console.log(`  参照回数     合計 ${totalOrders} 回 (${counted}/${out.length} 件を数えられた)`);

fs.writeFileSync(
  path.join(ROOT, 'src/data/snapshot.json'),
  JSON.stringify({
    $comment: 'チェーンから読んだメタデータの写し。scripts/build-snapshot.mjs が作る。'
      + ' 索引サーバではなく、何度でも作り直せる静的ファイル。参照回数はここに入れない (増えるので)。',
    generatedAt: new Date().toISOString(),
    atBlock: Number(latest),
    rpc: RPC,
    /** CorpusAnchor に記録された値。DDO の写しではなく、出どころから読んだもの */
    anchoredRoots: anchored,
    assets: out,
  }, null, 2) + '\n'
);
console.log(`  書き出し src/data/snapshot.json`);
