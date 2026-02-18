/**
 * FC尾島ジュニア - 会場管理
 * 会場情報の管理に関する機能を提供
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Venues = FCOjima.Hub.Venues || {};

// 会場管理モジュール
(function(app) {
    const Venues = app.Hub.Venues;

    /**
     * 会場機能の初期化
     */
    Venues.init = function() {
        console.log('会場機能を初期化しています...');
        this.setupEventListeners();
        this.renderVenuesList();
        console.log('会場機能の初期化が完了しました');
    };

    /**
     * イベントリスナーの設定
     */
    Venues.setupEventListeners = function() {
        const addVenueBtn = document.getElementById('add-venue');
        if (addVenueBtn) {
            addVenueBtn.addEventListener('click', () => this.openAddVenueModal());
        }

        const venueLogsBtn = document.getElementById('venues-logs');
        if (venueLogsBtn) {
            venueLogsBtn.addEventListener('click', () => app.Hub.openLogsModal('venues'));
        }

        const searchInput = document.getElementById('venue-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderVenuesList());
        }

        const typeFilter = document.getElementById('venue-type-filter');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => this.renderVenuesList());
        }

        // 会場追加フォームの保存ボタン
        const venueForm = document.getElementById('venue-form');
        if (venueForm) {
            venueForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveVenue();
            });
        }
    };

    /**
     * 会場リストの描画
     */
    Venues.renderVenuesList = function() {
        const venues = app.Hub.venues || [];
        const listEl = document.getElementById('venues-list');
        if (!listEl) return;

        const searchInput = document.getElementById('venue-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        const filtered = venues.filter(v =>
            !searchTerm ||
            (v.name && v.name.toLowerCase().includes(searchTerm)) ||
            (v.address && v.address.toLowerCase().includes(searchTerm))
        );

        if (filtered.length === 0) {
            listEl.innerHTML = app.UI ? app.UI.createAlert('info', '会場が登録されていません。') : '<p>会場が登録されていません。</p>';
            return;
        }

        const sorted = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));

        listEl.innerHTML = sorted.map(venue => `
            <div class="list-item venue-item" data-id="${venue.id}">
                <div class="venue-info">
                    <div class="venue-name">${app.UI ? app.UI.escapeHTML(venue.name) : venue.name}</div>
                    <div class="venue-address">${app.UI ? app.UI.escapeHTML(venue.address || '') : (venue.address || '')}</div>
                    ${venue.notes ? `<div class="venue-notes">${app.UI ? app.UI.escapeHTML(venue.notes) : venue.notes}</div>` : ''}
                </div>
                <div class="venue-actions">
                    <button type="button" class="secondary-button edit-venue" data-id="${venue.id}">編集</button>
                    <button type="button" class="secondary-button map-venue" data-id="${venue.id}">地図</button>
                    <button type="button" class="delete-button delete-venue" data-id="${venue.id}">削除</button>
                </div>
            </div>
        `).join('');

        listEl.querySelectorAll('.edit-venue').forEach(btn => {
            btn.addEventListener('click', () => this.openAddVenueModal(parseInt(btn.dataset.id)));
        });
        listEl.querySelectorAll('.map-venue').forEach(btn => {
            btn.addEventListener('click', () => this.openMap(parseInt(btn.dataset.id)));
        });
        listEl.querySelectorAll('.delete-venue').forEach(btn => {
            btn.addEventListener('click', () => this.deleteVenue(parseInt(btn.dataset.id)));
        });
    };

    /**
     * 会場選択モーダルを開く（削除用）
     */
    Venues.openVenueSelectForDelete = function() {
        console.log('会場選択モーダル（削除用）を開きます...');

        const venues = app.Hub.venues || [];
        const UI = app.UI;

        const logsContent = document.getElementById('logs-content');
        if (!logsContent) return;

        logsContent.innerHTML = '';
        const heading = document.createElement('h3');
        heading.textContent = '削除する会場を選択';
        logsContent.appendChild(heading);

        const selectList = document.createElement('div');
        selectList.className = 'select-list';

        if (venues.length === 0) {
            selectList.innerHTML = UI ? UI.createAlert('info', '登録されている会場はありません。') : '<p>登録されている会場はありません。</p>';
        } else {
            const sortedVenues = [...venues].sort((a, b) =>
                (a.name || '').localeCompare(b.name || '', 'ja')
            );

            sortedVenues.forEach(venue => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.textContent = venue.name;

                item.addEventListener('click', () => {
                    if (UI && UI.showConfirm(`本当に「${venue.name}」を削除しますか？`)) {
                        this.deleteVenue(venue.id);
                    }
                    if (UI) UI.closeModal('logs-modal');
                });

                selectList.appendChild(item);
            });
        }

        logsContent.appendChild(selectList);
        if (UI) UI.openModal('logs-modal');
    };

    /**
     * 会場追加/編集モーダルを開く
     * @param {number} venueId - 会場ID（編集時のみ指定、新規追加時はnull）
     */
    Venues.openAddVenueModal = function(venueId = null) {
        const venues = app.Hub.venues || [];
        const UI = app.UI;

        const titleEl = document.querySelector('#venue-modal h2');
        if (titleEl) titleEl.textContent = venueId ? '会場を編集' : '会場を追加';

        const form = document.getElementById('venue-form');
        if (form) {
            form.reset();
            form.removeAttribute('data-venue-id');
        }

        if (venueId) {
            const venue = venues.find(v => v.id === venueId);
            if (venue && form) {
                form.setAttribute('data-venue-id', venue.id);
                const nameEl = document.getElementById('venue-name');
                const addressEl = document.getElementById('venue-address');
                const notesEl = document.getElementById('venue-notes');
                if (nameEl) nameEl.value = venue.name || '';
                if (addressEl) addressEl.value = venue.address || '';
                if (notesEl) notesEl.value = venue.notes || '';
            }
        }

        if (UI) UI.openModal('venue-modal');
    };

    /**
     * 新規/編集会場を保存
     */
    Venues.saveVenue = function() {
        const venues = app.Hub.venues || [];
        const UI = app.UI;
        const Storage = app.Storage;

        const nameEl = document.getElementById('venue-name');
        const addressEl = document.getElementById('venue-address');
        const notesEl = document.getElementById('venue-notes');

        const name = nameEl ? nameEl.value.trim() : '';
        const address = addressEl ? addressEl.value.trim() : '';
        const notes = notesEl ? notesEl.value.trim() : '';

        if (!name || !address) {
            if (UI) UI.showAlert('会場名と住所は必須です');
            return;
        }

        const form = document.getElementById('venue-form');
        const venueFormId = form ? form.getAttribute('data-venue-id') : null;

        if (venueFormId) {
            const index = venues.findIndex(v => v.id === parseInt(venueFormId));
            if (index !== -1) {
                venues[index] = { id: parseInt(venueFormId), name, address, notes };
                app.Hub.logs = app.Storage.addLog('venues', '会場更新', `「${name}」`, app.Hub.logs);
                console.log(`会場を更新しました: ${name}`);
            }
        } else {
            const newId = venues.length > 0 ? Math.max(...venues.map(v => v.id)) + 1 : 1;
            venues.push({ id: newId, name, address, notes });
            app.Hub.logs = app.Storage.addLog('venues', '会場追加', `「${name}」`, app.Hub.logs);
            console.log(`新しい会場を登録しました: ${name}`);
        }

        app.Hub.venues = venues;
        if (Storage && Storage.saveVenues) Storage.saveVenues(venues);
        this.renderVenuesList();

        if (UI) UI.closeModal('venue-modal');
        if (form) {
            form.reset();
            form.removeAttribute('data-venue-id');
        }
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
     * @param {number} venueId - 会場ID
     */
    Venues.deleteVenue = function(venueId) {
        const venues = app.Hub.venues || [];
        const UI = app.UI;
        const Storage = app.Storage;

        const venue = venues.find(v => v.id === venueId);
        if (!venue) return;

        if (!UI || UI.showConfirm(`会場「${venue.name}」を削除してもよろしいですか？`)) {
            app.Hub.venues = venues.filter(v => v.id !== venueId);
            app.Hub.logs = app.Storage.addLog('venues', '会場削除', `「${venue.name}」`, app.Hub.logs);
            console.log(`会場を削除しました: ${venue.name}`);
            if (Storage && Storage.saveVenues) Storage.saveVenues(app.Hub.venues);
            this.renderVenuesList();
        }
    };

    /**
     * 地図を表示
     * @param {number} venueId - 会場ID
     */
    Venues.openMap = function(venueId) {
        const venues = app.Hub.venues || [];
        const venue = venues.find(v => v.id === venueId);
        if (!venue) return;

        const address = encodeURIComponent(venue.address);
        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
        if (app.Utils && app.Utils.openNewTab) {
            app.Utils.openNewTab(mapUrl);
        } else {
            window.open(mapUrl, '_blank');
        }
    };

    /**
     * 会場選択モーダルを開く（カレンダー等での会場設定用）
     * @param {string} target - 設定先（'venue'または'meeting'）
     */
    Venues.openVenueSelect = function(target) {
        const venues = app.Hub.venues || [];
        const UI = app.UI;

        const selectList = document.getElementById('venue-select-list');
        if (!selectList) return;

        selectList.innerHTML = '';

        if (venues.length === 0) {
            selectList.innerHTML = UI ? UI.createAlert('info', '登録されている会場はありません。') : '<p>登録されている会場はありません。</p>';
        } else {
            const sortedVenues = [...venues].sort((a, b) =>
                (a.name || '').localeCompare(b.name || '', 'ja')
            );

            sortedVenues.forEach(venue => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.textContent = venue.name;

                item.addEventListener('click', function() {
                    if (target === 'venue') {
                        const el = document.getElementById('event-venue');
                        if (el) el.value = venue.name;
                    } else if (target === 'meeting') {
                        const el = document.getElementById('event-meeting-place');
                        if (el) el.value = venue.name;
                    }
                    if (UI) UI.closeModal('venue-select-modal');
                });

                selectList.appendChild(item);
            });
        }

        if (UI) UI.openModal('venue-select-modal');
    };

})(window.FCOjima);
