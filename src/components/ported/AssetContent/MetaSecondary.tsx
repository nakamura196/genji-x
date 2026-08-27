/**
 * 本文そのものへの入口。**Ocean Market / Pontus-X Portal (Clio-X) からの移植**
 * (Apache-2.0)。由来: cliox/src/components/Asset/AssetContent/MetaSecondary.tsx
 *
 * 本家はここに「サンプルデータを落とす」ボタンとタグを置く。
 * こちらは CC0 で全文が公開してあるので、サンプルではなく**本文そのもの**を
 * 同じ位置・同じ格 (Button style="text" size="small") で出す。
 * 関所を作らないという判断を、画面の並びでも見せたいので位置は動かさない。
 *
 * ボタンは本家の Button コンポーネント (未移植) ではなく、移植済みの
 * Button/index.module.css を <a> に当てて同じ見た目にしている。
 * 遷移先が外部 URL なので、button 要素にする理由が無い。
 */
import styles from './MetaSecondary.module.css';
import btn from '../atoms/Button/index.module.css';
import { MetaItem } from './MetaItem';

export function MetaSecondary({
  gateway,
  ipfsUri,
  fileName,
  tags,
  labels,
}: {
  gateway: string;
  ipfsUri: string;
  fileName: string;
  tags: string[];
  /** 注記は 2 つ以上ある（CC0 であること / TEI/XML が素で開けないこと）ので配列で受ける */
  labels: { title: string; button: string; notes: string[] };
}) {
  return (
    <aside className={styles.metaSecondary}>
      <div className={styles.samples}>
        <MetaItem
          title={labels.title}
          content={
            <>
              <a
                className={`${btn.button} ${btn.text} ${btn.small}`}
                href={gateway}
                target="_blank"
                rel="noreferrer"
                download={fileName}
              >
                {labels.button}
              </a>
              <code className={styles.uri}>{ipfsUri}</code>
              {labels.notes.map((note) => (
                <p key={note} className={styles.note}>
                  {note}
                </p>
              ))}
            </>
          }
        />
      </div>
      {tags.length > 0 && (
        <div className={styles.tags}>
          {tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
