/**
 * FC尾島ジュニア - 権限の設定（管理タブ「🔐 権限の設定」）
 *
 * 役割ごと（監督・コーチ・役員・保護者）に、機能を使えるかを ON/OFF する。管理者の欄は固定（常にすべて使える）。
 *  - 開けるのは 管理者・監督・コーチ・役員
 *  - 変えられるのは自分より下の役割の欄だけ（管理者 ＞ 監督 ＞ コーチ ＞ 役員 ＞ 保護者）。自分の役割の欄も変えられない
 *  - 自分が使えない機能は、下の役割にも付けられない（外すことはできる）
 *  - 保護者には管理タブの中の機能は付けられない
 * 機能・初期値は js/common/permissions.js、守らせるのは firestore.rules（settings/permissions）。
 * 押すとすぐ保存する。ほかの人の画面には、その人が次に開いたときに反映される
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.PermSettings = FCOjima.Hub.PermSettings || {};

(function(app) {
    var PS = app.Hub.PermSettings;
    var P = app.Perm;
    var COLS = ['admin', 'coach', 'assist', 'officer', 'parent'];

    function esc(s) { return app.UI.escapeHTML(String(s == null ? '' : s)); }
    function myRole() { var p = app.Auth.currentUserProfile; return p ? p.role : ''; }

    PS.init = function() {
        var btn = document.getElementById('btn-permissions');
        if (btn) btn.addEventListener('click', function() { PS.open(); });
    };

    function ensureModal() {
        var modal = document.getElementById('perm-settings-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'perm-settings-modal';
        modal.className = 'modal';
        modal.innerHTML = '<div class="modal-content ps-content"><span class="close" aria-label="閉じる">&times;</span>' +
            '<h2 class="ps-title">🔐 権限の設定</h2><div class="ps-body"></div></div>';
        document.body.appendChild(modal);
        var close = function() { modal.style.display = 'none'; };
        modal.querySelector('.close').addEventListener('click', close);
        modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
        return modal;
    }

    /** 権限の設定を開く（管理者・監督・コーチ・役員） */
    PS.open = async function() {
        if (!(app.Auth.isManager && app.Auth.isManager())) {
            app.UI.showAlert('権限の設定を開けるのは、管理者・監督・コーチ・役員です', 'warning');
            return;
        }
        var modal = ensureModal();
        modal.querySelector('.ps-body').innerHTML = '<p class="loading">読み込み中...</p>';
        modal.style.display = 'flex';
        try { await app.Auth.loadPermissions(); } catch (e) { /* 初期値で出す */ }
        PS.render();
    };

    /**
     * その欄（役割×機能）を自分が変えられるか
     * @returns {string} '' なら変えられる。変えられなければ理由
     */
    PS.lockReason = function(role, key) {
        var me = myRole();
        if (role === 'admin') return '管理者の権限は変えられません';
        if (!P.applicable(role, key)) return '保護者には付けられない機能です';
        if (P.lowerRoles(me).indexOf(role) === -1) return role === me ? '自分の役割の欄は変えられません' : '自分より上の役割の欄は変えられません';
        var on = P.can(role, key, app.Auth.permissions);
        if (!on && !app.Auth.can(key)) return '自分が使えない機能は付けられません';
        return '';
    };

    PS.render = function() {
        var modal = document.getElementById('perm-settings-modal');
        if (!modal) return;
        var body = modal.querySelector('.ps-body');
        var perms = app.Auth.permissions || {};
        var me = myRole();
        var html = '<details class="ps-rules"><summary>役割のきまり（変えられません）</summary><ul>' +
            P.RULES_TEXT.map(function(t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>';
        html += '<p class="ps-lead">押すと切り替わり、すぐ保存されます。あなた（' + esc(P.LABEL[me] || me) + '）が変えられるのは ' +
            (P.lowerRoles(me).length ? esc(P.lowerRoles(me).map(function(r) { return P.LABEL[r]; }).join('・')) + ' の欄' : 'ありません') + '。</p>';
        html += '<div class="ps-table-wrap"><table class="ps-table"><thead><tr><th class="ps-feat">機能</th>' +
            COLS.map(function(r) { return '<th class="ps-role' + (r === me ? ' is-me' : '') + '">' + esc(P.LABEL[r]) + '</th>'; }).join('') +
            '</tr></thead><tbody>';
        var group = '';
        P.FEATURES.forEach(function(f) {
            if (f.group !== group) {
                group = f.group;
                html += '<tr class="ps-group"><th colspan="' + (COLS.length + 1) + '">' + esc(group) + '</th></tr>';
            }
            html += '<tr><th class="ps-feat" scope="row">' + esc(f.label) + (f.desc ? '<small>' + esc(f.desc) + '</small>' : '') + '</th>' +
                COLS.map(function(r) {
                    if (r !== 'admin' && !P.applicable(r, f.key)) return '<td class="ps-cell is-na" title="保護者には付けられない機能です">ー</td>';
                    var on = P.can(r, f.key, perms);
                    var why = PS.lockReason(r, f.key);
                    return '<td class="ps-cell"><button type="button" class="ps-toggle' + (on ? ' is-on' : '') + (why ? ' is-locked' : '') +
                        '" data-role="' + r + '" data-key="' + esc(f.key) + '" aria-pressed="' + on + '"' +
                        ' aria-label="' + esc(P.LABEL[r] + '・' + f.label + '：' + (on ? '使える' : '使えない')) + '"' +
                        (why ? ' disabled title="' + esc(why) + '"' : '') + '>' + (on ? '✓' : '') + '</button></td>';
                }).join('') + '</tr>';
        });
        html += '</tbody></table></div>';
        html += '<p class="ps-note">✓ 使える／空欄 使えない／ー 付けられない。薄い欄は変えられません（管理者・自分と上の役割・自分が使えない機能）。' +
            '役割を変えた人・ほかの人の画面には、その人が次にアプリを開いたときに反映されます。</p>';
        body.innerHTML = html;
        body.querySelectorAll('.ps-toggle:not([disabled])').forEach(function(btn) {
            btn.addEventListener('click', function() { PS.toggle(btn.dataset.role, btn.dataset.key, btn); });
        });
    };

    /** 1つの欄を切り替えて保存する */
    PS.toggle = async function(role, key, btn) {
        if (PS.lockReason(role, key)) return;
        var next = !P.can(role, key, app.Auth.permissions);
        if (btn) btn.disabled = true;
        try {
            await app.DB.setPermission(role, key, next);
        } catch (e) {
            console.warn('権限を保存できませんでした:', e);
            app.UI.showAlert('保存できませんでした（権限がないか、通信できませんでした）', 'error', 6000);
            PS.render();
            return;
        }
        var perms = app.Auth.permissions = app.Auth.permissions || {};
        perms[role] = Object.assign({}, perms[role] || {});
        perms[role][key] = next;
        var f = P.feature(key);
        app.UI.showAlert(P.LABEL[role] + '：「' + (f ? f.label : key) + '」を' + (next ? '使えるように' : '使えないように') + 'しました', 'success');
        PS.render();
    };
})(window.FCOjima);
