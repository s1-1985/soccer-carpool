/**
 * FC尾島ジュニア - HUBページ メイン初期化
 */

window.FCOjima = window.FCOjima || {};

FCOjima.Hub.init = async function() {
    console.log('HUB 初期化開始...');

    // Firestoreからデータをロード（認証済みの場合）
    if (window.FCOjima && FCOjima.DB) {
        try {
            const data = await FCOjima.DB.loadAllData();
            FCOjima.Hub.members       = data.members;
            FCOjima.Hub.venues        = data.venues;
            FCOjima.Hub.events        = data.events;
            FCOjima.Hub.notifications = data.notifications;
            FCOjima.Hub.logs          = data.logs;
            FCOjima.Hub.dutyEnabled     = data.dutySettings ? !!data.dutySettings.enabled : false;
            FCOjima.Hub.dutyGroups      = data.dutyGroups || [];
            FCOjima.Hub.dutyAssignments = data.dutyAssignments || [];
            console.log('Firestoreからデータをロードしました');
        } catch (e) {
            console.warn('Firestoreロード失敗 → localStorageを使用:', e);
            FCOjima.Hub.members       = FCOjima.Storage.loadMembers();
            FCOjima.Hub.venues        = FCOjima.Storage.loadVenues();
            FCOjima.Hub.events        = FCOjima.Storage.loadEvents();
            FCOjima.Hub.notifications = FCOjima.Storage.loadNotifications();
            FCOjima.Hub.logs          = FCOjima.Storage.loadLogs();
            FCOjima.Hub.dutyEnabled     = false;
            FCOjima.Hub.dutyGroups      = [];
            FCOjima.Hub.dutyAssignments = [];
        }
    } else {
        FCOjima.Hub.members       = FCOjima.Storage.loadMembers();
        FCOjima.Hub.venues        = FCOjima.Storage.loadVenues();
        FCOjima.Hub.events        = FCOjima.Storage.loadEvents();
        FCOjima.Hub.notifications = FCOjima.Storage.loadNotifications();
        FCOjima.Hub.logs          = FCOjima.Storage.loadLogs();
        FCOjima.Hub.dutyEnabled     = false;
        FCOjima.Hub.dutyGroups      = [];
        FCOjima.Hub.dutyAssignments = [];
    }

    // 現在の日付を設定
    FCOjima.Hub.currentDate = new Date();

    // 各タブを初期化
    if (FCOjima.Hub.Calendar && FCOjima.Hub.Calendar.init)       FCOjima.Hub.Calendar.init();
    if (FCOjima.Hub.Members   && FCOjima.Hub.Members.init)       FCOjima.Hub.Members.init();
    if (FCOjima.Hub.Notifications && FCOjima.Hub.Notifications.init) FCOjima.Hub.Notifications.init();
    if (FCOjima.Hub.Venues    && FCOjima.Hub.Venues.init)        FCOjima.Hub.Venues.init();

    // イベントのリアルタイム同期を開始
    FCOjima.Hub.startEventsRealtimeSync();

    console.log('HUB 初期化完了');
};

/**
 * イベントコレクションのリアルタイムリスナー。
 * 自分や他ユーザーがイベントを追加・変更・削除すると、再読込なしで
 * カレンダーと「参加予定」タブに即時反映される。
 *
 * コスト面の設計メモ（無料枠: 読み取り5万/日）:
 * - onSnapshotの課金は「初回に全件＋以降は変更ドキュメント分だけ」。
 *   イベントは高々数百件・変更頻度も低いので、タブ切替のたびに全件再取得する
 *   方式より読み取り数はむしろ少なく、体感遅延もゼロになる
 * - 常時リスナーはこの1本だけに絞る（members等は変更頻度が低く、再読込で十分）
 */
FCOjima.Hub.startEventsRealtimeSync = function() {
    if (FCOjima.Hub._eventsUnsub) return; // 二重登録防止
    if (!window.FCOjimaFirebase || !FCOjimaFirebase.Collections) return;
    var first = true;
    try {
        FCOjima.Hub._eventsUnsub = FCOjimaFirebase.Collections.events().onSnapshot(function(snapshot) {
            // 初回スナップショットは loadAllData と同内容なので再描画不要
            if (first) { first = false; return; }
            var events = snapshot.docs.map(function(doc) {
                var d = doc.data(); d.id = doc.id; return d;
            });
            FCOjima.Hub.events = events;
            try { localStorage.setItem('fcojima_events', JSON.stringify(events)); } catch (e) {}

            // カレンダー再描画（現在の表示月・ビューを維持）
            var Cal = FCOjima.Hub.Calendar;
            if (Cal) {
                if (Cal.renderCalendar) Cal.renderCalendar();
                if (Cal.renderEventsList) Cal.renderEventsList();
            }
            // 参加予定タブを再計算（バッジ更新含む）。タブ表示中なら一覧も再描画
            var Me = FCOjima.Hub.MyEvents;
            if (Me && Me.refresh) {
                Me.refresh().then(function() {
                    var tab = document.getElementById('my-events');
                    if (tab && tab.style.display !== 'none' && Me.renderList) Me.renderList(false);
                }).catch(function() {});
            }
            console.log('イベントのリアルタイム更新を反映しました (' + events.length + '件)');
        }, function(err) {
            console.warn('イベントリスナーエラー（リアルタイム同期停止・従来動作にフォールバック）:', err);
        });
    } catch (e) {
        console.warn('リアルタイム同期の開始に失敗:', e);
    }
};

FCOjima.Hub.openLogsModal = function(type) {
    const logs = FCOjima.Hub.logs || [];
    const filtered = type ? logs.filter(l => l.type === type) : logs;
    const logsContent = document.getElementById('logs-content');
    if (!logsContent) return;

    if (filtered.length === 0) {
        logsContent.innerHTML = '<p>ログがありません。</p>';
    } else {
        logsContent.innerHTML = filtered.slice().reverse().slice(0, 50).map(function(log) {
            const dt = new Date(log.datetime).toLocaleString('ja-JP');
            return `<div class="log-item">
                <span class="log-time">${dt}</span>
                <span class="log-user">${FCOjima.UI ? FCOjima.UI.escapeHTML(log.user) : log.user}</span>
                <span class="log-action">${FCOjima.UI ? FCOjima.UI.escapeHTML(log.action) : log.action}</span>
                <span class="log-details">${FCOjima.UI ? FCOjima.UI.escapeHTML(log.details) : log.details}</span>
            </div>`;
        }).join('');
    }

    if (FCOjima.UI && FCOjima.UI.openModal) FCOjima.UI.openModal('logs-modal');
};
