/**
 * 本文（散文）の体裁。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 由来: cliox/src/components/@shared/Page/PageMarkdown.module.css の `.content`
 *
 * 本家はここに Markdown を流し込む部品 (`@shared/Markdown`) を噛ませているが、
 * この試作は文面を i18n の messages から出すので、Markdown を解釈する必要がない。
 * 使うのは体裁だけ。見出しの上下の余白、箇条書きの「▪」、引用の飾りが
 * 本家と同じ値で当たる。
 */
import styles from './PageMarkdown.module.css';

export function PageContent({
  children, className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={[styles.content, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export default PageContent;
