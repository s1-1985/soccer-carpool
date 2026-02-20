/**
<<<<<<< HEAD
 * FC尾島ジュニア - 配車管理概要機能（Firebase版）
 * イベント選択、進捗管理、データ連携機能
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Overview = FCOjima.Carpool.Overview || {};

// 配車管理概要モジュール
(function() {
    const Overview = FCOjima.Carpool.Overview;
    const Firestore = FCOjima.Firestore;
    const Auth = FCOjima.Auth;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;
    
    // データ
    let currentEvent = null;
    let events = [];
    let members = [];
    let venues = [];
    let carpoolData = null;
    let eventsUnsubscribe = null;
    let membersUnsubscribe = null;
    let carpoolUnsubscribe = null;
    
    /**
     * 配車管理概要機能の初期化
     */
    Overview.init = async function() {
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
            
            // データをリアルタイム監視で読み込み
            await setupRealtimeListeners();
            
            // 選択されたイベントがある場合は設定
            if (selectedEventId) {
                selectEvent(selectedEventId);
            }
            
            // UI要素の初期化
            setupEventListeners();
            updateDisplay();
            
            // モーダルの初期化
            if (UI && UI.initModals) {
                UI.initModals();
            }
            
            console.log('配車管理概要機能を初期化しました（Firebase版）');
            
        } catch (error) {
            console.error('配車管理概要初期化エラー:', error);
            UI.showAlert('配車管理の初期化に失敗しました', 'danger');
        }
    };
    
    /**
     * リアルタイムリスナーの設定
     */
    async function setupRealtimeListeners() {
        // イベントのリアルタイム監視
        eventsUnsubscribe = Firestore.watchEvents((updatedEvents) => {
            events = updatedEvents.filter(event => {
                const eventDate = new Date(event.date);
                const now = new Date();
                // 過去1ヶ月〜未来のイベントのみ表示
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                return eventDate >= oneMonthAgo;
            });
            updateEventSelection();
            updateDisplay();
        });
        
        // メンバーのリアルタイム監視
        membersUnsubscribe = Firestore.watchMembers((updatedMembers) => {
            members = updatedMembers.filter(member => member.status === 'active');
            updateDisplay();
        });
        
        // 会場データを読み込み
        venues = await Firestore.loadVenues();
    }
    
    /**
     * イベントリスナーの設定
     */
    function setupEventListeners() {
        // イベント選択
        const eventSelect = document.getElementById('event-select');
        if (eventSelect) {
            eventSelect.addEventListener('change', function() {
                if (this.value) {
                    selectEvent(this.value);
                }
            });
        }
        
        // 各ステップへのナビゲーション
        const attendanceBtn = document.getElementById('go-to-attendance');
        const carsBtn = document.getElementById('go-to-cars');
        const assignmentBtn = document.getElementById('go-to-assignment');
        const notificationsBtn = document.getElementById('go-to-notifications');
        
        if (attendanceBtn) {
            attendanceBtn.addEventListener('click', () => navigateToStep('attendance'));
        }
        
        if (carsBtn) {
            carsBtn.addEventListener('click', () => navigateToStep('cars'));
        }
        
        if (assignmentBtn) {
            assignmentBtn.addEventListener('click', () => navigateToStep('assignments'));
        }
        
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => navigateToStep('notifications'));
        }
        
        // HUBに戻る
        const backToHubBtn = document.getElementById('back-to-hub');
        if (backToHubBtn) {
            backToHubBtn.addEventListener('click', () => {
                window.location.href = '../hub/index.html';
            });
        }
        
        // データリセット
        const resetDataBtn = document.getElementById('reset-carpool-data');
        if (resetDataBtn) {
            resetDataBtn.addEventListener('click', resetCarpoolData);
        }
        
        // LINE共有
        const shareOverviewBtn = document.getElementById('share-overview');
        if (shareOverviewBtn) {
            shareOverviewBtn.addEventListener('click', shareOverview);
        }
    }
    
    /**
     * イベントを選択
     */
    function selectEvent(eventId) {
        currentEvent = events.find(e => e.id === eventId);
        
        if (!currentEvent) {
            console.warn('指定されたイベントが見つかりません:', eventId);
            return;
        }
        
        // セッションストレージに保存
        sessionStorage.setItem('fc-ojima-selected-event', eventId);
        
        // 配車データをリアルタイム監視
        setupCarpoolDataListener(eventId);
        
        updateDisplay();
    }
    
    /**
     * 配車データのリアルタイム監視を設定
     */
    function setupCarpoolDataListener(eventId) {
        // 既存のリスナーを解除
        if (carpoolUnsubscribe) {
            carpoolUnsubscribe();
        }
        
        // 配車データのリアルタイム監視
        carpoolUnsubscribe = Firestore.watchCarpoolData(eventId, (updatedData) => {
            carpoolData = updatedData;
            updateDisplay();
        });
    }
    
    /**
     * イベント選択肢を更新
     */
    function updateEventSelection() {
        const eventSelect = document.getElementById('event-select');
        if (!eventSelect) return;
        
        // 現在の選択値を保持
        const currentSelection = eventSelect.value;
        
        // 選択肢をクリア
        eventSelect.innerHTML = '<option value="">イベントを選択</option>';
        
        // 日付順でソート（新しい順）
        const sortedEvents = events.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        sortedEvents.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            
            const eventDate = new Date(event.date);
            const dateStr = Utils.formatDate(eventDate);
            const timeStr = event.time ? ` ${event.time}` : '';
            
            option.textContent = `${dateStr}${timeStr} - ${event.title}`;
            
            // 過去のイベントは視覚的に区別
            if (eventDate < new Date()) {
                option.classList.add('past-event');
                option.textContent += ' (終了)';
            }
            
            eventSelect.appendChild(option);
        });
        
        // 選択値を復元
        if (currentSelection) {
            eventSelect.value = currentSelection;
        }
    }
    
    /**
     * 表示を更新
     */
    function updateDisplay() {
        updateEventInfo();
        updateProgress();
        updateStats();
        updateQuickActions();
    }
    
    /**
     * イベント情報を更新
     */
    function updateEventInfo() {
        const eventInfoCard = document.getElementById('event-info-card');
        if (!eventInfoCard) return;
        
        if (!currentEvent) {
            eventInfoCard.innerHTML = `
                <div class="no-event-selected">
                    <p>イベントを選択してください</p>
                    <p class="text-muted">配車管理を開始するには、上記からイベントを選択してください。</p>
                </div>
            `;
            return;
        }
        
        const eventDate = new Date(currentEvent.date);
        const isUpcoming = eventDate > new Date();
        const venue = venues.find(v => v.name === currentEvent.venue);
        
        eventInfoCard.innerHTML = `
            <div class="event-header">
                <h3 class="event-title">${Utils.escapeHTML(currentEvent.title)}</h3>
                <span class="event-type type-${currentEvent.type}">${getEventTypeLabel(currentEvent.type)}</span>
                ${!isUpcoming ? '<span class="badge badge-secondary">終了</span>' : ''}
            </div>
            
            <div class="event-details">
                <div class="event-detail-item">
                    <i class="icon-calendar"></i>
                    <span>${Utils.formatDate(eventDate)}</span>
                    ${currentEvent.time ? `<span class="event-time">${currentEvent.time}</span>` : ''}
                </div>
                
                ${currentEvent.venue ? `
                    <div class="event-detail-item">
                        <i class="icon-location"></i>
                        <span>${Utils.escapeHTML(currentEvent.venue)}</span>
                        ${venue && venue.address ? `<small class="venue-address">${Utils.escapeHTML(venue.address)}</small>` : ''}
                    </div>
                ` : ''}
                
                ${currentEvent.targetGrades && currentEvent.targetGrades.length > 0 ? `
                    <div class="event-detail-item">
                        <i class="icon-users"></i>
                        <span>対象: ${currentEvent.targetGrades.join(', ')}年生</span>
                    </div>
                ` : ''}
                
                ${currentEvent.notes ? `
                    <div class="event-notes">
                        <p>${Utils.escapeHTML(currentEvent.notes)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * 進捗状況を更新
     */
    function updateProgress() {
        const progressCard = document.getElementById('progress-card');
        if (!progressCard || !currentEvent) return;
        
        // 進捗計算
        const progress = calculateProgress();
        
        progressCard.innerHTML = `
            <h4>進捗状況</h4>
            
            <div class="progress-steps">
                <div class="progress-step ${progress.attendance.completed ? 'completed' : 'active'}">
                    <div class="step-icon">${progress.attendance.completed ? '✓' : '1'}</div>
                    <div class="step-content">
                        <h5>出欠確認</h5>
                        <p>${progress.attendance.description}</p>
                        <div class="step-actions">
                            <button onclick="FCOjima.Carpool.Overview.navigateToStep('attendance')" 
                                    class="btn btn-sm ${progress.attendance.completed ? 'btn-success' : 'btn-primary'}">
                                ${progress.attendance.completed ? '確認・編集' : '開始'}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="progress-step ${progress.cars.completed ? 'completed' : (progress.attendance.completed ? 'active' : 'disabled')}">
                    <div class="step-icon">${progress.cars.completed ? '✓' : '2'}</div>
                    <div class="step-content">
                        <h5>車両提供</h5>
                        <p>${progress.cars.description}</p>
                        <div class="step-actions">
                            <button onclick="FCOjima.Carpool.Overview.navigateToStep('cars')" 
                                    class="btn btn-sm ${progress.cars.completed ? 'btn-success' : 'btn-primary'}"
                                    ${progress.attendance.completed ? '' : 'disabled'}>
                                ${progress.cars.completed ? '確認・編集' : '開始'}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="progress-step ${progress.assignments.completed ? 'completed' : (progress.cars.completed ? 'active' : 'disabled')}">
                    <div class="step-icon">${progress.assignments.completed ? '✓' : '3'}</div>
                    <div class="step-content">
                        <h5>座席割り当て</h5>
                        <p>${progress.assignments.description}</p>
                        <div class="step-actions">
                            <button onclick="FCOjima.Carpool.Overview.navigateToStep('assignments')" 
                                    class="btn btn-sm ${progress.assignments.completed ? 'btn-success' : 'btn-primary'}"
                                    ${progress.cars.completed ? '' : 'disabled'}>
                                ${progress.assignments.completed ? '確認・編集' : '開始'}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="progress-step ${progress.notifications.completed ? 'completed' : (progress.assignments.completed ? 'active' : 'disabled')}">
                    <div class="step-icon">${progress.notifications.completed ? '✓' : '4'}</div>
                    <div class="step-content">
                        <h5>連絡配信</h5>
                        <p>${progress.notifications.description}</p>
                        <div class="step-actions">
                            <button onclick="FCOjima.Carpool.Overview.navigateToStep('notifications')" 
                                    class="btn btn-sm ${progress.notifications.completed ? 'btn-success' : 'btn-primary'}"
                                    ${progress.assignments.completed ? '' : 'disabled'}>
                                ${progress.notifications.completed ? '確認・編集' : '開始'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="overall-progress">
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress.overall.percentage}%"></div>
                </div>
                <span class="progress-text">${progress.overall.percentage}% 完了</span>
            </div>
        `;
    }
    
    /**
     * 進捗を計算
     */
    function calculateProgress() {
        if (!carpoolData) {
            return {
                attendance: { completed: false, description: '出欠確認を開始してください' },
                cars: { completed: false, description: '車両提供者の募集を開始してください' },
                assignments: { completed: false, description: '座席割り当てを行ってください' },
                notifications: { completed: false, description: '配車情報を共有してください' },
                overall: { percentage: 0 }
            };
        }
        
        const attendance = carpoolData.attendance || {};
        const cars = carpoolData.cars || [];
        const assignments = carpoolData.assignments || {};
        const notifications = carpoolData.notifications || [];
        
        // 出欠確認の進捗
        const attendanceCount = Object.keys(attendance).length;
        const attendingCount = Object.values(attendance).filter(status => status === 'attending').length;
        const attendanceCompleted = attendanceCount > 0;
        
        // 車両提供の進捗
        const carsCount = cars.length;
        const totalSeats = cars.reduce((sum, car) => sum + (car.seats || 0), 0);
        const carsCompleted = carsCount > 0 && totalSeats >= attendingCount;
        
        // 座席割り当ての進捗
        const assignedCount = Object.values(assignments).flat().filter(seat => seat).length;
        const assignmentsCompleted = assignedCount >= attendingCount;
        
        // 連絡配信の進捗
        const notificationsCompleted = notifications.length > 0;
        
        // 全体進捗
        const completedSteps = [attendanceCompleted, carsCompleted, assignmentsCompleted, notificationsCompleted].filter(Boolean).length;
        const overallPercentage = (completedSteps / 4) * 100;
        
        return {
            attendance: {
                completed: attendanceCompleted,
                description: attendanceCompleted ? 
                    `回答: ${attendanceCount}名 / 参加予定: ${attendingCount}名` : 
                    '出欠確認を開始してください'
            },
            cars: {
                completed: carsCompleted,
                description: carsCompleted ? 
                    `車両: ${carsCount}台 / 座席: ${totalSeats}席` : 
                    '車両提供者の募集を開始してください'
            },
            assignments: {
                completed: assignmentsCompleted,
                description: assignmentsCompleted ? 
                    `割り当て済み: ${assignedCount}名` : 
                    '座席割り当てを行ってください'
            },
            notifications: {
                completed: notificationsCompleted,
                description: notificationsCompleted ? 
                    '配車情報を共有済み' : 
                    '配車情報を共有してください'
            },
            overall: {
                percentage: Math.round(overallPercentage)
            }
        };
    }
    
    /**
     * 統計情報を更新
     */
    function updateStats() {
        const statsCard = document.getElementById('stats-card');
        if (!statsCard || !currentEvent) return;
        
        const attendance = carpoolData?.attendance || {};
        const cars = carpoolData?.cars || [];
        
        const attendingCount = Object.values(attendance).filter(status => status === 'attending').length;
        const absentCount = Object.values(attendance).filter(status => status === 'absent').length;
        const pendingCount = Object.values(attendance).filter(status => status === 'pending').length;
        
        const totalSeats = cars.reduce((sum, car) => sum + (car.seats || 0), 0);
        const availableSeats = Math.max(0, totalSeats - attendingCount);
        
        statsCard.innerHTML = `
            <h4>統計情報</h4>
            
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${attendingCount}</div>
                    <div class="stat-label">参加予定</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${cars.length}</div>
                    <div class="stat-label">車両台数</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${totalSeats}</div>
                    <div class="stat-label">総座席数</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${availableSeats}</div>
                    <div class="stat-label">空き座席</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${absentCount}</div>
                    <div class="stat-label">不参加</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${pendingCount}</div>
                    <div class="stat-label">未回答</div>
                </div>
            </div>
            
            ${totalSeats < attendingCount ? `
                <div class="alert alert-warning">
                    <strong>座席不足:</strong> ${attendingCount - totalSeats}席足りません
                </div>
            ` : ''}
            
            ${availableSeats > 5 ? `
                <div class="alert alert-info">
                    <strong>座席に余裕があります:</strong> ${availableSeats}席の空きがあります
                </div>
            ` : ''}
        `;
    }
    
    /**
     * クイックアクションを更新
     */
    function updateQuickActions() {
        const quickActionsCard = document.getElementById('quick-actions-card');
        if (!quickActionsCard || !currentEvent) return;
        
        const progress = calculateProgress();
        
        quickActionsCard.innerHTML = `
            <h4>クイックアクション</h4>
            
            <div class="quick-actions-grid">
                <button onclick="FCOjima.Carpool.Overview.shareOverview()" class="btn btn-info">
                    📱 概要をLINE共有
                </button>
                
                <button onclick="FCOjima.Carpool.Overview.exportData()" class="btn btn-success">
                    📊 データエクスポート
                </button>
                
                <button onclick="FCOjima.Carpool.Overview.duplicateFromPrevious()" class="btn btn-secondary">
                    📋 前回から複製
                </button>
                
                <button onclick="FCOjima.Carpool.Overview.resetCarpoolData()" class="btn btn-danger">
                    🗑️ データリセット
                </button>
            </div>
            
            ${progress.overall.percentage === 100 ? `
                <div class="completion-banner">
                    <h5>🎉 配車管理完了！</h5>
                    <p>すべての手順が完了しました。お疲れさまでした！</p>
                </div>
            ` : ''}
        `;
    }
    
    /**
     * ステップに移動
     */
    Overview.navigateToStep = function(step) {
        if (!currentEvent) {
            UI.showAlert('イベントを選択してください', 'warning');
            return;
        }
        
        // セッションストレージにイベントIDを保存
        sessionStorage.setItem('fc-ojima-selected-event', currentEvent.id);
        
        // 対応するページに移動
        const pageMap = {
            'attendance': 'attendance.html',
            'cars': 'cars.html',
            'assignments': 'assignments.html',
            'notifications': 'notifications.html'
        };
        
        if (pageMap[step]) {
            window.location.href = pageMap[step];
        }
    };
    
    /**
     * イベントタイプのラベルを取得
     */
    function getEventTypeLabel(type) {
        const labels = {
            match: '試合',
            practice: '練習',
            other: 'その他'
        };
        return labels[type] || type;
    }
    
    /**
     * 概要をLINE共有
     */
    Overview.shareOverview = function() {
        if (!currentEvent) {
            UI.showAlert('イベントを選択してください', 'warning');
            return;
        }
        
        const progress = calculateProgress();
        const eventDate = Utils.formatDate(new Date(currentEvent.date));
        
        let shareText = `【配車管理 - ${currentEvent.title}】\n`;
        shareText += `📅 ${eventDate} ${currentEvent.time || ''}\n`;
        shareText += `📍 ${currentEvent.venue || '会場未定'}\n\n`;
        
        shareText += `📊 進捗状況 (${progress.overall.percentage}%完了)\n`;
        shareText += `${progress.attendance.completed ? '✅' : '⏳'} 出欠確認: ${progress.attendance.description}\n`;
        shareText += `${progress.cars.completed ? '✅' : '⏳'} 車両提供: ${progress.cars.description}\n`;
        shareText += `${progress.assignments.completed ? '✅' : '⏳'} 座席割り当て: ${progress.assignments.description}\n`;
        shareText += `${progress.notifications.completed ? '✅' : '⏳'} 連絡配信: ${progress.notifications.description}\n\n`;
        
        shareText += `配車管理ページ: ${window.location.href}`;
        
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`;
        window.open(lineUrl, '_blank');
        
        UI.showAlert('概要をLINEで共有しました', 'success');
    };
    
    /**
     * データをエクスポート
     */
    Overview.exportData = function() {
        if (!currentEvent || !carpoolData) {
            UI.showAlert('エクスポートするデータがありません', 'warning');
            return;
        }
        
        const exportData = {
            event: currentEvent,
            carpoolData: carpoolData,
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        
        link.href = URL.createObjectURL(blob);
        link.download = `carpool-${currentEvent.id}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        UI.showAlert('データをエクスポートしました', 'success');
    };
    
    /**
     * 前回イベントから複製
     */
    Overview.duplicateFromPrevious = function() {
        if (!currentEvent) {
            UI.showAlert('イベントを選択してください', 'warning');
            return;
        }
        
        UI.showAlert('前回データからの複製機能は開発中です', 'info');
    };
    
    /**
     * 配車データをリセット
     */
    Overview.resetCarpoolData = function() {
        if (!currentEvent) {
            UI.showAlert('イベントを選択してください', 'warning');
            return;
        }
        
        if (!confirm('このイベントの配車データをすべてリセットしますか？\n※この操作は取り消せません')) {
            return;
        }
        
        // 権限チェック
        if (!Auth.hasPermission('manager')) {
            UI.showAlert('データリセットの権限がありません', 'danger');
            return;
        }
        
        // Firestoreからデータを削除
        Firestore.deleteDocument('carpool', currentEvent.id)
            .then(() => {
                UI.showAlert('配車データをリセットしました', 'success');
                Firestore.addLog('carpool', `イベント「${currentEvent.title}」の配車データをリセットしました`);
            })
            .catch(error => {
                console.error('データリセットエラー:', error);
                UI.showAlert('データリセットに失敗しました', 'danger');
            });
    };
    
    /**
     * 公開関数
     */
    Overview.navigateToStep = Overview.navigateToStep;
    Overview.shareOverview = Overview.shareOverview;
    Overview.exportData = Overview.exportData;
    Overview.duplicateFromPrevious = Overview.duplicateFromPrevious;
    Overview.resetCarpoolData = Overview.resetCarpoolData;
    
    /**
     * 表示の更新（外部から呼び出し可能）
     */
    Overview.updateDisplay = updateDisplay;
    
    /**
     * クリーンアップ
     */
    Overview.destroy = function() {
        if (eventsUnsubscribe) {
            eventsUnsubscribe();
            eventsUnsubscribe = null;
        }
        
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
    window.addEventListener('beforeunload', Overview.destroy);
    
})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function() {
    if (typeof FCOjima !== 'undefined' && FCOjima.Carpool && FCOjima.Carpool.Overview) {
        FCOjima.Carpool.Overview.init();
    }
});
=======
 * FC尾島ジュニア - 配車管理ページ 概要タブの機能
 * イベント概要情報の表示と管理を行う
 */

FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Overview = FCOjima.Carpool.Overview || {};

(function(app) {
    // 名前空間のショートカット
    var Overview = app.Carpool.Overview;
    var Utils = app.Utils;
    var UI = app.UI;
    var Storage = app.Storage;
    
    /**
     * 概要機能の初期化
     */
    Overview.init = function() {
        console.log('配車管理概要機能を初期化しています...');
        
        // イベントデータの初期化
        this.initEventData();
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        console.log('配車管理概要機能の初期化が完了しました');
    };
    
    /**
     * イベントリスナーの設定
     */
    Overview.setupEventListeners = function() {
        console.log('概要タブのイベントリスナーを設定しています...');
        
        // HUBに戻るボタン
        document.getElementById('back-to-hub').addEventListener('click', function() {
            Overview.goToMainPage();
        });
        
        // イベント共有ボタン
        document.getElementById('share-event-button').addEventListener('click', function() {
            Overview.shareEventViaLINE();
        });
        
        console.log('概要タブのイベントリスナー設定が完了しました');
    };
    
    /**
     * イベントデータを初期化
     */
    Overview.initEventData = function() {
        console.log('イベントデータを初期化します...');
        
        var event = Storage.getSelectedEvent();
        if (event) {
            this.displayEventData(event);
            
            // イベントIDを保存
            app.Carpool.appData.eventId = event.id;
            
            // イベント固有のデータをロード
            app.Carpool.loadData();
            
            console.log('イベントデータを読み込みました: ID=' + event.id + ', タイトル=' + event.title);
            
            // 車提供タブとアサインメントタブでも簡易情報を表示
            var carEventInfo = document.getElementById('carEventInfo');
            if (carEventInfo) {
                carEventInfo.innerHTML = '\
                    <div class="event-summary">\
                        <strong>' + UI.escapeHTML(event.title) + '</strong> \
                        (' + Utils.formatDateForDisplay(event.date) + ' ' + (event.startTime || '') + ')\
                    </div>';
            }
            
            var assignmentEventInfo = document.getElementById('assignmentEventInfo');
            if (assignmentEventInfo) {
                assignmentEventInfo.innerHTML = '\
                    <div class="event-summary">\
                        <strong>' + UI.escapeHTML(event.title) + '</strong> \
                        (' + Utils.formatDateForDisplay(event.date) + ' ' + (event.startTime || '') + ')\
                    </div>';
            }
            
            // 状況サマリーを更新
            this.updateStatusSummary();
        } else {
            var eventSummary = document.getElementById('event-summary');
            if (eventSummary) {
                eventSummary.innerHTML = UI.createAlert('info', 'イベントが選択されていません。HUBページからイベントを選択してください。');
            }
            console.log('選択されたイベントがありません');
        }
    };
    
    /**
     * イベントデータを表示
     * @param {Object} event - イベントオブジェクト
     */
    Overview.displayEventData = function(event) {
        console.log('イベントデータを表示します: ID=' + event.id + ', タイトル=' + event.title);
        
        // イベントタイトルをヘッダーに表示
        var header = document.getElementById('event-header');
        if (header) {
            var date = Utils.formatDateForDisplay(event.date);
            header.textContent = date + ' ' + event.title;
        }
        
        // 概要タブにイベント情報を表示
        var eventSummary = document.getElementById('event-summary');
        if (eventSummary) {
            // イベントタイプのバッジ
            var typeLabel = Utils.getEventTypeLabel(event.type);
            var typeBadge = `<span class="event-type-badge ${event.type}">${typeLabel}</span>`;
            
            // 学年ターゲット表示
            var targetDisplay = '';
            if (event.target && event.target.length > 0) {
                var targetGrades = event.target.map(function(grade) {
                    return Utils.getGradeLabel(grade);
                }).join(', ');
                
                targetDisplay = `
                <div class="detail-row">
                    <div class="detail-label">対象:</div>
                    <div class="detail-value">
                        <div class="target-grades">
                            ${targetGrades}
                        </div>
                    </div>
                </div>`;
                
                if (event.targetNotes) {
                    targetDisplay += `
                    <div class="detail-row">
                        <div class="detail-label">対象備考:</div>
                        <div class="detail-value">${UI.escapeHTML(event.targetNotes)}</div>
                    </div>`;
                }
            }
            
            // 日時情報
            var dateTimeInfo = `
            <div class="date-time-info">
                <div class="date-time-item">
                    <div class="date-time-label">日付</div>
                    <div class="date-time-value">${Utils.formatDateForDisplay(event.date)}</div>
                </div>`;
            
            if (event.startTime) {
                dateTimeInfo += `
                <div class="date-time-item">
                    <div class="date-time-label">時間</div>
                    <div class="date-time-value">${event.startTime}${event.endTime ? ' - ' + event.endTime : ''}</div>
                </div>`;
            }
            
            if (event.departureTime) {
                dateTimeInfo += `
                <div class="date-time-item">
                    <div class="date-time-label">出発時間</div>
                    <div class="date-time-value">${event.departureTime}</div>
                </div>`;
            }
            
            dateTimeInfo += '</div>';
            
            // 場所情報
            var locationInfo = '<div class="location-info">';
            
            if (event.meetingPlace) {
                // 会場登録データから住所を検索
                var venues = Storage.loadVenues();
                var meetingVenue = venues.find(function(v) {
                    return v.name === event.meetingPlace;
                });
                
                var mapButton = meetingVenue ? 
                    '<button type="button" class="map-button" onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' + 
                    encodeURIComponent(meetingVenue.address) + '\', \'_blank\')">Google Mapで開く</button>' : 
                    '';
                
                locationInfo += `
                <div class="location-item">
                    <div class="location-label">集合場所</div>
                    <div class="location-value">
                        <span>${UI.escapeHTML(event.meetingPlace)}</span>
                        ${mapButton}
                    </div>
                </div>`;
            }
            
            if (event.venue) {
                // 会場登録データから住所を検索
                var venues = Storage.loadVenues();
                var venue = venues.find(function(v) {
                    return v.name === event.venue;
                });
                
                var mapButton = venue ? 
                    '<button type="button" class="map-button" onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' + 
                    encodeURIComponent(venue.address) + '\', \'_blank\')">Google Mapで開く</button>' : 
                    '';
                
                locationInfo += `
                <div class="location-item">
                    <div class="location-label">会場</div>
                    <div class="location-value">
                        <span>${UI.escapeHTML(event.venue)}</span>
                        ${mapButton}
                    </div>
                </div>`;
            }
            
            locationInfo += '</div>';
            
            // 出欠回答期限
            var deadlineInfo = '';
            if (event.attendanceDeadline) {
                var deadlineDate = new Date(event.attendanceDeadline);
                var formattedDeadline = deadlineDate.toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                var now = new Date();
                var isExpired = deadlineDate < now;
                
                deadlineInfo = `
                <div class="deadline-box ${isExpired ? 'expired' : ''}">
                    <div>
                        <span class="deadline-icon">⏰</span>
                        出欠回答期限: ${formattedDeadline}
                    </div>
                    <div class="deadline-action">
                        <a href="attendance.html" class="button">出欠確認へ</a>
                    </div>
                </div>`;
            }
            
            // 備考
            var notesSection = '';
            if (event.notes) {
                notesSection = `
                <div class="notes-section">
                    <h3>備考</h3>
                    <div class="notes-content">${UI.escapeHTML(event.notes)}</div>
                </div>`;
            }
            
            // イベント詳細カードを表示
            eventSummary.innerHTML = `
                <div class="event-detail-card">
                    <h1 class="event-title">
                        ${UI.escapeHTML(event.title)}
                        ${typeBadge}
                    </h1>
                    
                    ${deadlineInfo}
                    ${dateTimeInfo}
                    ${locationInfo}
                    ${targetDisplay}
                    ${notesSection}
                </div>`;
        }
    };
    
    /**
     * 状況サマリーを更新
     */
    Overview.updateStatusSummary = function() {
        console.log('状況サマリーを更新します...');
        
        var statusSummary = document.getElementById('status-summary');
        if (!statusSummary) {
            console.log('状況サマリー要素が見つかりません');
            return;
        }
        
        var eventData = app.Carpool.appData;
        
        // 出欠状況の集計
        var attendance = eventData.attendance || [];
        var totalMembers = attendance.length;
        var respondedMembers = attendance.filter(function(a) { 
            return a.status === 'present' || a.status === 'absent';
        }).length;
        var presentMembers = attendance.filter(function(a) { return a.status === 'present'; }).length;
        
        // 車両提供状況の集計
        var carRegistrations = eventData.carRegistrations || [];
        var totalCars = carRegistrations.length;
        var availableCars = carRegistrations.filter(function(c) { return c.canDrive !== 'no'; }).length;
        var totalSeats = carRegistrations.reduce(function(sum, car) {
            if (car.canDrive === 'no') return sum;
            return sum + (parseInt(car.frontSeat) || 0) + 
                   (parseInt(car.middleSeat) || 0) + 
                   (parseInt(car.backSeat) || 0);
        }, 0);
        
        // 割り当て状況の集計
        var assignments = eventData.assignments || [];
        var assignedMembers = 0;
        
        assignments.forEach(function(assignment) {
            if (!assignment.seats) return;
            
            Object.keys(assignment.seats).forEach(function(seatType) {
                Object.keys(assignment.seats[seatType]).forEach(function(seatIndex) {
                    if (assignment.seats[seatType][seatIndex]) {
                        assignedMembers++;
                    }
                });
            });
        });
        
        // サマリーを表示
        statusSummary.innerHTML = `
            <div class="status-cards">
                <div class="status-card">
                    <h3>出欠状況</h3>
                    <div class="status-stats">
                        <div class="stat-item">
                            <div class="stat-value">${respondedMembers}/${totalMembers}</div>
                            <div class="stat-label">回答済み</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${presentMembers}</div>
                            <div class="stat-label">参加者</div>
                        </div>
                    </div>
                    <div class="status-actions">
                        <a href="attendance.html" class="button">出欠確認へ</a>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>車両状況</h3>
                    <div class="status-stats">
                        <div class="stat-item">
                            <div class="stat-value">${availableCars}/${totalCars}</div>
                            <div class="stat-label">提供可能車両</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${totalSeats}</div>
                            <div class="stat-label">座席数</div>
                        </div>
                    </div>
                    <div class="status-actions">
                        <a href="cars.html" class="button">車提供へ</a>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>割り当て状況</h3>
                    <div class="status-stats">
                        <div class="stat-item">
                            <div class="stat-value">${assignedMembers}/${presentMembers}</div>
                            <div class="stat-label">割り当て済み</div>
                        </div>
                    </div>
                    <div class="status-actions">
                        <a href="assignments.html" class="button">割り当てへ</a>
                    </div>
                </div>
            </div>
        `;
        
        console.log('状況サマリーの更新が完了しました');
    };
    
    /**
     * イベント情報をLINEで共有
     */
    Overview.shareEventViaLINE = function() {
        console.log('イベント情報をLINEで共有します...');
        
        var event = Storage.getSelectedEvent();
        if (!event) {
            UI.showAlert('イベント情報が見つかりません');
            return;
        }
        
        // 共有メッセージを生成
        var message = '【イベント情報】\n';
        message += Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        
        if (event.type) {
            message += '種類: ' + Utils.getEventTypeLabel(event.type) + '\n';
        }
        
        if (event.target && event.target.length > 0) {
            var targetGrades = event.target.map(function(grade) {
                return Utils.getGradeLabel(grade);
            }).join(', ');
            message += '対象: ' + targetGrades + '\n';
        }
        
        if (event.attendanceDeadline) {
            var deadlineDate = new Date(event.attendanceDeadline);
            var formattedDeadline = deadlineDate.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            message += '出欠回答期限: ' + formattedDeadline + '\n';
        }
        
        if (event.departureTime) {
            message += '出発時間: ' + event.departureTime + '\n';
        }
        
        if (event.meetingPlace) {
            message += '集合場所: ' + event.meetingPlace + '\n';
        }
        
        if (event.venue) {
            message += '会場: ' + event.venue + '\n';
        }
        
        if (event.startTime) {
            message += '時間: ' + event.startTime + (event.endTime ? ' - ' + event.endTime : '') + '\n';
        }
        
        if (event.notes) {
            message += '\n備考:\n' + event.notes + '\n';
        }
        
        // テキストをクリップボードにコピー
        if (Utils.copyToClipboard(message)) {
            UI.showAlert('イベント情報をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
            
            // LINEでの共有（モバイルのみ）
            if (Utils.shareViaLINE(message)) {
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
    };
    
    /**
     * メインページに戻る
     */
    Overview.goToMainPage = function() {
        console.log('HUBページに戻ります...');
        window.location.href = '../hub/index.html';
    };

    /**
     * イベント概要を指定コンテナに表示（他タブから呼ばれる）
     * @param {string} containerId - 表示先要素ID
     */
    Overview.displayEventSummary = function(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var event = Storage.getSelectedEvent();
        if (!event) {
            container.innerHTML = UI.createAlert('info', 'イベントが選択されていません。');
            return;
        }
        container.className = 'event-summary ' + (event.type || 'other');
        container.innerHTML = '<strong>' + UI.escapeHTML(event.title) + '</strong>' +
            ' (' + Utils.formatDateForDisplay(event.date) + ' ' + (event.startTime || '') + ')';
    };

    /**
     * イベントデータをロード（carRegistrations/assignments/attendance/notifications）
     */
    app.Carpool.loadData = function() {
        var event = Storage.getSelectedEvent();
        if (!event) return;
        this.appData.eventId = event.id;
        var data = Storage.loadEventData(event.id);
        this.appData.carRegistrations = data.carRegistrations || [];
        this.appData.assignments     = data.assignments     || [];
        this.appData.attendance      = data.attendance      || [];
        this.appData.notifications   = data.notifications   || [];
        console.log('イベントデータをロードしました: eventId=' + event.id);
    };

    /**
     * イベントデータを保存（localStorage + Firestore）
     */
    app.Carpool.saveData = function() {
        var eventId = this.appData.eventId;
        if (!eventId) {
            var event = Storage.getSelectedEvent();
            if (event) eventId = event.id;
        }
        if (!eventId) return;
        var data = {
            carRegistrations: this.appData.carRegistrations,
            assignments:      this.appData.assignments,
            attendance:       this.appData.attendance,
            notifications:    this.appData.notifications
        };
        // localStorageに保存
        Storage.saveEventData(eventId, data);
        // Firestoreにも保存
        if (window.FCOjima && FCOjima.DB && FCOjima.DB.saveEventData) {
            FCOjima.DB.saveEventData(eventId, data).catch(function(e) {
                console.warn('Firestore saveEventData失敗:', e);
            });
        }
        console.log('イベントデータを保存しました: eventId=' + eventId);
    };

    /**
     * メンバーを FCOjima.Carpool.members にロード
     */
    app.Carpool.loadMembers = function() {
        this.members = Storage.loadMembers();
        console.log('メンバーをロードしました: ' + this.members.length + '人');
    };

})(window.FCOjima);
>>>>>>> 3f29fdc53b2c8f871d428ea6715327a2f2c4429e
