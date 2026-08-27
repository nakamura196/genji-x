/**
 * この試作について。
 *
 * 元は Next.js テンプレート付属の「会社概要」のサンプル文（架空の会社の
 * ミッションと沿革）がそのまま残っていて、ヘッダの「この試作について」を
 * 押すとそれが出ていた。中身を書き直し、体裁も Ocean Market 系の移植部品
 * （Page / PageContent）に載せ替えた。Tailwind の prose クラスで
 * 独自に組んでいた部分は、本家の PageMarkdown.module.css に寄せている。
 * 文面は messages に置く。ここに直接書くと英語版が付いてこないため。
 */
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { SITE_CONFIG, UPSTREAM_SITE } from '@/constants/metadata';
import { Page } from '@/components/ported/Page';
import { PageContent } from '@/components/ported/Page/PageContent';
import { Box } from '@/components/ported/atoms/Box';
import { Button } from '@/components/ported/atoms/Button';
import styles from './page.module.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: activeLocale, namespace: 'about' });
  const title = t('title');
  const description = t('lead');
  // 題の「| Genji-X」は layout の title.template が足す。ここでは付けない
  const url = `${SITE_CONFIG.url}/${activeLocale}/about`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { card: SITE_CONFIG.twitter.card, title, description },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');

  const sections = ['what', 'data', 'chain', 'lineage'] as const;

  return (
    <Page title={t('title')} description={t('lead')} narrowContainer>
      <PageContent>
        {sections.map((key) => (
          <section key={key}>
            <h2>{t(`${key}.title`)}</h2>
            <p>{t(`${key}.body`)}</p>
          </section>
        ))}

        {/* 54 帖をまとめた 1 件。帖の一覧には混ぜていないので、ここから辿れるようにする */}
        <section>
          <h2>{t('whole.title')}</h2>
          <p>{t('whole.body')}</p>
          <p>
            <Button to={`/${locale}/asset/all`} style="text" arrow>
              {t('whole.link')}
            </Button>
          </p>
        </section>

        {/*
          **本家サイトのほうが優れている点を、先に書く。**
          全文検索・SPARQL エンドポイント・IIIF での画像との対応づけ・表示の速さは、
          どれも本家 (kouigenjimonogatari.github.io) のほうが上で、ここは置き換えではない。
          先に「入れていないもの」だけを並べると、本家の機能を落とした劣化版に読める。
          主張してよいのは版の固定・引用の記録・第三者による検証・帖ごとの参照数の 4 つだけ。

          `t.has` で包んであるのは、文面 (messages) の追加が別の担当だから。
          キーが入る前でも MISSING_MESSAGE を出さず、この節ごと出ないだけにする。
        */}
        {t.has('upstream.body') && (
          <section>
            <h2>{t('upstream.title')}</h2>
            <p>{t('upstream.body')}</p>
            <ul>
              {(['item1', 'item2', 'item3', 'item4'] as const).map((k) => (
                <li key={k}>{t(`upstream.${k}`)}</li>
              ))}
            </ul>
            <p>
              <Button href={UPSTREAM_SITE} style="text">
                {t('upstream.link')}
              </Button>
            </p>
          </section>
        )}

        <section>
          <h2>{t('missing.title')}</h2>
          <p>{t('missing.body')}</p>
          <ul>
            {(['item1', 'item2', 'item3', 'item4'] as const).map((k) => (
              <li key={k}>{t(`missing.${k}`)}</li>
            ))}
          </ul>
        </section>

        {/*
          注意書きだけは箱に入れて本文から浮かせる。
          「テストネットである」「root を記録したのは公開者ひとり」は、
          読み飛ばされると受け取り方を間違える種類の断り書きなので。
        */}
        <section>
          <Box className={styles.caveat}>
            <h2>{t('caveat.title')}</h2>
            <p>{t('caveat.body')}</p>
          </Box>
        </section>
      </PageContent>
    </Page>
  );
}
