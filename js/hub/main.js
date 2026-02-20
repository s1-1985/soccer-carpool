/**
 * FC尾島ジュニア - HUB統合メインファイル
 * 各ページの共通初期化と機能統合
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Main = FCOjima.Hub.Main || {};

// HUBメインモジュール
(function() {
    const Main = FCOjima.Hub.Main;
    const Storage = FCOjima.Storage;
    const UI = FCOjima.UI;
    const Utils = FCOjima.Utils;
    
    // アプリケーションの状態
    let currentPage = '';
    let isInitialized = false;
    
    /**
     * HUBアプリケーションの初期化
     */
    Main.init = function() {
        if (isInitialized) return;
        
        try {
            // 現在のページを特定
            currentPage = getCurrentPage();
            
            // 共通UI要素の初期化
            initCommonUI();
            
            // ナビゲーションの初期化
            initNavigation();
            
            // グローバルイベントリスナーの設定
            setupGlobalEventListeners();
            
            // ページ固有の初期化
            initPageSpecificFeatures();
            
            // アプリケーション情報の表示
            displayAppInfo();
            
            isInitialized = true;
            console.log(`FC尾島ジュニア HUB (${currentPage}) を初期化しました`);
            
        } catch (error) {
            console.error('HUB初期化エラー:', error);
            UI.showAlert('error', 'アプリケーションの初期化に失敗しました');
        }
    };
    
    /**
     * 現在のページを特定
     */
    function getCurrentPage() {
        const path = window.location.pathname;
        
        if (path.includes('calendar.html')) return 'calendar';
        if (path.includes('members.html')) return 'members';
        if (path.includes('venues.html')) return 'venues';
        if (path.includes('notifications.html')) return 'notifications';
        if (path.includes('hub/index.html') || path.endsWith('hub/')) return 'hub-index';
        
        return 'unknown';
    }
    
    /**
     * 共通UI要素の初期化
     */
    function initCommonUI() {
        // モーダルシステムの初期化
        UI.initModals();
        
        // アラートシステムの初期化
        UI.initAlerts();
        
        // ツールチップの初期化
        initTooltips();
        
        // レスポンシブメニューの初期化
        initResponsiveMenu();
    }
    
    /**
     * ナビゲーションの初期化
     */
    function initNavigation() {
        const navLinks = document.querySelectorAll('.main-nav a');
        
        navLinks.forEach(link => {
            // 現在のページをアクティブ化
            if (link.href.includes(currentPage)) {
                link.classList.add('active');
            }
            
            // ページ遷移前の確認
            link.addEventListener('click', function(e) {
                if (hasUnsavedChanges()) {
                    if (!confirm('保存されていない変更があります。このページから移動しますか？')) {
                        e.preventDefault();
                        return false;
                    }
                }
            });
        });
        
        // パンくずリストの更新
        updateBreadcrumb();
    }
    
    /**
     * グローバルイベントリスナーの設定
     */
    function setupGlobalEventListeners() {
        // キーボードショートカット
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // ページの離脱前確認
        window.addEventListener('beforeunload', function(e) {
            if (hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        });
        
        // エラーハンドリング
        window.addEventListener('error', function(e) {
            console.error('グローバルエラー:', e.error);
            UI.showAlert('error', 'アプリケーションエラーが発生しました');
        });
        
        // オンライン/オフライン状態の監視
        window.addEventListener('online', function() {
            UI.showAlert('success', 'ネットワークに接続されました');
        });
        
        window.addEventListener('offline', function() {
            UI.showAlert('warning', 'ネットワーク接続が切断されました');
        });
    }
    
    /**
     * ページ固有機能の初期化
     */
    function initPageSpecificFeatures() {
        switch (currentPage) {
            case 'calendar':
                // カレンダー機能の初期化は calendar.js で実行
                setupCalendarIntegration();
                break;
                
            case 'members':
                // メンバー管理機能の初期化は members.js で実行
                setupMembersIntegration();
                break;
                
            case 'venues':
                // 会場管理機能の初期化は venues.js で実行
                setupVenuesIntegration();
                break;
                
            case 'notifications':
                // 連絡事項機能の初期化は notifications.js で実行
                setupNotificationsIntegration();
                break;
                
            case 'hub-index':
                // HUBトップページの初期化
                setupHubIndex();
                break;
        }
    }
    
    /**
     * カレンダー機能との統合
     */
    function setupCalendarIntegration() {
        // 配車管理への遷移機能
        window.goToCarpool = function(eventId) {
            if (eventId) {
                // セッションストレージにイベントIDを保存
                sessionStorage.setItem('fc-ojima-selected-event', eventId);
                window.location.href = '../carpool/index.html';
            }
        };
    }
    
    /**
     * メンバー管理機能との統合
     */
    function setupMembersIntegration() {
        // 学年自動計算の更新
        setInterval(function() {
            if (typeof FCOjima.Hub.Members !== 'undefined' && 
                typeof FCOjima.Hub.Members.updateDisplay === 'function') {
                FCOjima.Hub.Members.updateDisplay();
            }
        }, 60000); // 1分ごとに更新
    }
    
    /**
     * 会場管理機能との統合
     */
    function setupVenuesIntegration() {
        // Google Maps連携の確認
        if (navigator.geolocation) {
            console.log('位置情報サービスが利用可能です');
        }
    }
    
    /**
     * 連絡事項機能との統合
     */
    function setupNotificationsIntegration() {
        // 新着通知のチェック
        checkNewNotifications();
        
        // 定期的な新着チェック（5分ごと）
        setInterval(checkNewNotifications, 5 * 60 * 1000);
    }
    
    /**
     * HUBトップページの初期化
     */
    function setupHubIndex() {
        // ダッシュボードの更新
        updateDashboard();
        
        // 定期的なダッシュボード更新（30秒ごと）
        setInterval(updateDashboard, 30000);
    }
    
    /**
     * ツールチップの初期化
     */
    function initTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', showTooltip);
            element.addEventListener('mouseleave', hideTooltip);
        });
    }
    
    /**
     * レスポンシブメニューの初期化
     */
    function initResponsiveMenu() {
        const menuToggle = document.querySelector('.menu-toggle');
        const nav = document.querySelector('.main-nav');
        
        if (menuToggle && nav) {
            menuToggle.addEventListener('click', function() {
                nav.classList.toggle('show');
            });
        }
    }
    
    /**
     * キーボードショートカットの処理
     */
    function handleKeyboardShortcuts(e) {
        // Ctrl+S: 保存
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const saveButton = document.querySelector('[data-action="save"]');
            if (saveButton) saveButton.click();
        }
        
        // Ctrl+N: 新規追加
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            const addButton = document.querySelector('[data-action="add"]');
            if (addButton) addButton.click();
        }
        
        // Escape: モーダルを閉じる
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal[style*="block"]');
            if (openModal) {
                openModal.style.display = 'none';
            }
        }
    }
    
    /**
     * 未保存の変更があるかチェック
     */
    function hasUnsavedChanges() {
        // フォームの変更をチェック
        const forms = document.querySelectorAll('form');
        for (let form of forms) {
            if (form.classList.contains('dirty')) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * パンくずリストの更新
     */
    function updateBreadcrumb() {
        const breadcrumb = document.querySelector('.breadcrumb');
        if (!breadcrumb) return;
        
        const pageNames = {
            'calendar': 'カレンダー',
            'members': 'メンバー管理',
            'venues': '会場管理',
            'notifications': '連絡事項',
            'hub-index': 'ホーム'
        };
        
        const pageName = pageNames[currentPage] || '不明';
        breadcrumb.innerHTML = `
            <a href="index.html">ホーム</a>
            <span class="separator">></span>
            <span class="current">${pageName}</span>
        `;
    }
    
    /**
     * 新着通知のチェック
     */
    function checkNewNotifications() {
        try {
            const notifications = Storage.loadNotifications();
            const recentNotifications = notifications.filter(n => {
                const notificationDate = new Date(n.date);
                const now = new Date();
                const diffInHours = (now - notificationDate) / (1000 * 60 * 60);
                return diffInHours <= 24;
            });
            
            if (recentNotifications.length > 0) {
                const badge = document.querySelector('.notification-badge');
                if (badge) {
                    badge.textContent = recentNotifications.length;
                    badge.style.display = 'inline';
                }
            }
        } catch (error) {
            console.error('新着通知チェックエラー:', error);
        }
    }
    
    /**
     * ダッシュボードの更新
     */
    function updateDashboard() {
        try {
            const events = Storage.loadEvents();
            const members = Storage.loadMembers();
            const venues = Storage.loadVenues();
            const notifications = Storage.loadNotifications();
            
            // 統計情報の更新
            updateDashboardStat('total-events', events.length);
            updateDashboardStat('total-members', members.length);
            updateDashboardStat('total-venues', venues.length);
            updateDashboardStat('total-notifications', notifications.length);
            
            // 今日のイベント
            const today = new Date().toISOString().split('T')[0];
            const todayEvents = events.filter(e => e.date.startsWith(today));
            updateDashboardStat('today-events', todayEvents.length);
            
        } catch (error) {
            console.error('ダッシュボード更新エラー:', error);
        }
    }
    
    /**
     * ダッシュボード統計の更新
     */
    function updateDashboardStat(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }
    
    /**
     * ツールチップの表示
     */
    function showTooltip(e) {
        const element = e.target;
        const text = element.getAttribute('data-tooltip');
        
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        
        document.body.appendChild(tooltip);
        
        // 位置を計算
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
        
        element._tooltip = tooltip;
    }
    
    /**
     * ツールチップの非表示
     */
    function hideTooltip(e) {
        const element = e.target;
        if (element._tooltip) {
            document.body.removeChild(element._tooltip);
            delete element._tooltip;
        }
    }
    
    /**
     * アプリケーション情報の表示
     */
    function displayAppInfo() {
        console.log('=== FC尾島ジュニア HUB ===');
        console.log(`バージョン: 1.0.0`);
        console.log(`現在のページ: ${currentPage}`);
        console.log(`初期化完了: ${new Date().toLocaleString()}`);
        console.log('========================');
    }
    
    // 外部から呼び出し可能な関数をエクスポート
    Main.getCurrentPage = getCurrentPage;
    Main.updateDashboard = updateDashboard;
    Main.checkNewNotifications = checkNewNotifications;
    
})();

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', function() {
    FCOjima.Hub.Main.init();
});

// CSS for tooltips and additional UI elements
const additionalCSS = `
/* ツールチップ */
.tooltip {
    position: absolute;
    background-color: #333;
    color: white;
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    white-space: nowrap;
    pointer-events: none;
}

.tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
}

/* 通知バッジ */
.notification-badge {
    background-color: #dc3545;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    position: absolute;
    top: -8px;
    right: -8px;
    display: none;
}

/* パンくずリスト */
.breadcrumb {
    margin-bottom: 20px;
    font-size: 14px;
    color: #666;
}

.breadcrumb a {
    color: #3498db;
    text-decoration: none;
}

.breadcrumb a:hover {
    text-decoration: underline;
}

.breadcrumb .separator {
    margin: 0 8px;
}

.breadcrumb .current {
    font-weight: 500;
}

/* レスポンシブメニュー */
.menu-toggle {
    display: none;
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 10px;
}

@media screen and (max-width: 768px) {
    .menu-toggle {
        display: block;
    }
    
    .main-nav {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        background-color: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .main-nav.show {
        display: block;
    }
    
    .main-nav ul {
        flex-direction: column;
    }
    
    .main-nav li {
        border-bottom: 1px solid #eee;
    }
}

/* フォームの変更状態 */
.form.dirty {
    border-left: 3px solid #ffc107;
}

/* ローディング状態 */
.loading {
    opacity: 0.6;
    pointer-events: none;
}

.loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;

// CSSを動的に追加
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalCSS;
document.head.appendChild(styleSheet);