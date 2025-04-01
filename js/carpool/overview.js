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

        // 出欠回答期限
        let deadlineDisplay = '';
        if (event.attendanceDeadline) {
            const deadlineDate = new Date(event.attendanceDeadline);
            const formattedDeadline = deadlineDate.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            deadlineDisplay = `
            <div class="detail-row">
                <span class="detail-label">出欠回答期限:</span>
                <span class="detail-value">${formattedDeadline}</span>
            </div>`;
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

        // 集合場所（GoogleMapリンク付き）
        let meetingPlaceDisplay = '';
        if (event.meetingPlace) {
            // 会場登録データから住所を検索
            const venues = FCOjima.Storage.loadVenues();
            const meetingVenue = venues.find(v => v.name === event.meetingPlace);
            const mapButton = meetingVenue ? 
                FCOjima.UI.createMapButton(meetingVenue.address, 'Google Mapで開く') : 
                '';
            
            meetingPlaceDisplay = `
            <div class="detail-row">
                <span class="detail-label">集合場所:</span>
                <span class="detail-value">${FCOjima.UI.escapeHTML(event.meetingPlace)} ${mapButton}</span>
            </div>`;
        }
        
        // 会場（GoogleMapリンク付き）
        let venueDisplay = '';
        if (event.venue) {
            // 会場登録データから住所を検索
            const venues = FCOjima.Storage.loadVenues();
            const venue = venues.find(v => v.name === event.venue);
            const mapButton = venue ? 
                FCOjima.UI.createMapButton(venue.address, 'Google Mapで開く') : 
                '';
            
            venueDisplay = `
            <div class="detail-row">
                <span class="detail-label">会場:</span>
                <span class="detail-value">${FCOjima.UI.escapeHTML(event.venue)} ${mapButton}</span>
            </div>`;
        } else {
            venueDisplay = `
            <div class="detail-row">
                <span class="detail-label">会場:</span>
                <span class="detail-value">未設定</span>
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
                ${deadlineDisplay}
                ${departureDisplay}
                ${meetingPlaceDisplay}
                ${venueDisplay}
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
    
    // 車提供タブとアサインメントタブでも簡易情報を表示
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
        
        // イベントIDを保存
        FCOjima.Carpool.appData.eventId = event.id;
        
        // イベント固有のデータをロード
        FCOjima.Carpool.loadData();
        
        console.log(`イベントデータを読み込みました: ID=${event.id}, タイトル=${event.title}`);
    } else {
        const eventSummary = document.getElementById('event-summary');
        if (eventSummary) {
            eventSummary.innerHTML = FCOjima.UI.createAlert('info', 'イベントが選択されていません。HUBページからイベントを選択してください。');
        }
        console.log('選択されたイベントがありません');
    }
};