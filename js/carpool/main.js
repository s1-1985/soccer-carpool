/**
 * FC尾島ジュニア - 配車管理ページのメインJS
 * 配車管理ページの初期化と全体的な制御を行う
 */

// 名前空間の定義はglobal.jsで行うため削除

// データ保存用オブジェクト
FCOjima.Carpool.appData = {
    eventId: null,
    carRegistrations: [],
    assignments: [],
    attendance: [],
    notifications: []
};

// 会員データ
FCOjima.Carpool.members = [];

/**
 * ページ初期化時の処理
 */
FCOjima.Carpool.init = function() {
    console.log('FC尾島ジュニア 配車管理ページを初期化しています...');
    
    // イベント情報の読み込み
    this.loadEventData();
    
    // メンバーデータの読み込み
    this.loadMembers();
    
    // データをロード
    this.loadData();
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    // 初期タブを開く - 概要タブをデフォルトで表示
    document.getElementById('defaultTab').click();
    
    // モーダル初期化
    FCOjima.UI.initModals();
    
    console.log('FC尾島ジュニア 配車管理ページの初期化が完了しました');
};

/**
 * セッションストレージからイベントデータを読み込む
 */
FCOjima.Carpool.loadEventData = function() {
    console.log('イベントデータを読み込んでいます...');
    
    const event = FCOjima.Storage.getSelectedEvent();
    if (event) {
        this.displayEventData(event);
        
        // イベントIDを保存
        this.appData.eventId = event.id;
        console.log(`イベントデータを読み込みました: ID=${event.id}, タイトル=${event.title}`);
    } else {
        const eventSummary = document.getElementById('event-summary');
        if (eventSummary) {
            eventSummary.innerHTML = FCOjima.UI.createAlert('info', 'イベントが選択されていません。HUBページからイベントを選択してください。');
        }
        console.log('選択されたイベントがありません');
    }
};

/**
 * ローカルストレージからメンバーデータを読み込む
 */
FCOjima.Carpool.loadMembers = function() {
    console.log('メンバーデータを読み込んでいます...');
    
    this.members = FCOjima.Storage.loadMembers();
    console.log(`メンバーデータを読み込みました: ${this.members.length}人`);
};

/**
 * ローカルストレージからデータをロード
 */
FCOjima.Carpool.loadData = function() {
    console.log('配車管理データを読み込んでいます...');
    
    if (this.appData.eventId) {
        // ローカルストレージからこのイベント用のデータを取得
        const eventData = FCOjima.Storage.loadEventData(this.appData.eventId);
        
        // データをマージ
        this.appData = {...this.appData, ...eventData};
        
        // UIを更新
        this.refreshUI();
        console.log(`配車管理データを読み込みました: ID=${this.appData.eventId}`);
    } else {
        console.log('イベントIDがないため、配車管理データを読み込めませんでした');
    }
};

/**
 * イベントリスナーの設定
 */
FCOjima.Carpool.setupEventListeners = function() {
    console.log('イベントリスナーを設定しています...');
    
    // 出欠確認タブでメンバー追加ボタンのイベントリスナー
    const addAttendeeButton = document.getElementById('add-attendee');
    if (addAttendeeButton) {
        addAttendeeButton.addEventListener('click', () => {
            FCOjima.Carpool.Attendance.openMemberSelectModal();
        });
    }
    
    // 車両提供条件変更時のイベントリスナー
    const canDriveSelect = document.getElementById('canDrive');
    if (canDriveSelect) {
        canDriveSelect.addEventListener('change', function() {
            const carDetails = document.getElementById('carDetails');
            if (this.value === 'no') {
                carDetails.style.display = 'none';
            } else {
                carDetails.style.display = 'block';
            }
        });
    }
    
    // 車提供登録ボタンのイベントリスナー
    const registerCarButton = document.querySelector('#carForm button');
    if (registerCarButton) {
        registerCarButton.addEventListener('click', () => {
            FCOjima.Carpool.CarProvision.registerCar();
        });
    }
    
    // ランダム割り当てボタンのイベントリスナー
    const generateRandomButton = document.querySelector('#assignments button:first-child');
    if (generateRandomButton) {
        generateRandomButton.addEventListener('click', () => {
            FCOjima.Carpool.Assignment.generateRandomAssignments();
        });
    }
    
    // 割り当て保存ボタンのイベントリスナー
    const saveAssignmentsButton = document.querySelector('#assignments button:nth-child(2)');
    if (saveAssignmentsButton) {
        saveAssignmentsButton.addEventListener('click', () => {
            FCOjima.Carpool.Assignment.saveAssignments();
        });
    }
    
    // 割り当て共有ボタンのイベントリスナー
    const shareAssignmentsButton = document.querySelector('#assignments button:nth-child(3)');
    if (shareAssignmentsButton) {
        shareAssignmentsButton.addEventListener('click', () => {
            FCOjima.Carpool.Assignment.shareAssignments();
        });
    }
    
    // 出欠保存ボタンのイベントリスナー
    const saveAttendanceButton = document.querySelector('#attendance button:first-child');
    if (saveAttendanceButton) {
        saveAttendanceButton.addEventListener('click', () => {
            FCOjima.Carpool.Attendance.saveAttendance();
        });
    }
    
    // 出欠リマインドボタンのイベントリスナー
    const reminderAttendanceButton = document.querySelector('#attendance button:nth-child(2)');
    if (reminderAttendanceButton) {
        reminderAttendanceButton.addEventListener('click', () => {
            FCOjima.Carpool.Attendance.reminderAttendance();
        });
    }
    
    // 連絡事項送信ボタンのイベントリスナー
    const sendNotificationButton = document.querySelector('#notificationForm button');
    if (sendNotificationButton) {
        sendNotificationButton.addEventListener('click', () => {
            FCOjima.Carpool.Notifications.sendNotification();
        });
    }
    
    // HUBに戻るボタンのイベントリスナー
    const goToMainPageButton = document.querySelector('.navigation-buttons button');
    if (goToMainPageButton) {
        goToMainPageButton.addEventListener('click', () => {
            this.goToMainPage();
        });
    }
    
    console.log('イベントリスナーの設定が完了しました');
};

/**
 * イベントデータを表示
 * @param {Object} event - イベントオブジェクト
 */
FCOjima.Carpool.displayEventData = function(event) {
    console.log(`イベントデータを表示します: ID=${event.id}, タイトル=${event.title}`);
    
    // イベントタイトルをヘッダーに表示
    const header = document.getElementById('event-header');
    if (header) {
        const date = FCOjima.Utils.formatDateForDisplay(event.date);
        header.textContent = `${date} ${event.title}`;
    }
    
    // 概要タブにイベント情報を表示
    const eventSummary = document.getElementById('event-summary');
    if (eventSummary) {
        // 学年ターゲット表示
        let targetDisplay = '';
        if (event.target && event.target.length > 0) {
            const targetGrades = event.target.map(grade => FCOjima.Utils.getGradeLabel(grade)).join(', ');
            targetDisplay = `
            <div class="detail-row">
                <span class="detail-label">対象:</span>
                <span class="detail-value">${targetGrades}</span>
            </div>`;
            
            if (event.targetNotes) {
                targetDisplay += `
                <div class="detail-row">
                    <span class="detail-label">対象備考:</span>
                    <span class="detail-value">${FCOjima.UI.escapeHTML(event.targetNotes)}</span>
                </div>`;
            }
        }

        // 出発時間
        let departureDisplay = '';
        if (event.departureTime) {
            departureDisplay = `
            <div class="detail-row">
                <span class="detail-label">出発時間:</span>
                <span class="detail-value">${event.departureTime}</span>
            </div>`;
        }

        // 集合場所
        let meetingPlaceDisplay = '';
        if (event.meetingPlace) {
            meetingPlaceDisplay = `
            <div class="detail-row">
                <span class="detail-label">集合場所:</span>
                <span class="detail-value">${FCOjima.UI.escapeHTML(event.meetingPlace)}</span>
            </div>`;
        }
        
        eventSummary.innerHTML = `
            <div class="event-detail-card">
                <h3>${FCOjima.UI.escapeHTML(event.title)}</h3>
                <div class="detail-row">
                    <span class="detail-label">日付:</span>
                    <span class="detail-value">${FCOjima.Utils.formatDateForDisplay(event.date)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">種類:</span>
                    <span class="detail-value">${FCOjima.Utils.getEventTypeLabel(event.type)}</span>
                </div>
                ${targetDisplay}
                ${departureDisplay}
                ${meetingPlaceDisplay}
                <div class="detail-row">
                    <span class="detail-label">会場:</span>
                    <span class="detail-value">${FCOjima.UI.escapeHTML(event.venue || '未設定')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">時間:</span>
                    <span class="detail-value">${event.startTime || ''}${event.endTime ? ` - ${event.endTime}` : ''}</span>
                </div>
                ${event.notes ? `
                <div class="detail-row">
                    <span class="detail-label">備考:</span>
                    <span class="detail-value">${FCOjima.UI.escapeHTML(event.notes)}</span>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    // 車提供タブとアサインメントタブでも簡易情報を表示
    const carEventInfo = document.getElementById('carEventInfo');
    if (carEventInfo) {
        carEventInfo.innerHTML = `
            <div class="event-summary">
                <strong>${FCOjima.UI.escapeHTML(event.title)}</strong> (${FCOjima.Utils.formatDateForDisplay(event.date)} ${event.startTime || ''})
            </div>
        `;
    }
    
    const assignmentEventInfo = document.getElementById('assignmentEventInfo');
    if (assignmentEventInfo) {
        assignmentEventInfo.innerHTML = `
            <div class="event-summary">
                <strong>${FCOjima.UI.escapeHTML(event.title)}</strong> (${FCOjima.Utils.formatDateForDisplay(event.date)} ${event.startTime || ''})
            </div>
        `;
    }
};

/**
 * ローカルストレージにデータを保存
 */
FCOjima.Carpool.saveData = function() {
    console.log('配車管理データを保存します...');
    
    if (this.appData.eventId) {
        FCOjima.Storage.saveEventData(this.appData.eventId, {
            carRegistrations: this.appData.carRegistrations,
            assignments: this.appData.assignments,
            attendance: this.appData.attendance,
            notifications: this.appData.notifications
        });
        console.log(`配車管理データを保存しました: ID=${this.appData.eventId}`);
    } else {
        console.log('イベントIDがないため、データを保存できませんでした');
    }
};

/**
 * UIを更新する関数
 */
FCOjima.Carpool.refreshUI = function() {
    console.log('UIを更新しています...');
    
    // 車の登録リストを更新
    FCOjima.Carpool.CarProvision.updateCarRegistrations();
    
    // 割り当て一覧を更新
    FCOjima.Carpool.Assignment.updateAssignments();
    
    // 出欠状況を更新
    FCOjima.Carpool.Attendance.updateAttendance();
    
    // 連絡事項を更新
    FCOjima.Carpool.Notifications.updateNotifications();
    
    console.log('UIの更新が完了しました');
};

/**
 * タブ切り替え関数
 * @param {Event} evt - イベントオブジェクト
 * @param {string} tabName - 開くタブのID
 */
FCOjima.Carpool.UI.openTab = function(evt, tabName) {
    FCOjima.UI.openTab(evt, tabName);
};

/**
 * メインページに戻る
 */
FCOjima.Carpool.goToMainPage = function() {
    window.location.href = 'index.html';
};

// DOMContentLoaded イベントで初期化
document.addEventListener('DOMContentLoaded', function() {
    FCOjima.Carpool.init();
});