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
