/**
 * FC尾島ジュニア - 配車管理ページ 概要タブの機能
 * イベント概要情報の表示と管理を行う
 */

(function(app) {
    // 名前空間のショートカット
    var Overview = app.Carpool.Overview;
    var Utils = app.Utils;
    var UI = app.UI;
    var Storage = app.Storage;
    
    /**
     * Utils.createMapButton関数の簡易実装
     * (Utils内で定義されていない場合の補完)
     */
    Utils.createMapButton = Utils.createMapButton || function(address, buttonText) {
        if (!address) return '';
        
        var encodedAddress = encodeURIComponent(address);
        var mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodedAddress;
        
        // モバイルデバイスでのみ表示
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            return '<button type="button" class="map-button" onclick="window.open(\'' + mapUrl + '\', \'_blank\')">' + buttonText + '</button>';
        }
        
        return '';
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
        } else {
            var eventSummary = document.getElementById('event-summary');
            if (eventSummary) {
                eventSummary.innerHTML = UI.createAlert('info', 'イベントが選択されていません。HUBページからイベントを選択してください。');
            }
        
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
            if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                var encodedMessage = encodeURIComponent(message);
                window.open('https://line.me/R/msg/text/?' + encodedMessage, '_blank');
                UI.showAlert('LINEでの共有を開始しました');
            }
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
    };
    
    /**
     * メインページに戻る
     * 問題3: carpoolのHUBに戻るボタンが機能していない - 修正
     */
    Overview.goToMainPage = function() {
        console.log('HUBページに戻ります...');
        window.location.href = 'index.html';
    };            console.log('選択されたイベントがありません');
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
            // 学年ターゲット表示
            var targetDisplay = '';
            if (event.target && event.target.length > 0) {
                var targetGrades = event.target.map(function(grade) {
                    return Utils.getGradeLabel(grade);
                }).join(', ');
                
                targetDisplay = '\
                <div class="detail-row">\
                    <span class="detail-label">対象:</span>\
                    <span class="detail-value">' + targetGrades + '</span>\
                </div>';
                
                if (event.targetNotes) {
                    targetDisplay += '\
                    <div class="detail-row">\
                        <span class="detail-label">対象備考:</span>\
                        <span class="detail-value">' + UI.escapeHTML(event.targetNotes) + '</span>\
                    </div>';
                }
            }
            
            // 出欠回答期限
            var deadlineDisplay = '';
            if (event.attendanceDeadline) {
                var deadlineDate = new Date(event.attendanceDeadline);
                var formattedDeadline = deadlineDate.toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                deadlineDisplay = '\
                <div class="detail-row">\
                    <span class="detail-label">出欠回答期限:</span>\
                    <span class="detail-value">' + formattedDeadline + '</span>\
                </div>';
            }
            
            // 出発時間
            var departureDisplay = '';
            if (event.departureTime) {
                departureDisplay = '\
                <div class="detail-row">\
                    <span class="detail-label">出発時間:</span>\
                    <span class="detail-value">' + event.departureTime + '</span>\
                </div>';
            }
            
            // 集合場所（GoogleMapリンク付き）
            var meetingPlaceDisplay = '';
            if (event.meetingPlace) {
                // 会場登録データから住所を検索
                var venues = Storage.loadVenues();
                var meetingVenue = venues.find(function(v) {
                    return v.name === event.meetingPlace;
                });
                
                var mapButton = meetingVenue ? 
                    Utils.createMapButton(meetingVenue.address, 'Google Mapで開く') : 
                    '';
                
                meetingPlaceDisplay = '\
                <div class="detail-row">\
                    <span class="detail-label">集合場所:</span>\
                    <span class="detail-value">' + UI.escapeHTML(event.meetingPlace) + ' ' + mapButton + '</span>\
                </div>';
            }
            
            // 会場（GoogleMapリンク付き）
            var venueDisplay = '';
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
                
                venueDisplay = '\
                <div class="detail-row">\
                    <span class="detail-label">会場:</span>\
                    <span class="detail-value">' + UI.escapeHTML(event.venue) + ' ' + mapButton + '</span>\
                </div>';
            } else {
                venueDisplay = '\
                <div class="detail-row">\
                    <span class="detail-label">会場:</span>\
                    <span class="detail-value">未設定</span>\
                </div>';
            }
            
            // 時間
            var timeDisplay = '\
            <div class="detail-row">\
                <span class="detail-label">時間:</span>\
                <span class="detail-value">' + (event.startTime || '') + 
                (event.endTime ? ' - ' + event.endTime : '') + '</span>\
            </div>';
            
            // 備考
            var notesDisplay = '';
            if (event.notes) {
                notesDisplay = '\
                <div class="detail-row">\
                    <span class="detail-label">備考:</span>\
                    <span class="detail-value">' + UI.escapeHTML(event.notes) + '</span>\
                </div>';
            }
            
            // イベント詳細カードを表示
            eventSummary.innerHTML = '\
                <div class="event-detail-card">\
                    <h3>' + UI.escapeHTML(event.title) + '</h3>\
                    <div class="detail-row">\
                        <span class="detail-label">日付:</span>\
                        <span class="detail-value">' + Utils.formatDateForDisplay(event.date) + '</span>\
                    </div>\
                    <div class="detail-row">\
                        <span class="detail-label">種類:</span>\
                        <span class="detail-value">' + Utils.getEventTypeLabel(event.type) + '</span>\
                    </div>\
                    ' + targetDisplay + '\
                    ' + deadlineDisplay + '\
                    ' + departureDisplay + '\
                    ' + meetingPlaceDisplay + '\
                    ' + venueDisplay + '\
                    ' + timeDisplay + '\
                    ' + notesDisplay + '\
                </div>';
        }