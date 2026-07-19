# 引き継ぎドキュメント (handover)

最終更新: 2026-07-19
mainの最新コミット: `a23124c` (2026-07-19)「fix: 保護者の子供情報の不整合を修正＋メンバーカードを役割・学年で見た目差別化 (#88)」
本番URL: https://fc-ojimajr-hub.web.app （Firebase Hosting / プロジェクト `fc-ojimajr-hub`）

---

## 2026-07-20 実機報告7件を修正（天気・持ち物編集・初期月表示・ログ混入・リアルタイム同期ほか）

**ユーザー報告（実機スクリーンショット5枚）と対応**:

1. **天気が未来イベントでも「取得できませんでした」**
   前回修正のジオコーディングは「群馬県太田市」（都道府県付き）で検索していたが、
   Open-MeteoのGeoNames DBは**都道府県付きだと0件**・「太田市」なら当たる（実API実測で確認）。
   住所から**都道府県を除いた市区町村名**を最優先クエリに変更（郡付きは町村名も試行）。
   ジオコーディングキャッシュキーをv3に更新（当日分の失敗キャッシュを無効化）。
   使用API: Open-Meteo（キー不要・無料。非商用1日1万リクエスト/IPまでで、
   取得結果は端末ごとにキャッシュしているため70人規模でも問題なし）

2. **イベント設定時の持ち物が固定で編集不可**
   イベントフォームに持ち物欄（「、」区切りテキスト）を追加。種類変更でテンプレが
   入り、自由に追加・削除可能。保存先は `event.checklist`（完全上書きリスト）。
   旧 `checklistExtra` とテンプレ表示は後方互換で維持（`Checklist.getItems` に
   override引数を追加）

3. **hubを開くと一瞬「2025年4月」が表示される**
   `hub/index.html` の `<h2 id="current-month">` に静的な「2025年4月」が
   ハードコードされており、データ読み込み完了までそれが見えていた。
   インラインスクリプトでHTMLパース時に今月を即時セットするよう変更

4. **イベントモーダルに他イベントのログが混入**
   ログ絞り込みの旧フォーマット用フォールバックが「タイトル先頭10文字の部分一致」
   だったため、毎週の「岩松」のような同名イベントのログが全部表示されていた。
   eventId一致を最優先とし、フォールバックは**タイトルと日付の両方一致**に厳格化

5. **イベント追加が参加予定に即反映されない／他ユーザーの変更が見えない**
   `FCOjima.Hub.startEventsRealtimeSync()` を新設し、eventsコレクションに
   `onSnapshot` リスナーを1本常駐させた。自分・他ユーザーのイベント追加/変更/削除が
   再読込なしでカレンダー・参加予定タブに反映される。
   **コスト設計**: onSnapshotは「初回全件＋以降は変更分のみ」課金のため、タブ切替の
   たびに全件再取得するより読み取りが少ない。常時リスナーはこの1本のみ
   （無料枠5万読取/日、70人規模で問題なし）。初回スナップショットはloadAllDataと
   重複するため再描画スキップ

6. **参加予定カードのタップでイベント詳細モーダルを開けるように**（新機能）
   ＋タブ並び順を「カレンダー→参加予定→連絡事項→メンバー→会場登録→管理」に変更
   ＋タブ行を横スクロール可能に（`.tab{overflow-x:auto}`・スクロールバー非表示。
   今後のタブ追加に対応）

7. **出欠マトリクス「過去も表示」で未回答サマリーが画面を埋め尽くす**
   未回答件数の横断集計が表示中の全イベント（過去含む）を数えていた。
   過去イベントの未回答は今さら回答不能なので、サマリーは**常に今後のイベントのみ**で
   集計するよう修正（過去列の表示自体はトグルどおり）

### 検証
新規E2E `e2e-fix7.mjs` 15項目 全PASS（Playwrightでの実挙動検証。天気は
実APIの挙動をモックで忠実に再現）。前回の3件修正の回帰テスト13項目もPASS。

### キャッシュバスト
`checklist.js`/`weather.js`/`calendar.js`/`myevents.js`/`main.js`/`admin.js`/
`common.css` を `?v=20260720a` に統一

---

## 2026-07-19 実機報告3件を修正（天気が出ない／下部見切れ／管理画面の子供誤表示）

**ユーザー報告（実機スクリーンショット5枚）**:
1. 天気がどこにも表示されない
2. ページ・モーダルとも最下部までスクロールすると下部固定バーに内容が見切れる
3. 管理タブで曽根さんの子供が別人（高阪姓の選手）と表示される（PR #88の修正後も再発）

### ① 天気が表示されない — 原因と修正
- **carpool側に未実装**: weather.jsは`hub/index.html`のみ読込で、ユーザーが最もよく見る
  配車概要ページに天気表示自体がなかった → `carpool/index.html`にweather.jsを追加し、
  概要の会場欄に天気チップを表示（`overview.js` `_renderWeather`）
- **ジオコーディングが施設名で失敗**: Open-Meteoのジオコーディングは地名DBベースで
  「岩松グラウンド」のような施設名はヒットせず、さらに失敗結果(null)を
  localStorageに**永続キャッシュ**していたため、一度失敗した会場は改善後も失敗が固定化
  → クエリを「住所の市区町村→施設接尾辞を除いた会場名→会場名」の順に試す連鎖に変更、
  キャッシュキーをv2に変更（旧失敗キャッシュを無効化）、失敗キャッシュは当日限りに変更
- なお報告時のスクリーンショットのイベント(7/18)は閲覧時点(7/20未明)で過去のため
  天気非表示は仕様どおり（過去イベントは表示しない）。未来イベントで表示されることを
  Playwrightで検証済み

### ② 下部固定バー・モーダルの見切れ — 原因と修正
- **モーダル**: `.modal-content`が`max-height:90vh + margin 24px`。モバイルChromeは
  URLバー表示中`vh`が実際の可視高さより大きく、90vh+24pxで下端のアクションボタンが
  画面外に出ていた → `max-height: calc(100dvh - 48px)`（dvh=動的ビューポート）に変更。
  ボトムシート型モーダル(assignment.css)・出欠マトリクスの`.matrix-wrap`も同様にdvh化
- **ページ**: Android Chromeのエッジ・トゥ・エッジ表示でナビバーが
  `env(safe-area-inset-bottom)`分高くなるのに、`.container`のpadding-bottomが固定値
  だった → `calc(100px/140px + env(safe-area-inset-bottom))`に変更。全ページの
  viewportメタに`viewport-fit=cover`を追加（iOSでenv()を有効にするため）
- Playwrightで全carpoolページ＋hubタブについて「ビューポート2倍の高さのダミー
  コンテンツを注入して最大スクロールした状態で最終行が固定バーに隠れない」ことを検証

### ③ 管理画面の子供誤表示 — 原因と修正
PR #88の`resolveChildrenIds`は**氏名の完全一致**で保護者メンバーを探していたが、
usersドキュメントの氏名は本人入力（「曽根　靖弘」全角スペース入り）、メンバー名は
管理者入力（スペースなし等）で一致せず、汚染された登録時スナップショット
（メンバー再登録でIDが振り直された後は別人の選手を指す）へフォールバックして
誤った子供が表示され続けていた。修正:
- `Utils.normalizeName`: NFKC正規化＋全空白（全角含む）除去で氏名照合
- 氏名で当たらない場合はフリガナ(kana)でも照合
- father/mother以外の役割（役員等）で登録された保護者メンバーも照合対象に
- フォールバック時は「選手として実在するID」のみ残す（別人参照の防止）
- ID→名前解決も`Utils.findChildMemberById`（選手優先）に統一（ID重複データ対策）

E2Eで「users名=全角スペース入り・メンバー名=スペースなし・スナップショット汚染」を
再現し、修正後は管理タブ・本人プロフィールとも正しい子供を表示することを検証（13項目PASS）。

### キャッシュバスト
全HTML: `utils.js`/`weather.js`/`overview.js`/`members.js`/`admin.js`/`common.css`/
`carpool/common.css`/`assignment.css` を `?v=20260720` に統一

---

## 2026-07-19 出欠状況の反映漏れを横断監査・修正（配車割り振りメンバー表示のバグ含む）

**ユーザー報告**: 「配車割り振り時に表示されるメンバー名が、イベント毎の対象メンバーか、
出欠回答済みのメンバーなのか、以前正しくできていなかった。今もそのままかもしれない」
→ コードベース全体を「イベントの出欠状況が他機能へ正しく反映されているか」の観点で
横断監査。同種のバグを複数発見・修正。

### 根本原因：`js/carpool/assignment.js` に「対象メンバー判定」ロジックが4箇所独立実装されていた

`updateMembersList`（配車ドック表示）、`updateStatsBar`（統計バー）、
`generateRandomAssignments`（自動割り振り）、LINE共有カード生成の4箇所が、
それぞれ独自に「このイベントの対象メンバーは誰か」を再実装しており、時間の経過とともに
実装が食い違っていた。具体的には:
- **自分自身をボランティアとして「参加」登録した保護者**（子供が選手として紐付いていない
  ケース）が `updateMembersList` にだけ抜けていて、統計バーの人数には数えられるのに
  ドラッグ対象ドックには出てこない、というユーザー報告どおりの不整合が発生していた
- 欠席登録済みのスタッフ/保護者の除外も4箇所でバラバラ（一部は除外、一部は除外漏れ）

**修正**: 4箇所の重複実装を廃止し、単一の `Assignment.getEventFilteredMembers()` に
統一。学年対象＋`extraPlayers`（学年外追加選手）＋出欠「参加」／未回答は対象・
「欠席」は除外、を全ロールに一貫して適用するようにした。

### 横展開で見つかった同種バグ

- **`js/hub/calendar.js` `Calendar.applyMyChildFilter`**（「自分の子供のみ」表示切替）:
  学年一致のみで判定しており `event.extraPlayers` を見ていなかった。学年外招集された
  自分の子のイベントがカレンダーから消える不具合。`isTargetFor`（学年＋extraPlayers）の
  パターンに合わせて修正
- **`js/carpool/attendance.js` `shareAttendanceStatus`の統計計算**: `stats.total`
  （対象人数）が学年一致のみで計算されており、`extraPlayers`で追加された選手が
  対象人数に含まれていなかった。結果として`stats.unknown`（未回答人数、
  `total - present - absent`で算出）が過少カウントされ、学年外追加選手の
  未回答が見えなくなっていた。`autoPopulateFromTargetGrades`と同じロジックに揃えて修正

### 確認して問題なしと判断した箇所（参考）

- `js/hub/admin.js` の出欠マトリクス（`isTargetFor`）・移動機能（`movePlayerToEvent`）
- `js/hub/calendar.js` イベント詳細モーダルの出欠一覧（学年＋extraPlayersを正しく合算）
- `js/carpool/overview.js` の対象学年表示（表示専用テキストで実害なし）
- `js/hub/myevents.js`、`attendance.js`の`autoPopulateFromTargetGrades`（既に正しい実装）
- `js/carpool/carprovision.js`／`notifications.js`（対象判定ロジック自体を持たない）

### 検証

Firebaseエミュレータ+Playwrightで新規E2Eテストを3本作成し全項目PASS:
- 配車割り振り: 自己出欠のみの保護者がドックに出る／欠席スタッフ・保護者が出ない
- カレンダー「自分の子供のみ」: 学年外追加された自分の子のイベントが表示される
- 出欠共有: 学年外追加選手が対象人数・未回答人数に反映される

既存の `e2e.mjs`（ログイン〜配車一連フロー、ランダム割り振り含む）で回帰なしを確認。

### キャッシュバスト
`assignment.js?v=20260719a`（`carpool/assignments.html`）、
`attendance.js?v=20260719a`（`carpool/attendance.html`）、
`calendar.js?v=20260719e`（`hub/index.html`）

---

## 2026-07-19 当番表機能 Phase 2（イベントへの当番グループ割り当て）

Phase 1（グループのON/OFF・作成・メンバー管理）に続き、「どのイベントにどのグループが
当番か」を割り当てる仕組みを実装。ユーザーヒアリング結果：
- 割り当て方法: **管理者が手動で選ぶ**（自動ローテーションではない）
- 表示場所: **イベント詳細モーダル・出欠マトリクス・参加予定タブ**の3箇所
- 確定時: **連絡事項に自動通知する**

### 実装内容
- Firestore新規コレクション: `teams/fc-ojima/dutyAssignments/{eventId}` に
  `{ groupId, groupName }`。`eventData`/`events`は承認済みなら誰でも書き込み可のため、
  当番割り当てだけマネージャー限定にする目的で別コレクションに分離（Phase 1と同じ設計判断）
- `firestore.rules`: `read: isApproved`、`write: isManager`
- `js/common/db.js`: `DB.loadDutyAssignments`/`saveDutyAssignment`/`deleteDutyAssignment`
- `js/common/firebase-config.js`: `Collections.dutyAssignments`
- `js/hub/main.js`: `Hub.init()`で`dutySettings`/`dutyGroups`/`dutyAssignments`を読み込み、
  `FCOjima.Hub.dutyEnabled`/`dutyGroups`/`dutyAssignments`としてグローバルに公開
  （`DB.loadAllData`にも追加。失敗時は握りつぶしてduty機能を無効扱いにするだけで
  他のデータ読み込みを壊さない、既存のlogsと同じ防御パターン）
- `js/hub/admin.js`:
  - `Admin.openEventDetailModal`（管理者向け概要モーダル）に、`dutyEnabled`が
    trueのときだけ当番グループ選択`<select>`を表示。変更で`Admin.assignDutyGroup`を呼ぶ
  - `Admin.assignDutyGroup(ev, groupId)`: `dutyAssignments`を保存/削除し、
    連絡事項に`type:'duty'`の通知を投稿（既存のmove通知パターンを踏襲）。
    出欠マトリクスが表示中なら再読み込みしてバッジに反映
  - 出欠マトリクスのイベント列ヘッダーに`🔔グループ名`のバッジを追加（`dutyEnabled`時のみ）
  - Phase 1の`Admin.loadDutyGroups`/`saveDutyEnabled`が`FCOjima.Hub.dutyEnabled`/
    `dutyGroups`も同期するよう修正（設定画面での変更が他のUIにも反映されるように）
- `js/hub/calendar.js`（保護者向けイベント詳細モーダル）、`js/hub/myevents.js`
  （参加予定タブ）: 当番情報を**読み取り専用**で表示（編集UIは管理者向けモーダルのみ）
- `hub/index.html`: `.e-duty`（マトリクスの当番バッジ）のCSSを追加

### 検証
Firebaseエミュレータ+Playwrightで、管理者による割り当て→通知投稿→マトリクスバッジ反映→
リロード後の永続化、保護者側の読み取り専用表示（参加予定タブ・カレンダー詳細モーダル）、
機能OFF時に一切表示されないこと、非マネージャーによる書き込み拒否、をそれぞれ確認
（10+3+1項目、全PASS）。

### キャッシュバスト
`firebase-config.js?v=20260719b`（全ページ）、`db.js?v=20260719c`（全ページ）、
`hub/index.html`: `main.js?v=20260719`、`calendar.js?v=20260719d`、
`myevents.js?v=20260719b`、`admin.js?v=20260719g`

### 今後の拡張余地（未着手・要望があれば）
- 自動ローテーション（現状は毎回手動選択）
- 当番の「貢献度」集計（送迎貢献度と同じ考え方で当番回数をランキング化できる）

---

## 2026-07-19 保護者の子供情報の不整合を修正＋メンバーカードの見た目を役割・学年で差別化

**ユーザー報告（実機スクリーンショット3枚）**: 「子どもの登録が合ってない。メンバー情報の方が正しい」
- 管理タブ「登録済みユーザー一覧」で保護者カードの「子供:」欄が、メンバー管理タブの
  同じ保護者のメンバーカードが示す子供と食い違っていた（例: 曽根靖弘さんの子供が
  「高阪裕慎」と表示されるが、正しくは「曽根逗生」）
- あわせて「メンバーのカード、ロールや学年によって色とか見た目を変えて」という要望

### 原因（子供情報の不整合）
保護者の「子供」情報が2箇所に別々に保存されていた：
1. `teams/fc-ojima/users/{uid}.childrenIds` — 登録申請時点のスナップショット
2. `teams/fc-ojima/members/{memberId}.childrenIds`（父/母メンバー） — 「メンバー」タブで
   管理者が編集する、常に最新のデータ

登録後にメンバー側の子供を編集しても①は自動更新されないため、両者がズレる。管理タブの
ユーザー一覧・保護者本人の「参加予定」タブ・カレンダーの「自分の子供のみ」フィルターは
すべて①（古い方）を参照していたため、表示が食い違っていた。

### 修正
- `js/common/utils.js` に `Utils.resolveChildrenIds(userLike, members)` を新規追加。
  氏名が一致する父/母メンバーが見つかればそちらの`childrenIds`（＝正）を優先し、
  見つからない場合のみ引数のchildrenIdsにフォールバックする
- `hub/index.html`: `FCOjima.Hub.init()`でメンバー読み込み後、`userProfile.childrenIds`を
  この関数で上書き（`Auth.currentUserProfile`と同一オブジェクトのため、参加予定タブ・
  カレンダーのフィルターにも自動的に反映される）
- `js/hub/admin.js`: 登録済み/承認待ちユーザー一覧の「子供:」表示も同じ関数を使うよう変更

### メンバーカードの見た目差別化
- 役割ごとにアイコン（🧢監督/📋コーチ/💼役員/⚽選手/👨父/👩母/👤部員外）を氏名の前に表示
- `css/hub/members.css`: 従来 `.member-card.parent` という実在しないクラス名を指定していて
  父/母カードに色が付いていなかったバグを修正（実際のroleは`father`/`mother`）。役員にも
  新たに色を追加
- 選手カードは学年ごとに左ボーダー色を変更（6年=山吹〜1年=紫、年少/年中/年長=ピンク）。
  `card.dataset.gradeColor`を追加し、CSS属性セレクタ`[data-grade-color="N"]`で切り替え

### 検証
Firebaseエミュレータ+Playwrightで、ユーザー登録時のchildrenIdsとメンバー側のchildrenIdsを
意図的にズレさせた状態を再現し、修正後は保護者本人の参加予定タブ・管理タブのユーザー一覧
の両方が正しい子供（メンバー側）を参照することを確認。カード見た目（role別クラス・
学年別ボーダー色）も12項目すべてPASS。

### キャッシュバスト
`hub/index.html`: `utils.js?v=20260719`、`members.js?v=20260719`、`members.css?v=20260719`、
`admin.js?v=20260719f`。`utils.js`はcarpool配下の全ページでも`?v=20260719`に統一。

---

## 2026-07-19 当番グループ機能のCodexレビュー指摘4件を修正

PR #86（実機タップ修正）マージ後、Codexの自動レビューで4件のP2指摘が入り、
すべて修正（新規PR）。

1. **チェックボックス直接操作の二重反転**: PR #86のタップ修正（`click`で
   `preventDefault()`して手動トグル）が、キーボード操作（Tab+Space）や
   スクリーンリーダーでcheckbox自体を直接アクティベートした場合に、
   ブラウザが既に反転させたcheckedをさらに反転させてしまい、操作が無効化される
   問題があった。`e.target === cb`（checkbox自体がクリックターゲットか）で分岐し、
   checkbox直接操作時はネイティブの状態をそのまま尊重するよう修正
   （`js/hub/admin.js` `Admin._buildDutyGroupCard`）
2. **同時編集での上書き消失**: 複数の管理者が同時に別グループメンバーを
   追加/削除すると、読み取り→全件書き戻し方式のため後勝ちで一方の変更が消える
   リスクがあった。`FieldValue.arrayUnion`/`arrayRemove`を使った原子的な
   更新に変更（`js/common/db.js`の`DB.addDutyGroupMember`/`removeDutyGroupMember`、
   `Admin.toggleDutyGroupMember`から呼び出し）
3. **設定トグル保存失敗時にUIが実態と乖離**: 当番表機能ON/OFFの保存が失敗しても
   トグルの見た目は新しい状態のままだった。失敗時に直前の状態へ戻すよう修正
   （`Admin.saveDutyEnabled`）
4. **【運用リスク・CI変更】Firestoreルールのデプロイ失敗が本番デプロイをブロックしない**:
   `.github/workflows/firebase-deploy.yml`の`continue-on-error: true`により、
   `firebase deploy --only firestore:rules`が失敗しても本番Hostingデプロイが
   続行されてしまう構成だった。新機能追加時にルールデプロイだけ失敗すると
   「画面は出るが新規コレクションの読み書きが全部permission-denied」という
   静かな事故になり得る（実際には今回実害なし。CIログで成功を確認済み）。
   ユーザーに確認の上、firestore:rulesのデプロイ失敗時は本番Hostingデプロイを
   ブロックするよう変更（storageルールは従来通りベストエフォート）

### 検証
Firebaseエミュレータ+Playwrightで4件それぞれを再現・修正確認（Space キー操作、
保存失敗時のロールバック、2ブラウザコンテキストでの同時編集）。すべてPASS。

---

## 2026-07-19 当番グループのメンバー追加・削除が実機で効かないバグを修正

**ユーザー報告（実機スクリーンショット付き）**: 「グループ毎のメンバーの追加と削除ができねーよ」
（当番グループ設定モーダルで、メンバーのチップをタップしても追加/削除できない）

### 原因
当番グループ設定のメンバー選択チップは `<label>` が `<input type="checkbox">` を内包し、
ラベルをタップすると内包チェックボックスに暗黙的にクリックが転送される、というブラウザの
デフォルト挙動に依存する実装だった。この暗黙の転送は、実機のモバイルChromeでは
モーダル内・flexレイアウト内では確実に発火しないことがある
（2026-07-18の「キャンバスモードで✕ボタン/D&Dが効かない」バグと同種の、
タッチ→クリック合成イベントの信頼性問題）。

### 修正
`js/hub/admin.js` の `Admin._buildDutyGroupCard` で、checkboxの`change`イベントに
依存するのをやめ、チップ（`<label>`）自体に`click`リスナーを付けて`preventDefault()`した上で
`checked`状態を手動でトグルする実装に変更（暗黙のラベル転送に頼らない一本化）。
あわせて、父・母ロールのメンバーに「（父）」「（母）」の役割ラベルが表示されていなかった
表示バグ（`ROLE_LABELS`はユーザーロール用の別マップで、メンバーロールの父/母を含んでいなかった）
も同時に修正。

### 検証
Firebaseエミュレータ+Playwrightで、**実際のタッチイベント（`locator.tap()`、`hasTouch:true`の
コンテキスト）** を使って再検証（前回の検証は`element.click()`によるプログラム的操作だったため、
今回のバグを検出できていなかった）。チップタップでの追加・削除・リロード後の永続化・
役割ラベル表示のすべてがPASS（7項目）。

### キャッシュバスト
`hub/index.html`: `admin.js?v=20260719d`

---

## 2026-07-19 当番表機能 Phase 1（グループ管理・ON/OFF切替）

ユーザーヒアリング結果：当番表はマスト機能ではないためON/OFFトグルで切替可能にする。
分け方は「グループ制」（お茶当番/旗当番のような種類別ではない）。管理タブで
①グループを作成（名称を決める）→②グループごとにメンバーを選ぶ、の2段階。
メンバー候補は指導者（coach/assist）・父・母のみ（選手は対象外）。

このセッションで実装したのは**グループ管理の器（Phase 1）のみ**。「どのイベントに
どのグループを割り当てるか」の実際の当番割り当てロジックはまだ未実装（todo.mdの
「4. 当番表機能」Phase 2に要ヒアリング事項として記録済み）。

### 実装内容
- Firestore新規コレクション: `teams/fc-ojima/dutySettings/main`（`{enabled: boolean}`）、
  `teams/fc-ojima/dutyGroups/{groupId}`（`{name, memberIds: string[]}`）
- `firestore.rules`: 両方とも`read: isApproved`／`write: isManager`
  （`venues`と同じパターンで、一般保護者による書き込みは拒否されることをE2Eで確認済み）
- `js/common/firebase-config.js`: `Collections.dutyGroups`/`Collections.dutySettings`を追加
- `js/common/db.js`: `DB.loadDutySettings`/`saveDutySettings`/`loadDutyGroups`/`saveDutyGroup`/`deleteDutyGroup`
- `js/hub/admin.js`: 管理タブに「🔔 当番グループ設定」ボタン→モーダル
  （ON/OFFトグル・グループ追加/改名/削除・メンバー選択チップ）
- `css/common.css`: `.duty-toggle-switch`（トグルスイッチ）、`.duty-group-card`/`.duty-member-chip`

### 検証
Firebaseエミュレータ+Playwrightで、管理者ロールにて：
- トグルON/OFF、グループ作成、メンバー割り当てがすべてページリロード後も永続化されること（11項目PASS）
- 一般保護者（承認済みだが非マネージャー）による`dutyGroups`直接書き込みが
  `permission-denied`で拒否されること（セキュリティ確認1項目PASS）

### キャッシュバスト
`firebase-config.js?v=20260719`（全ページ）、`db.js?v=20260719`（Firestore利用ページ）、
`admin.js?v=20260719c`、`common.css?v=20260719c`（hub/index.htmlのみ）

---

## 2026-07-19 持ち物チェックリスト＋未回答者の横断ビュー

todo.mdの壁打ちで決まった6機能のうち⑤⑥を実装（①②③は前セッションでPR #83にてマージ済み）。

### ⑤ 持ち物チェックリスト
- `js/common/checklist.js` を新規作成、`FCOjima.Checklist` 名前空間
  - `Checklist.getItems(type, extra)` / `Checklist.formatChips(type, extra)`
  - イベント種別（game/practice/event/nighter/other）ごとの持ち物をハードコードした辞書を返す最小実装
  - `event.checklistExtra`（イベント個別の追加持ち物）に対応済みだが、現状どのUIからも
    `checklistExtra`を書き込む導線は未実装（拡張の余地として残す）。**もし今後
    イベント編集モーダルからchecklistExtraを編集できるようにする場合は、
    `Calendar.saveEvent`（js/hub/calendar.js:881-896付近）の固定フィールド再構築ロジックに
    `checklistExtra`を明示的に追加しないと、他のフィールド編集保存時に消える**ので要注意
- 表示箇所3か所: `js/hub/myevents.js`（参加予定タブの各カード）、
  `js/hub/calendar.js`の`Calendar.showEventDetails`（保護者向けイベント詳細）、
  `js/hub/admin.js`の`Admin.openEventDetailModal`（管理者向け概要モーダル）
- CSS: `css/common.css`に`.checklist-chips`/`.checklist-chip`/`.checklist-label`を追加

### ⑥ 未回答者の横断ビュー
- `js/hub/admin.js`の`Admin.loadAttendanceMatrix`内に実装（別関数に分けず、
  マトリクス読み込み時の副産物として集計 — todo.mdのCodexレビュー指摘どおり案Aを採用し、
  出欠状況モーダルの中だけに表示。管理タブを開いただけでは表示されない仕様）
  - 表示中のイベント（過去表示トグルの状態に連動）の中で「未回答」が3件以上ある選手を
    多い順にチップ表示。0〜2件の選手は表示しない（`UNANSWERED_THRESHOLD = 3`で調整可能）
  - `isTargetFor`判定を通しているため、対象外（na）は未回答としてカウントされない
- CSS: `hub/index.html`のインラインstyleに`.mx-unanswered`系を追加（既存の
  `.mx-toolbar`等と同じ場所に集約されているページなので、ここに追記するのが既存踏襲）

### 検証
- Firebaseエミュレータ+Playwrightで検証（管理者・保護者の両ロールでログインし確認）。
  - 未回答が閾値以上の選手がチップ表示されること
  - 持ち物チップが管理者向けモーダル・保護者向けモーダル・参加予定タブカードの3箇所すべてに
    正しいイベント種別の持ち物で表示されること
  - 全6項目PASS

### キャッシュバスト
`hub/index.html`: `checklist.js?v=20260719`（新規）、`calendar.js?v=20260719c`、
`admin.js?v=20260719c`、`myevents.js?v=20260719`、`common.css?v=20260719c`

---

## 2026-07-17〜19 セッションまとめ（PR #75〜#81、全件マージ・本番反映済み）

このセッションで行った作業の一覧。詳細は各PRの日付見出しを参照。

| PR | 日付 | 内容 |
|---|---|---|
| #75 | 07-17 | 割り当て画面にキャンバス型全画面モード追加（ピンチズーム・パン・タップ配置） |
| #76 | 07-17 | キャンバスモードの座席はみ出し修正＋車らしいデザイン改良 |
| #77 | 07-17 | キャンバスモード実機バグ修正（✕で閉じない／メンバー帯D&D不可） |
| #78 | 07-17 | `.gitignore` にエミュレータデバッグログを追加（雑務） |
| #79 | 07-18 | 出欠マトリクスからの参加イベント移動＋保護者向け変更通知＋「参加予定」タブ新設 |
| #80 | 07-18 | 参加イベント移動時の連絡事項タブ即時反映＋出欠状況マトリクスUI刷新（sticky修正・内訳表示・過去トグル） |
| #81 | 07-19 | アプリ全体のデザイン刷新（ユニフォーム基調のデザインシステム化・公式ロゴ採用・ログイン画面全面刷新） |

このセッションでは以下の追加ツール・手法を使用した：
- **Firebaseエミュレータ + Playwright** によるE2E検証をほぼ全PRで実施（本番に一切影響しない）
- **Higgsfield MCP**（`soul_location`でログイン背景画像生成、`remove_background`でチーム公式ロゴの背景透過切り抜き）

### 未対応の改善提案（次セッションへの申し送り）
2026-07-17のE2E総点検で見つけた軽微な項目。今回は本題を優先し未着手：
1. `firestore.rules` の `users` 読み取りルールが必要以上に広い（`status=='approved'`なら誰でも読める）。
   初代管理者ブートストラップ用の名残で、その機構自体はPR #71で廃止済みなので条項ごと削除可能
2. `storage.rules` が「認証済みなら誰でも読み書き可」。承認前ユーザーも添付ファイルを触れてしまう。
   添付ファイル機能を本格運用する前に `isApproved` 相当のチェックを追加すると安全
3. `js/carpool/notifications.js` の検索結果ヘッダー（1箇所）がキーワード未エスケープ（他は全箇所escapeHTML適用済み）
4. 通常モード（キャンバスモードでない）の座席×ボタンが2行名前と軽く重なる（表示上の些細な不具合）

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

## 2026-07-19 PWA化（ホーム画面にアイコン追加できるように）

### 概要
スマホのホーム画面にアプリアイコンを追加でき、ブラウザURL欄を経由せず直接開けるようにした。

### 実装
- `manifest.json`（リポジトリルート）: `start_url: /hub/login.html`, `display: standalone`,
  `theme_color`/`background_color` はチームカラー`#1C1600`
- アイコンは公式ロゴ（Higgsfieldで背景除去済みの`hf_trim.png`）から生成。
  **透過のままだとホーム画面で浮くため、`#1C1600`の正方形背景に合成**してから書き出し
  （`img/icon-192.png` / `icon-512.png` / `icon-512-maskable.png`（Android用に安全マージン20%広め））
- 全10HTMLの`<head>`に`<link rel="manifest">` / `<meta name="theme-color">` /
  `<link rel="apple-touch-icon">`を追加
- **Service Workerは意図的に作らない**（オフライン対応はスコープ外。キャッシュバスト運用と
  衝突するリスクを避け、3原則のメンテナンスフリーを優先。todo.md参照）

### 検証
Playwright + CDP `Page.getAppManifest`（Chrome自身にマニフェストをパースさせる）で
パースエラー0件を確認。3ページ（index/hub/carpool配下）すべてで`manifest.json`への
リンクが正しく張られていることも確認。5項目全パス。

---

## 2026-07-19 送迎の貢献度・公平性の可視化（管理タブ）

### 概要
管理タブに「今シーズン誰が何回運転したか」のランキングを表示し、負担の偏りを見える化する。

### 実装（`js/hub/admin.js` / `hub/index.html` / `css/common.css`）
- 管理タブに「🚗 送迎の貢献度」ボタン＋モーダル（`Admin.initDriverStatsModal` / `Admin.loadDriverStats`）
- **集計は「今シーズン」＝直近の4/1〜に限定**（`Admin._seasonStartISO()`。学年繰り上げの
  `Utils.calculateGrade`と同じ4/1基準に合わせた。全期間集計だと過去のデータが混ざりミスリードに
  なるというCodexレビュー指摘を反映）
- `FCOjima.DB.loadEvents()`→シーズン内イベントのみ`Promise.all`で`loadEventData`取得
  →`carRegistrations`を`parent`名で集計（`canDrive==='no'`は除外）→棒グラフ表示
- 「今シーズン未登録の保護者」（father/mother roleで登録0件）も併記し、声かけの参考にできるように
- 新規Firestoreフィールドなし。既存の`carRegistrations`データを読むだけ

### 検証
エミュレータ+Playwrightで7項目全パス（シーズン内外の混入なし・`canDrive=no`除外・
未登録保護者リスト表示・モーダル開閉）。

キャッシュバスト: admin.js → `?v=20260719b`

---

## 2026-07-19 会場の現地天気表示（イベントモーダル）

### 概要
イベント詳細モーダルの会場欄に、開催日・現地の天気予報を表示する。

### 実装（`js/common/weather.js`新規／`js/hub/calendar.js`／`js/hub/admin.js`）
- **Open-Meteo API**（APIキー不要・無料・商用利用制限なし）を採用。ジオコーディング
  （`geocoding-api.open-meteo.com`）→ 緯度経度取得 → 天気予報（`api.open-meteo.com`）の2段構成
- `FCOjima.Weather.getForecast(venueName, address, dateISO)` が本体。
  - ジオコーディング結果は`localStorage`に永続キャッシュ（緯度経度は不変のため）
  - 天気予報は`sessionStorage`に当日限りキャッシュ
  - 過去日／16日超先（Open-Meteoの予報上限）／ジオコーディング失敗／ネットワークエラーは
    すべて`{ok:false, reason:...}`で返し、呼び出し元のモーダルを絶対に壊さない設計
  - 住所から都道府県+市区町村を正規表現で抜き出して検索精度を上げる（学校名等はヒット率が低いため）
- `Calendar.showEventDetails`（HUB→イベント詳細）と`Admin.openEventDetailModal`
  （管理タブ→出欠状況→イベント名タップの概要モーダル）の両方に、会場名の右に
  `<span id="event-weather-{eventId}">`を差し込み、非同期で天気チップを描画
- CSS: `css/common.css`に`.weather-chip`（情報色の丸ピル）を追加

### 検証
- Node単体テストでロジック6項目（未来日成功／キャッシュ効果／過去日／予報範囲外／
  ジオコーディング失敗／ネットワークエラー）全パス
- エミュレータ+Playwright（Open-Meteoをroute()でスタブ）で、カレンダー・管理タブ両方の
  モーダルへのチップ表示を確認。5項目全パス

キャッシュバスト: weather.js(新規) / calendar.js / admin.js → `?v=20260719`

---

## 2026-07-19 アプリ全体のデザイン刷新

ユニフォーム（黄×黒の横縞）に着想を得た「有料アプリ級」の見た目に刷新。
コンセプトカラー（山吹 #E8A200 × 黒茶 #1C1600）は不変。

### `css/common.css`（全面刷新・デザインシステム化）
- `:root` にデザイントークン（色/グラデ/影/角丸/フォーカス/ストライプ）を定義
- ストライプモチーフ `--stripe`（repeating-linear-gradient）をヘッダー/タブ/下部ナビの
  アクセントラインに使用（ユニフォーム由来）
- ヘッダー: インクのグラデ地＋SVGエンブレム（`header h1::before` にdata-URI、
  inline-blockで見出しの ellipsis を維持）
- タブ: アクティブは塗り潰しでなく発光する下線アクセント
- ボタン: ゴールドのグラデ＋押下アニメ、セカンダリはゴースト（枠線）
- 入力/カード/モーダル(backdrop-blur)/アラート(左バー)/ローディング(シマー)を高級化
- 温かみのある背景＋極薄ドット地模様、WebKitスクロールバー装飾

### `hub/login.html`（全面刷新）
- 生成画像 `img/login-hero.webp`（Higgsfield soul_location・28KB・夕暮れのピッチ）を
  暗幕＋screen合成で背景に。無くてもグラデ地で成立するフォールバック設計
- 自作SVGクレスト（盾＋黄黒縞＋サッカーボール＋1985リボン）、発光ゴールドのGoogleボタン

### その他
- 全HTMLに絵文字ならぬSVGエンブレムの favicon を追加（従来の404解消）
- 全HTMLの common.css キャッシュバストを `?v=20260719` に統一更新
- **JS・DOM構造・クラス名は不変**（既存機能に影響なし。純粋に見た目のみ）
- エミュレータ＋Playwrightでログイン/カレンダー/メンバー/連絡/マトリクスの表示を目視確認

---

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
