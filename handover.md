# 引き継ぎドキュメント (handover)

最終更新: 2026-07-17
mainの最新コミット: `9156b61` (2026-06-23)「fix: 4月1日以降も選手の学年が変わらないバグを修正 (#73)」
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
- **2026-06-23**: Fable 5による全体徹底点検。Playwrightテスト68項目（後述）。重大バグ2件含む多数修正（PR #71）
- **2026-07-17**: 選手学年の自動更新バグを修正（PR #73）

## 2026-07-18 出欠状況マトリクスのUI刷新（管理タブ）

`js/hub/admin.js` `loadAttendanceMatrix` と `hub/index.html`(CSS) を改修。

- **ヘッダーを1行構造に再設計**（旧: 日付/曜日/名称/人数の4行 rowspan コーナー）。
  モバイルChromeで `position:sticky` × rowspan が正しく効かず**左見出し（学年/氏名）が
  スクロール時に飛び出す**バグを解消。各イベント列は1つの `<th>`(.mx-evt) に
  日付・曜日・名称・人数内訳を縦積み。左上コーナーは学年/氏名の2セル（rowspanなし）
- **ヘッダーのどこをタップしても概要モーダル**（旧: 会場名セルのみ）。th全体にクリック付与
- **人数を内訳表示**: 参加(緑)/未回答(黄)/欠席(赤)。分母は対象学年＋extraPlayersの選手数
- **過去イベント表示トグル**: デフォルト「今後のみ」（date>=今日）。ボタンで過去も表示（件数付き）。
  状態は `Admin._matrixShowPast`
- **直近イベント列を強調**＋開いたとき自動で横スクロール、学年グループ区切り線、週末色分け
- キャッシュバスト: admin.js → `?v=20260718c`

---

## 2026-07-18 参加イベント移動・変更通知・「参加予定」タブ（新機能）

### 概要
同じ日に学年別イベントが複数ある場合、人数の少ないイベントへ他学年の選手を
補充移動させる運用を支援する機能群。

### 機能（`hub/index.html` / `js/hub/admin.js` / `js/hub/myevents.js`(新規)）
1. **出欠マトリクスからの参加イベント移動**（マネージャーのみ＝管理タブ内なので自然にゲート）
   - 同日に他イベントがあるセル（◯/✖/未）をタップ → `#matrix-move-modal` に同日他イベントをリスト表示
   - 選択+確認で移動実行: 移動先出欠=present、対象学年外なら **extraPlayers（既存の学年外追加選手機構）に追加**、
     移動元出欠=absent（備考「→○○へ移動」。既存ロジックで配車対象から自動除外）
   - `Admin.movePlayerToEvent` 参照。イベント保存は `Storage.saveEvents(Admin._matrixEvents)`
2. **変更通知**: 連絡事項コレクションに `type:'move'` の構造化通知を自動投稿
   （text/date/user は通常の連絡事項として表示互換。ts/memberId/from/toEventId等の構造化フィールド付き）
3. **保護者向けダイアログ**: HUBを開いたとき、自分の子（childrenIds）に関する未読move通知が
   あれば `#move-notice-modal` を表示。既読は端末ごと localStorage（`fcojima_move_ack_<uid>`）
4. **「参加予定」タブ**（`FCOjima.Hub.MyEvents` / `js/hub/myevents.js`）
   - childrenIds のあるユーザーのみタブ表示。子供（兄弟含む）が参加対象の今後のイベントをリスト化
   - 参加判定 = 対象学年 or extraPlayers、かつ出欠がabsentでない
   - 前回閲覧時とのスナップショット差分（localStorage `fcojima_myevents_snap_<uid>`）で
     変化をバナー＋🔔ハイライト表示、タブに赤丸バッジ（`.tab-badge`）。タブを開くと既読化

### 検証
エミュレータ＋Playwrightで22項目（移動実行→Firestore反映・extraPlayers追加・マトリクス再描画・
保護者ダイアログ表示/既読・参加予定タブの移動反映・バッジ消灯・連絡事項表示）全パス。

キャッシュバスト: admin.js / myevents.js → `?v=20260718`

---

## 2026-07-17 割り当て画面：キャンバス型全画面モード追加

### 背景
座席割り振り作業がスマホの狭い固定領域では作業しづらいというユーザー要望。
「A4ノートではなくA1画用紙の上で作業する」イメージで、大きな紙面をピンチズーム・パンで
動き回れる新しい全画面モードに全画面ボタン（⤢ 全画面で作業）の挙動を差し替えた。

### 実装（`carpool/assignments.html` / `js/carpool/assignment.js` / `css/carpool/assignment.css`）
- **キャンバス（`#canvas-mode`）**: 車両を紙面上にグリッド状（ほぼ正方形になる列数）で配置。
  `transform: translate+scale` によるパン（1本指/ドラッグ）・ピンチズーム（2本指）・
  ホイールズーム（PC）・ダブルタップズームを Pointer Events で自前実装（外部ライブラリなし）
- **下部ドック**: 配置待ちメンバー横帯 → 統計バー → アクションボタン（ランダム配置〜画像で出力）
  の順に固定表示。グローバルナビ（HUBに戻る/保存/共有）はキャンバス中は非表示（z-index 9500の下）
- **タップ配置フロー**: メンバー帯のアイコンをタップ選択 → 空席がパルス発光 → 座席タップで配置。
  選択なしで座席タップした場合は従来の座席編集モーダル
- **DOM移動方式**: モード開始時に `#cars-container` / `#members-container` /
  `#assignment-stats-bar-fs` / `.assignment-action-buttons` の実ノードをキャンバスへ移動し、
  終了時に元へ戻す（既存のイベントリスナー・保存ロジックをそのまま再利用、二重化なし）
- キャンバス中は既存のタッチドラッグ・HTML5ドラッグを無効化（パン操作との衝突防止）
- 全体表示ボタン（⊡）・＋/−ズーム・✕閉じるは右上の浮遊コントロール
- 旧全画面モード（`is-fullscreen`）のコード・CSSは残置（到達不能だが互換のため）

### 検証
Playwright + スタブハーネスで27項目確認（開閉・DOM移動と復帰・パン・ズーム・
タップ配置・選択解除・モーダル誤発火抑止・配置データ維持・再開閉）。全パス。

キャッシュバスト: assignment.js / assignment.css → `?v=20260717`

### 見た目改良（同日フォローアップ）
- **はみ出しバグ修正**: `#canvas-mode .car-top-view` が `width:100% + padding + border` で
  `box-sizing: content-box` のまま → 車カードから右下にはみ出していた。`box-sizing: border-box` で修正
- **車らしいデザイン**（キャンバスモード限定、通常モード・画像出力には影響なし）:
  ボンネットが丸い車体シルエット・フロントガラス/リアガラス（::before/::after）・
  座席のヘッドレスト表現・空席は破線・車ヘッダーに🚗アイコン
- Higgsfield等での画像生成は不採用（座席数で車の高さが可変のため固定イラストは崩れる。
  CSSのみの方がメンテナンスフリー原則に合致）
- キャッシュバスト: assignment.css → `?v=20260717b`

### 実機バグ修正（同日フォローアップ2）
実機で「✕で閉じない」「メンバー帯からD&Dできない」の報告。

1. **✕で閉じない（根本原因が重要）**: `touch-action: none` を指定したviewport内では、
   タッチ操作後にブラウザが click イベントを合成しないことがある（CDPタッチエミュレーションで再現確認済み）。
   ✕ボタンだけでなく座席タップも同条件で死ぬ。
   **対策**: キャンバス内のタップは `pointerup` から自前判定して `click()` を直接発火する方式に変更
   （`_initCanvasMode` 内 bindTap / タップディスパッチャ参照）。ブラウザがclickを合成した場合の
   二重発火は600msの吸収ウィンドウで抑止。パン直後の誤発火clickは1回吸収したらフラグを消費。
2. **メンバー帯からのD&D**: キャンバス中は全ドラッグを無効化していたが、メンバー帯は
   下部ドック（パン領域外）にありパンと衝突しないため、`member-item` のみドラッグ許可に変更。
   座席からのドラッグは引き続き無効（パンと衝突するため。座席の入替はタップ→モーダルで）

検証: タッチイベント（CDP `Input.dispatchTouchEvent`）ベースのテスト8項目を追加、
既存マウス系27項目と合わせ全パス。
キャッシュバスト: assignment.js → `?v=20260717b`

---

## 2026-07-17 選手学年の自動更新バグ修正（PR #73）

### 症状
生年月日を登録済みの選手でも、4月1日を過ぎると学年が自動で更新されなかった。

### 原因
`member.grade` はメンバー登録・編集時に `Utils.calculateGrade(birth)` で計算し
Firestore に保存していたが、その後は保存値をそのまま読むだけで再計算していなかった。

### 修正（`js/common/db.js`）
`DB.loadMembers()` でFirestoreからデータ取得後、`role === 'player'` かつ `birth` がある
メンバーの `grade` を毎回 `Utils.calculateGrade(birth)` で再計算して上書きするよう変更。
Firestoreへの書き戻しはなし（メモリ上のみ更新）。

```javascript
// DB.loadMembers() 内
members.forEach(function(m) {
    if (m.role === 'player' && m.birth) {
        m.grade = Utils.calculateGrade(m.birth);
    }
});
```

影響範囲: HUBメンバー一覧・配車出欠・割り当て・学年フィルター・卒団自動検出
キャッシュバスト: 全6HTMLの `db.js?v=20260623` に更新済み

---

## 2026-06-23 全体点検（PR #71）

Fable 5 (claude-fable-5) によるコードベース全件レビュー + Playwright + Firebase エミュレータを使った
68項目テストスイート（セキュリティルール/登録フロー/レイアウト/HUBタブ全/管理/型比較/配車フロー/保護者/却下ユーザー/認証）。

### 発見・修正した重大バグ

#### Bug 1: Firestore rules の `get().exists` が常に undefined（**全ユーザー・全デバイスで全データ読み込み失敗**）
- `isApproved` / `isManager` の内部実装で `get(...).exists` を参照していた
- `.exists` は `DocumentSnapshot` の**プロパティではなくメソッド（`.exists` は実際にはboolean）**で、
  Firestore Security Rules の `get()` 戻り値には存在しない。常に `undefined` → 常に `false`
- 結果: `events` / `venues` / `notifications` / `logs` / `eventData` の全読み取りが全ユーザーで拒否
  （承認済み保護者もマネージャーも同様）
- 実デバイスでは localStorage キャッシュで動いているように見えていたため長期間気づかれなかった
- **修正**: `exists()` 関数（ドキュメントの存在確認専用）と `get().data` を分離
  ```
  function userDocExists(teamId) {
    return exists(/databases/$(database)/documents/teams/$(teamId)/users/$(request.auth.uid));
  }
  function userData(teamId) {
    return get(/databases/$(database)/documents/teams/$(teamId)/users/$(request.auth.uid)).data;
  }
  function isApproved(teamId) {
    return userDocExists(teamId) && userData(teamId).status == 'approved';
  }
  ```

#### Bug 2: `loadAllData` で logs を Promise.all に含めていた（**一般保護者の画面が空になる**）
- `logs` コレクションはマネージャー限定読み取り（Firestoreルール）
- 一般保護者が `DB.loadAllData()` を呼ぶと logs の読み取りが permission-denied になり、
  `Promise.all` 全体が reject → members/events/venues/notifications も全滅
- **修正**: `db.js` の `loadAllData` で logs を別の try/catch に分離

#### Bug 3: `hub/register.html` に初代管理者自己昇格の穴（**セキュリティホール**）
- 「承認済みユーザーが 0 人なら `role:'admin', status:'approved'` で自己作成可」という
  bootstrap 条項がフロントエンドに残っていた
- Firestore rules 側では常に `status:'pending', role:'parent'` しか create を許可していない設定に
  なっていたが、フロントが不正なデータを送信しようとしていた（rules が弾く前に誤解を生む）
- **修正**: register.html のブートストラップロジックを完全削除。初代 admin は Firebase Console から手動作成する

### その他の修正（計11ファイル以上）

| ファイル | 修正内容 |
|---|---|
| `js/hub/calendar.js` | 学年比較バグ修正（`.includes(m.grade)` → `.some(g => String(g) === String(m.grade))`）、showEventDetails を async 化 |
| `js/hub/members.js` | 新規メンバーID採番を `Date.now()` に変更（Firestore文字列IDが `parseInt` で0になり ID=1 衝突） |
| `js/hub/venues.js` | 同上のID採番修正 |
| `js/hub/admin.js` | XSS修正（メール/子供名のエスケープ）、フィールド名修正（`ev.notes\|\|ev.description`）、admin役割変更のUI制限、学年比較修正 |
| `js/carpool/attendance.js` | 学年比較バグ修正（2箇所） |
| `js/carpool/assignment.js` | 学年比較修正（3箇所）、`Auth.getUserName` → `Auth.getDisplayName`（存在しない関数参照でコメント投稿者が常に「ユーザー」になっていた）、notes のダブルエスケープ修正 |
| `hub/index.html` | `requireApproved()` 後の null ガード追加（却下ユーザーがアクセスするとクラッシュ）、ログアウトボタン追加、役員フィルター追加 |
| `hub/pending.html` | SyntaxError 修正（`const TEAM_ID` 二重宣言 → インラインスクリプト全体が無効化されボタン動作不全） |
| `carpool/*.html` | `requireLogin` → `requireApproved`（未承認ユーザーが配車ページにアクセスできた） |
| `js/common/firebase-config.js` | localhost + localStorage フラグによるエミュレータ接続フック追加 |
| `firebase.json` | エミュレータ設定ブロック追加 |
| `.github/workflows/firebase-deploy.yml` | Firestore rules のデプロイステップ追加 |
| 不要ファイル削除 | 旧単独ページ（`carpool/assignment.html` 他6ファイル + CSS 1ファイル）を `git rm`（約1,500行削除） |

### 初代管理者のセットアップ手順（現在）

Firebase Console → fc-ojimajr-hub → Firestore → `teams/fc-ojima/users` に以下のドキュメントを手動作成:
```
ドキュメントID: <ユーザーのFirebase Auth UID>
フィールド:
  displayName: "管理者名"
  email: "admin@example.com"
  role: "admin"
  status: "approved"
  registeredAt: (Timestamp)
```
その後、そのユーザーでログインすれば管理者として使える。2人目以降は管理画面から承認・役割変更が可能。

### ローカル開発・テスト環境のセットアップ

```bash
firebase emulators:start
# ブラウザで localhost:5000 を開いた後、DevTools コンソールで:
localStorage.setItem('fcojima_use_emulator', '1')
location.reload()
# → Auth / Firestore / Storage がすべてエミュレータへ向く（本番への影響ゼロ）
```

---

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
