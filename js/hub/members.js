<<<<<<< HEAD
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
=======
/**
 * FC尾島ジュニア - メンバータブの機能
 * メンバー管理に関する機能を提供
 */

FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Members = FCOjima.Hub.Members || {};

(function(app) {
    var Members = app.Hub.Members;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;

    /**
     * メンバー管理機能の初期化
     */
    Members.init = function() {
        console.log('メンバー管理機能を初期化しています...');
        app.Hub.members = Storage.loadMembers();
        this.renderMembersList();
        this.setupEventListeners();
        console.log('メンバー管理機能の初期化が完了しました');
    };

    /**
     * イベントリスナーの設定（要素がない場合はスキップ）
     */
    Members.setupEventListeners = function() {
        console.log('メンバー管理のイベントリスナーを設定しています...');

        var addBtn = document.getElementById('add-member');
        if (addBtn) addBtn.addEventListener('click', function() { Members.openAddMemberModal(); });

        var editBtn = document.getElementById('edit-member');
        if (editBtn) editBtn.addEventListener('click', function() { Members.openMemberSelectForEdit(); });

        var deleteBtn = document.getElementById('delete-member');
        if (deleteBtn) deleteBtn.addEventListener('click', function() { Members.openMemberSelectForDelete(); });

        var logsBtn = document.getElementById('member-logs');
        if (logsBtn) logsBtn.addEventListener('click', function() { app.Hub.openLogsModal('members'); });

        var floatingAddBtn = document.getElementById('floating-add-button');
        if (floatingAddBtn) {
            floatingAddBtn.addEventListener('click', function(e) {
                e.preventDefault();
                Members.openAddMemberModal();
            });
        }

        // メンバーフォーム送信
        var memberForm = document.getElementById('member-form');
        if (memberForm) {
            memberForm.addEventListener('submit', function(e) {
                e.preventDefault();
                Members.saveMember();
            });
        }

        // キャンセルボタン
        var cancelBtn = document.getElementById('cancel-member');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                UI.closeModal('member-modal');
            });
        }

        // メンバー詳細モーダルの編集・削除ボタン
        var editDetailBtn = document.getElementById('edit-member-detail');
        if (editDetailBtn) {
            editDetailBtn.addEventListener('click', function() {
                var memberId = this.getAttribute('data-member-id');
                if (memberId) {
                    UI.closeModal('member-details-modal');
                    Members.openAddMemberModal(memberId);
                }
            });
        }

        var deleteDetailBtn = document.getElementById('delete-member-detail');
        if (deleteDetailBtn) {
            deleteDetailBtn.addEventListener('click', function() {
                var memberId = this.getAttribute('data-member-id');
                if (memberId) Members.deleteMember(memberId);
            });
        }

        // 役割変更時（背番号フィールドの表示制御）
        var roleSelect = document.getElementById('member-role');
        if (roleSelect) {
            roleSelect.addEventListener('change', function() {
                var numberGroup = document.getElementById('number-group');
                if (numberGroup) numberGroup.style.display = (this.value === 'player') ? 'block' : 'none';
            });
        }

        // 検索（入力イベント + 検索ボタン）
        var memberSearch = document.getElementById('member-search');
        if (memberSearch) memberSearch.addEventListener('input', function() { Members.filterMembers(); });

        var searchBtn = document.getElementById('search-member-btn');
        if (searchBtn) searchBtn.addEventListener('click', function() { Members.filterMembers(); });

        var roleFilter = document.getElementById('role-filter');
        if (roleFilter) roleFilter.addEventListener('change', function() { Members.filterMembers(); });

        var gradeFilter = document.getElementById('grade-filter');
        if (gradeFilter) gradeFilter.addEventListener('change', function() { Members.filterMembers(); });

        this.initGradeFilter();

        console.log('メンバー管理のイベントリスナー設定が完了しました');
    };

    /**
     * 学年フィルター初期化
     */
    Members.initGradeFilter = function() {
        var gradeFilter = document.getElementById('grade-filter');
        if (!gradeFilter) return;

        while (gradeFilter.options.length > 1) gradeFilter.remove(1);

        var grades = new Set();
        (app.Hub.members || []).forEach(function(m) { if (m.grade) grades.add(m.grade); });
        if (grades.size === 0) ['年少','年中','年長','1','2','3','4','5','6'].forEach(function(g) { grades.add(g); });

        var gradeOrder = { '年少': -3, '年中': -2, '年長': -1 };
        var sorted = Array.from(grades).sort(function(a, b) {
            var va = gradeOrder[a] !== undefined ? gradeOrder[a] : parseInt(a);
            var vb = gradeOrder[b] !== undefined ? gradeOrder[b] : parseInt(b);
            return va - vb;
        });

        sorted.forEach(function(grade) {
            var opt = document.createElement('option');
            opt.value = grade;
            opt.textContent = Utils.getGradeLabel(grade);
            gradeFilter.appendChild(opt);
        });
    };

    /**
     * メンバーリストフィルタリング
     */
    Members.filterMembers = function() {
        var searchInput = document.getElementById('member-search');
        var roleFilter = document.getElementById('role-filter');
        var gradeFilter = document.getElementById('grade-filter');
        if (!searchInput || !roleFilter || !gradeFilter) return;

        var searchText = searchInput.value.toLowerCase();
        var selectedRole = roleFilter.value;
        var selectedGrade = gradeFilter.value;

        document.querySelectorAll('.member-card').forEach(function(card) {
            var h3 = card.querySelector('h3');
            var memberName = h3 ? h3.textContent.toLowerCase() : '';
            var memberRole = card.dataset.role || 'other';
            var memberGrade = card.dataset.grade || '';

            var matchText = !searchText || memberName.includes(searchText);
            var roleCategory = (memberRole === 'coach' || memberRole === 'assist') ? 'coach' :
                               (memberRole === 'father' || memberRole === 'mother') ? 'parent' :
                               memberRole;
            var matchRole = selectedRole === 'all' || roleCategory === selectedRole;
            var matchGrade = true;
            if (selectedGrade !== 'all') {
                matchGrade = (memberRole === 'player') ? memberGrade === selectedGrade : false;
            }

            card.style.display = (matchText && matchRole && matchGrade) ? '' : 'none';
        });
    };

    /**
     * メンバーリスト描画
     */
    Members.renderMembersList = function() {
        var members = app.Hub.members || [];
        var listContainer = document.getElementById('members-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (members.length === 0) {
            listContainer.innerHTML = UI.createAlert('info', '登録されているメンバーはいません。');
            return;
        }

        var rolePriority = { 'coach': 1, 'assist': 2, 'player': 3, 'mother': 4, 'father': 5, 'other': 6 };
        var sorted = members.slice().sort(function(a, b) {
            if (rolePriority[a.role] !== rolePriority[b.role]) return rolePriority[a.role] - rolePriority[b.role];
            if (a.role === 'player' && b.role === 'player') return (a.number || 999) - (b.number || 999);
            return (a.name || '').localeCompare(b.name || '', 'ja');
        });

        var roleLabels = { 'coach': '監督', 'assist': 'コーチ', 'player': '選手', 'father': '父', 'mother': '母', 'other': '部員外' };

        sorted.forEach(function(member) {
            var card = document.createElement('div');
            card.className = 'member-card ' + member.role;
            card.dataset.memberId = member.id;
            card.dataset.role = member.role;
            card.dataset.grade = member.grade || '';
            card.style.cursor = 'pointer';

            var gradeHtml = (member.role === 'player' && member.grade) ?
                '<div class="detail-row"><span class="detail-label">学年:</span><span class="detail-value">' + Utils.getGradeLabel(member.grade) + '</span></div>' : '';
            var numberHtml = (member.role === 'player' && member.number) ?
                '<div class="detail-row"><span class="detail-label">背番号:</span><span class="detail-value">' + member.number + '</span></div>' : '';
            var notesHtml = member.notes ?
                '<div class="detail-row"><span class="detail-label">備考:</span><span class="detail-value">' + UI.escapeHTML(member.notes) + '</span></div>' : '';

            card.innerHTML =
                '<h3>' + UI.escapeHTML(member.name) + '</h3>' +
                '<div class="detail-row"><span class="detail-label">所属:</span><span class="detail-value">' + (roleLabels[member.role] || member.role) + '</span></div>' +
                gradeHtml + numberHtml + notesHtml;

            // クリックで詳細モーダルを開く
            card.addEventListener('click', function(e) {
                if (!e.target.classList.contains('secondary-button') && !e.target.classList.contains('delete-button')) {
                    Members.showMemberDetail(member.id);
                }
            });

            listContainer.appendChild(card);
        });
    };

    /**
     * メンバー詳細モーダルを表示
     */
    Members.showMemberDetail = function(memberId) {
        var members = app.Hub.members || [];
        var member = members.find(function(m) { return String(m.id) === String(memberId); });
        if (!member) return;

        var roleLabels = { 'coach': '監督', 'assist': 'コーチ', 'player': '選手', 'father': '父', 'mother': '母', 'other': '部員外' };

        var html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr><td style="padding:6px;font-weight:bold;width:40%;">氏名</td><td style="padding:6px;">' + UI.escapeHTML(member.name) + '</td></tr>';
        html += '<tr><td style="padding:6px;font-weight:bold;">所属</td><td style="padding:6px;">' + (roleLabels[member.role] || member.role) + '</td></tr>';
        if (member.birth) {
            var birthDate = new Date(member.birth);
            var birthStr = birthDate.toLocaleDateString('ja-JP', {year:'numeric',month:'2-digit',day:'2-digit'});
            html += '<tr><td style="padding:6px;font-weight:bold;">生年月日</td><td style="padding:6px;">' + birthStr + '</td></tr>';
        }
        if (member.gender) {
            html += '<tr><td style="padding:6px;font-weight:bold;">性別</td><td style="padding:6px;">' + (member.gender === 'male' ? '男性' : '女性') + '</td></tr>';
        }
        if (member.grade) {
            html += '<tr><td style="padding:6px;font-weight:bold;">学年</td><td style="padding:6px;">' + Utils.getGradeLabel(member.grade) + '</td></tr>';
        }
        if (member.number) {
            html += '<tr><td style="padding:6px;font-weight:bold;">背番号</td><td style="padding:6px;">' + member.number + '</td></tr>';
        }
        if (member.notes) {
            html += '<tr><td style="padding:6px;font-weight:bold;">備考</td><td style="padding:6px;">' + UI.escapeHTML(member.notes) + '</td></tr>';
        }
        html += '</table>';

        var content = document.getElementById('member-details-content');
        if (content) content.innerHTML = html;

        var editBtn = document.getElementById('edit-member-detail');
        if (editBtn) editBtn.setAttribute('data-member-id', member.id);

        var deleteBtn = document.getElementById('delete-member-detail');
        if (deleteBtn) deleteBtn.setAttribute('data-member-id', member.id);

        UI.openModal('member-details-modal');
    };

    /**
     * メンバー追加・編集モーダルを開く
     */
    Members.openAddMemberModal = function(memberId) {
        var members = app.Hub.members || [];
        var titleEl = document.querySelector('#member-modal h2');
        if (titleEl) titleEl.textContent = memberId ? 'メンバーを編集' : 'メンバーを追加';

        var form = document.getElementById('member-form');
        if (form) form.reset();

        if (memberId) {
            var member = members.find(function(m) { return String(m.id) === String(memberId); });
            if (member && form) {
                form.setAttribute('data-member-id', member.id);
                document.getElementById('member-name').value = member.name || '';
                document.getElementById('member-birth').value = member.birth || '';
                document.getElementById('member-gender').value = member.gender || 'male';
                document.getElementById('member-role').value = member.role || 'player';
                document.getElementById('member-number').value = member.number || '';
                document.getElementById('member-notes').value = member.notes || '';
                var ng = document.getElementById('number-group');
                if (ng) ng.style.display = (member.role === 'player') ? 'block' : 'none';
            }
        } else {
            if (form) {
                form.removeAttribute('data-member-id');
                document.getElementById('member-gender').value = 'male';
                document.getElementById('member-role').value = 'player';
                var ng = document.getElementById('number-group');
                if (ng) ng.style.display = 'block';
            }
        }

        UI.openModal('member-modal');
    };

    /**
     * メンバー保存
     */
    Members.saveMember = function() {
        var members = app.Hub.members || [];
        var logs = app.Hub.logs || [];

        var name = document.getElementById('member-name').value.trim();
        var birth = document.getElementById('member-birth').value;
        var gender = document.getElementById('member-gender').value;
        var role = document.getElementById('member-role').value;
        var number = (role === 'player') ? document.getElementById('member-number').value : null;
        var notes = document.getElementById('member-notes').value.trim();

        if (!name) {
            UI.showAlert('名前は必須です', 'warning');
            return;
        }

        var grade = null;
        if (role === 'player' && birth) {
            grade = Utils.calculateGrade(birth);
        }

        var form = document.getElementById('member-form');
        var memberFormId = form ? form.getAttribute('data-member-id') : null;

        if (memberFormId) {
            var index = members.findIndex(function(m) { return String(m.id) === String(memberFormId); });
            if (index !== -1) {
                var origId = members[index].id;
                members[index] = { id: origId, name: name, birth: birth, gender: gender, role: role, number: number ? parseInt(number) : null, grade: grade, notes: notes };
                app.Hub.logs = Storage.addLog('members', 'メンバー更新', '「' + name + '」', logs);
            }
        } else {
            var ids = members.map(function(m) { return parseInt(m.id) || 0; });
            var newId = ids.length > 0 ? Math.max.apply(null, ids) + 1 : 1;
            members.push({ id: newId, name: name, birth: birth, gender: gender, role: role, number: number ? parseInt(number) : null, grade: grade, notes: notes });
            app.Hub.logs = Storage.addLog('members', 'メンバー追加', '「' + name + '」', logs);
        }

        Storage.saveMembers(members);
        this.renderMembersList();

        UI.closeModal('member-modal');
        if (form) { form.reset(); form.removeAttribute('data-member-id'); }
        UI.showAlert('メンバーを保存しました', 'success');
    };

    /**
     * メンバー編集
     */
    Members.editMember = function(memberId) {
        this.openAddMemberModal(memberId);
    };

    /**
     * メンバー削除
     */
    Members.deleteMember = function(memberId) {
        var members = app.Hub.members || [];
        var member = members.find(function(m) { return String(m.id) === String(memberId); });
        if (!member) return;

        if (!UI.showConfirm('メンバー「' + member.name + '」を削除してもよろしいですか？')) return;

        app.Hub.logs = Storage.addLog('members', 'メンバー削除', '「' + member.name + '」', app.Hub.logs || []);
        app.Hub.members = members.filter(function(m) { return String(m.id) !== String(memberId); });
        Storage.saveMembers(app.Hub.members);
        this.renderMembersList();

        UI.closeModal('member-details-modal');
        UI.showAlert('メンバーを削除しました', 'success');
    };

    /**
     * メンバー選択（編集用）
     */
    Members.openMemberSelectForEdit = function() {
        var members = app.Hub.members || [];
        var logsContent = document.getElementById('logs-content');
        if (!logsContent) return;

        var h3 = document.createElement('h3');
        h3.textContent = '編集するメンバーを選択';
        var selectList = document.createElement('div');
        selectList.className = 'select-list';

        if (members.length === 0) {
            selectList.innerHTML = UI.createAlert('info', 'メンバーがいません。');
        } else {
            members.forEach(function(member) {
                var item = document.createElement('div');
                item.className = 'list-item';
                item.textContent = member.name;
                item.addEventListener('click', function() {
                    UI.closeModal('logs-modal');
                    Members.openAddMemberModal(member.id);
                });
                selectList.appendChild(item);
            });
        }

        logsContent.innerHTML = '';
        logsContent.appendChild(h3);
        logsContent.appendChild(selectList);
        UI.openModal('logs-modal');
    };

    /**
     * メンバー選択（削除用）
     */
    Members.openMemberSelectForDelete = function() {
        var members = app.Hub.members || [];
        var logsContent = document.getElementById('logs-content');
        if (!logsContent) return;

        var h3 = document.createElement('h3');
        h3.textContent = '削除するメンバーを選択';
        var selectList = document.createElement('div');
        selectList.className = 'select-list';

        if (members.length === 0) {
            selectList.innerHTML = UI.createAlert('info', 'メンバーがいません。');
        } else {
            members.forEach(function(member) {
                var item = document.createElement('div');
                item.className = 'list-item';
                item.textContent = member.name;
                item.style.color = '#c0392b';
                item.addEventListener('click', function() {
                    UI.closeModal('logs-modal');
                    Members.deleteMember(member.id);
                });
                selectList.appendChild(item);
            });
        }

        logsContent.innerHTML = '';
        logsContent.appendChild(h3);
        logsContent.appendChild(selectList);
        UI.openModal('logs-modal');
    };

})(window.FCOjima);
>>>>>>> 3f29fdc53b2c8f871d428ea6715327a2f2c4429e
