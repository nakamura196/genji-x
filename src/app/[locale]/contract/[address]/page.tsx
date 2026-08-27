/**
 * コントラクト 1 件の説明。**生の値へ飛ばす前に、これが何かを言う。**
 *
 * Etherscan は汎用なので、この資料の文脈では意味の取れない表示になる。
 * 実際につまずいたもの:
 *   DispenserCreated   何も作られていない (共有窓口への登録)
 *   1 of ○○            個数ではなく背番号
 *   contract_deployed  null なのに 2 つ作られている
 *   Holders が空        壊れていない。券が同じ取引で焼かれる設計だから
 *   コードが 45 バイト   最小プロキシで、本体は別の場所にある
 *
 * このページはそれらを説明してから、Etherscan へ送る。
 *
 * 見た目について: 以前は dh-ui の部品と --dh-* のトークンで組んでいて、
 * ヘッダ・フッタ・目録が Ocean 系の変数で動いているのに、この画面だけ
 * 別の設計の色と寸法で出ていた。暗い表示のときに片方だけ切り替わる
 * （地は Ocean 側、文字は dh 側）ので、そこが特に目立った。
 * 部品も変数も Ocean 系（移植したもの）に寄せている。
 */
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Page } from '@/components/ported/Page';
import { Box } from '@/components/ported/atoms/Box';
import { Badge } from '@/components/ported/atoms/Badge';
import { Button } from '@/components/ported/atoms/Button';
import { getContract, allContractAddresses } from '@/lib/contracts';
import { EXPLORER } from '@/lib/chain';
import { registry } from '@/lib/catalog';
import styles from './page.module.css';

export const dynamicParams = false;

const Row = ({ k, v, note }: { k: string; v: React.ReactNode; note?: string }) => (
  <div className={styles.row}>
    <div className={styles.rowInner}>
      <div className={styles.rowKey}>{k}</div>
      <div className={styles.rowValue}>{v}</div>
    </div>
    {note && <p className={styles.rowNote}>{note}</p>}
  </div>
);

const Mono = ({ children }: { children: React.ReactNode }) => (
  <code className={styles.mono}>{children}</code>
);

export default async function ContractPage({
  params,
}: {
  params: Promise<{ locale: string; address: string }>;
}) {
  const { locale, address } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contract');
  const c = getContract(address);
  if (!c) notFound();

  const base = `/${locale}`;
  const kindKey = c.kind === 'shared' ? `shared.${c.shared}` : c.kind;

  return (
    /*
      枠は他のページと同じ Page（Container + PageHeader）に載せる。
      以前はここだけ Container と PageHeader を自分で並べ、上の余白も
      この画面の CSS が持っていた。同じことを 2 か所に書くと必ずずれる。

      幅は narrow (62rem)。本家の内容ページ (cliox/src/pages/[slug].tsx) と同じで、
      長い散文と 42 文字の 16 進が並ぶこの画面には、既定の 1400px は広すぎる。

      パンくずと住所は `before` で題より上に出す。description に渡すと
      PageHeader の .description (1.7rem) が当たって、16 進の 42 文字が
      見出し並みの大きさで出てしまう。
    */
    <Page
      title={t(`kind.${kindKey}.title`)}
      narrowContainer
      headerClassName={styles.pageHeader}
      before={
        <>
          <nav className={styles.breadcrumb}>
            <a href={base}>{t('backToList')}</a>
            {c.slug && (
              <>
                {' '}
                / <a href={`${base}/asset/${c.slug}`}>{c.assetName ?? c.slug}</a>
              </>
            )}
          </nav>
          <p className={styles.address}>{c.address}</p>
        </>
      }
    >
      <div className={styles.badges}>
        {c.proxyTarget && <Badge label={t('badge.proxy')} tone="outline" />}
        {c.kind === 'shared' && <Badge label={t('badge.shared')} tone="warn" />}
        {c.kind === 'corpusAnchor' && <Badge label={t('badge.verified')} tone="ok" />}
      </div>

      {/* これは何か */}
      <div className={styles.section}>
        <Box>
          <p className={styles.lead}>{t(`kind.${kindKey}.what`)}</p>
          {t.has(`kind.${kindKey}.gotcha`) && (
            <p className={styles.gotcha}>{t(`kind.${kindKey}.gotcha`)}</p>
          )}
        </Box>
      </div>

      {/* チェーンから読んだ事実 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('facts')}</h2>
        <p className={styles.note}>{t('factsNote')}</p>

        {c.name && <Row k={t('row.name')} v={c.name} note={t('row.nameNote')} />}
        {c.symbol && <Row k={t('row.symbol')} v={<Mono>{c.symbol}</Mono>} />}

        <Row
          k={t('row.code')}
          v={`${c.codeBytes.toLocaleString()} ${t('bytes')}`}
          note={c.proxyTarget ? t('row.codeProxyNote') : undefined}
        />
        {c.proxyTarget && (
          <Row
            k={t('row.proxyTarget')}
            v={
              <a href={`${base}/contract/${c.proxyTarget}`}>
                <Mono>{c.proxyTarget}</Mono>
              </a>
            }
            note={t('row.proxyTargetNote')}
          />
        )}

        {c.kind === 'dataNft' && (
          <>
            <Row k={t('row.owner')} v={<Mono>{c.owner}</Mono>} note={t('row.ownerNote')} />
            <Row k={t('row.supply721')} v={String(c.totalSupply)} note={t('row.supply721Note')} />
          </>
        )}

        {c.kind === 'datatoken' && (
          <>
            <Row k={t('row.supply20')} v={String(c.totalSupply)} note={t('row.supply20Note')} />
            <Row
              k={t('row.cap')}
              v={t('row.capValue', { n: c.cap ?? '?' })}
              note={t('row.capNote')}
            />
          </>
        )}

        {c.pairedWith && (
          <Row
            k={t('row.paired')}
            v={
              <a href={`${base}/contract/${c.pairedWith}`}>
                <Mono>{c.pairedWith}</Mono>
              </a>
            }
            note={t(c.kind === 'dataNft' ? 'row.pairedNoteNft' : 'row.pairedNoteDt')}
          />
        )}
      </section>

      {/* 生の値へ */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('raw')}</h2>
        <p className={styles.note}>{t('rawNote')}</p>
        <div className={styles.links}>
          {/* Button の href は外部リンク扱い。新しいタブで開き、末尾に ↗ が付く（本家の挙動） */}
          <Button href={`${EXPLORER}/address/${c.address}`} style="outline" size="small">
            Etherscan
          </Button>
          {c.kind === 'corpusAnchor' && (
            <Button
              href={`https://repo.sourcify.dev/${registry.chainId}/${c.address}`}
              style="outline"
              size="small"
            >
              Sourcify
            </Button>
          )}
        </div>
      </section>
    </Page>
  );
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    allContractAddresses().map((address) => ({ locale, address }))
  );
}
