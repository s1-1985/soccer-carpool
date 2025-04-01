/**
 * FC尾島ジュニア - メンバータブの機能
 * メンバー管理に関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * メンバーリストを描画
 */
FCOjima.Hub.Members.renderMembersList = function() {
    const members = FCOjima.Hub.members;
    
    const listContainer = document.getElementById('members-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    // メンバーを役割と背番号でソート
    const sortedMembers = [...members].sort((a, b) => {
        // 役割の優先順位: 監督, コーチ, 選手, 母, 父, 部員外
        const rolePriority = {
            'coach': 1,
            'assist': 2,
            'player': 3,
            'mother': 4,
            'father': 5,
            'other': 6
        };
        
        if (rolePriority[a.role] !== rolePriority[b.role]) {
            return rolePriority[a.role] - rolePriority[b.role];
        }
        
        // 選手の場合は背番号でソート
        if (a.role === 'player' && b.role === 'player') {
            const numA = a.number || 999;
            const numB = b.number || 999;
            return numA - numB;
        }
        
        // それ以外は名前でソート
        return a.name.localeCompare(b.name, 'ja');
    });
    
    sortedMembers.forEach(member => {
        const memberCard = document.createElement('div');
        memberCard.className = 'member-card';
        memberCard.dataset.memberId = member.id;
        
        // 役割に応じた表示ラベル
        const roleLabels = {
            'coach': '監督',
            'assist': 'コーチ',
            'player': '選手',
            'father': '父',
            'mother': '母',
            'other': '部員外'
        };
        
        // 学年表示（選手のみ）
        let gradeDisplay = '';
        if (member.role === 'player' && member.grade) {
            gradeDisplay = `<div class="detail-row">
                <span class="detail-label">学年:</span>
                <span class="detail-value">${FCOjima.Utils.getGradeLabel(member.grade)}</span>
            </div>`;
        }
        
        // 背番号表示（選手のみ）
        let numberDisplay = '';
        if (member.role === 'player' && member.number) {
            numberDisplay = `<div class="detail-row">
                <span class="detail-label">背番号:</span>
                <span class="detail-value">${member.number}</span>
            </div>`;
        }
        
        // 備考表示（あれば）
        let notesDisplay = '';
        if (member.notes) {
            notesDisplay = `<div class="detail-row">
                <span class="detail-label">備考:</span>
                <span class="detail-value">${FCOjima.UI.escapeHTML(member.notes)}</span>
            </div>`;
        }
        
        memberCard.innerHTML = `
            <h3>${FCOjima.UI.escapeHTML(member.name)}</h3>
            <div class="detail-row">
                <span class="detail-label">所属:</span>
                <span class="detail-value">${roleLabels[member.role] || member.role}</span>
            </div>
            ${gradeDisplay}
            ${numberDisplay}
            ${notesDisplay}
            <div class="member-actions">
                <button class="secondary-button" onclick="FCOjima.Hub.Members.editMember(${member.id})">編集</button>
                <button class="delete-button" onclick="FCOjima.Hub.Members.deleteMember(${member.id})">削除</button>
            </div>
        `;
        
        listContainer.appendChild(memberCard);
    });
};

/**
 * メンバー追加モーダルを開く
 * @param {number} memberId - メンバーID（編集時のみ指定、新規追加時はnull）
 */
FCOjima.Hub.Members.openAddMemberModal = function(memberId = null) {
    const members = FCOjima.Hub.members;
    
    // モーダルのタイトル設定
    const titleEl = document.querySelector('#member-modal h2');
    titleEl.textContent = memberId ? 'メンバーを編集' : 'メンバーを追加';
    
    // フォームをリセット
    document.getElementById('member-form').reset();
    
    // 編集の場合は既存データを設定
    if (memberId) {
        const member = members.find(m => m.id === memberId);
        if (member) {
            // フォームにメンバーIDを設定
            document.getElementById('member-form').setAttribute('data-member-id', member.id);
            
            document.getElementById('member-name').value = member.name || '';
            document.getElementById('member-birth').value = member.birth || '';
            document.getElementById('member-gender').value = member.gender || 'male';
            document.getElementById('member-role').value = member.role || 'player';
            document.getElementById('member-number').value = member.number || '';
            document.getElementById('member-notes').value = member.notes || '';
            
            // 役割に応じて背番号フィールドの表示/非表示
            const numberGroup = document.getElementById('number-group');
            if (member.role === 'player') {
                numberGroup.style.display = 'block';
            } else {
                numberGroup.style.display = 'none';
            }
        }
    } else {
        // 新規追加の場合はデフォルト値を設定
        document.getElementById('member-gender').value = 'male';
        document.getElementById('member-role').value = 'player';
        document.getElementById('number-group').style.display = 'block';
    }
    
    // モーダルを表示
    FCOjima.UI.openModal('member-modal');
};

/**
 * 新規メンバー保存
 */
FCOjima.Hub.Members.saveMember = function() {
    const members = FCOjima.Hub.members;
    const logs = FCOjima.Hub.logs;
    
    const name = document.getElementById('member-name').value;
    const birth = document.getElementById('member-birth').value;
    const gender = document.getElementById('member-gender').value;
    const role = document.getElementById('member-role').value;
    const number = role === 'player' ? document.getElementById('member-number').value : null;
    const notes = document.getElementById('member-notes').value;
    
    // バリデーション
    if (!name) {
        FCOjima.UI.showAlert('名前は必須です');
        return;
    }
    
    // 学年を計算
    let grade = null;
    if (role === 'player' && birth) {
        grade = FCOjima.Utils.calculateGrade(birth);
    }
    
    // 既存メンバーの更新または新規メンバーの追加
    const memberFormId = document.getElementById('member-form').getAttribute('data-member-id');
    
    if (memberFormId) {
        // 既存メンバーの更新
        const index = members.findIndex(m => m.id === parseInt(memberFormId));
        if (index !== -1) {
            members[index] = {
                id: parseInt(memberFormId),
                name,
                birth,
                gender,
                role,
                number: number ? parseInt(number) : null,
                grade,
                notes
            };
            
            // ログに記録
            FCOjima.Hub.logs = FCOjima.Storage.addLog('members', 'メンバー更新', `「${name}」`, logs);
            console.log(`メンバーを更新しました: ID=${memberFormId}, 名前=${name}`);
        }
    } else {
        // 新しいメンバーID
        const newId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;
        
        // 新規メンバーを追加
        members.push({
            id: newId,
            name,
            birth,
            gender,
            role,
            number: number ? parseInt(number) : null,
            grade,
            notes
        });
        
        // ログに記録
        FCOjima.Hub.logs = FCOjima.Storage.addLog('members', 'メンバー追加', `「${name}」`, logs);
        console.log(`新しいメンバーを追加しました: ID=${newId}, 名前=${name}`);
    }
    
    // メンバーを保存してUIを更新
    FCOjima.Storage.saveMembers(members);
    this.renderMembersList();
    
    // モーダルを閉じてフォームをリセット
    FCOjima.UI.closeModal('member-modal');
    document.getElementById('member-form').reset();
    document.getElementById('member-form').removeAttribute('data-member-id');
};

/**
 * メンバー編集
 * @param {number} memberId - メンバーID
 */
FCOjima.Hub.Members.editMember = function(memberId) {
    this.openAddMemberModal(memberId);
};

/**
 * メンバー削除
 * @param {number} memberId - メンバーID
 */
FCOjima.Hub.Members.deleteMember = function(memberId) {
    const members = FCOjima.Hub.members;
    const logs = FCOjima.Hub.logs;
    
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    
    if (FCOjima.UI.showConfirm(`メンバー「${member.name}」を削除してもよろしいですか？`)) {
        // メンバーを削除
        FCOjima.Hub.members = members.filter(m => m.id !== memberId);
        
        // ログに記録
        FCOjima.Hub.logs = FCOjima.Storage.addLog('members', 'メンバー削除', `「${member.name}」`, logs);
        
        // メンバーを保存してUIを更新
        FCOjima.Storage.saveMembers(FCOjima.Hub.members);
        this.renderMembersList();
    }
};

/**
 * メンバー選択モーダルを開く（編集用）
 */
FCOjima.Hub.Members.openMemberSelectForEdit = function() {
    const members = FCOjima.Hub.members;
    
    const selectList = document.createElement('div');
    selectList.className = 'select-list';
    
    if (members.length === 0) {
        selectList.innerHTML = FCOjima.UI.createAlert('info', '登録されているメンバーはいません。');
    } else {
        members.forEach(member => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.textContent = member.name;
            
            item.addEventListener('click', () => {
                this.openAddMemberModal(member.id);
                FCOjima.UI.closeModal('logs-modal');
            });
            
            selectList.appendChild(item);
        });
    }
    
    // 既存のログコンテンツを置き換え
    const logsContent = document.getElementById('logs-content');
    logsContent.innerHTML = '';
    logsContent.appendChild(document.createElement('h3')).textContent = 'メンバーを選択';
    logsContent.appendChild(selectList);
    
    // モーダルを表示
    FCOjima.UI.openModal('logs-modal');
};

/**
 * メンバー選択モーダルを開く（削除用）
 */
FCOjima.Hub.Members.openMemberSelectForDelete = function() {
    const members = FCOjima.Hub.members;
    
    const selectList = document.createElement('div');
    selectList.className = 'select-list';
    
    if (members.length === 0) {
        selectList.innerHTML = FCOjima.UI.createAlert('info', '登録されているメンバーはいません。');
    } else {
        members.forEach(member => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.textContent = member.name;
            
            item.addEventListener('click', () => {
                if (FCOjima.UI.showConfirm(`本当に「${member.name}」を削除しますか？`)) {
                    this.deleteMember(member.id);
                }
                FCOjima.UI.closeModal('logs-modal');
            });
            
            selectList.appendChild(item);
        });
    }
    
    // 既存のログコンテンツを置き換え
    const logsContent = document.getElementById('logs-content');
    logsContent.innerHTML = '';
    logsContent.appendChild(document.createElement('h3')).textContent = 'メンバーを選択';
    logsContent.appendChild(selectList);
    
    // モーダルを表示
    FCOjima.UI.openModal('logs-modal');
};