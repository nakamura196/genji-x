/**
 * サイトマップ。**55 件の資産と、そこから指すコントラクトを全部載せる。**
 *
 * テンプレート由来のものは静的な 3 ページしか出していなかった。
 * この目録の値打ちは「帖ごとに引ける」ことなので、帖のページが索引に載らないと
 * 意味がない。registry から機械的に作る。
 *
 * localePrefix は 'always' なので、既定の ja にも接頭辞が付く。
 * 接頭辞なしの URL を出すと転送される URL を巡回させることになるので出さない。
 */
import { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/constants/metadata';
import registry from '@/data/registry.json';
import contracts from '@/data/contracts.json';
import txData from '@/data/transactions.json';

export const dynamic = 'force-static';
export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const out: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    const base = `${SITE_URL}/${locale}`;

    out.push({ url: base, lastModified: now, changeFrequency: 'daily', priority: 1 });
    out.push({ url: `${base}/search`, lastModified: now, changeFrequency: 'daily', priority: 0.9 });
    out.push({ url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 });
    // チェーンに氏名を置かない代わりの、身元の名乗り
    out.push({ url: `${base}/publisher`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 });
    // 参照を記録するのに何が要るか（ガス代の入手先を含む）
    out.push({ url: `${base}/how-to`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 });

    // 資産 55 件。これが本体
    for (const a of registry.assets) {
      out.push({
        url: `${base}/asset/${a.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: a.slug === 'all' ? 0.9 : 0.8,
      });
    }

    // 取引の説明。契約と同じく裏側の層
    for (const t of txData.transactions) {
      out.push({
        url: `${base}/tx/${t.hash}`,
        lastModified: now,
        changeFrequency: 'yearly',   // 取引は後から変わらない
        priority: 0.3,
      });
    }

    // コントラクトの説明。裏側の層なので優先度は下げる
    for (const address of Object.keys(contracts.contracts)) {
      out.push({
        url: `${base}/contract/${address}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.3,
      });
    }
  }

  return out;
}
