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
            console.log('Firestoreからデータをロードしました');
        } catch (e) {
            console.warn('Firestoreロード失敗 → localStorageを使用:', e);
            FCOjima.Hub.members       = FCOjima.Storage.loadMembers();
            FCOjima.Hub.venues        = FCOjima.Storage.loadVenues();
            FCOjima.Hub.events        = FCOjima.Storage.loadEvents();
            FCOjima.Hub.notifications = FCOjima.Storage.loadNotifications();
            FCOjima.Hub.logs          = FCOjima.Storage.loadLogs();
        }
    } else {
        FCOjima.Hub.members       = FCOjima.Storage.loadMembers();
        FCOjima.Hub.venues        = FCOjima.Storage.loadVenues();
        FCOjima.Hub.events        = FCOjima.Storage.loadEvents();
        FCOjima.Hub.notifications = FCOjima.Storage.loadNotifications();
        FCOjima.Hub.logs          = FCOjima.Storage.loadLogs();
    }

    // 現在の日付を設定
    FCOjima.Hub.currentDate = new Date();

    // 各タブを初期化
    if (FCOjima.Hub.Calendar && FCOjima.Hub.Calendar.init)       FCOjima.Hub.Calendar.init();
    if (FCOjima.Hub.Members   && FCOjima.Hub.Members.init)       FCOjima.Hub.Members.init();
    if (FCOjima.Hub.Notifications && FCOjima.Hub.Notifications.init) FCOjima.Hub.Notifications.init();
    if (FCOjima.Hub.Venues    && FCOjima.Hub.Venues.init)        FCOjima.Hub.Venues.init();

    console.log('HUB 初期化完了');
};

FCOjima.Hub.openLogsModal = function(type) {
    const logs = FCOjima.Hub.logs || [];
    const filtered = type ? logs.filter(l => l.type === type) : logs;
    const logsContent = document.getElementById('logs-content');
    if (!logsContent) return;

    if (filtered.length === 0) {
        logsContent.innerHTML = '<p>ログがありません。</p>';
    } else {
        logsContent.innerHTML = filtered.slice(0, 50).map(function(log) {
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
