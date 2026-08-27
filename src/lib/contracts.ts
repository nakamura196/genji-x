/**
 * コントラクトの「何であるか」を組み立てる。
 *
 * Etherscan は汎用なので、名前と中身がずれたまま出る。ここでは逆に、
 * **この資料の文脈で何を意味するか**だけを組み立てる。生の値へはその後で送る。
 */
import contractsData from '@/data/contracts.json';
import registry from '@/data/registry.json';
import snapshot from '@/data/snapshot.json';

export type ContractKind = 'dataNft' | 'datatoken' | 'corpusAnchor' | 'shared' | 'account';

export type ContractFacts = {
  address: string;
  kind: ContractKind;
  slug: string | null;
  shared: string | null;
  codeBytes: number;
  proxyTarget: string | null;
  name?: string | null;
  symbol?: string | null;
  totalSupply?: number | string | null;
  cap?: string | null;
  decimals?: number | null;
  owner?: string | null;
  /** 対になるもの。data NFT ↔ datatoken */
  pairedWith?: string | null;
  assetName?: string | null;
  volumeNumber?: number | null;
};

const table = contractsData.contracts as Record<string, ContractFacts>;

export function getContract(address: string): ContractFacts | null {
  const key = address.toLowerCase();
  const base = table[key];
  if (!base) return null;

  // 対になるものと、どの資料のものかを足す
  const entry = registry.assets.find(
    (a) => a.nft.toLowerCase() === key || a.datatoken.toLowerCase() === key
  );
  const snap = entry
    ? (snapshot.assets as { nft: string; ddo: { metadata?: { name?: string;
        additionalInformation?: { volumeNumber?: number } } } | null }[])
        .find((s) => s.nft.toLowerCase() === entry.nft.toLowerCase())
    : null;

  return {
    ...base,
    pairedWith: entry
      ? (entry.nft.toLowerCase() === key ? entry.datatoken : entry.nft)
      : null,
    assetName: snap?.ddo?.metadata?.name ?? entry?.label?.ja ?? null,
    volumeNumber: snap?.ddo?.metadata?.additionalInformation?.volumeNumber ?? null,
  };
}

export function allContractAddresses(): string[] {
  return Object.keys(table);
}

export { registry as contractRegistry };
