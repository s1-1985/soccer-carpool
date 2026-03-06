/**
 * FC尾島ジュニア - 管理タブの機能
 * 承認待ちユーザーの管理・役割変更（監督・コーチ・役員・管理者のみ使用可）
 */

FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Admin = FCOjima.Hub.Admin || {};

(function(app) {
    var Admin = app.Hub.Admin;
    var UI = app.UI;

    var ROLE_LABELS = {
        'admin':   '管理者',
        'coach':   '監督',
        'assist':  'コーチ',
        'officer': '役員',
        'parent':  '保護者'
    };

    /**
     * 管理タブの初期化
     */
    Admin.init = function() {
        console.log('管理タブを初期化しています...');
        Admin.refresh();
        Admin.initAttendanceMatrixModal();
        Admin.initEventDetailModal();
    };

    Admin.initEventDetailModal = function() {
        var modal = document.getElementById('event-detail-modal');
        var closeBtn = document.getElementById('event-detail-modal-close');
        if (!modal) return;
        closeBtn && closeBtn.addEventListener('click', function() { modal.style.display = 'none'; });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.style.display = 'none'; });
    };

    Admin.initAttendanceMatrixModal = function() {
        var btn = document.getElementById('btn-attendance-matrix');
        var modal = document.getElementById('attendance-matrix-modal');
        var closeBtn = document.getElementById('attendance-matrix-modal-close');
        if (!btn || !modal) return;

        var loaded = false;
        btn.addEventListener('click', function() {
            modal.style.display = 'flex';
            if (!loaded) {
                loaded = true;
                Admin.loadAttendanceMatrix();
            }
        });
        closeBtn && closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.style.display = 'none';
        });
    };

    /**
     * 承認待ち・全ユーザーを再読み込みして表示
     */
    Admin.refresh = async function() {
        try {
            await Promise.all([Admin.loadPendingUsers(), Admin.loadAllUsers()]);
        } catch(e) {
            console.error('管理タブ読み込みエラー:', e);
        }
    };

    /**
     * 承認待ちユーザーを読み込んで表示
     */
    Admin.loadPendingUsers = async function() {
        var el = document.getElementById('pending-users-list');
        if (!el) return;
        el.innerHTML = '<p class="loading">読み込み中...</p>';

        try {
            var users = await FCOjima.DB.loadPendingUsers();
            if (users.length === 0) {
                el.innerHTML = '<p style="color:#999;padding:8px;">承認待ちユーザーはいません。</p>';
                return;
            }
            el.innerHTML = '';
            users.forEach(function(u) {
                el.appendChild(Admin.createPendingCard(u));
            });
        } catch(e) {
            el.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
        }
    };

    /**
     * 承認待ちカードを作成
     */
    Admin.createPendingCard = function(u) {
        var members = app.Hub.members || [];
        var childNames = (u.childrenIds || []).map(function(cid) {
            var m = members.find(function(mem) { return String(mem.id) === String(cid); });
            return m ? m.name : cid;
        }).join('、') || '（なし）';

        var card = document.createElement('div');
        card.style.cssText = 'border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:12px;background:#fff;';
        card.innerHTML =
            '<div style="font-weight:bold;margin-bottom:4px;">' + (UI ? UI.escapeHTML(u.name || '') : (u.name || '')) + '</div>' +
            '<div style="font-size:13px;color:#666;">メール: ' + (u.email || '不明') + '</div>' +
            '<div style="font-size:13px;color:#666;">性別: ' + (u.gender === 'male' ? '男性' : u.gender === 'female' ? '女性' : '不明') + '</div>' +
            '<div style="font-size:13px;color:#666;">子供: ' + childNames + '</div>' +
            '<div style="font-size:12px;color:#aaa;margin-top:4px;">申請日時: ' + (u.registeredAt ? new Date(u.registeredAt.seconds * 1000).toLocaleString('ja-JP') : '不明') + '</div>' +
            '<div style="display:flex;gap:8px;margin-top:10px;">' +
                '<button class="approve-btn" data-uid="' + u.uid + '" style="flex:1;padding:8px;background:#2ecc71;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">承認</button>' +
                '<button class="reject-btn" data-uid="' + u.uid + '" style="flex:1;padding:8px;background:#e74c3c;color:white;border:none;border-radius:6px;cursor:pointer;">却下</button>' +
            '</div>';

        card.querySelector('.approve-btn').addEventListener('click', function() {
            Admin.approveUser(u.uid, u.name);
        });
        card.querySelector('.reject-btn').addEventListener('click', function() {
            Admin.rejectUser(u.uid, u.name);
        });

        return card;
    };

    /**
     * ユーザーを承認
     */
    Admin.approveUser = async function(uid, name) {
        if (!confirm((name || uid) + ' を承認しますか？')) return;
        try {
            var currentUid = app.Auth && app.Auth.getCurrentUser() ? app.Auth.getCurrentUser().uid : null;
            await FCOjima.DB.approveUser(uid, currentUid);
            if (UI) UI.showAlert((name || uid) + ' を承認しました', 'success');
            Admin.refresh();
        } catch(e) {
            if (UI) UI.showAlert('承認に失敗しました: ' + e.message, 'error');
        }
    };

    /**
     * ユーザーを却下
     */
    Admin.rejectUser = async function(uid, name) {
        if (!confirm((name || uid) + ' の申請を却下しますか？')) return;
        try {
            await FCOjima.DB.rejectUser(uid);
            if (UI) UI.showAlert((name || uid) + ' の申請を却下しました', 'info');
            Admin.refresh();
        } catch(e) {
            if (UI) UI.showAlert('却下に失敗しました: ' + e.message, 'error');
        }
    };

    /**
     * 全承認済みユーザーを読み込んで表示
     */
    Admin.loadAllUsers = async function() {
        var el = document.getElementById('all-users-list');
        if (!el) return;
        el.innerHTML = '<p class="loading">読み込み中...</p>';

        try {
            var users = await FCOjima.DB.loadAllUsers();
            var approved = users.filter(function(u) { return u.status === 'approved'; });
            if (approved.length === 0) {
                el.innerHTML = '<p style="color:#999;padding:8px;">登録済みユーザーはいません。</p>';
                return;
            }
            el.innerHTML = '';
            var members = app.Hub.members || [];

            approved.forEach(function(u) {
                var childNames = (u.childrenIds || []).map(function(cid) {
                    var m = members.find(function(mem) { return String(mem.id) === String(cid); });
                    return m ? m.name : cid;
                }).join('、') || '（なし）';

                var row = document.createElement('div');
                row.style.cssText = 'border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:8px;background:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;';

                var info = document.createElement('div');
                info.innerHTML =
                    '<div style="font-weight:bold;">' + (UI ? UI.escapeHTML(u.name || '') : (u.name || '')) + '</div>' +
                    '<div style="font-size:12px;color:#888;">' + (u.email || '') + '</div>' +
                    '<div style="font-size:12px;color:#888;">子供: ' + childNames + '</div>';

                var ctrl = document.createElement('div');
                ctrl.style.display = 'flex';
                ctrl.style.gap = '6px';
                ctrl.style.alignItems = 'center';

                var select = document.createElement('select');
                select.style.cssText = 'padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;';
                Object.keys(ROLE_LABELS).forEach(function(role) {
                    var opt = document.createElement('option');
                    opt.value = role;
                    opt.textContent = ROLE_LABELS[role];
                    if (u.role === role) opt.selected = true;
                    select.appendChild(opt);
                });

                // admin role の変更は admin のみ可能
                var currentProfile = app.Auth && app.Auth.currentUserProfile;
                if (u.uid === (currentProfile && currentProfile.uid)) {
                    select.disabled = true;
                    select.title = '自分の役割は変更できません';
                }

                var saveBtn = document.createElement('button');
                saveBtn.textContent = '変更';
                saveBtn.style.cssText = 'padding:4px 10px;font-size:12px;';
                saveBtn.addEventListener('click', function() {
                    Admin.updateRole(u.uid, select.value, u.name);
                });

                ctrl.appendChild(select);
                ctrl.appendChild(saveBtn);
                row.appendChild(info);
                row.appendChild(ctrl);
                el.appendChild(row);
            });
        } catch(e) {
            el.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
        }
    };

    /**
     * ユーザー役割を変更
     */
    Admin.updateRole = async function(uid, newRole, name) {
        try {
            await FCOjima.DB.updateUserRole(uid, newRole);
            if (UI) UI.showAlert((name || uid) + ' の役割を「' + (ROLE_LABELS[newRole] || newRole) + '」に変更しました', 'success');
        } catch(e) {
            if (UI) UI.showAlert('変更に失敗しました: ' + e.message, 'error');
        }
    };

    // =============================================
    //  出欠マトリクス
    // =============================================

    var DOW_LABELS = ['日','月','火','水','木','金','土'];
    var GRADE_ORDER = { '年少': -3, '年中': -2, '年長': -1 };

    function gradeNum(g) {
        return GRADE_ORDER[g] !== undefined ? GRADE_ORDER[g] : (parseInt(g, 10) || 99);
    }

    /**
     * 出欠マトリクスを構築して表示
     */
    Admin.loadAttendanceMatrix = async function() {
        var el = document.getElementById('attendance-matrix-container');
        if (!el) return;
        el.innerHTML = '<p class="loading">読み込み中...</p>';

        try {
            var Utils = FCOjima.Utils;

            // 1. イベント取得（ナイター除外・日付昇順）
            var events = await FCOjima.DB.loadEvents();
            var targetEvents = events.filter(function(ev) { return ev.type !== 'nighter'; });

            // 2. 選手のみ・学年→名前順にソート
            var members = (FCOjima.Hub.members || [])
                .filter(function(m) { return m.role === 'player'; })
                .slice()
                .sort(function(a, b) {
                    var d = gradeNum(a.grade) - gradeNum(b.grade);
                    if (d !== 0) return d;
                    return (a.name || '').localeCompare(b.name || '', 'ja');
                });

            if (targetEvents.length === 0) {
                el.innerHTML = '<p style="color:#999;padding:8px;">イベントがありません。</p>';
                return;
            }

            // 3. 各イベントの出欠データを並列取得
            var dataArr = await Promise.all(
                targetEvents.map(function(ev) { return FCOjima.DB.loadEventData(ev.id); })
            );

            // 4. マップ構築: eventId → { name/memberId → status }
            // ※ 出欠データは name で保存されているため name キー優先
            var statusMap = {};
            var presentCount = [];
            targetEvents.forEach(function(ev, i) {
                statusMap[ev.id] = {};
                var list = (dataArr[i] && dataArr[i].attendance) ? dataArr[i].attendance : [];
                var cnt = 0;
                list.forEach(function(item) {
                    if (item.name) statusMap[ev.id][item.name] = item.status;
                    if (item.memberId) statusMap[ev.id][String(item.memberId)] = item.status;
                    if (item.status === 'present') cnt++;
                });
                presentCount.push(cnt);
            });

            // 5. テーブル生成
            var table = document.createElement('table');
            table.className = 'attendance-matrix';
            var thead = document.createElement('thead');
            var tbody = document.createElement('tbody');

            // ─── 列ヘッダー行1: 日付 ───
            var tr1 = document.createElement('tr');
            // 左固定ヘッダー（rowspan=4）
            var thGrade = document.createElement('th');
            thGrade.className = 'mx-col mx-col-grade mx-corner';
            thGrade.rowSpan = 4;
            thGrade.textContent = '学年';
            var thName = document.createElement('th');
            thName.className = 'mx-col mx-col-name mx-corner';
            thName.rowSpan = 4;
            thName.textContent = '氏名';
            tr1.appendChild(thGrade);
            tr1.appendChild(thName);
            targetEvents.forEach(function(ev) {
                var th = document.createElement('th');
                th.className = 'mx-h mx-date';
                var d = new Date(ev.date + 'T00:00:00');
                th.textContent = (d.getMonth() + 1) + '/' + d.getDate();
                tr1.appendChild(th);
            });
            thead.appendChild(tr1);

            // ─── 列ヘッダー行2: 曜日 ───
            var tr2 = document.createElement('tr');
            targetEvents.forEach(function(ev) {
                var th = document.createElement('th');
                th.className = 'mx-h mx-dow';
                var d = new Date(ev.date + 'T00:00:00');
                var dow = d.getDay();
                th.textContent = DOW_LABELS[dow];
                if (dow === 0) th.style.color = '#e74c3c';
                else if (dow === 6) th.style.color = '#2980b9';
                tr2.appendChild(th);
            });
            thead.appendChild(tr2);

            // ─── 列ヘッダー行3: イベント名（タップでモーダル） ───
            var tr3 = document.createElement('tr');
            targetEvents.forEach(function(ev, i) {
                var th = document.createElement('th');
                th.className = 'mx-h mx-title mx-title-btn';
                th.textContent = ev.title || Utils.getEventTypeLabel(ev.type);
                th.title = ev.title || '';
                th.style.cursor = 'pointer';
                (function(ev, evData) {
                    th.addEventListener('click', function() {
                        Admin.openEventDetailModal(ev, evData);
                    });
                })(ev, dataArr[i]);
                tr3.appendChild(th);
            });
            thead.appendChild(tr3);

            // ─── 列ヘッダー行4: 参加人数 ───
            var tr4 = document.createElement('tr');
            targetEvents.forEach(function(ev, i) {
                var th = document.createElement('th');
                th.className = 'mx-h mx-count';
                th.textContent = presentCount[i] + '人';
                tr4.appendChild(th);
            });
            thead.appendChild(tr4);

            table.appendChild(thead);

            // ─── データ行: 選手1人1行 ───
            var STATUS_DISP = {
                'present': { text: '◯', cls: 'mx-present' },
                'absent':  { text: '✖', cls: 'mx-absent'  },
                'unknown': { text: '未', cls: 'mx-unknown' }
            };
            members.forEach(function(member) {
                var tr = document.createElement('tr');
                var tdGrade = document.createElement('td');
                tdGrade.className = 'mx-col mx-col-grade';
                tdGrade.textContent = Utils.getGradeLabel(member.grade);
                var tdName = document.createElement('td');
                tdName.className = 'mx-col mx-col-name';
                tdName.textContent = member.abbr || member.name || '';
                tr.appendChild(tdGrade);
                tr.appendChild(tdName);

                targetEvents.forEach(function(ev) {
                    var td = document.createElement('td');
                    td.className = 'mx-cell';
                    var evMap = statusMap[ev.id] || {};
                    var status = evMap[member.name] || evMap[String(member.id)];
                    if (!status) status = 'unknown';
                    var disp = STATUS_DISP[status] || STATUS_DISP['unknown'];
                    td.textContent = disp.text;
                    td.classList.add(disp.cls);
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);

            var wrap = document.createElement('div');
            wrap.className = 'matrix-wrap';
            wrap.appendChild(table);
            el.innerHTML = '';
            el.appendChild(wrap);

        } catch(e) {
            el.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
            console.error('出欠マトリクスエラー:', e);
        }
    };

    // =============================================
    //  イベント詳細モーダル & ファイル添付
    // =============================================

    Admin.openEventDetailModal = function(ev, evData) {
        var modal = document.getElementById('event-detail-modal');
        if (!modal) return;
        var body = document.getElementById('event-detail-modal-body');
        var Utils = FCOjima.Utils;
        var UI = FCOjima.UI;
        var d = new Date(ev.date + 'T00:00:00');
        var DOW = ['日','月','火','水','木','金','土'];

        // タイトル & イベント種別バッジ
        var typeLabel = Utils.getEventTypeLabel(ev.type);
        var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">'
            + '<h2 style="margin:0;font-size:18px;flex:1;">' + UI.escapeHTML(ev.title || typeLabel) + '</h2>'
            + '<span style="background:#E8A200;color:#fff;border-radius:12px;padding:2px 10px;font-size:11px;white-space:nowrap;">' + typeLabel + '</span>'
            + '</div>';

        // 日時グリッド
        html += '<div style="display:flex;flex-wrap:wrap;gap:10px 20px;margin-bottom:12px;padding:10px 14px;background:#fffbef;border:1px solid #E8A200;border-radius:8px;">';
        html += '<div><div style="font-size:11px;color:#888;">日付</div><div style="font-weight:bold;font-size:14px;">'
            + Utils.formatDateForDisplay(ev.date) + '（' + DOW[d.getDay()] + '）</div></div>';
        if (ev.startTime) {
            html += '<div><div style="font-size:11px;color:#888;">時間</div><div style="font-weight:bold;font-size:14px;">'
                + ev.startTime + (ev.endTime ? ' 〜 ' + ev.endTime : '') + '</div></div>';
        }
        if (ev.departureTime) {
            html += '<div><div style="font-size:11px;color:#888;">出発時間</div><div style="font-weight:bold;font-size:14px;">' + ev.departureTime + '</div></div>';
        }
        html += '</div>';

        // 場所情報
        var venues = (FCOjima.Storage && FCOjima.Storage.loadVenues) ? FCOjima.Storage.loadVenues() : [];
        if (ev.meetingPlace) {
            var mv = venues.find(function(v) { return v.name === ev.meetingPlace; });
            var mq = encodeURIComponent((mv && mv.address) ? mv.address : ev.meetingPlace);
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;">'
                + '<span style="color:#888;min-width:52px;">集合場所</span>'
                + '<span>' + UI.escapeHTML(ev.meetingPlace) + '</span>'
                + '<button onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' + mq + '\',\'_blank\')" style="margin-left:auto;background:#E8A200;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap;">地図を開く</button>'
                + '</div>';
        }
        if (ev.venue) {
            var vv = venues.find(function(v) { return v.name === ev.venue; });
            var vq = encodeURIComponent((vv && vv.address) ? vv.address : ev.venue);
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;">'
                + '<span style="color:#888;min-width:52px;">会場</span>'
                + '<span>' + UI.escapeHTML(ev.venue) + '</span>'
                + '<button onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' + vq + '\',\'_blank\')" style="margin-left:auto;background:#E8A200;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap;">地図を開く</button>'
                + '</div>';
        }

        // 対象学年
        if (ev.target && ev.target.length > 0) {
            var grades = ev.target.map(function(g) { return Utils.getGradeLabel(g); }).join('、');
            html += '<div style="margin-bottom:8px;font-size:13px;"><span style="color:#888;">対象: </span>' + grades + '</div>';
        }

        // 説明
        if (ev.description) {
            html += '<div style="margin-top:8px;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-size:13px;white-space:pre-wrap;">'
                + UI.escapeHTML(ev.description) + '</div>';
        }

        body.innerHTML = html;
        modal.style.display = 'flex';
        Admin.loadEventFiles(ev.id);

        // ファイルアップロードボタン
        var uploadBtn = document.getElementById('event-file-upload-btn');
        var fileInput = document.getElementById('event-file-input');
        if (uploadBtn && fileInput) {
            var newBtn = uploadBtn.cloneNode(true);
            uploadBtn.parentNode.replaceChild(newBtn, uploadBtn);
            newBtn.addEventListener('click', function() {
                fileInput.value = '';
                fileInput.click();
            });
            fileInput.onchange = function() {
                if (!fileInput.files.length) return;
                Admin.uploadEventFiles(ev.id, fileInput.files);
            };
        }
    };

    Admin.loadEventFiles = async function(eventId) {
        var list = document.getElementById('event-files-list');
        if (!list) return;
        list.innerHTML = '<p style="color:#999;font-size:12px;">読み込み中...</p>';
        try {
            var storage = firebase.storage();
            var ref = storage.ref('teams/' + FCOjimaFirebase.TEAM_ID + '/events/' + eventId);
            var result = await ref.listAll();
            if (result.items.length === 0) {
                list.innerHTML = '<p style="color:#999;font-size:12px;">ファイルなし</p>';
                return;
            }
            list.innerHTML = '';
            for (var i = 0; i < result.items.length; i++) {
                var item = result.items[i];
                var url = await item.getDownloadURL();
                var a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.className = 'event-file-link';
                a.textContent = item.name;
                list.appendChild(a);
            }
        } catch(e) {
            list.innerHTML = '<p style="color:#c00;font-size:12px;">読み込みエラー</p>';
            console.error('ファイル読み込みエラー:', e);
        }
    };

    Admin.uploadEventFiles = async function(eventId, files) {
        var list = document.getElementById('event-files-list');
        var storage = firebase.storage();
        var basePath = 'teams/' + FCOjimaFirebase.TEAM_ID + '/events/' + eventId + '/';
        try {
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                var ref = storage.ref(basePath + file.name);
                if (list) list.innerHTML = '<p style="color:#999;font-size:12px;">アップロード中... (' + (i+1) + '/' + files.length + ')</p>';
                await ref.put(file);
            }
            await Admin.loadEventFiles(eventId);
        } catch(e) {
            if (list) list.innerHTML = '<p style="color:#c00;font-size:12px;">アップロードエラー: ' + e.message + '</p>';
            console.error('アップロードエラー:', e);
        }
    };

})(window.FCOjima);
