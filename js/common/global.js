/**
 * FC尾島ジュニア - グローバル名前空間定義
 * アプリケーション全体で使用する名前空間を一元管理
 */

// グローバル名前空間の定義
window.FCOjima = {
    // 共通モジュール
    UI: {},
    Utils: {},
    Storage: {},
    
    // HUBページモジュール
    Hub: {
        currentDate: null,
        events: [],
        members: [],
        venues: [],
        logs: [],
        Calendar: {},
        Members: {},
        Notifications: {},
        Venues: {}
    },
    
    // 配車管理ページモジュール
    Carpool: {
        UI: {},
        appData: {
            eventId: null,
            carRegistrations: [],
            assignments: [],
            attendance: [],
            notifications: []
        },
        members: [],
        Overview: {},
        Attendance: {},
        CarProvision: {},
        Assignment: {},
        Notifications: {}
    }
};

// グローバル名前空間の初期化完了をログ出力
console.log('FCOjima 名前空間を初期化しました');
