/**
 * **「参照した」と記録するまでの手順。**
 *
 * この目録は読むだけなら何も要らない。本文は CC0 で IPFS にあり、
 * リンクを開けば読める。手続きが要るのは「この版を参照した」と
 * チェーンに書き残すときだけで、そのとき必要なのは **ガス代だけ**である。
 *
 * ── 用語をここで正しておく ──────────────────────────────────────
 * 「トークンが要る」と誤解されやすいので、この画面で正面から書く。
 *
 *   ETH        Ethereum のネイティブ通貨。**トークンではない**。
 *              ERC-20 の契約を持たず、チェーンの仕組みそのものが数えている
 *   datatoken  Ocean の ERC-20 トークン。**利用者が用意するものではない**。
 *              注文の取引の中で発行され、同じ取引の中でバーンされる
 *
 * だから読者が用意するのは Sepolia のテスト用 ETH ただ 1 つ。
 */
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Page } from '@/components/ported/Page';
import { Box } from '@/components/ported/atoms/Box';
import { Button } from '@/components/ported/atoms/Button';
import { getPageMetadata } from '@/constants/metadata';
import { registry } from '@/lib/catalog';
import styles from './page.module.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'howTo' });
  return getPageMetadata(locale as 'ja' | 'en', {
    title: t('title'), description: t('lead'), path: '/how-to',
  });
}

/**
 * 蛇口の一覧。**複数出す。**
 * 1 つに絞ると、その日たまたま空でも「もらえない」で終わってしまう。
 * 性質が違うものを並べる（待つだけ / 別サービスの登録が要る）。
 */
const FAUCETS = [
  { key: 'pk910',   href: 'https://sepolia-faucet.pk910.de/' },
  { key: 'google',  href: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia' },
  { key: 'alchemy', href: 'https://www.alchemy.com/faucets/ethereum-sepolia' },
];

export default async function HowToPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('howTo');

  return (
    <Page title={t('title')} narrowContainer>
      <div className={styles.section}>
        <Box>
          <p className={styles.lead}>{t('lead')}</p>
        </Box>
      </div>

      {/* ── 用語 ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('terms.title')}</h2>
        <p className={styles.note}>{t('terms.note')}</p>
        <dl className={styles.terms}>
          {(['eth', 'datatoken', 'gas'] as const).map((k) => (
            <div key={k} className={styles.term}>
              <dt className={styles.termName}>{t(`terms.${k}.name`)}</dt>
              <dd className={styles.termBody}>{t(`terms.${k}.body`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── 手順 ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('steps.title')}</h2>
        <ol className={styles.steps}>
          {(['wallet', 'network', 'faucet', 'order'] as const).map((k, i) => (
            <li key={k} className={styles.step}>
              <span className={styles.stepNo} aria-hidden="true">{i + 1}</span>
              <div>
                <h3 className={styles.stepTitle}>{t(`steps.${k}.title`)}</h3>
                <p className={styles.stepBody}>{t(`steps.${k}.body`)}</p>
                {k === 'faucet' && (
                  <div className={styles.faucets}>
                    {FAUCETS.map((f) => (
                      <Button key={f.key} href={f.href} style="outline" size="small">
                        {t(`faucet.${f.key}`)}
                      </Button>
                    ))}
                  </div>
                )}
                {k === 'network' && (
                  <p className={styles.hint}>
                    {t('steps.network.hint', { chainId: registry.chainId })}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 詰まりやすいところ ───────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('trouble.title')}</h2>
        {(['noEth', 'wrongChain', 'noWallet', 'nothing'] as const).map((k) => (
          <div key={k} className={styles.trouble}>
            <h3 className={styles.troubleQ}>{t(`trouble.${k}.q`)}</h3>
            <p className={styles.troubleA}>{t(`trouble.${k}.a`)}</p>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <Box>
          <p className={styles.lead}>{t('readOnly')}</p>
          <div className={styles.faucets}>
            <Button to={`/${locale}/search`} style="primary" size="small">
              {t('toCatalog')}
            </Button>
          </div>
        </Box>
      </section>
    </Page>
  );
}
