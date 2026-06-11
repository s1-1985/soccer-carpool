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
- PR作成・マージ・デプロイ確認は基本AIが自動で行う（ユーザー方針。`AI_HANDOFF.md` 参照）
