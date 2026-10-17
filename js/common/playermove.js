/**
 * FC尾島ジュニア - 同じ日の別の予定への選手の移動（参加イベント変更）
 *
 * 例: 5・6年の試合で欠席者が出たので、同じ日の3・4年の練習試合に出る4年生（または、その日に予定のない
 * 選手）を5・6年の試合に入れる。
 *  - 移動先: 出欠を「参加」に（対象学年外なら予定の学年外追加 extraPlayers に1人だけ追加）
 *  - 移動元: 出欠を「不参加」に（備考「〇〇へ移動」）
 *  - 連絡事項に変更のお知らせ（type:'move'）→ 保護者には HUB の変更ダイアログ・参加予定のバッジ
 *  - 元に戻す: 出欠・学年外追加・お知らせを移動前の状態に戻す
 * 対象: 試合・練習（ナイター練習・行事は除く）
 * 使う画面: HUB の予定の詳細・出欠状況の表（管理タブ）、配車管理の出欠ページ（管理者・指導者・役員のみ）
 */

window.FCOjima = window.FCOjima || {};
FCOjima.PlayerMove = FCOjima.PlayerMove || {};

(function(app) {
    var PM = app.PlayerMove;
    var DOW = ['日', '月', '火', '水', '木', '金', '土'];
    var GRADE_RANK = { '6': 0, '5': 1, '4': 2, '3': 3, '2': 4, '1': 5, '年長': 6, '年中': 7, '年少': 8 };

    function U() { return app.Utils; }
    function fmtDate(iso) {
        if (!iso) return '';
        var d = new Date(iso + 'T00:00:00');
        return (d.getMonth() + 1) + '/' + d.getDate() + '(' + DOW[d.getDay()] + ')';
    }
    function gradeLabel(m) { return m && m.grade ? U().getGradeLabel(m.grade) : ''; }
    function titleOf(ev) { return (ev && (ev.title || U().getEventTypeLabel(ev.type))) || ''; }
    function sortPlayers(list) {
        return list.slice().sort(function(a, b) {
            var ga = GRADE_RANK[a.grade] !== undefined ? GRADE_RANK[a.grade] : 99;
            var gb = GRADE_RANK[b.grade] !== undefined ? GRADE_RANK[b.grade] : 99;
            if (ga !== gb) return ga - gb;
            return (a.name || '').localeCompare(b.name || '', 'ja');
        });
    }
    function findRow(list, member) {
        return list.findIndex(function(a) {
            return a && ((a.memberId && String(a.memberId) === String(member.id)) || a.name === member.name);
        });
    }

    /** マネージャー（管理者・監督・コーチ・役員）だけが使える */
    PM.canUse = function() {
        return !!(app.Auth && app.Auth.isManager && app.Auth.isManager());
    };

    /**
     * 選手を入れ替えられる予定か（試合・練習だけ）。
     * ナイター練習は全学年対象・行事（総会・BBQ など）は家族ぐるみの参加で、同じ日に試合があっても
     * 両方に出られるため、移動元にも移動先にもしない（行事にしか予定のない選手は「予定のない選手」として出す）
     */
    PM.isMovableEvent = function(ev) {
        return !!ev && (ev.type === 'game' || ev.type === 'practice');
    };

    /** 選手がその予定の対象か（対象学年・学年外追加。出欠ページで参加者から外した人は除く） */
    PM.isTarget = function(member, ev, data) {
        return U().isTargetFor(member, ev) && !U().isRemovedFromEvent(member, data);
    };

    /** その予定での出欠（回答がなければ 'unknown'） */
    PM.statusOf = function(member, data) {
        var list = (data && data.attendance) || [];
        var i = findRow(list, member);
        if (i < 0) {
            i = list.findIndex(function(a) { return a && (member.formerNames || []).indexOf(a.name) !== -1; });
        }
        return (i >= 0 && list[i].status) ? list[i].status : 'unknown';
    };

    /** 予定の選手の出欠の人数 */
    PM.countFor = function(members, ev, data) {
        var c = { present: 0, unknown: 0, absent: 0 };
        members.forEach(function(m) {
            if (m.role !== 'player' || !PM.isTarget(m, ev, data)) return;
            var st = PM.statusOf(m, data);
            if (st === 'present') c.present++;
            else if (st === 'absent') c.absent++;
            else c.unknown++;
        });
        return c;
    };

    /**
     * 予定の出欠の1行を書き換える（トランザクション。他の人の回答や配車データには触れない）
     * @returns {Promise<Object|null>} 書き換える前の行（なければ null）
     */
    function setRow(eventId, member, changes) {
        var prev = null;
        return app.DB.updateEventData(eventId, function(data) {
            var list = (data && Array.isArray(data.attendance))
                ? data.attendance.map(function(a) { return Object.assign({}, a); })
                : [];
            var i = findRow(list, member);
            prev = i >= 0 ? Object.assign({}, list[i]) : null;
            if (i >= 0) {
                Object.assign(list[i], changes);
            } else {
                var it = Object.assign({ name: member.name, status: 'unknown', notes: '' }, changes);
                if (member.id != null) it.memberId = String(member.id);
                list.push(it);
            }
            var patch = { attendance: list };
            // 出欠ページで参加者から外していた人なら、その記録も消す（参加者に戻す）
            if (data && Array.isArray(data.attendanceRemoved) && data.attendanceRemoved.indexOf(member.name) !== -1) {
                patch.attendanceRemoved = data.attendanceRemoved.filter(function(n) { return n !== member.name; });
            }
            return patch;
        }).then(function() { return prev; });
    }

    /** 出欠の1行を、書き換える前の状態に戻す（もともと行がなかったなら行を消す） */
    function restoreRow(eventId, member, prev) {
        return app.DB.updateEventData(eventId, function(data) {
            var list = (data && Array.isArray(data.attendance))
                ? data.attendance.map(function(a) { return Object.assign({}, a); })
                : [];
            var i = findRow(list, member);
            if (prev) {
                if (i >= 0) list[i] = Object.assign({}, prev);
                else list.push(Object.assign({}, prev));
            } else if (i >= 0) {
                list.splice(i, 1);
            }
            return { attendance: list };
        });
    }

    /** LINE などに貼る文面 */
    PM.lineText = function(rec) {
        var g = gradeLabel(rec.member);
        return '【参加変更】' + fmtDate(rec.toEv.date) + ' ' + rec.member.name + (g ? '（' + g + '）' : '') + '：' +
            (rec.fromEv ? '「' + titleOf(rec.fromEv) + '」→「' + titleOf(rec.toEv) + '」' : '「' + titleOf(rec.toEv) + '」に参加');
    };

    /**
     * 選手を予定に入れる
     * @param {Object} member - 選手
     * @param {Object|null} fromEv - 同じ日の移動元の予定（その日に予定がない選手なら null）
     * @param {Object} toEv - 移動先の予定
     * @returns {Promise<Object>} 元に戻すための記録
     */
    PM.move = async function(member, fromEv, toEv) {
        var rec = { member: member, fromEv: fromEv || null, toEv: toEv, addedExtra: false, prevTo: null, prevFrom: null, noticeId: null };
        // 対象学年外なら学年外追加に（その1人だけを追加。他の人が同時に変えた項目には触れない）
        if (!U().isTargetFor(member, toEv)) {
            await app.DB.addEventExtraPlayer(toEv.id, member.name);
            toEv.extraPlayers = (toEv.extraPlayers || []).concat([member.name]);
            rec.addedExtra = true;
            PM._syncHubEvent(toEv.id, function(ev) {
                if ((ev.extraPlayers || []).indexOf(member.name) === -1) ev.extraPlayers = (ev.extraPlayers || []).concat([member.name]);
            });
        }
        rec.prevTo = await setRow(toEv.id, member, { status: 'present', notes: '' });
        if (fromEv) {
            rec.prevFrom = await setRow(fromEv.id, member, { status: 'absent', notes: '「' + titleOf(toEv) + '」へ移動' });
        }

        // 連絡事項へ変更のお知らせ（保護者の変更ダイアログ・参加予定タブが参照する）
        var now = new Date();
        var dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
                      ' ' + now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        var d = new Date(toEv.date + 'T00:00:00');
        var notice = {
            id: Date.now().toString() + Math.floor(Math.random() * 1000),
            type: 'move',
            date: dateStr,
            user: (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : 'システム',
            text: '【参加変更】' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + member.name + '：' +
                  (fromEv ? '「' + titleOf(fromEv) + '」→「' + titleOf(toEv) + '」' : '「' + titleOf(toEv) + '」に参加'),
            ts: Date.now(),
            eventDate: toEv.date,
            memberId: member.id != null ? String(member.id) : null,
            memberName: member.name,
            fromEventId: fromEv ? String(fromEv.id) : null,
            fromEventTitle: fromEv ? titleOf(fromEv) : '',
            toEventId: String(toEv.id),
            toEventTitle: titleOf(toEv)
        };
        try {
            await app.DB.putNotification(notice);
            rec.noticeId = notice.id;
            if (app.Hub && Array.isArray(app.Hub.notifications)) {
                app.Hub.notifications.unshift(notice);
                if (app.Hub.Notifications && app.Hub.Notifications.renderNotifications) app.Hub.Notifications.renderNotifications();
            }
        } catch (e) {
            console.warn('参加変更のお知らせの投稿に失敗:', e);
        }
        addLog('参加イベント変更', member.name + ': ' + (fromEv ? titleOf(fromEv) : '（予定なし）') + ' → ' + titleOf(toEv));
        return rec;
    };

    /** 移動を取り消す（出欠・学年外追加・お知らせを移動前に戻す） */
    PM.undo = async function(rec) {
        await restoreRow(rec.toEv.id, rec.member, rec.prevTo);
        if (rec.fromEv) await restoreRow(rec.fromEv.id, rec.member, rec.prevFrom);
        if (rec.addedExtra) {
            await app.DB.removeEventExtraPlayer(rec.toEv.id, rec.member.name);
            rec.toEv.extraPlayers = (rec.toEv.extraPlayers || []).filter(function(n) { return n !== rec.member.name; });
            PM._syncHubEvent(rec.toEv.id, function(ev) {
                ev.extraPlayers = (ev.extraPlayers || []).filter(function(n) { return n !== rec.member.name; });
            });
        }
        if (rec.noticeId) {
            try { await app.DB.deleteNotification(rec.noticeId); } catch (e) { console.warn('お知らせの削除に失敗:', e); }
            if (app.Hub && Array.isArray(app.Hub.notifications)) {
                app.Hub.notifications = app.Hub.notifications.filter(function(n) { return String(n.id) !== String(rec.noticeId); });
                if (app.Hub.Notifications && app.Hub.Notifications.renderNotifications) app.Hub.Notifications.renderNotifications();
            }
        }
        addLog('参加イベント変更の取り消し', rec.member.name + ': ' + titleOf(rec.toEv));
    };

    /** 操作ログ（HUB 以外の画面では端末に保存済みのログに追記し、手元のログを消さない） */
    function addLog(action, details) {
        if (!app.Storage || !app.Storage.addLog) return;
        var logs = (app.Hub && app.Hub.logs) || (app.Storage.loadLogs ? app.Storage.loadLogs() : []);
        var updated = app.Storage.addLog('attendance', action, details, logs);
        if (app.Hub) app.Hub.logs = updated;
    }

    /** HUB の予定一覧（リアルタイム同期で最新）の同じ予定にも反映する */
    PM._syncHubEvent = function(eventId, fn) {
        var ev = app.Hub && (app.Hub.events || []).find(function(e) { return String(e.id) === String(eventId); });
        if (ev) fn(ev);
    };

    /** その選手の保護者が、移動元の予定に車を登録していれば名前を返す */
    PM.guardianDrivers = function(members, member, fromData) {
        var guardians = members.filter(function(m) {
            return m.role !== 'player' && (m.childrenIds || []).some(function(c) { return String(c) === String(member.id); });
        }).map(function(m) { return m.name; });
        return ((fromData && fromData.carRegistrations) || [])
            .filter(function(c) { return c && c.canDrive !== 'no' && guardians.indexOf(c.parent) !== -1; })
            .map(function(c) { return c.parent; });
    };

    // =============================================
    // 「選手を入れる」画面
    // =============================================

    function ensureModal() {
        var modal = document.getElementById('player-move-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'player-move-modal';
        modal.className = 'modal';
        modal.style.zIndex = '1045'; // 予定の詳細・イベント概要・出欠状況の表より前面
        modal.innerHTML =
            '<div class="modal-content">' +
                '<span class="close" aria-label="閉じる">&times;</span>' +
                '<h2 style="font-size:18px;">選手を入れる</h2>' +
                '<div class="pm-head"></div>' +
                '<div class="pm-moved"></div>' +
                '<div class="pm-list"></div>' +
            '</div>';
        document.body.appendChild(modal);
        modal.querySelector('.close').addEventListener('click', function() { PM.close(); });
        modal.addEventListener('click', function(e) { if (e.target === modal) PM.close(); });
        return modal;
    }

    PM.close = function() {
        var modal = document.getElementById('player-move-modal');
        if (modal) modal.style.display = 'none';
        var cb = PM._state && PM._state.onClose;
        var changed = PM._state && PM._state.moved.length > 0;
        if (cb) cb(changed);
    };

    /**
     * 「選手を入れる」画面を開く
     * @param {Object} toEv - 選手を入れる予定
     * @param {Object} opts - { members, events（同じ日の予定。省略時は読み込む）, onClose(changed) }
     */
    PM.open = async function(toEv, opts) {
        if (!PM.canUse()) {
            app.UI.showAlert('選手の参加変更は管理者・指導者・役員のみ行えます', 'warning');
            return;
        }
        opts = opts || {};
        var modal = ensureModal();
        PM._state = { toEv: toEv, members: opts.members || [], events: opts.events || null, onClose: opts.onClose || null, moved: [] };
        modal.querySelector('.pm-head').innerHTML = '';
        modal.querySelector('.pm-moved').innerHTML = '';
        modal.querySelector('.pm-list').innerHTML = '<p class="loading">読み込み中...</p>';
        modal.style.display = 'flex';
        await PM.render();
    };

    PM.render = async function() {
        var st = PM._state;
        var modal = document.getElementById('player-move-modal');
        if (!st || !modal) return;
        var esc = app.UI.escapeHTML;
        var toEv = st.toEv;
        var listEl = modal.querySelector('.pm-list');
        var events, dataMap = {};
        try {
            // 予定の一覧は関数でも渡せる（HUB はリアルタイム同期で最新の一覧に差し替わるため）
            var src = typeof st.events === 'function' ? st.events() : st.events;
            events = (src || await app.DB.loadEventsOnDate(toEv.date)).filter(function(e) {
                return e.date === toEv.date && PM.isMovableEvent(e);
            });
            var ids = [String(toEv.id)].concat(events.filter(function(e) { return String(e.id) !== String(toEv.id); }).map(function(e) { return String(e.id); }));
            var datas = await Promise.all(ids.map(function(id) { return app.DB.loadEventData(id).catch(function() { return null; }); }));
            ids.forEach(function(id, i) { dataMap[id] = datas[i] || {}; });
        } catch (e) {
            listEl.innerHTML = '<p style="color:#c00;">読み込めませんでした。通信環境を確認してください</p>';
            return;
        }
        // 最新の予定（学年外追加など）を使う
        var latestTo = events.find(function(e) { return String(e.id) === String(toEv.id); });
        if (latestTo) { st.toEv = toEv = latestTo; }
        var toData = dataMap[String(toEv.id)];
        var players = st.members.filter(function(m) { return m.role === 'player'; });

        // 見出し: この予定の人数
        var c = PM.countFor(st.members, toEv, toData);
        modal.querySelector('.pm-head').innerHTML =
            '<div style="background:#fff8e6;border:1px solid #E8A200;border-radius:8px;padding:8px 10px;margin-bottom:10px;">' +
                '<div style="font-weight:bold;">' + esc(fmtDate(toEv.date) + ' ' + titleOf(toEv)) + '</div>' +
                '<div style="font-size:13px;margin-top:2px;"><span style="color:#2e7d32;">参加 ' + c.present + '</span>　' +
                '<span style="color:#b07d00;">未回答 ' + c.unknown + '</span>　<span style="color:#c62828;">不参加 ' + c.absent + '</span></div>' +
            '</div>';

        // この画面で移した選手（元に戻す・LINE用の文面）
        var movedEl = modal.querySelector('.pm-moved');
        movedEl.innerHTML = '';
        if (st.moved.length > 0) {
            var box = document.createElement('div');
            box.style.cssText = 'border:1px solid #c3e6cb;background:#f0fff4;border-radius:8px;padding:8px 10px;margin-bottom:10px;';
            var h = document.createElement('div');
            h.style.cssText = 'font-weight:bold;font-size:13px;margin-bottom:4px;';
            h.textContent = '移した選手';
            box.appendChild(h);
            st.moved.forEach(function(rec, i) {
                var row = document.createElement('div');
                row.className = 'pm-moved-row';
                row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0;';
                var t = document.createElement('span');
                t.style.cssText = 'flex:1;min-width:0;';
                t.textContent = PM.lineText(rec).replace(/^【参加変更】\S+ /, '');
                var undo = document.createElement('button');
                undo.type = 'button';
                undo.className = 'secondary-button pm-undo';
                undo.textContent = '元に戻す';
                undo.style.cssText = 'flex:0 0 auto;font-size:12px;padding:4px 10px;min-height:32px;';
                undo.addEventListener('click', async function() {
                    if (!app.UI.showConfirm(rec.member.name + ' の参加変更を元に戻しますか？')) return;
                    undo.disabled = true;
                    try {
                        await PM.undo(rec);
                        st.moved.splice(i, 1);
                        app.UI.showAlert(rec.member.name + ' の参加変更を元に戻しました', 'success');
                    } catch (e) {
                        undo.disabled = false;
                        app.UI.showAlert('元に戻せませんでした: ' + e.message, 'error', 6000);
                        return;
                    }
                    PM.render();
                });
                row.appendChild(t);
                row.appendChild(undo);
                box.appendChild(row);
            });
            var copy = document.createElement('button');
            copy.type = 'button';
            copy.className = 'pm-copy-line';
            copy.textContent = 'LINE用の文面をコピー';
            copy.style.cssText = 'margin-top:6px;font-size:13px;padding:6px 12px;';
            copy.addEventListener('click', function() {
                var text = st.moved.map(PM.lineText).join('\n');
                if (U().copyToClipboard(text)) app.UI.showAlert('参加変更の文面をコピーしました。チームのLINEに貼り付けて知らせてください', 'success', 5000);
                else app.UI.showAlert('コピーできませんでした', 'error');
            });
            box.appendChild(copy);
            movedEl.appendChild(box);
        }

        // 候補: 同じ日の他の予定の選手（不参加の選手は除く）と、その日に予定のない選手
        listEl.innerHTML = '';
        var others = events.filter(function(e) { return String(e.id) !== String(toEv.id); }).sort(U().compareEvents);
        var busy = {};
        others.forEach(function(ev) {
            var data = dataMap[String(ev.id)];
            var cands = sortPlayers(players.filter(function(m) {
                if (!PM.isTarget(m, ev, data)) return false;
                busy[String(m.id)] = true;
                return !PM.isTarget(m, toEv, toData) && PM.statusOf(m, data) !== 'absent';
            }));
            listEl.appendChild(section('■ ' + titleOf(ev) + (ev.venue ? '（' + ev.venue + '）' : ''), cands, ev, data));
        });
        var free = sortPlayers(players.filter(function(m) {
            return !busy[String(m.id)] && !PM.isTarget(m, toEv, toData);
        }));
        listEl.appendChild(section('■ この日に予定のない選手', free, null, null));

        function section(title, cands, fromEv, fromData) {
            var sec = document.createElement('div');
            sec.className = 'pm-section';
            sec.style.cssText = 'margin:10px 0 4px;';
            var h3 = document.createElement('div');
            h3.style.cssText = 'font-weight:bold;font-size:13px;color:#5c4300;border-bottom:1px solid #eee;padding-bottom:3px;margin-bottom:4px;word-break:keep-all;overflow-wrap:anywhere;';
            h3.textContent = title;
            sec.appendChild(h3);
            if (cands.length === 0) {
                var p = document.createElement('p');
                p.style.cssText = 'font-size:12px;color:#999;margin:4px 0;';
                p.textContent = '入れられる選手はいません';
                sec.appendChild(p);
                return sec;
            }
            cands.forEach(function(m) {
                var row = document.createElement('div');
                row.className = 'pm-row';
                row.dataset.name = m.name;
                row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f3f3f3;';
                var g = document.createElement('span');
                g.style.cssText = 'flex:0 0 34px;font-size:12px;color:#666;';
                g.textContent = gradeLabel(m);
                var n = document.createElement('span');
                n.style.cssText = 'flex:1;min-width:0;word-break:keep-all;overflow-wrap:anywhere;';
                n.textContent = m.name;
                row.appendChild(g);
                row.appendChild(n);
                if (fromEv) {
                    var stx = PM.statusOf(m, fromData);
                    var badge = document.createElement('span');
                    badge.style.cssText = 'flex:0 0 auto;font-size:11px;padding:1px 6px;border-radius:10px;' +
                        (stx === 'present' ? 'background:#e8f5e9;color:#2e7d32;' : 'background:#f5f5f5;color:#888;');
                    badge.textContent = stx === 'present' ? '参加' : '未回答';
                    row.appendChild(badge);
                }
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'pm-add';
                btn.textContent = '入れる';
                btn.style.cssText = 'flex:0 0 auto;font-size:13px;padding:4px 12px;min-height:34px;';
                btn.addEventListener('click', async function() {
                    var msg = m.name + (gradeLabel(m) ? '（' + gradeLabel(m) + '）' : '') + ' を「' + titleOf(toEv) + '」に入れますか？' +
                        (fromEv ? '\n「' + titleOf(fromEv) + '」は不参加になります。' : '') +
                        '\n（保護者に変更のお知らせが届きます）';
                    var drivers = fromEv ? PM.guardianDrivers(st.members, m, fromData) : [];
                    if (drivers.length > 0) {
                        msg += '\n\n※ 保護者（' + drivers.join('、') + '）の車が「' + titleOf(fromEv) + '」に登録されています。必要なら配車を調整してください。';
                    }
                    if (!app.UI.showConfirm(msg)) return;
                    btn.disabled = true;
                    try {
                        var rec = await PM.move(m, fromEv, toEv);
                        st.moved.push(rec);
                        app.UI.showAlert(m.name + ' を「' + titleOf(toEv) + '」に入れました', 'success');
                    } catch (e) {
                        btn.disabled = false;
                        app.UI.showAlert('参加変更に失敗しました: ' + e.message, 'error', 6000);
                        return;
                    }
                    PM.render();
                });
                row.appendChild(btn);
                sec.appendChild(row);
            });
            return sec;
        }
    };

})(window.FCOjima);
