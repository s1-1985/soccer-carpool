/**
 * FC尾島ジュニア - ストレージ操作
 * ローカルストレージとセッションストレージの操作機能
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Storage = FCOjima.Storage || {};

// ストレージ操作モジュール
(function() {
    // 名前空間のショートカット
    const Storage = FCOjima.Storage;
    
    // ストレージキーのプレフィックス
    Storage.PREFIX = 'fc-ojima-';
    
    /**
     * イベントデータをローカルストレージから読み込む
     * @returns {Array} イベントデータの配列
     */
    Storage.loadEvents = function() {
        const savedEvents = localStorage.getItem(this.PREFIX + 'events');
        let events = savedEvents ? JSON.parse(savedEvents) : [];
        
        // サンプルデータ（ローカルストレージにデータがない場合のみ）
        if (events.length === 0) {
            const sampleEvents = [
                {
                    id: 1,
                    date: "2025-01-25",
                    type: "practice",
                    title: "通常練習",
                    target: ["3", "4", "5", "6"],
                    venue: "市民グラウンド",
                    meetingPlace: "学校正門",
                    startTime: "09:00",
                    endTime: "11:00",
                    departureTime: "08:30",
                    attendanceDeadline: "2025-01-23T18:00:00",
                    notes: "雨天中止"
                },
                {
                    id: 2,
                    date: "2025-02-01",
                    type: "game",
                    title: "vs青葉FC",
                    target: ["5", "6"],
                    venue: "第二運動公園",
                    meetingPlace: "学校正門",
                    startTime: "10:00",
                    endTime: "12:00",
                    departureTime: "09:00",
                    attendanceDeadline: "2025-01-30T18:00:00",
                    notes: "ユニフォーム持参"
                }
            ];
            return sampleEvents;
        }
        
        return events;
    };
    
    /**
     * イベントデータをローカルストレージに保存
     * @param {Array} events - イベントデータの配列
     */
    Storage.saveEvents = function(events) {
        localStorage.setItem(this.PREFIX + 'events', JSON.stringify(events));
    };
    
    /**
     * メンバーデータをローカルストレージから読み込む
     * @returns {Array} メンバーデータの配列
     */
    Storage.loadMembers = function() {
        const savedMembers = localStorage.getItem(this.PREFIX + 'members');
        let members = savedMembers ? JSON.parse(savedMembers) : [];
        
        // サンプルデータ（ローカルストレージにデータがない場合のみ）
        if (members.length === 0) {
            const sampleMembers = [
                {
                    id: 1,
                    name: '田中浩二',
                    birth: '2014-08-15',
                    gender: 'male',
                    role: 'player',
                    number: 5,
                    grade: '5',
                    notes: 'ポジション: MF'
                },
                {
                    id: 2,
                    name: '佐藤勝',
                    birth: '2013-04-22',
                    gender: 'male',
                    role: 'player',
                    number: 10,
                    grade: '6',
                    notes: 'キャプテン'
                },
                {
                    id: 3,
                    name: '山田隆',
                    birth: '2013-11-08',
                    gender: 'male',
                    role: 'player',
                    number: 7,
                    grade: '6',
                    notes: ''
                },
                {
                    id: 4,
                    name: '鈴木大輔',
                    birth: '2015-03-12',
                    gender: 'male',
                    role: 'player',
                    number: 3,
                    grade: '4',
                    notes: ''
                }
            ];
            return sampleMembers;
        }
        
        return members;
    };
    
    /**
     * メンバーデータをローカルストレージに保存
     * @param {Array} members - メンバーデータの配列
     */
    Storage.saveMembers = function(members) {
        localStorage.setItem(this.PREFIX + 'members', JSON.stringify(members));
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
        
        const newLog = {
            datetime: datetime,
            user: user,
            type: type,
            action: action,
            details: details
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
})();