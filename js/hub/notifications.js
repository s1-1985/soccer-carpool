/**
 * FC尾島ジュニア - 連絡事項管理（Hub.Notifications）
 * カテゴリなし・ログ付き版
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Notifications = FCOjima.Hub.Notifications || {};

(function(app) {
    var Notifications = app.Hub.Notifications;
    var UI = app.UI;
    var Storage = app.Storage;

    Notifications.init = function() {
        console.log('連絡事項機能を初期化しています...');
        this.setupEventListeners();
        this.renderNotifications();
        console.log('連絡事項機能の初期化が完了しました');
    };

    Notifications.setupEventListeners = function() {
        // 送信ボタン
        var sendBtn = document.getElementById('send-notification');
        if (sendBtn) {
            sendBtn.addEventListener('click', function() {
                Notifications.sendNotification();
            });
        }

        // ログ表示ボタン
        var logsBtn = document.getElementById('notifications-logs');
        if (logsBtn) {
            logsBtn.addEventListener('click', function() {
                app.Hub.openLogsModal('notifications');
            });
        }
    };

    Notifications.renderNotifications = function() {
        var listEl = document.getElementById('notificationsList');
        if (!listEl) return;

        var notifications = app.Hub.notifications || [];

        if (notifications.length === 0) {
            listEl.innerHTML = UI.createAlert('info', '連絡事項はありません。');
            return;
        }

        listEl.innerHTML = '';
        var sorted = notifications.slice().sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });

        sorted.forEach(function(n, i) {
            var div = document.createElement('div');
            div.className = 'notification-card';

            var dateStr = n.date || '';
            var userStr = n.user ? UI.escapeHTML(n.user) : '';
            var textStr = UI.escapeHTML(n.text || '').replace(/\n/g, '<br>');

            div.innerHTML =
                '<div class="notification-header">' +
                    '<div class="notification-date">' + dateStr + '</div>' +
                    '<div class="notification-author">' + userStr + '</div>' +
                '</div>' +
                '<div class="notification-content">' + textStr + '</div>' +
                '<div class="notification-actions">' +
                    '<button type="button" class="secondary-button" data-action="share" data-index="' + i + '">LINEで共有</button>' +
                    '<button type="button" class="delete-button" data-action="delete" data-index="' + i + '">削除</button>' +
                '</div>';

            listEl.appendChild(div);
        });

        listEl.querySelectorAll('button[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var action = this.dataset.action;
                var index = parseInt(this.dataset.index);
                if (action === 'share') {
                    Notifications.shareNotification(index);
                } else if (action === 'delete') {
                    Notifications.deleteNotification(index);
                }
            });
        });
    };

    Notifications.sendNotification = function() {
        var textEl = document.getElementById('notificationText');
        var text = textEl ? textEl.value.trim() : '';

        if (!text) {
            UI.showAlert('連絡内容を入力してください', 'warning');
            return;
        }

        var now = new Date();
        var dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
                      ' ' + now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        var user = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : 'システム';

        var newItem = { date: dateStr, text: text, user: user };

        app.Hub.notifications = app.Hub.notifications || [];
        app.Hub.notifications.unshift(newItem);

        // ログ記録
        app.Hub.logs = Storage.addLog('notifications', '連絡事項追加', '「' + text.substring(0, 30) + '」', app.Hub.logs);

        Storage.saveNotifications(app.Hub.notifications);
        this.renderNotifications();

        if (textEl) textEl.value = '';
        UI.showAlert('連絡事項を送信しました', 'success');
    };

    Notifications.shareNotification = function(index) {
        var notifications = app.Hub.notifications || [];
        var n = notifications[index];
        if (!n) return;

        var url = window.location.origin + '/hub/index.html';
        var message = '【FC 尾島ジュニア 連絡事項】\n' + (n.date || '') + '\n\n' + (n.text || '') + '\n\n' + url;

        var copied = false;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(message).then(function() {
                UI.showAlert('クリップボードにコピーしました', 'success');
            });
            copied = true;
        }

        var lineUrl = 'https://line.me/R/msg/text/?' + encodeURIComponent(message);
        if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
            window.location.href = lineUrl;
        } else if (!copied) {
            UI.showAlert('共有テキストを準備しました。LINEなどに貼り付けてください。', 'info');
        }
    };

    Notifications.deleteNotification = function(index) {
        var notifications = app.Hub.notifications || [];
        var n = notifications[index];
        if (!n) return;

        if (!UI.showConfirm('この連絡事項を削除してもよろしいですか？')) return;

        var user = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : 'システム';
        app.Hub.logs = Storage.addLog('notifications', '連絡事項削除', '「' + (n.text || '').substring(0, 30) + '」', app.Hub.logs);

        notifications.splice(index, 1);
        app.Hub.notifications = notifications;
        Storage.saveNotifications(notifications);
        this.renderNotifications();
        UI.showAlert('連絡事項を削除しました', 'success');
    };

})(window.FCOjima);
