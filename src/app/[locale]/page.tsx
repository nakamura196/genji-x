/**
 * トップ（ランディング）。**本家の構成に合わせる。**
 *
 * Ocean Market / Pontus-X / Clio-X のトップは一覧ではなく、
 *   Hero（題・説明・検索・行き先ボタン）→ 役割の選択 → 説明 → FAQ → 連絡先
 * という縦の流れになっている。一覧は /search にある。
 *
 * ここでもその形に合わせ、「役割の選択」を**この試作の 3 つの立場**に置き換えた。
 * 読む人 / 引用する人 / 検証する人。裏側への入口はここから入る。
 *
 * 寸法と色は globals.css の `.home-*` に出してある。JSX に生の値
 * （#fff や 2rem）を書くと、暗い表示のときに追随できないため。
 * `.home` は本家と同じ名前。stylesGlobal/styles.css の
 * 「トップだけ本文を Libre Baskerville にする」規則がこの名前を見ている。
 *
 * 枠は他のページと同じ `Page` に載せる。本家のトップも
 * `<Page ... noContainer headerCenter>` で、幅は節ごとに自前の Container が持つ
 * （Hero と「裏側」は地の色を画面いっぱいに敷くので、外側で幅を切れない）。
 * `<main>` は Page が出す。ここで自前の `<main>` を書くと二重になる。
 */
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { listVolumes, getWhole, registry, snapshot } from '@/lib/catalog';
import { Page } from '@/components/ported/Page';
import { Container } from '@/components/ported/atoms/Container';
import { BoxLink } from '@/components/ported/atoms/Box';
import { Button } from '@/components/ported/atoms/Button';
import { UPSTREAM_SITE } from '@/constants/metadata';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const base = `/${locale}`;
  /** 数字は帖だけで数える。全体版 (54 帖まとめて 1 件) は粒度が違うので混ぜない */
  const assets = listVolumes();
  const volumes = assets.length;
  const lines = assets.reduce((n, a) => n + (a.lines ?? 0), 0);
  const withProof = assets.filter((a) => a.proof).length;
  const whole = getWhole();

  const roles: { key: string; href: string }[] = [
    { key: 'read', href: `${base}/search` },
    { key: 'cite', href: `${base}/search` },
    { key: 'verify', href: `${base}/asset/01` },
  ];

  const stats: [string, string][] = [
    [String(volumes), t('stats.volumes')],
    [lines.toLocaleString(), t('stats.lines')],
    [String(withProof), t('stats.withProof')],
    ['0', t('stats.servers')],
  ];

  return (
    <Page noContainer className="home">
      {/* Hero。本家は背景画像に黒 60% を重ね、検索を上部中央に置く */}
      <section className="home-hero">
        <Container>
          {/*
            **Hero に検索欄を置かない。**
            本家 (Clio-X / Pontus-X Portal) の Hero は、背景画像・見出し・説明・
            ボタン 2 つだけで、検索はヘッダの虫めがねに任せている（実際に
            cliox.org を見て確かめた）。Hero に入力欄を置くと、
            「まず何か打たないと始まらない」画面に見える。
            この目録は 54 帖しかないので、まず一覧を見せるほうが早い。
          */}
          <div className="home-hero-body">
            <h1>{t('hero.title')}</h1>
            <p className="home-hero-lead">{t('hero.lead')}</p>
            <div className="home-hero-actions">
              <Button to={`${base}/search`} style="secondary" size="lg">
                {t('hero.browse')}
              </Button>
              <Button
                to={`${base}/asset/01`}
                style="outline"
                size="lg"
                className="home-hero-outline"
              >
                {t('hero.verify')}
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* 数字 */}
      <Container>
        <section className="home-stats">
          {stats.map(([value, label]) => (
            <div key={label}>
              <div className="home-stat-value">{value}</div>
              <div className="home-stat-label">{label}</div>
            </div>
          ))}
        </section>
      </Container>

      {/* 立場を選ぶ。本家の ChooseRole にあたる */}
      <Container>
        <section className="home-section">
          <h2 className="home-section-title">{t('roles.title')}</h2>
          <div className="home-roles">
            {roles.map((r) => (
              <BoxLink key={r.key} href={r.href} className="home-role">
                <h3>{t(`roles.${r.key}.title`)}</h3>
                <p>{t(`roles.${r.key}.body`)}</p>
              </BoxLink>
            ))}
          </div>

          {/* 54 帖をまとめた 1 件への入口。一覧には混ぜていないので、ここから辿る */}
          {whole && (
            <p className="home-whole">
              <Button to={`${base}/asset/${whole.slug}`} style="text" arrow>
                {t('whole.link')}
              </Button>
            </p>
          )}
        </section>
      </Container>

      {/*
        本家サイト (kouigenjimonogatari.github.io) との関係。**ここは正直に書く。**
        全文検索・SPARQL・IIIF・表示の速さは、どれも本家のほうが優れている。
        それを伏せると「置き換えるもの」に読まれ、実際に使う人の期待を外す。
        `t.has` で包んであるのは、文面 (messages) の追加が別の担当だから。
        キーが入る前でも MISSING_MESSAGE を出さずに、この節ごと出ないだけにする。
      */}
      {t.has('upstream.body') && (
        <Container>
          <section className="home-section">
            <h2 className="home-section-title">{t('upstream.title')}</h2>
            {/* 段落の体裁は globals.css の既定に任せる。ここだけの class は増やさない */}
            <p>{t('upstream.body')}</p>
            <p className="home-whole">
              <Button href={UPSTREAM_SITE} style="text">
                {t('upstream.link')}
              </Button>
            </p>
          </section>
        </Container>
      )}

      {/* 裏側 */}
      <section className="home-behind">
        <Container>
          <h2>{t('behind.title')}</h2>
          <p className="home-behind-body">{t('behind.body')}</p>
          {/* 狭い画面では横にはみ出して自分でスクロールする（overflow-x: auto）。
              スクロールする箱はキーボードでも動かせないといけないので、
              tabindex を入れて Tab で入れるようにする（axe:
              scrollable-region-focusable。狭い画面でだけ出る指摘だった）。 */}
          <pre className="home-lineage" tabIndex={0} role="group" aria-label={t('behind.title')}>{`oceanprotocol/market            2020-06 〜
  └─ deltaDAO/mvg-portal        Pontus-X Portal
       └─ ClioX-mvg-portal      Clio-X
            └─ Genji-X          ${t('behind.this')}`}</pre>
          <p className="home-readat">
            {t('behind.readAt', { block: snapshot.atBlock.toLocaleString(), anchor: registry.corpusAnchor })}
          </p>
        </Container>
      </section>
    </Page>
  );
}
