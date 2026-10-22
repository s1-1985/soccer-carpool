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
     * メンバーを追加・編集・削除できるか（Firestoreルール上マネージャーのみ）。
     * 以前は保護者にも追加・編集・削除ボタンが表示され、押すと画面上は「保存しました」と
     * 出るのにサーバーへの書き込みは拒否され、再読み込みで元に戻っていた
     */
    function canManage() {
        return !!(app.Auth && app.Auth.isManager && app.Auth.isManager());
    }
    Members.canManage = canManage;

    function denyIfCannotManage() {
        if (canManage()) return false;
        UI.showAlert('メンバーの追加・編集・削除は管理者・指導者・役員のみ行えます', 'warning');
        return true;
    }

    /**
     * メンバー管理機能の初期化
     */
    Members.init = function() {
        console.log('メンバー管理機能を初期化しています...');
        if (!app.Hub.members || app.Hub.members.length === 0) {
            if (!app.Hub._loadedFromFirestore) app.Hub.members = Storage.loadMembers();
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
        // メンバーの書き込みはマネージャーのみ（Firestoreルール）。保護者の端末で実行すると
        // サーバーには反映されないのに画面からだけ消え、ログも端末ごとに重複して記録されていた
        if (!canManage()) return;
        var members = app.Hub.members || [];
        var graduated = members.filter(function(m) {
            if (m.role !== 'player' || !m.birth) return false;
            // calculateGrade()===null は「未就学で年少未満」「生年月日の入力ミス」でも真になり、
            // 卒団していない選手まで削除されていたため、中学生以上かどうかで判定する
            return Utils.isGraduated(m.birth);
        });
        if (graduated.length === 0) return;

        graduated.forEach(function(m) {
            var name = m.name;
            // 保護者の childrenIds から削除（父・母以外の役割で登録された保護者も含む）
            members.forEach(function(parent) {
                if (parent.role !== 'player' && parent.childrenIds) {
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
        if (Members._listenersSetup) return;
        Members._listenersSetup = true;
        var addBtn = document.getElementById('add-member');
        if (addBtn) addBtn.addEventListener('click', function() { Members.openAddMemberModal(); });

        var editBtn = document.getElementById('edit-member');
        if (editBtn) editBtn.addEventListener('click', function() { Members.openMemberSelectForEdit(); });

        var deleteBtn = document.getElementById('delete-member');
        if (deleteBtn) deleteBtn.addEventListener('click', function() { Members.openMemberSelectForDelete(); });

        var addSiblingBtn = document.getElementById('add-sibling-row');
        if (addSiblingBtn) addSiblingBtn.addEventListener('click', function() {
            var input = Members._addSiblingRow();
            if (input) input.focus();
        });

        // 編集権限がない人には追加・編集・削除ボタンを出さない
        if (!canManage()) {
            [addBtn, editBtn, deleteBtn,
             document.getElementById('edit-member-detail'),
             document.getElementById('delete-member-detail')].forEach(function(b) {
                if (b) b.style.display = 'none';
            });
        }

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

        // 子供の欄は父・母・役員（役員として登録された保護者）・コーチ（保護者を兼ねる場合）で出す。
        // 以前は役員・コーチに出なかったため、その人の子供を設定・変更できなかった
        var childrenGroup = document.getElementById('children-group');
        if (childrenGroup) {
            var hasChildren = Members._roleHasChildren(role);
            childrenGroup.style.display = hasChildren ? 'block' : 'none';
            var childrenLabel = childrenGroup.querySelector('label');
            if (childrenLabel) {
                childrenLabel.textContent = role === 'assist'
                    ? '子どもの名前（保護者を兼ねる場合。複数選択可）'
                    : '子どもの名前（複数選択可）';
            }
            if (hasChildren) {
                Members.renderChildrenSelector();
            }
        }
        // 兄弟児の欄も子供の欄と同じ役割（保護者）で出す
        var siblingsGroup = document.getElementById('siblings-group');
        if (siblingsGroup) siblingsGroup.style.display = Members._roleHasChildren(role) ? 'block' : 'none';
    };

    /**
     * 兄弟児の入力行を1行追加する
     * @param {{name:string, note:string}} [sibling]
     * @returns {HTMLInputElement|null} 名前の入力欄
     */
    Members._addSiblingRow = function(sibling) {
        var editor = document.getElementById('siblings-editor');
        if (!editor) return null;
        var row = document.createElement('div');
        row.className = 'sibling-row';
        // 1人分を枠で囲む（狭い画面で「削除」が次の段に回っても、どの兄弟児の削除か分かるように）
        row.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;border:1px solid #e6dfcf;border-radius:8px;padding:6px;';
        var name = document.createElement('input');
        name.type = 'text';
        name.className = 'sibling-name';
        name.placeholder = '名前（例: 佐々木 さくら）';
        name.maxLength = 30;
        name.style.cssText = 'flex:1 1 140px;min-width:0;';
        name.value = (sibling && sibling.name) || '';
        var note = document.createElement('input');
        note.type = 'text';
        note.className = 'sibling-note';
        note.placeholder = 'メモ（例: 3歳・チャイルドシート）';
        note.maxLength = 40;
        note.style.cssText = 'flex:1 1 140px;min-width:0;';
        note.value = (sibling && sibling.note) || '';
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'delete-button';
        rm.textContent = '削除';
        rm.style.cssText = 'flex:0 0 auto;margin-left:auto;padding:4px 10px;font-size:12px;min-height:32px;';
        rm.addEventListener('click', function() { row.remove(); });
        row.appendChild(name);
        row.appendChild(note);
        row.appendChild(rm);
        editor.appendChild(row);
        return name;
    };

    /** 兄弟児の表示用の文字列（「兄弟児: 佐々木 さくら（3歳）、…」。いなければ空文字） */
    Members._siblingsLabel = function(member) {
        var list = (member && member.siblings) || [];
        if (list.length === 0) return '';
        return '兄弟児: ' + list.map(function(s) { return s.name + (s.note ? '（' + s.note + '）' : ''); }).join('、');
    };

    /** 兄弟児の入力欄から [{name, note}] を読み取る（名前のない行は除き、同じ名前は1つにまとめる） */
    Members._readSiblingRows = function() {
        var list = [];
        var seen = {};
        document.querySelectorAll('#siblings-editor .sibling-row').forEach(function(row) {
            var name = (row.querySelector('.sibling-name').value || '').trim();
            var note = (row.querySelector('.sibling-note').value || '').trim();
            var key = Utils.normalizeName(name);
            if (!key || seen[key]) return;
            seen[key] = true;
            list.push({ name: name, note: note });
        });
        return list;
    };

    /** 子供の紐づけを編集できる役割か（父・母・役員・コーチ。コーチは保護者を兼ねる場合だけ子供を選ぶ） */
    Members._roleHasChildren = function(role) {
        return role === 'father' || role === 'mother' || role === 'officer' || role === 'assist';
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
            var ga = gradeOrder[a.grade] !== undefined ? gradeOrder[a.grade] : (parseInt(a.grade, 10) || 99);
            var gb = gradeOrder[b.grade] !== undefined ? gradeOrder[b.grade] : (parseInt(b.grade, 10) || 99);
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
            var va = gradeOrder[a] !== undefined ? gradeOrder[a] : (parseInt(a, 10) || 99);
            var vb = gradeOrder[b] !== undefined ? gradeOrder[b] : (parseInt(b, 10) || 99);
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
        var roleIcons = { 'coach': '🧢', 'assist': '📋', 'officer': '💼', 'player': '⚽', 'father': '👨', 'mother': '👩', 'other': '👤' };
        var genderLabels = { 'male': '男性', 'female': '女性' };
        // 未就学（年少/年中/年長）はグレード配色をひとつにまとめる
        var gradeColorKey = { '年少': 'pre', '年中': 'pre', '年長': 'pre' };

        sorted.forEach(function(member) {
            var card = document.createElement('div');
            card.className = 'member-card ' + member.role;
            card.dataset.memberId = member.id;
            card.dataset.role = member.role;
            card.dataset.grade = member.grade || '';
            if (member.role === 'player' && member.grade) {
                card.dataset.gradeColor = gradeColorKey[member.grade] || member.grade;
            }
            card.style.cursor = 'pointer';

            var icon = roleIcons[member.role] || '';
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
                        var child = Utils.findChildMemberById(members, cid);
                        return child ? child.name : null;
                    }).filter(Boolean);
                    if (childNames.length > 0) childrenNames = '子: ' + childNames.join('、');
                }
                var parts2 = [roleLabels[member.role]];
                if (genderStr) parts2.push(genderStr);
                infoHtml = '<div class="member-info-line">' + parts2.join(' | ') + '</div>';
                if (childrenNames) infoHtml += '<div class="member-info-line" style="color:#666;font-size:0.85em;">' + UI.escapeHTML(childrenNames) + '</div>';
                if (Members._siblingsLabel(member)) infoHtml += '<div class="member-info-line" style="color:#666;font-size:0.85em;">' + UI.escapeHTML(Members._siblingsLabel(member)) + '</div>';
            } else {
                infoHtml = '<div class="member-info-line">' + UI.escapeHTML(roleLabels[member.role] || member.role) + '</div>';
                // 役員として登録された保護者は子供も表示する
                if (Members._roleHasChildren(member.role) && member.childrenIds && member.childrenIds.length > 0) {
                    var officerChildNames = member.childrenIds.map(function(cid) {
                        var child = Utils.findChildMemberById(members, cid);
                        return child ? child.name : null;
                    }).filter(Boolean);
                    if (officerChildNames.length > 0) {
                        infoHtml += '<div class="member-info-line" style="color:#666;font-size:0.85em;">' + UI.escapeHTML('子: ' + officerChildNames.join('、')) + '</div>';
                    }
                }
                if (Members._siblingsLabel(member)) infoHtml += '<div class="member-info-line" style="color:#666;font-size:0.85em;">' + UI.escapeHTML(Members._siblingsLabel(member)) + '</div>';
            }

            var notesHtml = member.notes ?
                '<div class="member-info-line member-notes" style="color:#888;font-size:0.8em;">' + UI.escapeHTML(member.notes) + '</div>' : '';

            card.innerHTML =
                '<h3>' + (icon ? '<span class="member-role-icon">' + icon + '</span> ' : '') + UI.escapeHTML(member.name) + abbrHtml + '</h3>' +
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
        html += '<tr><td style="padding:6px;font-weight:bold;">所属</td><td style="padding:6px;">' + UI.escapeHTML(roleLabels[member.role] || member.role) + '</td></tr>';
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
        if (Members._roleHasChildren(member.role) && member.childrenIds && member.childrenIds.length > 0) {
            var childNames = member.childrenIds.map(function(cid) {
                var child = Utils.findChildMemberById(members, cid);
                return child ? child.name : null;
            }).filter(Boolean);
            if (childNames.length > 0) {
                html += '<tr><td style="padding:6px;font-weight:bold;">子どもの名前</td><td style="padding:6px;">' + UI.escapeHTML(childNames.join('、')) + '</td></tr>';
            }
        }
        if (member.siblings && member.siblings.length > 0) {
            html += '<tr><td style="padding:6px;font-weight:bold;">兄弟児</td><td style="padding:6px;">' + UI.escapeHTML(Members._siblingsLabel(member).replace(/^兄弟児: /, '')) + '</td></tr>';
        }
        if (member.abbr) {
            html += '<tr><td style="padding:6px;font-weight:bold;">略称</td><td style="padding:6px;">' + UI.escapeHTML(member.abbr) + '</td></tr>';
        }
        if (member.notes) {
            html += '<tr><td style="padding:6px;font-weight:bold;">備考</td><td class="member-notes" style="padding:6px;">' + UI.escapeHTML(member.notes) + '</td></tr>';
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
        if (denyIfCannotManage()) return;
        var members = app.Hub.members || [];
        var titleEl = document.querySelector('#member-modal h2');
        if (titleEl) titleEl.textContent = memberId ? 'メンバーを編集' : 'メンバーを追加';

        var form = document.getElementById('member-form');
        if (form) form.reset();

        // hidden input リセット
        var hiddenChildren = document.getElementById('member-children-ids');
        if (hiddenChildren) hiddenChildren.value = '[]';
        var siblingsEditor = document.getElementById('siblings-editor');
        if (siblingsEditor) siblingsEditor.innerHTML = '';

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
                (member.siblings || []).forEach(function(sib) { Members._addSiblingRow(sib); });

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
        if (denyIfCannotManage()) return;
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
        if (Members._roleHasChildren(role)) {
            var hiddenChildren = document.getElementById('member-children-ids');
            if (hiddenChildren && hiddenChildren.value) {
                try { childrenIds = JSON.parse(hiddenChildren.value); } catch(e) {}
            }
        }

        if (!name) {
            UI.showAlert('名前は必須です', 'warning');
            return;
        }

        // 同じ名前のメンバーがいると、出欠・配車・学年外追加などは名前で管理しているため
        // 2人を区別できず、片方の回答がもう片方に表示されるなどの食い違いが起きる
        var editingId = document.getElementById('member-form') ? document.getElementById('member-form').getAttribute('data-member-id') : null;
        var sameName = members.find(function(m) {
            return String(m.id) !== String(editingId) && Utils.normalizeName(m.name) === Utils.normalizeName(name);
        });
        if (sameName && !UI.showConfirm('「' + sameName.name + '」と同じ名前のメンバーがすでに登録されています。\n' +
                '出欠や配車は名前で管理しているため、同じ名前だと2人を区別できません。\n' +
                '（区別できるよう、名前に読みや学年を添えるなどをおすすめします）\n\nこのまま保存しますか？')) {
            return;
        }

        if (!abbr) abbr = name.length > 4 ? name.substring(0, 4) : name;

        var grade = null;
        if (role === 'player' && birth) {
            grade = Utils.calculateGrade(birth);
        }

        var form = document.getElementById('member-form');
        var memberFormId = form ? form.getAttribute('data-member-id') : null;
        var renamedFrom = null;

        if (memberFormId) {
            var index = members.findIndex(function(m) { return String(m.id) === String(memberFormId); });
            if (index !== -1) {
                var origId = members[index].id;
                // 子供欄は父・母のときしか表示されないため、役員など父・母以外の役割で登録された
                // 保護者を編集すると子供の紐づけが空で保存されて消えていた。選手以外は元の値を引き継ぐ
                if (!Members._roleHasChildren(role) && role !== 'player' && Array.isArray(members[index].childrenIds)) {
                    childrenIds = members[index].childrenIds;
                }
                var oldName = members[index].name;
                // 以前の名前（出欠・配車のデータが古い名前のまま残っていても本人として数えるため）
                var formerNames = (members[index].formerNames || []).slice();
                if (oldName && oldName !== name && formerNames.indexOf(oldName) === -1) formerNames.push(oldName);
                formerNames = formerNames.filter(function(n) { return n !== name; });
                // 兄弟児: 保護者の役割なら入力欄の内容、それ以外は元の値を引き継ぐ（欄が出ない役割で消えないように）
                var prevSiblings = members[index].siblings;
                var updated = { id: origId, name: name, kana: kana, abbr: abbr, birth: birth, gender: gender, role: role, number: number ? parseInt(number, 10) : null, grade: grade, notes: notes, childrenIds: childrenIds, formerNames: formerNames };
                if (Members._roleHasChildren(role)) {
                    var sibs = Members._readSiblingRows();
                    if (sibs.length > 0 || Array.isArray(prevSiblings)) updated.siblings = sibs;
                } else if (Array.isArray(prevSiblings)) {
                    updated.siblings = prevSiblings;
                }
                members[index] = updated;
                app.Hub.logs = Storage.addLog('members', 'メンバー更新', '「' + name + '」', logs);
                if (oldName && oldName !== name) renamedFrom = oldName;
            }
        } else {
            // タイムスタンプIDで採番（parseInt(最大値)+1 方式はFirestoreの英数字IDが
            // 0扱いになり既存IDと衝突するため廃止）
            var newId = Date.now();
            var created = { id: newId, name: name, kana: kana, abbr: abbr, birth: birth, gender: gender, role: role, number: number ? parseInt(number, 10) : null, grade: grade, notes: notes, childrenIds: childrenIds };
            if (Members._roleHasChildren(role)) {
                var newSibs = Members._readSiblingRows();
                if (newSibs.length > 0) created.siblings = newSibs;
            }
            members.push(created);
            app.Hub.logs = Storage.addLog('members', 'メンバー追加', '「' + name + '」', logs);
        }

        app.Hub.members = members; // app.Hub.membersを最新状態に保つ
        Storage.saveMembers(members);
        // 出欠・配車・学年外追加は名前で管理しているため、名前を変えたら予定のデータにも反映する
        if (renamedFrom) Members.propagateRename(renamedFrom, name);
        this.renderMembersList();

        UI.closeModal('member-modal');
        if (form) { form.reset(); form.removeAttribute('data-member-id'); }
        UI.showAlert('メンバーを保存しました', 'success');
    };

    /**
     * メンバーの名前変更を予定のデータに反映する。
     * 出欠・車の登録・座席・学年外追加は名前で管理しているため、以前は漢字の誤りを直しただけで、
     * 回答済みの出欠が「未回答」に戻る（古い名前の行が残る）、学年外追加から外れる、
     * 座席・運転手が別人扱いになる、といった食い違いが起きていた
     * @param {string} oldName
     * @param {string} newName
     */
    Members.propagateRename = async function(oldName, newName) {
        var events = app.Hub.events || [];
        // 予定の学年外追加（予定の一覧は手元にあるので全件まとめて保存）
        var changedEvents = false;
        events.forEach(function(ev) {
            if (Array.isArray(ev.extraPlayers) && ev.extraPlayers.indexOf(oldName) !== -1) {
                ev.extraPlayers = ev.extraPlayers.map(function(n) { return n === oldName ? newName : n; })
                    .filter(function(n, i, arr) { return arr.indexOf(n) === i; });
                changedEvents = true;
            }
        });
        if (changedEvents) Storage.saveEvents(events);

        if (!(window.FCOjima && FCOjima.DB && FCOjima.DB.updateEventData)) return;
        // 各予定の出欠・配車（今後の予定を先に。1件ずつトランザクションで最新の内容に対して書き換える）
        var today = Utils.formatDate(new Date());
        var ordered = events.slice().sort(function(a, b) {
            var fa = (a.date || '') >= today ? 0 : 1, fb = (b.date || '') >= today ? 0 : 1;
            return fa - fb || String(a.date || '').localeCompare(String(b.date || ''));
        });
        var failed = 0;
        var queue = ordered.slice();
        async function worker() {
            while (queue.length > 0) {
                var ev = queue.shift();
                try {
                    await FCOjima.DB.updateEventData(ev.id, function(data) {
                        return data ? Members._renameInEventData(data, oldName, newName) : {};
                    });
                } catch (e) {
                    failed++;
                    console.warn('名前変更の反映に失敗: event=' + ev.id, e);
                }
            }
        }
        await Promise.all([worker(), worker(), worker(), worker()]);
        if (failed > 0) {
            UI.showAlert('名前の変更を一部の予定（' + failed + '件）の出欠・配車に反映できませんでした。通信環境を確認してください', 'error', 8000);
        }
    };

    /**
     * イベントデータ内の名前を置き換えた差分（変更したフィールドだけ）を返す
     */
    Members._renameInEventData = function(data, oldName, newName) {
        var patch = {};
        function rn(n) { return n === oldName ? newName : n; }

        if (Array.isArray(data.attendance) && data.attendance.some(function(a) { return a && a.name === oldName; })) {
            var list = [];
            data.attendance.forEach(function(a) {
                if (!a) return;
                var item = Object.assign({}, a, { name: rn(a.name) });
                var dup = list.findIndex(function(x) { return x.name === item.name; });
                if (dup === -1) { list.push(item); return; }
                // 新しい名前の行がすでにある（自動追加された「未回答」など）→ 回答済みの方を残す
                if (list[dup].status === 'unknown' && item.status !== 'unknown') list[dup] = item;
            });
            patch.attendance = list;
        }
        ['attendanceRemoved', 'manualDriverNames', 'driverPeople'].forEach(function(f) {
            if (Array.isArray(data[f]) && data[f].indexOf(oldName) !== -1) {
                patch[f] = data[f].map(rn).filter(function(n, i, arr) { return arr.indexOf(n) === i; });
            }
        });
        // 運転手（parent）と、座席の割り当てで運転を替わったときの車の持ち主（owner）
        if (Array.isArray(data.carRegistrations) && data.carRegistrations.some(function(c) { return c && (c.parent === oldName || c.owner === oldName); })) {
            patch.carRegistrations = data.carRegistrations.map(function(c) {
                if (!c || (c.parent !== oldName && c.owner !== oldName)) return c;
                var copy = Object.assign({}, c);
                if (copy.parent === oldName) copy.parent = newName;
                if (copy.owner === oldName) copy.owner = newName;
                return copy;
            });
        }
        if (Array.isArray(data.assignments)) {
            var touched = false;
            var assignments = data.assignments.map(function(a) {
                if (!a) return a;
                var copy = Object.assign({}, a);
                if (copy.driver === oldName) { copy.driver = newName; touched = true; }
                if (copy.seats) {
                    var seats = {};
                    Object.keys(copy.seats).forEach(function(type) {
                        seats[type] = {};
                        Object.keys(copy.seats[type] || {}).forEach(function(idx) {
                            var p = copy.seats[type][idx];
                            if (p === oldName) touched = true;
                            seats[type][idx] = rn(p);
                        });
                    });
                    copy.seats = seats;
                }
                return copy;
            });
            if (touched) patch.assignments = assignments;
        }
        return patch;
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
        if (denyIfCannotManage()) return;

        if (!UI.showConfirm('メンバー「' + member.name + '」を削除してもよろしいですか？')) return;

        app.Hub.logs = Storage.addLog('members', 'メンバー削除', '「' + member.name + '」', app.Hub.logs || []);

        // 保護者の childrenIds から当該選手を削除（父・母以外の役割で登録された保護者も含む）
        if (member.role === 'player') {
            members.forEach(function(m) {
                if (m.role !== 'player' && m.childrenIds) {
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
        if (denyIfCannotManage()) return;
        var members = app.Hub.members || [];
        var logsContent = document.getElementById('logs-content');
        if (!logsContent) return;

        // 操作ログ用のモーダルを流用しているため、見出しを「操作ログ」のままにしない
        var modalTitle = document.querySelector('#logs-modal h2');
        if (modalTitle) modalTitle.textContent = 'メンバーを選択';
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
        if (denyIfCannotManage()) return;
        var members = app.Hub.members || [];
        var logsContent = document.getElementById('logs-content');
        if (!logsContent) return;

        // 操作ログ用のモーダルを流用しているため、見出しを「操作ログ」のままにしない
        var modalTitle = document.querySelector('#logs-modal h2');
        if (modalTitle) modalTitle.textContent = 'メンバーを選択';
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
