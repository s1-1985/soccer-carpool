/**
 * FC尾島ジュニア - 参加予定タブ
 * 自分の子供（兄弟姉妹含む）が参加対象のイベント一覧と、
 * 前回閲覧時からの変化通知・参加イベント変更ダイアログを提供する
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.MyEvents = FCOjima.Hub.MyEvents || {};

(function(app) {
    var MyEvents = app.Hub.MyEvents;
    var UI = app.UI;
    var Utils = app.Utils;

    var _profile = null;   // ログインユーザーのプロフィール
    var _items = null;     // 計算済みの参加予定 [{eventId,date,title,startTime,venue,kids:[{name,status}]}]
    var _changes = [];     // 前回スナップショットとの差分

    function uid() { return _profile ? _profile.uid : 'anon'; }
    function snapKey() { return 'fcojima_myevents_snap_' + uid(); }
    function moveAckKey() { return 'fcojima_move_ack_' + uid(); }
    function todayISO() {
        var d = new Date();
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    function fmtDate(iso) {
        if (!iso) return '';
        var d = new Date(iso + 'T00:00:00');
        var dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
        return (d.getMonth() + 1) + '/' + d.getDate() + '(' + dow + ')';
    }

    /**
     * 初期化（hub/index.html の DOMContentLoaded から呼ばれる）
     * 子供が登録されているユーザー（保護者）と、監督・コーチにタブを出す。どちらでもなければ何もしない
     *  - 監督・コーチ: 上に「指導の予定」（土日の都合の回答と担当。js/hub/coaching.js）
     *  - 保護者: お子さんの参加予定（監督・コーチが保護者を兼ねる場合は両方）
     */
    MyEvents.init = async function(profile) {
        _profile = profile;
        var hasKids = !!(profile && profile.childrenIds && profile.childrenIds.length > 0);
        var Coaching = app.Hub.Coaching;
        var coach = Coaching ? Coaching.myCoach(profile) : null;
        var showCoach = !!Coaching && (!!coach || !!(profile && (profile.role === 'coach' || profile.role === 'assist')));
        if (!hasKids && !showCoach) return;

        var kidsEl = document.getElementById('my-events-kids');
        if (kidsEl && !hasKids) kidsEl.style.display = 'none';
        var tabBtn = document.getElementById('my-events-tab');
        if (tabBtn) {
            tabBtn.style.display = '';
            tabBtn.addEventListener('click', function() {
                if (showCoach) Coaching.renderMine(document.getElementById('my-coaching'), Coaching.myCoach(_profile));
                if (hasKids) MyEvents.renderList(true);
            });
        }
        if (!hasKids) return;

        var okBtn = document.getElementById('move-notice-ok');
        if (okBtn) {
            okBtn.addEventListener('click', function() {
                try { localStorage.setItem(moveAckKey(), String(Date.now())); } catch (e) {}
                UI.closeModal('move-notice-modal');
                MyEvents.updateBadge();
            });
        }

        try {
            await MyEvents.refresh();
            MyEvents.checkMoveNotices();
        } catch (e) {
            console.warn('参加予定の初期化に失敗:', e);
        }
    };

    /** childrenIds に対応するメンバー（選手）を返す */
    MyEvents.getChildren = function() {
        // _profile 未設定（init前・子なしユーザー）でも安全に空配列を返す。
        // イベントのリアルタイム同期は全ユーザーで refresh を呼ぶため、ここでのnull安全が必要
        if (!_profile) return [];
        var ids = (_profile.childrenIds || []).map(String);
        // 子供は選手。過去のID採番バグで選手以外と同じIDが重複している場合に、
        // 保護者などが「子供」として参加予定に出ないよう選手に限定する
        return (app.Hub.members || []).filter(function(m) {
            return m.role === 'player' && ids.includes(String(m.id));
        });
    };

    /**
     * 参加予定を計算する
     * 参加 = 対象学年に含まれる or 学年外追加選手（extraPlayers）で、出欠が「不参加」でない
     */
    MyEvents.computeItems = async function() {
        var children = MyEvents.getChildren();
        if (children.length === 0) return [];

        var today = todayISO();
        var events = (app.Hub.events || []).filter(function(ev) {
            return ev.date && ev.date >= today && ev.type !== 'nighter';
        }).slice().sort(Utils.compareEvents);

        // 各イベントの出欠を並列取得（不参加の子を除くため）
        var dataArr = await Promise.all(events.map(function(ev) {
            return FCOjima.DB.loadEventData(ev.id).catch(function() { return null; });
        }));

        var items = [];
        events.forEach(function(ev, i) {
            var att = (dataArr[i] && dataArr[i].attendance) ? dataArr[i].attendance : [];
            var targets = (ev.target && ev.target.length > 0) ? ev.target : null;
            var extras = ev.extraPlayers || [];

            var kids = [];
            children.forEach(function(child) {
                var isTarget = !targets
                    || (child.grade && targets.some(function(g) { return String(g) === String(child.grade); }))
                    || extras.includes(child.name);
                if (!isTarget) return;
                // 出欠ページで参加者から外された（その予定には出ない）
                if (Utils.isRemovedFromEvent(child, dataArr[i])) return;

                var item = att.find(function(a) {
                    return (a.memberId && String(a.memberId) === String(child.id)) || a.name === child.name;
                });
                // 回答の無い行（status 未設定）は未回答として扱う（カレンダーの表示と揃える）
                var status = (item && item.status) ? item.status : 'unknown';
                // 不参加の子も残す（このタブ・やることで答えるので、答え直せるように）。
                // 以前は不参加にすると予定ごと消えていた
                kids.push({
                    name: child.name,
                    status: status,
                    // 乗る車（座席の割り当てで決まっていれば）
                    car: status === 'present' ? Utils.carOf(dataArr[i], child.name) : null
                });
            });

            if (kids.length > 0) {
                var dutyAssignment = app.Hub.getDutyAssignment ? app.Hub.getDutyAssignment(ev.id) : null;
                items.push({
                    eventId: String(ev.id),
                    date: ev.date,
                    title: ev.title || Utils.getEventTypeLabel(ev.type),
                    startTime: ev.startTime || '',
                    venue: ev.venue || '',
                    type: ev.type,
                    checklistExtra: ev.checklistExtra,
                    checklist: ev.checklist,
                    dutyGroupName: dutyAssignment ? dutyAssignment.groupName : null,
                    deadline: ev.attendanceDeadline || '',
                    // この予定の連絡（配車の「連絡」）
                    notes: ((dataArr[i] && dataArr[i].notifications) || []).filter(function(n) { return n && n.text; }),
                    kids: kids
                });
            }
        });
        return items;
    };

    /**
     * 参加予定を再計算し、前回スナップショットとの差分とバッジを更新する
     * （スナップショット自体はタブを開くまで更新しない）
     */
    var _refreshSeq = 0;
    var _refreshPromise = null;
    MyEvents.refresh = function() {
        // 予定の変更が続けて届くと再計算が並行して走る。先に始めた（古い予定一覧で計算した）方が
        // 後から終わって新しい結果を上書きしないよう、最後に始めた計算の結果だけを使う
        // （古い方の呼び出し元には、最後の計算が終わるまで待ってから返す）
        var seq = ++_refreshSeq;
        var p = MyEvents.computeItems().then(function(items) {
            if (seq !== _refreshSeq) return _refreshPromise;
            _items = items;
            _changes = MyEvents.diffSnapshot(_items);
            MyEvents.updateBadge();
            if (app.Hub.Home && app.Hub.Home.update) app.Hub.Home.update();
        });
        _refreshPromise = p;
        return p;
    };

    /** 現在の参加予定をスナップショット形式に変換 */
    function toSnapshot(items) {
        var snap = {};
        items.forEach(function(it) {
            it.kids.forEach(function(k) {
                if (k.status === 'absent') return;
                snap[k.name + '|' + it.eventId] = { d: it.date, t: it.title, s: it.startTime };
            });
        });
        return snap;
    }

    /** 計算済みの参加予定（まだなら null） */
    MyEvents.items = function() { return _items; };

    /** まだ答えていない（未回答の）子と予定 [{ item, kid }]（日付順） */
    MyEvents.unanswered = function() {
        var list = [];
        (_items || []).forEach(function(it) {
            it.kids.forEach(function(k) { if (k.status === 'unknown') list.push({ item: it, kid: k }); });
        });
        return list;
    };

    var STATUS_LABEL = { present: '参加', absent: '不参加', unknown: '未回答' };

    /**
     * 子供の出欠を答える（参加予定のカード・予定の詳細・カレンダーの「やること」から）。
     * 出欠表（eventData.attendance）のその子の行だけを、最新の内容に対してトランザクションで書き換える
     * （同じ予定にほかの保護者が同時に答えても消し合わない）。まだ出欠表に行がなければ足す
     * @param {string} eventId
     * @param {string} name - 子供（選手）の名前
     * @param {string} status - 'present' | 'absent'
     */
    MyEvents.answer = async function(eventId, name, status) {
        await FCOjima.DB.updateEventData(eventId, function(cur) {
            var att = (cur && Array.isArray(cur.attendance)) ? cur.attendance.map(function(a) { return Object.assign({}, a); }) : [];
            var row = att.find(function(a) { return a && a.name === name; });
            if (row) row.status = status;
            else att.push({ name: name, status: status, notes: '' });
            return { attendance: att };
        });
        // 自分で答えた分は「前回から変わった点」に出さない（不参加にした予定を「参加がなくなりました」と知らせない）
        try {
            var raw = localStorage.getItem(snapKey());
            if (raw) {
                var snap = JSON.parse(raw);
                var key = name + '|' + String(eventId);
                var it = (_items || []).find(function(x) { return x.eventId === String(eventId); });
                if (status === 'absent') delete snap[key];
                else if (it) snap[key] = { d: it.date, t: it.title, s: it.startTime };
                localStorage.setItem(snapKey(), JSON.stringify(snap));
            }
        } catch (e) {}
        UI.showAlert(name + '：「' + STATUS_LABEL[status] + '」で保存しました', 'success');
        await MyEvents.refresh();
        var tab = document.getElementById('my-events');
        if (tab && tab.style.display !== 'none') MyEvents.renderList(false);
    };

    /**
     * 子供1人分の「参加／不参加」ボタン（押すとすぐ保存）
     * @param {string} eventId
     * @param {string} name
     * @param {string} status - いまの回答
     * @param {Function} [onDone] - 保存したあとに呼ぶ
     */
    MyEvents.answerButtons = function(eventId, name, status, onDone) {
        var wrap = document.createElement('div');
        wrap.className = 'me-ans';
        wrap.setAttribute('role', 'group');
        wrap.setAttribute('aria-label', name + 'の出欠');
        [['present', '参加'], ['absent', '不参加']].forEach(function(o) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'me-ans-btn me-ans-' + o[0] + (status === o[0] ? ' is-on' : '');
            b.dataset.status = o[0];
            b.textContent = o[1];
            b.setAttribute('aria-pressed', String(status === o[0]));
            b.addEventListener('click', async function(e) {
                e.stopPropagation();
                if (status === o[0]) return;
                wrap.querySelectorAll('button').forEach(function(x) { x.disabled = true; });
                try {
                    await MyEvents.answer(eventId, name, o[0]);
                    if (onDone) onDone();
                } catch (err) {
                    console.warn('出欠を保存できませんでした:', err);
                    UI.showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                    wrap.querySelectorAll('button').forEach(function(x) { x.disabled = false; });
                }
            });
            wrap.appendChild(b);
        });
        return wrap;
    };

    /** 乗る車の表示（「🚗 加藤さんの車」）。決まっていなければ空 */
    MyEvents.carText = function(car) {
        if (!car) return '';
        return car.driver ? '🚗 ' + car.driver + 'さんの車' : '🚗 ' + (car.carIndex + 1) + '台目の車（運転手未定）';
    };

    /**
     * 前回スナップショットとの差分を計算
     * 初回（スナップショット未保存）は差分なし扱い
     */
    MyEvents.diffSnapshot = function(items) {
        var raw = localStorage.getItem(snapKey());
        if (!raw) return [];
        var prev;
        try { prev = JSON.parse(raw); } catch (e) { return []; }

        var cur = toSnapshot(items);
        var changes = [];
        var today = todayISO();

        Object.keys(cur).forEach(function(key) {
            var name = key.split('|')[0];
            if (!prev[key]) {
                changes.push({ type: 'added', key: key, name: name,
                    msg: fmtDate(cur[key].d) + '「' + cur[key].t + '」に ' + name + ' が参加予定に追加されました' });
            } else if (prev[key].d !== cur[key].d || prev[key].s !== cur[key].s || prev[key].t !== cur[key].t) {
                changes.push({ type: 'changed', key: key, name: name,
                    msg: '「' + cur[key].t + '」（' + name + '）の日時が変わりました: ' + fmtDate(cur[key].d) + ' ' + (cur[key].s || '') });
            }
        });
        Object.keys(prev).forEach(function(key) {
            if (!cur[key] && prev[key].d >= today) {
                var name = key.split('|')[0];
                changes.push({ type: 'removed', key: key, name: name,
                    msg: fmtDate(prev[key].d) + '「' + prev[key].t + '」の ' + name + ' の参加がなくなりました' });
            }
        });
        return changes;
    };

    /** 参加イベント変更の内容（移動元がない＝その日に予定のなかった子を入れた場合は「〇〇に参加」） */
    function moveText(n) {
        return n.fromEventTitle
            ? '「' + n.fromEventTitle + '」→「' + (n.toEventTitle || '') + '」へ変更'
            : '「' + (n.toEventTitle || '') + '」に参加することになりました';
    }

    /** 未読の参加イベント変更通知（type:'move'）を返す */
    MyEvents.unseenMoves = function() {
        if (!_profile) return [];
        var ack = parseInt(localStorage.getItem(moveAckKey()) || '0', 10);
        var childIds = (_profile.childrenIds || []).map(String);
        var childNames = MyEvents.getChildren().map(function(m) { return m.name; });
        return (app.Hub.notifications || []).filter(function(n) {
            if (n.type !== 'move') return false;
            if (!n.ts || n.ts <= ack) return false;
            return (n.memberId && childIds.includes(String(n.memberId)))
                || (n.memberName && childNames.includes(n.memberName));
        });
    };

    /** 前回見たときから変わった点があるか */
    MyEvents.hasChanges = function() {
        return (_changes && _changes.length > 0) || MyEvents.unseenMoves().length > 0;
    };

    /** 参加予定タブのバッジを更新（未回答があれば件数、変わった点だけなら赤丸。件数は js/hub/home.js） */
    MyEvents.updateBadge = function() {
        if (app.Hub.Home && app.Hub.Home.renderBadges) { app.Hub.Home.renderBadges(); return; }
        var badge = document.getElementById('my-events-badge');
        if (!badge) return;
        badge.classList.toggle('on', MyEvents.hasChanges());
    };

    /**
     * 参加イベント変更ダイアログ（保護者向け）
     * 未読の move 通知があればモーダルで表示する
     */
    MyEvents.checkMoveNotices = function() {
        var moves = MyEvents.unseenMoves();
        if (moves.length === 0) return;

        var body = document.getElementById('move-notice-body');
        if (!body) return;
        body.innerHTML = '';

        var intro = document.createElement('p');
        intro.style.cssText = 'margin:0 0 10px;color:#555;font-size:13px;';
        intro.textContent = 'お子さんの参加イベントが変更されました。ご確認ください。';
        body.appendChild(intro);

        moves.forEach(function(n) {
            var div = document.createElement('div');
            div.style.cssText = 'background:#fff8e6;border:1px solid #E8A200;border-radius:8px;padding:10px 12px;margin-bottom:8px;';
            var strong = document.createElement('div');
            strong.style.cssText = 'font-weight:bold;margin-bottom:4px;';
            strong.textContent = fmtDate(n.eventDate) + '　' + (n.memberName || '');
            var detail = document.createElement('div');
            detail.style.cssText = 'font-size:13px;';
            detail.textContent = moveText(n);
            div.appendChild(strong);
            div.appendChild(detail);
            body.appendChild(div);
        });

        UI.openModal('move-notice-modal');
    };

    /**
     * 参加予定リストを描画
     * @param {boolean} markSeen - trueならスナップショットを更新して既読化（タブを開いたとき）
     */
    MyEvents.renderList = async function(markSeen) {
        var listEl = document.getElementById('my-events-list');
        if (!listEl) return;

        if (!_items) {
            listEl.innerHTML = '<p class="loading">読み込み中...</p>';
            try { await MyEvents.refresh(); } catch (e) {
                listEl.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + UI.escapeHTML(e.message) + '</p>';
                return;
            }
        }

        // 変化バナー
        var changesEl = document.getElementById('my-events-changes');
        if (changesEl) {
            var moveMsgs = MyEvents.unseenMoves().map(function(n) {
                return fmtDate(n.eventDate) + ' ' + (n.memberName || '') + '：' + moveText(n);
            });
            var allMsgs = moveMsgs.concat(_changes.map(function(c) { return c.msg; }));
            if (allMsgs.length > 0) {
                changesEl.innerHTML = '';
                var box = document.createElement('div');
                box.className = 'me-changes';
                var head = document.createElement('div');
                head.style.fontWeight = 'bold';
                head.textContent = '🔔 前回から変わった点';
                box.appendChild(head);
                var ul = document.createElement('ul');
                allMsgs.forEach(function(m) {
                    var li = document.createElement('li');
                    li.textContent = m;
                    ul.appendChild(li);
                });
                box.appendChild(ul);
                changesEl.appendChild(box);
            } else {
                changesEl.innerHTML = '';
            }
        }

        // 変化のあったイベントIDセット（ハイライト用）
        var changedKeys = new Set(_changes.map(function(c) { return c.key; }));
        var movedEventIds = new Set();
        MyEvents.unseenMoves().forEach(function(n) {
            if (n.toEventId) movedEventIds.add(String(n.toEventId));
        });

        // リスト本体
        listEl.innerHTML = '';
        if (_items.length === 0) {
            listEl.innerHTML = UI.createAlert('info', '今後の参加予定イベントはありません。');
        } else {
            _items.forEach(function(it) {
                var isChanged = movedEventIds.has(it.eventId) || it.kids.some(function(k) {
                    return changedKeys.has(k.name + '|' + it.eventId);
                });
                var card = document.createElement('div');
                card.className = 'me-card' + (isChanged ? ' me-changed' : '');

                var dateDiv = document.createElement('div');
                dateDiv.className = 'me-date';
                dateDiv.textContent = fmtDate(it.date) + (it.startTime ? '　' + it.startTime : '');
                var titleDiv = document.createElement('div');
                titleDiv.className = 'me-title';
                titleDiv.textContent = (isChanged ? '🔔 ' : '') + it.title;
                card.appendChild(dateDiv);
                card.appendChild(titleDiv);

                if (it.venue) {
                    var meta = document.createElement('div');
                    meta.className = 'me-meta';
                    meta.textContent = '会場: ' + it.venue;
                    card.appendChild(meta);
                }

                // 持ち物は1行で（どの予定もほぼ同じなので、チップで並べると出欠のボタンより目立っていた）
                if (app.Checklist) {
                    var items = app.Checklist.getItems(it.type, it.checklistExtra, it.checklist);
                    if (items.length) {
                        var bring = document.createElement('div');
                        bring.className = 'me-meta me-bring';
                        bring.textContent = '🎒 ' + items.join('・');
                        card.appendChild(bring);
                    }
                }

                // カードタップでカレンダーのイベント詳細モーダルを開く
                card.style.cursor = 'pointer';
                card.addEventListener('click', function() {
                    if (app.Hub.Calendar && app.Hub.Calendar.showEventDetails) {
                        app.Hub.Calendar.showEventDetails(it.eventId);
                    }
                });

                if (it.dutyGroupName) {
                    var dutyMeta = document.createElement('div');
                    dutyMeta.className = 'me-meta';
                    dutyMeta.textContent = '🔔 当番: ' + it.dutyGroupName;
                    card.appendChild(dutyMeta);
                }

                // 子供ごとに出欠をその場で答えられる（以前は 予定の詳細 →「配車管理へ」→ 出欠確認 と進んで答えていた）
                var kidsDiv = document.createElement('div');
                kidsDiv.className = 'me-kids';
                it.kids.forEach(function(k) {
                    var row = document.createElement('div');
                    row.className = 'me-kid-row me-st-' + k.status;
                    var info = document.createElement('div');
                    info.className = 'me-kid-info';
                    var nm = document.createElement('span');
                    nm.className = 'me-kid me-kid-name' + (k.status === 'unknown' ? ' unknown' : '');
                    nm.textContent = k.name;
                    if (k.status === 'unknown') {
                        var tag = document.createElement('small');
                        tag.className = 'me-kid-tag';
                        tag.textContent = '未回答';
                        nm.appendChild(tag);
                    }
                    info.appendChild(nm);
                    var carText = MyEvents.carText(k.car);
                    if (carText) {
                        var car = document.createElement('span');
                        car.className = 'me-kid-car';
                        car.textContent = carText;
                        info.appendChild(car);
                    }
                    row.appendChild(info);
                    row.appendChild(MyEvents.answerButtons(it.eventId, k.name, k.status));
                    kidsDiv.appendChild(row);
                });
                card.appendChild(kidsDiv);
                // この予定の連絡（新着があれば件数）。押すとその予定の連絡のページ
                if (it.notes && it.notes.length) {
                    var unread = app.Inbox ? app.Inbox.eventUnread(it.eventId, it.notes).length : 0;
                    var notesLink = document.createElement('a');
                    notesLink.className = 'me-notes' + (unread ? ' has-new' : '');
                    notesLink.href = '../carpool/notifications.html?event=' + encodeURIComponent(it.eventId);
                    notesLink.textContent = '📣 この予定の連絡 ' + it.notes.length + '件' + (unread ? '（新着 ' + unread + '）' : '') + ' ›';
                    notesLink.addEventListener('click', function(e) { e.stopPropagation(); });
                    card.appendChild(notesLink);
                }
                if (it.kids.every(function(k) { return k.status === 'absent'; })) card.classList.add('me-all-absent');
                listEl.appendChild(card);
            });
        }

        // 既読化：スナップショット更新＋バッジ消灯（バナーは今回表示分を維持）
        if (markSeen && _items) {
            // 端末の保存領域がいっぱいでも画面の処理は止めない
            try {
                localStorage.setItem(snapKey(), JSON.stringify(toSnapshot(_items)));
                localStorage.setItem(moveAckKey(), String(Date.now()));
            } catch (e) { console.warn('参加予定の既読状態を保存できませんでした:', e); }
            // 見たので変わった点は消す（バナーは今回表示した分を残す）。未回答の件数は残る
            _changes = [];
            MyEvents.updateBadge();
        }
    };

})(window.FCOjima);
