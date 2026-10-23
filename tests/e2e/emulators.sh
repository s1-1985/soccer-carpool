#!/bin/bash
# リポジトリのルートで Firebase エミュレータ（Auth 9099 / Firestore 8080 / Storage 9199 / Hosting 5000）を起動する。
# クラウドの環境では HTTPS_PROXY があり、firebase-tools は 127.0.0.1 宛ての通信までプロキシ経由にしてしまうため、
# noproxy-local.js でローカル宛てだけ直接つなぐ（プロキシの設定は外さない）。
# 「All emulators ready」と出たら準備完了。止めるまで動き続けるのでバックグラウンドで起動する。
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
export FT_NODE_MODULES="${FT_NODE_MODULES:-$DIR/node_modules}"
cd "$ROOT"
NODE_OPTIONS="--require $DIR/noproxy-local.js" exec node "$FT_NODE_MODULES/firebase-tools/lib/bin/firebase.js" emulators:start --project fc-ojimajr-hub
