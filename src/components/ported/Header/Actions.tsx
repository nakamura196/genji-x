'use client';
/**
 * ヘッダ右側の操作。**本家の並びをそのまま揃える。**
 *
 * 本家 (Ocean Market / Pontus-X / Clio-X) の Menu.tsx の actions はこの順:
 *   LanguageSwitcher → SearchButton → Networks → NetworkMenu → Wallet
 *   → Automation → UserPreferences
 *
 * こちらで持たないもの:
 *   Networks   対応チェーンを選ぶ画面。本家も 2 本以上のときだけ出す
 *   Automation 自動実行のウォレット。この目録には無い機能
 *
 * ── ウォレットの状態を 1 か所で持つ理由 ────────────────────────
 * 本家は wagmi が状態を持っていて、NetworkMenu も Wallet も同じものを見る。
 * こちらの useWallet は呼ぶたびに別の状態を作るので、2 か所で呼ぶと
 * accountsChanged の待ち受けが二重になり、片方だけ古い値のまま残りうる。
 * **ここで 1 回だけ呼び、下に渡す。**
 */
import LanguageSwitcher from './LanguageSwitcher';
import SearchButton from './SearchButton';
import Network from './Network';
import UserPreferences, { type PreferencesLabels } from './UserPreferences';
import { useWallet, WalletButton } from '../Wallet';

export type ActionsLabels = PreferencesLabels & {
  connect: string;
  connecting: string;
  wrongChain: string;
  noWallet: string;
  /* 繋いだあとに開く吹き出しの中身（本家 Details.tsx にあたる） */
  copy: string;
  copied: string;
  explorer: string;
  disconnect: string;
  disconnectNote: string;
  searchLabel: string;
  languageLabel: string;
};

export function Actions({ locale, labels }: { locale: string; labels: ActionsLabels }) {
  const wallet = useWallet();

  return (
    <>
      {/* 1. 言語 */}
      <LanguageSwitcher locale={locale} label={labels.languageLabel} />

      {/* 2. 検索 */}
      <SearchButton locale={locale} label={labels.searchLabel} />

      {/* 3. ネットワーク（繋いでいるときだけ出る） */}
      <Network chainId={wallet.chainId} />

      {/* 4. ウォレット */}
      <WalletButton wallet={wallet} labels={labels} />

      {/* 5. 設定（見た目の切り替え） */}
      <UserPreferences labels={labels} />
    </>
  );
}
