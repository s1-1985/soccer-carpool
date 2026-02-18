/**
 * FC尾島ジュニア - 共通UI操作
 * 複数画面で共通して使用するUI操作機能（続き）
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.UI = FCOjima.UI || {};

// UI操作モジュール
(function() {
    // 名前空間のショートカット
    const UI = FCOjima.UI;
    
    /**
     * HTML特殊文字をエスケープ
     * @param {string} str - エスケープする文字列
     * @returns {string} エスケープされた文字列
     */
    UI.escapeHTML = function(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    /**
     * モーダルを開く
     * @param {string} modalId - モーダルのID
     */
    UI.openModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'block';
    };

    /**
     * モーダルを閉じる
     * @param {string} modalId - モーダルのID
     */
    UI.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    };

    /**
     * モーダルの閉じるボタンを初期化
     */
    UI.initModals = function() {
        document.querySelectorAll('.modal .close').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });
        window.addEventListener('click', function(e) {
            document.querySelectorAll('.modal').forEach(function(modal) {
                if (e.target === modal) modal.style.display = 'none';
            });
        });
    };

    /**
     * アラートを表示
     * @param {string} message - メッセージ
     */
    UI.showAlert = function(message) {
        alert(message);
    };

    /**
     * 確認ダイアログを表示
     * @param {string} message - メッセージ
     * @returns {boolean}
     */
    UI.showConfirm = function(message) {
        return confirm(message);
    };

    /**
     * タブを切り替え
     * @param {Event} evt - クリックイベント
     * @param {string} tabName - 表示するタブのID
     */
    UI.openTab = function(evt, tabName) {
        const tabcontents = document.querySelectorAll('.tabcontent');
        for (let i = 0; i < tabcontents.length; i++) {
            tabcontents[i].style.display = 'none';
        }
        const tablinks = document.querySelectorAll('.tablinks');
        for (let i = 0; i < tablinks.length; i++) {
            tablinks[i].classList.remove('active');
        }
        const target = document.getElementById(tabName);
        if (target) {
            target.style.display = 'block';
        }
        if (evt && evt.currentTarget) {
            evt.currentTarget.classList.add('active');
        }
    };

    /**
     * テーブルをクリア
     * @param {string} tableId - テーブルのID
     */
    UI.clearTable = function(tableId) {
        const table = document.getElementById(tableId);
        if (table) {
            const tbody = table.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = '';
            }
        } else {
            console.error('テーブルが見つかりません: ' + tableId);
        }
    };
    
    /**
     * スピナーを表示
     * @param {string} containerId - スピナーを表示するコンテナのID
     * @param {string} message - スピナーと共に表示するメッセージ
     */
    UI.showSpinner = function(containerId, message = '読み込み中...') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div class="loading">${message}</div>`;
        }
    };
    
    /**
     * スピナーを非表示
     * @param {string} containerId - スピナーを表示しているコンテナのID
     */
    UI.hideSpinner = function(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            const loading = container.querySelector('.loading');
            if (loading) {
                loading.remove();
            }
        }
    };
    
    /**
     * ツールチップを表示
     * @param {HTMLElement} element - ツールチップを表示する要素
     * @param {string} message - ツールチップメッセージ
     */
    UI.showTooltip = function(element, message) {
        // すでに表示中のツールチップがあれば削除
        const existingTooltip = document.querySelector('.tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        // ツールチップ要素を作成
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = message;
        document.body.appendChild(tooltip);
        
        // 要素の位置を取得
        const rect = element.getBoundingClientRect();
        
        // ツールチップの位置を設定
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.bottom + 10 + 'px';
        
        // 一定時間後に削除
        setTimeout(() => {
            tooltip.remove();
        }, 3000);
    };
    
    /**
     * タブを初期化
     * @param {string} defaultTabId - デフォルトで開くタブのID
     */
    UI.initTabs = function(defaultTabId) {
        // すべてのタブリンクにクリックイベントを設定
        const tabLinks = document.querySelectorAll('.tablinks');
        for (let i = 0; i < tabLinks.length; i++) {
            tabLinks[i].addEventListener('click', function(event) {
                const tabId = this.getAttribute('data-tab');
                if (tabId) {
                    UI.openTab(event, tabId);
                }
            });
        }
        
        // デフォルトタブを開く
        if (defaultTabId) {
            const defaultTab = document.querySelector(`[data-tab="${defaultTabId}"]`);
            if (defaultTab) {
                defaultTab.click();
            }
        }
    };
    
    /**
     * フォームのバリデーション
     * @param {HTMLFormElement} form - バリデーションするフォーム
     * @returns {boolean} バリデーション結果
     */
    UI.validateForm = function(form) {
        let isValid = true;
        
        // 必須項目をチェック
        const requiredFields = form.querySelectorAll('[required]');
        for (let i = 0; i < requiredFields.length; i++) {
            const field = requiredFields[i];
            if (!field.value.trim()) {
                isValid = false;
                field.classList.add('invalid');
                
                // エラーメッセージを表示
                let errorElement = field.nextElementSibling;
                if (!errorElement || !errorElement.classList.contains('error-message')) {
                    errorElement = document.createElement('div');
                    errorElement.className = 'error-message';
                    field.parentNode.insertBefore(errorElement, field.nextSibling);
                }
                
                errorElement.textContent = '必須項目です';
            } else {
                field.classList.remove('invalid');
                
                // エラーメッセージを削除
                const errorElement = field.nextElementSibling;
                if (errorElement && errorElement.classList.contains('error-message')) {
                    errorElement.remove();
                }
            }
        }
        
        return isValid;
    };
    
    /**
     * タブコンテンツの切り替え（アニメーション付き）
     * @param {string} tabId - 表示するタブのID
     */
    UI.switchTabContent = function(tabId) {
        // すべてのタブコンテンツを非表示
        const tabContents = document.querySelectorAll('.tab-content');
        for (let i = 0; i < tabContents.length; i++) {
            tabContents[i].classList.remove('active');
        }
        
        // 指定されたタブコンテンツを表示
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            // アニメーション用のクラスを追加
            targetTab.classList.add('fade-in');
            targetTab.classList.add('active');
            
            // アニメーション終了後にフェードインクラスを削除
            setTimeout(() => {
                targetTab.classList.remove('fade-in');
            }, 300);
        }
    };
    
    /**
     * フォームからオブジェクトを生成
     * @param {HTMLFormElement} form - データを取得するフォーム
     * @returns {Object} フォームデータのオブジェクト
     */
    UI.getFormData = function(form) {
        const formData = new FormData(form);
        const data = {};
        
        // FormDataからオブジェクトを生成
        for (const [key, value] of formData.entries()) {
            // チェックボックスの配列対応
            if (key.endsWith('[]')) {
                const arrayKey = key.slice(0, -2);
                if (!data[arrayKey]) {
                    data[arrayKey] = [];
                }
                data[arrayKey].push(value);
            } else {
                data[key] = value;
            }
        }
        
        return data;
    };
    
    /**
     * オブジェクトをフォームに設定
     * @param {HTMLFormElement} form - データを設定するフォーム
     * @param {Object} data - 設定するデータ
     */
    UI.setFormData = function(form, data) {
        // フォームをリセット
        form.reset();
        
        // オブジェクトの各プロパティをフォームに設定
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const value = data[key];
                const field = form.elements[key];
                
                if (field) {
                    if (Array.isArray(value)) {
                        // チェックボックスの配列対応
                        if (field instanceof RadioNodeList) {
                            for (let i = 0; i < field.length; i++) {
                                if (value.includes(field[i].value)) {
                                    field[i].checked = true;
                                }
                            }
                        }
                    } else {
                        // 通常のフィールド
                        if (field.type === 'checkbox') {
                            field.checked = !!value;
                        } else if (field.type === 'radio') {
                            const radio = form.querySelector(`input[name="${key}"][value="${value}"]`);
                            if (radio) {
                                radio.checked = true;
                            }
                        } else {
                            field.value = value;
                        }
                    }
                }
            }
        }
    };
})();