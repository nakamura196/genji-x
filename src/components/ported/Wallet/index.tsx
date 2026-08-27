'use client';
/**
 * ウォレットの接続。**本家のヘッダにある Wallet の位置と役割を再現する。**
 *
 * ── 本家との違い ────────────────────────────────────────────────
 * 本家 (Ocean Market / Pontus-X) は web3modal + wagmi を使い、
 * 多数のウォレットと複数チェーンに対応している。依存が重く、
 * この目録は Sepolia 1 本・MetaMask 系 1 種で足りるので、
 * viem だけで書いてある (追加の依存ゼロ)。
 *
 * ── 何をするか ──────────────────────────────────────────────────
 * 接続を覚えておく。既に許可されているなら、開いた時点で繋がっている状態にする。
 * ネットワークが Sepolia でなければ、押したときに切り替えを頼む。
 *
 * **サーバは一切関与しない。** 署名も接続もブラウザの中だけで起きる。
 * だから静的ホスティングのままで読み書きが完結する。
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createWalletClient, custom, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN, EXPLORER } from '@/lib/chain';
import styles from './index.module.css';
import account from './Account.module.css';
import details from './Details.module.css';

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

const getEthereum = (): Eip1193 | null =>
  (globalThis as { ethereum?: Eip1193 }).ethereum ?? null;

/** 何も購読しない。useSyncExternalStore を「今クライアントか」の判定だけに使う */
const subscribeNothing = () => () => {};

export function useWallet() {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * サーバ側には window.ethereum が無いので、最初の描画は必ず「未検出」になる。
   * それをそのまま出すと、クライアントで差し替わるまで見た目が飛ぶし、
   * 描き分けが食い違うと React が警告を出す。
   * **描き終わったかどうかを持ち、それまでは同じものを描く。**
   *
   * useState + useEffect ではなく useSyncExternalStore を使っているのは、
   * 「サーバでの値」と「クライアントでの値」を React に直接教えられるため。
   * 効果の中で setState すると、描画がもう一往復する。
   */
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  // ウォレットの有無は状態として持たない。描き終わっていれば、その場で見れば分かる
  const available = ready && getEthereum() != null;

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;
    // 既に許可されているなら、押さなくても繋がっている状態にする
    (async () => {
      const accounts = (await eth.request({ method: 'eth_accounts' }).catch(() => [])) as string[];
      if (accounts?.length) setAddress(accounts[0] as Address);
      const id = (await eth.request({ method: 'eth_chainId' }).catch(() => null)) as string | null;
      if (id) setChainId(parseInt(id, 16));
    })();
    const onAccounts = (...a: unknown[]) => {
      const list = a[0] as string[];
      setAddress(list?.length ? (list[0] as Address) : null);
    };
    const onChain = (...a: unknown[]) => setChainId(parseInt(a[0] as string, 16));
    eth.on?.('accountsChanged', onAccounts);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) return;
    setBusy(true);
    try {
      const wallet = createWalletClient({ chain: sepolia, transport: custom(eth as never) });
      const [account] = await wallet.requestAddresses();
      setAddress(account);
      const id = await wallet.getChainId();
      setChainId(id);
      if (id !== CHAIN.id) {
        await wallet.switchChain({ id: CHAIN.id }).catch(() => undefined);
        setChainId(await wallet.getChainId().catch(() => id));
      }
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * 接続を解く。
   *
   * **EIP-1193 に「切断」の口は無い。** ページ側からウォレットを切ることは
   * 仕様上できない。できるのは「このサイトに与えた許可を返上する」ことで、
   * MetaMask はそれを `wallet_revokePermissions` として持っている
   * (EIP-2255 の実験的な拡張。対応していないウォレットもある)。
   *
   * 通ればウォレット側の接続一覧からこのサイトが消える。
   * 通らなくても、**手元の状態は必ず消す**。押したのに何も起きない、
   * という状態を残さないため。次に「接続」を押せば、また許可を求める。
   */
  const disconnect = useCallback(async () => {
    const eth = getEthereum();
    setBusy(true);
    try {
      await eth?.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      }).catch(() => undefined);   // 対応していなければ黙って進む
    } finally {
      setAddress(null);
      setChainId(null);
      setBusy(false);
    }
  }, []);

  return {
    address, chainId, busy, available, ready, connect, disconnect,
    wrongChain: address != null && chainId != null && chainId !== CHAIN.id,
  };
}

export type WalletState = ReturnType<typeof useWallet>;

/** 本家 cliox/src/@utils/wallet の accountTruncate と同じ切り方 */
const accountTruncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * ヘッダに並ぶウォレットのボタン。
 * **Ocean Market / Pontus-X Portal の Wallet/Account からの移植**（Apache-2.0）。
 * 出どころ: cliox/src/components/Header/Wallet/{index,Account}.tsx
 *
 * DOM とクラス名は本家と同じ (.wallet > button.button[.initial] > .address)。
 * 本家の .initial は「まだ繋いでいない」状態のこと。
 *
 * ── 本家との違い ────────────────────────────────────────────────
 * 1. 繋いだあと、本家は押すと吹き出しが開き、プロフィール・ブックマーク・
 *    切断が並ぶ。この試作にはプロフィールもブックマークも無いので、
 *    **住所・コピー・Explorer・接続を解く** の 4 つだけを入れた
 *    (本家 Details.tsx の下半分にあたる)。開くものがあるのでキャレットも出す。
 * 2. アバター（blockies）を出していない。本家は住所から絵を作る部品を持っている。
 * 3. ウォレットが無いとき / 繋ぎ先が違うときを、モーダルではなくボタンで表す。
 *    本家はここを ConnectKit のモーダルに任せている。
 */
export function WalletButton({
  wallet,
  labels,
}: {
  wallet: WalletState;
  labels?: {
    connect: string; connecting: string; wrongChain: string; noWallet: string;
    copy: string; copied: string; explorer: string;
    disconnect: string; disconnectNote: string;
  };
}) {
  const { address, busy, available, ready, connect, disconnect, wrongChain } = wallet;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  /** 外を押したら閉じる。開いたままヘッダの他の操作に触れると邪魔になる */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`.${styles.wallet}`)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const copy = useCallback(async () => {
    if (!address) return;
    await navigator.clipboard?.writeText(address).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [address]);

  const text = {
    connect: labels?.connect ?? 'Connect',
    connecting: labels?.connecting ?? 'Connecting…',
    wrongChain: labels?.wrongChain ?? 'Wrong network',
    noWallet: labels?.noWallet ?? 'No wallet',
    copy: labels?.copy ?? 'Copy address',
    copied: labels?.copied ?? 'Copied',
    explorer: labels?.explorer ?? 'View on explorer',
    disconnect: labels?.disconnect ?? 'Disconnect',
    disconnectNote: labels?.disconnectNote ?? '',
  };

  // 描き終わるまではボタンの形だけ出しておく（サーバとクライアントで同じ）
  if (!ready) {
    return (
      <div className={styles.wallet}>
        <span className={`${account.button} ${account.initial} ${account.placeholder}`}>
          {text.connect}
        </span>
      </div>
    );
  }

  if (!available) {
    return (
      <div className={styles.wallet}>
        <a
          className={`${account.button} ${account.initial} ${account.download}`}
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer"
          title={text.noWallet}
        >
          {text.noWallet}
        </a>
      </div>
    );
  }

  if (address) {
    return (
      <div className={styles.wallet}>
        <button
          type="button"
          className={`${account.button} ${wrongChain ? account.error : ''}`}
          aria-label="Account"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => (wrongChain ? connect() : setOpen((v) => !v))}
          title={address}
        >
          {wrongChain ? (
            text.wrongChain
          ) : (
            <>
              <span className={account.address}>{accountTruncate(address)}</span>
              {/* 開くものがあるので矢印を出す。本家と同じ位置 */}
              <span className={details.caret} aria-hidden="true">{open ? '▴' : '▾'}</span>
            </>
          )}
        </button>

        {open && !wrongChain && (
          <div className={details.details} role="menu">
            <p className={details.full}>{address}</p>
            <div className={details.actions}>
              <button type="button" className={details.action} onClick={copy}>
                {copied ? text.copied : text.copy}
              </button>
              <a
                className={details.action}
                href={`${EXPLORER}/address/${address}`}
                target="_blank"
                rel="noreferrer"
              >
                {text.explorer}
              </a>
              {/*
                **押したら必ず何か起きる。** ウォレットが許可の返上に
                対応していなくても、この画面の状態は消える
              */}
              <button
                type="button"
                className={`${details.action} ${details.danger}`}
                onClick={() => { setOpen(false); disconnect(); }}
                disabled={busy}
              >
                {text.disconnect}
              </button>
            </div>
            <p className={details.note}>{text.disconnectNote}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wallet}>
      <button
        type="button"
        className={`${account.button} ${account.initial}`}
        onClick={() => connect()}
        disabled={busy}
      >
        {busy ? text.connecting : text.connect}
      </button>
    </div>
  );
}
