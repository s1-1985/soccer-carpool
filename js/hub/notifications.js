/**
 * FC尾島ジュニア - 連絡事項管理
 * 連絡事項の管理に関する機能を提供
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Notifications = FCOjima.Notifications || {};

// 連絡事項管理モジュール
(function() {
    // 名前空間のショートカット
    const Notifications = FCOjima.Notifications;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;
    const Storage = FCOjima.Storage;
    
    /**
     * 連絡事項の初期化
     */
    Notifications.init = function() {
        console.log('連絡事項機能を初期化しています...');
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        // 連絡事項の表示
        this.renderNotifications();
        
        console.log('連絡事項機能の初期化が完了しました');
    };
    
    /**
     * イベントリスナーの設定
     */
    Notifications.setupEventListeners = function() {
        console.log('連絡事項のイベントリスナーを設定します...');
        
        // 連絡事項フィルターのイベントリスナー
        const filterItems = document.querySelectorAll('.notification-filter-item');
        if (filterItems.length > 0) {
            filterItems.forEach(item => {
                item.addEventListener('click', () => {
                    // すべてのフィルターからactiveを削除
                    filterItems.forEach(i => i.classList.remove('active'));
                    // クリックされたフィルターにactiveを追加
                    item.classList.add('active');
                    // フィルタリング
                    this.filterNotifications(item.dataset.filter);
                });
            });
        }
        
        console.log('連絡事項のイベントリスナー設定が完了しました');
    };
    
    /**
     * 連絡事項の表示
     * 問題14: HUBの連絡事項表示機能の修正
     */
    Notifications.renderNotifications = function() {
        console.log('連絡事項を表示します...');
        
        const notificationsList = document.getElementById('notificationsList');
        if (!notificationsList) {
            console.log('連絡事項リスト要素が見つかりません');
            return;
        }
        
        if (FCOjima.notifications.length === 0) {
            notificationsList.innerHTML = UI.createAlert('info', '連絡事項はありません。');
            console.log('連絡事項がありません');
            return;
        }
        
        notificationsList.innerHTML = '';
        
        // 日付の新しい順に表示
        const sortedNotifications = [...FCOjima.notifications].sort((a, b) => {
            // 日付文字列からDateオブジェクトを作成して比較
            return new Date(b.date) - new Date(a.date);
        });
        
        sortedNotifications.forEach((notification, index) => {
            const notificationDiv = document.createElement('div');
            notificationDiv.className = `notification-card ${notification.type || 'info'}`;
            
            // 投稿者と日時を表示
            const notificationHeader = document.createElement('div');
            notificationHeader.className = 'notification-header';
            notificationHeader.innerHTML = `
                <div class="notification-date">${notification.date}</div>
                <div class="notification-author">${notification.user ? UI.escapeHTML(notification.user) : ''}</div>
            `;
            
            // 内容を表示
            const notificationContent = document.createElement('div');
            notificationContent.className = 'notification-content';
            notificationContent.innerHTML = UI.escapeHTML(notification.text).replace(/\n/g, '<br>');
            
            // アクションボタンを表示
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
        
        // ボタンにイベントリスナーを設定
        const shareButtons = notificationsList.querySelectorAll('.share-notification');
        const deleteButtons = notificationsList.querySelectorAll('.delete-notification');
        
        shareButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.shareNotification(parseInt(button.dataset.index));
            });
        });
        
        deleteButtons.forEach(button => {
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
        
        // すべて表示
        if (filter === 'all') {
            cards.forEach(card => {
                card.style.display = 'block';
            });
            return;
        }
        
        // フィルターに一致するものだけ表示
        cards.forEach(card => {
            if (card.classList.contains(filter)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    };
    
    /**
     * 連絡事項の送信
     * 問題14: HUBの連絡事項機能の修正
     */
    Notifications.sendNotification = function() {
        console.log('連絡事項を送信します...');
        
        const text = document.getElementById('notificationText').value;
        const category = document.getElementById('notification-category') ? 
                        document.getElementById('notification-category').value : 'info';
        
        if (!text) {
            UI.showAlert('連絡内容を入力してください');
            console.log('連絡内容が未入力です');
            return;
        }
        
        // 現在日時
        const now = new Date();
        const formattedDate = now.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const formattedTime = now.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 新しい通知を追加
        FCOjima.notifications.unshift({
            date: `${formattedDate} ${formattedTime}`,
            text: text,
            type: category,
            user: 'システム' // ログイン機能実装までのダミーユーザー
        });
        
        // 保存とUI更新
        Storage.saveNotifications(FCOjima.notifications);
        this.renderNotifications();
        
        // フォームリセット
        document.getElementById('notificationText').value = '';
        
        UI.showAlert('連絡事項を送信しました');
        console.log('連絡事項を送信しました');
    };
    
    /**
     * 連絡事項の共有
     * @param {number} index - 連絡事項のインデックス
     */
    Notifications.shareNotification = function(index) {
        console.log(`連絡事項を共有します: インデックス=${index}`);
        
        const notification = FCOjima.notifications[index];
        if (!notification) {
            console.log('指定された連絡事項が見つかりません');
            return;
        }
        
        // 共有メッセージを生成
        let message = '【連絡事項】\n';
        message += `${notification.date}\n\n`;
        message += notification.text;
        
        // テキストをクリップボードにコピー
        if (Utils.copyToClipboard(message)) {
            UI.showAlert('連絡事項をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
            
            // LINEでの共有（モバイルのみ）
            if (Utils.shareViaLINE(message)) {
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
        console.log(`連絡事項を削除します: インデックス=${index}`);
        
        const notification = FCOjima.notifications[index];
        if (!notification) {
            console.log('指定された連絡事項が見つかりません');
            return;
        }
        
        if (UI.showConfirm('この連絡事項を削除してもよろしいですか？')) {
            FCOjima.notifications.splice(index, 1);
            
            // 保存とUI更新
            Storage.saveNotifications(FCOjima.notifications);
            this.renderNotifications();
            
            console.log('連絡事項を削除しました');
        } else {
            console.log('連絡事項の削除がキャンセルされました');
        }
    };
})();