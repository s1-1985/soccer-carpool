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
    console.log('連絡事項機能を初期化しています...');
    
    // 連絡事項データの読み込み
    this.loadNotifications();
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    // 連絡事項の表示
    this.renderNotifications();
    
    console.log('連絡事項機能の初期化が完了しました');
};

/**
 * 連絡事項データの読み込み
 */
FCOjima.Hub.Notifications.loadNotifications = function() {
    console.log('連絡事項データを読み込んでいます...');
    FCOjima.Hub.notifications = FCOjima.Storage.loadNotifications();
    console.log(`連絡事項データを読み込みました: ${FCOjima.Hub.notifications.length}件`);
};

/**
 * 連絡事項データの保存
 */
FCOjima.Hub.Notifications.saveNotifications = function() {
    console.log('連絡事項データを保存します...');
    FCOjima.Storage.saveNotifications(FCOjima.Hub.notifications);
    console.log('連絡事項データを保存しました');
};

/**
 * イベントリスナーの設定
 */
FCOjima.Hub.Notifications.setupEventListeners = function() {
    console.log('連絡事項のイベントリスナーを設定します...');
    
    // 連絡事項送信ボタンのイベントリスナー
    const sendButton = document.getElementById('send-notification');
    if (sendButton) {
        sendButton.addEventListener('click', () => {
            this.sendNotification();
        });
    }
    
    console.log('連絡事項のイベントリスナー設定が完了しました');
};

/**
 * 連絡事項の表示
 * 問題14: HUBの連絡事項表示機能の修正
 */
FCOjima.Hub.Notifications.renderNotifications = function() {
    console.log('連絡事項を表示します...');
    
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) {
        console.log('連絡事項リスト要素が見つかりません');
        return;
    }
    
    if (FCOjima.Hub.notifications.length === 0) {
        notificationsList.innerHTML = FCOjima.UI.createAlert('info', '連絡事項はありません。');
        console.log('連絡事項がありません');
        return;
    }
    
    notificationsList.innerHTML = '';
    
    // 日付の新しい順に表示
    const sortedNotifications = [...FCOjima.Hub.notifications].sort((a, b) => {
        // 日付文字列からDateオブジェクトを作成して比較
        return new Date(b.date) - new Date(a.date);
    });
    
    sortedNotifications.forEach((notification, index) => {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `alert ${notification.type || 'info'}`;
        
        // 投稿者と日時を表示
        const notificationHeader = document.createElement('div');
        notificationHeader.className = 'notification-header';
        notificationHeader.innerHTML = `
            <strong>${notification.date}</strong> ${notification.user ? ` - ${FCOjima.UI.escapeHTML(notification.user)}` : ''}
        `;
        
        // 内容を表示
        const notificationContent = document.createElement('div');
        notificationContent.className = 'notification-content';
        notificationContent.innerHTML = FCOjima.UI.escapeHTML(notification.text).replace(/\n/g, '<br>');
        
        // アクションボタンを表示
        const actionButtons = document.createElement('div');
        actionButtons.className = 'notification-actions';
        actionButtons.innerHTML = `
            <button type="button" class="secondary-button" onclick="FCOjima.Hub.Notifications.shareNotification(${index})">共有</button>
            <button type="button" class="delete-button" onclick="FCOjima.Hub.Notifications.deleteNotification(${index})">削除</button>
        `;
        
        notificationDiv.appendChild(notificationHeader);
        notificationDiv.appendChild(notificationContent);
        notificationDiv.appendChild(actionButtons);
        notificationsList.appendChild(notificationDiv);
    });
    
    console.log('連絡事項の表示が完了しました');
};

/**
 * 連絡事項の送信
 * 問題14: HUBの連絡事項機能の修正
 */
FCOjima.Hub.Notifications.sendNotification = function() {
    console.log('連絡事項を送信します...');
    
    const text = document.getElementById('notificationText').value;
    
    if (!text) {
        FCOjima.UI.showAlert('連絡内容を入力してください');
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
        minute: '2-digit',
        second: '2-digit'
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
    console.log('連絡事項を送信しました');
};

/**
 * 連絡事項の共有
 * @param {number} index - 連絡事項のインデックス
 */
FCOjima.Hub.Notifications.shareNotification = function(index) {
    console.log(`連絡事項を共有します: インデックス=${index}`);
    
    const notification = FCOjima.Hub.notifications[index];
    if (!notification) {
        console.log('指定された連絡事項が見つかりません');
        return;
    }
    
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
    
    console.log('連絡事項の共有が完了しました');
};

/**
 * 連絡事項の削除
 * @param {number} index - 連絡事項のインデックス
 */
FCOjima.Hub.Notifications.deleteNotification = function(index) {
    console.log(`連絡事項を削除します: インデックス=${index}`);
    
    const notification = FCOjima.Hub.notifications[index];
    if (!notification) {
        console.log('指定された連絡事項が見つかりません');
        return;
    }
    
    if (FCOjima.UI.showConfirm('この連絡事項を削除してもよろしいですか？')) {
        FCOjima.Hub.notifications.splice(index, 1);
        
        // 保存とUI更新
        this.saveNotifications();
        this.renderNotifications();
        
        console.log('連絡事項を削除しました');
    } else {
        console.log('連絡事項の削除がキャンセルされました');
    }
};