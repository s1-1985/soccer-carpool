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

    // ユーザーの子供IDの解決（メンバー側を正とする）は FCOjima.Utils.resolveChildrenIds に集約
    Admin._resolveChildrenIds = function(u, members) {
        return FCOjima.Utils.resolveChildrenIds(u, members);
    };

    /**
     * 管理タブの初期化
     */
    Admin.init = function() {
        console.log('管理タブを初期化しています...');
        Admin.applyPermissions();
        Admin.refresh();
        Admin.initAttendanceMatrixModal();
        Admin.initEventDetailModal();
        Admin.initDriverStatsModal();
        Admin.initAttendanceRateModal();
        Admin.initLuggageSettingsModal();
        Admin.initDutyGroupsModal();
        Admin.initAllUsersModal();
        Admin.initSignupQrModal();
        if (app.Hub.PermSettings && app.Hub.PermSettings.init) app.Hub.PermSettings.init();
    };

    // 管理タブのボタンと、それを使える機能（権限の設定）。権限がなければボタンを出さない
    var TILE_FEATURES = {
        'btn-coach-planner': 'coach_plan',
        'btn-attendance-matrix': 'attendance_view',
        'btn-driver-stats': 'attendance_view',
        'btn-attendance-rate': 'attendance_view',
        'btn-signup-qr': 'signup_qr',
        'btn-duty-groups': 'duty',
        'btn-luggage-settings': 'luggage'
    };
    function can(f) { return !!(app.Auth && app.Auth.can && app.Auth.can(f)); }
    Admin.can = can;

    /** 権限に合わせて管理タブのボタン・承認待ちの欄を出し分ける（登録済みユーザー・権限の設定は管理者・監督・コーチ・役員の全員） */
    Admin.applyPermissions = function() {
        Object.keys(TILE_FEATURES).forEach(function(id) {
            var b = document.getElementById(id);
            if (b) b.style.display = can(TILE_FEATURES[id]) ? '' : 'none';
        });
        var pend = document.getElementById('pending-users-section');
        if (pend) pend.style.display = can('approve') ? '' : 'none';
        // ボタンが全部隠れた見出しは出さない
        document.querySelectorAll('#admin .admin-group').forEach(function(g) {
            var shown = [].some.call(g.querySelectorAll('.admin-tile'), function(b) { return b.style.display !== 'none'; });
            g.style.display = shown ? '' : 'none';
        });
    };

    /**
     * 登録済みユーザー一覧モーダルの初期化
     */
    Admin.initAllUsersModal = function() {
        var btn = document.getElementById('btn-all-users');
        var modal = document.getElementById('all-users-modal');
        var closeBtn = document.getElementById('all-users-modal-close');
        if (!btn || !modal) return;

        btn.addEventListener('click', function() {
            modal.style.display = 'flex';
        });
        closeBtn && closeBtn.addEventListener('click', function() { modal.style.display = 'none'; });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.style.display = 'none'; });
    };

    /**
     * 入会用QRコードモーダルの初期化
     */
    Admin.initSignupQrModal = function() {
        var btn = document.getElementById('btn-signup-qr');
        var modal = document.getElementById('signup-qr-modal');
        var closeBtn = document.getElementById('signup-qr-modal-close');
        var qrContainer = document.getElementById('signup-qr-code');
        var urlInput = document.getElementById('signup-qr-url');
        var copyBtn = document.getElementById('signup-qr-copy-btn');
        if (!btn || !modal) return;

        // LINE で送っても Safari・Chrome で開くように（LINE の中のブラウザでは Google のログインができない）
        var signupUrl = FCOjima.Utils.lineSafeUrl(window.location.origin + '/hub/register.html');
        var qrRendered = false;

        btn.addEventListener('click', function() {
            modal.style.display = 'flex';
            if (urlInput) urlInput.value = signupUrl;
            if (!qrRendered && window.QRCode && qrContainer) {
                new QRCode(qrContainer, {
                    text: signupUrl,
                    width: 220,
                    height: 220,
                    correctLevel: QRCode.CorrectLevel.M
                });
                qrRendered = true;
            }
        });
        closeBtn && closeBtn.addEventListener('click', function() { modal.style.display = 'none'; });
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.style.display = 'none'; });

        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                var ok = FCOjima.Utils && FCOjima.Utils.copyToClipboard && FCOjima.Utils.copyToClipboard(signupUrl);
                if (UI) UI.showAlert(ok ? 'リンクをコピーしました' : 'コピーに失敗しました。リンクを選択して手動でコピーしてください', ok ? 'success' : 'error');
            });
        }
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
        if (!can('approve')) {
            if (app.Hub.Home && app.Hub.Home.setPendingCount) app.Hub.Home.setPendingCount(0);
            return;
        }
        el.innerHTML = '<p class="loading">読み込み中...</p>';

        try {
            var users = await FCOjima.DB.loadPendingUsers();
            // 管理タブの件数・カレンダーの「やること」にも出す（以前は管理タブを開かないと気づけなかった）
            if (app.Hub.Home && app.Hub.Home.setPendingCount) app.Hub.Home.setPendingCount(users.length);
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

    // 申請の「立場」（register.html の requestedRole）
    var REQUESTED_ROLE_LABELS = { parent: '保護者', coach: '監督・コーチ', officer: '役員' };
    // 承認するときに選べる役割（管理者はここでは付けない。登録済みユーザー一覧で管理者だけが付けられる）
    var APPROVE_ROLES = ['parent', 'coach', 'assist', 'officer'];

    /**
     * 申請した人が名簿（メンバー）のだれにあたるか。氏名→フリガナの順で、選手以外から探す
     * @returns {Object|null}
     */
    Admin._matchAdultMember = function(u, adults) {
        var Utils = FCOjima.Utils;
        var n = Utils.normalizeNameLoose(u.name), k = Utils.normalizeNameLoose(u.kana);
        var hit = n ? adults.filter(function(m) { return Utils.normalizeNameLoose(m.name) === n; }) : [];
        if (hit.length !== 1 && k) hit = adults.filter(function(m) { return m.kana && Utils.normalizeNameLoose(m.kana) === k; });
        return hit.length === 1 ? hit[0] : null;
    };

    function myRole() {
        var p = app.Auth && app.Auth.currentUserProfile;
        return p ? p.role : '';
    }

    /** 承認するときに付けられる役割（固定のきまり。監督は管理者だけ） */
    Admin._approvableRoles = function() {
        var me = myRole();
        return APPROVE_ROLES.filter(function(r) {
            return r === 'coach' ? me === 'admin' : FCOjima.Perm.canChangeRole(me, 'parent', r);
        });
    };

    /** 登録済みユーザー（読み込んだもの。まだなら読む） */
    Admin._users = null;
    Admin._ensureUsers = async function() {
        if (!Admin._users) Admin._users = await FCOjima.DB.loadAllUsers();
        return Admin._users;
    };

    /** 承認するときの役割の初期値: 名簿の役割 → 申請の立場の順 */
    Admin._defaultApproveRole = function(u, member) {
        if (member && ['coach', 'assist', 'officer'].indexOf(member.role) !== -1) return member.role;
        if (member && (member.role === 'father' || member.role === 'mother')) return 'parent';
        if (u.requestedRole === 'coach') return 'assist';
        if (u.requestedRole === 'officer') return 'officer';
        return 'parent';
    };

    /**
     * 承認待ちカードを作成
     * 役割（保護者・監督・コーチ・役員）と、名簿のだれにあたるか（名前を名簿に合わせる）をここで決めて承認する。
     * 以前は全員「保護者」で承認され、監督・コーチは登録済みユーザー一覧で役割を直す必要があった。
     * また名簿と1文字でも違う名前で申請すると、指導の予定・子供の紐づけ（名前で照合）がつながらなかった
     */
    Admin.createPendingCard = function(u) {
        var members = app.Hub.members || [];
        var typedNames = Array.isArray(u.childrenNames) ? u.childrenNames.filter(Boolean) : [];
        var childNames = Admin._resolveChildrenIds(u, members).map(function(cid) {
            var m = FCOjima.Utils.findChildMemberById(members, cid);
            return m ? m.name : cid;
        }).join('、') || '（なし）';
        var adults = members.filter(function(m) { return m.role !== 'player'; }).slice().sort(function(a, b) {
            return (a.name || '').localeCompare(b.name || '', 'ja');
        });
        var matched = Admin._matchAdultMember(u, adults);

        var card = document.createElement('div');
        card.className = 'pending-card';
        card.style.cssText = 'border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:12px;background:#fff;';
        var esc = UI ? UI.escapeHTML : function(s) { return s; };
        var rowCss = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:6px 0;font-size:13px;';
        var selCss = 'flex:1;min-width:140px;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:13px;';
        card.innerHTML =
            '<div style="font-weight:bold;margin-bottom:4px;">' + esc(u.name || '') + (u.kana ? ' <span style="font-weight:normal;color:#888;font-size:12px;">' + esc(u.kana) + '</span>' : '') + '</div>' +
            '<div style="font-size:13px;color:#666;">メール: ' + esc(u.email || '不明') + '</div>' +
            '<div style="font-size:13px;color:#666;">申請の立場: ' + esc(REQUESTED_ROLE_LABELS[u.requestedRole] || '（未入力）') + '</div>' +
            '<div style="' + rowCss + '"><span style="min-width:4.5em;">役割</span><select class="pending-role-select" style="' + selCss + '"></select></div>' +
            '<div style="' + rowCss + '"><span style="min-width:4.5em;">名簿の人</span><select class="pending-member-select" style="' + selCss + '"></select></div>' +
            '<div class="pending-member-note" style="font-size:12px;color:#888;margin:-2px 0 4px;"></div>' +
            (typedNames.length > 0
                ? '<div style="font-size:13px;color:#666;margin-top:4px;">子供（申請時の入力を選手名簿と照合してください）:</div>' +
                  '<div class="pending-children"></div>'
                : '<div style="font-size:13px;color:#666;">子供: ' + esc(childNames) + '</div>') +
            (u.registeredAt ? '<div style="font-size:12px;color:#aaa;margin-top:4px;">申請日時: ' + new Date(u.registeredAt.seconds * 1000).toLocaleString('ja-JP') + '</div>' : '') +
            // 承認を大きく、却下は控えめに（以前は同じ大きさの緑と赤が並び、押し間違えやすかった）
            '<div class="pending-actions">' +
                '<button type="button" class="approve-btn" data-uid="' + u.uid + '">承認する</button>' +
                '<button type="button" class="reject-btn" data-uid="' + u.uid + '">却下</button>' +
            '</div>';

        // 役割（付けられる役割だけ。監督にできるのは管理者、コーチは管理者・監督・コーチ、役員は管理者・監督・コーチ・役員）
        var roleSel = card.querySelector('.pending-role-select');
        var allowed = Admin._approvableRoles();
        var pickRole = function(r) { return allowed.indexOf(r) !== -1 ? r : 'parent'; };
        var defRole = pickRole(Admin._defaultApproveRole(u, matched));
        allowed.forEach(function(r) {
            var opt = document.createElement('option');
            opt.value = r;
            opt.textContent = ROLE_LABELS[r];
            if (r === defRole) opt.selected = true;
            roleSel.appendChild(opt);
        });

        // 名簿の人（選手以外）。名前・フリガナが一致する人を初期選択
        var memberSel = card.querySelector('.pending-member-select');
        var noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = '（名簿にいない・申請の名前のまま）';
        memberSel.appendChild(noneOpt);
        var MEMBER_ROLE = { coach: '監督', assist: 'コーチ', father: '父', mother: '母', officer: '役員' };
        adults.forEach(function(m) {
            var opt = document.createElement('option');
            opt.value = String(m.id);
            opt.textContent = m.name + (MEMBER_ROLE[m.role] ? '（' + MEMBER_ROLE[m.role] + '）' : '');
            if (matched && String(matched.id) === String(m.id)) opt.selected = true;
            memberSel.appendChild(opt);
        });
        var noteEl = card.querySelector('.pending-member-note');
        var memberOf = function() {
            return adults.filter(function(m) { return String(m.id) === memberSel.value; })[0] || null;
        };
        var updateNote = function() {
            var m = memberOf();
            noteEl.textContent = !m ? '名簿にいない場合は、承認したあとメンバータブで追加してください'
                : (FCOjima.Utils.normalizeName(m.name) !== FCOjima.Utils.normalizeName(u.name)
                    ? 'ログインの名前を名簿の「' + m.name + '」に合わせます' : '名簿の名前と同じです');
        };
        memberSel.addEventListener('change', function() {
            var m = memberOf();
            if (m) roleSel.value = pickRole(Admin._defaultApproveRole(u, m));
            updateNote();
        });
        updateNote();

        // 申請時に入力された子供の氏名ごとに、選手名簿から本人を選ぶ欄（一致する選手を初期選択）。
        // 登録画面では承認前の人に名簿を見せないため、照合はここで管理者が行う
        var childSelects = [];
        var childBox = card.querySelector('.pending-children');
        if (childBox) {
            var players = members.filter(function(m) { return m.role === 'player'; }).slice().sort(function(a, b) {
                return (a.name || '').localeCompare(b.name || '', 'ja');
            });
            typedNames.forEach(function(typed) {
                var row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0;font-size:13px;';
                var lbl = document.createElement('span');
                lbl.textContent = '「' + typed + '」→';
                var sel = document.createElement('select');
                sel.className = 'pending-child-select';
                sel.style.cssText = 'flex:1;min-width:140px;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:13px;';
                var none = document.createElement('option');
                none.value = '';
                none.textContent = '（該当なし・あとで設定）';
                sel.appendChild(none);
                var match = FCOjima.Utils.matchPlayerByName(players, typed);
                players.forEach(function(p) {
                    var opt = document.createElement('option');
                    opt.value = String(p.id);
                    opt.textContent = p.name + (p.grade ? '（' + FCOjima.Utils.getGradeLabel(p.grade) + '）' : '');
                    if (match && String(match.id) === String(p.id)) opt.selected = true;
                    sel.appendChild(opt);
                });
                row.appendChild(lbl);
                row.appendChild(sel);
                childBox.appendChild(row);
                childSelects.push(sel);
            });
        }

        card.querySelector('.approve-btn').addEventListener('click', function() {
            var ids = null;
            if (childSelects.length > 0) {
                ids = [];
                childSelects.forEach(function(sel) {
                    if (sel.value && ids.indexOf(sel.value) === -1) ids.push(sel.value);
                });
            }
            var m = memberOf();
            Admin.approveUser(u.uid, u.name, ids, {
                role: roleSel.value,
                name: (m && m.name !== u.name) ? m.name : null
            });
        });
        card.querySelector('.reject-btn').addEventListener('click', function() {
            Admin.rejectUser(u.uid, u.name);
        });

        return card;
    };

    /**
     * ユーザーを承認
     * @param {string} uid
     * @param {string} name
     * @param {Array<string>|null} [childrenIds] - 承認カードで照合した子供（null なら変更しない）
     * @param {{role?: string, name?: string|null}} [extra] - 役割・名簿に合わせた名前（承認カードで選んだもの）
     */
    Admin.approveUser = async function(uid, name, childrenIds, extra) {
        extra = extra || {};
        var lines = '';
        if (extra.role) lines += '\n役割: ' + (ROLE_LABELS[extra.role] || extra.role);
        if (extra.name) lines += '\n名前: ' + name + ' → ' + extra.name + '（名簿に合わせる）';
        if (Array.isArray(childrenIds)) {
            var members = app.Hub.members || [];
            var names = childrenIds.map(function(cid) {
                var m = FCOjima.Utils.findChildMemberById(members, cid);
                return m ? m.name : cid;
            });
            lines += '\n子供: ' + (names.length > 0 ? names.join('、') : '（なし）');
        }
        // 監督として承認するときは、いまの監督（ほかに「監督」の役割の人）はコーチになる（監督は1人だけ）
        if (extra.role === 'coach') {
            var others = (await Admin._ensureUsers()).filter(function(x) { return x.role === 'coach' && x.uid !== uid; });
            extra.demoteUids = others.map(function(x) { return x.uid; });
            if (others.length) lines += '\n今の監督（' + others.map(function(x) { return x.name || x.uid; }).join('・') + '）はコーチになります';
        }
        if (!confirm((name || uid) + ' を承認しますか？' + lines)) return;
        try {
            var currentUid = app.Auth && app.Auth.getCurrentUser() ? app.Auth.getCurrentUser().uid : null;
            await FCOjima.DB.approveUser(uid, currentUid, childrenIds, extra);
            if (UI) UI.showAlert((extra.name || name || uid) + ' を承認しました', 'success');
            Admin.refresh();
            Admin.showApprovedNotice(extra.name || name || '');
        } catch(e) {
            if (UI) UI.showAlert('承認に失敗しました: ' + e.message, 'error');
        }
    };

    /**
     * 承認したことを本人に知らせる（LINE で送る・文をコピー）。
     * 承認されても本人には通知が届かず、承認待ちの画面を開き直すまで気づけなかった
     * @param {string} name - 承認した人の名前
     */
    Admin.showApprovedNotice = function(name) {
        var url = FCOjima.Utils.lineSafeUrl(window.location.origin + '/hub/index.html');
        var msg = (name ? name + 'さん\n' : '') + 'FC尾島ジュニアのアプリの利用を承認しました。\n' +
            '下のリンクから開くと、そのまま使えます。\n' + url;
        var modal = document.getElementById('approved-notice-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'approved-notice-modal';
            modal.className = 'modal';
            modal.style.zIndex = '1060';
            modal.innerHTML = '<div class="modal-content" style="max-width:420px;">' +
                '<span class="close" aria-label="閉じる">&times;</span>' +
                '<h2 style="font-size:16px;margin-bottom:6px;">✅ 承認しました</h2>' +
                '<p style="font-size:13px;color:#555;margin:0 0 8px;">本人には自動で知らせが届きません。LINE で知らせましょう。</p>' +
                '<textarea class="approved-notice-text form-control" rows="5" readonly style="width:100%;font-size:13px;"></textarea>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">' +
                '<button type="button" class="approved-notice-line" style="flex:1;">LINEで知らせる</button>' +
                '<button type="button" class="secondary-button approved-notice-copy" style="flex:1;">文をコピー</button>' +
                '</div></div>';
            document.body.appendChild(modal);
            var close = function() { modal.style.display = 'none'; };
            modal.querySelector('.close').addEventListener('click', close);
            modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
            modal.querySelector('.approved-notice-line').addEventListener('click', function() {
                var text = modal.querySelector('.approved-notice-text').value;
                window.open('https://line.me/R/msg/text/?' + encodeURIComponent(text), '_blank');
            });
            modal.querySelector('.approved-notice-copy').addEventListener('click', function() {
                var ok = FCOjima.Utils.copyToClipboard(modal.querySelector('.approved-notice-text').value);
                if (UI) UI.showAlert(ok ? '文をコピーしました。LINEに貼り付けてください' : 'コピーできませんでした', ok ? 'success' : 'error');
            });
        }
        modal.querySelector('.approved-notice-text').value = msg;
        modal.style.display = 'flex';
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
            Admin._users = users;
            var approved = users.filter(function(u) { return u.status === 'approved'; });
            var rejected = users.filter(function(u) { return u.status === 'rejected'; });
            el.innerHTML = '';
            // 監督（1人だけ）の指定・引き継ぎ
            el.appendChild(Admin._kantokuBox(approved));
            if (approved.length === 0) {
                el.insertAdjacentHTML('beforeend', '<p style="color:#999;padding:8px;">登録済みユーザーはいません。</p>');
            }
            var members = app.Hub.members || [];

            approved.forEach(function(u) {
                var childNames = Admin._resolveChildrenIds(u, members).map(function(cid) {
                    var m = FCOjima.Utils.findChildMemberById(members, cid);
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
                var me = myRole();
                var iAmAdmin = me === 'admin';

                // 選べる役割: 今の役割と、今の役割から変えてよい役割（固定のきまり。js/common/permissions.js）。
                // 監督にする・監督を外すのは管理者だけ（いまの監督は上の欄で次の監督を指名する）
                var select = document.createElement('select');
                select.style.cssText = 'padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;';
                Object.keys(ROLE_LABELS).forEach(function(role) {
                    if (role !== u.role && !FCOjima.Perm.canChangeRole(me, u.role || 'parent', role)) return;
                    var opt = document.createElement('option');
                    opt.value = role;
                    opt.textContent = ROLE_LABELS[role];
                    if (u.role === role) opt.selected = true;
                    select.appendChild(opt);
                });

                if (u.uid === (currentProfile && currentProfile.uid)) {
                    select.disabled = true;
                    select.title = u.role === 'coach' ? '監督は上の欄で次の監督を指名できます' : '自分の役割は変更できません';
                } else if (u.role === 'admin' && !iAmAdmin) {
                    // 管理者に対する操作は管理者だけ（Firestoreルールと同期）
                    select.disabled = true;
                    select.title = '管理者の役割変更は管理者のみ可能です';
                } else if (select.options.length <= 1) {
                    select.disabled = true;
                    select.title = (ROLE_LABELS[u.role] || '') + 'を外せるのは' + Admin._removersText(u.role) + 'です';
                }

                var saveBtn = document.createElement('button');
                saveBtn.textContent = '変更';
                saveBtn.style.cssText = 'padding:4px 10px;font-size:12px;white-space:nowrap;flex-shrink:0;';
                saveBtn.addEventListener('click', function() {
                    Admin.updateRole(u.uid, select.value, u.name);
                });
                // 役割を変えられない行（自分・管理者）はボタンも押せないようにする
                // （以前は押せてしまい、押すと権限エラーの表示になっていた）
                if (select.disabled) {
                    saveBtn.disabled = true;
                    saveBtn.title = select.title;
                }

                ctrl.appendChild(select);
                ctrl.appendChild(saveBtn);
                row.appendChild(info);
                row.appendChild(ctrl);
                el.appendChild(row);
            });

            // 却下済みユーザー。以前はどこにも表示されず、誤って却下すると本人も再申請できない
            // （usersドキュメントが残るため）まま、Firebase Consoleでしか戻せなかった
            if (rejected.length > 0) {
                var rh = document.createElement('h4');
                rh.style.cssText = 'margin:16px 0 6px;font-size:13px;color:#888;';
                rh.textContent = '却下済み（誤って却下した場合はここから承認できます）';
                el.appendChild(rh);
                var escR = UI ? UI.escapeHTML : function(s) { return s; };
                rejected.forEach(function(u) {
                    var row = document.createElement('div');
                    row.style.cssText = 'border:1px dashed #ddd;border-radius:8px;padding:10px;margin-bottom:8px;background:#fafafa;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;';
                    var info = document.createElement('div');
                    info.innerHTML = '<div style="font-weight:bold;color:#777;">' + escR(u.name || '') + '</div>' +
                        '<div style="font-size:12px;color:#999;">' + escR(u.email || '') + '</div>';
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'secondary-button';
                    btn.textContent = '承認する';
                    btn.style.cssText = 'padding:4px 12px;font-size:12px;';
                    btn.addEventListener('click', function() { Admin.approveUser(u.uid, u.name); });
                    row.appendChild(info);
                    // 承認し直せるのは、承認の権限があり、その人の役割を付けられる人（ルールと同じ）
                    if (can('approve') && FCOjima.Perm.canAssignRole(myRole(), u.role || 'parent')) row.appendChild(btn);
                    el.appendChild(row);
                });
            }
        } catch(e) {
            el.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
        }
    };

    /**
     * ユーザー役割を変更
     */
    Admin.updateRole = async function(uid, newRole, name) {
        var users = await Admin._ensureUsers().catch(function() { return []; });
        var target = users.filter(function(x) { return x.uid === uid; })[0] || {};
        if (target.role === newRole) return;
        try {
            if (newRole === 'coach') {
                // 監督にする（管理者）: いまの監督・ほかに「監督」の役割の人はコーチになる（監督は1人だけ）
                var others = users.filter(function(x) { return x.role === 'coach' && x.uid !== uid; });
                if (!confirm((name || uid) + 'さんを監督にしますか？' +
                    (others.length ? '\n今の監督（' + others.map(function(x) { return x.name || x.uid; }).join('・') + '）はコーチになります' : ''))) return;
                await FCOjima.DB.setKantoku(uid, others.map(function(x) { return x.uid; }));
                app.Auth.kantokuUid = uid;
            } else if (target.role === 'coach') {
                // 監督を外す（管理者）
                if (!confirm((name || uid) + 'さんを監督から外して「' + (ROLE_LABELS[newRole] || newRole) + '」にしますか？\n（監督がいなくなります。新しい監督は管理者が指定します）')) return;
                await FCOjima.DB.removeKantoku(uid, newRole, app.Auth.kantokuUid === uid);
                if (app.Auth.kantokuUid === uid) app.Auth.kantokuUid = '';
            } else {
                await FCOjima.DB.updateUserRole(uid, newRole);
            }
            if (UI) UI.showAlert((name || uid) + ' の役割を「' + (ROLE_LABELS[newRole] || newRole) + '」に変更しました', 'success');
            // 一覧を読み直す（変更前の役割のまま表示・操作可否が判定され続けないように）
            Admin.loadAllUsers();
        } catch(e) {
            if (UI) UI.showAlert('変更に失敗しました: ' + e.message, 'error');
        }
    };

    /** その役割を外せる人（説明用） */
    Admin._removersText = function(role) {
        var who = ['admin', 'coach', 'assist', 'officer'].filter(function(r) { return FCOjima.Perm.canAssignRole(r, role); });
        if (role === 'coach' || role === 'admin') who = ['admin'];
        return who.map(function(r) { return ROLE_LABELS[r]; }).join('・');
    };

    /**
     * 監督（1人だけ）の欄: いまの監督と、管理者の「監督に指定する」、いまの監督の「次の監督に指名する」
     * @param {Array} approved - 承認済みのユーザー
     */
    Admin._kantokuBox = function(approved) {
        var esc = UI.escapeHTML;
        var me = app.Auth.currentUserProfile || {};
        var kUid = app.Auth.kantokuUid || '';
        var coachUsers = approved.filter(function(u) { return u.role === 'coach'; });
        var current = approved.filter(function(u) { return u.uid === kUid && u.role === 'coach'; })[0] || null;
        var box = document.createElement('div');
        box.className = 'kantoku-box';
        var html = '<div class="kantoku-head">🧢 監督（1人だけ）: <b>' + (current ? esc(current.name || '') : 'まだ指定されていません') + '</b></div>';
        var stray = coachUsers.filter(function(u) { return !current || u.uid !== current.uid; });
        if (stray.length) {
            html += '<p class="kantoku-warn">⚠ 役割が「監督」の人が' + (current ? 'ほかに' : '') + stray.length + '人います（' +
                esc(stray.map(function(u) { return u.name || ''; }).join('・')) + '）。管理者が監督を1人指定してください（ほかの人はコーチになります）</p>';
        }
        var candidates = approved.filter(function(u) { return u.role !== 'admin' && u.uid !== (current && current.uid); });
        var options = candidates.map(function(u) {
            return '<option value="' + esc(u.uid) + '">' + esc(u.name || u.email || u.uid) + '（' + esc(ROLE_LABELS[u.role] || u.role || '') + '）</option>';
        }).join('');
        if (me.role === 'admin') {
            html += '<div class="kantoku-row"><select class="kantoku-select"><option value="">監督にする人を選ぶ</option>' + options + '</select>' +
                '<button type="button" class="kantoku-btn" data-mode="designate">監督に指定する</button></div>';
        } else if (current && current.uid === me.uid) {
            html += '<div class="kantoku-row"><select class="kantoku-select"><option value="">次の監督を選ぶ</option>' +
                candidates.filter(function(u) { return u.uid !== me.uid; }).map(function(u) {
                    return '<option value="' + esc(u.uid) + '">' + esc(u.name || u.email || u.uid) + '（' + esc(ROLE_LABELS[u.role] || u.role || '') + '）</option>';
                }).join('') + '</select>' +
                '<button type="button" class="kantoku-btn" data-mode="handover">次の監督に指名する</button></div>' +
                '<p class="kantoku-note">指名すると、あなたはコーチになります</p>';
        } else {
            html += '<p class="kantoku-note">監督は管理者が指定し、いまの監督が次の監督を指名できます</p>';
        }
        box.innerHTML = html;
        var btn = box.querySelector('.kantoku-btn');
        if (btn) btn.addEventListener('click', function() {
            var sel = box.querySelector('.kantoku-select');
            var uid = sel && sel.value;
            if (!uid) { UI.showAlert('人を選んでください', 'warning'); return; }
            var u = approved.filter(function(x) { return x.uid === uid; })[0] || {};
            if (btn.dataset.mode === 'designate') Admin.updateRole(uid, 'coach', u.name);
            else Admin.handoverKantoku(uid, u.name);
        });
        return box;
    };

    /** 監督の引き継ぎ（いまの監督が次の監督を指名する。自分はコーチになる） */
    Admin.handoverKantoku = async function(nextUid, name) {
        var me = app.Auth.currentUserProfile || {};
        if (!confirm((name || nextUid) + 'さんを次の監督にしますか？\nあなたはコーチになります（元に戻すには、' + (name || '次の監督') + 'さんか管理者に頼んでください）')) return;
        try {
            await FCOjima.DB.handoverKantoku(me.uid, nextUid);
        } catch (e) {
            UI.showAlert('監督を引き継げませんでした: ' + e.message, 'error', 8000);
            return;
        }
        UI.showAlert((name || '') + 'さんが監督になりました。あなたはコーチになりました（画面を読み込み直します）', 'success', 4000);
        setTimeout(function() { window.location.reload(); }, 1500);
    };

    // =============================================
    //  出欠マトリクス
    // =============================================

    /**
     * 出欠の名前→状態の表から、その選手の状態を返す（以前の名前 formerNames でも探す。
     * 名前を変える前に回答した出欠も本人の回答として数えるため）
     */
    Admin._statusFor = function(evMap, m) {
        var st = evMap[m.name] || evMap[String(m.id)];
        if (!st) {
            (m.formerNames || []).some(function(n) { st = evMap[n]; return !!st; });
        }
        return st || 'unknown';
    };

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
            var allNonNighter = events.filter(function(ev) { return ev.type !== 'nighter'; }).sort(Utils.compareEvents);
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

            // 対象選手かどうか判定（共通ヘルパーに委譲。Utils.isTargetFor参照）。
            // 出欠ページで参加者から外した人は対象外（－）
            var isTargetFor = function(m, ev) {
                if (!Utils.isTargetFor(m, ev)) return false;
                var i = targetEvents.indexOf(ev);
                return !(i >= 0 && Utils.isRemovedFromEvent(m, dataArr[i]));
            };

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
                    var st = Admin._statusFor(evMap, m);
                    if (st === 'present') present++;
                    else if (st === 'absent') absent++;
                });
                breakdown.push({ present: present, absent: absent, unknown: targetN - present - absent, target: targetN });
            });
            // 参加イベント移動の画面で、移動先の候補に人数を出すため
            Admin._matrixBreakdown = {};
            targetEvents.forEach(function(ev, i) { Admin._matrixBreakdown[String(ev.id)] = breakdown[i]; });

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
                    // 0でも緑/黄/赤のまま表示する（2026-07-20ユーザー指示。灰色化しない）
                    '<span class="b-p">' + brk.present + '</span>' +
                    '<span class="b-u">' + brk.unknown + '</span>' +
                    '<span class="b-a">' + brk.absent + '</span>';

                th.appendChild(dateDiv);
                th.appendChild(dowDiv);
                th.appendChild(titleDiv);
                th.appendChild(brkDiv);
                var titleForTooltip = (ev.title || '') + '　参加' + brk.present + '/未回答' + brk.unknown + '/欠席' + brk.absent + '（対象' + brk.target + '人）';

                if (FCOjima.Hub.dutyEnabled) {
                    var dutyAssignment = FCOjima.Hub.getDutyAssignment(ev.id);
                    if (dutyAssignment) {
                        var dutyDiv = document.createElement('div');
                        dutyDiv.className = 'e-duty';
                        dutyDiv.textContent = '🔔' + dutyAssignment.groupName;
                        th.appendChild(dutyDiv);
                        titleForTooltip += '　当番: ' + dutyAssignment.groupName;
                    }
                }
                th.title = titleForTooltip;

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
                        status = Admin._statusFor(evMap, member);
                    }
                    var disp = STATUS_DISP[status] || STATUS_DISP['unknown'];
                    td.textContent = disp.text;
                    td.classList.add(disp.cls);

                    // 同じ日に他の試合・練習がある対象セルはタップで「参加イベント移動」モーダルを開く
                    // （行事は同じ日の試合と両方に出られるため、移動元・移動先にしない）
                    if (status !== 'na' && can('player_move') && FCOjima.PlayerMove.isMovableEvent(ev)) {
                        var sameDayOthers = targetEvents.filter(function(o) {
                            return String(o.id) !== String(ev.id) && o.date === ev.date && FCOjima.PlayerMove.isMovableEvent(o);
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
            // ※ 「未回答が多い選手」サマリーは廃止（2026-07-20ユーザー指示:
            //   面積を取りすぎてマトリクス下部の6年生が見えなくなるため）
            el.appendChild(wrap);

            // 直近イベント列が見えるよう横スクロール位置を調整
            if (upcomingIdx >= 0) {
                requestAnimationFrame(function() {
                    var upTh = wrap.querySelector('.mx-evt.mx-upcoming');
                    if (upTh) {
                        // 左に固定した学年・氏名の列の右端に、直近の予定の列の左端を合わせる（前に列があれば少しだけ見せる）。
                        // 以前は固定列の幅を決め打ちで計算しており、直近の予定が先頭の列のときに、その列の左側が
                        // 固定列の下に潜り込んで日付の頭が切れていた
                        var delta = upTh.getBoundingClientRect().left - thName.getBoundingClientRect().right;
                        if (upcomingIdx > 0) delta -= 8;
                        wrap.scrollLeft = Math.max(0, wrap.scrollLeft + delta);
                    }
                });
            }

        } catch(e) {
            el.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
            console.error('出欠マトリクスエラー:', e);
        }
    };

    // =============================================
    //  送迎の貢献度・公平性の可視化
    // =============================================

    Admin.initDriverStatsModal = function() {
        var btn = document.getElementById('btn-driver-stats');
        var modal = document.getElementById('driver-stats-modal');
        var closeBtn = document.getElementById('driver-stats-modal-close');
        if (!btn || !modal) return;

        btn.addEventListener('click', function() {
            modal.style.display = 'flex';
            Admin.loadDriverStats();
        });
        closeBtn && closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.style.display = 'none';
        });
    };

    /**
     * 今シーズン（直近の4/1〜）の開始日をISO文字列で返す
     * 学年の繰り上げ（Utils.calculateGrade）と同じ4/1基準に揃える
     */
    Admin._seasonStartISO = function() {
        var today = new Date();
        var year = today.getFullYear();
        var apr1 = new Date(year, 3, 1); // 0-indexedで3が4月
        if (today < apr1) year -= 1;
        return year + '-04-01';
    };

    /**
     * 送迎の貢献度（今シーズンの運転回数）を集計して表示
     */
    Admin.loadDriverStats = async function() {
        var container = document.getElementById('driver-stats-container');
        var seasonLabel = document.getElementById('driver-stats-season-label');
        if (!container) return;
        container.innerHTML = '<p class="loading">読み込み中...</p>';

        try {
            var seasonStart = Admin._seasonStartISO();
            if (seasonLabel) {
                seasonLabel.textContent = seasonStart.slice(0, 4) + '年' + seasonStart.slice(5, 7) + '月〜 今シーズンの集計';
            }

            // 1. 今シーズンのイベントのみ取得（過去含む・ナイターも含めて集計対象とする）
            var events = await FCOjima.DB.loadEvents();
            var seasonEvents = events.filter(function(ev) { return ev.date && ev.date >= seasonStart; });

            if (seasonEvents.length === 0) {
                container.innerHTML = '<p style="color:#999;padding:8px;">今シーズンのイベントがありません。</p>';
                return;
            }

            // 2. 各イベントの車両登録を並列取得
            var dataArr = await Promise.all(
                seasonEvents.map(function(ev) { return FCOjima.DB.loadEventData(ev.id); })
            );

            // 3. parent名で運転回数を集計（canDrive!=='no'のみ）
            var counts = {};
            dataArr.forEach(function(data) {
                var regs = (data && data.carRegistrations) ? data.carRegistrations : [];
                regs.forEach(function(reg) {
                    if (!reg.parent || reg.canDrive === 'no') return;
                    counts[reg.parent] = (counts[reg.parent] || 0) + 1;
                });
            });

            var ranked = Object.keys(counts)
                .map(function(name) { return { name: name, count: counts[name] }; })
                .sort(function(a, b) { return b.count - a.count; });

            var maxCount = ranked.length > 0 ? ranked[0].count : 0;

            container.innerHTML = '';

            if (ranked.length > 0) {
                var listTitle = document.createElement('h3');
                listTitle.style.cssText = 'font-size:13px;color:#666;margin:0 0 8px;';
                listTitle.textContent = '運転回数ランキング';
                container.appendChild(listTitle);

                ranked.forEach(function(item) {
                    var row = document.createElement('div');
                    row.className = 'driver-stat-row';
                    var pct = maxCount > 0 ? Math.round(item.count / maxCount * 100) : 0;
                    row.innerHTML =
                        '<span class="driver-stat-name" title="' + FCOjima.UI.escapeHTML(item.name) + '">' + FCOjima.UI.escapeHTML(item.name) + '</span>' +
                        '<span class="driver-stat-bar-track"><span class="driver-stat-bar-fill" style="width:' + pct + '%;"></span></span>' +
                        '<span class="driver-stat-count">' + item.count + '回</span>';
                    container.appendChild(row);
                });
            } else {
                container.innerHTML = '<p style="color:#999;padding:8px;">今シーズンの車両登録がありません。</p>';
            }

            // 一度も運転していない父母（登録0件）も表示 → 声かけの参考になる
            var driverNames = new Set(Object.keys(counts));
            var zeroDrivers = (FCOjima.Hub.members || [])
                .filter(function(m) { return FCOjima.Utils.isGuardian(m) && !driverNames.has(m.name); })
                .map(function(m) { return m.name; });

            if (zeroDrivers.length > 0) {
                var zeroTitle = document.createElement('h3');
                zeroTitle.style.cssText = 'font-size:13px;color:#666;margin:16px 0 6px;';
                zeroTitle.textContent = '今シーズン未登録の保護者';
                container.appendChild(zeroTitle);
                var zeroP = document.createElement('p');
                zeroP.className = 'driver-stat-zero';
                zeroP.textContent = zeroDrivers.join('、');
                container.appendChild(zeroP);
            }
        } catch (e) {
            container.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
            console.error('送迎貢献度の集計エラー:', e);
        }
    };

    // =============================================
    //  荷物（共用備品）設定
    // =============================================

    Admin.initLuggageSettingsModal = function() {
        var btn = document.getElementById('btn-luggage-settings');
        var modal = document.getElementById('luggage-settings-modal');
        var closeBtn = document.getElementById('luggage-settings-modal-close');
        var addBtn = document.getElementById('luggage-add-btn');
        var input = document.getElementById('luggage-name-input');
        if (!btn || !modal) return;

        btn.addEventListener('click', function() {
            FCOjima.UI.openModal('luggage-settings-modal');
            Admin.loadLuggageSettings();
        });
        closeBtn && closeBtn.addEventListener('click', function() { FCOjima.UI.closeModal('luggage-settings-modal'); });
        modal.addEventListener('click', function(e) { if (e.target === modal) FCOjima.UI.closeModal('luggage-settings-modal'); });

        addBtn && addBtn.addEventListener('click', async function() {
            var name = (input.value || '').trim();
            if (!name) return;
            try {
                var items = await FCOjima.DB.loadLuggageItems();
                if (items.includes(name)) {
                    alert('「' + name + '」はすでに登録されています');
                    return;
                }
                await FCOjima.DB.addLuggageItem(name);
                input.value = '';
                Admin.loadLuggageSettings();
            } catch (e) {
                alert('荷物の登録に失敗しました: ' + e.message);
            }
        });
    };

    /** 登録済み荷物の一覧をチップで表示（✕で削除） */
    Admin.loadLuggageSettings = async function() {
        var container = document.getElementById('luggage-items-container');
        if (!container) return;
        container.innerHTML = '<p class="loading">読み込み中...</p>';
        try {
            var items = await FCOjima.DB.loadLuggageItems();
            container.innerHTML = '';
            if (items.length === 0) {
                container.innerHTML = '<p style="color:#999;font-size:12px;">荷物がまだ登録されていません。</p>';
                return;
            }
            items.forEach(function(name) {
                var chip = document.createElement('span');
                chip.className = 'duty-member-chip checked';
                chip.appendChild(document.createTextNode(name));
                var rm = document.createElement('button');
                rm.type = 'button';
                rm.className = 'duty-member-remove';
                rm.textContent = '✕';
                rm.title = name + ' を削除';
                rm.addEventListener('click', async function() {
                    if (!confirm('「' + name + '」を削除しますか？')) return;
                    try {
                        await FCOjima.DB.removeLuggageItem(name);
                        Admin.loadLuggageSettings();
                    } catch (e) {
                        alert('削除に失敗しました: ' + e.message);
                    }
                });
                chip.appendChild(rm);
                container.appendChild(chip);
            });
        } catch (e) {
            container.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
        }
    };

    // =============================================
    //  選手の参加率
    // =============================================

    Admin.initAttendanceRateModal = function() {
        var btn = document.getElementById('btn-attendance-rate');
        var modal = document.getElementById('attendance-rate-modal');
        var closeBtn = document.getElementById('attendance-rate-modal-close');
        if (!btn || !modal) return;
        btn.addEventListener('click', function() {
            FCOjima.UI.openModal('attendance-rate-modal');
            Admin.loadAttendanceRates();
        });
        closeBtn && closeBtn.addEventListener('click', function() { FCOjima.UI.closeModal('attendance-rate-modal'); });
        modal.addEventListener('click', function(e) { if (e.target === modal) FCOjima.UI.closeModal('attendance-rate-modal'); });
    };

    /**
     * 選手ごとの参加率を集計して表示する。
     * 集計対象: 今シーズンの消化済みイベント（今日まで・ナイター除く）のうち
     * その選手が対象（対象学年 or 学年外追加）だったもの。
     * 参加＝出欠で「参加」と回答していたイベント数。
     * 表示順: 6年→年少の学年降順、同学年は名前順
     */
    Admin.loadAttendanceRates = async function() {
        var container = document.getElementById('attendance-rate-container');
        var seasonLabel = document.getElementById('attendance-rate-season-label');
        if (!container) return;
        container.innerHTML = '<p class="loading">読み込み中...</p>';

        try {
            var seasonStart = Admin._seasonStartISO();
            var now = new Date();
            var todayISO = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
            if (seasonLabel) {
                seasonLabel.textContent = seasonStart.slice(0, 4) + '年' + seasonStart.slice(5, 7) + '月〜本日までの消化済みイベント（ナイター除く）で集計';
            }

            var events = await FCOjima.DB.loadEvents();
            var doneEvents = events.filter(function(ev) {
                return ev.type !== 'nighter' && ev.date && ev.date >= seasonStart && ev.date <= todayISO;
            });

            if (doneEvents.length === 0) {
                container.innerHTML = '<p style="color:#999;padding:8px;">集計対象のイベントがまだありません。</p>';
                return;
            }

            var dataArr = await Promise.all(
                doneEvents.map(function(ev) { return FCOjima.DB.loadEventData(ev.id); })
            );

            // 対象判定（共通ヘルパーに委譲。出欠マトリクスと完全に同じ定義。参加者から外した人は除く）
            var isTargetFor = function(m, ev) {
                if (!FCOjima.Utils.isTargetFor(m, ev)) return false;
                var i = doneEvents.indexOf(ev);
                return !(i >= 0 && FCOjima.Utils.isRemovedFromEvent(m, dataArr[i]));
            };

            var gradeNumMap = { '年少': -3, '年中': -2, '年長': -1 };
            function gradeVal(g) {
                if (gradeNumMap[g] !== undefined) return gradeNumMap[g];
                var n = parseInt(g, 10);
                return isNaN(n) ? -99 : n;
            }

            var players = (FCOjima.Hub.members || [])
                .filter(function(m) { return m.role === 'player'; })
                .slice()
                .sort(function(a, b) {
                    var d = gradeVal(b.grade) - gradeVal(a.grade); // 6年が先頭
                    if (d !== 0) return d;
                    return (a.name || '').localeCompare(b.name || '', 'ja');
                });

            var rows = players.map(function(m) {
                var targetN = 0, presentN = 0;
                doneEvents.forEach(function(ev, i) {
                    if (!isTargetFor(m, ev)) return;
                    targetN++;
                    var att = (dataArr[i] && dataArr[i].attendance) || [];
                    var rec = att.find(function(a) {
                        return (a.memberId != null && String(a.memberId) === String(m.id)) || a.name === m.name ||
                            (m.formerNames || []).indexOf(a.name) !== -1;
                    });
                    if (rec && rec.status === 'present') presentN++;
                });
                var pct = targetN > 0 ? Math.round(presentN / targetN * 100) : null;
                return { member: m, target: targetN, present: presentN, pct: pct };
            });

            container.innerHTML = '';
            var esc = FCOjima.UI.escapeHTML;
            var currentGrade = null;
            rows.forEach(function(r) {
                var g = r.member.grade || '未設定';
                if (g !== currentGrade) {
                    currentGrade = g;
                    var gh = document.createElement('h3');
                    gh.style.cssText = 'font-size:13px;color:#666;margin:14px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px;';
                    gh.textContent = FCOjima.Utils.getGradeLabel ? FCOjima.Utils.getGradeLabel(g) : g;
                    container.appendChild(gh);
                }
                var row = document.createElement('div');
                row.className = 'driver-stat-row';
                var pctText = (r.pct === null) ? '対象なし' : r.pct + '％';
                var barPct = r.pct === null ? 0 : r.pct;
                row.innerHTML =
                    '<span class="driver-stat-name" title="' + esc(r.member.name) + '">' + esc(r.member.name) + '</span>' +
                    '<span class="driver-stat-bar-track"><span class="driver-stat-bar-fill" style="width:' + barPct + '%;"></span></span>' +
                    '<span class="rate-stat-detail">' + r.present + '/' + r.target + '回　<b>' + pctText + '</b></span>';
                container.appendChild(row);
            });
        } catch (e) {
            container.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
            console.error('参加率の集計エラー:', e);
        }
    };

    // =============================================
    //  当番表（グループ設定）
    // =============================================

    var _dutyGroups = null;   // 読み込み済みグループ一覧のキャッシュ
    var _dutySettings = null;

    Admin.initDutyGroupsModal = function() {
        var btn = document.getElementById('btn-duty-groups');
        var modal = document.getElementById('duty-groups-modal');
        var closeBtn = document.getElementById('duty-groups-modal-close');
        var addBtn = document.getElementById('duty-group-add-btn');
        var toggle = document.getElementById('duty-enabled-toggle');
        if (!btn || !modal) return;

        btn.addEventListener('click', function() {
            modal.style.display = 'flex';
            Admin.loadDutyGroups();
        });
        closeBtn && closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', function(e) {
            if (e.target === modal) modal.style.display = 'none';
        });
        addBtn && addBtn.addEventListener('click', function() {
            var name = prompt('グループ名を入力してください（例: Aグループ）');
            if (!name || !name.trim()) return;
            Admin.createDutyGroup(name.trim());
        });
        toggle && toggle.addEventListener('change', function() {
            Admin.saveDutyEnabled(toggle.checked);
        });
    };

    /**
     * 当番表機能のON/OFF設定＋グループ一覧を読み込んで表示
     */
    Admin.loadDutyGroups = async function() {
        var container = document.getElementById('duty-groups-container');
        var toggle = document.getElementById('duty-enabled-toggle');
        if (!container) return;
        container.innerHTML = '<p class="loading">読み込み中...</p>';

        try {
            var settings = await FCOjima.DB.loadDutySettings();
            _dutySettings = settings;
            FCOjima.Hub.dutyEnabled = !!settings.enabled;
            if (toggle) toggle.checked = !!settings.enabled;

            var groups = await FCOjima.DB.loadDutyGroups();
            _dutyGroups = groups;
            FCOjima.Hub.dutyGroups = groups;

            // 候補メンバー: 指導者（coach/assist）・父・母・役員（役員も子供が所属している保護者）
            var candidates = (FCOjima.Hub.members || []).filter(function(m) {
                return ['coach', 'assist', 'father', 'mother', 'officer'].includes(m.role);
            });

            container.innerHTML = '';
            if (groups.length === 0) {
                container.innerHTML = '<p style="color:#999;padding:8px;">グループがまだありません。「グループを追加」から作成してください。</p>';
                return;
            }

            groups.forEach(function(group) {
                container.appendChild(Admin._buildDutyGroupCard(group, candidates));
            });
        } catch (e) {
            container.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
            console.error('当番グループの読み込みエラー:', e);
        }
    };

    /** 1グループ分のカードDOMを構築 */
    Admin._buildDutyGroupCard = function(group, candidates) {
        var UI = FCOjima.UI;
        var card = document.createElement('div');
        card.className = 'duty-group-card';

        var head = document.createElement('div');
        head.className = 'duty-group-head';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'duty-group-name';
        nameSpan.textContent = group.name;
        var renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'duty-group-icon-btn';
        renameBtn.textContent = '✏️';
        renameBtn.title = 'グループ名を変更';
        renameBtn.addEventListener('click', function() {
            var newName = prompt('グループ名を変更', group.name);
            if (!newName || !newName.trim() || newName.trim() === group.name) return;
            Admin.renameDutyGroup(group, newName.trim());
        });
        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'duty-group-icon-btn';
        delBtn.textContent = '🗑️';
        delBtn.title = 'グループを削除';
        delBtn.addEventListener('click', function() {
            if (!confirm('「' + group.name + '」を削除しますか？（所属メンバーの割り当ても削除されます）')) return;
            Admin.deleteDutyGroup(group);
        });
        head.appendChild(nameSpan);
        head.appendChild(renameBtn);
        head.appendChild(delBtn);
        card.appendChild(head);

        // メンバー表示: 「所属メンバーの一覧＋✕削除」＋「selectで追加」方式。
        // 旧実装（全候補チェックボックスのタップでトグル）は実機モバイルChromeで
        // 2度タップ不良が報告されたため、ネイティブUI（button/select）のみで構成する。
        // グループは作成時メンバー0人で、あとから追加していく。他グループとの重複所属OK
        var MEMBER_ROLE_LABELS = { coach: '監督', assist: 'コーチ', father: '父', mother: '母', officer: '役員' };
        var memberIds = (group.memberIds || []).map(String);
        var body = document.createElement('div');
        body.className = 'duty-group-members';

        var currentMembers = memberIds
            .map(function(id) { return candidates.find(function(m) { return String(m.id) === id; }); })
            .filter(Boolean);

        if (currentMembers.length === 0) {
            var emptyP = document.createElement('p');
            emptyP.style.cssText = 'color:#999;font-size:12px;margin:4px 0;';
            emptyP.textContent = 'メンバーがいません。下の「＋メンバーを追加」から追加してください。';
            body.appendChild(emptyP);
        } else {
            currentMembers.forEach(function(m) {
                var chip = document.createElement('span');
                chip.className = 'duty-member-chip checked';
                chip.appendChild(document.createTextNode(m.name + (MEMBER_ROLE_LABELS[m.role] ? '（' + MEMBER_ROLE_LABELS[m.role] + '）' : '')));
                var rm = document.createElement('button');
                rm.type = 'button';
                rm.className = 'duty-member-remove';
                rm.textContent = '✕';
                rm.title = m.name + ' をグループから外す';
                rm.addEventListener('click', function() {
                    Admin.removeDutyGroupMemberUI(group, m.id);
                });
                chip.appendChild(rm);
                body.appendChild(chip);
            });
        }
        card.appendChild(body);

        // 追加用select（所属済みは選択肢から除外。ネイティブUIなので実機タップ問題が起きない）
        var addable = candidates.filter(function(m) { return !memberIds.includes(String(m.id)); });
        if (addable.length > 0) {
            var sel = document.createElement('select');
            sel.className = 'duty-add-select';
            var ph = document.createElement('option');
            ph.value = '';
            ph.textContent = '＋ メンバーを追加...';
            sel.appendChild(ph);
            addable.forEach(function(m) {
                var opt = document.createElement('option');
                opt.value = String(m.id);
                opt.textContent = m.name + (MEMBER_ROLE_LABELS[m.role] ? '（' + MEMBER_ROLE_LABELS[m.role] + '）' : '');
                sel.appendChild(opt);
            });
            sel.addEventListener('change', function() {
                if (!sel.value) return;
                Admin.addDutyGroupMemberUI(group, sel.value);
            });
            card.appendChild(sel);
        } else if (candidates.length === 0) {
            var noCand = document.createElement('p');
            noCand.style.cssText = 'color:#999;font-size:12px;margin:4px 0;';
            noCand.textContent = '指導者・父・母・役員のメンバーが登録されていません。';
            card.appendChild(noCand);
        }
        return card;
    };

    /** グループにメンバーを追加（追加後に一覧を再描画） */
    Admin.addDutyGroupMemberUI = async function(group, memberId) {
        try {
            await FCOjima.DB.addDutyGroupMember(group.id, String(memberId));
            Admin.loadDutyGroups();
        } catch (e) {
            alert('メンバーの追加に失敗しました: ' + e.message);
            Admin.loadDutyGroups();
        }
    };

    /** グループからメンバーを外す（削除後に一覧を再描画） */
    Admin.removeDutyGroupMemberUI = async function(group, memberId) {
        try {
            await FCOjima.DB.removeDutyGroupMember(group.id, String(memberId));
            Admin.loadDutyGroups();
        } catch (e) {
            alert('メンバーの削除に失敗しました: ' + e.message);
            Admin.loadDutyGroups();
        }
    };

    Admin.saveDutyEnabled = async function(enabled) {
        var prevEnabled = _dutySettings ? !!_dutySettings.enabled : false;
        try {
            await FCOjima.DB.saveDutySettings({ enabled: enabled });
            _dutySettings = { enabled: enabled };
            FCOjima.Hub.dutyEnabled = enabled;
        } catch (e) {
            alert('設定の保存に失敗しました: ' + e.message);
            var toggle = document.getElementById('duty-enabled-toggle');
            if (toggle) toggle.checked = prevEnabled;
        }
    };

    Admin.createDutyGroup = async function(name) {
        try {
            await FCOjima.DB.saveDutyGroup({ name: name, memberIds: [] });
            Admin.loadDutyGroups();
        } catch (e) {
            alert('グループの作成に失敗しました: ' + e.message);
        }
    };

    Admin.renameDutyGroup = async function(group, newName) {
        try {
            // メンバーの追加・削除はarrayUnion/arrayRemoveで行っているため、ここで手元の
            // memberIds を書き戻すと、開いた後に他の人が追加したメンバーが消える。名前だけ更新する
            await FCOjima.DB.saveDutyGroup({ id: group.id, name: newName });
            // 割り当て側に保存されている名前も揃える（表示は getDutyAssignment で現在の名前を引く）
            await FCOjima.DB.renameDutyAssignmentsGroup(group.id, newName);
            (FCOjima.Hub.dutyAssignments || []).forEach(function(a) {
                if (String(a.groupId) === String(group.id)) a.groupName = newName;
            });
            await Admin.loadDutyGroups();
            Admin._refreshDutyViews();
        } catch (e) {
            alert('グループ名の変更に失敗しました: ' + e.message);
        }
    };

    Admin.deleteDutyGroup = async function(group) {
        try {
            await FCOjima.DB.deleteDutyGroup(group.id);
            // このグループを割り当てていた予定の割り当ても消す（残すと削除したグループが
            // 予定の「当番」に出続けていた）
            await FCOjima.DB.deleteDutyAssignmentsForGroup(group.id);
            FCOjima.Hub.dutyAssignments = (FCOjima.Hub.dutyAssignments || []).filter(function(a) {
                return String(a.groupId) !== String(group.id);
            });
            await Admin.loadDutyGroups();
            Admin._refreshDutyViews();
        } catch (e) {
            alert('グループの削除に失敗しました: ' + e.message);
        }
    };

    /** 当番の表示（出欠マトリクス・参加予定）を最新の割り当てで描き直す */
    Admin._refreshDutyViews = function() {
        var matrixEl = document.getElementById('attendance-matrix-container');
        if (matrixEl && matrixEl.querySelector('.attendance-matrix')) Admin.loadAttendanceMatrix();
        var Me = FCOjima.Hub.MyEvents;
        if (Me && Me.refresh) {
            Me.refresh().then(function() {
                var tab = document.getElementById('my-events');
                if (tab && tab.style.display !== 'none' && Me.renderList) Me.renderList(false);
            }).catch(function() {});
        }
    };

    /**
     * イベントに当番グループを割り当てる（管理者のみ）。
     * 連絡事項に自動通知を投稿する。
     * @param {Object} ev - イベント
     * @param {string} groupId - 当番グループID（空文字なら割り当て解除）
     */
    Admin.assignDutyGroup = async function(ev, groupId) {
        var Storage = FCOjima.Storage;
        FCOjima.Hub.dutyAssignments = FCOjima.Hub.dutyAssignments || [];
        var group = groupId ? (FCOjima.Hub.dutyGroups || []).find(function(g) { return String(g.id) === String(groupId); }) : null;

        try {
            if (groupId && group) {
                await FCOjima.DB.saveDutyAssignment(ev.id, { groupId: String(groupId), groupName: group.name });
                var idx = FCOjima.Hub.dutyAssignments.findIndex(function(a) { return String(a.eventId) === String(ev.id); });
                var entry = { eventId: String(ev.id), groupId: String(groupId), groupName: group.name };
                if (idx >= 0) FCOjima.Hub.dutyAssignments[idx] = entry;
                else FCOjima.Hub.dutyAssignments.push(entry);
            } else {
                await FCOjima.DB.deleteDutyAssignment(ev.id);
                FCOjima.Hub.dutyAssignments = FCOjima.Hub.dutyAssignments.filter(function(a) { return String(a.eventId) !== String(ev.id); });
            }

            // 連絡事項へ通知
            var now = new Date();
            var dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
                          ' ' + now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            var operator = (FCOjima.Auth && FCOjima.Auth.getDisplayName) ? FCOjima.Auth.getDisplayName() : 'システム';
            var d = new Date(ev.date + 'T00:00:00');
            var evDateLabel = (d.getMonth() + 1) + '/' + d.getDate();
            var notice = {
                id: Date.now().toString() + Math.floor(Math.random() * 1000),
                type: 'duty',
                date: dateStr,
                user: operator,
                text: '【当番】' + evDateLabel + '「' + (ev.title || '') + '」の当番: ' +
                      (group ? group.name : '（未設定に変更されました）'),
                ts: Date.now(),
                eventId: String(ev.id),
                eventDate: ev.date,
                groupId: groupId || null,
                groupName: group ? group.name : null
            };
            Object.assign(notice, FCOjima.Auth.authorStamp ? FCOjima.Auth.authorStamp() : {});
            try {
                await FCOjima.DB.putNotification(notice);
            } catch (e) {
                console.warn('当番のお知らせを投稿できませんでした:', e);
            }
            FCOjima.Hub.notifications = FCOjima.Hub.notifications || [];
            FCOjima.Hub.notifications.unshift(notice);
            Storage.saveNotifications(FCOjima.Hub.notifications);
            if (FCOjima.Hub.Notifications && FCOjima.Hub.Notifications.renderNotifications) {
                FCOjima.Hub.Notifications.renderNotifications();
            }

            // 出欠マトリクスが表示中なら当番バッジを反映
            var matrixEl = document.getElementById('attendance-matrix-container');
            if (matrixEl && matrixEl.querySelector('.attendance-matrix')) {
                Admin.loadAttendanceMatrix();
            }
        } catch (e) {
            alert('当番の割り当てに失敗しました: ' + e.message);
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
        if (!can('player_move')) return;

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
                // 移動先の人数（参加・未回答・不参加）。どの予定が足りないか分かるように
                var brk = (Admin._matrixBreakdown || {})[String(toEv.id)];
                meta.textContent = targetLabel + (toEv.startTime ? '　' + toEv.startTime + '〜' : '') +
                    (brk ? '　参加' + brk.present + '・未回答' + brk.unknown + '・不参加' + brk.absent : '');
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
            // 出欠（移動先: 参加／移動元: 不参加）・学年外追加・変更のお知らせは共通の処理で行う
            // （FCOjima.PlayerMove。予定の詳細・配車管理の出欠ページの「選手を入れる」と同じ）。
            // 学年外追加はその1人だけを追加し、他の人が同時に編集した予定の内容には触れない
            await FCOjima.PlayerMove.move(member, fromEv, toEv);

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
            + '<span style="background:#E8A200;color:#fff;border-radius:12px;padding:2px 10px;font-size:11px;white-space:nowrap;">' + UI.escapeHTML(typeLabel) + '</span>'
            + '</div>';

        // 日時グリッド
        html += '<div style="display:flex;flex-wrap:wrap;gap:10px 20px;margin-bottom:12px;padding:10px 14px;background:#fffbef;border:1px solid #E8A200;border-radius:8px;">';
        // formatDateForDisplay は「2026年10月20日(火)」と曜日込みで返す（曜日を重ねて付けない）
        html += '<div><div style="font-size:11px;color:#888;">日付</div><div style="font-weight:bold;font-size:14px;">'
            + Utils.formatDateForDisplay(ev.date) + '</div></div>';
        if (ev.startTime) {
            html += '<div><div style="font-size:11px;color:#888;">時間</div><div style="font-weight:bold;font-size:14px;">'
                + UI.escapeHTML(ev.startTime) + (ev.endTime ? ' 〜 ' + UI.escapeHTML(ev.endTime) : '') + '</div></div>';
        }
        if (ev.departureTime) {
            html += '<div><div style="font-size:11px;color:#888;">出発時間</div><div style="font-weight:bold;font-size:14px;">' + UI.escapeHTML(ev.departureTime) + '</div></div>';
        }
        html += '</div>';

        // 場所情報
        var venues = (FCOjima.Storage && FCOjima.Storage.loadVenues) ? FCOjima.Storage.loadVenues() : [];
        if (ev.meetingPlace) {
            var mv = venues.find(function(v) { return v.name === ev.meetingPlace; });
            var mq = FCOjima.Utils.encodeForOnclick((mv && mv.address) ? mv.address : ev.meetingPlace);
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;">'
                + '<span style="color:#888;min-width:52px;">集合場所</span>'
                + '<span>' + UI.escapeHTML(ev.meetingPlace) + '</span>'
                + '<button onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' + mq + '\',\'_blank\')" style="margin-left:auto;background:#E8A200;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap;">地図を開く</button>'
                + '</div>';
        }
        if (ev.venue) {
            var vv = venues.find(function(v) { return v.name === ev.venue; });
            var vq = FCOjima.Utils.encodeForOnclick((vv && vv.address) ? vv.address : ev.venue);
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px;flex-wrap:wrap;">'
                + '<span style="color:#888;min-width:52px;">会場</span>'
                + '<span>' + UI.escapeHTML(ev.venue) + '</span>'
                + '<button onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' + vq + '\',\'_blank\')" style="margin-left:auto;background:#E8A200;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;white-space:nowrap;">地図を開く</button>'
                + '</div>'
                // ※ カレンダーのイベント詳細モーダルも id="event-weather-<ID>" を使うため、
                //   同じIDだと閉じた方のモーダルに天気が差し込まれ、こちらに表示されなかった
                + '<div data-admin-weather-slot></div>';
        }

        // 対象学年
        if (ev.target && ev.target.length > 0) {
            var grades = ev.target.map(function(g) { return UI.escapeHTML(Utils.getGradeLabel(g)); }).join('、');
            html += '<div style="margin-bottom:8px;font-size:13px;"><span style="color:#888;">対象: </span>' + grades + '</div>';
        }

        // 持ち物チェックリスト＋荷物
        if (FCOjima.Checklist) {
            html += FCOjima.Checklist.formatChips(ev.type, ev.checklistExtra, ev.checklist);
            html += FCOjima.Checklist.formatLuggage(ev.luggage);
        }

        // 当番グループ割り当て（機能が有効な場合のみ・当番の権限がある人が変更可）
        if (FCOjima.Hub.dutyEnabled && can('duty')) {
            var dutyGroups = FCOjima.Hub.dutyGroups || [];
            var currentAssignment = FCOjima.Hub.getDutyAssignment(ev.id);
            html += '<div style="display:flex;align-items:center;gap:8px;margin:8px 0;font-size:13px;">'
                + '<span style="color:#888;min-width:52px;">当番</span>'
                + '<select id="event-duty-select" data-event-id="' + UI.escapeHTML(String(ev.id)) + '" style="padding:4px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;flex:1;max-width:220px;">'
                + '<option value="">未設定</option>'
                + dutyGroups.map(function(g) {
                    var selected = currentAssignment && String(currentAssignment.groupId) === String(g.id) ? ' selected' : '';
                    return '<option value="' + UI.escapeHTML(String(g.id)) + '"' + selected + '>' + UI.escapeHTML(g.name) + '</option>';
                  }).join('')
                + '</select>'
                + '</div>';
        }

        // 備考（イベントのフィールド名は notes。旧データの description にも対応）
        var evNotes = ev.notes || ev.description;
        if (evNotes) {
            html += '<div style="margin-top:8px;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-size:13px;white-space:pre-wrap;">'
                + UI.escapeHTML(evNotes) + '</div>';
        }

        body.innerHTML = html;
        modal.style.display = 'flex';

        // 当番グループ選択の変更を保存
        var dutySelect = document.getElementById('event-duty-select');
        if (dutySelect) {
            dutySelect.addEventListener('change', function() {
                Admin.assignDutyGroup(ev, dutySelect.value);
            });
        }

        // 会場の天気（非同期。取得失敗してもモーダル自体は壊れない）
        if (ev.venue && FCOjima.Weather && FCOjima.Weather.getDailyForecast) {
            var weatherTarget = body.querySelector('[data-admin-weather-slot]');
            if (weatherTarget) {
                var venueDataForWeather = venues.find(function(v) { return v.name === ev.venue; });
                var weatherAddr = venueDataForWeather && venueDataForWeather.address;
                weatherTarget.innerHTML = '<span class="weather-chip weather-chip-muted">天気を取得中...</span>';
                FCOjima.Weather.getDailyForecast(ev.venue, weatherAddr, ev.date, ev).then(function(result) {
                    // 取得中に別のイベントを開き直していたら差し込まない
                    if (weatherTarget.isConnected) {
                        weatherTarget.innerHTML = FCOjima.Weather.formatWidget(result, ev.venue, weatherAddr);
                    }
                });
            }
        }

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

    // 添付ファイルの実装は FCOjima.EventFiles（共通モジュール）に集約。
    // 種類・サイズ制限（PDF/Excel/Word/画像/テキスト・10MB）もそちらで一元管理
    Admin.loadEventFiles = function(eventId) {
        return FCOjima.EventFiles.render(eventId, document.getElementById('event-files-list'));
    };

    Admin.uploadEventFiles = function(eventId, files) {
        return FCOjima.EventFiles.upload(eventId, files, document.getElementById('event-files-list'));
    };

})(window.FCOjima);
