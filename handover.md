# 引き継ぎドキュメント (handover)

最終更新: 2026-06-11
mainの最新コミット: `f154d25` (2026-03-18)「複数画面の不具合修正: 画像出力・横レイアウト・出欠表示・会場地図・バッジ」
本番URL: https://fc-ojimajr-hub.web.app （Firebase Hosting / プロジェクト `fc-ojimajr-hub`）

---

## プロジェクト概要

FC尾島ジュニア（少年サッカーチーム）の運営支援Webアプリ。

- **HUB（`hub/`）**: カレンダー・メンバー管理・会場管理・連絡
- **配車管理（`carpool/`）**: イベントごとの出欠確認・車提供登録・座席割り振り・連絡
- **技術**: HTML/CSS/Vanilla JS + Firebase（Hosting / Firestore / Auth / Storage）
- **ビルド工程なし**。リポジトリのルートがそのままデプロイされる（`firebase.json` の `public: "."`）

## デプロイの仕組み（重要）

- **mainへのpush** → GitHub Actions「Deploy to Firebase Hosting」が本番(live)へ自動デプロイ
- **PR作成/更新** → プレビューチャンネル `preview-<PR番号>` へ自動デプロイ（URLがPRにコメントされる）
- **手動再デプロイ**: GitHubのActionsタブ → Deploy to Firebase Hosting → Run workflow（ブランチ=mainで実行）
  - main以外のブランチから手動実行しても本番には反映されない（安全のため制限済み）

> ⚠️ **注意**: pushトリガーのworkflowは「pushされたブランチ上のYAML」で動く。
> 過去ブランチに「自ブランチへのpushで本番デプロイ」という設定が残っていると、
> そのブランチに触れただけで本番が巻き戻る（下記インシデント参照）。
> **古いセッション/ブランチを安易に再開・再pushしないこと。**

## 2026-06-11 インシデント記録（本番巻き戻り事故）

- 旧セッションブランチ `claude/carpool-github-firebase-qQVuP` に当時の設定
  「feature branchへのpushでも本番自動デプロイ」（`17c0557`、2026-02-18）が残っていた
- 過去セッションを遡って閲覧していた際、同ブランチへ引き継ぎ資料作成のコミットがpushされ、
  **2026-02-18時点の古いコードが本番にデプロイされた**
- mainブランチ自体は無傷。PRのマージも発生していなかった（誤作成されたPR #68/#69は未マージのままクローズ）
- **復旧**: main同等の内容を本番(live)へ再デプロイし、本番が最新コードであることを検証済み
- **再発防止**: workflow_dispatch（手動再デプロイ、main限定）を追加（PR #70）、旧claude/*ブランチを削除
- **未実施の根本対策案**: リポジトリの Settings → Environments で
  `FIREBASE_SERVICE_ACCOUNT_FC_OJIMAJR_HUB` をmainブランチ限定の環境シークレットへ移行する
  （これをやればどのブランチのworkflowからも本番へはデプロイできなくなる。手動設定が必要）

## これまでの経緯（要約）

- **2026-02-18**: `claude/carpool-github-firebase-qQVuP` セッションで GitHub + Firebase 連携を構築
- **2026-02-23〜24**: 現在のmainの履歴が始まる（メンバー管理・カレンダー・認証・登録フロー等）。`AI_HANDOFF.md` 作成
- **2026-03-06〜07**: UI改善・モバイル対応・出欠マトリクス等の大量修正（PR #48〜#59）
- **2026-03-14〜18**: CORS/Storage設定、割り当て画面の大幅改善・統計バー・画像出力修正（PR #60〜#67）
- **2026-06-11**: 上記インシデントと復旧。workflow_dispatch追加・引き継ぎ資料整備（PR #70）

## 設計メモ・既知の注意点（現コードベース）

- **名前空間**: `FCOjima.Hub.*` / `FCOjima.Carpool.*` / `FCOjima.Storage` / `FCOjima.DB` / `FCOjima.UI` / `FCOjima.Auth`
- **データストア**:
  - Firestore: `members`, `events`, `venues`, `notifications`, `logs`, `eventCarpool/{eventId}/...`
  - localStorage キャッシュ: `fcojima_members` / `fcojima_events` / `fcojima_venues` / `fcojima_event_{eventId}`
  - sessionStorage: `fcojima_selectedEvent`（配車管理ページ間で選択イベントを共有）
- **イベントID・学年の比較は必ず `String(a) === String(b)`**（型不一致バグが頻発した経緯あり）
- **キャッシュバスト**: HTMLからのJS/CSS参照に `?v=YYYYMMDD` クエリ。JS/CSS変更時は参照側の更新を忘れない
- **Firebase Storage**: `storage.rules` + `cors.json`（mainデプロイ時にCIが適用）
- カラーテーマ: ユニフォームカラー（山吹色 `#E8A200` × 黒/濃茶 `#1C1600`）

## 関連ドキュメント

- `AI_HANDOFF.md`: 2026-02時点の引き継ぎ仕様書。
  PAT+curlによるPR操作手順が書かれているが、現在はClaude CodeのGitHub連携でPR作成・マージが
  できるため不要（「PR作成・マージ・デプロイ確認はAIが自動で行う」という運用方針は現在も有効）
- `docs/archive/`: 削除した旧ブランチから救出した当時の引き継ぎ資料（2026-02時点の内容）。
  記載されている「未修正バグ」はその後のmainで修正済みの可能性が高い。現状は本ファイルを正とする
