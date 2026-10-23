/**
 * FC尾島ジュニア - 役割（ロール）と機能ごとの権限
 *
 * 役割: 管理者（admin）＞ 監督（coach）＞ コーチ（assist）＞ 役員（officer）＞ 保護者（parent）
 *
 * 固定のきまり（設定では変えられない。firestore.rules でも同じことを確かめる）
 *  - 管理者はすべての権限を持つ。管理者に対する操作（役割・承認・名前の変更、管理者が書いた連絡事項の削除）は管理者だけ
 *  - 監督は1人だけ。最初は管理者が指定し、監督は次の監督を指名できる（指名すると前の監督はコーチになる）
 *  - コーチを任命・解任できるのは 管理者・監督・コーチ。役員を任命・解任できるのは 管理者・監督・コーチ・役員
 *  - 操作ログを削除できるのは管理者だけ
 *  - 権限の設定の画面を開けるのは 管理者・監督・コーチ・役員。変えられるのは自分より下の役割の欄だけで、
 *    自分が持っていない権限は付けられない。管理者の欄はだれも変えられない
 *
 * 機能ごとの権限（権限の設定で役割ごとに ON/OFF）の保存先: teams/{チーム}/settings/permissions
 *   { coach: { 機能: true/false }, assist: {...}, officer: {...}, parent: {...} }
 *   書かれていない機能は初期値（下の FEATURES の def。以前の動きと同じ）
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Perm = FCOjima.Perm || {};

(function(P) {
    P.ROLES = ['admin', 'coach', 'assist', 'officer', 'parent'];
    P.LABEL = { admin: '管理者', coach: '監督', assist: 'コーチ', officer: '役員', parent: '保護者' };
    P.RANK = { admin: 4, coach: 3, assist: 2, officer: 1, parent: 0 };
    /** 指導者・役員（権限の設定の画面を開ける・管理タブが出る役割） */
    P.STAFF = ['admin', 'coach', 'assist', 'officer'];

    var STAFF3 = ['coach', 'assist', 'officer'];
    /**
     * 機能。parent: 保護者にも付けられるか（管理タブの中の機能は付けられない）、def: 初期値で持っている役割（管理者は常に持つ）
     * ※ firestore.rules の defaultPerm / permFeatures / parentFeatures と同じにすること
     */
    P.FEATURES = [
        { key: 'events', group: '予定・名簿・連絡', label: '予定の追加・編集・削除', parent: true, def: STAFF3.concat(['parent']) },
        { key: 'members', group: '予定・名簿・連絡', label: '名簿（メンバー）の追加・編集・削除', parent: true, def: STAFF3 },
        { key: 'venues', group: '予定・名簿・連絡', label: '会場の登録・編集・削除', parent: true, def: STAFF3 },
        { key: 'notices_delete', group: '予定・名簿・連絡', label: 'ほかの人の連絡の削除', desc: 'チームの連絡事項・予定ごとの連絡。自分の連絡はだれでも消せる', parent: true, def: STAFF3 },
        { key: 'player_move', group: '予定・名簿・連絡', label: '参加者を追加（別の予定・予定のない選手を入れる）', parent: true, def: STAFF3 },
        { key: 'coach_answer', group: '指導者', label: '指導の都合を回答する（自分の分）', parent: true, def: STAFF3 },
        { key: 'coach_plan', group: '指導者', label: '指導者の予定・担当を決める', desc: '担当を決める・代わりに都合を入れる・聞く日を変える', parent: false, def: STAFF3 },
        { key: 'approve', group: '管理タブ', label: '申請の承認・却下', parent: false, def: STAFF3 },
        { key: 'attendance_view', group: '管理タブ', label: '出欠状況・送迎回数・参加率', desc: 'カレンダーの上の「今週の予定の状況」も', parent: false, def: STAFF3 },
        { key: 'duty', group: '管理タブ', label: '当番グループ・当番の割り当て', parent: false, def: STAFF3 },
        { key: 'luggage', group: '管理タブ', label: '荷物の設定', parent: false, def: STAFF3 },
        { key: 'signup_qr', group: '管理タブ', label: '入会用QRコード', parent: false, def: STAFF3 },
        { key: 'logs_view', group: '管理タブ', label: '操作ログを見る', parent: false, def: STAFF3 }
    ];
    var BY_KEY = {};
    P.FEATURES.forEach(function(f) { BY_KEY[f.key] = f; });
    P.feature = function(key) { return BY_KEY[key] || null; };

    /** その役割の欄で付けられる機能か（保護者は管理タブの機能を付けられない） */
    P.applicable = function(role, key) {
        var f = BY_KEY[key];
        if (!f || P.RANK[role] === undefined) return false;
        return role !== 'parent' || !!f.parent;
    };

    /** 初期値（設定に書かれていないとき） */
    P.defaultOf = function(role, key) {
        var f = BY_KEY[key];
        return !!f && f.def.indexOf(role) !== -1;
    };

    /**
     * その役割がその機能を使えるか
     * @param {string} role
     * @param {string} key - 機能
     * @param {Object|null} perms - 権限の設定（settings/permissions）
     */
    P.can = function(role, key, perms) {
        if (role === 'admin') return true;
        if (!P.applicable(role, key)) return false;
        var col = perms && perms[role];
        var v = (col && typeof col === 'object') ? col[key] : undefined;
        return typeof v === 'boolean' ? v : P.defaultOf(role, key);
    };

    /** 自分より下の役割（権限の設定で欄を変えられる役割） */
    P.lowerRoles = function(role) {
        var r = P.RANK[role];
        if (r === undefined || role === 'parent') return [];
        return ['coach', 'assist', 'officer', 'parent'].filter(function(x) { return P.RANK[x] < r; });
    };

    /**
     * その役割を付ける・外すことができるか（固定のきまり）。監督は別（管理者の指定・監督の引き継ぎ。canDesignateKantoku）
     * @param {string} myRole - 操作する人の役割
     * @param {string} role - 付ける／外す役割
     */
    P.canAssignRole = function(myRole, role) {
        if (myRole === 'admin') return true;
        if (role === 'parent') return P.STAFF.indexOf(myRole) !== -1;
        if (role === 'officer') return ['coach', 'assist', 'officer'].indexOf(myRole) !== -1;
        if (role === 'assist') return ['coach', 'assist'].indexOf(myRole) !== -1;
        return false; // 監督・管理者
    };

    /**
     * ある人の役割を from から to に変えられるか（相手が管理者なら管理者だけ）。
     * 監督にする・監督を外すのは管理者だけ（監督本人の引き継ぎは別の操作）
     */
    P.canChangeRole = function(myRole, from, to) {
        if (from === to) return true;
        if ((from === 'admin' || to === 'admin') && myRole !== 'admin') return false;
        if ((from === 'coach' || to === 'coach') && myRole !== 'admin') return false;
        return P.canAssignRole(myRole, from) && P.canAssignRole(myRole, to);
    };

    /** 役割の任命・解任のきまり（画面に出す説明） */
    P.RULES_TEXT = [
        '管理者はすべての権限を持ちます。管理者に対する操作（役割・承認・名前の変更、管理者が書いた連絡事項の削除）は、管理者だけができます',
        '監督は1人だけです。最初は管理者が指定し、監督は次の監督を指名できます（指名すると、前の監督はコーチになります）',
        'コーチを任命・解任できるのは、管理者・監督・コーチです',
        '役員を任命・解任できるのは、管理者・監督・コーチ・役員です',
        '操作ログを削除できるのは、管理者だけです',
        'この画面を開けるのは、管理者・監督・コーチ・役員です。変えられるのは自分より下の役割の欄だけで、自分が持っていない権限は付けられません。管理者の欄はだれも変えられません'
    ];
})(FCOjima.Perm);
