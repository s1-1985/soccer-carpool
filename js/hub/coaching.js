/**
 * FC尾島ジュニア - 指導者（監督・コーチ）の都合と担当
 *
 * 流れ:
 *  1. 監督・コーチは「参加予定」タブで、今後8週の土日（と予定のある日）の都合を回答しておく
 *     （○＝参加できる／午前のみ／午後のみ／×＝参加できない。メモも書ける）。予定がまだなくても回答できる
 *  2. 監督などマネージャーは管理タブ「🧢 指導者の予定・担当」で、日ごとの都合を見ながら予定を作り、
 *     予定ごとに付くコーチを決める。予定の追加フォームでも、日付を選ぶとその日の都合が出る
 *  3. 担当は予定の詳細（全員が見られる）と、コーチ本人の「参加予定」タブに出る
 * データ: coachAvailability/{メンバーID}（マネージャーのみ読み書き）、coachAssignments/{予定ID}（閲覧は全員）
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Coaching = FCOjima.Hub.Coaching || {};

(function(app) {
    var C = app.Hub.Coaching;
    var WEEKS = 8;
    var DOW = ['日', '月', '火', '水', '木', '金', '土'];
    var ANS = {
        ok: { mark: '○', text: '参加できる' },
        am: { mark: '午前', text: '午前のみ' },
        pm: { mark: '午後', text: '午後のみ' },
        ng: { mark: '×', text: '参加できない' }
    };
    var ORDER = ['ok', 'am', 'pm', 'ng'];

    C._avail = null;   // { メンバーID: { name, answers: { 日付: { s, note } } } }
    C._assign = null;  // { 予定ID: [メンバーID] }

    function UI() { return app.UI; }
    function Utils() { return app.Utils; }
    function esc(s) { return app.UI.escapeHTML(String(s == null ? '' : s)); }
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function fmt(date) {
        var d = new Date(date + 'T00:00:00');
        return (d.getMonth() + 1) + '/' + d.getDate() + '(' + DOW[d.getDay()] + ')';
    }
    function dayCls(date) {
        var w = new Date(date + 'T00:00:00').getDay();
        return w === 6 ? ' co-sat' : w === 0 ? ' co-sun' : '';
    }
    function isManager() { return !!(app.Auth && app.Auth.isManager && app.Auth.isManager()); }
    function shortName(m) { return (m && m.abbr) ? m.abbr : (m ? m.name : ''); }
    C.ANSWERS = ANS;

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

    /** 回答してもらう日: 今日から8週間の土日と、その間に予定（ナイター練習を除く）がある日 */
    C.planDates = function() {
        var set = {};
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var end = new Date(today.getTime());
        end.setDate(end.getDate() + WEEKS * 7);
        for (var d = new Date(today.getTime()); d < end; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === 0 || d.getDay() === 6) set[iso(d)] = true;
        }
        var from = iso(today), to = iso(end);
        (app.Hub.events || []).forEach(function(ev) {
            if (ev && ev.type !== 'nighter' && ev.date && ev.date >= from && ev.date < to) set[ev.date] = true;
        });
        return Object.keys(set).sort();
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
        if (C._assign === null || (isManager() && C._avail === null)) await C.load();
    };

    C.answerOf = function(memberId, date) {
        var a = C._avail && C._avail[String(memberId)];
        var v = a && a.answers && a.answers[date];
        return (v && ANS[v.s]) ? v : null;
    };

    /** 都合を保存（s を省くと回答を取り消す） */
    C.setAnswer = async function(member, date, s, note) {
        var value = s ? { s: s, note: note || '' } : null;
        await app.DB.setCoachAvailability(member.id, member.name, date, value);
        C._avail = C._avail || {};
        var a = C._avail[String(member.id)] || (C._avail[String(member.id)] = { name: member.name, answers: {} });
        if (value) a.answers[date] = value;
        else delete a.answers[date];
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

    function answerBadge(a) {
        if (!a) return '<span class="co-badge co-s-none">未回答</span>';
        return '<span class="co-badge co-s-' + a.s + '">' + esc(ANS[a.s].mark) + '</span>';
    }

    // =============================================
    // 自分の都合（「参加予定」タブ）
    // =============================================

    /**
     * 「参加予定」タブの「指導の予定」。日ごとに ○／午前／午後／× を押して回答し、担当になった予定も出す
     * @param {HTMLElement} container
     * @param {Object|null} member - 自分にあたる指導者のメンバー
     */
    C.renderMine = async function(container, member) {
        if (!container) return;
        if (!member) {
            container.innerHTML = '<section class="co-card co-my"><h3 class="co-title">🧢 指導の予定</h3>' +
                '<p class="co-hint">メンバーに監督・コーチとして登録されている名前と、ログインの名前が同じときに、土日の都合を回答できます。名前が違う場合は管理者に連絡してください。</p></section>';
            return;
        }
        container.innerHTML = '<section class="co-card co-my"><p class="loading">読み込み中...</p></section>';
        await C.ensureLoaded();
        var dates = C.planDates();
        var unanswered = dates.filter(function(d) { return !C.answerOf(member.id, d); }).length;
        var html = '<section class="co-card co-my">' +
            '<div class="co-head"><h3 class="co-title">🧢 指導の予定</h3>' +
            (unanswered ? '<span class="co-pill co-pill-warn">未回答 ' + unanswered + '日</span>' : '<span class="co-pill co-pill-ok">すべて回答済み</span>') + '</div>' +
            '<p class="co-hint">土日の都合を押してください（もう一度押すと取り消し）。監督はこれを見て予定と担当を決めます。</p>' +
            (C._availFailed ? '<p class="co-error">回答を読み込めませんでした。通信環境を確認して開き直してください。</p>' : '') +
            '<div class="co-my-list">';
        dates.forEach(function(date) {
            var evs = C.eventsOn(date);
            var mine = evs.filter(function(ev) { return C.assignedIds(ev.id).indexOf(String(member.id)) !== -1; });
            var a = C.answerOf(member.id, date);
            html += '<div class="co-row" data-date="' + date + '">' +
                '<div class="co-row-head"><span class="co-date' + dayCls(date) + '">' + fmt(date) + '</span>' +
                '<span class="co-evs">' + (evs.length ? esc(evs.map(function(e) { return e.title; }).join('・')) : '<span class="co-muted">予定なし</span>') + '</span></div>' +
                '<div class="co-seg" role="group" aria-label="' + fmt(date) + 'の都合">' +
                ORDER.map(function(s) {
                    return '<button type="button" class="co-seg-btn co-s-' + s + (a && a.s === s ? ' is-on' : '') + '" data-s="' + s + '" aria-pressed="' + (a && a.s === s ? 'true' : 'false') + '">' + ANS[s].mark + '</button>';
                }).join('') +
                '<button type="button" class="co-note-btn' + (a && a.note ? ' has-note' : '') + '" title="メモ（例: 10時から）" aria-label="メモ">📝</button></div>' +
                (a && a.note ? '<div class="co-note">' + esc(a.note) + '</div>' : '') +
                (mine.length ? '<div class="co-mine">🧢 担当: ' + esc(mine.map(function(e) { return e.title; }).join('・')) + '</div>' : '') +
                '</div>';
        });
        html += '</div></section>';
        container.innerHTML = html;
        container.querySelectorAll('.co-row').forEach(function(row) {
            var date = row.dataset.date;
            row.querySelectorAll('.co-seg-btn').forEach(function(btn) {
                btn.addEventListener('click', async function() {
                    var cur = C.answerOf(member.id, date);
                    var s = (cur && cur.s === btn.dataset.s) ? null : btn.dataset.s;
                    btn.disabled = true;
                    try {
                        await C.setAnswer(member, date, s, cur ? cur.note : '');
                    } catch (e) {
                        btn.disabled = false;
                        UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                        return;
                    }
                    C.renderMine(container, member);
                });
            });
            row.querySelector('.co-note-btn').addEventListener('click', async function() {
                var cur = C.answerOf(member.id, date);
                var note = UI().showPrompt(fmt(date) + ' のメモ（例: 10時から・午後は○○会場なら可）', cur ? cur.note : '');
                if (note === null) return;
                try {
                    // メモは都合の補足。まだ回答していない日にメモだけ書いたときは「○」として保存する
                    await C.setAnswer(member, date, cur ? cur.s : 'ok', String(note).trim());
                } catch (e) {
                    UI().showAlert('保存できませんでした。通信環境を確認してください', 'error', 6000);
                    return;
                }
                C.renderMine(container, member);
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

    C.openPlanner = async function() {
        if (!isManager()) return;
        var modal = ensureModal('coach-planner-modal', 1020,
            '<h2 class="co-modal-title">🧢 指導者の予定・担当</h2>' +
            '<p class="co-hint">監督・コーチが回答した土日の都合です。都合を見ながら予定を作り、予定ごとに付くコーチを決めてください。' +
            '名前をタップすると、本人の代わりに都合を入れられます。</p>' +
            '<div class="co-toolbar"><button type="button" class="secondary-button co-copy-request">📋 回答のお願いをコピー（LINE用）</button></div>');
        modal.querySelector('.co-copy-request').onclick = function() { C.copyRequest(); };
        modal.querySelector('.co-modal-body').innerHTML = '<p class="loading">読み込み中...</p>';
        UI().openModal('coach-planner-modal');
        await C.load();
        C.renderPlanner();
    };

    C.renderPlanner = function() {
        var modal = document.getElementById('coach-planner-modal');
        if (!modal || modal.style.display === 'none') return;
        var body = modal.querySelector('.co-modal-body');
        var coaches = C.coaches();
        if (coaches.length === 0) {
            body.innerHTML = '<p class="co-hint">メンバーに監督・コーチが登録されていません。メンバータブで役割を「監督」「コーチ」にしてください。</p>';
            return;
        }
        var html = C._availFailed ? '<p class="co-error">都合を読み込めませんでした。通信環境を確認して開き直してください。</p>' : '';
        C.planDates().forEach(function(date) {
            var groups = { ok: [], am: [], pm: [], ng: [], none: [] };
            coaches.forEach(function(m) {
                var a = C.answerOf(m.id, date);
                groups[a ? a.s : 'none'].push({ m: m, a: a });
            });
            var count = ORDER.concat(['none']).map(function(s) {
                return groups[s].length ? '<span class="co-cnt co-s-' + s + '">' + (s === 'none' ? '未' : ANS[s].mark) + ' ' + groups[s].length + '</span>' : '';
            }).join('');
            var chips = ORDER.concat(['none']).map(function(s) {
                return groups[s].map(function(x) {
                    return '<button type="button" class="co-chip co-s-' + s + '" data-member="' + esc(x.m.id) + '" title="' +
                        esc(x.m.name + '：' + (x.a ? ANS[x.a.s].text : '未回答') + (x.a && x.a.note ? '（' + x.a.note + '）' : '')) + '">' +
                        '<span class="co-chip-mark">' + (s === 'none' ? '？' : esc(ANS[s].mark)) + '</span>' + esc(shortName(x.m)) +
                        (x.a && x.a.note ? '<span class="co-chip-note">📝</span>' : '') + '</button>';
                }).join('');
            }).join('');
            var evs = C.eventsOn(date);
            var evHtml = evs.map(function(ev) {
                var names = C.assignedMembers(ev.id).map(shortName);
                var meta = [Utils().getEventTypeLabel(ev.type)];
                if (Array.isArray(ev.target) && ev.target.length) meta.push(ev.target.map(Utils().getGradeLabel).join('・'));
                if (ev.startTime || ev.departureTime) meta.push(ev.startTime || (ev.departureTime + '出発'));
                return '<div class="co-ev" data-event="' + esc(ev.id) + '">' +
                    '<div class="co-ev-main"><span class="co-ev-title">' + esc(ev.title) + '</span><span class="co-ev-meta">' + esc(meta.join('・')) + '</span>' +
                    '<span class="co-ev-coaches' + (names.length ? '' : ' co-unset') + '">🧢 ' + (names.length ? esc(names.join('・')) : '担当未定') + '</span></div>' +
                    '<button type="button" class="co-assign-btn">担当</button></div>';
            }).join('');
            html += '<section class="co-day" data-date="' + date + '">' +
                '<div class="co-day-head"><span class="co-date' + dayCls(date) + '">' + fmt(date) + '</span><span class="co-counts">' + count + '</span></div>' +
                '<div class="co-chips">' + chips + '</div>' +
                (evHtml ? '<div class="co-evlist">' + evHtml + '</div>' : '<p class="co-noev">予定はまだありません</p>') +
                '<button type="button" class="co-add-ev">＋ この日に予定を追加</button>' +
                '</section>';
        });
        body.innerHTML = html;
        body.querySelectorAll('.co-day').forEach(function(day) {
            var date = day.dataset.date;
            day.querySelectorAll('.co-chip').forEach(function(chip) {
                chip.addEventListener('click', function() {
                    var m = coaches.filter(function(x) { return String(x.id) === chip.dataset.member; })[0];
                    if (m) C.openAnswerSheet(m, date, function() { C.renderPlanner(); });
                });
            });
            day.querySelectorAll('.co-ev').forEach(function(row) {
                row.querySelector('.co-assign-btn').addEventListener('click', function() {
                    var ev = (app.Hub.events || []).filter(function(e) { return String(e.id) === row.dataset.event; })[0];
                    if (ev) C.openAssign(ev, function() { C.renderPlanner(); });
                });
            });
            day.querySelector('.co-add-ev').addEventListener('click', function() {
                var modal = document.getElementById('coach-planner-modal');
                if (modal) modal.style.display = 'none';
                app.Hub.Calendar.openAddEventModal(new Date(date + 'T00:00:00'));
            });
        });
    };

    /** 本人の代わりに都合を入れる（監督の画面で名前をタップ） */
    C.openAnswerSheet = function(member, date, onClose) {
        var modal = ensureModal('coach-answer-modal', 1035, '<h2 class="co-modal-title co-answer-title"></h2>');
        modal.querySelector('.co-answer-title').textContent = member.name + ' ' + fmt(date) + ' の都合';
        var cur = C.answerOf(member.id, date);
        var body = modal.querySelector('.co-modal-body');
        body.innerHTML = '<div class="co-seg co-seg-lg">' + ORDER.map(function(s) {
                return '<button type="button" class="co-seg-btn co-s-' + s + (cur && cur.s === s ? ' is-on' : '') + '" data-s="' + s + '">' + ANS[s].mark + '</button>';
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
        body.querySelectorAll('.co-seg-btn').forEach(function(b) { b.addEventListener('click', function() { save(b.dataset.s); }); });
        body.querySelector('.co-answer-clear').addEventListener('click', function() { save(null); });
        UI().openModal('coach-answer-modal');
    };

    /** 予定に付く指導者を選ぶ（都合の良い順。同じ日の他の予定の担当も出す） */
    C.openAssign = async function(ev, onClose) {
        if (!isManager()) return;
        var modal = ensureModal('coach-assign-modal', 1030, '<h2 class="co-modal-title co-assign-title"></h2><p class="co-hint">タップで付ける／外す（すぐ保存されます）</p>');
        modal.querySelector('.co-assign-title').textContent = fmt(ev.date) + ' ' + (ev.title || '') + ' の担当';
        modal._onClose = onClose || null;
        var body = modal.querySelector('.co-modal-body');
        body.innerHTML = '<p class="loading">読み込み中...</p>';
        UI().openModal('coach-assign-modal');
        await C.ensureLoaded();
        var rank = { ok: 0, am: 1, pm: 1, none: 2, ng: 3 };
        var others = C.eventsOn(ev.date).filter(function(e) { return String(e.id) !== String(ev.id); });
        var render = function() {
            var ids = C.assignedIds(ev.id);
            var list = C.coaches().map(function(m) { return { m: m, a: C.answerOf(m.id, ev.date) }; })
                .sort(function(x, y) { return rank[x.a ? x.a.s : 'none'] - rank[y.a ? y.a.s : 'none']; });
            body.innerHTML = list.length === 0
                ? '<p class="co-hint">メンバーに監督・コーチが登録されていません</p>'
                : list.map(function(x) {
                    var on = ids.indexOf(String(x.m.id)) !== -1;
                    var elsewhere = others.filter(function(e) { return C.assignedIds(e.id).indexOf(String(x.m.id)) !== -1; });
                    return '<button type="button" class="co-pick' + (on ? ' is-on' : '') + (x.a && x.a.s === 'ng' ? ' is-ng' : '') + '" data-member="' + esc(x.m.id) + '" aria-pressed="' + on + '">' +
                        '<span class="co-pick-check">' + (on ? '✓' : '') + '</span>' +
                        '<span class="co-pick-name">' + esc(x.m.name) + '<span class="co-pick-role">' + (x.m.role === 'coach' ? '監督' : 'コーチ') + '</span>' +
                        (x.a && x.a.note ? '<span class="co-pick-note">📝 ' + esc(x.a.note) + '</span>' : '') +
                        (elsewhere.length ? '<span class="co-pick-warn">同じ日に「' + esc(elsewhere.map(function(e) { return e.title; }).join('」「')) + '」の担当</span>' : '') +
                        '</span>' + answerBadge(x.a) + '</button>';
                }).join('');
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
        var text = '【指導者の都合のお願い】\nアプリの「参加予定」タブで、土日の都合（○・午前・午後・×）を押してください。\n' +
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
        if (C._avail === null) {
            el.innerHTML = '<span class="co-muted">指導者の都合を読み込み中...</span>';
            await C.load();
            if (el.dataset.date !== date) return;
        }
        var groups = { ok: [], am: [], pm: [], ng: [], none: [] };
        C.coaches().forEach(function(m) {
            var a = C.answerOf(m.id, date);
            groups[a ? a.s : 'none'].push(shortName(m));
        });
        var parts = ORDER.filter(function(s) { return groups[s].length; }).map(function(s) {
            return '<span class="co-hint-grp"><span class="co-badge co-s-' + s + '">' + ANS[s].mark + '</span>' + esc(groups[s].join('・')) + '</span>';
        });
        if (groups.none.length) parts.push('<span class="co-hint-grp"><span class="co-badge co-s-none">未回答</span>' + groups.none.length + '人</span>');
        el.innerHTML = '<span class="co-hint-label">🧢 この日の指導者:</span> ' + parts.join(' ');
    };

})(window.FCOjima);
