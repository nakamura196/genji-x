/**
 * ページの見出し。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 由来: cliox/src/components/@shared/Page/PageHeader.tsx
 * CSS はそのまま。本家にある Gaia-X のロゴやネットワーク警告は持たない。
 *
 * `className` は本家に無い追加。本家は `margin-bottom: var(--spacer)` 固定だが、
 * 題のすぐ下にバッジを並べる画面があり、そこだけ間を詰めたいため。
 */
import styles from './PageHeader.module.css';

export function PageHeader({
  title, description, center = false, className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <header className={[styles.header, center ? styles.center : '', className].filter(Boolean).join(' ')}>
      <div>
        <h1 className={styles.title}>{title}</h1>
      </div>
      {description && <p className={styles.description}>{description}</p>}
    </header>
  );
}

export default PageHeader;
