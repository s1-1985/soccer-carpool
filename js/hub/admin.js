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

    /**
     * 管理タブの初期化
     */
    Admin.init = function() {
        console.log('管理タブを初期化しています...');
        Admin.refresh();
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
        el.innerHTML = '<p class="loading">読み込み中...</p>';

        try {
            var users = await FCOjima.DB.loadPendingUsers();
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

    /**
     * 承認待ちカードを作成
     */
    Admin.createPendingCard = function(u) {
        var members = app.Hub.members || [];
        var childNames = (u.childrenIds || []).map(function(cid) {
            var m = members.find(function(mem) { return String(mem.id) === String(cid); });
            return m ? m.name : cid;
        }).join('、') || '（なし）';

        var card = document.createElement('div');
        card.style.cssText = 'border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:12px;background:#fff;';
        card.innerHTML =
            '<div style="font-weight:bold;margin-bottom:4px;">' + (UI ? UI.escapeHTML(u.name || '') : (u.name || '')) + '</div>' +
            '<div style="font-size:13px;color:#666;">メール: ' + (u.email || '不明') + '</div>' +
            '<div style="font-size:13px;color:#666;">性別: ' + (u.gender === 'male' ? '男性' : u.gender === 'female' ? '女性' : '不明') + '</div>' +
            '<div style="font-size:13px;color:#666;">子供: ' + childNames + '</div>' +
            '<div style="font-size:12px;color:#aaa;margin-top:4px;">申請日時: ' + (u.registeredAt ? new Date(u.registeredAt.seconds * 1000).toLocaleString('ja-JP') : '不明') + '</div>' +
            '<div style="display:flex;gap:8px;margin-top:10px;">' +
                '<button class="approve-btn" data-uid="' + u.uid + '" style="flex:1;padding:8px;background:#2ecc71;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">承認</button>' +
                '<button class="reject-btn" data-uid="' + u.uid + '" style="flex:1;padding:8px;background:#e74c3c;color:white;border:none;border-radius:6px;cursor:pointer;">却下</button>' +
            '</div>';

        card.querySelector('.approve-btn').addEventListener('click', function() {
            Admin.approveUser(u.uid, u.name);
        });
        card.querySelector('.reject-btn').addEventListener('click', function() {
            Admin.rejectUser(u.uid, u.name);
        });

        return card;
    };

    /**
     * ユーザーを承認
     */
    Admin.approveUser = async function(uid, name) {
        if (!confirm((name || uid) + ' を承認しますか？')) return;
        try {
            var currentUid = app.Auth && app.Auth.getCurrentUser() ? app.Auth.getCurrentUser().uid : null;
            await FCOjima.DB.approveUser(uid, currentUid);
            if (UI) UI.showAlert((name || uid) + ' を承認しました', 'success');
            Admin.refresh();
        } catch(e) {
            if (UI) UI.showAlert('承認に失敗しました: ' + e.message, 'error');
        }
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
            var approved = users.filter(function(u) { return u.status === 'approved'; });
            if (approved.length === 0) {
                el.innerHTML = '<p style="color:#999;padding:8px;">登録済みユーザーはいません。</p>';
                return;
            }
            el.innerHTML = '';
            var members = app.Hub.members || [];

            approved.forEach(function(u) {
                var childNames = (u.childrenIds || []).map(function(cid) {
                    var m = members.find(function(mem) { return String(mem.id) === String(cid); });
                    return m ? m.name : cid;
                }).join('、') || '（なし）';

                var row = document.createElement('div');
                row.style.cssText = 'border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:8px;background:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;';

                var info = document.createElement('div');
                info.innerHTML =
                    '<div style="font-weight:bold;">' + (UI ? UI.escapeHTML(u.name || '') : (u.name || '')) + '</div>' +
                    '<div style="font-size:12px;color:#888;">' + (u.email || '') + '</div>' +
                    '<div style="font-size:12px;color:#888;">子供: ' + childNames + '</div>';

                var ctrl = document.createElement('div');
                ctrl.style.display = 'flex';
                ctrl.style.gap = '6px';
                ctrl.style.alignItems = 'center';

                var select = document.createElement('select');
                select.style.cssText = 'padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;';
                Object.keys(ROLE_LABELS).forEach(function(role) {
                    var opt = document.createElement('option');
                    opt.value = role;
                    opt.textContent = ROLE_LABELS[role];
                    if (u.role === role) opt.selected = true;
                    select.appendChild(opt);
                });

                // admin role の変更は admin のみ可能
                var currentProfile = app.Auth && app.Auth.currentUserProfile;
                if (u.uid === (currentProfile && currentProfile.uid)) {
                    select.disabled = true;
                    select.title = '自分の役割は変更できません';
                }

                var saveBtn = document.createElement('button');
                saveBtn.textContent = '変更';
                saveBtn.style.cssText = 'padding:4px 10px;font-size:12px;';
                saveBtn.addEventListener('click', function() {
                    Admin.updateRole(u.uid, select.value, u.name);
                });

                ctrl.appendChild(select);
                ctrl.appendChild(saveBtn);
                row.appendChild(info);
                row.appendChild(ctrl);
                el.appendChild(row);
            });
        } catch(e) {
            el.innerHTML = '<p style="color:#c00;">読み込みエラー: ' + e.message + '</p>';
        }
    };

    /**
     * ユーザー役割を変更
     */
    Admin.updateRole = async function(uid, newRole, name) {
        try {
            await FCOjima.DB.updateUserRole(uid, newRole);
            if (UI) UI.showAlert((name || uid) + ' の役割を「' + (ROLE_LABELS[newRole] || newRole) + '」に変更しました', 'success');
        } catch(e) {
            if (UI) UI.showAlert('変更に失敗しました: ' + e.message, 'error');
        }
    };

})(window.FCOjima);
