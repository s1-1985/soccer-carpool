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