/**
 * FC尾島ジュニア - メンバータブの機能
 * メンバー管理に関する機能を提供
 */

FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Members = FCOjima.Hub.Members || {};

(function(app) {
    // 名前空間のショートカット
    var Members = app.Hub.Members;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;
    
    /**
     * メンバー管理機能の初期化
     */
    Members.init = function() {
        console.log('メンバー管理機能を初期化しています...');
        
        // データの読み込み
        app.Hub.members = Storage.loadMembers();
        
        // メンバーリストの描画
        this.renderMembersList();
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        console.log('メンバー管理機能の初期化が完了しました');
    };
    
    /**
     * イベントリスナーの設定
     */
    Members.setupEventListeners = function() {
        console.log('メンバー管理のイベントリスナーを設定しています...');
        
        // メンバー追加ボタン
        document.getElementById('add-member').addEventListener('click', function() {
            Members.openAddMemberModal();
        });
        
        // メンバー編集ボタン
        document.getElementById('edit-member').addEventListener('click', function() {
            Members.openMemberSelectForEdit();
        });
        
        // メンバー削除ボタン
        document.getElementById('delete-member').addEventListener('click', function() {
            Members.openMemberSelectForDelete();
        });
        
        // ログ表示ボタン
        document.getElementById('member-logs').addEventListener('click', function() {
            app.Hub.openLogsModal('members');
        });
        
        // フローティング追加ボタン
        var floatingAddButton = document.getElementById('floating-add-button');
        if (floatingAddButton) {
            floatingAddButton.addEventListener('click', function(e) {
                e.preventDefault();
                Members.openAddMemberModal();
            });
        }
        
        // キャンセルボタン
        document.getElementById('cancel-member').addEventListener('click', function() {
            UI.closeModal('member-modal');
            document.getElementById('member-form').reset();
            document.getElementById('member-form').removeAttribute('data-member-id');
        });

        // フォーム送信イベント
        document.getElementById('member-form').addEventListener('submit', function(e) {
            e.preventDefault();
            Members.saveMember();
        });
        
        // 役割変更時のイベント（背番号フィールドの表示/非表示）
        document.getElementById('member-role').addEventListener('change', function() {
            const numberGroup = document.getElementById('number-group');
            if (this.value === 'player') {
                numberGroup.style.display = 'block';
            } else {
                numberGroup.style.display = 'none';
            }
        });
        
        // 検索と絞り込み
        const memberSearch = document.getElementById('member-search');
        if (memberSearch) {
            memberSearch.addEventListener('input', function() {
                Members.filterMembers();
            });
        }
        
        const roleFilter = document.getElementById('role-filter');
        if (roleFilter) {
            roleFilter.addEventListener('change', function() {
                Members.filterMembers();
            });
        }
        
        const gradeFilter = document.getElementById('grade-filter');
        if (gradeFilter) {
            gradeFilter.addEventListener('change', function() {
                Members.filterMembers();
            });
        }
        
        // 学年フィルターの初期化
        this.initGradeFilter();
        
        console.log('メンバー管理のイベントリスナー設定が完了しました');
    };
    
    /**
     * 学年フィルターを初期化
     */
    Members.initGradeFilter = function() {
        const gradeFilter = document.getElementById('grade-filter');
        if (!gradeFilter) return;
        
        // 既存のオプションをクリア
        while (gradeFilter.options.length > 1) {
            gradeFilter.remove(1);
        }
        
        // メンバーデータから学年を抽出
        const members = app.Hub.members;
        const grades = new Set();
        
        members.forEach(member => {
            if (member.grade) {
                grades.add(member.grade);
            }
        });
        
        // 学年が存在しない場合は基本学年を追加
        if (grades.size === 0) {
            ['年少', '年中', '年長', '1', '2', '3', '4', '5', '6'].forEach(grade => {
                grades.add(grade);
            });
        }
        
        // ソートして追加
        const sortedGrades = Array.from(grades).sort((a, b) => {
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
            const option = document.createElement('option');
            option.value = grade;
            option.textContent = Utils.getGradeLabel(grade);
            gradeFilter.appendChild(option);
        });
    };
    
    /**
     * メンバーリストをフィルタリング
     */
    Members.filterMembers = function() {
        const searchInput = document.getElementById('member-search');
        const roleFilter = document.getElementById('role-filter');
        const gradeFilter = document.getElementById('grade-filter');
        
        if (!searchInput || !roleFilter || !gradeFilter) return;
        
        const searchText = searchInput.value.toLowerCase();
        const selectedRole = roleFilter.value;
        const selectedGrade = gradeFilter.value;
        
        const memberCards = document.querySelectorAll('.member-card');
        
        memberCards.forEach(card => {
            const memberName = card.querySelector('h3').textContent.toLowerCase();
            const memberRole = card.classList.contains('coach') ? 'coach' :
                               card.classList.contains('assist') ? 'coach' :
                               card.classList.contains('player') ? 'player' :
                               card.classList.contains('parent') ? 'parent' : 'other';
            
            let matchesSearch = memberName.includes(searchText);
            let matchesRole = selectedRole === 'all' || memberRole === selectedRole;
            let matchesGrade = true; // デフォルトは一致と見なす
            
            // 学年フィルターが指定されている場合は確認
            if (selectedGrade !== 'all') {
                // 選手のみ学年でフィルタリング
                if (memberRole === 'player') {
                    const gradeElem = card.querySelector('.detail-row:nth-child(2) .detail-value');
                    if (gradeElem) {
                        const grade = gradeElem.textContent.replace('年', '');
                        matchesGrade = grade === Utils.getGradeLabel(selectedGrade);
                    } else {
                        matchesGrade = false;
                    }
                } else {
                    // 選手以外は学年フィルターが指定されている場合は非表示
                    matchesGrade = false;
                }
            }
            
            // すべての条件に一致する場合のみ表示
            if (matchesSearch && matchesRole && matchesGrade) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    };
    
    /**
     * メンバーリストを描画
     */
    Members.renderMembersList = function() {
        const members = app.Hub.members;
        
        const listContainer = document.getElementById('members-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = '';
        
        if (members.length === 0) {
            listContainer.innerHTML = UI.createAlert('info', '登録されているメンバーはいません。');
            return;
        }
        
        // メンバーをソート: 監督(登録順) → コーチ(登録順) → 選手(学年→登録順) → 保護者/その他(登録順)
        const gradeOrder = { '年少': -3, '年中': -2, '年長': -1 };
        const rolePriority = { 'coach': 1, 'assist': 2, 'player': 3, 'mother': 4, 'father': 5, 'other': 6 };
        const sortedMembers = [...members].sort((a, b) => {
            const ra = rolePriority[a.role] || 99;
            const rb = rolePriority[b.role] || 99;
            if (ra !== rb) return ra - rb;
            // 同じ役割の場合
            if (a.role === 'player') {
                // 選手: 学年順 → 同学年内は登録順(ID順)
                const ga = gradeOrder[a.grade] !== undefined ? gradeOrder[a.grade] : (parseInt(a.grade) || 99);
                const gb = gradeOrder[b.grade] !== undefined ? gradeOrder[b.grade] : (parseInt(b.grade) || 99);
                if (ga !== gb) return ga - gb;
            }
            // 登録順(ID順)
            return (a.id || 0) - (b.id || 0);
        });
        
        sortedMembers.forEach(member => {
            const memberCard = document.createElement('div');
            memberCard.className = 'member-card';
            memberCard.classList.add(member.role);
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
                    <span class="detail-value">${Utils.getGradeLabel(member.grade)}</span>
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
                    <span class="detail-value">${UI.escapeHTML(member.notes)}</span>
                </div>`;
            }
            
            memberCard.innerHTML = `
                <h3>${UI.escapeHTML(member.name)}</h3>
                <div class="detail-row">
                    <span class="detail-label">所属:</span>
                    <span class="detail-value">${roleLabels[member.role] || member.role}</span>
                </div>
                ${gradeDisplay}
                ${numberDisplay}
                ${notesDisplay}
                <div class="member-actions">
                    <button class="secondary-button" onclick="FCOjima.Hub.Members.editMember(${member.id})">編集</button>
                </div>
            `;
            
            listContainer.appendChild(memberCard);
        });
    };
    
    /**
     * メンバー追加モーダルを開く
     * @param {number} memberId - メンバーID（編集時のみ指定、新規追加時はnull）
     */
    Members.openAddMemberModal = function(memberId = null) {
        const members = app.Hub.members;
        
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
        UI.openModal('member-modal');
    };
    
    /**
     * 新規メンバー保存
     */
    Members.saveMember = function() {
        const members = app.Hub.members;
        const logs = app.Hub.logs;
        
        const name = document.getElementById('member-name').value;
        const birth = document.getElementById('member-birth').value;
        const gender = document.getElementById('member-gender').value;
        const role = document.getElementById('member-role').value;
        const number = role === 'player' ? document.getElementById('member-number').value : null;
        const notes = document.getElementById('member-notes').value;
        
        // バリデーション
        if (!name) {
            UI.showAlert('名前は必須です');
            return;
        }
        
        // 学年を計算
        let grade = null;
        if (role === 'player' && birth) {
            grade = Utils.calculateGrade(birth);
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
                app.Hub.logs = Storage.addLog('members', 'メンバー更新', `「${name}」`, logs);
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
            app.Hub.logs = Storage.addLog('members', 'メンバー追加', `「${name}」`, logs);
            console.log(`新しいメンバーを追加しました: ID=${newId}, 名前=${name}`);
        }
        
        // メンバーを保存してUIを更新
        Storage.saveMembers(members);
        this.renderMembersList();
        
        // モーダルを閉じてフォームをリセット
        UI.closeModal('member-modal');
        document.getElementById('member-form').reset();
        document.getElementById('member-form').removeAttribute('data-member-id');
    };
    
    /**
     * メンバー編集
     * @param {number} memberId - メンバーID
     */
    Members.editMember = function(memberId) {
        this.openAddMemberModal(memberId);
    };
    
    /**
     * メンバー削除
     * @param {number} memberId - メンバーID
     */
    Members.deleteMember = function(memberId) {
        const members = app.Hub.members;
        const logs = app.Hub.logs;
        
        const member = members.find(m => m.id === memberId);
        if (!member) return;
        
        if (UI.showConfirm(`メンバー「${member.name}」を削除してもよろしいですか？`)) {
            // メンバーを削除
            app.Hub.members = members.filter(m => m.id !== memberId);
            
            // ログに記録
            app.Hub.logs = Storage.addLog('members', 'メンバー削除', `「${member.name}」`, logs);
            
            // メンバーを保存してUIを更新
            Storage.saveMembers(app.Hub.members);
            this.renderMembersList();
        }
    };
    
    /**
     * メンバー選択モーダルを開く（編集用）
     */
    Members.openMemberSelectForEdit = function() {
        const members = app.Hub.members;
        
        const selectList = document.createElement('div');
        selectList.className = 'select-list';
        
        if (members.length === 0) {
            selectList.innerHTML = UI.createAlert('info', '登録されているメンバーはいません。');
        } else {
            members.forEach(member => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.textContent = member.name;
                
                item.addEventListener('click', () => {
                    this.openAddMemberModal(member.id);
                    UI.closeModal('logs-modal');
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
        UI.openModal('logs-modal');
    };
    
    /**
     * メンバー選択モーダルを開く（削除用）
     */
    Members.openMemberSelectForDelete = function() {
        const members = app.Hub.members;
        
        const selectList = document.createElement('div');
        selectList.className = 'select-list';
        
        if (members.length === 0) {
            selectList.innerHTML = UI.createAlert('info', '登録されているメンバーはいません。');
        } else {
            members.forEach(member => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.textContent = member.name;
                
                item.addEventListener('click', () => {
                    if (UI.showConfirm(`本当に「${member.name}」を削除しますか？`)) {
                        this.deleteMember(member.id);
                    }
                    UI.closeModal('logs-modal');
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
        UI.openModal('logs-modal');
    };
    
})(window.FCOjima);