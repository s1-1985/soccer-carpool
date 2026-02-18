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
     * メンバーデータをローカルストレージから読み込む
     * ※Firestoreデータはページ初期化時に app.Hub.members へ格納済み
     */
    Storage.loadMembers = function() {
        // Firestoreからロード済みのキャッシュを返す
        if (window.FCOjima && FCOjima.Hub && FCOjima.Hub.members && FCOjima.Hub.members.length > 0) {
            return FCOjima.Hub.members;
        }
        // フォールバック: localStorageから読み込む
        const saved = localStorage.getItem(this.PREFIX + 'members');
        let members = saved ? JSON.parse(saved) : [];
        if (members.length === 0) {
            members = [
                { id: 1, name: '田中太郎',   birth: '2016-04-01', gender: 'male',   role: 'player', number: 10, grade: '3', notes: '' },
                { id: 2, name: '鈴木花子',   birth: '2016-09-15', gender: 'female', role: 'player', number: 7,  grade: '3', notes: '' },
                { id: 3, name: '佐藤次郎',   birth: '2017-03-20', gender: 'male',   role: 'player', number: 3,  grade: '2', notes: '' },
                { id: 4, name: '山田美咲',   birth: '2015-11-10', gender: 'female', role: 'mother', number: null, grade: null, notes: '田中太郎の母' }
            ];
        }
        return members;
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
        localStorage.setItem(this.PREFIX + 'events', JSON.stringify(events));
        if (window.FCOjima && FCOjima.DB) {
            FCOjima.DB.saveEvents(events).catch(e => console.warn('Firestore saveEvents:', e));
        }
    };
    
    /**
     * メンバーデータをローカルストレージから読み込む（続き）
     */
    // サンプルデータの続き
    const sampleMembers = [
        {
            id: 5,
            name: '渡邊悠人',
            birth: '2017-08-30',
            gender: 'male',
            role: 'player',
            number: 4,
            grade: '2',
            notes: ''
        },
        {
            id: 6,
            name: '飯田友則',
            birth: '',
            gender: 'male',
            role: 'coach',
            number: null,
            grade: null,
            notes: '監督'
        },
        {
            id: 7,
            name: '大槻智一',
            birth: '',
            gender: 'male',
            role: 'assist',
            number: null,
            grade: null,
            notes: 'コーチ'
        },
        {
            id: 8,
            name: '田中和人',
            birth: '',
            gender: 'male',
            role: 'father',
            number: null,
            grade: null,
            notes: '田中浩二の父'
        }
    ];
    
    /**
     * メンバーデータをローカルストレージに保存
     * @param {Array} members - メンバーデータの配列
     */
    Storage.saveMembers = function(members) {
        localStorage.setItem(this.PREFIX + 'members', JSON.stringify(members));
        if (window.FCOjima && FCOjima.DB) {
            FCOjima.DB.saveMembers(members).catch(e => console.warn('Firestore saveMembers:', e));
        }
    };
    
    /**
     * 会場データをローカルストレージから読み込む
     * @returns {Array} 会場データの配列
     */
    Storage.loadVenues = function() {
        const savedVenues = localStorage.getItem(this.PREFIX + 'venues');
        let venues = savedVenues ? JSON.parse(savedVenues) : [];
        
        // サンプルデータ（ローカルストレージにデータがない場合のみ）
        if (venues.length === 0) {
            const sampleVenues = [
                {
                    id: 1,
                    name: '市民グラウンド',
                    address: '尾島市中央区1-2-3',
                    notes: '駐車場は第二駐車場を利用'
                },
                {
                    id: 2,
                    name: '第二運動公園',
                    address: '尾島市西区5-6-7',
                    notes: '雨天時は第二体育館に変更'
                },
                {
                    id: 3,
                    name: '学校グラウンド',
                    address: '尾島市東区9-10-11',
                    notes: '学校開放時のみ利用可能'
                }
            ];
            return sampleVenues;
        }
        
        return venues;
    };
    
    /**
     * 会場データをローカルストレージに保存
     * @param {Array} venues - 会場データの配列
     */
    Storage.saveVenues = function(venues) {
        localStorage.setItem(this.PREFIX + 'venues', JSON.stringify(venues));
        if (window.FCOjima && FCOjima.DB) {
            FCOjima.DB.saveVenues(venues).catch(e => console.warn('Firestore saveVenues:', e));
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
        localStorage.setItem(this.PREFIX + 'logs', JSON.stringify(logs));
    };
    
    /**
     * 新しいログエントリを追加
     * @param {string} type - ログのタイプ（calendar, members, venues など）
     * @param {string} action - 実行されたアクション
     * @param {string} details - 詳細情報
     * @param {Array} logs - 既存のログ配列
     * @returns {Array} 更新されたログ配列
     */
    Storage.addLog = function(type, action, details, logs) {
        details = details || '';
        logs = logs || [];
        
        const now = new Date();
        const datetime = now.toISOString();
        const user = 'システム'; // ログイン機能実装までのダミーユーザー
        
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
        
        const newLog = {
            id: logId,
            datetime: datetime,
            user: user,
            type: type,
            action: action,
            details: details,
            canRestore: canRestore,
            restoreDeadline: restoreDeadline,
            deletedData: deletedData
        };
        
        const updatedLogs = logs.concat([newLog]);
        this.saveLogs(updatedLogs);
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
     * 連絡事項をローカルストレージに保存
     * @param {Array} notifications - 連絡事項データの配列
     */
    Storage.saveNotifications = function(notifications) {
        localStorage.setItem(this.PREFIX + 'notifications', JSON.stringify(notifications));
        if (window.FCOjima && FCOjima.DB) {
            FCOjima.DB.saveNotifications(notifications).catch(e => console.warn('Firestore saveNotifications:', e));
        }
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
        localStorage.setItem(this.PREFIX + 'event_' + eventId, JSON.stringify(data));
    };
    
    /**
     * 選択されたイベントをセッションストレージに保存
     * @param {Object} event - イベントオブジェクト
     */
    Storage.setSelectedEvent = function(event) {
        sessionStorage.setItem(this.PREFIX + 'selectedEvent', JSON.stringify(event));
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
            localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
        } else {
            localStorage.setItem(this.PREFIX + key, value);
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
            if (key.startsWith(this.PREFIX)) {
                localStorage.removeItem(key);
            }
        }
    };
})();