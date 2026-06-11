# FC尾島ジュニア HUB - AI用仕様書

> このファイルはユーザーからの要望・仕様・開発方針をまとめた仕様書です。
> AIエージェントはこのファイルと `AI_HANDOFF.md` の両方を必ず最初に読んでください。

---

## プロジェクト基本情報

**アプリ名:** FC尾島ジュニア HUB
**目的:** 少年サッカーチームの配車・出欠・メンバー管理Webアプリ
**本番URL:** https://fc-ojimajr-hub.web.app
**Firebase プロジェクト:** `fc-ojimajr-hub`（絶対変更禁止）

詳細なアーキテクチャ・ファイル構造・Firebase設定は `AI_HANDOFF.md` を参照。

---

## ユーザーからの要望・仕様（セッション別）

### セッション1〜4（AI_HANDOFF.md 参照）

セッション1〜4で決定された仕様・変更内容は `AI_HANDOFF.md` の各セクションを参照すること。

---

### セッション5（2026-06-11）

#### デバッグ作業の依頼

ユーザー指示:
> 「残ったトークンで座席割り当て機能のデバッグを全力で取り組んで。そのままトークンが尽きるまで実行して。」

この指示により、座席割り当て機能を中心に全コードベースの網羅的なデバッグを実施した。

---

## 技術仕様

### ストレージアーキテクチャ（デュアルストレージ）

**原則:** 全ての保存操作はlocalStorage（即時）とFirestore（非同期）の両方に書く。

```javascript
// 保存パターン
FCOjima.Storage.saveXxx(data);       // localStorage に即時保存
if (FCOjima.DB) FCOjima.DB.saveXxx(data); // Firestore に非同期保存（fire-and-forget）
```

**ロードパターン（優先順位）:**
1. Firestore からロード（認証済みの場合）
2. 失敗またはデータが null の場合 → localStorage にフォールバック

### Firestoreロード判定

`FCOjima.DB.loadEventData()` はドキュメントが存在しない場合 `null` を返す。
これにより正しいフォールバック判定が可能。

```javascript
// 正しい判定
const data = await FCOjima.DB.loadEventData(eventId);
if (data) {
    // Firestoreデータを使う
} else {
    // localStorageにフォールバック
}
```

### ログ記録の順序

`Storage.addLog` → インメモリ変数の変更 の順序を守ること。

理由: `Storage.addLog` が `Storage.loadEvents/Members/Venues` を呼び出し、これらはインメモリキャッシュを優先返却するため、変更後にaddLogを呼ぶとバックアップデータが取れない。

### carIndex の意味

座席割り当てにおける `assignment.carIndex` は `carRegistrations` 全体ではなく、
`availableCars`（`canDrive !== 'no'` でフィルターした配列）のインデックスを指す。

### 役割別メンバーアイコン色

| 役割 | color |
|---|---|
| coach / assist | 緑（green） |
| player | 琥珀色（amber） |
| parent（mother/father） | 灰色（gray） |
| other | 紫（purple） |

### extraPlayers

イベントの `extraPlayers` フィールドには対象学年外の選手名が格納される。
出欠確認・座席割り当て両UIで表示対象に含める。

---

## 開発方針・ルール

### ブランチ命名規則

- 必ず `claude/` プレフィックスを使用
- 末尾にセッションIDを付与（例: `claude/fix-calendar-seating-bugs-fjK5Z`）
- このルールを守らないと git push が 403 エラーになる

### コミット・プッシュ

- 変更が完了したら必ずコミットとプッシュを行う
- stop hook が発動した場合（未コミット変更がある場合）は即座にコミット・プッシュしてから再開
- コミットメッセージは日本語でも英語でも可、内容が明確であること

### ファイル操作の制約

- `js/carpool/assignment.js` は1300行以上の正常なコード。勝手に書き換え・短縮しない
- `firebase-config.js` は変更禁止
- `firebase.json` の `"public": "."` は変更禁止
- `FCOjima.Firestore` という名前空間は存在しない。必ず `FCOjima.DB` を使う

### 禁止事項

- Firebase プロジェクト ID の変更（`fc-ojimajr-hub` のみ有効）
- `public/` サブディレクトリの作成
- マージコンフリクトマーカーを含むままのコミット
- 既存の動作するコードの全書き換え

### このファイル（claude.md）とAI_HANDOFF.mdの更新

- 作業終了時・セッション切り替え時に必ず更新する
- `AI_HANDOFF.md` の「次のAIがすべきこと」と「既知の問題」を現状に合わせて修正する
- `handover.md` にそのセッションで行った変更の詳細を記録する

---

## 既実装機能一覧

### HUB ページ（`hub/index.html`）

- Googleログイン認証
- カレンダータブ（月曜始まり、土日幅広、イベント種別対応）
- メンバー管理タブ（略称・役員ロール対応、検索・詳細・CRUD）
- 連絡事項タブ
- 会場登録タブ（緯度経度・地図リンク対応）
- 管理タブ（承認管理）
- 操作ログ（最新50件表示、eventId絞り込み）

### 配車ページ群（`carpool/`）

- 配車概要 `overview.html`（イベント一覧・選択）
- 出欠確認 `attendance.html`（出欠CRUD、参加者追加・削除モーダル）
- 車提供登録 `cars.html`（Firestore優先ロード対応済み）
- 座席割り当て `assignments.html`（ドラッグ&ドロップ、役割別アイコン色、Firestore対応）
- 配車連絡 `notifications.html`

### 認証・登録フロー

- 新規登録 `hub/register.html`（子供順次選択UI、コーチ・監督も対応）
- 承認待ち `hub/pending.html`
- 初回登録者自動管理者承認（Bootstrapロジック）

---

## 未実装・未解決の課題

1. **役員ロール付与フロー** — admin.js で role = 'officer' 付与UIを追加
2. **carpool各ページのスティッキー化** — attendance.html, cars.html 等のナビ・ボタン sticky 化
3. **旧ファイル削除** — carpool/assignment.html, carprovision.html（ユーザー確認後）
4. **Firestore rules 再確認** — ブートストラップ用許可ルールが残存

---

## 変更履歴

| セッション | 日付 | 主な変更 |
|---|---|---|
| 1〜4 | 〜2026-02-23 | 初期実装、カレンダー、メンバー管理、認証フロー（AI_HANDOFF.md参照） |
| 5 | 2026-06-11 | 全コードベースデバッグ、座席割り当てFirestore対応確認、7件のバグ修正 |
