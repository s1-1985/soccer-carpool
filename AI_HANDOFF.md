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

## 📁 ファイル構造と各ファイルの役割

### 【現役ファイル】実際に使われているファイル

```
/index.html                       ルートランディングページ（hub/ or carpool/ へ誘導）

hub/
├── index.html    ★メインHUBページ（SPA・タブ方式）
│                   カレンダー / メンバー / 連絡事項 / 会場登録 の4タブを内包
│                   CSSは hub/calendar.css, members.css, notifications.css, venues.css をすべてロード
│                   JSは js/hub/main.js + calendar.js + members.js + notifications.js + venues.js をロード
└── login.html    Googleログイン画面

carpool/
├── index.html         配車機能のエントリポイント（overview.html へリダイレクト等）
├── overview.html      配車イベント一覧・選択画面
├── attendance.html    出欠確認画面
├── cars.html     ★車提供登録画面（旧 carprovision.html の後継・現役）
├── assignments.html ★座席割り当て画面（旧 assignment.html の後継・現役）
└── notifications.html 配車連絡画面

js/
├── common/
│   ├── firebase-config.js  Firebase接続設定（変更禁止）
│   ├── auth.js             Firebase認証ラッパー（FCOjima.Auth）
│   ├── db.js               Firestoreアクセス層（FCOjima.DB）← Firestore操作はここのみ
│   ├── storage.js          localStorage/Firestore二重保存（FCOjima.Storage）
│   ├── ui.js               共通UI操作・タブ切り替え（FCOjima.UI）
│   ├── utils.js            日付・文字列ユーティリティ（FCOjima.Utils）
│   └── global.js           グローバル初期化
├── hub/
│   ├── main.js             HUB全体の初期化・認証チェック
│   ├── calendar.js         カレンダー表示・イベントCRUD（FCOjima.Hub.Calendar）
│   ├── members.js          メンバー一覧・CRUD（FCOjima.Hub.Members）
│   ├── notifications.js    連絡事項（FCOjima.Hub.Notifications）
│   └── venues.js           会場登録・一覧（FCOjima.Hub.Venues）
└── carpool/
    ├── overview.js         配車概要・イベント一覧（FCOjima.Carpool.Overview）
    ├── assignment.js       座席割り当てロジック（1300行超）（FCOjima.Carpool.Assignment）
    ├── carprovision.js     車提供登録（FCOjima.Carpool.CarProvision）
    ├── attendance.js       出欠確認（FCOjima.Carpool.Attendance）
    └── notifications.js   配車連絡（FCOjima.Carpool.Notifications）

css/
├── common.css              全ページ共通スタイル（ヘッダー・タブ・ボタン・モーダル等）
├── hub/
│   ├── calendar.css        カレンダーグリッド・イベント表示スタイル
│   ├── members.css         メンバーカード・リストスタイル
│   ├── notifications.css   連絡事項スタイル
│   └── venues.css          会場リストスタイル
└── carpool/
    ├── common.css          carpool共通（ナビ・フッター・レイアウト）
    ├── overview.css     ★配車概要スタイル（現役）
    ├── attendance.css      出欠確認スタイル
    ├── carprovision.css    車提供スタイル（cars.html も同CSSを使用）
    ├── assignment.css      座席割り当てスタイル（assignments.html も同CSSを使用）
    └── notifications.css   配車連絡スタイル

Firebase設定ファイル:
├── firebase.json           ホスティング設定（変更禁止）
├── firestore.rules         Firestoreセキュリティルール
├── firestore.indexes.json  Firestoreインデックス設定
└── .github/workflows/firebase-deploy.yml  GitHub Actions自動デプロイ
```

### 【旧・非推奨ファイル】git上に残っているが使われていない

| ファイル | 後継 | 状態 |
|---|---|---|
| `carpool/assignment.html` | `carpool/assignments.html` | 旧版（v=20260219）。使用しない |
| `carpool/carprovision.html` | `carpool/cars.html` | 旧版。ナビは cars.html を指している |
| `css/carpool/overview-css.css` | `css/carpool/overview.css` | 不使用（overview.html は overview.css のみロード） |
| `hub/calendar.html` | `hub/index.html`（カレンダータブ） | 単体ページ旧版。SPA移行済み |
| `hub/members.html` | `hub/index.html`（メンバータブ） | 単体ページ旧版。SPA移行済み |
| `hub/notifications.html` | `hub/index.html`（連絡事項タブ） | 単体ページ旧版。SPA移行済み |
| `hub/venues.html` | `hub/index.html`（会場登録タブ） | 単体ページ旧版。SPA移行済み |

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

## 🚀 デプロイ履歴

| PR | 日付 | ブランチ | 内容 | コミット |
|---|---|---|---|---|
| #11 | 2026-02-23 | claude/fix-calendar-seating-bugs-fjK5Z | hub二重ナビ削除・carpool-navデザイン修正 | 8e7ac8c |
| #12 | 2026-02-23 | claude/fix-calendar-seating-bugs-fjK5Z | hub/index.htmlに不足CSSを追加（カレンダー崩れ修正） | 948c5b5 |
| #13 | 2026-02-23 | claude/fix-calendar-seating-bugs-fjK5Z | タブ1行固定・上部スティッキー・ボタン下部スティッキー対応 | 1d4890d |
| #15 | 2026-02-23 | claude/fix-calendar-seating-bugs-fjK5Z | メンバー管理・カレンダー・認証・登録フロー改善 | 228787a |
| #16 | 2026-02-23 | claude/fix-calendar-seating-bugs-fjK5Z | カレンダーUI・出欠確認・登録フロー・会場地図対応 | 47ef18b |
| hotfix | 2026-02-23 | claude/fix-calendar-seating-bugs-fjK5Z | register.html SyntaxError修正・初回登録者自動管理者承認 | 5199da4 |

---

## 🔄 最新の作業状況

**最終更新:** 2026-02-23 (Session 4 - register.html緊急修正完了)
**更新者:** Claude (branch: claude/fix-calendar-seating-bugs-fjK5Z)
**最終正常コミット:** 5199da4 (hotfix - register.html SyntaxError修正)

### PR #15 (228787a) で行った変更
1. **storage.js**: ダミーデータ削除・Firestore優先ロードに変更
2. **members.js**: 略称フィールド追加・役員(officer)ロール追加・ソート順更新
3. **calendar.js**: イベント重複チェック・「自分の子供のみ」フィルター実装
4. **auth.js / db.js**: Firestoreユーザー管理・承認状態チェック（pending/active/rejected）
5. **firestore.rules**: 役割別アクセス制御
6. **hub/register.html**: 新規登録ページ作成
7. **hub/pending.html**: 承認待ちページ作成
8. **js/hub/admin.js**: 管理者用承認画面モジュール作成
9. **hub/index.html**: 管理タブ追加

### PR #16 (現在コミット予定) で行った変更
1. **css/hub/calendar.css**:
   - カレンダー月曜始まり（月火水木金土日の列順）
   - 土日列を平日の1.6倍幅広に
   - セル最小高さを100pxに増加（スマホ80px）
   - イベントを2行表示（`-webkit-line-clamp: 2`）
   - イベント種別 `event`（イベント）のスタイル追加
2. **hub/index.html**:
   - 曜日ヘッダーを月火水木金土日に変更
   - イベント種別に「イベント（保護者も出欠対象）」追加（`event`）
   - 会場フォームに地図ピン指定・現在地ボタン追加（lat/lng対応）
3. **js/hub/calendar.js**:
   - `renderCalendar`: 月曜始まりに修正（`(firstDay.getDay() + 6) % 7`）
   - イベント詳細モーダルのログ: `eventId`で固有ログ絞り込み
   - `saveEvent`/`deleteEvent`: ログに`eventId`を記録するよう更新
4. **js/common/utils.js**: `getEventTypeLabel`に`event`(イベント)を追加
5. **js/common/storage.js**: `addLog`に`extra`引数を追加（追加フィールドをログに混入可能に）
6. **js/carpool/attendance.js**:
   - テーブル行の削除ボタンを除去
   - 「参加者を削除」ボタン追加・削除モーダル（`openRemoveAttendeeModal`）実装
   - イベント種別が`event`のとき、保護者（mother/father/officer）も出欠自動追加
   - `reminderAttendance`: 日付・イベント名・対象学年・期限・未回答人数・直リンクURLを含むメッセージに強化
   - `openMemberSelectModal`: `event`種別のとき保護者も追加候補に表示
7. **carpool/attendance.html**:
   - テーブルヘッダー「操作」列を削除（colspan=5→4）
   - 「参加者を追加」「参加者を削除」ボタンを下部action-buttonsに配置
   - 削除モーダル（`remove-attendee-modal`）HTML追加
8. **hub/register.html**:
   - 子供選択UIを順次ドロップダウン方式に変更
   - 1人目を選択すると自動的に2人目の選択欄が追加される（兄弟対応）
   - コーチ・監督も同フォームから登録可能（子供選択あり）
   - 役員（officer）は登録時には選べない（hardcodedで`role: 'parent'`のまま、後から権限者が付与）
9. **js/hub/venues.js**:
   - 地図関連ボタンのイベントリスナー追加（`setupMapListeners`）
   - `showLatLngInput`: 緯度・経度の手入力エリアを動的生成
   - `showMapPreview`: 座標でGoogle Mapsリンクを表示
   - 現在地取得（`navigator.geolocation`）対応
   - 会場オブジェクトに`lat`/`lng`フィールドを保存
   - `renderVenueList`: lat/lng優先で地図リンクを生成
   - `openAddVenueModal`: 編集時にlat/lngを復元

### Hotfix (5199da4) で行った変更
**問題:** PR#16デプロイ後、ログインページが壊れた（`Uncaught SyntaxError: Identifier 'TEAM_ID' has already been declared`）

**原因:** `firebase-config.js` がグローバルスコープで `const TEAM_ID = 'fc-ojima'` を宣言。
`register.html` のインラインスクリプト（IIFEなし）でも `const TEAM_ID = ...` を再宣言していた。

**修正内容:**
1. **hub/register.html**: 重複する `const TEAM_ID` 宣言を削除（グローバルの`TEAM_ID`をそのまま利用）
2. **hub/register.html**: 初回登録者ブートストラップロジック追加
   - 承認済みユーザーが0人の場合、最初の登録者を`role: 'admin', status: 'approved'`として自動承認
   - 承認後は `/hub/index.html` へ直接遷移（`/hub/pending.html`ではない）
   - サブタイトルに「最初の登録者は管理者として自動承認されます」のメッセージを表示
3. **firestore.rules**: `/users/{uid}` の読み取りルールを緩和
   - 認証済みユーザーが承認済みユーザーの有無をクエリ可能に（`resource.data.status == 'approved'`）
   - 作成ルールに `admin/approved` でのユーザー作成を許可（ブートストラップ用）

**注意:** firestore.rulesの変更により、認証済みユーザーは承認済みユーザーのドキュメントを読めるようになった。
これは小規模チームアプリとして許容範囲のリスク判断。

### ユーザーからの方針指示（重要）
- **座席割り当ては最終目標**：まずレイアウト・デザイン・その他機能を完成させる
- **作業の都度 AI_HANDOFF.md を更新すること**（必須）
- **ファイル構造の詳細・デプロイ日時・旧ファイル情報を引継ぎに明記すること**（必須）
- **トークン切れに備え、作業中断前に必ずMDを更新してコミット**（重要）

### 次のAIがすべきこと（優先順）
1. **役員ロール付与フロー**: admin.jsで管理者・監督・コーチ・既存役員が他ユーザーのroleを「officer」に変更できるUIを追加
2. **carpool各ページのスティッキー化**: attendance.html, cars.html 等も上部ナビ・下部ボタンをsticky固定
3. **座席割り当て（assignments.html）**: Firestoreからのロード確認と修正
4. **車提供（cars.html / carprovision.js）**: Firestore非同期ロード対応

### 既知の問題
- 座席割り当て画面（assignments.html）：Firestoreからのロードが動作しているか未確認
- 車提供ページ（cars.html）：localStorageのみ読み込みの可能性
- 旧ファイル（carpool/assignment.html, carprovision.html 等）が git 上に残存（削除はユーザー確認後）
- イベント種別`event`（保護者出欠）は新規イベントにのみ適用。既存の`other`種別のイベントは保護者自動追加されない（後方互換のため）
- Firestore の register.html ブートストラップ: 管理者登録後、Firestore rules の admin/approved 作成許可を残してある（次のAIはルールを再確認すること）
