/**
 * FC尾島ジュニア - 配車管理ページ 概要タブの機能
 * イベント概要情報の表示と管理を行う
 */

FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Overview = FCOjima.Carpool.Overview || {};

(function(app) {
    // 名前空間のショートカット
    var Overview = app.Carpool.Overview;
    var Utils = app.Utils;
    var UI = app.UI;
    var Storage = app.Storage;
    
    /**
     * 概要機能の初期化
     */
    Overview.init = function() {
        console.log('配車管理概要機能を初期化しています...');
        
        // イベントデータの初期化
        this.initEventData();
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        console.log('配車管理概要機能の初期化が完了しました');
    };
    
    /**
     * イベントリスナーの設定
     */
    Overview.setupEventListeners = function() {
        console.log('概要タブのイベントリスナーを設定しています...');
        
        // HUBに戻るボタン
        document.getElementById('back-to-hub').addEventListener('click', function() {
            Overview.goToMainPage();
        });
        
        // イベント共有ボタン
        document.getElementById('share-event-button').addEventListener('click', function() {
            Overview.shareEventViaLINE();
        });
        
        console.log('概要タブのイベントリスナー設定が完了しました');
    };
    
    /**
     * イベントデータを初期化
     */
    Overview.initEventData = function() {
        console.log('イベントデータを初期化します...');
        
        var event = Storage.getSelectedEvent();
        if (event) {
            this.displayEventData(event);
            
            // イベントIDを保存
            app.Carpool.appData.eventId = event.id;
            
            // イベント固有のデータをロード
            app.Carpool.loadData();
            
            console.log('イベントデータを読み込みました: ID=' + event.id + ', タイトル=' + event.title);
            
            // 車提供タブとアサインメントタブでも簡易情報を表示
            var carEventInfo = document.getElementById('carEventInfo');
            if (carEventInfo) {
                carEventInfo.innerHTML = '\
                    <div class="event-summary">\
                        <strong>' + UI.escapeHTML(event.title) + '</strong> \
                        (' + Utils.formatDateForDisplay(event.date) + ' ' + (event.startTime || '') + ')\
                    </div>';
            }
            
            var assignmentEventInfo = document.getElementById('assignmentEventInfo');
            if (assignmentEventInfo) {
                assignmentEventInfo.innerHTML = '\
                    <div class="event-summary">\
                        <strong>' + UI.escapeHTML(event.title) + '</strong> \
                        (' + Utils.formatDateForDisplay(event.date) + ' ' + (event.startTime || '') + ')\
                    </div>';
            }
            
            // 状況サマリーを更新
            this.updateStatusSummary();
        } else {
            var eventSummary = document.getElementById('event-summary');
            if (eventSummary) {
                eventSummary.innerHTML = UI.createAlert('info', 'イベントが選択されていません。HUBページからイベントを選択してください。');
            }
            console.log('選択されたイベントがありません');
        }
    };
    
    /**
     * イベントデータを表示
     * @param {Object} event - イベントオブジェクト
     */
    Overview.displayEventData = function(event) {
        console.log('イベントデータを表示します: ID=' + event.id + ', タイトル=' + event.title);
        
        // イベントタイトルをヘッダーに表示
        var header = document.getElementById('event-header');
        if (header) {
            var date = Utils.formatDateForDisplay(event.date);
            header.textContent = date + ' ' + event.title;
        }
        
        // 概要タブにイベント情報を表示
        var eventSummary = document.getElementById('event-summary');
        if (eventSummary) {
            // イベントタイプのバッジ
            var typeLabel = Utils.getEventTypeLabel(event.type);
            var typeBadge = `<span class="event-type-badge ${event.type}">${typeLabel}</span>`;
            
            // 学年ターゲット表示
            var targetDisplay = '';
            if (event.target && event.target.length > 0) {
                var targetGrades = event.target.map(function(grade) {
                    return Utils.getGradeLabel(grade);
                }).join(', ');
                
                targetDisplay = `
                <div class="detail-row">
                    <div class="detail-label">対象:</div>
                    <div class="detail-value">
                        <div class="target-grades">
                            ${targetGrades}
                        </div>
                    </div>
                </div>`;
                
                if (event.targetNotes) {
                    targetDisplay += `
                    <div class="detail-row">
                        <div class="detail-label">対象備考:</div>
                        <div class="detail-value">${UI.escapeHTML(event.targetNotes)}</div>
                    </div>`;
                }
            }
            
            // 日時情報
            var dateTimeInfo = `
            <div class="date-time-info">
                <div class="date-time-item">
                    <div class="date-time-label">日付</div>
                    <div class="date-time-value">${Utils.formatDateForDisplay(event.date)}</div>
                </div>`;
            
            if (event.startTime) {
                dateTimeInfo += `
                <div class="date-time-item">
                    <div class="date-time-label">時間</div>
                    <div class="date-time-value">${event.startTime}${event.endTime ? ' - ' + event.endTime : ''}</div>
                </div>`;
            }
            
            if (event.departureTime) {
                dateTimeInfo += `
                <div class="date-time-item">
                    <div class="date-time-label">出発時間</div>
                    <div class="date-time-value">${event.departureTime}</div>
                </div>`;
            }
            
            dateTimeInfo += '</div>';
            
            // 場所情報
            var locationInfo = '<div class="location-info">';
            
            if (event.meetingPlace) {
                // 会場登録データから住所を検索
                var venues = Storage.loadVenues();
                var meetingVenue = venues.find(function(v) {
                    return v.name === event.meetingPlace;
                });
                
                var mapButton = meetingVenue ? 
                    '<button type="button" class="map-button" onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' + 
                    encodeURIComponent(meetingVenue.address) + '\', \'_blank\')">Google Mapで開く</button>' : 
                    '';
                
                locationInfo += `
                <div class="location-item">
                    <div class="location-label">集合場所</div>
                    <div class="location-value">
                        <span>${UI.escapeHTML(event.meetingPlace)}</span>
                        ${mapButton}
                    </div>
                </div>`;
            }
            
            if (event.venue) {
                // 会場登録データから住所を検索
                var venues = Storage.loadVenues();
                var venue = venues.find(function(v) {
                    return v.name === event.venue;
                });
                
                var mapButton = venue ? 
                    '<button type="button" class="map-button" onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' + 
                    encodeURIComponent(venue.address) + '\', \'_blank\')">Google Mapで開く</button>' : 
                    '';
                
                locationInfo += `
                <div class="location-item">
                    <div class="location-label">会場</div>
                    <div class="location-value">
                        <span>${UI.escapeHTML(event.venue)}</span>
                        ${mapButton}
                    </div>
                </div>`;
            }
            
            locationInfo += '</div>';
            
            // 出欠回答期限
            var deadlineInfo = '';
            if (event.attendanceDeadline) {
                var deadlineDate = new Date(event.attendanceDeadline);
                var formattedDeadline = deadlineDate.toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                var now = new Date();
                var isExpired = deadlineDate < now;
                
                deadlineInfo = `
                <div class="deadline-box ${isExpired ? 'expired' : ''}">
                    <div>
                        <span class="deadline-icon">⏰</span>
                        出欠回答期限: ${formattedDeadline}
                    </div>
                    <div class="deadline-action">
                        <a href="attendance.html" class="button">出欠確認へ</a>
                    </div>
                </div>`;
            }
            
            // 備考
            var notesSection = '';
            if (event.notes) {
                notesSection = `
                <div class="notes-section">
                    <h3>備考</h3>
                    <div class="notes-content">${UI.escapeHTML(event.notes)}</div>
                </div>`;
            }
            
            // イベント詳細カードを表示
            eventSummary.innerHTML = `
                <div class="event-detail-card">
                    <h1 class="event-title">
                        ${UI.escapeHTML(event.title)}
                        ${typeBadge}
                    </h1>
                    
                    ${deadlineInfo}
                    ${dateTimeInfo}
                    ${locationInfo}
                    ${targetDisplay}
                    ${notesSection}
                </div>`;
        }
    };
    
    /**
     * 状況サマリーを更新
     */
    Overview.updateStatusSummary = function() {
        console.log('状況サマリーを更新します...');
        
        var statusSummary = document.getElementById('status-summary');
        if (!statusSummary) {
            console.log('状況サマリー要素が見つかりません');
            return;
        }
        
        var eventData = app.Carpool.appData;
        
        // 出欠状況の集計
        var attendance = eventData.attendance || [];
        var totalMembers = attendance.length;
        var respondedMembers = attendance.filter(function(a) { 
            return a.status === 'present' || a.status === 'absent';
        }).length;
        var presentMembers = attendance.filter(function(a) { return a.status === 'present'; }).length;
        
        // 車両提供状況の集計
        var carRegistrations = eventData.carRegistrations || [];
        var totalCars = carRegistrations.length;
        var availableCars = carRegistrations.filter(function(c) { return c.canDrive !== 'no'; }).length;
        var totalSeats = carRegistrations.reduce(function(sum, car) {
            if (car.canDrive === 'no') return sum;
            return sum + (parseInt(car.frontSeat) || 0) + 
                   (parseInt(car.middleSeat) || 0) + 
                   (parseInt(car.backSeat) || 0);
        }, 0);
        
        // 割り当て状況の集計
        var assignments = eventData.assignments || [];
        var assignedMembers = 0;
        
        assignments.forEach(function(assignment) {
            if (!assignment.seats) return;
            
            Object.keys(assignment.seats).forEach(function(seatType) {
                Object.keys(assignment.seats[seatType]).forEach(function(seatIndex) {
                    if (assignment.seats[seatType][seatIndex]) {
                        assignedMembers++;
                    }
                });
            });
        });
        
        // サマリーを表示
        statusSummary.innerHTML = `
            <div class="status-cards">
                <div class="status-card">
                    <h3>出欠状況</h3>
                    <div class="status-stats">
                        <div class="stat-item">
                            <div class="stat-value">${respondedMembers}/${totalMembers}</div>
                            <div class="stat-label">回答済み</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${presentMembers}</div>
                            <div class="stat-label">参加者</div>
                        </div>
                    </div>
                    <div class="status-actions">
                        <a href="attendance.html" class="button">出欠確認へ</a>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>車両状況</h3>
                    <div class="status-stats">
                        <div class="stat-item">
                            <div class="stat-value">${availableCars}/${totalCars}</div>
                            <div class="stat-label">提供可能車両</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${totalSeats}</div>
                            <div class="stat-label">座席数</div>
                        </div>
                    </div>
                    <div class="status-actions">
                        <a href="cars.html" class="button">車提供へ</a>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>割り当て状況</h3>
                    <div class="status-stats">
                        <div class="stat-item">
                            <div class="stat-value">${assignedMembers}/${presentMembers}</div>
                            <div class="stat-label">割り当て済み</div>
                        </div>
                    </div>
                    <div class="status-actions">
                        <a href="assignments.html" class="button">割り当てへ</a>
                    </div>
                </div>
            </div>
        `;
        
        console.log('状況サマリーの更新が完了しました');
    };
    
    /**
     * イベント情報をLINEで共有
     */
    Overview.shareEventViaLINE = function() {
        console.log('イベント情報をLINEで共有します...');
        
        var event = Storage.getSelectedEvent();
        if (!event) {
            UI.showAlert('イベント情報が見つかりません');
            return;
        }
        
        // 共有メッセージを生成
        var message = '【イベント情報】\n';
        message += Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        
        if (event.type) {
            message += '種類: ' + Utils.getEventTypeLabel(event.type) + '\n';
        }
        
        if (event.target && event.target.length > 0) {
            var targetGrades = event.target.map(function(grade) {
                return Utils.getGradeLabel(grade);
            }).join(', ');
            message += '対象: ' + targetGrades + '\n';
        }
        
        if (event.attendanceDeadline) {
            var deadlineDate = new Date(event.attendanceDeadline);
            var formattedDeadline = deadlineDate.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            message += '出欠回答期限: ' + formattedDeadline + '\n';
        }
        
        if (event.departureTime) {
            message += '出発時間: ' + event.departureTime + '\n';
        }
        
        if (event.meetingPlace) {
            message += '集合場所: ' + event.meetingPlace + '\n';
        }
        
        if (event.venue) {
            message += '会場: ' + event.venue + '\n';
        }
        
        if (event.startTime) {
            message += '時間: ' + event.startTime + (event.endTime ? ' - ' + event.endTime : '') + '\n';
        }
        
        if (event.notes) {
            message += '\n備考:\n' + event.notes + '\n';
        }
        
        // テキストをクリップボードにコピー
        if (Utils.copyToClipboard(message)) {
            UI.showAlert('イベント情報をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');
            
            // LINEでの共有（モバイルのみ）
            if (Utils.shareViaLINE(message)) {
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
    };
    
    /**
     * メインページに戻る
     */
    Overview.goToMainPage = function() {
        console.log('HUBページに戻ります...');
        window.location.href = '../hub/index.html';
    };

    /**
     * イベント概要を指定コンテナに表示（他タブから呼ばれる）
     * @param {string} containerId - 表示先要素ID
     */
    Overview.displayEventSummary = function(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var event = Storage.getSelectedEvent();
        if (!event) {
            container.innerHTML = UI.createAlert('info', 'イベントが選択されていません。');
            return;
        }
        container.className = 'event-summary ' + (event.type || 'other');
        container.innerHTML = '<strong>' + UI.escapeHTML(event.title) + '</strong>' +
            ' (' + Utils.formatDateForDisplay(event.date) + ' ' + (event.startTime || '') + ')';
    };

    /**
     * イベントデータをロード（carRegistrations/assignments/attendance/notifications）
     */
    app.Carpool.loadData = function() {
        var event = Storage.getSelectedEvent();
        if (!event) return;
        this.appData.eventId = event.id;
        var data = Storage.loadEventData(event.id);
        this.appData.carRegistrations = data.carRegistrations || [];
        this.appData.assignments     = data.assignments     || [];
        this.appData.attendance      = data.attendance      || [];
        this.appData.notifications   = data.notifications   || [];
        console.log('イベントデータをロードしました: eventId=' + event.id);
    };

    /**
     * イベントデータを保存
     */
    app.Carpool.saveData = function() {
        var eventId = this.appData.eventId;
        if (!eventId) {
            var event = Storage.getSelectedEvent();
            if (event) eventId = event.id;
        }
        if (!eventId) return;
        Storage.saveEventData(eventId, {
            carRegistrations: this.appData.carRegistrations,
            assignments:      this.appData.assignments,
            attendance:       this.appData.attendance,
            notifications:    this.appData.notifications
        });
        console.log('イベントデータを保存しました: eventId=' + eventId);
    };

    /**
     * メンバーを FCOjima.Carpool.members にロード
     */
    app.Carpool.loadMembers = function() {
        this.members = Storage.loadMembers();
        console.log('メンバーをロードしました: ' + this.members.length + '人');
    };

})(window.FCOjima);