/**
 * FC尾島ジュニア - 車提供タブ�E機�E�E�続き�E�E
 * 車両提供管琁E��関する機�Eを提侁E
 */

// 名前空間�E確俁E
window.FCOjima = window.FCOjima || {};
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.CarProvision = FCOjima.Carpool.CarProvision || {};

// 車提供モジュール
(function() {
    // 名前空間�EショートカチE��
    const CarProvision = FCOjima.Carpool.CarProvision;
    const UI = FCOjima.UI;

    /**
     * 車提供機�Eの初期匁E
     */
    CarProvision.init = function() {
        console.log('車提供機�Eを�E期化してぁE��ぁE..');
        FCOjima.Carpool.loadMembers();
        FCOjima.Carpool.loadData();
        this.updateEventInfo();
        this.updateCarRegistrations();
        console.log('車提供機�Eの初期化が完亁E��ました');
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
            UI.showAlert('運転老E��を�E力してください');
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
                const provideLabels = { both: '行き帰り可', to: '行きのみ', from: '帰り�Eみ', no: '不可' };

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
     * 運転老E��択モーダルを開ぁE
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
            list.innerHTML = UI.createAlert('info', '選択できるメンバ�Eがいません。�EにHUBでメンバ�Eを登録してください、E);
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
        console.log('運転老E��択モーダルを開きました');
    };

    /**
     * 車両惁E��を削除
     * @param {number} index - 車両インチE��クス
     */
    CarProvision.deleteCarRegistration = function(index) {
        console.log(`車両惁E��を削除しまぁE インチE��クス=${index}`);
        
        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        const car = carRegistrations[index];
        
        if (!car) {
            UI.showAlert('持E��された車両惁E��が見つかりません');
            return;
        }
        
        if (UI.showConfirm(`${car.parent}さんの車両登録を削除してもよろしぁE��すか�E�`)) {
            // 車両登録から削除
            carRegistrations.splice(index, 1);
            
            // チE�Eタを保孁E
            FCOjima.Carpool.appData.carRegistrations = carRegistrations;
            FCOjima.Carpool.saveData();
            
            // リストを更新
            this.updateCarRegistrations();
            
            UI.showAlert(`${car.parent}さんの車両登録を削除しました`);
            console.log(`車両惁E��を削除しました: ${car.parent}`);
        }
    };
    
    /**
     * 車両惁E��をLINEで共朁E
     */
    CarProvision.shareCarInfo = function() {
        console.log('車両惁E��を�E有しまぁE..');
        
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
        
        // メチE��ージを生戁E
        let message = '【車両惁E��】\n';
        message += FCOjima.Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        
        // 車両数と座席数の統訁E
        let totalSeats = 0;
        availableCars.forEach(car => {
            totalSeats += parseInt(car.frontSeat || 0) + 
                         parseInt(car.middleSeat || 0) + 
                         parseInt(car.backSeat || 0);
        });
        
        message += `車両数: ${availableCars.length}台\n`;
        message += `総座席数: ${totalSeats}席\n\n`;
        
        // 車両惁E��の詳細
        message += '【車両一覧】\n';
        availableCars.forEach((car, index) => {
            message += `${index + 1}. ${car.parent}さん\n`;
            
            // 提供タイチE
            const provideLabels = {
                'both': '行き帰り可能',
                'to': '行きのみ可能',
                'from': '帰り�Eみ可能'
            };
            message += `   ${provideLabels[car.canDrive]}\n`;
            
            // 座席数
            const totalCarSeats = parseInt(car.frontSeat || 0) + 
                                 parseInt(car.middleSeat || 0) + 
                                 parseInt(car.backSeat || 0);
            message += `   座席数: ${totalCarSeats}席 (助手席: ${car.frontSeat}, 中刁E ${car.middleSeat}, 後�E: ${car.backSeat})\n`;
            
            // 備老E
            if (car.notes) {
                message += `   備老E ${car.notes}\n`;
            }
            
            message += '\n';
        });
        
        // チE��ストをクリチE�Eボ�Eドにコピ�E
        if (FCOjima.Utils.copyToClipboard(message)) {
            UI.showAlert('車両惁E��をクリチE�Eボ�Eドにコピ�Eしました、EINEなどに貼り付けて共有できます、E);
            
            // LINEでの共有（モバイルのみ�E�E
            if (FCOjima.Utils.shareViaLINE(message)) {
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリチE�Eボ�Eドへのコピ�Eに失敗しました');
        }
        
        console.log('車両惁E��の共有メチE��ージを作�Eしました');
    };
    
    /**
     * 車両提供リクエストメチE��ージを作�E
     */
    CarProvision.createCarRequestMessage = function() {
        console.log('車両提供リクエストメチE��ージを作�EしまぁE..');
        
        const event = FCOjima.Storage.getSelectedEvent();
        const attendance = FCOjima.Carpool.appData.attendance || [];
        
        if (!event) {
            UI.showAlert('イベント情報が見つかりません');
            return;
        }
        
        // 参加人数を集訁E
        const participantCount = attendance.filter(item => item.status === 'present').length;
        
        // メチE��ージを生戁E
        let message = '【車両提供�Eお願い】\n';
        message += FCOjima.Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        
        message += `以下�Eイベント�E車両提供にご協力いただける方を募雁E��てぁE��す、En\n`;
        
        // 雁E��場所と会場
        if (event.meetingPlace) {
            message += `雁E��場所: ${event.meetingPlace}\n`;
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
        
        message += `車両を提供いただける方は、以下�E惁E��をお知らせください、En`;
        message += `・行き�E�帰り／両方\n`;
        message += `・乗車可能人数\n`;
        message += `・備老E��同乗希望老E��ど�E�\n\n`;
        
        message += `ご協力お願いぁE��します。`;
        
        // チE��ストをクリチE�Eボ�Eドにコピ�E
        if (FCOjima.Utils.copyToClipboard(message)) {
            UI.showAlert('車両提供リクエストメチE��ージをクリチE�Eボ�Eドにコピ�Eしました、EINEなどに貼り付けて共有できます、E);
            
            // LINEでの共有（モバイルのみ�E�E
            if (FCOjima.Utils.shareViaLINE(message)) {
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリチE�Eボ�Eドへのコピ�Eに失敗しました');
        }
        
        console.log('車両提供リクエストメチE��ージを作�Eしました');
    };
    
    /**
     * 車両惁E��一括編雁E��ードを開姁E
     */
    CarProvision.startBulkEdit = function() {
        console.log('車両惁E��一括編雁E��ードを開始しまぁE..');
        
        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        if (carRegistrations.length === 0) {
            UI.showAlert('編雁E��る車両惁E��がありません');
            return;
        }
        
        // 編雁E��ーブルを作�Eして表示
        const tableHTML = `
        <div class="bulk-edit-container">
            <h3>車両惁E��一括編雁E/h3>
            <table class="bulk-edit-table">
                <thead>
                    <tr>
                        <th>運転老E/th>
                        <th>提侁E/th>
                        <th>助手席</th>
                        <th>中刁E/th>
                        <th>後�E</th>
                        <th>備老E/th>
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
                                <option value="from" ${car.canDrive === 'from' ? 'selected' : ''}>帰り�Eみ可能</option>
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
                <button id="save-bulk-edit" class="primary-button">保孁E/button>
                <button id="cancel-bulk-edit" class="secondary-button">キャンセル</button>
            </div>
        </div>
        `;
        
        const bulkEditContainer = document.createElement('div');
        bulkEditContainer.className = 'bulk-edit-overlay';
        bulkEditContainer.innerHTML = tableHTML;
        document.body.appendChild(bulkEditContainer);
        
        // イベントリスナ�Eを設宁E
        const saveButton = document.getElementById('save-bulk-edit');
        const cancelButton = document.getElementById('cancel-bulk-edit');
        
        saveButton.addEventListener('click', function() {
            CarProvision.saveBulkEdit();
        });
        
        cancelButton.addEventListener('click', function() {
            CarProvision.cancelBulkEdit();
        });
        
        console.log('車両惁E��一括編雁E��ードを開始しました');
    };
    
    /**
     * 車両惁E��一括編雁E��保孁E
     */
    CarProvision.saveBulkEdit = function() {
        console.log('車両惁E��一括編雁E��保存しまぁE..');
        
        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        
        // 編雁E��ィールドから値を取得して更新
        const inputs = document.querySelectorAll('.bulk-edit-table input, .bulk-edit-table select');
        inputs.forEach(input => {
            const index = parseInt(input.dataset.index);
            const field = input.dataset.field;
            
            if (index >= 0 && index < carRegistrations.length && field) {
                carRegistrations[index][field] = input.value;
            }
        });
        
        // チE�Eタを保孁E
        FCOjima.Carpool.appData.carRegistrations = carRegistrations;
        FCOjima.Carpool.saveData();
        
        // 一括編雁E��ードを終亁E
        this.cancelBulkEdit();
        
        // リストを更新
        this.updateCarRegistrations();
        
        UI.showAlert('車両惁E��を一括更新しました');
        console.log('車両惁E��一括編雁E��保存しました');
    };
    
    /**
     * 車両惁E��一括編雁E��キャンセル
     */
    CarProvision.cancelBulkEdit = function() {
        console.log('車両惁E��一括編雁E��キャンセルしまぁE..');
        
        // 一括編雁E��ンチE��を削除
        const bulkEditContainer = document.querySelector('.bulk-edit-overlay');
        if (bulkEditContainer) {
            document.body.removeChild(bulkEditContainer);
        }
        
        console.log('車両惁E��一括編雁E��キャンセルしました');
    };
})();
