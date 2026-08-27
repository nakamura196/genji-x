import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import Header from '@/components/ported/Header';
import './globals.css';
/* Ocean Market の全体スタイル（移植）。Tailwind の後に読んで、こちらを土台にする */
import '@/stylesGlobal/styles.css';
import Footer from '@/components/ported/Footer';
import { ThemeProvider } from 'next-themes';
import { getMetadata } from '@/constants/metadata';
import { getTranslations } from 'next-intl/server';
import registry from '@/data/registry.json';
import { gatewayUrl } from '@/lib/merkle-browser';
import type { Metadata } from 'next';

/**
 * **書体は next/font ではなく、移植した fonts.css に任せる。**
 *
 * ここで next/font の Inter を body に当てていたため、移植した
 * IBM Plex Sans / Libre Baskerville が一度も画面に出ていなかった。
 * next/font はクラス名で font-family を直接指定するので、
 * 変数 (--font-family-base) を使う移植側の指定より強い。
 *
 * 実体は public/static/fonts/ の 4 ファイルで、
 * stylesGlobal/_variables.css が @import している。
 * 日本語の字は IBM Plex Sans に入っていないので、
 * --font-family-base の後半で日本語の書体を並べてある。
 */

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
  return getMetadata(activeLocale);
}

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // SSR対応
  setRequestLocale(locale);
  const t = await getTranslations('site');

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/*
          **`__name` の受け皿。next-themes より前に置く。**

          next-themes は「暗い表示かどうか」を決める処理を、関数を
          `toString()` して <script> に埋め込む形で出す。ページが描かれる前に
          class を付けて、切り替わる瞬間のちらつきを防ぐためである。

          ところが Cloudflare 向けに束ねるとき、esbuild が `keepNames` を有効にして
          関数名を保つための `__name(k2, "k2")` という呼び出しを差し込む。
          差し込まれるのは**サーバ側の束ね物**だが、next-themes はその
          「差し込まれたあとの関数」を toString() するので、
          **ブラウザに届く文字列にも `__name(...)` が残る**。
          ブラウザ側にその関数は無いので `ReferenceError` になる。

          本番でだけ起きる（開発サーバは esbuild で束ねない）。
          実際、配ったあとにコンソールで初めて気づいた。

          何もしない関数を先に置いておけば、呼ばれても素通りする。
          名前を保つのは束ね物の中の話なので、ここでは何も壊さない。
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.__name||(window.__name=function(f){return f});',
          }}
        />
      </head>
      <body className="sticky-footer">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          disableTransitionOnChange
        >
          {/* messages are inherited from the request config (next-intl v4) */}
          <NextIntlClientProvider>
            <Header locale={locale} />
            {/* ページが <main> を持つとは限らないので、レイアウト側で包んで伸ばす。
                これが無いと、コンテンツが短いページでフッタが画面の途中に止まる */}
            <div className="page-body">{children}</div>
            <Footer
              groups={[
                {
                  title: t('footer.material'),
                  links: [
                    { label: t('footer.source'), href: 'https://kouigenjimonogatari.github.io/' },
                    { label: t('footer.repo'), href: 'https://github.com/kouigenjimonogatari/kouigenjimonogatari.github.io' },
                    { label: 'IPFS', href: gatewayUrl(registry.assets[0].ipfsCid) },
                  ],
                },
                {
                  title: t('footer.chain'),
                  links: [
                    { label: t('footer.anchor'), href: `https://sepolia.etherscan.io/address/${registry.corpusAnchor}` },
                    { label: 'Sourcify', href: `https://repo.sourcify.dev/11155111/${registry.corpusAnchor}` },
                    /* チェーンに氏名を置かない代わりに、身元はここで名乗る。
                       たどり着けない場所に置くと、名乗っていないのと同じになる */
                    { label: t('footer.publisher'), href: `/${locale}/publisher` },
                    /* 参照を記録するのに何が要るか。ガス代の入手先も含む */
                    { label: t('footer.howTo'), href: `/${locale}/how-to` },
                  ],
                },
                {
                  title: t('footer.lineage'),
                  links: [
                    { label: 'Ocean Market', href: 'https://github.com/oceanprotocol/market' },
                    { label: 'Pontus-X Portal', href: 'https://github.com/deltaDAO/mvg-portal' },
                    { label: 'Clio-X', href: 'https://github.com/ciferresearch/ClioX-mvg-portal' },
                  ],
                },
              ]}
              beta={t('footer.beta')}
              bottom={t('footer.bottom')}
            />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
