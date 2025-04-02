/**
 * FC尾島ジュニア - グローバル名前空間定義
 * アプリケーション全体で使用する名前空間を一元管理
 */

// 既存の名前空間を保持（二重初期化防止）
window.FCOjima = window.FCOjima || {};

// 名前空間の構造を定義
(function(app) {
    // 共通モジュール
    app.UI = app.UI || {};
    app.Utils = app.Utils || {};
    app.Storage = app.Storage || {};
    
    // HUBページモジュール
    app.Hub = app.Hub || {
        currentDate: null,
        events: [],
        members: [],
        venues: [],
        logs: [],
        notifications: []
    };
    
    app.Hub.Calendar = app.Hub.Calendar || {};
    app.Hub.Members = app.Hub.Members || {};
    app.Hub.Notifications = app.Hub.Notifications || {};
    app.Hub.Venues = app.Hub.Venues || {};
    
    // 配車管理ページモジュール
    app.Carpool = app.Carpool || {
        UI: {},
        appData: {
            eventId: null,
            carRegistrations: [],
            assignments: [],
            attendance: [],
            notifications: []
        },
        members: []
    };
    
    app.Carpool.Overview = app.Carpool.Overview || {};
    app.Carpool.Attendance = app.Carpool.Attendance || {};
    app.Carpool.CarProvision = app.Carpool.CarProvision || {};
    app.Carpool.Assignment = app.Carpool.Assignment || {};
    app.Carpool.Notifications = app.Carpool.Notifications || {};

    // 初期化完了メッセージ
    console.log('FCOjima 名前空間を初期化しました');

})(window.FCOjima);
