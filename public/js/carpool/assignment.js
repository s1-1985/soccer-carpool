/**
 * FC蟆ｾ蟲ｶ繧ｸ繝･繝九い - 蠎ｧ蟶ｭ蜑ｲ繧雁ｽ薙※讖溯・・・irebase迚茨ｼ・ * 繝峨Λ繝・げ&繝峨Ο繝・・縲∝ｺｧ蟶ｭ繝ｬ繧､繧｢繧ｦ繝医∬・蜍暮・鄂ｮ讖溯・
 */

// 蜷榊燕遨ｺ髢薙・遒ｺ菫・window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Assignment = FCOjima.Carpool.Assignment || {};

// 蠎ｧ蟶ｭ蜑ｲ繧雁ｽ薙※繝｢繧ｸ繝･繝ｼ繝ｫ
(function() {
    const Assignment = FCOjima.Carpool.Assignment;
    const Firestore = FCOjima.Firestore;
    const Auth = FCOjima.Auth;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;
    
    // 繝・・繧ｿ
    let currentEvent = null;
    let attendanceData = {};
    let carsData = [];
    let assignmentData = {};
    let carpoolData = null;
    let membersData = [];
    let carpoolUnsubscribe = null;
    let membersUnsubscribe = null;
    
    // 繝峨Λ繝・げ&繝峨Ο繝・・髢｢騾｣
    let draggedElement = null;
    let draggedMemberId = null;
    let draggedFromSeat = null;
    let longPressTimer = null;
    let isDragging = false;
    
    // 險ｭ螳・    const LONG_PRESS_DURATION = 500; // 繝溘Μ遘・    
    /**
     * 蠎ｧ蟶ｭ蜑ｲ繧雁ｽ薙※讖溯・縺ｮ蛻晄悄蛹・     */
    Assignment.init = async function() {
        try {
            // 隱崎ｨｼ繝√ぉ繝・け
            if (!Auth.isLoggedIn()) {
                console.warn('譛ｪ繝ｭ繧ｰ繧､繝ｳ繝ｦ繝ｼ繧ｶ繝ｼ縺ｧ縺・);
                UI.showAlert('繝ｭ繧ｰ繧､繝ｳ縺悟ｿ・ｦ√〒縺・, 'warning');
                window.location.href = '../auth/login.html';
                return;
            }
            
            // 繧ｻ繝・す繝ｧ繝ｳ縺九ｉ繧､繝吶Φ繝・D繧貞叙蠕・            const selectedEventId = sessionStorage.getItem('fc-ojima-selected-event');
            if (!selectedEventId) {
                UI.showAlert('繧､繝吶Φ繝医′驕ｸ謚槭＆繧後※縺・∪縺帙ｓ', 'warning');
                window.location.href = 'index.html';
                return;
            }
            
            // 繧､繝吶Φ繝域ュ蝣ｱ繧貞叙蠕・            currentEvent = await Firestore.getDocument('events', selectedEventId);
            if (!currentEvent) {
                UI.showAlert('謖・ｮ壹＆繧後◆繧､繝吶Φ繝医′隕九▽縺九ｊ縺ｾ縺帙ｓ', 'danger');
                window.location.href = 'index.html';
                return;
            }
            
            // 繝・・繧ｿ繧偵Μ繧｢繝ｫ繧ｿ繧､繝逶｣隕悶〒隱ｭ縺ｿ霎ｼ縺ｿ
            setupRealtimeListeners();
            
            // UI隕∫ｴ縺ｮ蛻晄悄蛹・            setupEventListeners();
            updateEventInfo();
            updateDisplay();
            
            // 繝｢繝ｼ繝繝ｫ縺ｮ蛻晄悄蛹・            if (UI && UI.initModals) {
                UI.initModals();
            }
            
            console.log('蠎ｧ蟶ｭ蜑ｲ繧雁ｽ薙※讖溯・繧貞・譛溷喧縺励∪縺励◆・・irebase迚茨ｼ・);
            
        } catch (error) {
            console.error('蠎ｧ蟶ｭ蜑ｲ繧雁ｽ薙※蛻晄悄蛹悶お繝ｩ繝ｼ:', error);
            UI.showAlert('蠎ｧ蟶ｭ蜑ｲ繧雁ｽ薙※縺ｮ蛻晄悄蛹悶↓螟ｱ謨励＠縺ｾ縺励◆', 'danger');
        }
    };
    
    /**
     * 繝ｪ繧｢繝ｫ繧ｿ繧､繝繝ｪ繧ｹ繝翫・縺ｮ險ｭ螳・     */
    function setupRealtimeListeners() {
        // 繝｡繝ｳ繝舌・繝・・繧ｿ縺ｮ逶｣隕・        membersUnsubscribe = Firestore.watchMembers((updatedMembers) => {
            membersData = updatedMembers.filter(member => member.status === 'active');
            updateDisplay();
        });
        
        // 驟崎ｻ翫ョ繝ｼ繧ｿ縺ｮ繝ｪ繧｢繝ｫ繧ｿ繧､繝逶｣隕・        carpoolUnsubscribe = Firestore.watchCarpoolData(currentEvent.id, (updatedData) => {
            carpoolData = updatedData;
            attendanceData = carpoolData?.attendance || {};
            carsData = carpoolData?.cars || [];
            assignmentData = carpoolData?.assignments || {};
            updateDisplay();
        });
    }
    
    /**
     * 繧､繝吶Φ繝医Μ繧ｹ繝翫・縺ｮ險ｭ螳・     */
    function setupEventListeners() {
        // 閾ｪ蜍暮・鄂ｮ繝懊ち繝ｳ
        const autoAssignBtn = document.getElementById('auto-assign');
        if (autoAssignBtn) {
            autoAssignBtn.addEventListener('click', performAutoAssignment);
        }
        
        // 驟咲ｽｮ繝ｪ繧ｻ繝・ヨ繝懊ち繝ｳ
        const resetAssignmentBtn = document.getElementById('reset-assignment');
        if (resetAssignmentBtn) {
            resetAssignmentBtn.addEventListener('click', resetAllAssignments);
        }
        
        // 驟咲ｽｮ譛驕ｩ蛹悶・繧ｿ繝ｳ
        const optimizeBtn = document.getElementById('optimize-assignment');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', optimizeAssignment);
        }
        
        // LINE蜈ｱ譛峨・繧ｿ繝ｳ
        const shareAssignmentBtn = document.getElementById('share-assignment');
        if (shareAssignmentBtn) {
            shareAssignmentBtn.addEventListener('click', shareAssignmentInfo);
        }
        
        // 谺｡縺ｮ繧ｹ繝・ャ繝励∈
        const nextStepBtn = document.getElementById('next-step');
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => {
                window.location.href = 'notifications.html';
            });
        }
        
        // 蜑阪・繧ｹ繝・ャ繝励↓謌ｻ繧・        const prevStepBtn = document.getElementById('prev-step');
        if (prevStepBtn) {
            prevStepBtn.addEventListener('click', () => {
                window.location.href = 'cars.html';
            });
        }
        
        // 讎りｦ√↓謌ｻ繧・        const backToOverviewBtn = document.getElementById('back-to-overview');
        if (backToOverviewBtn) {
            backToOverviewBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        
        // 陦ｨ遉ｺ蛻・ｊ譖ｿ縺・        const toggleViewBtn = document.getElementById('toggle-view');
        if (toggleViewBtn) {
            toggleViewBtn.addEventListener('click', toggleAssignmentView);
        }
    }
    
    /**
     * 繧､繝吶Φ繝域ュ蝣ｱ繧呈峩譁ｰ
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
     * 陦ｨ遉ｺ繧呈峩譁ｰ
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
     * 霆贋ｸ｡縺ｪ縺励Γ繝・そ繝ｼ繧ｸ繧定｡ｨ遉ｺ
     */
    function showNoCarsMessage() {
        const assignmentContainer = document.getElementById('assignment-container');
        if (!assignmentContainer) return;
        
        assignmentContainer.innerHTML = `
            <div class="no-cars-message">
                <h4>霆贋ｸ｡縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</h4>
                <p>蠎ｧ蟶ｭ蜑ｲ繧雁ｽ薙※繧定｡後≧縺ｫ縺ｯ縲√∪縺夊ｻ贋ｸ｡謠蝉ｾ帙・逋ｻ骭ｲ縺悟ｿ・ｦ√〒縺吶・/p>
                <button onclick="window.location.href='cars.html'" class="btn btn-primary">
                    霆贋ｸ｡謠蝉ｾ帙・繝ｼ繧ｸ縺ｸ
                </button>
            </div>
        `;
    }
    
    /**
     * 繝｡繝ｳ繝舌・荳隕ｧ繧呈峩譁ｰ
     */
    function updateMembersList() {
        const membersList = document.getElementById('unassigned-members');
        if (!membersList) return;
        
        const attendingMembers = getAttendingMembers();
        const unassignedMembers = getUnassignedMembers(attendingMembers);
        
        if (unassignedMembers.length === 0) {
            membersList.innerHTML = `
                <div class="no-unassigned">
                    <p>笨・蜈ｨ蜩｡驟咲ｽｮ貂医∩</p>
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
        
        // 繝峨Λ繝・げ繧､繝吶Φ繝医ｒ險ｭ螳・        setupMemberDragEvents();
    }
    
    /**
     * 繝峨Λ繝・げ蜿ｯ閭ｽ縺ｪ繝｡繝ｳ繝舌・隕∫ｴ繧剃ｽ懈・
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
                    ${grade ? `<div class="member-grade">${grade}蟷ｴ逕・/div>` : ''}
                    ${member.number ? `<div class="member-number">#${member.number}</div>` : ''}
                </div>
                <div class="member-role">${getRoleLabel(member.role)}</div>
            </div>
        `;
    }
    
    /**
     * 霆贋ｸ｡蛻･蠎ｧ蟶ｭ蜑ｲ繧雁ｽ薙※繧呈峩譁ｰ
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
        
        // 蠎ｧ蟶ｭ縺ｮ繝峨Ο繝・・繧､繝吶Φ繝医ｒ險ｭ螳・        setupSeatDropEvents();
    }
    
    /**
     * 霆贋ｸ｡蜑ｲ繧雁ｽ薙※繧ｫ繝ｼ繝峨ｒ菴懈・
     */
    function createCarAssignmentCard(car, carIndex) {
        const carAssignment = assignmentData[carIndex] || {};
        const seatLayout = generateSeatLayout(car, carAssignment, carIndex);
        
        return `
            <div class="car-assignment-card" data-car-index="${carIndex}">
                <div class="car-header">
                    <h4>${Utils.escapeHTML(car.driverName)}縺ｮ霆・/h4>
                    <div class="car-info">
                        <span class="car-model">${Utils.escapeHTML(car.carModel || '')}</span>
                        <span class="car-seats">${car.availableSeats}蟶ｭ</span>
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
     * 蠎ｧ蟶ｭ繝ｬ繧､繧｢繧ｦ繝医ｒ逕滓・
     */
    function generateSeatLayout(car, carAssignment, carIndex) {
        const seats = carAssignment.seats || {};
        const seatConfig = calculateSeatConfiguration(car.totalSeats, car.availableSeats);
        
        let html = '<div class="car-diagram">';
        
        // 驕玖ｻ｢蟶ｭ繧ｨ繝ｪ繧｢・磯°霆｢蟶ｭ縺ｯ蟶ｸ縺ｫ驕玖ｻ｢閠・〒蝗ｺ螳夲ｼ・        html += '<div class="seat-row driver-row">';
        html += `<div class="seat driver-seat occupied">
            <div class="seat-label">驕玖ｻ｢蟶ｭ</div>
            <div class="seat-occupant">${Utils.escapeHTML(car.driverName)}</div>
        </div>`;
        
        // 蜉ｩ謇句ｸｭ・亥茜逕ｨ蜿ｯ閭ｽ縺ｪ蝣ｴ蜷茨ｼ・        if (seatConfig.front > 0) {
            const frontSeat = seats.front || null;
            html += createSeatElement('front', 0, frontSeat, carIndex, '蜉ｩ謇句ｸｭ');
        }
        
        html += '</div>';
        
        // 荳ｭ蛻怜ｺｧ蟶ｭ
        if (seatConfig.middle > 0) {
            html += '<div class="seat-row middle-row">';
            for (let i = 0; i < seatConfig.middle; i++) {
                const middleSeat = seats[`middle-${i}`] || null;
                html += createSeatElement('middle', i, middleSeat, carIndex, `荳ｭ蛻・{i + 1}`);
            }
            html += '</div>';
        }
        
        // 蠕悟・蠎ｧ蟶ｭ
        if (seatConfig.back > 0) {
            html += '<div class="seat-row back-row">';
            for (let i = 0; i < seatConfig.back; i++) {
                const backSeat = seats[`back-${i}`] || null;
                html += createSeatElement('back', i, backSeat, carIndex, `蠕悟・${i + 1}`);
            }
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }
    
    /**
     * 蠎ｧ蟶ｭ隕∫ｴ繧剃ｽ懈・
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
                                ${calculateGrade(occupantInfo.birthDate) || ''}蟷ｴ逕・                                ${occupantInfo.number ? ` #${occupantInfo.number}` : ''}
                            </div>
                        ` : `
                            <div class="occupant-details">${getRoleLabel(occupantInfo.role)}</div>
                        `}
                        <button class="remove-occupant" onclick="FCOjima.Carpool.Assignment.removeSeatOccupant(${carIndex}, '${seatId}')">
                            ﾃ・                        </button>
                    </div>
                ` : `
                    <div class="empty-seat-placeholder">
                        <span>遨ｺ蟶ｭ</span>
                    </div>
                `}
            </div>
        `;
    }
    
    /**
     * 蠎ｧ蟶ｭ讒区・繧定ｨ育ｮ・     */
    function calculateSeatConfiguration(totalSeats, availableSeats) {
        // 驕玖ｻ｢蟶ｭ縺ｯ蟶ｸ縺ｫ驕玖ｻ｢閠・↑縺ｮ縺ｧ縲∝茜逕ｨ蜿ｯ閭ｽ蠎ｧ蟶ｭ縺九ｉ髯､螟悶＠縺ｦ險育ｮ・        const driverSeat = 1;
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
     * 霆贋ｸ｡繧ｵ繝槭Μ繝ｼ繧堤函謌・     */
    function generateCarSummary(carAssignment, totalAvailableSeats) {
        const seats = carAssignment.seats || {};
        const occupiedSeats = Object.values(seats).filter(seat => seat !== null).length;
        const emptySeats = totalAvailableSeats - occupiedSeats;
        
        return `
            <div class="assignment-summary">
                <span class="occupied-count">驟咲ｽｮ貂医∩: ${occupiedSeats}蜷・/span>
                <span class="empty-count">遨ｺ蟶ｭ: ${emptySeats}蟶ｭ</span>
            </div>
        `;
    }
    
    /**
     * 繝｡繝ｳ繝舌・縺ｮ繝峨Λ繝・げ繧､繝吶Φ繝医ｒ險ｭ螳・     */
    function setupMemberDragEvents() {
        const draggableMembers = document.querySelectorAll('.draggable-member');
        
        draggableMembers.forEach(member => {
            // 繝槭え繧ｹ繧､繝吶Φ繝・            member.addEventListener('dragstart', handleDragStart);
            member.addEventListener('dragend', handleDragEnd);
            
            // 繧ｿ繝・メ繧､繝吶Φ繝茨ｼ医Δ繝舌う繝ｫ蟇ｾ蠢懶ｼ・            member.addEventListener('touchstart', handleTouchStart, { passive: false });
            member.addEventListener('touchmove', handleTouchMove, { passive: false });
            member.addEventListener('touchend', handleTouchEnd);
            
            // 髟ｷ謚ｼ縺励〒縺ｮ隧ｳ邏ｰ邱ｨ髮・            member.addEventListener('mousedown', startLongPress);
            member.addEventListener('mouseup', cancelLongPress);
            member.addEventListener('mouseleave', cancelLongPress);
        });
    }
    
    /**
     * 蠎ｧ蟶ｭ縺ｮ繝峨Ο繝・・繧､繝吶Φ繝医ｒ險ｭ螳・     */
    function setupSeatDropEvents() {
        const droppableSeats = document.querySelectorAll('.droppable-seat');
        
        droppableSeats.forEach(seat => {
            seat.addEventListener('dragover', handleDragOver);
            seat.addEventListener('drop', handleDrop);
            seat.addEventListener('dragenter', handleDragEnter);
            seat.addEventListener('dragleave', handleDragLeave);
            
            // 逶ｴ謗･繧ｯ繝ｪ繝・け縺ｧ縺ｮ驟咲ｽｮ
            seat.addEventListener('click', handleSeatClick);
        });
        
        // 譌｢縺ｫ驟咲ｽｮ貂医∩縺ｮ繝｡繝ｳ繝舌・繧ゅラ繝ｩ繝・げ蜿ｯ閭ｽ縺ｫ縺吶ｋ
        const occupants = document.querySelectorAll('.seat-occupant');
        occupants.forEach(occupant => {
            occupant.draggable = true;
            occupant.addEventListener('dragstart', handleOccupantDragStart);
            occupant.addEventListener('dragend', handleDragEnd);
        });
    }
    
    /**
     * 繝峨Λ繝・げ髢句ｧ句・逅・     */
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
     * 驟咲ｽｮ貂医∩繝｡繝ｳ繝舌・縺ｮ繝峨Λ繝・げ髢句ｧ句・逅・     */
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
     * 繝峨Λ繝・げ邨ゆｺ・・逅・     */
    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        
        // 繝峨Ο繝・・繧ｾ繝ｼ繝ｳ縺ｮ繝上う繝ｩ繧､繝医ｒ蜑企勁
        document.querySelectorAll('.drop-target').forEach(element => {
            element.classList.remove('drop-target');
        });
        
        draggedElement = null;
        draggedMemberId = null;
        draggedFromSeat = null;
        isDragging = false;
    }
    
    /**
     * 繝峨Λ繝・げ繧ｪ繝ｼ繝舌・蜃ｦ逅・     */
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    
    /**
     * 繝峨Λ繝・げ繧ｨ繝ｳ繧ｿ繝ｼ蜃ｦ逅・     */
    function handleDragEnter(e) {
        if (draggedMemberId) {
            e.target.classList.add('drop-target');
        }
    }
    
    /**
     * 繝峨Λ繝・げ繝ｪ繝ｼ繝門・逅・     */
    function handleDragLeave(e) {
        e.target.classList.remove('drop-target');
    }
    
    /**
     * 繝峨Ο繝・・蜃ｦ逅・     */
    function handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('drop-target');
        
        if (!draggedMemberId) return;
        
        const seat = e.target.closest('.droppable-seat');
        if (!seat) return;
        
        const carIndex = parseInt(seat.dataset.carIndex);
        const seatId = seat.dataset.seatId;
        
        // 蠎ｧ蟶ｭ縺ｫ驟咲ｽｮ
        assignMemberToSeat(draggedMemberId, carIndex, seatId, draggedFromSeat);
    }
    
    /**
     * 蠎ｧ蟶ｭ繧ｯ繝ｪ繝・け蜃ｦ逅・ｼ育峩謗･驟咲ｽｮ・・     */
    function handleSeatClick(e) {
        if (isDragging) return;
        
        const seat = e.target.closest('.droppable-seat');
        if (!seat) return;
        
        const carIndex = parseInt(seat.dataset.carIndex);
        const seatId = seat.dataset.seatId;
        
        // 遨ｺ蟶ｭ縺ｮ蝣ｴ蜷医√Γ繝ｳ繝舌・驕ｸ謚槭Δ繝ｼ繝繝ｫ繧帝幕縺・        if (!seat.classList.contains('occupied')) {
            openMemberSelectionModal(carIndex, seatId);
        }
    }
    
    /**
     * 繧ｿ繝・メ繧､繝吶Φ繝亥・逅・ｼ医Δ繝舌う繝ｫ蟇ｾ蠢懶ｼ・     */
    function handleTouchStart(e) {
        const touch = e.touches[0];
        draggedElement = e.target;
        draggedMemberId = e.target.dataset.memberId;
        
        // 髟ｷ謚ｼ縺玲､懷・逕ｨ繧ｿ繧､繝槭・
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
            
            // 繝峨Ο繝・・繧ｿ繝ｼ繧ｲ繝・ヨ縺ｮ繝上う繝ｩ繧､繝・            document.querySelectorAll('.drop-target').forEach(el => {
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
     * 髟ｷ謚ｼ縺鈴幕蟋・     */
    function startLongPress(e) {
        longPressTimer = setTimeout(() => {
            openMemberEditModal(e.target.dataset.memberId);
        }, LONG_PRESS_DURATION);
    }
    
    /**
     * 髟ｷ謚ｼ縺励く繝｣繝ｳ繧ｻ繝ｫ
     */
    function cancelLongPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }
    
    /**
     * 繝峨Λ繝・げ繝｢繝ｼ繝蛾幕蟋・     */
    function startDragMode(element) {
        isDragging = true;
        element.classList.add('dragging');
    }
    
    /**
     * 繝峨Λ繝・げ繝｢繝ｼ繝臥ｵゆｺ・     */
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
     * 繝｡繝ｳ繝舌・繧貞ｺｧ蟶ｭ縺ｫ驟咲ｽｮ
     */
    async function assignMemberToSeat(memberId, carIndex, seatId, fromSeat = null) {
        try {
            const member = getMemberById(memberId);
            if (!member) return;
            
            const updatedAssignments = { ...assignmentData };
            
            // 譁ｰ縺励＞蠎ｧ蟶ｭ驟咲ｽｮ
            if (!updatedAssignments[carIndex]) {
                updatedAssignments[carIndex] = { seats: {} };
            }
            if (!updatedAssignments[carIndex].seats) {
                updatedAssignments[carIndex].seats = {};
            }
            
            // 譌｢蟄倥・驟咲ｽｮ縺後≠繧後・蜑企勁
            if (fromSeat) {
                if (updatedAssignments[fromSeat.carIndex]?.seats) {
                    delete updatedAssignments[fromSeat.carIndex].seats[fromSeat.seatId];
                }
            } else {
                // 莉悶・蠎ｧ蟶ｭ縺九ｉ蜷後§繝｡繝ｳ繝舌・繧貞炎髯､
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
            
            // 譁ｰ縺励＞蠎ｧ蟶ｭ縺ｫ驟咲ｽｮ
            updatedAssignments[carIndex].seats[seatId] = memberId;
            
            await saveCarpoolData({ assignments: updatedAssignments });
            
            // 繝ｭ繧ｰ險倬鹸
            const car = carsData[carIndex];
            await Firestore.addLog('carpool', 
                `${member.name}繧・{car.driverName}縺ｮ霆奇ｼ・{seatId}・峨↓驟咲ｽｮ縺励∪縺励◆・・{currentEvent.title}・荏);
                
            UI.showAlert(`${member.name}繧帝・鄂ｮ縺励∪縺励◆`, 'success');
            
        } catch (error) {
            console.error('蠎ｧ蟶ｭ驟咲ｽｮ繧ｨ繝ｩ繝ｼ:', error);
            UI.showAlert('蠎ｧ蟶ｭ縺ｮ驟咲ｽｮ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'danger');
        }
    }
    
    /**
     * 蠎ｧ蟶ｭ縺九ｉ莠ｺ繧貞炎髯､
     */
    Assignment.removeSeatOccupant = async function(carIndex, seatId) {
        try {
            const updatedAssignments = { ...assignmentData };
            
            if (updatedAssignments[carIndex]?.seats?.[seatId]) {
                const memberId = updatedAssignments[carIndex].seats[seatId];
                const member = getMemberById(memberId);
                
                delete updatedAssignments[carIndex].seats[seatId];
                
                await saveCarpoolData({ assignments: updatedAssignments });
                
                if (member) {
                    UI.showAlert(`${member.name}繧貞ｺｧ蟶ｭ縺九ｉ螟悶＠縺ｾ縺励◆`, 'success');
                    await Firestore.addLog('carpool', 
                        `${member.name}繧貞ｺｧ蟶ｭ縺九ｉ螟悶＠縺ｾ縺励◆・・{currentEvent.title}・荏);
                }
            }
            
        } catch (error) {
            console.error('蠎ｧ蟶ｭ蜑企勁繧ｨ繝ｩ繝ｼ:', error);
            UI.showAlert('蠎ｧ蟶ｭ縺九ｉ縺ｮ蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'danger');
        }
    };
    
    /**
     * 繝｡繝ｳ繝舌・驕ｸ謚槭Δ繝ｼ繝繝ｫ繧帝幕縺・     */
    function openMemberSelectionModal(carIndex, seatId) {
        const attendingMembers = getAttendingMembers();
        const unassignedMembers = getUnassignedMembers(attendingMembers);
        
        if (unassignedMembers.length === 0) {
            UI.showAlert('驟咲ｽｮ蜿ｯ閭ｽ縺ｪ繝｡繝ｳ繝舌・縺後＞縺ｾ縺帙ｓ', 'info');
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
                        ${grade ? `<div class="member-grade">${grade}蟷ｴ逕・/div>` : ''}
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
     * 繝｢繝ｼ繝繝ｫ縺九ｉ繝｡繝ｳ繝舌・繧帝∈謚槭＠縺ｦ蠎ｧ蟶ｭ縺ｫ驟咲ｽｮ
     */
    Assignment.selectMemberForSeat = function(memberId, carIndex, seatId) {
        assignMemberToSeat(memberId, carIndex, seatId);
        UI.closeModal('member-selection-modal');
    };
    
    /**
     * 閾ｪ蜍暮・鄂ｮ螳溯｡・     */
    function performAutoAssignment() {
        const attendingMembers = getAttendingMembers();
        const unassignedMembers = getUnassignedMembers(attendingMembers);
        
        if (unassignedMembers.length === 0) {
            UI.showAlert('驟咲ｽｮ蟇ｾ雎｡縺ｮ繝｡繝ｳ繝舌・縺後＞縺ｾ縺帙ｓ', 'info');
            return;
        }
        
        if (!confirm(`${unassignedMembers.length}蜷阪ｒ閾ｪ蜍暮・鄂ｮ縺励∪縺吶°・歔)) {
            return;
        }
        
        const autoAssignment = generateAutoAssignment(unassignedMembers);
        
        if (autoAssignment.success) {
            saveCarpoolData({ assignments: autoAssignment.assignments })
                .then(() => {
                    UI.showAlert(`${unassignedMembers.length}蜷阪ｒ閾ｪ蜍暮・鄂ｮ縺励∪縺励◆`, 'success');
                    Firestore.addLog('carpool', `${unassignedMembers.length}蜷阪ｒ閾ｪ蜍暮・鄂ｮ縺励∪縺励◆・・{currentEvent.title}・荏);
                })
                .catch(error => {
                    console.error('閾ｪ蜍暮・鄂ｮ菫晏ｭ倥お繝ｩ繝ｼ:', error);
                    UI.showAlert('閾ｪ蜍暮・鄂ｮ縺ｮ菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'danger');
                });
        } else {
            UI.showAlert('閾ｪ蜍暮・鄂ｮ縺ｫ螟ｱ謨励＠縺ｾ縺励◆: ' + autoAssignment.error, 'warning');
        }
    }
    
    /**
     * 閾ｪ蜍暮・鄂ｮ繧｢繝ｫ繧ｴ繝ｪ繧ｺ繝
     */
    function generateAutoAssignment(membersToAssign) {
        const updatedAssignments = { ...assignmentData };
        const membersToPlace = [...membersToAssign];
        
        // 蜆ｪ蜈磯・ｽ・ 逶｣逹｣繝ｻ繧ｳ繝ｼ繝・竊・鬮伜ｭｦ蟷ｴ 竊・菴主ｭｦ蟷ｴ
        membersToPlace.sort((a, b) => {
            if (a.role === 'coach' && b.role !== 'coach') return -1;
            if (b.role === 'coach' && a.role !== 'coach') return 1;
            
            const gradeA = parseInt(calculateGrade(a.birthDate)) || 0;
            const gradeB = parseInt(calculateGrade(b.birthDate)) || 0;
            return gradeB - gradeA;
        });
        
        // 蜷・ｻ贋ｸ｡縺ｮ遨ｺ蟶ｭ繧貞叙蠕・        const availableSeats = [];
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
                error: `蠎ｧ蟶ｭ縺・{membersToPlace.length - availableSeats.length}蟶ｭ荳崎ｶｳ縺励※縺・∪縺兪
            };
        }
        
        // 繝｡繝ｳ繝舌・繧貞ｺｧ蟶ｭ縺ｫ驟咲ｽｮ
        membersToPlace.forEach((member, index) => {
            if (index < availableSeats.length) {
                const { carIndex } = availableSeats[index];
                
                if (!updatedAssignments[carIndex]) {
                    updatedAssignments[carIndex] = { seats: {} };
                }
                
                // 遨ｺ縺阪す繝ｼ繝医ｒ隕九▽縺代※驟咲ｽｮ
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
     * 谺｡縺ｮ蛻ｩ逕ｨ蜿ｯ閭ｽ蠎ｧ蟶ｭ繧定ｦ九▽縺代ｋ
     */
    function findNextAvailableSeat(carIndex, assignments) {
        const car = carsData[carIndex];
        const carAssignment = assignments[carIndex] || { seats: {} };
        const occupiedSeats = carAssignment.seats || {};
        
        const seatConfig = calculateSeatConfiguration(car.totalSeats, car.availableSeats);
        
        // 蜉ｩ謇句ｸｭ 竊・蠕悟・ 竊・荳ｭ蛻励・鬆・〒驟咲ｽｮ
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
     * 蜈ｨ驟咲ｽｮ繝ｪ繧ｻ繝・ヨ
     */
    function resetAllAssignments() {
        if (!confirm('縺吶∋縺ｦ縺ｮ蠎ｧ蟶ｭ驟咲ｽｮ繧偵Μ繧ｻ繝・ヨ縺励∪縺吶°・・)) {
            return;
        }
        
        saveCarpoolData({ assignments: {} })
            .then(() => {
                UI.showAlert('縺吶∋縺ｦ縺ｮ驟咲ｽｮ繧偵Μ繧ｻ繝・ヨ縺励∪縺励◆', 'success');
                Firestore.addLog('carpool', `縺吶∋縺ｦ縺ｮ蠎ｧ蟶ｭ驟咲ｽｮ繧偵Μ繧ｻ繝・ヨ縺励∪縺励◆・・{currentEvent.title}・荏);
            })
            .catch(error => {
                console.error('繝ｪ繧ｻ繝・ヨ繧ｨ繝ｩ繝ｼ:', error);
                UI.showAlert('繝ｪ繧ｻ繝・ヨ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'danger');
            });
    }
    
    /**
     * 驟咲ｽｮ譛驕ｩ蛹・     */
    function optimizeAssignment() {
        UI.showAlert('驟咲ｽｮ譛驕ｩ蛹匁ｩ溯・縺ｯ髢狗匱荳ｭ縺ｧ縺・, 'info');
    }
    
    /**
     * 驟咲ｽｮ諠・ｱ繧鱈INE蜈ｱ譛・     */
    function shareAssignmentInfo() {
        const eventDate = Utils.formatDate(new Date(currentEvent.date));
        let message = `縲仙ｺｧ蟶ｭ驟咲ｽｮ縲曾n\n`;
        message += `${currentEvent.title}\n`;
        message += `套 ${eventDate} ${currentEvent.time || ''}\n\n`;
        
        carsData.forEach((car, carIndex) => {
            const carAssignment = assignmentData[carIndex] || { seats: {} };
            const occupiedSeats = carAssignment.seats || {};
            
            message += `囓 ${car.driverName}縺ｮ霆浬n`;
            
            Object.entries(occupiedSeats).forEach(([seatId, memberId]) => {
                const member = getMemberById(memberId);
                if (member) {
                    const seatLabel = getSeatLabel(seatId);
                    message += `縲${seatLabel}: ${member.name}\n`;
                }
            });
            
            message += '\n';
        });
        
        const totalAssigned = Object.values(assignmentData).reduce((total, car) => {
            return total + Object.keys(car.seats || {}).length;
        }, 0);
        
        message += `投 驟咲ｽｮ貂医∩: ${totalAssigned}蜷構n`;
        message += `\n譖ｴ譁ｰ譌･譎・ ${new Date().toLocaleString()}`;
        
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
        window.open(lineUrl, '_blank');
        
        UI.showAlert('蠎ｧ蟶ｭ驟咲ｽｮ繧鱈INE縺ｧ蜈ｱ譛峨＠縺ｾ縺励◆', 'success');
    }
    
    /**
     * 蠎ｧ蟶ｭ繝ｩ繝吶Ν繧貞叙蠕・     */
    function getSeatLabel(seatId) {
        const [row, index] = seatId.split('-');
        const labels = {
            'front': '蜉ｩ謇句ｸｭ',
            'middle': `荳ｭ蛻・{parseInt(index) + 1}`,
            'back': `蠕悟・${parseInt(index) + 1}`
        };
        return labels[row] || seatId;
    }
    
    /**
     * 陦ｨ遉ｺ蛻・ｊ譖ｿ縺・     */
    function toggleAssignmentView() {
        const container = document.getElementById('assignment-container');
        if (container.classList.contains('compact-view')) {
            container.classList.remove('compact-view');
            document.getElementById('toggle-view').textContent = '繧ｳ繝ｳ繝代け繝郁｡ｨ遉ｺ';
        } else {
            container.classList.add('compact-view');
            document.getElementById('toggle-view').textContent = '隧ｳ邏ｰ陦ｨ遉ｺ';
        }
    }
    
    /**
     * 邨ｱ險域ュ蝣ｱ繧呈峩譁ｰ
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
                    <div class="stat-label">驟咲ｽｮ貂医∩</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${unassignedCount}</div>
                    <div class="stat-label">譛ｪ驟咲ｽｮ</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${emptySeats}</div>
                    <div class="stat-label">遨ｺ蟶ｭ</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${carsData.length}</div>
                    <div class="stat-label">霆贋ｸ｡謨ｰ</div>
                </div>
            </div>
        `;
    }
    
    /**
     * 騾ｲ謐励ｒ譖ｴ譁ｰ
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
            <h4>驟咲ｽｮ騾ｲ謐・/h4>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="progress-text">${progress}% 螳御ｺ・(${assignedCount}/${attendingMembers.length}蜷・</div>
            
            ${progress === 100 ? `
                <div class="completion-message">
                    笨・縺吶∋縺ｦ縺ｮ驟咲ｽｮ縺悟ｮ御ｺ・＠縺ｾ縺励◆・・                </div>
            ` : ''}
        `;
    }
    
    /**
     * 繝倥Ν繝代・髢｢謨ｰ
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
        
        if (gradeOffset === -3) return "蟷ｴ蟆・;
        if (gradeOffset === -2) return "蟷ｴ荳ｭ"; 
        if (gradeOffset === -1) return "蟷ｴ髟ｷ";
        if (gradeOffset >= 0 && gradeOffset <= 5) return String(gradeOffset + 1);
        
        return null;
    }
    
    function getEventTypeLabel(type) {
        const labels = { match: '隧ｦ蜷・, practice: '邱ｴ鄙・, other: '縺昴・莉・ };
        return labels[type] || type;
    }
    
    function getRoleLabel(role) {
        const labels = { coach: '逶｣逹｣繝ｻ繧ｳ繝ｼ繝・, player: '驕ｸ謇・, parent: '菫晁ｭｷ閠・ };
        return labels[role] || role;
    }
    
    /**
     * 驟崎ｻ翫ョ繝ｼ繧ｿ繧剃ｿ晏ｭ・     */
    async function saveCarpoolData(dataToUpdate) {
        const updatedCarpoolData = {
            ...carpoolData,
            ...dataToUpdate,
            lastUpdated: new Date().toISOString()
        };
        
        await Firestore.setDocument('carpool', currentEvent.id, updatedCarpoolData);
    }
    
    /**
     * 陦ｨ遉ｺ縺ｮ譖ｴ譁ｰ・亥､夜Κ縺九ｉ蜻ｼ縺ｳ蜃ｺ縺怜庄閭ｽ・・     */
    Assignment.updateDisplay = updateDisplay;
    
    /**
     * 繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・
     */
    Assignment.destroy = function() {
        if (membersUnsubscribe) {
            membersUnsubscribe();
            membersUnsubscribe = null;
        }
        
        if (carpoolUnsubscribe) {
            carpoolUnsubscribe();
            carpoolUnsubscribe = null;
        }
        
        // 繧ｿ繧､繝槭・縺ｮ繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };
    
    // 繝壹・繧ｸ縺九ｉ髮｢繧後ｋ譎ゅ・繧ｯ繝ｪ繝ｼ繝ｳ繧｢繝・・
    window.addEventListener('beforeunload', Assignment.destroy);
    
})();

// 繝壹・繧ｸ隱ｭ縺ｿ霎ｼ縺ｿ譎ゅ↓蛻晄悄蛹・document.addEventListener('DOMContentLoaded', function() {
    if (typeof FCOjima !== 'undefined' && FCOjima.Carpool && FCOjima.Carpool.Assignment) {
        FCOjima.Carpool.Assignment.init();
    }
});

    Assignment.updateDisplay = updateDisplay;

})(window.FCOjima = window.FCOjima || {});

    Assignment.updateDisplay = updateDisplay;

})(window.FCOjima = window.FCOjima || {});
