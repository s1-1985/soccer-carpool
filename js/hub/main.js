/**
 * FC尾島ジュニア - HUBページのメインJS
 * HUBページの初期化と全体的な制御を行う
 */

// 名前空間の定義はglobal.jsで行うため削除

// グローバル変数
FCOjima.Hub.currentDate = new Date();
FCOjima.Hub.events = [];
FCOjima.Hub.members = [];
FCOjima.Hub.venues = [];
FCOjima.Hub.logs = [];

/**
 * ページ初期化時の処理
 */
FCOjima.Hub.init = function() {
    // データの読み込み
    this.loadData();
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    // 初期表示
    this.renderInitialView();
    
    // モーダル初期化
    FCOjima.UI.initModals();
    
    console.log('FC尾島ジュニア HUBページを初期化しました');
};

/**
 * データの読み込み
 */
FCOjima.Hub.loadData = function() {
    // イベントデータの読み込み
    this.events = FCOjima.Storage.loadEvents();
    FCOjima.Storage.saveEvents(this.events); // サンプルデータがあれば保存
    
    // メンバーデータの読み込み
    this.members = FCOjima.Storage.loadMembers();
    FCOjima.Storage.saveMembers(this.members); // サンプルデータがあれば保存
    
    // 会場データの読み込み
    this.venues = FCOjima.Storage.loadVenues();
    FCOjima.Storage.saveVenues(this.venues); // サンプルデータがあれば保存
    
    // ログデータの読み込み
    this.logs = FCOjima.Storage.loadLogs();
};

/**
 * イベントリスナーの設定
 */
FCOjima.Hub.setupEventListeners = function() {
    // タブの初期化（デフォルトタブをクリック）
    document.getElementById('defaultTab').click();
    
    // 表示切り替えボタン
    document.getElementById('calendar-view').addEventListener('click', function() {
        document.getElementById('calendar-container').classList.remove('hidden');
        document.getElementById('list-container').classList.add('hidden');
        document.getElementById('calendar-view').classList.add('active');
        document.getElementById('list-view').classList.remove('active');
    });
    
    document.getElementById('list-view').addEventListener('click', function() {
        document.getElementById('calendar-container').classList.add('hidden');
        document.getElementById('list-container').classList.remove('hidden');
        document.getElementById('calendar-view').classList.remove('active');
        document.getElementById('list-view').classList.add('active');
    });
    
    // 月の移動ボタン
    document.getElementById('prev-month').addEventListener('click', function() {
        FCOjima.Hub.currentDate.setMonth(FCOjima.Hub.currentDate.getMonth() - 1);
        FCOjima.Hub.Calendar.renderCalendar();
        FCOjima.Hub.Calendar.renderEventsList();
    });
    
    document.getElementById('next-month').addEventListener('click', function() {
        FCOjima.Hub.currentDate.setMonth(FCOjima.Hub.currentDate.getMonth() + 1);
        FCOjima.Hub.Calendar.renderCalendar();
        FCOjima.Hub.Calendar.renderEventsList();
    });
    
    // アクションボタン
    document.getElementById('add-event').addEventListener('click', function() {
        FCOjima.Hub.Calendar.openAddEventModal();
    });
    
    document.getElementById('add-member').addEventListener('click', function() {
        FCOjima.Hub.Members.openAddMemberModal();
    });
    
    document.getElementById('edit-member').addEventListener('click', function() {
        FCOjima.Hub.Members.openMemberSelectForEdit();
    });
    
    document.getElementById('delete-member').addEventListener('click', function() {
        FCOjima.Hub.Members.openMemberSelectForDelete();
    });
    
    document.getElementById('add-venue').addEventListener('click', function() {
        FCOjima.Hub.Venues.openAddVenueModal();
    });
    
    document.getElementById('view-logs').addEventListener('click', function() {
        FCOjima.Hub.openLogsModal('calendar');
    });
    
    document.getElementById('member-logs').addEventListener('click', function() {
        FCOjima.Hub.openLogsModal('members');
    });
    
    // フォーム送信イベント
    document.getElementById('event-form').addEventListener('submit', function(e) {
        e.preventDefault();
        FCOjima.Hub.Calendar.saveEvent();
    });
    
    document.getElementById('member-form').addEventListener('submit', function(e) {
        e.preventDefault();
        FCOjima.Hub.Members.saveMember();
    });
    
    document.getElementById('venue-form').addEventListener('submit', function(e) {
        e.preventDefault();
        FCOjima.Hub.Venues.saveVenue();
    });
    
    // 会場選択ボタン
    document.getElementById('select-venue').addEventListener('click', function() {
        FCOjima.Hub.Venues.openVenueSelect('venue');
    });
    
    document.getElementById('select-meeting-venue').addEventListener('click', function() {
        FCOjima.Hub.Venues.openVenueSelect('meeting');
    });
    
    // 役割変更時のイベント（背番号フィールドの表示/非表示）
    document.getElementById('member-role').addEventListener('change', function() {
        const numberGroup = document.getElementById('number-group');
        if (this.value === 'player') {
            numberGroup.style.display = 'block';
        } else {
            numberGroup.style.display = 'none';
        }
    });
    
    // イベント詳細モーダルのボタン
    document.getElementById('manage-event').addEventListener('click', function() {
        const eventId = this.getAttribute('data-event-id');
        FCOjima.Hub.Calendar.navigateToCarpool(eventId);
    });
    
    document.getElementById('edit-event').addEventListener('click', function() {
        const eventId = this.getAttribute('data-event-id');
        FCOjima.Hub.Calendar.editEvent(eventId);
    });
    
    document.getElementById('delete-event').addEventListener('click', function() {
        const eventId = this.getAttribute('data-event-id');
        FCOjima.Hub.Calendar.deleteEvent(eventId);
    });
};

/**
 * 初期表示処理
 */
FCOjima.Hub.renderInitialView = function() {
    // カレンダーと予定リストの描画
    FCOjima.Hub.Calendar.renderCalendar();
    FCOjima.Hub.Calendar.renderEventsList();
    
    // メンバーリストの描画
    FCOjima.Hub.Members.renderMembersList();
    
    // 会場リストの描画
    FCOjima.Hub.Venues.renderVenuesList();
};

/**
 * ログモーダルを開く
 * @param {string} type - ログタイプ
 */
FCOjima.Hub.openLogsModal = function(type) {
    const logsContent = document.getElementById('logs-content');
    logsContent.innerHTML = '';
    
    // タイプに応じてログをフィルタリング
    const filteredLogs = this.logs.filter(log => log.type === type);
    
    if (filteredLogs.length === 0) {
        logsContent.innerHTML = FCOjima.UI.createAlert('info', 'ログがありません。');
    } else {
        // 日付で降順ソート
        const sortedLogs = [...filteredLogs].sort((a, b) => {
            return new Date(b.datetime) - new Date(a.datetime);
        });
        
        // テーブルを作成
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>日時</th>
                    <th>ユーザー</th>
                    <th>アクション</th>
                    <th>詳細</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        
        const tbody = table.querySelector('tbody');
        
        sortedLogs.forEach(log => {
            const row = document.createElement('tr');
            
            // 日時を整形
            const date = new Date(log.datetime);
            const formattedDate = date.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${FCOjima.UI.escapeHTML(log.user)}</td>
                <td>${FCOjima.UI.escapeHTML(log.action)}</td>
                <td>${FCOjima.UI.escapeHTML(log.details)}</td>
            `;
            
            tbody.appendChild(row);
        });
        
        logsContent.appendChild(table);
    }
    
    // モーダルを表示
    FCOjima.UI.openModal('logs-modal');
};

// DOMContentLoaded イベントで初期化
document.addEventListener('DOMContentLoaded', function() {
    FCOjima.Hub.init();
});