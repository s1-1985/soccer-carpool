/**
 * FC尾島ジュニア - 座席割り当て機能（Firebase版）
 * ドラッグ&ドロップ、座席レイアウト、自動配置機能
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Assignment = FCOjima.Carpool.Assignment || {};

// 座席割り当てモジュール
(function () {
    const Assignment = FCOjima.Carpool.Assignment;
    const Firestore = FCOjima.Firestore;
    const Auth = FCOjima.Auth;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;

    // データ
    let currentEvent = null;
    let attendanceData = {};
    let carsData = [];
    let assignmentData = {};
    let carpoolData = null;
    let membersData = [];
    let carpoolUnsubscribe = null;
    let membersUnsubscribe = null;

    // ドラッグ&ドロップ関連
    let draggedElement = null;
    let draggedMemberId = null;
    let draggedFromSeat = null;
    let longPressTimer = null;
    let isDragging = false;

    // 設定
    const LONG_PRESS_DURATION = 500; // ミリ秒

    /**
     * 座席割り当て機能の初期化
     */
    Assignment.init = async function () {
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

            // メンバー情報を取得
            membersData = await Firestore.loadMembers();

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

            console.log('座席割り当て機能を初期化しました（Firebase版）');

        } catch (error) {
            console.error('座席割り当て初期化エラー:', error);
            UI.showAlert('座席割り当ての初期化に失敗しました', 'danger');
        }
    };

    /**
     * リアルタイムリスナーの設定
     */
    function setupRealtimeListeners() {
        // メンバーデータの監視
        membersUnsubscribe = Firestore.watchMembers((updatedMembers) => {
            membersData = updatedMembers.filter(member => member.status === 'active');
            updateDisplay();
        });

        // 配車データのリアルタイム監視
        carpoolUnsubscribe = Firestore.watchCarpoolData(currentEvent.id, (updatedData) => {
            carpoolData = updatedData;
            attendanceData = carpoolData?.attendance || {};
            carsData = carpoolData?.cars || [];
            assignmentData = carpoolData?.assignments || {};
            updateDisplay();
        });
    }

    /**
     * イベントリスナーの設定
     */
    function setupEventListeners() {
        // 自動配置ボタン
        const autoAssignBtn = document.getElementById('auto-assign');
        if (autoAssignBtn) {
            autoAssignBtn.addEventListener('click', performAutoAssignment);
        }

        // 配置リセットボタン
        const resetAssignmentBtn = document.getElementById('reset-assignment');
        if (resetAssignmentBtn) {
            resetAssignmentBtn.addEventListener('click', resetAllAssignments);
        }

        // 配置最適化ボタン
        const optimizeBtn = document.getElementById('optimize-assignment');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', optimizeAssignment);
        }

        // LINE共有ボタン
        const shareAssignmentBtn = document.getElementById('share-assignment');
        if (shareAssignmentBtn) {
            shareAssignmentBtn.addEventListener('click', shareAssignmentInfo);
        }

        // 次のステップへ
        const nextStepBtn = document.getElementById('next-step');
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => {
                window.location.href = 'notifications.html';
            });
        }

        // 前のステップに戻る
        const prevStepBtn = document.getElementById('prev-step');
        if (prevStepBtn) {
            prevStepBtn.addEventListener('click', () => {
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

        // 表示切り替え
        const toggleViewBtn = document.getElementById('toggle-view');
        if (toggleViewBtn) {
            toggleViewBtn.addEventListener('click', toggleAssignmentView);
        }
    }

    /**
     * イベント情報を更新
     */
    function updateEventInfo() {
        const eventInfoCard = document.getElementById('event-info');
        if (!eventInfoCard || !currentEvent) return;

        const eventDate = new Date(currentEvent.date);

        eventInfoCard.innerHTML = `
            <div class="event-header">
                <h3>${Utils.escapeHTML(currentEvent.title)}</h3>
                <span class="event-type type-${currentEvent.type}">${getEventTypeLabel(currentEvent.type)}</span>
            </div>
            
            <div class="event-details">
                <div class="event-detail-item">
                    <i class="icon-calendar"></i>
                    <span>${Utils.formatDate(eventDate)} ${currentEvent.time || ''}</span>
                </div>
                
                ${currentEvent.venue ? `
                    <div class="event-detail-item">
                        <i class="icon-location"></i>
                        <span>${Utils.escapeHTML(currentEvent.venue)}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 表示を更新
     */
    function updateDisplay() {
        if (carsData.length === 0) {
            showNoCarsMessage();
            return;
        }

        updateMembersList();
        updateCarsAssignment();
        updateStats();
        updateProgress();
    }

    /**
     * 車両なしメッセージを表示
     */
    function showNoCarsMessage() {
        const assignmentContainer = document.getElementById('assignment-container');
        if (!assignmentContainer) return;

        assignmentContainer.innerHTML = `
            <div class="no-cars-message">
                <h4>車両が登録されていません</h4>
                <p>座席割り当てを行うには、まず車両提供の登録が必要です。</p>
                <button onclick="window.location.href='cars.html'" class="btn btn-primary">
                    車両提供ページへ
                </button>
            </div>
        `;
    }

    /**
     * メンバー一覧を更新
     */
    function updateMembersList() {
        const membersList = document.getElementById('unassigned-members');
        if (!membersList) return;

        const attendingMembers = getAttendingMembers();
        const unassignedMembers = getUnassignedMembers(attendingMembers);

        if (unassignedMembers.length === 0) {
            membersList.innerHTML = `
                <div class="no-unassigned">
                    <p>✅ 全員配置済み</p>
                </div>
            `;
            return;
        }

        let html = '<div class="members-grid">';

        unassignedMembers.forEach(member => {
            html += createDraggableMember(member);
        });

        html += '</div>';

        membersList.innerHTML = html;

        // ドラッグイベントを設定
        setupMemberDragEvents();
    }

    /**
     * ドラッグ可能なメンバー要素を作成
     */
    function createDraggableMember(member) {
        const grade = member.role === 'player' ? (calculateGrade(member.birthDate) || '') : '';
        const roleClass = `role-${member.role}`;

        return `
            <div class="draggable-member ${roleClass}" 
                 data-member-id="${member.id}"
                 draggable="true">
                <div class="member-info">
                    <div class="member-name">${Utils.escapeHTML(member.name)}</div>
                    ${grade ? `<div class="member-grade">${grade}年生</div>` : ''}
                    ${member.number ? `<div class="member-number">#${member.number}</div>` : ''}
                </div>
                <div class="member-role">${getRoleLabel(member.role)}</div>
            </div>
        `;
    }

    /**
     * 車両別座席割り当てを更新
     */
    function updateCarsAssignment() {
        const carsContainer = document.getElementById('cars-assignment');
        if (!carsContainer) return;

        let html = '<div class="cars-assignment-grid">';

        carsData.forEach((car, carIndex) => {
            html += createCarAssignmentCard(car, carIndex);
        });

        html += '</div>';

        carsContainer.innerHTML = html;

        // 座席のドロップイベントを設定
        setupSeatDropEvents();
    }

    /**
     * 車両割り当てカードを作成
     */
    function createCarAssignmentCard(car, carIndex) {
        const carAssignment = assignmentData[carIndex] || {};
        const seatLayout = generateSeatLayout(car, carAssignment, carIndex);

        return `
            <div class="car-assignment-card" data-car-index="${carIndex}">
                <div class="car-header">
                    <h4>${Utils.escapeHTML(car.driverName)}の車</h4>
                    <div class="car-info">
                        <span class="car-model">${Utils.escapeHTML(car.carModel || '')}</span>
                        <span class="car-seats">${car.availableSeats}席</span>
                    </div>
                </div>
                
                <div class="seat-layout">
                    ${seatLayout}
                </div>
                
                <div class="car-summary">
                    ${generateCarSummary(carAssignment, car.availableSeats)}
                </div>
            </div>
        `;
    }

    /**
     * 座席レイアウトを生成
     */
    function generateSeatLayout(car, carAssignment, carIndex) {
        const seats = carAssignment.seats || {};
        const seatConfig = calculateSeatConfiguration(car.totalSeats, car.availableSeats);

        let html = '<div class="car-diagram">';

        // 運転席エリア（運転席は常に運転者で固定）
        html += '<div class="seat-row driver-row">';
        html += `<div class="seat driver-seat occupied">
            <div class="seat-label">運転席</div>
            <div class="seat-occupant">${Utils.escapeHTML(car.driverName)}</div>
        </div>`;

        // 助手席（利用可能な場合）
        if (seatConfig.front > 0) {
            const frontSeat = seats.front || null;
            html += createSeatElement('front', 0, frontSeat, carIndex, '助手席');
        }

        html += '</div>';

        // 中列座席
        if (seatConfig.middle > 0) {
            html += '<div class="seat-row middle-row">';
            for (let i = 0; i < seatConfig.middle; i++) {
                const middleSeat = seats[`middle-${i}`] || null;
                html += createSeatElement('middle', i, middleSeat, carIndex, `中列${i + 1}`);
            }
            html += '</div>';
        }

        // 後列座席
        if (seatConfig.back > 0) {
            html += '<div class="seat-row back-row">';
            for (let i = 0; i < seatConfig.back; i++) {
                const backSeat = seats[`back-${i}`] || null;
                html += createSeatElement('back', i, backSeat, carIndex, `後列${i + 1}`);
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * 座席要素を作成
     */
    function createSeatElement(row, index, occupant, carIndex, label) {
        const seatId = `${row}-${index}`;
        const isOccupied = occupant !== null;
        const occupantInfo = isOccupied ? getMemberById(occupant) : null;

        return `
            <div class="seat droppable-seat ${isOccupied ? 'occupied' : 'empty'}"
                 data-car-index="${carIndex}"
                 data-seat-id="${seatId}"
                 data-seat-row="${row}"
                 data-seat-index="${index}">
                <div class="seat-label">${label}</div>
                ${isOccupied && occupantInfo ? `
                    <div class="seat-occupant" data-member-id="${occupant}">
                        <div class="occupant-name">${Utils.escapeHTML(occupantInfo.name)}</div>
                        ${occupantInfo.role === 'player' ? `
                            <div class="occupant-details">
                                ${calculateGrade(occupantInfo.birthDate) || ''}年生
                                ${occupantInfo.number ? ` #${occupantInfo.number}` : ''}
                            </div>
                        ` : `
                            <div class="occupant-details">${getRoleLabel(occupantInfo.role)}</div>
                        `}
                        <button class="remove-occupant" onclick="FCOjima.Carpool.Assignment.removeSeatOccupant(${carIndex}, '${seatId}')">
                            ×
                        </button>
                    </div>
                ` : `
                    <div class="empty-seat-placeholder">
                        <span>空席</span>
                    </div>
                `}
            </div>
        `;
    }

    /**
     * 座席構成を計算
     */
    function calculateSeatConfiguration(totalSeats, availableSeats) {
        // 運転席は常に運転者なので、利用可能座席から除外して計算
        const driverSeat = 1;
        const passengerSeats = Math.min(availableSeats, totalSeats - driverSeat);

        if (passengerSeats <= 0) {
            return { front: 0, middle: 0, back: 0 };
        } else if (passengerSeats <= 1) {
            return { front: 1, middle: 0, back: 0 };
        } else if (passengerSeats <= 4) {
            return { front: 1, middle: 0, back: Math.min(3, passengerSeats - 1) };
        } else {
            const front = 1;
            const remaining = passengerSeats - 1;
            const middle = Math.min(3, remaining);
            const back = Math.max(0, remaining - 3);
            return { front, middle, back };
        }
    }

    /**
     * 車両サマリーを生成
     */
    function generateCarSummary(carAssignment, totalAvailableSeats) {
        const seats = carAssignment.seats || {};
        const occupiedSeats = Object.values(seats).filter(seat => seat !== null).length;
        const emptySeats = totalAvailableSeats - occupiedSeats;

        return `
            <div class="assignment-summary">
                <span class="occupied-count">配置済み: ${occupiedSeats}名</span>
                <span class="empty-count">空席: ${emptySeats}席</span>
            </div>
        `;
    }

    /**
     * メンバーのドラッグイベントを設定
     */
    function setupMemberDragEvents() {
        const draggableMembers = document.querySelectorAll('.draggable-member');

        draggableMembers.forEach(member => {
            // マウスイベント
            member.addEventListener('dragstart', handleDragStart);
            member.addEventListener('dragend', handleDragEnd);

            // タッチイベント（モバイル対応）
            member.addEventListener('touchstart', handleTouchStart, { passive: false });
            member.addEventListener('touchmove', handleTouchMove, { passive: false });
            member.addEventListener('touchend', handleTouchEnd);

            // 長押しでの詳細編集
            member.addEventListener('mousedown', startLongPress);
            member.addEventListener('mouseup', cancelLongPress);
            member.addEventListener('mouseleave', cancelLongPress);
        });
    }

    /**
     * 座席のドロップイベントを設定
     */
    function setupSeatDropEvents() {
        const droppableSeats = document.querySelectorAll('.droppable-seat');

        droppableSeats.forEach(seat => {
            seat.addEventListener('dragover', handleDragOver);
            seat.addEventListener('drop', handleDrop);
            seat.addEventListener('dragenter', handleDragEnter);
            seat.addEventListener('dragleave', handleDragLeave);

            // 直接クリックでの配置
            seat.addEventListener('click', handleSeatClick);
        });

        // 既に配置済みのメンバーもドラッグ可能にする
        const occupants = document.querySelectorAll('.seat-occupant');
        occupants.forEach(occupant => {
            occupant.draggable = true;
            occupant.addEventListener('dragstart', handleOccupantDragStart);
            occupant.addEventListener('dragend', handleDragEnd);
        });
    }

    /**
     * ドラッグ開始処理
     */
    function handleDragStart(e) {
        draggedElement = e.target;
        draggedMemberId = e.target.dataset.memberId;
        draggedFromSeat = null;
        isDragging = true;

        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedMemberId);
    }

    /**
     * 配置済みメンバーのドラッグ開始処理
     */
    function handleOccupantDragStart(e) {
        const seat = e.target.closest('.droppable-seat');
        draggedElement = e.target;
        draggedMemberId = e.target.dataset.memberId;
        draggedFromSeat = {
            carIndex: parseInt(seat.dataset.carIndex),
            seatId: seat.dataset.seatId
        };
        isDragging = true;

        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedMemberId);
    }

    /**
     * ドラッグ終了処理
     */
    function handleDragEnd(e) {
        e.target.classList.remove('dragging');

        // ドロップゾーンのハイライトを削除
        document.querySelectorAll('.drop-target').forEach(element => {
            element.classList.remove('drop-target');
        });

        draggedElement = null;
        draggedMemberId = null;
        draggedFromSeat = null;
        isDragging = false;
    }

    /**
     * ドラッグオーバー処理
     */
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    /**
     * ドラッグエンター処理
     */
    function handleDragEnter(e) {
        if (draggedMemberId) {
            e.target.classList.add('drop-target');
        }
    }

    /**
     * ドラッグリーブ処理
     */
    function handleDragLeave(e) {
        e.target.classList.remove('drop-target');
    }

    /**
     * ドロップ処理
     */
    function handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('drop-target');

        if (!draggedMemberId) return;

        const seat = e.target.closest('.droppable-seat');
        if (!seat) return;

        const carIndex = parseInt(seat.dataset.carIndex);
        const seatId = seat.dataset.seatId;

        // 座席に配置
        assignMemberToSeat(draggedMemberId, carIndex, seatId, draggedFromSeat);
    }

    /**
     * 座席クリック処理（直接配置）
     */
    function handleSeatClick(e) {
        if (isDragging) return;

        const seat = e.target.closest('.droppable-seat');
        if (!seat) return;

        const carIndex = parseInt(seat.dataset.carIndex);
        const seatId = seat.dataset.seatId;

        // 空席の場合、メンバー選択モーダルを開く
        if (!seat.classList.contains('occupied')) {
            openMemberSelectionModal(carIndex, seatId);
        }
    }

    /**
     * タッチイベント処理（モバイル対応）
     */
    function handleTouchStart(e) {
        const touch = e.touches[0];
        draggedElement = e.target;
        draggedMemberId = e.target.dataset.memberId;

        // 長押し検出用タイマー
        longPressTimer = setTimeout(() => {
            startDragMode(e.target);
        }, LONG_PRESS_DURATION);
    }

    function handleTouchMove(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        if (isDragging) {
            e.preventDefault();

            const touch = e.touches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const seat = elementBelow?.closest('.droppable-seat');

            // ドロップターゲットのハイライト
            document.querySelectorAll('.drop-target').forEach(el => {
                el.classList.remove('drop-target');
            });

            if (seat && !seat.classList.contains('occupied')) {
                seat.classList.add('drop-target');
            }
        }
    }

    function handleTouchEnd(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        if (isDragging) {
            const touch = e.changedTouches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const seat = elementBelow?.closest('.droppable-seat');

            if (seat && !seat.classList.contains('occupied')) {
                const carIndex = parseInt(seat.dataset.carIndex);
                const seatId = seat.dataset.seatId;
                assignMemberToSeat(draggedMemberId, carIndex, seatId);
            }

            endDragMode();
        }
    }

    /**
     * 長押し開始
     */
    function startLongPress(e) {
        longPressTimer = setTimeout(() => {
            openMemberEditModal(e.target.dataset.memberId);
        }, LONG_PRESS_DURATION);
    }

    /**
     * 長押しキャンセル
     */
    function cancelLongPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    /**
     * ドラッグモード開始
     */
    function startDragMode(element) {
        isDragging = true;
        element.classList.add('dragging');
    }

    /**
     * ドラッグモード終了
     */
    function endDragMode() {
        isDragging = false;
        document.querySelectorAll('.dragging').forEach(el => {
            el.classList.remove('dragging');
        });
        document.querySelectorAll('.drop-target').forEach(el => {
            el.classList.remove('drop-target');
        });
    }

    /**
     * メンバーを座席に配置
     */
    async function assignMemberToSeat(memberId, carIndex, seatId, fromSeat = null) {
        try {
            const member = getMemberById(memberId);
            if (!member) return;

            const updatedAssignments = { ...assignmentData };

            // 新しい座席配置
            if (!updatedAssignments[carIndex]) {
                updatedAssignments[carIndex] = { seats: {} };
            }
            if (!updatedAssignments[carIndex].seats) {
                updatedAssignments[carIndex].seats = {};
            }

            // 既存の配置があれば削除
            if (fromSeat) {
                if (updatedAssignments[fromSeat.carIndex]?.seats) {
                    delete updatedAssignments[fromSeat.carIndex].seats[fromSeat.seatId];
                }
            } else {
                // 他の座席から同じメンバーを削除
                Object.keys(updatedAssignments).forEach(carIdx => {
                    if (updatedAssignments[carIdx].seats) {
                        Object.keys(updatedAssignments[carIdx].seats).forEach(sId => {
                            if (updatedAssignments[carIdx].seats[sId] === memberId) {
                                delete updatedAssignments[carIdx].seats[sId];
                            }
                        });
                    }
                });
            }

            // 新しい座席に配置
            updatedAssignments[carIndex].seats[seatId] = memberId;

            await saveCarpoolData({ assignments: updatedAssignments });

            // ログ記録
            const car = carsData[carIndex];
            await Firestore.addLog('carpool',
                `${member.name}を${car.driverName}の車（${seatId}）に配置しました（${currentEvent.title}）`);

            UI.showAlert(`${member.name}を配置しました`, 'success');

        } catch (error) {
            console.error('座席配置エラー:', error);
            UI.showAlert('座席の配置に失敗しました', 'danger');
        }
    }

    /**
     * 座席から人を削除
     */
    Assignment.removeSeatOccupant = async function (carIndex, seatId) {
        try {
            const updatedAssignments = { ...assignmentData };

            if (updatedAssignments[carIndex]?.seats?.[seatId]) {
                const memberId = updatedAssignments[carIndex].seats[seatId];
                const member = getMemberById(memberId);

                delete updatedAssignments[carIndex].seats[seatId];

                await saveCarpoolData({ assignments: updatedAssignments });

                if (member) {
                    UI.showAlert(`${member.name}を座席から外しました`, 'success');
                    await Firestore.addLog('carpool',
                        `${member.name}を座席から外しました（${currentEvent.title}）`);
                }
            }

        } catch (error) {
            console.error('座席削除エラー:', error);
            UI.showAlert('座席からの削除に失敗しました', 'danger');
        }
    };

    /**
     * メンバー選択モーダルを開く
     */
    function openMemberSelectionModal(carIndex, seatId) {
        const attendingMembers = getAttendingMembers();
        const unassignedMembers = getUnassignedMembers(attendingMembers);

        if (unassignedMembers.length === 0) {
            UI.showAlert('配置可能なメンバーがいません', 'info');
            return;
        }

        const modal = document.getElementById('member-selection-modal');
        const content = document.getElementById('member-selection-content');

        if (!modal || !content) return;

        let html = '<div class="member-selection-list">';
        unassignedMembers.forEach(member => {
            const grade = member.role === 'player' ? (calculateGrade(member.birthDate) || '') : '';
            html += `
                <div class="selectable-member" data-member-id="${member.id}"
                     onclick="FCOjima.Carpool.Assignment.selectMemberForSeat('${member.id}', ${carIndex}, '${seatId}')">
                    <div class="member-info">
                        <div class="member-name">${Utils.escapeHTML(member.name)}</div>
                        ${grade ? `<div class="member-grade">${grade}年生</div>` : ''}
                    </div>
                    <div class="member-role">${getRoleLabel(member.role)}</div>
                </div>
            `;
        });
        html += '</div>';

        content.innerHTML = html;
        UI.openModal('member-selection-modal');
    }

    /**
     * モーダルからメンバーを選択して座席に配置
     */
    Assignment.selectMemberForSeat = function (memberId, carIndex, seatId) {
        assignMemberToSeat(memberId, carIndex, seatId);
        UI.closeModal('member-selection-modal');
    };

    /**
     * 自動配置実行
     */
    function performAutoAssignment() {
        const attendingMembers = getAttendingMembers();
        const unassignedMembers = getUnassignedMembers(attendingMembers);

        if (unassignedMembers.length === 0) {
            UI.showAlert('配置対象のメンバーがいません', 'info');
            return;
        }

        if (!confirm(`${unassignedMembers.length}名を自動配置しますか？`)) {
            return;
        }

        const autoAssignment = generateAutoAssignment(unassignedMembers);

        if (autoAssignment.success) {
            saveCarpoolData({ assignments: autoAssignment.assignments })
                .then(() => {
                    UI.showAlert(`${unassignedMembers.length}名を自動配置しました`, 'success');
                    Firestore.addLog('carpool', `${unassignedMembers.length}名を自動配置しました（${currentEvent.title}）`);
                })
                .catch(error => {
                    console.error('自動配置保存エラー:', error);
                    UI.showAlert('自動配置の保存に失敗しました', 'danger');
                });
        } else {
            UI.showAlert('自動配置に失敗しました: ' + autoAssignment.error, 'warning');
        }
    }

    /**
     * 自動配置アルゴリズム
     */
    function generateAutoAssignment(membersToAssign) {
        const updatedAssignments = { ...assignmentData };
        const membersToPlace = [...membersToAssign];

        // 優先順位: 監督・コーチ → 高学年 → 低学年
        membersToPlace.sort((a, b) => {
            if (a.role === 'coach' && b.role !== 'coach') return -1;
            if (b.role === 'coach' && a.role !== 'coach') return 1;

            const gradeA = parseInt(calculateGrade(a.birthDate)) || 0;
            const gradeB = parseInt(calculateGrade(b.birthDate)) || 0;
            return gradeB - gradeA;
        });

        // 各車両の空席を取得
        const availableSeats = [];
        carsData.forEach((car, carIndex) => {
            const carAssignment = updatedAssignments[carIndex] || { seats: {} };
            const occupiedSeats = Object.keys(carAssignment.seats || {}).length;
            const emptySeats = car.availableSeats - occupiedSeats;

            for (let i = 0; i < emptySeats; i++) {
                availableSeats.push({ carIndex, car });
            }
        });

        if (availableSeats.length < membersToPlace.length) {
            return {
                success: false,
                error: `座席が${membersToPlace.length - availableSeats.length}席不足しています`
            };
        }

        // メンバーを座席に配置
        membersToPlace.forEach((member, index) => {
            if (index < availableSeats.length) {
                const { carIndex } = availableSeats[index];

                if (!updatedAssignments[carIndex]) {
                    updatedAssignments[carIndex] = { seats: {} };
                }

                // 空きシートを見つけて配置
                const seatId = findNextAvailableSeat(carIndex, updatedAssignments);
                if (seatId) {
                    updatedAssignments[carIndex].seats[seatId] = member.id;
                }
            }
        });

        return {
            success: true,
            assignments: updatedAssignments
        };
    }

    /**
     * 次の利用可能座席を見つける
     */
    function findNextAvailableSeat(carIndex, assignments) {
        const car = carsData[carIndex];
        const carAssignment = assignments[carIndex] || { seats: {} };
        const occupiedSeats = carAssignment.seats || {};

        const seatConfig = calculateSeatConfiguration(car.totalSeats, car.availableSeats);

        // 助手席 → 後列 → 中列の順で配置
        if (seatConfig.front > 0 && !occupiedSeats['front-0']) {
            return 'front-0';
        }

        for (let i = 0; i < seatConfig.back; i++) {
            const seatId = `back-${i}`;
            if (!occupiedSeats[seatId]) {
                return seatId;
            }
        }

        for (let i = 0; i < seatConfig.middle; i++) {
            const seatId = `middle-${i}`;
            if (!occupiedSeats[seatId]) {
                return seatId;
            }
        }

        return null;
    }

    /**
     * 全配置リセット
     */
    function resetAllAssignments() {
        if (!confirm('すべての座席配置をリセットしますか？')) {
            return;
        }

        saveCarpoolData({ assignments: {} })
            .then(() => {
                UI.showAlert('すべての配置をリセットしました', 'success');
                Firestore.addLog('carpool', `すべての座席配置をリセットしました（${currentEvent.title}）`);
            })
            .catch(error => {
                console.error('リセットエラー:', error);
                UI.showAlert('リセットに失敗しました', 'danger');
            });
    }

    /**
     * 配置最適化
     */
    function optimizeAssignment() {
        UI.showAlert('配置最適化機能は開発中です', 'info');
    }

    /**
     * 配置情報をLINE共有
     */
    function shareAssignmentInfo() {
        const eventDate = Utils.formatDate(new Date(currentEvent.date));
        let message = `【座席配置】\n\n`;
        message += `${currentEvent.title}\n`;
        message += `📅 ${eventDate} ${currentEvent.time || ''}\n\n`;

        carsData.forEach((car, carIndex) => {
            const carAssignment = assignmentData[carIndex] || { seats: {} };
            const occupiedSeats = carAssignment.seats || {};

            message += `🚗 ${car.driverName}の車\n`;

            Object.entries(occupiedSeats).forEach(([seatId, memberId]) => {
                const member = getMemberById(memberId);
                if (member) {
                    const seatLabel = getSeatLabel(seatId);
                    message += `　${seatLabel}: ${member.name}\n`;
                }
            });

            message += '\n';
        });

        const totalAssigned = Object.values(assignmentData).reduce((total, car) => {
            return total + Object.keys(car.seats || {}).length;
        }, 0);

        message += `📊 配置済み: ${totalAssigned}名\n`;
        message += `\n更新日時: ${new Date().toLocaleString()}`;

        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
        window.open(lineUrl, '_blank');

        UI.showAlert('座席配置をLINEで共有しました', 'success');
    }

    /**
     * 座席ラベルを取得
     */
    function getSeatLabel(seatId) {
        const [row, index] = seatId.split('-');
        const labels = {
            'front': '助手席',
            'middle': `中列${parseInt(index) + 1}`,
            'back': `後列${parseInt(index) + 1}`
        };
        return labels[row] || seatId;
    }

    /**
     * 表示切り替え
     */
    function toggleAssignmentView() {
        const container = document.getElementById('assignment-container');
        if (container.classList.contains('compact-view')) {
            container.classList.remove('compact-view');
            document.getElementById('toggle-view').textContent = 'コンパクト表示';
        } else {
            container.classList.add('compact-view');
            document.getElementById('toggle-view').textContent = '詳細表示';
        }
    }

    /**
     * 統計情報を更新
     */
    function updateStats() {
        const statsCard = document.getElementById('assignment-stats');
        if (!statsCard) return;

        const attendingMembers = getAttendingMembers();
        const assignedCount = Object.values(assignmentData).reduce((total, car) => {
            return total + Object.keys(car.seats || {}).length;
        }, 0);
        const unassignedCount = attendingMembers.length - assignedCount;
        const totalSeats = carsData.reduce((sum, car) => sum + car.availableSeats, 0);
        const emptySeats = totalSeats - assignedCount;

        statsCard.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${assignedCount}</div>
                    <div class="stat-label">配置済み</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${unassignedCount}</div>
                    <div class="stat-label">未配置</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${emptySeats}</div>
                    <div class="stat-label">空席</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${carsData.length}</div>
                    <div class="stat-label">車両数</div>
                </div>
            </div>
        `;
    }

    /**
     * 進捗を更新
     */
    function updateProgress() {
        const progressCard = document.getElementById('assignment-progress');
        if (!progressCard) return;

        const attendingMembers = getAttendingMembers();
        const assignedCount = Object.values(assignmentData).reduce((total, car) => {
            return total + Object.keys(car.seats || {}).length;
        }, 0);

        const progress = attendingMembers.length > 0 ?
            Math.round((assignedCount / attendingMembers.length) * 100) : 0;

        progressCard.innerHTML = `
            <h4>配置進捗</h4>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="progress-text">${progress}% 完了 (${assignedCount}/${attendingMembers.length}名)</div>
            
            ${progress === 100 ? `
                <div class="completion-message">
                    ✅ すべての配置が完了しました！
                </div>
            ` : ''}
        `;
    }

    /**
     * ヘルパー関数
     */
    function getAttendingMembers() {
        return membersData.filter(member => {
            const attendance = attendanceData[member.id];
            return attendance && attendance.status === 'attending';
        });
    }

    function getUnassignedMembers(attendingMembers) {
        const assignedMemberIds = new Set();
        Object.values(assignmentData).forEach(car => {
            Object.values(car.seats || {}).forEach(memberId => {
                if (memberId) assignedMemberIds.add(memberId);
            });
        });

        return attendingMembers.filter(member => !assignedMemberIds.has(member.id));
    }

    function getMemberById(memberId) {
        return membersData.find(member => member.id === memberId);
    }

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

    function getEventTypeLabel(type) {
        const labels = { match: '試合', practice: '練習', other: 'その他' };
        return labels[type] || type;
    }

    function getRoleLabel(role) {
        const labels = { coach: '監督・コーチ', player: '選手', parent: '保護者' };
        return labels[role] || role;
    }

    /**
     * 表示の更新（外部から呼び出し可能）
     */
    Assignment.updateDisplay = updateDisplay;

    /**
     * クリーンアップ
     */
    Assignment.destroy = function () {
        if (membersUnsubscribe) {
            membersUnsubscribe();
            membersUnsubscribe = null;
        }

        if (carpoolUnsubscribe) {
            carpoolUnsubscribe();
            carpoolUnsubscribe = null;
        }

        // タイマーのクリーンアップ
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    // ページから離れる時のクリーンアップ
    window.addEventListener('beforeunload', Assignment.destroy);

    /**
     * データ保存（内部関数）
     */
    async function saveCarpoolData(data) {
        if (!currentEvent || !currentEvent.id) return;

        // 既存のデータをマージ
        const updateData = {
            ...carpoolData,
            ...data
        };

        await Firestore.saveCarpool(currentEvent.id, updateData);
    }

})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function () {
    if (typeof FCOjima !== 'undefined' && FCOjima.Carpool && FCOjima.Carpool.Assignment) {
        FCOjima.Carpool.Assignment.init();
    }
});