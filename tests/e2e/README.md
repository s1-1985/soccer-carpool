# E2E テスト（Firebase エミュレータ＋Playwright）

アプリの画面をヘッドレスの Chromium で実際に操作して確かめるテスト一式。
**エミュレータ専用**（本番の Firebase には一切つながない）。各テストは最初にエミュレータのデータを全部消して作り直す。
このフォルダは本番には配信しない（`firebase.json` の hosting の ignore に `tests/**`）。

## 流し方（クラウドのセッションで）

```bash
cd tests/e2e
./setup.sh                       # 初回だけ: npm install（playwright・firebase-tools）と vendor/ の取得
./emulators.sh > emu.log 2>&1 &  # エミュレータを起動（バックグラウンド）。emu.log に「All emulators ready」が出るまで待つ
./run-all.sh r1                  # 一式（45ファイル・653項目、40分ほど）。結果は r1-summary.txt
node t-polish.mjs                # 1ファイルだけ流すとき（NO_PROXY=127.0.0.1,localhost を付ける）
```

- ブラウザは環境に入っている `/opt/pw-browsers/chromium` を使う（`playwright install` はしない）
- エミュレータは長時間動かしていると止まることがある。テストが一斉に失敗したらまず `emu.log` とポート 5000/8080/9099 を確認し、起動し直す
- `noproxy-local.js`: クラウドの環境では firebase-tools が 127.0.0.1 宛てまでプロキシ経由にしてしまうため、ローカル宛てだけ直接つなぐ。
  これがないと Storage のルールから Firestore を参照できず、添付ファイルが常に拒否になる（本番の不具合ではない）
- ブラウザでエミュレータのアプリを開くときは、DevTools で `localStorage.setItem('fcojima_use_emulator','1')`（`lib.mjs` の `context()` は自動で設定）

## 書き方（`lib.mjs`）

| 関数 | 用途 |
|---|---|
| `wipe()` | エミュレータの Firestore を空にする（各テストの最初に呼ぶ） |
| `put(path, data)` / `get(path)` / `list(col)` / `del(path)` | Firestore を REST で直接読み書き（ルールを通らない管理者扱い）。`T` = `teams/fc-ojima` |
| `makeUser(email, name, role, extra)` | Auth のユーザーと `users/{uid}` を作る（既定は承認済み。`extra` で `status:'pending'` など） |
| `context({ email, name, device })` | そのユーザーでログイン済みのブラウザを開く。CDN（gstatic・html2canvas）は `vendor/` から返し、天気・地図・フォントは塞ぐ |
| `chk(名前, 条件, 補足)` / `summary()` | `PASS`/`FAIL` を1行ずつ出す。最後に `process.exit(summary() ? 1 : 0)` |
| `watchErrors(page)` | ページのエラーを集める（最後に「ページエラーなし」を確かめる） |

- 日付は JST の「今日」からの相対で作る（`plus(n)`）。どの日に流しても通るようにする
- スマホ幅は `{ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true }`、操作は `page.tap()`
- 表示が変わったら期待値を直す。テストを消したり飛ばしたりして通さない

## ファイル

| ファイル | 内容 |
|---|---|
| `t-hub` `t-carpool-data` `t-merge` `t-share` `t-admin-move` `t-seat-mobile` | HUB・配車データの基本（他ページの保存で消えない・同時編集・共有リンク・出欠の移動・スマホの座席） |
| `t-round2`〜`t-round10`（`b`・`sec` 付き含む） | 全体デバッグ 2〜10巡目で直した不具合（権限・XSS・オフライン・古いデータ・見切れなど） |
| `t-xss` `t-xss2` `t-offline` `t-oddata` `t-overflow` `t-files` | 格納型XSS・通信エラー・壊れたデータ・スマホのはみ出し・添付ファイル |
| `t-sibling` `t-playermove` `t-seatmap` `t-weather` | 兄弟児・別の予定への選手の移動・車提供の座席の図・会場の天気（`wx/` の固定データ） |
| `t-coaching` `t-coachdates` `t-coachlink` `t-driver` `t-cpdebug` | 指導者の都合と担当・聞く日（祝日）・帯同指導者の配車への連携・運転手の移動 |
| `t-firstday` `t-firstday2` `t-polish` | はじめて使う人の導線（LINE から開く・やること・出欠をその場で・連絡の新着ほか）とブラッシュアップ |
| `t-round11` `t-round11b` | 全体デバッグ11巡目（予定の日付に仕込んだHTML・削除した指導者・名前の変更とログインの名前・メモ・はじめての端末の新着・自分で答えた出欠の「変わった点」） |
| `t-perm` | 役割のきまりと権限の設定をルール（REST・一括書き込み）で直接確かめる（任命・解任、監督の指定・引き継ぎ・1人だけ、管理者に対する操作、ログの閲覧・削除、権限の設定の欄・値、設定どおりの予定・名簿・当番・指導者の都合、連絡の uid と削除） |
| `t-perm-ui` | 役割と権限の画面（役員の管理タブ・承認の役割・役割の選択肢・権限の設定の表と保存・連絡とログの削除ボタン・権限を外した人の画面・監督の指定と引き継ぎ） |
| `e2e-dock-scroll` `e2e-dock-drag-regression` | 割り当て画面の下のドックのスクロール・ドラッグ（タッチ操作） |
| `detect.mjs` | スマホの見切れを見つける関数（`t-round10` が使う） |
| `shots-polish.mjs` | 観察用: 主な画面をスマホ幅で撮る（`node shots-polish.mjs 出力先`）。検証ではない |
