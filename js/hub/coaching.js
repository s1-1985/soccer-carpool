/**
 * FC尾島ジュニア - 指導者（監督・コーチ）の都合と担当
 *
 * 流れ:
 *  1. 監督・コーチは「参加予定」タブの「指導の予定」で、今後の土日・祝日などの都合を回答しておく
 *     （行ける／午前だけ／午後だけ／行けない。メモも書ける）。予定がまだなくても回答できる。
 *     いちばん上に自分が担当する予定が出る
 *  2. 監督などマネージャーは管理タブ「🧢 指導者の予定・担当」で、週末を1つずつ切り替えて見る。
 *     日ごとに「行ける／行けない／未回答」の人と、その日の予定。予定の下に出る行ける人を押すと担当になる
 *  3. 担当（帯同指導者）は予定の詳細（全員が見られる）・コーチ本人の「指導の予定」・配車（概要、座席の割り当ての🧢）に出る
 * 聞く日: 8週間の土日・祝日は自動。お盆・年末年始などは監督が期間で追加（管理タブの画面・カレンダーの日付）、
 *        活動のない土日は「この日は聞かない」で外す
 * データ: coachAvailability/{メンバーID}（マネージャーのみ読み書き）、coachAssignments/{予定ID}（閲覧は全員）、
 *        coachDates/plan（聞く日の追加・外した日。閲覧は全員、変更はマネージャー）
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Coaching = FCOjima.Hub.Coaching || {};

(function(app) {
    var C = app.Hub.Coaching;
    var WEEKS = 8;          // 回答してもらう期間（週）
    var MINE_WEEKENDS = 4;  // 自分の回答の画面で最初に出す週末の数（残りは「さらに表示」）
    var DOW = ['日', '月', '火', '水', '木', '金', '土'];
    // 都合: 記号（一覧・名前の横）／ボタンの文字／説明
    var ANS = {
        ok: { mark: '○', label: '行ける', text: '行ける' },
        am: { mark: '午前', label: '午前だけ', text: '午前だけ' },
        pm: { mark: '午後', label: '午後だけ', text: '午後だけ' },
        ng: { mark: '×', label: '行けない', text: '行けない' }
    };
    var ORDER = ['ok', 'am', 'pm', 'ng'];

    C._avail = null;   // { メンバーID: { name, answers: { 日付: { s, note } } } }
    C._assign = null;  // { 予定ID: [メンバーID] }
    C._dates = null;   // 都合を聞く日の追加・外した日 { add: { 日付: true }, skip: { 日付: true } }
    C._showAllMine = false;
    C._weekKey = null; // 監督の画面で開いている週末

    function UI() { return app.UI; }
    function Utils() { return app.Utils; }
    function esc(s) { return app.UI.escapeHTML(String(s == null ? '' : s)); }
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function dateOf(s) { return new Date(s + 'T00:00:00'); }
    function fmt(date) { var d = dateOf(date); return (d.getMonth() + 1) + '/' + d.getDate() + '(' + DOW[d.getDay()] + ')'; }
    function md(date) { var d = dateOf(date); return (d.getMonth() + 1) + '/' + d.getDate(); }
    function dow(date) { return DOW[dateOf(date).getDay()]; }
    function holName(date) { return (app.Holidays && app.Holidays.nameOf) ? app.Holidays.nameOf(date) : ''; }
    function dayCls(date) { var w = dateOf(date).getDay(); return (w === 0 || holName(date)) ? ' co-sun' : w === 6 ? ' co-sat' : ''; }
    function isManager() { return !!(app.Auth && app.Auth.isManager && app.Auth.isManager()); }
    function shortName(m) { return (m && m.abbr) ? m.abbr : (m ? m.name : ''); }
    function evTime(ev) { return ev.startTime ? ev.startTime + '〜' : (ev.departureTime ? ev.departureTime + '出発' : ''); }
    C.ANSWERS = ANS;

    /** 都合のボタンの中身: 大きい文字（○・午前・午後・×）と小さいことば（行ける・だけ・行けない） */
    function ansButtonInner(s) {
        var big = { ok: '○', am: '午前', pm: '午後', ng: '×' }[s];
        var small = { ok: '行ける', am: 'だけ', pm: 'だけ', ng: '行けない' }[s];
        return '<span class="co-ans-mark' + (s === 'am' || s === 'pm' ? ' co-ans-word' : '') + '">' + big + '</span>' +
            '<span class="co-ans-label">' + small + '</span>';
    }

    // =============================================
    // データ
    // =============================================

    /** 指導者（監督・コーチ）のメンバー。監督→コーチ、名前順 */
    C.coaches = function() {
        var rank = { coach: 0, assist: 1 };
        return (app.Hub.members || []).filter(function(m) { return m.role === 'coach' || m.role === 'assist'; })
            .slice().sort(function(a, b) { return (rank[a.role] - rank[b.role]) || (a.name || '').localeCompare(b.name || '', 'ja'); });
    };

    /** ログイン中のユーザーにあたる指導者のメンバー（メンバーの名前とログインの名前が同じ） */
    C.myCoach = function(profile) {
        if (!profile || !profile.name) return null;
        var key = Utils().normalizeName(profile.name);
        return C.coaches().filter(function(m) { return Utils().normalizeName(m.name) === key; })[0] || null;
    };

    /**
     * 自動で聞く期間（今日から8週間）{ from, to }（to は含まない）。
     * 最後の週末（月曜の祝日まで）が途中で切れないよう、終わりは週末の区切り（火曜）まで延ばす
     */
    function autoRange() {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var end = new Date(today.getTime());
        end.setDate(end.getDate() + WEEKS * 7);
        end.setDate(end.getDate() + ((2 - end.getDay() + 7) % 7));
        return { from: iso(today), to: iso(end) };
    }
    /** 何もしなくても聞く日（今日から8週間の土日・祝日） */
    function isAutoDate(date, r) {
        r = r || autoRange();
        if (date < r.from || date >= r.to) return false;
        var w = dateOf(date).getDay();
        return w === 0 || w === 6 || !!holName(date);
    }
    function datesOf(kind) { return (C._dates && C._dates[kind]) || {}; }

    /** 監督が「聞かない」にした日（土日・祝日のうち予定のない日だけ。予定がある日は必ず聞く） */
    C.isSkipped = function(date, r) {
        return !!datesOf('skip')[date] && isAutoDate(date, r) && C.eventsOn(date).length === 0;
    };

    /**
     * 都合を聞く日
     *  - 今日から8週間の土日・祝日（監督が「聞かない」にした日を除く）
     *  - その間に予定（ナイター練習を除く）がある日
     *  - 監督が追加した日（お盆・年末年始など。8週間より先でも）
     * @param {boolean} [includeSkipped] - 「聞かない」にした日も入れる（監督の画面で「戻す」を出すため）
     */
    C.planDates = function(includeSkipped) {
        var r = autoRange();
        var set = {};
        for (var d = dateOf(r.from); iso(d) < r.to; d.setDate(d.getDate() + 1)) {
            var k = iso(d);
            if (isAutoDate(k, r) && (includeSkipped || !C.isSkipped(k, r))) set[k] = true;
        }
        (app.Hub.events || []).forEach(function(ev) {
            var date = ev && ev.date ? String(ev.date) : '';
            if (date && ev.type !== 'nighter' && date >= r.from && date < r.to) set[date] = true;
        });
        Object.keys(datesOf('add')).forEach(function(k) { if (k >= r.from) set[k] = true; });
        return Object.keys(set).sort();
    };

    C.isAsked = function(date) { return C.planDates().indexOf(String(date)) !== -1; };

    /** その日が入る週末の区切り（火曜〜月曜）の火曜日 */
    function weekKeyOf(date) {
        var d = dateOf(date);
        d.setDate(d.getDate() - ((d.getDay() - 2 + 7) % 7));
        return iso(d);
    }

    /**
     * 聞く日にする／聞かない日にする
     * 土日・祝日（自動で聞く日）は「聞かない」の印を付け外し、それ以外の日は「追加」の印を付け外す
     */
    C.setAsked = async function(dates, on) {
        var r = autoRange();
        var byDate = {};
        dates.forEach(function(d) {
            var auto = isAutoDate(d, r);
            byDate[d] = on ? (auto ? 'reset' : 'add') : (auto ? 'skip' : 'reset');
        });
        await app.DB.setCoachDates(byDate);
        C._dates = C._dates || { add: {}, skip: {} };
        Object.keys(byDate).forEach(function(d) {
            delete C._dates.add[d];
            delete C._dates.skip[d];
            if (byDate[d] !== 'reset') C._dates[byDate[d]][d] = true;
        });
    };

    /**
     * 回答する日を週末ごとにまとめる。火曜〜月曜を1つの区切りにして、金曜・月曜の祝日の予定も
     * その週末（3連休など）と一緒に出す
     * @param {boolean} [includeSkipped] - 「聞かない」にした日も入れる
     * @returns {Array<{key:string, dates:string[], label:string}>}
     */
    C.weekends = function(includeSkipped) {
        var groups = [];
        var byKey = {};
        C.planDates(includeSkipped).forEach(function(date) {
            var key = weekKeyOf(date);
            if (!byKey[key]) { byKey[key] = { key: key, dates: [] }; groups.push(byKey[key]); }
            byKey[key].dates.push(date);
        });
        groups.forEach(function(g) {
            var a = g.dates[0], b = g.dates[g.dates.length - 1];
            g.label = a === b ? fmt(a) : fmt(a) + '〜' + (dateOf(a).getMonth() === dateOf(b).getMonth() ? dateOf(b).getDate() + '(' + dow(b) + ')' : fmt(b));
            g.short = a === b ? md(a) : md(a) + '〜' + (dateOf(a).getMonth() === dateOf(b).getMonth() ? String(dateOf(b).getDate()) : md(b));
        });
        return groups;
    };

    /** その日の予定（ナイター練習を除く） */
    C.eventsOn = function(date) {
        return (app.Hub.events || []).filter(function(ev) {
            return String(ev.date) === String(date) && ev.type !== 'nighter';
        }).slice().sort(Utils().compareEvents);
    };

    /**
     * 都合・担当を読み込む（都合はマネージャーしか読めないので、それ以外では担当だけ）
     * 読み込めなくても他の画面は動くように、失敗は空として扱う
     */
    C.load = async function() {
        var tasks = [app.DB.loadCoachAssignments().then(function(m) { C._assign = m; }).catch(function(e) {
            console.warn('指導者の担当を読み込めませんでした:', e);
            if (!C._assign) C._assign = {};
        })];
        tasks.push(C.loadDates());
        if (isManager()) {
            tasks.push(app.DB.loadCoachAvailability().then(function(m) { C._avail = m; C._availFailed = false; }).catch(function(e) {
                console.warn('指導者の都合を読み込めませんでした:', e);
                if (!C._avail) C._avail = {};
                C._availFailed = true;
            }));
        }
        await Promise.all(tasks);
    };
    C.ensureLoaded = async function() {
        if (C._assign === null || C._dates === null || (isManager() && C._avail === null)) await C.load();
    };

    /** 都合を聞く日の追加・外した日を読み込む（読み込めなければ土日・祝日だけ） */
    C.loadDates = function() {
        return app.DB.loadCoachDates().then(function(x) {
            var set = function(list) { var m = {}; list.forEach(function(d) { m[d] = true; }); return m; };
            C._dates = { add: set(x.add), skip: set(x.skip) };
        }).catch(function(e) {
            console.warn('都合を聞く日を読み込めませんでした:', e);
            if (!C._dates) C._dates = { add: {}, skip: {} };
        });
    };

    C.answerOf = function(memberId, date) {
        var a = C._avail && C._avail[String(memberId)];
        var v = a && a.answers && a.answers[date];
        return (v && ANS[v.s]) ? v : null;
    };

    function availOf(memberId) {
        C._avail = C._avail || {};
        return C._avail[String(memberId)] || (C._avail[String(memberId)] = { name: '', answers: {} });
    }

    /** 都合を保存（s を省くと回答を取り消す） */
    C.setAnswer = async function(member, date, s, note) {
        var value = s ? { s: s, note: note || '' } : null;
        await app.DB.setCoachAvailability(member.id, member.name, date, value);
        var a = availOf(member.id);
        a.name = member.name;
        if (value) a.answers[date] = value;
        else delete a.answers[date];
    };

    /** 未回答の日をまとめて保存 */
    C.setAnswers = async function(member, dates, s) {
        var byDate = {};
        dates.forEach(function(d) { byDate[d] = { s: s, note: '' }; });
        await app.DB.setCoachAvailabilityMany(member.id, member.name, byDate);
        var a = availOf(member.id);
        a.name = member.name;
        dates.forEach(function(d) { a.answers[d] = { s: s, note: '' }; });
    };

    C.assignedIds = function(eventId) { return ((C._assign || {})[String(eventId)] || []).slice(); };
    C.assignedMembers = function(eventId) {
        var all = app.Hub.members || [];
        return C.assignedIds(eventId).map(function(id) {
            return all.filter(function(m) { return String(m.id) === id; })[0];
        }).filter(Boolean);
    };
    C.setAssigned = async function(eventId, member, on) {
        await app.DB.setCoachAssigned(eventId, member.id, on);
        C._assign = C._assign || {};
        var id = String(member.id);
        var ids = (C._assign[String(eventId)] || []).filter(function(x) { return x !== id; });
        if (on) ids.push(id);
        C._assign[String(eventId)] = ids;
    };

    /** その日の都合ごとの指導者 { ok:[{m,a}], am, pm, ng, none } */
    function groupsOn(date) {
        var g = { ok: [], am: [], pm: [], ng: [], none: [] };
        C.coaches().forEach(function(m) {
            var a = C.answerOf(m.id, date);
            g[a ? a.s : 'none'].push({ m: m, a: a });
        });
        return g;
    }

    // =============================================
    // 自分の都合（「参加予定」タブ）
    // =============================================

    /**
     * 「参加予定」タブの「指導の予定」
     *  - あなたの担当（これからの担当の予定）
     *  - 回答の進み具合と「未回答をまとめて『行ける』に」
     *  - 週末ごとのカード: 日ごとに 行ける／午前だけ／午後だけ／行けない（もう一度押すと取り消し）とメモ
     * @param {HTMLElement} container
     * @param {Object|null} member - 自分にあたる指導者のメンバー
     */
    C.renderMine = async function(container, member) {
        if (!container) return;
        if (!member) {
            container.innerHTML = '<section class="co-card co-my"><h3 class="co-title">🧢 指導の予定</h3>' +
                '<p class="co-hint">メンバーに監督・コーチとして登録されている名前と、ログインの名前が同じときに、土日・祝日などの都合を回答できます。名前が違う場合は管理者に連絡してください。</p></section>';
            return;
        }
        if (!container.querySelector('.co-my')) container.innerHTML = '<section class="co-card co-my"><p class="loading">読み込み中...</p></section>';
        await C.ensureLoaded();
        var weekends = C.weekends();
        var allDates = [].concat.apply([], weekends.map(function(w) { return w.dates; }));
        var answered = allDates.filter(function(d) { return C.answerOf(member.id, d); }).length;
        var unanswered = allDates.filter(function(d) { return !C.answerOf(member.id, d); });
        var me = String(member.id);

        // あなたの担当（今日以降・日付順）
        var today = iso(new Date());
        var mine = (app.Hub.events || []).filter(function(ev) {
            return ev.date >= today && C.assignedIds(ev.id).indexOf(me) !== -1;
        }).slice().sort(Utils().compareEvents);

        var html = '<section class="co-card co-my">' +
            '<h3 class="co-title">🧢 指導の予定</h3>';
        html += '<div class="co-duty">' +
            '<div class="co-sub-title">あなたの担当</div>' +
            (mine.length ? mine.map(function(ev) {
                return '<button type="button" class="co-duty-item" data-event="' + esc(ev.id) + '">' +
                    '<span class="co-duty-date' + dayCls(ev.date) + '">' + fmt(ev.date) + '</span>' +
                    '<span class="co-duty-body"><span class="co-duty-title">' + esc(ev.title) + '</span>' +
                    '<span class="co-duty-meta">' + esc([evTime(ev), ev.venue].filter(Boolean).join('・')) + '</span></span>' +
                    '<span class="co-duty-arrow">›</span></button>';
            }).join('') : '<p class="co-empty">まだ担当はありません。監督が都合を見て決めます。</p>') +
            '</div>';

        // 都合はマネージャー（監督・コーチ・役員・管理者）しか読み書きできない。ログインの役割が保護者のままの
        // 指導者には、押しても保存できないボタンを出さずに案内する（担当は見られる）
        if (!isManager()) {
            container.innerHTML = html + '<p class="co-hint co-role-hint">都合を回答するには、ログインの役割が「監督」か「コーチ」である必要があります。管理者に役割の変更を頼んでください。</p></section>';
            container.querySelectorAll('.co-duty-item').forEach(function(b) {
                b.addEventListener('click', function() { app.Hub.Calendar.showEventDetails(b.dataset.event); });
            });
            return;
        }

        html += '<div class="co-progress">' +
            '<div class="co-progress-head"><span class="co-sub-title">都合の回答</span>' +
            '<span class="co-progress-num">回答済み <b>' + answered + '</b> / ' + allDates.length + '日</span></div>' +
            '<div class="co-progress-bar"><span style="width:' + (allDates.length ? Math.round(answered * 100 / allDates.length) : 0) + '%"></span></div>' +
            (C._availFailed ? '<p class="co-error">回答を読み込めませんでした。通信環境を確認して開き直してください。</p>' : '') +
            (unanswered.length ? '<button type="button" class="co-bulk secondary-button">未回答の' + unanswered.length + '日をまとめて「行ける」にする</button>' : '') +
            '<p class="co-hint">行ける日・行けない日を押してください（もう一度押すと取り消し）。監督はこれを見て予定と担当を決めます。</p>' +
            '</div>';

        weekends.forEach(function(w, wi) {
            if (wi >= MINE_WEEKENDS && !C._showAllMine) return;
            var left = w.dates.filter(function(d) { return !C.answerOf(member.id, d); }).length;
            html += '<div class="co-week">' +
                '<div class="co-week-head"><span class="co-week-label">' + w.label + '</span>' +
                (left ? '<span class="co-tag co-tag-warn">未回答 ' + left + '日</span>' : '<span class="co-tag co-tag-ok">✓ 回答済み</span>') + '</div>';
            w.dates.forEach(function(date) {
                var evs = C.eventsOn(date);
                var a = C.answerOf(member.id, date);
                var myEvs = evs.filter(function(ev) { return C.assignedIds(ev.id).indexOf(me) !== -1; });
                var hol = holName(date);
                html += '<div class="co-day-row' + (a ? '' : ' is-unanswered') + '" data-date="' + date + '">' +
                    '<div class="co-day-top"><span class="co-dow' + dayCls(date) + '">' + dow(date) + '</span>' +
                    '<span class="co-day-date">' + md(date) + '</span>' +
                    '<span class="co-day-evs">' + (hol ? '<b class="co-hol">' + esc(hol) + '</b>' : '') +
                    (evs.length ? esc(evs.map(function(e) { return e.title; }).join('・')) : '予定なし') + '</span>' +
                    '<span class="co-state co-s-' + (a ? a.s : 'none') + '">' + (a ? ANS[a.s].text : '未回答') + '</span></div>' +
                    '<div class="co-answer" role="group" aria-label="' + fmt(date) + 'の都合">' +
                    ORDER.map(function(s) {
                        var on = a && a.s === s;
                        return '<button type="button" class="co-ans co-s-' + s + (on ? ' is-on' : '') + '" data-s="' + s + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
                            ansButtonInner(s) +
                            '</button>';
                    }).join('') + '</div>' +
                    (myEvs.length ? '<div class="co-mine">🧢 あなたの担当: ' + esc(myEvs.map(function(e) { return e.title; }).join('・')) + '</div>' : '') +
                    '<button type="button" class="co-memo' + (a && a.note ? ' has-note' : '') + '">' +
                    (a && a.note ? '📝 ' + esc(a.note) + ' <span class="co-memo-edit">変更</span>' : '＋ メモ（例: 10時から）') + '</button>' +
                    '</div>';
            });
            html += '</div>';
        });
        if (weekends.length > MINE_WEEKENDS) {
            html += '<button type="button" class="co-more secondary-button">' + (C._showAllMine ? '近い' + MINE_WEEKENDS + '週だけ表示' : 'さらに表示（' + weekends[weekends.length - 1].label + 'まで）') + '</button>';
        }
        html += '</section>';
        container.innerHTML = html;

        var rerender = function() { C.renderMine(container, member); };
        container.querySelectorAll('.co-duty-item').forEach(function(b) {
            b.addEventListener('click', function() { app.Hub.Calendar.showEventDetails(b.dataset.event); });
        });
        var bulk = container.querySelector('.co-bulk');
        if (bulk) bulk.addEventListener('click', async function() {
            if (!UI().showConfirm('未回答の' + unanswered.length + '日をすべて「行ける」にしますか？\n（行けない日は、あとから1日ずつ変えられます）')) return;
            bulk.disabled = true;
            try {
                await C.setAnswers(member, unanswered, 'ok');
            } catch (e) {
                bulk.disabled = false;
                UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                return;
            }
            rerender();
        });
        var more = container.querySelector('.co-more');
        if (more) more.addEventListener('click', function() { C._showAllMine = !C._showAllMine; rerender(); });
        container.querySelectorAll('.co-day-row').forEach(function(row) {
            var date = row.dataset.date;
            row.querySelectorAll('.co-ans').forEach(function(btn) {
                btn.addEventListener('click', async function() {
                    var cur = C.answerOf(member.id, date);
                    var s = (cur && cur.s === btn.dataset.s) ? null : btn.dataset.s;
                    row.querySelectorAll('.co-ans').forEach(function(b) { b.disabled = true; });
                    try {
                        await C.setAnswer(member, date, s, cur ? cur.note : '');
                    } catch (e) {
                        row.querySelectorAll('.co-ans').forEach(function(b) { b.disabled = false; });
                        UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                        return;
                    }
                    rerender();
                });
            });
            row.querySelector('.co-memo').addEventListener('click', async function() {
                var cur = C.answerOf(member.id, date);
                var note = UI().showPrompt(fmt(date) + ' のメモ（例: 10時から・午後は別会場なら可）', cur ? cur.note : '');
                if (note === null) return;
                try {
                    // メモは都合の補足。まだ回答していない日にメモだけ書いたときは「行ける」として保存する
                    await C.setAnswer(member, date, cur ? cur.s : 'ok', String(note).trim());
                } catch (e) {
                    UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                    return;
                }
                rerender();
            });
        });
    };

    // =============================================
    // 監督の画面（管理タブ「🧢 指導者の予定・担当」）
    // =============================================

    function ensureModal(id, z, titleHtml) {
        var modal = document.getElementById(id);
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal co-modal';
        modal.style.zIndex = String(z);
        modal.innerHTML = '<div class="modal-content"><span class="close" aria-label="閉じる">&times;</span>' + titleHtml + '<div class="co-modal-body"></div></div>';
        document.body.appendChild(modal);
        var close = function() {
            modal.style.display = 'none';
            if (modal._onClose) { var cb = modal._onClose; modal._onClose = null; cb(); }
        };
        modal._close = close;
        modal.querySelector('.close').addEventListener('click', close);
        modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
        return modal;
    }

    /** 週末の状態: 担当のいない予定の数・まだ回答していない指導者の数（「聞かない」にした日は数えない） */
    function weekStatus(w) {
        var r = autoRange();
        var dates = w.dates.filter(function(d) { return !C.isSkipped(d, r); });
        if (dates.length === 0) return { off: true, noCoach: 0, notAnswered: 0 };
        var noCoach = 0;
        dates.forEach(function(d) {
            C.eventsOn(d).forEach(function(ev) { if (C.assignedIds(ev.id).length === 0) noCoach++; });
        });
        var notAnswered = C.coaches().filter(function(m) {
            return dates.some(function(d) { return !C.answerOf(m.id, d); });
        }).length;
        return { noCoach: noCoach, notAnswered: notAnswered };
    }

    C.openPlanner = async function(weekKey) {
        if (!isManager()) return;
        var modal = ensureModal('coach-planner-modal', 1020, '<h2 class="co-modal-title">🧢 指導者の予定・担当</h2><div class="co-weeks" role="tablist"></div>');
        if (weekKey) C._weekKey = weekKey;
        modal.querySelector('.co-modal-body').innerHTML = '<p class="loading">読み込み中...</p>';
        UI().openModal('coach-planner-modal');
        await C.load();
        C.renderPlanner();
    };

    C.renderPlanner = function() {
        var modal = document.getElementById('coach-planner-modal');
        if (!modal || modal.style.display === 'none') return;
        var body = modal.querySelector('.co-modal-body');
        var tabs = modal.querySelector('.co-weeks');
        var coaches = C.coaches();
        if (coaches.length === 0) {
            tabs.innerHTML = '';
            body.innerHTML = '<p class="co-hint">メンバーに監督・コーチが登録されていません。メンバータブで役割を「監督」「コーチ」にしてください。</p>';
            return;
        }
        var weekends = C.weekends(true);
        var r = autoRange();
        // 開く週末: 前に開いていた週末、なければいちばん近い週末
        var cur = weekends.filter(function(w) { return w.key === C._weekKey; })[0] || weekends[0];
        C._weekKey = cur ? cur.key : null;

        // 週末の切り替え（担当のいない予定があれば ⚠、まだ回答していない人がいれば「未回答」）
        tabs.innerHTML = weekends.map(function(w) {
            var st = weekStatus(w);
            var badge = st.off ? '<span class="co-wk-badge co-wk-off">聞かない</span>'
                : st.noCoach ? '<span class="co-wk-badge co-wk-warn">⚠ 担当なし' + st.noCoach + '</span>'
                : st.notAnswered ? '<span class="co-wk-badge co-wk-wait">未回答' + st.notAnswered + '人</span>'
                : '<span class="co-wk-badge co-wk-ok">✓</span>';
            return '<button type="button" class="co-wk' + (w.key === cur.key ? ' is-on' : '') + '" data-week="' + w.key + '" role="tab" aria-selected="' + (w.key === cur.key) + '">' +
                '<span class="co-wk-date">' + w.short + '</span>' + badge + '</button>';
        }).join('');

        var html = C._availFailed ? '<p class="co-error">都合を読み込めませんでした。通信環境を確認して開き直してください。</p>' : '';
        html += '<div class="co-plan-tools"><button type="button" class="secondary-button co-add-dates">＋ 都合を聞く日を追加（お盆・年末年始など）</button></div>';
        html += '<p class="co-hint">行ける人を押すと、その予定の担当になります。名前の一覧の人を押すと、本人の代わりに都合を入れられます。</p>';
        (cur ? cur.dates : []).forEach(function(date) {
            var hol = holName(date);
            var head = '<span class="co-dow' + dayCls(date) + '">' + dow(date) + '</span>' + md(date) +
                (hol ? '<span class="co-hol">' + esc(hol) + '</span>' : '');
            if (C.isSkipped(date, r)) {
                html += '<section class="co-pday is-skipped" data-date="' + date + '"><h3 class="co-pday-head">' + head +
                    '<span class="co-skip-tag">聞かない日</span>' +
                    '<button type="button" class="co-unskip">聞く日に戻す</button></h3></section>';
                return;
            }
            var g = groupsOn(date);
            var people = function(list, s) {
                return list.map(function(x) {
                    return '<button type="button" class="co-person co-s-' + s + '" data-member="' + esc(x.m.id) + '" title="' + esc(x.m.name + (x.a && x.a.note ? '（' + x.a.note + '）' : '')) + '">' +
                        esc(shortName(x.m)) + (s === 'am' || s === 'pm' ? '<small>' + ANS[s].mark + '</small>' : '') +
                        (x.a && x.a.note ? '<small class="co-person-note">📝' + esc(x.a.note) + '</small>' : '') + '</button>';
                }).join('');
            };
            var canCome = g.ok.concat(g.am, g.pm);
            var line = function(label, cls, list) {
                return '<div class="co-line ' + cls + '"><span class="co-line-label">' + label + '</span><div class="co-line-people">' +
                    (list.length ? list : '<span class="co-none">なし</span>') + '</div></div>';
            };
            var evs = C.eventsOn(date);
            html += '<section class="co-pday" data-date="' + date + '">' +
                '<h3 class="co-pday-head">' + head +
                // 予定のある日は必ず聞くので、外せるのは予定のない日だけ
                (evs.length ? '' : '<button type="button" class="co-skip">この日は聞かない</button>') + '</h3>' +
                '<div class="co-avail">' +
                line('行ける', 'co-line-ok', people(g.ok, 'ok') + people(g.am, 'am') + people(g.pm, 'pm')) +
                line('行けない', 'co-line-ng', people(g.ng, 'ng')) +
                (g.none.length ? line('未回答', 'co-line-none', people(g.none, 'none')) : '') +
                '</div>';
            if (evs.length === 0) html += '<p class="co-noev">この日の予定はまだありません</p>';
            evs.forEach(function(ev) {
                var assigned = C.assignedMembers(ev.id);
                var ids = assigned.map(function(m) { return String(m.id); });
                var others = evs.filter(function(e) { return String(e.id) !== String(ev.id); });
                var busy = function(m) { return others.filter(function(e) { return C.assignedIds(e.id).indexOf(String(m.id)) !== -1; }); };
                var meta = [Utils().getEventTypeLabel(ev.type)];
                if (Array.isArray(ev.target) && ev.target.length) meta.push(ev.target.map(Utils().getGradeLabel).join('・'));
                if (evTime(ev)) meta.push(evTime(ev));
                var cands = canCome.filter(function(x) { return ids.indexOf(String(x.m.id)) === -1; });
                html += '<div class="co-pev' + (assigned.length ? '' : ' is-empty') + '" data-event="' + esc(ev.id) + '">' +
                    '<div class="co-pev-head"><span class="co-pev-title">' + esc(ev.title) + '</span><span class="co-pev-meta">' + esc(meta.join('・')) + '</span></div>' +
                    '<div class="co-pev-row"><span class="co-pev-label">担当</span><div class="co-pev-chips">' +
                    (assigned.length ? assigned.map(function(m) {
                        return '<button type="button" class="co-assigned" data-member="' + esc(m.id) + '" aria-label="' + esc(m.name) + 'を担当から外す">' +
                            esc(shortName(m)) + '<span class="co-x">✕</span></button>';
                    }).join('') : '<span class="co-unset">⚠ まだいません</span>') + '</div></div>' +
                    '<div class="co-pev-row"><span class="co-pev-label">追加</span><div class="co-pev-chips">' +
                    cands.map(function(x) {
                        var b = busy(x.m);
                        return '<button type="button" class="co-cand co-s-' + x.a.s + '" data-member="' + esc(x.m.id) + '">＋ ' + esc(shortName(x.m)) +
                            (x.a.s !== 'ok' ? '<small>' + ANS[x.a.s].mark + '</small>' : '') +
                            (b.length ? '<small class="co-busy">' + esc(b.map(function(e) { return e.title; }).join('・')) + 'も担当</small>' : '') + '</button>';
                    }).join('') +
                    '<button type="button" class="co-more-pick">ほかの人から選ぶ</button>' +
                    '</div></div></div>';
            });
            html += '<button type="button" class="co-add-ev">＋ この日に予定を追加</button></section>';
        });
        html += '<div class="co-footer"><button type="button" class="secondary-button co-copy-request">📋 未回答の人へのお願いをコピー（LINE用）</button></div>';
        body.innerHTML = html;

        var rerender = function() { C.renderPlanner(); };
        tabs.querySelectorAll('.co-wk').forEach(function(b) {
            b.addEventListener('click', function() {
                C._weekKey = b.dataset.week;
                rerender();
                modal.querySelector('.modal-content').scrollTop = 0;
            });
        });
        var memberById = function(id) { return coaches.filter(function(m) { return String(m.id) === id; })[0]; };
        var setAsked = async function(btn, date, on) {
            btn.disabled = true;
            try {
                await C.setAsked([date], on);
            } catch (e) {
                btn.disabled = false;
                UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                return;
            }
            C.markCalendar();
            rerender();
        };
        body.querySelector('.co-add-dates').addEventListener('click', function() { C.openAddDates(rerender); });
        body.querySelectorAll('.co-pday').forEach(function(day) {
            var date = day.dataset.date;
            var unskip = day.querySelector('.co-unskip');
            if (unskip) {
                unskip.addEventListener('click', function() { setAsked(unskip, date, true); });
                return;
            }
            var skip = day.querySelector('.co-skip');
            if (skip) skip.addEventListener('click', function() {
                if (!UI().showConfirm(fmt(date) + ' は指導者に都合を聞かない日にしますか？\n（活動がない日など。回答済みの都合は残ります）')) return;
                setAsked(skip, date, false);
            });
            day.querySelectorAll('.co-person').forEach(function(p) {
                p.addEventListener('click', function() {
                    var m = memberById(p.dataset.member);
                    if (m) C.openAnswerSheet(m, date, rerender);
                });
            });
            day.querySelectorAll('.co-pev').forEach(function(row) {
                var ev = (app.Hub.events || []).filter(function(e) { return String(e.id) === row.dataset.event; })[0];
                if (!ev) return;
                var toggle = async function(btn, m, on) {
                    btn.disabled = true;
                    try {
                        await C.setAssigned(ev.id, m, on);
                    } catch (e) {
                        btn.disabled = false;
                        UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                        return;
                    }
                    rerender();
                };
                row.querySelectorAll('.co-cand').forEach(function(b) {
                    b.addEventListener('click', function() { var m = memberById(b.dataset.member); if (m) toggle(b, m, true); });
                });
                row.querySelectorAll('.co-assigned').forEach(function(b) {
                    b.addEventListener('click', function() { var m = memberById(b.dataset.member); if (m) toggle(b, m, false); });
                });
                row.querySelector('.co-more-pick').addEventListener('click', function() { C.openAssign(ev, rerender); });
            });
            day.querySelector('.co-add-ev').addEventListener('click', function() {
                var modal = document.getElementById('coach-planner-modal');
                if (modal) modal.style.display = 'none';
                app.Hub.Calendar.openAddEventModal(dateOf(date));
            });
        });
        body.querySelector('.co-copy-request').addEventListener('click', function() { C.copyRequest(); });
    };

    /** 本人の代わりに都合を入れる（監督の画面で名前をタップ） */
    C.openAnswerSheet = function(member, date, onClose) {
        var modal = ensureModal('coach-answer-modal', 1035, '<h2 class="co-modal-title co-answer-title"></h2><p class="co-hint">本人の代わりに都合を入れます</p>');
        modal.querySelector('.co-answer-title').textContent = member.name + ' ' + fmt(date);
        var cur = C.answerOf(member.id, date);
        var body = modal.querySelector('.co-modal-body');
        body.innerHTML = '<div class="co-answer co-answer-lg">' + ORDER.map(function(s) {
                return '<button type="button" class="co-ans co-s-' + s + (cur && cur.s === s ? ' is-on' : '') + '" data-s="' + s + '">' +
                    ansButtonInner(s) +
                    '</button>';
            }).join('') + '</div>' +
            '<label class="co-label" for="co-answer-note">メモ</label>' +
            '<input type="text" id="co-answer-note" maxlength="60" placeholder="例: 10時から・午後は別会場なら可" value="' + esc(cur ? cur.note : '') + '">' +
            '<div class="co-sheet-actions"><button type="button" class="secondary-button co-answer-clear">未回答に戻す</button></div>';
        modal._onClose = onClose || null;
        var save = async function(s) {
            var note = (body.querySelector('#co-answer-note').value || '').trim();
            try {
                await C.setAnswer(member, date, s, note);
            } catch (e) {
                UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                return;
            }
            modal._close();
        };
        body.querySelectorAll('.co-ans').forEach(function(b) { b.addEventListener('click', function() { save(b.dataset.s); }); });
        body.querySelector('.co-answer-clear').addEventListener('click', function() { save(null); });
        UI().openModal('coach-answer-modal');
    };

    /**
     * 都合を聞く日を期間で追加する（お盆・年末年始など、土日・祝日のほかに活動する日）
     * @param {Function} [onDone] - 追加したあとに呼ぶ
     */
    C.openAddDates = function(onDone) {
        if (!isManager()) return;
        var modal = ensureModal('coach-dates-modal', 1030, '<h2 class="co-modal-title">都合を聞く日を追加</h2>' +
            '<p class="co-hint">お盆・年末年始など、土日・祝日のほかに活動する日を追加します（土日・祝日は自動で聞きます）。追加した日はコーチの「指導の予定」に出ます。</p>');
        var today = iso(new Date());
        var body = modal.querySelector('.co-modal-body');
        body.innerHTML = '<label class="co-label" for="co-dates-from">はじめの日</label>' +
            '<input type="date" id="co-dates-from" min="' + today + '">' +
            '<label class="co-label" for="co-dates-to">おわりの日（1日だけなら空のまま）</label>' +
            '<input type="date" id="co-dates-to" min="' + today + '">' +
            '<p class="co-dates-preview" aria-live="polite"></p>' +
            '<div class="co-sheet-actions"><button type="button" class="primary-button co-dates-save" disabled>追加する</button></div>';
        modal._onClose = null;
        var from = body.querySelector('#co-dates-from');
        var to = body.querySelector('#co-dates-to');
        var preview = body.querySelector('.co-dates-preview');
        var save = body.querySelector('.co-dates-save');
        var picked = [];
        var fresh = [];
        var update = function() {
            picked = [];
            fresh = [];
            var a = from.value, b = to.value || from.value;
            to.min = a || today;
            var msg = '';
            if (!a) msg = '';
            else if (a < today) msg = '今日より前の日は追加できません';
            else if (b < a) msg = 'おわりの日は、はじめの日と同じか後の日にしてください';
            else {
                for (var d = dateOf(a); iso(d) <= b; d.setDate(d.getDate() + 1)) picked.push(iso(d));
                if (picked.length > 31) { msg = '一度に追加できるのは31日までです'; picked = []; }
            }
            if (picked.length) {
                var asked = {};
                C.planDates().forEach(function(x) { asked[x] = true; });
                fresh = picked.filter(function(x) { return !asked[x]; });
                msg = fresh.length
                    ? '新しく聞く日: ' + fresh.slice(0, 10).map(fmt).join('・') + (fresh.length > 10 ? ' ほか' + (fresh.length - 10) + '日' : '')
                    : 'この期間は、もう全部が聞く日になっています';
            }
            preview.textContent = msg;
            preview.classList.toggle('is-error', !!msg && !fresh.length);
            save.disabled = fresh.length === 0;
        };
        from.addEventListener('input', update);
        from.addEventListener('change', update);
        to.addEventListener('input', update);
        to.addEventListener('change', update);
        save.addEventListener('click', async function() {
            if (!fresh.length) return;
            save.disabled = true;
            try {
                await C.setAsked(picked, true);
            } catch (e) {
                save.disabled = false;
                UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                return;
            }
            C._weekKey = weekKeyOf(fresh[0]);
            modal._close();
            UI().showAlert(fresh.length + '日を都合を聞く日にしました', 'success');
            C.markCalendar();
            if (onDone) onDone();
        });
        UI().openModal('coach-dates-modal');
    };

    /**
     * 予定に付く指導者を選ぶ（予定の詳細の「担当」・監督の画面の「ほかの人から選ぶ」）
     * 行ける人・未回答・行けない人に分けて出す。同じ日の他の予定の担当なら「〇〇も担当」
     */
    C.openAssign = async function(ev, onClose) {
        if (!isManager()) return;
        var modal = ensureModal('coach-assign-modal', 1030, '<h2 class="co-modal-title co-assign-title"></h2><p class="co-hint">押すと担当になります（もう一度押すと外れます）。すぐ保存されます。</p>');
        modal.querySelector('.co-assign-title').textContent = fmt(ev.date) + ' ' + (ev.title || '') + ' の担当';
        modal._onClose = onClose || null;
        var body = modal.querySelector('.co-modal-body');
        body.innerHTML = '<p class="loading">読み込み中...</p>';
        UI().openModal('coach-assign-modal');
        await C.ensureLoaded();
        var others = C.eventsOn(ev.date).filter(function(e) { return String(e.id) !== String(ev.id); });
        var render = function() {
            var ids = C.assignedIds(ev.id);
            var g = groupsOn(ev.date);
            var section = function(title, list) {
                if (!list.length) return '';
                return '<div class="co-pick-group"><div class="co-sub-title">' + title + '</div>' + list.map(function(x) {
                    var on = ids.indexOf(String(x.m.id)) !== -1;
                    var elsewhere = others.filter(function(e) { return C.assignedIds(e.id).indexOf(String(x.m.id)) !== -1; });
                    return '<button type="button" class="co-pick' + (on ? ' is-on' : '') + '" data-member="' + esc(x.m.id) + '" aria-pressed="' + on + '">' +
                        '<span class="co-pick-check">' + (on ? '✓' : '') + '</span>' +
                        '<span class="co-pick-name">' + esc(x.m.name) +
                        '<span class="co-pick-sub">' + (x.m.role === 'coach' ? '監督' : 'コーチ') +
                        (x.a ? '・' + ANS[x.a.s].text : '') + (x.a && x.a.note ? '・' + esc(x.a.note) : '') + '</span>' +
                        (elsewhere.length ? '<span class="co-pick-warn">「' + esc(elsewhere.map(function(e) { return e.title; }).join('」「')) + '」も担当</span>' : '') +
                        '</span></button>';
                }).join('') + '</div>';
            };
            var html = section('行ける人', g.ok.concat(g.am, g.pm)) + section('未回答', g.none) + section('行けない人', g.ng);
            body.innerHTML = html || '<p class="co-hint">メンバーに監督・コーチが登録されていません</p>';
            body.querySelectorAll('.co-pick').forEach(function(btn) {
                btn.addEventListener('click', async function() {
                    var m = C.coaches().filter(function(x) { return String(x.id) === btn.dataset.member; })[0];
                    if (!m) return;
                    var on = C.assignedIds(ev.id).indexOf(String(m.id)) === -1;
                    btn.disabled = true;
                    try {
                        await C.setAssigned(ev.id, m, on);
                    } catch (e) {
                        btn.disabled = false;
                        UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                        return;
                    }
                    render();
                });
            });
        };
        render();
    };

    /** 回答していない監督・コーチへのお願い（LINE に貼る文面）をコピー */
    C.copyRequest = function() {
        var dates = C.planDates();
        var lines = [];
        C.coaches().forEach(function(m) {
            var missing = dates.filter(function(d) { return !C.answerOf(m.id, d); });
            if (missing.length) lines.push('・' + m.name + 'さん（' + missing.slice(0, 6).map(fmt).join('、') + (missing.length > 6 ? ' ほか' + (missing.length - 6) + '日' : '') + '）');
        });
        if (lines.length === 0) {
            UI().showAlert('全員が回答済みです', 'info');
            return;
        }
        var url = location.origin + '/hub/index.html';
        var text = '【指導者の都合のお願い】\nアプリの「参加予定」タブの「指導の予定」で、各日の都合（行ける・午前だけ・午後だけ・行けない）を押してください。\n' +
            lines.join('\n') + '\n' + url;
        if (Utils().copyToClipboard(text)) UI().showAlert('回答のお願いの文面をコピーしました。LINEに貼り付けてください', 'success', 5000);
        else UI().showAlert('コピーできませんでした', 'error');
    };

    // =============================================
    // 予定の詳細・予定の追加フォーム
    // =============================================

    /** 予定の詳細の「🧢 指導」の値（担当がなければマネージャーには「未定」、それ以外には出さない） */
    C.detailValue = function(ev) {
        var names = C.assignedMembers(ev.id).map(function(m) { return m.name; });
        if (names.length) return esc(names.join('・'));
        return isManager() ? '<span class="co-muted">未定</span>' : '';
    };

    /** 予定の追加・編集フォーム: 選んだ日の指導者の都合（マネージャーのみ） */
    C.renderFormHint = async function(el, date) {
        if (!el) return;
        if (!isManager() || !date || C.coaches().length === 0) { el.innerHTML = ''; el.style.display = 'none'; return; }
        el.style.display = '';
        el.dataset.date = date;
        if (C._avail === null || C._dates === null) {
            el.innerHTML = '<span class="co-muted">指導者の都合を読み込み中...</span>';
            await C.load();
            if (el.dataset.date !== date) return;
        }
        // まだ聞いていない日（土日・祝日以外など）: 予定を登録すれば聞く日になる。8週間より先なら今すぐ聞ける
        if (date >= iso(new Date()) && !C.isAsked(date)) {
            var r = autoRange();
            var later = date >= r.to;
            el.innerHTML = '<div class="co-hint-label">🧢 この日の指導者</div>' +
                '<div class="co-hint-line co-muted">' + (later ? 'まだ指導者に都合を聞いていない日です' : '予定（ナイター練習以外）を登録すると、この日も指導者に都合を聞きます') + '</div>' +
                (later ? '<button type="button" class="co-hint-ask">この日も都合を聞く</button>' : '');
            var ask = el.querySelector('.co-hint-ask');
            if (ask) ask.addEventListener('click', async function() {
                ask.disabled = true;
                try {
                    await C.setAsked([date], true);
                } catch (e) {
                    ask.disabled = false;
                    UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                    return;
                }
                C.markCalendar();
                C.renderFormHint(el, date);
            });
            return;
        }
        var g = groupsOn(date);
        var names = function(list) { return list.map(function(x) { return esc(shortName(x.m)) + (x.a && x.a.s !== 'ok' ? '（' + ANS[x.a.s].mark + '）' : ''); }).join('・'); };
        var canCome = g.ok.concat(g.am, g.pm);
        el.innerHTML = '<div class="co-hint-label">🧢 この日の指導者</div>' +
            '<div class="co-hint-line"><span class="co-badge co-s-ok">行ける</span>' + (canCome.length ? names(canCome) : '<span class="co-muted">なし</span>') + '</div>' +
            (g.ng.length ? '<div class="co-hint-line"><span class="co-badge co-s-ng">行けない</span>' + names(g.ng) + '</div>' : '') +
            (g.none.length ? '<div class="co-hint-line"><span class="co-badge co-s-none">未回答</span>' + g.none.length + '人</div>' : '');
    };

    // =============================================
    // カレンダー
    // =============================================

    /**
     * 「その日の予定」の下: 指導者に都合を聞く日かどうかと、聞く日にする・外すボタン（マネージャーのみ・今日以降）
     * @param {HTMLElement} el
     * @param {string} date - YYYY-MM-DD
     */
    C.renderDayAsk = async function(el, date) {
        if (!el) return;
        date = String(date);
        if (!isManager() || C.coaches().length === 0 || date < iso(new Date())) { el.innerHTML = ''; el.style.display = 'none'; return; }
        el.style.display = '';
        el.dataset.date = date;
        if (C._dates === null || C._avail === null) {
            el.innerHTML = '<span class="co-muted">読み込み中...</span>';
            await C.ensureLoaded();
            if (el.dataset.date !== date) return;
        }
        var html;
        if (C.isSkipped(date)) {
            html = '<div class="co-dayask-text">🧢 指導者に都合を<b>聞かない日</b>にしています</div>' +
                '<div class="co-dayask-actions"><button type="button" class="secondary-button co-dayask-on">聞く日に戻す</button></div>';
        } else if (C.isAsked(date)) {
            var g = groupsOn(date);
            var total = C.coaches().length;
            html = '<div class="co-dayask-text">🧢 指導者に都合を聞く日です（回答 ' + (total - g.none.length) + ' / ' + total + '人）</div>' +
                '<div class="co-dayask-actions"><button type="button" class="secondary-button co-dayask-open">都合・担当を見る</button>' +
                (C.eventsOn(date).length ? '' : '<button type="button" class="secondary-button co-dayask-off">この日は聞かない</button>') + '</div>';
        } else {
            html = '<div class="co-dayask-text">🧢 指導者にはまだ都合を聞いていない日です</div>' +
                '<div class="co-dayask-actions"><button type="button" class="secondary-button co-dayask-on">この日も指導者に都合を聞く</button></div>';
        }
        el.innerHTML = html;
        var change = async function(btn, on) {
            btn.disabled = true;
            try {
                await C.setAsked([date], on);
            } catch (e) {
                btn.disabled = false;
                UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                return;
            }
            C.markCalendar();
            C.renderDayAsk(el, date);
        };
        var on = el.querySelector('.co-dayask-on');
        if (on) on.addEventListener('click', function() { change(on, true); });
        var off = el.querySelector('.co-dayask-off');
        if (off) off.addEventListener('click', function() { change(off, false); });
        var open = el.querySelector('.co-dayask-open');
        if (open) open.addEventListener('click', function() {
            UI().closeModal('day-events-modal');
            C.openPlanner(weekKeyOf(date));
        });
    };

    /**
     * カレンダーの日付に、土日・祝日のほかに都合を聞く日として追加した日の印（🧢）を付ける（マネージャーのみ）
     */
    C.markCalendar = function() {
        if (!isManager()) return;
        if (C._dates === null) {
            if (!C._datesLoading) {
                C._datesLoading = true;
                C.loadDates().then(function() { C._datesLoading = false; C.markCalendar(); });
            }
            return;
        }
        var today = iso(new Date());
        var add = datesOf('add');
        document.querySelectorAll('#calendar-grid .calendar-day').forEach(function(day) {
            var dateEl = day.querySelector('.date');
            if (!dateEl) return;
            var old = dateEl.querySelector('.cal-coach-mark');
            var on = !!add[day.dataset.date] && day.dataset.date >= today;
            if (on && !old) {
                var mark = document.createElement('span');
                mark.className = 'cal-coach-mark';
                mark.title = '指導者に都合を聞く日';
                mark.textContent = '🧢';
                dateEl.insertBefore(mark, dateEl.firstChild);
            } else if (!on && old) {
                old.remove();
            }
        });
    };

})(window.FCOjima);
