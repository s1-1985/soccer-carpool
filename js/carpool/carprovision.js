/**
 * FC尾島ジュニア - 車提供タブの機能
 * 車両提供管理に関する機能を提供
 */

(function(app) {
    // 名前空間のショートカット
    var CarProvision = app.Carpool.CarProvision;
    var UI = app.UI;
    var Storage = app.Storage;
    
    /**
     * 初期化
     */
    CarProvision.init = function() {
        console.log('車提供機能を初期化しています...');
        
        // 車両リストを表示
        this.updateCarRegistrations();
        
        console.log('車提供機能の初期化が完了しました');
    };
    
    /**
     * 車の登録リストを更新
     */
    CarProvision.updateCarRegistrations = function() {
        console.log('車両登録リストを更新しています...');
        
        var carsTable = document.getElementById('registeredCars');
        if (!carsTable) {
            console.log('車両テーブルが見つかりません');
            return;
        }
        
        var tableBody = carsTable.querySelector('tbody');
        tableBody.innerHTML = '';
        
        var carRegistrations = app.Carpool.appData.carRegistrations || [];
        
        // 参加者数と乗車可能人数の表示を更新
        this.updateCarStats();
        
        if (carRegistrations.length === 0) {
            var row = tableBody.insertRow();
            var cell = row.insertCell();
            cell.colSpan = 8; // 列数に合わせる
            cell.innerHTML = UI.createAlert('info', 'まだ車両提供の登録がありません。');
            console.log('車両登録がありません');
            return;
        }
        
        console.log('車両登録数: ' + carRegistrations.length + '台');
        
        carRegistrations.forEach(function(registration, index) {
            var row = tableBody.insertRow();
            
            // 運転者名
            row.insertCell(0).textContent = registration.parent;
            
            // 車提供の表示
            var provideCell = row.insertCell(1);
            var provideLabels = {
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
            var totalSeats = registration.canDrive === 'no' ? 0 : (
                (parseInt(registration.frontSeat) || 0) + 
                (parseInt(registration.middleSeat) || 0) + 
                (parseInt(registration.backSeat) || 0)
            );
            row.insertCell(5).textContent = totalSeats;
            
            // 備考
            row.insertCell(6).textContent = registration.notes || '';
            
            // 編集と削除ボタン
            var actionsCell = row.insertCell(7);
            actionsCell.innerHTML = '\
                <button type="button" class="secondary-button edit-car" data-index="' + index + '">編集</button>\
                <button type="button" class="delete-button delete-car" data-index="' + index + '">削除</button>';
        });
        
        // 編集と削除ボタンのイベントリスナーを設定
        var editButtons = carsTable.querySelectorAll('.edit-car');
        var deleteButtons = carsTable.querySelectorAll('.delete-car');
        
        editButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                CarProvision.editCarRegistration(parseInt(this.dataset.index));
            });
        });
        
        deleteButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                CarProvision.deleteCarRegistration(parseInt(this.dataset.index));
            });
        });
        
        console.log('車両登録リストの更新が完了しました');
    };