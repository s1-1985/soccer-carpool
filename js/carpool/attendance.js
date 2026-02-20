/**

 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Attendance = FCOjima.Carpool.Attendance || {};

// 出欠確認モジュール
(function () {
    const Attendance = FCOjima.Carpool.Attendance;
    const Firestore = FCOjima.Firestore;
    const Auth = FCOjima.Auth;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;

    // データ
    let currentEvent = null;
    let targetMembers = [];
    let attendanceData = {};
    let carpoolData = null;
    let membersUnsubscribe = null;
    let carpoolUnsubscribe = null;
    let currentFilters = {
        role: 'all',
        grade: 'all',
        status: 'all'
    };

    /**
     * 出欠確認機能の初期化
     */
    Attendance.init = async function () {
        try {
            // 認証チェック
            if (!Auth.isLoggedIn()) {
                console.warn('未ログインユーザーです');
                UI.showAlert('ログインが必要です', 'warning');
                window.location.href = '../auth/login.html';
                return;
            }

            // セッションからイベントIDを取得
            const selectedEventId = sessionStorage.getItem('fc-ojima-selected-event');
            if (!selectedEventId) {
                UI.showAlert('イベントが選択されていません', 'warning');
                window.location.href = 'index.html';
                return;
            }

            // イベント情報を取得
            currentEvent = await Firestore.getDocument('events', selectedEventId);
            if (!currentEvent) {
                UI.showAlert('指定されたイベントが見つかりません', 'danger');
                window.location.href = 'index.html';
                return;
            }

            // データをリアルタイム監視で読み込み
            setupRealtimeListeners();

            // UI要素の初期化
            setupEventListeners();
            updateEventInfo();
            updateDisplay();

            // モーダルの初期化
            if (UI && UI.initModals) {
                UI.initModals();
            }

            console.log('出欠確認機能を初期化しました（Firebase版）');

        } catch (error) {
            console.error('出欠確認初期化エラー:', error);
            UI.showAlert('出欠確認の初期化に失敗しました', 'danger');
        }
    };

    /**
     * リアルタイムリスナーの設定
     */
    function setupRealtimeListeners() {
        // メンバーのリアルタイム監視
        membersUnsubscribe = Firestore.watchMembers((updatedMembers) => {
            // イベント対象メンバーをフィルタリング
            targetMembers = filterTargetMembers(updatedMembers);
            updateDisplay();
        });

        // 配車データ（出欠情報含む）のリアルタイム監視
        carpoolUnsubscribe = Firestore.watchCarpoolData(currentEvent.id, (updatedData) => {
            carpoolData = updatedData;
            attendanceData = carpoolData?.attendance || {};
            updateDisplay();
        });
    }

    /**
     * イベント対象メンバーをフィルタリング
     */
    function filterTargetMembers(allMembers) {
        return allMembers.filter(member => {
            // アクティブなメンバーのみ
            if (member.status !== 'active') return false;

            // 対象学年が指定されている場合
            if (currentEvent.targetGrades && currentEvent.targetGrades.length > 0) {
                // 選手の場合は学年チェック
                if (member.role === 'player') {
                    const memberGrade = calculateGrade(member.birthDate);
                    return memberGrade && currentEvent.targetGrades.includes(memberGrade);
                }
                // 監督・コーチは常に対象
                return member.role === 'coach';
            }

            // 全学年対象の場合は選手・監督・コーチが対象
            return ['player', 'coach'].includes(member.role);
        }).sort((a, b) => {
            // ソート順: 役割 → 学年 → 名前
            if (a.role !== b.role) {
                const roleOrder = { 'coach': 0, 'player': 1 };
                return (roleOrder[a.role] || 2) - (roleOrder[b.role] || 2);
            }

            if (a.role === 'player') {
                const gradeA = calculateGrade(a.birthDate) || '0';
                const gradeB = calculateGrade(b.birthDate) || '0';
                if (gradeA !== gradeB) {
                    return parseInt(gradeA) - parseInt(gradeB);
                }
            }

            return a.name.localeCompare(b.name);
        });
    }

    /**
     * イベントリスナーの設定
     */
    function setupEventListeners() {
        // フィルター機能
        const roleFilter = document.getElementById('role-filter');
        const gradeFilter = document.getElementById('grade-filter');
        const statusFilter = document.getElementById('status-filter');

        if (roleFilter) {
            roleFilter.addEventListener('change', function () {
                currentFilters.role = this.value;
                updateDisplay();
            });
        }

        if (gradeFilter) {
            gradeFilter.addEventListener('change', function () {
                currentFilters.grade = this.value;
                updateDisplay();
            });
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', function () {
                currentFilters.status = this.value;
                updateDisplay();
            });
        }

        // 一括設定ボタン
        const bulkAttendingBtn = document.getElementById('bulk-attending');
        const bulkAbsentBtn = document.getElementById('bulk-absent');
        const bulkPendingBtn = document.getElementById('bulk-pending');

        if (bulkAttendingBtn) {
            bulkAttendingBtn.addEventListener('click', () => setBulkAttendance('attending'));
        }

        if (bulkAbsentBtn) {
            bulkAbsentBtn.addEventListener('click', () => setBulkAttendance('absent'));
        }

        if (bulkPendingBtn) {
            bulkPendingBtn.addEventListener('click', () => setBulkAttendance('pending'));
        }

        // リマインド送信
        const sendReminderBtn = document.getElementById('send-reminder');
        if (sendReminderBtn) {
            sendReminderBtn.addEventListener('click', sendReminder);
        }

        // LINE共有
        const shareAttendanceBtn = document.getElementById('share-attendance');
        if (shareAttendanceBtn) {
            shareAttendanceBtn.addEventListener('click', shareAttendance);
        }

        // 次のステップへ
        const nextStepBtn = document.getElementById('next-step');
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => {
                window.location.href = 'cars.html';
            });
        }

        // 概要に戻る
        const backToOverviewBtn = document.getElementById('back-to-overview');
        if (backToOverviewBtn) {
            backToOverviewBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        // メンバー追加モーダル
        const addMemberBtn = document.getElementById('add-member');
        if (addMemberBtn) {
            addMemberBtn.addEventListener('click', openAddMemberModal);
        }
    }

    /**
     * イベント情報を更新
     */
    function updateEventInfo() {
        const eventInfoCard = document.getElementById('event-info');
        if (!eventInfoCard || !currentEvent) return;

        const eventDate = new Date(currentEvent.date);
        const isUpcoming = eventDate > new Date();

        eventInfoCard.innerHTML = `
            <div class="event-header">
                <h3>${Utils.escapeHTML(currentEvent.title)}</h3>
                <span class="event-type type-${currentEvent.type}">${getEventTypeLabel(currentEvent.type)}</span>
                ${!isUpcoming ? '<span class="badge badge-secondary">終了</span>' : ''}
            </div>
            
            <div class="event-details">
                <div class="event-detail-item">
                    <i class="icon-calendar"></i>
                    <span>${Utils.formatDate(eventDate)}</span>
                    ${currentEvent.time ? `<span class="event-time">${currentEvent.time}</span>` : ''}
                </div>
                
                ${currentEvent.venue ? `
                    <div class="event-detail-item">
                        <i class="icon-location"></i>
                        <span>${Utils.escapeHTML(currentEvent.venue)}</span>
                    </div>
                ` : ''}
                
                ${currentEvent.targetGrades && currentEvent.targetGrades.length > 0 ? `
                    <div class="event-detail-item">
                        <i class="icon-users"></i>
                        <span>対象: ${currentEvent.targetGrades.join(', ')}年生</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 表示を更新
     */
    function updateDisplay() {
        updateAttendanceList();
        updateStats();
        updateBulkActions();
    }

    /**
     * 出欠一覧を更新
     */
    function updateAttendanceList() {
        const attendanceList = document.getElementById('attendance-list');
        if (!attendanceList) return;

        const filteredMembers = getFilteredMembers();

        if (filteredMembers.length === 0) {
            attendanceList.innerHTML = '<div class="no-members">対象メンバーがいません。</div>';
            return;
        }

        let html = `
            <div class="attendance-table-container">
                <table class="table attendance-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="select-all-attendance"></th>
                            <th>名前</th>
                            <th>役割</th>
                            <th>学年</th>
                            <th>出欠</th>
                            <th>回答日時</th>
                            <th>備考</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filteredMembers.forEach(member => {
            html += createAttendanceRow(member);
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        attendanceList.innerHTML = html;

        // イベントリスナーを設定
        setupAttendanceRowEvents();
    }

    /**
     * 出欠行を作成
     */
    function createAttendanceRow(member) {
        const memberAttendance = attendanceData[member.id];
        const status = memberAttendance?.status || 'pending';
        const respondedAt = memberAttendance?.respondedAt;
        const notes = memberAttendance?.notes || '';

        const roleLabel = getRoleLabel(member.role);
        const gradeDisplay = member.role === 'player' ? (calculateGrade(member.birthDate) || '-') : '-';
        const statusLabel = getStatusLabel(status);
        const statusClass = getStatusClass(status);

        return `
            <tr class="attendance-row ${statusClass}" data-member-id="${member.id}">
                <td><input type="checkbox" class="attendance-checkbox" value="${member.id}"></td>
                <td>
                    <div class="member-info">
                        <strong>${Utils.escapeHTML(member.name)}</strong>
                        ${member.number ? `<span class="member-number">#${member.number}</span>` : ''}
                    </div>
                </td>
                <td><span class="role-badge role-${member.role}">${roleLabel}</span></td>
                <td>${gradeDisplay}</td>
                <td>
                    <select class="attendance-select" data-member-id="${member.id}">
                        <option value="pending" ${status === 'pending' ? 'selected' : ''}>未回答</option>
                        <option value="attending" ${status === 'attending' ? 'selected' : ''}>参加</option>
                        <option value="absent" ${status === 'absent' ? 'selected' : ''}>不参加</option>
                    </select>
                </td>
                <td>
                    ${respondedAt ? `
                        <span class="responded-time">${Utils.formatDateTime(new Date(respondedAt))}</span>
                    ` : '-'}
                </td>
                <td>
                    <input type="text" class="attendance-notes" data-member-id="${member.id}" 
                           value="${Utils.escapeHTML(notes)}" placeholder="備考">
                </td>
                <td>
                    <div class="attendance-actions">
                        <button onclick="FCOjima.Carpool.Attendance.sendIndividualReminder('${member.id}')" 
                                class="btn btn-info btn-sm" title="個別リマインド">📧</button>
                        <button onclick="FCOjima.Carpool.Attendance.removeMember('${member.id}')" 
                                class="btn btn-danger btn-sm" title="対象外にする">🚫</button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * 出欠行のイベントを設定
     */
    function setupAttendanceRowEvents() {
        // 出欠選択の変更
        document.querySelectorAll('.attendance-select').forEach(select => {
            select.addEventListener('change', function () {
                const memberId = this.dataset.memberId;
                const status = this.value;
                updateMemberAttendance(memberId, status);
            });
        });

        // 備考の変更
        document.querySelectorAll('.attendance-notes').forEach(input => {
            input.addEventListener('blur', function () {
                const memberId = this.dataset.memberId;
                const notes = this.value.trim();
                updateMemberNotes(memberId, notes);
            });
        });

        // 全選択チェックボックス
        const selectAllCheckbox = document.getElementById('select-all-attendance');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function () {
                document.querySelectorAll('.attendance-checkbox').forEach(checkbox => {
                    checkbox.checked = this.checked;
                });
                updateBulkActions();
            });
        }

        // 個別チェックボックス
        document.querySelectorAll('.attendance-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', updateBulkActions);
        });
    }

    /**
     * メンバーの出欠を更新
     */
    async function updateMemberAttendance(memberId, status) {
        try {
            const updatedAttendance = {
                ...attendanceData,
                [memberId]: {
                    ...attendanceData[memberId],
                    status: status,
                    respondedAt: new Date().toISOString(),
                    updatedBy: Auth.getCurrentUser()?.uid || 'unknown'
                }
            };

            await saveCarpoolData({ attendance: updatedAttendance });

            // ログ記録
            const member = targetMembers.find(m => m.id === memberId);
            const statusLabel = getStatusLabel(status);
            await Firestore.addLog('carpool',
                `${member?.name}の出欠を「${statusLabel}」に更新しました（${currentEvent.title}）`);

        } catch (error) {
            console.error('出欠更新エラー:', error);
            UI.showAlert('出欠の更新に失敗しました', 'danger');
        }
    }

    /**
     * メンバーの備考を更新
     */
    async function updateMemberNotes(memberId, notes) {
        try {
            const updatedAttendance = {
                ...attendanceData,
                [memberId]: {
                    ...attendanceData[memberId],
                    notes: notes,
                    updatedAt: new Date().toISOString()
                }
            };

            await saveCarpoolData({ attendance: updatedAttendance });

        } catch (error) {
            console.error('備考更新エラー:', error);
            UI.showAlert('備考の更新に失敗しました', 'danger');
        }
    }

    /**
     * 配車データを保存
     */
    async function saveCarpoolData(dataToUpdate) {
        const updatedCarpoolData = {
            ...carpoolData,
            ...dataToUpdate,
            lastUpdated: new Date().toISOString()
        };

        await Firestore.setDocument('carpool', currentEvent.id, updatedCarpoolData);
    }

    /**
     * 一括出欠設定
     */
    async function setBulkAttendance(status) {
        const checkedBoxes = document.querySelectorAll('.attendance-checkbox:checked');
        const memberIds = Array.from(checkedBoxes).map(cb => cb.value);

        if (memberIds.length === 0) {
            UI.showAlert('メンバーを選択してください', 'warning');
            return;
        }

        const statusLabel = getStatusLabel(status);
        if (!confirm(`選択した${memberIds.length}名の出欠を「${statusLabel}」に設定しますか？`)) {
            return;
        }

        try {
            const updatedAttendance = { ...attendanceData };
            const now = new Date().toISOString();
            const currentUser = Auth.getCurrentUser()?.uid || 'unknown';

            memberIds.forEach(memberId => {
                updatedAttendance[memberId] = {
                    ...updatedAttendance[memberId],
                    status: status,
                    respondedAt: now,
                    updatedBy: currentUser
                };
            });

            await saveCarpoolData({ attendance: updatedAttendance });

            UI.showAlert(`${memberIds.length}名の出欠を「${statusLabel}」に設定しました`, 'success');
            await Firestore.addLog('carpool',
                `${memberIds.length}名の出欠を一括で「${statusLabel}」に設定しました（${currentEvent.title}）`);

        } catch (error) {
            console.error('一括出欠設定エラー:', error);
            UI.showAlert('一括出欠設定に失敗しました', 'danger');
        }
    }

    /**
     * リマインドを送信
     */
    function sendReminder() {
        const pendingMembers = targetMembers.filter(member => {
            const attendance = attendanceData[member.id];
            return !attendance || attendance.status === 'pending';
        });

        if (pendingMembers.length === 0) {
            UI.showAlert('未回答者はいません', 'info');
            return;
        }

        // リマインドメッセージの作成
        const eventDate = Utils.formatDate(new Date(currentEvent.date));
        let message = `【出欠確認のお願い】\n\n`;
        message += `${currentEvent.title}\n`;
        message += `📅 ${eventDate} ${currentEvent.time || ''}\n`;
        message += `📍 ${currentEvent.venue || ''}\n\n`;
        message += `以下の方の出欠回答をお待ちしています：\n`;

        pendingMembers.forEach((member, index) => {
            message += `${index + 1}. ${member.name}`;
            if (member.role === 'player') {
                const grade = calculateGrade(member.birthDate);
                if (grade) message += `（${grade}年生）`;
            }
            message += '\n';
        });

        message += `\n配車管理ページ: ${window.location.href}`;

        // LINE共有
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
        window.open(lineUrl, '_blank');

        UI.showAlert(`未回答者${pendingMembers.length}名にリマインドを送信しました`, 'success');
        Firestore.addLog('carpool', `未回答者${pendingMembers.length}名にリマインドを送信しました（${currentEvent.title}）`);
    }

    /**
     * 個別リマインドを送信
     */
    Attendance.sendIndividualReminder = function (memberId) {
        const member = targetMembers.find(m => m.id === memberId);
        if (!member) return;

        const eventDate = Utils.formatDate(new Date(currentEvent.date));
        let message = `【${member.name}さんへ 出欠確認のお願い】\n\n`;
        message += `${currentEvent.title}\n`;
        message += `📅 ${eventDate} ${currentEvent.time || ''}\n`;
        message += `📍 ${currentEvent.venue || ''}\n\n`;
        message += `出欠のご回答をお待ちしています。\n`;
        message += `配車管理ページ: ${window.location.href}`;

        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
        window.open(lineUrl, '_blank');

        UI.showAlert(`${member.name}さんに個別リマインドを送信しました`, 'success');
    };

    /**
     * メンバーを対象外にする
     */
    Attendance.removeMember = function (memberId) {
        const member = targetMembers.find(m => m.id === memberId);
        if (!member) return;

        if (!confirm(`${member.name}さんを出欠確認の対象外にしますか？`)) {
            return;
        }

        // 出欠データから削除
        const updatedAttendance = { ...attendanceData };
        delete updatedAttendance[memberId];

        saveCarpoolData({ attendance: updatedAttendance })
            .then(() => {
                UI.showAlert(`${member.name}さんを対象外にしました`, 'success');
                Firestore.addLog('carpool', `${member.name}さんを出欠確認の対象外にしました（${currentEvent.title}）`);
            })
            .catch(error => {
                console.error('メンバー除外エラー:', error);
                UI.showAlert('メンバーの除外に失敗しました', 'danger');
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
    Attendance.addMemberToAttendance = function (member) {
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
    Attendance.removeMemberFromAttendance = function (name) {
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
    Attendance.exportAttendanceCSV = function () {
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
    Attendance.setAllMembersStatus = function (status) {
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

        UI.showAlert(`全メンバーのステータスを「${status === 'present' ? '参加' :
            status === 'absent' ? '不参加' : '未回答'
            }」に設定しました`);
        console.log(`全メンバーのステータスを「${status}」に設定しました`);
    };

    /**
     * 出欠状況を共有
     */
    function shareAttendance() {
        const stats = getAttendanceStats();
        const eventDate = Utils.formatDate(new Date(currentEvent.date));

        let message = `【出欠状況】\n\n`;
        message += `${currentEvent.title}\n`;
        message += `📅 ${eventDate} ${currentEvent.time || ''}\n`;
        message += `📍 ${currentEvent.venue || ''}\n\n`;

        message += `📊 出欠状況\n`;
        message += `参加予定: ${stats.attending}名\n`;
        message += `不参加: ${stats.absent}名\n`;
        message += `未回答: ${stats.pending}名\n`;
        message += `合計: ${stats.total}名\n\n`;

        // 参加者一覧
        if (stats.attending > 0) {
            message += `👥 参加予定者\n`;
            const attendingMembers = targetMembers.filter(member => {
                const attendance = attendanceData[member.id];
                return attendance && attendance.status === 'attending';
            });

            attendingMembers.forEach((member, index) => {
                message += `${index + 1}. ${member.name}`;
                if (member.role === 'player') {
                    const grade = calculateGrade(member.birthDate);
                    if (grade) message += `（${grade}年生）`;
                }
                message += '\n';
            });
        }

        message += `\n更新日時: ${new Date().toLocaleString()}`;

        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
        window.open(lineUrl, '_blank');

        UI.showAlert('出欠状況をLINEで共有しました', 'success');
    }

    /**
     * メンバー追加モーダルを開く
     */
    function openAddMemberModal() {
        // 実装中メッセージ
        UI.showAlert('メンバー追加機能は開発中です', 'info');
    }

    /**
     * フィルタリングされたメンバーを取得
     */
    function getFilteredMembers() {
        return targetMembers.filter(member => {
            // 役割フィルター
            const roleMatch = currentFilters.role === 'all' || member.role === currentFilters.role;

            // 学年フィルター
            const grade = calculateGrade(member.birthDate);
            const gradeMatch = currentFilters.grade === 'all' || grade === currentFilters.grade;

            // 出欠ステータスフィルター
            const attendance = attendanceData[member.id];
            const status = attendance?.status || 'pending';
            const statusMatch = currentFilters.status === 'all' || status === currentFilters.status;

            return roleMatch && gradeMatch && statusMatch;
        });
    }

    /**
     * 統計情報を更新
     */
    function updateStats() {
        const statsCard = document.getElementById('attendance-stats');
        if (!statsCard) return;

        const stats = getAttendanceStats();
        const responseRate = stats.total > 0 ? Math.round(((stats.attending + stats.absent) / stats.total) * 100) : 0;

        statsCard.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item stat-attending">
                    <div class="stat-number">${stats.attending}</div>
                    <div class="stat-label">参加予定</div>
                </div>
                
                <div class="stat-item stat-absent">
                    <div class="stat-number">${stats.absent}</div>
                    <div class="stat-label">不参加</div>
                </div>
                
                <div class="stat-item stat-pending">
                    <div class="stat-number">${stats.pending}</div>
                    <div class="stat-label">未回答</div>
                </div>
                
                <div class="stat-item stat-total">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">合計</div>
                </div>
            </div>
            
            <div class="response-rate">
                <div class="response-rate-label">回答率</div>
                <div class="response-rate-bar">
                    <div class="response-rate-fill" style="width: ${responseRate}%"></div>
                </div>
                <div class="response-rate-text">${responseRate}%</div>
            </div>
            
            ${stats.pending > 0 ? `
                <div class="alert alert-warning">
                    <strong>未回答者:</strong> ${stats.pending}名の回答が未完了です
                </div>
            ` : stats.total > 0 ? `
                <div class="alert alert-success">
                    <strong>回答完了:</strong> 全員の回答が完了しました
                </div>
            ` : ''}
        `;
    }

    /**
     * 出欠統計を取得
     */
    function getAttendanceStats() {
        const attending = targetMembers.filter(member => {
            const attendance = attendanceData[member.id];
            return attendance && attendance.status === 'attending';
        }).length;

        const absent = targetMembers.filter(member => {
            const attendance = attendanceData[member.id];
            return attendance && attendance.status === 'absent';
        }).length;

        const pending = targetMembers.filter(member => {
            const attendance = attendanceData[member.id];
            return !attendance || attendance.status === 'pending';
        }).length;

        return {
            attending,
            absent,
            pending,
            total: targetMembers.length
        };
    }

    /**
     * 一括操作ボタンの更新
     */
    function updateBulkActions() {
        const checkedBoxes = document.querySelectorAll('.attendance-checkbox:checked');
        const bulkActions = document.getElementById('bulk-actions');

        if (bulkActions) {
            bulkActions.style.display = checkedBoxes.length > 0 ? 'block' : 'none';
        }
    }

    /**
     * 学年を計算
     */
    function calculateGrade(birthDate) {
        if (!birthDate) return null;

        const birth = new Date(birthDate);
        const now = new Date();

        const schoolYearStart = new Date(now.getFullYear(), 3, 2);
        if (now < schoolYearStart) {
            schoolYearStart.setFullYear(schoolYearStart.getFullYear() - 1);
        }

        const elementarySchoolEntryYear = birth.getFullYear() + (birth.getMonth() >= 3 && birth.getDate() >= 2 ? 7 : 6);
        const gradeOffset = schoolYearStart.getFullYear() - elementarySchoolEntryYear;

        if (gradeOffset === -3) return "年少";
        if (gradeOffset === -2) return "年中";
        if (gradeOffset === -1) return "年長";
        if (gradeOffset >= 0 && gradeOffset <= 5) return String(gradeOffset + 1);

        return null;
    }

    /**
     * ヘルパー関数
     */
    function getEventTypeLabel(type) {
        const labels = { match: '試合', practice: '練習', other: 'その他' };
        return labels[type] || type;
    }

    function getRoleLabel(role) {
        const labels = { coach: '監督・コーチ', player: '選手', parent: '保護者' };
        return labels[role] || role;
    }

    function getStatusLabel(status) {
        const labels = { attending: '参加', absent: '不参加', pending: '未回答' };
        return labels[status] || status;
    }

    function getStatusClass(status) {
        return `attendance-${status}`;
    }

    /**
     * 表示の更新（外部から呼び出し可能）
     */
    Attendance.updateDisplay = updateDisplay;

    /**
     * クリーンアップ
     */
    Attendance.destroy = function () {
        if (membersUnsubscribe) {
            membersUnsubscribe();
            membersUnsubscribe = null;
        }

        if (carpoolUnsubscribe) {
            carpoolUnsubscribe();
            carpoolUnsubscribe = null;
        }
    };

    // ページから離れる時のクリーンアップ
    window.addEventListener('beforeunload', Attendance.destroy);

})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function () {
    if (typeof FCOjima !== 'undefined' && FCOjima.Carpool && FCOjima.Carpool.Attendance) {
        FCOjima.Carpool.Attendance.init();
    }
});

