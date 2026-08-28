#!/usr/bin/env zsh
# 取引を集めきるまで、間を空けて何度か試す。
#
# 前提: 公開 RPC (publicnode) は叩きすぎると**接続ごと拒否する**。
#       エラーで止まるならまだよいが、締め出しの手前では**空を返す**ので、
#       取りこぼしに気づかないまま悪くなったファイルを書いてしまう。
#
# 使い方: zsh scripts/collect-transactions.zsh
#
# 何をするか: build-transactions.mjs は前回の結果と足し合わせるので、
#             部分的にしか取れなくても回を重ねれば揃う。
#             揃った時点で止める。揃わなければ上限で諦めて 1 を返す。
set -uo pipefail

cd "${0:A:h}/.."

MAX=8          # 試す回数の上限
WAIT=300       # 1 回あたりの待ち (秒)

# 揃っている、と言える数。参照 2 件・root 6 件・説明書き 110 件 (55 帖 × 作成/更新)
want() {
  node -e '
    const fs = require("fs");
    const f = "src/data/transactions.json";
    if (!fs.existsSync(f)) { console.log("0 0 0"); process.exit(1); }
    const t = JSON.parse(fs.readFileSync(f, "utf8")).transactions;
    const n = (k) => t.filter((x) => x.kinds.includes(k)).length;
    const [o, a, m] = [n("order"), n("anchor"), n("metadata")];
    console.log(`${o} ${a} ${m}`);
    process.exit(o >= 2 && a >= 6 && m >= 110 ? 0 : 1);
  '
}

for i in {1..$MAX}; do
  print "== $i / $MAX 回目 =="
  node scripts/build-transactions.mjs 2>&1 | grep -vE '^\s*(参照|説明書き) [0-9]+/' | tail -8

  counts=$(want) && { print "揃いました: 参照/root/説明書き = ${counts}"; exit 0 }
  print "まだです: 参照/root/説明書き = ${counts:-（読めず）}"

  if (( i < MAX )); then
    print "${WAIT} 秒待ちます"
    sleep $WAIT
  fi
done

print "揃いませんでした。NEXT_PUBLIC_SEPOLIA_RPC_URL に自前の RPC を指すのが確実です"
exit 1
