/**
 * FC尾島ジュニア - HUB の最初の画面（カレンダータブの上）の「やること」と「今週の予定」
 *
 * はじめて開いた人が「何をすればいいか」が分かるように、その人にいま必要なことだけを出す
 *  - 保護者: まだ答えていない出欠（その場で「参加／不参加」）
 *  - 監督・コーチ: 指導の都合の未回答（参加予定タブへ）
 *  - マネージャー: 承認待ちの人（管理タブへ）と、今日から7日間の予定ごとの出欠・車の席・帯同指導者・割り当て
 * タブにも件数を出す（参加予定 = 出欠の未回答＋都合の未回答、管理 = 承認待ち）
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Home = FCOjima.Hub.Home || {};

(function(app) {
    var Home = app.Hub.Home;
    var MAX_ATT_ROWS = 3;    // やることに出す出欠の数（残りは参加予定タブで）
    var WEEK_DAYS = 7;       // 今週の予定（今日から何日）

    var _profile = null;
    var _pending = 0;        // 承認待ちの人数（管理タブが読み込んだもの）
    var _coachLeft = 0;      // 指導の都合の未回答の日数
    var _week = {};          // 予定ID → 配車の状況（今週の予定）
    var _seq = 0;

    function UI() { return app.UI; }
    function Utils() { return app.Utils; }
    function esc(s) { return app.UI.escapeHTML(String(s == null ? '' : s)); }
    function isManager() { return !!(app.Auth && app.Auth.isManager && app.Auth.isManager()); }
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function fmt(date) {
        var d = new Date(date + 'T00:00:00');
        return (d.getMonth() + 1) + '/' + d.getDate() + '(' + ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] + ')';
    }
    function openTab(id) {
        var b = document.getElementById(id);
        if (b) b.click();
        window.scrollTo(0, 0);
    }

    /**
     * 初期化（hub/index.html の DOMContentLoaded から。参加予定タブ・管理タブの初期化のあと）
     * @param {Object} profile
     */
    Home.init = function(profile) {
        _profile = profile;
        // カレンダータブに戻ってきたら数え直す（都合を答えた・担当を決めた後など）
        var calTab = document.getElementById('defaultTab');
        if (calTab) calTab.addEventListener('click', function() { Home.update(true); });
        Home.update(true);
    };

    /** 承認待ちの人数（管理タブが承認待ちを読み込むたびに呼ぶ） */
    Home.setPendingCount = function(n) {
        _pending = n || 0;
        Home.render();
    };

    /** 指導の都合の未回答の日数（自分が指導者でなければ 0） */
    async function coachLeft() {
        var C = app.Hub.Coaching;
        if (!C || !isManager()) return 0;
        var me = C.myCoach(_profile);
        if (!me) return 0;
        await C.ensureLoaded();
        return C.planDates().filter(function(d) { return !C.answerOf(me.id, d); }).length;
    }

    /** 今日から7日間の予定（ナイター練習を除く） */
    function weekEvents() {
        var from = iso(new Date());
        var end = new Date(); end.setDate(end.getDate() + WEEK_DAYS - 1);
        var to = iso(end);
        return (app.Hub.events || []).filter(function(ev) {
            return ev && ev.type !== 'nighter' && String(ev.date) >= from && String(ev.date) <= to;
        }).slice().sort(Utils().compareEvents);
    }

    /** 今週の予定の配車の状況を読み込む（読み込み済みの予定は reload のときだけ読み直す） */
    async function loadWeek(reload) {
        if (!isManager()) return;
        if (reload) _week = {};
        var C = app.Hub.Coaching;
        if (C) await C.ensureLoaded();
        var evs = weekEvents().filter(function(ev) { return !_week[String(ev.id)]; });
        var data = await Promise.all(evs.map(function(ev) {
            return app.DB.loadEventData(ev.id).catch(function() { return null; });
        }));
        evs.forEach(function(ev, i) {
            var coaches = C ? C.assignedMembers(ev.id) : [];
            _week[String(ev.id)] = {
                st: Utils().carpoolStatus(ev, app.Hub.members || [], data[i], coaches),
                coaches: coaches
            };
        });
    }

    /**
     * 数え直して出し直す
     * @param {boolean} [reload] - 都合・今週の予定を読み直す
     */
    Home.update = async function(reload) {
        var seq = ++_seq;
        try {
            var left = await coachLeft();
            await loadWeek(reload);
            if (seq !== _seq) return;
            _coachLeft = left;
        } catch (e) {
            console.warn('やること・今週の予定を読み込めませんでした:', e);
        }
        if (seq === _seq) Home.render();
    };

    /** タブの件数（参加予定 = 出欠の未回答＋都合の未回答、管理 = 承認待ち） */
    Home.renderBadges = function() {
        var Me = app.Hub.MyEvents;
        var att = (Me && Me.unanswered) ? Me.unanswered().length : 0;
        var me = document.getElementById('my-events-badge');
        if (me) {
            var n = att + _coachLeft;
            var changed = !!(Me && Me.hasChanges && Me.hasChanges());
            me.textContent = n > 0 ? (n > 99 ? '99+' : String(n)) : '';
            me.classList.toggle('num', n > 0);
            me.classList.toggle('on', n > 0 || changed);
            me.setAttribute('aria-label', n > 0 ? '未回答 ' + n + '件' : (changed ? '変更あり' : ''));
        }
        var ad = document.getElementById('admin-badge');
        if (ad) {
            ad.textContent = _pending > 0 ? String(_pending) : '';
            ad.classList.toggle('num', _pending > 0);
            ad.classList.toggle('on', _pending > 0);
            ad.setAttribute('aria-label', _pending > 0 ? '承認待ち ' + _pending + '人' : '');
        }
    };

    /** やることと今週の予定を出す */
    Home.render = function() {
        Home.renderBadges();
        var root = document.getElementById('hub-home');
        if (!root) return;
        var Me = app.Hub.MyEvents;
        var att = (Me && Me.unanswered) ? Me.unanswered() : [];
        var todos = '';

        // 出欠の回答（その場で「参加／不参加」）
        if (att.length) {
            todos += '<section class="hh-card hh-att"><div class="hh-head"><span class="hh-ttl">📝 出欠の回答</span>' +
                '<span class="hh-count">未回答 ' + att.length + '件</span></div>' +
                att.slice(0, MAX_ATT_ROWS).map(function(x, i) {
                    var dl = x.item.deadline ? new Date(x.item.deadline) : null;
                    var dlText = (dl && !isNaN(dl.getTime())) ? '締切 ' + (dl.getMonth() + 1) + '/' + dl.getDate() : '';
                    return '<div class="hh-row" data-i="' + i + '">' +
                        '<button type="button" class="hh-row-main" data-event="' + esc(x.item.eventId) + '">' +
                        '<span class="hh-row-date">' + fmt(x.item.date) + (x.item.startTime ? ' ' + esc(x.item.startTime) : '') + '</span>' +
                        '<span class="hh-row-title">' + esc(x.item.title) + '</span>' +
                        '<span class="hh-row-sub">' + esc(x.kid.name) + (dlText ? '<span class="hh-dl">' + dlText + '</span>' : '') + '</span>' +
                        '</button></div>';
                }).join('') +
                (att.length > MAX_ATT_ROWS ? '<button type="button" class="hh-more" data-go="my-events-tab">ほか ' + (att.length - MAX_ATT_ROWS) + '件は「参加予定」で答える ›</button>' : '') +
                '</section>';
        }
        // 指導の都合
        if (_coachLeft > 0) {
            todos += '<button type="button" class="hh-card hh-link" data-go="my-events-tab"><span class="hh-ttl">🧢 指導の都合</span>' +
                '<span class="hh-count">未回答 ' + _coachLeft + '日</span><span class="hh-go">答える ›</span></button>';
        }
        // 承認待ち
        if (_pending > 0 && isManager()) {
            todos += '<button type="button" class="hh-card hh-link" data-go="admin-tab"><span class="hh-ttl">👤 承認待ち</span>' +
                '<span class="hh-count">' + _pending + '人</span><span class="hh-go">確認する ›</span></button>';
        }

        var html = todos ? '<div class="hh-label">やること</div>' + todos : '';
        html += weekHtml();
        root.innerHTML = html;
        root.style.display = html ? '' : 'none';

        // 出欠の「参加／不参加」（押すとすぐ保存。答えた予定はやることから消える）
        root.querySelectorAll('.hh-att .hh-row').forEach(function(row) {
            var x = att[parseInt(row.dataset.i, 10)];
            if (x && Me.answerButtons) row.appendChild(Me.answerButtons(x.item.eventId, x.kid.name, x.kid.status));
        });
        root.querySelectorAll('[data-event]').forEach(function(b) {
            b.addEventListener('click', function() { app.Hub.Calendar.showEventDetails(b.dataset.event); });
        });
        root.querySelectorAll('[data-go]').forEach(function(b) {
            b.addEventListener('click', function() { openTab(b.dataset.go); });
        });
    };

    /** 今週の予定（マネージャー）: 予定ごとに 出欠・車の席・帯同指導者・割り当て */
    function weekHtml() {
        if (!isManager()) return '';
        var evs = weekEvents().filter(function(ev) { return _week[String(ev.id)]; });
        if (!evs.length) return '';
        var chip = function(state, text) { return '<span class="hh-chip' + (state ? ' is-' + state : '') + '">' + text + '</span>'; };
        return '<section class="hh-week"><div class="hh-label">今週の予定の状況 <small>今日から7日間</small></div>' +
            evs.map(function(ev) {
                var w = _week[String(ev.id)];
                var st = w.st;
                var a = st.attendance;
                var seatState = st.need === 0 ? '' : st.cars === 0 ? 'warn' : st.seats >= st.need ? 'ok' : 'warn';
                var assignState = st.need === 0 ? '' : st.assigned >= st.need ? 'ok' : st.assigned > 0 ? 'part' : 'warn';
                var coachNames = w.coaches.map(function(m) { return m.abbr || m.name; }).join('・');
                return '<button type="button" class="hh-week-row" data-event="' + esc(ev.id) + '">' +
                    '<span class="hh-week-head"><span class="hh-row-date">' + fmt(ev.date) + (ev.startTime ? ' ' + esc(ev.startTime) : '') + '</span>' +
                    '<span class="hh-row-title">' + esc(ev.title || Utils().getEventTypeLabel(ev.type)) + '</span></span>' +
                    '<span class="hh-chips">' +
                    chip(a.unanswered === 0 && a.total > 0 ? 'ok' : a.unanswered > 0 ? 'warn' : '', '出欠 ' + (a.present + a.absent) + '/' + a.total + (a.unanswered ? '<small>未' + a.unanswered + '</small>' : '')) +
                    chip(seatState, '車の席 ' + st.seats + '/' + st.need) +
                    chip(coachNames ? 'ok' : 'warn', coachNames ? '帯同 ' + esc(coachNames) : '帯同 未定') +
                    chip(assignState, '割り当て ' + st.assigned + '/' + st.need) +
                    '</span></button>';
            }).join('') +
            '<p class="hh-note">「車の席」は乗れる席の数／座席が要る人（参加・帯同指導者）。押すと予定の詳細</p></section>';
    }

})(window.FCOjima);
