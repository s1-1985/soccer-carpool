/**
 * FC尾島ジュニア - 連絡事項管理
 * 連絡事項の管理に関する機能を提供
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Notifications = FCOjima.Hub.Notifications || {};

// 連絡事項管理モジュール
(function(app) {
    const Notifications = app.Hub.Notifications;

    /**
     * 連絡事項の初期化
     */
    Notifications.init = function() {
        console.log('連絡事項機能を初期化しています...');
        this.setupEventListeners();
        this.renderNotifications();
        console.log('連絡事項機能の初期化が完了しました');
    };

    /**
     * イベントリスナーの設定
     */
    Notifications.setupEventListeners = function() {
        console.log('連絡事項のイベントリスナーを設定します...');

        const filterItems = document.querySelectorAll('.notification-filter-item');
        if (filterItems.length > 0) {
            filterItems.forEach(item => {
                item.addEventListener('click', () => {
                    filterItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    this.filterNotifications(item.dataset.filter);
                });
            });
        }

        const sendBtn = document.getElementById('send-notification');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendNotification());
        }

        const notifLogsBtn = document.getElementById('notifications-logs');
        if (notifLogsBtn) {
            notifLogsBtn.addEventListener('click', () => app.Hub.openLogsModal('notifications'));
        }

        console.log('連絡事項のイベントリスナー設定が完了しました');
    };

    /**
     * 連絡事項の表示
     */
    Notifications.renderNotifications = function() {
        console.log('連絡事項を表示します...');

        const notificationsList = document.getElementById('notificationsList');
        if (!notificationsList) {
            console.log('連絡事項リスト要素が見つかりません');
            return;
        }

        const notifications = app.Hub.notifications || [];
        const UI = app.UI;

        if (notifications.length === 0) {
            notificationsList.innerHTML = UI ? UI.createAlert('info', '連絡事項はありません。') : '<p>連絡事項はありません。</p>';
            console.log('連絡事項がありません');
            return;
        }

        notificationsList.innerHTML = '';

        const sortedNotifications = [...notifications].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });

        sortedNotifications.forEach((notification, index) => {
            const notificationDiv = document.createElement('div');
            notificationDiv.className = `notification-card ${notification.type || 'info'}`;

            const notificationHeader = document.createElement('div');
            notificationHeader.className = 'notification-header';
            notificationHeader.innerHTML = `
                <div class="notification-date">${notification.date}</div>
                <div class="notification-author">${notification.user && UI ? UI.escapeHTML(notification.user) : (notification.user || '')}</div>
            `;

            const notificationContent = document.createElement('div');
            notificationContent.className = 'notification-content';
            const escapedText = UI ? UI.escapeHTML(notification.text) : notification.text;
            notificationContent.innerHTML = escapedText.replace(/\n/g, '<br>');

            const actionButtons = document.createElement('div');
            actionButtons.className = 'notification-actions';
            actionButtons.innerHTML = `
                <button type="button" class="secondary-button share-notification" data-index="${index}">共有</button>
                <button type="button" class="delete-button delete-notification" data-index="${index}">削除</button>
            `;

            notificationDiv.appendChild(notificationHeader);
            notificationDiv.appendChild(notificationContent);
            notificationDiv.appendChild(actionButtons);
            notificationsList.appendChild(notificationDiv);
        });

        notificationsList.querySelectorAll('.share-notification').forEach(button => {
            button.addEventListener('click', () => {
                this.shareNotification(parseInt(button.dataset.index));
            });
        });

        notificationsList.querySelectorAll('.delete-notification').forEach(button => {
            button.addEventListener('click', () => {
                this.deleteNotification(parseInt(button.dataset.index));
            });
        });

        console.log('連絡事項の表示が完了しました');
    };

    /**
     * 連絡事項のフィルタリング
     * @param {string} filter - フィルターの種類（'all', 'important', 'event', 'schedule'）
     */
    Notifications.filterNotifications = function(filter) {
        console.log(`連絡事項をフィルタリングします: ${filter}`);

        const cards = document.querySelectorAll('.notification-card');

        if (filter === 'all') {
            cards.forEach(card => { card.style.display = 'block'; });
            return;
        }

        cards.forEach(card => {
            card.style.display = card.classList.contains(filter) ? 'block' : 'none';
        });
    };

    /**
     * 連絡事項の送信
     */
    Notifications.sendNotification = function() {
        console.log('連絡事項を送信します...');

        const textEl = document.getElementById('notificationText');
        const categoryEl = document.getElementById('notification-category');
        const UI = app.UI;
        const Storage = app.Storage;

        const text = textEl ? textEl.value.trim() : '';
        const category = categoryEl ? categoryEl.value : 'info';

        if (!text) {
            if (UI) UI.showAlert('連絡内容を入力してください');
            console.log('連絡内容が未入力です');
            return;
        }

        const now = new Date();
        const formattedDate = now.toLocaleDateString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
        const formattedTime = now.toLocaleTimeString('ja-JP', {
            hour: '2-digit', minute: '2-digit'
        });

        const userName = (app.Auth) ? app.Auth.getDisplayName() : 'システム';
        app.Hub.notifications = app.Hub.notifications || [];
        app.Hub.notifications.unshift({
            date: `${formattedDate} ${formattedTime}`,
            text: text,
            type: category,
            user: userName
        });

        if (Storage && Storage.saveNotifications) Storage.saveNotifications(app.Hub.notifications);
        app.Hub.logs = app.Storage.addLog('notifications', '連絡事項追加', text.substring(0, 30) + (text.length > 30 ? '...' : ''), app.Hub.logs);
        this.renderNotifications();

        if (textEl) textEl.value = '';
        if (UI) UI.showAlert('連絡事項を送信しました');
        console.log('連絡事項を送信しました');
    };

    /**
     * 連絡事項の共有
     * @param {number} index - 連絡事項のインデックス
     */
    Notifications.shareNotification = function(index) {
        console.log(`連絡事項を共有します: インデックス=${index}`);

        const notifications = app.Hub.notifications || [];
        const notification = notifications[index];
        const UI = app.UI;
        const Utils = app.Utils;

        if (!notification) {
            console.log('指定された連絡事項が見つかりません');
            return;
        }

        let message = '【連絡事項】\n';
        message += `${notification.date}\n\n`;
        message += notification.text;

        if (Utils && Utils.copyToClipboard && Utils.copyToClipboard(message)) {
            if (UI) UI.showAlert('連絡事項をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
            if (Utils.shareViaLINE) Utils.shareViaLINE(message);
        } else {
            if (UI) UI.showAlert('クリップボードへのコピーに失敗しました');
        }

        console.log('連絡事項の共有が完了しました');
    };

    /**
     * 連絡事項の削除
     * @param {number} index - 連絡事項のインデックス
     */
    Notifications.deleteNotification = function(index) {
        console.log(`連絡事項を削除します: インデックス=${index}`);

        const notifications = app.Hub.notifications || [];
        const notification = notifications[index];
        const UI = app.UI;
        const Storage = app.Storage;

        if (!notification) {
            console.log('指定された連絡事項が見つかりません');
            return;
        }

        if (!UI || UI.showConfirm('この連絡事項を削除してもよろしいですか？')) {
            const deletedText = notification.text ? notification.text.substring(0, 30) : '';
            app.Hub.notifications.splice(index, 1);
            if (Storage && Storage.saveNotifications) Storage.saveNotifications(app.Hub.notifications);
            app.Hub.logs = app.Storage.addLog('notifications', '連絡事項削除', deletedText, app.Hub.logs);
            this.renderNotifications();
            console.log('連絡事項を削除しました');
        } else {
            console.log('連絡事項の削除がキャンセルされました');
        }
    };

})(window.FCOjima);
