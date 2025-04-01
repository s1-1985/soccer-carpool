/**
 * FC尾島ジュニア - 車提供タブの機能
 * 車両提供管理に関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

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
    
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations;
    
    if (!carRegistrations || carRegistrations.length === 0) {
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
        row.insertCell(2).textContent = registration.frontSeat || 0;
        row.insertCell(3).textContent = registration.middleSeat || 0;
        row.insertCell(4).textContent = registration.backSeat || 0;
        
        // 合計座席数
        const totalSeats = (parseInt(registration.frontSeat) || 0) + 
                          (parseInt(registration.middleSeat) || 0) + 
                          (parseInt(registration.backSeat) || 0);
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
        FCOjima.UI.showAlert('保護者名を入力してください');
        console.log('保護者名が未入力です');
        return;
    }
    
    // 既存登録のチェック - 同じ保護者名があれば更新
    const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
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
    const car = carRegistrations[index];
    if (!car) {
        console.log('指定された車両が見つかりません');
        return;
    }
    
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
    
    if (!carRegistrations[index]) {
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