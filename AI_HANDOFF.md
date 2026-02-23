# FC尾島ジュニア HUB - AI引き継ぎ仕様書

> **全AIエージェントへ：** このリポジトリで作業を始める前に必ずこのファイルを最初に読んでください。
> 過去にGeminiがこのファイルを無視し、Firebase設定を別プロジェクトに繋ぎ替えたり、
> ファイルを文字化けさせたりする重大な破壊を起こしています。

---

## 📋 プロジェクト概要

**アプリ名:** FC尾島ジュニア HUB
**目的:** 少年サッカーチームの配車・出欠・メンバー管理Webアプリ
**本番URL:** https://fc-ojimajr-hub.web.app
**Firebase プロジェクト:** `fc-ojimajr-hub`（変更禁止！）

---

## 🔥 Firebase設定（変更禁止）

```javascript
// js/common/firebase-config.js に記載
const firebaseConfig = {
  apiKey: "AIzaSyAM3ukhgT-5ITkaputyom6xxSM5B9Uio3A",
  authDomain: "fc-ojimajr-hub.firebaseapp.com",
  projectId: "fc-ojimajr-hub",          // ← これが正しいプロジェクトID
  storageBucket: "fc-ojimajr-hub.firebasestorage.app",
  messagingSenderId: "583979255748",
  appId: "1:583979255748:web:095b681f0b16e7ee0bc691"
};
```

**firebase.json の正しい設定:**
```json
{
  "hosting": {
    "site": "fc-ojimajr-hub",
    "public": ".",          // ← ルートを配信（"public"サブディレクトリではない！）
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**", "firestore.rules", "firestore.indexes.json"],
    "headers": [
      { "source": "**/*.html", "headers": [{"key": "Cache-Control", "value": "no-cache"}] },
      { "source": "**/*.@(js|css)", "headers": [{"key": "Cache-Control", "value": "no-cache"}] }
    ]
  },
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
}
```

---

## 🏗️ アーキテクチャ

### 技術スタック
- **フロントエンド:** Vanilla JavaScript（フレームワークなし）
- **ストレージ:** Firebase Firestore（優先） + localStorage（フォールバック）
- **認証:** Firebase Authentication（Googleログイン）
- **ホスティング:** Firebase Hosting（GitHub Actions自動デプロイ）

### 名前空間（JavaScriptモジュール構造）
```
window.FCOjima
├── FCOjima.UI            → js/common/ui.js
├── FCOjima.Utils         → js/common/utils.js
├── FCOjima.Storage       → js/common/storage.js
├── FCOjima.Auth          → js/common/auth.js
├── FCOjima.DB            → js/common/db.js   ← Firestoreアクセスはここのみ
├── FCOjima.Hub
│   ├── FCOjima.Hub.Calendar     → js/hub/calendar.js
│   ├── FCOjima.Hub.Members      → js/hub/members.js
│   ├── FCOjima.Hub.Notifications → js/hub/notifications.js
│   └── FCOjima.Hub.Venues       → js/hub/venues.js
└── FCOjima.Carpool
    ├── FCOjima.Carpool.Overview  → js/carpool/overview.js
    ├── FCOjima.Carpool.Assignment → js/carpool/assignment.js
    ├── FCOjima.Carpool.CarProvision → js/carpool/carprovision.js
    ├── FCOjima.Carpool.Attendance → js/carpool/attendance.js
    └── FCOjima.Carpool.Notifications → js/carpool/notifications.js
```

**重要:** `FCOjima.Firestore` は存在しない。Firestoreアクセスは必ず `FCOjima.DB` を使うこと。

### Firestoreコレクション構造
```
teams/fc-ojima/
├── members/       メンバー一覧
├── venues/        会場一覧
├── events/        イベント（試合・練習）
├── notifications/ 連絡事項
├── logs/          操作ログ
└── eventData/{eventId}  配車・出欠データ
```

---

## 📁 ファイル構造

```
/
├── hub/              HUBページ（メイン管理画面）
│   ├── index.html    HUBトップ（メンバー・イベント・通知）
│   ├── calendar.html カレンダー/イベント管理
│   ├── members.html  メンバー管理
│   ├── notifications.html 連絡事項
│   └── venues.html   会場管理
├── carpool/          配車管理ページ
│   ├── index.html    配車概要
│   ├── attendance.html 出欠確認
│   ├── cars.html     車提供登録
│   ├── assignments.html 座席割り当て ← 重点修正対象
│   └── notifications.html 連絡
├── js/
│   ├── common/       共通ライブラリ
│   └── hub/, carpool/ 各ページ用JS
├── css/              スタイルシート
├── firebase.json     Firebase設定（変更禁止）
└── AI_HANDOFF.md     本ファイル
```

---

## ✅ 現在の実装状況（最終正常コミット: 936f74c）

### 動作確認済み
- Googleログイン認証
- HUBページ全体（メンバー/イベント/会場/連絡事項）
- イベントモーダル（学年外選手追加機能含む）
- 操作ログ（ユーザー名付き）
- モーダルのキャンセルボタン
- メンバー検索・詳細表示

### 直近の修正（座席割り当て関連）
- `assignment.js` の `init()` を async化、Firestore から直接ロード
- `overview.js` の `saveData()` を Firestore にも保存するよう修正
- `assignments.html` で `await Assignment.init()` になっていなかったバグを修正
- 車両なし時でもメンバーリストが「読込中」のまま固まるバグを修正

### 未解決・要確認
- 座席割り当て画面がまだ「読込中のまま」との報告あり（修正はデプロイ済みだが本人未確認）
- 車提供（carprovision.js）もFirestoreから非同期ロードするよう修正が必要

---

## ⚠️ 他AIへの厳重な注意事項

### 絶対にやってはいけないこと

1. **firebase-config.js のプロジェクトIDを変更しない**
   - 正しい: `fc-ojimajr-hub`
   - 過去にGeminiが `fc-ojima-hub`（別プロジェクト）に変更して全データが消えた

2. **firebase.json の `"public"` を `"public"` サブディレクトリに変更しない**
   - 正しい: `"public": "."`（ルートから配信）
   - Geminiが `"public": "public"` にして404が多発した

3. **`public/` ディレクトリを作らない**
   - このプロジェクトはルートから配信する。`public/`サブディレクトリは不要

4. **`FCOjima.Firestore` を使わない**
   - そのような名前空間は存在しない。正しくは `FCOjima.DB`

5. **マージコンフリクトを放置してコミットしない**
   - `<<<<<<< HEAD` マーカーがあるファイルは必ず解決してからコミット

6. **ファイルを完全に書き換えない**
   - 既存の動作するコードを確認せずに別アーキテクチャに書き換えると破壊につながる

7. **`assignment.js` を短縮・書き換えない**
   - 現在1300行以上の正常なコード。「SyntaxError」が出た場合はファイルの欠損が原因なので末尾を確認すること

### マージコンフリクト発生時
```bash
# コンフリクトマーカーが残っていないか確認
grep -r "<<<<<<< HEAD" --include="*.js" --include="*.html" --include="*.json" .

# コンフリクトがある場合は我々のバージョン（HEAD）を採用
git checkout HEAD -- <ファイルパス>
```

---

## 🚀 デプロイフロー

```bash
# 1. 作業ブランチを作成（必ず claude/ プレフィックス）
git checkout -b claude/fix-xxx-yyy

# 2. 変更してコミット
git add <ファイル>
git commit -m "fix: 説明"

# 3. プッシュ
git push -u origin claude/fix-xxx-yyy

# 4. PRを作成してmainにマージ（GitHub Actionsが自動デプロイ）
gh pr create --repo s1-1985/soccer-carpool --title "..." --head claude/fix-xxx-yyy --base main --body "..."
gh pr merge <PR番号> --repo s1-1985/soccer-carpool --merge

# 5. デプロイ確認
gh run list --repo s1-1985/soccer-carpool --limit 3
```

---

## 📝 このファイルの更新ルール

作業を終えるとき、または別のAIに引き継ぐときは必ずこのファイルの以下のセクションを更新してください：

```markdown
## 🔄 最新の作業状況

**最終更新:** YYYY-MM-DD HH:MM
**更新者:** Claude / Gemini
**最終正常コミット:** <コミットハッシュ>

### 今回行った変更
- ...

### 次のAIがすべきこと
1. ...
2. ...

### 既知の問題
- ...
```

---

## 🔄 最新の作業状況

**最終更新:** 2026-02-23 (Session 2)
**更新者:** Claude (branch: claude/fix-calendar-seating-bugs-fjK5Z)
**最終正常コミット:** a1f8964（前回：Gemini破壊修復完了）

### 今回行った変更（レイアウト・デザイン修正）
1. **hub/index.html**
   - `<nav class="main-nav">` を削除（タブと二重ナビになっていた）
   - `<div class="tab">` を `.container` の外に移動（全幅表示のため）
2. **css/carpool/common.css**
   - `.carpool-nav` スタイル改善：白背景、金ボーダー（`border-bottom: 2px solid #E8A200`）、左右パディング統一
   - `.container { padding-bottom: 90px }` 追加（固定フッターで隠れないよう）
   - モバイルの `carpool-nav` を縦並びから折り返し表示に変更

### ユーザーからの方針指示（重要）
- **座席割り当ては最終目標**：まずレイアウト・デザイン・その他機能を完成させる
- **作業の都度 AI_HANDOFF.md を更新すること**（必須）

### 次のAIがすべきこと
1. ユーザーが指示するレイアウト・機能修正に対応する
2. 各HTMLページのデザイン整合性を確認（carpool vs hub）
3. 座席割り当て（assignments.html）は最後に対応
4. 車提供（cars.html）の Firestore 非同期ロードは後で対応

### 既知の問題
- 座席割り当て画面（assignments.html）：Firestoreからのロードが動作しているか未確認
- 車提供ページ（cars.html）：localStorageのみ読み込みの可能性
- hub サブページ（calendar.html, members.html等）は単体でも存在するが、メインは hub/index.html のタブ方式
