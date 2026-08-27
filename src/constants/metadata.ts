/**
 * サイト全体のメタ情報。app/sitemap.ts からも読むので、ここを唯一の出どころにする。
 *
 * ── 位置づけ ────────────────────────────────────────────────────
 * これは **本家サイト (kouigenjimonogatari.github.io) の web3 版**である。
 * 対象は作品そのものではなく、そこで公開している **TEI/XML のテキストデータベース**。
 * 題に「テキストDB」を入れないと、源氏物語一般の web3 版に読まれてしまう。
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/** 本家サイト。ここでの主張は「本家にできないことだけ」に絞る */
export const UPSTREAM_SITE = 'https://kouigenjimonogatari.github.io/';

export const SITE_CONFIG = {
  shortName: 'Genji-X',
  name: {
    ja: '校異源氏物語テキストDB — web3 版',
    en: 'Kouigenji Monogatari Text DB — web3 edition',
  },
  description: {
    ja: '校異源氏物語（池田亀鑑『校異源氏物語』中央公論社 を底本とする TEI/XML、54 帖・25,065 行）を'
      + 'チェーンと IPFS に載せた版。本文は CC0 で、読むのに手続きは要りません。'
      + '各帖には「刻まれた全体の一部である」ことを、他の帖を見ずに確かめる証明が付いています。',
    en: 'A chain-and-IPFS edition of the Kouigenji Monogatari text database '
      + '(TEI/XML from Ikeda Kikan, Chuokoron-sha; 54 volumes, 25,065 lines). The text is CC0 and needs '
      + 'no permission to read. Each volume carries a proof that it belongs to the anchored '
      + 'whole, checkable without touching the other volumes.',
  },
  /**
   * **チェーンの DDO に書いてある値と一致させる。** DDO の author は
   * 'Satoru Nakamura / 中村 覚' で、所属は入っていない。
   *
   * 所属は当初こちらで足していたが、チェーンにも本家サイトの該当箇所にも無い情報を
   * 画面や構造化データに足すと、どこまでが記録でどこからが装飾か分からなくなる。
   * **画面はチェーンの記録を映すだけにする。**
   */
  author: 'Satoru Nakamura / 中村 覚',
  license: 'https://creativecommons.org/publicdomain/zero/1.0/',
  keywords: {
    ja: ['校異源氏物語', '源氏物語', 'TEI', 'デジタルアーカイブ', 'デジタルヒューマニティーズ',
      '古典籍', '池田亀鑑', 'IPFS', 'ブロックチェーン', 'Ocean Protocol', 'Merkle'],
    en: ['Kouigenji Monogatari', 'Genji Monogatari', 'TEI', 'digital archive',
      'digital humanities', 'Japanese classics', 'Ikeda Kikan', 'IPFS', 'blockchain',
      'Ocean Protocol', 'Merkle tree'],
  },
  url: SITE_URL,
  ogImage: { ja: '/ogp-ja.svg', en: '/ogp-en.svg' },
  twitter: { card: 'summary_large_image' as const },
} as const;

export const getMetadata = (locale: 'ja' | 'en') => {
  const title = SITE_CONFIG.name[locale];
  const description = SITE_CONFIG.description[locale];
  const ogImage = SITE_CONFIG.ogImage[locale];
  const other = locale === 'ja' ? 'en' : 'ja';

  return {
    title: { default: title, template: `%s | ${SITE_CONFIG.shortName}` },
    description,
    metadataBase: new URL(SITE_CONFIG.url),
    keywords: [...SITE_CONFIG.keywords[locale]],
    authors: [{ name: SITE_CONFIG.author }],
    creator: SITE_CONFIG.author,
    publisher: SITE_CONFIG.author,
    // 言語ごとの正典 URL。localePrefix: 'always' なので両方に接頭辞が付く
    alternates: {
      canonical: `${SITE_CONFIG.url}/${locale}`,
      languages: {
        ja: `${SITE_CONFIG.url}/ja`,
        en: `${SITE_CONFIG.url}/en`,
        'x-default': `${SITE_CONFIG.url}/ja`,
      },
    },
    openGraph: {
      type: 'website' as const,
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      alternateLocale: other === 'ja' ? 'ja_JP' : 'en_US',
      url: `${SITE_CONFIG.url}/${locale}`,
      siteName: SITE_CONFIG.shortName,
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: SITE_CONFIG.twitter.card,
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true, follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' as const,
        'max-snippet': -1, 'max-video-preview': -1 },
    },
  };
};

/**
 * ページごとのメタ情報。
 *
 * 題の「| Genji-X」は layout の title.template が足すので、ここでは付けない。
 * 正典 URL と言語の対応を毎回書くと漏れるので、ここにまとめる。
 */
export const getPageMetadata = (
  locale: 'ja' | 'en',
  page: { title: string; description: string; path: string; image?: string }
) => {
  const url = `${SITE_CONFIG.url}/${locale}${page.path}`;
  const image = page.image ?? SITE_CONFIG.ogImage[locale];
  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: url,
      languages: {
        ja: `${SITE_CONFIG.url}/ja${page.path}`,
        en: `${SITE_CONFIG.url}/en${page.path}`,
        'x-default': `${SITE_CONFIG.url}/ja${page.path}`,
      },
    },
    openGraph: {
      type: 'article' as const,
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      url,
      siteName: SITE_CONFIG.shortName,
      title: page.title,
      description: page.description,
      images: [{ url: image, width: 1200, height: 630, alt: page.title }],
    },
    twitter: {
      card: SITE_CONFIG.twitter.card,
      title: page.title,
      description: page.description,
      images: [image],
    },
  };
};
