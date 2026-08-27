/**
 * Cloudflare のダッシュボードのコンソールで実行して、API トークンを 1 本作る。
 *
 * ── これは何をするか ────────────────────────────────────────────
 * ダッシュボードで「カスタム トークンを作成する」を手で埋めるのと同じことを、
 * 同じ API に対して行う。**ログイン中のセッションを使う。** 鍵も文字も外に送らない。
 *
 * ── なぜ本来おすすめしないか ────────────────────────────────────
 * 「コンソールにこれを貼ってください」は攻撃者が使う手口そのもの (self-XSS)。
 * ブラウザが警告を出すのもそのため。**中身を読めないまま貼る癖をつけないこと。**
 * このスクリプトは、そのために 1 行ずつ何をしているか書いてある。
 *
 * ── 安全側に倒してあること ──────────────────────────────────────
 * 1. 先に読み取りだけで疎通と権限の解決を行い、**全部そろわなければ何も作らない**
 * 2. 同じ名前のトークンが既にあれば止まる（二重に作らない）
 * 3. 作るのは 1 本だけ。既存のトークンは読まないし触らない
 *
 * ── 使い方 ──────────────────────────────────────────────────────
 * https://dash.cloudflare.com/profile/api-tokens を開いた状態で、
 * 開発者ツールのコンソールに貼って Enter。
 */
(async () => {
  const NAME = 'genji-x deploy';
  const ZONE = 'ldas.jp';
  const BASE = 'https://dash.cloudflare.com/api/v4';

  // ダッシュボードは Cookie で認証する。CSRF の合言葉も Cookie にある
  const csrf = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)?.[1];
  const headers = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);

  const call = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method, headers, credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok && json?.success, status: res.status, json };
  };
  const stop = (msg, extra) => {
    console.error('%c中止: ' + msg, 'color:#c00;font-weight:bold', extra ?? '');
    return null;
  };

  // ── 1. セッションで API を叩けるか ───────────────────────────
  const me = await call('GET', '/user');
  if (!me.ok) return stop('ログイン中のセッションで API を叩けません。ダッシュボードを開き直してください', me);
  console.log('1. セッション        ok　' + (me.json.result?.email ?? ''));

  // ── 2. 同じ名前のトークンが既に無いか ────────────────────────
  const list = await call('GET', '/user/tokens');
  if (!list.ok) return stop('トークンの一覧を読めません', list);
  if (list.json.result?.some((t) => t.name === NAME))
    return stop(`「${NAME}」は既にあります。二重に作りません`);
  console.log('2. 同名の確認        ok　既存 ' + (list.json.result?.length ?? 0) + ' 本');

  // ── 3. アカウントとゾーンの id ───────────────────────────────
  const accs = await call('GET', '/accounts');
  const accountId = accs.json?.result?.[0]?.id;
  if (!accountId) return stop('アカウントが取れません', accs);

  const zones = await call('GET', '/zones?name=' + encodeURIComponent(ZONE));
  const zoneId = zones.json?.result?.[0]?.id;
  if (!zoneId) return stop(`ゾーン ${ZONE} が見つかりません`, zones);
  console.log('3. 対象              ok　account ' + accountId.slice(0, 8) + '… / zone ' + zoneId.slice(0, 8) + '…');

  // ── 4. 権限の id を名前から引く ──────────────────────────────
  //     画面で「Workers スクリプト → 編集」を選ぶのと同じこと
  const pg = await call('GET', '/user/tokens/permission_groups');
  if (!pg.ok) return stop('権限の一覧を読めません', pg);
  const find = (label) => {
    const hit = pg.json.result.filter((g) => g.name === label);
    if (hit.length !== 1) console.warn(`  「${label}」が ${hit.length} 件`, hit);
    return hit[0];
  };
  const want = {
    'Workers Scripts Write': null,   // Worker を配る
    'Workers Routes Write': null,    // genji-x.ldas.jp の割り当て
    'Zone Read': null,               // ゾーンの参照
  };
  for (const k of Object.keys(want)) want[k] = find(k);
  const missing = Object.entries(want).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return stop('権限が引けません: ' + missing.join(', '));
  console.log('4. 権限              ok　' + Object.keys(want).join(' / '));

  // ── 5. 作る。ここで初めて書き込む ────────────────────────────
  const payload = {
    name: NAME,
    policies: [
      {
        effect: 'allow',
        resources: { ['com.cloudflare.api.account.' + accountId]: '*' },
        permission_groups: [{ id: want['Workers Scripts Write'].id }],
      },
      {
        effect: 'allow',
        // **ゾーンを 1 つに絞る。** ここが今回の眼目
        resources: { ['com.cloudflare.api.account.zone.' + zoneId]: '*' },
        permission_groups: [
          { id: want['Workers Routes Write'].id },
          { id: want['Zone Read'].id },
        ],
      },
    ],
  };
  console.log('5. 送る中身', payload);

  const made = await call('POST', '/user/tokens', payload);
  if (!made.ok) return stop('作成に失敗しました', made);

  console.log('%c作成しました', 'color:#0a0;font-weight:bold');
  console.log('  名前   ' + made.json.result.name);
  console.log('  範囲   ' + ZONE + ' のみ');
  console.log('%c' + made.json.result.value, 'font-size:14px;font-family:monospace');
  console.log('%cこの値はこの 1 回しか出ません。1Password に入れてください。',
    'color:#c60;font-weight:bold');
  console.log('  項目名は「Cloudflare deploy genji-x」。**パレンを入れないこと**');
})();
