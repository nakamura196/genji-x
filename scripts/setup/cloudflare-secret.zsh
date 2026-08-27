#!/usr/bin/env zsh
#
# Cloudflare の専用トークンを GitHub の Secret に入れる。
#
# ── 先にやっていただくこと ──────────────────────────────────────
# Cloudflare の API トークンは **CLI からは作れない**（wrangler の OAuth に
# 作成の権限が無い）。ダッシュボードで 1 本作る:
#
#   https://dash.cloudflare.com/profile/api-tokens → Create Token → Custom token
#
#     名前  genji-x deploy
#     Account | Workers Scripts | Edit    Worker を配る
#     Zone    | Workers Routes  | Edit    genji-x.ldas.jp の割り当てに要る
#     Zone    | Zone            | Read    ゾーンの参照
#     Zone Resources: Include | Specific zone | ldas.jp
#
#   **ldas.jp だけに絞る。** アカウント全体に効くトークンを使い回すと、
#   1 本漏れたときの被害が全リポジトリに広がる。
#
# 作ったら 1Password に保存する。**タイトルにパレンを入れない**
# （op:// の URI が解釈できなくなる）:
#
#   op item create --category="API Credential" --vault=Personal \
#     --title="Cloudflare deploy genji-x" \
#     "credential[concealed]=<トークン>" \
#     "hostname=api.cloudflare.com"
#
# ── このスクリプトがすること ────────────────────────────────────
#   zsh scripts/setup/cloudflare-secret.zsh
#
# 1Password から取り、**権限が足りているか実際に確かめてから**、
# GitHub の Secret に入れる。値は画面に出さず、標準入力で渡す
# （引数にするとシェルの履歴と ps に残る）。
set -euo pipefail

REPO=nakamura196/genji-x
ACCOUNT=7efcf816ee8a11cebbfcc7115bbca3d5
ITEM="${1:-Cloudflare deploy genji-x}"
VAULT="${CF_VAULT:-Personal}"

print "1Password の項目 : $ITEM"
print "リポジトリ       : $REPO"
print ""

T=$(op item get "$ITEM" --vault "$VAULT" --fields credential --reveal 2>/dev/null || true)
if [[ -z "$T" ]]; then
  print "1Password から取れませんでした。" >&2
  print "  項目名を確かめてください: op item list --vault $VAULT | grep -i cloudflare" >&2
  exit 1
fi
print "取得しました（${#T} 文字。表示しません）"

code () { curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $T" "$1" }

print ""
print "権限を確かめます（配ってから足りないと分かるのを避けるため）"
ok=1
c=$(code https://api.cloudflare.com/client/v4/user/tokens/verify)
[[ "$c" == 200 ]] || c=$(code "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/tokens/verify")
print "  トークンが有効                 $c"; [[ "$c" == 200 ]] || ok=0

c=$(code "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/workers/scripts")
print "  Workers Scripts               $c"; [[ "$c" == 200 ]] || ok=0

ZID=$(curl -s -H "Authorization: Bearer $T" \
  "https://api.cloudflare.com/client/v4/zones?name=ldas.jp" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);r=d.get('result') or [];print(r[0]['id'] if r else '')")
if [[ -n "$ZID" ]]; then
  c=$(code "https://api.cloudflare.com/client/v4/zones/$ZID/workers/routes")
  print "  Workers Routes (ldas.jp)      $c"; [[ "$c" == 200 ]] || ok=0
else
  print "  ldas.jp のゾーンが見えません（Zone | Zone | Read が要ります）"; ok=0
fi

if (( ! ok )); then
  print ""
  print "権限が足りません。ダッシュボードで作り直してください。" >&2
  unset T
  exit 1
fi

print ""
print "GitHub の Secret に入れます"
print -n "$T" | gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO"
print -n "$ACCOUNT" | gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$REPO"
unset T ZID

print ""
gh secret list --repo "$REPO"
print ""
print "次: gh workflow run Deploy --repo $REPO"
