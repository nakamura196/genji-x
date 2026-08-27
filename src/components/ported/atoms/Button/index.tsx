/**
 * ボタン。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 由来: cliox/src/components/@shared/atoms/Button/index.tsx
 * CSS (index.module.css) は移植済みのものをそのまま使う。
 *
 * 本家との違いは 2 つだけ。
 *   1. `classnames/bind` を使わない。この試作は classnames を依存に持たない。
 *      組み上がる class 属性は本家と同じ。
 *   2. `to` に渡す道は呼ぶ側が言語つき (`/ja/search`) で作る。
 *      next-intl の Link を使うと、すでに言語が入った道をもう一度包んでしまう。
 *
 * 外側のリンク (`href`) に「↗」を足すのは本家の挙動。押した先が
 * 別のサイトだと分かるので、そのまま残した。
 */
import Link from 'next/link';
import styles from './index.module.css';

export interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  /** 外部リンク。新しいタブで開き、末尾に ↗ が付く */
  href?: string;
  /** サイト内リンク。言語つきの道を渡すこと */
  to?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  name?: string;
  size?: 'small' | 'sm' | 'md' | 'lg';
  style?: 'primary' | 'ghost' | 'text' | 'secondary' | 'outline';
  type?: 'submit' | 'button';
  title?: string;
  /** 末尾に → を足す（本家の arrow と同じ） */
  arrow?: boolean;
}

export function Button({
  href, children, className, to, size, style, arrow, ...props
}: ButtonProps) {
  const styleClasses = [
    styles.button,
    style ? styles[style] : '',
    size ? styles[size] : '',
    className,
  ].filter(Boolean).join(' ');

  if (to) {
    return (
      <Link href={to} className={styleClasses} {...props}>
        {children}
        {arrow && <>&nbsp;&#8594;</>}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={styleClasses} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
        &nbsp;&#8599;
      </a>
    );
  }

  return (
    <button className={styleClasses} {...props}>
      {children}
      {arrow && <>&nbsp;&#8594;</>}
    </button>
  );
}

export default Button;
