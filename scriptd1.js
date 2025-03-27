// scriptd1.js - FC尾島ジュニア カレンダーページ用JavaScript

// グローバル変数
let currentDate = new Date();
let events = [];

// ページ読み込み完了時の処理
document.addEventListener('DOMContentLoaded', function() {
    // ローカルストレージからイベントデータを読み込む
    loadEvents();
    
    // カレンダーとリストを初期表示
    renderCalendar();
    renderEventsList();
    
    // 表示切り替えボタンのイベントリスナー
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
    
    // 月の移動ボタンのイベントリスナー
    document.getElementById('prev-month').addEventListener('click', function() {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
        renderEventsList();
    });
    
    document.getElementById('next-month').addEventListener('click', function() {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
        renderEventsList();
    });
    
    // 予定追加ボタンのイベントリスナー
    document.getElementById('add-event').addEventListener('click', function() {
        // 初期日付を現在の月の1日に設定
        const initialDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        document.getElementById('event-date').valueAsDate = initialDate;
        
        // モーダルを表示
        document.getElementById('event-modal').style.display = 'block';
    });
    
    // モーダルを閉じるボタンのイベントリスナー
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            document.getElementById('event-modal').style.display = 'none';
            document.getElementById('event-details-modal').style.display = 'none';
        });
    });
    
    // モーダル外クリックでモーダルを閉じる
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('event-modal')) {
            document.getElementById('event-modal').style.display = 'none';
        }
        if (event.target === document.getElementById('event-details-modal')) {
            document.getElementById('event-details-modal').style.display = 'none';
        }
    });
    
    // キャンセルボタンのイベントリスナー
    document.getElementById('cancel-event').addEventListener('click', function() {
        document.getElementById('event-modal').style.display = 'none';
    });
    
    // イベント登録フォームの送信イベントリスナー
    document.getElementById('event-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveEvent();
    });
    
    // イベント詳細モーダルのボタンイベントリスナー
    document.getElementById('manage-event').addEventListener('click', function() {
        const eventId = this.getAttribute('data-event-id');
        navigateToCarpool(eventId);
    });
    
    document.getElementById('edit-event').addEventListener('click', function() {
        const eventId = this.getAttribute('data-event-id');
        editEvent(eventId);
    });
    
    document.getElementById('delete-event').addEventListener('click', function() {
        const eventId = this.getAttribute('data-event-id');
        deleteEvent(eventId);
    });
});

// カレンダーを描画する関数
function renderCalendar() {
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
        const dayElement = createDayElement(dateObj, true);
        calendarGrid.appendChild(dayElement);
    }
    
    // 当月の日を表示
    const today = new Date();
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dateObj = new Date(year, month, i);
        const isToday = dateObj.getDate() === today.getDate() && 
                         dateObj.getMonth() === today.getMonth() && 
                         dateObj.getFullYear() === today.getFullYear();
        
        const dayElement = createDayElement(dateObj, false, isToday);
        calendarGrid.appendChild(dayElement);
    }
    
    // 翌月の日を表示（6週間表示のために必要な分だけ）
    const daysFromPrevMonth = firstDayIndex;
    const daysFromCurrentMonth = lastDay.getDate();
    const totalCellsFilled = daysFromPrevMonth + daysFromCurrentMonth;
    const cellsToFill = 42 - totalCellsFilled; // 6週間 = 42日
    
    for (let i = 1; i <= cellsToFill; i++) {
        const dateObj = new Date(year, month + 1, i);
        const dayElement = createDayElement(dateObj, true);
        calendarGrid.appendChild(dayElement);
    }
    
    // イベントを表示
    displayEvents();
}

// 日付要素を作成する関数
function createDayElement(date, isOtherMonth, isToday = false) {
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
    day.dataset.date = formatDate(date);
    
    // 日付クリックで予定追加モーダルを開く
    day.addEventListener('click', function() {
        // 日付ズレを修正 - 正確な日付を使用
        document.getElementById('event-date').valueAsDate = date;
        document.getElementById('event-modal').style.display = 'block';
    });
    
    return day;
}

// 日付フォーマット（YYYY-MM-DD）
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 人間が読みやすい日付フォーマット
function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    
    return `${year}年${month}月${day}日(${dayOfWeek})`;
}

// ローカルストレージからイベントデータを読み込む
function loadEvents() {
    const savedEvents = localStorage.getItem('fcOjimaEvents');
    events = savedEvents ? JSON.parse(savedEvents) : [];
    
    // サンプルデータ（ローカルストレージにデータがない場合のみ）
    if (events.length === 0) {
        events = [
            {
                id: 1,
                date: '2025-04-05',
                type: 'game',
                title: 'vs青葉FC',
                time: '13:00-15:00',
                location: '市民グラウンド',
                notes: 'ユニフォームは緑色'
            },
            {
                id: 2,
                date: '2025-04-12',
                type: 'game',
                title: 'vsさくらSC',
                time: '10:00-12:00',
                location: '第二運動公園',
                notes: '集合時間は9:00'
            },
            {
                id: 3,
                date: '2025-04-15',
                type: 'practice',
                title: '通常練習',
                time: '16:00-18:00',
                location: '学校グラウンド',
                notes: ''
            }
        ];
        saveEvents();
    }
}

// イベントをローカルストレージに保存
function saveEvents() {
    localStorage.setItem('fcOjimaEvents', JSON.stringify(events));
}

// イベントをカレンダーに表示
function displayEvents() {
    // 現在の月のイベントのみをフィルタリング
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    events.forEach(event => {
        const eventDate = new Date(event.date);
        
        // 日付要素を取得
        const dayElement = document.querySelector(`.calendar-day[data-date="${event.date}"]`);
        if (!dayElement) return;
        
        // イベント要素を作成
        const eventElement = document.createElement('div');
        eventElement.className = `event ${event.type}`;
        eventElement.textContent = event.title;
        eventElement.dataset.eventId = event.id;
        
        // イベントクリックで詳細モーダルを表示
        eventElement.addEventListener('click', function(e) {
            e.stopPropagation(); // 親要素へのクリックイベントの伝播を防止
            showEventDetails(event.id);
        });
        
        dayElement.appendChild(eventElement);
    });
}

// リスト表示を描画（すべての日付を表示）
function renderEventsList() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const listContainer = document.getElementById('events-list');
    listContainer.innerHTML = '';
    
    // 月の最初の日と最後の日を取得
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 月内の全日付を生成
    const allDatesInMonth = [];
    for (let day = 1; day <= lastDay.getDate(); day++) {
        allDatesInMonth.push(formatDate(new Date(year, month, day)));
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
        dateHeading.textContent = formatDateForDisplay(dateString);
        dateHeading.dataset.date = dateString;
        listContainer.appendChild(dateHeading);
        
        // その日付のイベントを表示
        const dateEvents = eventsByDate[dateString];
        
        if (dateEvents && dateEvents.length > 0) {
            // イベントがある場合は表示
            dateEvents.forEach(event => {
                const eventItem = createEventListItem(event);
                listContainer.appendChild(eventItem);
            });
        } else {
            // イベントがない場合は「予定なし」と表示し、クリックで予定追加できるようにする
            const noEventItem = document.createElement('div');
            noEventItem.className = 'event-item empty';
            noEventItem.innerHTML = '<div class="event-title">予定なし</div>';
            
            // 予定なし項目をクリックすると、その日付で予定追加ダイアログを開く
            noEventItem.addEventListener('click', function() {
                document.getElementById('event-date').value = dateString;
                document.getElementById('event-modal').style.display = 'block';
            });
            
            listContainer.appendChild(noEventItem);
        }
    });
}

// イベントリスト項目を作成
function createEventListItem(event) {
    const eventItem = document.createElement('div');
    eventItem.className = `event-item ${event.type}`;
    eventItem.dataset.eventId = event.id;
    
    const title = document.createElement('div');
    title.className = 'event-title';
    title.textContent = event.title;
    
    const details = document.createElement('div');
    details.className = 'event-details';
    details.textContent = `${event.time} @ ${event.location}`;
    
    eventItem.appendChild(title);
    eventItem.appendChild(details);
    
    // イベントクリックで詳細モーダルを表示
    eventItem.addEventListener('click', function() {
        showEventDetails(event.id);
    });
    
    return eventItem;
}

// イベント詳細表示
function showEventDetails(eventId) {
    const event = events.find(e => e.id === parseInt(eventId));
    if (!event) return;
    
    const content = document.getElementById('event-details-content');
    content.innerHTML = `
        <h3>${event.title}</h3>
        <div class="detail-item">
            <span class="detail-label">日付:</span> ${formatDateForDisplay(event.date)}
        </div>
        <div class="detail-item">
            <span class="detail-label">時間:</span> ${event.time || '未設定'}
        </div>
        <div class="detail-item">
            <span class="detail-label">場所:</span> ${event.location || '未設定'}
        </div>
        <div class="detail-item">
            <span class="detail-label">種類:</span> ${getEventTypeLabel(event.type)}
        </div>
        ${event.notes ? `
        <div class="detail-item">
            <span class="detail-label">備考:</span><br>
            ${event.notes}
        </div>
        ` : ''}
    `;
    
    // ボタンにイベントIDを設定
    document.getElementById('manage-event').setAttribute('data-event-id', event.id);
    document.getElementById('edit-event').setAttribute('data-event-id', event.id);
    document.getElementById('delete-event').setAttribute('data-event-id', event.id);
    
    // モーダルを表示
    document.getElementById('event-details-modal').style.display = 'block';
}

// イベントタイプのラベルを取得
function getEventTypeLabel(type) {
    const types = {
        'game': '試合',
        'practice': '練習',
        'other': 'その他'
    };
    return types[type] || type;
}

// 新規イベント保存
function saveEvent() {
    const date = document.getElementById('event-date').value;
    const type = document.getElementById('event-type').value;
    const title = document.getElementById('event-title').value;
    const time = document.getElementById('event-time').value;
    const location = document.getElementById('event-location').value;
    const notes = document.getElementById('event-notes').value;
    
    // バリデーション（タイトルのみ必須）
    if (!date || !title) {
        alert('日付とタイトルは必須です');
        return;
    }
    
    // 新しいイベントID
    const newId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
    
    // 新しいイベントを追加
    events.push({
        id: newId,
        date,
        type,
        title,
        time,
        location,
        notes
    });
    
    // イベントを保存してUIを更新
    saveEvents();
    renderCalendar();
    renderEventsList();
    
    // モーダルを閉じてフォームをリセット
    document.getElementById('event-modal').style.display = 'none';
    document.getElementById('event-form').reset();
}

// イベント編集
function editEvent(eventId) {
    const event = events.find(e => e.id === parseInt(eventId));
    if (!event) return;
    
    // フォームに値を設定
    document.getElementById('event-date').value = event.date;
    document.getElementById('event-type').value = event.type;
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-time').value = event.time || '';
    document.getElementById('event-location').value = event.location || '';
    document.getElementById('event-notes').value = event.notes || '';
    
    // 詳細モーダルを閉じて編集モーダルを開く
    document.getElementById('event-details-modal').style.display = 'none';
    document.getElementById('event-modal').style.display = 'block';
    
    // フォーム送信時の処理を変更
    const form = document.getElementById('event-form');
    const originalSubmitHandler = form.onsubmit;
    
    form.onsubmit = function(e) {
        e.preventDefault();
        
        // 既存のイベントを更新
        const index = events.findIndex(e => e.id === parseInt(eventId));
        if (index !== -1) {
            events[index] = {
                id: parseInt(eventId),
                date: document.getElementById('event-date').value,
                type: document.getElementById('event-type').value,
                title: document.getElementById('event-title').value,
                time: document.getElementById('event-time').value,
                location: document.getElementById('event-location').value,
                notes: document.getElementById('event-notes').value
            };
            
            // イベントを保存してUIを更新
            saveEvents();
            renderCalendar();
            renderEventsList();
            
            // モーダルを閉じてフォームをリセット
            document.getElementById('event-modal').style.display = 'none';
            document.getElementById('event-form').reset();
            
            // イベントハンドラを元に戻す
            form.onsubmit = originalSubmitHandler;
        }
    };
}

// イベント削除
function deleteEvent(eventId) {
    if (confirm('この予定を削除してもよろしいですか？')) {
        // イベントを削除
        events = events.filter(e => e.id !== parseInt(eventId));
        
        // イベントを保存してUIを更新
        saveEvents();
        renderCalendar();
        renderEventsList();
        
        // モーダルを閉じる
        document.getElementById('event-details-modal').style.display = 'none';
    }
}

// D2（配車管理画面）へ移動
function navigateToCarpool(eventId) {
    // イベント情報をセッションストレージに保存
    const event = events.find(e => e.id === parseInt(eventId));
    if (event) {
        sessionStorage.setItem('selectedEvent', JSON.stringify(event));
        // D2のページに移動
        window.location.href = 'indexd2.html';
    }
}