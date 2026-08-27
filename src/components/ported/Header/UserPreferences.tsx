'use client';
/**
 * 設定（歯車）。**Ocean Market / Pontus-X Portal からの移植**（Apache-2.0）。
 * 出どころ: cliox/src/components/Header/UserPreferences/{index,Appearance}.tsx
 *
 * DOM とクラス名は本家と同じ。
 *   .preferences（歯車 + キャレット）→ .content（吹き出し）→ ul.preferencesDetails
 *   → li.appearances → .label + .buttons > button.button[.selected]
 *
 * ── 本家との違い ────────────────────────────────────────────────
 * 中身は「見た目」だけにした。本家はここに外部コンテンツの可否・デバッグ表示・
 * 案内の再表示・自動実行ウォレットの 4 つを並べているが、どれも対応する実体が
 * この試作に無い。空の項目を残すと嘘になるので置かない。
 *
 * 吹き出しは本家の tippy.js を入れず、押した要素の真下に出している
 * （理由は Tooltip.module.css の冒頭に書いた）。
 *
 * 「明るい / 暗い」の選択は本家の Appearance.module.css の
 * .buttons / .button / .selected をそのまま使う。style の直書きはしていない。
 * next-themes には 3 つ目として「端末に合わせる」があるので、
 * そこだけ選択肢が 1 つ多い。
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { CaretIcon, CogIcon, MoonIcon, SunIcon, SystemIcon } from './Icons';
import styles from './UserPreferences.module.css';
import tooltip from './Tooltip.module.css';
import appearance from './Appearance.module.css';

export type PreferencesLabels = {
  prefsLabel: string;
  appearance: string;
  appearanceHelp?: string;
  light: string;
  dark: string;
  system: string;
};

const THEMES = ['light', 'dark', 'system'] as const;

export default function UserPreferences({ labels }: { labels: PreferencesLabels }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 外を押したら閉じる。本家では tippy.js がやっていること
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className={styles.anchor} ref={ref}>
      <button
        type="button"
        className={styles.preferences}
        aria-label={labels.prefsLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <CogIcon aria-hidden className={styles.icon} />
        <CaretIcon aria-hidden className={styles.caret} />
      </button>

      {open && (
        <div className={`${tooltip.content} ${styles.panel}`}>
          <ul className={styles.preferencesDetails}>
            <Appearance labels={labels} />
          </ul>
        </div>
      )}
    </div>
  );
}

function Appearance({ labels }: { labels: PreferencesLabels }) {
  const { theme, setTheme } = useTheme();
  /**
   * サーバ側では選ばれている見た目が分からない。決め打ちで描くと、
   * クライアントで直った瞬間に選択が飛ぶし、React が食い違いを警告する。
   * **描き終わるまではどれも選ばれていない状態にし、その後で反映する。**
   * サーバとクライアントで別の値を返せる useSyncExternalStore を使うと、
   * 効果の中で setState して描画をもう一往復させずに済む。
   */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const icons = { light: SunIcon, dark: MoonIcon, system: SystemIcon };
  const names: Record<(typeof THEMES)[number], string> = {
    light: labels.light,
    dark: labels.dark,
    system: labels.system,
  };

  return (
    <li className={appearance.appearances}>
      <span className={appearance.label}>{labels.appearance}</span>

      <div className={appearance.buttons}>
        {THEMES.map((value) => {
          const Icon = icons[value];
          const selected = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              className={`${appearance.button} ${selected ? appearance.selected : ''}`}
              // 「押した状態が残る」ボタンなので aria-pressed で今の選択を伝える
              aria-pressed={selected}
              onClick={() => setTheme(value)}
            >
              <Icon aria-hidden />
              {names[value]}
            </button>
          );
        })}
      </div>

      {labels.appearanceHelp && <p className={appearance.help}>{labels.appearanceHelp}</p>}
    </li>
  );
}
