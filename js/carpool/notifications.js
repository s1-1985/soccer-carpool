/**
 * FC尾島ジュニア - 連絡タブの機能
 * 連絡事項管理に関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * 連絡事項を更新
 */
FCOjima.Carpool.Notifications.updateNotifications = function() {
    console.log('連絡事項を更新しています...');
    
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) {
        console.log('連絡事項リストが見つかりません');
        return;
    }
    
    const notifications = FCOjima.Carpool.appData.notifications || [];
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = FCOjima.UI.createAlert('info', '連絡事項はありません。');
        console.log('連絡事項がありません');
        return;
    }
    
    notificationsList.innerHTML = '';
    
    // 日付の新しい順にソート
    const sortedNotifications = [...notifications].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
    
    // 連絡事項を表示
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
            <button type="button" class="secondary-button" onclick="FCOjima.Carpool.Notifications.shareNotification(${index})">共有</button>
            <button type="button" class="delete-button" onclick="FCOjima.Carpool.Notifications.deleteNotification(${index})">削除</button>
        `;
        
        notificationDiv.appendChild(notificationContent);
        notificationDiv.appendChild(actionButtons);
        notificationsList.appendChild(notificationDiv);
    });
    
    console.log('連絡事項の更新が完了しました');
};

/**
 * 連絡事項の送信
 */
FCOjima.Carpool.Notifications.sendNotification = function() {
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
        minute: '2-digit'
    });
    
    // 新しい通知を追加
    const notifications = FCOjima.Carpool.appData.notifications || [];
    
    notifications.unshift({
        date: `${formattedDate} ${formattedTime}`,
        text: text,
        type: 'info',
        user: 'システム' // ログイン機能実装までのダミーユーザー
    });
    
    // データを保存
    FCOjima.Carpool.appData.notifications = notifications;
    FCOjima.Carpool.saveData();
    
    // UI更新
    this.updateNotifications();
    
    // フォームリセット
    document.getElementById('notificationText').value = '';
    
    console.log('連絡事項を送信しました');
    FCOjima.UI.showAlert('連絡事項を送信しました');
};

/**
 * 連絡事項の共有
 * @param {number} index - 連絡事項のインデックス
 */
FCOjima.Carpool.Notifications.shareNotification = function(index) {
    console.log(`連絡事項を共有します: インデックス=${index}`);
    
    const notifications = FCOjima.Carpool.appData.notifications || [];
    
    if (!notifications[index]) {
        console.log('指定された連絡事項が見つかりません');
        return;
    }
    
    const notification = notifications[index];
    
    // イベント情報を取得
    const event = FCOjima.Storage.getSelectedEvent();
    
    // 共有メッセージを生成
    let message = '【連絡事項】\n';
    
    if (event) {
        message += `${FCOjima.Utils.formatDateForDisplay(event.date)} ${event.title}\n\n`;
    }
    
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
FCOjima.Carpool.Notifications.deleteNotification = function(index) {
    console.log(`連絡事項を削除します: インデックス=${index}`);
    
    const notifications = FCOjima.Carpool.appData.notifications || [];
    
    if (!notifications[index]) {
        console.log('指定された連絡事項が見つかりません');
        return;
    }
    
    if (FCOjima.UI.showConfirm('この連絡事項を削除してもよろしいですか？')) {
        // 連絡事項を削除
        notifications.splice(index, 1);
        
        // データを保存
        FCOjima.Carpool.appData.notifications = notifications;
        FCOjima.Carpool.saveData();
        
        // UI更新
        this.updateNotifications();
        
        console.log('連絡事項を削除しました');
    } else {
        console.log('連絡事項の削除がキャンセルされました');
    }
};