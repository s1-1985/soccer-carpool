/**
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
    
    /**
     * カレンダー機能の初期化
     */
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
    
    /**
     * イベントリスナーの設定
     */
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