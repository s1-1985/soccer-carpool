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

    // =========================================================
    // 以下: モーダル・アラート・エスケープ等の必須関数
    // =========================================================

    /**
     * HTMLエスケープ
     * @param {string} str
     * @returns {string}
     */
    UI.escapeHTML = function(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    /**
     * アラートHTML文字列を生成
     * @param {string} type - 'info' | 'success' | 'warning' | 'error'
     * @param {string} message
     * @returns {string}
     */
    UI.createAlert = function(type, message) {
        const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
        const icon = icons[type] || icons.info;
        return `<div class="alert alert-${UI.escapeHTML(type)}">${icon} ${UI.escapeHTML(message)}</div>`;
    };

    /**
     * トースト通知を表示
     * @param {string} message
     * @param {string} type - 'info' | 'success' | 'warning' | 'error'
     * @param {number} duration - 表示時間(ms)
     */
    UI.showAlert = function(message, type, duration) {
        type = type || 'info';
        duration = duration || 3000;

        // 既存のトーストを削除
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast-notification toast-' + type;
        toast.textContent = message;
        toast.style.cssText = [
            'position:fixed', 'bottom:20px', 'left:50%',
            'transform:translateX(-50%)',
            'background:' + (type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#3498db'),
            'color:' + (type === 'warning' ? '#333' : '#fff'),
            'padding:12px 24px', 'border-radius:8px',
            'font-size:14px', 'z-index:9999',
            'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
            'max-width:80vw', 'text-align:center'
        ].join(';');
        document.body.appendChild(toast);

        setTimeout(function() {
            if (toast.parentNode) toast.remove();
        }, duration);
    };

    /**
     * 確認ダイアログ（window.confirm ラッパー）
     * @param {string} message
     * @returns {boolean}
     */
    UI.showConfirm = function(message) {
        return window.confirm(message);
    };

    /**
     * プロンプトダイアログ（window.prompt ラッパー）
     * @param {string} message
     * @param {string} defaultValue
     * @returns {string|null}
     */
    UI.showPrompt = function(message, defaultValue) {
        return window.prompt(message, defaultValue || '');
    };

    /**
     * モーダルを初期化（×ボタン・背景クリックで閉じる）
     */
    UI.initModals = function() {
        // ×ボタンで閉じる
        document.querySelectorAll('.modal .close').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const modal = btn.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        // モーダル外クリックで閉じる
        document.querySelectorAll('.modal').forEach(function(modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) modal.style.display = 'none';
            });
        });

        console.log('モーダルを初期化しました');
    };

    /**
     * モーダルを開く
     * @param {string} modalId
     */
    UI.openModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        } else {
            console.warn('モーダルが見つかりません: ' + modalId);
        }
    };

    /**
     * モーダルを閉じる
     * @param {string} modalId
     */
    UI.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    };

    /**
     * タブを開く
     * @param {Event} evt
     * @param {string} tabId
     */
    UI.openTab = function(evt, tabId) {
        // すべてのタブコンテンツを非表示（tabcontent / tab-content 両対応）
        document.querySelectorAll('.tabcontent, .tab-content').forEach(function(c) {
            c.style.display = 'none';
            c.classList.remove('active');
        });

        // すべてのタブリンクの active を外す
        document.querySelectorAll('.tablinks').forEach(function(link) {
            link.classList.remove('active');
        });

        // 対象タブを表示
        const target = document.getElementById(tabId);
        if (target) {
            target.style.display = 'block';
            target.classList.add('active');
        }

        // クリックされたボタンをアクティブに
        if (evt && evt.currentTarget) {
            evt.currentTarget.classList.add('active');
        }
    };

})();