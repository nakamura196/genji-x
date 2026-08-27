#!/usr/bin/env zsh
#
# GitHub Actions が Cloudflare へ配るためのトークンを登録する。
#
# ── 前提 ────────────────────────────────────────────────────────
# Cloudflare の API トークンは **CLI からは作れない**（wrangler の OAuth は
# 作成の権限を持たない）。先にダッシュボードで 1 本作っておく:
#
#   https://dash.cloudflare.com/profile/api-tokens → Create Token → Custom token
#
#   Account | Workers Scripts        | Edit    Worker を配る
#   Zone    | Workers Routes         | Edit    genji-x.ldas.jp の割り当て
#   Zone    | Zone                   | Read    ゾーンの参照
#   Zone Resources: Include | Specific zone | ldas.jp
#
#   ※ ldas.jp だけに絞る。他の案件と使い回さない
#     （1 本漏れたときの被害範囲を広げないため）
#
# ── 使い方 ──────────────────────────────────────────────────────
#   zsh scripts/setup/cloudflare-secret.zsh
#
# トークンは画面に出ません。GitHub の Secret に入れたあと、変数を消します。
set -euo pipefail

REPO=nakamura196/genji-x
ACCOUNT_ID=7efcf816ee8a11cebbfcc7115bbca3d5

print "リポジトリ : $REPO"
print "アカウント : $ACCOUNT_ID"
print ""

# -s で入力を隠す。画面にもシェルの履歴にも残らない
read -s 'TOKEN?Cloudflare API Token を貼り付けてください (表示されません): '
print ""

if [[ -z "$TOKEN" ]]; then
  print "空でした。中止します。" >&2
  exit 1
fi
print "受け取った長さ: ${#TOKEN} 文字"

# 入れる前に、そのトークンで本当に配れるのかを確かめる
print ""
print "権限を確かめています…"
VERIFY=$(curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify)
if ! print "$VERIFY" | grep -q '"success":true'; then
  # ユーザー所有でなければアカウント所有の窓口で試す
  VERIFY=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/tokens/verify")
fi
if print "$VERIFY" | grep -q '"success":true'; then
  print "  トークンは有効です"
else
  print "  検証に失敗しました。中止します。" >&2
  print "$VERIFY" | head -c 300 >&2
  unset TOKEN
  exit 1
fi

# Workers の一覧が引けるか（Workers Scripts の権限があるか）
LIST=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts")
if print "$LIST" | grep -q '"success":true'; then
  print "  Workers Scripts を読めます"
else
  print "  Workers Scripts を読めません。権限が足りない可能性があります" >&2
fi

print ""
print "GitHub の Secret に入れます…"
# 値は標準入力で渡す。引数にするとシェルの履歴と ps に残る
print -n "$TOKEN" | gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO"
print -n "$ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$REPO"

unset TOKEN VERIFY LIST

print ""
print "登録しました:"
gh secret list --repo "$REPO"
print ""
print "次: git push で main に入れると Deploy が走ります。"
print "    手で試すなら gh workflow run Deploy --repo $REPO"
