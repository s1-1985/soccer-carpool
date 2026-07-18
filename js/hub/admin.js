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

        btn.addEventListener('click', function() {
            modal.style.display = 'flex';
            Admin.loadAttendanceMatrix();
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
        var esc = UI ? UI.escapeHTML : function(s) { return s; };
        card.innerHTML =
            '<div style="font-weight:bold;margin-bottom:4px;">' + esc(u.name || '') + '</div>' +
            '<div style="font-size:13px;color:#666;">メール: ' + esc(u.email || '不明') + '</div>' +
            '<div style="font-size:13px;color:#666;">性別: ' + (u.gender === 'male' ? '男性' : u.gender === 'female' ? '女性' : '不明') + '</div>' +
            '<div style="font-size:13px;color:#666;">子供: ' + esc(childNames) + '</div>' +
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

                var esc = UI ? UI.escapeHTML : function(s) { return s; };
                var info = document.createElement('div');
                info.innerHTML =
                    '<div style="font-weight:bold;">' + esc(u.name || '') + '</div>' +
                    '<div style="font-size:12px;color:#888;">' + esc(u.email || '') + '</div>' +
                    '<div style="font-size:12px;color:#888;">子供: ' + esc(childNames) + '</div>';

                var ctrl = document.createElement('div');
                ctrl.style.display = 'flex';
                ctrl.style.gap = '6px';
                ctrl.style.alignItems = 'center';

                var currentProfile = app.Auth && app.Auth.currentUserProfile;
                var iAmAdmin = !!(currentProfile && currentProfile.role === 'admin');

                var select = document.createElement('select');
                select.style.cssText = 'padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;';
                Object.keys(ROLE_LABELS).forEach(function(role) {
                    // 管理者役割の付与は admin のみ（Firestoreルールと同期）
                    if (role === 'admin' && !iAmAdmin && u.role !== 'admin') return;
                    var opt = document.createElement('option');
                    opt.value = role;
                    opt.textContent = ROLE_LABELS[role];
                    if (u.role === role) opt.selected = true;
                    select.appendChild(opt);
                });

                if (u.uid === (currentProfile && currentProfile.uid)) {
                    select.disabled = true;
                    select.title = '自分の役割は変更できません';
                } else if (u.role === 'admin' && !iAmAdmin) {
                    // 管理者の役割変更（剥奪）も admin のみ（Firestoreルールと同期）
                    select.disabled = true;
                    select.title = '管理者の役割変更は管理者のみ可能です';
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

            // 今日（ISO文字列）
            var now = new Date();
            var todayISO = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);

            // 1. イベント取得（ナイター除外・日付昇順）
            var events = await FCOjima.DB.loadEvents();
            var allNonNighter = events.filter(function(ev) { return ev.type !== 'nighter'; });
            // 過去表示トグル（デフォルト: 今後のみ）
            var showPast = !!Admin._matrixShowPast;
            var targetEvents = showPast
                ? allNonNighter
                : allNonNighter.filter(function(ev) { return ev.date && ev.date >= todayISO; });
            var pastCount = allNonNighter.length - allNonNighter.filter(function(ev) { return ev.date && ev.date >= todayISO; }).length;

            // 2. 選手のみ・学年→名前順にソート
            var members = (FCOjima.Hub.members || [])
                .filter(function(m) { return m.role === 'player'; })
                .slice()
                .sort(function(a, b) {
                    var d = gradeNum(a.grade) - gradeNum(b.grade);
                    if (d !== 0) return d;
                    return (a.name || '').localeCompare(b.name || '', 'ja');
                });

            // ─── ツールバー（過去表示トグル・凡例） ───
            function buildToolbar() {
                var bar = document.createElement('div');
                bar.className = 'mx-toolbar';
                var toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'mx-toggle-btn' + (showPast ? ' is-active' : '');
                toggle.textContent = showPast ? '過去も表示中' : '今後のみ表示' + (pastCount > 0 ? '（過去' + pastCount + '件）' : '');
                toggle.addEventListener('click', function() {
                    Admin._matrixShowPast = !showPast;
                    Admin.loadAttendanceMatrix();
                });
                var legend = document.createElement('div');
                legend.className = 'mx-legend';
                legend.innerHTML = '人数: <b class="p">参加</b>/<b class="u">未回答</b>/<b class="a">欠席</b>';
                bar.appendChild(toggle);
                bar.appendChild(legend);
                return bar;
            }

            if (targetEvents.length === 0) {
                el.innerHTML = '';
                el.appendChild(buildToolbar());
                var empty = document.createElement('p');
                empty.style.cssText = 'color:#999;padding:16px 8px;';
                empty.textContent = showPast ? 'イベントがありません。' : '今後のイベントはありません。「過去も表示」で消化済みのイベントを確認できます。';
                el.appendChild(empty);
                return;
            }

            // 3. 各イベントの出欠データを並列取得
            var dataArr = await Promise.all(
                targetEvents.map(function(ev) { return FCOjima.DB.loadEventData(ev.id); })
            );

            // 対象選手かどうか判定
            function isTargetFor(member, ev) {
                var evTargets = (ev.target && ev.target.length > 0) ? ev.target : null;
                var extraPlayers = ev.extraPlayers || [];
                return !evTargets
                    || (member.grade && evTargets.some(function(g) { return String(g) === String(member.grade); }))
                    || extraPlayers.includes(member.name);
            }

            // 4. マップ構築 + 内訳集計（参加/未回答/欠席）
            var statusMap = {};
            var breakdown = []; // {present, unknown, absent, target}
            targetEvents.forEach(function(ev, i) {
                statusMap[ev.id] = {};
                var list = (dataArr[i] && dataArr[i].attendance) ? dataArr[i].attendance : [];
                list.forEach(function(item) {
                    if (item.name) statusMap[ev.id][item.name] = item.status;
                    if (item.memberId) statusMap[ev.id][String(item.memberId)] = item.status;
                });
                // 対象選手を分母に present/absent/unknown を数える
                var present = 0, absent = 0, targetN = 0;
                var evMap = statusMap[ev.id];
                members.forEach(function(m) {
                    if (!isTargetFor(m, ev)) return;
                    targetN++;
                    var st = evMap[m.name] || evMap[String(m.id)] || 'unknown';
                    if (st === 'present') present++;
                    else if (st === 'absent') absent++;
                });
                breakdown.push({ present: present, absent: absent, unknown: targetN - present - absent, target: targetN });
            });

            // 直近イベント（今日以降で最初）のインデックス
            var upcomingIdx = -1;
            for (var ui = 0; ui < targetEvents.length; ui++) {
                if (targetEvents[ui].date && targetEvents[ui].date >= todayISO) { upcomingIdx = ui; break; }
            }

            // 5. テーブル生成
            var table = document.createElement('table');
            table.className = 'attendance-matrix';
            var thead = document.createElement('thead');
            var tbody = document.createElement('tbody');

            // ─── 単一ヘッダー行（列＝イベント。学年/氏名は左上コーナー） ───
            var trH = document.createElement('tr');
            var thGrade = document.createElement('th');
            thGrade.className = 'mx-corner mx-corner-grade';
            thGrade.textContent = '学年';
            var thName = document.createElement('th');
            thName.className = 'mx-corner mx-corner-name';
            thName.textContent = '氏名';
            trH.appendChild(thGrade);
            trH.appendChild(thName);

            targetEvents.forEach(function(ev, i) {
                var th = document.createElement('th');
                th.className = 'mx-evt';
                var d = new Date(ev.date + 'T00:00:00');
                var dow = d.getDay();
                if (i === upcomingIdx) th.classList.add('mx-upcoming');
                if (dow === 0) th.classList.add('mx-sun');
                else if (dow === 6) th.classList.add('mx-sat');

                var dateDiv = document.createElement('div');
                dateDiv.className = 'e-date';
                dateDiv.textContent = (d.getMonth() + 1) + '/' + d.getDate();
                var dowDiv = document.createElement('div');
                dowDiv.className = 'e-dow';
                dowDiv.textContent = DOW_LABELS[dow];
                if (dow === 0) dowDiv.style.color = '#e74c3c';
                else if (dow === 6) dowDiv.style.color = '#2980b9';
                var titleDiv = document.createElement('div');
                titleDiv.className = 'e-title';
                titleDiv.textContent = ev.title || Utils.getEventTypeLabel(ev.type);

                var brk = breakdown[i];
                var brkDiv = document.createElement('div');
                brkDiv.className = 'e-brk';
                brkDiv.innerHTML =
                    '<span class="b-p' + (brk.present ? '' : ' z0') + '">' + brk.present + '</span>' +
                    '<span class="b-u' + (brk.unknown ? '' : ' z0') + '">' + brk.unknown + '</span>' +
                    '<span class="b-a' + (brk.absent ? '' : ' z0') + '">' + brk.absent + '</span>';

                th.appendChild(dateDiv);
                th.appendChild(dowDiv);
                th.appendChild(titleDiv);
                th.appendChild(brkDiv);
                th.title = (ev.title || '') + '　参加' + brk.present + '/未回答' + brk.unknown + '/欠席' + brk.absent + '（対象' + brk.target + '人）';

                // ヘッダーのどこをタップしても概要モーダル
                (function(ev, evData) {
                    th.addEventListener('click', function() {
                        Admin.openEventDetailModal(ev, evData, false);
                    });
                })(ev, dataArr[i]);
                trH.appendChild(th);
            });
            thead.appendChild(trH);
            table.appendChild(thead);

            // ─── データ行: 選手1人1行 ───
            var STATUS_DISP = {
                'present': { text: '◯', cls: 'mx-present' },
                'absent':  { text: '✖', cls: 'mx-absent'  },
                'unknown': { text: '未', cls: 'mx-unknown' },
                'na':      { text: '－', cls: 'mx-na'      }
            };
            var prevGrade = null;
            members.forEach(function(member) {
                var tr = document.createElement('tr');
                // 学年グループの境目に区切り線
                if (prevGrade !== null && String(member.grade) !== String(prevGrade)) {
                    tr.className = 'mx-grade-top';
                }
                prevGrade = member.grade;

                var tdGrade = document.createElement('td');
                tdGrade.className = 'mx-col mx-col-grade';
                tdGrade.textContent = Utils.getGradeLabel(member.grade);
                var tdName = document.createElement('td');
                tdName.className = 'mx-col mx-col-name';
                tdName.textContent = member.abbr || member.name || '';
                tr.appendChild(tdGrade);
                tr.appendChild(tdName);

                targetEvents.forEach(function(ev, ci) {
                    var td = document.createElement('td');
                    td.className = 'mx-cell';
                    if (ci === upcomingIdx) td.classList.add('mx-col-hi');

                    var isTarget = isTargetFor(member, ev);
                    var status;
                    if (!isTarget) {
                        status = 'na';
                    } else {
                        var evMap = statusMap[ev.id] || {};
                        status = evMap[member.name] || evMap[String(member.id)] || 'unknown';
                    }
                    var disp = STATUS_DISP[status] || STATUS_DISP['unknown'];
                    td.textContent = disp.text;
                    td.classList.add(disp.cls);

                    // 同じ日に他のイベントがある対象セルはタップで「参加イベント移動」モーダルを開く
                    if (status !== 'na') {
                        var sameDayOthers = targetEvents.filter(function(o) {
                            return String(o.id) !== String(ev.id) && o.date === ev.date;
                        });
                        if (sameDayOthers.length > 0) {
                            td.classList.add('mx-cell-movable');
                            td.title = 'タップで参加イベントを変更';
                            (function(member, ev, others) {
                                td.addEventListener('click', function() {
                                    Admin.openMatrixMoveModal(member, ev, others);
                                });
                            })(member, ev, sameDayOthers);
                        }
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });

            // 移動保存時にイベント一覧全体が必要（extraPlayers更新のため）
            Admin._matrixEvents = events;

            table.appendChild(tbody);

            var wrap = document.createElement('div');
            wrap.className = 'matrix-wrap';
            wrap.appendChild(table);
            el.innerHTML = '';
            el.appendChild(buildToolbar());
            el.appendChild(wrap);

            // 直近イベント列が見えるよう横スクロール位置を調整
            if (upcomingIdx >= 0) {
                requestAnimationFrame(function() {
                    var upTh = wrap.querySelector('.mx-evt.mx-upcoming');
                    if (upTh) {
                        var leftCols = 30 + (thName.offsetWidth || 60);
                        var target = upTh.offsetLeft - leftCols - 8;
                        if (target > 0) wrap.scrollLeft = target;
                    }
                });
            }

        } catch(e) {
            el.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
            console.error('出欠マトリクスエラー:', e);
        }
    };

    // =============================================
    //  参加イベント移動（出欠マトリクスから）
    // =============================================

    /**
     * 移動先イベント選択モーダルを開く
     * @param {Object} member - 対象選手
     * @param {Object} fromEv - 現在参加しているイベント
     * @param {Array} others - 同日の他イベント（移動先候補）
     */
    Admin.openMatrixMoveModal = function(member, fromEv, others) {
        if (!FCOjima.Auth.isManager()) return;

        var Utils = FCOjima.Utils;
        var info = document.getElementById('matrix-move-info');
        if (info) {
            var gradeLabel = member.grade ? Utils.getGradeLabel(member.grade) : '';
            info.textContent = member.name + (gradeLabel ? '（' + gradeLabel + '）' : '') +
                ' — ' + fromEv.date + '「' + (fromEv.title || '') + '」から移動先を選択してください';
        }

        var list = document.getElementById('matrix-move-list');
        if (list) {
            list.innerHTML = '';
            others.forEach(function(toEv) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'matrix-move-item';
                var targetLabel = (toEv.target && toEv.target.length > 0)
                    ? '対象: ' + toEv.target.map(function(g) { return Utils.getGradeLabel(g); }).join('・')
                    : '対象: 全学年';
                var title = document.createElement('div');
                title.style.cssText = 'font-weight:bold;font-size:14px;';
                title.textContent = toEv.title || Utils.getEventTypeLabel(toEv.type);
                var meta = document.createElement('div');
                meta.style.cssText = 'font-size:12px;color:#777;margin-top:2px;';
                meta.textContent = targetLabel + (toEv.startTime ? '　' + toEv.startTime + '〜' : '');
                btn.appendChild(title);
                btn.appendChild(meta);
                btn.addEventListener('click', function() {
                    if (!confirm(member.name + ' の参加を\n「' + (fromEv.title || '') + '」→「' + (toEv.title || '') + '」\nに変更しますか？\n（保護者へ変更通知が送られます）')) return;
                    Admin.movePlayerToEvent(member, fromEv, toEv);
                });
                list.appendChild(btn);
            });
        }
        FCOjima.UI.openModal('matrix-move-modal');
    };

    /**
     * 選手の参加イベントを移動する
     * - 移動先: 出欠を「参加」で登録（対象学年外なら extraPlayers にも追加）
     * - 移動元: 出欠を「不参加」に変更（配車対象から自動的に外れる）
     * - 連絡事項に変更通知（type:'move'）を投稿（保護者ダイアログ・参加予定タブが参照）
     */
    Admin.movePlayerToEvent = async function(member, fromEv, toEv) {
        try {
            var Storage = FCOjima.Storage;

            // 出欠データを取得（未作成なら空で初期化）
            var fromData = await FCOjima.DB.loadEventData(fromEv.id)
                || { carRegistrations: [], assignments: [], attendance: [], notifications: [] };
            var toData = await FCOjima.DB.loadEventData(toEv.id)
                || { carRegistrations: [], assignments: [], attendance: [], notifications: [] };
            if (!Array.isArray(fromData.attendance)) fromData.attendance = [];
            if (!Array.isArray(toData.attendance)) toData.attendance = [];

            function upsert(list, status, notes) {
                var item = list.find(function(a) {
                    return (a.memberId && String(a.memberId) === String(member.id)) || a.name === member.name;
                });
                if (item) {
                    item.status = status;
                    if (notes !== undefined) item.notes = notes;
                } else {
                    var it = { name: member.name, status: status, notes: notes || '' };
                    if (member.id != null) it.memberId = String(member.id);
                    list.push(it);
                }
            }
            upsert(toData.attendance, 'present', '');
            upsert(fromData.attendance, 'absent', '「' + (toEv.title || '') + '」へ移動');

            // 移動先の対象学年に含まれない場合は学年外追加選手として登録
            var targets = (toEv.target && toEv.target.length > 0) ? toEv.target : null;
            var inTarget = !targets || (member.grade && targets.some(function(g) { return String(g) === String(member.grade); }));
            if (!inTarget && !(toEv.extraPlayers || []).includes(member.name)) {
                toEv.extraPlayers = (toEv.extraPlayers || []).concat([member.name]);
                // マトリクス読込時の全イベント配列を保存（localStorage + Firestore）
                var allEvents = Admin._matrixEvents || FCOjima.Hub.events || [];
                var evInAll = allEvents.find(function(e) { return String(e.id) === String(toEv.id); });
                if (evInAll) evInAll.extraPlayers = toEv.extraPlayers.slice();
                // Hub.events側にも反映（カレンダー表示との整合）
                var hubEv = (FCOjima.Hub.events || []).find(function(e) { return String(e.id) === String(toEv.id); });
                if (hubEv) hubEv.extraPlayers = toEv.extraPlayers.slice();
                Storage.saveEvents(allEvents);
            }

            await FCOjima.DB.saveEventData(fromEv.id, fromData);
            await FCOjima.DB.saveEventData(toEv.id, toData);

            // 連絡事項へ変更通知を投稿（構造化フィールド付き＝保護者ダイアログが参照）
            var now = new Date();
            var dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
                          ' ' + now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            var operator = (FCOjima.Auth && FCOjima.Auth.getDisplayName) ? FCOjima.Auth.getDisplayName() : 'システム';
            var d = new Date(fromEv.date + 'T00:00:00');
            var evDateLabel = (d.getMonth() + 1) + '/' + d.getDate();
            var notice = {
                id: Date.now().toString() + Math.floor(Math.random() * 1000),
                type: 'move',
                date: dateStr,
                user: operator,
                text: '【参加変更】' + evDateLabel + ' ' + member.name + '：「' + (fromEv.title || '') + '」→「' + (toEv.title || '') + '」',
                ts: Date.now(),
                eventDate: fromEv.date,
                memberId: member.id != null ? String(member.id) : null,
                memberName: member.name,
                fromEventId: String(fromEv.id),
                fromEventTitle: fromEv.title || '',
                toEventId: String(toEv.id),
                toEventTitle: toEv.title || ''
            };
            FCOjima.Hub.notifications = FCOjima.Hub.notifications || [];
            FCOjima.Hub.notifications.unshift(notice);
            Storage.saveNotifications(FCOjima.Hub.notifications);

            // 連絡事項タブを即時再描画（初期化時に一度描画されたきりなので、
            // これがないと移動した本人の画面ではリロードするまで通知が出ない）
            if (FCOjima.Hub.Notifications && FCOjima.Hub.Notifications.renderNotifications) {
                FCOjima.Hub.Notifications.renderNotifications();
            }

            // 操作ログ
            FCOjima.Hub.logs = Storage.addLog('attendance', '参加イベント変更',
                member.name + ': ' + (fromEv.title || '') + ' → ' + (toEv.title || ''), FCOjima.Hub.logs);

            FCOjima.UI.closeModal('matrix-move-modal');
            FCOjima.UI.showAlert(member.name + ' を「' + (toEv.title || '') + '」へ移動しました', 'success');

            // マトリクスを再読込
            Admin.loadAttendanceMatrix();
        } catch (e) {
            console.error('参加イベント移動エラー:', e);
            FCOjima.UI.showAlert('移動に失敗しました: ' + e.message, 'error');
        }
    };

    // =============================================
    //  イベント詳細モーダル & ファイル添付
    // =============================================

    Admin.openEventDetailModal = function(ev, evData, showFiles) {
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

        // 備考（イベントのフィールド名は notes。旧データの description にも対応）
        var evNotes = ev.notes || ev.description;
        if (evNotes) {
            html += '<div style="margin-top:8px;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-size:13px;white-space:pre-wrap;">'
                + UI.escapeHTML(evNotes) + '</div>';
        }

        body.innerHTML = html;
        modal.style.display = 'flex';
        var filesWrapper = document.getElementById('event-files-wrapper');
        if (filesWrapper) filesWrapper.style.display = (showFiles === false) ? 'none' : '';
        if (showFiles !== false) Admin.loadEventFiles(ev.id);

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
