/**
 * FC尾島ジュニア - 車提供タブの機能（続き）
 * 車両提供管理に関する機能を提供
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.CarProvision = FCOjima.Carpool.CarProvision || {};

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
        FCOjima.Carpool.members = FCOjima.Carpool.members || FCOjima.Storage.loadMembers();
        this.setupEventListeners();
        this.updateCarRegistrations();
        console.log('車提供機能の初期化が完了しました');
    };

    /**
     * イベントリスナーの設定
     */
    CarProvision.setupEventListeners = function() {
        var registerBtn = document.getElementById('register-car');
        if (registerBtn) {
            registerBtn.addEventListener('click', function() { CarProvision.registerCar(); });
        }
        var selectDriverBtn = document.getElementById('select-driver');
        if (selectDriverBtn) {
            selectDriverBtn.addEventListener('click', function() { CarProvision.openDriverSelectModal(); });
        }
        // 車提供条件変更
        var canDriveSelect = document.getElementById('canDrive');
        if (canDriveSelect) {
            canDriveSelect.addEventListener('change', function() {
                var carDetails = document.getElementById('carDetails');
                if (carDetails) carDetails.style.display = (this.value === 'no') ? 'none' : 'block';
            });
        }
    };

    /**
     * 車両を登録
     */
    CarProvision.registerCar = function() {
        console.log('車両を登録します...');
        var parentName = document.getElementById('parentName') ? document.getElementById('parentName').value.trim() : '';
        var canDrive = document.getElementById('canDrive') ? document.getElementById('canDrive').value : 'both';
        var frontSeat = document.getElementById('frontSeat') ? parseInt(document.getElementById('frontSeat').value) || 0 : 0;
        var middleSeat = document.getElementById('middleSeat') ? parseInt(document.getElementById('middleSeat').value) || 0 : 0;
        var backSeat = document.getElementById('backSeat') ? parseInt(document.getElementById('backSeat').value) || 0 : 0;
        var notes = document.getElementById('carNotes') ? document.getElementById('carNotes').value.trim() : '';

        if (!parentName) {
            UI.showAlert('運転者名を入力してください');
            return;
        }

        var carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];

        // 同じ運転者の既存登録を上書き
        var existingIndex = carRegistrations.findIndex(function(c) { return c.parent === parentName; });
        var newEntry = { parent: parentName, canDrive: canDrive, frontSeat: frontSeat, middleSeat: middleSeat, backSeat: backSeat, notes: notes };

        if (existingIndex !== -1) {
            carRegistrations[existingIndex] = newEntry;
        } else {
            carRegistrations.push(newEntry);
        }

        FCOjima.Carpool.appData.carRegistrations = carRegistrations;
        FCOjima.Carpool.saveData();
        this.updateCarRegistrations();

        // フォームリセット
        if (document.getElementById('parentName')) document.getElementById('parentName').value = '';
        if (document.getElementById('canDrive')) document.getElementById('canDrive').value = 'both';
        if (document.getElementById('frontSeat')) document.getElementById('frontSeat').value = '1';
        if (document.getElementById('middleSeat')) document.getElementById('middleSeat').value = '3';
        if (document.getElementById('backSeat')) document.getElementById('backSeat').value = '0';
        if (document.getElementById('carNotes')) document.getElementById('carNotes').value = '';
        var carDetails = document.getElementById('carDetails');
        if (carDetails) carDetails.style.display = 'block';

        UI.showAlert('車両を登録しました');
        console.log('車両を登録しました: ' + parentName);
    };

    /**
     * 登録済み車両リストを描画
     */
    CarProvision.updateCarRegistrations = function() {
        console.log('登録済み車両リストを更新します...');
        var carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];

        // 統計
        var statsEl = document.getElementById('car-stats');
        if (statsEl) {
            var available = carRegistrations.filter(function(c) { return c.canDrive !== 'no'; });
            var totalSeats = available.reduce(function(sum, c) {
                return sum + (parseInt(c.frontSeat) || 0) + (parseInt(c.middleSeat) || 0) + (parseInt(c.backSeat) || 0);
            }, 0);
            statsEl.innerHTML = '<div class="stats-row">' +
                '<span class="stat">登録台数: ' + carRegistrations.length + '台</span>' +
                '<span class="stat">提供可能: ' + available.length + '台</span>' +
                '<span class="stat">総座席数: ' + totalSeats + '席</span>' +
                '</div>';
        }

        // テーブル
        var tbody = document.querySelector('#registeredCars tbody');
        if (!tbody) return;

        if (carRegistrations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-table-message">登録された車両はありません</td></tr>';
            return;
        }

        var provideLabels = { 'both': '行き帰り', 'to': '行きのみ', 'from': '帰りのみ', 'no': '不可' };
        tbody.innerHTML = carRegistrations.map(function(car, idx) {
            var total = (parseInt(car.frontSeat) || 0) + (parseInt(car.middleSeat) || 0) + (parseInt(car.backSeat) || 0);
            return '<tr>' +
                '<td>' + UI.escapeHTML(car.parent) + '</td>' +
                '<td>' + (provideLabels[car.canDrive] || car.canDrive) + '</td>' +
                '<td>' + (car.canDrive !== 'no' ? car.frontSeat : '-') + '</td>' +
                '<td>' + (car.canDrive !== 'no' ? car.middleSeat : '-') + '</td>' +
                '<td>' + (car.canDrive !== 'no' ? car.backSeat : '-') + '</td>' +
                '<td>' + (car.canDrive !== 'no' ? total : '-') + '</td>' +
                '<td>' + UI.escapeHTML(car.notes || '') + '</td>' +
                '<td><button type="button" class="delete-button delete-car" data-index="' + idx + '">削除</button></td>' +
            '</tr>';
        }).join('');

        tbody.querySelectorAll('.delete-car').forEach(function(btn) {
            btn.addEventListener('click', function() {
                CarProvision.deleteCarRegistration(parseInt(btn.dataset.index));
            });
        });

        console.log('登録済み車両リストの更新が完了しました');
    };

    /**
     * 運転者選択モーダルを開く
     */
    CarProvision.openDriverSelectModal = function() {
        console.log('運転者選択モーダルを開きます...');
        var selectList = document.getElementById('driver-select-list');
        if (!selectList) return;
        selectList.innerHTML = '';

        var members = FCOjima.Carpool.members || [];
        var parents = members.filter(function(m) {
            return m.role === 'father' || m.role === 'mother' || m.role === 'coach' || m.role === 'assist';
        });

        if (parents.length === 0) {
            selectList.innerHTML = UI.createAlert('info', '登録されている保護者・スタッフがいません');
        } else {
            parents.forEach(function(member) {
                var item = document.createElement('div');
                item.className = 'list-item';
                item.textContent = member.name;
                item.addEventListener('click', function() {
                    var parentNameEl = document.getElementById('parentName');
                    if (parentNameEl) parentNameEl.value = member.name;
                    UI.closeModal('driver-select-modal');
                });
                selectList.appendChild(item);
            });
        }

        UI.openModal('driver-select-modal');
        console.log('運転者選択モーダルを開きました');
    };

    /**
     * 車両情報を削除（続き）
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
        }
    };
    
    /**
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