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
            FCOjima.Hub._loadedFromFirestore = true;
            console.log('Firestoreからデータをロードしました');
        } catch (e) {
            console.warn('Firestoreロード失敗 → localStorageを使用:', e);
            // 黙って古いデータを出すと、最新だと思って操作されてしまうため知らせる
            if (FCOjima.UI && FCOjima.UI.showAlert) {
                FCOjima.UI.showAlert('サーバーから最新のデータを読み込めませんでした。端末に残っている古いデータを表示しています（このままでは保存できません）。電波の良い所で再読み込みしてください', 'warning', 10000);
            }
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

    // 添付ファイルの自動削除（イベント終了後30日で掃除。マネージャーのみ・1日1回）
    var profile = FCOjima.Auth && FCOjima.Auth.currentUserProfile;
    // ※ イベント一覧をFirestoreから読めたときだけ実行する。オフライン等で端末内の古い一覧に
    //   フォールバックした場合、一覧にない（＝削除済みと誤認した）まだ先のイベントの添付まで消しうる
    if (FCOjima.Hub._loadedFromFirestore &&
        profile && ['admin', 'coach', 'assist', 'officer'].includes(profile.role) &&
        FCOjima.EventFiles && FCOjima.EventFiles.cleanupOldFiles) {
        FCOjima.EventFiles.cleanupOldFiles(FCOjima.Hub.events);
    }
    // 3か月より古い連絡事項の掃除（ほかの人の連絡を消せる人・管理者だけ。1日1回）
    if (FCOjima.Hub._loadedFromFirestore && FCOjima.Auth && FCOjima.Auth.can && FCOjima.Auth.can('notices_delete')
        && FCOjima.DB && FCOjima.DB.cleanupOldNotifications) {
        var cleanKey = 'fcojima_notice_cleanup_day';
        var today = FCOjima.Utils.formatDate(new Date());
        var last = null;
        try { last = localStorage.getItem(cleanKey); } catch (e) {}
        if (last !== today) {
            try { localStorage.setItem(cleanKey, today); } catch (e) {}
            FCOjima.DB.cleanupOldNotifications(FCOjima.Auth.isAdmin()).catch(function(e) { console.warn('古い連絡事項の掃除に失敗:', e); });
        }
    }

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
            // オフライン中の端末キャッシュ由来のスナップショットは、一覧の差し替えにも保存時の
            // 差分判定の基準にも使わない（再接続後にサーバーからのスナップショットが届く）
            if (snapshot.metadata && snapshot.metadata.fromCache) return;
            var events = snapshot.docs.map(function(doc) {
                var d = doc.data(); d.id = doc.id;
                return (FCOjima.DB && FCOjima.DB.normalizeEvent) ? FCOjima.DB.normalizeEvent(d) : d;
            });
            // 保存時の差分判定の基準も最新に揃える（他の人の変更を古い内容で上書きしないため）
            if (FCOjima.DB && FCOjima.DB.rememberSnapshot) FCOjima.DB.rememberSnapshot('events', snapshot);
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

/**
 * イベントの当番割り当てを返す（当番表機能が無効・未割り当てなら null）。
 * 割り当て（dutyAssignments）には割り当てた時点のグループ名も保存されているが、
 * その後グループ名を変えても古い名前のまま表示され、グループを削除しても
 * 「当番: （削除したグループ）」が残っていた。表示名は現在のグループから引く
 * @param {string|number} eventId
 * @returns {{eventId:string, groupId:string, groupName:string}|null}
 */
FCOjima.Hub.getDutyAssignment = function(eventId) {
    if (!FCOjima.Hub.dutyEnabled) return null;
    var a = (FCOjima.Hub.dutyAssignments || []).find(function(x) { return String(x.eventId) === String(eventId); });
    if (!a) return null;
    var groups = FCOjima.Hub.dutyGroups || [];
    var g = groups.find(function(x) { return String(x.id) === String(a.groupId); });
    if (!g) return null; // グループが削除済み
    return { eventId: String(a.eventId), groupId: String(a.groupId), groupName: g.name };
};

FCOjima.Hub.openLogsModal = function(type) {
    const logs = FCOjima.Hub.logs || [];
    const filtered = type ? logs.filter(l => l.type === type) : logs;
    const logsContent = document.getElementById('logs-content');
    if (!logsContent) return;
    const logsTitle = document.querySelector('#logs-modal h2');
    if (logsTitle) logsTitle.textContent = '操作ログ';

    // ログを消せるのは管理者だけ（Firestore のルール）。1件ずつの「削除」と、この種類のログをまとめて消すボタン
    const isAdmin = !!(FCOjima.Auth && FCOjima.Auth.isAdmin && FCOjima.Auth.isAdmin());
    const esc = function(s) { return FCOjima.UI ? FCOjima.UI.escapeHTML(s) : s; };
    if (filtered.length === 0) {
        logsContent.innerHTML = '<p>ログがありません。</p>';
    } else {
        logsContent.innerHTML = filtered.slice().reverse().slice(0, 50).map(function(log) {
            const dt = new Date(log.datetime).toLocaleString('ja-JP');
            return `<div class="log-item">
                <span class="log-time">${esc(dt)}</span>
                <span class="log-user">${esc(log.user)}</span>
                <span class="log-action">${esc(log.action)}</span>
                <span class="log-details">${esc(log.details)}</span>
                ${isAdmin ? `<button type="button" class="log-delete" data-id="${esc(String(log.id || ''))}" aria-label="このログを削除">削除</button>` : ''}
            </div>`;
        }).join('');
    }
    if (isAdmin) {
        const tools = document.createElement('div');
        tools.className = 'log-admin-tools';
        tools.innerHTML = '<button type="button" class="delete-button log-delete-all">' +
            (type ? 'この種類のログをすべて削除' : 'すべてのログを削除') + '</button>' +
            '<p class="log-admin-note">ログを削除できるのは管理者だけです（3か月より前の分も消えます）</p>';
        logsContent.appendChild(tools);
        logsContent.querySelectorAll('.log-delete').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const id = btn.dataset.id;
                if (!id || !FCOjima.UI.showConfirm('このログを削除しますか？')) return;
                btn.disabled = true;
                FCOjima.DB.deleteLogs([id]).then(function() {
                    FCOjima.Hub._removeLogs(function(l) { return String(l.id) === id; });
                    FCOjima.Hub.openLogsModal(type);
                }).catch(function(e) {
                    btn.disabled = false;
                    FCOjima.UI.showAlert('ログを削除できませんでした: ' + e.message, 'error', 6000);
                });
            });
        });
        tools.querySelector('.log-delete-all').addEventListener('click', function() {
            if (!FCOjima.UI.showConfirm((type ? 'この種類のログ' : 'すべてのログ') + 'を削除しますか？（元に戻せません）')) return;
            this.disabled = true;
            FCOjima.DB.deleteAllLogs(type || null).then(function(n) {
                FCOjima.Hub._removeLogs(function(l) { return !type || l.type === type; });
                FCOjima.UI.showAlert(n + '件のログを削除しました', 'success');
                FCOjima.Hub.openLogsModal(type);
            }).catch(function(e) {
                FCOjima.UI.showAlert('ログを削除できませんでした: ' + e.message, 'error', 6000);
                FCOjima.Hub.openLogsModal(type);
            });
        });
    }

    if (FCOjima.UI && FCOjima.UI.openModal) FCOjima.UI.openModal('logs-modal');
};

/** 手元のログ（画面・端末）から消す */
FCOjima.Hub._removeLogs = function(match) {
    FCOjima.Hub.logs = (FCOjima.Hub.logs || []).filter(function(l) { return !match(l); });
    if (FCOjima.Storage && FCOjima.Storage.saveLogs) FCOjima.Storage.saveLogs(FCOjima.Hub.logs);
};
