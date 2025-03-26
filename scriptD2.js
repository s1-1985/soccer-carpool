// script.js - サッカーチーム送迎管理アプリのメイン JavaScript ファイル

// ページロード時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // スケジュールデータの読み込み
    loadSchedule();
    
    // カープールデータの読み込み
    loadCarpools();
    
    // フォームイベントリスナーの設定
    setupFormListeners();
    
    // ナビゲーションのアクティブ状態設定
    setActiveNavItem();
    
    // モーダル関連の設定
    setupModals();
});

// ナビゲーションのアクティブ状態を設定
function setActiveNavItem() {
    const currentUrl = window.location.pathname;
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        // 現在のURLにリンクのパスが含まれている場合、activeクラスを追加
        if (currentUrl.includes(link.getAttribute('href'))) {
            link.classList.add('active');
        }
    });
}

// スケジュールデータの読み込み（モックデータ）
function loadSchedule() {
    // 実際の実装ではAPIからデータを取得
    const schedules = [
        {
            id: 1,
            type: 'game',
            opponent: 'FCレッドスター',
            date: '2025-04-05',
            time: '14:00',
            location: '中央公園サッカー場',
            address: '東京都中央区日本橋1-1-1',
            notes: 'ユニフォームは緑色。13:00に集合してください。'
        },
        {
            id: 2,
            type: 'practice',
            date: '2025-04-10',
            time: '19:00',
            location: '市民グラウンド',
            address: '東京都新宿区西新宿2-8-1',
            notes: 'ボールとシューズを忘れずに。'
        },
        {
            id: 3,
            type: 'game',
            opponent: 'ブルーイーグルス',
            date: '2025-04-18',
            time: '15:30',
            location: '多摩川河川敷グラウンド',
            address: '東京都大田区田園調布1-1',
            notes: 'アウェイゲーム。白いユニフォームを着用。'
        }
    ];
    
    displaySchedule(schedules);
}

// スケジュールの表示
function displaySchedule(schedules) {
    const scheduleTable = document.getElementById('schedule-table');
    if (!scheduleTable) return;
    
    const tableBody = scheduleTable.querySelector('tbody') || scheduleTable;
    tableBody.innerHTML = '';
    
    schedules.forEach(event => {
        const row = document.createElement('tr');
        row.dataset.eventId = event.id;
        
        // 日付フォーマット
        const eventDate = new Date(event.date + 'T' + event.time);
        const formattedDate = eventDate.toLocaleDateString('ja-JP', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            weekday: 'short'
        });
        
        const formattedTime = eventDate.toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        // イベントタイプのバッジ
        const typeLabel = event.type === 'game' ? '試合' : '練習';
        const typeClass = event.type === 'game' ? 'game' : 'practice';
        
        row.innerHTML = `
            <td>
                <span class="match-type ${typeClass}">${typeLabel}</span>
                ${event.type === 'game' ? `<span>vs ${event.opponent}</span>` : ''}
            </td>
            <td>${formattedDate}<br>${formattedTime}</td>
            <td>${event.location}<br><small>${event.address}</small></td>
            <td>
                <button class="btn-text show-carpool" data-event-id="${event.id}">送迎を確認</button>
                <button class="btn-text offer-ride" data-event-id="${event.id}">送迎を提供</button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
    
    // イベントリスナーの設定
    const showCarpoolButtons = document.querySelectorAll('.show-carpool');
    showCarpoolButtons.forEach(button => {
        button.addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            showCarpoolsForEvent(eventId);
        });
    });
    
    const offerRideButtons = document.querySelectorAll('.offer-ride');
    offerRideButtons.forEach(button => {
        button.addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            openOfferRideModal(eventId);
        });
    });
}

// イベントIDからイベント情報を取得
function getEventById(eventId) {
    // 実際の実装ではAPIから取得するか、ローカルストレージから取得
    const schedules = [
        {
            id: 1,
            type: 'game',
            opponent: 'FCレッドスター',
            date: '2025-04-05',
            time: '14:00',
            location: '中央公園サッカー場',
            address: '東京都中央区日本橋1-1-1',
            notes: 'ユニフォームは緑色。13:00に集合してください。'
        },
        {
            id: 2,
            type: 'practice',
            date: '2025-04-10',
            time: '19:00',
            location: '市民グラウンド',
            address: '東京都新宿区西新宿2-8-1',
            notes: 'ボールとシューズを忘れずに。'
        },
        {
            id: 3,
            type: 'game',
            opponent: 'ブルーイーグルス',
            date: '2025-04-18',
            time: '15:30',
            location: '多摩川河川敷グラウンド',
            address: '東京都大田区田園調布1-1',
            notes: 'アウェイゲーム。白いユニフォームを着用。'
        }
    ];
    
    return schedules.find(event => event.id === parseInt(eventId));
}

// 特定イベントのカープール情報を表示
function showCarpoolsForEvent(eventId) {
    // イベント情報の取得
    const event = getEventById(eventId);
    if (!event) return;
    
    // カープールセクションを表示
    const carpoolSection = document.getElementById('carpool-section');
    if (!carpoolSection) return;
    
    // セクションタイトルの更新
    const carpoolTitle = document.querySelector('.carpool-section h2');
    if (carpoolTitle) {
        const eventDate = new Date(event.date + 'T' + event.time);
        const formattedDate = eventDate.toLocaleDateString('ja-JP', { 
            month: '2-digit', 
            day: '2-digit',
            weekday: 'short'
        });
        
        carpoolTitle.textContent = `${formattedDate} ${event.type === 'game' ? `vs ${event.opponent}` : '練習'} の送迎情報`;
    }
    
    // カープール情報の取得・表示
    const carpools = getCarpoolsByEventId(eventId);
    displayCarpools(carpools, eventId);
    
    // カープールがない場合のメッセージ
    const carpoolList = document.getElementById('carpool-list');
    if (carpools.length === 0 && carpoolList) {
        carpoolList.innerHTML = `
            <div class="alert alert-info">
                この予定の送迎情報はまだ登録されていません。「送迎を提供」ボタンから登録してください。
            </div>
        `;
    }
    
    // セクションを表示
    carpoolSection.style.display = 'block';
    
    // セクションまでスクロール
    carpoolSection.scrollIntoView({ behavior: 'smooth' });
}

// イベントIDからカープール情報を取得
function getCarpoolsByEventId(eventId) {
    // 実際の実装ではAPIから取得するか、ローカルストレージから取得
    const carpools = [
        {
            id: 101,
            eventId: 1,
            driver: {
                id: 201,
                name: '山田太郎',
                phone: '090-1234-5678',
                role: 'parent'
            },
            departure: {
                location: '新宿駅南口',
                time: '12:30'
            },
            return: {
                location: '新宿駅南口',
                estimatedTime: '17:00'
            },
            capacity: 4,
            passengers: [
                { id: 301, name: '佐藤健太', role: 'player' },
                { id: 302, name: '田中誠', role: 'player' }
            ],
            notes: '新宿駅南口のバスロータリー付近で待ち合わせ。白いミニバンです。'
        },
        {
            id: 102,
            eventId: 1,
            driver: {
                id: 202,
                name: '鈴木一郎',
                phone: '090-8765-4321',
                role: 'coach'
            },
            departure: {
                location: '渋谷駅東口',
                time: '12:15'
            },
            return: {
                location: '渋谷駅東口',
                estimatedTime: '17:30'
            },
            capacity: 3,
            passengers: [
                { id: 303, name: '高橋和也', role: 'player' }
            ],
            notes: '渋谷駅東口のスクランブル交差点前のベンチで待ち合わせ。'
        },
        {
            id: 103,
            eventId: 2,
            driver: {
                id: 203,
                name: '佐藤美咲',
                phone: '090-2345-6789',
                role: 'parent'
            },
            departure: {
                location: '池袋駅西口',
                time: '18:00'
            },
            return: {
                location: '池袋駅西口',
                estimatedTime: '21:30'
            },
            capacity: 3,
            passengers: [],
            notes: '池袋駅西口の地下街入口前で待ち合わせ。'
        }
    ];
    
    return carpools.filter(carpool => carpool.eventId === parseInt(eventId));
}

// カープール情報の表示
function displayCarpools(carpools, eventId) {
    const carpoolList = document.getElementById('carpool-list');
    if (!carpoolList) return;
    
    carpoolList.innerHTML = '';
    
    carpools.forEach(carpool => {
        const carpoolCard = document.createElement('div');
        carpoolCard.className = 'carpool-card';
        
        // 残りの座席数を計算
        const availableSeats = carpool.capacity - carpool.passengers.length;
        const availableStatus = availableSeats > 0 ? 
            `<span class="badge badge-success">残り${availableSeats}席</span>` :
            `<span class="badge badge-danger">満席</span>`;
        
        // 乗客リスト
        let passengerList = '';
        if (carpool.passengers.length > 0) {
            passengerList = '<div class="passengers"><strong>乗車予定者:</strong> ';
            passengerList += carpool.passengers.map(p => p.name).join('、');
            passengerList += '</div>';
        }
        
        // 座席表示
        let seatsHtml = '<div class="seats">';
        for (let i = 0; i < carpool.capacity; i++) {
            const seatClass = i < carpool.passengers.length ? 'filled' : 'available';
            seatsHtml += `<div class="seat ${seatClass}"></div>`;
        }
        seatsHtml += '</div>';
        
        carpoolCard.innerHTML = `
            <div class="carpool-info">
                <div class="driver-name">${carpool.driver.name} ${getRoleLabel(carpool.driver.role)}</div>
                <div class="carpool-details">
                    <div>
                        <div><strong>出発:</strong> ${carpool.departure.location} (${carpool.departure.time})</div>
                        <div><strong>帰り:</strong> ${carpool.return.location} (${carpool.return.estimatedTime}予定)</div>
                    </div>
                    <div>
                        <div>${availableStatus}</div>
                        ${seatsHtml}
                        ${passengerList}
                    </div>
                </div>
                <div class="carpool-notes">
                    <small>${carpool.notes}</small>
                </div>
            </div>
            <div class="carpool-actions">
                <button class="btn btn-small ${availableSeats > 0 ? '' : 'btn-secondary'}" 
                    ${availableSeats > 0 ? '' : 'disabled'}
                    data-carpool-id="${carpool.id}" 
                    onclick="requestRide(${carpool.id})">
                    乗車を申し込む
                </button>
            </div>
        `;
        
        carpoolList.appendChild(carpoolCard);
    });
}

// 役割ラベルの取得
function getRoleLabel(role) {
    const roles = {
        'coach': '(コーチ)',
        'player': '(選手)',
        'parent': '(保護者)',
        'staff': '(スタッフ)'
    };
    
    return roles[role] || '';
}

// 配車申し込み
function requestRide(carpoolId) {
    // 実際の実装ではAPIを使用して申し込み処理
    console.log(`カープールID ${carpoolId} への申し込みを処理中...`);
    
    // 申し込みモーダルを表示
    openRequestRideModal(carpoolId);
}

// カープールデータの読み込み（一覧表示用）
function loadCarpools() {
    // 実際の実装ではAPIからデータを取得
    // この関数は今後のページで必要に応じて実装
}

// 送迎提供モーダルを開く
function openOfferRideModal(eventId) {
    const event = getEventById(eventId);
    if (!event) return;
    
    const modal = document.getElementById('offer-ride-modal');
    if (!modal) return;
    
    // イベント情報をモーダル内に設定
    const eventInfoElem = modal.querySelector('.event-info');
    if (eventInfoElem) {
        const eventDate = new Date(event.date + 'T' + event.time);
        const formattedDate = eventDate.toLocaleDateString('ja-JP', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            weekday: 'short'
        });
        
        const formattedTime = eventDate.toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        eventInfoElem.innerHTML = `
            <strong>${event.type === 'game' ? `試合 vs ${event.opponent}` : '練習'}</strong><br>
            ${formattedDate} ${formattedTime}<br>
            ${event.location}
        `;
    }
    
    // イベントIDをフォームに設定
    const eventIdInput = document.getElementById('offer-event-id');
    if (eventIdInput) {
        eventIdInput.value = eventId;
    }
    
    // モーダルを表示
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'flex';
    }
}