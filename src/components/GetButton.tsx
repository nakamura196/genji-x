'use client';
/**
 * 「取得」ボタン。**MetaMask で署名して、参照した記録をチェーンに残す。**
 *
 * ── サーバは関与しない ──────────────────────────────────────────
 * 署名するのは利用者のウォレットで、このサイトのサーバは通らない。
 * だから静的ホスティングのままで読み書きが完結する。
 *
 * ── 押しても本文は手に入らない ──────────────────────────────────
 * 本文は CC0 で IPFS に公開してあるので、押さなくても読める。
 * 押して得られるのは**証拠**である。「この版を参照した」を、
 * 誰にも消せない形で公開の場所に残す。引用の記録に近い。
 *
 * Ocean 本来の設計では Provider が門番をするので押さないと落とせないが、
 * CC0 の本文に関所を作らない判断をしたので、その動機は無くしてある。
 *
 * ── Ocean のノードを 1 度も呼ばない ─────────────────────────────
 * providerFee をすべて 0 にすると、`_checkProviderFee` の ecrecover が 0x0 を返し、
 * providerFeeAddress も 0x0 なので検査を通る。有料にした瞬間に署名が要る。
 */
import { useState } from 'react';
import { createWalletClient, custom, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { publicClient, ORDER_ABI, freeOrderParams, EXPLORER, CHAIN } from '@/lib/chain';
import { useUsageCounts } from './UsageCounts';
import { Button } from './ported/atoms/Button';
import styles from './GetButton.module.css';

type State = 'idle' | 'connecting' | 'signing' | 'waiting' | 'done' | 'error';

export function GetButton({
  datatoken, fromBlock, countLabel, labels, hideCount = false,
}: {
  datatoken: Address;
  fromBlock: number;
  countLabel: string;
  /** 右パネルでは上に数字を出すので、ここでは省く */
  hideCount?: boolean;
  labels: {
    get: string; connecting: string; signing: string; waiting: string;
    done: string; again: string; noWallet: string; wrongChain: string;
    receipt: string; note: string; copy: string; copied: string;
    /** 手順の画面への導線。無ければ出さない */
    howTo?: string; howToHref?: string;
  };
}) {
  const [state, setState] = useState<State>('idle');
  const [tx, setTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // 回数は増えるので、開いたときに数え直す。注文が通ったら再取得のきっかけにする
  const { counts } = useUsageCounts([datatoken], fromBlock + (state === 'done' ? 0 : 0));
  const c = counts?.[datatoken.toLowerCase()];

  async function run() {
    setError(null);
    const eth = (globalThis as { ethereum?: unknown }).ethereum;
    if (!eth) { setError(labels.noWallet); setState('error'); return; }
    try {
      setState('connecting');
      const wallet = createWalletClient({ chain: sepolia, transport: custom(eth as never) });
      const [account] = await wallet.requestAddresses();

      // つないだ先が Sepolia でなければ切り替えを頼む
      const id = await wallet.getChainId();
      if (id !== CHAIN.id) {
        try {
          await wallet.switchChain({ id: CHAIN.id });
        } catch {
          setError(labels.wrongChain); setState('error'); return;
        }
      }

      setState('signing');
      const hash = await wallet.writeContract({
        account,
        address: datatoken,
        abi: ORDER_ABI,
        functionName: 'buyFromDispenserAndOrder',
        args: freeOrderParams(account) as never,
        chain: sepolia,
      });
      setTx(hash);
      setState('waiting');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState(receipt.status === 'success' ? 'done' : 'error');
      if (receipt.status !== 'success') setError('reverted');
    } catch (e) {
      const m = (e as Error).message ?? String(e);
      setError(m.length > 160 ? m.slice(0, 160) + '…' : m);
      setState('error');
    }
  }

  const busy = state === 'connecting' || state === 'signing' || state === 'waiting';
  const label =
    state === 'connecting' ? labels.connecting
    : state === 'signing' ? labels.signing
    : state === 'waiting' ? labels.waiting
    : state === 'done' ? labels.again
    : labels.get;

  return (
    <div>
      {!hideCount && (
        <p className={styles.count}>
          {c ? countLabel.replace('{n}', String(c.orders)).replace('{people}', String(c.consumers)) : '…'}
        </p>
      )}
      {/* 押したあとは「もう一度」なので、目立たせない側 (outline) に落とす */}
      <Button
        onClick={run}
        disabled={busy}
        style={state === 'done' ? 'outline' : 'primary'}
      >
        {label}
      </Button>

      <p className={styles.note}>{labels.note}</p>
      {/*
        **一番詰まるのがここ。** 押してから「ガス代が要る」と知って、
        どこでもらうのか分からないまま止まる。手順の画面へ導線を置く。
        フッタにもあるが、フッタまで下りる人は多くない。
      */}
      {labels.howToHref && (
        <p className={styles.note}>
          <a className={styles.howTo} href={labels.howToHref}>{labels.howTo}</a>
        </p>
      )}

      {state === 'done' && tx && (
        <div className={styles.receipt}>
          <div className={styles.receiptOk}>{labels.done}</div>
          <div className={styles.receiptLabel}>{labels.receipt}</div>
          <code className={styles.hash}>sepolia:{tx}</code>
          <div className={styles.receiptActions}>
            <Button
              style="outline"
              size="small"
              onClick={() => {
                navigator.clipboard?.writeText(`sepolia:${tx}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? labels.copied : labels.copy}
            </Button>
            <a href={`${EXPLORER}/tx/${tx}`} target="_blank" rel="noreferrer"
               className={styles.explorer}>
              Etherscan
            </a>
          </div>
        </div>
      )}

      {state === 'error' && error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
