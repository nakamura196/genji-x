/**
 * 1 帖の詳細。**本家 (Ocean Market / Pontus-X Portal / Clio-X) の詳細ページと
 * 同じ 2 カラム**にする。段組と DOM は移植した AssetContent が持つ。
 *
 * ── なぜ 2 カラムに戻したか ──────────────────────────────────
 * これまで 1 カラムの縦積みで、「取得」も「自分で確かめる」も本文のずっと下に
 * あった。本家は **左が動かない事実、右が読者が起こす行為**という分け方で、
 * 幅の広い画面ならどちらも一目に入る。買うものが無いだけで、この分け方は
 * こちらでも成り立つ。右に置くのは価格と購入ではなく、参照回数と取得。
 *
 * ── 画面の順番の意図（左カラム）────────────────────────────
 *   1. 帯（所有者・datatoken・第何帖・公開日）
 *   2. 説明（DDO に入っている本文そのもの）
 *   3. 本文への入口（CC0 なので隠さない。関所ではないことを示す）
 *   4. 生の値（DID・アドレス・葉ハッシュ・root）
 *
 * Etherscan が汎用ゆえに出してしまう紛らわしい表示
 * (DispenserCreated / 1 of ○○ / Holders が空) は 1 つも出さない。
 */
import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Page } from '@/components/ported/Page';
import { AssetContent } from '@/components/ported/AssetContent';
import { getAsset, readAnchors, registry } from '@/lib/catalog';
import { EXPLORER } from '@/lib/chain';
import { gatewayUrl } from '@/lib/merkle-browser';
import styles from './page.module.css';

/**
 * **再検証しない（ISR を使わない）。**
 *
 * この画面はビルド時にチェーンを読んで、静的に書き出している。
 * 5 分ごとに作り直す設定にしていたが、本番 (Cloudflare Workers / OpenNext) で
 * **RSC の先読みが 500 を返していた**。ISR は保存領域 (R2 や KV) を要求するのに、
 * この Worker はバインディングを 1 つも持っていないため。
 *
 * 直し方は 2 つあった。保存領域を足すか、再検証をやめるか。
 * **やめるほうを選んだ。** 再検証で拾える差分は「同じ root を刻んだ観測者の数」だけで、
 * これは滅多に増えない。参照回数のほうは、もともとブラウザが公開 RPC から
 * その場で数え直している。**サーバで動く処理を持たない**という方針とも合う。
 *
 * 新しい記録を画面に出したくなったら、作り直して配り直せばよい。
 */
export const dynamic = 'force-static';

export default async function AssetPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('asset');

  const a = getAsset(slug);
  if (!a) notFound();

  /**
   * root の記録は増えない (刻んだら終わり) のでサーバ側で取る。
   * 参照回数は増えるのでクライアント側 (AssetActions の中) で数える。
   */
  const anchors = a.proof
    ? await readAnchors(
        a.proof.chapterRoot,
        a.proof.corpusAnchor,
        a.proof.corpusAnchorFromBlock ?? registry.corpusAnchorFromBlock
      ).catch(() => ({ records: [], observers: 0 }))
    : { records: [], observers: 0 };

  /**
   * 説明・作者・日付・タグは DDO の metadata そのもの。catalog.ts の Asset に
   * 載せたので、ここで snapshot.json を開き直さない（写しの形を知る場所を増やさない）。
   */
  const ddo = {
    description: a.description,
    author: a.author,
    created: a.created,
    updated: a.updated,
    tags: a.tags,
  };
  /* ゲートウェイの選び方は lib/merkle-browser.ts に 1 か所だけ書いてある。
     ここで直に書くと、ボット判定で落ちる先を指したまま気づけない */
  const gateway = gatewayUrl(a.ipfsCid);

  return (
    /* **Page を使う。** ここも `<main>` を持っていなかった（検索画面と同じ問題）。
       余白を測るテストが対象を 1 つも見つけられず、空のまま通っていた */
    <Page title={a.name} className={styles.page}>

      <AssetContent
        asset={a}
        ddo={ddo}
        publisher={registry.publisher}
        explorer={EXPLORER}
        network="Sepolia"
        gateway={gateway}
        anchors={{ records: anchors.records.length, observers: anchors.observers }}
        locale={locale}
        labels={{
          meta: {
            ownedBy: t('meta.ownedBy'),
            accessedWith: t.raw('meta.accessedWith') as string,
            // 種別の枠には「第何帖か」を入れる。本家の dataset / algorithm と同じ格
            type: a.volumeNumber ? t('volume', { n: a.volumeNumber }) : t('whole'),
            access: t('meta.access'),
            published: t('meta.published'),
            updated: t('meta.updated'),
          },
          sample: {
            title: t('read.title'),
            button: t('read.button'),
            notes: [t('read.lead'), t('read.xmlNote')],
          },
          raw: {
            author: t('raw.author'),
            owner: t('raw.owner'),
            did: t('raw.did'),
            nft: t('raw.nft'),
            datatoken: t('raw.datatoken'),
            lines: t('raw.lines'),
            bytes: t('raw.bytes'),
            waka: t('raw.waka'),
            ddo: t('raw.ddo'),
            ddoValue: t.raw('raw.ddoValue') as string,
            leaf: t('raw.leaf'),
            root: t('raw.root'),
            anchor: t('raw.anchor'),
            anchorCount: t.raw('raw.anchorCount') as string,
            // 値の出どころの印。チェーンの記録・公開者の申告・手元の集計を分ける
            sources: t.raw('raw.sources') as Record<'ddo' | 'chain' | 'tei',
              { short: string; help: string }>,
          },
          rawTitle: t('raw.title'),
          rawLegend: t.raw('raw.legend') as { chain: string; ddo: string; tei: string },
          caveat: t('caveat'),
        }}
        actions={{
          datatoken: a.datatoken,
          fromBlock: registry.corpusAnchorFromBlock,
          cid: a.ipfsCid,
          proof: a.proof,
          // 写しの回数。数え直し (client) が届くまでのあいだ、これを出す
          fallbackOrders: a.usage?.orders ?? null,
          links: {
            nft: `${EXPLORER}/address/${a.nft}`,
            datatoken: `${EXPLORER}/address/${a.datatoken}`,
            anchor: a.proof ? `${EXPLORER}/address/${a.proof.corpusAnchor}` : null,
          },
          labels: {
            count: t('count.title'),
            countLoading: t('count.loading'),
            get: {
              get: t('get.button'),
              connecting: t('get.connecting'),
              signing: t('get.signing'),
              waiting: t('get.waiting'),
              done: t('get.done'),
              again: t('get.again'),
              noWallet: t('get.noWallet'),
              wrongChain: t('get.wrongChain'),
              receipt: t('get.receipt'),
              note: t('get.note'),
              howTo: t('get.howTo'),
              howToHref: `/${locale}/how-to`,
              copy: t('get.copy'),
              copied: t('get.copied'),
            },
            verifyTitle: t('verify.title'),
            verifyLead: a.proof
              ? t('verify.lead', {
                  proof: a.proof.inclusionProof.length,
                  bytes: a.proof.inclusionProof.length * 32,
                  total: a.proof.treeSize,
                })
              : '',
            verify: {
              run: t('verify.run'),
              running: t('verify.running'),
              again: t('verify.again'),
              fetch: t('verify.step.fetch'),
              hash: t('verify.step.hash'),
              fold: t('verify.step.fold'),
              done: t('verify.ok'),
              failed: t('verify.ng'),
              note: t('verify.note'),
              preview: t('verify.preview'),
              previewNote: t('verify.previewNote'),
            },
            behind: t('behind.title'),
            behindNft: t('raw.nft'),
            behindDt: t('raw.datatoken'),
            behindAnchor: t('raw.anchor'),
          },
        }}
      />
    </Page>
  );
}

export async function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    registry.assets.map((a) => ({ locale, slug: a.slug }))
  );
}
