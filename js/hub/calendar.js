/**
 * FC尾島ジュニア - カレンダータブの機能
 * カレンダーとイベント管理に関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * カレンダーを描画する関数
 */
FCOjima.Hub.Calendar.renderCalendar = function() {
    const currentDate = FCOjima.Hub.currentDate;
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
FCOjima.Hub.Calendar.createDayElement = function(date, isOtherMonth, isToday = false) {
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
    day.dataset.date = FCOjima.Utils.formatDate(date);
    
    // 日付クリックで予定追加モーダルを開く
    day.addEventListener('click', () => {
        this.openAddEventModal(date);
    });
    
    return day;
};

/**
 * イベントをカレンダーに表示
 */
FCOjima.Hub.Calendar.displayEvents = function() {
    const events = FCOjima.Hub.events;
    
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
FCOjima.Hub.Calendar.renderEventsList = function() {
    const currentDate = FCOjima.Hub.currentDate;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const events = FCOjima.Hub.events;
    
    const listContainer = document.getElementById('events-list');
    listContainer.innerHTML = '';
    
    // 月の最初の日と最後の日を取得
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 月内の全日付を生成
    const allDatesInMonth = [];
    for (let day = 1; day <= lastDay.getDate(); day++) {
        allDatesInMonth.push(FCOjima.Utils.formatDate(new Date(year, month, day)));
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
        dateHeading.textContent = FCOjima.Utils.formatDateForDisplay(dateString);
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
FCOjima.Hub.Calendar.createEventListItem = function(event) {
    const eventItem = document.createElement('div');
    eventItem.className = `event-item ${event.type}`;
    eventItem.dataset.eventId = event.id;
    
    // 学年ターゲット表示
    let targetDisplay = '';
    if (event.target && event.target.length > 0) {
        const targetGrades = event.target.map(grade => FCOjima.Utils.getGradeLabel(grade)).join(', ');
        targetDisplay = `<span class="badge">${targetGrades}</span> `;
    }
    
    const title = document.createElement('div');
    title.className = 'event-title';
    title.innerHTML = `${targetDisplay}${FCOjima.UI.escapeHTML(event.title)}`;
    
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
FCOjima.Hub.Calendar.showEventDetails = function(eventId) {
    const events = FCOjima.Hub.events;
    const event = events.find(e => e.id === parseInt(eventId));
    if (!event) return;
    
    const content = document.getElementById('event-details-content');
    
    // 学年ターゲット表示
    let targetDisplay = '';
    if (event.target && event.target.length > 0) {
        const targetGrades = event.target.map(grade => FCOjima.Utils.getGradeLabel(grade)).join(', ');
        targetDisplay = `
        <div class="detail-item">
            <span class="detail-label">対象:</span> ${targetGrades}
        </div>`;
        
        if (event.targetNotes) {
            targetDisplay += `
            <div class="detail-item">
                <span class="detail-label">対象備考:</span> ${FCOjima.UI.escapeHTML(event.targetNotes)}
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
            <span class="detail-label">集合場所:</span> ${FCOjima.UI.escapeHTML(event.meetingPlace)}
        </div>`;
    }
    
    content.innerHTML = `
        <h3>${FCOjima.UI.escapeHTML(event.title)}</h3>
        <div class="detail-item">
            <span class="detail-label">日付:</span> ${FCOjima.Utils.formatDateForDisplay(event.date)}
        </div>
        <div class="detail-item">
            <span class="detail-label">種類:</span> ${FCOjima.Utils.getEventTypeLabel(event.type)}
        </div>
        ${targetDisplay}
        ${deadlineDisplay}
        ${departureDisplay}
        ${meetingPlaceDisplay}
        <div class="detail-item">
            <span class="detail-label">会場:</span> ${FCOjima.UI.escapeHTML(event.venue || '未設定')}
        </div>
        <div class="detail-item">
            <span class="detail-label">時間:</span> ${event.startTime || '未設定'}${event.endTime ? ` - ${event.endTime}` : ''}
        </div>
        ${event.notes ? `
        <div class="detail-item">
            <span class="detail-label">備考:</span><br>
            ${FCOjima.UI.escapeHTML(event.notes)}
        </div>
        ` : ''}
    `;
    
    // ボタンにイベントIDを設定
    document.getElementById('manage-event').setAttribute('data-event-id', event.id);
    document.getElementById('edit-event').setAttribute('data-event-id', event.id);
    document.getElementById('delete-event').setAttribute('data-event-id', event.id);
    
    // モーダルを表示
    FCOjima.UI.openModal('event-details-modal');
};

/**
 * 予定追加モーダルを開く
 * @param {Date} date - 日付（nullの場合は現在の日付）
 */
FCOjima.Hub.Calendar.openAddEventModal = function(date = null) {
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
    FCOjima.UI.openModal('event-modal');
};

/**
 * 対象学年のチェックボックスを生成
 */
FCOjima.Hub.Calendar.generateGradeCheckboxes = function() {
    const container = document.getElementById('event-target-grades');
    container.innerHTML = '';
    
    const members = FCOjima.Hub.members;
    
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
        label.textContent = FCOjima.Utils.getGradeLabel(grade);
        label.style.display = 'inline';
        
        item.appendChild(checkbox);
        item.appendChild(label);
        container.appendChild(item);
    });
};

/**
 * 新規イベント保存
 */
FCOjima.Hub.Calendar.saveEvent = function() {
    const events = FCOjima.Hub.events;
    const logs = FCOjima.Hub.logs;
    
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
        FCOjima.UI.showAlert('日付とタイトルは必須です');
        return;
    }
    
    // 新しいイベントID
    const newId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
    
    // 新しいイベントを追加または既存イベントを更新
    const eventFormId = document.getElementById('event-form').getAttribute('data-event-id');
    
    if (eventFormId) {
        // 既存イベントの更新
        const index = events.findIndex(e => e.id === parseInt(eventFormId));
        if (index !== -1) {
            events[index] = {
                id: parseInt(eventFormId),
                date,
                type,
                title,
                target,
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
            FCOjima.Hub.logs = FCOjima.Storage.addLog('calendar', 'イベント更新', `「${title}」（${date}）`, logs);
        }
    } else {
        // 新規イベントを追加
        events.push({
            id: newId,
            date,
            type,
            title,
            target,
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
        FCOjima.Hub.logs = FCOjima.Storage.addLog('calendar', 'イベント追加', `「${title}」（${date}）`, logs);
    }
    
    // イベントを保存してUIを更新
    FCOjima.Storage.saveEvents(events);
    this.renderCalendar();
    this.renderEventsList();
    
    // モーダルを閉じてフォームをリセット
    FCOjima.UI.closeModal('event-modal');
    document.getElementById('event-form').reset();
    document.getElementById('event-form').removeAttribute('data-event-id');
};

/**
 * イベント編集
 * @param {number} eventId - イベントID
 */
FCOjima.Hub.Calendar.editEvent = function(eventId) {
    const events = FCOjima.Hub.events;
    const event = events.find(e => e.id === parseInt(eventId));
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
        const deadlineDate = FCOjima.Utils.formatDate(deadline);
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
    FCOjima.UI.closeModal('event-details-modal');
    FCOjima.UI.openModal('event-modal');
};

/**
 * イベント削除
 * @param {number} eventId - イベントID
 */
FCOjima.Hub.Calendar.deleteEvent = function(eventId) {
    const events = FCOjima.Hub.events;
    const logs = FCOjima.Hub.logs;
    
    const event = events.find(e => e.id === parseInt(eventId));
    if (!event) return;
    
    if (FCOjima.UI.showConfirm(`イベント「${event.title}」を削除してもよろしいですか？`)) {
        // イベントを削除
        FCOjima.Hub.events = events.filter(e => e.id !== parseInt(eventId));
        
        // ログに記録
        FCOjima.Hub.logs = FCOjima.Storage.addLog('calendar', 'イベント削除', `「${event.title}」（${event.date}）`, logs);
        
        // イベントを保存してUIを更新
        FCOjima.Storage.saveEvents(FCOjima.Hub.events);
        this.renderCalendar();
        this.renderEventsList();
        
        // モーダルを閉じる
        FCOjima.UI.closeModal('event-details-modal');
    }
};

/**
 * 配車管理画面へ移動
 * @param {number} eventId - イベントID
 */
FCOjima.Hub.Calendar.navigateToCarpool = function(eventId) {
    const events = FCOjima.Hub.events;
    
    // イベント情報をセッションストレージに保存
    const event = events.find(e => e.id === parseInt(eventId));
    if (event) {
        FCOjima.Storage.setSelectedEvent(event);
        // 配車管理ページに移動
        window.location.href = 'carpool.html';
    }
};