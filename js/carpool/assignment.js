/**
 * FC尾島ジュニア - 座席割り振り補助関数
 * ※ このブロックは下部の Assignment IIFE と同じオブジェクトを操作する
 */
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Assignment = FCOjima.Carpool.Assignment || {};

(function(app) {
    var Assignment = app.Carpool.Assignment;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;

    /**
     * 座席をクリア
     * @param {HTMLElement} seat - 座席要素
     */
    Assignment.clearSeat = function(seat) {
        seat.classList.remove('filled');
        delete seat.dataset.person;
        
        // アイコンを削除
        const icon = seat.querySelector('.member-icon');
        if (icon) {
            icon.remove();
        }
        
        // ラベルが消えていたら復元
        let label = seat.querySelector('.seat-label');
        if (!label) {
            label = document.createElement('div');
            label.className = 'seat-label';
            label.textContent = `${seat.dataset.seatType} ${parseInt(seat.dataset.seatIndex) + 1}`;
            seat.appendChild(label);
        }
    };
    
    /**
     * 座席編集モーダルを開く
     * @param {HTMLElement} seat - 座席要素
     */
    Assignment.openSeatEditModal = function(seat) {
        console.log('座席編集モーダルを開きます...');

        const seatEditModal = document.getElementById('seat-edit-modal');
        if (!seatEditModal) return;

        const seatEditForm = document.getElementById('seat-edit-form');
        seatEditForm.dataset.carIndex = seat.dataset.carIndex;
        seatEditForm.dataset.seatType = seat.dataset.seatType;
        seatEditForm.dataset.seatIndex = seat.dataset.seatIndex;

        // 現在の配置状況を表示
        const currentInfo = document.getElementById('seat-current-info');
        const currentPerson = seat.dataset.person;
        if (currentInfo) {
            currentInfo.textContent = currentPerson
                ? '現在: ' + currentPerson + '（別の名前をタップで変更）'
                : '空席 — 配置するメンバーをタップしてください';
        }

        // メンバーリストを生成（全メンバー + 荷物、割り当て済みを除く）
        const memberList = document.getElementById('seat-member-list');
        if (memberList) {
            memberList.innerHTML = '';

            const members = app.Carpool.members || [];
            const assignedPeople = [];
            document.querySelectorAll('.seat.filled').forEach(function(s) {
                if (s !== seat && s.dataset.person) assignedPeople.push(s.dataset.person);
            });

            const available = members.filter(function(m) {
                return !assignedPeople.includes(m.name);
            });
            available.push({ id: 'luggage', name: '荷物', role: 'other' });

            const roleOrder = { coach: 1, assist: 2, player: 3, father: 4, mother: 4, other: 5 };
            available.sort(function(a, b) {
                return (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5);
            });

            if (available.length === 0) {
                memberList.innerHTML = '<p style="padding:10px;color:#999;">配置できるメンバーがいません</p>';
            } else {
                available.forEach(function(member) {
                    var item = document.createElement('div');
                    item.style.cssText = 'padding:10px 14px;border-bottom:1px solid #eee;cursor:pointer;display:flex;align-items:center;gap:10px;';
                    if (currentPerson === member.name) item.style.background = '#fff3cd';

                    var initials = document.createElement('span');
                    initials.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#E8A200;color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.85em;font-weight:bold;flex-shrink:0;';
                    initials.textContent = (member.name || '').substring(0, 2);

                    var nameSpan = document.createElement('span');
                    nameSpan.textContent = member.name;

                    item.appendChild(initials);
                    item.appendChild(nameSpan);

                    item.addEventListener('click', function() {
                        Assignment.setSeatOccupant(seat, member.name);
                        UI.closeModal('seat-edit-modal');
                        Assignment.saveAssignments();
                        Assignment.updateMembersList();
                    });

                    memberList.appendChild(item);
                });
            }
        }

        UI.openModal('seat-edit-modal');
    };
    
    /**
     * 座席編集を保存
     */
    Assignment.saveSeatEdit = function() {
        console.log('座席編集を保存します...');
        
        const seatEditForm = document.getElementById('seat-edit-form');
        const carIndex = seatEditForm.dataset.carIndex;
        const seatType = seatEditForm.dataset.seatType;
        const seatIndex = seatEditForm.dataset.seatIndex;
        
        const person = document.getElementById('seat-person').value;
        
        // 対象の座席要素を取得
        const seat = document.querySelector(`.seat[data-car-index="${carIndex}"][data-seat-type="${seatType}"][data-seat-index="${seatIndex}"]`);
        
        if (seat) {
            if (person) {
                // 乗車メンバーを設定
                this.setSeatOccupant(seat, person);
                console.log(`座席に乗車メンバーを設定しました: ${person}`);
            } else {
                // 座席をクリア
                this.clearSeat(seat);
                console.log('座席をクリアしました');
            }
        } else {
            console.log('対象の座席要素が見つかりません');
        }
        
        // モーダルを閉じる
        UI.closeModal('seat-edit-modal');
        
        // 配置データを保存
        this.saveAssignments();
        
        // メンバーリストを更新
        this.updateMembersList();
        
        console.log('座席編集を保存しました');
    };
    
    /**
     * 選択した座席をクリア
     */
    Assignment.clearSelectedSeat = function() {
        console.log('選択した座席をクリアします...');
        
        const seatEditForm = document.getElementById('seat-edit-form');
        const carIndex = seatEditForm.dataset.carIndex;
        const seatType = seatEditForm.dataset.seatType;
        const seatIndex = seatEditForm.dataset.seatIndex;
        
        // 対象の座席要素を取得
        const seat = document.querySelector(`.seat[data-car-index="${carIndex}"][data-seat-type="${seatType}"][data-seat-index="${seatIndex}"]`);
        
        if (seat) {
            // 座席をクリア
            this.clearSeat(seat);
            console.log('座席をクリアしました');
        } else {
            console.log('対象の座席要素が見つかりません');
        }
        
        // モーダルを閉じる
        UI.closeModal('seat-edit-modal');
        
        // 配置データを保存
        this.saveAssignments();
        
        // メンバーリストを更新
        this.updateMembersList();
        
        console.log('選択した座席のクリアが完了しました');
    };
    
    /**
     * 車のドライバーを編集
     * @param {number} carIndex - 車両インデックス
     */
    Assignment.editCarDriver = function(carIndex) {
        console.log(`車のドライバーを編集します: インデックス=${carIndex}`);
        
        const carRegistrations = app.Carpool.appData.carRegistrations;
        const car = carRegistrations[carIndex];
        if (!car) {
            console.log('指定された車両が見つかりません');
            return;
        }
        
        const newDriver = UI.showPrompt('ドライバー名を入力してください', car.parent);
        
        if (newDriver && newDriver !== car.parent) {
            // ドライバー名を更新
            car.parent = newDriver;
            
            // 運転手の座席表示も更新
            const driverSeat = document.querySelector(`.seat.driver-seat[data-car-index="${carIndex}"]`);
            if (driverSeat) {
                driverSeat.dataset.person = newDriver;
                
                // アイコンを更新
                const icon = driverSeat.querySelector('.member-icon');
                if (icon) {
                    icon.textContent = this.getNameInitials(newDriver);
                    icon.dataset.name = newDriver;
                }
            }
            
            // データを保存
            app.Carpool.saveData();
            
            // UIを更新
            if (app.Carpool.CarProvision && app.Carpool.CarProvision.updateCarRegistrations) {
                app.Carpool.CarProvision.updateCarRegistrations();
            }
            this.updateAssignments();
            
            console.log(`ドライバーを更新しました: ${newDriver}`);
        } else {
            console.log('ドライバーの変更がキャンセルされました');
        }
    };
    
    /**
     * ランダム割り当て生成
     */
    Assignment.generateRandomAssignments = function() {
        console.log('ランダム割り当てを生成します...');
        
        const carRegistrations = app.Carpool.appData.carRegistrations;
        
        if (!carRegistrations || carRegistrations.length === 0) {
            UI.showAlert('この予定には車両登録がありません');
            console.log('車両登録がありません');
            return;
        }
        
        // 運転可能な保護者リスト
        const drivers = carRegistrations.filter(reg => reg.canDrive !== 'no');
        
        if (drivers.length === 0) {
            UI.showAlert('運転可能な保護者がいません');
            console.log('運転可能な保護者がいません');
            return;
        }
        
        // 出欠で参加確定している選手
        const attendance = app.Carpool.appData.attendance;
        const presentPlayers = [];
        
        if (attendance && attendance.length > 0) {
            attendance
                .filter(a => a.status === 'present')
                .forEach(a => {
                    const player = app.Carpool.members.find(m => m.name === a.name && m.role === 'player');
                    if (player) {
                        presentPlayers.push(player.name);
                    }
                });
        }
        
        console.log(`参加確定している選手数: ${presentPlayers.length}人`);
        
        // 参加確定している選手がいない場合は全選手を対象にする
        let targetPlayers = presentPlayers;
        if (targetPlayers.length === 0) {
            targetPlayers = app.Carpool.members
                .filter(m => m.role === 'player')
                .map(m => m.name);
            console.log(`全選手数: ${targetPlayers.length}人`);
        }
        
        // 監督・コーチのリスト
        const staffMembers = app.Carpool.members
            .filter(m => m.role === 'coach' || m.role === 'assist')
            .map(m => m.name);
        
        console.log(`監督・コーチ数: ${staffMembers.length}人`);
        
        // 割り当てリセット
        app.Carpool.appData.assignments = [];
        
        // 各車両に対して割り当て
        drivers.forEach((driver, carIndex) => {
            // 座席情報を初期化
            const seats = {
                '助手席': {},
                '中列': {},
                '後列': {}
            };
            
            // 運転手は自動的に割り当て
            const driverName = driver.parent;
            
            // 優先順位：監督・コーチ→助手席、選手→中列と後列
            // 助手席に監督・コーチを割り当て
            let staffIndex = 0;
            for (let i = 0; i < driver.frontSeat && staffIndex < staffMembers.length; i++) {
                seats['助手席'][i] = staffMembers[staffIndex];
                staffIndex++;
            }
            
            // 残りの選手を中列と後列に割り当て
            let availableSeats = [];
            
            // 残りの助手席
            for (let i = Object.keys(seats['助手席']).length; i < driver.frontSeat; i++) {
                availableSeats.push({ type: '助手席', index: i });
            }
            
            // 中列
            for (let i = 0; i < driver.middleSeat; i++) {
                availableSeats.push({ type: '中列', index: i });
            }
            
            // 後列
            for (let i = 0; i < driver.backSeat; i++) {
                availableSeats.push({ type: '後列', index: i });
            }
            
            // シャッフル（ランダム割り当て）
            availableSeats = Utils.shuffleArray(availableSeats);
            
            // 選手を割り当て（同じ学年でまとめる）
            const playersByGrade = {};
            targetPlayers.forEach(player => {
                const memberInfo = app.Carpool.members.find(m => m.name === player);
                if (memberInfo && memberInfo.grade) {
                    if (!playersByGrade[memberInfo.grade]) {
                        playersByGrade[memberInfo.grade] = [];
                    }
                    playersByGrade[memberInfo.grade].push(player);
                }
            });
            
            // 学年ごとにグループ化して割り当て
            Object.values(playersByGrade).forEach(gradePlayers => {
                // 各グループをシャッフル
                const shuffledGradePlayers = Utils.shuffleArray([...gradePlayers]);
                
                // 利用可能な座席がある限り、このグループから割り当てる
                while (shuffledGradePlayers.length > 0 && availableSeats.length > 0) {
                    const player = shuffledGradePlayers.shift();
                    const seat = availableSeats.shift();
                    
                    seats[seat.type][seat.index] = player;
                    
                    // 割り当てた選手をtargetPlayersから削除
                    const index = targetPlayers.indexOf(player);
                    if (index !== -1) {
                        targetPlayers.splice(index, 1);
                    }
                }
            });
            
            // グループ化されなかった残りの選手を割り当て
            while (targetPlayers.length > 0 && availableSeats.length > 0) {
                const player = targetPlayers.shift();
                const seat = availableSeats.shift();
                
                seats[seat.type][seat.index] = player;
            }
            
            // 割り当て結果を保存
            app.Carpool.appData.assignments.push({
                carIndex,
                driver: driverName,
                seats
            });
        });
        
        // データ保存とUI更新
        app.Carpool.saveData();
        this.updateAssignments();
        
        // 割り当てられなかった選手がいれば通知
        if (targetPlayers.length > 0) {
            UI.showAlert(`注意: ${targetPlayers.length}名のメンバーに乗車スペースがありません。必要に応じて手動で調整してください。`);
            console.log(`未割り当てのメンバー: ${targetPlayers.length}人`);
        } else {
            UI.showAlert('乗車割り当てが完了しました！');
            console.log('すべてのメンバーの割り当てが完了しました');
        }
    };
    
    /**
     * 割り当て結果の保存
     */
    Assignment.saveAssignments = function() {
        console.log('割り当て結果を保存します...');
        
        // 現在の割り当て状態を取得
        const carLayouts = document.querySelectorAll('.car-layout');
        const assignments = [];
        
        carLayouts.forEach(carLayout => {
            const carIndex = parseInt(carLayout.dataset.carIndex);
            const seats = {
                '助手席': {},
                '中列': {},
                '後列': {}
            };
            
            // 各座席の情報を取得
            const seatElements = carLayout.querySelectorAll('.seat:not(.driver-seat)');
            seatElements.forEach(seat => {
                const seatType = seat.dataset.seatType;
                const seatIndex = seat.dataset.seatIndex;
                const person = seat.dataset.person;
                
                if (person) {
                    seats[seatType][seatIndex] = person;
                }
            });
            
            // 運転手を取得
            const driverSeat = carLayout.querySelector('.seat.driver-seat');
            const driver = driverSeat ? driverSeat.dataset.person : '';
            
            assignments.push({
                carIndex,
                driver,
                seats
            });
        });
        
        // 割り当て結果を保存
        app.Carpool.appData.assignments = assignments;
        
        // データ保存
        app.Carpool.saveData();
        
        console.log(`割り当て結果を保存しました: ${assignments.length}台`);
    };
    
    /**
     * 割り当て結果の共有
     */
    Assignment.shareAssignments = function() {
        console.log('割り当て結果を共有します...');
        
        // 割り当て結果をテキスト形式で生成
        let message = '【乗車割り当て】\n';
        
        // イベント情報を取得
        const event = Storage.getSelectedEvent();
        if (event) {
            message += `${Utils.formatDateForDisplay(event.date)} ${event.title}\n\n`;
        }
        
        const assignments = app.Carpool.appData.assignments;
        const carRegistrations = app.Carpool.appData.carRegistrations;
        
        if (assignments && assignments.length > 0) {
            assignments.forEach((assignment, index) => {
                const car = carRegistrations[assignment.carIndex];
                message += `■ ${assignment.driver}の車\n`;
                
                // 各座席タイプごとに乗車メンバーを表示
                Object.keys(assignment.seats).forEach(seatType => {
                    const seatIndices = Object.keys(assignment.seats[seatType]);
                    if (seatIndices.length === 0) return;
                    
                    message += `  ${seatType}: `;
                    
                    const passengers = seatIndices.map(seatIndex => {
                        return assignment.seats[seatType][seatIndex];
                    }).filter(Boolean);
                    
                    message += passengers.join(', ') + '\n';
                });
                
                message += '\n';
            });
        } else {
            message += '配車割り当てが設定されていません。';
        }
        
        // 出欠確認・割り当てページのURLを追加
        var baseUrl = window.location.origin;
        message += '\n\n▼ 出欠確認:\n' + baseUrl + '/carpool/attendance.html';
        message += '\n▼ 座席割り当て:\n' + baseUrl + '/carpool/assignments.html';

        // テキストをクリップボードにコピー
        if (Utils.copyToClipboard(message)) {
            UI.showAlert('配車情報をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');

            // LINEでの共有（モバイルのみ）
            if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                var lineUrl = 'https://line.me/R/msg/text/?' + encodeURIComponent(message);
                window.location.href = lineUrl;
            }
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
        
        console.log('割り当て結果の共有が完了しました');
    };
    
})(window.FCOjima);/**
 * FC尾島ジュニア - 割り当てタブの機能
 * 乗車割り当てに関する機能を提供
 */

FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Assignment = FCOjima.Carpool.Assignment || {};

(function(app) {
    // 名前空間のショートカット
    var Assignment = app.Carpool.Assignment;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;
    
    /**
     * 割り当て機能の初期化
     */
    Assignment.init = function() {
        console.log('割り当て機能を初期化しています...');

        // メンバーとイベントデータをロード
        app.Carpool.loadMembers();
        app.Carpool.loadData();

        // イベント情報を表示
        this.updateEventInfo();

        // 割り当て一覧を更新
        this.updateAssignments();

        // イベントリスナーの設定
        this.setupEventListeners();

        console.log('割り当て機能の初期化が完了しました');
    };
    
    /**
     * イベントリスナーの設定
     */
    Assignment.setupEventListeners = function() {
        console.log('割り当てのイベントリスナーを設定しています...');
        
        // ランダム割り当てボタン
        var generateRandomButton = document.getElementById('generate-random');
        if (generateRandomButton) {
            generateRandomButton.addEventListener('click', function() {
                Assignment.generateRandomAssignments();
            });
        }
        
        // 割り当て保存ボタン
        var saveAssignmentsButton = document.getElementById('save-assignments');
        if (saveAssignmentsButton) {
            saveAssignmentsButton.addEventListener('click', function() {
                Assignment.saveAssignments();
            });
        }
        
        // 割り当て共有ボタン
        var shareAssignmentsButton = document.getElementById('share-assignments');
        if (shareAssignmentsButton) {
            shareAssignmentsButton.addEventListener('click', function() {
                Assignment.shareAssignments();
            });
        }
        
        // 座席編集モーダルの保存ボタン
        var seatEditForm = document.getElementById('seat-edit-form');
        if (seatEditForm) {
            seatEditForm.addEventListener('submit', function(e) {
                e.preventDefault();
                Assignment.saveSeatEdit();
            });
        }
        
        // 座席クリアボタン
        var clearSeatButton = document.getElementById('clear-seat');
        if (clearSeatButton) {
            clearSeatButton.addEventListener('click', function() {
                Assignment.clearSelectedSeat();
            });
        }

        // キャンセルボタン
        var cancelSeatBtn = document.getElementById('cancel-seat-edit');
        if (cancelSeatBtn) {
            cancelSeatBtn.addEventListener('click', function() {
                UI.closeModal('seat-edit-modal');
            });
        }
        
        console.log('割り当てのイベントリスナー設定が完了しました');
    };
    
    /**
     * イベント情報を表示
     */
    Assignment.updateEventInfo = function() {
        console.log('イベント情報を表示します...');
        
        const eventInfo = document.getElementById('assignment-event-info');
        if (!eventInfo) {
            console.log('イベント情報表示領域が見つかりません');
            return;
        }
        
        const event = Storage.getSelectedEvent();
        if (!event) {
            eventInfo.innerHTML = UI.createAlert('info', 'イベントが選択されていません。');
            console.log('選択されたイベントがありません');
            return;
        }
        
        // イベントタイプのクラスを付与
        eventInfo.className = `event-summary ${event.type || 'other'}`;
        
        // イベント情報を表示
        eventInfo.innerHTML = `
            <strong>${UI.escapeHTML(event.title)}</strong>
            (${Utils.formatDateForDisplay(event.date)} ${event.startTime || ''})
        `;
        
        console.log('イベント情報の表示が完了しました');
    };
    
    /**
     * 割り当て一覧を更新
     */
    Assignment.updateAssignments = function() {
        console.log('割り当て一覧を更新しています...');
        
        const carsContainer = document.getElementById('cars-container');
        if (!carsContainer) {
            console.log('車両コンテナが見つかりません');
            return;
        }
        
        carsContainer.innerHTML = '';
        
        const carRegistrations = app.Carpool.appData.carRegistrations;
        
        if (!carRegistrations || carRegistrations.length === 0) {
            carsContainer.innerHTML = UI.createAlert('info', '車両登録がありません。「車提供」タブで車両を登録してください。');
            console.log('車両登録がありません');
            return;
        }
        
        // 車両提供者のみフィルタリング
        const availableCars = carRegistrations.filter(car => car.canDrive !== 'no');
        
        if (availableCars.length === 0) {
            carsContainer.innerHTML = UI.createAlert('info', '車両提供可能な登録がありません。');
            console.log('車両提供可能な登録がありません');
            return;
        }
        
        console.log(`利用可能な車両数: ${availableCars.length}台`);
        
        // 既存の配置データを取得
        const existingAssignments = app.Carpool.appData.assignments || [];
        
        // 車両ごとに配置レイアウトを作成
        availableCars.forEach((car, carIndex) => {
            const carLayout = this.createCarLayout(car, carIndex, existingAssignments);
            carsContainer.appendChild(carLayout);
        });
        
        // メンバーリストを更新
        this.updateMembersList();
        
        // ドラッグ＆ドロップのセットアップ
        this.setupDragAndDrop();
        
        console.log('割り当て一覧の更新が完了しました');
    };
    
    /**
     * 車両レイアウトを作成
     * @param {Object} car - 車両情報
     * @param {number} carIndex - 車両インデックス
     * @param {Array} existingAssignments - 既存の配置データ
     * @returns {HTMLElement} 車両レイアウト要素
     */
    Assignment.createCarLayout = function(car, carIndex, existingAssignments) {
        // 車両レイアウトのコンテナ
        const carLayout = document.createElement('div');
        carLayout.className = 'car-layout';
        carLayout.dataset.carIndex = carIndex;
        
        // 車両ヘッダー
        const carHeader = document.createElement('div');
        carHeader.className = 'car-header';
        carHeader.textContent = `${car.parent}の車`;
        carHeader.addEventListener('click', () => {
            this.editCarDriver(carIndex);
        });
        carLayout.appendChild(carHeader);
        
        // 車両詳細情報
        const carInfo = document.createElement('div');
        carInfo.className = 'car-info';
        carInfo.innerHTML = `
            <div class="car-info-item">提供: ${this.getProvideTypeLabel(car.canDrive)}</div>
            <div class="car-info-item">備考: ${car.notes || 'なし'}</div>
        `;
        carLayout.appendChild(carInfo);
        
        // 車両座席レイアウト
        const carSeatLayout = document.createElement('div');
        carSeatLayout.className = 'car-seat-layout';
        
        // 車の表現（上から見た図）を作成
        const carView = document.createElement('div');
        carView.className = 'car-top-view';
        
        // 運転席
        const driverSeat = this.createDriverSeat(car.parent, carIndex);
        carView.appendChild(driverSeat);
        
        // 座席レイアウトを作成
        // 前列（助手席）
        if (car.frontSeat > 0) {
            const frontRow = document.createElement('div');
            frontRow.className = 'seat-row front-row';
            
            for (let i = 0; i < car.frontSeat; i++) {
                const seat = this.createSeat('助手席', i, carIndex);
                frontRow.appendChild(seat);
            }
            
            carView.appendChild(frontRow);
        }
        
        // 中列
        if (car.middleSeat > 0) {
            const middleRow = document.createElement('div');
            middleRow.className = 'seat-row middle-row';
            
            for (let i = 0; i < car.middleSeat; i++) {
                const seat = this.createSeat('中列', i, carIndex);
                middleRow.appendChild(seat);
            }
            
            carView.appendChild(middleRow);
        }
        
        // 後列
        if (car.backSeat > 0) {
            const backRow = document.createElement('div');
            backRow.className = 'seat-row back-row';
            
            for (let i = 0; i < car.backSeat; i++) {
                const seat = this.createSeat('後列', i, carIndex);
                backRow.appendChild(seat);
            }
            
            carView.appendChild(backRow);
        }
        
        carSeatLayout.appendChild(carView);
        carLayout.appendChild(carSeatLayout);
        
        // 既存の配置データを反映
        const carAssignment = existingAssignments.find(a => a.carIndex === carIndex);
        if (carAssignment && carAssignment.seats) {
            Object.keys(carAssignment.seats).forEach(seatType => {
                const seatIndices = Object.keys(carAssignment.seats[seatType]);
                
                seatIndices.forEach(seatIndex => {
                    const person = carAssignment.seats[seatType][seatIndex];
                    if (person) {
                        const seat = carLayout.querySelector(`.seat[data-seat-type="${seatType}"][data-seat-index="${seatIndex}"]`);
                        if (seat) {
                            this.setSeatOccupant(seat, person);
                        }
                    }
                });
            });
        }
        
        return carLayout;
    };
    
    /**
     * 運転席を作成
     * @param {string} driverName - 運転者名
     * @param {number} carIndex - 車両インデックス
     * @returns {HTMLElement} 運転席要素
     */
    Assignment.createDriverSeat = function(driverName, carIndex) {
        const driverSeat = document.createElement('div');
        driverSeat.className = 'seat driver-seat';
        driverSeat.dataset.seatType = 'driver';
        driverSeat.dataset.carIndex = carIndex;
        driverSeat.dataset.person = driverName;
        driverSeat.title = "ドライバー: " + driverName;
        
        const icon = document.createElement('div');
        icon.className = 'member-icon driver-icon';
        icon.textContent = this.getNameInitials(driverName);
        icon.dataset.name = driverName;
        
        const label = document.createElement('div');
        label.className = 'seat-label';
        label.textContent = '運転手';
        
        driverSeat.appendChild(icon);
        driverSeat.appendChild(label);
        
        driverSeat.draggable = true;
        driverSeat.addEventListener('dragstart', this.handleDragStart.bind(this));
        
        return driverSeat;
    };
    
    /**
     * 座席を作成
     * @param {string} seatType - 座席タイプ（助手席/中列/後列）
     * @param {number} seatIndex - 座席インデックス
     * @param {number} carIndex - 車両インデックス
     * @returns {HTMLElement} 座席要素
     */
    Assignment.createSeat = function(seatType, seatIndex, carIndex) {
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.dataset.seatType = seatType;
        seat.dataset.seatIndex = seatIndex;
        seat.dataset.carIndex = carIndex;
        
        const label = document.createElement('div');
        label.className = 'seat-label';
        label.textContent = `${seatType} ${seatIndex + 1}`;
        
        seat.appendChild(label);
        
        // 座席クリック時の処理
        seat.addEventListener('click', () => {
            this.openSeatEditModal(seat);
        });
        
        return seat;
    };
    
    /**
     * 座席に乗車メンバーを設定
     * @param {HTMLElement} seat - 座席要素
     * @param {string} personName - 乗車メンバー名
     */
    Assignment.setSeatOccupant = function(seat, personName) {
        seat.classList.add('filled');
        seat.dataset.person = personName;
        
        // 既存のアイコンがあれば削除
        const existingIcon = seat.querySelector('.member-icon');
        if (existingIcon) {
            existingIcon.remove();
        }
        
        const icon = document.createElement('div');
        icon.className = 'member-icon';
        icon.textContent = this.getNameInitials(personName);
        icon.dataset.name = personName;
        icon.title = personName;
        
        seat.insertBefore(icon, seat.firstChild);
    };
    
    /**
     * 名前からイニシャルを取得
     * @param {string} name - 名前
     * @returns {string} イニシャル（最大2文字）
     */
    Assignment.getNameInitials = function(name) {
        if (!name) return '';
        
        // 名前を分割（空白または記号で区切る）
        const parts = name.split(/[\s\-_,\.]/);
        
        if (parts.length > 1) {
            // 複数の部分があれば、最初の部分の最初の文字と次の部分の最初の文字
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        } else {
            // 単一の名前の場合は、最初の1〜2文字
            return name.substring(0, 2);
        }
    };
    
    /**
     * 提供タイプのラベルを取得
     * @param {string} type - 提供タイプ
     * @returns {string} ラベル
     */
    Assignment.getProvideTypeLabel = function(type) {
        const types = {
            'both': '行き帰り可能',
            'no': '不可',
            'to': '行きのみ可能',
            'from': '帰りのみ可能'
        };
        
        return types[type] || type;
    };
    
    /**
     * メンバーリストを更新
     */
    Assignment.updateMembersList = function() {
        console.log('メンバーリストを更新しています...');
        
        const membersContainer = document.getElementById('members-container');
        if (!membersContainer) {
            console.log('メンバーコンテナが見つかりません');
            return;
        }
        
        membersContainer.innerHTML = '';
        
        // イベントの対象学年を取得
        const event = Storage.getSelectedEvent();
        let targetGrades = [];
        
        if (event && event.target && event.target.length > 0) {
            targetGrades = event.target;
            console.log(`対象学年: ${targetGrades.join(', ')}`);
        } else {
            console.log('対象学年が指定されていません');
        }
        
        // 対象学年のメンバーと監督・コーチをフィルタリング
        let filteredMembers = [];
        const members = app.Carpool.members;
        
        // 監督・コーチは常に表示
        const staffMembers = members.filter(m => m.role === 'coach' || m.role === 'assist');
        filteredMembers = [...staffMembers];
        
        // 対象学年の選手を追加
        if (targetGrades.length > 0) {
            const targetPlayers = members.filter(m => 
                m.role === 'player' && 
                m.grade && 
                targetGrades.includes(m.grade)
            );
            filteredMembers = [...filteredMembers, ...targetPlayers];
        } else {
            // 対象学年が指定されていない場合は全選手
            const allPlayers = members.filter(m => m.role === 'player');
            filteredMembers = [...filteredMembers, ...allPlayers];
        }
        
        // 出欠で参加確定している選手の保護者を追加
        const attendance = app.Carpool.appData.attendance;
        if (attendance && attendance.length > 0) {
            const presentPlayers = attendance
                .filter(a => a.status === 'present')
                .map(a => a.name);
                
            const parentMembers = members.filter(m => 
                (m.role === 'father' || m.role === 'mother') && 
                members.some(p => 
                    p.role === 'player' && 
                    presentPlayers.includes(p.name) && 
                    p.notes && 
                    p.notes.includes(m.name)
                )
            );
            
            filteredMembers = [...filteredMembers, ...parentMembers];
        }
        
        // 既に座席に配置されているメンバーを除外
        const assignedMembers = [];
        document.querySelectorAll('.seat.filled').forEach(seat => {
            if (seat.dataset.person) {
                assignedMembers.push(seat.dataset.person);
            }
        });
        
        filteredMembers = filteredMembers.filter(m => 
            !assignedMembers.includes(m.name)
        );
        
        // 荷物アイテムを追加
        filteredMembers.push({
            id: 'luggage',
            name: '荷物',
            role: 'other'
        });
        
        console.log(`配置可能なメンバー数: ${filteredMembers.length}人`);
        
        // メンバーリストに表示
        if (filteredMembers.length === 0) {
            membersContainer.innerHTML = UI.createAlert('info', '配置可能なメンバーがいません。');
            return;
        }
        
        // 役割ごとに分類
        const roleGroups = {
            coach: { title: '監督・コーチ', members: [] },
            player: { title: '選手', members: [] },
            parent: { title: '保護者', members: [] },
            other: { title: 'その他', members: [] }
        };
        
        filteredMembers.forEach(member => {
            if (member.role === 'coach' || member.role === 'assist') {
                roleGroups.coach.members.push(member);
            } else if (member.role === 'player') {
                roleGroups.player.members.push(member);
            } else if (member.role === 'father' || member.role === 'mother') {
                roleGroups.parent.members.push(member);
            } else {
                roleGroups.other.members.push(member);
            }
        });
        
        // 各グループを表示
        Object.values(roleGroups).forEach(group => {
            if (group.members.length === 0) return;
            
            const groupHeader = document.createElement('h3');
            groupHeader.textContent = group.title;
            groupHeader.className = 'member-group-header';
            membersContainer.appendChild(groupHeader);
            
            const membersList = document.createElement('div');
            membersList.className = 'members-list';
            
            group.members.forEach(member => {
                const memberItem = this.createMemberItem(member);
                membersList.appendChild(memberItem);
            });
            
            membersContainer.appendChild(membersList);
        });
        
        console.log('メンバーリストの更新が完了しました');
    };
    
    /**
     * メンバーアイテムを作成
     * @param {Object} member - メンバー情報
     * @returns {HTMLElement} メンバーアイテム要素
     */
    Assignment.createMemberItem = function(member) {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        memberItem.classList.add(member.role);
        memberItem.dataset.memberId = member.id;
        memberItem.dataset.name = member.name;
        
        const icon = document.createElement('div');
        icon.className = 'member-icon';
        icon.textContent = this.getNameInitials(member.name);
        
        const nameLabel = document.createElement('div');
        nameLabel.className = 'member-name';
        nameLabel.textContent = member.name;
        
        memberItem.appendChild(icon);
        memberItem.appendChild(nameLabel);
        
        // ドラッグ＆ドロップ用の属性
        memberItem.draggable = true;
        memberItem.addEventListener('dragstart', this.handleDragStart.bind(this));
        
        return memberItem;
    };
    
    /**
     * ドラッグ開始ハンドラ
     * @param {DragEvent} e - ドラッグイベント
     */
    Assignment.handleDragStart = function(e) {
        // 要素がメンバーアイテムの場合
        if (e.target.classList.contains('member-item')) {
            e.dataTransfer.setData('text/plain', e.target.dataset.name);
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'member',
                name: e.target.dataset.name
            }));
        }
        // 要素が座席の場合
        else if (e.target.classList.contains('seat') && e.target.dataset.person) {
            e.dataTransfer.setData('text/plain', e.target.dataset.person);
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'seat',
                name: e.target.dataset.person,
                fromCarIndex: e.target.dataset.carIndex,
                fromSeatType: e.target.dataset.seatType,
                fromSeatIndex: e.target.dataset.seatIndex
            }));
        }
        
        e.dataTransfer.effectAllowed = 'move';
    };
    
    /**
     * ドラッグ＆ドロップのセットアップ
     */
    Assignment.setupDragAndDrop = function() {
        console.log('ドラッグ＆ドロップをセットアップします...');
        
        // 全ての座席要素に対してイベントリスナーを設定
        const seats = document.querySelectorAll('.seat');
        
        seats.forEach(seat => {
            seat.addEventListener('dragover', function(e) {
                e.preventDefault(); // ドロップを許可
                e.dataTransfer.dropEffect = 'move';
                this.classList.add('dragover');
            });
            
            seat.addEventListener('dragleave', function(e) {
                this.classList.remove('dragover');
            });
            
            seat.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('dragover');
                
                // ドロップされたデータを取得
                const memberName = e.dataTransfer.getData('text/plain');
                
                try {
                    const jsonData = JSON.parse(e.dataTransfer.getData('application/json'));
                    
                    // 座席データの場合は交換処理
                    if (jsonData.type === 'seat') {
                        Assignment.handleSeatExchange(
                            jsonData.fromCarIndex,
                            jsonData.fromSeatType,
                            jsonData.fromSeatIndex,
                            this.dataset.carIndex,
                            this.dataset.seatType,
                            this.dataset.seatIndex
                        );
                    } else {
                        // 新規配置
                        Assignment.setSeatOccupant(this, memberName);
                        
                        // 配置データを保存
                        Assignment.saveAssignments();
                        
                        // 配置された人をリストから削除
                        Assignment.updateMembersList();
                    }
                } catch (e) {
                    console.error('ドロップデータの解析に失敗しました', e);
                    
                    // 単純に配置
                    Assignment.setSeatOccupant(this, memberName);
                    
                    // 配置データを保存
                    Assignment.saveAssignments();
                    
                    // 配置された人をリストから削除
                    Assignment.updateMembersList();
                }
            });
        });
        
        // メンバーコンテナにもドロップイベントを設定（座席からメンバーリストへの移動）
        const membersContainer = document.getElementById('members-container');
        if (membersContainer) {
            membersContainer.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            
            membersContainer.addEventListener('drop', function(e) {
                e.preventDefault();
                
                try {
                    const jsonData = JSON.parse(e.dataTransfer.getData('application/json'));
                    
                    // 座席からのドロップの場合、その座席をクリア
                    if (jsonData.type === 'seat') {
                        const seat = document.querySelector(`.seat[data-car-index="${jsonData.fromCarIndex}"][data-seat-type="${jsonData.fromSeatType}"][data-seat-index="${jsonData.fromSeatIndex}"]`);
                        if (seat) {
                            Assignment.clearSeat(seat);
                            
                            // 配置データを保存
                            Assignment.saveAssignments();
                            
                            // メンバーリストを更新
                            Assignment.updateMembersList();
                        }
                    }
                } catch (e) {
                    console.error('ドロップデータの解析に失敗しました', e);
                }
            });
        }
        
        console.log('ドラッグ＆ドロップのセットアップが完了しました');
    };
    
    /**
     * 座席交換処理
     * @param {number} fromCarIndex - 元の車両インデックス
     * @param {string} fromSeatType - 元の座席タイプ
     * @param {number} fromSeatIndex - 元の座席インデックス
     * @param {number} toCarIndex - 先の車両インデックス
     * @param {string} toSeatType - 先の座席タイプ
     * @param {number} toSeatIndex - 先の座席インデックス
     */
    Assignment.handleSeatExchange = function(fromCarIndex, fromSeatType, fromSeatIndex, toCarIndex, toSeatType, toSeatIndex) {
        console.log(`座席交換: 車${fromCarIndex}の${fromSeatType}${fromSeatIndex} -> 車${toCarIndex}の${toSeatType}${toSeatIndex}`);
        
        // 元の座席と先の座席を取得
        const fromSeat = document.querySelector(`.seat[data-car-index="${fromCarIndex}"][data-seat-type="${fromSeatType}"][data-seat-index="${fromSeatIndex}"]`);
        const toSeat = document.querySelector(`.seat[data-car-index="${toCarIndex}"][data-seat-type="${toSeatType}"][data-seat-index="${toSeatIndex}"]`);
        
        if (!fromSeat || !toSeat) {
            console.error('座席要素が見つかりません');
            return;
        }
        
        // 交換データの一時保存
        const fromPerson = fromSeat.dataset.person;
        const toPerson = toSeat.dataset.person;
        
        // 両方とも人が設定されていれば交換
        if (fromPerson && toPerson) {
            this.setSeatOccupant(fromSeat, toPerson);
            this.setSeatOccupant(toSeat, fromPerson);
        }
        // 元だけ人が設定されていれば移動
        else if (fromPerson) {
            this.setSeatOccupant(toSeat, fromPerson);
            this.clearSeat(fromSeat);
        }
        // 先だけ人が設定されていれば移動
        else if (toPerson) {
            this.setSeatOccupant(fromSeat, toPerson);
            this.clearSeat(toSeat);
        }
        
        // 配置データを保存
        this.saveAssignments();
    };