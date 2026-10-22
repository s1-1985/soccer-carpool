/**
 * FC尾島ジュニア - 指導者（監督・コーチ）の都合と担当
 *
 * 流れ:
 *  1. 監督・コーチは「参加予定」タブの「指導の予定」で、月のカレンダーの聞かれている日をタップして都合を回答しておく
 *     （タップするたびに ○ 行ける → △ 一部だけ → × 行けない → 未回答。△は午前だけ・午後だけ・時間による、メモも書ける）。
 *     予定がまだなくても回答できる。いちばん上に自分が担当する予定が出る
 *  2. 監督などマネージャーは管理タブ「🧢 指導者の予定・担当」で、同じ月のカレンダーに ○△× の人数と担当の ✓／⚠ を見る。
 *     日をタップすると下にその日の「行ける／一部／行けない／未回答」の人と予定。予定の下に出る行ける人を押すと担当になる
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
    var DOW = ['日', '月', '火', '水', '木', '金', '土'];
    // 都合: sym（カレンダーの記号）／mark（短い印）／label（ボタンの文字）／text（説明）
    // △（一部だけ）は 午前だけ（am）・午後だけ（pm）・時間による（part）の3つ
    var ANS = {
        ok:   { sym: '○', mark: '○', label: '行ける', text: '○ 行ける' },
        am:   { sym: '△', mark: '午前', label: '午前だけ', text: '△ 午前だけ' },
        pm:   { sym: '△', mark: '午後', label: '午後だけ', text: '△ 午後だけ' },
        part: { sym: '△', mark: '△', label: '時間による', text: '△ 時間による' },
        ng:   { sym: '×', mark: '×', label: '行けない', text: '× 行けない' }
    };
    function isPartial(s) { return s === 'am' || s === 'pm' || s === 'part'; }
    /** 名前の横などに添える短い印（○・△午前・△午後・△・×） */
    function shortAns(s) { return s === 'am' ? '△午前' : s === 'pm' ? '△午後' : ANS[s] ? ANS[s].sym : ''; }
    /** カレンダーをタップしたときの次の都合: 未回答 → ○ → △ → × → 未回答 */
    function nextAnswer(s) { return !s ? 'ok' : s === 'ok' ? 'part' : isPartial(s) ? 'ng' : null; }

    C._avail = null;   // { メンバーID: { name, answers: { 日付: { s, note } } } }
    C._assign = null;  // { 予定ID: [メンバーID] }
    C._dates = null;   // 都合を聞く日の追加・外した日 { add: { 日付: true }, skip: { 日付: true } }

    function UI() { return app.UI; }
    function Utils() { return app.Utils; }
    function esc(s) { return app.UI.escapeHTML(String(s == null ? '' : s)); }
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function dateOf(s) { return new Date(s + 'T00:00:00'); }
    function fmt(date) { var d = dateOf(date); return (d.getMonth() + 1) + '/' + d.getDate() + '(' + DOW[d.getDay()] + ')'; }
    function holName(date) { return (app.Holidays && app.Holidays.nameOf) ? app.Holidays.nameOf(date) : ''; }
    function dayCls(date) { var w = dateOf(date).getDay(); return (w === 0 || holName(date)) ? ' co-sun' : w === 6 ? ' co-sat' : ''; }
    function isManager() { return !!(app.Auth && app.Auth.isManager && app.Auth.isManager()); }
    function shortName(m) { return (m && m.abbr) ? m.abbr : (m ? m.name : ''); }
    function evTime(ev) { return ev.startTime ? ev.startTime + '〜' : (ev.departureTime ? ev.departureTime + '出発' : ''); }
    C.ANSWERS = ANS;

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

    /** その日の都合ごとの指導者 { ok:[{m,a}], am, pm, part, ng, none } */
    function groupsOn(date) {
        var g = { ok: [], am: [], pm: [], part: [], ng: [], none: [] };
        C.coaches().forEach(function(m) {
            var a = C.answerOf(m.id, date);
            g[a ? a.s : 'none'].push({ m: m, a: a });
        });
        return g;
    }

    // =============================================
    // 月のカレンダー（コーチの回答・監督の画面で共通。アプリのカレンダーと同じ月曜始まり）
    // =============================================

    var MONTH_DOWS = ['月', '火', '水', '木', '金', '土', '日'];

    function ymOf(date) { return String(date).slice(0, 7); }
    function ymLabel(ym) { return ym.slice(0, 4) + '年' + parseInt(ym.slice(5, 7), 10) + '月'; }
    /** 日付の一覧にある月（'YYYY-MM'、古い順） */
    function monthsOf(dates) {
        var list = [];
        dates.forEach(function(d) { var ym = ymOf(d); if (list.indexOf(ym) === -1) list.push(ym); });
        return list.sort();
    }

    /**
     * 月のカレンダー
     * @param {string} ym - 'YYYY-MM'
     * @param {Function} cell - 日付 'YYYY-MM-DD' → マスのHTML
     */
    function monthGrid(ym, cell) {
        var y = parseInt(ym.slice(0, 4), 10), mo = parseInt(ym.slice(5, 7), 10) - 1;
        var lead = (new Date(y, mo, 1).getDay() + 6) % 7;
        var days = new Date(y, mo + 1, 0).getDate();
        var html = '<div class="co-cal-dows" aria-hidden="true">' + MONTH_DOWS.map(function(d, i) {
            return '<span class="' + (i === 5 ? 'co-sat' : i === 6 ? 'co-sun' : '') + '">' + d + '</span>';
        }).join('') + '</div><div class="co-cal-grid">';
        for (var i = 0; i < lead; i++) html += '<span class="co-cal-pad"></span>';
        for (var d = 1; d <= days; d++) html += cell(iso(new Date(y, mo, d)));
        return html + '</div>';
    }

    /** 月の切り替え（‹ 2026年11月 ›） */
    function monthNav(ym, months, extra) {
        var i = months.indexOf(ym);
        return '<div class="co-cal-nav">' +
            '<button type="button" class="co-cal-prev" aria-label="前の月"' + (i <= 0 ? ' disabled' : '') + '>‹</button>' +
            '<div class="co-cal-month"><span class="co-cal-ym">' + ymLabel(ym) + '</span>' + (extra || '') + '</div>' +
            '<button type="button" class="co-cal-next" aria-label="次の月"' + (i < 0 || i >= months.length - 1 ? ' disabled' : '') + '>›</button></div>';
    }
    function bindMonthNav(root, ym, months, go) {
        var i = months.indexOf(ym);
        var prev = root.querySelector('.co-cal-prev'), next = root.querySelector('.co-cal-next');
        if (prev) prev.addEventListener('click', function() { if (i > 0) go(months[i - 1]); });
        if (next) next.addEventListener('click', function() { if (i >= 0 && i < months.length - 1) go(months[i + 1]); });
    }

    /** ○ △ × の大きいボタンと、△のときの「午前だけ・午後だけ・時間による」 */
    function answerControls(cur) {
        var s = cur ? cur.s : '';
        var partial = isPartial(s);
        var big = [
            { s: 'ok', mark: '○', label: '行ける', on: s === 'ok' },
            { s: 'part', mark: '△', label: partial ? ANS[s].label : '一部だけ', on: partial },
            { s: 'ng', mark: '×', label: '行けない', on: s === 'ng' }
        ];
        return '<div class="co-answer3" role="group" aria-label="都合">' + big.map(function(b) {
                return '<button type="button" class="co-ans co-s-' + b.s + (b.on ? ' is-on' : '') + '" data-s="' + b.s + '" aria-pressed="' + b.on + '">' +
                    '<span class="co-ans-mark">' + b.mark + '</span><span class="co-ans-label">' + esc(b.label) + '</span></button>';
            }).join('') + '</div>' +
            (partial ? '<div class="co-part" role="group" aria-label="△のとき">' + ['am', 'pm', 'part'].map(function(p) {
                return '<button type="button" class="co-part-btn' + (s === p ? ' is-on' : '') + '" data-s="' + p + '" aria-pressed="' + (s === p) + '">' + ANS[p].label + '</button>';
            }).join('') + '</div>' : '');
    }

    // =============================================
    // 自分の都合（「参加予定」タブ）: 月のカレンダーをタップするたびに ○ → △ → × → 未回答
    // =============================================

    C._mineMonth = null; // 開いている月
    C._mineSel = null;   // 下に詳しく出している日
    var _saveChain = Promise.resolve();
    /** 都合の保存が終わるまで待つ（続けてタップしても順番に保存する） */
    C.whenSaved = function() { return _saveChain; };

    /** 自分の都合を手元ですぐ変え、保存は順番に（失敗したら知らせて最新の状態に戻す） */
    function saveMine(member, date, s, note, rerender) {
        var a = availOf(member.id);
        a.name = member.name;
        var value = s ? { s: s, note: note || '' } : null;
        if (value) a.answers[date] = value; else delete a.answers[date];
        _saveChain = _saveChain.then(function() {
            return app.DB.setCoachAvailability(member.id, member.name, date, value);
        }).catch(function(e) {
            console.warn('都合を保存できませんでした:', e);
            UI().showAlert('保存できませんでした。通信環境を確認してください（画面を最新の状態に戻します）', 'error', 6000);
            return C.load().then(rerender);
        });
        return _saveChain;
    }

    /** カレンダーの下: 選んだ日の予定・担当と、○△×・△のときの中身・メモ */
    function mineDayPanel(member, date) {
        var me = String(member.id);
        var a = C.answerOf(me, date);
        var evs = C.eventsOn(date);
        var myEvs = evs.filter(function(ev) { return C.assignedIds(ev.id).indexOf(me) !== -1; });
        var hol = holName(date);
        return '<div class="co-daypanel" data-date="' + date + '">' +
            '<div class="co-dp-head">' +
            '<button type="button" class="co-dp-prev" aria-label="前の日">‹</button>' +
            '<div class="co-dp-title"><span class="co-dp-date' + dayCls(date) + '">' + fmt(date) + '</span>' +
            (hol ? '<span class="co-hol">' + esc(hol) + '</span>' : '') +
            '<span class="co-dp-state co-s-' + (a ? a.s : 'none') + '">' + (a ? ANS[a.s].text : '未回答') + '</span></div>' +
            '<button type="button" class="co-dp-next" aria-label="次の日">›</button></div>' +
            '<div class="co-dp-evs">' + (evs.length ? evs.map(function(ev) {
                return '<span class="co-dp-ev">' + esc(ev.title) + (evTime(ev) ? '<small>' + esc(evTime(ev)) + '</small>' : '') + '</span>';
            }).join('') : '<span class="co-muted">予定はまだありません（決まる前でも回答できます）</span>') + '</div>' +
            (myEvs.length ? '<div class="co-mine">🧢 あなたの担当: ' + esc(myEvs.map(function(e) { return e.title; }).join('・')) + '</div>' : '') +
            answerControls(a) +
            '<button type="button" class="co-memo' + (a && a.note ? ' has-note' : '') + '">' +
            (a && a.note ? '📝 ' + esc(a.note) + ' <span class="co-memo-edit">変更</span>' : '＋ メモ（例: 10時から・午後は別会場なら可）') + '</button>' +
            '</div>';
    }

    /**
     * 「参加予定」タブの「指導の予定」
     *  - あなたの担当（これからの担当の予定）
     *  - 回答の進み具合と「未回答をまとめて ○」
     *  - 月のカレンダー: 聞かれている日（枠のある日）をタップするたびに ○ → △ → × → 未回答
     *  - カレンダーの下に、最後にタップした日の予定と、○△×・△のとき（午前だけ・午後だけ・時間による）・メモ
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
        var me = String(member.id);
        var dates = C.planDates();
        var asked = {};
        dates.forEach(function(d) { asked[d] = true; });

        // あなたの担当（今日以降・日付順）
        var today = iso(new Date());
        var mine = (app.Hub.events || []).filter(function(ev) {
            return String(ev.date) >= today && C.assignedIds(ev.id).indexOf(me) !== -1;
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

        var bindDuty = function() {
            container.querySelectorAll('.co-duty-item').forEach(function(b) {
                b.addEventListener('click', function() { app.Hub.Calendar.showEventDetails(b.dataset.event); });
            });
        };
        // 都合はマネージャー（監督・コーチ・役員・管理者）しか読み書きできない。ログインの役割が保護者のままの
        // 指導者には、押しても保存できないボタンを出さずに案内する（担当は見られる）
        if (!isManager()) {
            container.innerHTML = html + '<p class="co-hint co-role-hint">都合を回答するには、ログインの役割が「監督」か「コーチ」である必要があります。管理者に役割の変更を頼んでください。</p></section>';
            bindDuty();
            return;
        }

        var answered = dates.filter(function(d) { return C.answerOf(me, d); }).length;
        var unanswered = dates.filter(function(d) { return !C.answerOf(me, d); });
        html += '<div class="co-progress">' +
            '<div class="co-progress-head"><span class="co-sub-title">都合の回答</span>' +
            '<span class="co-progress-num">回答済み <b>' + answered + '</b> / ' + dates.length + '日</span></div>' +
            '<div class="co-progress-bar"><span style="width:' + (dates.length ? Math.round(answered * 100 / dates.length) : 0) + '%"></span></div>' +
            (C._availFailed ? '<p class="co-error">回答を読み込めませんでした。通信環境を確認して開き直してください。</p>' : '') +
            (unanswered.length ? '<button type="button" class="co-bulk secondary-button">未回答の' + unanswered.length + '日をまとめて「○ 行ける」にする</button>' : '') +
            '</div>';
        if (dates.length === 0) {
            container.innerHTML = html + '<p class="co-empty">いま回答する日はありません</p></section>';
            bindDuty();
            return;
        }

        var months = monthsOf(dates);
        var sel = (C._mineSel && asked[C._mineSel]) ? C._mineSel : (unanswered[0] || dates[0]);
        var ym = (C._mineMonth && months.indexOf(C._mineMonth) !== -1) ? C._mineMonth : ymOf(sel);
        if (ymOf(sel) !== ym) {
            var inMonth = dates.filter(function(d) { return ymOf(d) === ym; });
            sel = inMonth.filter(function(d) { return !C.answerOf(me, d); })[0] || inMonth[0];
        }
        C._mineSel = sel;
        C._mineMonth = ym;
        var left = dates.filter(function(d) { return ymOf(d) === ym && !C.answerOf(me, d); }).length;
        html += '<div class="co-cal co-cal-mine">' +
            monthNav(ym, months, left ? '<span class="co-tag co-tag-warn">未回答 ' + left + '日</span>' : '<span class="co-tag co-tag-ok">✓ 回答済み</span>') +
            monthGrid(ym, function(date) {
                var n = parseInt(date.slice(8), 10);
                var cls = 'co-cal-day' + dayCls(date);
                if (!asked[date]) return '<span class="' + cls + ' is-off"><span class="co-cal-num">' + n + '</span></span>';
                var a = C.answerOf(me, date);
                var evs = C.eventsOn(date);
                var duty = evs.some(function(ev) { return C.assignedIds(ev.id).indexOf(me) !== -1; });
                return '<button type="button" class="' + cls + ' is-asked ' + (a ? 'co-s-' + a.s : 'is-unanswered') + (date === sel ? ' is-sel' : '') +
                    '" data-date="' + date + '" aria-label="' + fmt(date) + ' ' + (a ? ANS[a.s].text : '未回答') + '">' +
                    '<span class="co-cal-num">' + n + '</span>' +
                    '<span class="co-cal-mark">' + (a ? ANS[a.s].sym : '') + '</span>' +
                    (a && (a.s === 'am' || a.s === 'pm') ? '<span class="co-cal-sub">' + ANS[a.s].mark + '</span>' : '') +
                    '<span class="co-cal-flag">' + (duty ? '🧢' : (evs.length ? '<i class="co-cal-dot"></i>' : '')) + '</span>' +
                    '</button>';
            }) +
            '</div>' +
            '<p class="co-cal-legend">枠のある日をタップするたびに <b class="co-c-ok">○</b> 行ける → <b class="co-c-pt">△</b> 一部だけ → <b class="co-c-ng">×</b> 行けない → 未回答 と変わります。' +
            '<span class="co-cal-legend-sub"><i class="co-cal-dot"></i> 予定がある日　🧢 あなたの担当</span></p>' +
            mineDayPanel(member, sel) +
            '</section>';
        container.innerHTML = html;
        bindDuty();

        var rerender = function() { C.renderMine(container, member); };
        var save = function(date, s, note) {
            C._mineSel = date;
            saveMine(member, date, s, note, rerender);
            rerender();
        };
        var bulk = container.querySelector('.co-bulk');
        if (bulk) bulk.addEventListener('click', async function() {
            if (!UI().showConfirm('未回答の' + unanswered.length + '日をすべて「○ 行ける」にしますか？\n（行けない日は、あとからカレンダーで変えられます）')) return;
            bulk.disabled = true;
            try {
                await _saveChain;
                await C.setAnswers(member, unanswered, 'ok');
            } catch (e) {
                bulk.disabled = false;
                UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                return;
            }
            rerender();
        });
        bindMonthNav(container, ym, months, function(next) { C._mineMonth = next; C._mineSel = null; rerender(); });
        container.querySelectorAll('.co-cal-day.is-asked').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var date = btn.dataset.date;
                var cur = C.answerOf(me, date);
                save(date, nextAnswer(cur && cur.s), cur ? cur.note : '');
            });
        });
        var panel = container.querySelector('.co-daypanel');
        var cur = C.answerOf(me, sel);
        panel.querySelectorAll('.co-answer3 .co-ans').forEach(function(btn) {
            btn.addEventListener('click', function() {
                // 選んでいるものをもう一度押すと取り消し
                var on = btn.classList.contains('is-on');
                save(sel, on ? null : btn.dataset.s, cur ? cur.note : '');
            });
        });
        panel.querySelectorAll('.co-part-btn').forEach(function(btn) {
            btn.addEventListener('click', function() { save(sel, btn.dataset.s, cur ? cur.note : ''); });
        });
        panel.querySelector('.co-memo').addEventListener('click', function() {
            var note = UI().showPrompt(fmt(sel) + ' のメモ（例: 10時から・午後は別会場なら可）', cur ? cur.note : '');
            if (note === null) return;
            // メモは都合の補足。まだ回答していない日にメモだけ書いたときは「△ 時間による」として保存する
            save(sel, cur ? cur.s : 'part', String(note).trim());
        });
        var step = function(delta) {
            var i = dates.indexOf(sel) + delta;
            if (i < 0 || i >= dates.length) return;
            C._mineSel = dates[i];
            C._mineMonth = ymOf(dates[i]);
            rerender();
        };
        var prevDay = panel.querySelector('.co-dp-prev'), nextDay = panel.querySelector('.co-dp-next');
        prevDay.disabled = dates.indexOf(sel) <= 0;
        nextDay.disabled = dates.indexOf(sel) >= dates.length - 1;
        prevDay.addEventListener('click', function() { step(-1); });
        nextDay.addEventListener('click', function() { step(1); });
    };

    // =============================================
    // 監督の画面（管理タブ「🧢 指導者の予定・担当」）: 同じ月のカレンダーに ○△× の人数と担当（✓／⚠）。
    // 日をタップすると下にその日の都合と予定ごとの担当
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

    C._planMonth = null; // 開いている月
    C._planSel = null;   // 下に出している日

    /**
     * 監督の画面を開く
     * @param {string} [date] - 'YYYY-MM-DD' を渡すとその日を開く（カレンダーの「都合・担当を見る」など）
     */
    C.openPlanner = async function(date) {
        if (!isManager()) return;
        var modal = ensureModal('coach-planner-modal', 1020, '<h2 class="co-modal-title">🧢 指導者の予定・担当</h2>');
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            C._planSel = date;
            C._planMonth = ymOf(date);
        }
        modal.querySelector('.co-modal-body').innerHTML = '<p class="loading">読み込み中...</p>';
        UI().openModal('coach-planner-modal');
        await C.load();
        C.renderPlanner();
    };

    /** 日の担当の状態: 予定がなければ ''、担当のいない予定があれば 'warn'、全部決まっていれば 'ok' */
    function dutyState(date) {
        var evs = C.eventsOn(date);
        if (!evs.length) return '';
        return evs.some(function(ev) { return C.assignedIds(ev.id).length === 0; }) ? 'warn' : 'ok';
    }

    /** 監督の画面の下: 選んだ日の都合・予定ごとの担当 */
    function plannerDayHtml(date, info) {
        var hol = holName(date);
        var evs = C.eventsOn(date);
        var head = '<span class="co-dp-date' + dayCls(date) + '">' + fmt(date) + '</span>' +
            (hol ? '<span class="co-hol">' + esc(hol) + '</span>' : '');
        if (info.skipped) {
            return '<section class="co-pday is-skipped" data-date="' + date + '"><h3 class="co-pday-head">' + head +
                '<span class="co-skip-tag">聞かない日</span>' +
                '<button type="button" class="co-unskip">聞く日に戻す</button></h3>' +
                '<p class="co-noev">この日は指導者に都合を聞かない日にしています（活動がない日など）</p>' +
                '<button type="button" class="co-add-ev">＋ この日に予定を追加</button></section>';
        }
        var g = groupsOn(date);
        var canCome = g.ok.concat(g.am, g.pm, g.part);
        var html = '<section class="co-pday" data-date="' + date + '">' +
            '<h3 class="co-pday-head">' + head +
            // 予定のある日は必ず聞くので、外せるのは予定のない聞く日だけ
            (info.asked && !evs.length ? '<button type="button" class="co-skip">この日は聞かない</button>' : '') + '</h3>';
        if (info.asked) {
            var people = function(list, s) {
                return list.map(function(x) {
                    return '<button type="button" class="co-person co-s-' + s + '" data-member="' + esc(x.m.id) + '" title="' + esc(x.m.name + (x.a && x.a.note ? '（' + x.a.note + '）' : '')) + '">' +
                        esc(shortName(x.m)) + (isPartial(s) ? '<small>' + shortAns(s) + '</small>' : '') +
                        (x.a && x.a.note ? '<small class="co-person-note">📝' + esc(x.a.note) + '</small>' : '') + '</button>';
                }).join('');
            };
            var line = function(label, cls, list) {
                return '<div class="co-line ' + cls + '"><span class="co-line-label">' + label + '</span><div class="co-line-people">' +
                    (list.length ? list : '<span class="co-none">なし</span>') + '</div></div>';
            };
            html += '<div class="co-avail">' +
                line('○ 行ける', 'co-line-ok', people(g.ok, 'ok')) +
                (g.am.length + g.pm.length + g.part.length ? line('△ 一部', 'co-line-pt', people(g.am, 'am') + people(g.pm, 'pm') + people(g.part, 'part')) : '') +
                line('× 行けない', 'co-line-ng', people(g.ng, 'ng')) +
                (g.none.length ? line('未回答', 'co-line-none', people(g.none, 'none')) : '') +
                '</div><p class="co-hint co-pday-hint">名前を押すと、本人の代わりに都合を入れられます</p>';
        } else {
            html += '<p class="co-noev">まだ指導者に都合を聞いていない日です</p>' +
                '<button type="button" class="secondary-button co-ask-day">この日も指導者に都合を聞く</button>';
        }
        if (info.asked && evs.length === 0) html += '<p class="co-noev">この日の予定はまだありません</p>';
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
                        (x.a.s !== 'ok' ? '<small>' + shortAns(x.a.s) + '</small>' : '') +
                        (b.length ? '<small class="co-busy">' + esc(b.map(function(e) { return e.title; }).join('・')) + 'も担当</small>' : '') + '</button>';
                }).join('') +
                '<button type="button" class="co-more-pick">' + (cands.length ? 'ほかの人から選ぶ' : '指導者を選ぶ') + '</button>' +
                '</div></div></div>';
        });
        html += '<button type="button" class="co-add-ev">＋ この日に予定を追加</button></section>';
        return html;
    }

    C.renderPlanner = function() {
        var modal = document.getElementById('coach-planner-modal');
        if (!modal || modal.style.display === 'none') return;
        var body = modal.querySelector('.co-modal-body');
        var coaches = C.coaches();
        if (coaches.length === 0) {
            body.innerHTML = '<p class="co-hint">メンバーに監督・コーチが登録されていません。メンバータブで役割を「監督」「コーチ」にしてください。</p>';
            return;
        }
        var r = autoRange();
        var today = r.from;
        var askedSet = {}, skippedSet = {};
        C.planDates(true).forEach(function(d) { if (C.isSkipped(d, r)) skippedSet[d] = true; else askedSet[d] = true; });
        // 開ける月: 今月から、聞く日・これからの予定（ナイター練習を除く）がある月まで
        var evDates = (app.Hub.events || []).filter(function(ev) {
            return ev && ev.type !== 'nighter' && String(ev.date || '') >= today;
        }).map(function(ev) { return String(ev.date); });
        var allDates = Object.keys(askedSet).concat(Object.keys(skippedSet), evDates);
        var last = monthsOf(allDates.concat([today])).pop();
        var months = [];
        for (var ym0 = ymOf(today); ym0 <= last && months.length < 24; ) {
            months.push(ym0);
            var nd = new Date(parseInt(ym0.slice(0, 4), 10), parseInt(ym0.slice(5, 7), 10), 1);
            ym0 = iso(nd).slice(0, 7);
        }
        var ym = (C._planMonth && months.indexOf(C._planMonth) !== -1) ? C._planMonth : months[0];
        C._planMonth = ym;
        var monthDates = allDates.filter(function(d) { return ymOf(d) === ym && d >= today; }).sort();
        var sel = C._planSel;
        if (!sel || ymOf(sel) !== ym || sel < today) {
            sel = monthDates.filter(function(d) { return dutyState(d) === 'warn'; })[0] ||
                monthDates.filter(function(d) { return askedSet[d]; })[0] || monthDates[0] ||
                (ym === ymOf(today) ? today : ym + '-01');
        }
        C._planSel = sel;
        var warnDays = monthDates.filter(function(d, i, arr) { return arr.indexOf(d) === i && dutyState(d) === 'warn'; }).length;

        var html = C._availFailed ? '<p class="co-error">都合を読み込めませんでした。通信環境を確認して開き直してください。</p>' : '';
        html += '<div class="co-plan-tools"><button type="button" class="secondary-button co-add-dates">＋ 都合を聞く日を追加（お盆・年末年始など）</button></div>';
        html += '<div class="co-cal co-cal-plan">' +
            monthNav(ym, months, warnDays ? '<span class="co-tag co-tag-warn">⚠ 担当なし ' + warnDays + '日</span>' : '') +
            monthGrid(ym, function(date) {
                var n = parseInt(date.slice(8), 10);
                var cls = 'co-cal-day' + dayCls(date);
                if (date < today) return '<span class="' + cls + ' is-past"><span class="co-cal-num">' + n + '</span></span>';
                var st = dutyState(date);
                var flag = st === 'warn' ? '<span class="co-cal-st is-warn" title="担当のいない予定があります">⚠</span>'
                    : st === 'ok' ? '<span class="co-cal-st is-ok" title="担当が決まっています">✓</span>' : '';
                var inner = '';
                if (skippedSet[date]) inner = '<span class="co-cal-skip">聞かない</span>';
                else if (askedSet[date]) {
                    var g = groupsOn(date);
                    var p = g.am.length + g.pm.length + g.part.length;
                    inner = '<span class="co-cal-counts">' +
                        (g.ok.length ? '<span class="co-c-ok">○' + g.ok.length + '</span>' : '') +
                        (p ? '<span class="co-c-pt">△' + p + '</span>' : '') +
                        (g.ng.length ? '<span class="co-c-ng">×' + g.ng.length + '</span>' : '') +
                        (!g.ok.length && !p && !g.ng.length ? '<span class="co-c-none">未</span>' : '') + '</span>';
                } else if (st) inner = '<span class="co-cal-skip">未質問</span>';
                return '<button type="button" class="' + cls + (askedSet[date] ? ' is-asked' : skippedSet[date] ? ' is-skipped' : ' is-open') +
                    (date === sel ? ' is-sel' : '') + '" data-date="' + date + '"><span class="co-cal-num">' + n + '</span>' + flag + inner + '</button>';
            }) + '</div>' +
            '<p class="co-cal-legend"><b class="co-c-ok">○</b> 行ける <b class="co-c-pt">△</b> 一部だけ <b class="co-c-ng">×</b> 行けない の人数。' +
            '<span class="co-cal-st is-ok">✓</span> 担当が決まった日 <span class="co-cal-st is-warn">⚠</span> 担当のいない予定がある日。日をタップすると下に出ます</p>';
        html += '<div class="co-plan-day">' + plannerDayHtml(sel, { asked: !!askedSet[sel], skipped: !!skippedSet[sel] }) + '</div>';
        html += '<div class="co-footer"><button type="button" class="secondary-button co-copy-request">📋 未回答の人へのお願いをコピー（LINE用）</button></div>';
        body.innerHTML = html;

        var rerender = function() { C.renderPlanner(); };
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
        bindMonthNav(body, ym, months, function(next) { C._planMonth = next; C._planSel = null; rerender(); });
        body.querySelectorAll('.co-cal-grid button.co-cal-day').forEach(function(btn) {
            btn.addEventListener('click', function() {
                C._planSel = btn.dataset.date;
                rerender();
                var dayEl = body.querySelector('.co-plan-day');
                if (dayEl && dayEl.scrollIntoView) dayEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            });
        });
        var day = body.querySelector('.co-pday');
        var date = day.dataset.date;
        var unskip = day.querySelector('.co-unskip');
        if (unskip) unskip.addEventListener('click', function() { setAsked(unskip, date, true); });
        var askDay = day.querySelector('.co-ask-day');
        if (askDay) askDay.addEventListener('click', function() { setAsked(askDay, date, true); });
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
        var addEv = day.querySelector('.co-add-ev');
        if (addEv) addEv.addEventListener('click', function() {
            modal.style.display = 'none';
            app.Hub.Calendar.openAddEventModal(dateOf(date));
        });
        body.querySelector('.co-copy-request').addEventListener('click', function() { C.copyRequest(); });
    };

    /**
     * 本人の代わりに都合を入れる（監督の画面で名前をタップ）。
     * ○・× は押すと保存して閉じる。△は「午前だけ・午後だけ・時間による」を選ぶ
     */
    C.openAnswerSheet = function(member, date, onClose) {
        var modal = ensureModal('coach-answer-modal', 1035, '<h2 class="co-modal-title co-answer-title"></h2><p class="co-hint">本人の代わりに都合を入れます</p>');
        modal.querySelector('.co-answer-title').textContent = member.name + ' ' + fmt(date);
        modal._onClose = onClose || null;
        var body = modal.querySelector('.co-modal-body');
        var cur = C.answerOf(member.id, date);
        var draw = function(s) {
            var note = body.querySelector('#co-answer-note') ? body.querySelector('#co-answer-note').value : (cur ? cur.note : '');
            body.innerHTML = '<div class="co-answer-lg">' + answerControls(s ? { s: s } : null) + '</div>' +
                '<label class="co-label" for="co-answer-note">メモ</label>' +
                '<input type="text" id="co-answer-note" maxlength="60" placeholder="例: 10時から・午後は別会場なら可" value="' + esc(note || '') + '">' +
                '<div class="co-sheet-actions"><button type="button" class="secondary-button co-answer-clear">未回答に戻す</button></div>';
            body.querySelectorAll('.co-answer3 .co-ans').forEach(function(b) {
                b.addEventListener('click', function() {
                    // △ は中身（午前だけ・午後だけ・時間による）を選べるように開いたまま。○・× はすぐ保存して閉じる
                    if (b.dataset.s === 'part') { save('part', false); draw('part'); return; }
                    save(b.dataset.s, true);
                });
            });
            body.querySelectorAll('.co-part-btn').forEach(function(b) {
                b.addEventListener('click', function() { save(b.dataset.s, true); });
            });
            body.querySelector('.co-answer-clear').addEventListener('click', function() { save(null, true); });
        };
        var save = async function(s, close) {
            var note = (body.querySelector('#co-answer-note').value || '').trim();
            try {
                await C.setAnswer(member, date, s, note);
            } catch (e) {
                UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                return;
            }
            if (close) modal._close();
        };
        draw(cur ? cur.s : null);
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
            C._planSel = fresh[0];
            C._planMonth = ymOf(fresh[0]);
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
            var html = section('行ける人（○・△）', g.ok.concat(g.am, g.pm, g.part)) + section('未回答', g.none) + section('行けない人', g.ng);
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
        var text = '【指導者の都合のお願い】\nアプリの「参加予定」タブの「指導の予定」のカレンダーで、枠のある日をタップして都合（○ 行ける・△ 一部だけ・× 行けない）を入れてください。\n' +
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
        var names = function(list) { return list.map(function(x) { return esc(shortName(x.m)) + (x.a && x.a.s !== 'ok' ? '（' + shortAns(x.a.s) + '）' : ''); }).join('・'); };
        var canCome = g.ok.concat(g.am, g.pm, g.part);
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
            C.openPlanner(date);
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
