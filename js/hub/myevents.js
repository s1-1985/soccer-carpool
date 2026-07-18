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
     * 子供が未登録のユーザーでは何もしない
     */
    MyEvents.init = async function(profile) {
        _profile = profile;
        if (!profile || !profile.childrenIds || profile.childrenIds.length === 0) return;

        var tabBtn = document.getElementById('my-events-tab');
        if (tabBtn) {
            tabBtn.style.display = '';
            tabBtn.addEventListener('click', function() {
                MyEvents.renderList(true);
            });
        }

        var okBtn = document.getElementById('move-notice-ok');
        if (okBtn) {
            okBtn.addEventListener('click', function() {
                localStorage.setItem(moveAckKey(), String(Date.now()));
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
        var ids = (_profile.childrenIds || []).map(String);
        return (app.Hub.members || []).filter(function(m) {
            return ids.includes(String(m.id));
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
        }).slice().sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

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

                var item = att.find(function(a) {
                    return (a.memberId && String(a.memberId) === String(child.id)) || a.name === child.name;
                });
                var status = item ? item.status : 'unknown';
                if (status === 'absent') return; // 不参加（移動済み含む）は表示しない

                kids.push({ name: child.name, status: status });
            });

            if (kids.length > 0) {
                items.push({
                    eventId: String(ev.id),
                    date: ev.date,
                    title: ev.title || Utils.getEventTypeLabel(ev.type),
                    startTime: ev.startTime || '',
                    venue: ev.venue || '',
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
    MyEvents.refresh = async function() {
        _items = await MyEvents.computeItems();
        _changes = MyEvents.diffSnapshot(_items);
        MyEvents.updateBadge();
    };

    /** 現在の参加予定をスナップショット形式に変換 */
    function toSnapshot(items) {
        var snap = {};
        items.forEach(function(it) {
            it.kids.forEach(function(k) {
                snap[k.name + '|' + it.eventId] = { d: it.date, t: it.title, s: it.startTime };
            });
        });
        return snap;
    }

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

    /** 参加予定タブの赤丸バッジを更新 */
    MyEvents.updateBadge = function() {
        var badge = document.getElementById('my-events-badge');
        if (!badge) return;
        var on = (_changes && _changes.length > 0) || MyEvents.unseenMoves().length > 0;
        badge.classList.toggle('on', on);
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
            detail.textContent = '「' + (n.fromEventTitle || '') + '」→「' + (n.toEventTitle || '') + '」へ変更';
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
                return fmtDate(n.eventDate) + ' ' + (n.memberName || '') + '：「' + (n.fromEventTitle || '') + '」→「' + (n.toEventTitle || '') + '」へ変更';
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

                var kidsDiv = document.createElement('div');
                kidsDiv.className = 'me-kids';
                it.kids.forEach(function(k) {
                    var chip = document.createElement('span');
                    chip.className = 'me-kid' + (k.status === 'unknown' ? ' unknown' : '');
                    chip.textContent = k.name + (k.status === 'unknown' ? '（未回答）' : '');
                    kidsDiv.appendChild(chip);
                });
                card.appendChild(kidsDiv);
                listEl.appendChild(card);
            });
        }

        // 既読化：スナップショット更新＋バッジ消灯（バナーは今回表示分を維持）
        if (markSeen && _items) {
            localStorage.setItem(snapKey(), JSON.stringify(toSnapshot(_items)));
            localStorage.setItem(moveAckKey(), String(Date.now()));
            var badge = document.getElementById('my-events-badge');
            if (badge) badge.classList.remove('on');
        }
    };

})(window.FCOjima);
