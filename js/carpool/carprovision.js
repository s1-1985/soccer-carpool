/**
 * FC尾島ジュニア - 車提供タブの機能
 * 車両提供管理に関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * 初期化
 */
FCOjima.Carpool.CarProvision.init = function() {
    console.log('車提供機能を初期化しています...');
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    console.log('車提供機能の初期化が完了しました');
};

/**
 * イベントリスナーの設定
 */
FCOjima.Carpool.CarProvision.setupEventListeners = function() {
    // 車提供登録ボタンのイベントリスナー
    const registerCarButton = document.getElementById('register-car');
    if (registerCarButton) {
        registerCarButton.addEventListener('click', () => {
            this.registerCar();
        });
    }
    
    // 車両提供条件変更時のイベントリスナー
    const canDriveSelect = document.getElementById('canDrive');
    if (canDriveSelect) {
        canDriveSelect.addEventListener('change', function() {
            const carDetails = document.getElementById('carDetails');
            if (this.value === 'no') {
                carDetails.style.display = 'none';
            } else {
                carDetails.style.display = 'block';
            }
        });
    }
    
    // メンバーから運転者選択ボタン
    const selectDriverButton = document.getElementById('select-driver');
    if (selectDriverButton) {
        selectDriverButton.addEventListener('click', () => {
            this.openDriverSelectModal();
        });
    }
};

/**
 * 車の登録リストを更新
 */
FCOjima.Carpool.CarProvision.updateCarRegistrations = function() {
    console.log('車両登録リストを更新しています...');
    
    const carsTable = document.getElementById('registeredCars');
    if (!carsTable) {
        console.log('車両テーブルが見つかりません');
        return;
    }
    
    const tableBody = carsTable.querySelector('tbody');
    tableBody.innerHTML = '';
    
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
    
    // 参加者数と乗車可能人数の表示を更新
    this.updateCarStats();
    
    if (carRegistrations.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 8; // 列数に合わせる
        cell.innerHTML = FCOjima.UI.createAlert('info', 'まだ車両提供の登録がありません。');
        console.log('車両登録がありません');
        return;
    }
    
    console.log(`車両登録数: ${carRegistrations.length}台`);
    
    carRegistrations.forEach((registration, index) => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = registration.parent;
        
        // 車提供の表示
        const provideCell = row.insertCell(1);
        const provideLabels = {
            'both': '行き帰り可能',
            'no': '不可',
            'to': '行きのみ可能',
            'from': '帰りのみ可能'
        };
        provideCell.textContent = provideLabels[registration.canDrive] || registration.canDrive;
        
        // 座席数
        row.insertCell(2).textContent = registration.canDrive === 'no' ? '0' : (registration.frontSeat || 0);
        row.insertCell(3).textContent = registration.canDrive === 'no' ? '0' : (registration.middleSeat || 0);
        row.insertCell(4).textContent = registration.canDrive === 'no' ? '0' : (registration.backSeat || 0);
        
        // 合計座席数
        const totalSeats = registration.canDrive === 'no' ? 0 : (
            (parseInt(registration.frontSeat) || 0) + 
            (parseInt(registration.middleSeat) || 0) + 
            (parseInt(registration.backSeat) || 0)
        );
        row.insertCell(5).textContent = totalSeats;
        
        row.insertCell(6).textContent = registration.notes || '';
        
        // 編集と削除ボタン
        const actionsCell = row.insertCell(7);
        actionsCell.innerHTML = `
            <button type="button" class="secondary-button" onclick="FCOjima.Carpool.CarProvision.editCarRegistration(${index})">編集</button>
            <button type="button" class="delete-button" onclick="FCOjima.Carpool.CarProvision.deleteCarRegistration(${index})">削除</button>
        `;
    });
    
    console.log('車両登録リストの更新が完了しました');
};

/**
 * 参加者数と乗車可能人数の統計表示を更新
 */
FCOjima.Carpool.CarProvision.updateCarStats = function() {
    console.log('車両統計を更新しています...');
    
    const carStats = document.getElementById('car-stats');
    if (!carStats) {
        console.log('車両統計表示要素が見つかりません');
        return;
    }
    
    // 参加確定人数を計算
    const attendance = FCOjima.Carpool.appData.attendance || [];
    const confirmedAttendees = attendance.filter(a => a.status === 'present').length;
    
    // 乗車可能人数を計算
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
    let totalSeats = 0;
    
    carRegistrations.forEach(car => {
        if (car.canDrive !== 'no') {
            totalSeats += (parseInt(car.frontSeat) || 0) + 
                         (parseInt(car.middleSeat) || 0) + 
                         (parseInt(car.backSeat) || 0);
        }
    });
    
    // 統計情報を表示
    carStats.innerHTML = `
        <p>当日参加メンバー数: <strong>${confirmedAttendees}人</strong> / 乗車可能人数: <strong>${totalSeats}人</strong></p>
    `;
    
    console.log(`車両統計を更新しました: 参加者=${confirmedAttendees}人, 座席=${totalSeats}席`);
};

/**
 * 車提供登録
 */
FCOjima.Carpool.CarProvision.registerCar = function() {
    console.log('車両情報を登録します...');
    
    const parentName = document.getElementById('parentName').value;
    const canDrive = document.getElementById('canDrive').value;
    const frontSeat = parseInt(document.getElementById('frontSeat').value || 0);
    const middleSeat = parseInt(document.getElementById('middleSeat').value || 0);
    const backSeat = parseInt(document.getElementById('backSeat').value || 0);
    const notes = document.getElementById('notes').value;
    
    // 基本的な入力チェック
    if (!parentName) {
        FCOjima.UI.showAlert('運転者名を入力してください');
        console.log('運転者名が未入力です');
        return;
    }
    
    // 既存登録のチェック - 同じ運転者名があれば更新
    let carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
    const existingIndex = carRegistrations.findIndex(
        reg => reg.parent === parentName
    );
    
    const registration = {
        parent: parentName,
        canDrive: canDrive,
        frontSeat: canDrive === 'no' ? 0 : frontSeat,
        middleSeat: canDrive === 'no' ? 0 : middleSeat,
        backSeat: canDrive === 'no' ? 0 : backSeat,
        notes: notes
    };
    
    if (existingIndex >= 0) {
        carRegistrations[existingIndex] = registration;
        console.log(`既存の車両登録を更新しました: ${parentName}`);
    } else {
        carRegistrations.push(registration);
        console.log(`新しい車両を登録しました: ${parentName}`);
    }
    
    // データ保存とUI更新
    FCOjima.Carpool.appData.carRegistrations = carRegistrations;
    FCOjima.Carpool.saveData();
    this.updateCarRegistrations();
    
    // フォームリセット
    document.getElementById('carForm').reset();
    document.getElementById('frontSeat').value = 1;
    document.getElementById('middleSeat').value = 3;
    document.getElementById('backSeat').value = 0;
    
    FCOjima.UI.showAlert('車両情報を登録しました');
};

/**
 * 車両登録の編集
 * @param {number} index - 車両登録のインデックス
 */
FCOjima.Carpool.CarProvision.editCarRegistration = function(index) {
    console.log(`車両登録を編集します: インデックス=${index}`);
    
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations;
    if (!carRegistrations || !carRegistrations[index]) {
        console.log('指定された車両が見つかりません');
        return;
    }
    
    const car = carRegistrations[index];
    
    // フォームに値を設定
    document.getElementById('parentName').value = car.parent;
    document.getElementById('canDrive').value = car.canDrive;
    document.getElementById('frontSeat').value = car.frontSeat || 0;
    document.getElementById('middleSeat').value = car.middleSeat || 0;
    document.getElementById('backSeat').value = car.backSeat || 0;
    document.getElementById('notes').value = car.notes || '';
    
    // 車両提供条件に応じて詳細フォームの表示/非表示
    const carDetails = document.getElementById('carDetails');
    if (car.canDrive === 'no') {
        carDetails.style.display = 'none';
    } else {
        carDetails.style.display = 'block';
    }
    
    // 該当の車両登録を削除
    carRegistrations.splice(index, 1);
    FCOjima.Carpool.appData.carRegistrations = carRegistrations;
    
    // UIを更新
    this.updateCarRegistrations();
    
    console.log(`車両登録を編集フォームにロードしました: ${car.parent}`);
};

/**
 * 車両登録の削除
 * @param {number} index - 車両登録のインデックス
 */
FCOjima.Carpool.CarProvision.deleteCarRegistration = function(index) {
    console.log(`車両登録を削除します: インデックス=${index}`);
    
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations;
    
    if (!carRegistrations || !carRegistrations[index]) {
        console.log('指定された車両が見つかりません');
        return;
    }
    
    const carName = carRegistrations[index].parent;
    
    if (FCOjima.UI.showConfirm(`「${carName}」の車両登録を削除してもよろしいですか？`)) {
        // 該当の車両登録を削除
        carRegistrations.splice(index, 1);
        FCOjima.Carpool.appData.carRegistrations = carRegistrations;
        
        // データ保存とUI更新
        FCOjima.Carpool.saveData();
        this.updateCarRegistrations();
        
        console.log(`車両登録を削除しました: ${carName}`);
    } else {
        console.log('車両登録の削除がキャンセルされました');
    }
};

/**
 * 運転者選択モーダルを開く
 */
FCOjima.Carpool.CarProvision.openDriverSelectModal = function() {
    console.log('運転者選択モーダルを開きます...');
    
    const driverSelectList = document.getElementById('driver-select-list');
    if (!driverSelectList) {
        console.log('運転者選択リストが見つかりません');
        return;
    }
    
    driverSelectList.innerHTML = '';
    
    // 保護者メンバーを取得
    const members = FCOjima.Carpool.members;
    const parentMembers = members.filter(m => m.role === 'father' || m.role === 'mother');
    
    if (parentMembers.length === 0) {
        driverSelectList.innerHTML = FCOjima.UI.createAlert('info', '保護者として登録されているメンバーがいません。');
        console.log('保護者メンバーがいません');
    } else {
        // 名前順にソート
        const sortedParents = [...parentMembers].sort((a, b) => 
            a.name.localeCompare(b.name, 'ja')
        );
        
        sortedParents.forEach(member => {
            const item = document.createElement('div');
            item.className = 'list-item';
            
            const roleLabel = member.role === 'father' ? '(父)' : '(母)';
            item.textContent = `${member.name} ${roleLabel}`;
            
            item.addEventListener('click', () => {
                document.getElementById('parentName').value = member.name;
                FCOjima.UI.closeModal('driver-select-modal');
            });
            
            driverSelectList.appendChild(item);
        });
    }
    
    // モーダルを表示
    FCOjima.UI.openModal('driver-select-modal');
    
    console.log('運転者選択モーダルを開きました');
};