import { keccak256, toHex } from 'viem';

/**
 * イベントと関数の名前。**16 進を手で書かない。**
 *
 * ここには当てずっぽうで書いた値が 2 つ入っていた
 * (anchor を 0xd1a2d40b、setMetaData を 0x36c6dcd6 としていた。どちらも別物)。
 * 見た目では正しさが分からないので、間違いに気づけなかった。
 *
 * **署名の文字列だけを持ち、16 進はその場で計算する。** これならずれようがない。
 * イベントは keccak256(署名) がまるごと topic0、関数は先頭 4 バイトが selector。
 *
 * 署名の出どころ:
 *   Transfer / OrderStarted / TokensDispensed / ProviderFee  Ocean の ERC20Template
 *   Metadata*   Ocean の ERC721Template。**metaDataHash は bytes32**
 *               (bytes と書くと署名が変わり、ログが 1 件も一致しない。実際に踏んだ)
 *   setMetaData / buyFromDispenserAndOrder  genji-witness/lib/ocean.mjs の TYPES
 *   anchor      genji-witness/contracts/src/CorpusAnchor.sol
 */
export const META_ARGS = '(address,uint8,string,bytes,bytes,bytes32,uint256,uint256)';

export const EVENT_SIGS = [
  'Transfer(address,address,uint256)',
  'OrderStarted(address,address,uint256,uint256,uint256,address,uint256)',
  'TokensDispensed(address,address,uint256)',
  /* providerData は uint8 v の**前**。ここを後ろに置くと一致しない */
  'ProviderFee(address,address,uint256,bytes,uint8,bytes32,bytes32,uint256)',
  'MetadataCreated' + META_ARGS,
  'MetadataUpdated' + META_ARGS,
  /* 自作の CorpusAnchor */
  'CorpusAnchored(bytes32,bytes32,address,uint64,uint32,string,string)',
] as const;

export const FUNCTION_SIGS = [
  /* providerFee の 4 つ目は v で uint8。uint256 と書くと一致しない */
  'buyFromDispenserAndOrder((address,uint256,(address,address,uint256,uint8,bytes32,bytes32,uint256,bytes),(address,address,uint256)),address)',
  'anchor(bytes32,bytes32,uint64,uint32,string,string)',
  'setMetaData(uint8,string,string,bytes,bytes,bytes32,(address,uint8,bytes32,bytes32)[])',
] as const;

const nameOf = (sig: string) => sig.slice(0, sig.indexOf('('));

/** topic0 → イベント名 */
export const TOPIC_NAME: Record<string, string> = Object.fromEntries(
  EVENT_SIGS.map((sig) => [keccak256(toHex(sig)), nameOf(sig)])
);

/** selector (先頭 4 バイト) → 関数名 */
export const SELECTOR_NAME: Record<string, string> = Object.fromEntries(
  FUNCTION_SIGS.map((sig) => [keccak256(toHex(sig)).slice(0, 10), nameOf(sig)])
);