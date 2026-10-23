/**
 * FC尾島ジュニア - 連絡事項管理（Hub.Notifications）
 * カテゴリなし・ログ付き版
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Notifications = FCOjima.Hub.Notifications || {};

(function(app) {
    var Notifications = app.Hub.Notifications;
    var UI = app.UI;
    var Storage = app.Storage;

    var EVENT_NOTE_DAYS = 30;   // 予定ごとの連絡を出す予定（今日から何日先まで）
    var EVENT_NOTE_SHOW = 3;    // 1つの予定で出す連絡の数（新しい順）
    var _eventNotes = [];       // [{ ev, notes }]（連絡のある予定だけ）
    var _newTeam = {};          // タブを開いたときに新着だったチームの連絡事項のID
    var _newEvent = {};         // 同じく予定ごとの連絡（予定ID → 連絡のキーの一覧）

    Notifications.init = function() {
        console.log('連絡事項機能を初期化しています...');
        this.setupEventListeners();
        this.renderNotifications();
        // 予定ごとの連絡を読み、タブ・やることに新着の件数を出す
        Notifications.loadEventNotes().then(function() {
            Notifications.updateBadge();
            if (app.Hub.Home && app.Hub.Home.render) app.Hub.Home.render();
        });
        console.log('連絡事項機能の初期化が完了しました');
    };

    function todayISO() {
        var d = new Date();
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    /**
     * これからの予定（今日から30日・ナイター練習を除く）の「連絡」（配車の連絡）を読む。
     * 以前は予定ごとの連絡は配車のページを開かないと見られず、HUB の連絡事項と2か所に分かれていた
     */
    Notifications.loadEventNotes = async function() {
        var from = todayISO();
        var end = new Date(); end.setDate(end.getDate() + EVENT_NOTE_DAYS);
        var to = end.getFullYear() + '-' + ('0' + (end.getMonth() + 1)).slice(-2) + '-' + ('0' + end.getDate()).slice(-2);
        var evs = (app.Hub.events || []).filter(function(ev) {
            return ev && ev.type !== 'nighter' && String(ev.date) >= from && String(ev.date) <= to;
        }).slice().sort(app.Utils.compareEvents);
        var data = await Promise.all(evs.map(function(ev) {
            return app.DB.loadEventData(ev.id).catch(function() { return null; });
        }));
        _eventNotes = evs.map(function(ev, i) {
            return { ev: ev, notes: ((data[i] && data[i].notifications) || []).filter(function(n) { return n && n.text; }) };
        }).filter(function(x) { return x.notes.length > 0; });
    };

    /** 新着の件数（チームの連絡事項＋これからの予定ごとの連絡） */
    Notifications.unreadCount = function() {
        if (!app.Inbox) return 0;
        var n = app.Inbox.teamUnread(app.Hub.notifications || []).length;
        _eventNotes.forEach(function(x) { n += app.Inbox.eventUnread(x.ev.id, x.notes).length; });
        return n;
    };

    /** 連絡事項タブの件数 */
    Notifications.updateBadge = function() {
        var b = document.getElementById('notif-badge');
        if (!b) return;
        var n = Notifications.unreadCount();
        b.textContent = n > 0 ? (n > 99 ? '99+' : String(n)) : '';
        b.classList.toggle('num', n > 0);
        b.classList.toggle('on', n > 0);
        b.setAttribute('aria-label', n > 0 ? '新着 ' + n + '件' : '');
    };

    /**
     * 連絡事項タブを開いたとき: 新着に印を付けて出し、読んだことにする
     */
    Notifications.open = async function() {
        await Notifications.loadEventNotes();
        _newTeam = {};
        _newEvent = {};
        if (app.Inbox) {
            app.Inbox.teamUnread(app.Hub.notifications || []).forEach(function(n) { _newTeam[String(n.id)] = true; });
            _eventNotes.forEach(function(x) {
                _newEvent[String(x.ev.id)] = app.Inbox.eventUnread(x.ev.id, x.notes).map(app.Inbox.noteKey);
            });
        }
        Notifications.renderEventNotes();
        Notifications.renderNotifications();
        if (app.Inbox) {
            app.Inbox.markTeamSeen(app.Hub.notifications || []);
            _eventNotes.forEach(function(x) { app.Inbox.markEventSeen(x.ev.id, x.notes); });
        }
        Notifications.updateBadge();
        if (app.Hub.Home && app.Hub.Home.render) app.Hub.Home.render();
    };

    /** 予定ごとの連絡（これからの予定。新しい連絡から3件ずつ、押すとその予定の連絡のページ） */
    Notifications.renderEventNotes = function() {
        var box = document.getElementById('hub-event-notes');
        if (!box) return;
        if (!_eventNotes.length) { box.innerHTML = ''; return; }
        var esc = UI.escapeHTML;
        var fmt = function(date) {
            var d = new Date(date + 'T00:00:00');
            return (d.getMonth() + 1) + '/' + d.getDate() + '(' + ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] + ')';
        };
        box.innerHTML = '<h3 class="notif-sub">📣 予定ごとの連絡 <small>これからの予定</small></h3>' + _eventNotes.map(function(x) {
            var news = _newEvent[String(x.ev.id)] || [];
            return '<div class="event-note-card">' +
                '<div class="event-note-head"><span class="event-note-date">' + fmt(x.ev.date) + '</span>' +
                '<span class="event-note-title">' + esc(x.ev.title || '') + '</span>' +
                (news.length ? '<span class="notif-new">新着 ' + news.length + '</span>' : '') + '</div>' +
                x.notes.slice(0, EVENT_NOTE_SHOW).map(function(n) {
                    var isNew = app.Inbox && news.indexOf(app.Inbox.noteKey(n)) !== -1;
                    return '<div class="event-note' + (isNew ? ' is-new' : '') + '">' +
                        '<div class="event-note-meta">' + esc(/^\d{4}-\d{2}-\d{2}$/.test(n.date || '') ? fmt(n.date) : (n.date || '')) + (n.user ? ' ・ ' + esc(n.user) : '') + (isNew ? '<span class="notif-new">新着</span>' : '') + '</div>' +
                        '<div class="event-note-text">' + esc(n.text).replace(/\n/g, '<br>') + '</div></div>';
                }).join('') +
                '<a class="event-note-link" href="../carpool/notifications.html?event=' + encodeURIComponent(String(x.ev.id)) + '">' +
                (x.notes.length > EVENT_NOTE_SHOW ? 'ほか' + (x.notes.length - EVENT_NOTE_SHOW) + '件・' : '') + 'この予定の連絡を見る・書く ›</a>' +
                '</div>';
        }).join('') + '<h3 class="notif-sub">チームの連絡事項</h3>';
    };

    Notifications.setupEventListeners = function() {
        // 送信ボタン
        var sendBtn = document.getElementById('send-notification');
        if (sendBtn) {
            sendBtn.addEventListener('click', function() {
                Notifications.sendNotification();
            });
        }

        // タブを開いたら新着に印を付けて出し、読んだことにする
        var tab = document.getElementById('notifications-tab');
        if (tab) tab.addEventListener('click', function() { Notifications.open(); });

        // ログ表示ボタン
        var logsBtn = document.getElementById('notifications-logs');
        if (logsBtn) {
            logsBtn.addEventListener('click', function() {
                app.Hub.openLogsModal('notifications');
            });
        }
    };

    Notifications.renderNotifications = function() {
        var listEl = document.getElementById('notificationsList');
        if (!listEl) return;

        var notifications = app.Hub.notifications || [];

        if (notifications.length === 0) {
            listEl.innerHTML = UI.createAlert('info', '連絡事項はありません。');
            return;
        }

        listEl.innerHTML = '';
        var sorted = notifications.slice().sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });

        sorted.forEach(function(n) {
            // 元の配列でのインデックスを使う（sortedはシャローコピーなので同じオブジェクト参照）
            var origIndex = notifications.indexOf(n);
            var div = document.createElement('div');
            div.className = 'notification-card';

            var dateStr = UI.escapeHTML(n.date || '');
            var userStr = n.user ? UI.escapeHTML(n.user) : '';
            var textStr = UI.escapeHTML(n.text || '').replace(/\n/g, '<br>');

            // 削除ボタンは投稿者本人 or 権限者のみ表示
            var currentUser = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : '';
            var canDelete = (app.Auth && app.Auth.isManager && app.Auth.isManager()) ||
                            (n.user && currentUser && n.user === currentUser);
            var isNew = !!_newTeam[String(n.id)];
            if (isNew) div.className += ' is-new';
            div.innerHTML =
                '<div class="notification-header">' +
                    '<div class="notification-date">' + dateStr + (isNew ? '<span class="notif-new">新着</span>' : '') + '</div>' +
                    '<div class="notification-author">' + userStr + '</div>' +
                '</div>' +
                '<div class="notification-content">' + textStr + '</div>' +
                '<div class="notification-actions">' +
                    '<button type="button" class="secondary-button" data-action="share" data-index="' + origIndex + '">LINEで共有</button>' +
                    (canDelete ? '<button type="button" class="delete-button" data-action="delete" data-index="' + origIndex + '">削除</button>' : '') +
                '</div>';

            listEl.appendChild(div);
        });

        listEl.querySelectorAll('button[data-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var action = this.dataset.action;
                var index = parseInt(this.dataset.index, 10);
                if (action === 'share') {
                    Notifications.shareNotification(index);
                } else if (action === 'delete') {
                    Notifications.deleteNotification(index);
                }
            });
        });
    };

    Notifications.sendNotification = function() {
        var textEl = document.getElementById('notificationText');
        var text = textEl ? textEl.value.trim() : '';

        if (!text) {
            UI.showAlert('連絡内容を入力してください', 'warning');
            return;
        }

        var now = new Date();
        var dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) +
                      ' ' + now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        var user = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : 'システム';

        // Firestoreの doc パスに使用するためユニークIDを付与（未設定だと全件が "undefined" パスに上書きされる）
        var newId = Date.now().toString() + Math.floor(Math.random() * 1000);
        var newItem = { id: newId, date: dateStr, text: text, user: user };

        app.Hub.notifications = app.Hub.notifications || [];
        app.Hub.notifications.unshift(newItem);

        // ログ記録
        app.Hub.logs = Storage.addLog('notifications', '連絡事項追加', '「' + text.substring(0, 30) + '」', app.Hub.logs);

        Storage.saveNotifications(app.Hub.notifications);
        this.renderNotifications();

        if (textEl) textEl.value = '';
        UI.showAlert('連絡事項を送信しました', 'success');
    };

    Notifications.shareNotification = function(index) {
        var notifications = app.Hub.notifications || [];
        var n = notifications[index];
        if (!n) return;

        var url = app.Utils.lineSafeUrl(window.location.origin + '/hub/index.html');
        var message = '【FC 尾島ジュニア 連絡事項】\n' + (n.date || '') + '\n\n' + (n.text || '') + '\n\n' + url;

        var lineUrl = 'https://line.me/R/msg/text/?' + encodeURIComponent(message);
        if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
            // モバイル: LINEアプリへ遷移
            window.location.href = lineUrl;
        } else if (navigator.clipboard) {
            // PC: クリップボードに非同期コピー
            navigator.clipboard.writeText(message)
                .then(function() {
                    UI.showAlert('クリップボードにコピーしました', 'success');
                })
                .catch(function(err) {
                    console.error('クリップボードコピー失敗:', err);
                    UI.showAlert('共有テキストを準備しました。手動でコピーしてください。', 'info');
                });
        } else {
            UI.showAlert('共有テキストを準備しました。LINEなどに貼り付けてください。', 'info');
        }
    };

    Notifications.deleteNotification = function(index) {
        var notifications = app.Hub.notifications || [];
        var n = notifications[index];
        if (!n) return;

        if (!UI.showConfirm('この連絡事項を削除してもよろしいですか？')) return;

        var user = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : 'システム';
        app.Hub.logs = Storage.addLog('notifications', '連絡事項削除', '「' + (n.text || '').substring(0, 30) + '」', app.Hub.logs);

        notifications.splice(index, 1);
        app.Hub.notifications = notifications;
        Storage.saveNotifications(notifications);
        this.renderNotifications();
        UI.showAlert('連絡事項を削除しました', 'success');
    };

})(window.FCOjima);
