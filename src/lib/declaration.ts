/**
 * 署名つきの宣言（「このアドレスは私です」）。
 *
 * ── なぜチェーンではなくここにあるのか ──────────────────────────
 * EDPB のブロックチェーン指針 (02/2025) は、**個人情報をチェーンに置くことを
 * 平文・暗号化・ハッシュのいずれでも認めていない**。ウォレットのアドレスも、
 * 人と結び付けば個人情報になる（匿名ではなく仮名にすぎない）。
 *
 * そこでチェーンに記録するのは**アドレスだけ**にし、「その鍵が誰か」は
 * こちら側で名乗る。**この宣言は消せる。** 消せばアドレスは再びただの
 * アドレスに戻る。指針の言う「チェーンは指すだけ、身元は消せる側に置く」形。
 *
 * ── 宣言の URL もチェーンに載せていない ─────────────────────────
 * 当初は `.well-known/…` の URL を DDO に書く案だったが、**URL も永久に残る**。
 * 置き場所を後から変えられなくなるのでやめた。
 *
 * ── 実体は public/ にある ───────────────────────────────────────
 * `public/.well-known/genji-witness.json` として配信もしている。
 * 機械で取りに来る人はそちらを読む。ここはその同じファイルを画面に出すため。
 */
import declaration from '../../public/.well-known/genji-witness.json';

export type Declaration = {
  version: number;
  identity: { name: string; affiliation: string | null; orcid: string | null; homepage: string };
  address: string;
  chains: { chainId: number; name: string; corpusAnchor: string; oceanDataNft: string; did: string }[];
  corpus: {
    corpusId: string; sourceCommit: string; sourceUri: string; ipfs: string;
    trees: Record<string, { root: string; treeSize: number; spec: string }>;
  };
  statement: string;
  signature: string;
  signatureScheme: string;
};

export const DECLARATION = declaration as unknown as Declaration;

/** 配信している場所。機械で取りに来る人向け */
export const DECLARATION_PATH = '/.well-known/genji-witness.json';

/**
 * 自分で確かめるための一行。foundry の `cast` があれば誰でも実行できる。
 * 宣言の文面は改行を含むので、ファイルから読ませる形にする。
 */
export const verifyCommand = (origin: string) =>
  [
    `curl -s ${origin}${DECLARATION_PATH} -o d.json`,
    `cast wallet verify --address ${DECLARATION.address} "$(jq -r .statement d.json)" "$(jq -r .signature d.json)"`,
  ].join('\n');
