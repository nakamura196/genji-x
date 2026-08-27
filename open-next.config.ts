/**
 * Cloudflare Workers で Next.js を動かすための設定。
 *
 * このカタログは **サーバ側で鍵を持たず、実行時にチェーンも読まない**。
 * ページはビルド時に全部作られていて、Worker がするのは配ることと、
 * next-intl の言語振り分け (proxy.ts) だけである。
 *
 * だから KV も D1 も要らない。Vercel でもそのまま動く。
 * 「誰かのサーバに依存しない」という主張を、配備の形でも保っている。
 */
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
