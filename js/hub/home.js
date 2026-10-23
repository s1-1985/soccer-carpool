/**
 * FC尾島ジュニア - HUB の最初の画面（カレンダータブの上）の「やること」と「今週の予定」
 *
 * はじめて開いた人が「何をすればいいか」が分かるように、その人にいま必要なことだけを出す
 *  - 保護者: まだ答えていない出欠（その場で「参加／不参加」）
 *  - 監督・コーチ: 指導の都合の未回答（参加予定タブへ）
 *  - 承認の権限がある人: 承認待ちの人（管理タブへ）。出欠状況の権限がある人: 今日から7日間の予定ごとの出欠・車の席・帯同指導者・割り当て
 *  - 全員: 新しい連絡（連絡事項タブへ）、スマホのブラウザで開いているときは一度だけ「ホーム画面に追加」の案内
 * タブにも件数を出す（参加予定 = 出欠の未回答＋都合の未回答、管理 = 承認待ち）
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Home = FCOjima.Hub.Home || {};

(function(app) {
    var Home = app.Hub.Home;
    var MAX_ATT_ROWS = 3;    // やることに出す出欠の数（残りは参加予定タブで）
    var WEEK_DAYS = 7;       // 今週の予定（今日から何日）

    var A2HS_KEY = 'fcojima_a2hs_done'; // 「ホーム画面に追加」の案内を閉じた（次から出さない）
    var _installEvt = null;             // Android の Chrome がくれる「インストール」（あれば押すだけで追加できる）
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        _installEvt = e;
        if (Home.render) Home.render();
    });
    window.addEventListener('appinstalled', function() {
        try { localStorage.setItem(A2HS_KEY, '1'); } catch (e) {}
        if (Home.render) Home.render();
    });

    var _profile = null;
    var _pending = 0;        // 承認待ちの人数（管理タブが読み込んだもの）
    var _coachLeft = 0;      // 指導の都合の未回答の日数
    var _week = {};          // 予定ID → 配車の状況（今週の予定）
    var _seq = 0;

    function UI() { return app.UI; }
    function Utils() { return app.Utils; }
    function esc(s) { return app.UI.escapeHTML(String(s == null ? '' : s)); }
    // 権限の設定の機能（js/common/permissions.js）
    function can(f) { return !!(app.Auth && app.Auth.can && app.Auth.can(f)); }
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
        if (!C || !can('coach_answer')) return 0;
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
        if (!can('attendance_view')) return;
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

    /**
     * 「ホーム画面に追加」の案内を出すか: スマホのブラウザで開いていて（ホーム画面のアプリではない）、まだ閉じていない
     * @returns {string|null} 'ios' | 'android' | null
     */
    function a2hsKind() {
        try { if (localStorage.getItem(A2HS_KEY) === '1') return null; } catch (e) { return null; }
        var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
        if (standalone) return null;
        var ua = navigator.userAgent || '';
        if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
        if (/Android/.test(ua)) return 'android';
        return null;
    }

    function a2hsHtml() {
        var kind = a2hsKind();
        if (!kind) return '';
        var how = kind === 'ios'
            ? 'Safari の画面下の <b>共有ボタン</b>（□に↑）→「<b>ホーム画面に追加</b>」'
            : (_installEvt ? '下の「ホーム画面に追加」を押してください' : 'Chrome の右上の <b>︙</b> →「<b>ホーム画面に追加</b>」（または「アプリをインストール」）');
        return '<section class="hh-a2hs"><div class="hh-a2hs-head"><span class="hh-a2hs-ttl">📱 ホーム画面に追加しておくと便利です</span>' +
            '<button type="button" class="hh-a2hs-close" aria-label="閉じる（次から出さない）">閉じる</button></div>' +
            '<p class="hh-a2hs-text">次からはアイコンを押すだけで開けます。' + how + '</p>' +
            (kind === 'android' && _installEvt ? '<button type="button" class="hh-a2hs-install">ホーム画面に追加</button>' : '') +
            '</section>';
    }

    /** やることと今週の予定を出す */
    Home.render = function() {
        // 初期化（データの読み込み）の前には描かない。Android の Chrome は「ホーム画面に追加」の合図
        // （beforeinstallprompt）をページを開いてすぐに送ってくることがあり、以前はデータを読む前にここで
        // 新着の連絡を数えたため、はじめての端末の「7日より前の連絡は読んだことにする」が空の一覧で決まり、
        // 3か月分の連絡事項が全部「新着」になっていた（初期化のあとに描くときに合図も使う）
        if (!_profile) return;
        Home.renderBadges();
        var root = document.getElementById('hub-home');
        if (!root) return;
        var Me = app.Hub.MyEvents;
        var att = (Me && Me.unanswered) ? Me.unanswered() : [];
        var todos = '';

        // 出欠の回答（その場で「参加／不参加」）。同じ予定の兄弟はまとめて1つの予定の下に並べる
        // （以前は子どもごとに予定の日付・名前を繰り返していた）
        if (att.length) {
            var groups = [];
            att.forEach(function(x, i) {
                var g = groups.filter(function(y) { return String(y.item.eventId) === String(x.item.eventId); })[0];
                if (!g) { g = { item: x.item, rows: [] }; groups.push(g); }
                g.rows.push(i);
            });
            todos += '<section class="hh-card hh-att"><div class="hh-head"><span class="hh-ttl">📝 出欠の回答</span>' +
                '<span class="hh-count">未回答 ' + att.length + '件</span></div>' +
                groups.slice(0, MAX_ATT_ROWS).map(function(g) {
                    var dl = g.item.deadline ? new Date(g.item.deadline) : null;
                    var dlText = (dl && !isNaN(dl.getTime())) ? '締切 ' + (dl.getMonth() + 1) + '/' + dl.getDate() : '';
                    return '<div class="hh-ev">' +
                        '<button type="button" class="hh-row-main" data-event="' + esc(g.item.eventId) + '">' +
                        '<span class="hh-row-date">' + fmt(g.item.date) + (g.item.startTime ? ' ' + esc(g.item.startTime) : '') +
                        (dlText ? '<span class="hh-dl">' + dlText + '</span>' : '') + '</span>' +
                        '<span class="hh-row-title">' + esc(g.item.title) + ' <span class="hh-row-go">›</span></span></button>' +
                        g.rows.map(function(i) {
                            return '<div class="hh-row" data-i="' + i + '"><span class="hh-row-sub">' + esc(att[i].kid.name) + '</span></div>';
                        }).join('') +
                        '</div>';
                }).join('') +
                (groups.length > MAX_ATT_ROWS ? '<button type="button" class="hh-more" data-go="my-events-tab">ほか ' + (groups.length - MAX_ATT_ROWS) + '件の予定は「参加予定」で答える ›</button>' : '') +
                '</section>';
        }
        // 指導の都合
        if (_coachLeft > 0) {
            todos += '<button type="button" class="hh-card hh-link" data-go="my-events-tab"><span class="hh-ttl">🧢 指導の都合</span>' +
                '<span class="hh-count">未回答 ' + _coachLeft + '日</span><span class="hh-go">答える ›</span></button>';
        }
        // 承認待ち
        if (_pending > 0 && can('approve')) {
            todos += '<button type="button" class="hh-card hh-link" data-go="admin-tab"><span class="hh-ttl">👤 承認待ち</span>' +
                '<span class="hh-count">' + _pending + '人</span><span class="hh-go">確認する ›</span></button>';
        }

        // 新しい連絡（チームの連絡事項・これからの予定ごとの連絡）
        var N = app.Hub.Notifications;
        var unreadNotes = (N && N.unreadCount) ? N.unreadCount() : 0;
        if (unreadNotes > 0) {
            todos += '<button type="button" class="hh-card hh-link" data-go="notifications-tab"><span class="hh-ttl">📣 新しい連絡</span>' +
                '<span class="hh-count">' + unreadNotes + '件</span><span class="hh-go">見る ›</span></button>';
        }

        // やることを先に。「ホーム画面に追加」は一度だけの案内なので、その下に小さく
        var html = todos ? '<div class="hh-label">やること</div>' + todos : '';
        html += a2hsHtml();
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
        var install = root.querySelector('.hh-a2hs-install');
        if (install) install.addEventListener('click', function() {
            var evt = _installEvt;
            _installEvt = null;
            if (evt) evt.prompt();
        });
        var close = root.querySelector('.hh-a2hs-close');
        if (close) close.addEventListener('click', function() {
            try { localStorage.setItem(A2HS_KEY, '1'); } catch (e) {}
            Home.render();
        });
    };

    /** 今週の予定（マネージャー）: 予定ごとに 出欠・車の席・帯同指導者・割り当て */
    function weekHtml() {
        if (!can('attendance_view')) return '';
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
                    chip(coachNames ? 'ok' : 'warn', coachNames ? '帯同 ' + esc(coachNames) : '帯同 未定') +
                    // まだ誰も「参加」と答えていなければ、席・割り当ては「0/0」ではなく回答待ちと出す
                    (st.need === 0
                        ? chip('', st.cars ? '車 ' + st.cars + '台・参加の回答待ち' : '配車は参加の回答待ち')
                        : chip(seatState, '車の席 ' + st.seats + '/' + st.need) + chip(assignState, '割り当て ' + st.assigned + '/' + st.need)) +
                    '</span></button>';
            }).join('') +
            '<p class="hh-note">「車の席」は乗れる席の数／座席が要る人（参加・帯同指導者）。押すと予定の詳細</p></section>';
    }

})(window.FCOjima);
