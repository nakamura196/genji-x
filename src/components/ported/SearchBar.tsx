'use client';
/**
 * 検索と絞り込み。**本家は Aquarius に Elasticsearch のクエリを投げている。**
 *
 * こちらは 55 件しかないので、全部メモリに載る。配列を絞るだけで足りる。
 * Ocean が索引サーバを要る理由は規模（複数チェーンに数千件）であって、
 * 仕組みの必然ではない。ここではその差がそのまま「サーバが要らない」に効いている。
 *
 * 見た目は Ocean Market / Pontus-X Portal / Clio-X の検索ページの左側
 * （cliox/src/components/Search/Filter.tsx）に合わせる。Apache-2.0。
 * あちらは折りたたみの箱が並ぶが、こちらは項目が 3 つしかないので常に開いている。
 * DOM の入れ子とクラス名は本家と同じにしてある。
 *
 * **件数はここに出さない。** 本家は件数をページの見出し (h1) として出しており、
 * 絞り込みの側には置いていない。以前ここに 12px の小さな字で出していたが、
 * 絞った結果が何件になったかは一覧の側の情報なので、AssetList の頭へ移した。
 */
import { useMemo, useState, useEffect, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import teiFacets from '@/data/tei-facets.json';
import styles from './SearchBar.module.css';
import type { Asset } from '@/lib/catalog';

/** 何も購読しない。useSyncExternalStore を「いまクライアントか」の判定だけに使う */
const subscribeNothing = () => () => {};

export type SortKey = 'volume' | 'orders' | 'lines' | 'waka';

/**
 * 和歌の数による絞り込み。**チェーンではなく TEI から数えた値で絞る。**
 *
 * 最初は「和歌を含む」という有無のチェックにしようとしたが、**全 54 帖が
 * 1 首以上持っていた**（最少は匂宮と夢浮橋の 1 首、最多は須磨の 48 首）。
 * 有無では 1 件も絞れないので、数の帯にした。区切りは実際の分布から取っている
 * （1–4 が 9 帖、5–9 が 10 帖、10–19 が 19 帖、20 以上が 16 帖）。
 */
export type WakaBand = 'any' | '1-4' | '5-9' | '10-19' | '20+';

const WAKA_BANDS: { key: WakaBand; test: (n: number) => boolean }[] = [
  { key: '1-4', test: (n) => n >= 1 && n <= 4 },
  { key: '5-9', test: (n) => n >= 5 && n <= 9 },
  { key: '10-19', test: (n) => n >= 10 && n <= 19 },
  { key: '20+', test: (n) => n >= 20 },
];

const inBand = (band: WakaBand, n: number | null) =>
  band === 'any' || (n != null && (WAKA_BANDS.find((b) => b.key === band)?.test(n) ?? true));

export type SearchLabels = {
  filters: string;
  placeholder: string;
  onlyProof: string;
  sortBy: string;
  volume: string;
  orders: string;
  lines: string;
  waka: string;
  /** 「和歌の数」の見出し */
  wakaTitle: string;
  /** この帯は TEI から数えた値だと断る 1 行 */
  wakaNote: string;
  wakaAny: string;
  wakaBands: Record<Exclude<WakaBand, 'any'>, string>;
  count: string;
  clear: string;
  noResults: string;
};

/**
 * 絞り込みの一致に使う文字列を集める。
 *
 * **漢字の巻名は素材から読む。** TEI の `<title type="alt">` に入っている
 * （表記は東京大学附属図書館の一覧による）。以前はこちらで書いた対応表を
 * 持っていたが、資料が持つようになったので消した。
 *
 * 空白や括弧を落とした形でも当たるようにする（「若菜 上」を「若菜上」で、
 * 「朝顔（槿）」を「朝顔」や「槿」で探す人がいる）。
 *
 * **画面に出す巻名は必ず元の値（歴史的仮名遣い）。** 言い換えて表示はしない。
 */
const ALT = teiFacets.volumes as Record<string, { title: string | null; titleAlt: string | null }>;

const variants = (s: string) => {
  const out = new Set<string>([s]);
  if (s.includes(' ')) out.add(s.replaceAll(' ', ''));
  const m = s.match(/^(.+)（(.+)）$/);
  if (m) { out.add(m[1]); out.add(m[2]); }
  return [...out];
};

const haystack = (a: Asset) => {
  const slug = a.volumeNumber ? String(a.volumeNumber).padStart(2, '0') : null;
  const alt = slug ? ALT[slug]?.titleAlt : null;
  return [a.name, a.volumeTitle, a.symbol, String(a.volumeNumber ?? ''),
    ...(alt ? variants(alt) : [])]
    .filter(Boolean).map((x) => String(x).toLowerCase());
};

export function useAssetFilter(assets: Asset[], counts: Record<string, { orders: number }> | null) {
  /**
   * **URL の `?q=` を読む。**
   *
   * ヘッダと Hero の検索欄は `/search?q=…` に送っているのに、受け取る側が
   * 無かった。`?q=きり` を開いても 54 件のまま出ていた。
   * 打ち替えたら URL 側も書き換える（履歴は積まない）。目録なので、
   * 絞った状態のまま人に渡せることに意味がある。
   */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [q, setQ] = useState(urlQ);

  /**
   * 戻る・進むや、別の画面から `?q=` 付きで来たときに追随する。
   *
   * **効果 (useEffect) の中で setState しない。** 描画のあとにもう一度描き直すことになり、
   * React コンパイラの検査も「連鎖した再描画」として警告する。
   * 代わりに、**描画中に「URL が前回と変わったか」を見て直す**
   * （React が「props が変わったときの state の調整」として案内している書き方）。
   * この直しは同じ描画の中で完了するので、画面が 2 度描かれない。
   */
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    setQ(urlQ);
  }

  useEffect(() => {
    const now = params.get('q') ?? '';
    if (now === q) return;
    const next = new URLSearchParams(params.toString());
    if (q) next.set('q', q); else next.delete('q');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // params を依存に入れると、書き換え → 再実行 の往復になる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const [onlyProof, setOnlyProof] = useState(false);
  const [waka, setWaka] = useState<WakaBand>('any');
  const [sort, setSort] = useState<SortKey>('volume');

  /** 帯ごとの件数。絞る前の全件から数えるので、選んでも数字が動かない */
  const wakaCounts = useMemo(() => {
    const out = {} as Record<WakaBand, number>;
    out.any = assets.length;
    for (const b of WAKA_BANDS) out[b.key] = assets.filter((a) => a.waka != null && b.test(a.waka)).length;
    return out;
  }, [assets]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = assets.filter((a) => {
      if (onlyProof && !a.proof) return false;
      if (!inBand(waka, a.waka)) return false;
      if (!needle) return true;
      return haystack(a).some((s) => s.includes(needle));
    });
    const orders = (a: Asset) => counts?.[a.datatoken.toLowerCase()]?.orders ?? 0;
    return [...out].sort((x, y) => {
      if (sort === 'orders') return orders(y) - orders(x);
      if (sort === 'lines') return (y.lines ?? 0) - (x.lines ?? 0);
      if (sort === 'waka') return (y.waka ?? 0) - (x.waka ?? 0);
      return (x.volumeNumber ?? 0) - (y.volumeNumber ?? 0);
    });
  }, [assets, counts, q, onlyProof, waka, sort]);

  /** 既定から動いているか。動いているときだけ「条件を外す」を出す */
  const isDirty = q !== '' || onlyProof || waka !== 'any' || sort !== 'volume';
  const clear = () => { setQ(''); setOnlyProof(false); setWaka('any'); setSort('volume'); };

  return {
    q, setQ, onlyProof, setOnlyProof, waka, setWaka, wakaCounts,
    sort, setSort, filtered, isDirty, clear,
  };
}

export function SearchBar({
  q, setQ, onlyProof, setOnlyProof, waka, setWaka, wakaCounts,
  sort, setSort, isDirty, clear, labels,
}: {
  q: string; setQ: (v: string) => void;
  onlyProof: boolean; setOnlyProof: (v: boolean) => void;
  waka: WakaBand; setWaka: (v: WakaBand) => void;
  wakaCounts: Record<WakaBand, number>;
  sort: SortKey; setSort: (v: SortKey) => void;
  isDirty: boolean; clear: () => void;
  labels: SearchLabels;
}) {
  /**
   * **絞り込みが実際に効くようになったか**を DOM に出す。
   *
   * サーバ側で描いた HTML の時点でも入力欄は見えるが、React が繋がるまでは
   * 打っても何も起きない。テストがその隙間に打ち込んで、
   * **URL も件数も変わらないまま落ちていた**（狭い画面でだけ再現した。
   * 広い画面はたまたま間に合っていた）。
   * 人にとっても同じ隙間はあるので、目印を出すのは検査のためだけではない。
   */
  /**
   * サーバでは false、クライアントでは true を返す。
   * `useState(false)` + `useEffect(() => setReady(true))` でも同じ結果になるが、
   * それだと描画がもう一往復し、React コンパイラの検査にも引っかかる。
   * **「サーバでの値」と「クライアントでの値」を React に直接教える**ほうが素直。
   * ヘッダのウォレット (components/ported/Wallet) でも同じ書き方をしている。
   */
  const ready = useSyncExternalStore(subscribeNothing, () => true, () => false);
  // 親 (.filterContainer) の直下の div ごとに区切り線が入る本家の作りに乗るため、
  // 「絞り込み」と「並べ替え」を兄弟の div として並べる。1 枚にまとめると
  // 区切り線が 1 本しか出ず、本家の見た目と変わってしまう。
  return (
    <>
      <div data-filter-ready={ready ? 'true' : 'false'}>
        <div className={styles.filterList}>
          <div className={styles.filtersHeader}>
            <h3 className={styles.filtersTitle}>{labels.filters}</h3>
            {isDirty && (
              <button type="button" className={styles.clearBtn} onClick={clear}>
                {labels.clear}
              </button>
            )}
          </div>

          {/* 本家の検索欄は Header にあり、押すと URL に ?text= を足して
              Aquarius に投げ直す。こちらは配列を絞るだけなので入力に直結させている */}
          <input
            type="search"
            className={`${styles.input} ${styles.small}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.placeholder}
          />

          <div className={styles.filterType}>
            <div>
              <input
                id="onlyProof"
                type="checkbox"
                className={styles.checkbox}
                checked={onlyProof}
                onChange={(e) => setOnlyProof(e.target.checked)}
              />
              <label htmlFor="onlyProof" className={styles.checkboxLabel}>
                {labels.onlyProof}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/*
        和歌の数。**チェーンから来ていない項目はここだけ**なので、
        見出しの下に出どころを 1 行で断る。これを書かないと、
        隣に並ぶ「証明つき」（チェーンの記録）と区別が付かない。
      */}
      <div>
        <div className={styles.filterList}>
          <h3 className={styles.filtersTitle}>{labels.wakaTitle}</h3>
          <p className={styles.filtersNote}>{labels.wakaNote}</p>
          <div className={styles.filterType} role="radiogroup" aria-label={labels.wakaTitle}>
            {(['any', '1-4', '5-9', '10-19', '20+'] as WakaBand[]).map((band) => (
              <div key={band}>
                <input
                  id={`waka-${band}`}
                  type="radio"
                  name="waka"
                  className={styles.checkbox}
                  checked={waka === band}
                  onChange={() => setWaka(band)}
                />
                <label htmlFor={`waka-${band}`} className={styles.checkboxLabel}>
                  {band === 'any' ? labels.wakaAny : labels.wakaBands[band]}
                  <span className={styles.facetCount}>{wakaCounts[band]}</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className={styles.filterList}>
          <h3 className={styles.filtersTitle}>{labels.sortBy}</h3>
          <div className={styles.filterType}>
            <select
              className={`${styles.select} ${styles.small}`}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label={labels.sortBy}
            >
              <option value="volume">{labels.volume}</option>
              <option value="orders">{labels.orders}</option>
              <option value="lines">{labels.lines}</option>
              <option value="waka">{labels.waka}</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
