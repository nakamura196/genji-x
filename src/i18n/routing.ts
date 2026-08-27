import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'ja'],

  // Used when no locale matches
  defaultLocale: 'ja',

  /**
   * **常に言語接頭辞を付ける。** middleware を使わないため。
   *
   * Next 16 の proxy (旧 middleware) は Edge runtime に対応せず、
   * OpenNext (Cloudflare) は Node runtime の middleware に対応していない。
   * どちらも直せないので、middleware そのものを無くした。
   *
   * このカタログは全ページがビルド時に作られる静的なページなので、
   * 言語の振り分けに実行時の処理が要らない。Accept-Language による
   * 自動判定は失われるが、/ から /ja への案内を 1 枚置けば足りる。
   */
  localePrefix: 'always',
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
