/**
 * **この記録を公開した鍵は誰か。**
 *
 * チェーンに書いてあるのはアドレスだけで、氏名は 1 文字も入っていない
 * （EDPB のブロックチェーン指針 02/2025 に従った。取り消せない場所に
 *  個人情報を置かない）。だが「誰が出したのか分からない目録」では
 * 引用の宛先にならない。**その橋渡しをこの画面が担う。**
 *
 * ── 画面の作りで一番大事なこと ──────────────────────────────────
 * **「チェーンが保証した事実」と「こちら側の申告」を、はっきり分けて出す。**
 * 混ぜると、読者は目の前の名前がどこまで検証されたものか判断できない。
 *
 *   上の節   チェーンから読んだ値。誰でも Etherscan で確かめられる
 *   下の節   こちらが名乗っているだけの値。**消せる**
 *
 * 見た目は contract/[address] の説明画面に合わせる（同じ「裏側を見せる」系統）。
 */
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Page } from '@/components/ported/Page';
import { Box } from '@/components/ported/atoms/Box';
import { Badge } from '@/components/ported/atoms/Badge';
import { Button } from '@/components/ported/atoms/Button';
import { EXPLORER } from '@/lib/chain';
import { registry, listVolumes } from '@/lib/catalog';
import { DECLARATION, DECLARATION_PATH } from '@/lib/declaration';
import { SITE_URL } from '@/constants/metadata';
import { getPageMetadata } from '@/constants/metadata';
import styles from './page.module.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'publisher' });
  return getPageMetadata(locale as 'ja' | 'en', {
    title: t('title'), description: t('lead'), path: '/publisher',
  });
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

export default async function PublisherPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('publisher');

  const addr = DECLARATION.address;
  const chain = DECLARATION.chains[0];
  const volumes = listVolumes().length;
  /* 宣言の文面は改行を含むので、そのまま <pre> に出す */
  const command = [
    `curl -s ${SITE_URL}${DECLARATION_PATH} -o d.json`,
    `cast wallet verify --address ${addr} \\`,
    `  "$(jq -r .statement d.json)" "$(jq -r .signature d.json)"`,
  ].join('\n');

  return (
    <Page
      title={t('title')}
      narrowContainer
      headerClassName={styles.pageHeader}
      before={<p className={styles.address}>{addr}</p>}
    >
      <div className={styles.badges}>
        <Badge label={t('badge.network')} tone="warn" />
        <Badge label={t('badge.noName')} tone="ok" />
      </div>

      <div className={styles.section}>
        <Box>
          <p className={styles.lead}>{t('lead')}</p>
        </Box>
      </div>

      {/* ── ① チェーンが保証していること ──────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('onChain.title')}</h2>
        <p className={styles.note}>{t('onChain.note')}</p>

        <Row k={t('onChain.address')} v={<Mono>{addr}</Mono>} />
        <Row
          k={t('onChain.author')}
          v={<Mono>{addr}</Mono>}
          note={t('onChain.authorNote', { n: volumes + 1 })}
        />
        <Row
          k={t('onChain.anchor')}
          v={
            <a href={`/${locale}/contract/${registry.corpusAnchor}`}>
              <Mono>{registry.corpusAnchor}</Mono>
            </a>
          }
          note={t('onChain.anchorNote')}
        />
        <Row k={t('onChain.network')} v={`Sepolia (chainId ${chain.chainId})`} />

        <div className={styles.links}>
          <Button href={`${EXPLORER}/address/${addr}`} style="outline" size="small">
            Etherscan
          </Button>
        </div>
      </section>

      {/* ── ② こちら側の申告 ──────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.claim}`}>
        <h2 className={styles.sectionTitle}>{t('offChain.title')}</h2>
        <p className={styles.warn}>{t('offChain.warn')}</p>

        <Row k={t('offChain.name')} v={DECLARATION.identity.name} />
        {DECLARATION.identity.affiliation && (
          <Row k={t('offChain.affiliation')} v={DECLARATION.identity.affiliation} />
        )}
        <Row
          k={t('offChain.signature')}
          v={<Mono>{`${DECLARATION.signature.slice(0, 22)}…`}</Mono>}
          note={t('offChain.signatureNote', { scheme: DECLARATION.signatureScheme })}
        />

        <div className={styles.links}>
          <Button href={DECLARATION_PATH} style="outline" size="small">
            {t('offChain.file')}
          </Button>
        </div>
      </section>

      {/* ── ③ 自分で確かめる ──────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('verify.title')}</h2>
        <p className={styles.note}>{t('verify.note')}</p>
        {/* 横に長いので、この箱の中だけで流す。キーボードでも動かせるようにする */}
        <pre className={styles.command} tabIndex={0} role="group" aria-label={t('verify.title')}>
          {command}
        </pre>
        <p className={styles.rowNote}>{t('verify.expect', { address: addr })}</p>
      </section>

      {/* ── ④ 資料そのものを作った人は別 ─────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('creators.title')}</h2>
        <Box>
          <p className={styles.lead}>{t('creators.body')}</p>
          <div className={styles.links}>
            <Button href={DECLARATION.identity.homepage} style="outline" size="small">
              {t('creators.link')}
            </Button>
          </div>
        </Box>
      </section>
    </Page>
  );
}
