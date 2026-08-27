/**
 * カード・パネルの基底。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 由来: cliox/src/components/@shared/atoms/Box.module.css
 *
 * 本家に React の部品は無く、CSS だけが置いてあって、各所から
 * `composes: box from '.../Box.module.css'` で取り込まれている
 * （AssetTeaser と AssetContent はこちらでもそうしている）。
 * ページから直に使う場所ではその書き方ができないので、薄い包みだけ足した。
 * 寸法・影・角の丸みは CSS 側の値をそのまま使うので、本家とずれない。
 *
 * `as="a"` にすると Box.module.css の `a.box:hover`（少し浮く）が効く。
 */
import styles from './Box.module.css';

type BoxOwnProps = {
  children: React.ReactNode;
  className?: string;
};

export function Box({ children, className, ...rest }: BoxOwnProps & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={[styles.box, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

export function BoxLink({
  children, className, ...rest
}: BoxOwnProps & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={[styles.box, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </a>
  );
}

export default Box;
