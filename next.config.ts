import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // サブディレクトリでのホスティングに対応
  basePath,
  /**
   * Next 16 の開発サーバは、別オリジンからの要求を 403 で弾く。
   * **127.0.0.1 と localhost を別物とみなす**ので、片方で開くと
   * JS が全部 403 になり、画面は出るのに何も動かない（hydration が起きない）状態になる。
   * curl は Origin を送らないので 200 が返り、原因が見えにくい。
   * Playwright が 127.0.0.1 を使うため、両方を許可する。
   */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  /**
   * `/` に来た人を既定の言語へ送る。
   * 以前は src/app/page.tsx の redirect() で行っていたが、Next 16.4 は
   * ルートの page.tsx にルートレイアウトを要求するようになった。
   * レイアウトは [locale] の下にあるので、設定側の redirects に移した。
   */
  async redirects() {
    return [{ source: '/', destination: '/ja' /* routing.defaultLocale と同じ */, permanent: false }];
  },
};

export default withNextIntl(nextConfig);

// `next dev` でも Cloudflare の実行環境に寄せる。
// このアプリはバインディングを持たないので、主に挙動を本番に近づけるため。
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
