/**
 * カタログが指すコントラクトの「事実」を集める。**ビルド時に 1 回だけ。**
 *
 *   node scripts/build-contracts.mjs
 *
 * ── なぜ集めるのか ──────────────────────────────────────────────
 * Etherscan は汎用なので、名前と中身がずれたまま表示される。実際につまずいた:
 *   DispenserCreated  何も作られていない (共有の Dispenser への登録)
 *   1 of ○○           個数ではなく背番号
 *   Holders が空       壊れていない。datatoken が同じ取引でバーンされる設計だから
 *
 * そこで、生の値へ直接飛ばす前に「これは何か」を説明するページを挟む。
 * そのページに出す事実をここで集める。
 *
 * ── 集めるもの ──────────────────────────────────────────────────
 *   コードの大きさ    45 バイトなら最小プロキシ (本体は共有)
 *   委譲先           EIP-1167 の中に埋まっている 20 バイト
 *   name / symbol    コントラクト自身の申告 (チェーンが保証した事実ではない)
 *   ownerOf(1)       data NFT の「公開者の役」を誰が持っているか
 *   totalSupply/cap  datatoken の発行の状況
 */
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/registry.json'), 'utf8'));

const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL
    || 'https://ethereum-sepolia-rpc.publicnode.com', { batch: true, retryCount: 3 }),
});

/** Ocean が Sepolia に置いた共有のもの。誰の持ち物でもなく、全員で使う */
const SHARED = {
  '0xEF62FB495266C72a5212A11Dce8baa79Ec0ABeB1': 'factory',
  '0x2720d405ef7cDC8a2E2e5AeBC8883C99611d893C': 'dispenser',
  '0x9C9eE07b8Ce907D2f9244F8317C1Ed29A3193bAe': 'nftTemplate',
  '0xDEfD0018969cd2d4E648209F876ADe184815f038': 'dtTemplate',
  '0x69B6E54Ad2b3c2801d11d8Ad56ea1d892555b776': 'feeCollector',
};

const ERC721 = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'ownerOf', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
];
const ERC20 = [
  ...ERC721.filter((f) => f.name !== 'ownerOf'),
  { type: 'function', name: 'cap', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
];

/** EIP-1167 の最小プロキシから委譲先を取り出す */
function proxyTarget(code) {
  const m = code.match(/363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3/i);
  return m ? `0x${m[1]}` : null;
}

const call = async (address, abi, functionName, args) => {
  try { return await client.readContract({ address, abi, functionName, args }); }
  catch { return null; }
};

const targets = [];
for (const a of registry.assets) {
  targets.push({ address: a.nft, kind: 'dataNft', slug: a.slug });
  targets.push({ address: a.datatoken, kind: 'datatoken', slug: a.slug });
}
targets.push({ address: registry.corpusAnchor, kind: 'corpusAnchor' });
for (const [address, kind] of Object.entries(SHARED)) targets.push({ address, kind: 'shared', shared: kind });

console.log(`${targets.length} 件のコントラクトを調べます`);
const out = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [i, t] of targets.entries()) {
  const code = await client.getCode({ address: t.address }).catch(() => '0x');
  const size = code && code !== '0x' ? (code.length - 2) / 2 : 0;
  const entry = {
    address: t.address, kind: t.kind, slug: t.slug ?? null, shared: t.shared ?? null,
    codeBytes: size, proxyTarget: code ? proxyTarget(code) : null,
  };
  if (t.kind === 'dataNft') {
    entry.name = await call(t.address, ERC721, 'name');
    entry.symbol = await call(t.address, ERC721, 'symbol');
    const supply = await call(t.address, ERC721, 'totalSupply');
    entry.totalSupply = supply != null ? Number(supply) : null;
    const owner = await call(t.address, ERC721, 'ownerOf', [1n]);
    entry.owner = owner ?? null;
  } else if (t.kind === 'datatoken') {
    entry.name = await call(t.address, ERC20, 'name');
    entry.symbol = await call(t.address, ERC20, 'symbol');
    const supply = await call(t.address, ERC20, 'totalSupply');
    entry.totalSupply = supply != null ? supply.toString() : null;
    const cap = await call(t.address, ERC20, 'cap');
    entry.cap = cap != null ? (cap / 10n ** 18n).toString() : null;
    const d = await call(t.address, ERC20, 'decimals');
    entry.decimals = d != null ? Number(d) : null;
  }
  out[t.address.toLowerCase()] = entry;
  if ((i + 1) % 20 === 0 || i === targets.length - 1) process.stdout.write(`\r  ${i + 1}/${targets.length}`);
  await sleep(60);
}
console.log('');

const proxies = Object.values(out).filter((o) => o.proxyTarget).length;
const shared = Object.values(out).filter((o) => o.kind === 'shared').length;
console.log(`  最小プロキシ ${proxies} 件 (本体は共有)`);
console.log(`  共有のもの   ${shared} 件`);

fs.writeFileSync(path.join(ROOT, 'src/data/contracts.json'),
  JSON.stringify({
    $comment: 'カタログが指すコントラクトの事実。scripts/build-contracts.mjs が集める。'
      + ' name / symbol はコントラクト自身の申告であって、チェーンが保証した事実ではない。',
    generatedAt: new Date().toISOString(),
    contracts: out,
  }, null, 2) + '\n');
console.log('  書き出し src/data/contracts.json');
