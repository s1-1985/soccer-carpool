/**
 * FC尾島ジュニア - 出欠確認タブの機能
 * 出欠管理に関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

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
    
    console.log('出欠状況の更新が完了しました');
};

/**
 * 出欠情報の保存
 */
FCOjima.Carpool.Attendance.saveAttendance = function() {
    console.log('出欠情報を保存します...');
    
    const table = document.getElementById('attendance-table');
    if (!table) {
        console.log('出欠テーブルが見つかりません');
        return;
    }
    
    const rows = table.querySelectorAll('tbody tr');
    const attendanceData = [];
    
    rows.forEach(row => {
        const nameCell = row.cells[0];
        const statusSelect = row.querySelector('select');
        const notesInput = row.querySelector('input');
        
        if (nameCell && statusSelect) {
            attendanceData.push({
                name: nameCell.textContent,
                status: statusSelect.value,
                notes: notesInput ? notesInput.value : ''
            });
        }
    });
    
    // 出欠データを保存
    FCOjima.Carpool.appData.attendance = attendanceData;
    FCOjima.Carpool.saveData();
    
    console.log(`出欠情報を保存しました: ${attendanceData.length}人`);
    FCOjima.UI.showAlert('出欠情報を保存しました');
};

/**
 * 未回答者にリマインド
 */
FCOjima.Carpool.Attendance.reminderAttendance = function() {
    console.log('未回答者にリマインドを送信します...');
    
    const attendanceData = FCOjima.Carpool.appData.attendance || [];
    
    // 未回答の選手を抽出
    const unknownPlayers = attendanceData.filter(a => a.status === 'unknown');
    
    if (unknownPlayers.length === 0) {
        FCOjima.UI.showAlert('未回答者はいません');
        console.log('未回答者はいません');
        return;
    }
    
    // イベント情報を取得
    const event = FCOjima.Storage.getSelectedEvent();
    
    // リマインドメッセージを生成
    let message = '【出欠確認リマインド】\n';
    
    if (event) {
        message += `${FCOjima.Utils.formatDateForDisplay(event.date)} ${event.title}\n\n`;
    }
    
    message += '下記の選手は出欠未回答です。ご確認をお願いします。\n\n';
    message += unknownPlayers.map(p => p.name).join('\n');
    
    // テキストをクリップボードにコピー
    if (FCOjima.Utils.copyToClipboard(message)) {
        FCOjima.UI.showAlert('リマインド文をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
        
        // LINEでの共有（モバイルのみ）
        if (FCOjima.Utils.shareViaLINE(message)) {
            FCOjima.UI.showAlert('LINEでの共有を開始しました');
        }
    } else {
        FCOjima.UI.showAlert('クリップボードへのコピーに失敗しました');
    }
    
    console.log(`リマインドを送信しました: 未回答者${unknownPlayers.length}人`);
};

/**
 * メンバー選択モーダルを開く
 */
FCOjima.Carpool.Attendance.openMemberSelectModal = function() {
    console.log('メンバー選択モーダルを開きます...');
    
    const selectList = document.getElementById('member-select-list');
    if (!selectList) {
        console.log('メンバー選択リストが見つかりません');
        return;
    }
    
    selectList.innerHTML = '';
    
    // 既存の出欠データに含まれていないメンバーをフィルタリング
    const attendanceData = FCOjima.Carpool.appData.attendance || [];
    const existingMembers = attendanceData.map(a => a.name);
    
    const members = FCOjima.Carpool.members.filter(m => 
        m.role === 'player' && 
        !existingMembers.includes(m.name)
    );
    
    if (members.length === 0) {
        selectList.innerHTML = FCOjima.UI.createAlert('info', '追加できるメンバーがいません');
        console.log('追加できるメンバーがいません');
    } else {
        // 学年→背番号の順でソート
        members.sort((a, b) => {
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
        
        members.forEach(member => {
            const item = document.createElement('div');
            item.className = 'list-item';
            
            const gradeLabel = member.grade ? FCOjima.Utils.getGradeLabel(member.grade) : '';
            item.textContent = `${member.name} (${gradeLabel})`;
            
            item.addEventListener('click', () => {
                this.addMemberToAttendance(member);
                FCOjima.UI.closeModal('member-select-modal');
            });
            
            selectList.appendChild(item);
        });
    }
    
    // モーダルを表示
    FCOjima.UI.openModal('member-select-modal');
    
    console.log('メンバー選択モーダルを開きました');
};

/**
 * メンバーを出欠リストに追加
 * @param {Object} member - メンバーオブジェクト
 */
FCOjima.Carpool.Attendance.addMemberToAttendance = function(member) {
    console.log(`メンバーを出欠リストに追加します: ${member.name}`);
    
    // 出欠データに追加
    const attendanceData = FCOjima.Carpool.appData.attendance || [];
    
    attendanceData.push({
        name: member.name,
        status: 'unknown',
        notes: ''
    });
    
    // データを保存
    FCOjima.Carpool.appData.attendance = attendanceData;
    FCOjima.Carpool.saveData();
    
    // UI更新
    this.updateAttendance();
    
    console.log(`メンバーを出欠リストに追加しました: ${member.name}`);
    FCOjima.UI.showAlert(`${member.name}さんを出欠リストに追加しました`);
};