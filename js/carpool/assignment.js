/**
 * FC尾島ジュニア - 割り当てタブの機能
 * 乗車割り当てに関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * 割り当て一覧を更新
 */
FCOjima.Carpool.Assignment.updateAssignments = function() {
    console.log('割り当て一覧を更新しています...');
    
    const carsContainer = document.getElementById('cars-container');
    if (!carsContainer) {
        console.log('車両コンテナが見つかりません');
        return;
    }
    
    carsContainer.innerHTML = '';
    
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations;
    
    if (!carRegistrations || carRegistrations.length === 0) {
        carsContainer.innerHTML = FCOjima.UI.createAlert('info', '車両登録がありません。「車提供」タブで車両を登録してください。');
        console.log('車両登録がありません');
        return;
    }
    
    // 車両提供者のみフィルタリング
    const availableCars = carRegistrations.filter(car => car.canDrive !== 'no');
    
    if (availableCars.length === 0) {
        carsContainer.innerHTML = FCOjima.UI.createAlert('info', '車両提供可能な登録がありません。');
        console.log('車両提供可能な登録がありません');
        return;
    }
    
    console.log(`利用可能な車両数: ${availableCars.length}台`);
    
    // 既存の配置データを取得
    const existingAssignments = FCOjima.Carpool.appData.assignments || [];
    
    // 車両ごとに配置レイアウトを作成
    availableCars.forEach((car, carIndex) => {
        const carLayout = document.createElement('div');
        carLayout.className = 'car-layout';
        carLayout.dataset.carIndex = carIndex;
        
        // 車両ヘッダー作成
        const carHeader = document.createElement('div');
        carHeader.className = 'car-header';
        carHeader.textContent = `${car.parent}`;
        carHeader.addEventListener('click', () => {
            this.editCarDriver(carIndex);
        });
        carLayout.appendChild(carHeader);
        
        // 車両座席レイアウト作成
        const seatsLayout = document.createElement('div');
        seatsLayout.className = 'car-seats';
        
        // 運転手の座席
        const driverSeat = document.createElement('div');
        driverSeat.className = 'seat driver';
        driverSeat.textContent = '運転手';
        driverSeat.dataset.seatType = 'driver';
        driverSeat.dataset.carIndex = carIndex;
        driverSeat.dataset.person = car.parent;
        driverSeat.title = "ドライバー: " + car.parent;
        seatsLayout.appendChild(driverSeat);
        
        // 助手席
        for (let i = 0; i < car.frontSeat; i++) {
            this.createSeat(seatsLayout, carIndex, '助手席', i);
        }
        
        // 中列席
        for (let i = 0; i < car.middleSeat; i++) {
            this.createSeat(seatsLayout, carIndex, '中列', i);
        }
        
        // 後列席
        for (let i = 0; i < car.backSeat; i++) {
            this.createSeat(seatsLayout, carIndex, '後列', i);
        }
        
        carLayout.appendChild(seatsLayout);
        carsContainer.appendChild(carLayout);
    });
    
    // 既存の配置データを反映
    existingAssignments.forEach(assignment => {
        const carIndex = assignment.carIndex;
        const seats = assignment.seats;
        
        if (seats) {
            Object.keys(seats).forEach(seatType => {
                const seatIndices = Object.keys(seats[seatType]);
                
                seatIndices.forEach(seatIndex => {
                    const person = seats[seatType][seatIndex];
                    if (person) {
                        const seat = document.querySelector(`.seat[data-car-index="${carIndex}"][data-seat-type="${seatType}"][data-seat-index="${seatIndex}"]`);
                        if (seat) {
                            seat.textContent = person;
                            seat.classList.add('filled');
                            seat.dataset.person = person;
                        }
                    }
                });
            });
        }
    });
    
    // メンバーリストを更新
    this.updateMembersList();
    
    // ドラッグ＆ドロップのセットアップ
    this.setupDragAndDrop();
    
    console.log('割り当て一覧の更新が完了しました');
};

/**
 * 座席を作成
 * @param {HTMLElement} container - 追加先コンテナ
 * @param {number} carIndex - 車両インデックス
 * @param {string} seatType - 座席タイプ（助手席/中列/後列）
 * @param {number} seatIndex - 座席インデックス
 */
FCOjima.Carpool.Assignment.createSeat = function(container, carIndex, seatType, seatIndex) {
    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.textContent = `${seatType} ${seatIndex + 1}`;
    seat.dataset.seatType = seatType;
    seat.dataset.seatIndex = seatIndex;
    seat.dataset.carIndex = carIndex;
    
    // 座席クリック時の処理
    seat.addEventListener('click', () => {
        this.openSeatEditModal(seat);
    });
    
    container.appendChild(seat);
};

/**
 * メンバーリストを更新
 */
FCOjima.Carpool.Assignment.updateMembersList = function() {
    console.log('メンバーリストを更新しています...');
    
    const membersContainer = document.getElementById('members-container');
    if (!membersContainer) {
        console.log('メンバーコンテナが見つかりません');
        return;
    }
    
    membersContainer.innerHTML = '';
    
    // イベントの対象学年を取得
    const event = FCOjima.Storage.getSelectedEvent();
    let targetGrades = [];
    
    if (event && event.target && event.target.length > 0) {
        targetGrades = event.target;
        console.log(`対象学年: ${targetGrades.join(', ')}`);
    } else {
        console.log('対象学年が指定されていません');
    }
    
    // 対象学年のメンバーと監督・コーチをフィルタリング
    let filteredMembers = [];
    const members = FCOjima.Carpool.members;
    
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
    const attendance = FCOjima.Carpool.appData.attendance;
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
        membersContainer.innerHTML = FCOjima.UI.createAlert('info', '配置可能なメンバーがいません。');
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
        membersContainer.appendChild(groupHeader);
        
        const membersList = document.createElement('div');
        membersList.className = 'members-list';
        
        group.members.forEach(member => {
            const memberItem = document.createElement('div');
            memberItem.className = 'member-item';
            memberItem.textContent = member.name;
            memberItem.dataset.memberId = member.id;
            memberItem.dataset.name = member.name;
            
            // ドラッグ＆ドロップ用の属性
            memberItem.draggable = true;
            memberItem.addEventListener('dragstart', this.handleDragStart);
            
            membersList.appendChild(memberItem);
        });
        
        membersContainer.appendChild(membersList);
    });
    
    console.log('メンバーリストの更新が完了しました');
};

/**
 * ドラッグ開始ハンドラ
 * @param {DragEvent} e - ドラッグイベント
 */
FCOjima.Carpool.Assignment.handleDragStart = function(e) {
    // データ転送オブジェクトにメンバー名を設定
    e.dataTransfer.setData('text/plain', e.target.dataset.name);
    e.dataTransfer.effectAllowed = 'move';
};

/**
 * ドラッグ＆ドロップのセットアップ
 */
FCOjima.Carpool.Assignment.setupDragAndDrop = function() {
    console.log('ドラッグ＆ドロップをセットアップします...');
    
    // 全ての座席要素に対してイベントリスナーを設定
    const seats = document.querySelectorAll('.seat:not(.driver)');
    
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
            
            const memberName = e.dataTransfer.getData('text/plain');
            
            // 既に人が配置されている場合は入れ替え
            const currentPerson = this.dataset.person;
            
            // 座席に人を配置
            this.textContent = memberName;
            this.classList.add('filled');
            this.dataset.person = memberName;
            
            // 配置された人をリストから削除
            FCOjima.Carpool.Assignment.updateMembersList();
            
            // 配置データを保存
            FCOjima.Carpool.Assignment.saveAssignments();
        });
    });
    
    console.log('ドラッグ＆ドロップのセットアップが完了しました');
};

/**
 * 座席編集モーダルを開く
 * @param {HTMLElement} seat - 座席要素
 */
FCOjima.Carpool.Assignment.openSeatEditModal = function(seat) {
    console.log('座席編集モーダルを開きます...');
    
    const seatEditModal = document.getElementById('seat-edit-modal');
    if (!seatEditModal) {
        console.log('座席編集モーダルが見つかりません');
        return;
    }
    
    // 現在選択されている座席の情報を保存
    const seatEditForm = document.getElementById('seat-edit-form');
    seatEditForm.dataset.carIndex = seat.dataset.carIndex;
    seatEditForm.dataset.seatType = seat.dataset.seatType;
    seatEditForm.dataset.seatIndex = seat.dataset.seatIndex;
    
    // 現在の乗車メンバーを表示
    const seatPerson = document.getElementById('seat-person');
    seatPerson.value = seat.dataset.person || '';
    
    // モーダルを表示
    FCOjima.UI.openModal('seat-edit-modal');
    
    console.log(`座席編集モーダルを開きました: 車両=${seat.dataset.carIndex}, 座席=${seat.dataset.seatType} ${parseInt(seat.dataset.seatIndex) + 1}`);
};

/**
 * 座席編集を保存
 */
FCOjima.Carpool.Assignment.saveSeatEdit = function() {
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
            seat.textContent = person;
            seat.classList.add('filled');
            seat.dataset.person = person;
            console.log(`座席に乗車メンバーを設定しました: ${person}`);
        } else {
            // 座席をクリア
            seat.textContent = `${seatType} ${parseInt(seatIndex) + 1}`;
            seat.classList.remove('filled');
            delete seat.dataset.person;
            console.log('座席をクリアしました');
        }
    } else {
        console.log('対象の座席要素が見つかりません');
    }
    
    // モーダルを閉じる
    FCOjima.UI.closeModal('seat-edit-modal');
    
    // 配置データを保存
    this.saveAssignments();
    
    // メンバーリストを更新
    this.updateMembersList();
    
    console.log('座席編集を保存しました');
};

/**
 * 選択した座席をクリア
 */
FCOjima.Carpool.Assignment.clearSelectedSeat = function() {
    console.log('選択した座席をクリアします...');
    
    const seatEditForm = document.getElementById('seat-edit-form');
    const carIndex = seatEditForm.dataset.carIndex;
    const seatType = seatEditForm.dataset.seatType;
    const seatIndex = seatEditForm.dataset.seatIndex;
    
    // 対象の座席要素を取得
    const seat = document.querySelector(`.seat[data-car-index="${carIndex}"][data-seat-type="${seatType}"][data-seat-index="${seatIndex}"]`);
    
    if (seat) {
        // 座席をクリア
        seat.textContent = `${seatType} ${parseInt(seatIndex) + 1}`;
        seat.classList.remove('filled');
        delete seat.dataset.person;
        console.log('座席をクリアしました');
    } else {
        console.log('対象の座席要素が見つかりません');
    }
    
    // モーダルを閉じる
    FCOjima.UI.closeModal('seat-edit-modal');
    
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
FCOjima.Carpool.Assignment.editCarDriver = function(carIndex) {
    console.log(`車のドライバーを編集します: インデックス=${carIndex}`);
    
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations;
    const car = carRegistrations[carIndex];
    if (!car) {
        console.log('指定された車両が見つかりません');
        return;
    }
    
    const newDriver = FCOjima.UI.showPrompt('ドライバー名を入力してください', car.parent);
    
    if (newDriver && newDriver !== car.parent) {
        // ドライバー名を更新
        car.parent = newDriver;
        
        // 運転手の座席表示も更新
        const driverSeat = document.querySelector(`.seat.driver[data-car-index="${carIndex}"]`);
        if (driverSeat) {
            driverSeat.dataset.person = newDriver;
        }
        
        // データを保存
        FCOjima.Carpool.saveData();
        
        // UIを更新
        FCOjima.Carpool.CarProvision.updateCarRegistrations();
        this.updateAssignments();
        
        console.log(`ドライバーを更新しました: ${newDriver}`);
    } else {
        console.log('ドライバーの変更がキャンセルされました');
    }
};

/**
 * ランダム割り当て生成
 */
FCOjima.Carpool.Assignment.generateRandomAssignments = function() {
    console.log('ランダム割り当てを生成します...');
    
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations;
    
    if (!carRegistrations || carRegistrations.length === 0) {
        FCOjima.UI.showAlert('この予定には車両登録がありません');
        console.log('車両登録がありません');
        return;
    }
    
    // 運転可能な保護者リスト
    const drivers = carRegistrations.filter(reg => reg.canDrive !== 'no');
    
    if (drivers.length === 0) {
        FCOjima.UI.showAlert('運転可能な保護者がいません');
        console.log('運転可能な保護者がいません');
        return;
    }
    
    // 出欠で参加確定している選手
    const attendance = FCOjima.Carpool.appData.attendance;
    const presentPlayers = [];
    
    if (attendance && attendance.length > 0) {
        attendance
            .filter(a => a.status === 'present')
            .forEach(a => {
                const player = FCOjima.Carpool.members.find(m => m.name === a.name && m.role === 'player');
                if (player) {
                    presentPlayers.push(player.name);
                }
            });
    }
    
    console.log(`参加確定している選手数: ${presentPlayers.length}人`);
    
    // 参加確定している選手がいない場合は全選手を対象にする
    let targetPlayers = presentPlayers;
    if (targetPlayers.length === 0) {
        targetPlayers = FCOjima.Carpool.members
            .filter(m => m.role === 'player')
            .map(m => m.name);
        console.log(`全選手数: ${targetPlayers.length}人`);
    }
    
    // 監督・コーチのリスト
    const staffMembers = FCOjima.Carpool.members
        .filter(m => m.role === 'coach' || m.role === 'assist')
        .map(m => m.name);
    
    console.log(`監督・コーチ数: ${staffMembers.length}人`);
    
    // 割り当てリセット
    FCOjima.Carpool.appData.assignments = [];
    
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
        availableSeats = FCOjima.Utils.shuffleArray(availableSeats);
        
        // 選手を割り当て（同じ学年でまとめる）
        const playersByGrade = {};
        targetPlayers.forEach(player => {
            const memberInfo = FCOjima.Carpool.members.find(m => m.name === player);
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
            const shuffledGradePlayers = FCOjima.Utils.shuffleArray([...gradePlayers]);
            
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
        FCOjima.Carpool.appData.assignments.push({
            carIndex,
            driver: driverName,
            seats
        });
    });
    
    // データ保存とUI更新
    FCOjima.Carpool.saveData();
    this.updateAssignments();
    
    // 割り当てられなかった選手がいれば通知
    if (targetPlayers.length > 0) {
        FCOjima.UI.showAlert(`注意: ${targetPlayers.length}名のメンバーに乗車スペースがありません。必要に応じて手動で調整してください。`);
        console.log(`未割り当てのメンバー: ${targetPlayers.length}人`);
    } else {
        FCOjima.UI.showAlert('乗車割り当てが完了しました！');
        console.log('すべてのメンバーの割り当てが完了しました');
    }
};

/**
 * 割り当て結果の保存
 */
FCOjima.Carpool.Assignment.saveAssignments = function() {
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
        const seatElements = carLayout.querySelectorAll('.seat:not(.driver)');
        seatElements.forEach(seat => {
            const seatType = seat.dataset.seatType;
            const seatIndex = seat.dataset.seatIndex;
            const person = seat.dataset.person;
            
            if (person) {
                seats[seatType][seatIndex] = person;
            }
        });
        
        // 運転手を取得
        const driverSeat = carLayout.querySelector('.seat.driver');
        const driver = driverSeat ? driverSeat.dataset.person : '';
        
        assignments.push({
            carIndex,
            driver,
            seats
        });
    });
    
    // 割り当て結果を保存
    FCOjima.Carpool.appData.assignments = assignments;
    
    // データ保存
    FCOjima.Carpool.saveData();
    
    console.log(`割り当て結果を保存しました: ${assignments.length}台`);
    FCOjima.UI.showAlert('割り当て情報を保存しました');
};

/**
 * 割り当て結果の共有
 */
FCOjima.Carpool.Assignment.shareAssignments = function() {
    console.log('割り当て結果を共有します...');
    
    // 割り当て結果をテキスト形式で生成
    let message = '【乗車割り当て】\n';
    
    // イベント情報を取得
    const event = FCOjima.Storage.getSelectedEvent();
    if (event) {
        message += `${FCOjima.Utils.formatDateForDisplay(event.date)} ${event.title}\n\n`;
    }
    
    const assignments = FCOjima.Carpool.appData.assignments;
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations;
    
    if (assignments && assignments.length > 0) {
        assignments.forEach((assignment, index) => {
            const car = carRegistrations[assignment.carIndex];
            message += `■ ${assignment.driver}の車\n
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
    
    // テキストをクリップボードにコピー
    if (FCOjima.Utils.copyToClipboard(message)) {
        FCOjima.UI.showAlert('配車情報をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
        
        // LINEでの共有（モバイルのみ）
        if (FCOjima.Utils.shareViaLINE(message)) {
            FCOjima.UI.showAlert('LINEでの共有を開始しました');
        }
    } else {
        FCOjima.UI.showAlert('クリップボードへのコピーに失敗しました');
    }
    
    console.log('割り当て結果の共有が完了しました');
};