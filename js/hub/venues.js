/**
 * FC尾島ジュニア - 会場管理機能（Firebase版）
 * 会場情報の管理、Google Maps連携、フィルタリング機能
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Venues = FCOjima.Hub.Venues || {};

// 会場管理モジュール
(function() {
    const Venues = FCOjima.Hub.Venues;
    const Firestore = FCOjima.Firestore;
    const Auth = FCOjima.Auth;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;
    
    // データ
    let venues = [];
    let venuesUnsubscribe = null;
    let currentFilters = {
        type: 'all',
        area: 'all'
    };
    let currentEditingVenue = null;
    
    /**
     * 会場管理機能の初期化
     */
    Venues.init = async function() {
        try {
            // 認証チェック
            if (!Auth.isLoggedIn()) {
                console.warn('未ログインユーザーです');
                UI.showAlert('ログインが必要です', 'warning');
                return;
            }
            
            // 会場データをリアルタイム監視で読み込み
            setupRealtimeListeners();
            
            // UI要素の初期化
            setupEventListeners();
            updateDisplay();
            
            // モーダルの初期化
            if (UI && UI.initModals) {
                UI.initModals();
            }
            
            console.log('会場管理機能を初期化しました（Firebase版）');
            
        } catch (error) {
            console.error('会場管理初期化エラー:', error);
            UI.showAlert('会場管理の初期化に失敗しました', 'danger');
        }
    };
    
    /**
     * リアルタイムリスナーの設定
     */
    function setupRealtimeListeners() {
        // 既存のリスナーを解除
        if (venuesUnsubscribe) {
            venuesUnsubscribe();
        }
        
        // 会場のリアルタイム監視
        venuesUnsubscribe = Firestore.watchVenues((updatedVenues) => {
            venues = updatedVenues;
            updateDisplay();
        });
    }
    
    /**
     * イベントリスナーの設定
     */
    function setupEventListeners() {
        // フィルター機能
        const typeFilter = document.getElementById('type-filter');
        const areaFilter = document.getElementById('area-filter');
        
        if (typeFilter) {
            typeFilter.addEventListener('change', function() {
                currentFilters.type = this.value;
                updateDisplay();
            });
        }
        
        if (areaFilter) {
            areaFilter.addEventListener('change', function() {
                currentFilters.area = this.value;
                updateDisplay();
            });
        }
        
        // 会場追加ボタン
        const addVenueBtn = document.getElementById('add-venue');
        if (addVenueBtn) {
            addVenueBtn.addEventListener('click', () => openVenueModal());
        }
        
        // 会場フォーム送信
        const venueForm = document.getElementById('venue-form');
        if (venueForm) {
            venueForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveVenue();
            });
        }
        
        // 検索機能
        const searchInput = document.getElementById('venue-search');
        if (searchInput) {
            searchInput.addEventListener('input', updateDisplay);
        }
        
        // 住所から座標を取得ボタン
        const geocodeBtn = document.getElementById('geocode-address');
        if (geocodeBtn) {
            geocodeBtn.addEventListener('click', geocodeAddress);
        }
        
        // 地図表示切り替え
        const toggleMapBtn = document.getElementById('toggle-map-view');
        if (toggleMapBtn) {
            toggleMapBtn.addEventListener('click', toggleMapView);
        }
    }
    
    /**
     * 表示を更新
     */
    function updateDisplay() {
        const venuesList = document.getElementById('venues-list');
        if (!venuesList) return;
        
        // フィルタリングとソート
        const filteredVenues = getFilteredVenues();
        
        if (filteredVenues.length === 0) {
            venuesList.innerHTML = '<div class="no-venues">条件に一致する会場がありません。</div>';
            updateStats();
            return;
        }
        
        // カード形式で表示
        let html = '<div class="venues-grid">';
        
        filteredVenues.forEach(venue => {
            html += createVenueCard(venue);
        });
        
        html += '</div>';
        
        venuesList.innerHTML = html;
        
        // 統計の更新
        updateStats();
    }
    
    /**
     * 会場カードを作成
     */
    function createVenueCard(venue) {
        const typeLabel = getTypeLabel(venue.type);
        const mapLink = generateMapLink(venue.address);
        const distance = venue.distance ? `約${venue.distance}km` : '';
        
        return `
            <div class="venue-card" data-venue-id="${venue.id}">
                <div class="venue-card-header">
                    <h3 class="venue-name">${Utils.escapeHTML(venue.name)}</h3>
                    <span class="venue-type type-${venue.type}">${typeLabel}</span>
                </div>
                
                <div class="venue-info">
                    <div class="venue-address">
                        <i class="icon-location"></i>
                        <span>${Utils.escapeHTML(venue.address)}</span>
                    </div>
                    
                    ${venue.phone ? `
                        <div class="venue-phone">
                            <i class="icon-phone"></i>
                            <span>${Utils.escapeHTML(venue.phone)}</span>
                        </div>
                    ` : ''}
                    
                    ${distance ? `
                        <div class="venue-distance">
                            <i class="icon-navigation"></i>
                            <span>${distance}</span>
                        </div>
                    ` : ''}
                    
                    ${venue.capacity ? `
                        <div class="venue-capacity">
                            <i class="icon-users"></i>
                            <span>収容人数: ${venue.capacity}名</span>
                        </div>
                    ` : ''}
                </div>
                
                ${venue.notes ? `
                    <div class="venue-notes">
                        <p>${Utils.escapeHTML(venue.notes)}</p>
                    </div>
                ` : ''}
                
                <div class="venue-actions">
                    <button onclick="FCOjima.Hub.Venues.viewVenue('${venue.id}')" class="btn btn-info btn-sm">詳細</button>
                    <a href="${mapLink}" target="_blank" class="btn btn-success btn-sm">地図</a>
                    <button onclick="FCOjima.Hub.Venues.editVenue('${venue.id}')" class="btn btn-primary btn-sm">編集</button>
                    <button onclick="FCOjima.Hub.Venues.deleteVenue('${venue.id}')" class="btn btn-danger btn-sm">削除</button>
                </div>
                
                <div class="venue-footer">
                    <small class="text-muted">
                        登録日: ${venue.createdAt ? Utils.formatDate(new Date(venue.createdAt)) : '-'}
                    </small>
                </div>
            </div>
        `;
    }
    
    /**
     * 会場モーダルを開く
     */
    function openVenueModal(venue = null) {
        currentEditingVenue = venue;
        
        const form = document.getElementById('venue-form');
        const modal = document.getElementById('venue-modal');
        
        if (!form || !modal) return;
        
        // フォームのリセット
        form.reset();
        
        if (venue) {
            // 編集モード
            form.dataset.venueId = venue.id;
            document.getElementById('venue-name').value = venue.name;
            document.getElementById('venue-type').value = venue.type;
            document.getElementById('venue-address').value = venue.address || '';
            document.getElementById('venue-phone').value = venue.phone || '';
            document.getElementById('venue-website').value = venue.website || '';
            document.getElementById('venue-capacity').value = venue.capacity || '';
            document.getElementById('venue-parking').value = venue.parking || '';
            document.getElementById('venue-facilities').value = venue.facilities || '';
            document.getElementById('venue-notes').value = venue.notes || '';
            document.getElementById('venue-latitude').value = venue.latitude || '';
            document.getElementById('venue-longitude').value = venue.longitude || '';
            
            document.getElementById('modal-title').textContent = '会場編集';
        } else {
            // 新規作成モード
            delete form.dataset.venueId;
            document.getElementById('modal-title').textContent = '会場追加';
        }
        
        UI.openModal('venue-modal');
    }
    
    /**
     * 会場を保存
     */
    async function saveVenue() {
        try {
            const form = document.getElementById('venue-form');
            const formData = new FormData(form);
            const venueId = form.dataset.venueId;
            
            // フォームデータを取得
            const venueData = {
                name: formData.get('name').trim(),
                type: formData.get('type'),
                address: formData.get('address').trim(),
                phone: formData.get('phone').trim(),
                website: formData.get('website').trim(),
                capacity: formData.get('capacity') ? parseInt(formData.get('capacity')) : null,
                parking: formData.get('parking').trim(),
                facilities: formData.get('facilities').trim(),
                notes: formData.get('notes').trim(),
                latitude: formData.get('latitude') ? parseFloat(formData.get('latitude')) : null,
                longitude: formData.get('longitude') ? parseFloat(formData.get('longitude')) : null
            };
            
            // バリデーション
            if (!venueData.name) {
                UI.showAlert('会場名を入力してください', 'warning');
                return;
            }
            
            if (!venueData.address) {
                UI.showAlert('住所を入力してください', 'warning');
                return;
            }
            
            // 重複チェック
            const duplicateName = venues.find(v => 
                v.id !== venueId && 
                v.name.toLowerCase() === venueData.name.toLowerCase()
            );
            
            if (duplicateName) {
                UI.showAlert('同じ名前の会場が既に登録されています', 'warning');
                return;
            }
            
            // 権限チェック
            if (!Auth.hasPermission('manager')) {
                UI.showAlert('会場の編集権限がありません', 'danger');
                return;
            }
            
            // Firestoreに保存
            if (venueId) {
                // 既存会場の更新
                await Firestore.updateDocument('venues', venueId, venueData);
                await Firestore.addLog('venues', `会場「${venueData.name}」を編集しました`);
                UI.showAlert('会場情報を更新しました', 'success');
            } else {
                // 新規会場の追加
                venueData.createdAt = new Date().toISOString();
                await Firestore.addDocument('venues', venueData);
                await Firestore.addLog('venues', `会場「${venueData.name}」を追加しました`);
                UI.showAlert('会場を追加しました', 'success');
            }
            
            // モーダルを閉じる
            UI.closeModal('venue-modal');
            
        } catch (error) {
            console.error('会場保存エラー:', error);
            UI.showAlert('会場の保存に失敗しました', 'danger');
        }
    }
    
    /**
     * 会場を削除
     */
    Venues.deleteVenue = async function(venueId) {
        try {
            const venue = venues.find(v => v.id === venueId);
            if (!venue) return;
            
            if (!confirm(`会場「${venue.name}」を削除しますか？\n※この操作は取り消せません`)) {
                return;
            }
            
            // 権限チェック
            if (!Auth.hasPermission('manager')) {
                UI.showAlert('会場の削除権限がありません', 'danger');
                return;
            }
            
            await Firestore.deleteDocument('venues', venueId);
            await Firestore.addLog('venues', `会場「${venue.name}」を削除しました`);
            
            UI.showAlert('会場を削除しました', 'success');
            
        } catch (error) {
            console.error('会場削除エラー:', error);
            UI.showAlert('会場の削除に失敗しました', 'danger');
        }
    };
    
    /**
     * 会場を編集
     */
    Venues.editVenue = function(venueId) {
        const venue = venues.find(v => v.id === venueId);
        if (venue) {
            openVenueModal(venue);
        }
    };
    
    /**
     * 会場詳細を表示
     */
    Venues.viewVenue = function(venueId) {
        const venue = venues.find(v => v.id === venueId);
        if (!venue) return;
        
        const modal = document.getElementById('venue-detail-modal');
        if (!modal) return;
        
        // 会場詳細の表示
        document.getElementById('detail-name').textContent = venue.name;
        document.getElementById('detail-type').textContent = getTypeLabel(venue.type);
        document.getElementById('detail-address').textContent = venue.address;
        document.getElementById('detail-phone').textContent = venue.phone || '-';
        document.getElementById('detail-website').textContent = venue.website || '-';
        document.getElementById('detail-capacity').textContent = venue.capacity ? `${venue.capacity}名` : '-';
        document.getElementById('detail-parking').textContent = venue.parking || '-';
        document.getElementById('detail-facilities').textContent = venue.facilities || '-';
        document.getElementById('detail-notes').textContent = venue.notes || '-';
        document.getElementById('detail-coordinates').textContent = 
            venue.latitude && venue.longitude ? `${venue.latitude}, ${venue.longitude}` : '-';
        document.getElementById('detail-created').textContent = 
            venue.createdAt ? Utils.formatDate(new Date(venue.createdAt)) : '-';
        
        // 地図リンクの設定
        const mapLink = document.getElementById('detail-map-link');
        if (mapLink) {
            mapLink.href = generateMapLink(venue.address);
        }
        
        // 距離計算の表示
        if (venue.distance) {
            document.getElementById('detail-distance').textContent = `約${venue.distance}km`;
        }
        
        UI.openModal('venue-detail-modal');
    };
    
    /**
     * 住所から座標を取得（ジオコーディング）
     */
    async function geocodeAddress() {
        const addressInput = document.getElementById('venue-address');
        const latitudeInput = document.getElementById('venue-latitude');
        const longitudeInput = document.getElementById('venue-longitude');
        
        if (!addressInput.value.trim()) {
            UI.showAlert('住所を入力してください', 'warning');
            return;
        }
        
        try {
            // Google Maps Geocoding APIを使用
            const address = encodeURIComponent(addressInput.value.trim());
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=YOUR_GOOGLE_MAPS_API_KEY`;
            
            // 実際の実装では、サーバーサイドでAPIキーを使用することを推奨
            UI.showAlert('ジオコーディング機能は開発中です。手動で座標を入力してください。', 'info');
            
            // 開発時のダミー実装（実際にはGoogle Maps APIを使用）
            const dummyCoordinates = getDummyCoordinates(addressInput.value);
            if (dummyCoordinates) {
                latitudeInput.value = dummyCoordinates.lat;
                longitudeInput.value = dummyCoordinates.lng;
                UI.showAlert('座標を取得しました（ダミーデータ）', 'success');
            }
            
        } catch (error) {
            console.error('ジオコーディングエラー:', error);
            UI.showAlert('座標の取得に失敗しました', 'danger');
        }
    }
    
    /**
     * 開発用のダミー座標取得
     */
    function getDummyCoordinates(address) {
        // 太田市周辺の座標をダミーとして返す
        const dummyLocations = {
            '太田': { lat: 36.2929, lng: 139.3744 },
            '尾島': { lat: 36.3166, lng: 139.2833 },
            '群馬': { lat: 36.3908, lng: 139.0608 },
            '足利': { lat: 36.3411, lng: 139.4497 },
            '館林': { lat: 36.2452, lng: 139.5405 }
        };
        
        for (const [key, coords] of Object.entries(dummyLocations)) {
            if (address.includes(key)) {
                return coords;
            }
        }
        
        // デフォルトは太田市役所
        return { lat: 36.2929, lng: 139.3744 };
    }
    
    /**
     * 地図ビューの切り替え
     */
    function toggleMapView() {
        const mapContainer = document.getElementById('venues-map-container');
        const listContainer = document.getElementById('venues-list');
        const toggleBtn = document.getElementById('toggle-map-view');
        
        if (mapContainer.style.display === 'none') {
            // 地図表示
            mapContainer.style.display = 'block';
            listContainer.style.display = 'none';
            toggleBtn.textContent = 'リスト表示';
            initializeMap();
        } else {
            // リスト表示
            mapContainer.style.display = 'none';
            listContainer.style.display = 'block';
            toggleBtn.textContent = '地図表示';
        }
    }
    
    /**
     * 地図の初期化
     */
    function initializeMap() {
        // 実際の実装では Google Maps JavaScript API を使用
        const mapContainer = document.getElementById('venues-map');
        if (!mapContainer) return;
        
        mapContainer.innerHTML = `
            <div class="map-placeholder">
                <p>🗺️ 地図表示機能は開発中です</p>
                <p>Google Maps APIの設定が必要です</p>
                <div class="venues-map-list">
                    ${venues.map(venue => `
                        <div class="map-venue-item">
                            <strong>${Utils.escapeHTML(venue.name)}</strong><br>
                            <small>${Utils.escapeHTML(venue.address)}</small><br>
                            <a href="${generateMapLink(venue.address)}" target="_blank" class="btn btn-sm btn-primary">地図で開く</a>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * Google Maps URLを生成
     */
    function generateMapLink(address) {
        if (!address) return '#';
        const encoded = encodeURIComponent(address);
        return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    }
    
    /**
     * フィルタリングされた会場を取得
     */
    function getFilteredVenues() {
        const searchTerm = document.getElementById('venue-search')?.value.toLowerCase() || '';
        
        return venues.filter(venue => {
            // タイプフィルター
            const typeMatch = currentFilters.type === 'all' || venue.type === currentFilters.type;
            
            // エリアフィルター（住所に基づく）
            const areaMatch = currentFilters.area === 'all' || 
                            (venue.address && venue.address.includes(currentFilters.area));
            
            // 検索フィルター
            const searchMatch = !searchTerm || 
                               venue.name.toLowerCase().includes(searchTerm) ||
                               (venue.address && venue.address.toLowerCase().includes(searchTerm));
            
            return typeMatch && areaMatch && searchMatch;
        }).sort((a, b) => {
            // ソート順: タイプ → 名前
            if (a.type !== b.type) {
                const typeOrder = { 'ground': 0, 'gym': 1, 'park': 2, 'other': 3 };
                return (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4);
            }
            
            return a.name.localeCompare(b.name);
        });
    }
    
    /**
     * タイプラベルを取得
     */
    function getTypeLabel(type) {
        const labels = {
            ground: 'グラウンド',
            gym: '体育館',
            park: '公園',
            other: 'その他'
        };
        return labels[type] || type;
    }
    
    /**
     * 統計情報の更新
     */
    function updateStats() {
        const totalVenues = document.getElementById('total-venues');
        const groundsCount = document.getElementById('grounds-count');
        const gymsCount = document.getElementById('gyms-count');
        const parksCount = document.getElementById('parks-count');
        
        if (totalVenues) {
            totalVenues.textContent = venues.length;
        }
        
        if (groundsCount) {
            groundsCount.textContent = venues.filter(v => v.type === 'ground').length;
        }
        
        if (gymsCount) {
            gymsCount.textContent = venues.filter(v => v.type === 'gym').length;
        }
        
        if (parksCount) {
            parksCount.textContent = venues.filter(v => v.type === 'park').length;
        }
    }
    
    /**
     * CSV形式で会場リストをエクスポート
     */
    Venues.exportVenues = function() {
        if (venues.length === 0) {
            UI.showAlert('エクスポートする会場がありません', 'warning');
            return;
        }
        
        const csvHeader = 'Name,Type,Address,Phone,Website,Capacity,Parking,Notes,Latitude,Longitude,Created\n';
        const csvData = venues.map(venue => {
            return [
                venue.name,
                getTypeLabel(venue.type),
                venue.address || '',
                venue.phone || '',
                venue.website || '',
                venue.capacity || '',
                venue.parking || '',
                venue.notes || '',
                venue.latitude || '',
                venue.longitude || '',
                venue.createdAt ? Utils.formatDate(new Date(venue.createdAt)) : ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        }).join('\n');
        
        const csvContent = csvHeader + csvData;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        link.href = URL.createObjectURL(blob);
        link.download = `fc-ojima-venues-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        UI.showAlert('会場リストをエクスポートしました', 'success');
    };
    
    /**
     * 表示の更新（外部から呼び出し可能）
     */
    Venues.updateDisplay = updateDisplay;
    
    /**
     * クリーンアップ
     */
    Venues.destroy = function() {
        if (venuesUnsubscribe) {
            venuesUnsubscribe();
            venuesUnsubscribe = null;
        }
    };
    
    // ページから離れる時のクリーンアップ
    window.addEventListener('beforeunload', Venues.destroy);
    
})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function() {
    if (typeof FCOjima !== 'undefined' && FCOjima.Hub && FCOjima.Hub.Venues) {
        FCOjima.Hub.Venues.init();
    }
});