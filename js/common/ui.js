/**
 * FC尾島ジュニア - 共通UI操作
 * 複数画面で共通して使用するUI操作機能
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * タブ切り替え関数
 * @param {Event} evt - イベントオブジェクト
 * @param {string} tabName - 表示するタブのID
 */
FCOjima.UI.openTab = function(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    
    const tablinks = document.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
};

/**
 * モーダルを開く
 * @param {string} modalId - モーダルのID
 */
FCOjima.UI.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "block";
    }
};

/**
 * モーダルを閉じる
 * @param {string} modalId - モーダルのID
 */
FCOjima.UI.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "none";
        
        // モーダル内のフォームがあればリセット
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => {
            form.reset();
            // data属性の削除（編集モードの解除）
            if (form.hasAttribute('data-member-id')) {
                form.removeAttribute('data-member-id');
            }
            if (form.hasAttribute('data-venue-id')) {
                form.removeAttribute('data-venue-id');
            }
            if (form.hasAttribute('data-event-id')) {
                form.removeAttribute('data-event-id');
            }
        });
    }
};

/**
 * 全てのモーダルを閉じる
 */
FCOjima.UI.closeAllModals = function() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        // モーダル内のフォームがあればリセット
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => {
            form.reset();
            // data属性の削除（編集モードの解除）
            if (form.hasAttribute('data-member-id')) {
                form.removeAttribute('data-member-id');
            }
            if (form.hasAttribute('data-venue-id')) {
                form.removeAttribute('data-venue-id');
            }
            if (form.hasAttribute('data-event-id')) {
                form.removeAttribute('data-event-id');
            }
        });
        
        modal.style.display = "none";
    });
};

/**
 * アラートメッセージを表示
 * @param {string} message - 表示するメッセージ
 */
FCOjima.UI.showAlert = function(message) {
    alert(message); // 将来的にはカスタムアラートUIに置き換え可能
};

/**
 * 確認ダイアログを表示
 * @param {string} message - 表示するメッセージ
 * @returns {boolean} ユーザーの選択結果
 */
FCOjima.UI.showConfirm = function(message) {
    return confirm(message); // 将来的にはカスタム確認UIに置き換え可能
};

/**
 * 入力プロンプトを表示
 * @param {string} message - 表示するメッセージ
 * @param {string} defaultValue - デフォルト値
 * @returns {string|null} ユーザーの入力または「キャンセル」の場合はnull
 */
FCOjima.UI.showPrompt = function(message, defaultValue = '') {
    return prompt(message, defaultValue); // 将来的にはカスタムプロンプトUIに置き換え可能
};

/**
 * ドラッグ可能な要素のセットアップ
 * @param {HTMLElement} element - ドラッグ可能にする要素
 * @param {string} data - ドラッグデータ
 */
FCOjima.UI.setupDraggable = function(element, data) {
    element.draggable = true;
    
    element.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', data);
        e.dataTransfer.effectAllowed = 'move';
    });
};

/**
 * ドロップターゲットのセットアップ
 * @param {HTMLElement} element - ドロップ先の要素
 * @param {Function} dropHandler - ドロップ時の処理関数
 */
FCOjima.UI.setupDropTarget = function(element, dropHandler) {
    element.addEventListener('dragover', function(e) {
        e.preventDefault(); // ドロップを許可
        e.dataTransfer.dropEffect = 'move';
    });
    
    element.addEventListener('drop', function(e) {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        dropHandler(data, this);
    });
};

/**
 * モーダル初期化（閉じるボタン、外部クリック時の閉じる処理）
 */
FCOjima.UI.initModals = function() {
    // モーダルを閉じるボタンのイベントリスナー
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            FCOjima.UI.closeAllModals();
        });
    });
    
    // モーダル外クリックでモーダルを閉じる
    window.addEventListener('click', function(event) {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // キャンセルボタンのイベントリスナー
    const cancelButtons = document.querySelectorAll('[id$="-cancel"]');
    cancelButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const modalId = this.closest('.modal').id;
            FCOjima.UI.closeModal(modalId);
        });
    });
};

/**
 * フォームをクリア
 * @param {string} formId - フォームのID
 */
FCOjima.UI.clearForm = function(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        
        // data属性の削除（編集モードの解除）
        if (form.hasAttribute('data-member-id')) {
            form.removeAttribute('data-member-id');
        }
        if (form.hasAttribute('data-venue-id')) {
            form.removeAttribute('data-venue-id');
        }
        if (form.hasAttribute('data-event-id')) {
            form.removeAttribute('data-event-id');
        }
    }
};

/**
 * HTMLエスケープ（XSS対策）
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
FCOjima.UI.escapeHTML = function(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * テーブルをクリア
 * @param {string} tableId - テーブルのID
 */
FCOjima.UI.clearTable = function(tableId) {
    const table = document.getElementById(tableId);
    if (table) {
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = '';
        }
    }
};

/**
 * 要素の内容を変更
 * @param {string} elementId - 要素のID
 * @param {string} content - 設定する内容（HTML）
 */
FCOjima.UI.setContent = function(elementId, content) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = content;
    }
};

/**
 * 要素を表示/非表示
 * @param {string} elementId - 要素のID
 * @param {boolean} visible - 表示するかどうか
 */
FCOjima.UI.setVisible = function(elementId, visible) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = visible ? 'block' : 'none';
    }
};

/**
 * アラート要素を生成
 * @param {string} type - アラートタイプ（info, success, warning, danger）
 * @param {string} message - 表示するメッセージ
 * @returns {string} HTML文字列
 */
FCOjima.UI.createAlert = function(type, message) {
    return `<div class="alert ${type}">${message}</div>`;
};

/**
 * バッジ要素を生成
 * @param {string} type - バッジタイプ（success, warning, danger）
 * @param {string} text - 表示するテキスト
 * @returns {string} HTML文字列
 */
FCOjima.UI.createBadge = function(type, text) {
    return `<span class="badge badge-${type}">${text}</span>`;
};

/**
 * 画像要素を生成
 * @param {string} src - 画像のソースURL
 * @param {string} alt - 代替テキスト
 * @param {Object} options - オプション（width, height, className）
 * @returns {string} HTML文字列
 */
FCOjima.UI.createImage = function(src, alt, options = {}) {
    const width = options.width ? ` width="${options.width}"` : '';
    const height = options.height ? ` height="${options.height}"` : '';
    const className = options.className ? ` class="${options.className}"` : '';
    
    return `<img src="${src}" alt="${alt}"${width}${height}${className}>`;
};

/**
 * 共有ボタンを生成（LINEへの共有）
 * @param {string} message - 共有するメッセージ
 * @param {string} buttonText - ボタンのテキスト（デフォルトは「LINEで共有」）
 * @returns {string} HTMLボタン要素の文字列
 */
FCOjima.UI.createShareButton = function(message, buttonText = 'LINEで共有') {
    const encodedMessage = encodeURIComponent(message);
    return `<button type="button" class="share-button" onclick="FCOjima.Utils.shareViaLINE('${encodedMessage}')">${buttonText}</button>`;
};

/**
 * Googleマップへのリンクボタンを生成
 * @param {string} address - 住所
 * @param {string} buttonText - ボタンのテキスト（デフォルトは「地図を表示」）
 * @returns {string} HTMLボタン要素の文字列
 */
FCOjima.UI.createMapButton = function(address, buttonText = '地図を表示') {
    if (!address) return '';
    
    const encodedAddress = encodeURIComponent(address);
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    
    // モバイルデバイスでのみ表示
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        return `<button type="button" class="map-button" onclick="FCOjima.Utils.openNewTab('${mapUrl}')">${buttonText}</button>`;
    }
    
    return '';
};