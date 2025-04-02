/**
 * FC尾島ジュニア - 出欠確認タブの機能
 * 出欠管理に関する機能を提供
 */

(function(app) {
    // 名前空間のショートカット
    var Attendance = app.Carpool.Attendance;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;
    
    /**
     * 初期化
     */
    Attendance.init = function() {
        console.log('出欠確認機能を初期化しています...');
        
        // 出欠回答期限を表示 (問題12: 出欠回答期限表示の実装)
        this.updateDeadline();
        
        // 出欠状況を表示（問題4: 指定学年の選手が表示されない - 修正）
        this.updateAttendance();
        
        // 出欠統計を表示
        this.updateStats();
        
        console.log('出欠確認機能の初期化が完了しました');
    };
    
    /**
     * 出欠回答期限を表示
     */
    Attendance.updateDeadline = function() {
        console.log('出欠回答期限を更新しています...');
        
        var deadlineElement = document.getElementById('attendance-deadline');
        if (!deadlineElement) {
            console.log('出欠期限表示要素が見つかりません');
            return;
        }
        
        // イベント情報を取得
        var event = Storage.getSelectedEvent();
        if (!event) {
            deadlineElement.innerHTML = '';
            console.log('イベント情報が見つかりません');
            return;
        }
        
        // 回答期限の表示
        if (event.attendanceDeadline) {
            var deadlineDate = new Date(event.attendanceDeadline);
            var formattedDeadline = deadlineDate.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            deadlineElement.innerHTML = '\
                <p><strong>出欠回答期限: ' + formattedDeadline + '</strong></p>';
            
            // 期限が過ぎている場合は赤字で表示
            var now = new Date();
            if (deadlineDate < now) {
                deadlineElement.classList.add('deadline-expired');
            } else {
                deadlineElement.classList.remove('deadline-expired');
            }
        } else {
            deadlineElement.innerHTML = '\
                <p>出欠回答期限は設定されていません</p>';
        }
        
        console.log('出欠回答期限の表示を更新しました');
    };