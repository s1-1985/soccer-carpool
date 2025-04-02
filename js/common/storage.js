/**
 * FC尾島ジュニア - ストレージ操作
 * ローカルストレージとセッションストレージの操作機能
 */

(function(app) {
    // 名前空間のショートカット
    var Storage = app.Storage;
    
    // ストレージキーのプレフィックス
    Storage.PREFIX = 'fcOjima_';
    
    /**
     * イベントデータをローカルストレージから読み込む
     * @returns {Array} イベントデータの配列
     */
    Storage.loadEvents = function() {
        console.log('イベントデータを読み込んでいます...');
        
        var savedEvents = localStorage.getItem(this.PREFIX + 'events');
        var events = savedEvents ? JSON.parse(savedEvents) : [];
        
        // サンプルデータ（ローカルストレージにデータがない場合のみ）
        if (events.length === 0) {
            var sampleEvents = [
                {
                    id: 1,
                    date: '2025-04-05',
                    type: 'game',
                    title: 'vs青葉FC',
                    target: ['1', '2', '3'],
                    targetNotes: '',
                    attendanceDeadline: '2025-04-03T18:00',
                    departureTime: '12:00',
                    meetingPlace: '市民グラウンド',
                    venue: '市民グラウンド',
                    startTime: '13:00',
                    endTime: '15:00',
                    notes: 'ユニフォームは緑色'
                },
                {
                    id: 2,
                    date: '2025-04-12',
                    type: 'game',
                    title: 'vsさくらSC',
                    target: ['2', '3', '4'],
                    targetNotes: '〇〇君のみ参加',
                    attendanceDeadline: '2025-04-10T18:00',
                    departureTime: '09:00',
                    meetingPlace: '第二運動公園',
                    venue: '第二運動公園',
                    startTime: '10:00',
                    endTime: '12:00',
                    notes: '集合時間は9:00'
                },
                {
                    id: 3,
                    date: '2025-04-15',
                    type: 'practice',
                    title: '通常練習',
                    target: ['1', '2', '3', '4', '5', '6'],
                    targetNotes: '',
                    departureTime: '',
                    meetingPlace: '学校グラウンド',
                    venue: '学校グラウンド',
                    startTime: '16:00',
                    endTime: '18:00',
                    notes: ''
                }
            ];
            return sampleEvents;
        }
        
        // 古いイベントを除外（6ヶ月以上前のイベント）
        var sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        var sixMonthsAgoStr = app.Utils.formatDate(sixMonthsAgo);
        
        var filteredEvents = events.filter(function(event) {
            return event.date >= sixMonthsAgoStr;
        });
        
        // 古いイベントが削除された場合は保存し直す
        if (filteredEvents.length < events.length) {
            this.saveEvents(filteredEvents);
            console.log((events.length - filteredEvents.length) + '件の古いイベントを削除しました');
        }
        
        return filteredEvents;
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
        var savedMembers = localStorage.getItem(this.PREFIX + 'members');
        var members = savedMembers ? JSON.parse(savedMembers) : [];
        
        // サンプルデータ（ローカルストレージにデータがない場合のみ）
        if (members.length === 0) {
            var sampleMembers = [
                {
                    id: 1,
                    name: '山田隆',
                    birth: '2018-04-10',
                    gender: 'male',
                    role: 'player',
                    number: 6,
                    grade: '1',
                    notes: ''
                },
                {
                    id: 2,
                    name: '佐藤勝',
                    birth: '2018-05-22',
                    gender: 'male',
                    role: 'player',
                    number: 6,
                    grade: '1',
                    notes: ''
                },
                {
                    id: 3,
                    name: '田中浩二',
                    birth: '2017-11-05',
                    gender: 'male',
                    role: 'player',
                    number: 5,
                    grade: '2',
                    notes: ''
                },
                {
                    id: 4,
                    name: '鈴木大輔',
                    birth: '2017-06-15',
                    gender: 'male',
                    role: 'player',
                    number: 4,
                    grade: '2',
                    notes: ''
                },
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
        var savedVenues = localStorage.getItem(this.PREFIX + 'venues');
        var venues = savedVenues ? JSON.parse(savedVenues) : [];
        
        // サンプルデータ（ローカルストレージにデータがない場合のみ）
        if (venues.length === 0) {
            var sampleVenues = [
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
        var savedLogs = localStorage.getItem(this.PREFIX + 'logs');
        var logs = savedLogs ? JSON.parse(savedLogs) : [];
        
        // 3ヶ月より古いログを削除
        var threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        var filteredLogs = logs.filter(function(log) {
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
        
        var now = new Date();
        var datetime = now.toISOString();
        var user = 'システム'; // ログイン機能実装までのダミーユーザー
        
        // 各ログにユニークIDを付与
        var logId = Date.now().toString() + Math.floor(Math.random() * 1000);
        
        // 削除のログには復元フラグを追加（1週間有効）
        var canRestore = action.includes('削除');
        var restoreDeadline = canRestore ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
        
        // 削除時のデータバックアップを行う
        var deletedData = null;
        if (canRestore) {
            // 削除されたデータのタイプに応じてバックアップを行う
            switch (type) {
                case 'members':
                    // メンバー削除の場合
                    var memberMatch = details.match(/「(.+?)」/);
                    if (memberMatch) {
                        var memberName = memberMatch[1];
                        var members = this.loadMembers();
                        deletedData = members.find(function(m) {
                            return m.name === memberName;
                        });
                    }
                    break;
                case 'venues':
                    // 会場削除の場合
                    var venueMatch = details.match(/「(.+?)」/);
                    if (venueMatch) {
                        var venueName = venueMatch[1];
                        var venues = this.loadVenues();
                        deletedData = venues.find(function(v) {
                            return v.name === venueName;
                        });
                    }
                    break;
                case 'calendar':
                    // イベント削除の場合
                    var eventMatch = details.match(/「(.+?)」/);
                    if (eventMatch) {
                        var eventTitle = eventMatch[1];
                        var events = this.loadEvents();
                        deletedData = events.find(function(e) {
                            return e.title === eventTitle;
                        });
                    }
                    break;
            }
        }
        
        var newLog = {
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
        
        var updatedLogs = logs.concat([newLog]);
        this.saveLogs(updatedLogs);
        return updatedLogs;
    };
    
    /**
     * 連絡事項をローカルストレージから読み込む
     * @returns {Array} 連絡事項データの配列
     */
    Storage.loadNotifications = function() {
        var savedNotifications = localStorage.getItem(this.PREFIX + 'notifications');
        var notifications = savedNotifications ? JSON.parse(savedNotifications) : [];
        
        // 3ヶ月より古い連絡事項を削除
        var threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        var filteredNotifications = notifications.filter(function(notification) {
            var notificationDate = new Date(notification.date);
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
        var savedData = localStorage.getItem(this.PREFIX + 'event_' + eventId);
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
        var eventData = sessionStorage.getItem(this.PREFIX + 'selectedEvent');
        return eventData ? JSON.parse(eventData) : null;
    };
    
})(window.FCOjima);
