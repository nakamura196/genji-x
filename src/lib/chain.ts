/**
 * チェーンへの入口。**索引サーバを一切使わない。**
 *
 * Ocean Market と Pontus-X portal は Aquarius (索引サーバ) から読む。
 * その索引サーバが 503 を返して Market が 0 件になったのが、この試作の出発点だった。
 * ここでは公開 RPC に直接問い合わせる。落ちるサーバが無い。
 *
 * 読むだけならウォレットも要らない。書く (注文する) ときだけ MetaMask を使う。
 */
import { createPublicClient, http, defineChain } from 'viem';
import { sepolia } from 'viem/chains';

/** Ocean v4 が Sepolia に置いたコントラクト */
export const OCEAN = {
  ERC721Factory: '0xEF62FB495266C72a5212A11Dce8baa79Ec0ABeB1',
  Dispenser: '0x2720d405ef7cDC8a2E2e5AeBC8883C99611d893C',
  OPFCommunityFeeCollector: '0x69B6E54Ad2b3c2801d11d8Ad56ea1d892555b776',
} as const;

export const CHAIN = sepolia;
export const EXPLORER = 'https://sepolia.etherscan.io';

/**
 * 無料の公開 RPC には実測でこういう制限がある (2026-08-26)。
 *   1 回 50,000 ブロックまで / アドレス指定が必須 / 続けて叩くと締め出される
 * さらに厄介なことに、**混んでいるとエラーではなく空の結果を返す**。
 * だからこの画面は「全体を舐める」ことをせず、**アドレスが分かっているものだけ**を引く。
 */
export const RPC_URL =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL, { batch: true, retryCount: 2 }),
});

// ── ABI。使う分だけ ────────────────────────────────────────────
export const ERC721_ABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'ownerOf', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
] as const;

export const ERC20_ABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

/**
 * MetadataCreated / MetadataUpdated。indexed は createdBy だけ。
 * flags の bit 1 が立っていなければ data は平文の JSON で、**復号が要らない**。
 */
export const METADATA_EVENT = {
  type: 'event',
  name: 'MetadataCreated',
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
} as const;

/**
 * OrderStarted。実物で確かめた並び:
 *   topics[1] = 利用者 / topics[2] = 出品側の手数料の宛先
 *
 * **注意**: 送信者と利用者は別にできる (実測済み)。誰でも他人を利用者として
 * 記録できるので、「本人が申告した」ことを示すには tx.from と突き合わせる必要がある。
 */
export const ORDER_EVENT = {
  type: 'event',
  name: 'OrderStarted',
  inputs: [
    { name: 'consumer', type: 'address', indexed: true },
    { name: 'payer', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256' },
    { name: 'serviceIndex', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'publishMarketAddress', type: 'address', indexed: true },
    { name: 'blockNumber', type: 'uint256' },
  ],
} as const;

/** CorpusAnchor。root を刻むだけのコントラクト。状態変数を持たない */
export const CORPUS_ANCHORED_EVENT = {
  type: 'event',
  name: 'CorpusAnchored',
  inputs: [
    { name: 'corpusId', type: 'bytes32', indexed: true },
    { name: 'root', type: 'bytes32', indexed: true },
    { name: 'observer', type: 'address', indexed: true },
    { name: 'capturedAt', type: 'uint64' },
    { name: 'treeSize', type: 'uint32' },
    { name: 'sourceUri', type: 'string' },
    { name: 'spec', type: 'string' },
  ],
} as const;

/** buyFromDispenserAndOrder。MetaMask から呼ぶ */
export const ORDER_ABI = [
  {
    type: 'function',
    name: 'buyFromDispenserAndOrder',
    stateMutability: 'nonpayable',
    outputs: [],
    inputs: [
      {
        name: '_orderParams',
        type: 'tuple',
        components: [
          { name: 'consumer', type: 'address' },
          { name: 'serviceIndex', type: 'uint256' },
          {
            name: '_providerFee',
            type: 'tuple',
            components: [
              { name: 'providerFeeAddress', type: 'address' },
              { name: 'providerFeeToken', type: 'address' },
              { name: 'providerFeeAmount', type: 'uint256' },
              { name: 'v', type: 'uint8' },
              { name: 'r', type: 'bytes32' },
              { name: 's', type: 'bytes32' },
              { name: 'validUntil', type: 'uint256' },
              { name: 'providerData', type: 'bytes' },
            ],
          },
          {
            name: '_consumeMarketFee',
            type: 'tuple',
            components: [
              { name: 'consumeMarketFeeAddress', type: 'address' },
              { name: 'consumeMarketFeeToken', type: 'address' },
              { name: 'consumeMarketFeeAmount', type: 'uint256' },
            ],
          },
        ],
      },
      { name: 'dispenserContract', type: 'address' },
    ],
  },
] as const;

const ZERO = '0x0000000000000000000000000000000000000000' as const;
const ZERO32 = `0x${'0'.repeat(64)}` as const;

/**
 * 注文の引数。**手数料をすべて 0 にする**のが要点。
 *
 * `_checkProviderFee` は手数料が 0 でも必ず ecrecover を呼ぶ。ただし v が 27/28 で
 * ないとき ecrecover は 0x0 を返し、providerFeeAddress も 0x0 なので等しくなって
 * 検査を通る。つまり **Ocean のノードが 1 台も動いていなくても注文できる**。
 * 有料にした瞬間、ノードの署名が必須になる。
 */
export const freeOrderParams = (consumer: `0x${string}`) =>
  [
    {
      consumer,
      serviceIndex: 0n,
      _providerFee: {
        providerFeeAddress: ZERO,
        providerFeeToken: ZERO,
        providerFeeAmount: 0n,
        v: 0,
        r: ZERO32,
        s: ZERO32,
        validUntil: 0n,
        providerData: '0x' as const,
      },
      _consumeMarketFee: {
        consumeMarketFeeAddress: ZERO,
        consumeMarketFeeToken: ZERO,
        consumeMarketFeeAmount: 0n,
      },
    },
    OCEAN.Dispenser,
  ] as const;
