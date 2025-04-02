/**
 * FC尾島ジュニア - 共通UI操作
 * 複数画面で共通して使用するUI操作機能
 */

(function(app) {
    // 名前空間のショートカット
    var UI = app.UI;
    
    /**
     * タブ切り替え関数
     * @param {Event} evt - イベントオブジェクト
     * @param {string} tabName - 表示するタブのID
     */
    UI.openTab = function(evt, tabName) {
        console.log('タブを開きます: ' + tabName);
        
        // 全てのタブコンテンツを非表示
        var tabcontent = document.getElementsByClassName("tabcontent");
        for (var i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        
        // 全てのタブリンクからactiveクラスを削除
        var tablinks = document.getElementsByClassName("tablinks");
        for (var i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        
        // 選択されたタブコンテンツを表示し、タブリンクにactiveクラスを追加
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";
    };
    
    /**
     * モーダルを開く
     * @param {string} modalId - モーダルのID
     */
    UI.openModal = function(modalId) {
        console.log('モーダルを開きます: ' + modalId);
        var modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = "block";
        } else {
            console.error('モーダル要素が見つかりません: ' + modalId);
        }
    };
    
    /**
     * モーダルを閉じる
     * @param {string} modalId - モーダルのID
     */
    UI.closeModal = function(modalId) {
        console.log('モーダルを閉じます: ' + modalId);
        var modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = "none";
            
            // モーダル内のフォームをリセット
            var forms = modal.querySelectorAll('form');
            forms.forEach(function(form) {
                form.reset();
                
                // 編集モードを解除（data属性を削除）
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
        } else {
            console.error('モーダル要素が見つかりません: ' + modalId);
        }
    };
    
    /**
     * アラートメッセージを表示
     * @param {string} message - 表示するメッセージ
     */
    UI.showAlert = function(message) {
        alert(message);
    };
    
    /**
     * 確認ダイアログを表示
     * @param {string} message - 表示するメッセージ
     * @returns {boolean} ユーザーの選択結果
     */
    UI.showConfirm = function(message) {
        return confirm(message);
    };
    
    /**
     * 入力プロンプトを表示
     * @param {string} message - 表示するメッセージ
     * @param {string} defaultValue - デフォルト値
     * @returns {string|null} ユーザーの入力または「キャンセル」の場合はnull
     */
    UI.showPrompt = function(message, defaultValue) {
        return prompt(message, defaultValue || '');
    };
    
    /**
     * HTMLエスケープ（XSS対策）
     * @param {string} str - エスケープする文字列
     * @returns {string} エスケープされた文字列
     */
    UI.escapeHTML = function(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
    
    /**
     * アラート要素を生成
     * @param {string} type - アラートタイプ（info, success, warning, danger）
     * @param {string} message - 表示するメッセージ
     * @returns {string} HTML文字列
     */
    UI.createAlert = function(type, message) {
        return '<div class="alert ' + type + '">' + message + '</div>';
    };
    
    /**
     * モーダル初期化（閉じるボタン、外部クリック時の閉じる処理、キャンセルボタン）
     * 問題15の修正: モーダルのキャンセルボタンが機能するように改善
     */
    UI.initModals = function() {
        console.log('モーダルの初期化を行います...');
        
        // モーダルを閉じるボタン(×ボタン)のイベントリスナー
        var closeButtons = document.querySelectorAll('.close');
        closeButtons.forEach(function(button) {
            // 既存のイベントリスナーを削除して新しく追加（イベントの重複を防止）
            var newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
                
                newButton.addEventListener('click', function() {
                    var modalId = this.closest('.modal').id;
                    console.log('モーダル「' + modalId + '」の閉じるボタンがクリックされました');
                    UI.closeModal(modalId);
                });
            }
        });
        
        // モーダル外クリックでモーダルを閉じる
        window.addEventListener('click', function(event) {
            document.querySelectorAll('.modal').forEach(function(modal) {
                if (event.target === modal) {
                    console.log('モーダル「' + modal.id + '」の外側がクリックされました');
                    UI.closeModal(modal.id);
                }
            });
        });
        
        // キャンセルボタンのイベントリスナー
        function setupCancelButton(button) {
            // 既存のイベントリスナーを削除
            var newButton = button.cloneNode(true);
            if (button.parentNode) {
                button.parentNode.replaceChild(newButton, button);
                
                // 新しいイベントリスナーを追加
                newButton.addEventListener('click', function(e) {
                    e.preventDefault(); // フォーム送信を防止
                    var modalId = this.closest('.modal').id;
                    console.log('モーダル「' + modalId + '」のキャンセルボタンがクリックされました');
                    UI.closeModal(modalId);
                });
            }
        }
        
        // id末尾が-cancelのボタン
        document.querySelectorAll('[id$="-cancel"]').forEach(setupCancelButton);
        
        // キャンセルという文字を含むボタン
        document.querySelectorAll('button').forEach(function(button) {
            if (button.textContent.includes('キャンセル') || 
                button.textContent.includes('取消') || 
                button.textContent.includes('やめる')) {
                setupCancelButton(button);
            }
        });
        
        console.log('モーダルの初期化が完了しました');
    };
    
    /**
     * 要素の内容を変更
     * @param {string} elementId - 要素のID
     * @param {string} content - 設定する内容（HTML）
     */
    UI.setContent = function(elementId, content) {
        var element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = content;
        } else {
            console.error('要素が見つかりません: ' + elementId);
        }
    };
    
    /**
     * テーブルをクリア
     * @param {string} tableId - テーブルのID
     */
    UI.clearTable = function(tableId) {
        var table = document.getElementById(tableId);
        if (table) {
            var tbody = table.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = '';
            }
        } else {
            console.error('テーブルが見つかりません: ' + tableId);
        }
    };
    
})(window.FCOjima);
