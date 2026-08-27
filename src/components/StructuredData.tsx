/**
 * schema.org の構造化データ（JSON-LD）。
 *
 * ── なぜ入れるのか ──────────────────────────────────────────────
 * この目録は TEI/XML のデータセットである。schema.org/Dataset で書いておくと
 * **Google Dataset Search に載る**。デジタルアーカイブの資料が研究者に
 * 見つかる経路として、これが実際にいちばん効く。
 *
 * ── 何を書くか ──────────────────────────────────────────────────
 * 嘘を書かないこと。distribution には**実際に取り出せる URL** だけを入れる。
 * IPFS のゲートウェイは落ちることがあるが、CID 自体は場所に依存しないので
 * identifier に ipfs:// を、distribution には公開ゲートウェイ経由の URL を置く。
 *
 * DID (did:op:…) も identifier に入れる。Ocean の目録から引ける名前である。
 */
import { SITE_CONFIG, SITE_URL, UPSTREAM_SITE } from '@/constants/metadata';
import { gatewayUrl } from '@/lib/merkle-browser';

const JsonLd = ({ data }: { data: unknown }) => (
  <script
    type="application/ld+json"
    // 生成元は自分のデータだけ。外から来た文字列は入れない
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
  />
);

/** サイト全体。トップに 1 回だけ置く */
export function SiteJsonLd({ locale }: { locale: 'ja' | 'en' }) {
  return (
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_CONFIG.name[locale],
      alternateName: SITE_CONFIG.shortName,
      url: `${SITE_URL}/${locale}`,
      inLanguage: locale === 'ja' ? 'ja' : 'en',
      description: SITE_CONFIG.description[locale],
      isBasedOn: UPSTREAM_SITE,
      creator: { '@type': 'Person', name: SITE_CONFIG.author },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/${locale}/search?q={q}` },
        'query-input': 'required name=q',
      },
    }} />
  );
}

/** 帖 1 件（または全体）。Google Dataset Search はこれを読む */
export function DatasetJsonLd({
  locale, name, description, slug, cid, did, lines, bytes, volumeNumber, sourceCommit,
}: {
  locale: 'ja' | 'en';
  name: string;
  description: string;
  slug: string;
  cid: string;
  did?: string | null;
  lines?: number | null;
  bytes?: number | null;
  volumeNumber?: number | null;
  sourceCommit?: string | null;
}) {
  const url = `${SITE_URL}/${locale}/asset/${slug}`;
  const identifiers = [`ipfs://${cid}`, ...(did ? [did] : [])];

  return (
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name,
      description,
      url,
      identifier: identifiers,
      license: SITE_CONFIG.license,
      // CC0 なので誰でも使える。ここを曖昧にしない
      isAccessibleForFree: true,
      inLanguage: 'ja',
      keywords: [...SITE_CONFIG.keywords[locale]],
      // チェーンの DDO に書いてある値だけを出す。所属は DDO に無いので出さない
      creator: { '@type': 'Person', name: SITE_CONFIG.author },
      publisher: { '@type': 'Person', name: SITE_CONFIG.author },
      isBasedOn: UPSTREAM_SITE,
      encodingFormat: 'application/tei+xml',
      ...(bytes ? { contentSize: `${bytes} B` } : {}),
      ...(volumeNumber ? { position: volumeNumber } : {}),
      ...(sourceCommit ? { version: sourceCommit } : {}),
      ...(lines ? {
        variableMeasured: {
          '@type': 'PropertyValue',
          name: locale === 'ja' ? '行数 (seg 要素)' : 'lines (seg elements)',
          value: lines,
        },
      } : {}),
      distribution: [
        {
          '@type': 'DataDownload',
          encodingFormat: 'application/tei+xml',
          contentUrl: gatewayUrl(cid),
          name: 'IPFS (gateway.pinata.cloud)',
        },
        {
          '@type': 'DataDownload',
          encodingFormat: 'application/tei+xml',
          contentUrl: `https://ipfs.filebase.io/ipfs/${cid}`,
          name: 'IPFS (filebase.io)',
        },
      ],
    }} />
  );
}

/** パンくず。検索結果に階層が出る */
export function BreadcrumbJsonLd({
  locale, items,
}: {
  locale: 'ja' | 'en';
  items: { name: string; path: string }[];
}) {
  return (
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        item: `${SITE_URL}/${locale}${it.path}`,
      })),
    }} />
  );
}
