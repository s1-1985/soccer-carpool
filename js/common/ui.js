/**
 * FC尾島ジュニア - 共通UI操作
 * 複数画面で共通して使用するUI操作機能
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.UI = FCOjima.UI || {};

// UI操作モジュール
(function() {
    // 名前空間のショートカット
    const UI = FCOjima.UI;
    
    /**
     * アラートメッセージを表示
     * @param {string} message - 表示するメッセージ
     * @param {string} type - アラートの種類（'info', 'success', 'warning', 'danger'）
     */
    UI.showAlert = function(message, type = 'info') {
        // すでに表示中のアラートがあれば削除
        const existingAlert = document.querySelector('.alert-popup');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        // アラート要素を作成
        const alert = document.createElement('div');
        alert.className = `alert-popup ${type}`;
        alert.innerHTML = message;
        
        // ボディに追加
        document.body.appendChild(alert);
        
        // 一定時間後に削除
        setTimeout(() => {
            alert.classList.add('fade-out');
            setTimeout(() => {
                alert.remove();
            }, 300);
        }, 3000);
    };
    
    /**
     * 確認ダイアログを表示
     * @param {string} message - 表示するメッセージ
     * @returns {boolean} 確認結果
     */
    UI.showConfirm = function(message) {
        return confirm(message);
    };
    
    /**
     * 入力ダイアログを表示
     * @param {string} message - 表示するメッセージ
     * @param {string} defaultValue - デフォルト値
     * @returns {string|null} 入力された文字列またはnull
     */
    UI.showPrompt = function(message, defaultValue = '') {
        return prompt(message, defaultValue);
    };
    
    /**
     * HTMLエスケープ
     * @param {string} text - エスケープする文字列
     * @returns {string} エスケープされた文字列
     */
    UI.escapeHTML = function(text) {
        if (!text) return '';
        
        const escape = document.createElement('div');
        escape.textContent = text;
        return escape.innerHTML;
    };
    
    /**
     * アラートメッセージのHTMLを作成
     * @param {string} type - アラートの種類（'info', 'success', 'warning', 'danger'）
     * @param {string} message - 表示するメッセージ
     * @returns {string} アラートのHTML
     */
    UI.createAlert = function(type, message) {
        return `<div class="alert ${type}">${message}</div>`;
    };
    
    /**
     * モーダルを開く
     * @param {string} modalId - モーダルのID
     */
    UI.openModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    };
    
    /**
     * モーダルを閉じる
     * @param {string} modalId - モーダルのID
     */
    UI.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    };
    
    /**
     * すべてのモーダルを初期化（閉じるボタンの設定など）
     */
    UI.initModals = function() {
        // すべてのモーダルに閉じるボタンイベントを設定
        const modals = document.querySelectorAll('.modal');
        
        modals.forEach(modal => {
            const closeButton = modal.querySelector('.close');
            if (closeButton) {
                closeButton.addEventListener('click', function() {
                    modal.style.display = 'none';
                });
            }
            
            // モーダル外クリックで閉じる
            window.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    };
    
    /**
     * タブを開く
     * @param {Event} event - イベントオブジェクト
     * @param {string} tabId - 開くタブのID
     */
    UI.openTab = function(event, tabId) {
        // すべてのタブコンテンツを非表示
        const tabcontent = document.getElementsByClassName('tabcontent');
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = 'none';
        }
        
        // すべてのタブからactiveクラスを削除
        const tablinks = document.getElementsByClassName('tablinks');
        for (let i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(' active', '');
        }
        
        // 選択されたタブを表示し、そのボタンをアクティブにする
        document.getElementById(tabId).style.display = 'block';
        if (event && event.currentTarget) {
            event.currentTarget.className += ' active';
        }
    };
    
    /**
     * デフォルトタブを開く（ページ読み込み時に自動実行）
     * @param {string} defaultTabId - デフォルトで開くタブのID
     */
    UI.openDefaultTab = function(defaultTabId) {
        // ページがタブ構造を持っているかチェック
        const tabContent = document.getElementById(defaultTabId);
        if (!tabContent) return;
        
        // タブコンテンツをすべて非表示
        const tabcontent = document.getElementsByClassName('tabcontent');
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = 'none';
        }
        
        // デフォルトタブを表示
        document.getElementById(defaultTabId).style.display = 'block';
        
        // デフォルトタブのボタンをアクティブにする
        const tablinks = document.getElementsByClassName('tablinks');
        for (let i = 0; i < tablinks.length; i++) {
            if (tablinks[i].getAttribute('onclick') && 
                tablinks[i].getAttribute('onclick').includes(defaultTabId)) {
                tablinks[i].className += ' active';
                break;
            }
        }
    };
})();