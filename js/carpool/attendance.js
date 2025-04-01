/**
 * FC尾島ジュニア - 出欠確認タブの機能
 * 出欠管理に関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * 初期化
 */
FCOjima.Carpool.Attendance.init = function() {
    console.log('出欠確認機能を初期化しています...');
    
    // 出欠回答期限を表示
    this.updateDeadline();
    
    // 出欠統計を表示
    this.updateStats();
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    console.log('出欠確認機能の初期化が完了しました');
};

/**
 * イベントリスナーの設定
 */
FCOjima.Carpool.Attendance.setupEventListeners = function() {
    // 出欠保存ボタンのイベントリスナー
    const saveButton = document.getElementById('save-attendance');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            this.saveAttendance();
        });
    }
    
    // リマインドボタンのイベントリスナー
    const reminderButton = document.getElementById('reminder-attendance');
    if (reminderButton) {
        reminderButton.addEventListener('click', () => {
            this.reminderAttendance();
        });
    }
    
    // メンバー追加ボタンのイベントリスナー
    const addAttendeeButton = document.getElementById('add-attendee');
    if (addAttendeeButton) {
        addAttendeeButton.addEventListener('click', () => {
            this.openMemberSelectModal();
        });
    }
};

/**
 * 出欠状況を更新
 */
FCOjima.Carpool.Attendance.updateAttendance = function() {
    console.log('出欠状況を更新しています...');
    
    const table = document.getElementById('attendance-table');
    if (!table) {
        console.log('出欠テーブルが見つかりません');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    
    // イベントの対象学年を取得
    const event = FCOjima.Storage.getSelectedEvent();
    let targetGrades = [];
    
    if (event && event.target && event.target.length > 0) {
        targetGrades = event.target;
        console.log(`対象学年: ${targetGrades.join(', ')}`);
    } else {
        console.log('対象学年が指定されていません');
    }
    
    // 対象学年の選手をフィルタリング
    let targetPlayers = [];
    const members = FCOjima.Carpool.members;
    
    if (targetGrades.length > 0) {
        targetPlayers = members.filter(m => 
            m.role === 'player' && 
            m.grade && 
            targetGrades.includes(m.grade)
        );
    } else {
        // 対象学年が指定されていない場合は全選手
        targetPlayers = members.filter(m => m.role === 'player');
    }
    
    // 学年→背番号の順でソート
    targetPlayers.sort((a, b) => {
        if (a.grade !== b.grade) {
            const gradeOrder = {
                '年少': -3,
                '年中': -2,
                '年長': -1
            };
            
            const valA = gradeOrder[a.grade] !== undefined ? gradeOrder[a.grade] : parseInt(a.grade);
            const valB = gradeOrder[b.grade] !== undefined ? gradeOrder[b.grade] : parseInt(b.grade);
            
            return valA - valB;
        }
        
        const numA = a.number || 999;
        const numB = b.number || 999;
        return numA - numB;
    });
    
    // 既存の出欠データを取得
    const attendanceData = FCOjima.Carpool.appData.attendance || [];
    
    // 選手ごとに行を追加
    targetPlayers.forEach(player => {
        const row = document.createElement('tr');
        
        // 名前
        const nameCell = document.createElement('td');
        nameCell.textContent = player.name;
        row.appendChild(nameCell);
        
        // 学年
        const gradeCell = document.createElement('td');
        gradeCell.textContent = player.grade ? FCOjima.Utils.getGradeLabel(player.grade) : '';
        row.appendChild(gradeCell);
        
        // 出欠入力セル
        const attendanceCell = document.createElement('td');
        const selectElement = document.createElement('select');
        selectElement.dataset.playerId = player.id;
        
        const options = [
            { value: 'unknown', text: '未定' },
            { value: 'present', text: '参加' },
            { value: 'absent', text: '欠席' }
        ];
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            selectElement.appendChild(optionElement);
        });
        
        // 既存データがあれば選択状態を設定
        const existingData = attendanceData.find(a => a.name === player.name);
        if (existingData) {
            selectElement.value = existingData.status || 'unknown';
        }
        
        attendanceCell.appendChild(selectElement);
        row.appendChild(attendanceCell);
        
        // 備考入力セル
        const notesCell = document.createElement('td');
        const notesInput = document.createElement('input');
        notesInput.type = 'text';
        notesInput.dataset.playerId = player.id;
        
        // 既存データがあれば備考を設定
        if (existingData) {
            notesInput.value = existingData.notes || '';
        }
        
        notesCell.appendChild(notesInput);
        row.appendChild(notesCell);
        
        tbody.appendChild(row);
    });
    
    // 出欠統計を更新
    this.updateStats();
    
    console.log('出欠状況の更新が完了しました');
};

/**
 * 出欠回答期限を表示
 */
FCOjima.Carpool.Attendance.updateDeadline = function() {
    console.log('出欠回答期限を更新しています...');
    
    const deadlineElement = document.getElementById('attendance-deadline');
    if (!deadlineElement) {
        console.log('出欠期限表示要素が見つかりません');
        return;
    }
    
    // イベント情報を取得
    const event = FCOjima.Storage.getSelectedEvent();
    if (!event) {
        deadlineElement.innerHTML = '';
        console.log('イベント情報が見つかりません');
        return;
    }
    
    // 回答期限の表示
    if (event.attendanceDeadline) {
        const deadlineDate = new Date(event.attendanceDeadline);
        const formattedDeadline = deadlineDate.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        deadlineElement.innerHTML = `
            <p><strong>出欠回答期限: ${formattedDeadline}</strong></p>`;
    } else {
        deadlineElement.innerHTML = `
            <p>出欠回答期限は設定されていません</p>`;
    }
    
    console.log('出欠回答期限の表示を更新しました');
};

/**
 * 出欠統計を更新
 */
FCOjima.Carpool.Attendance.updateStats = function() {
    console.log('出欠統計を更新しています...');
    
    const statsElement = document.getElementById('attendance-stats');
    if (!statsElement) {
        console.log('出欠統計表示要素が見つかりません');
        return;
    }
    
    // 出欠データを取得
    const attendanceData = FCOjima.Carpool.appData.attendance || [];
    
    // 出欠状況ごとの人数をカウント
    const stats = {
        present: 0, // 参加
        absent: 0,  // 欠席
        unknown: 0, // 未回答
        father: 0,  // 父親
        mother: 0,  // 母親
        other: 0    // 部員外
    };
    
    // 出欠状況のカウント
    attendanceData.forEach(item => {
        if (item.status === 'present') {
            stats.present++;
            
            // 参加者の役割を確認
            const member = FCOjima.Carpool.members.find(m => m.name === item.name);
            if (member) {
                if (member.role === 'father') {
                    stats.father++;
                } else if (member.role === 'mother') {
                    stats.mother++;
                } else if (member.role !== 'player' && member.role !== 'coach' && member.role !== 'assist') {
                    stats.other++;
                }
            }
        } else if (item.status === 'absent') {
            stats.absent++;
        } else {
            stats.unknown++;
        }
    });
    
    // 統計表示を更新
    statsElement.innerHTML = `
        <p>参加選手: <strong>${stats.present}人</strong> / 欠席: <strong>${stats.absent}人</strong> / 
           父: <strong>${stats.father}人</strong> / 母: <strong>${stats.mother}人</strong> / 
           部員外: <strong>${stats.other}人</strong></p>
        <p>未回答: <strong>${stats.unknown}人</strong></p>
    `;
    
    console.log('出欠統計の表示を更新しました');
};