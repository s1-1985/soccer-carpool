#!/bin/bash
# E2E テストの準備（新しいセッションで一度だけ）
#  - playwright と firebase-tools を入れる（ブラウザは /opt/pw-browsers/chromium を使うのでダウンロードしない）
#  - テスト中のページが読む CDN のスクリプトを vendor/ に置く（lib.mjs が gstatic などへの通信をここから返す）
set -e
cd "$(dirname "$0")"
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund
mkdir -p vendor
for f in firebase-app-compat firebase-auth-compat firebase-firestore-compat firebase-storage-compat; do
  [ -s "vendor/$f.js" ] || curl -sSf -o "vendor/$f.js" "https://www.gstatic.com/firebasejs/9.23.0/$f.js"
done
[ -s vendor/html2canvas.min.js ] || curl -sSf -o vendor/html2canvas.min.js "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
ls -l vendor
echo "準備できました。次は ./emulators.sh（別のターミナル／バックグラウンド）→ ./run-all.sh"
