/**
 * FC尾島ジュニア - 配車管理ページ 概要タブの機能
 * イベント概要情報の表示と管理を行う
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * イベントデータを表示
 * @param {Object} event - イベントオブジェクト
 */
FCOjima.Carpool.Overview.displayEventData = function(event) {
    console.log(`イベントデータを表示します: ID=${event.id}, タイトル=${event.title}`);
    
    // イベントタイトルをヘッダーに表示
    const header = document.getElementById('event-header');
    if (header) {
        const date = FCOjima.Utils.formatDateForDisplay(event.date);
        header.textContent = `${date} ${event.title}`;
    }
    
    // 概要タブにイベント情報を表示
    const eventSummary = document.getElementById('event-summary');
    if (eventSummary) {
        // 学年ターゲット表示
        let targetDisplay = '';
        if (event.target && event.target.length > 0) {
            const targetGrades = event.target.map(grade => FCOjima.Utils.getGradeLabel(grade)).join(', ');
            targetDisplay = `
            <div class="detail-row">
                <span class="detail-label">対象:</span>
                <span class="detail-value">${targetGrades}</span>
            </div>`;
            
            if (event.targetNotes) {
                targetDisplay += `
                <div class="detail-row">
                    <span class="detail-label">対象備考:</span>
                    <span class="detail-value">${FCOjima.UI.escapeHTML(event.targetNotes)}</span>
                </div>`;
            }
        }

        // 出発時間
        let departureDisplay = '';
        if (event.departureTime) {
            departureDisplay = `
            <div class="detail-row">
                <span class="detail-label">出発時間:</span>
                <span class="detail-value">${event.departureTime}</span>
            </div>`;
        }

        // 集合場所
        let meetingPlaceDisplay = '';
        if (event.meetingPlace) {
            meetingPlaceDisplay = `
            <div class="detail-row">
                <span class="detail-label">集合場所:</span>
                <span class="detail-value">${FCOjima.UI.escapeHTML(event.meetingPlace)}</span>
            </div>`;
        }
        
        eventSummary.innerHTML = `
            <div class="event-detail-card">
                <h3>${FCOjima.UI.escapeHTML(event.title)}</h3>
                <div class="detail-row">
                    <span class="detail-label">日付:</span>
                    <span class="detail-value">${FCOjima.Utils.formatDateForDisplay(event.date)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">種類:</span>
                    <span class="detail-value">${FCOjima.Utils.getEventTypeLabel(event.type)}</span>
                </div>
                ${targetDisplay}
                ${departureDisplay}
                ${meetingPlaceDisplay}
                <div class="detail-row">
                    <span class="detail-label">会場:</span>
                    <span class="detail-value">${FCOjima.UI.escapeHTML(event.venue || '未設定')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">時間:</span>
                    <span class="detail-value">${event.startTime || ''}${event.endTime ? ` - ${event.endTime}` : ''}</span>
                </div>
                ${event.notes ? `
                <div class="detail-row">
                    <span class="detail-label">備考:</span>
                    <span class="detail-value">${FCOjima.UI.escapeHTML(event.notes)}</span>
                </div>
                ` : ''}
            </div>
        `;
    }
    
    // 他のタブでも簡易情報を表示
    const carEventInfo = document.getElementById('carEventInfo');
    if (carEventInfo) {
        carEventInfo.innerHTML = `
            <div class="event-summary">
                <strong>${FCOjima.UI.escapeHTML(event.title)}</strong> (${FCOjima.Utils.formatDateForDisplay(event.date)} ${event.startTime || ''})
            </div>
        `;
    }
    
    const assignmentEventInfo = document.getElementById('assignmentEventInfo');
    if (assignmentEventInfo) {
        assignmentEventInfo.innerHTML = `
            <div class="event-summary">
                <strong>${FCOjima.UI.escapeHTML(event.title)}</strong> (${FCOjima.Utils.formatDateForDisplay(event.date)} ${event.startTime || ''})
            </div>
        `;
    }
};

/**
 * イベントデータを初期化
 */
FCOjima.Carpool.Overview.initEventData = function() {
    console.log('イベントデータを初期化します...');
    
    const event = FCOjima.Storage.getSelectedEvent();
    if (event) {
        this.displayEventData(event);
        console.log(`イベントデータを読み込みました: ID=${event.id}, タイトル=${event.title}`);
    } else {
        const eventSummary = document.getElementById('event-summary');
        if (eventSummary) {
            eventSummary.innerHTML = FCOjima.UI.createAlert('info', 'イベントが選択されていません。HUBページからイベントを選択してください。');
        }
        console.log('選択されたイベントがありません');
    }
};

/**
 * HUBページに戻る
 */
FCOjima.Carpool.Overview.goToMainPage = function() {
    window.location.href = 'index.html';
};