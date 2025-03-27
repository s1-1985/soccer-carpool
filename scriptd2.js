// scriptd2.js - サッカーチーム送迎管理アプリのメイン JavaScript ファイル

// ページロード時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // イベント情報の読み込み
    loadEventData();
    
    // データをロード
    loadData();
    
    // 初期タブを開く - 概要タブをデフォルトで表示
    document.getElementById('defaultTab').click();
});

// セッションストレージからイベントデータを読み込む
function loadEventData() {
    const eventData = sessionStorage.getItem('selectedEvent');
    if (eventData) {
        const event = JSON.parse(eventData);
        displayEventData(event);
    } else {
        const eventSummary = document.getElementById('event-summary');
        if (eventSummary) {
            eventSummary.innerHTML = '<div class="alert info">イベントが選択されていません。カレンダーページからイベントを選択してください。</div>';
        }
    }
}

// イベントデータを表示
function displayEventData(event) {
    // 概要タブにイベント情報を表示
    const eventSummary = document.getElementById('event-summary');
    if (eventSummary) {
        eventSummary.innerHTML = `
            <div class="event-detail-card">
                <h3>${event.title}</h3>
                <div class="detail-row">
                    <span class="detail-label">日付:</span>
                    <span class="detail-value">${formatDateForDisplay(event.date)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">時間:</span>
                    <span class="detail-value">${event.time || '未設定'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">場所:</span>
                    <span class="detail-value">${event.location || '未設定'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">種類:</span>
                    <span class="detail-value">${getEventTypeLabel(event.type)}</span>
                </div>
                ${event.notes ? `
                <div class="detail-row">
                    <span class="detail-label">備考:</span>
                    <span class="detail-value">${event.notes}</span>
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
                <strong>${event.title}</strong> (${formatDateForDisplay(event.date)} ${event.time || ''})
            </div>
        `;
    }
    
    const assignmentEventInfo = document.getElementById('assignmentEventInfo');
    if (assignmentEventInfo) {
        assignmentEventInfo.innerHTML = `
            <div class="event-summary">
                <strong>${event.title}</strong> (${formatDateForDisplay(event.date)} ${event.time || ''})
            </div>
        `;
    }
}

// データ保存用オブジェクト
let appData = {
    eventId: null,
    carRegistrations: [],
    assignments: [],
    attendance: [],
    notifications: []
};

// ローカルストレージからデータをロード
function loadData() {
    const eventData = sessionStorage.getItem('selectedEvent');
    if (eventData) {
        const event = JSON.parse(eventData);
        appData.eventId = event.id;
        
        // ローカルストレージからこのイベント用のデータを取得
        const savedData = localStorage.getItem(`soccerCarpoolApp_event_${event.id}`);
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            appData = {...appData, ...parsedData};
        }
        
        refreshUI();
    }
}

// ローカルストレージにデータを保存
function saveData() {
    if (appData.eventId) {
        localStorage.setItem(`soccerCarpoolApp_event_${appData.eventId}`, JSON.stringify({
            carRegistrations: appData.carRegistrations,
            assignments: appData.assignments,
            attendance: appData.attendance,
            notifications: appData.notifications
        }));
    }
}

// UIを更新する関数
function refreshUI() {
    // 車の登録リストを更新
    updateCarRegistrations();
    
    // 割り当て一覧を更新
    updateAssignments();
    
    // 出欠状況を更新
    updateAttendance();
    
    // 連絡事項を更新
    updateNotifications();
}

// 車の登録リストを更新
function updateCarRegistrations() {
    const carsTable = document.getElementById('registeredCars');
    if (!carsTable) return;
    
    const tableBody = carsTable.querySelector('tbody');
    tableBody.innerHTML = '';
    
    if (appData.carRegistrations.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.innerHTML = '<div class="alert info">まだ車両提供の登録がありません。</div>';
        return;
    }
    
    appData.carRegistrations.forEach((registration, index) => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = registration.parent;
        row.insertCell(1).textContent = registration.child;
        row.insertCell(2).textContent = registration.canDrive === 'yes' ? '可能' : '不可';
        row.insertCell(3).textContent = registration.canDrive === 'yes' ? registration.capacity + '名' : '-';
        row.insertCell(4).textContent = registration.notes || '';
    });
}

// 割り当て一覧を更新
function updateAssignments() {
    const assignmentsDiv = document.getElementById('carAssignments');
    if (!assignmentsDiv) return;
    
    if (appData.assignments.length === 0) {
        assignmentsDiv.innerHTML = '<div class="alert info">まだ乗車割り当てが生成されていません。</div>';
        return;
    }
    
    assignmentsDiv.innerHTML = '';
    
    appData.assignments.forEach((assignment, index) => {
        const card = document.createElement('div');
        card.className = 'player-card';
        
        const title = document.createElement('h3');
        title.textContent = assignment.driver + 'さんの車';
        card.appendChild(title);
        
        const capacity = document.createElement('p');
        capacity.innerHTML = '<strong>乗車可能人数:</strong> ' + assignment.capacity + '名';
        card.appendChild(capacity);
        
        if (assignment.notes) {
            const notes = document.createElement('p');
            notes.innerHTML = '<strong>備考:</strong> ' + assignment.notes;
            card.appendChild(notes);
        }
        
        const passengerTitle = document.createElement('p');
        passengerTitle.innerHTML = '<strong>乗車メンバー:</strong>';
        card.appendChild(passengerTitle);
        
        const passengerList = document.createElement('ul');
        assignment.passengers.forEach(passenger => {
            const item = document.createElement('li');
            item.textContent = passenger + (passenger === assignment.passengers[0] ? ' (自分の子)' : '');
            passengerList.appendChild(item);
        });
        card.appendChild(passengerList);
        
        const editButton = document.createElement('button');
        editButton.textContent = '編集';
        editButton.onclick = function() { editAssignment(index); };
        card.appendChild(editButton);
        
        assignmentsDiv.appendChild(card);
    });
}

// 出欠状況を更新
function updateAttendance() {
    const attendanceTable = document.getElementById('attendance-table');
    if (!attendanceTable) return;
    
    // 既存の出欠データがあれば表示
    if (appData.attendance.length > 0) {
        const tableBody = attendanceTable.querySelector('tbody');
        tableBody.innerHTML = '';
        
        appData.attendance.forEach(player => {
            const row = tableBody.insertRow();
            
            const nameCell = row.insertCell(0);
            nameCell.textContent = player.name;
            
            const statusCell = row.insertCell(1);
            const statusSelect = document.createElement('select');
            statusSelect.className = 'attendance-select';
            statusSelect.innerHTML = `
                <option value="present" ${player.status === 'present' ? 'selected' : ''}>参加</option>
                <option value="absent" ${player.status === 'absent' ? 'selected' : ''}>欠席</option>
                <option value="late" ${player.status === 'late' ? 'selected' : ''}>遅刻</option>
                <option value="early-leave" ${player.status === 'early-leave' ? 'selected' : ''}>早退</option>
                <option value="unknown" ${player.status === 'unknown' ? 'selected' : ''}>未回答</option>
            `;
            statusCell.appendChild(statusSelect);
            
            const notesCell = row.insertCell(2);
            const notesInput = document.createElement('input');
            notesInput.type = 'text';
            notesInput.placeholder = '備考';
            notesInput.value = player.notes || '';
            notesCell.appendChild(notesInput);
        });
    }
}

// 連絡事項を更新
function updateNotifications() {
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList) return;
    
    if (appData.notifications.length === 0) {
        notificationsList.innerHTML = '<div class="alert info">現在、連絡事項はありません。</div>';
        return;
    }
    
    notificationsList.innerHTML = '';
    
    appData.notifications.forEach(notification => {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `alert ${notification.type || 'info'}`;
        notificationDiv.innerHTML = `${notification.date} - 「${notification.text}」`;
        notificationsList.appendChild(notificationDiv);
    });
}

// 車提供登録
function registerCar() {
    const parentName = document.getElementById('parentName').value;
    const childName = document.getElementById('childName').value;
    const canDrive = document.getElementById('canDrive').value;
    const capacity = document.getElementById('capacity').value;
    const notes = document.getElementById('notes').value;
    
    // 基本的な入力チェック
    if (!parentName && !childName) {
        alert('保護者名またはお子様の名前を入力してください');
        return;
    }
    
    // 既存登録のチェック - 同じ親子の組み合わせがあれば更新
    const existingIndex = appData.carRegistrations.findIndex(
        reg => reg.parent === parentName && reg.child === childName
    );
    
    const registration = {
        parent: parentName || '未入力',
        child: childName || '未入力',
        canDrive: canDrive,
        capacity: canDrive === 'yes' ? parseInt(capacity) : 0,
        notes: notes
    };
    
    if (existingIndex >= 0) {
        appData.carRegistrations[existingIndex] = registration;
    } else {
        appData.carRegistrations.push(registration);
    }
    
    // データ保存とUI更新
    saveData();
    updateCarRegistrations();
    
    // フォームリセット
    document.getElementById('carForm').reset();
    
    alert('車両情報を登録しました');
}

// 割り当て生成
function generateAssignments() {
    if (appData.carRegistrations.length === 0) {
        alert('この予定には車両登録がありません');
        return;
    }
    
    // 運転可能な保護者リスト
    const drivers = appData.carRegistrations.filter(reg => reg.canDrive === 'yes');
    
    if (drivers.length === 0) {
        alert('運転可能な保護者がいません');
        return;
    }
    
    // 運転不可能な子供リスト
    const needRide = appData.carRegistrations
        .filter(reg => reg.canDrive === 'no')
        .map(reg => reg.child);
    
    // 簡易的な割り当てアルゴリズム
    let assignments = [];
    let remainingKids = [...needRide];
    
    drivers.forEach(driver => {
        // ドライバー自身の子を含める
        let passengers = [driver.child];
        let remainingCapacity = driver.capacity - 1;
        
        // 残りの席に子供を割り当て
        while (remainingCapacity > 0 && remainingKids.length > 0) {
            passengers.push(remainingKids.shift());
            remainingCapacity--;
        }
        
        assignments.push({
            driver: driver.parent,
            capacity: driver.capacity,
            notes: driver.notes,
            passengers: passengers
        });
    });
    
    // 割り当て結果を保存
    appData.assignments = assignments;
    
    // UI更新
    saveData();
    updateAssignments();
    
    if (remainingKids.length > 0) {
        alert(`注意: ${remainingKids.length}名の子供に乗車スペースがありません。必要に応じて手動で調整してください。`);
    } else {
        alert('乗車割り当てが完了しました！');
    }
}

// 乗車割り当ての編集
function editAssignment(index) {
    // 実際の実装ではモーダルウィンドウなどで編集UI表示
    alert('この機能は現在開発中です');
}

// 割り当て結果の保存
function saveAssignments() {
    saveData();
    alert('割り当て情報を保存しました');
}

// 割り当て結果の共有
function shareAssignments() {
    // 実際の実装ではメール送信や共有リンク生成など
    alert('この機能は現在開発中です。将来的にはLINEやメールでの共有が可能になります。');
}

// 出欠確認を保存
function saveAttendance() {
    // テーブルから出欠データを取得
    const table = document.getElementById('attendance-table');
    const rows = table.querySelectorAll('tbody tr');
    const attendanceData = [];
    
    rows.forEach(row => {
        const name = row.cells[0].textContent;
        const status = row.querySelector('select').value;
        const notes = row.querySelector('input').value;
        
        attendanceData.push({
            name: name,
            status: status,
            notes: notes
        });
    });
    
    // データを保存
    appData.attendance = attendanceData;
    saveData();
    
    alert('出欠データを保存しました');
}

// 未回答者にリマインド
function reminderAttendance() {
    // 未回答者を抽出
    const unknownAttendees = appData.attendance.filter(player => player.status === 'unknown');
    
    if (unknownAttendees.length === 0) {
        alert('未回答の選手はいません');
        return;
    }
    
    // 実際の実装ではメール送信など
    alert(`${unknownAttendees.length}名の未回答者にリマインドを送信しました`);
}

// 新規連絡事項の送信
function sendNotification() {
    const text = document.getElementById('notificationText').value;
    
    if (!text) {
        alert('連絡内容を入力してください');
        return;
    }
    
    // 現在日時
    const now = new Date();
    const formattedDate = now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const formattedTime = now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // 新しい通知を追加
    appData.notifications.unshift({
        date: `${formattedDate} ${formattedTime}`,
        text: text,
        type: 'info'
    });
    
    // 保存とUI更新
    saveData();
    updateNotifications();
    
    // フォームリセット
    document.getElementById('notificationText').value = '';
    
    alert('連絡事項を送信しました');
}

// 日付のフォーマット表示用
function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    
    return `${year}年${month}月${day}日(${dayOfWeek})`;
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