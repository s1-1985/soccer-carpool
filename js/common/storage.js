/**
 * FC尾島ジュニア - ストレージ操作
 * ローカルストレージとセッションストレージの操作機能
 */

// 名前空間の定義はglobal.jsで行うため削除

// ストレージキーのプレフィックス
FCOjima.Storage.PREFIX = 'fcOjima_';

/**
 * イベントデータをローカルストレージから読み込む
 * @returns {Array} イベントデータの配列
 */
FCOjima.Storage.loadEvents = function() {
    const savedEvents = localStorage.getItem(`${this.PREFIX}events`);
    const events = savedEvents ? JSON.parse(savedEvents) : [];
    
    // サンプルデータ（ローカルストレージにデータがない場合のみ）
    if (events.length === 0) {
        const sampleEvents = [
            {
                id: 1,
                date: '2025-04-05',
                type: 'game',
                title: 'vs青葉FC',
                target: ['1', '2', '3'],
                targetNotes: '',
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
    
    return events;
};

/**
 * イベントデータをローカルストレージに保存
 * @param {Array} events - イベントデータの配列
 */
FCOjima.Storage.saveEvents = function(events) {
    localStorage.setItem(`${this.PREFIX}events`, JSON.stringify(events));
};

/**
 * メンバーデータをローカルストレージから読み込む
 * @returns {Array} メンバーデータの配列
 */
FCOjima.Storage.loadMembers = function() {
    const savedMembers = localStorage.getItem(`${this.PREFIX}members`);
    const members = savedMembers ? JSON.parse(savedMembers) : [];
    
    // サンプルデータ（ローカルストレージにデータがない場合のみ）
    if (members.length === 0) {
        const sampleMembers = [
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
FCOjima.Storage.saveMembers = function(members) {
    localStorage.setItem(`${this.PREFIX}members`, JSON.stringify(members));
};

/**
 * 会場データをローカルストレージから読み込む
 * @returns {Array} 会場データの配列
 */
FCOjima.Storage.loadVenues = function() {
    const savedVenues = localStorage.getItem(`${this.PREFIX}venues`);
    const venues = savedVenues ? JSON.parse(savedVenues) : [];
    
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
FCOjima.Storage.saveVenues = function(venues) {
    localStorage.setItem(`${this.PREFIX}venues`, JSON.stringify(venues));
};

/**
 * ログデータをローカルストレージから読み込む
 * @returns {Array} ログデータの配列
 */
FCOjima.Storage.loadLogs = function() {
    const savedLogs = localStorage.getItem(`${this.PREFIX}logs`);
    return savedLogs ? JSON.parse(savedLogs) : [];
};

/**
 * ログデータをローカルストレージに保存
 * @param {Array} logs - ログデータの配列
 */
FCOjima.Storage.saveLogs = function(logs) {
    // 365日より古いログを削除
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    
    const filteredLogs = logs.filter(log => new Date(log.datetime) > oneYearAgo);
    localStorage.setItem(`${this.PREFIX}logs`, JSON.stringify(filteredLogs));
};

/**
 * 新しいログエントリを追加
 * @param {string} type - ログのタイプ（calendar, members, venues など）
 * @param {string} action - 実行されたアクション
 * @param {string} details - 詳細情報
 * @param {Array} logs - 既存のログ配列
 * @returns {Array} 更新されたログ配列
 */
FCOjima.Storage.addLog = function(type, action, details = '', logs = []) {
    const now = new Date();
    const datetime = now.toISOString();
    const user = 'システム'; // ログイン機能実装までのダミーユーザー
    
    const newLog = {
        datetime,
        user,
        type,
        action,
        details
    };
    
    const updatedLogs = [...logs, newLog];
    this.saveLogs(updatedLogs);
    return updatedLogs;
};

/**
 * イベント固有のデータをローカルストレージから読み込む
 * @param {number} eventId - イベントID
 * @returns {Object} イベント固有のデータ
 */
FCOjima.Storage.loadEventData = function(eventId) {
    const savedData = localStorage.getItem(`${this.PREFIX}event_${eventId}`);
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
FCOjima.Storage.saveEventData = function(eventId, data) {
    localStorage.setItem(`${this.PREFIX}event_${eventId}`, JSON.stringify(data));
};

/**
 * 選択されたイベントをセッションストレージに保存
 * @param {Object} event - イベントオブジェクト
 */
FCOjima.Storage.setSelectedEvent = function(event) {
    sessionStorage.setItem(`${this.PREFIX}selectedEvent`, JSON.stringify(event));
};

/**
 * 選択されたイベントをセッションストレージから取得
 * @returns {Object|null} 選択されたイベントオブジェクトまたはnull
 */
FCOjima.Storage.getSelectedEvent = function() {
    const eventData = sessionStorage.getItem(`${this.PREFIX}selectedEvent`);
    return eventData ? JSON.parse(eventData) : null;
};