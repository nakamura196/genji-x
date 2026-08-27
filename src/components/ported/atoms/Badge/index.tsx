/**
 * 小さなラベル。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 由来: cliox/src/components/@shared/atoms/Badge/index.tsx
 *
 * 本家は `classnames/bind` でクラスを組み立てているが、この試作は
 * classnames を依存に持たない（部品 2 つのために 1 パッケージ増やしたくない）。
 * 出来上がる class 属性は本家と同じになる。
 *
 * `tone` は本家に無い追加。理由は index.module.css の追加分のコメントに書いた。
 */
import styles from './index.module.css';

export type BadgeTone = 'default' | 'ok' | 'warn' | 'outline';

export function Badge({
  label,
  tone = 'default',
  className,
}: {
  label: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const classes = [
    styles.badge,
    tone !== 'default' ? styles[tone] : '',
    className,
  ].filter(Boolean).join(' ');

  return <span className={classes}>{label}</span>;
}

export default Badge;
