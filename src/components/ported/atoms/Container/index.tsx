/**
 * 本文の幅。**Ocean Market からの移植**（Apache-2.0）。
 * 既定 1400px / narrow 62rem / wide 2200px。
 * これまで各ページで独自に幅を指定していたので、全部これに載せ替える。
 */
import styles from './index.module.css';

export function Container({
  children, narrow, wide, className = '',
}: {
  children: React.ReactNode;
  narrow?: boolean;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={[
      styles.container,
      narrow ? styles.narrow : '',
      wide ? styles.wide : '',
      className,
    ].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
