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
     * 地図確認ボタンのリスナーを設定
     */
    Venues.setupMapListeners = function() {
        // 「地図を開いて住所を確認」ボタン
        var mapOpenBtn = document.getElementById('venue-map-open');
        if (mapOpenBtn) {
            mapOpenBtn.addEventListener('click', function() {
                var addr = (document.getElementById('venue-address') || {}).value || '';
                var mapsUrl = addr
                    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr)
                    : 'https://www.google.com/maps/';
                window.open(mapsUrl, '_blank');
            });
        }
    };

    /**
     * イベントリスナーを設定
     */
    Venues.setupEventListeners = function() {
        Venues.setupMapListeners();

        var addBtn = document.getElementById('add-venue');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                Venues.openAddVenueModal();
            });
        }

        var venueForm = document.getElementById('venue-form');
        if (venueForm) {
            venueForm.addEventListener('submit', function(e) {
                e.preventDefault();
                Venues.saveVenue();
            });
        }

        var cancelBtn = document.getElementById('cancel-venue');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                UI.closeModal('venue-modal');
            });
        }

        var logsBtn = document.getElementById('venues-logs');
        if (logsBtn) {
            logsBtn.addEventListener('click', function() {
                app.Hub.openLogsModal('venues');
            });
        }

        var searchInput = document.getElementById('venue-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                Venues.filterVenues(this.value);
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

        var currentUser = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : '';
        var isManager = app.Auth && app.Auth.isManager && app.Auth.isManager();

        venues.forEach(function(venue) {
            var card = document.createElement('div');
            card.className = 'venue-card';
            card.dataset.venueId = venue.id;
            card.dataset.venueName = venue.name || '';

            // 地図リンクを生成（住所ベース）
            var mapsQuery = venue.address ? encodeURIComponent(venue.address) : encodeURIComponent(venue.name || '');
            var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + mapsQuery;
            var locationHtml = venue.address
                ? '<div class="venue-address">📍 ' + UI.escapeHTML(venue.address) + '</div>'
                : '';

            // 削除ボタンは登録者本人 or 権限者のみ
            var canDelete = isManager || (venue.createdBy && currentUser && venue.createdBy === currentUser);

            card.innerHTML =
                '<div class="venue-card-header">' +
                    '<h3 class="venue-name">' + UI.escapeHTML(venue.name || '') + '</h3>' +
                '</div>' +
                '<div class="venue-card-body">' +
                    locationHtml +
                    (venue.notes ? '<div class="venue-notes">' + UI.escapeHTML(venue.notes) + '</div>' : '') +
                '</div>' +
                '<div class="venue-card-actions">' +
                    '<button type="button" class="secondary-button" onclick="window.open(\'' + mapsUrl + '\',\'_blank\')">地図を開く</button>' +
                    '<button type="button" class="secondary-button" onclick="FCOjima.Hub.Venues.editVenue(\'' + venue.id + '\')">編集</button>' +
                    (canDelete ? '<button type="button" class="delete-button" onclick="FCOjima.Hub.Venues.deleteVenue(\'' + venue.id + '\')">削除</button>' : '') +
                '</div>';

            listEl.appendChild(card);
        });
    };

    Venues.updateVenueList = Venues.renderVenueList;

    /**
     * 会場フィルタリング（名前のみ）
     */
    Venues.filterVenues = function(searchText) {
        var cards = document.querySelectorAll('.venue-card');
        var text = (searchText || '').toLowerCase();

        cards.forEach(function(card) {
            var name = (card.dataset.venueName || '').toLowerCase();
            card.style.display = (!text || name.includes(text)) ? '' : 'none';
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

        if (venueId) {
            var venue = venues.find(function(v) { return String(v.id) === String(venueId); });
            if (venue) {
                form.setAttribute('data-venue-id', venue.id);
                document.getElementById('venue-name').value = venue.name || '';
                document.getElementById('venue-address').value = venue.address || '';
                document.getElementById('venue-notes').value = venue.notes || '';
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
        var address = document.getElementById('venue-address').value.trim();
        var notes = document.getElementById('venue-notes').value.trim();

        if (!name) {
            UI.showAlert('会場名は必須です', 'warning');
            return;
        }

        var form = document.getElementById('venue-form');
        var venueFormId = form ? form.getAttribute('data-venue-id') : null;
        var currentUser = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : 'システム';

        if (venueFormId) {
            var index = venues.findIndex(function(v) { return String(v.id) === String(venueFormId); });
            if (index !== -1) {
                var orig = venues[index];
                venues[index] = { id: orig.id, name: name, address: address, notes: notes, createdBy: orig.createdBy || currentUser };
                app.Hub.logs = Storage.addLog('venues', '会場更新', '「' + name + '」', logs);
            }
        } else {
            var newId = venues.length > 0 ? Math.max.apply(null, venues.map(function(v) { return parseInt(v.id) || 0; })) + 1 : 1;
            venues.push({ id: newId, name: name, address: address, notes: notes, createdBy: currentUser });
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
     * 会場削除（権限チェック）
     */
    Venues.deleteVenue = function(venueId) {
        var venues = app.Hub.venues || [];
        var venue = venues.find(function(v) { return String(v.id) === String(venueId); });
        if (!venue) return;

        var currentUser = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : '';
        var isManager = app.Auth && app.Auth.isManager && app.Auth.isManager();
        var canDelete = isManager || (venue.createdBy && currentUser && venue.createdBy === currentUser);

        if (!canDelete) {
            UI.showAlert('この会場を削除する権限がありません', 'warning');
            return;
        }

        if (!UI.showConfirm('会場「' + venue.name + '」を削除してもよろしいですか？')) return;

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
