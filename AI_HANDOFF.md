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

## ✅ 現在の実装状況（最終正常コミット: cd884ca5 / PR #21）

### 動作確認済み
- Googleログイン認証
- HUBページ全体（メンバー/イベント/会場/連絡事項）
- イベントモーダル（学年外選手追加機能含む）
- 操作ログ（ユーザー名付き）
- モーダルのキャンセルボタン
- メンバー検索・詳細表示
- メンバーソート（監督→コーチ→選手→保護者→その他）
- 保護者の子ども登録（childrenIds方式）・卒団連動削除
- 選手の自動卒団（Utils.calculateGrade が null の場合削除）
- ナイターイベント種別（自動入力・配車ボタン非表示）
- 会場フォーム簡略化（緯度経度・タイプ削除・地図を開くボタン）
- 連絡事項・会場削除権限（投稿者本人 or 管理者のみ）
- 配車管理 概要タブ 会場マップリンク
- **座席割り当て（assignments.html）- SyntaxError修正により初めて動作可能に**

### 未解決・要確認
- 旧ファイル（carpool/assignment.html, carprovision.html 等）が git 上に残存（削除はユーザー確認後）
- 車提供（carprovision.js）保護者フィルター: childrenIds ベースに今後更新推奨

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
| **未PR** | 2026-02-24 | claude/review-calendar-seating-9A20d | Session5前回分16コミット統合（下記参照） | - |
| **未PR** | 2026-03-02 | claude/review-calendar-seating-QHdbi | Session8: 割り当てUI改善・コメント機能 | 9e2cc70 |

---

## 🔄 最新の作業状況

**最終更新:** 2026-03-02 (Session 8 - 割り当て画面UI改善・コメント機能追加)
**更新者:** Claude (branch: claude/review-calendar-seating-QHdbi)
**最終正常コミット:** 9e2cc70（未PR・main未マージ）

### ⚠️ PR未作成の注意
- Session5（前回）の16コミットは `claude/review-calendar-seating-9A20d` に統合済みだが、**まだmainへのPRが未作成**
- このセッションの作業終了後、ユーザーがGitHub上で `claude/review-calendar-seating-9A20d` → `main` のPRを作成してマージすること
- GitHub URL: https://github.com/s1-1985/soccer-carpool/compare/main...claude/review-calendar-seating-9A20d

### Session5 で行った変更（前セッション・未マージ16コミット）
1. `7f7166a` **フリガナ追加・FABバグ修正・LINEリンク案内文追加・ドライバー表示順修正**
   - members.js: フリガナ（furigana）フィールド追加・ソート対応
   - assignment.js: FABボタン（浮動アクションボタン）バグ修正
2. `0a94970` **座席割り振りバグ修正 + Firestore対応強化**
   - assignment.js: Firestoreから直接ロード・保存
3. `7028ced` **座席割り当てメンバーアイコンの色分け修正**
4. `4dc4591` **membersContainerへの重複ドロップリスナー問題を修正**
5. `ee12dde` **全carpoolページでFirestore優先ロードに統一**
   - overview.js, attendance.js, carprovision.js: Firestore非同期ロード対応
6. `435db2a` **editCarDriver のcarIndex参照バグ修正**
7. `42484ca` **イベント編集時にextraPlayersが消えるバグを修正**
8. `ed78c80` **extraPlayersが出欠・座席割り当てに反映されないバグを修正**
9. `0686c5e` **shareAssignments の不使用変数削除（carIndex→carRegistrations誤参照）**
10. `20de329` **連絡事項のシェア/削除ボタンの誤インデックスバグを修正**
11. `846dbb9` **Firestoreロード条件・通知IDなし問題・誤carIndex参照を修正**
12. `2198617` **座席間ドラッグ後にメンバーリストが更新されないバグを修正**
13. `2f5ecd9` **座席内メンバーアイコンに役割別色分けを追加**
14. `36f7033` **座席編集モーダルに seat-current-info と seat-member-list を追加**
15. `b455d5c` **Storage.addLog が Firestore にログを保存しないバグを修正**
16. `40dddb1` **イベント削除時のログバックアップ損失・ログ順序・検索正規表現を修正**

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

### Session 6 で行った変更
1. **前セッション16コミット統合**: `claude/fix-calendar-seating-bugs-fjK5Z` のコミットを現ブランチにマージ
2. **carpool各ページのスティッキー化**:
   - `css/carpool/common.css`: `header { position: sticky; top: 0; z-index: 200; }` 追加
   - `css/carpool/common.css`: `.carpool-nav { position: sticky; top: 71px; z-index: 199; }` 追加
   - `css/carpool/common.css`: `.card > .action-buttons, .container > .action-buttons { position: sticky; bottom: 60px; }` 追加
   - 全carpool HTML（attendance/cars/assignments/notifications/overview/index）のCSSバージョンを `v=20260224` に更新
3. **役員ロール付与フロー**: 確認したところすでに実装済み（admin.jsに role selectドロップダウン + 変更ボタンあり）

### Session 7 で行った変更（2026-02-25 / branch: claude/review-calendar-seating-QHdbi）

#### 変更ファイル
- `js/carpool/assignment.js` (+276行): 以下すべてのバグ修正・機能追加
- `carpool/assignments.html`: リセットボタン追加、運転手変更モーダル追加、モバイル向けレイアウト改善
- `css/carpool/assignment.css`: モバイル1カラム、ボトムシート風モーダル、座席数調整ボタン

#### 実装内容
1. **座席タップ時のメンバーリストをイベント対象学年でフィルタリング** (`openSeatEditModal` + `getEventFilteredMembers`ヘルパー追加)
2. **ランダム配置もイベント対象学年でフィルタリング** + 出欠参加確定選手を優先
3. **同学年グループ化ランダム配置**: 同じ学年の選手が同じ車にまとまるよう配置アルゴリズム改善
4. **運転手変更モーダル**: ドライバー座席をタップ → モーダルから選手以外のメンバーを選択
5. **選手（player）は運転席に割り当て不可**: 運転手モーダルに選手を表示しない + D&Dで運転席へのドロップを禁止
6. **座席数をリアルタイム調整**: 各車の助手席/中列/後列それぞれ +/- ボタンで増減可能
7. **割り振りリセットボタン追加**: 全座席をクリアするボタンを追加
8. **画像出力の情報拡充**: 日時・イベント名・集合時間・集合場所・会場・参加指導者・参加選手名を表示
9. **画像横幅拡大**: min 800px確保、座席・アイコンを大きく、名前が見切れにくく
10. **スマホUI改善**: モバイルで1カラム（車両リストが全幅に）、座席/運転手選択モーダルはボトムシート風

### Session 8 で行った変更（2026-03-02 / branch: claude/review-calendar-seating-QHdbi）

#### コミット: 9e2cc70

#### 変更ファイル
- `css/common.css`: ヘッダー縮小（モバイル）
- `css/carpool/common.css`: ナビ sticky top 更新
- `css/carpool/assignment.css`: 車ヘッダーレイアウト・スクロールスナップ・コメント・横画面対応
- `carpool/assignments.html`: ボタン順変更・コメントセクション追加
- `js/carpool/assignment.js`: 車ヘッダー・コメント機能・LINE共有・画像出力改善
- `js/carpool/overview.js`: comment フィールドをデータ保存/ロードに追加

#### 実装内容
1. **上部スペース削減・ヘッダー縮小**: モバイルで header padding `15px`→`6px`、h1 `24px`→`17px`
2. **車ヘッダー変更**: 「田中の車 ✏」→「田中（略称）」+ 「座席数変更」ボタンをインライン横並び
3. **備考欄コンパクト化**: 提供タイプ表示を削除、備考のみ1行表示
4. **スクロールスナップ（縦）**: 車エリアに `scroll-snap-type: y mandatory`（1台ずつ止まる）
5. **スクロールスナップ（横）**: 横レイアウト時の車エリアに `scroll-snap-type: x mandatory`
6. **ボタン順変更**: ランダム配置・リセット・保存・**コメント**・画像で出力（LINEで共有→コメントに変更）
7. **LINE共有は「保存して共有」ボタンに統合**: グローバルナビの既存ボタンから引き続き利用可能
8. **コメント機能追加**:
   - 作業エリア最下部に textarea（1つ）を常時表示
   - 「コメント」ボタン押下でスクロール＆フォーカス
   - blur 時に自動保存 or 保存ボタンで保存（Firestore の `comment` フィールドに永続化）
   - LINE共有テキストにコメントを反映
   - 画像出力にコメントを赤太文字で強調表示
9. **メンバーアイコン幅縮小・左詰め**: item 幅を少し縮小、padding・gap 調整
10. **横画面（landscape）対応**: `orientation: landscape` and `max-height: 500px` 時にメンバーエリアも横スクロール、アイコン幅 72px に縮小、名前2行折り返し、グループヘッダー非表示

### 次のAIがすべきこと（優先順）
1. **PRを作成・マージ**: `claude/review-calendar-seating-QHdbi` → `main` のPRを作成・マージ
2. **Firebase自動デプロイ確認**: PRマージ後、GitHub Actionsが自動デプロイ → `https://fc-ojimajr-hub.web.app` で確認
3. **実機動作確認**: スナップスクロール・コメント保存・画像出力にコメント反映
4. **追加要望があれば対応**

### 既知の問題
- 旧ファイル（carpool/assignment.html, carprovision.html 等）が git 上に残存（削除はユーザー確認後）
- イベント種別`event`（保護者出欠）は新規イベントにのみ適用

---

## 🧭 システム設計の根幹原則（2026-02-26 確定）

このシステムは作成者の子どもが卒団した後も、別の保護者・管理者が長期的に使い続けることを前提に設計する。

### 3原則

| 原則 | 意味 | 技術的含意 |
|---|---|---|
| **① 無料** | 利用者・作成者どちらにも課金が発生しない | 無料枠で収まる設計、従量課金サービスは原則使わない |
| **② 直感的** | 作成者不在でも誰でも迷わず使える | 複雑な操作を要する機能は作らない、UI はシンプルに |
| **③ メンテナンスフリー** | 卒団後に保守作業を求められても対応できない | npm依存なし・ビルド不要・管理場所を最小化 |

### 3原則に照らした現在のアーキテクチャ評価

```
技術選択                          3原則との相性
──────────────────────────────────────────────
Vanilla JS（フレームワークなし）   ◎ ビルド不要・npm依存なし・10年後も動く
Firebase Auth + Firestore         ◎ 管理不要・Google が維持・無料枠で十分
Firebase Hosting + GitHub Actions ◎ push だけで自動デプロイ・触る必要なし
Firebase Storage（将来追加）      ◎ 同じ Firebase で管理一元化・実装シンプル
```

**現在の構成は3原則と非常に相性が良い。**
特に Vanilla JS を選んだことがメンテナンスフリーに効いている。React 等のフレームワークだと npm パッケージの陳腐化・セキュリティアップデートが定期的に発生し、数年後に誰も触れなくなるリスクがある。

### 新機能・変更の判断基準

何か追加・変更を検討する際は、以下を必ず確認すること：

1. **無料枠を超えないか？** 従量課金が発生する設計は避ける
2. **管理する場所が増えないか？** サービス追加はメンテコスト増につながる
3. **作成者不在でも運用できるか？** 管理者が定期作業を要する仕組みは避ける

---

## 💡 将来構想：イベントへのファイル添付機能

> **⚠️ 重要：ユーザーから明示的な実装指示があるまで、この構想に対して一切のコード変更・実装アクションを取ってはならない。**

### 概要
各イベントに対して、大会要綱・レギュレーション等のファイル（PDF / Excel / Word / JPEG 等）を添付・閲覧DLできる機能を将来的に追加したい。

### Firebase 無料枠に関する認識整理（2026-02-26 確認済み）

Firebase の制限はサービスごとに独立している：

| サービス | 制限内容 | 補足 |
|---|---|---|
| **Firestore** | 保存データ **1 GiB**・読み取り5万回/日・書き込み2万回/日 | 転送量ではなく蓄積データ量 |
| **Firebase Storage** | 保存データ **5 GiB**・DL転送量 **1 GB/日** | ファイルを直接置く場合の制限 |
| **Firebase Hosting** | 保存 10 GiB・転送 **360 MB/日** | 静的ファイル（HTML/CSS/JS）の配信 |

**ポイント：** ファイルを Firebase Storage に置いた場合、ユーザーがDLするたびに転送量（1 GB/日）を消費する。大人数が大きなファイルをDLすると上限に近づく可能性がある。

### UX 要件（2026-02-26 確認済み）

- イベントモーダル内に「ファイルを添付」ボタンを配置
- タップ → 端末のファイル選択画面 → 選ぶだけ、という標準的なWebアップロードUI
- 添付済みファイルは一覧表示し、各ファイルをタップでDL
- アップロードは管理者のみ、DLは全ユーザーが可能（権限は既存の Auth に準拠）
- 複雑な操作を排除し、LINEやSlackでファイルを送る感覚に近い操作感を目標とする

```
【イベントモーダルのイメージ】

┌─────────────────────────────┐
│ ○○大会（6/15）              │
│ 会場: 尾島グラウンド         │
│                              │
│ 📎 添付ファイル              │
│  ├ 大会要綱.pdf       [DL]  │
│  └ 会場マップ.jpg     [DL]  │
│  [+ ファイルを添付]          │ ← 管理者のみ表示
└─────────────────────────────┘
```

### 採用予定アーキテクチャ（Firebase Storage 案 ← 3原則に基づき最終決定）

**Google Drive 案・Cloudflare R2 案は却下。Firebase Storage を使う。**

理由：3原則の「メンテナンスフリー」に照らすと、管理場所を増やすべきでない。
- Google Drive 案 → 管理者が Drive とシステムを二重管理する手間が発生
- Cloudflare R2 案 → Cloudflare Workers という別サービスの管理が必要になる
- Firebase Storage → 既存の Firebase に一本化、追加サービス不要

小規模チーム（保護者数十人）では 1GB/日の転送量上限を超えることはほぼない（50人が 5MB の PDF を毎日DLしても 250MB）。

```
【ファイルの流れ】

管理者  →  イベントモーダルの「ファイルを添付」をタップ
              ↓ 端末のファイル選択画面
              ↓ ファイルを選ぶだけ（自動アップロード）
           Firebase Storage にファイルを保存
              ↓
           URL + メタ情報を Firestore のイベントに保存

ユーザー →  イベントモーダルを開く → 添付ファイル一覧を表示
              ↓ ファイルをタップ
           Firebase Storage から直接ダウンロード
```

**技術的な流れ：**
```
管理者がファイルを選択（<input type="file">）
    → Firebase Storage SDK で直接アップロード（Workers 不要）
    → 完了後、URL + メタ情報を Firestore のイベントドキュメントに保存
    → モーダルの添付ファイル一覧に表示
```

### Firebase はフロントエンドではない（重要な認識整理）

- **フロントエンド** ＝ 自分たちが書いた HTML / CSS / JS コードそのもの
- **Firebase Hosting** ＝ そのファイルを置いておく配信サーバー（置き場所に過ぎない）
- Firebase Auth・Firestore はホスティング先に関わらず利用可能
- 将来的に Firebase Hosting を GitHub Pages / Cloudflare Pages / Netlify 等に移しても、Auth・Firestore はそのまま使い続けられる

### 実装する際の Firestore スキーマ案（参考）

```
events/{eventId}/
  attachments: [
    {
      name: "大会要綱.pdf",
      url: "https://firebasestorage.googleapis.com/...",
      size: "512KB",
      uploadedAt: Timestamp,
      uploadedBy: "uid"
    }
  ]
```

または `events/{eventId}/attachments/{attachmentId}` のサブコレクション方式も可。

### ホスティングについて（2026-02-26 結論）

**Firebase Hosting のまま継続。移行は不要。**

3原則「メンテナンスフリー」に照らすと、動いているものを変える理由がない。
Cloudflare Pages 等への移行は短期的な作業コストが発生するだけで、長期的なメリットが薄い。
