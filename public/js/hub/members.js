/**
 * FC尾島ジュニア - メンバー管理機能（Firebase版）
 * メンバー情報の管理、学年計算、フィルタリング機能
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Members = FCOjima.Hub.Members || {};

// メンバー管理モジュール
(function() {
    const Members = FCOjima.Hub.Members;
    const Firestore = FCOjima.Firestore;
    const Auth = FCOjima.Auth;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;
    
    // データ
    let members = [];
    let membersUnsubscribe = null;
    let currentFilters = {
        role: 'all',
        grade: 'all',
        status: 'active'
    };
    let currentEditingMember = null;
    
    /**
     * メンバー管理機能の初期化
     */
    Members.init = async function() {
        try {
            // 認証チェック
            if (!Auth.isLoggedIn()) {
                console.warn('未ログインユーザーです');
                UI.showAlert('ログインが必要です', 'warning');
                return;
            }
            
            // メンバーデータをリアルタイム監視で読み込み
            setupRealtimeListeners();
            
            // UI要素の初期化
            setupEventListeners();
            updateDisplay();
            
            // モーダルの初期化
            if (UI && UI.initModals) {
                UI.initModals();
            }
            
            console.log('メンバー管理機能を初期化しました（Firebase版）');
            
        } catch (error) {
            console.error('メンバー管理初期化エラー:', error);
            UI.showAlert('メンバー管理の初期化に失敗しました', 'danger');
        }
    };
    
    /**
     * リアルタイムリスナーの設定
     */
    function setupRealtimeListeners() {
        // 既存のリスナーを解除
        if (membersUnsubscribe) {
            membersUnsubscribe();
        }
        
        // メンバーのリアルタイム監視
        membersUnsubscribe = Firestore.watchMembers((updatedMembers) => {
            members = updatedMembers.map(member => ({
                ...member,
                grade: calculateGrade(member.birthDate), // 学年を自動計算
                age: calculateAge(member.birthDate)       // 年齢を自動計算
            }));
            updateDisplay();
        });
    }
    
    /**
     * イベントリスナーの設定
     */
    function setupEventListeners() {
        // フィルター機能
        const roleFilter = document.getElementById('role-filter');
        const gradeFilter = document.getElementById('grade-filter');
        const statusFilter = document.getElementById('status-filter');
        
        if (roleFilter) {
            roleFilter.addEventListener('change', function() {
                currentFilters.role = this.value;
                updateDisplay();
            });
        }
        
        if (gradeFilter) {
            gradeFilter.addEventListener('change', function() {
                currentFilters.grade = this.value;
                updateDisplay();
            });
        }
        
        if (statusFilter) {
            statusFilter.addEventListener('change', function() {
                currentFilters.status = this.value;
                updateDisplay();
            });
        }
        
        // メンバー追加ボタン
        const addMemberBtn = document.getElementById('add-member');
        if (addMemberBtn) {
            addMemberBtn.addEventListener('click', () => openMemberModal());
        }
        
        // メンバーフォーム送信
        const memberForm = document.getElementById('member-form');
        if (memberForm) {
            memberForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveMember();
            });
        }
        
        // 検索機能
        const searchInput = document.getElementById('member-search');
        if (searchInput) {
            searchInput.addEventListener('input', updateDisplay);
        }
        
        // バルクアクション
        const bulkDeleteBtn = document.getElementById('bulk-delete');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', bulkDeleteMembers);
        }
        
        // 卒業処理ボタン
        const graduateBtn = document.getElementById('process-graduation');
        if (graduateBtn) {
            graduateBtn.addEventListener('click', processGraduation);
        }
    }
    
    /**
     * 表示を更新
     */
    function updateDisplay() {
        const membersList = document.getElementById('members-list');
        if (!membersList) return;
        
        // フィルタリングとソート
        const filteredMembers = getFilteredMembers();
        
        if (filteredMembers.length === 0) {
            membersList.innerHTML = '<div class="no-members">条件に一致するメンバーがいません。</div>';
            updateStats();
            return;
        }
        
        // テーブル形式で表示
        let html = `
            <div class="members-table-container">
                <table class="table members-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="select-all-members"></th>
                            <th>名前</th>
                            <th>役割</th>
                            <th>学年</th>
                            <th>年齢</th>
                            <th>背番号</th>
                            <th>保護者</th>
                            <th>登録日</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        filteredMembers.forEach(member => {
            html += createMemberRow(member);
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        membersList.innerHTML = html;
        
        // 全選択チェックボックスのイベント設定
        setupBulkSelection();
        
        // 統計の更新
        updateStats();
    }
    
    /**
     * メンバー行を作成
     */
    function createMemberRow(member) {
        const roleLabel = getRoleLabel(member.role);
        const gradeDisplay = getGradeDisplay(member);
        const numberDisplay = member.role === 'player' && member.number ? member.number : '-';
        const registrationDate = member.createdAt ? Utils.formatDate(new Date(member.createdAt)) : '-';
        
        return `
            <tr class="member-row" data-member-id="${member.id}">
                <td><input type="checkbox" class="member-checkbox" value="${member.id}"></td>
                <td>
                    <div class="member-name">
                        <strong>${Utils.escapeHTML(member.name)}</strong>
                        ${member.status === 'inactive' ? '<span class="badge badge-secondary">退団</span>' : ''}
                        ${member.status === 'graduated' ? '<span class="badge badge-success">卒業</span>' : ''}
                    </div>
                </td>
                <td><span class="role-badge role-${member.role}">${roleLabel}</span></td>
                <td>${gradeDisplay}</td>
                <td>${member.age || '-'}歳</td>
                <td>${numberDisplay}</td>
                <td>${Utils.escapeHTML(member.parentName || '-')}</td>
                <td>${registrationDate}</td>
                <td>
                    <div class="member-actions">
                        <button onclick="FCOjima.Hub.Members.viewMember('${member.id}')" class="btn btn-info btn-sm" title="詳細">👁</button>
                        <button onclick="FCOjima.Hub.Members.editMember('${member.id}')" class="btn btn-primary btn-sm" title="編集">✏️</button>
                        <button onclick="FCOjima.Hub.Members.deleteMember('${member.id}')" class="btn btn-danger btn-sm" title="削除">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    /**
     * メンバーモーダルを開く
     */
    function openMemberModal(member = null) {
        currentEditingMember = member;
        
        const form = document.getElementById('member-form');
        const modal = document.getElementById('member-modal');
        
        if (!form || !modal) return;
        
        // フォームのリセット
        form.reset();
        
        if (member) {
            // 編集モード
            form.dataset.memberId = member.id;
            document.getElementById('member-name').value = member.name;
            document.getElementById('member-role').value = member.role;
            document.getElementById('member-birth-date').value = member.birthDate || '';
            document.getElementById('member-number').value = member.number || '';
            document.getElementById('member-parent-name').value = member.parentName || '';
            document.getElementById('member-phone').value = member.phone || '';
            document.getElementById('member-email').value = member.email || '';
            document.getElementById('member-address').value = member.address || '';
            document.getElementById('member-emergency-contact').value = member.emergencyContact || '';
            document.getElementById('member-notes').value = member.notes || '';
            document.getElementById('member-status').value = member.status || 'active';
            
            document.getElementById('modal-title').textContent = 'メンバー編集';
        } else {
            // 新規作成モード
            delete form.dataset.memberId;
            document.getElementById('member-status').value = 'active';
            document.getElementById('modal-title').textContent = 'メンバー追加';
        }
        
        // 役割に応じたフィールドの表示制御
        toggleRoleSpecificFields(member?.role || 'player');
        
        UI.openModal('member-modal');
    }
    
    /**
     * 役割別フィールドの表示制御
     */
    function toggleRoleSpecificFields(role) {
        const numberField = document.getElementById('number-field');
        const parentField = document.getElementById('parent-field');
        
        if (role === 'player') {
            if (numberField) numberField.style.display = 'block';
            if (parentField) parentField.style.display = 'block';
        } else {
            if (numberField) numberField.style.display = 'none';
            if (parentField) parentField.style.display = 'none';
        }
    }
    
    /**
     * メンバーを保存
     */
    async function saveMember() {
        try {
            const form = document.getElementById('member-form');
            const formData = new FormData(form);
            const memberId = form.dataset.memberId;
            
            // フォームデータを取得
            const memberData = {
                name: formData.get('name').trim(),
                role: formData.get('role'),
                birthDate: formData.get('birthDate'),
                number: formData.get('number') ? parseInt(formData.get('number')) : null,
                parentName: formData.get('parentName').trim(),
                phone: formData.get('phone').trim(),
                email: formData.get('email').trim(),
                address: formData.get('address').trim(),
                emergencyContact: formData.get('emergencyContact').trim(),
                notes: formData.get('notes').trim(),
                status: formData.get('status') || 'active'
            };
            
            // バリデーション
            if (!memberData.name) {
                UI.showAlert('名前を入力してください', 'warning');
                return;
            }
            
            // 背番号の重複チェック（選手の場合）
            if (memberData.role === 'player' && memberData.number) {
                const duplicateNumber = members.find(m => 
                    m.id !== memberId && 
                    m.role === 'player' && 
                    m.number === memberData.number &&
                    m.status === 'active'
                );
                
                if (duplicateNumber) {
                    UI.showAlert(`背番号${memberData.number}は既に使用されています`, 'warning');
                    return;
                }
            }
            
            // 権限チェック
            if (!Auth.hasPermission('manager')) {
                UI.showAlert('メンバーの編集権限がありません', 'danger');
                return;
            }
            
            // Firestoreに保存
            if (memberId) {
                // 既存メンバーの更新
                await Firestore.updateDocument('members', memberId, memberData);
                await Firestore.addLog('members', `メンバー「${memberData.name}」を編集しました`);
                UI.showAlert('メンバー情報を更新しました', 'success');
            } else {
                // 新規メンバーの追加
                memberData.createdAt = new Date().toISOString();
                await Firestore.addDocument('members', memberData);
                await Firestore.addLog('members', `メンバー「${memberData.name}」を追加しました`);
                UI.showAlert('メンバーを追加しました', 'success');
            }
            
            // モーダルを閉じる
            UI.closeModal('member-modal');
            
        } catch (error) {
            console.error('メンバー保存エラー:', error);
            UI.showAlert('メンバーの保存に失敗しました', 'danger');
        }
    }
    
    /**
     * メンバーを削除
     */
    Members.deleteMember = async function(memberId) {
        try {
            const member = members.find(m => m.id === memberId);
            if (!member) return;
            
            if (!confirm(`メンバー「${member.name}」を削除しますか？\n※この操作は取り消せません`)) {
                return;
            }
            
            // 権限チェック
            if (!Auth.hasPermission('manager')) {
                UI.showAlert('メンバーの削除権限がありません', 'danger');
                return;
            }
            
            await Firestore.deleteDocument('members', memberId);
            await Firestore.addLog('members', `メンバー「${member.name}」を削除しました`);
            
            UI.showAlert('メンバーを削除しました', 'success');
            
        } catch (error) {
            console.error('メンバー削除エラー:', error);
            UI.showAlert('メンバーの削除に失敗しました', 'danger');
        }
    };
    
    /**
     * メンバーを編集
     */
    Members.editMember = function(memberId) {
        const member = members.find(m => m.id === memberId);
        if (member) {
            openMemberModal(member);
        }
    };
    
    /**
     * メンバー詳細を表示
     */
    Members.viewMember = function(memberId) {
        const member = members.find(m => m.id === memberId);
        if (!member) return;
        
        const modal = document.getElementById('member-detail-modal');
        if (!modal) return;
        
        // メンバー詳細の表示
        document.getElementById('detail-name').textContent = member.name;
        document.getElementById('detail-role').textContent = getRoleLabel(member.role);
        document.getElementById('detail-grade').textContent = getGradeDisplay(member);
        document.getElementById('detail-age').textContent = `${member.age || '-'}歳`;
        document.getElementById('detail-birth-date').textContent = member.birthDate ? Utils.formatDate(new Date(member.birthDate)) : '-';
        document.getElementById('detail-number').textContent = member.number || '-';
        document.getElementById('detail-parent').textContent = member.parentName || '-';
        document.getElementById('detail-phone').textContent = member.phone || '-';
        document.getElementById('detail-email').textContent = member.email || '-';
        document.getElementById('detail-address').textContent = member.address || '-';
        document.getElementById('detail-emergency').textContent = member.emergencyContact || '-';
        document.getElementById('detail-notes').textContent = member.notes || '-';
        document.getElementById('detail-status').textContent = getStatusLabel(member.status);
        document.getElementById('detail-created').textContent = member.createdAt ? Utils.formatDate(new Date(member.createdAt)) : '-';
        
        UI.openModal('member-detail-modal');
    };
    
    /**
     * フィルタリングされたメンバーを取得
     */
    function getFilteredMembers() {
        const searchTerm = document.getElementById('member-search')?.value.toLowerCase() || '';
        
        return members.filter(member => {
            // 役割フィルター
            const roleMatch = currentFilters.role === 'all' || member.role === currentFilters.role;
            
            // 学年フィルター
            const gradeMatch = currentFilters.grade === 'all' || member.grade === currentFilters.grade;
            
            // ステータスフィルター
            const statusMatch = currentFilters.status === 'all' || member.status === currentFilters.status;
            
            // 検索フィルター
            const searchMatch = !searchTerm || 
                               member.name.toLowerCase().includes(searchTerm) ||
                               (member.parentName && member.parentName.toLowerCase().includes(searchTerm));
            
            return roleMatch && gradeMatch && statusMatch && searchMatch;
        }).sort((a, b) => {
            // ソート順: 役割 → 学年 → 名前
            if (a.role !== b.role) {
                const roleOrder = { 'coach': 0, 'player': 1, 'parent': 2 };
                return (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
            }
            
            if (a.grade !== b.grade) {
                return (parseInt(a.grade) || 0) - (parseInt(b.grade) || 0);
            }
            
            return a.name.localeCompare(b.name);
        });
    }
    
    /**
     * 学年を計算
     */
    function calculateGrade(birthDate) {
        if (!birthDate) return null;
        
        const birth = new Date(birthDate);
        const now = new Date();
        
        // 小学校入学年（4月2日〜翌年4月1日生まれが同学年）
        const schoolYearStart = new Date(now.getFullYear(), 3, 2); // 4月2日
        if (now < schoolYearStart) {
            schoolYearStart.setFullYear(schoolYearStart.getFullYear() - 1);
        }
        
        const elementarySchoolEntryYear = birth.getFullYear() + (birth.getMonth() >= 3 && birth.getDate() >= 2 ? 7 : 6);
        const gradeOffset = schoolYearStart.getFullYear() - elementarySchoolEntryYear;
        
        if (gradeOffset === -3) return "年少";
        if (gradeOffset === -2) return "年中"; 
        if (gradeOffset === -1) return "年長";
        if (gradeOffset >= 0 && gradeOffset <= 5) return String(gradeOffset + 1);
        
        return null;
    }
    
    /**
     * 年齢を計算
     */
    function calculateAge(birthDate) {
        if (!birthDate) return null;
        
        const birth = new Date(birthDate);
        const now = new Date();
        
        let age = now.getFullYear() - birth.getFullYear();
        const monthDiff = now.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }
    
    /**
     * 役割ラベルを取得
     */
    function getRoleLabel(role) {
        const labels = {
            coach: '監督・コーチ',
            player: '選手',
            parent: '保護者'
        };
        return labels[role] || role;
    }
    
    /**
     * 学年表示を取得
     */
    function getGradeDisplay(member) {
        if (member.role !== 'player') return '-';
        return member.grade || '未設定';
    }
    
    /**
     * ステータスラベルを取得
     */
    function getStatusLabel(status) {
        const labels = {
            active: '在籍',
            inactive: '退団',
            graduated: '卒業'
        };
        return labels[status] || status;
    }
    
    /**
     * 統計情報の更新
     */
    function updateStats() {
        const totalMembers = document.getElementById('total-members');
        const playersCount = document.getElementById('players-count');
        const coachesCount = document.getElementById('coaches-count');
        const parentsCount = document.getElementById('parents-count');
        
        const activeMembers = members.filter(m => m.status === 'active');
        
        if (totalMembers) {
            totalMembers.textContent = activeMembers.length;
        }
        
        if (playersCount) {
            playersCount.textContent = activeMembers.filter(m => m.role === 'player').length;
        }
        
        if (coachesCount) {
            coachesCount.textContent = activeMembers.filter(m => m.role === 'coach').length;
        }
        
        if (parentsCount) {
            parentsCount.textContent = activeMembers.filter(m => m.role === 'parent').length;
        }
    }
    
    /**
     * 一括選択の設定
     */
    function setupBulkSelection() {
        const selectAllCheckbox = document.getElementById('select-all-members');
        const memberCheckboxes = document.querySelectorAll('.member-checkbox');
        
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function() {
                memberCheckboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                });
                updateBulkActions();
            });
        }
        
        memberCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateBulkActions);
        });
    }
    
    /**
     * 一括操作ボタンの更新
     */
    function updateBulkActions() {
        const checkedBoxes = document.querySelectorAll('.member-checkbox:checked');
        const bulkActions = document.getElementById('bulk-actions');
        
        if (bulkActions) {
            bulkActions.style.display = checkedBoxes.length > 0 ? 'block' : 'none';
        }
    }
    
    /**
     * 一括削除
     */
    function bulkDeleteMembers() {
        const checkedBoxes = document.querySelectorAll('.member-checkbox:checked');
        const memberIds = Array.from(checkedBoxes).map(cb => cb.value);
        
        if (memberIds.length === 0) return;
        
        if (!confirm(`選択した${memberIds.length}名のメンバーを削除しますか？`)) {
            return;
        }
        
        // 権限チェック
        if (!Auth.hasPermission('manager')) {
            UI.showAlert('メンバーの削除権限がありません', 'danger');
            return;
        }
        
        // 一括削除実行
        Promise.all(memberIds.map(id => Firestore.deleteDocument('members', id)))
            .then(() => {
                UI.showAlert(`${memberIds.length}名のメンバーを削除しました`, 'success');
                Firestore.addLog('members', `${memberIds.length}名のメンバーを一括削除しました`);
            })
            .catch(error => {
                console.error('一括削除エラー:', error);
                UI.showAlert('一括削除に失敗しました', 'danger');
            });
    }
    
    /**
     * 卒業処理
     */
    function processGraduation() {
        const sixthGraders = members.filter(m => 
            m.role === 'player' && 
            m.grade === '6' && 
            m.status === 'active'
        );
        
        if (sixthGraders.length === 0) {
            UI.showAlert('卒業対象の6年生がいません', 'info');
            return;
        }
        
        if (!confirm(`6年生${sixthGraders.length}名を卒業処理しますか？`)) {
            return;
        }
        
        // 卒業処理実行
        Promise.all(sixthGraders.map(member => 
            Firestore.updateDocument('members', member.id, { 
                status: 'graduated',
                graduatedAt: new Date().toISOString()
            })
        ))
        .then(() => {
            UI.showAlert(`${sixthGraders.length}名の卒業処理が完了しました`, 'success');
            Firestore.addLog('members', `${sixthGraders.length}名の卒業処理を実行しました`);
        })
        .catch(error => {
            console.error('卒業処理エラー:', error);
            UI.showAlert('卒業処理に失敗しました', 'danger');
        });
    }
    
    /**
     * 表示の更新（外部から呼び出し可能）
     */
    Members.updateDisplay = updateDisplay;
    
    /**
     * クリーンアップ
     */
    Members.destroy = function() {
        if (membersUnsubscribe) {
            membersUnsubscribe();
            membersUnsubscribe = null;
        }
    };
    
    // ページから離れる時のクリーンアップ
    window.addEventListener('beforeunload', Members.destroy);
    
})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function() {
    if (typeof FCOjima !== 'undefined' && FCOjima.Hub && FCOjima.Hub.Members) {
        FCOjima.Hub.Members.init();
    }
});