/**
 * FC尾島ジュニア - 配車連絡機能（Firebase版）
 * 配車情報の共有、テンプレート生成、LINE連携機能
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Notifications = FCOjima.Carpool.Notifications || {};

// 配車連絡モジュール
(function () {
    const Notifications = FCOjima.Carpool.Notifications;
    const Firestore = FCOjima.Firestore;
    const Auth = FCOjima.Auth;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;

    // データ
    let currentEvent = null;
    let attendanceData = {};
    let carsData = [];
    let assignmentData = {};
    let notificationsData = [];
    let carpoolData = null;
    let membersData = [];
    let carpoolUnsubscribe = null;
    let membersUnsubscribe = null;

    // テンプレート設定
    const MESSAGE_TEMPLATES = {
        complete: {
            name: '配車完了通知',
            template: `【配車情報】

{eventTitle}
📅 {eventDate} {eventTime}
📍 {eventVenue}

{carAssignments}

■連絡事項
{notes}

何かご不明な点がございましたら、お気軽にお声かけください。`
        },
        reminder: {
            name: '配車リマインド',
            template: `【配車リマインド】

{eventTitle}
📅 {eventDate} {eventTime}
📍 {eventVenue}

{carAssignments}

■お願い
・集合時間の5分前にはお越しください
・車のナンバーや色をご確認ください
・忘れ物がないようにご注意ください

よろしくお願いいたします。`
        },
        changes: {
            name: '配車変更通知',
            template: `【配車変更のお知らせ】

{eventTitle}
📅 {eventDate} {eventTime}

配車に変更がありましたのでお知らせします。

{carAssignments}

変更にご理解のほど、よろしくお願いいたします。`
        },
        individual: {
            name: '個別通知',
            template: `【{memberName}さんへ】

{eventTitle}の配車情報をお知らせします。

📅 {eventDate} {eventTime}
🚗 {driverName}の車
🪑 {seatPosition}
📞 {driverPhone}

集合場所や時間についてご不明な点がございましたら、{driverName}さん（{driverPhone}）までご連絡ください。`
        }
    };

    /**
     * 配車連絡機能の初期化
     */
    Notifications.init = async function () {
        try {
            // 認証チェック
            if (!Auth.isLoggedIn()) {
                console.warn('未ログインユーザーです');
                UI.showAlert('ログインが必要です', 'warning');
                window.location.href = '../auth/login.html';
                return;
            }

            // セッションからイベントIDを取得
            const selectedEventId = sessionStorage.getItem('fc-ojima-selected-event');
            if (!selectedEventId) {
                UI.showAlert('イベントが選択されていません', 'warning');
                window.location.href = 'index.html';
                return;
            }

            // イベント情報を取得
            currentEvent = await Firestore.getDocument('events', selectedEventId);
            if (!currentEvent) {
                UI.showAlert('指定されたイベントが見つかりません', 'danger');
                window.location.href = 'index.html';
                return;
            }

            // データをリアルタイム監視で読み込み
            setupRealtimeListeners();

            // UI要素の初期化
            setupEventListeners();
            updateEventInfo();
            updateDisplay();

            // モーダルの初期化
            if (UI && UI.initModals) {
                UI.initModals();
            }

            console.log('配車連絡機能を初期化しました（Firebase版）');

        } catch (error) {
            console.error('配車連絡初期化エラー:', error);
            UI.showAlert('配車連絡の初期化に失敗しました', 'danger');
        }
    };

    /**
     * リアルタイムリスナーの設定
     */
    function setupRealtimeListeners() {
        // メンバーデータの監視
        membersUnsubscribe = Firestore.watchMembers((updatedMembers) => {
            membersData = updatedMembers.filter(member => member.status === 'active');
            updateDisplay();
        });

        // 配車データのリアルタイム監視
        carpoolUnsubscribe = Firestore.watchCarpoolData(currentEvent.id, (updatedData) => {
            carpoolData = updatedData;
            attendanceData = carpoolData?.attendance || {};
            carsData = carpoolData?.cars || [];
            assignmentData = carpoolData?.assignments || {};
            notificationsData = carpoolData?.notifications || [];
            updateDisplay();
        });
    }

    /**
     * イベントリスナーの設定
     */
    function setupEventListeners() {
        // クイック送信ボタン
        const quickSendBtns = document.querySelectorAll('.quick-send-btn');
        quickSendBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                const templateType = this.dataset.template;
                sendQuickNotification(templateType);
            });
        });

        // カスタムメッセージ作成
        const customMessageBtn = document.getElementById('create-custom-message');
        if (customMessageBtn) {
            customMessageBtn.addEventListener('click', openCustomMessageModal);
        }

        // 個別通知送信
        const individualNotifyBtn = document.getElementById('send-individual');
        if (individualNotifyBtn) {
            individualNotifyBtn.addEventListener('click', openIndividualNotificationModal);
        }

        // メッセージ履歴表示
        const showHistoryBtn = document.getElementById('show-history');
        if (showHistoryBtn) {
            showHistoryBtn.addEventListener('click', showNotificationHistory);
        }

        // テンプレート管理
        const manageTemplatesBtn = document.getElementById('manage-templates');
        if (manageTemplatesBtn) {
            manageTemplatesBtn.addEventListener('click', openTemplateManager);
        }

        // エクスポート機能
        const exportBtn = document.getElementById('export-carpool');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportCarpoolInfo);
        }

        // 配車完了ボタン
        const completeBtn = document.getElementById('complete-carpool');
        if (completeBtn) {
            completeBtn.addEventListener('click', completeCarpoolProcess);
        }

        // 前のステップに戻る
        const prevStepBtn = document.getElementById('prev-step');
        if (prevStepBtn) {
            prevStepBtn.addEventListener('click', () => {
                window.location.href = 'assignments.html';
            });
        }

        // 概要に戻る
        const backToOverviewBtn = document.getElementById('back-to-overview');
        if (backToOverviewBtn) {
            backToOverviewBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        // カスタムメッセージフォーム送信
        const customForm = document.getElementById('custom-message-form');
        if (customForm) {
            customForm.addEventListener('submit', (e) => {
                e.preventDefault();
                sendCustomMessage();
            });
        }

        // 個別通知フォーム送信
        const individualForm = document.getElementById('individual-form');
        if (individualForm) {
            individualForm.addEventListener('submit', (e) => {
                e.preventDefault();
                sendIndividualNotification();
            });
        }
    }

    /**
     * イベント情報を更新
     */
    function updateEventInfo() {
        const eventInfoCard = document.getElementById('event-info');
        if (!eventInfoCard || !currentEvent) return;

        const eventDate = new Date(currentEvent.date);

        eventInfoCard.innerHTML = `
            <div class="event-header">
                <h3>${Utils.escapeHTML(currentEvent.title)}</h3>
                <span class="event-type type-${currentEvent.type}">${getEventTypeLabel(currentEvent.type)}</span>
            </div>
            
            <div class="event-details">
                <div class="event-detail-item">
                    <i class="icon-calendar"></i>
                    <span>${Utils.formatDate(eventDate)} ${currentEvent.time || ''}</span>
                </div>
                
                ${currentEvent.venue ? `
                    <div class="event-detail-item">
                        <i class="icon-location"></i>
                        <span>${Utils.escapeHTML(currentEvent.venue)}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 表示を更新
     */
    function updateDisplay() {
        updateAssignmentSummary();
        updateQuickActions();
        updateNotificationHistory();
        updateProgress();
    }

    /**
     * 配車状況サマリーを更新
     */
    function updateAssignmentSummary() {
        const summaryCard = document.getElementById('assignment-summary');
        if (!summaryCard) return;

        const attendingMembers = getAttendingMembers();
        const assignedCount = getAssignedMembersCount();
        const unassignedCount = attendingMembers.length - assignedCount;

        if (carsData.length === 0) {
            summaryCard.innerHTML = `
                <div class="no-assignment">
                    <h4>配車情報がありません</h4>
                    <p>配車を完了してから連絡機能をご利用ください。</p>
                    <button onclick="window.location.href='assignments.html'" class="btn btn-primary">
                        座席割り当てページへ
                    </button>
                </div>
            `;
            return;
        }

        let html = `
            <h4>配車状況サマリー</h4>
            
            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-number">${assignedCount}</div>
                    <div class="stat-label">配置済み</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${unassignedCount}</div>
                    <div class="stat-label">未配置</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${carsData.length}</div>
                    <div class="stat-label">車両数</div>
                </div>
            </div>
        `;

        if (unassignedCount > 0) {
            html += `
                <div class="alert alert-warning">
                    <strong>注意:</strong> ${unassignedCount}名が未配置です。配車を完了してから連絡を送信してください。
                </div>
            `;
        } else if (assignedCount > 0) {
            html += `
                <div class="alert alert-success">
                    ✅ すべての配車が完了しています。連絡を送信できます。
                </div>
            `;

            // 配車詳細を表示
            html += '<div class="car-assignments-preview">';
            html += generateCarAssignmentsText();
            html += '</div>';
        }

        summaryCard.innerHTML = html;
    }

    /**
     * クイックアクションを更新
     */
    function updateQuickActions() {
        const quickActionsCard = document.getElementById('quick-actions');
        if (!quickActionsCard) return;

        const assignedCount = getAssignedMembersCount();
        const isAssignmentComplete = assignedCount > 0 && getAttendingMembers().length === assignedCount;

        quickActionsCard.innerHTML = `
            <h4>クイック送信</h4>
            
            <div class="quick-actions-grid">
                <button class="btn btn-success quick-send-btn ${!isAssignmentComplete ? 'disabled' : ''}" 
                        data-template="complete"
                        ${!isAssignmentComplete ? 'disabled' : ''}>
                    📋 配車完了通知
                </button>
                
                <button class="btn btn-info quick-send-btn ${!isAssignmentComplete ? 'disabled' : ''}" 
                        data-template="reminder"
                        ${!isAssignmentComplete ? 'disabled' : ''}>
                    ⏰ 配車リマインド
                </button>
                
                <button class="btn btn-warning quick-send-btn ${!isAssignmentComplete ? 'disabled' : ''}" 
                        data-template="changes"
                        ${!isAssignmentComplete ? 'disabled' : ''}>
                    🔄 配車変更通知
                </button>
                
                <button class="btn btn-primary" id="create-custom-message">
                    ✏️ カスタムメッセージ
                </button>
                
                <button class="btn btn-secondary ${!isAssignmentComplete ? 'disabled' : ''}" 
                        id="send-individual"
                        ${!isAssignmentComplete ? 'disabled' : ''}>
                    👤 個別通知
                </button>
                
                <button class="btn btn-info" id="export-carpool">
                    📄 情報エクスポート
                </button>
            </div>
            
            ${!isAssignmentComplete ? `
                <div class="alert alert-info">
                    配車を完了してからクイック送信をご利用ください。
                </div>
            ` : ''}
        `;

        // イベントリスナーを再設定
        document.querySelectorAll('.quick-send-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                if (!this.disabled) {
                    const templateType = this.dataset.template;
                    sendQuickNotification(templateType);
                }
            });
        });
    }

    /**
     * クイック通知送信
     */
    function sendQuickNotification(templateType) {
        const template = MESSAGE_TEMPLATES[templateType];
        if (!template) return;

        const message = generateMessageFromTemplate(template.template);

        // プレビューモーダルを表示
        showMessagePreview(template.name, message, () => {
            sendMessageToLine(message);
            saveNotificationToHistory(template.name, message);
        });
    }

    /**
     * テンプレートからメッセージを生成
     */
    function generateMessageFromTemplate(template) {
        const eventDate = Utils.formatDate(new Date(currentEvent.date));
        const eventTime = currentEvent.time || '';
        const eventVenue = currentEvent.venue || '';
        const carAssignments = generateCarAssignmentsText();

        return template
            .replace('{eventTitle}', currentEvent.title)
            .replace('{eventDate}', eventDate)
            .replace('{eventTime}', eventTime)
            .replace('{eventVenue}', eventVenue)
            .replace('{carAssignments}', carAssignments)
            .replace('{notes}', '・集合時間の5分前にお越しください\n・忘れ物がないようにご注意ください');
    }

    /**
     * 配車割り当てテキストを生成
     */
    function generateCarAssignmentsText() {
        let text = '';

        carsData.forEach((car, carIndex) => {
            const carAssignment = assignmentData[carIndex] || { seats: {} };
            const occupiedSeats = carAssignment.seats || {};

            if (Object.keys(occupiedSeats).length > 0) {
                text += `■${car.driverName}の車`;
                if (car.carModel) {
                    text += `（${car.carModel}）`;
                }
                if (car.phone) {
                    text += ` ${car.phone}`;
                }
                text += '\n';

                Object.entries(occupiedSeats).forEach(([seatId, memberId]) => {
                    const member = getMemberById(memberId);
                    if (member) {
                        const seatLabel = getSeatLabel(seatId);
                        text += `　${seatLabel}: ${member.name}`;
                        if (member.role === 'player') {
                            const grade = calculateGrade(member.birthDate);
                            if (grade) text += `（${grade}年生）`;
                        }
                        text += '\n';
                    }
                });
                text += '\n';
            }
        });

        return text.trim();
    }

    /**
     * メッセージプレビューを表示
     */
    function showMessagePreview(title, message, onConfirm) {
        const modal = document.getElementById('message-preview-modal');
        const titleElement = document.getElementById('preview-title');
        const contentElement = document.getElementById('preview-content');
        const confirmBtn = document.getElementById('confirm-send');

        if (!modal || !titleElement || !contentElement || !confirmBtn) return;

        titleElement.textContent = title;
        contentElement.textContent = message;

        // 確認ボタンのイベントリスナーをクリア
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        newConfirmBtn.addEventListener('click', () => {
            UI.closeModal('message-preview-modal');
            onConfirm();
        });

        UI.openModal('message-preview-modal');
    }

    /**
     * LINEにメッセージを送信
     */
    function sendMessageToLine(message) {
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
        window.open(lineUrl, '_blank');

        UI.showAlert('メッセージをLINEで送信しました', 'success');
    }

    /**
     * 通知履歴に保存
     */
    async function saveNotificationToHistory(title, message) {
        try {
            const notification = {
                id: Utils.generateId(),
                title: title,
                message: message,
                sentAt: new Date().toISOString(),
                sentBy: Auth.getCurrentUser()?.uid || 'unknown'
            };

            const updatedNotifications = [...notificationsData, notification];

            await saveCarpoolData({ notifications: updatedNotifications });

            // ログ記録
            await Firestore.addLog('carpool', `配車連絡「${title}」を送信しました（${currentEvent.title}）`);

        } catch (error) {
            console.error('通知履歴保存エラー:', error);
        }
    }

    /**
     * カスタムメッセージモーダルを開く
     */
    function openCustomMessageModal() {
        const modal = document.getElementById('custom-message-modal');
        const textarea = document.getElementById('custom-message-text');

        if (!modal || !textarea) return;

        // デフォルトテンプレートを設定
        const defaultTemplate = generateMessageFromTemplate(MESSAGE_TEMPLATES.complete.template);
        textarea.value = defaultTemplate;

        UI.openModal('custom-message-modal');
    }

    /**
     * カスタムメッセージを送信
     */
    function sendCustomMessage() {
        const messageText = document.getElementById('custom-message-text').value.trim();
        const messageTitle = document.getElementById('custom-message-title').value.trim() || 'カスタムメッセージ';

        if (!messageText) {
            UI.showAlert('メッセージを入力してください', 'warning');
            return;
        }

        showMessagePreview(messageTitle, messageText, () => {
            sendMessageToLine(messageText);
            saveNotificationToHistory(messageTitle, messageText);
        });

        UI.closeModal('custom-message-modal');
    }

    /**
     * 個別通知モーダルを開く
     */
    function openIndividualNotificationModal() {
        const modal = document.getElementById('individual-modal');
        const memberSelect = document.getElementById('individual-member');

        if (!modal || !memberSelect) return;

        // 配置済みメンバーを取得
        const assignedMembers = getAssignedMembers();

        if (assignedMembers.length === 0) {
            UI.showAlert('個別通知を送信できる配置済みメンバーがいません', 'warning');
            return;
        }

        // メンバー選択肢を更新
        memberSelect.innerHTML = '<option value="">メンバーを選択</option>';
        assignedMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            if (member.role === 'player') {
                const grade = calculateGrade(member.birthDate);
                if (grade) option.textContent += ` (${grade}年生)`;
            }
            memberSelect.appendChild(option);
        });

        UI.openModal('individual-modal');
    }

    /**
     * 個別通知を送信
     */
    function sendIndividualNotification() {
        const memberId = document.getElementById('individual-member').value;
        const member = getMemberById(memberId);

        if (!member) {
            UI.showAlert('メンバーを選択してください', 'warning');
            return;
        }

        // メンバーの配置情報を取得
        const assignment = findMemberAssignment(memberId);
        if (!assignment) {
            UI.showAlert('選択されたメンバーは配置されていません', 'warning');
            return;
        }

        const car = carsData[assignment.carIndex];
        const seatLabel = getSeatLabel(assignment.seatId);

        const message = MESSAGE_TEMPLATES.individual.template
            .replace('{memberName}', member.name)
            .replace('{eventTitle}', currentEvent.title)
            .replace('{eventDate}', Utils.formatDate(new Date(currentEvent.date)))
            .replace('{eventTime}', currentEvent.time || '')
            .replace('{driverName}', car.driverName)
            .replace('{seatPosition}', seatLabel)
            .replace('{driverPhone}', car.phone || '連絡先未登録');

        showMessagePreview(`個別通知 - ${member.name}さん`, message, () => {
            sendMessageToLine(message);
            saveNotificationToHistory(`個別通知 - ${member.name}`, message);
        });

        UI.closeModal('individual-modal');
    }

    /**
     * 通知履歴を表示
     */
    function showNotificationHistory() {
        const modal = document.getElementById('history-modal');
        const content = document.getElementById('history-content');

        if (!modal || !content) return;

        if (notificationsData.length === 0) {
            content.innerHTML = '<p>送信履歴がありません。</p>';
        } else {
            let html = '<div class="notifications-history">';

            // 新しい順でソート
            const sortedNotifications = [...notificationsData].sort((a, b) =>
                new Date(b.sentAt) - new Date(a.sentAt)
            );

            sortedNotifications.forEach(notification => {
                html += `
                    <div class="history-item">
                        <div class="history-header">
                            <h5>${Utils.escapeHTML(notification.title)}</h5>
                            <span class="history-date">${Utils.formatDateTime(new Date(notification.sentAt))}</span>
                        </div>
                        <div class="history-message">
                            <pre>${Utils.escapeHTML(notification.message)}</pre>
                        </div>
                        <div class="history-actions">
                            <button onclick="FCOjima.Carpool.Notifications.resendNotification('${notification.id}')" 
                                    class="btn btn-sm btn-secondary">再送信</button>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            content.innerHTML = html;
        }

        UI.openModal('history-modal');
    }

    /**
     * 通知を再送信
     */
    Notifications.resendNotification = function (notificationId) {
        const notification = notificationsData.find(n => n.id === notificationId);
        if (!notification) return;

        showMessagePreview(`再送信: ${notification.title}`, notification.message, () => {
            sendMessageToLine(notification.message);
            saveNotificationToHistory(`再送信: ${notification.title}`, notification.message);
        });

        UI.closeModal('history-modal');
    };

    /**
     * 配車情報をエクスポート
     */
    function exportCarpoolInfo() {
        const eventDate = Utils.formatDate(new Date(currentEvent.date));
        const timestamp = new Date().toISOString().split('T')[0];

        let exportText = `FC尾島ジュニア 配車情報\n`;
        exportText += `イベント: ${currentEvent.title}\n`;
        exportText += `日時: ${eventDate} ${currentEvent.time || ''}\n`;
        exportText += `会場: ${currentEvent.venue || ''}\n\n`;

        exportText += `■参加者一覧\n`;
        const attendingMembers = getAttendingMembers();
        attendingMembers.forEach((member, index) => {
            exportText += `${index + 1}. ${member.name}`;
            if (member.role === 'player') {
                const grade = calculateGrade(member.birthDate);
                if (grade) exportText += ` (${grade}年生)`;
            }
            exportText += '\n';
        });

        exportText += '\n';
        exportText += generateCarAssignmentsText();

        exportText += `\n\n作成日時: ${new Date().toLocaleString()}`;

        // ファイルとしてダウンロード
        const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `配車情報_${currentEvent.title}_${timestamp}.txt`;
        link.click();

        UI.showAlert('配車情報をエクスポートしました', 'success');
    }

    /**
     * 配車プロセス完了
     */
    function completeCarpoolProcess() {
        const assignedCount = getAssignedMembersCount();
        const attendingCount = getAttendingMembers().length;

        if (assignedCount < attendingCount) {
            UI.showAlert('すべての配車を完了してからプロセスを終了してください', 'warning');
            return;
        }

        if (!confirm('配車管理プロセスを完了しますか？\n完了後も編集は可能です。')) {
            return;
        }

        // 完了通知を自動送信
        const completeMessage = generateMessageFromTemplate(MESSAGE_TEMPLATES.complete.template);

        showMessagePreview('配車完了通知', completeMessage, () => {
            sendMessageToLine(completeMessage);
            saveNotificationToHistory('配車完了通知', completeMessage);

            // 完了フラグを設定
            saveCarpoolData({
                completed: true,
                completedAt: new Date().toISOString(),
                completedBy: Auth.getCurrentUser()?.uid || 'unknown'
            });

            UI.showAlert('配車管理プロセスが完了しました！', 'success');

            // ログ記録
            Firestore.addLog('carpool', `配車管理プロセスを完了しました（${currentEvent.title}）`);
        });
    }

    /**
     * 通知履歴を更新
     */
    function updateNotificationHistory() {
        const historyCard = document.getElementById('recent-notifications');
        if (!historyCard) return;

        const recentNotifications = notificationsData
            .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
            .slice(0, 3);

        if (recentNotifications.length === 0) {
            historyCard.innerHTML = `
                <h4>送信履歴</h4>
                <p class="no-history">まだ送信履歴がありません。</p>
            `;
            return;
        }

        let html = '<h4>最近の送信履歴</h4><div class="recent-notifications-list">';

        recentNotifications.forEach(notification => {
            html += `
                <div class="recent-notification-item">
                    <div class="notification-title">${Utils.escapeHTML(notification.title)}</div>
                    <div class="notification-time">${Utils.formatDateTime(new Date(notification.sentAt))}</div>
                </div>
            `;
        });

        html += '</div>';

        if (notificationsData.length > 3) {
            html += `<button onclick="FCOjima.Carpool.Notifications.showNotificationHistory()" class="btn btn-sm btn-secondary">全履歴を表示</button>`;
        }

        historyCard.innerHTML = html;
    }

    /**
     * 進捗を更新
     */
    function updateProgress() {
        const progressCard = document.getElementById('notification-progress');
        if (!progressCard) return;

        const assignedCount = getAssignedMembersCount();
        const attendingCount = getAttendingMembers().length;
        const isComplete = assignedCount > 0 && assignedCount === attendingCount;
        const hasNotifications = notificationsData.length > 0;

        progressCard.innerHTML = `
            <h4>配車管理進捗</h4>
            
            <div class="progress-checklist">
                <div class="progress-item ${attendingCount > 0 ? 'completed' : ''}">
                    ${attendingCount > 0 ? '✅' : '⏳'} 出欠確認: ${attendingCount}名参加予定
                </div>
                
                <div class="progress-item ${carsData.length > 0 ? 'completed' : ''}">
                    ${carsData.length > 0 ? '✅' : '⏳'} 車両提供: ${carsData.length}台登録済み
                </div>
                
                <div class="progress-item ${isComplete ? 'completed' : ''}">
                    ${isComplete ? '✅' : '⏳'} 座席割り当て: ${assignedCount}/${attendingCount}名配置済み
                </div>
                
                <div class="progress-item ${hasNotifications ? 'completed' : ''}">
                    ${hasNotifications ? '✅' : '⏳'} 連絡配信: ${notificationsData.length}件送信済み
                </div>
            </div>
            
            ${isComplete && hasNotifications ? `
                <div class="completion-banner">
                    🎉 配車管理プロセス完了！
                </div>
            ` : ''}
        `;
    }

    /**
     * ヘルパー関数
     */
    function getAttendingMembers() {
        return membersData.filter(member => {
            const attendance = attendanceData[member.id];
            return attendance && attendance.status === 'attending';
        });
    }

    function getAssignedMembersCount() {
        return Object.values(assignmentData).reduce((total, car) => {
            return total + Object.keys(car.seats || {}).length;
        }, 0);
    }

    function getAssignedMembers() {
        const assigned = [];
        Object.values(assignmentData).forEach(car => {
            Object.values(car.seats || {}).forEach(memberId => {
                if (memberId) {
                    const member = getMemberById(memberId);
                    if (member) assigned.push(member);
                }
            });
        });
        return assigned;
    }

    function findMemberAssignment(memberId) {
        for (const [carIndex, carAssignment] of Object.entries(assignmentData)) {
            for (const [seatId, assignedMemberId] of Object.entries(carAssignment.seats || {})) {
                if (assignedMemberId === memberId) {
                    return { carIndex: parseInt(carIndex), seatId };
                }
            }
        }
        return null;
    }

    function getMemberById(memberId) {
        return membersData.find(member => member.id === memberId);
    }

    function getSeatLabel(seatId) {
        const [row, index] = seatId.split('-');
        const labels = {
            'front': '助手席',
            'middle': `中列${parseInt(index) + 1}`,
            'back': `後列${parseInt(index) + 1}`
        };
        return labels[row] || seatId;
    }

    function calculateGrade(birthDate) {
        if (!birthDate) return null;

        const birth = new Date(birthDate);
        const now = new Date();

        const schoolYearStart = new Date(now.getFullYear(), 3, 2);
        if (now < schoolYearStart) {
            schoolYearStart.setFullYear(schoolYearStart.getFullYear() - 1);
        }

        const elementarySchoolEntryYear = birth.getFullYear() + (birth.getMonth() >= 3 && birth.getDate() >= 2 ? 7 : 6);
        const gradeOffset = schoolYearStart.getFullYear() - elementarySchoolEntryYear;

        if (gradeOffset === -3) return "年少";
        if (gradeOffset === -2) return "年中";
        if (gradeOffset === -1) return "年長";
        if (gradeOffset >= 0 && gradeOffset <= 5) return String(gradeOffset + 1);

        return null;
    }

    function getEventTypeLabel(type) {
        const labels = { match: '試合', practice: '練習', other: 'その他' };
        return labels[type] || type;
    }

    /**
     * 配車データを保存
     */
    async function saveCarpoolData(dataToUpdate) {
        const updatedCarpoolData = {
            ...carpoolData,
            ...dataToUpdate,
            lastUpdated: new Date().toISOString()
        };

        await Firestore.setDocument('carpool', currentEvent.id, updatedCarpoolData);
    }

    /**
     * 公開関数
     */
    Notifications.showNotificationHistory = showNotificationHistory;
    Notifications.resendNotification = Notifications.resendNotification;

    /**
     * 表示の更新（外部から呼び出し可能）
     */
    Notifications.updateDisplay = updateDisplay;

    /**
     * クリーンアップ
     */
    Notifications.destroy = function () {
        if (membersUnsubscribe) {
            membersUnsubscribe();
            membersUnsubscribe = null;
        }

        if (carpoolUnsubscribe) {
            carpoolUnsubscribe();
            carpoolUnsubscribe = null;
        }
    };

    // ページから離れる時のクリーンアップ
    window.addEventListener('beforeunload', Notifications.destroy);

})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function () {
    if (typeof FCOjima !== 'undefined' && FCOjima.Carpool && FCOjima.Carpool.Notifications) {
        FCOjima.Carpool.Notifications.init();
    }
});
