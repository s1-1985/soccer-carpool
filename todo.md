# TODO（次セッション引き継ぎ用・詳細仕様）

最終更新: 2026-07-19
このファイルは「壁打ちで決まった6機能」の実装状況と詳細仕様を記録する。
セッションが途中で終わっても、この内容だけで作業を再開できる解像度で書く。

**運用ルール**：着手したら「状態」を`未着手→進行中→完了(PR#xx)`に更新し、
完了したらこのファイルから該当セクションを削除して`handover.md`に転記する。

---

## 進捗サマリ

| # | 機能 | 状態 | 優先度 |
|---|---|---|---|
| 1 | 会場の現地天気表示（イベントモーダル） | 完了（次PRで反映） | 高（明示的リクエスト） |
| 2 | 送迎の貢献度・公平性の可視化 | 完了（次PRで反映） | 高 |
| 3 | PWA化（ホーム画面アイコン） | 完了（次PRで反映） | 高 |
| 4 | 当番表機能（お茶当番・旗当番等） | 進行中（グループ管理は完了・次PRで反映。イベントへの割り当ては未着手） | 中 |
| 5 | 持ち物チェックリスト | 完了（次PRで反映、handover.md参照） | 中 |
| 6 | 未回答者の横断ビュー | 完了（次PRで反映、handover.md参照） | 中 |

各機能は独立している。**着手順は上から推奨**だが、ユーザーの要望次第で変えてよい。
すべて「PR単位で実装→エミュレータ+Playwrightで検証→handover.md追記→ドラフトPR作成→
subscribe_pr_activityで監視」という、このセッションで確立した型を踏襲する。

---

## 1. 会場の現地天気表示（イベントモーダル）

### 要件
イベント詳細モーダルの「会場」欄に、そのイベント当日・現地の天気予報を表示する。

### 技術選定：Open-Meteo API（無料・APIキー不要・CORS対応）
3原則（無料・メンテナンスフリー）に最も合う。サインアップ不要、商用不可の縛りなし、
呼び出し回数の実用上の制限も緩い（非商用利用は事実上無制限）。フロントから直接fetchできる。

- **ジオコーディング**: `https://geocoding-api.open-meteo.com/v1/search?name=<会場名>&count=1&language=ja&format=json`
  → `results[0].latitude` / `results[0].longitude` を取得
  - 会場名だけだと精度が低い場合があるので、`venue.address`（登録済みなら）を優先的に使う
  - 例: `太田市粕川町` のような地名でも一定精度で当たる。学校名だと当たらないこともあるので
    フォールバックとして「都道府県+市区町村」部分だけ抽出して再検索する等の工夫が要る
    （`venue.address`の先頭の都道府県市区町村を正規表現で抜き出す）
- **天気予報**: `https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lon>&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&start_date=<event.date>&end_date=<event.date>`
  - `daily.weathercode[0]` は[WMO Weather interpretation codes](https://open-meteo.com/en/docs)。
    0=快晴, 1-3=晴れ〜曇り, 45/48=霧, 51-67=雨, 71-77=雪, 80-82=にわか雨, 95-99=雷雨。
    絵文字マッピングのテーブルを自分で作る（☀️🌤️☁️🌧️⛈️🌨️等）
  - 予報は**16日先まで**しか出ない（Open-Meteoの仕様）。それより先のイベントは
    「天気予報はまだ取得できません（開催7日前頃から表示）」等のプレースホルダーを出す
  - 過去日（試合が終わった後）は`archive-api.open-meteo.com`という別エンドポイントがあるが、
    優先度低。当面は「過去のイベントには天気を表示しない」でよい

### 実装方針
- `js/common/weather.js` を新規作成、`FCOjima.Weather` 名前空間
  - `Weather.getForecast(venueName, address, dateISO)` → `{ ok, emoji, label, tempMax, tempMin, pop }` を返す非同期関数
  - ジオコーディング結果は `localStorage`（キー: `fcojima_geocode_<venueName>`）に**永続キャッシュ**
    する（緯度経度は変わらないので毎回叩く必要がない。APIの実質無制限とはいえマナーとして）
  - 天気予報結果は当日中だけ有効な短期キャッシュ（`sessionStorage`、キーに日付を含める）
  - エラー（ネットワーク不可、地名が当たらない等）は静かに失敗して「天気: 取得できませんでした」
    を出す。天気が取れないことでモーダル全体が壊れてはいけない
- 呼び出し箇所は2箇所（会場表示ロジックが重複しているため）:
  1. `js/hub/calendar.js` の `Calendar.showEventDetails`（`venueMapBtn`を作っている付近、580行目前後）
  2. `js/hub/admin.js` の `Admin.openEventDetailModal`（673行目〜、出欠マトリクスから開く概要モーダル）
  - 表示は非同期なので、まず「天気: 取得中...」を表示 → Promise解決後にDOM差し替え
    （`document.getElementById('event-weather-<eventId>')`のような一意IDを振る）
- UIイメージ: 会場名の右横か下に
  `☀️ 7/25(土) 現地 28℃/21℃ 降水10%` のような1行バッジ
  （`css/common.css`に`.weather-chip`的なクラスを追加、山吹×黒テーマに馴染む配色で）

### 検証観点
- 未来日・16日以内 → 天気が出る
- 未来日・16日超 → プレースホルダー
- 過去日 → 天気欄を出さない、またはグレーアウト
- 会場名でジオコーディングが失敗するケース（実在しない地名等）→ エラーメッセージのみ、モーダルは壊れない
- Firestoreエミュレータ環境ではネットワークがサンドボックス制限を受けるため、
  このE2E検証は「Open-Meteoへのfetchをroute()でスタブ」して行うこと
  （前回セッションでgstatic.com等をローカルファイルに差し替えたのと同じ手法。
  `scratchpad/e2e/vendor/`にサンプルレスポンスJSONを置いておくと楽）

---

## 2. 送迎の貢献度・公平性の可視化

### 要件
管理タブに「今シーズン誰が何回運転したか」の一覧を表示し、負担の偏りを見える化する。

### データソース
`teams/fc-ojima/eventData/{eventId}` の `carRegistrations` 配列（各要素に `parent`, `canDrive` 等）。
全イベント分をロードして `parent` 名で集計するだけ。**新しいFirestoreフィールドは不要**。

### 実装方針
- `js/hub/admin.js` に `Admin.loadDriverStats` を追加
  - `FCOjima.DB.loadEvents()` で全イベント取得 → `Promise.all` で各イベントの `loadEventData` を取得
    （出欠マトリクスの `loadAttendanceMatrix` と全く同じパターンなので、そこのコードを参考にする）
  - `carRegistrations.filter(c => c.canDrive !== 'no')` を集計。同一人物が複数イベントに
    登録している回数をカウント（`Map<parentName, count>`）
  - ランキング表示（多い順）。同時に「一度も運転していない保護者」も出すと公平性の議論がしやすい
    （`FCOjima.Hub.members`のfather/mother roleのうち、登録0件の人をリストアップ）
- UI: 管理タブに新セクション「🚗 送迎の貢献度」、ボタンを押すと表示（出欠状況と同じモーダル形式でよい）
  - 棒グラフ的な簡易表現（CSSの`width:%`だけで作れる、Chart.js等のライブラリは不要＝3原則に合う）
- **【Codexレビュー指摘・反映済み】集計は「今シーズン」に限定する（全期間だと去年以前の登録が
  混ざりランキングが実態と乖離してミスリードになる）。学年繰り上げが4/1基準（`Utils.calculateGrade`）
  なのに合わせ、シーズン境界も「直近の4/1〜」で固定する。
  `FCOjima.DB.loadEvents()`で全件取得した後、`event.date >= シーズン開始日`でフィルタしてから
  `Promise.all`に渡す（出欠マトリクスの過去トグルの日付比較ロジックがそのまま使える）

### 検証観点
- 運転者が0人のイベントも含めて集計が壊れないこと
- 同じ保護者が別名義（例:「田中」と「田中太郎」）で登録されていても別集計になる仕様（名寄せはしない、
  既存データがnameベースなので割り切る）
- E2Eでは複数イベント・複数carRegistrationsをシードして集計結果を検証

---

## 3. PWA化（ホーム画面にアイコンを追加できるように）

### 要件
スマホのホーム画面に公式ロゴのアイコンを追加でき、タップでブラウザURL欄なしに開ける。

### 実装方針（ビルド不要、Vanilla構成のまま）
1. `manifest.json` をリポジトリルートに作成:
   ```json
   {
     "name": "FC尾島ジュニア HUB",
     "short_name": "尾島ジュニア",
     "start_url": "/hub/login.html",
     "display": "standalone",
     "background_color": "#1C1600",
     "theme_color": "#1C1600",
     "icons": [
       { "src": "/img/favicon-64.png", "sizes": "64x64", "type": "image/png" },
       { "src": "/img/icon-192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/img/icon-512.png", "sizes": "512x512", "type": "image/png" }
     ]
   }
   ```
   - `icon-192.png` / `icon-512.png` は `img/logo.webp`（Higgsfieldで透過済みの公式ロゴ）から
     Pythonで生成する。ロゴは背景透明なので、PWAアイコンとしては**チームカラーの黒(#1C1600)か
     山吹(#E8A200)の正方形背景に合成**してから書き出すこと（透明のままだとホーム画面で
     白背景に馴染まずダサくなる）。生成手順は今セッションの `logo_trim.png` / `hf_trim.png`
     切り抜き作業と同じ場所（`/tmp/.../scratchpad/`）にスクリプトの実績があるので再利用可
   - `maskable`アイコン対応（Android用に安全マージンを持たせた正方形）も余裕があれば追加
2. 全HTMLの `<head>` に以下を追加:
   ```html
   <link rel="manifest" href="/manifest.json">
   <meta name="theme-color" content="#1C1600">
   <link rel="apple-touch-icon" href="/img/icon-192.png">
   ```
3. Service Workerは**今回は作らない**（オフライン対応まではスコープ外。manifestだけでも
   「ホーム画面に追加」は機能する。SWを足すとキャッシュ管理の複雑さが増し、
   「JS/CSS変更時にキャッシュバストを更新する」という既存運用と衝突するリスクがあるため、
   3原則のメンテナンスフリーを優先してあえて入れない判断でよい）
4. `firebase.json` の `hosting.headers` に `manifest.json` のContent-Type設定は通常不要
   （Firebase Hostingが`.json`を`application/json`で自動配信するため）

### 検証観点
- Chromeの「ホーム画面に追加」導線が出る（DevTools > Application > Manifest で警告が出ないか確認）
- アイコンが正方形の背景色付きで綺麗に見えること（透過ロゴそのままだと角が透明でおかしくなるので注意）
- 既存のfaviconと二重管理にならないよう、favicon用画像とPWAアイコン用画像は共通化できるか検討

---

## 4. 当番表機能（お茶当番・旗当番・審判当番等）

### ユーザー決定事項（2026-07-19ヒアリング済み）
- 当番表はマスト機能ではない。**ON/OFFで切り替え可能**にする（オフなら他画面に非表示）
- 当番の分け方は「グループ制」。イベントごとの細かい種類（お茶/旗など）分けではなく、
  保護者・指導者をあらかじめ複数のグループに分けておく方式
- 設定は管理タブで行う。手順は2段階：
  1. グループを作る（グループごとの名称を決める。例: Aグループ/Bグループ）
  2. グループごとにメンバーを選ぶ。**メンバー候補は指導者（coach/assist）・父・母のみ**
     （選手は対象外）

### Phase 1（実装済み・このtodo.md更新と同じPRで反映）
- Firestore: `teams/fc-ojima/dutySettings/main` に `{ enabled: boolean }`、
  `teams/fc-ojima/dutyGroups/{groupId}` に `{ name: string, memberIds: string[] }`
- `firestore.rules`: 両コレクションとも `read: isApproved`、`write: isManager`
  （`venues`コレクションと同じパターン。書き込みを管理者限定にする対応はCodex指摘を
  先取りする形で最初から反映済み）
- `js/common/db.js`: `DB.loadDutySettings/saveDutySettings/loadDutyGroups/saveDutyGroup/deleteDutyGroup`
- `js/hub/admin.js`: `Admin.initDutyGroupsModal`ほか。管理タブに「🔔 当番グループ設定」ボタン →
  モーダルでON/OFFトグル・グループ追加/改名/削除・メンバー選択（チップのチェックボックス）
- 検証: Firebaseエミュレータ+Playwrightで、トグル/グループ作成/メンバー割り当てが
  すべてリロード後も永続化されること、一般保護者（マネージャーでない）による
  `dutyGroups`書き込みが`permission-denied`になることを確認済み

### Phase 2（未着手・要ヒアリング）
グループの器は作ったが、**「特定のイベントにどのグループを割り当てるか」の仕組みがまだない**。
次に着手する前に、以下をユーザーに確認すること：

- イベントへの割り当て方法：グループを順番に自動ローテーションさせるか、管理者がイベントごとに
  手動でグループを選ぶか
- 表示場所：イベント詳細モーダルに「今回の当番: Aグループ」のように出す想定でよいか
  （出欠マトリクスや参加予定タブへの表示要否も含む）
- 通知要否：「今度の日曜はAグループが当番です」を連絡事項に自動投稿するか
  （参加イベント移動の`move`通知パターンがそのまま流用できる）
- Phase 1で追加した`dutyGroups`とは別に、イベント側にどのグループが割り当たったかを持たせる
  場所が必要（例: `events/{eventId}.dutyGroupId`、または`eventData/{eventId}`に追加）。
  後者にする場合は、Phase 1で先取りした「書き込みをマネージャー限定にする」設計と矛盾しないよう、
  `eventData`の`write: isApproved`ルールとは別に保護する必要がある点に注意
  （`eventData`は現状「承認済みなら誰でも書き込み可」のため）

---

## 5. 持ち物チェックリスト

### 要件
イベント種別（試合/練習/イベント/ナイター）ごとに、持ち物のテンプレを表示する。
「参加予定」タブ、およびイベント詳細モーダルに表示。

### 実装方針
- 超シンプルにやるなら**Firestore不要**。`js/common/utils.js`（or新規`checklist.js`）に
  イベント種別→持ち物リストのハードコード辞書を持つだけでよい:
  ```js
  const CHECKLISTS = {
    game:    ['ゼッケン', 'すね当て', '水筒', '着替え', '雨具（念のため）'],
    practice:['水筒', 'すね当て', 'ボール（自分の）'],
    event:   ['筆記用具', '水筒'],
    nighter: ['ライト付きシューズ推奨', '防寒着']
  };
  ```
  これだと管理者が編集できないが、まず最小実装として出す価値はある
- ただし「イベントごとに持ち物を追記したい」（例:「今回は雨具必須」）というニーズが
  出そうなので、拡張案として `events/{eventId}` に `checklistExtra: string[]` を持たせて
  イベント編集モーダルから追記できるようにすると実用性が上がる（優先度は最小実装の後）
  - **【Codexレビュー指摘・要対応】この拡張をやる場合、`Calendar.saveEvent`
    （`js/hub/calendar.js:881-896`付近）が固定フィールドのリストからイベントオブジェクトを
    再構築して`Storage.saveEvents`で全イベントを書き戻す実装になっているため、
    `checklistExtra`をこの構築ロジックに明示的に含めないと、**管理者がタイトルや時間を
    編集して保存するたびに`checklistExtra`が消える**（未知フィールドは保持されない）。
    実装時は必ず`saveEvent`内のフィールドリストに`checklistExtra`を追加すること
    （読み込み側`openEditEventModal`相当の初期値復元にも追加が要る）
- 表示箇所:
  1. `js/hub/myevents.js` の `MyEvents.renderList` — 各`.me-card`内に持ち物チップを追加
  2. イベント詳細モーダル（①の天気表示と同じ場所に併記すると情報がまとまる）

### 検証観点
- イベント種別ごとに正しいリストが出る
- `checklistExtra`（拡張する場合）が空でも壊れない

---

## 6. 未回答者の横断ビュー

### 要件
管理タブに「複数イベントにまたがって、ずっと出欠未回答の人」の一覧を表示し、
個別に声をかけやすくする。

### 実装方針
- `js/hub/admin.js` に `Admin.loadUnansweredSummary` を追加。ロジックは出欠マトリクス
  （`loadAttendanceMatrix`）とほぼ同じデータ取得をするので、**関数を分けずに
  マトリクス読み込み時に副産物として集計してしまう**のが効率的
  （`statusMap`が既にeventId×memberの状態を持っているので、そこから
  「unknownの数が一定以上の選手」を抽出するだけ）
- 表示: 出欠状況モーダルのツールバー（`.mx-toolbar`）に「未回答が多い順」ソートボタンを
  追加する案、または別セクションで「未回答3件以上: 選手三郎(4件), ..." のような
  テキストサマリーを出す案。UIはシンプルな方（後者）から始めるのを推奨
  - **【Codexレビュー指摘・要対応】このサマリーを「管理タブを開いたら常に見える場所」
    （出欠状況モーダルの外）に置く場合、`loadAttendanceMatrix`は現状
    `#btn-attendance-matrix`をタップするまで実行されない（`js/hub/admin.js:45-48`の
    `initAttendanceMatrixModal`参照）。そのため「管理タブに入っただけ」の状態では
    サマリーが空/古いままになる。
    - 案A: サマリー表示はモーダル内に留める（マトリクスを開いたときだけ見える。実装がシンプル）
    - 案B: 管理タブを開いたタイミング（`Admin.init`相当）でも軽量に同じ集計を走らせる
      （マトリクスの全データ取得は少し重いので、タブ表示のたびに走らせて良いか要検討）
    案Aを既定にし、案Bは「管理タブを開くたびに毎回全イベント分fetchするコスト」との
    トレードオフをユーザーに確認してから決めること
- 「未回答が多い＝連絡が届いていない可能性」も考慮し、該当選手の保護者へのリマインド
  導線（LINE共有等、既存の`attendance.js`の`reminderAttendance`関数を参考に）があると尚良い

### 検証観点
- 未回答が0件の選手が誤って表示されないこと
- 学年外・対象外（`na`）が「未回答」とカウントされないこと（既存の`isTargetFor`判定を必ず通す）

---

## 実装時の共通チェックリスト（このセッションで確立した型）

新機能を1つ実装するごとに、以下を必ず行う：

1. ブランチを `origin/main` から作り直す
   （`git fetch origin main -q && git checkout -B claude/session-XXX origin/main`）
   ※前回までのセッションブランチ名は `claude/session-5l7d8h`。新セッションなら
   ハーネス（CLAUDE.md記載の「古いセッションブランチを再開・再pushしない」原則）に注意し、
   新しいセッションが払い出す新ブランチ名を使うこと
2. 実装
3. `node --check <変更したjsファイル>` で構文チェック
4. Firebaseエミュレータを起動して実機相当の検証（Playwright）。
   `scratchpad/e2e/` に前回セッションで作ったハーネス一式（`seed.mjs`, `vendor/`のFirebase SDK
   キャッシュ, `newCtx()`ヘルパー等）が残っていれば流用できる。ただし`/tmp`配下は
   セッションが変わると消えている可能性が高いので、無ければゼロから作る
5. HTML側のキャッシュバスト更新を忘れない（`?v=YYYYMMDD`、画像なら`?v=N`）
6. `handover.md` に日付見出しで詳細を追記（このtodo.mdのセクションを転記・要約する形でよい）
7. コミット→プッシュ→ドラフトPR作成→`subscribe_pr_activity`で監視
8. このtodo.mdから完了したセクションを削除 or 「完了(PR#xx)」に更新

---

## 次にやるべき最初の一歩（次セッション開始時）

①②③⑤⑥は完了・本番反映済み。④当番表は**Phase 1（グループ管理の器）のみ完了**。

1. まずこのファイルを読む
2. ④当番表 Phase 2（イベントへの割り当て）に進むかユーザーに確認する。進む場合は
   本ファイル「4. 当番表機能」の「Phase 2（未着手・要ヒアリング）」節にある質問
   （割り当て方法・表示場所・通知要否・スキーマ配置）を先に聞くこと
