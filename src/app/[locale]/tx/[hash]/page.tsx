/**
 * 取引 1 件の説明。**Etherscan と同じものを、この資料の文脈で読ませる。**
 *
 * Etherscan は汎用なので、6 件の記録が同じ重みで並ぶ。どれがこの取引の目的で、
 * どれがそのための手続きなのかは書いていない。ここでは逆に、
 * **何が起きたのかだけ**を順に並べ、生の値へはその後で送る。
 *
 * 扱うのは `src/data/transactions.json` にある取引だけ。任意の取引は扱わない。
 * 広げると「劣化した Etherscan」になる。本物を見たい人には出口を置く。
 *
 * 画面の作りは contract/[address] に合わせてある。同じ Page（narrow Container）、
 * 同じ Row、同じ「これは何か → 事実 → 生の値へ」の並び。
 * 行き来する 2 枚が違う組み方だと、読者は毎回読み直すことになる。
 */
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Page } from '@/components/ported/Page';
import { Box } from '@/components/ported/atoms/Box';
import { Badge } from '@/components/ported/atoms/Badge';
import { Button } from '@/components/ported/atoms/Button';
import { EXPLORER } from '@/lib/chain';
import { getContract } from '@/lib/contracts';
import {
  getTx, allTxHashes, actorsOf, moveOf, asTickets, formatEth, formatGwei,
  TOPIC_NAME, SELECTOR_NAME, type Tx, type TxLog,
} from '@/lib/transactions';
import styles from './page.module.css';
import type { Metadata } from 'next';

export const dynamicParams = false;

/**
 * タブと共有に出る題。**「参照の記録」だけでは 8 件を見分けられない。**
 * 帖が分かるものは帖名を、分からないものは取引の頭を添える。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; hash: string }>;
}): Promise<Metadata> {
  const { locale, hash } = await params;
  const tx = getTx(hash);
  if (!tx) return {};
  const t = await getTranslations({ locale, namespace: 'tx' });
  const kind = tx.kinds.includes('order') ? 'order' : tx.kinds[0];
  const slug = (tx.details.find((d) => (d as { slug?: string }).slug) as { slug?: string } | undefined)?.slug;
  const who = slug
    ? getContract(tx.to ?? '')?.assetName ?? slug
    : `${hash.slice(0, 10)}…`;
  return {
    title: `${t(`kind.${kind}.title`)} — ${who}`,
    description: t(`kind.${kind}.what`),
  };
}

const Mono = ({ children }: { children: React.ReactNode }) => (
  <code className={styles.mono}>{children}</code>
);

const Row = ({ k, v, note }: { k: string; v: React.ReactNode; note?: string }) => (
  <div className={styles.row}>
    <div className={styles.rowInner}>
      <div className={styles.rowKey}>{k}</div>
      <div className={styles.rowValue}>{v}</div>
    </div>
    {note && <p className={styles.rowNote}>{note}</p>}
  </div>
);

/** 42 字の 16 進は読めないので頭と尻だけ。ゼロアドレスだけは意味があるので語で出す */
const shortAddr = (a: string, zero: string) =>
  /^0x0{40}$/i.test(a) ? zero : `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * 記録 1 件の注釈を選ぶ。
 * イベント名だけでは足りない場面が 1 つある。**Transfer は 3 回出てくるが、
 * 発行・移動・バーンで意味がまるで違う。** 送り主と宛先を見て決める。
 */
function noteKeyOf(log: TxLog): string {
  const name = TOPIC_NAME[log.topic0];
  if (name === 'Transfer' && log.transfer) return `transfer.${moveOf(log.transfer)}`;
  return name ?? 'unknown';
}

export default async function TxPage({
  params,
}: {
  params: Promise<{ locale: string; hash: string }>;
}) {
  const { locale, hash } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tx');
  const tx = getTx(hash);
  if (!tx) notFound();

  const base = `/${locale}`;
  const kind: Tx['kinds'][number] = tx.kinds.includes('order') ? 'order' : tx.kinds[0];
  /* 帖が特定できる取引（参照の記録）だけ、その帖へ戻れるようにする */
  const slug = (tx.details.find((d) => (d as { slug?: string }).slug) as { slug?: string } | undefined)?.slug;
  const asset = slug ? getContract(tx.to ?? '') : null;

  const when = new Date(tx.timestamp * 1000);
  const zero = t('zeroAddress');

  return (
    <Page
      title={t(`kind.${kind}.title`)}
      narrowContainer
      headerClassName={styles.pageHeader}
      before={
        <>
          <nav className={styles.breadcrumb}>
            <a href={base}>{t('backToList')}</a>
            {slug && (
              <>
                {' '}/ <a href={`${base}/asset/${slug}`}>{asset?.assetName ?? slug}</a>
              </>
            )}
          </nav>
          <p className={styles.hash}>{tx.hash}</p>
        </>
      }
    >
      <div className={styles.badges}>
        <Badge label={t(tx.status === 'success' ? 'badge.ok' : 'badge.failed')}
               tone={tx.status === 'success' ? 'ok' : 'warn'} />
        <Badge label={t('badge.block', { n: tx.block.toLocaleString() })} tone="outline" />
        <Badge label={t('badge.gas', { n: tx.gasUsed.toLocaleString() })} tone="outline" />
      </div>

      {/* これは何か */}
      <div className={styles.section}>
        <Box>
          <p className={styles.lead}>{t(`kind.${kind}.what`)}</p>
          {t.has(`kind.${kind}.gotcha`) && (
            <p className={styles.gotcha}>{t(`kind.${kind}.gotcha`)}</p>
          )}
        </Box>
      </div>

      {/* 記録の順に何が起きたか。この画面の主役 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('logs')}</h2>
        <p className={styles.note}>{t('logsNote', { n: tx.logs.length })}</p>

        <ol className={styles.logs}>
          {tx.logs.map((log) => {
            const name = TOPIC_NAME[log.topic0];
            const key = noteKeyOf(log);
            const move = log.transfer ? moveOf(log.transfer) : null;
            /* 参照の記録だけ、他と同じ見た目にしない。この 1 行が目的だから */
            const isPoint = name === 'OrderStarted' || name === 'CorpusAnchored';
            return (
              <li key={log.index} className={`${styles.log} ${isPoint ? styles.point : ''}`}>
                <div className={styles.logIdx}>{log.index}</div>
                <div className={styles.logBody}>
                  <div className={styles.logName}>
                    {name ?? t('unknownEvent')}
                    {move && <span className={`${styles.move} ${styles[move]}`}>{t(`move.${move}`)}</span>}
                  </div>
                  {log.transfer && (
                    <div className={styles.flow}>
                      {shortAddr(log.transfer.from, zero)}
                      <span className={styles.arrow}>→</span>
                      {shortAddr(log.transfer.to, zero)}
                      <span className={styles.amount}>
                        {t('tickets', { n: asTickets(log.transfer.value) })}
                      </span>
                    </div>
                  )}
                  <p className={styles.logNote}>{t(`note.${key}`)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* root の記録なら、何を記録したのかを出す */}
      {tx.kinds.includes('anchor') && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('anchored')}</h2>
          {tx.details.map((d, i) => {
            const a = d as { root?: string; treeSize?: number; spec?: string; sourceUri?: string };
            if (!a.root) return null;
            return (
              <div key={i}>
                <Row k={t('row.root')} v={<Mono>{a.root}</Mono>} />
                <Row k={t('row.treeSize')} v={t('leaves', { n: (a.treeSize ?? 0).toLocaleString() })}
                     note={t('row.treeSizeNote')} />
                <Row k={t('row.spec')} v={<Mono>{a.spec}</Mono>} note={t('row.specNote')} />
                <Row k={t('row.sourceUri')} v={
                  a.sourceUri?.startsWith('http')
                    ? <a href={a.sourceUri} target="_blank" rel="noreferrer"><Mono>{a.sourceUri}</Mono></a>
                    : <Mono>{a.sourceUri}</Mono>
                } note={t('row.sourceUriNote')} />
              </div>
            );
          })}
        </section>
      )}

      {/* 説明書きの記録なら、どの帖に何を書いたのかを出す */}
      {tx.kinds.includes('metadata') && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('wrote')}</h2>
          {tx.details.map((d, i) => {
            const m = d as {
              slug?: string; nft?: string; change?: string; ddoBytes?: number; flags?: string;
            };
            if (!m.slug) return null;
            return (
              <div key={i}>
                <Row
                  k={t('row.volume')}
                  /* 番号ではなく帖名で出す。54 と言われても分からない */
                  v={<a href={`${base}/asset/${m.slug}`}>{getContract(m.nft ?? '')?.assetName ?? m.slug}</a>}
                />
                <Row k={t('row.change')} v={t(`change.${m.change}`)} note={t('row.changeNote')} />
                <Row k={t('row.ddoBytes')} v={t('bytes', { n: (m.ddoBytes ?? 0).toLocaleString() })} />
                <Row
                  k={t('row.flags')}
                  v={<Mono>{m.flags}</Mono>}
                  note={t(m.flags === '0x00' ? 'row.flagsPlainNote' : 'row.flagsNote')}
                />
              </div>
            );
          })}
        </section>
      )}

      {/* チェーンから読んだ事実 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('facts')}</h2>
        <p className={styles.note}>{t('factsNote')}</p>

        <Row k={t('row.from')} v={<Mono>{tx.from}</Mono>} note={t('row.fromNote')} />
        {tx.to && (
          <Row
            k={t('row.to')}
            v={getContract(tx.to)
              ? <a href={`${base}/contract/${tx.to}`}><Mono>{tx.to}</Mono></a>
              : <Mono>{tx.to}</Mono>}
            note={t('row.toNote')}
          />
        )}
        <Row k={t('row.selector')}
             v={<Mono>{SELECTOR_NAME[tx.selector] ?? tx.selector}</Mono>}
             note={t('row.selectorNote')} />
        <Row k={t('row.time')}
             v={<time dateTime={when.toISOString()}>{when.toISOString().replace('T', ' ').slice(0, 19)} UTC</time>} />
        <Row k={t('row.value')} v={`${formatEth(tx.value)} ETH`} note={t('row.valueNote')} />
        <Row k={t('row.fee')} v={`${formatEth(tx.feeWei)} ETH`} note={t('row.feeNote')} />
        <Row k={t('row.gas')}
             v={t('row.gasValue', {
               used: tx.gasUsed.toLocaleString(),
               limit: tx.gasLimit.toLocaleString(),
               price: formatGwei(tx.gasPrice),
             })} />
      </section>

      {/* 出てきたアドレス。説明を持っているものだけ中に送る */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('actors')}</h2>
        <p className={styles.note}>{t('actorsNote')}</p>
        <ul className={styles.actors}>
          {actorsOf(tx).map((a) => (
            <li key={a.address}>
              {a.known
                ? <a href={`${base}/contract/${a.address}`}><Mono>{a.address}</Mono></a>
                : <a href={`${EXPLORER}/address/${a.address}`} target="_blank" rel="noreferrer">
                    <Mono>{a.address}</Mono>
                  </a>}
              <span className={styles.actorRole}>
                {a.known ? t('actorKnown') : t('actorUnknown')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 生の値へ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('raw')}</h2>
        <p className={styles.note}>{t('rawNote')}</p>
        <div className={styles.links}>
          <Button href={`${EXPLORER}/tx/${tx.hash}`} style="outline" size="small">
            Etherscan
          </Button>
        </div>
      </section>
    </Page>
  );
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    allTxHashes().map((hash) => ({ locale, hash }))
  );
}
