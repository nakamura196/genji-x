/**
 * フッタ。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 出どころ: cliox/src/components/Footer/{Footer,Links}.tsx
 *
 * DOM の骨格は本家と同じ。
 *   footer > Container > (リンクの段組) + (区切り線の下の 1 行)
 *
 * ── 本家との違い ────────────────────────────────────────────────
 * 1. 本家 Links.tsx の中身（助成機関のロゴ 6 枚・法務ページ・購読ボタン）は
 *    置いていない。どれも対応する実体がこの試作に無い。
 *    代わりに、素材・チェーン・系統への行き先を groups で受け取る。
 * 2. 本家はここを Tailwind のユーティリティで組んでいる。こちらは JSX に
 *    style を直書きしない方針なので、同じ組み方を Footer.module.css に写した。
 * 3. 幅は移植した Container に合わせる（本家 Footer.tsx も Container を使う）。
 */
import { Container } from '../atoms/Container';
import styles from './Footer.module.css';

export type FooterGroup = { title: string; links: { label: string; href: string }[] };

/** 外に出るリンクだけ別のタブで開く。本家の Button も href 指定なら _blank */
const isExternal = (href: string) => /^https?:\/\//.test(href);

export default function Footer({
  groups,
  bottom,
  beta,
}: {
  groups: FooterGroup[];
  bottom: React.ReactNode;
  beta?: string;
}) {
  return (
    <footer className={styles.footer}>
      <Container className={styles.inner}>
        <div className={styles.links}>
          {groups.map((g) => (
            <div key={g.title} className={styles.column}>
              <h3 className={styles.title}>{g.title}</h3>
              <ul className={styles.list}>
                {g.links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className={styles.link}
                      {...(isExternal(l.href)
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.bottom}>
          {beta && <span className={styles.beta}>{beta}</span>}
          <p className={styles.subtitle}>{bottom}</p>
        </div>
      </Container>
    </footer>
  );
}
