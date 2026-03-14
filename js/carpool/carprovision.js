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
    CarProvision.init = async function() {
        console.log('車提供機能を初期化しています...');

        // メンバーをロード（Firestore優先 → localStorageフォールバック）
        if (window.FCOjima && FCOjima.DB && FCOjima.DB.loadMembers) {
            try {
                FCOjima.Carpool.members = await FCOjima.DB.loadMembers();
                console.log('メンバーをFirestoreからロードしました: ' + FCOjima.Carpool.members.length + '人');
            } catch (e) {
                console.warn('Firestoreメンバーロード失敗、localStorageにフォールバック:', e);
                FCOjima.Carpool.loadMembers();
            }
        } else {
            FCOjima.Carpool.loadMembers();
        }

        // イベントデータをロード（Firestore優先 → localStorageフォールバック）
        const event = FCOjima.Storage.getSelectedEvent();
        if (event) {
            FCOjima.Carpool.appData.eventId = event.id;
            let firestoreLoaded = false;
            if (window.FCOjima && FCOjima.DB && FCOjima.DB.loadEventData) {
                try {
                    const data = await FCOjima.DB.loadEventData(event.id);
                    if (data) {
                        FCOjima.Carpool.appData.carRegistrations = data.carRegistrations || [];
                        FCOjima.Carpool.appData.assignments     = data.assignments     || [];
                        FCOjima.Carpool.appData.attendance      = data.attendance      || [];
                        FCOjima.Carpool.appData.notifications   = data.notifications   || [];
                        firestoreLoaded = true;
                        console.log('イベントデータをFirestoreからロードしました: 車両=' + FCOjima.Carpool.appData.carRegistrations.length + '台');
                    }
                } catch (e) {
                    console.warn('Firestoreイベントデータロード失敗:', e);
                }
            }
            if (!firestoreLoaded) {
                FCOjima.Carpool.loadData();
                console.log('localStorageからイベントデータをロードしました');
            }
        }

        this.updateEventInfo();
        this.updateCarRegistrations();
        this.initExtraPassengerUI();
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

        // メンバー外乗員を収集
        var extraPassengers = [];
        var epInputs = document.querySelectorAll('.ep-confirmed-name');
        epInputs.forEach(function(el) {
            var name = el.dataset.name;
            if (name) extraPassengers.push({ name: name });
        });

        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        carRegistrations.push({ parent: parentName, canDrive, frontSeat, middleSeat, backSeat, notes, extraPassengers: extraPassengers });
        FCOjima.Carpool.appData.carRegistrations = carRegistrations;
        FCOjima.Carpool.saveData();

        // フォームをクリア
        document.getElementById('parentName').value  = '';
        document.getElementById('canDrive').value    = 'both';
        document.getElementById('frontSeat').value   = '1';
        document.getElementById('middleSeat').value  = '3';
        document.getElementById('backSeat').value    = '0';
        document.getElementById('carNotes').value    = '';
        CarProvision.resetExtraPassengerInputs();
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
        const provideLabels = { both: '往復', to: '行き', from: '帰り', no: '不可' };
        const provideClass  = { both: 'both', to: 'to', from: 'from', no: 'no' };

        // テーブル（デスクトップ）
        if (tbody) {
            if (carRegistrations.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-table-message">登録された車両はありません</td></tr>';
            } else {
                tbody.innerHTML = '';
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

        // カードリスト（モバイル）
        var tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            var existingCards = tableContainer.querySelector('.car-card-list');
            if (existingCards) existingCards.remove();

            var cardList = document.createElement('div');
            cardList.className = 'car-card-list';

            if (carRegistrations.length === 0) {
                var empty = document.createElement('p');
                empty.style.cssText = 'text-align:center;color:#999;padding:16px 0;';
                empty.textContent = '登録された車両はありません';
                cardList.appendChild(empty);
            } else {
                carRegistrations.forEach(function(car, index) {
                    const total = (parseInt(car.frontSeat) || 0) +
                                  (parseInt(car.middleSeat) || 0) +
                                  (parseInt(car.backSeat) || 0);
                    const label = provideLabels[car.canDrive] || car.canDrive;
                    const cls   = provideClass[car.canDrive]  || '';
                    var card = document.createElement('div');
                    card.className = 'car-card';
                    card.innerHTML =
                        '<div class="car-card-header">' +
                            '<span class="car-card-name">' + UI.escapeHTML(car.parent) + '</span>' +
                            '<span class="car-card-badge ' + cls + '">' + label + '</span>' +
                        '</div>' +
                        '<div class="car-card-seats">助手席 ' + (car.frontSeat || 0) + ' ＋ 中列 ' + (car.middleSeat || 0) + ' ＋ 後列 ' + (car.backSeat || 0) + ' ＝ 合計 <strong>' + total + '</strong> 席</div>' +
                        (car.notes ? '<div class="car-card-notes">📝 ' + UI.escapeHTML(car.notes) + '</div>' : '') +
                        ((car.extraPassengers && car.extraPassengers.length > 0) ?
                            '<div class="car-card-notes">👤 メンバー外: ' + car.extraPassengers.map(function(ep) { return UI.escapeHTML(ep.name); }).join('、') + '</div>' : '') +
                        '<button type="button" class="car-card-delete" onclick="FCOjima.Carpool.CarProvision.deleteCarRegistration(' + index + ')">削除</button>';
                    cardList.appendChild(card);
                });
            }
            tableContainer.appendChild(cardList);
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
            const presentCount = (FCOjima.Carpool.appData.attendance || [])
                .filter(function(a) { return a.status === 'present'; }).length;
            const requiredSeatsLabel = presentCount > 0 ? ' / 必要 ' + presentCount + '席' : '';
            statsDiv.innerHTML =
                '<div class="stat-item"><span class="stat-label">車両数</span><span class="stat-value">' + carRegistrations.length + '台</span></div>' +
                '<div class="stat-item"><span class="stat-label">提供可能</span><span class="stat-value">' + available.length + '台</span></div>' +
                '<div class="stat-item"><span class="stat-label">総座席数</span><span class="stat-value">' + totalSeats + '席' + requiredSeatsLabel + '</span></div>';
        }
    };

    /**
     * 運転者選択モーダルを開く
     */
    CarProvision.openDriverSelectModal = function() {
        const list = document.getElementById('driver-select-list');
        if (!list) return;

        const members = FCOjima.Carpool.members;
        // 保護者（父・母・役員）を名前順で先に、監督・コーチを最後に表示
        const parents = members.filter(function(m) {
            return m.role === 'father' || m.role === 'mother' || m.role === 'officer';
        }).sort(function(a, b) { return (a.name || '').localeCompare(b.name || '', 'ja'); });
        const staff = members.filter(function(m) {
            return m.role === 'coach' || m.role === 'assist';
        }).sort(function(a, b) { return (a.name || '').localeCompare(b.name || '', 'ja'); });
        const candidates = parents.concat(staff);

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
        
        // イベントリスナーを設定（once:true で重複実行を防止）
        const saveButton = document.getElementById('save-bulk-edit');
        const cancelButton = document.getElementById('cancel-bulk-edit');

        if (saveButton) {
            saveButton.addEventListener('click', function() {
                CarProvision.saveBulkEdit();
            }, { once: true });
        }

        if (cancelButton) {
            cancelButton.addEventListener('click', function() {
                CarProvision.cancelBulkEdit();
            }, { once: true });
        }
        
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
            const index = parseInt(input.dataset.index, 10);
            const field = input.dataset.field;

            if (!isNaN(index) && index >= 0 && index < carRegistrations.length && field) {
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
        const bulkEditContainer = document.querySelector('.bulk-edit-overlay');
        if (bulkEditContainer) document.body.removeChild(bulkEditContainer);
        console.log('車両情報一括編集をキャンセルしました');
    };

    // =============================================
    // メンバー外乗員 UI
    // =============================================

    CarProvision.initExtraPassengerUI = function() {
        var group = document.getElementById('extra-passenger-group');
        if (!group) return;

        // 座席数変更時に再描画
        ['frontSeat', 'middleSeat', 'backSeat'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', function() {
                CarProvision.refreshExtraPassengerInputs();
            });
        });

        this.refreshExtraPassengerInputs();
    };

    /** 総座席数を返す（運転席除く） */
    CarProvision._getTotalSeats = function() {
        var f = parseInt((document.getElementById('frontSeat') || {}).value) || 0;
        var m = parseInt((document.getElementById('middleSeat') || {}).value) || 0;
        var b = parseInt((document.getElementById('backSeat') || {}).value) || 0;
        return f + m + b;
    };

    /** 現在確定済みメンバー外乗員の数を返す */
    CarProvision._getConfirmedCount = function() {
        return document.querySelectorAll('.ep-confirmed-name').length;
    };

    /** メンバー外乗員の入力欄を再描画 */
    CarProvision.refreshExtraPassengerInputs = function() {
        var group = document.getElementById('extra-passenger-group');
        var container = document.getElementById('extra-passenger-inputs');
        if (!container) return;

        var totalSeats = CarProvision._getTotalSeats();
        // 座席がない場合は非表示
        if (totalSeats === 0) { group.style.display = 'none'; return; }
        group.style.display = '';

        var confirmed = CarProvision._getConfirmedCount();

        // 超過分の確定行を除去
        var confirmedRows = container.querySelectorAll('.ep-row.ep-done');
        confirmedRows.forEach(function(row, i) {
            if (i >= totalSeats) row.remove();
        });

        // 空の入力欄が既にあれば何もしない（または席が満杯なら消す）
        var emptyRow = container.querySelector('.ep-row:not(.ep-done)');
        confirmed = CarProvision._getConfirmedCount();
        if (confirmed >= totalSeats) {
            if (emptyRow) emptyRow.remove();
            return;
        }
        if (!emptyRow) CarProvision._addEmptyEpRow(container);
    };

    CarProvision._addEmptyEpRow = function(container) {
        var row = document.createElement('div');
        row.className = 'ep-row';
        row.style.cssText = 'display:flex;gap:6px;align-items:center;';

        var input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '名前を入力';
        input.style.cssText = 'flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font-size:13px;';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '決定';
        btn.style.cssText = 'background:#E8A200;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer;white-space:nowrap;';

        btn.addEventListener('click', function() {
            var name = input.value.trim();
            if (!name) return;
            // 行を確定済みに変換
            row.innerHTML = '';
            row.classList.add('ep-done');
            row.style.cssText = 'display:flex;gap:6px;align-items:center;background:#f0fff4;border:1px solid #28a745;border-radius:6px;padding:5px 10px;';

            var nameSpan = document.createElement('span');
            nameSpan.className = 'ep-confirmed-name';
            nameSpan.dataset.name = name;
            nameSpan.style.cssText = 'flex:1;font-size:13px;color:#155724;';
            nameSpan.textContent = name;

            var cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = 'background:transparent;border:1px solid #dc3545;color:#dc3545;border-radius:4px;padding:2px 8px;font-size:12px;cursor:pointer;';
            cancelBtn.addEventListener('click', function() {
                row.remove();
                CarProvision.refreshExtraPassengerInputs();
            });

            row.appendChild(nameSpan);
            row.appendChild(cancelBtn);

            // 次の入力欄を追加（席数に余裕があれば）
            CarProvision.refreshExtraPassengerInputs();
        });

        row.appendChild(input);
        row.appendChild(btn);
        container.appendChild(row);
        input.focus();
    };

    /** フォームリセット時にメンバー外乗員もリセット */
    CarProvision.resetExtraPassengerInputs = function() {
        var container = document.getElementById('extra-passenger-inputs');
        if (container) container.innerHTML = '';
        CarProvision.refreshExtraPassengerInputs();
    };
})();