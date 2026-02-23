/**
 * FC尾島ジュニア - 配車管琁E�Eージ 概要タブ�E機�E
 * イベント概要情報の表示と管琁E��行う
 */

FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Overview = FCOjima.Carpool.Overview || {};

(function(app) {
    // 名前空間�EショートカチE��
    var Overview = app.Carpool.Overview;
    var Utils = app.Utils;
    var UI = app.UI;
    var Storage = app.Storage;
    
    /**
     * 概要機�Eの初期匁E
     */
    Overview.init = function() {
        console.log('配車管琁E��要機�Eを�E期化してぁE��ぁE..');
        
        // イベントデータの初期匁E
        this.initEventData();
        
        // イベントリスナ�Eの設宁E
        this.setupEventListeners();
        
        console.log('配車管琁E��要機�Eの初期化が完亁E��ました');
    };
    
    /**
     * イベントリスナ�Eの設宁E
     */
    Overview.setupEventListeners = function() {
        console.log('概要タブ�Eイベントリスナ�Eを設定してぁE��ぁE..');
        
        // HUBに戻る�Eタン
        document.getElementById('back-to-hub').addEventListener('click', function() {
            Overview.goToMainPage();
        });
        
        // イベント�E有�Eタン
        document.getElementById('share-event-button').addEventListener('click', function() {
            Overview.shareEventViaLINE();
        });
        
        console.log('概要タブ�Eイベントリスナ�E設定が完亁E��ました');
    };
    
    /**
     * イベントデータを�E期化
     */
    Overview.initEventData = function() {
        console.log('イベントデータを�E期化しまぁE..');
        
        var event = Storage.getSelectedEvent();
        if (event) {
            this.displayEventData(event);
            
            // イベンチEDを保孁E
            app.Carpool.appData.eventId = event.id;
            
            // イベント固有�EチE�EタをローチE
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
                eventSummary.innerHTML = UI.createAlert('info', 'イベントが選択されてぁE��せん、EUBペ�Eジからイベントを選択してください、E);
            }
            console.log('選択されたイベントがありません');
        }
    };
    
    /**
     * イベントデータを表示
     * @param {Object} event - イベントオブジェクチE
     */
    Overview.displayEventData = function(event) {
        console.log('イベントデータを表示しまぁE ID=' + event.id + ', タイトル=' + event.title);
        
        // イベントタイトルを�EチE��ーに表示
        var header = document.getElementById('event-header');
        if (header) {
            var date = Utils.formatDateForDisplay(event.date);
            header.textContent = date + ' ' + event.title;
        }
        
        // 概要タブにイベント情報を表示
        var eventSummary = document.getElementById('event-summary');
        if (eventSummary) {
            // イベントタイプ�Eバッジ
            var typeLabel = Utils.getEventTypeLabel(event.type);
            var typeBadge = `<span class="event-type-badge ${event.type}">${typeLabel}</span>`;
            
            // 学年ターゲチE��表示
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
                        <div class="detail-label">対象備老E</div>
                        <div class="detail-value">${UI.escapeHTML(event.targetNotes)}</div>
                    </div>`;
                }
            }
            
            // 日時情報
            var dateTimeInfo = `
            <div class="date-time-info">
                <div class="date-time-item">
                    <div class="date-time-label">日仁E/div>
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
            
            // 場所惁E��
            var locationInfo = '<div class="location-info">';
            
            if (event.meetingPlace) {
                // 会場登録チE�Eタから住所を検索
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
                    <div class="location-label">雁E��場所</div>
                    <div class="location-value">
                        <span>${UI.escapeHTML(event.meetingPlace)}</span>
                        ${mapButton}
                    </div>
                </div>`;
            }
            
            if (event.venue) {
                // 会場登録チE�Eタから住所を検索
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
            
            // 出欠回答期陁E
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
                        出欠回答期陁E ${formattedDeadline}
                    </div>
                    <div class="deadline-action">
                        <a href="attendance.html" class="button">出欠確認へ</a>
                    </div>
                </div>`;
            }
            
            // 備老E
            var notesSection = '';
            if (event.notes) {
                notesSection = `
                <div class="notes-section">
                    <h3>備老E/h3>
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
        console.log('状況サマリーを更新しまぁE..');
        
        var statusSummary = document.getElementById('status-summary');
        if (!statusSummary) {
            console.log('状況サマリー要素が見つかりません');
            return;
        }
        
        var eventData = app.Carpool.appData;
        
        // 出欠状況�E雁E��E
        var attendance = eventData.attendance || [];
        var totalMembers = attendance.length;
        var respondedMembers = attendance.filter(function(a) { 
            return a.status === 'present' || a.status === 'absent';
        }).length;
        var presentMembers = attendance.filter(function(a) { return a.status === 'present'; }).length;
        
        // 車両提供状況�E雁E��E
        var carRegistrations = eventData.carRegistrations || [];
        var totalCars = carRegistrations.length;
        var availableCars = carRegistrations.filter(function(c) { return c.canDrive !== 'no'; }).length;
        var totalSeats = carRegistrations.reduce(function(sum, car) {
            if (car.canDrive === 'no') return sum;
            return sum + (parseInt(car.frontSeat) || 0) + 
                   (parseInt(car.middleSeat) || 0) + 
                   (parseInt(car.backSeat) || 0);
        }, 0);
        
        // 割り当て状況�E雁E��E
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
                    <h3>出欠状況E/h3>
                    <div class="status-stats">
                        <div class="stat-item">
                            <div class="stat-value">${respondedMembers}/${totalMembers}</div>
                            <div class="stat-label">回答済み</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${presentMembers}</div>
                            <div class="stat-label">参加老E/div>
                        </div>
                    </div>
                    <div class="status-actions">
                        <a href="attendance.html" class="button">出欠確認へ</a>
                    </div>
                </div>
                
                <div class="status-card">
                    <h3>車両状況E/h3>
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
                    <h3>割り当て状況E/h3>
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
        
        console.log('状況サマリーの更新が完亁E��ました');
    };
    
    /**
     * イベント情報をLINEで共朁E
     */
    Overview.shareEventViaLINE = function() {
        console.log('イベント情報をLINEで共有しまぁE..');
        
        var event = Storage.getSelectedEvent();
        if (!event) {
            UI.showAlert('イベント情報が見つかりません');
            return;
        }
        
        // 共有メチE��ージを生戁E
        var message = '【イベント情報】\n';
        message += Utils.formatDateForDisplay(event.date) + ' ' + event.title + '\n\n';
        
        if (event.type) {
            message += '種顁E ' + Utils.getEventTypeLabel(event.type) + '\n';
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
            message += '出欠回答期陁E ' + formattedDeadline + '\n';
        }
        
        if (event.departureTime) {
            message += '出発時間: ' + event.departureTime + '\n';
        }
        
        if (event.meetingPlace) {
            message += '雁E��場所: ' + event.meetingPlace + '\n';
        }
        
        if (event.venue) {
            message += '会場: ' + event.venue + '\n';
        }
        
        if (event.startTime) {
            message += '時間: ' + event.startTime + (event.endTime ? ' - ' + event.endTime : '') + '\n';
        }
        
        if (event.notes) {
            message += '\n備老E\n' + event.notes + '\n';
        }
        
        // チE��ストをクリチE�Eボ�Eドにコピ�E
        if (Utils.copyToClipboard(message)) {
            UI.showAlert('イベント情報をクリチE�Eボ�Eドにコピ�Eしました、EINEなどに貼り付けて共有できます、E);
            
            // LINEでの共有（モバイルのみ�E�E
            if (Utils.shareViaLINE(message)) {
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリチE�Eボ�Eドへのコピ�Eに失敗しました');
        }
    };
    
    /**
     * メインペ�Eジに戻めE
     */
    Overview.goToMainPage = function() {
        console.log('HUBペ�Eジに戻りまぁE..');
        window.location.href = '../hub/index.html';
    };

    /**
     * イベント概要を持E��コンチE��に表示�E�他タブから呼ばれる�E�E
     * @param {string} containerId - 表示先要素ID
     */
    Overview.displayEventSummary = function(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var event = Storage.getSelectedEvent();
        if (!event) {
            container.innerHTML = UI.createAlert('info', 'イベントが選択されてぁE��せん、E);
            return;
        }
        container.className = 'event-summary ' + (event.type || 'other');
        container.innerHTML = '<strong>' + UI.escapeHTML(event.title) + '</strong>' +
            ' (' + Utils.formatDateForDisplay(event.date) + ' ' + (event.startTime || '') + ')';
    };

    /**
     * イベントデータをロード！EarRegistrations/assignments/attendance/notifications�E�E
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
     * イベントデータを保存！EocalStorage + Firestore�E�E
     */
    app.Carpool.saveData = function() {
        var eventId = this.appData.eventId;
        if (!eventId) {
            var event = Storage.getSelectedEvent();
            if (event) eventId = event.id;
        }
        if (!eventId) return;
        var data = {
            carRegistrations: this.appData.carRegistrations,
            assignments:      this.appData.assignments,
            attendance:       this.appData.attendance,
            notifications:    this.appData.notifications
        };
        // localStorageに保孁E
        Storage.saveEventData(eventId, data);
        // Firestoreにも保孁E
        if (window.FCOjima && FCOjima.DB && FCOjima.DB.saveEventData) {
            FCOjima.DB.saveEventData(eventId, data).catch(function(e) {
                console.warn('Firestore saveEventData失敁E', e);
            });
        }
        console.log('イベントデータを保存しました: eventId=' + eventId);
    };

    /**
     * メンバ�EめEFCOjima.Carpool.members にローチE
     */
    app.Carpool.loadMembers = function() {
        this.members = Storage.loadMembers();
        console.log('メンバ�Eをロードしました: ' + this.members.length + '人');
    };

})(window.FCOjima);
