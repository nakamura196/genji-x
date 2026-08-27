/**
 * ページの枠。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 由来: cliox/src/components/@shared/Page/index.tsx
 *
 * 中身から外したもの:
 *   Seo                     App Router の generateMetadata が同じ役をする
 *   SearchBar               ヘッダの検索は別部品として移植済み
 *   ExternalContentWarning  外部の埋め込みを持たないので出番が無い
 *   useUserPreferences      上記に付随する設定なので不要
 * 残したのは「Container で幅を決め、PageHeader で見出しを出す」ところ。
 * 本家の props 名 (noPageHeader / headerCenter / noContainer / wideContainer)
 * はそのままにしてある。あとで本家の実装を見に行ったとき、対応が取れるように。
 *
 * ── 本家に無い追加 ─────────────────────────────────────────────
 * `<main>` を**この部品が持つ**。本家では 1 つ上の App
 * (cliox/src/components/App/index.tsx) が `<main className={styles.main}>` を
 * 出しているが、こちらの相当物 (layout.tsx の `.page-body`) は
 * 「フッタを最下部に押し下げる」ためだけの箱で、幅の上限も持たない。
 * そこに main を移すと、幅を測るテストが 1920px の外枠を測ってしまい、
 * 「本文が 1400px に収まっているか」を見なくなる。main は Container の中に置く。
 *
 * `before`           題より上に出すもの（パンくずなど）。本家に相当する画面が
 *                    無いコントラクトの説明ページで要る
 * `headerClassName`  題のすぐ下にバッジを並べる画面で、本家の
 *                    margin-bottom (1 spacer) を詰めるため
 * `className`        `<main>` に付ける。トップの `.home`（Libre Baskerville を
 *                    当てる規則がこの名前を見ている）を渡すのに使う
 */
import { Container } from '../atoms/Container';
import { PageHeader } from './PageHeader';
import styles from './index.module.css';

export function Page({
  children,
  title,
  description,
  before,
  noPageHeader,
  headerCenter,
  headerClassName,
  noContainer,
  wideContainer,
  narrowContainer,
  className,
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  before?: React.ReactNode;
  noPageHeader?: boolean;
  headerCenter?: boolean;
  headerClassName?: string;
  noContainer?: boolean;
  wideContainer?: boolean;
  narrowContainer?: boolean;
  className?: string;
}) {
  const content = (
    <main className={className}>
      {before}
      {!noPageHeader && title && (
        <PageHeader
          title={title}
          description={description}
          center={headerCenter}
          className={headerClassName}
        />
      )}
      {children}
    </main>
  );

  // 本家のトップと同じ扱い。全幅の帯を敷く画面は、節ごとに自前で Container を置く
  if (noContainer) return content;

  return (
    <Container wide={wideContainer} narrow={narrowContainer} className={styles.page}>
      {content}
    </Container>
  );
}

export default Page;
