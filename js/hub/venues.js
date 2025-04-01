/**
 * FC尾島ジュニア - 会場登録タブの機能
 * 会場管理に関する機能を提供
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * 会場リストを描画
 */
FCOjima.Hub.Venues.renderVenuesList = function() {
    const venues = FCOjima.Hub.venues;
    
    const listContainer = document.getElementById('venues-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    if (venues.length === 0) {
        listContainer.innerHTML = FCOjima.UI.createAlert('info', '登録されている会場はありません。');
        return;
    }
    
    // 会場名でソート
    const sortedVenues = [...venues].sort((a, b) => 
        a.name.localeCompare(b.name, 'ja')
    );
    
    sortedVenues.forEach(venue => {
        const venueCard = document.createElement('div');
        venueCard.className = 'venue-card';
        venueCard.dataset.venueId = venue.id;
        
        // 備考表示（あれば）
        let notesDisplay = '';
        if (venue.notes) {
            notesDisplay = `<div class="detail-row">
                <span class="detail-label">備考:</span>
                <span class="detail-value">${FCOjima.UI.escapeHTML(venue.notes)}</span>
            </div>`;
        }
        
        venueCard.innerHTML = `
            <h3>${FCOjima.UI.escapeHTML(venue.name)}</h3>
            <div class="detail-row">
                <span class="detail-label">住所:</span>
                <span class="detail-value">${FCOjima.UI.escapeHTML(venue.address)}</span>
            </div>
            ${notesDisplay}
            <div class="venue-actions">
                <button class="secondary-button" onclick="FCOjima.Hub.Venues.editVenue(${venue.id})">編集</button>
                <button class="secondary-button" onclick="FCOjima.Hub.Venues.openMap(${venue.id})">地図を表示</button>
            </div>
        `;
        
        listContainer.appendChild(venueCard);
    });
    
    // 会場削除ボタンを下部に追加
    const deleteButtonArea = document.createElement('div');
    deleteButtonArea.className = 'action-buttons';
    deleteButtonArea.innerHTML = `
        <button class="delete-button" onclick="FCOjima.Hub.Venues.openVenueSelectForDelete()">会場を削除</button>
    `;
    
    listContainer.appendChild(deleteButtonArea);
};

/**
 * 会場選択モーダルを開く（削除用）
 */
FCOjima.Hub.Venues.openVenueSelectForDelete = function() {
    console.log('会場選択モーダル（削除用）を開きます...');
    
    const venues = FCOjima.Hub.venues;
    
    const selectList = document.createElement('div');
    selectList.className = 'select-list';
    
    if (venues.length === 0) {
        selectList.innerHTML = FCOjima.UI.createAlert('info', '登録されている会場はありません。');
    } else {
        // 会場名でソート
        const sortedVenues = [...venues].sort((a, b) => 
            a.name.localeCompare(b.name, 'ja')
        );
        
        sortedVenues.forEach(venue => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.textContent = venue.name;
            
            item.addEventListener('click', () => {
                if (FCOjima.UI.showConfirm(`本当に「${venue.name}」を削除しますか？`)) {
                    this.deleteVenue(venue.id);
                }
                FCOjima.UI.closeModal('logs-modal');
            });
            
            selectList.appendChild(item);
        });
    }
    
    // 既存のログコンテンツを置き換え
    const logsContent = document.getElementById('logs-content');
    logsContent.innerHTML = '';
    logsContent.appendChild(document.createElement('h3')).textContent = '削除する会場を選択';
    logsContent.appendChild(selectList);
    
    // モーダルを表示
    FCOjima.UI.openModal('logs-modal');
};

/**
 * 会場追加モーダルを開く
 * @param {number} venueId - 会場ID（編集時のみ指定、新規追加時はnull）
 */
FCOjima.Hub.Venues.openAddVenueModal = function(venueId = null) {
    const venues = FCOjima.Hub.venues;
    
    // モーダルのタイトル設定
    const titleEl = document.querySelector('#venue-modal h2');
    titleEl.textContent = venueId ? '会場を編集' : '会場を追加';
    
    // フォームをリセット
    document.getElementById('venue-form').reset();
    
    // 編集の場合は既存データを設定
    if (venueId) {
        const venue = venues.find(v => v.id === venueId);
        if (venue) {
            // フォームに会場IDを設定
            document.getElementById('venue-form').setAttribute('data-venue-id', venue.id);
            
            document.getElementById('venue-name').value = venue.name || '';
            document.getElementById('venue-address').value = venue.address || '';
            document.getElementById('venue-notes').value = venue.notes || '';
        }
    }
    
    // モーダルを表示
    FCOjima.UI.openModal('venue-modal');
};

/**
 * 新規会場保存
 */
FCOjima.Hub.Venues.saveVenue = function() {
    const venues = FCOjima.Hub.venues;
    const logs = FCOjima.Hub.logs;
    
    const name = document.getElementById('venue-name').value;
    const address = document.getElementById('venue-address').value;
    const notes = document.getElementById('venue-notes').value;
    
    // バリデーション
    if (!name || !address) {
        FCOjima.UI.showAlert('会場名と住所は必須です');
        return;
    }
    
    // 新しい会場ID
    const newId = venues.length > 0 ? Math.max(...venues.map(v => v.id)) + 1 : 1;
    
    // 既存会場の更新または新規会場の追加
    const venueFormId = document.getElementById('venue-form').getAttribute('data-venue-id');
    
    if (venueFormId) {
        // 既存会場の更新
        const index = venues.findIndex(v => v.id === parseInt(venueFormId));
        if (index !== -1) {
            venues[index] = {
                id: parseInt(venueFormId),
                name,
                address,
                notes
            };
            
            // ログに記録
            FCOjima.Hub.logs = FCOjima.Storage.addLog('venues', '会場更新', `「${name}」`, logs);
        }
    } else {
        // 新規会場を追加
        venues.push({
            id: newId,
            name,
            address,
            notes
        });
        
        // ログに記録
        FCOjima.Hub.logs = FCOjima.Storage.addLog('venues', '会場追加', `「${name}」`, logs);
    }
    
    // 会場を保存してUIを更新
    FCOjima.Storage.saveVenues(venues);
    this.renderVenuesList();
    
    // モーダルを閉じてフォームをリセット
    FCOjima.UI.closeModal('venue-modal');
    document.getElementById('venue-form').reset();
    document.getElementById('venue-form').removeAttribute('data-venue-id');
};

/**
 * 会場編集
 * @param {number} venueId - 会場ID
 */
FCOjima.Hub.Venues.editVenue = function(venueId) {
    this.openAddVenueModal(venueId);
};

/**
 * 会場削除
 * @param {number} venueId - 会場ID
 */
FCOjima.Hub.Venues.deleteVenue = function(venueId) {
    const venues = FCOjima.Hub.venues;
    const logs = FCOjima.Hub.logs;
    
    const venue = venues.find(v => v.id === venueId);
    if (!venue) return;
    
    if (FCOjima.UI.showConfirm(`会場「${venue.name}」を削除してもよろしいですか？`)) {
        // 会場を削除
        FCOjima.Hub.venues = venues.filter(v => v.id !== venueId);
        
        // ログに記録
        FCOjima.Hub.logs = FCOjima.Storage.addLog('venues', '会場削除', `「${venue.name}」`, logs);
        
        // 会場を保存してUIを更新
        FCOjima.Storage.saveVenues(FCOjima.Hub.venues);
        this.renderVenuesList();
    }
};

/**
 * 地図を表示
 * @param {number} venueId - 会場ID
 */
FCOjima.Hub.Venues.openMap = function(venueId) {
    const venues = FCOjima.Hub.venues;
    
    const venue = venues.find(v => v.id === venueId);
    if (!venue) return;
    
    // Google Mapsを開く
    const address = encodeURIComponent(venue.address);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
    FCOjima.Utils.openNewTab(mapUrl);
};

/**
 * 会場選択モーダルを開く
 * @param {string} target - 設定先（'venue'または'meeting'）
 */
FCOjima.Hub.Venues.openVenueSelect = function(target) {
    const venues = FCOjima.Hub.venues;
    
    const selectList = document.getElementById('venue-select-list');
    selectList.innerHTML = '';
    
    if (venues.length === 0) {
        selectList.innerHTML = FCOjima.UI.createAlert('info', '登録されている会場はありません。');
    } else {
        // 会場名でソート
        const sortedVenues = [...venues].sort((a, b) => 
            a.name.localeCompare(b.name, 'ja')
        );
        
        sortedVenues.forEach(venue => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.textContent = venue.name;
            
            item.addEventListener('click', function() {
                // ターゲットによって設定先を変える
                if (target === 'venue') {
                    document.getElementById('event-venue').value = venue.name;
                } else if (target === 'meeting') {
                    document.getElementById('event-meeting-place').value = venue.name;
                }
                FCOjima.UI.closeModal('venue-select-modal');
            });
            
            selectList.appendChild(item);
        });
    }
    
    FCOjima.UI.openModal('venue-select-modal');
};