/**
 * FC尾島ジュニア - 連絡事項タブの機能
 * 連絡事項の管理に関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

// 連絡事項データ（グローバル変数）
FCOjima.Hub.notifications = [];

/**
 * 連絡事項の初期化
 */
FCOjima.Hub.Notifications.init = function() {
    // 連絡事項データの読み込み
    this.loadNotifications();
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    // 連絡事項の表示
    this.renderNotifications();
};

/**
 * 連絡事項データの読み込み
 */
FCOjima.Hub.Notifications.loadNotifications = function() {
    const savedNotifications = localStorage.getItem(`${FCOjima.Storage.PREFIX}notifications`);
    FCOjima.Hub.notifications = savedNotifications ? JSON.parse(savedNotifications) : [];
};

/**
 * 連絡事項データの保存
 */
FCOjima.Hub.Notifications.saveNotifications = function() {
    localStorage.setItem(`${FCOjima.Storage.PREFIX}notifications`, JSON.stringify(FCOjima.Hub.notifications));
};

/**
 * イベントリスナーの設定
 */
FCOjima.Hub.Notifications.setupEventListeners = function() {
    // 連絡事項送信ボタンのイベントリスナー
    const sendButton = document.querySelector('#notificationForm button');
    if (sendButton) {
        sendButton.addEventListener('click', () => {
            this.sendNotification();
        });
    }
};

/**
 * 連絡事項の表示
 */
FCOjima.Hub.Notifications.renderNotifications = function() {
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;
    
    if (FCOjima.Hub.notifications.length === 0) {
        notificationsList.innerHTML = FCOjima.UI.createAlert('info', '連絡事項はありません。');
        return;
    }
    
    notificationsList.innerHTML = '';
    
    // 日付の新しい順に表示
    const sortedNotifications = [...FCOjima.Hub.notifications].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
    
    sortedNotifications.forEach((notification, index) => {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `alert ${notification.type || 'info'}`;
        
        const notificationContent = document.createElement('div');
        notificationContent.innerHTML = `
            <div><strong>${notification.date}</strong> ${notification.user ? ` - ${FCOjima.UI.escapeHTML(notification.user)}` : ''}</div>
            <div>${FCOjima.UI.escapeHTML(notification.text)}</div>
        `;
        
        const actionButtons = document.createElement('div');
        actionButtons.className = 'notification-actions';
        actionButtons.innerHTML = `
            <button type="button" class="secondary-button" onclick="FCOjima.Hub.Notifications.shareNotification(${index})">共有</button>
            <button type="button" class="delete-button" onclick="FCOjima.Hub.Notifications.deleteNotification(${index})">削除</button>
        `;
        
        notificationDiv.appendChild(notificationContent);
        notificationDiv.appendChild(actionButtons);
        notificationsList.appendChild(notificationDiv);
    });
};

/**
 * 連絡事項の送信
 */
FCOjima.Hub.Notifications.sendNotification = function() {
    const text = document.getElementById('notificationText').value;
    
    if (!text) {
        FCOjima.UI.showAlert('連絡内容を入力してください');
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
    FCOjima.Hub.notifications.unshift({
        date: `${formattedDate} ${formattedTime}`,
        text: text,
        type: 'info',
        user: 'システム' // ログイン機能実装までのダミーユーザー
    });
    
    // 保存とUI更新
    this.saveNotifications();
    this.renderNotifications();
    
    // フォームリセット
    document.getElementById('notificationText').value = '';
    
    FCOjima.UI.showAlert('連絡事項を送信しました');
};

/**
 * 連絡事項の共有
 * @param {number} index - 連絡事項のインデックス
 */
FCOjima.Hub.Notifications.shareNotification = function(index) {
    if (!FCOjima.Hub.notifications[index]) return;
    
    const notification = FCOjima.Hub.notifications[index];
    
    // 共有メッセージを生成
    let message = '【連絡事項】\n';
    message += `${notification.date}\n\n`;
    message += notification.text;
    
    // テキストをクリップボードにコピー
    if (FCOjima.Utils.copyToClipboard(message)) {
        FCOjima.UI.showAlert('連絡事項をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
        
        // LINEでの共有（モバイルのみ）
        if (FCOjima.Utils.shareViaLINE(message)) {
            FCOjima.UI.showAlert('LINEでの共有を開始しました');
        }
    } else {
        FCOjima.UI.showAlert('クリップボードへのコピーに失敗しました');
    }
};

/**
 * 連絡事項の削除
 * @param {number} index - 連絡事項のインデックス
 */
FCOjima.Hub.Notifications.deleteNotification = function(index) {
    if (!FCOjima.Hub.notifications[index]) return;
    
    if (FCOjima.UI.showConfirm('この連絡事項を削除してもよろしいですか？')) {
        FCOjima.Hub.notifications.splice(index, 1);
        
        // 保存とUI更新
        this.saveNotifications();
        this.renderNotifications();
    }
};