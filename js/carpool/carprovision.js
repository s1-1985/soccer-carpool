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
            await FCOjima.Carpool.loadEventDataForSelected();
            // 帯同指導者（HUBで監督が決めた担当）。運転者を選ぶ一覧で先に出す
            await FCOjima.Carpool.loadEventCoaches();
        }

        this.updateEventInfo();
        this.updateCarRegistrations();
        this.initSeatMap();
        this.initSiblingUI();
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
        const frontSeat  = CarProvision._seats.frontSeat;
        const middleSeat = CarProvision._seats.middleSeat;
        const backSeat   = CarProvision._seats.backSeat;
        const notes      = (document.getElementById('carNotes').value || '').trim();

        if (!parentName) {
            UI.showAlert('運転者名を入力してください');
            return;
        }

        // メンバー外乗員（兄弟児など）とその席。座席割り当てではこの席に座り、選手は割り当てない
        var extraPassengers = CarProvision._passengers.map(function(p) {
            return { name: p.name, seatType: p.seatType, seatIndex: p.seatIndex };
        });

        const carRegistrations = FCOjima.Carpool.appData.carRegistrations || [];
        // 同じ運転者の登録がすでにあれば確認する（ボタンの二度押しや登録し直しで同じ車が
        // 2台になり、座席割り当てに同じ車が重複して出ていた）
        if (carRegistrations.some(function(c) { return (c.parent || '').trim() === parentName; }) &&
            !UI.showConfirm(parentName + 'さんの車はすでに登録されています。もう1台追加しますか？\n（内容を変えたい場合は、登録済みの車を削除してから登録し直してください）')) {
            return;
        }
        carRegistrations.push({ parent: parentName, canDrive, frontSeat, middleSeat, backSeat, notes, extraPassengers: extraPassengers });
        FCOjima.Carpool.appData.carRegistrations = carRegistrations;
        FCOjima.Carpool.saveData();

        // フォームをクリア
        document.getElementById('parentName').value  = '';
        document.getElementById('canDrive').value    = 'both';
        document.getElementById('carNotes').value    = '';
        CarProvision.resetSeatMap();
        CarProvision.refreshSiblings();
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
                    // 乗車可能 = 座席数 − 兄弟児など（その席には選手を割り当てない）
                    const total = FCOjima.Utils.carOpenSeats(car);
                    const row = document.createElement('tr');
                    row.innerHTML =
                        '<td>' + UI.escapeHTML(car.parent) + '</td>' +
                        '<td>' + UI.escapeHTML(provideLabels[car.canDrive] || car.canDrive) + '</td>' +
                        '<td>' + (parseInt(car.frontSeat, 10)  || 0) + '</td>' +
                        '<td>' + (parseInt(car.middleSeat, 10) || 0) + '</td>' +
                        '<td>' + (parseInt(car.backSeat, 10)   || 0) + '</td>' +
                        '<td>' + total + '</td>' +
                        '<td>' + UI.escapeHTML(car.notes || '') +
                            (CarProvision._passengerText(car) ? '<br>👤 ' + UI.escapeHTML(CarProvision._passengerText(car)) : '') + '</td>' +
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
                    const total = FCOjima.Utils.carOpenSeats(car);
                    const extra = FCOjima.Utils.carExtraCount(car);
                    const label = UI.escapeHTML(provideLabels[car.canDrive] || car.canDrive);
                    const cls   = provideClass[car.canDrive]  || '';
                    var card = document.createElement('div');
                    card.className = 'car-card';
                    card.innerHTML =
                        '<div class="car-card-header">' +
                            '<span class="car-card-name">' + UI.escapeHTML(car.parent) + '</span>' +
                            '<span class="car-card-badge ' + cls + '">' + label + '</span>' +
                        '</div>' +
                        '<div class="car-card-seats">助手席 ' + (parseInt(car.frontSeat, 10) || 0) + ' ＋ 中列 ' + (parseInt(car.middleSeat, 10) || 0) + ' ＋ 後列 ' + (parseInt(car.backSeat, 10) || 0) +
                            (extra > 0 ? ' − 兄弟児など ' + extra : '') + ' ＝ 乗車可能 <strong>' + total + '</strong> 席</div>' +
                        (car.notes ? '<div class="car-card-notes">📝 ' + UI.escapeHTML(car.notes) + '</div>' : '') +
                        (CarProvision._passengerText(car) ?
                            '<div class="car-card-notes">👤 メンバー外: ' + UI.escapeHTML(CarProvision._passengerText(car)) + '</div>' : '') +
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
            // 乗車可能な席の数（兄弟児などが乗る席は除く）
            const totalSeats = available.reduce(function(sum, car) { return sum + FCOjima.Utils.carOpenSeats(car); }, 0);
            const extraTotal = available.reduce(function(sum, car) { return sum + FCOjima.Utils.carExtraCount(car); }, 0);
            const presentCount = (FCOjima.Carpool.appData.attendance || [])
                .filter(function(a) { return a.status === 'present'; }).length;
            const requiredSeatsLabel = presentCount > 0 ? ' / 必要 ' + presentCount + '席' : '';
            statsDiv.innerHTML =
                '<div class="stat-item"><span class="stat-label">車両数</span><span class="stat-value">' + carRegistrations.length + '台</span></div>' +
                '<div class="stat-item"><span class="stat-label">提供可能</span><span class="stat-value">' + available.length + '台</span></div>' +
                '<div class="stat-item"><span class="stat-label">乗車可能</span><span class="stat-value">' + totalSeats + '席' + requiredSeatsLabel + '</span></div>' +
                (extraTotal > 0 ? '<div class="stat-item stat-note"><span class="stat-label">兄弟児など</span><span class="stat-value">' + extraTotal + '人（座席数から除いています）</span></div>' : '');
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
        // この予定の帯同指導者（HUBで監督が決めた担当）は車を出すことが多いので、いちばん上に🧢付きで出す
        const coaches = FCOjima.Carpool.eventCoaches ? FCOjima.Carpool.eventCoaches() : [];
        const coachIds = coaches.map(function(m) { return String(m.id); });
        const candidates = coaches.concat(parents, staff.filter(function(m) { return coachIds.indexOf(String(m.id)) === -1; }));

        if (candidates.length === 0) {
            list.innerHTML = UI.createAlert('info', '選択できるメンバーがいません。先にHUBでメンバーを登録してください。');
            UI.openModal('driver-select-modal');
            return;
        }

        list.innerHTML = '';
        candidates.forEach(function(member) {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.textContent = (coachIds.indexOf(String(member.id)) !== -1 ? '🧢 ' : '') + member.name;
            if (coachIds.indexOf(String(member.id)) !== -1) item.title = '帯同指導者';
            item.addEventListener('click', function() {
                document.getElementById('parentName').value = member.name;
                UI.closeModal('driver-select-modal');
                CarProvision.refreshSiblings();
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
        // 乗車可能な席の数（兄弟児などが乗る席は除く）
        let totalSeats = 0;
        availableCars.forEach(car => {
            totalSeats += FCOjima.Utils.carOpenSeats(car);
        });
        
        message += `車両数: ${availableCars.length}台\n`;
        message += `乗車可能: ${totalSeats}席\n\n`;
        
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
            const extraCount = FCOjima.Utils.carExtraCount(car);
            message += `   乗車可能: ${FCOjima.Utils.carOpenSeats(car)}席 (助手席: ${car.frontSeat}, 中列: ${car.middleSeat}, 後列: ${car.backSeat}` +
                (extraCount > 0 ? `, 兄弟児など: ${extraCount}人` : '') + ')\n';
            
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
    // 座席の図（乗車可能人数と、兄弟児などメンバー外の人の席）
    // 割り当てと同じ形の車で、席の数を −／＋ で変え、席をタップして兄弟児などの席を決める。
    // 決めた席は extraPassengers[].seatType / seatIndex に保存し、座席割り当てではその席に座る
    // （選手は割り当てられない）
    // =============================================

    var SEAT_ROWS = [
        { key: 'frontSeat',  type: '助手席', max: 1 },
        { key: 'middleSeat', type: '中列',   max: 3 },
        { key: 'backSeat',   type: '後列',   max: 3 }
    ];
    var DEFAULT_SEATS = { frontSeat: 1, middleSeat: 3, backSeat: 0 };
    // 空いている席に乗せる順（座席割り当ての自動配置と同じ: 後列→中列→助手席）
    var FILL_ORDER = ['後列', '中列', '助手席'];

    CarProvision._seats = Object.assign({}, DEFAULT_SEATS);
    CarProvision._passengers = []; // { name, seatType, seatIndex, sibling }

    function rowOf(type) { return SEAT_ROWS.filter(function(r) { return r.type === type; })[0]; }
    function countOf(type) { var r = rowOf(type); return r ? CarProvision._seats[r.key] : 0; }
    function passengerAt(type, index) {
        return CarProvision._passengers.filter(function(p) { return p.seatType === type && p.seatIndex === index; })[0] || null;
    }
    function seatName(type, index) { return type + (type === '助手席' ? '' : (index + 1)); }

    /** 登録済みの車のメンバー外乗員（席つき）の表示 */
    CarProvision._passengerText = function(car) {
        return (car.extraPassengers || []).map(function(ep) {
            return ep.name + (ep.seatType ? '（' + seatName(ep.seatType, parseInt(ep.seatIndex, 10) || 0) + '）' : '');
        }).join('、');
    };

    CarProvision._firstFreeSeat = function() {
        for (var t = 0; t < FILL_ORDER.length; t++) {
            for (var i = 0; i < countOf(FILL_ORDER[t]); i++) {
                if (!passengerAt(FILL_ORDER[t], i)) return { seatType: FILL_ORDER[t], seatIndex: i };
            }
        }
        return null;
    };

    /**
     * メンバー外の人を席に乗せる（席を省略すると空いている席）。その席に別の人がいれば降ろす
     * @returns {boolean} 乗せられたか
     */
    CarProvision.seatPassenger = function(name, sibling, seatType, seatIndex) {
        name = String(name || '').trim();
        if (!name) return false;
        var others = CarProvision._passengers.filter(function(p) { return p.name !== name; });
        var seat = (seatType != null) ? { seatType: seatType, seatIndex: seatIndex } : null;
        if (!seat) {
            var saved = CarProvision._passengers;
            CarProvision._passengers = others;
            seat = CarProvision._firstFreeSeat();
            CarProvision._passengers = saved;
        }
        if (!seat) {
            UI.showAlert('空いている席がありません。席の数を増やすか、ほかの人の席を空けてください', 'warning');
            return false;
        }
        CarProvision._passengers = others.filter(function(p) {
            return !(p.seatType === seat.seatType && p.seatIndex === seat.seatIndex);
        }).concat([{ name: name, seatType: seat.seatType, seatIndex: seat.seatIndex, sibling: !!sibling }]);
        return true;
    };

    CarProvision.unseatPassenger = function(name) {
        CarProvision._passengers = CarProvision._passengers.filter(function(p) { return p.name !== name; });
    };

    /** 席の数を変える。なくなった席に乗せていた人は空いている席へ（なければ降ろして知らせる） */
    CarProvision.setSeatCount = function(key, n) {
        var row = SEAT_ROWS.filter(function(r) { return r.key === key; })[0];
        if (!row) return;
        CarProvision._seats[key] = Math.max(0, Math.min(row.max, n));
        var moved = [], dropped = [];
        CarProvision._passengers.filter(function(p) {
            return p.seatType === row.type && p.seatIndex >= CarProvision._seats[key];
        }).forEach(function(p) {
            CarProvision.unseatPassenger(p.name);
            var free = CarProvision._firstFreeSeat();
            if (free) {
                CarProvision._passengers.push({ name: p.name, seatType: free.seatType, seatIndex: free.seatIndex, sibling: p.sibling });
                moved.push(p.name + '→' + seatName(free.seatType, free.seatIndex));
            } else {
                dropped.push(p.name);
            }
        });
        if (moved.length) UI.showAlert('席が減ったため、' + moved.join('、') + ' に移しました', 'info');
        if (dropped.length) UI.showAlert('席が足りないため、' + dropped.join('、') + ' を降ろしました', 'warning', 6000);
        CarProvision.renderSeatMap();
        CarProvision.refreshSiblings();
    };

    CarProvision.initSeatMap = function() {
        var nameInput = document.getElementById('parentName');
        if (nameInput) nameInput.addEventListener('input', function() { CarProvision.renderSeatMap(); });
        var modal = document.getElementById('cp-seat-modal');
        var addBtn = document.getElementById('cp-seat-other-add');
        var input = document.getElementById('cp-seat-other-name');
        if (addBtn && input) {
            var addOther = function() {
                var name = (input.value || '').trim();
                if (!name) { input.focus(); return; }
                var st = CarProvision._pickerSeat;
                // 家庭の兄弟児と同じ名前なら兄弟児として扱う
                var sib = ((CarProvision._siblingFamily && CarProvision._siblingFamily.siblings) || []).some(function(x) {
                    return FCOjima.Utils.normalizeName(x.name) === FCOjima.Utils.normalizeName(name);
                });
                if (CarProvision.seatPassenger(name, sib, st.seatType, st.seatIndex)) {
                    input.value = '';
                    UI.closeModal('cp-seat-modal');
                    CarProvision.renderSeatMap();
                    CarProvision.refreshSiblings();
                }
            };
            addBtn.addEventListener('click', addOther);
            input.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); addOther(); } });
        }
        var clearBtn = document.getElementById('cp-seat-clear');
        if (clearBtn) clearBtn.addEventListener('click', function() {
            var st = CarProvision._pickerSeat;
            var p = st && passengerAt(st.seatType, st.seatIndex);
            if (p) CarProvision.unseatPassenger(p.name);
            UI.closeModal('cp-seat-modal');
            CarProvision.renderSeatMap();
            CarProvision.refreshSiblings();
        });
        if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) UI.closeModal('cp-seat-modal'); });
        CarProvision.renderSeatMap();
    };

    CarProvision.resetSeatMap = function() {
        CarProvision._seats = Object.assign({}, DEFAULT_SEATS);
        CarProvision._passengers = [];
        CarProvision.renderSeatMap();
    };

    /** 席の要素 */
    function seatButton(type, index) {
        var p = passengerAt(type, index);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cp-seat' + (p ? ' cp-seat-taken' : '');
        btn.dataset.seatType = type;
        btn.dataset.seatIndex = index;
        btn.title = seatName(type, index) + (p ? '：' + p.name : '：空き（選手が乗れる席）');
        var name = document.createElement('span');
        name.className = 'cp-seat-name';
        name.textContent = p ? p.name : '空き';
        var label = document.createElement('span');
        label.className = 'cp-seat-label';
        label.textContent = p ? (p.sibling ? '兄弟児' : '同乗者') : seatName(type, index);
        btn.appendChild(name);
        btn.appendChild(label);
        btn.addEventListener('click', function() { CarProvision.openSeatPicker(type, index); });
        return btn;
    }

    CarProvision.renderSeatMap = function() {
        var car = document.getElementById('cp-car');
        var steppers = document.getElementById('cp-steppers');
        if (!car || !steppers) return;
        car.innerHTML = '';
        // 前列: 助手席（左）＋運転席（右）。右ハンドル
        SEAT_ROWS.forEach(function(row) {
            var rowEl = document.createElement('div');
            rowEl.className = 'cp-row';
            rowEl.dataset.row = row.type;
            var n = CarProvision._seats[row.key];
            for (var i = 0; i < n; i++) rowEl.appendChild(seatButton(row.type, i));
            if (n === 0) {
                var none = document.createElement('span');
                none.className = 'cp-seat-none';
                none.textContent = row.type + 'なし';
                rowEl.appendChild(none);
            }
            if (row.type === '助手席') {
                var driver = document.createElement('div');
                driver.className = 'cp-seat cp-seat-driver';
                var dn = (document.getElementById('parentName') || {}).value || '';
                var dm = (FCOjima.Carpool.members || []).filter(function(m) { return m.name === dn.trim(); })[0];
                var nameSpan = document.createElement('span');
                nameSpan.className = 'cp-seat-name';
                nameSpan.textContent = (dm && dm.abbr) ? dm.abbr : (dn.trim() || '運転者');
                var label = document.createElement('span');
                label.className = 'cp-seat-label';
                label.textContent = '運転席';
                driver.appendChild(nameSpan);
                driver.appendChild(label);
                rowEl.appendChild(driver);
            }
            car.appendChild(rowEl);
        });

        // 席の数（−／＋）
        steppers.innerHTML = '';
        SEAT_ROWS.forEach(function(row) {
            var n = CarProvision._seats[row.key];
            var wrap = document.createElement('div');
            wrap.className = 'cp-stepper';
            wrap.dataset.key = row.key;
            var label = document.createElement('span');
            label.className = 'cp-stepper-label';
            label.textContent = row.type;
            var minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'cp-step cp-step-minus';
            minus.textContent = '−';
            minus.setAttribute('aria-label', row.type + 'を1席減らす');
            minus.disabled = n <= 0;
            minus.addEventListener('click', function() { CarProvision.setSeatCount(row.key, n - 1); });
            var count = document.createElement('span');
            count.className = 'cp-step-count';
            count.textContent = n + '席';
            var plus = document.createElement('button');
            plus.type = 'button';
            plus.className = 'cp-step cp-step-plus';
            plus.textContent = '＋';
            plus.setAttribute('aria-label', row.type + 'を1席増やす');
            plus.disabled = n >= row.max;
            plus.addEventListener('click', function() { CarProvision.setSeatCount(row.key, n + 1); });
            wrap.appendChild(label);
            wrap.appendChild(minus);
            wrap.appendChild(count);
            wrap.appendChild(plus);
            steppers.appendChild(wrap);
        });

        var total = CarProvision._seats.frontSeat + CarProvision._seats.middleSeat + CarProvision._seats.backSeat;
        var taken = CarProvision._passengers.length;
        var sum = document.getElementById('cp-seat-summary');
        if (sum) {
            // 乗車可能 = 座席数 − 兄弟児など（登録済みの車・配車の概要・割り当ての座席数も同じ数え方）
            sum.innerHTML = taken > 0
                ? '座席 ' + total + ' − 兄弟児など ' + taken + ' ＝ 乗車可能 <strong>' + Math.max(0, total - taken) + '</strong> 席'
                : '乗車可能 <strong>' + total + '</strong> 席';
        }
    };

    /** 席をタップ: その席に乗せる人を選ぶ */
    CarProvision.openSeatPicker = function(type, index) {
        CarProvision._pickerSeat = { seatType: type, seatIndex: index };
        var cur = passengerAt(type, index);
        document.getElementById('cp-seat-title').textContent = seatName(type, index) + ' の席';
        document.getElementById('cp-seat-current').textContent = cur
            ? '今は ' + cur.name + '（' + (cur.sibling ? '兄弟児' : '同乗者') + '）が乗ります'
            : '今は空き（選手が乗れる席）です';
        var box = document.getElementById('cp-seat-siblings');
        box.innerHTML = '';
        var fam = CarProvision._siblingFamily;
        var sibs = (fam && fam.member && fam.siblings) || [];
        if (sibs.length > 0) {
            var h = document.createElement('div');
            h.className = 'cp-seat-sub';
            h.textContent = '兄弟児をこの席に乗せる';
            box.appendChild(h);
            sibs.forEach(function(sib) {
                var at = CarProvision._passengers.filter(function(p) { return p.name === sib.name; })[0];
                var here = at && at.seatType === type && at.seatIndex === index;
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'cp-sib-choice' + (here ? ' cp-sib-here' : '');
                b.dataset.name = sib.name;
                b.disabled = !!here;
                var nm = document.createElement('span');
                nm.className = 'cp-sib-name';
                nm.textContent = sib.name + (sib.note ? '（' + sib.note + '）' : '');
                var st = document.createElement('span');
                st.className = 'cp-sib-state';
                st.textContent = here ? 'この席' : (at ? seatName(at.seatType, at.seatIndex) + 'から移す' : '乗せる');
                b.appendChild(nm);
                b.appendChild(st);
                b.addEventListener('click', function() {
                    if (CarProvision.seatPassenger(sib.name, true, type, index)) {
                        UI.closeModal('cp-seat-modal');
                        CarProvision.renderSeatMap();
                        CarProvision.refreshSiblings();
                    }
                });
                box.appendChild(b);
            });
        }
        document.getElementById('cp-seat-other-name').value = '';
        document.getElementById('cp-seat-clear').style.display = cur ? '' : 'none';
        UI.openModal('cp-seat-modal');
    };

    // =============================================
    // 兄弟児（保護者のメンバー情報に登録した、チームに所属していない子）
    // =============================================

    CarProvision.initSiblingUI = function() {
        var nameInput = document.getElementById('parentName');
        if (nameInput) nameInput.addEventListener('input', function() { CarProvision.refreshSiblings(); });
        var toggle = document.getElementById('sibling-add-toggle');
        var form = document.getElementById('sibling-add-form');
        if (toggle && form) toggle.addEventListener('click', function() {
            var open = form.style.display === 'none';
            form.style.display = open ? 'flex' : 'none';
            if (open) document.getElementById('sibling-add-name').focus();
        });
        var save = document.getElementById('sibling-add-save');
        if (save) save.addEventListener('click', function() { CarProvision.addSibling(); });
        this.refreshSiblings();
    };

    /** 運転者の家庭の兄弟児を、チェックで選べるように表示する（運転者が保護者のメンバーでなければ出さない） */
    CarProvision.refreshSiblings = function() {
        var group = document.getElementById('sibling-group');
        var box = document.getElementById('sibling-options');
        if (!group || !box) return;
        var driver = (document.getElementById('parentName') || {}).value || '';
        var res = FCOjima.Utils.findFamilySiblings(FCOjima.Carpool.members || [], driver);
        // 別の家庭の運転者に変えたら、書きかけの兄弟児の登録欄は閉じて空にする
        var prevId = CarProvision._siblingFamily && CarProvision._siblingFamily.member ? String(CarProvision._siblingFamily.member.id) : null;
        var nextId = res.member ? String(res.member.id) : null;
        if (prevId !== nextId) {
            var addForm = document.getElementById('sibling-add-form');
            if (addForm) addForm.style.display = 'none';
            ['sibling-add-name', 'sibling-add-note'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
        }
        CarProvision._siblingFamily = res;
        // 別の家庭の運転者に変えたら、前の家庭の兄弟児は席から降ろす（名前を入れて乗せた人はそのまま）
        var famNames = res.siblings.map(function(x) { return x.name; });
        var before = CarProvision._passengers.length;
        CarProvision._passengers = CarProvision._passengers.filter(function(p) { return !p.sibling || famNames.indexOf(p.name) !== -1; });
        if (CarProvision._passengers.length !== before) CarProvision.renderSeatMap();
        if (!res.member) {
            group.style.display = 'none';
            return;
        }
        group.style.display = '';
        box.innerHTML = '';
        if (res.siblings.length === 0) {
            var p = document.createElement('p');
            p.style.cssText = 'margin:0;font-size:12px;color:#888;';
            p.textContent = '登録されている兄弟児はいません。よく一緒に乗る兄弟児は下から登録すると、次回からチェックで選べます。';
            box.appendChild(p);
            return;
        }
        res.siblings.forEach(function(sib) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;';
            var label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:6px;flex:1;min-width:0;cursor:pointer;font-size:14px;';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'sibling-check';
            cb.value = sib.name;
            var seated = CarProvision._passengers.filter(function(p) { return p.name === sib.name; })[0];
            cb.checked = !!seated;
            // チェック: 空いている席に乗せる（後列→中列→助手席）／外す: 席から降ろす
            cb.addEventListener('change', function() {
                if (cb.checked) {
                    if (!CarProvision.seatPassenger(sib.name, true)) cb.checked = false;
                } else {
                    CarProvision.unseatPassenger(sib.name);
                }
                CarProvision.renderSeatMap();
                CarProvision.refreshSiblings();
            });
            // 名前の下にメモを小さく（狭い画面で名前とメモが何行にも折り返さないように）
            var text = document.createElement('span');
            text.style.cssText = 'display:flex;flex-direction:column;min-width:0;word-break:keep-all;overflow-wrap:anywhere;';
            var nameSpan = document.createElement('span');
            nameSpan.textContent = sib.name;
            text.appendChild(nameSpan);
            if (sib.note) {
                var noteSpan = document.createElement('span');
                noteSpan.style.cssText = 'font-size:11px;color:#888;';
                noteSpan.textContent = sib.note;
                text.appendChild(noteSpan);
            }
            label.appendChild(cb);
            label.appendChild(text);
            if (seated) {
                var seatTag = document.createElement('span');
                seatTag.className = 'cp-sib-seat';
                seatTag.textContent = seatName(seated.seatType, seated.seatIndex);
                label.appendChild(seatTag);
            }
            var rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'sibling-remove';
            rm.textContent = '削除';
            rm.title = sib.name + 'を兄弟児の登録から削除';
            rm.style.cssText = 'flex:0 0 auto;background:transparent;border:1px solid #dc3545;color:#dc3545;border-radius:4px;padding:2px 8px;font-size:11px;min-height:28px;';
            rm.addEventListener('click', function() { CarProvision.removeSibling(sib); });
            row.appendChild(label);
            row.appendChild(rm);
            box.appendChild(row);
        });
    };

    /** 運転者の家庭に兄弟児を登録する（保護者のメンバー情報の兄弟児に追加） */
    CarProvision.addSibling = async function() {
        var res = CarProvision._siblingFamily;
        var nameEl = document.getElementById('sibling-add-name');
        var noteEl = document.getElementById('sibling-add-note');
        var name = (nameEl.value || '').trim();
        var note = (noteEl.value || '').trim();
        if (!res || !res.member) return;
        if (!name) { UI.showAlert('兄弟児の名前を入力してください', 'warning'); return; }
        if (res.siblings.some(function(s) { return FCOjima.Utils.normalizeName(s.name) === FCOjima.Utils.normalizeName(name); })) {
            UI.showAlert(name + 'はすでに登録されています', 'info');
            return;
        }
        var sib = { name: name, note: note };
        try {
            await FCOjima.DB.addMemberSibling(res.member.id, sib);
        } catch (e) {
            console.warn('兄弟児の登録に失敗:', e);
            UI.showAlert(e && e.code === 'permission-denied'
                ? '兄弟児を登録できませんでした。ご自分の家庭以外の兄弟児は、管理者・指導者・役員がメンバー画面で登録してください'
                : '兄弟児を登録できませんでした。通信環境を確認してください', 'error', 7000);
            return;
        }
        res.member.siblings = (res.member.siblings || []).concat([sib]);
        CarProvision.seatPassenger(name, true);
        CarProvision.renderSeatMap();
        nameEl.value = '';
        noteEl.value = '';
        document.getElementById('sibling-add-form').style.display = 'none';
        CarProvision.refreshSiblings();
        UI.showAlert(name + 'を兄弟児として登録しました（次回からチェックで選べます）', 'success');
    };

    /** 登録した兄弟児を削除する（その兄弟児を登録した保護者のメンバー情報から外す） */
    CarProvision.removeSibling = async function(sib) {
        if (!UI.showConfirm(sib.name + 'を兄弟児の登録から削除しますか？\n（すでに登録した車の同乗者からは消えません）')) return;
        try {
            await FCOjima.DB.removeMemberSibling(sib.ownerId, sib.raw);
        } catch (e) {
            console.warn('兄弟児の削除に失敗:', e);
            UI.showAlert(e && e.code === 'permission-denied'
                ? '削除できませんでした。ご自分の家庭以外の兄弟児は、管理者・指導者・役員がメンバー画面で削除してください'
                : '削除できませんでした。通信環境を確認してください', 'error', 7000);
            return;
        }
        var owner = (FCOjima.Carpool.members || []).find(function(m) { return String(m.id) === sib.ownerId; });
        if (owner) owner.siblings = (owner.siblings || []).filter(function(s) { return s !== sib.raw; });
        CarProvision.unseatPassenger(sib.name);
        CarProvision.renderSeatMap();
        CarProvision.refreshSiblings();
    };

})();