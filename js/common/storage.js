/**
 * FC尾島ジュニア - ストレージ操作
 * Firestore（優先）＋ローカルストレージ（フォールバック）
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Storage = FCOjima.Storage || {};

// ストレージ操作モジュール
(function() {
    // 名前空間のショートカット
    const Storage = FCOjima.Storage;

    // ローカルストレージのプレフィックス
    Storage.PREFIX = 'fcojima_';

    /**
     * サーバーへの保存に失敗したことを画面に出す。
     * 以前はコンソールに出すだけで、画面上は「保存しました」のまま再読み込みで消えていた
     */
    function reportSaveError(what, e) {
        console.warn('Firestore ' + what + ':', e);
        var UI = window.FCOjima && FCOjima.UI;
        if (UI && UI.showAlert) {
            var msg = (e && e.code === 'not-loaded') ? e.message
                : 'サーバーへの保存に失敗しました。通信環境を確認して、ページを再読み込みしてからもう一度操作してください';
            UI.showAlert(msg, 'error', 8000);
        }
    }

    /**
     * 端末内キャッシュ（localStorage）への書き込み。失敗しても例外を出さない。
     *
     * localStorage はオフライン時のフォールバック用キャッシュにすぎないが、以前は書き込みを
     * Firestoreへの保存より前に素のまま行っていたため、容量（約5MB）を使い切ると
     * QuotaExceededError で処理がそこで止まり、サーバーへの保存自体が行われなかった。
     * 開いたイベントごとの配車データ（fcojima_event_ID）を消さずに溜め続けるので、
     * 何シーズンも使う配車担当の端末ほど起こりうる。容量不足のときは古いキャッシュを
     * 消してから1回だけ再試行する。
     * @returns {boolean} 書き込めたか
     */
    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            try {
                pruneCaches(key);
                localStorage.setItem(key, value);
                return true;
            } catch (e2) {
                console.warn('端末内キャッシュに保存できませんでした（容量不足など）: ' + key, e2);
                return false;
            }
        }
    }
    Storage.safeSetItem = safeSetItem;

    /** 消しても困らない端末内キャッシュ（イベントごとの配車データ・ログ・天気の座標）を削除する */
    function pruneCaches(keepKey) {
        var removable = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (!k || k === keepKey) continue;
            if (k.indexOf(Storage.PREFIX + 'event_') === 0 || k === Storage.PREFIX + 'logs' ||
                k.indexOf('fcojima_geocode_') === 0) {
                removable.push(k);
            }
        }
        removable.forEach(function(k) { localStorage.removeItem(k); });
        if (removable.length > 0) console.log('端末内キャッシュを整理しました: ' + removable.length + '件');
    }

    /**
     * メンバーデータをローカルストレージから読み込む
     * ※Firestoreデータはページ初期化時に app.Hub.members へ格納済み
     */
    Storage.loadMembers = function() {
        // Firestoreからロード済みのキャッシュを返す
        if (window.FCOjima && FCOjima.Hub && FCOjima.Hub.members && FCOjima.Hub.members.length > 0) {
            return FCOjima.Hub.members;
        }
        // フォールバック: localStorageから読み込む（ダミーデータなし）
        const saved = localStorage.getItem(this.PREFIX + 'members');
        return saved ? JSON.parse(saved) : [];
    };

    /**
     * イベント（予定）をローカルストレージから読み込む
     */
    Storage.loadEvents = function() {
        if (window.FCOjima && FCOjima.Hub && FCOjima.Hub.events && FCOjima.Hub.events.length > 0) {
            return FCOjima.Hub.events;
        }
        const saved = localStorage.getItem(this.PREFIX + 'events');
        return saved ? JSON.parse(saved) : [];
    };

    /**
     * イベントデータを保存（Firestore + localStorage）
     */
    Storage.saveEvents = function(events) {
        safeSetItem(this.PREFIX + 'events', JSON.stringify(events));
        if (window.FCOjima && FCOjima.DB) {
            FCOjima.DB.saveEvents(events).catch(e => reportSaveError('saveEvents', e));
        }
    };
    
    /**
     * メンバーデータをローカルストレージに保存
     * @param {Array} members - メンバーデータの配列
     */
    Storage.saveMembers = function(members) {
        safeSetItem(this.PREFIX + 'members', JSON.stringify(members));
        if (window.FCOjima && FCOjima.DB) {
            FCOjima.DB.saveMembers(members).catch(e => reportSaveError('saveMembers', e));
        }
    };
    
    /**
     * 会場データをローカルストレージから読み込む
     * @returns {Array} 会場データの配列
     */
    Storage.loadVenues = function() {
        if (window.FCOjima && FCOjima.Hub && FCOjima.Hub.venues && FCOjima.Hub.venues.length > 0) {
            return FCOjima.Hub.venues;
        }
        const savedVenues = localStorage.getItem(this.PREFIX + 'venues');
        return savedVenues ? JSON.parse(savedVenues) : [];
    };
    
    /**
     * 会場データをローカルストレージに保存
     * @param {Array} venues - 会場データの配列
     */
    Storage.saveVenues = function(venues) {
        safeSetItem(this.PREFIX + 'venues', JSON.stringify(venues));
        if (window.FCOjima && FCOjima.DB) {
            FCOjima.DB.saveVenues(venues).catch(e => reportSaveError('saveVenues', e));
        }
    };
    
    /**
     * ログデータをローカルストレージから読み込む
     * @returns {Array} ログデータの配列
     */
    Storage.loadLogs = function() {
        const savedLogs = localStorage.getItem(this.PREFIX + 'logs');
        let logs = savedLogs ? JSON.parse(savedLogs) : [];
        
        // 3ヶ月より古いログを削除
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const filteredLogs = logs.filter(function(log) {
            return new Date(log.datetime) > threeMonthsAgo;
        });
        
        // 古いログが削除された場合は保存し直す
        if (filteredLogs.length < logs.length) {
            this.saveLogs(filteredLogs);
            console.log((logs.length - filteredLogs.length) + '件の古いログを削除しました');
        }
        
        return filteredLogs;
    };
    
    /**
     * ログデータをローカルストレージに保存
     * @param {Array} logs - ログデータの配列
     */
    Storage.saveLogs = function(logs) {
        safeSetItem(this.PREFIX + 'logs', JSON.stringify(logs));
    };
    
    /**
     * 新しいログエントリを追加
     * @param {string} type - ログのタイプ（calendar, members, venues など）
     * @param {string} action - 実行されたアクション
     * @param {string} details - 詳細情報
     * @param {Array} logs - 既存のログ配列
     * @returns {Array} 更新されたログ配列
     */
    Storage.addLog = function(type, action, details, logs, extra) {
        details = details || '';
        logs = logs || [];
        extra = extra || {};
        
        const now = new Date();
        const datetime = now.toISOString();
        const user = (window.FCOjima && window.FCOjima.Auth && window.FCOjima.Auth.getDisplayName)
            ? window.FCOjima.Auth.getDisplayName()
            : 'システム';
        
        // 各ログにユニークIDを付与
        const logId = Date.now().toString() + Math.floor(Math.random() * 1000);
        
        // 削除のログには復元フラグを追加（1週間有効）
        const canRestore = action.includes('削除');
        const restoreDeadline = canRestore ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
        
        // 削除時のデータバックアップを行う
        let deletedData = null;
        if (canRestore) {
            // 削除されたデータのタイプに応じてバックアップを行う
            switch (type) {
                case 'members':
                    // メンバー削除の場合
                    const memberMatch = details.match(/「(.+?)」/);
                    if (memberMatch) {
                        const memberName = memberMatch[1];
                        const members = this.loadMembers();
                        deletedData = members.find(function(m) {
                            return m.name === memberName;
                        });
                    }
                    break;
                case 'venues':
                    // 会場削除の場合
                    const venueMatch = details.match(/「(.+?)」/);
                    if (venueMatch) {
                        const venueName = venueMatch[1];
                        const venues = this.loadVenues();
                        deletedData = venues.find(function(v) {
                            return v.name === venueName;
                        });
                    }
                    break;
                case 'calendar':
                    // イベント削除の場合
                    const eventMatch = details.match(/「(.+?)」/);
                    if (eventMatch) {
                        const eventTitle = eventMatch[1];
                        const events = this.loadEvents();
                        deletedData = events.find(function(e) {
                            return e.title === eventTitle;
                        });
                    }
                    break;
            }
        }
        
        const newLog = Object.assign({
            id: logId,
            datetime: datetime,
            user: user,
            type: type,
            action: action,
            details: details,
            canRestore: canRestore,
            restoreDeadline: restoreDeadline,
            deletedData: deletedData
        }, extra);
        
        const updatedLogs = logs.concat([newLog]);
        this.saveLogs(updatedLogs);

        // Firestoreにもログを追加（非同期 fire-and-forget）
        if (window.FCOjima && FCOjima.DB && FCOjima.DB.addLog) {
            FCOjima.DB.addLog(type, action, details, Object.assign({}, extra, { id: logId })).catch(function(e) {
                console.warn('Firestore addLog失敗:', e);
            });
        }

        return updatedLogs;
    };
    
    /**
     * 連絡事項をローカルストレージから読み込む
     * @returns {Array} 連絡事項データの配列
     */
    Storage.loadNotifications = function() {
        const savedNotifications = localStorage.getItem(this.PREFIX + 'notifications');
        let notifications = savedNotifications ? JSON.parse(savedNotifications) : [];
        
        // 3ヶ月より古い連絡事項を削除
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const filteredNotifications = notifications.filter(function(notification) {
            const notificationDate = new Date(notification.date);
            return notificationDate > threeMonthsAgo;
        });
        
        // 古い連絡事項が削除された場合は保存し直す
        if (filteredNotifications.length < notifications.length) {
            this.saveNotifications(filteredNotifications);
            console.log((notifications.length - filteredNotifications.length) + '件の古い連絡事項を削除しました');
        }
        
        return filteredNotifications;
    };
    
    /**
     * 連絡事項をローカルストレージに保存（端末のキャッシュ）
     * @param {Array} notifications - 連絡事項データの配列
     */
    Storage.saveNotifications = function(notifications) {
        // 端末に残すだけ。サーバーへは1件ずつ書く・消す（DB.putNotification / DB.deleteNotification）。
        // 連絡事項の削除は権限のある人に限ったため、一覧ごとの保存（古い連絡の削除を含む）はしない
        safeSetItem(this.PREFIX + 'notifications', JSON.stringify(notifications));
    };
    
    /**
     * イベント固有のデータをローカルストレージから読み込む
     * @param {number} eventId - イベントID
     * @returns {Object} イベント固有のデータ
     */
    Storage.loadEventData = function(eventId) {
        const savedData = localStorage.getItem(this.PREFIX + 'event_' + eventId);
        if (savedData) {
            return JSON.parse(savedData);
        }
        
        // データがない場合は空のオブジェクトを返す
        return {
            carRegistrations: [],
            assignments: [],
            attendance: [],
            notifications: []
        };
    };
    
    /**
     * イベント固有のデータをローカルストレージに保存
     * @param {number} eventId - イベントID
     * @param {Object} data - イベント固有のデータ
     */
    Storage.saveEventData = function(eventId, data) {
        safeSetItem(this.PREFIX + 'event_' + eventId, JSON.stringify(data));
    };

    /**
     * イベント固有のデータをローカルストレージから削除
     * @param {number} eventId - イベントID
     */
    Storage.deleteEventData = function(eventId) {
        localStorage.removeItem(this.PREFIX + 'event_' + eventId);
    };

    /**
     * 選択されたイベントをセッションストレージに保存
     * @param {Object} event - イベントオブジェクト
     */
    Storage.setSelectedEvent = function(event) {
        try { sessionStorage.setItem(this.PREFIX + 'selectedEvent', JSON.stringify(event)); } catch (e) { console.warn('選択中イベントを保存できませんでした:', e); }
    };
    
    /**
     * 選択されたイベントをセッションストレージから取得
     * @returns {Object|null} 選択されたイベントオブジェクトまたはnull
     */
    Storage.getSelectedEvent = function() {
        const eventData = sessionStorage.getItem(this.PREFIX + 'selectedEvent');
        return eventData ? JSON.parse(eventData) : null;
    };
    
    /**
     * ローカルストレージにデータが存在するか確認
     * @param {string} key - ストレージキー
     * @returns {boolean} データが存在するかどうか
     */
    Storage.exists = function(key) {
        return localStorage.getItem(this.PREFIX + key) !== null;
    };
    
    /**
     * ローカルストレージからデータを取得
     * @param {string} key - ストレージキー
     * @param {*} defaultValue - データが存在しない場合のデフォルト値
     * @returns {*} 取得したデータまたはデフォルト値
     */
    Storage.get = function(key, defaultValue = null) {
        const item = localStorage.getItem(this.PREFIX + key);
        if (item === null) return defaultValue;
        
        try {
            return JSON.parse(item);
        } catch (e) {
            return item;
        }
    };
    
    /**
     * ローカルストレージにデータを保存
     * @param {string} key - ストレージキー
     * @param {*} value - 保存するデータ
     */
    Storage.set = function(key, value) {
        if (typeof value === 'object') {
            safeSetItem(this.PREFIX + key, JSON.stringify(value));
        } else {
            safeSetItem(this.PREFIX + key, value);
        }
    };
    
    /**
     * ローカルストレージからデータを削除
     * @param {string} key - ストレージキー
     */
    Storage.remove = function(key) {
        localStorage.removeItem(this.PREFIX + key);
    };
    
    /**
     * ローカルストレージをクリア（プレフィックスに一致するもののみ）
     */
    Storage.clear = function() {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.PREFIX)) {
                localStorage.removeItem(key);
            }
        }
    };
})();