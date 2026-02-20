/**

 * FC尾島ジュニア - 連絡事項管理機能
 * 連絡事項の表示、追加、削除、フィルタリング、LINE共有機能
 */

// 名前空間の確保

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Notifications = FCOjima.Hub.Notifications || {};


// 連絡事項管理モジュール
(function () {
    const Notifications = FCOjima.Hub.Notifications;
    const Storage = FCOjima.Storage;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;

    // データ管理
    let notifications = [];
    let filteredNotifications = [];
    let logs = [];

    // 現在の状態
    let currentNotification = null;
    let filterType = 'all';
    let sortOrder = 'desc'; // desc: 新しい順, asc: 古い順

    /**
     * 連絡事項管理の初期化
     */
    Notifications.init = function () {
        // データを読み込み
        notifications = Storage.loadNotifications();
        logs = Storage.loadLogs();

        // 初期データがない場合のサンプルデータ
        if (notifications.length === 0) {
            notifications = createSampleNotifications();
            Storage.saveNotifications(notifications);
        }

        // UI要素の初期化
        setupEventListeners();
        updateDisplay();
        updateStats();

        // モーダルの初期化
        UI.initModals();

        console.log('連絡事項管理機能を初期化しました');
    };

    /**
     * サンプル連絡事項データの作成
     */
    function createSampleNotifications() {
        const now = new Date();
        return [
            {
                id: 1,
                date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1日前
                user: "飯田監督",
                type: "important",
                text: "明日の練習についてのお知らせです。\n雨天の場合は体育館での練習に変更となります。\n\n集合時間: 9:00\n場所: 尾島体育館\n持ち物: 室内シューズ",
                createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 2,
                date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2日前
                user: "田中コーチ",
                type: "event",
                text: "来週の試合のユニフォームについて\n\nホーム戦のため、白いユニフォームを着用してください。\n忘れた場合は予備をお貸しします。",
                createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 3,
                date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3日前
                user: "佐藤保護者会長",
                type: "schedule",
                text: "保護者会のお知らせ\n\n日時: 4月15日（土）19:00〜\n場所: 尾島公民館 第1会議室\n議題: 新年度の活動計画について",
                createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    /**
     * イベントリスナーの設定
     */
    function setupEventListeners() {
        // 連絡事項追加ボタン
        document.getElementById('add-notification').addEventListener('click', function () {
            openNotificationModal();
        });

        // タイプフィルター
        document.getElementById('notification-type-filter').addEventListener('change', function (e) {
            filterType = e.target.value;
            filterNotifications();
        });

        // ソート順切り替え
        document.getElementById('sort-order').addEventListener('change', function (e) {
            sortOrder = e.target.value;
            filterNotifications();
        });

        // 全件削除ボタン
        document.getElementById('clear-notifications').addEventListener('click', function () {
            if (confirm('すべての連絡事項を削除しますか？この操作は取り消せません。')) {
                clearAllNotifications();
            }
        });

        // エクスポートボタン
        document.getElementById('export-notifications').addEventListener('click', function (e) {
            e.stopPropagation();
            const exportOptions = document.getElementById('export-options');
            exportOptions.classList.toggle('show');
        });

        // エクスポートオプション
        document.getElementById('export-csv').addEventListener('click', exportAsCSV);
        document.getElementById('export-text').addEventListener('click', exportAsText);

        // ログ表示ボタン
        document.getElementById('show-logs').addEventListener('click', openLogsModal);

        // 連絡事項フォーム送信
        document.getElementById('notification-form').addEventListener('submit', function (e) {
            e.preventDefault();
            saveNotification();
        });

        // 外部クリックでエクスポートメニューを閉じる
        document.addEventListener('click', function (e) {
            const exportOptions = document.getElementById('export-options');
            if (!e.target.closest('#export-notifications') && !e.target.closest('#export-options')) {
                exportOptions.classList.remove('show');
            }
        });
    }

    /**
     * 連絡事項の検索とフィルタリング
     */
    function filterNotifications() {
        filteredNotifications = notifications.filter(notification => {
            return filterType === 'all' || notification.type === filterType;
        });

        // ソート
        filteredNotifications.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);

            if (sortOrder === 'desc') {
                return dateB - dateA; // 新しい順
            } else {
                return dateA - dateB; // 古い順
            }
        });

        updateDisplay();
    }

    /**
     * 表示の更新
     */
    function updateDisplay() {
        const container = document.getElementById('notifications-container');

        if (!filteredNotifications.length) {
            filteredNotifications = notifications;
            filterNotifications();
        }

        if (filteredNotifications.length === 0) {
            container.innerHTML = '<div class="no-data">連絡事項がありません</div>';
            return;
        }

        let html = '';
        filteredNotifications.forEach(notification => {
            const isRecent = isRecentNotification(notification.date);

            html += `
                <div class="notification-item ${isRecent ? 'recent' : ''}" data-notification-id="${notification.id}">
                    <div class="notification-header">
                        <div class="notification-meta">
                            <span class="notification-date">${Utils.formatDateTime(notification.date)}</span>
                            <span class="notification-user">${Utils.escapeHTML(notification.user)}</span>
                            <span class="notification-type notification-type-${notification.type}">${getTypeLabel(notification.type)}</span>
                            ${isRecent ? '<span class="recent-badge">NEW</span>' : ''}
                        </div>
                        <div class="notification-actions">
                            <button type="button" onclick="FCOjima.Hub.Notifications.shareToLine(${notification.id})" 
                                    class="share-button">
                                LINE共有
                            </button>
                            <button type="button" onclick="FCOjima.Hub.Notifications.deleteNotification(${notification.id})" 
                                    class="delete-button">
                                削除
                            </button>
                        </div>
                    </div>
                    <div class="notification-content">
                        ${Utils.escapeHTML(notification.text).replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * 統計情報の更新
     */
    function updateStats() {
        const stats = {
            total: notifications.length,
            important: notifications.filter(n => n.type === 'important').length,
            event: notifications.filter(n => n.type === 'event').length,
            schedule: notifications.filter(n => n.type === 'schedule').length,
            info: notifications.filter(n => n.type === 'info').length
        };

        document.getElementById('total-notifications').textContent = stats.total;
        document.getElementById('important-count').textContent = stats.important;
        document.getElementById('event-count').textContent = stats.event;
        document.getElementById('schedule-count').textContent = stats.schedule;
        document.getElementById('info-count').textContent = stats.info;
    }

    /**
     * 連絡事項タイプのラベルを取得
     */
    function getTypeLabel(type) {
        const labels = {
            important: '重要',
            event: 'イベント',
            schedule: '日程',
            info: '連絡'
        };
        return labels[type] || '連絡';
    }

    /**
     * 最新の連絡事項かどうかを判定（24時間以内）
     */
    function isRecentNotification(dateString) {
        const notificationDate = new Date(dateString);
        const now = new Date();
        const diffInHours = (now - notificationDate) / (1000 * 60 * 60);
        return diffInHours <= 24;
    }

    /**
     * 連絡事項モーダルを開く
     */
    function openNotificationModal() {
        const modal = document.getElementById('notification-modal');
        const form = document.getElementById('notification-form');

        // フォームをリセット
        form.reset();

        // 現在の日時を設定
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 16);
        document.getElementById('notification-date').value = dateStr;

        UI.openModal('notification-modal');
    }

    /**
     * 連絡事項を保存
     */
    function saveNotification() {
        const form = document.getElementById('notification-form');
        const formData = new FormData(form);

        const notificationData = {
            date: formData.get('date'),
            user: formData.get('user').trim(),
            type: formData.get('type'),
            text: formData.get('text').trim()
        };

        // バリデーション
        if (!notificationData.user) {
            UI.showAlert('error', '投稿者名を入力してください');
            return;
        }

        if (!notificationData.text) {
            UI.showAlert('error', '連絡内容を入力してください');
            return;
        }

        try {
            // 新規追加
            const newNotification = {
                id: Date.now(),
                ...notificationData,
                createdAt: new Date().toISOString()
            };

            notifications.unshift(newNotification); // 先頭に追加

            // データを保存
            Storage.saveNotifications(notifications);

            // ログを記録
            const logMessage = `連絡事項を投稿しました（${getTypeLabel(notificationData.type)}）`;
            Utils.addLog('notifications', logMessage, `投稿者: ${notificationData.user}`);

            // 表示を更新
            filterNotifications();
            updateStats();

            // モーダルを閉じる
            UI.closeModal('notification-modal');

            // 成功メッセージ
            UI.showAlert('success', '連絡事項を投稿しました');

        } catch (error) {
            console.error('連絡事項保存エラー:', error);
            UI.showAlert('error', '連絡事項の保存に失敗しました');
        }
    }

    /**
     * 連絡事項を削除
     */
    function deleteNotification(notificationId) {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) return;

        if (!confirm('この連絡事項を削除しますか？')) {
            return;
        }

        try {
            // 連絡事項を削除
            notifications = notifications.filter(n => n.id !== notificationId);

            // データを保存
            Storage.saveNotifications(notifications);

            // ログを記録
            const logMessage = `連絡事項を削除しました（${getTypeLabel(notification.type)}）`;
            Utils.addLog('notifications', logMessage, `投稿者: ${notification.user}`);

            // 表示を更新
            filterNotifications();
            updateStats();

            // 成功メッセージ
            UI.showAlert('success', '連絡事項を削除しました');

        } catch (error) {
            console.error('連絡事項削除エラー:', error);
            UI.showAlert('error', '連絡事項の削除に失敗しました');
        }
    }

    /**
     * すべての連絡事項を削除
     */
    function clearAllNotifications() {
        try {
            const count = notifications.length;
            notifications = [];

            // データを保存
            Storage.saveNotifications(notifications);

            // ログを記録
            Utils.addLog('notifications', `すべての連絡事項を削除しました（${count}件）`);

            // 表示を更新
            filterNotifications();
            updateStats();

            // 成功メッセージ
            UI.showAlert('success', `${count}件の連絡事項を削除しました`);

        } catch (error) {
            console.error('全件削除エラー:', error);
            UI.showAlert('error', '連絡事項の削除に失敗しました');
        }
    }

    /**
     * LINEに共有
     */
    function shareToLine(notificationId) {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) return;

        try {
            const shareText = `【FC尾島ジュニア - ${getTypeLabel(notification.type)}】\n` +
                `${Utils.formatDateTime(notification.date)}\n` +
                `投稿者: ${notification.user}\n\n` +
                `${notification.text}`;

            const encodedText = encodeURIComponent(shareText);
            const lineUrl = `https://line.me/R/msg/text/?${encodedText}`;

            window.open(lineUrl, '_blank');

            // ログを記録
            Utils.addLog('notifications', `連絡事項をLINEで共有しました`, `タイプ: ${getTypeLabel(notification.type)}`);

        } catch (error) {
            console.error('LINE共有エラー:', error);
            UI.showAlert('error', 'LINE共有に失敗しました');
        }
    }

    /**
     * CSV形式でエクスポート
     */
    function exportAsCSV() {
        try {
            const headers = ['日時', '投稿者', 'タイプ', '内容', '作成日'];
            const csvData = [headers];

            notifications.forEach(notification => {
                csvData.push([
                    Utils.formatDateTime(notification.date),
                    notification.user,
                    getTypeLabel(notification.type),
                    notification.text.replace(/\n/g, ' '), // 改行を除去
                    Utils.formatDate(notification.createdAt)
                ]);
            });

            const csvContent = csvData.map(row =>
                row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
            ).join('\n');

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `FC尾島ジュニア_連絡事項_${Utils.formatDate(new Date())}.csv`;
            link.click();

            document.getElementById('export-options').classList.remove('show');
            UI.showAlert('success', 'CSVファイルをダウンロードしました');

        } catch (error) {
            console.error('CSV エクスポートエラー:', error);
            UI.showAlert('error', 'CSVエクスポートに失敗しました');
        }
    }

    /**
     * テキスト形式でエクスポート
     */
    function exportAsText() {
        try {
            let textContent = 'FC尾島ジュニア 連絡事項一覧\n';
            textContent += `エクスポート日時: ${Utils.formatDateTime(new Date())}\n`;
            textContent += '=' * 50 + '\n\n';

            notifications.forEach((notification, index) => {
                textContent += `${index + 1}. [${getTypeLabel(notification.type)}] ${Utils.formatDateTime(notification.date)}\n`;
                textContent += `投稿者: ${notification.user}\n`;
                textContent += `内容:\n${notification.text}\n`;
                textContent += '-' * 30 + '\n\n';
            });

            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `FC尾島ジュニア_連絡事項_${Utils.formatDate(new Date())}.txt`;
            link.click();

            document.getElementById('export-options').classList.remove('show');
            UI.showAlert('success', 'テキストファイルをダウンロードしました');

        } catch (error) {
            console.error('テキスト エクスポートエラー:', error);
            UI.showAlert('error', 'テキストエクスポートに失敗しました');
        }
    }

    /**
     * ログモーダルを開く
     */
    function openLogsModal() {
        const content = document.getElementById('logs-content');
        const notificationLogs = logs.filter(log => log.module === 'notifications');

        if (notificationLogs.length === 0) {
            content.innerHTML = '<div class="no-data">まだログがありません</div>';
        } else {
            let html = '<div class="logs-list">';

            notificationLogs.reverse().forEach(log => {
                html += `
                    <div class="log-item">
                        <div class="log-header">
                            <span class="log-date">${Utils.formatDateTime(log.timestamp)}</span>
                            <span class="log-user">${Utils.escapeHTML(log.user || '不明')}</span>
                        </div>
                        <div class="log-content">
                            ${Utils.escapeHTML(log.message)}
                            ${log.details ? ` - ${Utils.escapeHTML(log.details)}` : ''}
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            content.innerHTML = html;
        }

        UI.openModal('logs-modal');
    }

    // 外部から呼び出し可能な関数をエクスポート
    Notifications.openNotificationModal = openNotificationModal;
    Notifications.deleteNotification = deleteNotification;
    Notifications.shareToLine = shareToLine;
    Notifications.updateDisplay = updateDisplay;
    Notifications.openLogsModal = openLogsModal;

})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function () {
    FCOjima.Hub.Notifications.init();
});

