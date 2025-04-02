/**
 * FC尾島ジュニア - 配車管理ページのメインJS
 * 配車管理ページの初期化と全体的な制御を行う
 */

(function(app) {
    // 名前空間のショートカット
    var Carpool = app.Carpool;
    var UI = app.UI;
    var Storage = app.Storage;
    
    /**
     * ページ初期化時の処理
     */
    Carpool.init = function() {
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
        UI.initModals();
        
        console.log('FC尾島ジュニア 配車管理ページの初期化が完了しました');
    };
    
    /**
     * セッションストレージからイベントデータを読み込む
     */
    Carpool.loadEventData = function() {
        console.log('イベントデータを読み込んでいます...');
        
        var event = Storage.getSelectedEvent();
        if (event) {
            // イベントIDを保存
            this.appData.eventId = event.id;
            console.log('イベントデータを読み込みました: ID=' + event.id + ', タイトル=' + event.title);
            
            // 概要タブでイベントデータを表示
            Carpool.Overview.displayEventData(event);
        } else {
            var eventSummary = document.getElementById('event-summary');
            if (eventSummary) {
                eventSummary.innerHTML = UI.createAlert('info', 'イベントが選択されていません。HUBページからイベントを選択してください。');
            }
            console.log('選択されたイベントがありません');
        }
    };
    
    /**
     * ローカルストレージからメンバーデータを読み込む
     */
    Carpool.loadMembers = function() {
        console.log('メンバーデータを読み込んでいます...');
        
        this.members = Storage.loadMembers();
        console.log('メンバーデータを読み込みました: ' + this.members.length + '人');
    };
    
    /**
     * ローカルストレージからデータをロード
     */
    Carpool.loadData = function() {
        console.log('配車管理データを読み込んでいます...');
        
        if (this.appData.eventId) {
            // ローカルストレージからこのイベント用のデータを取得
            var eventData = Storage.loadEventData(this.appData.eventId);
            
            // データをマージ
            this.appData.carRegistrations = eventData.carRegistrations || [];
            this.appData.assignments = eventData.assignments || [];
            this.appData.attendance = eventData.attendance || [];
            this.appData.notifications = eventData.notifications || [];
            
            // UIを更新
            this.refreshUI();
            console.log('配車管理データを読み込みました: ID=' + this.appData.eventId);
        } else {
            console.log('イベントIDがないため、配車管理データを読み込めませんでした');
        }
    };
    
    /**
     * イベントリスナーの設定
     */
    Carpool.setupEventListeners = function() {
        console.log('イベントリスナーを設定しています...');
        
        // タブの設定
        var tabLinks = document.querySelectorAll('.tablinks');
        tabLinks.forEach(function(tab) {
            tab.addEventListener('click', function(e) {
                var tabName = this.getAttribute('onclick').match(/openTab\(event,\s*'([^']+)'/)[1];
                Carpool.UI.openTab(e, tabName);
            });
        });
        
        // HUBに戻るボタンのイベントリスナー（問題3の修正）
        var backToHubButton = document.querySelector('.global-navigation button:first-child');
        if (backToHubButton) {
            backToHubButton.addEventListener('click', function() {
                Carpool.Overview.goToMainPage();
            });
        }
        
        // 概要タブの共有ボタン
        var shareEventButton = document.getElementById('share-event-button');
        if (shareEventButton) {
            shareEventButton.addEventListener('click', function() {
                Carpool.Overview.shareEventViaLINE();
            });
        }
        
        // 出欠確認タブで処理
        this.setupAttendanceListeners();
        
        // 車提供タブの処理
        this.setupCarProvisionListeners();
        
        // 割り当てタブの処理
        this.setupAssignmentListeners();
        
        // 連絡タブの処理
        this.setupNotificationListeners();
        
        console.log('イベントリスナーの設定が完了しました');
    };
    
    /**
     * 出欠確認タブのイベントリスナー設定
     */
    Carpool.setupAttendanceListeners = function() {
        // 出欠保存ボタン
        var saveAttendanceButton = document.getElementById('save-attendance');
        if (saveAttendanceButton) {
            saveAttendanceButton.addEventListener('click', function() {
                Carpool.Attendance.saveAttendance();
            });
        }
        
        // リマインドボタン
        var reminderButton = document.getElementById('reminder-attendance');
        if (reminderButton) {
            reminderButton.addEventListener('click', function() {
                Carpool.Attendance.reminderAttendance();
            });
        }
        
        // メンバー追加ボタン
        var addAttendeeButton = document.getElementById('add-attendee');
        if (addAttendeeButton) {
            addAttendeeButton.addEventListener('click', function() {
                Carpool.Attendance.openMemberSelectModal();
            });
        }
    };
    
    /**
     * 車提供タブのイベントリスナー設定
     */
    Carpool.setupCarProvisionListeners = function() {
        // 車提供登録ボタン
        var registerCarButton = document.getElementById('register-car');
        if (registerCarButton) {
            registerCarButton.addEventListener('click', function() {
                Carpool.CarProvision.registerCar();
            });
        }
        
        // 車両提供条件変更
        var canDriveSelect = document.getElementById('canDrive');
        if (canDriveSelect) {
            canDriveSelect.addEventListener('change', function() {
                var carDetails = document.getElementById('carDetails');
                carDetails.style.display = (this.value === 'no') ? 'none' : 'block';
            });
        }
        
        // 運転者選択ボタン
        var selectDriverButton = document.getElementById('select-driver');
        if (selectDriverButton) {
            selectDriverButton.addEventListener('click', function() {
                Carpool.CarProvision.openDriverSelectModal();
            });
        }
    };
    
    /**
     * 割り当てタブのイベントリスナー設定
     */
    Carpool.setupAssignmentListeners = function() {
        // ランダム割り当てボタン
        var generateRandomButton = document.getElementById('generate-random');
        if (generateRandomButton) {
            generateRandomButton.addEventListener('click', function() {
                Carpool.Assignment.generateRandomAssignments();
            });
        }
        
        // 割り当て保存ボタン
        var saveAssignmentsButton = document.getElementById('save-assignments');
        if (saveAssignmentsButton) {
            saveAssignmentsButton.addEventListener('click', function() {
                Carpool.Assignment.saveAssignments();
            });
        }
        
        // 割り当て共有ボタン
        var shareAssignmentsButton = document.getElementById('share-assignments');
        if (shareAssignmentsButton) {
            shareAssignmentsButton.addEventListener('click', function() {
                Carpool.Assignment.shareAssignments();
            });
        }
        
        // 座席編集モーダルの保存ボタン
        var seatEditForm = document.getElementById('seat-edit-form');
        if (seatEditForm) {
            seatEditForm.addEventListener('submit', function(e) {
                e.preventDefault();
                Carpool.Assignment.saveSeatEdit();
            });
        }
        
        // 座席クリアボタン
        var clearSeatButton = document.getElementById('clear-seat');
        if (clearSeatButton) {
            clearSeatButton.addEventListener('click', function() {
                Carpool.Assignment.clearSelectedSeat();
            });
        }
    };
    
    /**
     * 連絡タブのイベントリスナー設定
     */
    Carpool.setupNotificationListeners = function() {
        // 連絡事項送信ボタン
        var sendNotificationButton = document.getElementById('send-notification');
        if (sendNotificationButton) {
            sendNotificationButton.addEventListener('click', function() {
                Carpool.Notifications.sendNotification();
            });
        }
    };
    
    /**
     * ローカルストレージにデータを保存
     */
    Carpool.saveData = function() {
        console.log('配車管理データを保存します...');
        
        if (this.appData.eventId) {
            Storage.saveEventData(this.appData.eventId, {
                carRegistrations: this.appData.carRegistrations,
                assignments: this.appData.assignments,
                attendance: this.appData.attendance,
                notifications: this.appData.notifications
            });
            console.log('配車管理データを保存しました: ID=' + this.appData.eventId);
        } else {
            console.log('イベントIDがないため、データを保存できませんでした');
        }
    };
    
    /**
     * UIを更新する関数
     */
    Carpool.refreshUI = function() {
        console.log('UIを更新しています...');
        
        // 車の登録リストを更新
        if (Carpool.CarProvision.updateCarRegistrations) {
            Carpool.CarProvision.updateCarRegistrations();
        }
        
        // 割り当て一覧を更新
        if (Carpool.Assignment.updateAssignments) {
            Carpool.Assignment.updateAssignments();
        }
        
        // 出欠状況を更新
        if (Carpool.Attendance.updateAttendance) {
            Carpool.Attendance.updateAttendance();
        }
        
        // 連絡事項を更新
        if (Carpool.Notifications.updateNotifications) {
            Carpool.Notifications.updateNotifications();
        }
        
        console.log('UIの更新が完了しました');
    };
    
    /**
     * タブ切り替え関数
     * @param {Event} evt - イベントオブジェクト
     * @param {string} tabName - 開くタブのID
     */
    Carpool.UI.openTab = function(evt, tabName) {
        UI.openTab(evt, tabName);
    };
    
    // DOMContentLoaded イベントで初期化
    document.addEventListener('DOMContentLoaded', function() {
        Carpool.init();
        
        // 各タブの初期化
        if (Carpool.Attendance.init) {
            Carpool.Attendance.init();
        }
        
        if (Carpool.CarProvision.init) {
            Carpool.CarProvision.init();
        }
    });
    
})(window.FCOjima);
