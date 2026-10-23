/**
 * FC尾島ジュニア - 連絡の「新着」（読んだかどうか）
 *
 * 連絡は2か所にある
 *  - チームの連絡事項（HUB の「連絡事項」タブ。notifications コレクション）: ID で覚える
 *  - 予定ごとの連絡（配車の「連絡」。eventData.notifications）: 予定ID と内容（日付・投稿者・本文）で覚える
 * どちらも端末ごと・ユーザーごとに localStorage に覚える（サーバーには書かない）。
 * 自分が書いたものは新着にしない。はじめて使う端末では、チームの連絡事項は7日より前のものを読んだことにする
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Inbox = FCOjima.Inbox || {};

(function(app) {
    var Inbox = app.Inbox;
    var MAX_EVENTS = 100;    // 覚えておく予定の数（古い予定から消す）
    var FIRST_DAYS = 7;      // はじめての端末で新着にするチームの連絡事項（何日前まで）

    function uid() {
        var u = (app.Auth && app.Auth.currentUser) || (window.FCOjimaFirebase && FCOjimaFirebase.auth && FCOjimaFirebase.auth.currentUser);
        return u ? u.uid : 'anon';
    }
    function me() { return (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : ''; }
    function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function teamKey() { return 'fcojima_seen_team_' + uid(); }
    function eventKey() { return 'fcojima_seen_event_' + uid(); }
    function mine(n) { var m = me(); return !!(n && n.user && m && n.user === m); }

    /** 予定ごとの連絡1件の識別（ID が無いため内容から作る） */
    Inbox.noteKey = function(n) {
        var s = [n && n.date, n && n.user, n && n.text].join('|');
        var h = 5381;
        for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        return (h >>> 0).toString(36) + s.length.toString(36);
    };

    /** チームの連絡事項のうち新着（まだ見ていない・自分のでない） */
    Inbox.teamUnread = function(list) {
        list = list || [];
        var seen = load(teamKey());
        if (!Array.isArray(seen)) {
            var cutoff = Date.now() - FIRST_DAYS * 86400000;
            seen = list.filter(function(n) {
                var t = n.ts || new Date(n.date).getTime();
                return !isNaN(t) && t < cutoff;
            }).map(function(n) { return String(n.id); });
            save(teamKey(), seen);
        }
        return list.filter(function(n) { return n && n.id != null && seen.indexOf(String(n.id)) === -1 && !mine(n); });
    };

    /** チームの連絡事項をすべて見たことにする */
    Inbox.markTeamSeen = function(list) {
        save(teamKey(), (list || []).filter(function(n) { return n && n.id != null; }).map(function(n) { return String(n.id); }));
    };

    /** 予定ごとの連絡のうち新着 */
    Inbox.eventUnread = function(eventId, notes) {
        var all = load(eventKey()) || {};
        var seen = all[String(eventId)] || [];
        return (notes || []).filter(function(n) { return n && n.text && seen.indexOf(Inbox.noteKey(n)) === -1 && !mine(n); });
    };

    /** 予定ごとの連絡を見たことにする */
    Inbox.markEventSeen = function(eventId, notes) {
        var all = load(eventKey()) || {};
        delete all[String(eventId)];
        all[String(eventId)] = (notes || []).map(Inbox.noteKey);
        var keys = Object.keys(all);
        if (keys.length > MAX_EVENTS) keys.slice(0, keys.length - MAX_EVENTS).forEach(function(k) { delete all[k]; });
        save(eventKey(), all);
    };

    /**
     * 配車のページの上の「連絡」に新着の件数を出す
     * @param {string} eventId
     * @param {Array} notes - eventData.notifications
     */
    Inbox.renderCarpoolNav = function(eventId, notes) {
        var link = document.querySelector('.carpool-nav a[href="notifications.html"]');
        if (!link || eventId == null) return;
        var n = Inbox.eventUnread(eventId, notes).length;
        var badge = link.querySelector('.nav-badge');
        if (!n) { if (badge) badge.remove(); return; }
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'nav-badge';
            link.appendChild(badge);
        }
        badge.textContent = String(n);
        badge.setAttribute('aria-label', '新着 ' + n + '件');
    };
})(window.FCOjima);
