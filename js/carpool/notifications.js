/**
 * FC尾島ジュニア - 連絡タブの機能
 * 連絡事項管理に関する機能を提供
 */

(function(app) {
    // 名前空間のショートカット
    var Notifications = app.Carpool.Notifications;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;
    
    /**
     * 連絡事項を更新
     */
    Notifications.updateNotifications = function() {
        console.log('連絡事項を更新しています...');
        
        var notificationsList = document.getElementById('notificationsList');
        if (!notificationsList) {
            console.log('連絡事項リストが見つかりません');
            return;
        }
        
        var notifications = app.Carpool.appData.notifications || [];
        
        if (notifications.length === 0) {
            notificationsList.innerHTML = UI.createAlert('info', '連絡事項はありません。');
            console.log('連絡事項がありません');
            return;
        }
        
        notificationsList.innerHTML = '';
        
        // 日付の新しい順にソート
        var sortedNotifications = notifications.sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });
        
        // 連絡事項を表示
        sortedNotifications.forEach(function(notification, index) {
            var notificationDiv = document.createElement('div');
            notificationDiv.className = 'alert ' + (notification.type || 'info');
            
            var notificationContent = document.createElement('div');
            notificationContent.innerHTML = '\
                <div class="notification-header">\
                    <strong>' + notification.date + '</strong> ' + 
                    (notification.user ? ' - ' + UI.escapeHTML(notification.user) : '') + '\
                </div>\
                <div class="notification-content">' + 
                    UI.escapeHTML(notification.text).replace(/\n/g, '<br>') + 
                '</div>';
            
            var actionButtons = document.createElement('div');
            actionButtons.className = 'notification-actions';
            actionButtons.innerHTML = '\
                <button type="button" class="secondary-button share-notification" data-index="' + index + '">共有</button>\
                <button type="button" class="delete-button delete-notification" data-index="' + index + '">削除</button>';
            
            notificationDiv.appendChild(notificationContent);
            notificationDiv.appendChild(actionButtons);
            notificationsList.appendChild(notificationDiv);
        });
        
        // ボタンにイベントリスナーを設定
        var shareButtons = notificationsList.querySelectorAll('.share-notification');
        var deleteButtons = notificationsList.querySelectorAll('.delete-notification');
        
        shareButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                Notifications.shareNotification(parseInt(this.dataset.index));
            });
        });
        
        deleteButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                Notifications.deleteNotification(parseInt(this.dataset.index));
            });
        });
        
        console.log('連絡事項の更新が完了しました');
    };
    
    /**
     * 連絡事項の送信
     * 問題7: carpoolで連絡機能が動作しない - 修正
     */
    Notifications.sendNotification = function() {
        console.log('連絡事項を送信します...');
        
        var text = document.getElementById('notificationText').value;
        
        if (!text) {
            UI.showAlert('連絡内容を入力してください');
            console.log('連絡内容が未入力です');
            return;
        }
        
        // 現在日時
        var now = new Date();
        var formattedDate = now.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        var formattedTime = now.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 新しい通知を追加
        var notifications = app.Carpool.appData.notifications || [];
        
        var newNotification = {
            date: formattedDate + ' ' + formattedTime,
            text: text,
            type: 'info',
            user: 'システム' // ログイン機能実装までのダミーユーザー
        };
        
        notifications.unshift(newNotification);
        
        // データを保存
        app.Carpool.appData.notifications = notifications;
        app.Carpool.saveData();
        
        // UI更新
        this.updateNotifications();
        
        // フォームリセット
        document.getElementById('notificationText').value = '';
        
        console.log('連絡事項を送信しました');
        UI.showAlert('連絡事項を送信しました');
    };
    
    /**
     * 連絡事項の共有
     * @param {number} index - 連絡事項のインデックス
     */
    Notifications.shareNotification = function(index) {
        console.log('連絡事項を共有します: インデックス=' + index);
        
        var notifications = app.Carpool.appData.notifications || [];
        
        if (!notifications[index]) {
            console.log('指定された連絡事項が見つかりません');
            return;
        }
        
        var notification = notifications[index];
        
        // イベント情報を取得
        var event = Storage.getSelectedEvent();
        
        // 共有メッセージを生成
        var message = '【連絡事項】\n';
        
        if (event) {
            message += Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        }
        
        message += notification.date + '\n\n';
        message += notification.text;
        
        // テキストをクリップボードにコピー
        if (Utils.copyToClipboard(message)) {
            UI.showAlert('連絡事項をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
            
            // LINEでの共有（モバイルのみ）
            if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                var encodedMessage = encodeURIComponent(message);
                window.open('https://line.me/R/msg/text/?' + encodedMessage, '_blank');
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
        
        console.log('連絡事項の共有が完了しました');
    };
    
    /**
     * 連絡事項の削除
     * @param {number} index - 連絡事項のインデックス
     */
    Notifications.deleteNotification = function(index) {
        console.log('連絡事項を削除します: インデックス=' + index);
        
        var notifications = app.Carpool.appData.notifications || [];
        
        if (!notifications[index]) {
            console.log('指定された連絡事項が見つかりません');
            return;
        }
        
        if (UI.showConfirm('この連絡事項を削除してもよろしいですか？')) {
            // 連絡事項を削除
            notifications.splice(index, 1);
            
            // データを保存
            app.Carpool.appData.notifications = notifications;
            app.Carpool.saveData();
            
            // UI更新
            this.updateNotifications();
            
            console.log('連絡事項を削除しました');
        } else {
            console.log('連絡事項の削除がキャンセルされました');
        }
    };
    
})(window.FCOjima);