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
        if (!app.Hub.members || app.Hub.members.length === 0) {
            app.Hub.members = Storage.loadMembers();
        }
        // 自動卒団チェック
        Members.checkGraduation();
        this.renderMembersList();
        this.setupEventListeners();
        console.log('メンバー管理機能の初期化が完了しました');
    };

    /**
     * 卒団チェック（中学1年＝grade:null になった選手を自動削除）
     */
    Members.checkGraduation = function() {
        var members = app.Hub.members || [];
        var graduated = members.filter(function(m) {
            if (m.role !== 'player' || !m.birth) return false;
            return Utils.calculateGrade(m.birth) === null;
        });
        if (graduated.length === 0) return;

        graduated.forEach(function(m) {
            var name = m.name;
            // 保護者の childrenIds から削除
            members.forEach(function(parent) {
                if ((parent.role === 'father' || parent.role === 'mother') && parent.childrenIds) {
                    parent.childrenIds = parent.childrenIds.filter(function(cid) {
                        return String(cid) !== String(m.id);
                    });
                }
            });
            app.Hub.logs = Storage.addLog('members', 'メンバー自動卒団', '「' + name + '」', app.Hub.logs || []);
        });

        var graduatedIds = graduated.map(function(m) { return String(m.id); });
        app.Hub.members = members.filter(function(m) { return !graduatedIds.includes(String(m.id)); });
        Storage.saveMembers(app.Hub.members);

        var names = graduated.map(function(m) { return m.name; }).join('、');
        UI.showAlert('【自動卒団】' + names + ' が中学進学のためメンバーから削除されました', 'info');
    };

    /**
     * イベントリスナーの設定
     */
    Members.setupEventListeners = function() {
        var addBtn = document.getElementById('add-member');
        if (addBtn) addBtn.addEventListener('click', function() { Members.openAddMemberModal(); });

        var editBtn = document.getElementById('edit-member');
        if (editBtn) editBtn.addEventListener('click', function() { Members.openMemberSelectForEdit(); });

        var deleteBtn = document.getElementById('delete-member');
        if (deleteBtn) deleteBtn.addEventListener('click', function() { Members.openMemberSelectForDelete(); });

        var logsBtn = document.getElementById('member-logs');
        if (logsBtn) logsBtn.addEventListener('click', function() { app.Hub.openLogsModal('members'); });

        var memberForm = document.getElementById('member-form');
        if (memberForm) {
            memberForm.addEventListener('submit', function(e) {
                e.preventDefault();
                Members.saveMember();
            });
        }

        var cancelBtn = document.getElementById('cancel-member');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                UI.closeModal('member-modal');
            });
        }

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

        // 役割変更時（背番号・子どもフィールドの表示制御）
        var roleSelect = document.getElementById('member-role');
        if (roleSelect) {
            roleSelect.addEventListener('change', function() {
                Members.onRoleChange(this.value);
            });
        }

        var memberSearch = document.getElementById('member-search');
        if (memberSearch) memberSearch.addEventListener('input', function() { Members.filterMembers(); });

        var searchBtn = document.getElementById('search-member-btn');
        if (searchBtn) searchBtn.addEventListener('click', function() { Members.filterMembers(); });

        var roleFilter = document.getElementById('role-filter');
        if (roleFilter) roleFilter.addEventListener('change', function() { Members.filterMembers(); });

        var gradeFilter = document.getElementById('grade-filter');
        if (gradeFilter) gradeFilter.addEventListener('change', function() { Members.filterMembers(); });

        this.initGradeFilter();
    };

    /**
     * 役割変更時のフィールド表示制御
     */
    Members.onRoleChange = function(role) {
        var numberGroup = document.getElementById('number-group');
        if (numberGroup) numberGroup.style.display = (role === 'player') ? 'block' : 'none';

        var childrenGroup = document.getElementById('children-group');
        if (childrenGroup) {
            childrenGroup.style.display = (role === 'father' || role === 'mother') ? 'block' : 'none';
            if (role === 'father' || role === 'mother') {
                Members.renderChildrenSelector();
            }
        }
    };

    /**
     * 子ども選択リストを描画
     */
    Members.renderChildrenSelector = function() {
        var container = document.getElementById('children-selector');
        if (!container) return;

        var members = app.Hub.members || [];
        var players = members.filter(function(m) { return m.role === 'player'; });

        // 現在フォームのmemberIdを取得（編集中の保護者IDを除外）
        var form = document.getElementById('member-form');
        var editingId = form ? form.getAttribute('data-member-id') : null;

        // 現在選択済みの子ども
        var currentSelected = [];
        if (editingId) {
            var editingMember = members.find(function(m) { return String(m.id) === String(editingId); });
            if (editingMember && editingMember.childrenIds) {
                currentSelected = editingMember.childrenIds.map(String);
            }
        }

        // hidden input から取得（新規/切替時）
        var hiddenInput = document.getElementById('member-children-ids');
        if (hiddenInput && hiddenInput.value) {
            try {
                currentSelected = JSON.parse(hiddenInput.value).map(String);
            } catch(e) {}
        }

        container.innerHTML = '';
        if (players.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:13px;">登録されている選手がいません</p>';
            return;
        }

        var gradeOrder = { '年少': -3, '年中': -2, '年長': -1 };
        var sorted = players.slice().sort(function(a, b) {
            var ga = gradeOrder[a.grade] !== undefined ? gradeOrder[a.grade] : (parseInt(a.grade) || 99);
            var gb = gradeOrder[b.grade] !== undefined ? gradeOrder[b.grade] : (parseInt(b.grade) || 99);
            if (ga !== gb) return ga - gb;
            return (a.number || 999) - (b.number || 999);
        });

        sorted.forEach(function(player) {
            var label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:14px;';

            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = String(player.id);
            cb.checked = currentSelected.includes(String(player.id));
            cb.addEventListener('change', function() {
                Members.updateChildrenIds();
            });

            var gradeLabel = player.grade ? Utils.getGradeLabel(player.grade) : '';
            var numLabel = player.number ? ' #' + player.number : '';
            label.appendChild(cb);
            label.appendChild(document.createTextNode(player.name + (gradeLabel ? ' (' + gradeLabel + numLabel + ')' : '')));
            container.appendChild(label);
        });
    };

    /**
     * 選択済み子どもIDをhidden inputに反映
     */
    Members.updateChildrenIds = function() {
        var checkboxes = document.querySelectorAll('#children-selector input[type=checkbox]:checked');
        var ids = Array.from(checkboxes).map(function(cb) { return cb.value; });
        var hiddenInput = document.getElementById('member-children-ids');
        if (hiddenInput) hiddenInput.value = JSON.stringify(ids);
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

        // ソート: 監督(1)→コーチ(2)→選手(3,学年→背番号)→保護者(4)→役員(5)→その他(6)
        var rolePriority = { 'coach': 1, 'assist': 2, 'player': 3, 'father': 4, 'mother': 4, 'officer': 5, 'other': 6 };
        var gradeOrder = { '年少': -3, '年中': -2, '年長': -1 };

        var sorted = members.slice().sort(function(a, b) {
            var pa = rolePriority[a.role] || 99;
            var pb = rolePriority[b.role] || 99;
            if (pa !== pb) return pa - pb;
            if (a.role === 'player' && b.role === 'player') {
                var ga = gradeOrder[a.grade] !== undefined ? gradeOrder[a.grade] : (parseInt(a.grade) || 99);
                var gb = gradeOrder[b.grade] !== undefined ? gradeOrder[b.grade] : (parseInt(b.grade) || 99);
                if (ga !== gb) return ga - gb;
                return (a.number || 999) - (b.number || 999);
            }
            return (a.name || '').localeCompare(b.name || '', 'ja');
        });

        var roleLabels = { 'coach': '監督', 'assist': 'コーチ', 'officer': '役員', 'player': '選手', 'father': '父', 'mother': '母', 'other': '部員外' };
        var genderLabels = { 'male': '男性', 'female': '女性' };

        sorted.forEach(function(member) {
            var card = document.createElement('div');
            card.className = 'member-card ' + member.role;
            card.dataset.memberId = member.id;
            card.dataset.role = member.role;
            card.dataset.grade = member.grade || '';
            card.style.cursor = 'pointer';

            var abbrHtml = member.abbr ?
                ' <span style="font-size:0.8em;color:#888;font-weight:normal;">（' + UI.escapeHTML(member.abbr) + '）</span>' : '';

            // 選手カード: 所属・学年・背番号を1行でコンパクト表示
            var infoHtml = '';
            if (member.role === 'player') {
                var parts = [roleLabels['player']];
                if (member.grade) parts.push(Utils.getGradeLabel(member.grade));
                if (member.number) parts.push('#' + member.number);
                infoHtml = '<div class="member-info-line">' + parts.join(' | ') + '</div>';
            } else if (member.role === 'father' || member.role === 'mother') {
                // 保護者カード: 氏名、性別、子どもの名前
                var genderStr = member.gender ? genderLabels[member.gender] || '' : '';
                var childrenNames = '';
                if (member.childrenIds && member.childrenIds.length > 0) {
                    var childNames = member.childrenIds.map(function(cid) {
                        var child = members.find(function(m) { return String(m.id) === String(cid); });
                        return child ? child.name : null;
                    }).filter(Boolean);
                    if (childNames.length > 0) childrenNames = '子: ' + childNames.join('、');
                }
                var parts2 = [roleLabels[member.role]];
                if (genderStr) parts2.push(genderStr);
                infoHtml = '<div class="member-info-line">' + parts2.join(' | ') + '</div>';
                if (childrenNames) infoHtml += '<div class="member-info-line" style="color:#666;font-size:0.85em;">' + UI.escapeHTML(childrenNames) + '</div>';
            } else {
                infoHtml = '<div class="member-info-line">' + (roleLabels[member.role] || member.role) + '</div>';
            }

            var notesHtml = member.notes ?
                '<div class="member-info-line" style="color:#888;font-size:0.8em;">' + UI.escapeHTML(member.notes) + '</div>' : '';

            card.innerHTML =
                '<h3>' + UI.escapeHTML(member.name) + abbrHtml + '</h3>' +
                infoHtml + notesHtml;

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

        var roleLabels = { 'coach': '監督', 'assist': 'コーチ', 'player': '選手', 'officer': '役員', 'father': '父', 'mother': '母', 'other': '部員外' };

        var html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr><td style="padding:6px;font-weight:bold;width:40%;">氏名</td><td style="padding:6px;">' + UI.escapeHTML(member.name) + '</td></tr>';
        if (member.kana) {
            html += '<tr><td style="padding:6px;font-weight:bold;">フリガナ</td><td style="padding:6px;color:#666;">' + UI.escapeHTML(member.kana) + '</td></tr>';
        }
        html += '<tr><td style="padding:6px;font-weight:bold;">所属</td><td style="padding:6px;">' + (roleLabels[member.role] || member.role) + '</td></tr>';
        if (member.gender) {
            html += '<tr><td style="padding:6px;font-weight:bold;">性別</td><td style="padding:6px;">' + (member.gender === 'male' ? '男性' : '女性') + '</td></tr>';
        }
        if (member.birth) {
            var birthDate = new Date(member.birth);
            var birthStr = birthDate.toLocaleDateString('ja-JP', {year:'numeric',month:'2-digit',day:'2-digit'});
            html += '<tr><td style="padding:6px;font-weight:bold;">生年月日</td><td style="padding:6px;">' + birthStr + '</td></tr>';
        }
        if (member.grade) {
            html += '<tr><td style="padding:6px;font-weight:bold;">学年</td><td style="padding:6px;">' + Utils.getGradeLabel(member.grade) + '</td></tr>';
        }
        if (member.number) {
            html += '<tr><td style="padding:6px;font-weight:bold;">背番号</td><td style="padding:6px;">' + member.number + '</td></tr>';
        }
        // 保護者: 子どもの名前を表示
        if ((member.role === 'father' || member.role === 'mother') && member.childrenIds && member.childrenIds.length > 0) {
            var childNames = member.childrenIds.map(function(cid) {
                var child = members.find(function(m) { return String(m.id) === String(cid); });
                return child ? child.name : null;
            }).filter(Boolean);
            if (childNames.length > 0) {
                html += '<tr><td style="padding:6px;font-weight:bold;">子どもの名前</td><td style="padding:6px;">' + UI.escapeHTML(childNames.join('、')) + '</td></tr>';
            }
        }
        if (member.abbr) {
            html += '<tr><td style="padding:6px;font-weight:bold;">略称</td><td style="padding:6px;">' + UI.escapeHTML(member.abbr) + '</td></tr>';
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

        // hidden input リセット
        var hiddenChildren = document.getElementById('member-children-ids');
        if (hiddenChildren) hiddenChildren.value = '[]';

        if (memberId) {
            var member = members.find(function(m) { return String(m.id) === String(memberId); });
            if (member && form) {
                form.setAttribute('data-member-id', member.id);
                document.getElementById('member-name').value = member.name || '';
                var kanaEl = document.getElementById('member-kana');
                if (kanaEl) kanaEl.value = member.kana || '';
                document.getElementById('member-birth').value = member.birth || '';
                document.getElementById('member-gender').value = member.gender || 'male';
                document.getElementById('member-role').value = member.role || 'player';
                document.getElementById('member-number').value = member.number || '';
                var abbrEl = document.getElementById('member-abbr');
                if (abbrEl) abbrEl.value = member.abbr || '';
                document.getElementById('member-notes').value = member.notes || '';

                // 子どもID をhidden inputに設定
                if (hiddenChildren && member.childrenIds) {
                    hiddenChildren.value = JSON.stringify(member.childrenIds.map(String));
                }

                Members.onRoleChange(member.role);
            }
        } else {
            if (form) {
                form.removeAttribute('data-member-id');
                document.getElementById('member-gender').value = 'male';
                document.getElementById('member-role').value = 'player';
                Members.onRoleChange('player');
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
        var kanaEl = document.getElementById('member-kana');
        var kana = kanaEl ? kanaEl.value.trim() : '';
        var birth = document.getElementById('member-birth').value;
        var gender = document.getElementById('member-gender').value;
        var role = document.getElementById('member-role').value;
        var number = (role === 'player') ? document.getElementById('member-number').value : null;
        var abbrEl = document.getElementById('member-abbr');
        var abbr = abbrEl ? abbrEl.value.trim() : '';
        var notes = document.getElementById('member-notes').value.trim();

        // 子どものID（保護者の場合）
        var childrenIds = [];
        if (role === 'father' || role === 'mother') {
            var hiddenChildren = document.getElementById('member-children-ids');
            if (hiddenChildren && hiddenChildren.value) {
                try { childrenIds = JSON.parse(hiddenChildren.value); } catch(e) {}
            }
        }

        if (!name) {
            UI.showAlert('名前は必須です', 'warning');
            return;
        }

        if (!abbr) abbr = name.length > 4 ? name.substring(0, 4) : name;

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
                members[index] = { id: origId, name: name, kana: kana, abbr: abbr, birth: birth, gender: gender, role: role, number: number ? parseInt(number) : null, grade: grade, notes: notes, childrenIds: childrenIds };
                app.Hub.logs = Storage.addLog('members', 'メンバー更新', '「' + name + '」', logs);
            }
        } else {
            var ids = members.map(function(m) { return parseInt(m.id) || 0; });
            var newId = ids.length > 0 ? Math.max.apply(null, ids) + 1 : 1;
            members.push({ id: newId, name: name, kana: kana, abbr: abbr, birth: birth, gender: gender, role: role, number: number ? parseInt(number) : null, grade: grade, notes: notes, childrenIds: childrenIds });
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
     * メンバー削除（保護者の childrenIds からも削除）
     */
    Members.deleteMember = function(memberId) {
        var members = app.Hub.members || [];
        var member = members.find(function(m) { return String(m.id) === String(memberId); });
        if (!member) return;

        if (!UI.showConfirm('メンバー「' + member.name + '」を削除してもよろしいですか？')) return;

        app.Hub.logs = Storage.addLog('members', 'メンバー削除', '「' + member.name + '」', app.Hub.logs || []);

        // 保護者の childrenIds から当該選手を削除
        if (member.role === 'player') {
            members.forEach(function(m) {
                if ((m.role === 'father' || m.role === 'mother') && m.childrenIds) {
                    m.childrenIds = m.childrenIds.filter(function(cid) { return String(cid) !== String(memberId); });
                }
            });
        }

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
