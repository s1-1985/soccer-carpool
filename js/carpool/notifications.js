/**
 * FC尾島ジュニア - 連絡タブの機能（続き）
 * 連絡事項管理に関する機能を提供
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Notifications = FCOjima.Carpool.Notifications || {};

// 連絡タブモジュール
(function() {
    // 名前空間のショートカット
    const Notifications = FCOjima.Carpool.Notifications;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;

    /**
     * 連絡機能の初期化
     */
    Notifications.init = function() {
        console.log('連絡機能を初期化しています...');
        this.setupEventListeners();
        this.updateNotifications();
        console.log('連絡機能の初期化が完了しました');
    };

    /**
     * イベントリスナーの設定
     */
    Notifications.setupEventListeners = function() {
        var sendBtn = document.getElementById('send-notification');
        if (sendBtn) {
            sendBtn.addEventListener('click', function() { Notifications.sendNotification(); });
        }
        var shareLatestBtn = document.getElementById('share-latest-notification');
        if (shareLatestBtn) {
            shareLatestBtn.addEventListener('click', function() { Notifications.shareLatestNotification(); });
        }
    };

    /**
     * 連絡事項リストを描画
     */
    Notifications.updateNotifications = function() {
        console.log('連絡事項を更新します...');
        var listEl = document.getElementById('notificationsList');
        if (!listEl) return;

        var notifications = FCOjima.Carpool.appData.notifications || [];

        if (notifications.length === 0) {
            listEl.innerHTML = UI.createAlert('info', '連絡事項はありません。');
            return;
        }

        listEl.innerHTML = '';
        var sorted = notifications.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

        sorted.forEach(function(notification, index) {
            var div = document.createElement('div');
            div.className = 'notification-card ' + (notification.type || 'info');

            var header = document.createElement('div');
            header.className = 'notification-header';
            header.innerHTML = '<div class="notification-date">' + notification.date + '</div>' +
                '<div class="notification-author">' + (notification.user ? UI.escapeHTML(notification.user) : '') + '</div>';

            var content = document.createElement('div');
            content.className = 'notification-content';
            content.innerHTML = UI.escapeHTML(notification.text).replace(/\n/g, '<br>');

            var actions = document.createElement('div');
            actions.className = 'notification-actions';
            actions.innerHTML = '<button type="button" class="secondary-button share-notification" data-index="' + index + '">共有</button>' +
                '<button type="button" class="delete-button delete-notification" data-index="' + index + '">削除</button>';

            div.appendChild(header);
            div.appendChild(content);
            div.appendChild(actions);
            listEl.appendChild(div);
        });

        listEl.querySelectorAll('.share-notification').forEach(function(btn) {
            btn.addEventListener('click', function() { Notifications.shareNotification(parseInt(btn.dataset.index)); });
        });
        listEl.querySelectorAll('.delete-notification').forEach(function(btn) {
            btn.addEventListener('click', function() { Notifications.deleteNotification(parseInt(btn.dataset.index)); });
        });

        console.log('連絡事項の更新が完了しました');
    };

    /**
     * 連絡事項を送信
     */
    Notifications.sendNotification = function() {
        console.log('連絡事項を送信します...');
        var textEl = document.getElementById('notificationText');
        var typeEl = document.getElementById('notification-type');
        var text = textEl ? textEl.value.trim() : '';
        var type = typeEl ? typeEl.value : 'info';

        if (!text) {
            UI.showAlert('連絡内容を入力してください');
            return;
        }

        var now = new Date();
        var date = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
                   ' ' + now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        var notifications = FCOjima.Carpool.appData.notifications || [];
        notifications.unshift({ date: date, text: text, type: type, user: 'システム' });
        FCOjima.Carpool.appData.notifications = notifications;
        FCOjima.Carpool.saveData();
        this.updateNotifications();

        if (textEl) textEl.value = '';
        UI.showAlert('連絡事項を送信しました');
        console.log('連絡事項を送信しました');
    };

    /**
     * 最新の連絡事項を共有
     */
    Notifications.shareLatestNotification = function() {
        var notifications = FCOjima.Carpool.appData.notifications || [];
        if (notifications.length === 0) {
            UI.showAlert('共有する連絡事項がありません');
            return;
        }
        this.shareNotification(0);
    };

    /**
     * 特定の連絡事項を共有
     * @param {number} index
     */
    Notifications.shareNotification = function(index) {
        var notifications = FCOjima.Carpool.appData.notifications || [];
        var notification = notifications[index];
        if (!notification) return;

        var message = '【連絡事項】\n' + notification.date + '\n\n' + notification.text;

        if (Utils && Utils.copyToClipboard && Utils.copyToClipboard(message)) {
            UI.showAlert('連絡事項をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
            if (Utils.shareViaLINE) Utils.shareViaLINE(message);
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
    };

    /**
     * 連絡事項を削除
     * @param {number} index
     */
    Notifications.deleteNotification = function(index) {
        if (!UI.showConfirm('この連絡事項を削除してもよろしいですか？')) return;
        var notifications = FCOjima.Carpool.appData.notifications || [];
        notifications.splice(index, 1);
        FCOjima.Carpool.appData.notifications = notifications;
        FCOjima.Carpool.saveData();
        this.updateNotifications();
        console.log('連絡事項を削除しました');
    };

    /**
     * すべての連絡事項を共有（続き）
     */
    Notifications.shareAllNotifications = function() {
        console.log('すべての連絡事項を共有しています...');
        
        console.log('すべての連絡事項の共有が完了しました');
    };
    
    /**
     * 連絡事項を一括削除
     */
    Notifications.deleteAllNotifications = function() {
        console.log('すべての連絡事項を削除します...');
        
        const notifications = FCOjima.Carpool.appData.notifications || [];
        
        if (notifications.length === 0) {
            UI.showAlert('削除する連絡事項がありません');
            return;
        }
        
        if (UI.showConfirm(`連絡事項を全て削除してもよろしいですか？（${notifications.length}件）`)) {
            // 連絡事項をクリア
            FCOjima.Carpool.appData.notifications = [];
            FCOjima.Carpool.saveData();
            
            // UI更新
            this.updateNotifications();
            
            UI.showAlert('すべての連絡事項を削除しました');
            console.log('すべての連絡事項を削除しました');
        } else {
            console.log('連絡事項の一括削除がキャンセルされました');
        }
    };
    
    /**
     * 配車完了連絡を作成
     */
    Notifications.createAssignmentNotification = function() {
        console.log('配車完了連絡を作成します...');
        
        const event = FCOjima.Storage.getSelectedEvent();
        const assignments = FCOjima.Carpool.appData.assignments || [];
        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        
        if (!event) {
            UI.showAlert('イベント情報が見つかりません');
            return;
        }
        
        if (assignments.length === 0) {
            UI.showAlert('配車情報が設定されていません');
            return;
        }
        
        // メッセージを生成
        let message = '【配車のお知らせ】\n';
        message += Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        
        // 出発情報
        if (event.departureTime) {
            message += `出発時間: ${event.departureTime}\n`;
        }
        
        if (event.meetingPlace) {
            message += `集合場所: ${event.meetingPlace}\n`;
        }
        
        message += '\n【配車内容】\n';
        
        // 配車情報を整理
        assignments.forEach((assignment, carIndex) => {
            const car = carRegistrations[assignment.carIndex];
            if (!car) return;
            
            message += `■ ${car.parent}さんの車\n`;
            
            // 乗車メンバーを集計
            const passengers = [];
            
            // 座席タイプごとに乗車メンバーを取得
            Object.keys(assignment.seats).forEach(seatType => {
                Object.values(assignment.seats[seatType]).forEach(passengerName => {
                    if (passengerName && passengerName !== car.parent) {
                        passengers.push(passengerName);
                    }
                });
            });
            
            if (passengers.length > 0) {
                message += `  乗車: ${passengers.join(', ')}\n`;
            } else {
                message += `  乗車: なし\n`;
            }
            
            message += '\n';
        });
        
        message += '以上、ご確認ください。';
        
        // テキストエリアに設定
        document.getElementById('notificationText').value = message;
        
        UI.showAlert('配車完了連絡を作成しました。内容を確認して「送信」ボタンをクリックしてください。');
        console.log('配車完了連絡を作成しました');
    };
    
    /**
     * LINEへの最適化表示
     * @param {string} text - 元のテキスト
     * @returns {string} LINE用に最適化されたテキスト
     */
    Notifications.optimizeForLINE = function(text) {
        if (!text) return '';
        
        // 1. 改行を適切に調整（3つ以上の連続した改行を2つにする）
        let optimized = text.replace(/\n{3,}/g, '\n\n');
        
        // 2. 長い行を分割（LINEでは1行が長すぎると読みにくい）
        const MAX_LINE_LENGTH = 40; // 日本語の場合は40文字程度が目安
        const lines = optimized.split('\n');
        
        const wrappedLines = lines.map(line => {
            if (line.length <= MAX_LINE_LENGTH) return line;
            
            // 長い行を適切な位置で分割
            let wrappedLine = '';
            let currentLength = 0;
            
            // 文章を単語や句読点で区切って処理
            const segments = line.split(/([、。．，．：；\s])/);
            
            segments.forEach(segment => {
                if (currentLength + segment.length > MAX_LINE_LENGTH) {
                    wrappedLine += '\n' + segment;
                    currentLength = segment.length;
                } else {
                    wrappedLine += segment;
                    currentLength += segment.length;
                }
            });
            
            return wrappedLine;
        });
        
        return wrappedLines.join('\n');
    };
    
    /**
     * 連絡事項をエクスポート
     */
    Notifications.exportNotifications = function() {
        console.log('連絡事項をエクスポートします...');
        
        const notifications = FCOjima.Carpool.appData.notifications || [];
        
        if (notifications.length === 0) {
            UI.showAlert('エクスポートする連絡事項がありません');
            return;
        }
        
        // イベント情報を取得
        const event = FCOjima.Storage.getSelectedEvent();
        let filename = 'fc-ojima-notifications';
        
        if (event) {
            filename = `連絡事項_${event.date}_${event.title}`;
        }
        
        // 連絡事項をテキスト形式に変換
        let textContent = '# FC尾島ジュニア 連絡事項\n\n';
        
        if (event) {
            textContent += `イベント: ${event.title}\n`;
            textContent += `日付: ${Utils.formatDateForDisplay(event.date)}\n\n`;
        }
        
        // 日付の新しい順にソート
        const sortedNotifications = [...notifications].sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });
        
        sortedNotifications.forEach((notification, index) => {
            textContent += `## ${index + 1}. ${notification.date}\n\n`;
            textContent += `${notification.text}\n\n`;
            
            if (notification.user) {
                textContent += `(投稿者: ${notification.user})\n\n`;
            }
            
            textContent += '---\n\n';
        });
        
        // テキストファイルとしてダウンロード
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        UI.showAlert('連絡事項をテキストファイルにエクスポートしました');
        console.log('連絡事項のエクスポートが完了しました');
    };
    
    /**
     * 連絡事項検索
     * @param {string} keyword - 検索キーワード
     */
    Notifications.searchNotifications = function(keyword) {
        console.log(`連絡事項を検索します: "${keyword}"`);
        
        if (!keyword) {
            this.updateNotifications(); // キーワードがなければ全て表示
            return;
        }
        
        const notificationsList = document.getElementById('notificationsList');
        if (!notificationsList) {
            return;
        }
        
        const notifications = FCOjima.Carpool.appData.notifications || [];
        
        if (notifications.length === 0) {
            notificationsList.innerHTML = UI.createAlert('info', '連絡事項はありません。');
            return;
        }
        
        // キーワードを含む連絡事項を検索
        const filteredNotifications = notifications.filter(notification => {
            return notification.text.includes(keyword) || 
                   notification.date.includes(keyword) || 
                   (notification.user && notification.user.includes(keyword));
        });
        
        if (filteredNotifications.length === 0) {
            notificationsList.innerHTML = UI.createAlert('info', `"${keyword}" を含む連絡事項は見つかりませんでした。`);
            return;
        }
        
        notificationsList.innerHTML = '';
        
        // 日付の新しい順にソート
        const sortedNotifications = filteredNotifications.sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
        });
        
        // 検索結果ヘッダー
        const searchHeader = document.createElement('div');
        searchHeader.className = 'search-header';
        searchHeader.innerHTML = `"${keyword}" の検索結果: ${filteredNotifications.length}件`;
        notificationsList.appendChild(searchHeader);
        
        // 検索結果を表示
        sortedNotifications.forEach((notification, index) => {
            const notificationDiv = document.createElement('div');
            notificationDiv.className = 'notification-card ' + (notification.type || 'info');
            
            // 検索キーワードをハイライト表示
            const highlightedText = UI.escapeHTML(notification.text).replace(
                new RegExp(keyword, 'gi'),
                match => `<span class="highlight">${match}</span>`
            );
            
            const notificationContent = document.createElement('div');
            notificationContent.innerHTML = '\
                <div class="notification-header">\
                    <div class="notification-date">' + notification.date.replace(
                        new RegExp(keyword, 'gi'),
                        match => `<span class="highlight">${match}</span>`
                    ) + '</div>\
                    <div class="notification-author">' + 
                        (notification.user ? UI.escapeHTML(notification.user).replace(
                            new RegExp(keyword, 'gi'),
                            match => `<span class="highlight">${match}</span>`
                        ) : '') + 
                    '</div>\
                </div>\
                <div class="notification-content">' + 
                    highlightedText.replace(/\n/g, '<br>') + 
                '</div>';
            
            const actionButtons = document.createElement('div');
            actionButtons.className = 'notification-actions';
            actionButtons.innerHTML = '\
                <button type="button" class="secondary-button share-notification" data-index="' + 
                notifications.indexOf(notification) + '">共有</button>\
                <button type="button" class="delete-button delete-notification" data-index="' + 
                notifications.indexOf(notification) + '">削除</button>';
            
            notificationDiv.appendChild(notificationContent);
            notificationDiv.appendChild(actionButtons);
            notificationsList.appendChild(notificationDiv);
        });
        
        // ボタンにイベントリスナーを設定
        const shareButtons = notificationsList.querySelectorAll('.share-notification');
        const deleteButtons = notificationsList.querySelectorAll('.delete-notification');
        
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
        
        console.log(`連絡事項の検索が完了しました: ${filteredNotifications.length}件見つかりました`);
    };
})();