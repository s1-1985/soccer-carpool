/**
<<<<<<< HEAD
 * FC尾島ジュニア - カレンダー機能
 * Firebase連携による完全なカレンダー管理システム
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Calendar = FCOjima.Hub.Calendar || {};

(function() {
    'use strict';
    
    const Calendar = FCOjima.Hub.Calendar;
    
    // グローバル変数
    let currentDate = new Date();
    let currentView = 'calendar'; // 'calendar' or 'list'
    let events = [];
    let eventsUnsubscribe = null;
=======
 * FC尾島ジュニア - カレンダータブの機能
 * カレンダーとイベント管理に関する機能を提供
 */

FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Calendar = FCOjima.Hub.Calendar || {};

(function(app) {
    // 名前空間のショートカット
    var Calendar = app.Hub.Calendar;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;
>>>>>>> 3f29fdc53b2c8f871d428ea6715327a2f2c4429e
    
    /**
     * カレンダー機能の初期化
     */
<<<<<<< HEAD
    function initCalendar() {
        console.log('📅 カレンダー機能を初期化中...');
        
        try {
            // DOM要素の確認
            const calendarBody = document.getElementById('calendar-body');
            if (!calendarBody) {
                const errorMsg = 'カレンダーボディ要素（#calendar-body）が見つかりません';
                console.error('❌', errorMsg);
                
                // エラー表示用の要素を作成
                const errorDiv = document.createElement('div');
                errorDiv.className = 'calendar-error';
                errorDiv.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #dc3545; background: rgba(220, 53, 69, 0.1); border-radius: 8px; margin: 20px;">
                        <h3>⚠️ カレンダー初期化エラー</h3>
                        <p>${errorMsg}</p>
                        <p>ページを再読み込みしてください。</p>
                    </div>
                `;
                
                // main-contentに追加を試行
                const mainContent = document.querySelector('.main-content') || document.body;
                mainContent.appendChild(errorDiv);
                return;
            }
            
            // 必須DOM要素の存在確認
            const requiredElements = [
                'prev-month', 'next-month', 'current-month-year',
                'calendar-view-btn', 'list-view-btn', 'add-event-btn'
            ];
            
            const missingElements = requiredElements.filter(id => !document.getElementById(id));
            if (missingElements.length > 0) {
                console.warn('⚠️ 一部のDOM要素が見つかりません:', missingElements);
            }
            
            // 初期表示の設定
            setupEventListeners();
            updateDisplay(); // まず空のカレンダーを表示
            loadEvents(); // その後でイベントを読み込み
            
            console.log('✅ カレンダー機能の初期化完了');
            
        } catch (error) {
            console.error('💥 カレンダー初期化で予期しないエラーが発生:', error);
            
            // フォールバック：基本的なエラーメッセージを表示
            const container = document.getElementById('calendar-content') || document.body;
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545; background: rgba(220, 53, 69, 0.1); border-radius: 8px;">
                    <h3>💥 システムエラー</h3>
                    <p>カレンダーの初期化に失敗しました。</p>
                    <p>開発者ツール（F12）でコンソールを確認してください。</p>
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        ページを再読み込み
                    </button>
                </div>
            `;
        }
    }
=======
    Calendar.init = function() {
        console.log('カレンダー機能を初期化しています...');
        
        // データの読み込み
        app.Hub.events = Storage.loadEvents();
        
        // 現在の日付を設定
        app.Hub.currentDate = new Date();
        
        // カレンダーの描画
        this.renderCalendar();
        
        // リストビューの描画
        this.renderEventsList();
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        console.log('カレンダー機能の初期化が完了しました');
    };
>>>>>>> 3f29fdc53b2c8f871d428ea6715327a2f2c4429e
    
    /**
     * イベントリスナーの設定
     */
<<<<<<< HEAD
    function setupEventListeners() {
        // 月ナビゲーション
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                try {
                    console.log('📅 前月に移動中...');
                    currentDate.setMonth(currentDate.getMonth() - 1);
                    updateDisplay();
                    console.log('✅ 前月への移動完了:', formatDate(currentDate));
                } catch (error) {
                    console.error('💥 前月移動エラー:', error);
                    showErrorMessage('前月への移動に失敗しました');
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                try {
                    console.log('📅 次月に移動中...');
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    updateDisplay();
                    console.log('✅ 次月への移動完了:', formatDate(currentDate));
                } catch (error) {
                    console.error('💥 次月移動エラー:', error);
                    showErrorMessage('次月への移動に失敗しました');
                }
            });
        }
        
        // 表示切り替え
        const calendarViewBtn = document.getElementById('calendar-view-btn');
        const listViewBtn = document.getElementById('list-view-btn');
        
        if (calendarViewBtn) {
            calendarViewBtn.addEventListener('click', () => {
                currentView = 'calendar';
                updateViewButtons();
                updateDisplay();
            });
        }
        
        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => {
                currentView = 'list';
                updateViewButtons();
                updateDisplay();
            });
        }
        
        // イベント追加ボタン
        const addEventBtn = document.getElementById('add-event-btn');
        if (addEventBtn) {
            addEventBtn.addEventListener('click', () => {
                openEventModal();
            });
        }
        
        // イベント保存ボタン
        const saveEventBtn = document.getElementById('save-event');
        if (saveEventBtn) {
            saveEventBtn.addEventListener('click', saveEvent);
        }
        
        // モーダルを閉じるボタン
        const closeButtons = document.querySelectorAll('.close-modal');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', closeEventModal);
        });
        
        // モーダル外クリック
        const modal = document.getElementById('event-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeEventModal();
                }
            });
        }
    }
    
    /**
     * 表示の更新
     */
    function updateDisplay() {
        updateMonthYear();
        updateViewButtons();
        
        if (currentView === 'calendar') {
            renderCalendarView();
        } else {
            renderListView();
        }
    }
    
    /**
     * 月年表示の更新
     */
    function updateMonthYear() {
        const monthYearElement = document.getElementById('current-month-year');
        if (monthYearElement) {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            monthYearElement.textContent = `${year}年 ${month}月`;
        }
    }
    
    /**
     * 表示切り替えボタンの更新
     */
    function updateViewButtons() {
        const calendarViewBtn = document.getElementById('calendar-view-btn');
        const listViewBtn = document.getElementById('list-view-btn');
        
        if (calendarViewBtn && listViewBtn) {
            // すべてのボタンからactiveクラスを削除
            calendarViewBtn.classList.remove('active');
            listViewBtn.classList.remove('active');
            
            // 現在のビューに対応するボタンにactiveクラスを追加
            if (currentView === 'calendar') {
                calendarViewBtn.classList.add('active');
            } else if (currentView === 'list') {
                listViewBtn.classList.add('active');
            }
        }
    }

    /**
     * カレンダー表示の生成
     */
    function renderCalendarView() {
        console.log('🔍 renderCalendarView() 開始');
        const calendarBody = document.getElementById('calendar-body');
        if (!calendarBody) {
            console.error('❌ calendar-body要素が見つかりません');
            return;
        }
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        console.log(`📅 カレンダー生成: ${year}年 ${month + 1}月`);
        
        // 月の最初の日と最後の日
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // カレンダーボディをクリア
        calendarBody.innerHTML = '';
        
        // 前月の空白セル
        const startDayOfWeek = firstDay.getDay();
        for (let i = 0; i < startDayOfWeek; i++) {
            calendarBody.appendChild(createDayElement(null, true));
        }
        
        // 当月の日付セル
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const cellDate = new Date(year, month, day);
            const dateStr = formatDate(cellDate);
            const dayEvents = getEventsForDate(dateStr);
            const isToday = isDateToday(cellDate);
            
            calendarBody.appendChild(createDayElement(day, false, dateStr, dayEvents, isToday));
        }
        
        // 次月の空白セル（6週間のグリッドを完成させる）
        const totalCells = 42; // 6週間 × 7日
        const currentCells = startDayOfWeek + lastDay.getDate();
        const remainingCells = totalCells - currentCells;
        
        for (let i = 0; i < remainingCells; i++) {
            calendarBody.appendChild(createDayElement(null, true));
        }
        
        console.log('✅ カレンダーHTML生成完了');
        console.log('Generated cells:', totalCells);
        
        // イベントリスナーを追加
        addCalendarEventListeners();
    }
    
    /**
     * 日付セル要素を作成
     */
    function createDayElement(day, isEmpty = false, dateStr = '', dayEvents = [], isToday = false) {
        const cell = document.createElement('div');
        cell.className = `calendar-cell ${isEmpty ? 'empty' : ''} ${isToday ? 'today' : ''}`;
        
        if (!isEmpty) {
            cell.setAttribute('data-date', dateStr);
            
            // 日付番号
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            cell.appendChild(dayNumber);
            
            // イベント表示エリア
            const eventsDiv = document.createElement('div');
            eventsDiv.className = 'events';
            
            // イベント表示（最大3個）
            const maxEvents = 3;
            dayEvents.slice(0, maxEvents).forEach(event => {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'event';
                eventDiv.setAttribute('data-event-id', event.id);
                eventDiv.textContent = event.title;
                eventsDiv.appendChild(eventDiv);
            });
            
            // 追加イベント表示
            if (dayEvents.length > maxEvents) {
                const moreEventsDiv = document.createElement('div');
                moreEventsDiv.className = 'more-events';
                moreEventsDiv.textContent = `他${dayEvents.length - maxEvents}件`;
                eventsDiv.appendChild(moreEventsDiv);
            }
            
            cell.appendChild(eventsDiv);
        }
        
        return cell;
    }
    
    /**
     * カレンダーイベントリスナーの追加
     */
    function addCalendarEventListeners() {
        // 日付セルクリック
        const cells = document.querySelectorAll('.calendar-cell:not(.empty)');
        cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                if (e.target.classList.contains('event')) return;
                
                const dateStr = cell.dataset.date;
                if (dateStr) {
                    openEventModal(dateStr);
                }
            });
        });
        
        // イベントクリック
        const eventElements = document.querySelectorAll('.event');
        eventElements.forEach(element => {
            element.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = element.dataset.eventId;
                showEventDetails(eventId);
            });
        });
    }
    
    /**
     * リスト表示の生成
     */
    function renderListView() {
        const container = document.getElementById('calendar-content');
        if (!container) return;
        
        const monthEvents = getFilteredEvents();
        
        let html = '<div class="events-list">';
        
        if (monthEvents.length === 0) {
            html += '<div class="no-events">この月にイベントがありません</div>';
        } else {
            monthEvents.forEach(event => {
                const eventDate = new Date(event.date);
                html += `
                    <div class="event-item" data-event-id="${event.id}">
                        <div class="event-date">
                            <div class="date">${eventDate.getDate()}</div>
                            <div class="day">${getDayName(eventDate.getDay())}</div>
                        </div>
                        <div class="event-info">
                            <div class="event-title">${event.title}</div>
                            ${event.time ? `<div class="event-time">⏰ ${event.time}</div>` : ''}
                            ${event.venue ? `<div class="event-venue">📍 ${event.venue}</div>` : ''}
                            ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                        </div>
                        <div class="event-actions">
                            <button class="btn btn-sm" onclick="editEvent('${event.id}')">編集</button>
                            <button class="btn btn-sm btn-primary" onclick="goToCarpool('${event.id}')">配車管理</button>
                        </div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    /**
     * Firestoreからイベントデータを読み込み
     */
    function loadEvents() {
        if (!window.FCOjima || !window.FCOjima.Firebase || !window.FCOjima.Firebase.db) {
            console.warn('Firestore が利用できません - デモモードで実行します');
            // デモ用のサンプルイベントを追加
            events = [
                {
                    id: 'demo-1',
                    title: '練習試合 vs 太田FC',
                    date: '2025-07-05',
                    time: '09:00',
                    venue: '尾島総合運動場',
                    description: 'U-12 練習試合'
                },
                {
                    id: 'demo-2', 
                    title: '通常練習',
                    date: '2025-07-12',
                    time: '10:00',
                    venue: '尾島小学校グラウンド',
                    description: '基礎練習とミニゲーム'
                }
            ];
            updateDisplay();
            return;
        }
        
        try {
            eventsUnsubscribe = window.FCOjima.Firebase.db.collection('events')
                .orderBy('date', 'asc')
                .onSnapshot((snapshot) => {
                    events = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    
                    console.log(`📅 イベント ${events.length} 件を読み込みました`);
                    updateDisplay();
                }, (error) => {
                    console.error('💥 イベント読み込みエラー:', error);
                    
                    // エラー種別に応じた処理
                    let errorMessage = 'イベントの読み込みに失敗しました';
                    if (error.code === 'permission-denied') {
                        console.warn('🔒 権限エラー - ログイン状態を確認してください');
                        errorMessage = 'アクセス権限がありません。ログイン状態を確認してください。';
                    } else if (error.code === 'unavailable') {
                        console.warn('🌐 ネットワークエラー - 接続を確認してください');
                        errorMessage = 'サーバーに接続できません。ネットワーク接続を確認してください。';
                    } else if (error.code === 'resource-exhausted') {
                        console.warn('📊 クォータ超過 - しばらく待ってからお試しください');
                        errorMessage = 'アクセス数が制限を超えました。しばらく待ってからお試しください。';
                    } else if (error.code === 'cancelled') {
                        console.warn('🚫 操作がキャンセルされました');
                        errorMessage = '操作がキャンセルされました。';
                    }
                    
                    // エラーメッセージを表示
                    showErrorMessage(errorMessage);
                    
                    // エラー時もカレンダーグリッドは表示する
                    updateDisplay();
                });
        } catch (error) {
            console.error('Firestore接続エラー:', error);
            // エラー時もカレンダーグリッドは表示する
            updateDisplay();
        }
    }
    
    /**
     * 指定日のイベントを取得
     */
    function getEventsForDate(dateStr) {
        return events.filter(event => event.date === dateStr);
    }
    
    /**
     * フィルターされたイベントを取得
     */
    function getFilteredEvents() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
        
        return events.filter(event => event.date && event.date.startsWith(monthStr));
    }
    
    /**
     * 今日かどうかチェック
     */
    function isDateToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
    
    /**
     * 日付をフォーマット
     */
    function formatDate(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * 曜日名を取得
     */
    function getDayName(dayIndex) {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        return days[dayIndex];
    }
    
    /**
     * イベント追加モーダルを開く
     */
    function openEventModal(dateStr = null) {
        const modal = document.getElementById('event-modal');
        if (!modal) return;
        
        // モーダルを新規追加モードにリセット
        resetEventModal();
        
        // フォームをリセット
        const form = document.getElementById('event-form');
        if (form) {
            form.reset();
        }
        
        // 日付を設定
        if (dateStr) {
            const dateInput = document.getElementById('event-date');
            if (dateInput) {
                dateInput.value = dateStr;
            }
        }
        
        modal.style.display = 'block';
    }
    
    /**
     * イベント追加モーダルを閉じる
     */
    function closeEventModal() {
        const modal = document.getElementById('event-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    /**
     * イベントを保存
     */
    async function saveEvent() {
        if (!window.FCOjima || !window.FCOjima.Firebase || !window.FCOjima.Firebase.db) {
            alert('Firestoreが利用できません');
            return;
        }
        
        // フォームデータを取得
        const eventData = {
            title: document.getElementById('event-title')?.value || '',
            date: document.getElementById('event-date')?.value || '',
            time: document.getElementById('event-time')?.value || '',
            venue: document.getElementById('event-venue')?.value || '',
            targetGrades: getSelectedGrades(),
            description: document.getElementById('event-description')?.value || '',
            createdAt: new Date().toISOString(),
            createdBy: window.FCOjima?.currentUser?.email || 'unknown'
        };
        
        // バリデーション
        if (!eventData.title) {
            alert('イベント名を入力してください');
            return;
        }
        
        if (!eventData.date) {
            alert('日付を選択してください');
            return;
        }
        
        try {
            await window.FCOjima.Firebase.db.collection('events').add(eventData);
            console.log('✅ イベントを作成しました:', eventData.title);
            
            // 成功時の処理
            closeEventModal();
            loadEvents(); // イベント一覧を再読み込み
            
            // 成功メッセージ
            showSuccessMessage('イベントを保存しました');
            
        } catch (error) {
            console.error('💥 イベント保存エラー:', error);
            
            // エラーの詳細を表示
            let errorMessage = 'イベントの保存に失敗しました';
            if (error.code === 'permission-denied') {
                errorMessage = '保存する権限がありません。ログイン状態を確認してください。';
            } else if (error.code === 'network-error') {
                errorMessage = 'ネットワークエラーです。接続を確認してください。';
            }
            
            showErrorMessage(errorMessage);
        }
    }
    
    /**
     * 成功メッセージ表示
     */
    function showSuccessMessage(message) {
        console.log('✅ 成功:', message);
        
        // UI通知を作成
        const notification = createNotification('success', message);
        document.body.appendChild(notification);
        
        // 3秒後に自動削除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
    /**
     * エラーメッセージ表示
     */
    function showErrorMessage(message) {
        console.error('❌ エラー:', message);
        
        // UI通知を作成
        const notification = createNotification('error', message);
        document.body.appendChild(notification);
        
        // 5秒後に自動削除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    /**
     * 通知要素を作成
     */
    function createNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 500;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span>${type === 'success' ? '✅' : '❌'}</span>
                <span>${message}</span>
                <button onclick="this.parentNode.parentNode.remove()" style="
                    background: none; border: none; color: white; 
                    font-size: 18px; cursor: pointer; margin-left: auto;
                ">×</button>
            </div>
        `;
        
        return notification;
    }
    
    /**
     * 選択された学年を取得
     */
    function getSelectedGrades() {
        const checkboxes = document.querySelectorAll('input[name="target-grades"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    /**
     * イベント詳細を表示
     */
    function showEventDetails(eventId) {
        const event = events.find(e => e.id === eventId);
        if (!event) return;
        
        const details = `
イベント: ${event.title}
日付: ${event.date}
時間: ${event.time || '未設定'}
会場: ${event.venue || '未設定'}
対象学年: ${event.targetGrades ? event.targetGrades.join(', ') + '年生' : '全学年'}
説明: ${event.description || 'なし'}
        `;
        
        alert(details);
    }
    
    /**
     * イベント編集
     */
    function editEvent(eventId) {
        console.log('🔧 イベント編集開始:', eventId);
        
        const event = events.find(e => e.id === eventId);
        if (!event) {
            console.error('❌ イベントが見つかりません:', eventId);
            showErrorMessage('編集対象のイベントが見つかりません');
            return;
        }
        
        try {
            // モーダルを開く
            const modal = document.getElementById('event-modal');
            const modalTitle = document.querySelector('.modal-title');
            
            if (!modal || !modalTitle) {
                console.error('❌ モーダル要素が見つかりません');
                showErrorMessage('編集画面を開けません');
                return;
            }
            
            // モーダルタイトルを変更
            modalTitle.textContent = 'イベント編集';
            
            // フォームに既存データを設定
            document.getElementById('event-title').value = event.title || '';
            document.getElementById('event-date').value = event.date || '';
            document.getElementById('event-time').value = event.time || '';
            document.getElementById('event-venue').value = event.venue || '';
            document.getElementById('event-description').value = event.description || '';
            
            // 対象学年のチェックボックスを設定
            if (event.targetGrades) {
                event.targetGrades.forEach(grade => {
                    const checkbox = document.querySelector(`input[name="target-grades"][value="${grade}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
            
            // 保存ボタンのイベントハンドラーを変更
            const saveBtn = document.getElementById('save-event');
            if (saveBtn) {
                saveBtn.onclick = () => updateEvent(eventId);
                saveBtn.textContent = '更新';
            }
            
            modal.style.display = 'block';
            console.log('✅ イベント編集モーダルを開きました');
            
        } catch (error) {
            console.error('💥 イベント編集モーダル起動エラー:', error);
            showErrorMessage('編集画面の起動に失敗しました');
        }
    }
    
    /**
     * イベント更新
     */
    async function updateEvent(eventId) {
        if (!window.FCOjima || !window.FCOjima.Firebase || !window.FCOjima.Firebase.db) {
            showErrorMessage('Firestoreが利用できません');
            return;
        }
        
        try {
            // フォームデータを取得
            const eventData = {
                title: document.getElementById('event-title')?.value || '',
                date: document.getElementById('event-date')?.value || '',
                time: document.getElementById('event-time')?.value || '',
                venue: document.getElementById('event-venue')?.value || '',
                targetGrades: getSelectedGrades(),
                description: document.getElementById('event-description')?.value || '',
                updatedAt: new Date().toISOString(),
                updatedBy: window.FCOjima?.currentUser?.email || 'unknown'
            };
            
            // バリデーション
            if (!eventData.title) {
                showErrorMessage('イベント名を入力してください');
                return;
            }
            
            if (!eventData.date) {
                showErrorMessage('日付を選択してください');
                return;
            }
            
            await window.FCOjima.Firebase.db.collection('events').doc(eventId).update(eventData);
            console.log('✅ イベントを更新しました:', eventData.title);
            
            // 成功時の処理
            resetEventModal();
            closeEventModal();
            
            showSuccessMessage('イベントを更新しました');
            
        } catch (error) {
            console.error('💥 イベント更新エラー:', error);
            
            let errorMessage = 'イベントの更新に失敗しました';
            if (error.code === 'permission-denied') {
                errorMessage = '更新する権限がありません。ログイン状態を確認してください。';
            } else if (error.code === 'not-found') {
                errorMessage = '更新対象のイベントが見つかりません。';
            } else if (error.code === 'network-error') {
                errorMessage = 'ネットワークエラーです。接続を確認してください。';
            }
            
            showErrorMessage(errorMessage);
        }
    }
    
    /**
     * モーダルリセット
     */
    function resetEventModal() {
        const modalTitle = document.querySelector('.modal-title');
        const saveBtn = document.getElementById('save-event');
        
        if (modalTitle) {
            modalTitle.textContent = 'イベント追加';
        }
        
        if (saveBtn) {
            saveBtn.onclick = saveEvent;
            saveBtn.textContent = '保存';
        }
        
        // チェックボックスをクリア
        const checkboxes = document.querySelectorAll('input[name="target-grades"]');
        checkboxes.forEach(cb => cb.checked = false);
    }
    
    /**
     * 配車管理に移動
     */
    function goToCarpool(eventId) {
        sessionStorage.setItem('fc-ojima-selected-event', eventId);
        window.location.href = '../carpool/index.html';
    }
    
    // 名前空間に関数を登録
    Calendar.init = initCalendar;
    Calendar.updateDisplay = updateDisplay;
    Calendar.renderCalendarView = renderCalendarView;
    Calendar.renderListView = renderListView;
    Calendar.openEventModal = openEventModal;
    Calendar.closeEventModal = closeEventModal;
    Calendar.saveEvent = saveEvent;
    
    // グローバル関数として公開（後方互換性）
    window.editEvent = editEvent;
    window.goToCarpool = goToCarpool;
    
    // DOM読み込み完了後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCalendar);
    } else {
        initCalendar();
    }
    
    // クリーンアップ
    window.addEventListener('beforeunload', () => {
        if (eventsUnsubscribe) {
            eventsUnsubscribe();
        }
    });
    
})();
=======
    Calendar.setupEventListeners = function() {
        console.log('カレンダーのイベントリスナーを設定しています...');
        
        // 表示切り替えボタン
        document.getElementById('calendar-view').addEventListener('click', function() {
            document.getElementById('calendar-container').classList.remove('hidden');
            document.getElementById('list-container').classList.add('hidden');
            document.getElementById('calendar-view').classList.add('active');
            document.getElementById('list-view').classList.remove('active');
        });
        
        document.getElementById('list-view').addEventListener('click', function() {
            document.getElementById('calendar-container').classList.add('hidden');
            document.getElementById('list-container').classList.remove('hidden');
            document.getElementById('calendar-view').classList.remove('active');
            document.getElementById('list-view').classList.add('active');
        });
        
        // 月の移動ボタン
        document.getElementById('prev-month').addEventListener('click', function() {
            app.Hub.currentDate.setMonth(app.Hub.currentDate.getMonth() - 1);
            Calendar.renderCalendar();
            Calendar.renderEventsList();
        });
        
        document.getElementById('next-month').addEventListener('click', function() {
            app.Hub.currentDate.setMonth(app.Hub.currentDate.getMonth() + 1);
            Calendar.renderCalendar();
            Calendar.renderEventsList();
        });
        
        // 予定追加ボタン
        document.getElementById('add-event').addEventListener('click', function() {
            Calendar.openAddEventModal();
        });
        
        // ログ表示ボタン
        document.getElementById('view-logs').addEventListener('click', function() {
            app.Hub.openLogsModal('calendar');
        });
        
        // フォーム送信イベント
        document.getElementById('event-form').addEventListener('submit', function(e) {
            e.preventDefault();
            Calendar.saveEvent();
        });
        
        // 会場選択ボタン
        document.getElementById('select-venue').addEventListener('click', function() {
            app.Hub.Venues.openVenueSelect('venue');
        });
        
        document.getElementById('select-meeting-venue').addEventListener('click', function() {
            app.Hub.Venues.openVenueSelect('meeting');
        });
        
        // キャンセルボタン（イベント追加モーダル）
        var cancelEventBtn = document.getElementById('cancel-event');
        if (cancelEventBtn) {
            cancelEventBtn.addEventListener('click', function() {
                UI.closeModal('event-modal');
            });
        }

        // 学年外選手追加ボタン
        var addExtraPlayersBtn = document.getElementById('add-extra-players');
        if (addExtraPlayersBtn) {
            addExtraPlayersBtn.addEventListener('click', function() {
                Calendar.openExtraPlayerModal();
            });
        }

        // 学年外選手確定ボタン
        var confirmExtraBtn = document.getElementById('confirm-extra-players');
        if (confirmExtraBtn) {
            confirmExtraBtn.addEventListener('click', function() {
                Calendar.confirmExtraPlayers();
            });
        }

        // 学年外選手キャンセルボタン
        var cancelExtraBtn = document.getElementById('cancel-extra-players');
        if (cancelExtraBtn) {
            cancelExtraBtn.addEventListener('click', function() {
                UI.closeModal('extra-player-modal');
            });
        }

        // イベント詳細モーダルのボタン
        document.getElementById('manage-event').addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            Calendar.navigateToCarpool(eventId);
        });

        document.getElementById('edit-event').addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            Calendar.editEvent(eventId);
        });

        document.getElementById('delete-event').addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            Calendar.deleteEvent(eventId);
        });

        console.log('カレンダーのイベントリスナー設定が完了しました');
    };
    
    /**
     * カレンダーを描画する関数
     */
    Calendar.renderCalendar = function() {
        const currentDate = app.Hub.currentDate;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // 月の表示を更新
        document.getElementById('current-month').textContent = `${year}年${month + 1}月`;
        
        // 月の最初の日と最後の日を取得
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // 月の最初の日の曜日（0: 日曜日, 1: 月曜日, ...）
        const firstDayIndex = firstDay.getDay();
        
        // カレンダーグリッドを取得
        const calendarGrid = document.getElementById('calendar-grid');
        calendarGrid.innerHTML = '';
        
        // 前月の日を表示
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const dateObj = new Date(year, month - 1, day);
            const dayElement = this.createDayElement(dateObj, true);
            calendarGrid.appendChild(dayElement);
        }
        
        // 当月の日を表示
        const today = new Date();
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const dateObj = new Date(year, month, i);
            const isToday = dateObj.getDate() === today.getDate() && 
                             dateObj.getMonth() === today.getMonth() && 
                             dateObj.getFullYear() === today.getFullYear();
            
            const dayElement = this.createDayElement(dateObj, false, isToday);
            calendarGrid.appendChild(dayElement);
        }
        
        // 翌月の日を表示（6週間表示のために必要な分だけ）
        const daysFromPrevMonth = firstDayIndex;
        const daysFromCurrentMonth = lastDay.getDate();
        const totalCellsFilled = daysFromPrevMonth + daysFromCurrentMonth;
        const cellsToFill = 42 - totalCellsFilled; // 6週間 = 42日
        
        for (let i = 1; i <= cellsToFill; i++) {
            const dateObj = new Date(year, month + 1, i);
            const dayElement = this.createDayElement(dateObj, true);
            calendarGrid.appendChild(dayElement);
        }
        
        // イベントを表示
        this.displayEvents();
    };
    
    /**
     * 日付要素を作成する関数
     * @param {Date} date - 日付オブジェクト
     * @param {boolean} isOtherMonth - 他の月の日付かどうか
     * @param {boolean} isToday - 今日かどうか
     * @returns {HTMLElement} 日付要素
     */
    Calendar.createDayElement = function(date, isOtherMonth, isToday = false) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        
        // 他の月の日付かどうか
        if (isOtherMonth) {
            day.classList.add('other-month');
        }
        
        // 今日かどうか
        if (isToday) {
            day.classList.add('today');
        }
        
        // 土曜日または日曜日の場合にクラスを追加
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) {
            day.classList.add('sunday');
        } else if (dayOfWeek === 6) {
            day.classList.add('saturday');
        }
        
        // 日付の表示部分
        const dateDiv = document.createElement('div');
        dateDiv.className = 'date';
        dateDiv.textContent = date.getDate();
        day.appendChild(dateDiv);
        
        // データ属性に日付を設定
        day.dataset.date = Utils.formatDate(date);
        
        // 日付クリックで予定追加モーダルを開く
        day.addEventListener('click', () => {
            this.openAddEventModal(date);
        });
        
        return day;
    };
    
    /**
     * イベントをカレンダーに表示
     */
    Calendar.displayEvents = function() {
        const events = app.Hub.events;
        
        events.forEach(event => {
            // 日付要素を取得
            const dayElement = document.querySelector(`.calendar-day[data-date="${event.date}"]`);
            if (!dayElement) return;
            
            // イベント要素を作成
            const eventElement = document.createElement('div');
            eventElement.className = `event ${event.type}`;
            eventElement.textContent = event.title;
            eventElement.dataset.eventId = event.id;
            
            // イベントクリックで詳細モーダルを表示
            eventElement.addEventListener('click', (e) => {
                e.stopPropagation(); // 親要素へのクリックイベントの伝播を防止
                this.showEventDetails(event.id);
            });
            
            dayElement.appendChild(eventElement);
        });
    };
    
    /**
     * リスト表示を描画（すべての日付を表示）
     */
    Calendar.renderEventsList = function() {
        const currentDate = app.Hub.currentDate;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const events = app.Hub.events;
        
        const listContainer = document.getElementById('events-list');
        listContainer.innerHTML = '';
        
        // 月の最初の日と最後の日を取得
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // 月内の全日付を生成
        const allDatesInMonth = [];
        for (let day = 1; day <= lastDay.getDate(); day++) {
            allDatesInMonth.push(Utils.formatDate(new Date(year, month, day)));
        }
        
        // 日付ごとのイベントを準備
        const eventsByDate = {};
        allDatesInMonth.forEach(date => {
            eventsByDate[date] = events.filter(event => event.date === date);
        });
        
        // すべての日付を表示
        allDatesInMonth.forEach(dateString => {
            const dateObj = new Date(dateString);
            
            // 日付の見出しを追加
            const dateHeading = document.createElement('div');
            dateHeading.className = 'date-heading';
            dateHeading.textContent = Utils.formatDateForDisplay(dateString);
            dateHeading.dataset.date = dateString;
            listContainer.appendChild(dateHeading);
            
            // その日付のイベントを表示
            const dateEvents = eventsByDate[dateString];
            
            if (dateEvents && dateEvents.length > 0) {
                // イベントがある場合は表示
                dateEvents.forEach(event => {
                    const eventItem = this.createEventListItem(event);
                    listContainer.appendChild(eventItem);
                });
            } else {
                // イベントがない場合は「予定なし」と表示し、クリックで予定追加できるようにする
                const noEventItem = document.createElement('div');
                noEventItem.className = 'event-item empty';
                noEventItem.innerHTML = '<div class="event-title">予定なし</div>';
                
                // 予定なし項目をクリックすると、その日付で予定追加ダイアログを開く
                noEventItem.addEventListener('click', () => {
                    this.openAddEventModal(new Date(dateString));
                });
                
                listContainer.appendChild(noEventItem);
            }
        });
    };
    
    /**
     * イベントリスト項目を作成
     * @param {Object} event - イベントオブジェクト
     * @returns {HTMLElement} イベントリスト項目要素
     */
    Calendar.createEventListItem = function(event) {
        const eventItem = document.createElement('div');
        eventItem.className = `event-item ${event.type}`;
        eventItem.dataset.eventId = event.id;
        
        // 学年ターゲット表示
        let targetDisplay = '';
        if (event.target && event.target.length > 0) {
            const targetGrades = event.target.map(grade => Utils.getGradeLabel(grade)).join(', ');
            targetDisplay = `<span class="badge">${targetGrades}</span> `;
        }
        
        const title = document.createElement('div');
        title.className = 'event-title';
        title.innerHTML = `${targetDisplay}${UI.escapeHTML(event.title)}`;
        
        const details = document.createElement('div');
        details.className = 'event-details';
        
        let timeDisplay = '';
        if (event.startTime) {
            timeDisplay += event.startTime;
            if (event.endTime) {
                timeDisplay += `-${event.endTime}`;
            }
        }
        
        details.textContent = `${timeDisplay} @ ${event.venue || '未設定'}`;
        
        eventItem.appendChild(title);
        eventItem.appendChild(details);
        
        // イベントクリックで詳細モーダルを表示
        eventItem.addEventListener('click', () => {
            this.showEventDetails(event.id);
        });
        
        return eventItem;
    };
    
    /**
     * イベント詳細表示
     * @param {number} eventId - イベントID
     */
    Calendar.showEventDetails = function(eventId) {
        const events = app.Hub.events;
        const event = events.find(e => String(e.id) === String(eventId));
        if (!event) {
            console.warn('イベントが見つかりません: id=' + eventId, events.map(e=>e.id));
            return;
        }
        
        const content = document.getElementById('event-details-content');
        
        // 学年ターゲット表示
        let targetDisplay = '';
        if (event.target && event.target.length > 0) {
            const targetGrades = event.target.map(grade => Utils.getGradeLabel(grade)).join(', ');
            targetDisplay = `
            <div class="detail-item">
                <span class="detail-label">対象:</span> ${targetGrades}
            </div>`;
            
            if (event.targetNotes) {
                targetDisplay += `
                <div class="detail-item">
                    <span class="detail-label">対象備考:</span> ${UI.escapeHTML(event.targetNotes)}
                </div>`;
            }
        }
        
        // 出欠回答期限
        let deadlineDisplay = '';
        if (event.attendanceDeadline) {
            const deadline = new Date(event.attendanceDeadline);
            const formattedDeadline = deadline.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            deadlineDisplay = `
            <div class="detail-item">
                <span class="detail-label">出欠回答期限:</span> ${formattedDeadline}
            </div>`;
        }
        
        // 出発時間
        let departureDisplay = '';
        if (event.departureTime) {
            departureDisplay = `
            <div class="detail-item">
                <span class="detail-label">出発時間:</span> ${event.departureTime}
            </div>`;
        }
        
        // 集合場所
        let meetingPlaceDisplay = '';
        if (event.meetingPlace) {
            meetingPlaceDisplay = `
            <div class="detail-item">
                <span class="detail-label">集合場所:</span> ${UI.escapeHTML(event.meetingPlace)}
            </div>`;
        }
        
        // 出欠一覧（イベントの対象学年メンバー）
        let attendanceDisplay = '';
        const members = app.Hub.members || [];
        const targetGradeValues = event.target || [];
        const extraPlayers = event.extraPlayers || [];
        let targetMembers = [];
        if (targetGradeValues.length > 0) {
            targetMembers = members.filter(m => m.role === 'player' && targetGradeValues.includes(m.grade));
        }
        // 学年外追加選手
        extraPlayers.forEach(name => {
            if (!targetMembers.find(m => m.name === name)) {
                const m = members.find(m => m.name === name);
                if (m) targetMembers.push(m);
            }
        });
        if (targetMembers.length > 0) {
            const eventData = Storage.loadEventData(event.id);
            const attendance = eventData.attendance || [];
            const statusMap = {};
            attendance.forEach(a => { statusMap[a.name] = a.status; });

            const rows = targetMembers.map(m => {
                const st = statusMap[m.name] || 'pending';
                const label = st === 'present' ? '○' : st === 'absent' ? '×' : '－';
                const cls = st === 'present' ? 'color:green' : st === 'absent' ? 'color:red' : 'color:#999';
                return `<span style="margin-right:12px;"><b style="${cls}">${label}</b> ${UI.escapeHTML(m.name)}</span>`;
            }).join('');

            attendanceDisplay = `<div class="detail-item"><span class="detail-label">出欠確認:</span><br><div style="margin-top:4px;line-height:2;">${rows}</div></div>`;
        }

        // イベントログ
        const allLogs = app.Hub.logs || [];
        const eventLogs = allLogs.filter(l => l.type === 'calendar' && l.details && l.details.includes(UI.escapeHTML(event.title).substring(0, 10)));
        let eventLogDisplay = '';
        if (eventLogs.length > 0) {
            const logRows = eventLogs.slice(-5).map(l =>
                `<div style="font-size:0.85em;border-bottom:1px solid #eee;padding:2px 0;">${l.datetime ? l.datetime.substring(0,16).replace('T',' ') : ''} [${UI.escapeHTML(l.user||'')}] ${UI.escapeHTML(l.action||'')} ${UI.escapeHTML(l.details||'')}</div>`
            ).join('');
            eventLogDisplay = `<div class="detail-item" style="margin-top:8px;"><span class="detail-label">ログ（直近5件）:</span><div>${logRows}</div></div>`;
        }

        content.innerHTML = `
            <h3>${UI.escapeHTML(event.title)}</h3>
            <div class="detail-item">
                <span class="detail-label">日付:</span> ${Utils.formatDateForDisplay(event.date)}
            </div>
            <div class="detail-item">
                <span class="detail-label">種類:</span> ${Utils.getEventTypeLabel(event.type)}
            </div>
            ${targetDisplay}
            ${deadlineDisplay}
            ${departureDisplay}
            ${meetingPlaceDisplay}
            <div class="detail-item">
                <span class="detail-label">会場:</span> ${UI.escapeHTML(event.venue || '未設定')}
            </div>
            <div class="detail-item">
                <span class="detail-label">時間:</span> ${event.startTime || '未設定'}${event.endTime ? ` - ${event.endTime}` : ''}
            </div>
            ${event.notes ? `
            <div class="detail-item">
                <span class="detail-label">備考:</span><br>
                ${UI.escapeHTML(event.notes)}
            </div>
            ` : ''}
            ${attendanceDisplay}
            ${eventLogDisplay}
        `;
        
        // ボタンにイベントIDを設定
        document.getElementById('manage-event').setAttribute('data-event-id', event.id);
        document.getElementById('edit-event').setAttribute('data-event-id', event.id);
        document.getElementById('delete-event').setAttribute('data-event-id', event.id);
        
        // モーダルを表示
        UI.openModal('event-details-modal');
    };
    
    /**
     * 予定追加モーダルを開く
     * @param {Date} date - 日付（nullの場合は現在の日付）
     */
    Calendar.openAddEventModal = function(date = null) {
        console.log('予定追加モーダルを開きます...');
        
        // モーダルのタイトルを設定
        document.querySelector('#event-modal h2').textContent = 'イベントを追加';
        
        // フォームをリセット
        document.getElementById('event-form').reset();
        
        // 日付を設定（指定があれば）
        if (date) {
            // タイムゾーンによる日付のずれを防ぐため、YYYYMMDDの文字列に変換してからセット
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            document.getElementById('event-date').value = dateString;
            console.log(`日付設定: ${dateString}`);
        } else {
            // 指定がなければ今日の日付
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            document.getElementById('event-date').value = dateString;
            console.log(`今日の日付: ${dateString}`);
        }
        
        // 対象学年のチェックボックスを生成
        this.generateGradeCheckboxes();
        
        // モーダルを表示
        UI.openModal('event-modal');
    };
    
    /**
     * 対象学年のチェックボックスを生成
     */
    Calendar.generateGradeCheckboxes = function() {
        const container = document.getElementById('event-target-grades');
        container.innerHTML = '';
        
        const members = app.Hub.members;
        
        // メンバーから存在する学年を抽出
        const existingGrades = new Set();
        members.forEach(member => {
            if (member.role === 'player' && member.grade) {
                existingGrades.add(member.grade);
            }
        });
        
        // 学年が存在しない場合は全学年を表示
        if (existingGrades.size === 0) {
            const grades = ['年少', '年中', '年長', '1', '2', '3', '4', '5', '6'];
            grades.forEach(grade => existingGrades.add(grade));
        }
        
        // ソートして表示
        const sortedGrades = Array.from(existingGrades).sort((a, b) => {
            const gradeOrder = {
                '年少': -3,
                '年中': -2,
                '年長': -1
            };
            
            const valA = gradeOrder[a] !== undefined ? gradeOrder[a] : parseInt(a);
            const valB = gradeOrder[b] !== undefined ? gradeOrder[b] : parseInt(b);
            
            return valA - valB;
        });
        
        sortedGrades.forEach(grade => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `grade-${grade}`;
            checkbox.value = grade;
            checkbox.name = 'event-target';
            
            const label = document.createElement('label');
            label.htmlFor = `grade-${grade}`;
            label.textContent = Utils.getGradeLabel(grade);
            label.style.display = 'inline';
            
            item.appendChild(checkbox);
            item.appendChild(label);
            container.appendChild(item);
        });
    };
    
    /**
     * 新規イベント保存
     */
    Calendar.saveEvent = function() {
        const events = app.Hub.events;
        const logs = app.Hub.logs;
        
        const date = document.getElementById('event-date').value;
        const type = document.getElementById('event-type').value;
        const title = document.getElementById('event-title').value;
        
        // 対象学年を取得
        const targetCheckboxes = document.querySelectorAll('input[name="event-target"]:checked');
        const target = Array.from(targetCheckboxes).map(cb => cb.value);
        const targetNotes = document.getElementById('event-target-notes').value;
        
        // 出欠回答期限を取得
        const deadlineDate = document.getElementById('event-attendance-deadline-date').value;
        const deadlineTime = document.getElementById('event-attendance-deadline-time').value;
        let attendanceDeadline = null;
        if (deadlineDate) {
            if (deadlineTime) {
                attendanceDeadline = `${deadlineDate}T${deadlineTime}`;
            } else {
                attendanceDeadline = `${deadlineDate}T23:59`;
            }
        }
        
        const departureTime = document.getElementById('event-departure-time').value;
        const meetingPlace = document.getElementById('event-meeting-place').value;
        const venue = document.getElementById('event-venue').value;
        const startTime = document.getElementById('event-start-time').value;
        const endTime = document.getElementById('event-end-time').value;
        const notes = document.getElementById('event-notes').value;
        
        // バリデーション（タイトルのみ必須）
        if (!date || !title) {
            UI.showAlert('日付とタイトルは必須です');
            return;
        }
        
        // 新しいイベントID
        const newId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
        
        // 新しいイベントを追加または既存イベントを更新
        const eventFormId = document.getElementById('event-form').getAttribute('data-event-id');

        // 追加選手
        const extraPlayersVal = document.getElementById('event-extra-players');
        const extraPlayers = extraPlayersVal && extraPlayersVal.value ? extraPlayersVal.value.split(',').filter(Boolean) : [];

        if (eventFormId) {
            // 既存イベントの更新
            const index = events.findIndex(e => String(e.id) === String(eventFormId));
            if (index !== -1) {
                const origId = events[index].id;
                events[index] = {
                    id: origId,
                    date,
                    type,
                    title,
                    target,
                    extraPlayers,
                    targetNotes,
                    attendanceDeadline,
                    departureTime,
                    meetingPlace,
                    venue,
                    startTime,
                    endTime,
                    notes
                };
                
                // ログに記録
                app.Hub.logs = Storage.addLog('calendar', 'イベント更新', `「${title}」（${date}）`, logs);
            }
        } else {
            // 新規イベントを追加
            events.push({
                id: newId,
                date,
                type,
                title,
                target,
                extraPlayers,
                targetNotes,
                attendanceDeadline,
                departureTime,
                meetingPlace,
                venue,
                startTime,
                endTime,
                notes
            });
            
            // ログに記録
            app.Hub.logs = Storage.addLog('calendar', 'イベント追加', `「${title}」（${date}）`, logs);
        }
        
        // イベントを保存してUIを更新
        Storage.saveEvents(events);
        this.renderCalendar();
        this.renderEventsList();
        
        // モーダルを閉じてフォームをリセット
        UI.closeModal('event-modal');
        document.getElementById('event-form').reset();
        document.getElementById('event-form').removeAttribute('data-event-id');
        var extraInput = document.getElementById('event-extra-players');
        if (extraInput) extraInput.value = '';
        var extraListEl = document.getElementById('extra-players-list');
        if (extraListEl) { extraListEl.innerHTML = ''; extraListEl.style.display = 'none'; }
        UI.showAlert('イベントを保存しました', 'success');
    };
    
    /**
     * イベント編集
     * @param {number} eventId - イベントID
     */
    Calendar.editEvent = function(eventId) {
        const events = app.Hub.events;
        const event = events.find(e => String(e.id) === String(eventId));
        if (!event) return;
        
        // モーダルのタイトル設定
        document.querySelector('#event-modal h2').textContent = 'イベントを編集';
        
        // フォームにイベントIDを設定
        document.getElementById('event-form').setAttribute('data-event-id', event.id);
        
        // フォームに値を設定
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-type').value = event.type;
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-target-notes').value = event.targetNotes || '';
        
        // 出欠回答期限を設定
        if (event.attendanceDeadline) {
            const deadline = new Date(event.attendanceDeadline);
            const deadlineDate = Utils.formatDate(deadline);
            const hours = String(deadline.getHours()).padStart(2, '0');
            const minutes = String(deadline.getMinutes()).padStart(2, '0');
            const deadlineTime = `${hours}:${minutes}`;
            
            document.getElementById('event-attendance-deadline-date').value = deadlineDate;
            document.getElementById('event-attendance-deadline-time').value = deadlineTime;
        } else {
            document.getElementById('event-attendance-deadline-date').value = '';
            document.getElementById('event-attendance-deadline-time').value = '';
        }
        
        document.getElementById('event-departure-time').value = event.departureTime || '';
        document.getElementById('event-meeting-place').value = event.meetingPlace || '';
        document.getElementById('event-venue').value = event.venue || '';
        document.getElementById('event-start-time').value = event.startTime || '';
        document.getElementById('event-end-time').value = event.endTime || '';
        document.getElementById('event-notes').value = event.notes || '';
        
        // 対象学年のチェックボックスを生成
        this.generateGradeCheckboxes();
        
        // 対象学年のチェックボックスを設定
        if (event.target && event.target.length > 0) {
            event.target.forEach(grade => {
                const checkbox = document.getElementById(`grade-${grade}`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        // 詳細モーダルを閉じて編集モーダルを開く
        UI.closeModal('event-details-modal');
        UI.openModal('event-modal');
    };
    
    /**
     * イベント削除
     * @param {number} eventId - イベントID
     */
    Calendar.deleteEvent = function(eventId) {
        const events = app.Hub.events;
        const logs = app.Hub.logs;

        const event = events.find(e => String(e.id) === String(eventId));
        if (!event) return;

        if (UI.showConfirm(`イベント「${event.title}」を削除してもよろしいですか？`)) {
            // イベントを削除
            app.Hub.events = events.filter(e => String(e.id) !== String(eventId));
            
            // ログに記録
            app.Hub.logs = Storage.addLog('calendar', 'イベント削除', `「${event.title}」（${event.date}）`, logs);
            
            // イベントを保存してUIを更新
            Storage.saveEvents(app.Hub.events);
            this.renderCalendar();
            this.renderEventsList();
            
            // モーダルを閉じる
            UI.closeModal('event-details-modal');
        }
    };
    
    /**
     * 配車管理画面へ移動
     * @param {number} eventId - イベントID
     */
    Calendar.navigateToCarpool = function(eventId) {
        const events = app.Hub.events;

        // イベント情報をセッションストレージに保存
        const event = events.find(e => String(e.id) === String(eventId));
        if (event) {
            Storage.setSelectedEvent(event);
            // 配車管理ページに移動
            window.location.href = '../carpool/index.html';
        }
    };

    /**
     * 学年外選手追加モーダルを開く
     */
    Calendar.openExtraPlayerModal = function() {
        var members = app.Hub.members || [];
        var checkedGrades = Array.from(document.querySelectorAll('input[name="event-target"]:checked')).map(cb => cb.value);

        // 指定学年外の選手を抽出
        var extraCandidates = members.filter(function(m) {
            return m.role === 'player' && (!checkedGrades.length || !checkedGrades.includes(m.grade));
        });

        // 現在選択中の追加選手
        var currentExtra = (document.getElementById('event-extra-players').value || '').split(',').filter(Boolean);

        var listEl = document.getElementById('extra-player-list');
        listEl.innerHTML = '';

        if (extraCandidates.length === 0) {
            listEl.innerHTML = '<p style="padding:10px;color:#999;">対象外の選手はいません。</p>';
        } else {
            extraCandidates.forEach(function(m) {
                var item = document.createElement('label');
                item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #eee;cursor:pointer;';

                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = m.name;
                cb.checked = currentExtra.includes(m.name);

                var gradeLabel = Utils.getGradeLabel(m.grade || '');
                item.appendChild(cb);
                item.appendChild(document.createTextNode(m.name + (gradeLabel ? ' (' + gradeLabel + ')' : '')));
                listEl.appendChild(item);
            });
        }

        UI.openModal('extra-player-modal');
    };

    /**
     * 学年外選手選択を確定
     */
    Calendar.confirmExtraPlayers = function() {
        var checked = Array.from(document.querySelectorAll('#extra-player-list input[type=checkbox]:checked')).map(cb => cb.value);

        document.getElementById('event-extra-players').value = checked.join(',');

        var listEl = document.getElementById('extra-players-list');
        if (checked.length > 0) {
            listEl.innerHTML = '<b>追加選手: </b>' + checked.map(name => '<span style="background:#fff3cd;padding:2px 6px;border-radius:4px;margin:2px;">' + UI.escapeHTML(name) + '</span>').join('');
            listEl.style.display = 'block';
        } else {
            listEl.innerHTML = '';
            listEl.style.display = 'none';
        }

        UI.closeModal('extra-player-modal');
    };

})(window.FCOjima);
>>>>>>> 3f29fdc53b2c8f871d428ea6715327a2f2c4429e
