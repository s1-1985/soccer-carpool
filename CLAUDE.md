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

## Firestore ルール記述の注意点

- **存在確認は必ず `exists()` を使う。`get().exists` は undefined で常に false になる**
  ```
  // NG: get(/.../).exists  ← プロパティとして存在しない → 常に false
  // OK: exists(/.../)      ← 専用関数
  ```
- `get().data.field` でフィールドを参照するのは問題ない。存在確認だけ `exists()` に任せる

## DB設計の注意点

- `DB.loadAllData()` では logs を **Promise.all の外・別の try/catch** で取得すること
  （logs はマネージャー限定。一般保護者が含まれる Promise.all に入れると全データ読み込みが失敗する）
- 新規ドキュメントのIDは `Date.now().toString()` を使う
  （`Math.max(...parseInt(ids))` はFirestoreの文字列IDを0と解釈してID=1衝突を起こす）

## 初代管理者のセットアップ

アプリからは初代 admin を作成できない（セキュリティ上の意図的制限）。
Firebase Console → Firestore → `teams/fc-ojima/users` に手動でドキュメントを作成する。
詳細手順は `handover.md` の「初代管理者のセットアップ手順」を参照。

## ローカルテスト（エミュレータ使用）

```bash
firebase emulators:start
```
ブラウザで `localhost:5000` を開き、DevTools コンソールで:
```javascript
localStorage.setItem('fcojima_use_emulator', '1'); location.reload();
```
これで Auth / Firestore / Storage がすべてローカルエミュレータへ向く（本番に影響しない）。
