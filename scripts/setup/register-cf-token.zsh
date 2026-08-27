#!/usr/bin/env zsh
#
# クリップボードにある Cloudflare のトークンを、1Password と GitHub の Secret に入れる。
#
# **値は 1 度も画面に出さない。** 引数にも渡さない（履歴と ps に残るため）。
# 1Password へは JSON のひな型を標準入力で、GitHub へは標準入力で渡す。
#
# 入れる前に、そのトークンで本当に配れるのかを Cloudflare の API で確かめる。
# 足りなければそこで止める（配ってから気づくのを避けるため）。
set -euo pipefail

REPO=nakamura196/genji-x
ACCOUNT=7efcf816ee8a11cebbfcc7115bbca3d5
ITEM="Cloudflare deploy genji-x"
VAULT=Personal

T=$(pbpaste)
[[ -n "$T" ]] || { print -u2 "クリップボードが空です"; exit 1 }
print "クリップボードから受け取りました（${#T} 文字。表示しません）"

code () { curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $T" "$1" }

print ""
print "権限を確かめます"
ok=1
c=$(code https://api.cloudflare.com/client/v4/user/tokens/verify)
print "  トークンが有効                $c"; [[ "$c" == 200 ]] || ok=0

c=$(code "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/workers/scripts")
print "  Workers Scripts              $c"; [[ "$c" == 200 ]] || ok=0

ZID=$(curl -s -H "Authorization: Bearer $T" \
  "https://api.cloudflare.com/client/v4/zones?name=ldas.jp" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);r=d.get('result') or [];print(r[0]['id'] if r else '')")
if [[ -n "$ZID" ]]; then
  c=$(code "https://api.cloudflare.com/client/v4/zones/$ZID/workers/routes")
  print "  Workers Routes (ldas.jp)     $c"; [[ "$c" == 200 ]] || ok=0
else
  print "  ldas.jp のゾーンが見えません"; ok=0
fi

# 絞れているか。
#
# **「見えるゾーンの数」で測ってはいけない。** /zones の一覧には、
# 実際には何もできないゾーンの名前も出る（実測: ldas.jp に絞ったトークンでも
# toyobunko-lab.jp が一覧に出た。ただしそちらは全部 403 だった）。
# 名前が見えることと、操作できることは別。**他のゾーンで操作を試して測る。**
OTHER=$(curl -s -H "Authorization: Bearer $T" https://api.cloudflare.com/client/v4/zones \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for z in (d.get('result') or []):
    if z.get('name') != 'ldas.jp':
        print(z['id']); break
")
if [[ -n "$OTHER" ]]; then
  c=$(code "https://api.cloudflare.com/client/v4/zones/$OTHER/workers/routes")
  if [[ "$c" == 200 ]]; then
    print "  他のゾーンにも届く            $c  ← 絞れていません"; ok=0
  else
    print "  他のゾーンでは拒否される      $c  (絞れています)"
  fi
else
  print "  他のゾーンは一覧にも出ない        (絞れています)"
fi

if (( ! ok )); then
  print -u2 "\n権限が足りません。作り直してください。"
  unset T
  exit 1
fi

print "\n1Password に入れます"
if op item get "$ITEM" --vault "$VAULT" >/dev/null 2>&1; then
  print "  既にある項目を更新します"
  op item edit "$ITEM" --vault "$VAULT" "credential[concealed]=$T" >/dev/null
else
  # JSON のひな型を標準入力で渡す。引数にすると履歴と ps に残る
  # **ひな型は名前つきパイプで渡す。** `--template=-` は
  # 「ひな型と標準入力を同時には使えない」と断られる。
  # 一時ファイルに書くとディスクに秘密が落ちるので、`<(...)` を使う。
  op item create --vault "$VAULT" --template=<(python3 -c "
import json, sys
print(json.dumps({
  'title': sys.argv[1],
  'category': 'API_CREDENTIAL',
  'fields': [
    {'id': 'credential', 'type': 'CONCEALED', 'purpose': '', 'label': 'credential', 'value': sys.argv[2]},
    {'id': 'hostname', 'type': 'STRING', 'label': 'hostname', 'value': 'api.cloudflare.com'},
    {'id': 'notesPlain', 'type': 'STRING', 'purpose': 'NOTES', 'label': 'notesPlain',
     'value': '用途: genji-x を Cloudflare Workers へ配る (GitHub Actions) | 使用先: nakamura196/genji-x | 範囲: zone ldas.jp のみ (Workers Scripts Edit / Workers Routes Edit / Zone Read)'},
  ],
}))
" "$ITEM" "$T") >/dev/null
  print "  新しく作りました"
fi

print "\nGitHub の Secret に入れます"
print -n "$T" | gh secret set CLOUDFLARE_API_TOKEN --repo "$REPO"
print -n "$ACCOUNT" | gh secret set CLOUDFLARE_ACCOUNT_ID --repo "$REPO"

unset T ZID OTHER
# 値をクリップボードに残さない
print -n "" | pbcopy
print "  クリップボードを空にしました"

print ""
gh secret list --repo "$REPO"
