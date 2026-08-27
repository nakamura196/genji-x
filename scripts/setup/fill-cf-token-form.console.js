/**
 * Cloudflare の「カスタム トークンを作成する」画面の項目を埋める。
 *
 * ── 前のスクリプトとの違い ──────────────────────────────────────
 * 前のは API を直接叩いて作ろうとしたが、書き込みが 403 で断られた。
 * 読み取り (GET) は全部通ったので、ダッシュボードは書き込みに
 * Cookie の CSRF 以外の合言葉も要求しているらしい。
 *
 * **こちらは API を一切叩かない。** 画面の部品を、人が押すのと同じように押す。
 * 最後の「概要に進む」と「トークンを作成する」は**押さない**。
 * 埋まった内容を目で確かめてから、ご自分で押してください。
 *
 * ── 使い方 ──────────────────────────────────────────────────────
 * 「カスタム トークンを作成する」の画面で、コンソールに貼って Enter。
 * 選べない項目があれば、そこで止まって「出ていた候補」を表示します。
 */
(async () => {
  const ZONE = 'ldas.jp';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  /** 条件が満たされるまで待つ。**最大 50 回・約 3 秒で打ち切る** */
  const until = async (fn) => {
    for (let i = 0; i < 50; i++) {
      const v = fn();
      if (v) return v;
      await sleep(60);
    }
    return null;
  };

  const click = (el) => {
    el.scrollIntoView({ block: 'center' });
    for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
    }
  };
  const fail = (msg) => {
    console.error('%c止まりました: ' + msg, 'color:#c00;font-weight:bold');
    console.warn('残りは画面で選んでください');
    return null;
  };
  /**
   * 開いている一覧の項目。react-select は portal に出すことがあるので
   * 画面全体から探す。id が `react-select-N-option-M` の形のものも拾う。
   */
  const options = () => [...document.querySelectorAll(
    '[role="option"], .react-select__option, [id^="react-select-"][id*="-option-"]')];

  const key = (el, k, code) => el.dispatchEvent(new KeyboardEvent('keydown', {
    key: k, code: k, keyCode: code, which: code, bubbles: true, cancelable: true }));

  /**
   * 一覧を開いて、文字が一致する項目を押す。
   *
   * **クリックだけでは開かないことがある。** react-select は
   * 中の input のキー操作で開く作りで、合成したマウス事象を
   * 無視する場合がある（実際「候補: []」で止まった）。
   * クリック → だめなら ↓ キー、の順に試す。
   */
  const pick = async (opener, want, label) => {
    const inner = opener.querySelector?.('input');
    const openIt = () => {
      inner?.focus();
      click(opener);
    };
    openIt();
    let li = await until(() =>
      options().find((e) => norm(e.textContent) === want) ||
      options().find((e) => norm(e.textContent).includes(want)));

    if (!li && inner) {
      // 開いていないなら、キーボードで開く
      key(inner, 'ArrowDown', 40);
      li = await until(() =>
        options().find((e) => norm(e.textContent) === want) ||
        options().find((e) => norm(e.textContent).includes(want)));
    }

    if (!li) {
      const seen = options().map((e) => norm(e.textContent));
      console.warn(`  「${want}」が見当たりません。開いていた候補 ${seen.length} 件:`,
        seen.slice(0, 25));
      if (!seen.length) console.warn('  一覧が開いていません。この欄は画面で選んでください');
      return fail(label);
    }
    click(li);
    // 選んだあと React が組み直すので、次に進む前に落ち着くのを待つ
    await sleep(500);
    console.log(`  ${label}: ${want}`);
    return true;
  };

  /**
   * 権限の 1 行を埋める。リソース → 権限 → レベル
   *
   * **行の参照を持ち回らない。** 選ぶたびに React が行ごと作り直すので、
   * 最初に掴んだ要素は画面から外れた古いものになる。
   * それに気づかず「レベルの欄が有効になりません」で止まっていた
   * （実際には新しい行の欄が有効になっていた）。毎回引き直す。
   */
  const rowAt = (i) =>
    [...document.querySelectorAll('[data-sentry-component="PermissionRow"]')][i];

  const row = async (i, resource, permission, level) => {
    console.log(`権限 ${i + 1} 行目`);
    if (!rowAt(i)) return fail(`${i + 1} 行目が見つかりません`);

    const resBtn = rowAt(i).querySelector('button[aria-haspopup="listbox"]');
    if (norm(resBtn?.textContent) === resource) {
      console.log(`  リソース: ${resource}（すでに選択済み）`);
    } else if (!(await pick(resBtn, resource, 'リソース'))) return null;

    const permToggle = rowAt(i)
      .querySelector('input[name^="permissionGroupKeys"]')
      ?.parentElement?.querySelector('button[id$="toggle-button"]');
    if (!permToggle) return fail('権限の欄が見つかりません');
    if (!(await pick(permToggle, permission, '権限'))) return null;

    // レベルの欄は、権限を選ぶと有効になる。**その都度、行から引き直す**
    const lvl = await until(() =>
      rowAt(i)?.querySelector('.react-select__control:not(.react-select__control--is-disabled)'));
    if (!lvl) {
      const now = rowAt(i);
      console.warn('  行の中の react-select:',
        [...(now?.querySelectorAll('.react-select__control') ?? [])]
          .map((e) => norm(e.textContent) + (e.className.includes('is-disabled') ? '（無効）' : '')));
      return fail('レベルの欄が有効になりません');
    }
    if (!(await pick(lvl, level, 'レベル'))) return null;
    return true;
  };

  const addMore = async () => {
    const b = [...document.querySelectorAll('button')]
      .find((x) => norm(x.textContent) === 'さらに追加する');
    if (!b) return fail('「さらに追加する」が見つかりません');
    click(b);
    await sleep(400);
    return true;
  };

  console.log('=== 権限を 3 行 ===');
  if (!(await row(0, 'アカウント', 'Workers スクリプト', '編集'))) return;
  if (!(await addMore())) return;
  if (!(await row(1, 'ゾーン', 'Workers ルート', '編集'))) return;
  if (!(await addMore())) return;
  if (!(await row(2, 'ゾーン', 'ゾーン', '読み取り'))) return;

  console.log('=== ゾーン リソース ===');
  await sleep(600);
  const zoneSec = [...document.querySelectorAll('div')].find(
    (d) => norm(d.querySelector(':scope > h4')?.textContent) === 'ゾーン リソース');
  if (!zoneSec) {
    console.warn('  ゾーン リソースの区画がまだ出ていません。画面で選んでください');
  } else {
    const sels = [...zoneSec.querySelectorAll('.react-select__control')];
    if (sels[1] && !(await pick(sels[1], '特定のゾーン', '対象'))) return;
    await sleep(400);
    const after = [...zoneSec.querySelectorAll('.react-select__control')];
    if (after[2] && !(await pick(after[2], ZONE, 'ゾーン'))) return;
  }

  console.log('%c埋めました。画面を見て確かめてください。', 'color:#0a0;font-weight:bold');
  console.log('  期待する内容:');
  console.log('    アカウント | Workers スクリプト | 編集');
  console.log('    ゾーン     | Workers ルート     | 編集');
  console.log('    ゾーン     | ゾーン             | 読み取り');
  console.log('    ゾーン リソース: 含む | 特定のゾーン | ' + ZONE);
  console.log('%c合っていれば「概要に進む」→「トークンを作成する」を押してください。',
    'color:#c60;font-weight:bold');
})();
