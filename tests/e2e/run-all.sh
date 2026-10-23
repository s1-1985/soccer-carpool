#!/bin/bash
# E2E テストを一式流す。使い方: ./run-all.sh [接頭辞]（既定 r1）
#  - 先に ./emulators.sh でエミュレータを起動しておくこと（テストはエミュレータのデータを毎回消して作り直す）
#  - ファイルごとの結果を「接頭辞-ファイル名.log」、一覧を「接頭辞-summary.txt」に書く
#  - 1ファイルずつ順に流す（同じエミュレータのデータを使うので並列にはできない）。全体で40分ほど
P=${1:-r1}
cd "$(dirname "$0")"
export NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost
: > $P-summary.txt
for t in t-hub t-carpool-data t-merge t-share t-admin-move t-seat-mobile t-round2 t-overflow t-xss t-xss2 t-offline t-round3 t-files t-round4 t-round4b t-round5 t-round5b t-round6 t-round6sec t-round7 t-round7b t-oddata t-round8 t-round8b t-round9 t-round9b t-round10 t-sibling t-playermove t-weather t-seatmap t-coaching t-coachdates t-coachlink t-driver t-cpdebug t-firstday t-firstday2 t-polish t-round11 t-round11b t-perm t-perm-ui e2e-dock-scroll e2e-dock-drag-regression; do
  timeout 400 node $t.mjs > $P-$t.log 2>&1
  echo "$t exit=$? $(grep -c '^PASS' $P-$t.log) pass $(grep -c '^FAIL' $P-$t.log) fail" | tee -a $P-summary.txt
done
awk '{p+=$3; f+=$5} END {print NR" files, "p" pass, "f" fail"}' $P-summary.txt | tee -a $P-summary.txt
