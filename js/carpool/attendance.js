/**
 * FC尾島ジュニア - 出欠確認タブの機能（続き）
 * 出欠管理に関する機能を提供
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Attendance = FCOjima.Carpool.Attendance || {};

// 出欠確認モジュール
(function() {
    // 名前空間のショートカット
    const Attendance = FCOjima.Carpool.Attendance;
    const UI = FCOjima.UI;

    /**
     * 出欠確認機能の初期化
     */
    Attendance.init = function() {
        console.log('出欠確認機能を初期化しています...');
        FCOjima.Carpool.members = FCOjima.Storage.loadMembers();
        this.setupEventListeners();
        this.updateAttendance();
        this.updateStats();
        console.log('出欠確認機能の初期化が完了しました');
    };

    /**
     * イベントリスナーの設定
     */
    Attendance.setupEventListeners = function() {
        // 出欠保存ボタン
        var saveBtn = document.getElementById('save-attendance');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() { Attendance.saveAttendance(); });
        }
        // リマインドボタン
        var reminderBtn = document.getElementById('reminder-attendance');
        if (reminderBtn) {
            reminderBtn.addEventListener('click', function() { Attendance.reminderAttendance(); });
        }
        // メンバー追加ボタン
        var addBtn = document.getElementById('add-attendee');
        if (addBtn) {
            addBtn.addEventListener('click', function() { Attendance.openMemberSelectModal(); });
        }
    };

    /**
     * 出欠テーブルを描画
     */
    Attendance.updateAttendance = function() {
        console.log('出欠テーブルを更新します...');
        var tbody = document.querySelector('#attendance-table tbody');
        if (!tbody) return;

        var attendance = FCOjima.Carpool.appData.attendance || [];

        // 初回は全メンバー（選手）を出欠リストに追加
        if (attendance.length === 0) {
            var members = FCOjima.Carpool.members || [];
            var event = FCOjima.Storage.getSelectedEvent();
            var targetGrades = event && event.target && event.target.length > 0 ? event.target : null;

            members.forEach(function(m) {
                if (m.role !== 'player') return;
                if (targetGrades && !targetGrades.includes(m.grade)) return;
                attendance.push({ name: m.name, status: 'unknown', notes: '' });
            });
            FCOjima.Carpool.appData.attendance = attendance;
        }

        if (attendance.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-row">メンバーがいません</td></tr>';
            return;
        }

        tbody.innerHTML = attendance.map(function(item, idx) {
            var memberInfo = (FCOjima.Carpool.members || []).find(function(m) { return m.name === item.name; });
            var grade = memberInfo ? (FCOjima.Utils ? FCOjima.Utils.getGradeLabel(memberInfo.grade) : memberInfo.grade) : '';
            var statusClass = item.status === 'present' ? 'present' : item.status === 'absent' ? 'absent' : 'unknown';
            return '<tr>' +
                '<td>' + UI.escapeHTML(item.name) + '</td>' +
                '<td>' + UI.escapeHTML(grade || '') + '</td>' +
                '<td><select class="attendance-select ' + statusClass + '" data-index="' + idx + '">' +
                    '<option value="unknown"' + (item.status === 'unknown' ? ' selected' : '') + '>未回答</option>' +
                    '<option value="present"' + (item.status === 'present' ? ' selected' : '') + '>参加</option>' +
                    '<option value="absent"' + (item.status === 'absent' ? ' selected' : '') + '>不参加</option>' +
                '</select></td>' +
                '<td><input type="text" class="attendance-notes" data-index="' + idx + '" value="' + UI.escapeHTML(item.notes || '') + '" placeholder="備考"></td>' +
            '</tr>';
        }).join('');

        // selectのカラー動的更新
        tbody.querySelectorAll('.attendance-select').forEach(function(sel) {
            sel.addEventListener('change', function() {
                sel.className = 'attendance-select ' + sel.value;
            });
        });

        console.log('出欠テーブルの更新が完了しました');
    };

    /**
     * 出欠統計を描画
     */
    Attendance.updateStats = function() {
        var statsEl = document.getElementById('attendance-stats');
        if (!statsEl) return;
        var attendance = FCOjima.Carpool.appData.attendance || [];
        var present = attendance.filter(function(a) { return a.status === 'present'; }).length;
        var absent = attendance.filter(function(a) { return a.status === 'absent'; }).length;
        var unknown = attendance.filter(function(a) { return a.status === 'unknown'; }).length;
        statsEl.innerHTML =
            '<div class="stats-row">' +
            '<span class="stat present">参加: ' + present + '名</span>' +
            '<span class="stat absent">不参加: ' + absent + '名</span>' +
            '<span class="stat unknown">未回答: ' + unknown + '名</span>' +
            '</div>';
    };

    /**
     * 出欠を保存
     */
    Attendance.saveAttendance = function() {
        console.log('出欠を保存します...');
        var attendance = FCOjima.Carpool.appData.attendance || [];

        // UIから最新の値を取得
        document.querySelectorAll('.attendance-select').forEach(function(sel) {
            var idx = parseInt(sel.dataset.index);
            if (attendance[idx]) attendance[idx].status = sel.value;
        });
        document.querySelectorAll('.attendance-notes').forEach(function(input) {
            var idx = parseInt(input.dataset.index);
            if (attendance[idx]) attendance[idx].notes = input.value;
        });

        FCOjima.Carpool.appData.attendance = attendance;
        FCOjima.Carpool.saveData();
        this.updateStats();
        UI.showAlert('出欠を保存しました');
        console.log('出欠を保存しました');
    };

    /**
     * 未回答者へのリマインドメッセージを生成してクリップボードへコピー
     */
    Attendance.reminderAttendance = function() {
        console.log('リマインドメッセージを作成します...');
        var attendance = FCOjima.Carpool.appData.attendance || [];
        var event = FCOjima.Storage.getSelectedEvent();
        var unknownMembers = attendance.filter(function(a) { return a.status === 'unknown'; });

        if (unknownMembers.length === 0) {
            UI.showAlert('未回答者はいません');
            return;
        }

        var message = '【出欠回答のお願い】\n';
        if (event) {
            message += (FCOjima.Utils ? FCOjima.Utils.formatDateForDisplay(event.date) : event.date) + ' ' + event.title + '\n\n';
        }
        message += '以下の方がまだ出欠を回答されていません。\n\n';
        unknownMembers.forEach(function(a) { message += '・' + a.name + '\n'; });
        message += '\nご回答をお願いします。';

        if (FCOjima.Utils && FCOjima.Utils.copyToClipboard(message)) {
            UI.showAlert('リマインドメッセージをクリップボードにコピーしました。LINEに貼り付けて共有できます。');
            if (FCOjima.Utils.shareViaLINE) FCOjima.Utils.shareViaLINE(message);
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
    };

    /**
     * メンバー選択モーダルを開く（続き）
     */
    Attendance.openMemberSelectModal = function() {
        console.log('メンバー選択モーダルを開きます...');
        
        const selectList = document.getElementById('member-select-list');
        if (!selectList) {
            console.log('メンバー選択リスト要素が見つかりません');
            return;
        }
        
        selectList.innerHTML = '';
        
        // 現在の出欠データを取得
        const attendance = FCOjima.Carpool.appData.attendance || [];
        const attendanceNames = attendance.map(item => item.name);
        
        // 選手のみ取得
        const players = FCOjima.Carpool.members.filter(member => 
            member.role === 'player' && 
            !attendanceNames.includes(member.name)
        );
        
        if (players.length === 0) {
            selectList.innerHTML = UI.createAlert('info', '追加できるメンバーがいません');
            UI.openModal('member-select-modal');
            return;
        }
        
        // グレードでソート
        const playersByGrade = {};
        players.forEach(player => {
            const grade = player.grade || '未設定';
            if (!playersByGrade[grade]) {
                playersByGrade[grade] = [];
            }
            playersByGrade[grade].push(player);
        });
        
        // グレード順にソート（年少→年長→1年→6年）
        const sortedGrades = Object.keys(playersByGrade).sort((a, b) => {
            const gradeOrder = {
                '年少': -3,
                '年中': -2,
                '年長': -1,
                '未設定': 99
            };
            
            const valA = gradeOrder[a] !== undefined ? gradeOrder[a] : parseInt(a);
            const valB = gradeOrder[b] !== undefined ? gradeOrder[b] : parseInt(b);
            
            return valA - valB;
        });
        
        // 学年ごとにメンバーを表示
        sortedGrades.forEach(grade => {
            const gradeHeader = document.createElement('div');
            gradeHeader.className = 'grade-header';
            gradeHeader.textContent = FCOjima.Utils.getGradeLabel(grade);
            selectList.appendChild(gradeHeader);
            
            playersByGrade[grade].forEach(player => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.textContent = player.name;
                
                item.addEventListener('click', () => {
                    Attendance.addMemberToAttendance(player);
                    UI.closeModal('member-select-modal');
                });
                
                selectList.appendChild(item);
            });
        });
        
        UI.openModal('member-select-modal');
        console.log('メンバー選択モーダルを開きました');
    };
    
    /**
     * メンバーを出欠リストに追加
     * @param {Object} member - メンバーオブジェクト
     */
    Attendance.addMemberToAttendance = function(member) {
        console.log(`メンバーを出欠リストに追加します: ${member.name}`);
        
        // 既存の出欠データを取得
        const attendance = FCOjima.Carpool.appData.attendance || [];
        
        // 既に存在するかチェック
        const exists = attendance.some(item => item.name === member.name);
        if (exists) {
            UI.showAlert(`${member.name}は既に出欠リストに存在します`);
            return;
        }
        
        // 新しい出欠データを追加
        attendance.push({
            name: member.name,
            status: 'unknown',
            notes: ''
        });
        
        // データを保存
        FCOjima.Carpool.appData.attendance = attendance;
        FCOjima.Carpool.saveData();
        
        // 画面を更新
        this.updateAttendance();
        this.updateStats();
        
        UI.showAlert(`${member.name}を出欠リストに追加しました`);
        console.log(`メンバーを出欠リストに追加しました: ${member.name}`);
    };
    
    /**
     * 出欠リストからメンバーを削除
     * @param {string} name - メンバー名
     */
    Attendance.removeMemberFromAttendance = function(name) {
        console.log(`メンバーを出欠リストから削除します: ${name}`);
        
        // 既存の出欠データを取得
        const attendance = FCOjima.Carpool.appData.attendance || [];
        
        // 指定したメンバーを除外
        const newAttendance = attendance.filter(item => item.name !== name);
        
        // データが変更されなかった場合
        if (newAttendance.length === attendance.length) {
            UI.showAlert(`${name}は出欠リストに存在しません`);
            return;
        }
        
        // データを保存
        FCOjima.Carpool.appData.attendance = newAttendance;
        FCOjima.Carpool.saveData();
        
        // 画面を更新
        this.updateAttendance();
        this.updateStats();
        
        UI.showAlert(`${name}を出欠リストから削除しました`);
        console.log(`メンバーを出欠リストから削除しました: ${name}`);
    };
    
    /**
     * 出欠をCSV形式でエクスポート
     */
    Attendance.exportAttendanceCSV = function() {
        console.log('出欠データをCSVでエクスポートします...');
        
        const attendance = FCOjima.Carpool.appData.attendance || [];
        const event = FCOjima.Storage.getSelectedEvent();
        
        if (!event) {
            UI.showAlert('イベント情報が見つかりません');
            return;
        }
        
        // CSVヘッダー
        let csv = '名前,ステータス,備考\n';
        
        // 出欠データを追加
        attendance.forEach(item => {
            const status = item.status === 'present' ? '参加' : 
                          item.status === 'absent' ? '不参加' : '未回答';
            
            // CSVエスケープ処理
            const escapedName = item.name.replace(/"/g, '""');
            const escapedNotes = (item.notes || '').replace(/"/g, '""');
            
            csv += `"${escapedName}","${status}","${escapedNotes}"\n`;
        });
        
        // CSVをダウンロード
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `出欠_${event.date}_${event.title}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        UI.showAlert('出欠データをCSVでエクスポートしました');
        console.log('出欠データをCSVでエクスポートしました');
    };
    
    /**
     * 全メンバーの状態を一括設定
     * @param {string} status - 設定するステータス（'present', 'absent', 'unknown'）
     */
    Attendance.setAllMembersStatus = function(status) {
        console.log(`全メンバーのステータスを設定します: ${status}`);
        
        if (!['present', 'absent', 'unknown'].includes(status)) {
            console.error('無効なステータスです');
            return;
        }
        
        // 全ての選択要素を更新
        document.querySelectorAll('.attendance-select').forEach(select => {
            select.value = status;
            select.className = 'attendance-select ' + status;
        });
        
        UI.showAlert(`全メンバーのステータスを「${
            status === 'present' ? '参加' : 
            status === 'absent' ? '不参加' : '未回答'
        }」に設定しました`);
        console.log(`全メンバーのステータスを「${status}」に設定しました`);
    };
    
    /**
     * 出欠状況を共有
     */
    Attendance.shareAttendanceStatus = function() {
        console.log('出欠状況を共有します...');
        
        const attendance = FCOjima.Carpool.appData.attendance || [];
        const event = FCOjima.Storage.getSelectedEvent();
        
        if (!event) {
            UI.showAlert('イベント情報が見つかりません');
            return;
        }
        
        // 統計情報の計算
        const stats = {
            total: 0,
            present: 0,
            absent: 0,
            unknown: 0
        };
        
        // 対象学年のメンバー数をカウント
        const members = FCOjima.Carpool.members;
        if (event.target && event.target.length > 0) {
            stats.total = members.filter(member => 
                member.role === 'player' && 
                member.grade && 
                event.target.includes(member.grade)
            ).length;
        } else {
            stats.total = members.filter(member => member.role === 'player').length;
        }
        
        // 参加状況をカウント
        attendance.forEach(item => {
            if (item.status === 'present') {
                stats.present++;
            } else if (item.status === 'absent') {
                stats.absent++;
            } else {
                stats.unknown++;
            }
        });
        
        // 未回答者数を調整
        stats.unknown = stats.total - stats.present - stats.absent;
        if (stats.unknown < 0) stats.unknown = 0;
        
        // 参加メンバーを抽出
        const presentMembers = attendance
            .filter(item => item.status === 'present')
            .map(item => {
                const member = members.find(m => m.name === item.name);
                return {
                    name: item.name,
                    grade: member ? member.grade : null,
                    notes: item.notes
                };
            });
        
        // グレードでグループ化
        const presentByGrade = {};
        presentMembers.forEach(member => {
            const grade = member.grade || '未設定';
            if (!presentByGrade[grade]) {
                presentByGrade[grade] = [];
            }
            presentByGrade[grade].push(member);
        });
        
        // メッセージを生成
        let message = '【出欠状況】\n';
        message += FCOjima.Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        
        message += `参加: ${stats.present}名\n`;
        message += `不参加: ${stats.absent}名\n`;
        
        if (stats.unknown > 0) {
            message += `未回答: ${stats.unknown}名\n`;
        }
        
        message += '\n【参加者一覧】\n';
        
        // グレード順にソート（年少→年長→1年→6年）
        const sortedGrades = Object.keys(presentByGrade).sort((a, b) => {
            const gradeOrder = {
                '年少': -3,
                '年中': -2,
                '年長': -1,
                '未設定': 99
            };
            
            const valA = gradeOrder[a] !== undefined ? gradeOrder[a] : parseInt(a);
            const valB = gradeOrder[b] !== undefined ? gradeOrder[b] : parseInt(b);
            
            return valA - valB;
        });
        
        // 学年ごとに参加者を表示
        sortedGrades.forEach(grade => {
            message += `\n◆${FCOjima.Utils.getGradeLabel(grade)}\n`;
            
            presentByGrade[grade].forEach(member => {
                message += `・${member.name}`;
                if (member.notes) {
                    message += ` (${member.notes})`;
                }
                message += '\n';
            });
        });
        
        // テキストをクリップボードにコピー
        if (FCOjima.Utils.copyToClipboard(message)) {
            UI.showAlert('出欠状況をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
            
            // LINEでの共有（モバイルのみ）
            if (FCOjima.Utils.shareViaLINE(message)) {
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
        
        console.log('出欠状況の共有メッセージを作成しました');
    };
})();