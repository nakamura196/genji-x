/**
 * robots.txt。
 *
 * この目録は**見つけてもらうために作っている**（研究者が「桐壺」で検索して
 * 辿り着けること）ので、全部を索引に載せる。
 * 除くのは、内容の無い転送先だけ。
 */
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/constants/metadata';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
