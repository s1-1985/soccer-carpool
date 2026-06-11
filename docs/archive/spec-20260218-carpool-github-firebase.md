> **アーカイブ**: 削除済み旧ブランチ `claude/carpool-github-firebase-qQVuP` から2026-06-11に救出した資料。
> 内容は **2026-02-18時点のコード状態** に基づく。記載の「未修正バグ」はその後のmainで修正済みの可能性が高い。
> 現状はリポジトリルートの `handover.md` を正とする。

# FC尾島ジュニア 配車管理システム 仕様書

最終更新: 2026-06-11

---

## システム概要

FC尾島ジュニア（サッカーチーム）の練習・試合イベントにおける配車管理を行うウェブアプリケーション。

- **対象ユーザー**: チームスタッフ（コーチ・保護者）
- **主な機能**: イベント管理、出欠確認、車両提供登録、座席割り振り、連絡
- **技術スタック**: HTML/CSS/Vanilla JS、Firebase（Firestore + Auth）
- **ホスティング**: Firebase Hosting

---

## 機能要件

### ハブページ（`hub/`）

#### カレンダー
- イベントをカレンダー形式で表示
- イベントをクリックすると詳細モーダルが開く
- イベント名が長い場合は折り返さずに省略表示（`text-overflow: ellipsis`）
- iOS Safari でのタップ動作に対応（`cursor: pointer`必須）

#### メンバー管理
- メンバーの一覧表示・追加・編集・削除
- 学年でフィルタリング
- メンバーは学年・姓名でソート表示
- ロール: `player`（選手）/ `coach`（コーチ）/ `parent`（保護者）/ `other`（その他）

#### 会場管理
- 練習・試合場所の登録・編集・削除
- 住所・地図リンク管理

#### 連絡
- チーム全体への連絡投稿
- 返信機能

### 配車管理（`carpool/`）

#### イベント選択（`carpool/index.html`）
- ハブで管理しているイベント一覧から配車管理するイベントを選択
- 選択したイベントは `sessionStorage` (`fcojima_selectedEvent`) に保存

#### 出欠確認（`carpool/attendance.html`）
- イベントに参加するメンバーの出欠を管理
- **対象学年フィルタ**: イベントに対象学年が設定されている場合、その学年のみ表示
  - 対象学年は数値・文字列どちらでも比較できるようにする（型不一致バグに注意）
- メンバーを個人単位で追加可能
- 出欠ステータス: 参加・欠席・未回答
- 出欠締切日時の設定・表示

#### 車提供（`carpool/carprovision.html`）
- ドライバーが乗せられる人数を登録
- **座席数はプルダウン（`<select>`）で選択**（数値入力ではない）
  - 前席: 0〜1
  - 中席: 0〜3
  - 後席: 0〜3
- 提供種別: 往復・片道（行き）・片道（帰り）・なし
- 既登録車両の一覧表示・編集・削除

#### 座席割り振り（`carpool/assignment.html`）
- 車両の座席に参加メンバーを割り当て
- 車の上面図で視覚的に座席配置
- ドラッグ＆ドロップで割り当て変更
- 対象学年フィルタ（出欠確認と同じ型比較ロジック）
- 割り当て結果を共有・保存

#### 連絡（`carpool/notifications.html`）
- 配車管理に関する連絡の投稿・返信

---

## 技術仕様

### アーキテクチャ

```
FCOjima namespace
├── FCOjima.Hub.*       - ハブページ専用（calendar, members, venues, notifications）
├── FCOjima.Carpool.*   - 配車管理ページ専用（overview, attendance, carprovision, assignment, notifications）
├── FCOjima.Storage     - localStorage/sessionStorage 抽象化
├── FCOjima.DB          - Firestore CRUD
├── FCOjima.UI          - 共通UI（モーダル、アラート等）
└── FCOjima.Auth        - Firebase認証
```

### データストア

#### Firestore コレクション
- `members` - チームメンバー
- `events` - イベント（練習・試合等）
- `venues` - 会場
- `notifications` - ハブ連絡
- `logs` - 操作ログ
- `eventCarpool/{eventId}/...` - イベント別配車データ

#### localStorage キー
- `fcojima_members` - メンバーキャッシュ
- `fcojima_events` - イベントキャッシュ
- `fcojima_venues` - 会場キャッシュ
- `fcojima_event_{eventId}` - イベント別配車データキャッシュ

#### sessionStorage キー
- `fcojima_selectedEvent` - 選択中イベント（配車管理ページ間で共有）

### メンバーデータの流れ

1. ハブページ起動時: `DB.loadMembers()` → `FCOjima.Hub.members` にキャッシュ + `localStorage` に保存
2. 配車管理ページ: `Storage.loadMembers()` → `FCOjima.Hub.members`（常に空）→ `localStorage` フォールバック
3. **課題**: Firestoreにしかデータがなく `localStorage` が空の場合、配車ページでメンバーが取得できない

### イベントIDの型
- FirestoreのドキュメントIDは文字列
- コード内で数値として扱っている箇所がある
- 比較は必ず `String(a) === String(b)` パターンで行う

### 学年フィルタの実装

`event.target` フィールドに対象学年が格納される（形式は数値配列または文字列配列、混在する可能性あり）。

```javascript
// 正しい比較方法
var inGrade = targetGrades
    ? targetGrades.some(g => String(g) === String(m.grade))
    : true;
```

---

## UIデザイン仕様

### カラーパレット
- プライマリ背景: `#1C1600`（濃い茶色）
- プライマリアクセント: `#E8A200`（黄色）
- 背景: `#f8f9fa`（薄いグレー）
- テキスト: `#333`

### モバイル対応要件

- **最小タップ領域**: `min-height: 44px`（iOS Human Interface Guidelines準拠）
- **タブバー**: 4タブ以上は横スクロール対応（`overflow-x: auto; flex-wrap: nowrap`）
- **テーブル**: 列が多いテーブルは `min-width` 指定 + `.table-container` の `overflow-x: auto` で横スクロール
- **モーダル**: モバイルでは幅95%、`max-height: 96vh`
- **固定ボトムナビ**: コンテンツが隠れないよう `.container` に `padding-bottom` を設定
- **iOS Safari**: クリックイベントが必要なdiv要素には `cursor: pointer` を必ず付与

### レスポンシブブレークポイント
- モバイル: `max-width: 768px`

---

## 開発ルール

### コードスタイル
- Vanilla JS（フレームワーク不使用）
- ES5〜ES6構文（IEサポート不要）
- `var` / `let` / `const` 混在可
- Promiseベースの非同期処理
- コメントは最小限（WHYが非自明な場合のみ）

### ファイル命名
- CSS: 機能ごとに分離（`css/hub/*.css`, `css/carpool/*.css`, `css/common.css`）
- JS: 機能ごとに分離（`js/hub/*.js`, `js/carpool/*.js`, `js/common/*.js`）

### Git運用
- ブランチ: `claude/carpool-github-firebase-qQVuP`
- コミットメッセージ: 日本語またはConventional Commits（`fix:`, `feat:`, `refactor:` etc.）

---

## ユーザーから出された要望一覧

| 優先度 | 状態 | 要望 |
|--------|------|------|
| 高 | ✅完了 | スマホから配車管理が開けない問題の修正 |
| 高 | ✅完了 | スマホで全体的なレイアウト崩れ・ボタンが押せない問題の修正 |
| 高 | ✅完了 | タブバーが画面幅を超えてボタンが押せない問題の修正 |
| 高 | ✅完了 | モーダルのボタンが画面外に隠れる問題の修正 |
| 高 | ✅完了 | iOSカレンダーの日付タップが反応しない問題の修正 |
| 高 | ✅完了 | 全ボタンのタップ領域を44px以上に統一 |
| 高 | ✅完了 | 個人単位でのメンバー追加（出欠確認） |
| 高 | 🔴未修正 | 座席割り振りページが「読み込み中...」のまま動かない |
| 高 | 🔴未修正 | 出欠確認で指定学年の選手が表示されない |
| 高 | 🔴未修正 | 出欠確認でメンバー追加しようとすると「対象がいない」となる |
| 中 | 🔴未修正 | 車提供の座席数をプルダウン選択に変更 |
| 中 | 🔴未修正 | カレンダーのイベント名が長いとレイアウトが崩れる |

---

## 未解決バグの詳細

詳細な根本原因分析は `handover.md` を参照。
