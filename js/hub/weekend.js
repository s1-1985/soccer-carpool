/**
 * FC尾島ジュニア - 週末の段取り（管理タブ・HUB の「今週の予定の状況」から開く）
 *
 * チームの週の流れ（火曜に監督が予定を出す → 保護者が出欠を答える → 役員が集計 → 監督が参加の割り振りを調整 →
 * 遠征先ごとに車の提供を確かめる → 役員が配車表を作って LINE に流す）を、1つの画面で上から順に進められるようにする。
 *  ① 予定を出す   … まとめて追加（先週と同じ予定を写せる）・LINE で知らせる文
 *  ② 出欠を集める … 予定ごとの 参加/未回答/不参加 と、未回答の子への声かけの文
 *  ③ 参加を調整   … 必要な人数に足りない予定を知らせ、その場で参加者を入れ替える（同じ日の別の予定から）
 *  ④ 車を集める   … 車の席と、車の提供をまだ答えていない保護者への声かけの文
 *  ⑤ 配車表       … 割り当ての画面へ（画像で LINE に流す）
 * 監督がするのは主に ① と ③。集計はアプリがするので、役員から監督への受け渡し（木曜）は要らなくなる。
 * 開けるのは「出欠状況」の権限がある人（初期値は 管理者・監督・コーチ・役員）。ボタンはそれぞれの権限があるときだけ
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Weekend = FCOjima.Hub.Weekend || {};

(function(app) {
    var W = app.Hub.Weekend;
    var DAYS = 7;
    var WD = ['日', '月', '火', '水', '木', '金', '土'];

    function U() { return app.Utils; }
    function esc(s) { return app.UI.escapeHTML(String(s == null ? '' : s)); }
    function can(f) { return !!(app.Auth && app.Auth.can && app.Auth.can(f)); }
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function addDays(isoDate, n) { var d = new Date(isoDate + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
    function md(isoDate) { var d = new Date(isoDate + 'T00:00:00'); return (d.getMonth() + 1) + '/' + d.getDate() + '(' + WD[d.getDay()] + ')'; }
    function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
    function gradesText(ev) {
        var t = (ev.target || []).map(function(g) { return U().getGradeLabel ? U().getGradeLabel(g) : g + '年'; });
        return t.length ? t.join('・') : '全員';
    }
    function appUrl() { return location.origin + '/hub/index.html?tab=my-events'; }

    /** 期間の最初の日: 次の土曜の4日前（＝火曜。予定を出す日）。今日が火〜月なら、その週の火曜から */
    W.defaultFrom = function() {
        var d = new Date();
        var back = (d.getDay() + 5) % 7; // 火曜=0
        d.setDate(d.getDate() - back);
        return iso(d);
    };

    W._from = null;
    W._data = {};    // 予定ID → { ed, st, coaches }
    W._mode = 'board';

    W.canOpen = function() { return !!(app.Auth && app.Auth.isManager && app.Auth.isManager()) && can('attendance_view'); };

    function ensureModal() {
        var m = document.getElementById('weekend-modal');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'weekend-modal';
        m.className = 'modal';
        m.innerHTML = '<div class="modal-content wk-content"><span class="close" aria-label="閉じる">&times;</span>' +
            '<h2 class="wk-title">🗓 週末の段取り</h2><div class="wk-body"></div></div>';
        document.body.appendChild(m);
        var close = function() { m.style.display = 'none'; };
        m.querySelector('.close').addEventListener('click', close);
        m.addEventListener('click', function(e) { if (e.target === m) close(); });
        return m;
    }

    W.open = async function(from) {
        if (!W.canOpen()) { app.UI.showAlert('週末の段取りを開けるのは、出欠状況の権限がある人です', 'warning'); return; }
        W._from = isDate(from) ? from : (W._from || W.defaultFrom());
        W._mode = 'board';
        var m = ensureModal();
        m.style.display = 'flex';
        await W.load();
    };

    /** 期間の予定（ナイター以外・日付順） */
    W.events = function() {
        var to = addDays(W._from, DAYS - 1);
        return (app.Hub.events || []).filter(function(ev) {
            return ev.type !== 'nighter' && isDate(ev.date) && ev.date >= W._from && ev.date <= to;
        }).slice().sort(U().compareEvents);
    };

    W._loadSeq = 0;
    W.load = async function() {
        var body = document.querySelector('#weekend-modal .wk-body');
        if (!body) return;
        // 週を続けて切り替えたとき、先に始めた読み込みがあとから終わって新しい週の集計を上書きしないよう、最後の読み込みだけ使う
        var seq = ++W._loadSeq;
        body.innerHTML = '<p class="loading">読み込み中...</p>';
        try {
            var evs = W.events();
            var members = app.Hub.members || [];
            var assign = {};
            try { assign = await app.DB.loadCoachAssignments(); } catch (e) { assign = {}; }
            var datas = await Promise.all(evs.map(function(ev) { return app.DB.loadEventData(ev.id).catch(function() { return null; }); }));
            if (seq !== W._loadSeq) return;
            W._data = {};
            evs.forEach(function(ev, i) {
                var ed = datas[i] || {};
                var coaches = (assign[String(ev.id)] || []).map(function(id) { return members.find(function(m) { return String(m.id) === String(id); }); }).filter(Boolean);
                W._data[String(ev.id)] = { ed: ed, st: U().carpoolStatus(ev, members, ed, coaches), coaches: coaches };
            });
            W.render();
        } catch (e) {
            console.warn('週末の段取りを読み込めませんでした:', e);
            if (seq === W._loadSeq) body.innerHTML = '<p style="color:#c00;">読み込めませんでした。通信環境を確認して、開き直してください</p>';
        }
    };

    // ---------- 集計 ----------

    /** 予定の対象の選手と、それぞれの出欠 [{ member, status }] */
    W.players = function(ev) {
        var d = W._data[String(ev.id)] || {};
        var ed = d.ed || {};
        var members = app.Hub.members || [];
        var names = U().attendanceTargetNames(ev, members, ed);
        var att = Array.isArray(ed.attendance) ? ed.attendance : [];
        return names.map(function(n) {
            var a = att.find(function(x) { return x && x.name === n; });
            var st = a && (a.status === 'present' || a.status === 'absent') ? a.status : 'unknown';
            return { name: n, member: members.find(function(m) { return m.name === n; }) || null, status: st };
        });
    };

    /** 参加する子の保護者のうち、この予定の車の提供をまだ答えていない人（名簿の父・母） */
    W.carUnanswered = function(ev) {
        var d = W._data[String(ev.id)] || {};
        var regs = (d.ed && Array.isArray(d.ed.carRegistrations)) ? d.ed.carRegistrations : [];
        var owners = regs.map(function(c) { return U().carOwner(c); });
        var kidIds = W.players(ev).filter(function(p) { return p.status === 'present' && p.member; }).map(function(p) { return String(p.member.id); });
        return (app.Hub.members || []).filter(function(m) {
            return (m.role === 'father' || m.role === 'mother') && (m.childrenIds || []).some(function(id) { return kidIds.indexOf(String(id)) !== -1; }) &&
                owners.indexOf(String(m.name || '').trim()) === -1;
        }).map(function(m) { return m.name; });
    };

    function stepState(done, total) { return total === 0 ? '' : done >= total ? 'ok' : 'warn'; }

    // ---------- 描画 ----------

    W.render = function() {
        var body = document.querySelector('#weekend-modal .wk-body');
        if (!body) return;
        if (W._mode === 'bulk') { W.renderBulk(body); return; }
        var evs = W.events();
        var to = addDays(W._from, DAYS - 1);
        var html = '<div class="wk-nav"><button type="button" class="wk-prev" aria-label="前の週">‹</button>' +
            '<span class="wk-range">' + md(W._from) + ' 〜 ' + md(to) + '</span><button type="button" class="wk-next" aria-label="次の週">›</button></div>';

        // ① 予定を出す
        html += '<section class="wk-step"><h3><span class="wk-no">1</span>予定を出す' + (evs.length ? '<span class="wk-badge is-ok">' + evs.length + '件</span>' : '<span class="wk-badge is-warn">まだ</span>') + '</h3>';
        if (evs.length) {
            html += '<ul class="wk-evs">' + evs.map(function(ev) {
                return '<li><b>' + esc(md(ev.date)) + '</b> ' + esc(gradesText(ev)) + ' ' + esc(ev.title || U().getEventTypeLabel(ev.type)) +
                    (ev.venue ? ' <span class="wk-sub">' + esc(ev.venue) + '</span>' : '') +
                    (ev.departureTime ? ' <span class="wk-sub">' + esc(ev.departureTime) + '出発</span>' : (ev.startTime ? ' <span class="wk-sub">' + esc(ev.startTime) + '〜</span>' : '')) + '</li>';
            }).join('') + '</ul>';
        } else {
            html += '<p class="wk-empty">この週の予定はまだありません。</p>';
        }
        html += '<div class="wk-btns">' + (can('events') ? '<button type="button" class="wk-bulk">＋ まとめて追加</button>' : '') +
            (evs.length ? '<button type="button" class="wk-share" data-kind="plan">LINEで知らせる</button>' : '') + '</div>' +
            '<p class="wk-hint">LINE には予定とアプリのリンクを流し、出欠と車の提供は「参加予定」で答えてもらいます（コメントでの回答・集計が要らなくなります）</p></section>';

        if (evs.length) {
            // ② 出欠
            var totU = 0, totAll = 0;
            var attRows = evs.map(function(ev) {
                var ps = W.players(ev);
                var p = ps.filter(function(x) { return x.status === 'present'; }).length;
                var a = ps.filter(function(x) { return x.status === 'absent'; }).length;
                var u = ps.filter(function(x) { return x.status === 'unknown'; });
                totU += u.length; totAll += ps.length;
                return '<li class="wk-row"><div class="wk-row-head"><b>' + esc(md(ev.date)) + '</b> ' + esc(ev.title || '') + '</div>' +
                    '<div class="wk-counts"><span class="c-p">参加 ' + p + '</span><span class="c-u' + (u.length ? ' is-warn' : '') + '">未回答 ' + u.length + '</span><span class="c-a">不参加 ' + a + '</span></div>' +
                    (u.length ? '<div class="wk-names">未回答: ' + esc(u.map(function(x) { return x.name; }).join('、')) + '</div>' : '') + '</li>';
            }).join('');
            html += '<section class="wk-step"><h3><span class="wk-no">2</span>出欠を集める<span class="wk-badge is-' + (totU ? 'warn' : 'ok') + '">' + (totU ? '未回答 ' + totU : 'そろった') + '</span></h3>' +
                '<ul class="wk-rows">' + attRows + '</ul>' +
                '<div class="wk-btns">' + (totU ? '<button type="button" class="wk-share" data-kind="remind">未回答の人に声をかける</button>' : '') +
                (can('attendance_view') ? '<button type="button" class="wk-matrix">出欠状況の表</button>' : '') + '</div></section>';

            // ③ 参加を調整
            var shortCount = 0;
            var adjRows = evs.map(function(ev) {
                var p = W.players(ev).filter(function(x) { return x.status === 'present'; }).length;
                var need = parseInt(ev.minPlayers, 10) || 0;
                var short = need > 0 && p < need;
                if (short) shortCount++;
                return '<li class="wk-row' + (short ? ' is-short' : '') + '"><div class="wk-row-head"><b>' + esc(md(ev.date)) + '</b> ' + esc(ev.title || '') + ' <span class="wk-sub">' + esc(gradesText(ev)) + '</span></div>' +
                    '<div class="wk-counts"><span class="c-p">参加 ' + p + (need ? ' / 必要 ' + need : '') + '</span>' + (short ? '<span class="is-warn">⚠ ' + (need - p) + '人足りません</span>' : (need ? '<span class="is-ok">足りています</span>' : '<span class="wk-sub">必要な人数は未設定</span>')) + '</div>' +
                    (can('player_move') ? '<button type="button" class="wk-move" data-event="' + esc(ev.id) + '">参加者を入れる・入れ替える</button>' : '') + '</li>';
            }).join('');
            html += '<section class="wk-step"><h3><span class="wk-no">3</span>参加を調整する<span class="wk-badge is-' + (shortCount ? 'warn' : 'ok') + '">' + (shortCount ? '足りない ' + shortCount + '件' : '問題なし') + '</span></h3>' +
                '<p class="wk-hint">同じ日のほかの予定の子や、その日に予定のない子を、この予定に入れられます（入れた子の保護者には知らせが出ます）。必要な人数は予定の編集で決められます</p>' +
                '<ul class="wk-rows">' + adjRows + '</ul></section>';

            // ④ 車
            var carShort = 0, carAsk = 0;
            var carRows = evs.map(function(ev) {
                var st = (W._data[String(ev.id)] || {}).st || { seats: 0, need: 0, cars: 0 };
                var un = W.carUnanswered(ev);
                carAsk += un.length;
                var ok = st.need === 0 || st.seats >= st.need;
                if (!ok) carShort++;
                return '<li class="wk-row' + (ok ? '' : ' is-short') + '"><div class="wk-row-head"><b>' + esc(md(ev.date)) + '</b> ' + esc(ev.title || '') + (ev.venue ? ' <span class="wk-sub">' + esc(ev.venue) + '</span>' : '') + '</div>' +
                    '<div class="wk-counts"><span>車 ' + st.cars + '台</span><span class="' + (ok ? 'is-ok' : 'is-warn') + '">席 ' + st.seats + ' / 必要 ' + st.need + '</span></div>' +
                    (un.length ? '<div class="wk-names">車の提供をまだ答えていない保護者: ' + esc(un.join('、')) + '</div>' : '') + '</li>';
            }).join('');
            html += '<section class="wk-step"><h3><span class="wk-no">4</span>車を集める<span class="wk-badge is-' + (carShort ? 'warn' : 'ok') + '">' + (carShort ? '席が足りない ' + carShort + '件' : '足りている') + '</span></h3>' +
                '<p class="wk-hint">席の「必要」は参加する子と帯同の指導者の人数です。保護者は「参加予定」で車を出せるか答えます</p>' +
                '<ul class="wk-rows">' + carRows + '</ul>' +
                '<div class="wk-btns">' + (carAsk ? '<button type="button" class="wk-share" data-kind="car">車の提供を頼む</button>' : '') + '</div></section>';

            // ⑤ 配車表
            var aRows = evs.map(function(ev) {
                var st = (W._data[String(ev.id)] || {}).st || { assigned: 0, need: 0 };
                var done = st.need > 0 && st.assigned >= st.need;
                return '<li class="wk-row"><div class="wk-row-head"><b>' + esc(md(ev.date)) + '</b> ' + esc(ev.title || '') + '</div>' +
                    '<div class="wk-counts"><span class="' + (done ? 'is-ok' : st.assigned ? '' : 'is-warn') + '">割り当て ' + st.assigned + ' / ' + st.need + '</span>' +
                    '<a class="wk-link" href="../carpool/assignments.html?event=' + encodeURIComponent(String(ev.id)) + '">配車表を作る ›</a></div></li>';
            }).join('');
            var allAssigned = evs.every(function(ev) { var st = (W._data[String(ev.id)] || {}).st || {}; return st.need > 0 && st.assigned >= st.need; });
            html += '<section class="wk-step"><h3><span class="wk-no">5</span>配車表<span class="wk-badge is-' + (allAssigned ? 'ok' : 'warn') + '">' + (allAssigned ? 'できた' : 'まだ') + '</span></h3>' +
                '<p class="wk-hint">割り当ての画面の「共有」で、配車表を画像にして LINE に流せます（ホワイトボードの写真の代わり）</p>' +
                '<ul class="wk-rows">' + aRows + '</ul></section>';
        }
        html += '<div class="wk-share-box" hidden><textarea class="wk-share-text" rows="8"></textarea><div class="wk-btns">' +
            '<button type="button" class="wk-share-line">LINEで送る</button><button type="button" class="wk-share-copy">コピー</button></div></div>';
        body.innerHTML = html;
        W.bind(body);
    };

    W.bind = function(body) {
        body.querySelector('.wk-prev').addEventListener('click', function() { W._from = addDays(W._from, -7); W.load(); });
        body.querySelector('.wk-next').addEventListener('click', function() { W._from = addDays(W._from, 7); W.load(); });
        var bulk = body.querySelector('.wk-bulk');
        if (bulk) bulk.addEventListener('click', function() { W._mode = 'bulk'; W._rows = null; W.render(); });
        var mx = body.querySelector('.wk-matrix');
        if (mx) mx.addEventListener('click', function() {
            var b = document.getElementById('btn-attendance-matrix');
            if (b) b.click();
        });
        body.querySelectorAll('.wk-move').forEach(function(b) {
            b.addEventListener('click', function() {
                var ev = (app.Hub.events || []).find(function(e) { return String(e.id) === b.dataset.event; });
                if (!ev || !app.PlayerMove) return;
                app.PlayerMove.open(ev, {
                    members: app.Hub.members || [],
                    events: function() { return app.Hub.events || []; },
                    onClose: function(changed) { if (changed) W.load(); }
                });
            });
        });
        body.querySelectorAll('.wk-share').forEach(function(b) {
            b.addEventListener('click', function() { W.showShare(W.shareText(b.dataset.kind)); });
        });
        var box = body.querySelector('.wk-share-box');
        body.querySelector('.wk-share-line').addEventListener('click', function() {
            var t = box.querySelector('textarea').value;
            if (!U().shareViaLINE(t)) { U().copyToClipboard(t); app.UI.showAlert('コピーしました。LINE に貼り付けてください', 'success'); }
        });
        body.querySelector('.wk-share-copy').addEventListener('click', function() {
            U().copyToClipboard(box.querySelector('textarea').value);
            app.UI.showAlert('コピーしました', 'success');
        });
    };

    W.showShare = function(text) {
        var box = document.querySelector('#weekend-modal .wk-share-box');
        if (!box) return;
        box.querySelector('textarea').value = text;
        box.hidden = false;
        box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    /** LINE に流す文: plan＝予定の知らせ、remind＝未回答の声かけ、car＝車の提供のお願い */
    W.shareText = function(kind) {
        var evs = W.events();
        var lines = [];
        if (kind === 'plan') {
            lines.push('【' + md(W._from) + '〜' + md(addDays(W._from, DAYS - 1)) + 'の予定】');
            evs.forEach(function(ev) {
                lines.push('・' + md(ev.date) + ' ' + gradesText(ev) + ' ' + (ev.title || U().getEventTypeLabel(ev.type)) +
                    (ev.venue ? ' ' + ev.venue : '') + (ev.departureTime ? ' ' + ev.departureTime + '出発' : (ev.startTime ? ' ' + ev.startTime + '〜' : '')));
            });
            lines.push('', '出欠と車の提供（出せる・出せない）は、アプリの「参加予定」から答えてください。');
        } else if (kind === 'remind') {
            lines.push('【出欠の回答のお願い】まだ答えていないお子さんです。');
            evs.forEach(function(ev) {
                var u = W.players(ev).filter(function(p) { return p.status === 'unknown'; }).map(function(p) { return p.name; });
                if (u.length) lines.push('・' + md(ev.date) + ' ' + (ev.title || '') + '：' + u.join('、'));
            });
            lines.push('', 'アプリの「参加予定」から答えてください。');
        } else {
            lines.push('【車の提供のお願い】参加するお子さんの保護者の方、車を出せるか答えてください。');
            evs.forEach(function(ev) {
                var u = W.carUnanswered(ev);
                if (u.length) lines.push('・' + md(ev.date) + ' ' + (ev.title || '') + (ev.venue ? '（' + ev.venue + '）' : '') + '：' + u.join('、') + ' さん');
            });
            lines.push('', 'アプリの「参加予定」の「車の提供」で答えられます。');
        }
        lines.push(appUrl());
        return lines.join('\n');
    };

    // ---------- まとめて追加 ----------

    function blankRow(date) { return { date: date || addDays(W._from, 4), type: 'game', title: '', target: [], venue: '', departureTime: '', startTime: '', minPlayers: '' }; }

    /** 先週の予定を、日付を7日ずらして写す（ナイターは除く） */
    W.copyLastWeek = function() {
        var from = addDays(W._from, -7), to = addDays(W._from, -1);
        return (app.Hub.events || []).filter(function(ev) { return ev.type !== 'nighter' && isDate(ev.date) && ev.date >= from && ev.date <= to; })
            .slice().sort(U().compareEvents).map(function(ev) {
                return { date: addDays(ev.date, 7), type: ev.type || 'game', title: ev.title || '', target: (ev.target || []).map(String), venue: ev.venue || '',
                    departureTime: ev.departureTime || '', startTime: ev.startTime || '', minPlayers: ev.minPlayers ? String(ev.minPlayers) : '' };
            });
    };

    function grades() {
        var gs = [];
        (app.Hub.members || []).forEach(function(m) { if (m.role === 'player' && m.grade && gs.indexOf(String(m.grade)) === -1) gs.push(String(m.grade)); });
        if (!gs.length) gs = ['1', '2', '3', '4', '5', '6'];
        return gs.sort(function(a, b) { return (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99); });
    }

    W.renderBulk = function(body) {
        if (!W._rows) W._rows = [blankRow()];
        var days = []; for (var i = 0; i < DAYS; i++) days.push(addDays(W._from, i));
        var gs = grades();
        var venues = (app.Hub.venues || []).map(function(v) { return v.name; }).filter(Boolean);
        var html = '<div class="wk-bulk-head"><button type="button" class="wk-back">‹ 段取りに戻る</button><span>' + md(W._from) + '〜' + md(addDays(W._from, DAYS - 1)) + ' の予定をまとめて追加</span></div>' +
            '<p class="wk-hint">1行が1つの予定です。カテゴリー（学年）ごとに行を作ります。「先週と同じ」で先週の予定を写してから直すと早いです</p>' +
            '<datalist id="wk-venues">' + venues.map(function(v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>';
        html += W._rows.map(function(r, idx) {
            return '<div class="wk-brow" data-i="' + idx + '">' +
                '<div class="wk-bline"><select class="b-date">' + days.map(function(d) { return '<option value="' + d + '"' + (d === r.date ? ' selected' : '') + '>' + md(d) + '</option>'; }).join('') + '</select>' +
                '<select class="b-type"><option value="game"' + (r.type === 'game' ? ' selected' : '') + '>試合</option><option value="practice"' + (r.type === 'practice' ? ' selected' : '') + '>練習</option><option value="event"' + (r.type === 'event' ? ' selected' : '') + '>イベント</option></select>' +
                '<button type="button" class="b-del" aria-label="この行を消す">×</button></div>' +
                '<input type="text" class="b-title" placeholder="タイトル（例: スポアカ・岩松）" maxlength="60" value="' + esc(r.title) + '">' +
                '<div class="b-grades">' + gs.map(function(g) {
                    return '<label><input type="checkbox" value="' + esc(g) + '"' + (r.target.indexOf(g) !== -1 ? ' checked' : '') + '>' + esc(U().getGradeLabel ? U().getGradeLabel(g) : g + '年') + '</label>';
                }).join('') + '</div>' +
                '<div class="wk-bline"><input type="text" class="b-venue" list="wk-venues" placeholder="会場" value="' + esc(r.venue) + '">' +
                '<label class="b-sm">出発<input type="time" class="b-dep" value="' + esc(r.departureTime) + '"></label>' +
                '<label class="b-sm">開始<input type="time" class="b-start" value="' + esc(r.startTime) + '"></label>' +
                '<label class="b-sm">必要<input type="number" class="b-min" min="0" max="40" inputmode="numeric" value="' + esc(r.minPlayers) + '">人</label></div></div>';
        }).join('');
        html += '<div class="wk-btns"><button type="button" class="wk-addrow">＋ 行を足す</button><button type="button" class="wk-copy">先週と同じ</button></div>' +
            '<div class="wk-btns"><button type="button" class="wk-save">この内容で予定を作る</button></div>';
        body.innerHTML = html;

        var read = function() {
            W._rows = Array.prototype.map.call(body.querySelectorAll('.wk-brow'), function(el) {
                return { date: el.querySelector('.b-date').value, type: el.querySelector('.b-type').value, title: el.querySelector('.b-title').value.trim(),
                    target: Array.prototype.map.call(el.querySelectorAll('.b-grades input:checked'), function(c) { return c.value; }),
                    venue: el.querySelector('.b-venue').value.trim(), departureTime: el.querySelector('.b-dep').value, startTime: el.querySelector('.b-start').value,
                    minPlayers: el.querySelector('.b-min').value };
            });
        };
        body.querySelector('.wk-back').addEventListener('click', function() { W._mode = 'board'; W.render(); });
        body.querySelector('.wk-addrow').addEventListener('click', function() { read(); var last = W._rows[W._rows.length - 1]; W._rows.push(blankRow(last && last.date)); W.renderBulk(body); });
        body.querySelector('.wk-copy').addEventListener('click', function() {
            var rows = W.copyLastWeek();
            if (!rows.length) { app.UI.showAlert('先週の予定がありません', 'info'); return; }
            read();
            W._rows = W._rows.filter(function(r) { return r.title; }).concat(rows);
            W.renderBulk(body);
            app.UI.showAlert('先週の予定 ' + rows.length + '件を写しました。直してから「予定を作る」を押してください', 'success');
        });
        body.querySelectorAll('.b-del').forEach(function(b) {
            b.addEventListener('click', function() { read(); W._rows.splice(parseInt(b.closest('.wk-brow').dataset.i, 10), 1); if (!W._rows.length) W._rows = [blankRow()]; W.renderBulk(body); });
        });
        body.querySelector('.wk-save').addEventListener('click', function() { read(); W.saveBulk(); });
    };

    /** まとめて追加: タイトルのある行を予定にする */
    W.saveBulk = function() {
        if (!can('events')) { app.UI.showAlert('予定を作る権限がありません', 'warning'); return; }
        var rows = (W._rows || []).filter(function(r) { return r.title; });
        if (!rows.length) { app.UI.showAlert('タイトルを入れた行がありません', 'warning'); return; }
        var noGrade = rows.filter(function(r) { return !r.target.length; });
        if (noGrade.length && !app.UI.showConfirm('学年を選んでいない予定が ' + noGrade.length + '件あります（全員が対象になります）。このまま作りますか？')) return;
        var base = Date.now();
        rows.forEach(function(r, i) {
            var id = base + i;
            app.Hub.events.push({
                id: id, date: r.date, type: r.type, title: r.title, target: r.target, extraPlayers: [], targetNotes: '',
                minPlayers: Math.max(0, parseInt(r.minPlayers, 10) || 0), attendanceDeadline: null,
                departureTime: r.departureTime, meetingPlace: '', venue: r.venue, startTime: r.startTime, endTime: '', notes: '',
                checklist: (app.Checklist && app.Checklist.getItems) ? app.Checklist.getItems(r.type) : [], luggage: []
            });
            app.Hub.logs = app.Storage.addLog('calendar', 'イベント追加', '「' + r.title + '」（' + r.date + '）', app.Hub.logs, { eventId: id });
        });
        app.Storage.saveEvents(app.Hub.events);
        if (app.Hub.Calendar) { app.Hub.Calendar.renderCalendar(); app.Hub.Calendar.renderEventsList(); }
        app.UI.showAlert(rows.length + '件の予定を作りました。「LINEで知らせる」で保護者に知らせてください', 'success', 6000);
        W._rows = null;
        W._mode = 'board';
        W.load();
    };
})(window.FCOjima);
