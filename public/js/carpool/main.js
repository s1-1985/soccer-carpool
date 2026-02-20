/**
 * FC尾島ジュニア - 配車管理 メイン機能
 * タブ切り替え、進行管理、共通機能、データ同期
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Main = FCOjima.Carpool.Main || {};

// 配車管理メイン管理モジュール
(function() {
    const Main = FCOjima.Carpool.Main;
    const Storage = FCOjima.Storage;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;
    
    // 現在のタブとフロー
    let currentTab = 'overview';
    let currentEventId = null;
    let currentEvent = null;
    
    // タブの順序（配車管理フロー）
    const tabOrder = ['overview', 'attendance', 'cars', 'assignments', 'notifications'];
    const tabNames = {
        overview: '概要',
        attendance: '出欠確認', 
        cars: '車提供',
        assignments: '割り当て',
        notifications: '連絡'
    };
    
    // データキャッシュ
    let dataCache = {
        events: [],
        members: [],
        venues: [],
        attendanceData: [],
        carProvisions: [],
        assignments: [],
        logs: []
    };
    
    // 進行状況
    let progressStatus = {
        eventSelected: false,
        attendanceComplete: false,
        carsProvided: false,
        assignmentComplete: false,
        notificationSent: false
    };
    
    /**
     * 配車管理メイン機能の初期化
     */
    Main.init = function() {
        console.log('FC尾島ジュニア 配車管理を初期化しています...');
        
        // URLパラメータからタブとイベントIDを取得
        determineInitialState();
        
        // データの読み込み
        loadAllData();
        
        // UI要素の初期化
        setupEventListeners();
        setupKeyboardShortcuts();
        
        // タブ切り替えの初期化
        initializeTabs();
        
        // 進行状況の初期化
        updateProgressStatus();
        
        // 自動保存の設定
        setupAutoSave();
        
        // エラーハンドリングの設定
        setupErrorHandling();
        
        // 定期的なデータ同期
        setupDataSync();
        
        console.log('FC尾島ジュニア 配車管理の初期化が完了しました');
    };
    
    /**
     * 初期状態の決定
     */
    function determineInitialState() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // イベントIDの取得
        currentEventId = urlParams.get('eventId');
        if (currentEventId) {
            currentEventId = parseInt(currentEventId);
        }
        
        // タブの取得
        const tabParam = urlParams.get('tab');
        if (tabParam && tabOrder.includes(tabParam)) {
            currentTab = tabParam;
        } else {
            currentTab = 'overview';
        }
        
        console.log('初期状態:', { currentEventId, currentTab });
    }
    
    /**
     * すべてのデータを読み込み
     */
    function loadAllData() {
        try {
            dataCache.events = Storage.loadEvents();
            dataCache.members = Storage.loadMembers();
            dataCache.venues = Storage.loadVenues();
            dataCache.attendanceData = Storage.loadAttendanceData();
            dataCache.carProvisions = Storage.loadCarProvisions();
            dataCache.assignments = Storage.loadAssignments();
            dataCache.logs = Storage.loadLogs();
            
            // 現在のイベントを設定
            if (currentEventId) {
                currentEvent = dataCache.events.find(e => e.id === currentEventId);
            }
            
            console.log('データを読み込みました:', {
                events: dataCache.events.length,
                members: dataCache.members.length,
                venues: dataCache.venues.length,
                attendanceData: dataCache.attendanceData.length,
                carProvisions: dataCache.carProvisions.length,
                assignments: dataCache.assignments.length,
                logs: dataCache.logs.length
            });
        } catch (error) {
            console.error('データの読み込みでエラーが発生しました:', error);
            UI.showAlert('データの読み込みでエラーが発生しました。', 'danger');
        }
    }
    
    /**
     * イベントリスナーの設定
     */
    function setupEventListeners() {
        // タブナビゲーション
        tabOrder.forEach(tab => {
            const tabElement = document.getElementById(`${tab}-tab`);
            if (tabElement) {
                tabElement.addEventListener('click', function(e) {
                    e.preventDefault();
                    switchTab(tab);
                });
            }
        });
        
        // 戻るボタンのハンドリング
        window.addEventListener('popstate', function(e) {
            if (e.state && e.state.tab) {
                currentTab = e.state.tab;
                updateTabDisplay();
            }
        });
        
        // ウィンドウのリサイズ対応
        window.addEventListener('resize', Utils.debounce(handleResize, 250));
        
        // ページ離脱前の確認
        window.addEventListener('beforeunload', function(e) {
            if (hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
        
        // 進行状況バーのクリックイベント
        const progressSteps = document.querySelectorAll('.progress-step');
        progressSteps.forEach((step, index) => {
            step.addEventListener('click', function() {
                if (index < tabOrder.length) {
                    switchTab(tabOrder[index]);
                }
            });
        });
    }
    
    /**
     * キーボードショートカットの設定
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // Ctrl/Cmd キーとの組み合わせのみ
            if (!(e.ctrlKey || e.metaKey)) return;
            
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    switchTab('overview');
                    break;
                case '2':
                    e.preventDefault();
                    switchTab('attendance');
                    break;
                case '3':
                    e.preventDefault();
                    switchTab('cars');
                    break;
                case '4':
                    e.preventDefault();
                    switchTab('assignments');
                    break;
                case '5':
                    e.preventDefault();
                    switchTab('notifications');
                    break;
                case 's':
                    e.preventDefault();
                    saveAllData();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    switchToPreviousTab();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    switchToNextTab();
                    break;
            }
        });
    }
    
    /**
     * タブの初期化
     */
    function initializeTabs() {
        // 初期タブの表示
        switchTab(currentTab);
        
        // 履歴の初期状態を設定
        if (window.history.replaceState) {
            window.history.replaceState(
                { tab: currentTab, eventId: currentEventId }, 
                '', 
                `?eventId=${currentEventId}&tab=${currentTab}`
            );
        }
    }
    
    /**
     * タブの切り替え
     */
    function switchTab(tabName) {
        if (!tabOrder.includes(tabName)) {
            console.warn('無効なタブ名:', tabName);
            return;
        }
        
        const previousTab = currentTab;
        currentTab = tabName;
        
        // イベントが選択されていない場合はoverviewに戻る
        if (!currentEvent && tabName !== 'overview') {
            UI.showAlert('先にイベントを選択してください。', 'warning');
            currentTab = 'overview';
            tabName = 'overview';
        }
        
        // タブ表示の更新
        updateTabDisplay();
        
        // URLの更新
        if (window.history.pushState && currentEventId) {
            window.history.pushState(
                { tab: currentTab, eventId: currentEventId }, 
                '', 
                `?eventId=${currentEventId}&tab=${currentTab}`
            );
        }
        
        // タブ固有の初期化
        initializeTabModule(tabName);
        
        // 進行状況の更新
        updateProgressStatus();
        
        // ログの追加
        addLog('タブ切り替え', `${previousTab} から ${currentTab} に切り替えました`);
        
        console.log('タブを切り替えました:', previousTab, '->', currentTab);
    }
    
    /**
     * 前のタブに切り替え
     */
    function switchToPreviousTab() {
        const currentIndex = tabOrder.indexOf(currentTab);
        if (currentIndex > 0) {
            switchTab(tabOrder[currentIndex - 1]);
        }
    }
    
    /**
     * 次のタブに切り替え
     */
    function switchToNextTab() {
        const currentIndex = tabOrder.indexOf(currentTab);
        if (currentIndex < tabOrder.length - 1) {
            switchTab(tabOrder[currentIndex + 1]);
        }
    }
    
    /**
     * タブ表示の更新
     */
    function updateTabDisplay() {
        // ナビゲーションのアクティブ状態を更新
        tabOrder.forEach(tab => {
            const tabElement = document.getElementById(`${tab}-tab`);
            if (tabElement) {
                tabElement.classList.toggle('active', tab === currentTab);
            }
        });
        
        // コンテンツエリアの表示切り替え
        tabOrder.forEach(tab => {
            const contentElement = document.getElementById(`${tab}-content`);
            if (contentElement) {
                contentElement.style.display = tab === currentTab ? 'block' : 'none';
            }
        });
        
        // 進行状況バーの更新
        updateProgressBar();
        
        // ページタイトルの更新
        updatePageTitle();
    }
    
    /**
     * タブモジュールの初期化
     */
    function initializeTabModule(tabName) {
        try {
            switch (tabName) {
                case 'overview':
                    if (FCOjima.Carpool.Overview && FCOjima.Carpool.Overview.init) {
                        FCOjima.Carpool.Overview.init();
                    }
                    break;
                case 'attendance':
                    if (FCOjima.Carpool.Attendance && FCOjima.Carpool.Attendance.init) {
                        FCOjima.Carpool.Attendance.init();
                    }
                    break;
                case 'cars':
                    if (FCOjima.Carpool.CarProvision && FCOjima.Carpool.CarProvision.init) {
                        FCOjima.Carpool.CarProvision.init();
                    }
                    break;
                case 'assignments':
                    if (FCOjima.Carpool.Assignment && FCOjima.Carpool.Assignment.init) {
                        FCOjima.Carpool.Assignment.init();
                    }
                    break;
                case 'notifications':
                    if (FCOjima.Carpool.Notifications && FCOjima.Carpool.Notifications.init) {
                        FCOjima.Carpool.Notifications.init();
                    }
                    break;
            }
        } catch (error) {
            console.error(`タブ ${tabName} の初期化でエラーが発生しました:`, error);
            UI.showAlert(`タブの初期化でエラーが発生しました。`, 'danger');
        }
    }
    
    /**
     * 進行状況の更新
     */
    function updateProgressStatus() {
        if (!currentEventId) {
            progressStatus = {
                eventSelected: false,
                attendanceComplete: false,
                carsProvided: false,
                assignmentComplete: false,
                notificationSent: false
            };
            return;
        }
        
        const eventAttendance = dataCache.attendanceData.filter(a => a.eventId === currentEventId);
        const eventCars = dataCache.carProvisions.filter(c => c.eventId === currentEventId);
        const eventAssignments = dataCache.assignments.filter(a => a.eventId === currentEventId);
        
        // 出欠確認完了チェック
        const attendingCount = eventAttendance.filter(a => a.status === 'attending').length;
        const totalResponses = eventAttendance.filter(a => a.status !== 'pending').length;
        
        // 車提供チェック
        const providingCars = eventCars.filter(c => c.outboundAvailable || c.returnAvailable).length;
        
        // 割り当て完了チェック
        const assignedCount = eventAssignments.reduce((sum, a) => sum + a.passengers.length, 0);
        
        progressStatus = {
            eventSelected: !!currentEvent,
            attendanceComplete: totalResponses > 0 && attendingCount > 0,
            carsProvided: providingCars > 0,
            assignmentComplete: assignedCount >= attendingCount && attendingCount > 0,
            notificationSent: false // 実際のアプリでは送信ログから判定
        };
        
        updateProgressBar();
    }
    
    /**
     * 進行状況バーの更新
     */
    function updateProgressBar() {
        const progressSteps = document.querySelectorAll('.progress-step');
        const completedSteps = Object.values(progressStatus).filter(Boolean).length;
        const progressPercentage = (completedSteps / progressSteps.length) * 100;
        
        // 各ステップの状態を更新
        progressSteps.forEach((step, index) => {
            const tabName = tabOrder[index];
            const isActive = tabName === currentTab;
            const isCompleted = getStepCompletionStatus(index);
            
            step.classList.toggle('active', isActive);
            step.classList.toggle('completed', isCompleted);
            
            // ステップ番号の更新
            const stepNumber = step.querySelector('.step-number');
            if (stepNumber) {
                stepNumber.textContent = isCompleted ? '✓' : (index + 1);
            }
        });
        
        // 進行状況バーの更新
        const progressFill = document.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progressPercentage}%`;
        }
        
        // 進行状況テキストの更新
        const progressText = document.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = `${completedSteps}/${progressSteps.length} 完了`;
        }
    }
    
    /**
     * ステップ完了状況の取得
     */
    function getStepCompletionStatus(stepIndex) {
        switch (stepIndex) {
            case 0: return progressStatus.eventSelected;
            case 1: return progressStatus.attendanceComplete;
            case 2: return progressStatus.carsProvided;
            case 3: return progressStatus.assignmentComplete;
            case 4: return progressStatus.notificationSent;
            default: return false;
        }
    }
    
    /**
     * ページタイトルの更新
     */
    function updatePageTitle() {
        let title = '配車管理 - FC尾島ジュニア';
        
        if (currentEvent) {
            title = `${currentEvent.name} - ${tabNames[currentTab]} - 配車管理 - FC尾島ジュニア`;
        } else {
            title = `${tabNames[currentTab]} - 配車管理 - FC尾島ジュニア`;
        }
        
        document.title = title;
    }
    
    /**
     * 自動保存の設定
     */
    function setupAutoSave() {
        // 3分ごとに自動保存
        setInterval(function() {
            if (hasUnsavedChanges()) {
                saveAllData();
                addLog('自動保存', 'データを自動保存しました');
            }
        }, 3 * 60 * 1000);
    }
    
    /**
     * エラーハンドリングの設定
     */
    function setupErrorHandling() {
        // グローバルエラーハンドラー
        window.addEventListener('error', function(e) {
            console.error('グローバルエラー:', e.error);
            addLog('エラー', `予期しないエラーが発生しました: ${e.error.message}`);
            UI.showAlert('予期しないエラーが発生しました。', 'danger');
        });
        
        // Promise のエラーハンドラー
        window.addEventListener('unhandledrejection', function(e) {
            console.error('未処理のPromise拒否:', e.reason);
            addLog('エラー', `Promise エラー: ${e.reason}`);
            e.preventDefault();
        });
    }
    
    /**
     * データ同期の設定
     */
    function setupDataSync() {
        // 30秒ごとにデータの整合性をチェック
        setInterval(function() {
            syncData();
        }, 30 * 1000);
    }
    
    /**
     * ウィンドウリサイズのハンドリング
     */
    function handleResize() {
        const isMobile = window.innerWidth < 768;
        document.body.classList.toggle('mobile', isMobile);
        
        // 現在のタブモジュールの更新
        if (currentTab && FCOjima.Carpool[capitalize(currentTab)] && 
            FCOjima.Carpool[capitalize(currentTab)].updateDisplay) {
            FCOjima.Carpool[capitalize(currentTab)].updateDisplay();
        }
    }
    
    /**
     * 未保存の変更があるかチェック
     */
    function hasUnsavedChanges() {
        // 実際のアプリケーションでは、フォームの状態をチェック
        return false;
    }
    
    /**
     * すべてのデータを保存
     */
    function saveAllData() {
        try {
            Storage.saveEvents(dataCache.events);
            Storage.saveMembers(dataCache.members);
            Storage.saveVenues(dataCache.venues);
            Storage.saveAttendanceData(dataCache.attendanceData);
            Storage.saveCarProvisions(dataCache.carProvisions);
            Storage.saveAssignments(dataCache.assignments);
            Storage.saveLogs(dataCache.logs);
            
            UI.showAlert('データを保存しました。', 'success');
        } catch (error) {
            console.error('データの保存でエラーが発生しました:', error);
            UI.showAlert('データの保存でエラーが発生しました。', 'danger');
        }
    }
    
    /**
     * データの同期
     */
    function syncData() {
        try {
            // ストレージからデータを再読み込み
            const currentData = {
                attendanceData: Storage.loadAttendanceData(),
                carProvisions: Storage.loadCarProvisions(),
                assignments: Storage.loadAssignments()
            };
            
            // データが変更されている場合は更新
            let hasChanges = false;
            
            Object.keys(currentData).forEach(key => {
                if (JSON.stringify(currentData[key]) !== JSON.stringify(dataCache[key])) {
                    dataCache[key] = currentData[key];
                    hasChanges = true;
                }
            });
            
            // 変更があった場合は表示を更新
            if (hasChanges) {
                updateProgressStatus();
                
                if (currentTab && FCOjima.Carpool[capitalize(currentTab)] && 
                    FCOjima.Carpool[capitalize(currentTab)].updateDisplay) {
                    FCOjima.Carpool[capitalize(currentTab)].updateDisplay();
                }
            }
        } catch (error) {
            console.error('データ同期でエラーが発生しました:', error);
        }
    }
    
    /**
     * HUBへの遷移
     */
    function goToHub() {
        window.location.href = '../hub/calendar.html';
    }
    
    /**
     * 文字列の最初の文字を大文字にする
     */
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    /**
     * ログの追加
     */
    function addLog(action, details) {
        const log = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            action,
            details,
            module: 'carpool-main',
            eventId: currentEventId
        };
        
        dataCache.logs.unshift(log);
        
        // ログは最新100件まで保持
        if (dataCache.logs.length > 100) {
            dataCache.logs = dataCache.logs.slice(0, 100);
        }
        
        Storage.saveLogs(dataCache.logs);
    }
    
    // 外部から呼び出し可能な関数をエクスポート
    Main.switchTab = switchTab;
    Main.getCurrentTab = () => currentTab;
    Main.getCurrentEvent = () => currentEvent;
    Main.getCurrentEventId = () => currentEventId;
    Main.getDataCache = () => dataCache;
    Main.getProgressStatus = () => progressStatus;
    Main.saveAllData = saveAllData;
    Main.syncData = syncData;
    Main.goToHub = goToHub;
    Main.updateProgressStatus = updateProgressStatus;
    
})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function() {
    // 基盤モジュールの確認
    if (typeof FCOjima === 'undefined' || 
        !FCOjima.Storage || 
        !FCOjima.UI || 
        !FCOjima.Utils) {
        console.error('必要な基盤モジュールが読み込まれていません');
        alert('システムの初期化でエラーが発生しました。ページを再読み込みしてください。');
        return;
    }
    
    // 配車管理メイン機能の初期化
    FCOjima.Carpool.Main.init();
});

// グローバル関数として一部機能を公開
window.goToHub = function() {
    FCOjima.Carpool.Main.goToHub();
};