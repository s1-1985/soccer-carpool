/**
 * FC尾島ジュニア - 会場管理
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Venues = FCOjima.Hub.Venues || {};

(function(app) {
    var Venues = app.Hub.Venues;
    var UI = app.UI;
    var Storage = app.Storage;

    /**
     * 会場管理機能の初期化
     */
    Venues.init = function() {
        console.log('会場管理機能を初期化しています...');
        this.renderVenueList();
        this.setupEventListeners();
        console.log('会場管理機能の初期化が完了しました');
    };

    /**
     * 地図ピンボタン・現在地ボタンのリスナーを設定
     */
    Venues.setupMapListeners = function() {
        // 地図でピンを指定ボタン
        var mapPinBtn = document.getElementById('venue-map-pin');
        if (mapPinBtn) {
            mapPinBtn.addEventListener('click', function() {
                // Google Mapsを開く（座標はURLから取得可能）
                var addr = (document.getElementById('venue-address') || {}).value || '';
                var mapsUrl = addr
                    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr)
                    : 'https://www.google.com/maps/';
                window.open(mapsUrl, '_blank');

                // 座標手入力エリアを表示
                Venues.showLatLngInput();
                UI.showAlert('Google Mapsで場所を長押しするとURL・座標が表示されます。\n緯度・経度をコピーして下の入力欄に貼り付けてください。', 'info');
            });
        }

        // 現在地ボタン
        var currentLocBtn = document.getElementById('venue-current-location');
        if (currentLocBtn) {
            currentLocBtn.addEventListener('click', function() {
                if (!navigator.geolocation) {
                    UI.showAlert('このブラウザは位置情報に対応していません', 'warning');
                    return;
                }
                currentLocBtn.textContent = '取得中...';
                currentLocBtn.disabled = true;
                navigator.geolocation.getCurrentPosition(
                    function(pos) {
                        var lat = pos.coords.latitude.toFixed(6);
                        var lng = pos.coords.longitude.toFixed(6);
                        document.getElementById('venue-lat').value = lat;
                        document.getElementById('venue-lng').value = lng;
                        Venues.showMapPreview(lat, lng);
                        currentLocBtn.textContent = '📡 現在地を使用';
                        currentLocBtn.disabled = false;
                        UI.showAlert('現在地を取得しました（緯度: ' + lat + '、経度: ' + lng + '）', 'success');
                    },
                    function(err) {
                        currentLocBtn.textContent = '📡 現在地を使用';
                        currentLocBtn.disabled = false;
                        UI.showAlert('位置情報の取得に失敗しました: ' + err.message, 'error');
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });
        }
    };

    /**
     * 緯度経度の手入力エリアを表示
     */
    Venues.showLatLngInput = function() {
        var preview = document.getElementById('venue-map-preview');
        if (!preview) return;
        if (document.getElementById('venue-latlng-input')) return; // 既に表示済み

        var inputArea = document.createElement('div');
        inputArea.id = 'venue-latlng-input';
        inputArea.style.marginTop = '8px';
        inputArea.innerHTML =
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                '<div style="flex:1;min-width:120px;">' +
                    '<label style="font-size:12px;color:#666;">緯度（Latitude）</label>' +
                    '<input type="number" step="0.000001" id="venue-lat-input" placeholder="例: 36.289553" class="form-control" style="margin-top:2px;">' +
                '</div>' +
                '<div style="flex:1;min-width:120px;">' +
                    '<label style="font-size:12px;color:#666;">経度（Longitude）</label>' +
                    '<input type="number" step="0.000001" id="venue-lng-input" placeholder="例: 139.365439" class="form-control" style="margin-top:2px;">' +
                '</div>' +
            '</div>' +
            '<button type="button" id="venue-apply-latlng" class="secondary-button" style="margin-top:6px;font-size:13px;">座標を適用</button>';
        preview.parentElement.insertBefore(inputArea, preview);
        preview.style.display = 'block';

        document.getElementById('venue-apply-latlng').addEventListener('click', function() {
            var latVal = document.getElementById('venue-lat-input').value;
            var lngVal = document.getElementById('venue-lng-input').value;
            if (!latVal || !lngVal) {
                UI.showAlert('緯度と経度を両方入力してください', 'warning');
                return;
            }
            document.getElementById('venue-lat').value = latVal;
            document.getElementById('venue-lng').value = lngVal;
            Venues.showMapPreview(latVal, lngVal);
        });
    };

    /**
     * 地図プレビューを表示
     */
    Venues.showMapPreview = function(lat, lng) {
        var preview = document.getElementById('venue-map-preview');
        if (!preview) return;
        preview.style.display = 'block';
        preview.innerHTML =
            '<a href="https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng + '" target="_blank" ' +
            'style="display:block;background:#e8f4fd;border:1px solid #bee5f5;border-radius:6px;padding:8px;font-size:13px;text-decoration:none;color:#0066cc;">' +
            '📍 緯度: ' + lat + '  経度: ' + lng + '<br>' +
            '<span style="font-size:11px;color:#888;">↑ タップしてGoogle Mapsで確認</span>' +
            '</a>';
    };

    /**
     * イベントリスナーを設定
     */
    Venues.setupEventListeners = function() {
        // 地図関連ボタン
        Venues.setupMapListeners();

        // 会場追加ボタン
        var addBtn = document.getElementById('add-venue');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                Venues.openAddVenueModal();
            });
        }

        // フローティング追加ボタン（会場登録タブ表示時）
        var floatingBtn = document.getElementById('floating-add-button');
        if (floatingBtn) {
            // floating button は index.html のインラインスクリプトで制御
        }

        // 会場フォーム送信
        var venueForm = document.getElementById('venue-form');
        if (venueForm) {
            venueForm.addEventListener('submit', function(e) {
                e.preventDefault();
                Venues.saveVenue();
            });
        }

        // キャンセルボタン
        var cancelBtn = document.getElementById('cancel-venue');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                UI.closeModal('venue-modal');
            });
        }

        // ログ表示ボタン
        var logsBtn = document.getElementById('venues-logs');
        if (logsBtn) {
            logsBtn.addEventListener('click', function() {
                app.Hub.openLogsModal('venues');
            });
        }

        // 検索
        var searchInput = document.getElementById('venue-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                Venues.filterVenues(this.value, document.getElementById('venue-type-filter') ? document.getElementById('venue-type-filter').value : 'all');
            });
        }

        var typeFilter = document.getElementById('venue-type-filter');
        if (typeFilter) {
            typeFilter.addEventListener('change', function() {
                Venues.filterVenues(document.getElementById('venue-search') ? document.getElementById('venue-search').value : '', this.value);
            });
        }
    };

    /**
     * 会場一覧をレンダリング（カード形式）
     */
    Venues.renderVenueList = function() {
        var venues = app.Hub.venues || [];
        var listEl = document.getElementById('venues-list');
        if (!listEl) return;

        if (venues.length === 0) {
            listEl.innerHTML = UI.createAlert('info', '登録された会場はありません。');
            return;
        }

        listEl.innerHTML = '';
        var typeLabels = { ground: 'グラウンド', gym: '体育館', park: '公園', other: 'その他' };

        venues.forEach(function(venue) {
            var card = document.createElement('div');
            card.className = 'venue-card';
            card.dataset.venueId = venue.id;
            card.dataset.venueName = venue.name || '';
            card.dataset.venueType = venue.type || '';

            var typeLabel = typeLabels[venue.type] || venue.type || '';

            // 地図リンクを生成（lat/lng優先、なければ住所）
            var mapsQuery = (venue.lat && venue.lng)
                ? venue.lat + ',' + venue.lng
                : (venue.address ? encodeURIComponent(venue.address) : '');
            var mapsUrl = mapsQuery
                ? 'https://www.google.com/maps/search/?api=1&query=' + mapsQuery
                : '';
            var locationHtml = '';
            if (venue.lat && venue.lng) {
                locationHtml = '<div class="venue-address">📍 緯度: ' + venue.lat + ' 経度: ' + venue.lng + '</div>';
                if (venue.address) locationHtml += '<div style="font-size:12px;color:#888;">' + UI.escapeHTML(venue.address) + '</div>';
            } else if (venue.address) {
                locationHtml = '<div class="venue-address">📍 ' + UI.escapeHTML(venue.address) + '</div>';
            }

            card.innerHTML =
                '<div class="venue-card-header">' +
                    '<h3 class="venue-name">' + UI.escapeHTML(venue.name || '') + '</h3>' +
                    (typeLabel ? '<span class="venue-type-badge">' + UI.escapeHTML(typeLabel) + '</span>' : '') +
                '</div>' +
                '<div class="venue-card-body">' +
                    locationHtml +
                    (venue.notes ? '<div class="venue-notes">' + UI.escapeHTML(venue.notes) + '</div>' : '') +
                '</div>' +
                '<div class="venue-card-actions">' +
                    (mapsUrl ? '<button type="button" class="secondary-button" onclick="window.open(\'' + mapsUrl + '\',\'_blank\')">地図を開く</button>' : '') +
                    '<button type="button" class="secondary-button" onclick="FCOjima.Hub.Venues.editVenue(\'' + venue.id + '\')">編集</button>' +
                    '<button type="button" class="delete-button" onclick="FCOjima.Hub.Venues.deleteVenue(\'' + venue.id + '\')">削除</button>' +
                '</div>';

            listEl.appendChild(card);
        });
    };

    // 後方互換性のため updateVenueList も用意
    Venues.updateVenueList = Venues.renderVenueList;

    /**
     * 会場フィルタリング
     */
    Venues.filterVenues = function(searchText, typeFilter) {
        var cards = document.querySelectorAll('.venue-card');
        var text = (searchText || '').toLowerCase();
        var type = typeFilter || 'all';

        cards.forEach(function(card) {
            var name = (card.dataset.venueName || '').toLowerCase();
            var cardType = card.dataset.venueType || '';
            var matchText = !text || name.includes(text);
            var matchType = type === 'all' || cardType === type;
            card.style.display = (matchText && matchType) ? '' : 'none';
        });
    };

    /**
     * 会場追加モーダルを開く
     */
    Venues.openAddVenueModal = function(venueId) {
        var venues = app.Hub.venues || [];

        var titleEl = document.querySelector('#venue-modal h2');
        if (titleEl) titleEl.textContent = venueId ? '会場を編集' : '会場を追加';

        var form = document.getElementById('venue-form');
        if (form) form.reset();

        // lat/lng の手入力エリアと古いプレビューをリセット
        var oldInputArea = document.getElementById('venue-latlng-input');
        if (oldInputArea) oldInputArea.remove();
        var mapPreview = document.getElementById('venue-map-preview');
        if (mapPreview) { mapPreview.style.display = 'none'; mapPreview.innerHTML = ''; }
        var latEl = document.getElementById('venue-lat');
        var lngEl = document.getElementById('venue-lng');
        if (latEl) latEl.value = '';
        if (lngEl) lngEl.value = '';

        if (venueId) {
            var venue = venues.find(function(v) { return String(v.id) === String(venueId); });
            if (venue) {
                form.setAttribute('data-venue-id', venue.id);
                document.getElementById('venue-name').value = venue.name || '';
                var typeEl = document.getElementById('venue-type');
                if (typeEl) typeEl.value = venue.type || 'ground';
                document.getElementById('venue-address').value = venue.address || '';
                document.getElementById('venue-notes').value = venue.notes || '';
                if (venue.lat && latEl) latEl.value = venue.lat;
                if (venue.lng && lngEl) lngEl.value = venue.lng;
                if (venue.lat && venue.lng) Venues.showMapPreview(venue.lat, venue.lng);
            }
        } else {
            if (form) form.removeAttribute('data-venue-id');
        }

        UI.openModal('venue-modal');
    };

    /**
     * 会場を保存
     */
    Venues.saveVenue = function() {
        var venues = app.Hub.venues || [];
        var logs = app.Hub.logs || [];

        var name = document.getElementById('venue-name').value.trim();
        var typeEl = document.getElementById('venue-type');
        var type = typeEl ? typeEl.value : 'other';
        var address = document.getElementById('venue-address').value.trim();
        var notes = document.getElementById('venue-notes').value.trim();
        var latEl = document.getElementById('venue-lat');
        var lngEl = document.getElementById('venue-lng');
        var lat = latEl && latEl.value ? parseFloat(latEl.value) : null;
        var lng = lngEl && lngEl.value ? parseFloat(lngEl.value) : null;

        if (!name) {
            UI.showAlert('会場名は必須です', 'warning');
            return;
        }
        if (!address && (!lat || !lng)) {
            UI.showAlert('住所か地図座標のいずれかを入力してください', 'warning');
            return;
        }

        var form = document.getElementById('venue-form');
        var venueFormId = form ? form.getAttribute('data-venue-id') : null;

        var user = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : 'システム';

        if (venueFormId) {
            var index = venues.findIndex(function(v) { return String(v.id) === String(venueFormId); });
            if (index !== -1) {
                venues[index] = { id: venues[index].id, name: name, type: type, address: address, lat: lat, lng: lng, notes: notes };
                app.Hub.logs = Storage.addLog('venues', '会場更新', '「' + name + '」', logs);
            }
        } else {
            var newId = venues.length > 0 ? Math.max.apply(null, venues.map(function(v) { return parseInt(v.id) || 0; })) + 1 : 1;
            venues.push({ id: newId, name: name, type: type, address: address, lat: lat, lng: lng, notes: notes });
            app.Hub.venues = venues;
            app.Hub.logs = Storage.addLog('venues', '会場追加', '「' + name + '」', logs);
        }

        Storage.saveVenues(venues);
        this.renderVenueList();

        UI.closeModal('venue-modal');
        if (form) {
            form.reset();
            form.removeAttribute('data-venue-id');
        }
        UI.showAlert('会場を保存しました', 'success');
    };

    /**
     * 会場編集
     */
    Venues.editVenue = function(venueId) {
        this.openAddVenueModal(venueId);
    };

    /**
     * 会場削除
     */
    Venues.deleteVenue = function(venueId) {
        var venues = app.Hub.venues || [];
        var venue = venues.find(function(v) { return String(v.id) === String(venueId); });
        if (!venue) return;

        if (!UI.showConfirm('会場「' + venue.name + '」を削除してもよろしいですか？')) return;

        var user = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : 'システム';
        app.Hub.logs = Storage.addLog('venues', '会場削除', '「' + venue.name + '」', app.Hub.logs || []);

        app.Hub.venues = venues.filter(function(v) { return String(v.id) !== String(venueId); });
        Storage.saveVenues(app.Hub.venues);
        this.renderVenueList();
        UI.showAlert('会場を削除しました', 'success');
    };

    /**
     * 会場選択モーダルを開く（イベント作成時）
     * @param {string} target - 'venue' または 'meeting'
     */
    Venues.openVenueSelect = function(target) {
        var venues = app.Hub.venues || [];
        var selectList = document.getElementById('venue-select-list');
        if (!selectList) return;

        selectList.innerHTML = '';

        if (venues.length === 0) {
            selectList.innerHTML = UI.createAlert('info', '登録されている会場はありません。');
        } else {
            var sorted = venues.slice().sort(function(a, b) { return (a.name || '').localeCompare(b.name || '', 'ja'); });

            sorted.forEach(function(venue) {
                var item = document.createElement('div');
                item.className = 'list-item';
                item.textContent = venue.name;

                item.addEventListener('click', function() {
                    if (target === 'venue') {
                        var el = document.getElementById('event-venue');
                        if (el) el.value = venue.name;
                    } else if (target === 'meeting') {
                        var el = document.getElementById('event-meeting-place');
                        if (el) el.value = venue.name;
                    }
                    UI.closeModal('venue-select-modal');
                });

                selectList.appendChild(item);
            });
        }

        UI.openModal('venue-select-modal');
    };

})(window.FCOjima);
