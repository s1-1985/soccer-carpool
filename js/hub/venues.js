/**
 * FC尾島ジュニア - 会場管理
 * 会場情報の管理に関する機能を提供（続き）
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Venues = FCOjima.Hub.Venues || {};

// 会場管理モジュール
(function() {
    // 名前空間のショートカット
    const Venues = FCOjima.Hub.Venues;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;
    const Storage = FCOjima.Storage;

    /**
     * 会場管理機能の初期化
     */
    Venues.init = function() {
        console.log('会場管理機能を初期化しています...');
        this.updateVenueList();
        console.log('会場管理機能の初期化が完了しました');
    };

    /**
     * 会場一覧を更新
     */
    Venues.updateVenueList = function() {
        const venues = FCOjima.Hub.venues || [];
        const tbody = document.querySelector('#venue-table tbody');
        if (!tbody) return;

        if (venues.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-table-message">登録された会場はありません。</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        venues.forEach(function(venue) {
            const row = document.createElement('tr');
            row.innerHTML =
                '<td>' + UI.escapeHTML(venue.name) + '</td>' +
                '<td>' + UI.escapeHTML(venue.address || '') + '</td>' +
                '<td>' + UI.escapeHTML(venue.notes || '') + '</td>' +
                '<td>' +
                    '<button type="button" class="secondary-button" onclick="FCOjima.Hub.Venues.editVenue(' + venue.id + ')">編集</button> ' +
                    '<button type="button" class="delete-button" onclick="FCOjima.Hub.Venues.deleteVenue(' + venue.id + ')">削除</button>' +
                '</td>';
            tbody.appendChild(row);
        });
    };

    /**
     * 会場選択モーダルを開く（削除用）
     */
    Venues.openVenueSelectForDelete = function() {
        console.log('会場選択モーダル（削除用）を開きます...');
        
        const venues = FCOjima.Hub.venues;
        
        const selectList = document.createElement('div');
        selectList.className = 'select-list';
        
        if (venues.length === 0) {
            selectList.innerHTML = UI.createAlert('info', '登録されている会場はありません。');
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
                    if (UI.showConfirm(`本当に「${venue.name}」を削除しますか？`)) {
                        this.deleteVenue(venue.id);
                    }
                    UI.closeModal('logs-modal');
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
        UI.openModal('logs-modal');
    };
    
    /**
     * 会場追加モーダルを開く
     * @param {number} venueId - 会場ID（編集時のみ指定、新規追加時はnull）
     */
    Venues.openAddVenueModal = function(venueId = null) {
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
        UI.openModal('venue-modal');
    };
    
    /**
     * 新規会場保存
     * 問題1: HUB会場登録のログが表示されない - logsパラメータを明示的に渡す
     */
    Venues.saveVenue = function() {
        const venues = FCOjima.Hub.venues;
        const logs = FCOjima.Hub.logs; // ログを取得
        
        const name = document.getElementById('venue-name').value;
        const address = document.getElementById('venue-address').value;
        const notes = document.getElementById('venue-notes').value;
        
        // バリデーション
        if (!name || !address) {
            UI.showAlert('会場名と住所は必須です');
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
                
                // ログに記録 - 修正: logs引数を明示的に渡す
                FCOjima.Hub.logs = Storage.addLog('venues', '会場更新', `「${name}」`, logs);
                console.log(`会場を更新しました: ${name}`);
            }
        } else {
            // 新規会場を追加
            venues.push({
                id: newId,
                name,
                address,
                notes
            });
            
            // ログに記録 - 修正: logs引数を明示的に渡す
            FCOjima.Hub.logs = Storage.addLog('venues', '会場追加', `「${name}」`, logs);
            console.log(`新しい会場を登録しました: ${name}`);
        }
        
        // 会場を保存してUIを更新
        Storage.saveVenues(venues);
        this.updateVenueList();
        
        // モーダルを閉じてフォームをリセット
        UI.closeModal('venue-modal');
        document.getElementById('venue-form').reset();
        document.getElementById('venue-form').removeAttribute('data-venue-id');
    };
    
    /**
     * 会場編集
     * @param {number} venueId - 会場ID
     */
    Venues.editVenue = function(venueId) {
        this.openAddVenueModal(venueId);
    };
    
    /**
     * 会場削除
     * 問題1: HUB会場登録のログが表示されない - logsパラメータを明示的に渡す
     * @param {number} venueId - 会場ID
     */
    Venues.deleteVenue = function(venueId) {
        const venues = FCOjima.Hub.venues;
        const logs = FCOjima.Hub.logs; // ログを取得
        
        const venue = venues.find(v => v.id === venueId);
        if (!venue) return;
        
        if (UI.showConfirm(`会場「${venue.name}」を削除してもよろしいですか？`)) {
            // 会場を削除
            FCOjima.Hub.venues = venues.filter(v => v.id !== venueId);
            
            // ログに記録 - 修正: logs引数を明示的に渡す
            FCOjima.Hub.logs = Storage.addLog('venues', '会場削除', `「${venue.name}」`, logs);
            console.log(`会場を削除しました: ${venue.name}`);
            
            // 会場を保存してUIを更新
            Storage.saveVenues(FCOjima.Hub.venues);
            this.updateVenueList();
        }
    };
    
    /**
     * 地図を表示
     * @param {number} venueId - 会場ID
     */
    Venues.openMap = function(venueId) {
        const venues = FCOjima.Hub.venues;
        
        const venue = venues.find(v => v.id === venueId);
        if (!venue) return;
        
        // Google Mapsを開く
        const address = encodeURIComponent(venue.address);
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
        Utils.openNewTab(mapUrl);
    };
    
    /**
     * 会場選択モーダルを開く
     * @param {string} target - 設定先（'venue'または'meeting'）
     */
    Venues.openVenueSelect = function(target) {
        const venues = FCOjima.Hub.venues;
        
        const selectList = document.getElementById('venue-select-list');
        selectList.innerHTML = '';
        
        if (venues.length === 0) {
            selectList.innerHTML = UI.createAlert('info', '登録されている会場はありません。');
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
                    UI.closeModal('venue-select-modal');
                });
                
                selectList.appendChild(item);
            });
        }
        
        UI.openModal('venue-select-modal');
    };
})();