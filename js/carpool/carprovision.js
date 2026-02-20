/**
<<<<<<< HEAD
 * FC尾島ジュニア - 車両提供機能（Firebase版）
 * 保護者の車両提供管理、座席数管理、配車計画機能
=======
 * FC尾島ジュニア - 車提供タブの機能（続き）
 * 車両提供管理に関する機能を提供
>>>>>>> 3f29fdc53b2c8f871d428ea6715327a2f2c4429e
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.CarProvision = FCOjima.Carpool.CarProvision || {};

<<<<<<< HEAD
// 車両提供モジュール
(function() {
    const CarProvision = FCOjima.Carpool.CarProvision;
    const Firestore = FCOjima.Firestore;
    const Auth = FCOjima.Auth;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;
    
    // データ
    let currentEvent = null;
    let attendanceData = {};
    let carsData = [];
    let carpoolData = null;
    let membersData = [];
    let carpoolUnsubscribe = null;
    let membersUnsubscribe = null;
    let currentEditingCar = null;
    
    /**
     * 車両提供機能の初期化
     */
    CarProvision.init = async function() {
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
            
            console.log('車両提供機能を初期化しました（Firebase版）');
            
        } catch (error) {
            console.error('車両提供初期化エラー:', error);
            UI.showAlert('車両提供の初期化に失敗しました', 'danger');
=======
// 車提供モジュール
(function() {
    // 名前空間のショートカット
    const CarProvision = FCOjima.Carpool.CarProvision;
    const UI = FCOjima.UI;

    /**
     * 車提供機能の初期化
     */
    CarProvision.init = function() {
        console.log('車提供機能を初期化しています...');
        FCOjima.Carpool.loadMembers();
        FCOjima.Carpool.loadData();
        this.updateEventInfo();
        this.updateCarRegistrations();
        console.log('車提供機能の初期化が完了しました');
    };

    /**
     * イベント情報を表示
     */
    CarProvision.updateEventInfo = function() {
        const event = FCOjima.Storage.getSelectedEvent();
        const header = document.getElementById('event-header');
        if (header && event) {
            header.textContent = FCOjima.Utils.formatDateForDisplay(event.date) + ' ' + event.title;
        }
        const carEventInfo = document.getElementById('carEventInfo');
        if (carEventInfo && event) {
            carEventInfo.className = 'event-summary ' + (event.type || 'other');
            carEventInfo.innerHTML = '<strong>' + UI.escapeHTML(event.title) + '</strong>' +
                ' (' + FCOjima.Utils.formatDateForDisplay(event.date) + ')';
        }
    };

    /**
     * 車両を登録
     */
    CarProvision.registerCar = function() {
        const parentName = (document.getElementById('parentName').value || '').trim();
        const canDrive   = document.getElementById('canDrive').value;
        const frontSeat  = parseInt(document.getElementById('frontSeat').value)  || 0;
        const middleSeat = parseInt(document.getElementById('middleSeat').value) || 0;
        const backSeat   = parseInt(document.getElementById('backSeat').value)   || 0;
        const notes      = (document.getElementById('carNotes').value || '').trim();

        if (!parentName) {
            UI.showAlert('運転者名を入力してください');
            return;
        }

        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        carRegistrations.push({ parent: parentName, canDrive, frontSeat, middleSeat, backSeat, notes });
        FCOjima.Carpool.appData.carRegistrations = carRegistrations;
        FCOjima.Carpool.saveData();

        // フォームをクリア
        document.getElementById('parentName').value  = '';
        document.getElementById('canDrive').value    = 'both';
        document.getElementById('frontSeat').value   = '1';
        document.getElementById('middleSeat').value  = '3';
        document.getElementById('backSeat').value    = '0';
        document.getElementById('carNotes').value    = '';
        const carDetails = document.getElementById('carDetails');
        if (carDetails) carDetails.style.display = 'block';

        this.updateCarRegistrations();
        UI.showAlert(parentName + 'さんの車両登録を追加しました');
        console.log('車両登録を追加しました: ' + parentName);
    };

    /**
     * 登録済み車両一覧を更新
     */
    CarProvision.updateCarRegistrations = function() {
        const tbody = document.querySelector('#registeredCars tbody');
        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];

        if (tbody) {
            if (carRegistrations.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-table-message">登録された車両はありません</td></tr>';
            } else {
                tbody.innerHTML = '';
                const provideLabels = { both: '行き帰り可', to: '行きのみ', from: '帰りのみ', no: '不可' };

                carRegistrations.forEach(function(car, index) {
                    const total = (parseInt(car.frontSeat) || 0) +
                                  (parseInt(car.middleSeat) || 0) +
                                  (parseInt(car.backSeat) || 0);
                    const row = document.createElement('tr');
                    row.innerHTML =
                        '<td>' + UI.escapeHTML(car.parent) + '</td>' +
                        '<td>' + (provideLabels[car.canDrive] || car.canDrive) + '</td>' +
                        '<td>' + (car.frontSeat  || 0) + '</td>' +
                        '<td>' + (car.middleSeat || 0) + '</td>' +
                        '<td>' + (car.backSeat   || 0) + '</td>' +
                        '<td>' + total + '</td>' +
                        '<td>' + UI.escapeHTML(car.notes || '') + '</td>' +
                        '<td><button type="button" class="delete-button" onclick="FCOjima.Carpool.CarProvision.deleteCarRegistration(' + index + ')">削除</button></td>';
                    tbody.appendChild(row);
                });
            }
        }

        // 統計更新
        const statsDiv = document.getElementById('car-stats');
        if (statsDiv) {
            const available = carRegistrations.filter(function(c) { return c.canDrive !== 'no'; });
            const totalSeats = available.reduce(function(sum, car) {
                return sum + (parseInt(car.frontSeat) || 0) +
                             (parseInt(car.middleSeat) || 0) +
                             (parseInt(car.backSeat) || 0);
            }, 0);
            statsDiv.innerHTML =
                '<div class="stat-item"><span class="stat-label">車両数</span><span class="stat-value">' + carRegistrations.length + '台</span></div>' +
                '<div class="stat-item"><span class="stat-label">提供可能</span><span class="stat-value">' + available.length + '台</span></div>' +
                '<div class="stat-item"><span class="stat-label">総座席数</span><span class="stat-value">' + totalSeats + '席</span></div>';
        }
    };

    /**
     * 運転者選択モーダルを開く
     */
    CarProvision.openDriverSelectModal = function() {
        const list = document.getElementById('driver-select-list');
        if (!list) return;

        const members = FCOjima.Carpool.members;
        const candidates = members.filter(function(m) {
            return m.role === 'father' || m.role === 'mother' ||
                   m.role === 'coach'  || m.role === 'assist';
        });

        if (candidates.length === 0) {
            list.innerHTML = UI.createAlert('info', '選択できるメンバーがいません。先にHUBでメンバーを登録してください。');
            UI.openModal('driver-select-modal');
            return;
        }

        list.innerHTML = '';
        candidates.forEach(function(member) {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.textContent = member.name;
            item.addEventListener('click', function() {
                document.getElementById('parentName').value = member.name;
                UI.closeModal('driver-select-modal');
            });
            list.appendChild(item);
        });

        UI.openModal('driver-select-modal');
        console.log('運転者選択モーダルを開きました');
    };

    /**
     * 車両情報を削除
     * @param {number} index - 車両インデックス
     */
    CarProvision.deleteCarRegistration = function(index) {
        console.log(`車両情報を削除します: インデックス=${index}`);
        
        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        const car = carRegistrations[index];
        
        if (!car) {
            UI.showAlert('指定された車両情報が見つかりません');
            return;
        }
        
        if (UI.showConfirm(`${car.parent}さんの車両登録を削除してもよろしいですか？`)) {
            // 車両登録から削除
            carRegistrations.splice(index, 1);
            
            // データを保存
            FCOjima.Carpool.appData.carRegistrations = carRegistrations;
            FCOjima.Carpool.saveData();
            
            // リストを更新
            this.updateCarRegistrations();
            
            UI.showAlert(`${car.parent}さんの車両登録を削除しました`);
            console.log(`車両情報を削除しました: ${car.parent}`);
>>>>>>> 3f29fdc53b2c8f871d428ea6715327a2f2c4429e
        }
    };
    
    /**
<<<<<<< HEAD
     * リアルタイムリスナーの設定
     */
    function setupRealtimeListeners() {
        // メンバーデータの監視
        membersUnsubscribe = Firestore.watchMembers((updatedMembers) => {
            membersData = updatedMembers.filter(member => member.status === 'active');
            updateDisplay();
        });
        
        // 配車データ（出欠・車両情報含む）のリアルタイム監視
        carpoolUnsubscribe = Firestore.watchCarpoolData(currentEvent.id, (updatedData) => {
            carpoolData = updatedData;
            attendanceData = carpoolData?.attendance || {};
            carsData = carpoolData?.cars || [];
            updateDisplay();
        });
    }
    
    /**
     * イベントリスナーの設定
     */
    function setupEventListeners() {
        // 車両追加ボタン
        const addCarBtn = document.getElementById('add-car');
        if (addCarBtn) {
            addCarBtn.addEventListener('click', () => openCarModal());
        }
        
        // 車両フォーム送信
        const carForm = document.getElementById('car-form');
        if (carForm) {
            carForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveCar();
            });
        }
        
        // 自動配車提案ボタン
        const autoAssignBtn = document.getElementById('auto-assign');
        if (autoAssignBtn) {
            autoAssignBtn.addEventListener('click', generateAutoAssignment);
        }
        
        // LINE共有ボタン
        const shareCarsBtn = document.getElementById('share-cars');
        if (shareCarsBtn) {
            shareCarsBtn.addEventListener('click', shareCarsInfo);
        }
        
        // 次のステップへ
        const nextStepBtn = document.getElementById('next-step');
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => {
                window.location.href = 'assignments.html';
            });
        }
        
        // 前のステップに戻る
        const prevStepBtn = document.getElementById('prev-step');
        if (prevStepBtn) {
            prevStepBtn.addEventListener('click', () => {
                window.location.href = 'attendance.html';
            });
        }
        
        // 概要に戻る
        const backToOverviewBtn = document.getElementById('back-to-overview');
        if (backToOverviewBtn) {
            backToOverviewBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        
        // 車両募集メッセージ送信
        const requestCarsBtn = document.getElementById('request-cars');
        if (requestCarsBtn) {
            requestCarsBtn.addEventListener('click', sendCarRequest);
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
            </div>
        `;
    }
    
    /**
     * 表示を更新
     */
    function updateDisplay() {
        updateAttendanceSummary();
        updateCarsList();
        updateStats();
        updateRecommendations();
    }
    
    /**
     * 出欠状況サマリーを更新
     */
    function updateAttendanceSummary() {
        const summaryCard = document.getElementById('attendance-summary');
        if (!summaryCard) return;
        
        const attendingMembers = getAttendingMembers();
        const absentCount = Object.values(attendanceData).filter(a => a.status === 'absent').length;
        const pendingCount = Object.values(attendanceData).filter(a => a.status === 'pending').length;
        
        summaryCard.innerHTML = `
            <h4>出欠状況サマリー</h4>
            
            <div class="attendance-summary-stats">
                <div class="summary-stat">
                    <div class="stat-number">${attendingMembers.length}</div>
                    <div class="stat-label">参加予定</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-number">${absentCount}</div>
                    <div class="stat-label">不参加</div>
                </div>
                <div class="summary-stat">
                    <div class="stat-number">${pendingCount}</div>
                    <div class="stat-label">未回答</div>
                </div>
            </div>
            
            ${attendingMembers.length > 0 ? `
                <div class="attending-members">
                    <h5>参加予定者 (${attendingMembers.length}名)</h5>
                    <div class="members-list">
                        ${attendingMembers.map(member => `
                            <span class="member-tag">${member.name}</span>
                        `).join('')}
                    </div>
                </div>
            ` : `
                <div class="alert alert-warning">
                    参加予定者がまだいません。出欠確認を先に行ってください。
                </div>
            `}
        `;
    }
    
    /**
     * 車両一覧を更新
     */
    function updateCarsList() {
        const carsList = document.getElementById('cars-list');
        if (!carsList) return;
        
        if (carsData.length === 0) {
            carsList.innerHTML = `
                <div class="no-cars">
                    <p>車両提供者がまだいません</p>
                    <p class="text-muted">車両を追加するか、保護者に車両提供を依頼してください。</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="cars-grid">';
        
        carsData.forEach((car, index) => {
            html += createCarCard(car, index);
        });
        
        html += '</div>';
        
        carsList.innerHTML = html;
    }
    
    /**
     * 車両カードを作成
     */
    function createCarCard(car, index) {
        const driver = membersData.find(m => m.id === car.driverId);
        const driverName = driver?.name || car.driverName || '不明';
        
        // 座席構成を計算
        const seatConfig = calculateSeatConfiguration(car.totalSeats);
        
        return `
            <div class="car-card" data-car-index="${index}">
                <div class="car-header">
                    <h4 class="car-title">${driverName}の車</h4>
                    <div class="car-actions">
                        <button onclick="FCOjima.Carpool.CarProvision.editCar(${index})" 
                                class="btn btn-primary btn-sm">編集</button>
                        <button onclick="FCOjima.Carpool.CarProvision.deleteCar(${index})" 
                                class="btn btn-danger btn-sm">削除</button>
                    </div>
                </div>
                
                <div class="car-info">
                    <div class="car-detail">
                        <i class="icon-car"></i>
                        <span>車種: ${Utils.escapeHTML(car.carModel || '未設定')}</span>
                    </div>
                    
                    <div class="car-detail">
                        <i class="icon-users"></i>
                        <span>総座席数: ${car.totalSeats}席</span>
                    </div>
                    
                    <div class="car-detail">
                        <i class="icon-check"></i>
                        <span>利用可能: ${car.availableSeats}席</span>
                    </div>
                    
                    ${car.phone ? `
                        <div class="car-detail">
                            <i class="icon-phone"></i>
                            <span>${Utils.escapeHTML(car.phone)}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="seat-layout">
                    <h5>座席レイアウト</h5>
                    <div class="seat-diagram">
                        ${generateSeatDiagram(seatConfig)}
                    </div>
                </div>
                
                <div class="car-availability">
                    <div class="availability-item ${car.canPickup ? 'available' : 'unavailable'}">
                        ${car.canPickup ? '✅' : '❌'} 行き送迎
                    </div>
                    <div class="availability-item ${car.canDropoff ? 'available' : 'unavailable'}">
                        ${car.canDropoff ? '✅' : '❌'} 帰り送迎
                    </div>
                </div>
                
                ${car.notes ? `
                    <div class="car-notes">
                        <strong>備考:</strong> ${Utils.escapeHTML(car.notes)}
                    </div>
                ` : ''}
                
                <div class="car-footer">
                    <small class="text-muted">
                        登録日: ${car.createdAt ? Utils.formatDateTime(new Date(car.createdAt)) : '-'}
                    </small>
                </div>
            </div>
        `;
    }
    
    /**
     * 座席構成を計算
     */
    function calculateSeatConfiguration(totalSeats) {
        // 一般的な車の座席構成パターン
        if (totalSeats <= 2) {
            return { front: 1, middle: 0, back: Math.max(0, totalSeats - 1) };
        } else if (totalSeats <= 5) {
            return { front: 1, middle: 0, back: Math.max(0, totalSeats - 1) };
        } else if (totalSeats <= 7) {
            return { front: 1, middle: Math.min(3, totalSeats - 2), back: Math.max(0, totalSeats - 4) };
        } else {
            return { front: 1, middle: 3, back: Math.max(0, totalSeats - 4) };
        }
    }
    
    /**
     * 座席図を生成
     */
    function generateSeatDiagram(seatConfig) {
        let html = '<div class="car-diagram">';
        
        // 運転席（常に1席）
        html += '<div class="seat-row front-row">';
        html += '<div class="seat driver-seat">運転席</div>';
        if (seatConfig.front > 1) {
            html += '<div class="seat passenger-seat">助手席</div>';
        }
        html += '</div>';
        
        // 中列
        if (seatConfig.middle > 0) {
            html += '<div class="seat-row middle-row">';
            for (let i = 0; i < seatConfig.middle; i++) {
                html += '<div class="seat middle-seat">中列</div>';
            }
            html += '</div>';
        }
        
        // 後列
        if (seatConfig.back > 0) {
            html += '<div class="seat-row back-row">';
            for (let i = 0; i < seatConfig.back; i++) {
                html += '<div class="seat back-seat">後列</div>';
            }
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }
    
    /**
     * 車両モーダルを開く
     */
    function openCarModal(car = null, carIndex = null) {
        currentEditingCar = car ? { ...car, index: carIndex } : null;
        
        const form = document.getElementById('car-form');
        const modal = document.getElementById('car-modal');
        
        if (!form || !modal) return;
        
        // フォームのリセット
        form.reset();
        
        // 保護者（運転可能）のリストを作成
        updateDriverOptions();
        
        if (car) {
            // 編集モード
            form.dataset.carIndex = carIndex;
            document.getElementById('car-driver').value = car.driverId || '';
            document.getElementById('car-driver-name').value = car.driverName || '';
            document.getElementById('car-model').value = car.carModel || '';
            document.getElementById('car-total-seats').value = car.totalSeats || '';
            document.getElementById('car-available-seats').value = car.availableSeats || '';
            document.getElementById('car-phone').value = car.phone || '';
            document.getElementById('car-can-pickup').checked = car.canPickup || false;
            document.getElementById('car-can-dropoff').checked = car.canDropoff || false;
            document.getElementById('car-notes').value = car.notes || '';
            
            document.getElementById('modal-title').textContent = '車両情報編集';
        } else {
            // 新規作成モード
            delete form.dataset.carIndex;
            document.getElementById('car-can-pickup').checked = true;
            document.getElementById('car-can-dropoff').checked = true;
            document.getElementById('modal-title').textContent = '車両追加';
        }
        
        UI.openModal('car-modal');
    }
    
    /**
     * 運転者選択肢を更新
     */
    function updateDriverOptions() {
        const driverSelect = document.getElementById('car-driver');
        if (!driverSelect) return;
        
        // 現在の選択値を保持
        const currentSelection = driverSelect.value;
        
        // 選択肢をクリア
        driverSelect.innerHTML = '<option value="">運転者を選択（または手動入力）</option>';
        
        // 保護者・監督・コーチのメンバーを追加
        const potentialDrivers = membersData.filter(member => 
            ['parent', 'coach'].includes(member.role) && member.status === 'active'
        );
        
        potentialDrivers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            driverSelect.appendChild(option);
        });
        
        // 選択値を復元
        if (currentSelection) {
            driverSelect.value = currentSelection;
        }
        
        // 運転者選択時の処理
        driverSelect.addEventListener('change', function() {
            const selectedMember = membersData.find(m => m.id === this.value);
            const driverNameInput = document.getElementById('car-driver-name');
            const phoneInput = document.getElementById('car-phone');
            
            if (selectedMember) {
                driverNameInput.value = selectedMember.name;
                driverNameInput.readOnly = true;
                if (selectedMember.phone) {
                    phoneInput.value = selectedMember.phone;
                }
            } else {
                driverNameInput.value = '';
                driverNameInput.readOnly = false;
                phoneInput.value = '';
            }
        });
    }
    
    /**
     * 車両を保存
     */
    async function saveCar() {
        try {
            const form = document.getElementById('car-form');
            const formData = new FormData(form);
            const carIndex = form.dataset.carIndex;
            
            // フォームデータを取得
            const carData = {
                driverId: formData.get('driverId') || null,
                driverName: formData.get('driverName').trim(),
                carModel: formData.get('carModel').trim(),
                totalSeats: parseInt(formData.get('totalSeats')) || 0,
                availableSeats: parseInt(formData.get('availableSeats')) || 0,
                phone: formData.get('phone').trim(),
                canPickup: formData.has('canPickup'),
                canDropoff: formData.has('canDropoff'),
                notes: formData.get('notes').trim()
            };
            
            // バリデーション
            if (!carData.driverName) {
                UI.showAlert('運転者名を入力してください', 'warning');
                return;
            }
            
            if (carData.totalSeats < 1 || carData.totalSeats > 10) {
                UI.showAlert('総座席数は1〜10席の範囲で入力してください', 'warning');
                return;
            }
            
            if (carData.availableSeats < 0 || carData.availableSeats > carData.totalSeats) {
                UI.showAlert('利用可能座席数が正しくありません', 'warning');
                return;
            }
            
            if (!carData.canPickup && !carData.canDropoff) {
                UI.showAlert('行きまたは帰りのどちらかは送迎可能にしてください', 'warning');
                return;
            }
            
            // 車両データを更新
            const updatedCars = [...carsData];
            
            if (carIndex !== undefined) {
                // 既存車両の更新
                updatedCars[parseInt(carIndex)] = {
                    ...updatedCars[parseInt(carIndex)],
                    ...carData,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // 新規車両の追加
                carData.id = Utils.generateId();
                carData.createdAt = new Date().toISOString();
                updatedCars.push(carData);
            }
            
            await saveCarpoolData({ cars: updatedCars });
            
            // モーダルを閉じる
            UI.closeModal('car-modal');
            
            const actionText = carIndex !== undefined ? '更新' : '追加';
            UI.showAlert(`車両を${actionText}しました`, 'success');
            await Firestore.addLog('carpool', `車両「${carData.driverName}」を${actionText}しました（${currentEvent.title}）`);
            
        } catch (error) {
            console.error('車両保存エラー:', error);
            UI.showAlert('車両の保存に失敗しました', 'danger');
        }
    }
    
    /**
     * 車両を編集
     */
    CarProvision.editCar = function(carIndex) {
        const car = carsData[carIndex];
        if (car) {
            openCarModal(car, carIndex);
        }
    };
    
    /**
     * 車両を削除
     */
    CarProvision.deleteCar = function(carIndex) {
        const car = carsData[carIndex];
        if (!car) return;
        
        if (!confirm(`${car.driverName}の車両を削除しますか？`)) {
            return;
        }
        
        const updatedCars = carsData.filter((_, index) => index !== carIndex);
        
        saveCarpoolData({ cars: updatedCars })
            .then(() => {
                UI.showAlert('車両を削除しました', 'success');
                Firestore.addLog('carpool', `車両「${car.driverName}」を削除しました（${currentEvent.title}）`);
            })
            .catch(error => {
                console.error('車両削除エラー:', error);
                UI.showAlert('車両の削除に失敗しました', 'danger');
            });
    };
    
    /**
     * 統計情報を更新
     */
    function updateStats() {
        const statsCard = document.getElementById('cars-stats');
        if (!statsCard) return;
        
        const attendingCount = getAttendingMembers().length;
        const totalCars = carsData.length;
        const totalSeats = carsData.reduce((sum, car) => sum + car.availableSeats, 0);
        const pickupCars = carsData.filter(car => car.canPickup).length;
        const dropoffCars = carsData.filter(car => car.canDropoff).length;
        
        const seatShortage = Math.max(0, attendingCount - totalSeats);
        const seatSurplus = Math.max(0, totalSeats - attendingCount);
        
        statsCard.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${totalCars}</div>
                    <div class="stat-label">提供車両</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${totalSeats}</div>
                    <div class="stat-label">総座席数</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${attendingCount}</div>
                    <div class="stat-label">参加者数</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${pickupCars}</div>
                    <div class="stat-label">行き送迎</div>
                </div>
                
                <div class="stat-item">
                    <div class="stat-number">${dropoffCars}</div>
                    <div class="stat-label">帰り送迎</div>
                </div>
                
                <div class="stat-item ${seatShortage > 0 ? 'stat-warning' : 'stat-success'}">
                    <div class="stat-number">${seatShortage > 0 ? `-${seatShortage}` : seatSurplus}</div>
                    <div class="stat-label">${seatShortage > 0 ? '座席不足' : '座席余裕'}</div>
                </div>
            </div>
            
            ${seatShortage > 0 ? `
                <div class="alert alert-warning">
                    <strong>座席不足:</strong> ${seatShortage}席足りません。車両提供者を追加募集してください。
                </div>
            ` : totalSeats > 0 ? `
                <div class="alert alert-success">
                    <strong>座席確保完了:</strong> 十分な座席が確保されています。
                </div>
            ` : `
                <div class="alert alert-info">
                    車両提供者を募集してください。
                </div>
            `}
        `;
    }
    
    /**
     * 推奨事項を更新
     */
    function updateRecommendations() {
        const recommendationsCard = document.getElementById('recommendations');
        if (!recommendationsCard) return;
        
        const attendingCount = getAttendingMembers().length;
        const totalSeats = carsData.reduce((sum, car) => sum + car.availableSeats, 0);
        const recommendations = generateRecommendations(attendingCount, totalSeats);
        
        if (recommendations.length === 0) return;
        
        let html = '<h4>推奨事項</h4><ul class="recommendations-list">';
        
        recommendations.forEach(rec => {
            html += `<li class="recommendation-item ${rec.type}">${rec.message}</li>`;
        });
        
        html += '</ul>';
        
        recommendationsCard.innerHTML = html;
    }
    
    /**
     * 推奨事項を生成
     */
    function generateRecommendations(attendingCount, totalSeats) {
        const recommendations = [];
        
        if (attendingCount === 0) {
            recommendations.push({
                type: 'warning',
                message: '参加予定者がいません。まず出欠確認を完了してください。'
            });
            return recommendations;
        }
        
        if (totalSeats === 0) {
            recommendations.push({
                type: 'danger',
                message: '車両提供者がいません。保護者に車両提供を依頼してください。'
            });
        } else if (totalSeats < attendingCount) {
            const shortage = attendingCount - totalSeats;
            recommendations.push({
                type: 'warning',
                message: `${shortage}席不足です。追加で車両提供者を募集してください。`
            });
        } else if (totalSeats > attendingCount + 3) {
            recommendations.push({
                type: 'info',
                message: '座席に余裕があります。車両数を調整することを検討してください。'
            });
        }
        
        // 行き帰りの送迎バランスチェック
        const pickupCars = carsData.filter(car => car.canPickup).length;
        const dropoffCars = carsData.filter(car => car.canDropoff).length;
        
        if (pickupCars === 0) {
            recommendations.push({
                type: 'warning',
                message: '行きの送迎車両がありません。'
            });
        }
        
        if (dropoffCars === 0) {
            recommendations.push({
                type: 'warning',
                message: '帰りの送迎車両がありません。'
            });
        }
        
        return recommendations;
    }
    
    /**
     * 車両募集メッセージを送信
     */
    function sendCarRequest() {
        const attendingCount = getAttendingMembers().length;
        const totalSeats = carsData.reduce((sum, car) => sum + car.availableSeats, 0);
        const shortage = Math.max(0, attendingCount - totalSeats);
        
        const eventDate = Utils.formatDate(new Date(currentEvent.date));
        let message = `【車両提供のお願い】\n\n`;
        message += `${currentEvent.title}\n`;
        message += `📅 ${eventDate} ${currentEvent.time || ''}\n`;
        message += `📍 ${currentEvent.venue || ''}\n\n`;
        
        message += `👥 参加予定者: ${attendingCount}名\n`;
        message += `🚗 現在の車両: ${carsData.length}台（${totalSeats}席）\n`;
        
        if (shortage > 0) {
            message += `⚠️ ${shortage}席不足しています\n\n`;
            message += `車両提供にご協力いただける方は、配車管理ページから登録をお願いします。\n`;
        } else {
            message += `✅ 十分な座席が確保されています\n\n`;
            message += `現在の車両提供状況をお知らせします。\n`;
        }
        
        message += `\n配車管理ページ: ${window.location.href}`;
        
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
        window.open(lineUrl, '_blank');
        
        UI.showAlert('車両提供の依頼を送信しました', 'success');
        Firestore.addLog('carpool', `車両提供の依頼を送信しました（${currentEvent.title}）`);
    }
    
    /**
     * 車両情報を共有
     */
    function shareCarsInfo() {
        if (carsData.length === 0) {
            UI.showAlert('共有する車両情報がありません', 'warning');
            return;
        }
        
        const eventDate = Utils.formatDate(new Date(currentEvent.date));
        let message = `【車両提供状況】\n\n`;
        message += `${currentEvent.title}\n`;
        message += `📅 ${eventDate} ${currentEvent.time || ''}\n\n`;
        
        message += `🚗 車両一覧\n`;
        carsData.forEach((car, index) => {
            message += `${index + 1}. ${car.driverName}の車（${car.availableSeats}席）\n`;
            message += `   ${car.canPickup ? '✅' : '❌'}行き ${car.canDropoff ? '✅' : '❌'}帰り\n`;
            if (car.carModel) {
                message += `   車種: ${car.carModel}\n`;
            }
            message += '\n';
        });
        
        const totalSeats = carsData.reduce((sum, car) => sum + car.availableSeats, 0);
        message += `📊 合計: ${carsData.length}台 ${totalSeats}席\n`;
        message += `\n更新日時: ${new Date().toLocaleString()}`;
        
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
        window.open(lineUrl, '_blank');
        
        UI.showAlert('車両情報をLINEで共有しました', 'success');
    }
    
    /**
     * 自動配車提案を生成
     */
    function generateAutoAssignment() {
        if (carsData.length === 0) {
            UI.showAlert('車両が登録されていません', 'warning');
            return;
        }
        
        UI.showAlert('自動配車提案機能は開発中です', 'info');
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
     * 参加予定メンバーを取得
     */
    function getAttendingMembers() {
        return membersData.filter(member => {
            const attendance = attendanceData[member.id];
            return attendance && attendance.status === 'attending';
        });
    }
    
    /**
     * ヘルパー関数
     */
    function getEventTypeLabel(type) {
        const labels = { match: '試合', practice: '練習', other: 'その他' };
        return labels[type] || type;
    }
    
    /**
     * 表示の更新（外部から呼び出し可能）
     */
    CarProvision.updateDisplay = updateDisplay;
    
    /**
     * クリーンアップ
     */
    CarProvision.destroy = function() {
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
    window.addEventListener('beforeunload', CarProvision.destroy);
    
})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function() {
    if (typeof FCOjima !== 'undefined' && FCOjima.Carpool && FCOjima.Carpool.CarProvision) {
        FCOjima.Carpool.CarProvision.init();
    }
});
=======
     * 車両情報をLINEで共有
     */
    CarProvision.shareCarInfo = function() {
        console.log('車両情報を共有します...');
        
        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        const event = FCOjima.Storage.getSelectedEvent();
        
        if (!event) {
            UI.showAlert('イベント情報が見つかりません');
            return;
        }
        
        // 利用可能な車両のみ抽出
        const availableCars = carRegistrations.filter(car => car.canDrive !== 'no');
        
        if (availableCars.length === 0) {
            UI.showAlert('利用可能な車両がありません');
            return;
        }
        
        // メッセージを生成
        let message = '【車両情報】\n';
        message += FCOjima.Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        
        // 車両数と座席数の統計
        let totalSeats = 0;
        availableCars.forEach(car => {
            totalSeats += parseInt(car.frontSeat || 0) + 
                         parseInt(car.middleSeat || 0) + 
                         parseInt(car.backSeat || 0);
        });
        
        message += `車両数: ${availableCars.length}台\n`;
        message += `総座席数: ${totalSeats}席\n\n`;
        
        // 車両情報の詳細
        message += '【車両一覧】\n';
        availableCars.forEach((car, index) => {
            message += `${index + 1}. ${car.parent}さん\n`;
            
            // 提供タイプ
            const provideLabels = {
                'both': '行き帰り可能',
                'to': '行きのみ可能',
                'from': '帰りのみ可能'
            };
            message += `   ${provideLabels[car.canDrive]}\n`;
            
            // 座席数
            const totalCarSeats = parseInt(car.frontSeat || 0) + 
                                 parseInt(car.middleSeat || 0) + 
                                 parseInt(car.backSeat || 0);
            message += `   座席数: ${totalCarSeats}席 (助手席: ${car.frontSeat}, 中列: ${car.middleSeat}, 後列: ${car.backSeat})\n`;
            
            // 備考
            if (car.notes) {
                message += `   備考: ${car.notes}\n`;
            }
            
            message += '\n';
        });
        
        // テキストをクリップボードにコピー
        if (FCOjima.Utils.copyToClipboard(message)) {
            UI.showAlert('車両情報をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
            
            // LINEでの共有（モバイルのみ）
            if (FCOjima.Utils.shareViaLINE(message)) {
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
        
        console.log('車両情報の共有メッセージを作成しました');
    };
    
    /**
     * 車両提供リクエストメッセージを作成
     */
    CarProvision.createCarRequestMessage = function() {
        console.log('車両提供リクエストメッセージを作成します...');
        
        const event = FCOjima.Storage.getSelectedEvent();
        const attendance = FCOjima.Carpool.appData.attendance || [];
        
        if (!event) {
            UI.showAlert('イベント情報が見つかりません');
            return;
        }
        
        // 参加人数を集計
        const participantCount = attendance.filter(item => item.status === 'present').length;
        
        // メッセージを生成
        let message = '【車両提供のお願い】\n';
        message += FCOjima.Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        
        message += `以下のイベントの車両提供にご協力いただける方を募集しています。\n\n`;
        
        // 集合場所と会場
        if (event.meetingPlace) {
            message += `集合場所: ${event.meetingPlace}\n`;
        }
        
        if (event.venue) {
            message += `会場: ${event.venue}\n`;
        }
        
        if (event.startTime) {
            message += `時間: ${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}\n`;
        }
        
        if (event.departureTime) {
            message += `出発時間: ${event.departureTime}\n`;
        }
        
        message += `\n現在の参加予定人数: ${participantCount}名\n\n`;
        
        message += `車両を提供いただける方は、以下の情報をお知らせください。\n`;
        message += `・行き／帰り／両方\n`;
        message += `・乗車可能人数\n`;
        message += `・備考（同乗希望者など）\n\n`;
        
        message += `ご協力お願いいたします。`;
        
        // テキストをクリップボードにコピー
        if (FCOjima.Utils.copyToClipboard(message)) {
            UI.showAlert('車両提供リクエストメッセージをクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
            
            // LINEでの共有（モバイルのみ）
            if (FCOjima.Utils.shareViaLINE(message)) {
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
        
        console.log('車両提供リクエストメッセージを作成しました');
    };
    
    /**
     * 車両情報一括編集モードを開始
     */
    CarProvision.startBulkEdit = function() {
        console.log('車両情報一括編集モードを開始します...');
        
        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        if (carRegistrations.length === 0) {
            UI.showAlert('編集する車両情報がありません');
            return;
        }
        
        // 編集テーブルを作成して表示
        const tableHTML = `
        <div class="bulk-edit-container">
            <h3>車両情報一括編集</h3>
            <table class="bulk-edit-table">
                <thead>
                    <tr>
                        <th>運転者</th>
                        <th>提供</th>
                        <th>助手席</th>
                        <th>中列</th>
                        <th>後列</th>
                        <th>備考</th>
                    </tr>
                </thead>
                <tbody>
                    ${carRegistrations.map((car, index) => `
                    <tr>
                        <td>
                            <input type="text" value="${UI.escapeHTML(car.parent)}" data-index="${index}" data-field="parent">
                        </td>
                        <td>
                            <select data-index="${index}" data-field="canDrive">
                                <option value="both" ${car.canDrive === 'both' ? 'selected' : ''}>行き帰り可能</option>
                                <option value="no" ${car.canDrive === 'no' ? 'selected' : ''}>不可</option>
                                <option value="to" ${car.canDrive === 'to' ? 'selected' : ''}>行きのみ可能</option>
                                <option value="from" ${car.canDrive === 'from' ? 'selected' : ''}>帰りのみ可能</option>
                            </select>
                        </td>
                        <td>
                            <input type="number" min="0" max="1" value="${car.frontSeat}" data-index="${index}" data-field="frontSeat">
                        </td>
                        <td>
                            <input type="number" min="0" max="3" value="${car.middleSeat}" data-index="${index}" data-field="middleSeat">
                        </td>
                        <td>
                            <input type="number" min="0" max="3" value="${car.backSeat}" data-index="${index}" data-field="backSeat">
                        </td>
                        <td>
                            <input type="text" value="${UI.escapeHTML(car.notes || '')}" data-index="${index}" data-field="notes">
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="action-buttons">
                <button id="save-bulk-edit" class="primary-button">保存</button>
                <button id="cancel-bulk-edit" class="secondary-button">キャンセル</button>
            </div>
        </div>
        `;
        
        const bulkEditContainer = document.createElement('div');
        bulkEditContainer.className = 'bulk-edit-overlay';
        bulkEditContainer.innerHTML = tableHTML;
        document.body.appendChild(bulkEditContainer);
        
        // イベントリスナーを設定
        const saveButton = document.getElementById('save-bulk-edit');
        const cancelButton = document.getElementById('cancel-bulk-edit');
        
        saveButton.addEventListener('click', function() {
            CarProvision.saveBulkEdit();
        });
        
        cancelButton.addEventListener('click', function() {
            CarProvision.cancelBulkEdit();
        });
        
        console.log('車両情報一括編集モードを開始しました');
    };
    
    /**
     * 車両情報一括編集を保存
     */
    CarProvision.saveBulkEdit = function() {
        console.log('車両情報一括編集を保存します...');
        
        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        
        // 編集フィールドから値を取得して更新
        const inputs = document.querySelectorAll('.bulk-edit-table input, .bulk-edit-table select');
        inputs.forEach(input => {
            const index = parseInt(input.dataset.index);
            const field = input.dataset.field;
            
            if (index >= 0 && index < carRegistrations.length && field) {
                carRegistrations[index][field] = input.value;
            }
        });
        
        // データを保存
        FCOjima.Carpool.appData.carRegistrations = carRegistrations;
        FCOjima.Carpool.saveData();
        
        // 一括編集モードを終了
        this.cancelBulkEdit();
        
        // リストを更新
        this.updateCarRegistrations();
        
        UI.showAlert('車両情報を一括更新しました');
        console.log('車両情報一括編集を保存しました');
    };
    
    /**
     * 車両情報一括編集をキャンセル
     */
    CarProvision.cancelBulkEdit = function() {
        console.log('車両情報一括編集をキャンセルします...');
        
        // 一括編集コンテナを削除
        const bulkEditContainer = document.querySelector('.bulk-edit-overlay');
        if (bulkEditContainer) {
            document.body.removeChild(bulkEditContainer);
        }
        
        console.log('車両情報一括編集をキャンセルしました');
    };
})();
>>>>>>> 3f29fdc53b2c8f871d428ea6715327a2f2c4429e
