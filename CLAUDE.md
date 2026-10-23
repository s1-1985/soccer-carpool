# CLAUDE.md

FC尾島ジュニア（少年サッカーチーム）の運営・配車管理Webアプリ。
Vanilla JS + Firebase（Hosting/Firestore/Auth/Storage）。ビルド工程なし、リポジトリルートをそのままデプロイ。

## 必読

- 作業開始前に `handover.md`（最新の引き継ぎ・経緯・インシデント記録）を読むこと
- mainへのマージ＝本番デプロイ。PRのプレビューURL（CIがコメントする）で動作確認してからマージする

## 重要ルール

- `.github/workflows/firebase-deploy.yml` の push トリガーに main 以外のブランチを追加しない
  （2026-06-11の本番巻き戻り事故の原因。詳細は handover.md）
- 古いセッションブランチを再開・再pushしない
- イベントID・学年の比較は `String(a) === String(b)` で行う（型不一致バグが頻発した）
- JS/CSS変更時は参照側HTMLの `?v=YYYYMMDD` キャッシュバストを更新する
- `img/` 配下の画像を差し替えるときも参照側に `?v=N` を付ける（ファイル名が同じだとキャッシュされ古い画像が残る）
- PR作成・マージ・デプロイ確認は基本AIが自動で行う（ユーザー方針。`AI_HANDOFF.md` 参照）
  - 2026-10 の Claude Code（Web）のセッションでは: GitHub の MCP ツールでドラフトPRを作る → CIがプレビューURLをコメント →
    ユーザーが確認してマージ → AIが本番の配信（`?v=` が新しくなったか）を curl で確認、という流れだった
  - マージ後に同じセッションブランチで続けるときは `git fetch origin main && git checkout -B <ブランチ> origin/main` で作り直してから
    `git push --force-with-lease`（マージ済みの履歴に積み上げない）
- モバイルChromeでは `position: sticky` が `rowspan` を持つ `<th>` に対して正しく効かない。
  複数行ヘッダー＋左固定列のテーブルを作る場合は、ヘッダーを1セル構造にまとめる
  （2026-07-18 出欠マトリクスの「左見出しが飛び出す」バグの原因。詳細は handover.md）
- CSS の当たり方に注意（2026-10-23 のブラッシュアップで見つけた不具合）
  - 予定の種類（`game`/`practice`/`event`/`other`）をそのまま class にすると、種類「イベント」は `class="… event"` になり、
    カレンダーのマス用の `.event`・`.event.event` が当たる（リストの項目が小さい文字・2行で切れる・紫になった）
  - `css/common.css` の `button` には金色の背景・影・hover がある。文字だけ・枠だけのボタンは `box-shadow: none` と `:hover` も上書きする
  - ページの CSS の `@media (max-width: 768px)` が、後ろに書いた通常の指定を打ち消すことがある（連絡事項のカードの `flex-direction: column` など）。
    スマホ幅で必ず見る
- `innerHTML` に入れる値は、出所に関係なく `UI.escapeHTML` を通す。予定の日付（`event.date`）も承認済みなら誰でも書き込めるので、
  日付として使う前に `YYYY-MM-DD` の形か確かめる（2026-10-23 指導者の画面で日付に仕込んだHTMLが動いた。詳細は handover.md）
- 機能を使えるかは `Auth.can('機能')` で判定する（役割ごとの ON/OFF を管理タブ「権限の設定」で変えられる。2026-10-23）。
  新しい機能を権限で絞るときは `js/common/permissions.js` の `FEATURES` と、`firestore.rules` の `permFeatures`・`parentFeatures`・`defaultPerm` を**両方**直す。
  管理タブ・登録済みユーザー・権限の設定を開けるかだけは `Auth.isManager()`（管理者・監督・コーチ・役員）。
  役割のきまり（監督は1人・任命と解任・管理者に対する操作は管理者だけ・ログの削除は管理者だけ）は設定では変えられない。詳細は handover.md
- 画面を変えたら `tests/e2e/` の E2E テストを流す（下の「E2E テスト」）。表示を変えたらテストの期待値も直す（テストを消して通さない）

## Firestore ルール記述の注意点

- **存在確認は必ず `exists()` を使う。`get().exists` は undefined で常に false になる**
  ```
  // NG: get(/.../).exists  ← プロパティとして存在しない → 常に false
  // OK: exists(/.../)      ← 専用関数
  ```
- `get().data.field` でフィールドを参照するのは問題ない。存在確認だけ `exists()` に任せる
- `storage.rules` は Firestore の users を参照して承認済みか判定している（`firestore.exists()` / `firestore.get()`）。
  Cloud Storage のサービスエージェントに `Firebase Rules Firestore Service Agent` ロールが必要（付与手順は handover.md）。
  CI のデプロイではこのロールは付与されない。ロールがないと添付ファイルは誰も使えなくなる
- ローカルのエミュレータで Storage のルールを試すと、firebase-tools が 127.0.0.1 宛ての通信も HTTPS_PROXY 経由にするため
  Firestore を参照できず常に拒否になることがある（本番の不具合ではない。handover.md 参照）。
  `tests/e2e/emulators.sh` で起動すれば `noproxy-local.js` がローカル宛てだけ直接つなぐので起きない

## DB設計の注意点

- `DB.loadAllData()` では logs を **Promise.all の外・別の try/catch** で取得すること
  （logs はマネージャー限定。一般保護者が含まれる Promise.all に入れると全データ読み込みが失敗する）
- 新規ドキュメントのIDは `Date.now().toString()` を使う
  （`Math.max(...parseInt(ids))` はFirestoreの文字列IDを0と解釈してID=1衝突を起こす）

## 初代管理者のセットアップ

アプリからは初代 admin を作成できない（セキュリティ上の意図的制限）。
Firebase Console → Firestore → `teams/fc-ojima/users` に手動でドキュメントを作成する。
詳細手順は `handover.md` の「初代管理者のセットアップ手順」を参照。

## E2E テスト（`tests/e2e/`。詳しくは `tests/e2e/README.md`）

Firebase エミュレータ＋Playwright で画面を実際に操作して確かめるテスト一式（45ファイル・653項目。2026-10-23 時点ですべて PASS）。
本番には配信しない（`firebase.json` の hosting の ignore に `tests/**`）。
```bash
cd tests/e2e
./setup.sh                       # 初回だけ（npm install と vendor/ の取得）
./emulators.sh > emu.log 2>&1 &  # 「All emulators ready」まで待つ
./run-all.sh r1                  # 一式（40分ほど）。結果は r1-summary.txt
```
以前のテストはセッションの scratchpad にしかなく、セッションが終わると消えていた。新しいテストもこのフォルダに置き、`run-all.sh` に足す。

## ローカルで画面を触る（エミュレータ使用）

```bash
tests/e2e/emulators.sh   # または firebase emulators:start（クラウドの環境ではプロキシの関係で emulators.sh を使う）
```
ブラウザで `localhost:5000` を開き、DevTools コンソールで:
```javascript
localStorage.setItem('fcojima_use_emulator', '1'); location.reload();
```
これで Auth / Firestore / Storage がすべてローカルエミュレータへ向く（本番に影響しない）。
