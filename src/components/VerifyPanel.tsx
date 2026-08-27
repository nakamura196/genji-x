'use client';
/**
 * **読者のブラウザの中で検証する。** サーバの「検証しました」を信じない。
 *
 * ボタンを押すと、この順で走る:
 *   1. 公開 IPFS ゲートウェイから本文を取る（このサイトを経由しない）
 *   2. 取った本文を SHA-256 して、DDO の葉ハッシュと合うか見る
 *   3. DDO に入っている 6 個のハッシュで root まで畳む
 *
 * 3 が通れば「この帖は、チェーンに刻まれた全 54 帖の一部である」が確定する。
 * **他の 53 帖は 1 バイトも見ない。** 渡すのは 192 バイトだけ。
 */
import { useState } from 'react';
import { verifyInclusion, leafHash, toHex, fetchFromIpfs } from '@/lib/merkle-browser';
import { Button } from './ported/atoms/Button';
import styles from './VerifyPanel.module.css';

type Step = { label: string; state: 'idle' | 'run' | 'ok' | 'ng'; detail?: string };

export function VerifyPanel({
  cid, leafHash: expectedLeaf, leafIndex, treeSize, inclusionProof, chapterRoot, labels,
}: {
  cid: string;
  leafHash: string;
  leafIndex: number;
  treeSize: number;
  inclusionProof: string[];
  chapterRoot: string;
  labels: {
    run: string; running: string; again: string;
    fetch: string; hash: string; fold: string;
    done: string; failed: string; note: string;
    preview: string; previewNote: string;
  };
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'ok' | 'ng' | null>(null);
  /**
   * 取れた本文をそのまま見せる。
   * TEI/XML はブラウザで開いても真っ白か解析エラーになる (名前空間つきの XML で、
   * 描き方をブラウザが知らないため)。「アクセスできない」ように見えるが届いている。
   * ここで中身を出せば、取れたことが目で分かる。通信は増えない (検証で既に取っている)。
   */
  const [preview, setPreview] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const s: Step[] = [
      { label: labels.fetch, state: 'run' },
      { label: labels.hash, state: 'idle' },
      { label: labels.fold, state: 'idle' },
    ];
    setSteps([...s]);
    try {
      const { bytes, gateway } = await fetchFromIpfs(cid);
      setPreview(new TextDecoder().decode(bytes.slice(0, 4000)));
      s[0] = { label: labels.fetch, state: 'ok',
        detail: `${gateway} / ${bytes.length.toLocaleString()} bytes` };
      s[1].state = 'run';
      setSteps([...s]);

      const got = toHex(await leafHash(bytes));
      const leafOk = got.toLowerCase() === expectedLeaf.toLowerCase();
      s[1] = { label: labels.hash, state: leafOk ? 'ok' : 'ng', detail: got };
      if (!leafOk) { setSteps([...s]); setResult('ng'); return; }
      s[2].state = 'run';
      setSteps([...s]);

      const ok = await verifyInclusion(bytes, leafIndex, treeSize, inclusionProof, chapterRoot);
      s[2] = { label: labels.fold, state: ok ? 'ok' : 'ng',
        detail: `${inclusionProof.length} hashes = ${inclusionProof.length * 32} bytes → ${chapterRoot.slice(0, 18)}…` };
      setSteps([...s]);
      setResult(ok ? 'ok' : 'ng');
    } catch (e) {
      s[0] = { label: labels.fetch, state: 'ng', detail: (e as Error).message.slice(0, 120) };
      setSteps([...s]);
      setResult('ng');
    } finally {
      setBusy(false);
    }
  }

  const mark = (st: Step['state']) =>
    st === 'ok' ? '✓' : st === 'ng' ? '✕' : st === 'run' ? '…' : '·';
  const stepClass = (st: Step['state']) =>
    `${styles.step} ${st === 'ok' ? styles.stepOk : st === 'ng' ? styles.stepNg : ''}`;

  return (
    <div>
      <Button onClick={run} disabled={busy} style="primary" size="small">
        {busy ? labels.running : result ? labels.again : labels.run}
      </Button>

      {steps.length > 0 && (
        <ul className={styles.steps}>
          {steps.map((st, i) => (
            <li key={i} className={stepClass(st.state)}>
              <span className={styles.mark}>{mark(st.state)}</span>
              {st.label}
              {st.detail && <div className={styles.detail}>{st.detail}</div>}
            </li>
          ))}
        </ul>
      )}

      {preview && result === 'ok' && (
        <details className={styles.details}>
          <summary className={styles.summary}>{labels.preview}</summary>
          <p className={styles.previewNote}>{labels.previewNote}</p>
          <pre className={styles.preview}>{preview}</pre>
        </details>
      )}

      {result && (
        <p className={`${styles.result} ${result === 'ok' ? styles.resultOk : styles.resultNg}`}>
          {result === 'ok' ? labels.done : labels.failed}
        </p>
      )}

      <p className={styles.note}>{labels.note}</p>
    </div>
  );
}
