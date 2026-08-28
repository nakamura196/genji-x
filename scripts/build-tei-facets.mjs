/**
 * TEI から**チェーンに載せていない**手がかり（ファセット）を作る。
 *
 *   node scripts/build-tei-facets.mjs
 *
 * ── なぜ snapshot.json と分けるのか ─────────────────────────────
 * `src/data/snapshot.json` は**チェーンの写し**である。中身は 1 つ残らず
 * Sepolia から読み直せる。この JSON はそうではない。**手元の TEI から数えた値**で、
 * チェーンには存在しない。
 *
 * 2 つを 1 つのファイルに混ぜると、画面に出た数字を見たときに
 * 「これはチェーンが保証しているのか、こちらが数えただけなのか」が
 * 区別できなくなる。**ファイルを分けることが、その区別そのもの**。
 *
 * ── ではなぜチェーンに載せないのか ──────────────────────────────
 * 和歌の数は TEI を数えれば誰でも同じ値になる。**改竄する意味がない。**
 * チェーンに載せる価値があるのは「後から言い張られると困るもの」だけで、
 * 具体的には (1) 元データのハッシュ (root)、(2) いつ・誰が出したか、
 * (3) その 2 つを結ぶ署名 の 3 つに尽きる。
 *
 * 和歌の数はそこから導ける。root が固定されていれば TEI も固定され、
 * TEI が固定されていれば和歌の数も固定される。**すでに証明の下にある。**
 * 重ねて載せると、費用が増えるだけでなく、
 * 「数え方を変えたら訂正できない値」を 1 つ増やすことになる。
 *
 * ── 数え方 ──────────────────────────────────────────────────
 * `<lg type="waka" rhyme="tanka">` を数える。全 54 帖で 795 首。
 * 数え直したい人は、下の sourceCommit の TEI に対して
 *   grep -o '<lg[^>]*type="waka"' xml/master/NN.xml | wc -l
 * を実行すれば同じ値になる。
 *
 * ── 行数・バイト数・葉ハッシュもここに移した ────────────────────
 * これらは以前 DDO に入っていたが、**本文があれば全部計算できる**ので
 * チェーンから外した (scripts/19-reattribute.mjs)。だが一覧に「328 行」と
 * 出すために毎回 77 KB の本文を取りに行くのは無駄なので、ここで先に数えておく。
 *
 *   lines     <seg> の出現回数
 *   bytes     ファイルのバイト数
 *   leafHash  sha256(0x00 ‖ ファイルの中身)   RFC 6962 の葉
 *   title     <title> の巻名（歴史的仮名遣い）
 *   titleAlt  <title type="alt"> の巻名（漢字）
 *
 * ── 漢字の巻名は手書きの表をやめた ──────────────────────────────
 * 以前は `src/data/volume-aliases.ts` にこちらで書いた対応表を置いていた。
 * TEI 本体に `<title type="alt">` が入った（kouigenjimonogatari PR #8 / #9、
 * 表記は東京大学附属図書館の一覧による）ので、**素材から読む**ようにした。
 * 手で書いた表は消してある。資料が持っているものを、こちらで作り直さない。
 *
 * **葉ハッシュを索引側に置いても、証明の強さは落ちない。** 検証する人は
 * この JSON を信じる必要がなく、本文から自分で計算し直せばよい。
 * ここにあるのは「速く出すための控え」であって、根拠ではない。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/registry.json'), 'utf8'));
/** 素材の commit は「全体版」の DDO に入っている。ここは写しから引く（数えた値ではない） */
const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/snapshot.json'), 'utf8'));
const whole = snapshot.assets.find((a) => a.slug === 'all');
const info = whole?.ddo?.metadata?.additionalInformation ?? {};

/** 素材の置き場。genji-witness と同じ相対位置を既定にする */
const TEI_DIR = process.env.GENJI_TEI_DIR
  || path.resolve(ROOT, '../kouigenji/xml/master');

const OUT = path.join(ROOT, 'src/data/tei-facets.json');

if (!fs.existsSync(TEI_DIR)) {
  // 素材が無い環境（CI など）では、既にある JSON を残して黙って終わる。
  // ここで落とすとビルドごと止まるが、この値は無くても画面は成立する。
  console.warn(`[tei-facets] TEI が見つかりません: ${TEI_DIR}`);
  console.warn('[tei-facets] 既存の tei-facets.json をそのまま使います');
  process.exit(0);
}

const volumes = {};
let total = 0;

for (let i = 1; i <= 54; i++) {
  const slug = String(i).padStart(2, '0');
  const file = path.join(TEI_DIR, `${slug}.xml`);
  if (!fs.existsSync(file)) throw new Error(`欠けています: ${file}`);
  const buf = fs.readFileSync(file);
  const xml = buf.toString('utf8');
  // 属性の順序に依存しないように、<lg ...> を取り出してから type を見る
  const waka = (xml.match(/<lg\b[^>]*>/g) ?? [])
    .filter((tag) => /\btype="waka"/.test(tag)).length;
  // 巻名。属性の順序に依存しないよう、<title ...> を取り出してから見る
  const titles = (xml.match(/<title\b[^>]*>[^<]*<\/title>/g) ?? []);
  const pick = (test) => {
    const t = titles.find(test);
    return t ? t.replace(/^<title[^>]*>/, '').replace(/<\/title>$/, '') : null;
  };
  const title = pick((t) => !/type=/.test(t) && t.includes('・'));
  const titleAlt = pick((t) => /type="alt"/.test(t));

  volumes[slug] = {
    waka,
    // 「校異源氏物語・きりつぼ」から巻名だけを取る
    title: title ? title.split('・').pop() : null,
    titleAlt: titleAlt ? titleAlt.split('・').pop() : null,
    lines: (xml.match(/<seg\b/g) ?? []).length,
    bytes: buf.length,
    // RFC 6962 の葉。ここにあるのは控えで、検証者は本文から作り直せる
    leafHash: '0x' + crypto.createHash('sha256')
      .update(Buffer.concat([Buffer.from([0]), buf])).digest('hex'),
  };
  total += waka;
}

const out = {
  $comment: 'TEI から数えた値。チェーンには載っていない。snapshot.json と混ぜないこと',
  spec: {
    title: 'titleStmt/title (historical kana)',
    titleAlt: 'titleStmt/title[@type="alt"] (kanji)',
    waka: 'count of lg[@type="waka"]',
    lines: 'count of <seg>',
    bytes: 'file length',
    leafHash: 'sha256(0x00 || file bytes)  RFC 6962 leaf',
  },
  sourceCommit: info.sourceCommit ?? null,
  sourceUri: info.sourceUri ?? null,
  totals: {
    waka: total,
    lines: Object.values(volumes).reduce((a, v) => a + v.lines, 0),
    bytes: Object.values(volumes).reduce((a, v) => a + v.bytes, 0),
  },
  volumes,
};

fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`[tei-facets] 54 帖 / 和歌 ${total} 首 / ${out.totals.lines.toLocaleString()} 行 `
  + `/ ${out.totals.bytes.toLocaleString()} バイト → ${path.relative(ROOT, OUT)}`);
