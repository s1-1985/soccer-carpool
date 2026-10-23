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
    Overview.init = async function() {
        console.log('配車管理概要機能を初期化しています...');

        // イベントデータの初期化（Firestore対応）
        await this.initEventData();

        // イベントリスナーの設定
        this.setupEventListeners();

        console.log('配車管理概要機能の初期化が完了しました');
    };
    
    /**
     * イベントリスナーの設定
     */
    Overview.setupEventListeners = function() {
        if (Overview._listenersSetup) return;
        Overview._listenersSetup = true;
        console.log('概要タブのイベントリスナーを設定しています...');

        // HUBに戻るボタン
        var backBtn = document.getElementById('back-to-hub');
        if (backBtn) backBtn.addEventListener('click', function() { Overview.goToMainPage(); });

        // イベント共有ボタン
        var shareBtn = document.getElementById('share-event-button');
        if (shareBtn) shareBtn.addEventListener('click', function() { Overview.shareEventViaLINE(); });

        console.log('概要タブのイベントリスナー設定が完了しました');
    };
    
    /**
     * イベントデータを初期化
     */
    Overview.initEventData = async function() {
        console.log('イベントデータを初期化します...');

        var event = Storage.getSelectedEvent();
        if (event) {
            this.displayEventData(event);
            this.refreshVenues(event);
            this.initFileAttachment(event.id);

            // イベントデータをロード（Firestore優先 → localStorageフォールバック）
            await app.Carpool.loadEventDataForSelected();
            // 帯同指導者（HUBで監督が決めた担当）
            await app.Carpool.loadEventCoaches();
            this.renderEventCoaches();
            // 出欠の対象（対象学年の選手など）を数えるためにメンバーを読む
            if (!(app.Carpool.members && app.Carpool.members.length) && FCOjima.DB && FCOjima.DB.loadMembers) {
                try { app.Carpool.members = await FCOjima.DB.loadMembers(); } catch (e) { app.Carpool.loadMembers(); }
            }

            console.log('イベントデータを読み込みました: ID=' + event.id + ', タイトル=' + event.title);
            
            // 車提供タブとアサインメントタブでも簡易情報を表示
            var carEventInfo = document.getElementById('carEventInfo');
            if (carEventInfo) {
                carEventInfo.innerHTML = '\
                    <div class="event-summary">\
                        <strong>' + UI.escapeHTML(event.title) + '</strong> \
                        (' + Utils.formatDateForDisplay(event.date) + ' ' + UI.escapeHTML(event.startTime || '') + ')\
                    </div>';
            }
            
            var assignmentEventInfo = document.getElementById('assignmentEventInfo');
            if (assignmentEventInfo) {
                assignmentEventInfo.innerHTML = '\
                    <div class="event-summary">\
                        <strong>' + UI.escapeHTML(event.title) + '</strong> \
                        (' + Utils.formatDateForDisplay(event.date) + ' ' + UI.escapeHTML(event.startTime || '') + ')\
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
            var typeBadge = `<span class="event-type-badge ${UI.escapeHTML(event.type)}">${UI.escapeHTML(typeLabel)}</span>`;
            
            // 学年ターゲット表示
            var targetDisplay = '';
            if (event.target && event.target.length > 0) {
                var targetGrades = event.target.map(function(grade) {
                    return UI.escapeHTML(Utils.getGradeLabel(grade));
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
                    <div class="date-time-value">${UI.escapeHTML(event.startTime)}${event.endTime ? ' - ' + UI.escapeHTML(event.endTime) : ''}</div>
                </div>`;
            }
            
            if (event.departureTime) {
                dateTimeInfo += `
                <div class="date-time-item">
                    <div class="date-time-label">出発時間</div>
                    <div class="date-time-value">${UI.escapeHTML(event.departureTime)}</div>
                </div>`;
            }
            
            dateTimeInfo += '</div>';
            
            // 場所情報
            var locationInfo = '<div class="location-info">';
            
            if (event.meetingPlace) {
                // 会場登録データから住所を検索（なければ会場名でマップ検索）
                var meetingVenue = Overview._findVenue(event.meetingPlace);
                var meetingQuery = (meetingVenue && meetingVenue.address) ? meetingVenue.address : event.meetingPlace;
                var meetingMapBtn = '<button type="button" class="map-button" onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' +
                    Utils.encodeForOnclick(meetingQuery) + '\', \'_blank\')">地図を開く</button>';

                locationInfo += `
                <div class="location-item">
                    <div class="location-label">集合場所</div>
                    <div class="location-value">
                        <span>${UI.escapeHTML(event.meetingPlace)}</span>
                        ${meetingMapBtn}
                    </div>
                </div>`;
            }

            if (event.venue) {
                // 会場登録データから住所を検索（なければ会場名でマップ検索）
                var venueData = Overview._findVenue(event.venue);
                var venueQuery = (venueData && venueData.address) ? venueData.address : event.venue;
                var venueMapBtn = '<button type="button" class="map-button" onclick="window.open(\'https://www.google.com/maps/search/?api=1&query=' +
                    Utils.encodeForOnclick(venueQuery) + '\', \'_blank\')">地図を開く</button>';

                locationInfo += `
                <div class="location-item">
                    <div class="location-label">会場</div>
                    <div class="location-value">
                        <span>${UI.escapeHTML(event.venue)}</span>
                        ${venueMapBtn}
                    </div>
                    <div id="overview-weather" class="weather-slot"></div>
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
            
            // 個人持ち物＋荷物（2026-07-21ユーザー要望: イベント概要にも表示）
            var checklistSection = '';
            if (app.Checklist) {
                checklistSection = (app.Checklist.formatChips(event.type, event.checklistExtra, event.checklist) || '')
                    + (app.Checklist.formatLuggage(event.luggage) || '');
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
                    <div id="overview-coaches"></div>
                    ${targetDisplay}
                    ${checklistSection}
                    ${notesSection}
                </div>`;

            // 会場の現地天気（非同期。取得失敗しても画面は壊さない）
            Overview._renderWeather(event);
        }
    };

    /**
     * 会場名から会場（住所）を探す。サーバーから読んだ最新の会場一覧を優先し、
     * まだ読めていなければ端末に残っている一覧を使う
     */
    Overview._findVenue = function(name) {
        if (!name) return null;
        var list = Overview._venues || ((app.Hub && app.Hub.venues) ? app.Hub.venues : Storage.loadVenues()) || [];
        return list.find(function(v) { return v.name === name; }) || null;
    };

    /**
     * 会場一覧をサーバーから読み直し、集合場所・会場の住所が変わっていれば地図・天気を表示し直す。
     * 以前は端末に残っている会場一覧（HUBを開いたときの保存分）しか見ておらず、共有リンクから直接開いた
     * 端末や、その後に登録・住所変更された会場では、地図が会場名だけの検索になり天気も市区町村単位になっていた
     */
    Overview.refreshVenues = function(event) {
        if (!(window.FCOjima && FCOjima.DB && FCOjima.DB.loadVenues) || !event) return;
        var before = [event.meetingPlace, event.venue].map(function(n) {
            var v = Overview._findVenue(n);
            return v ? (v.address || '') : null;
        });
        FCOjima.DB.loadVenues().then(function(venues) {
            Overview._venues = venues;
            if (Storage.safeSetItem) Storage.safeSetItem(Storage.PREFIX + 'venues', JSON.stringify(venues));
            var after = [event.meetingPlace, event.venue].map(function(n) {
                var v = Overview._findVenue(n);
                return v ? (v.address || '') : null;
            });
            if (JSON.stringify(before) !== JSON.stringify(after)) Overview.displayEventData(event);
        }).catch(function(e) {
            console.warn('会場一覧の読み込みに失敗（端末に残っている一覧を使います）:', e);
        });
    };

    /**
     * 会場の天気予報（当日までの数日分ウィジェット）を #overview-weather に差し込む
     */
    Overview._renderWeather = function(event) {
        if (!event || !event.venue || !app.Weather || !app.Weather.getDailyForecast) return;
        var target = document.getElementById('overview-weather');
        if (!target) return;
        var venueData = Overview._findVenue(event.venue);
        var address = venueData && venueData.address;
        app.Weather.getDailyForecast(event.venue, address, event.date, event).then(function(result) {
            var el = document.getElementById('overview-weather');
            if (el) el.innerHTML = app.Weather.formatWidget(result, event.venue, address);
        });
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
        // 出欠・車・割り当ての数え方は HUB の「今週の予定」と共通（Utils.carpoolStatus）。
        // 出欠の対象は、出欠ページを誰もまだ開いていない（出欠表が空の）ときも対象学年の選手などを数える。
        // 以前は出欠表の行だけを数えていたため、最初は「出欠 0/0」と出て対象がいないように見えた
        var st = app.Utils.carpoolStatus(Storage.getSelectedEvent(), app.Carpool.members || [], eventData,
            app.Carpool.eventCoaches ? app.Carpool.eventCoaches() : []);
        var totalMembers = st.attendance.total;
        var respondedMembers = st.attendance.present + st.attendance.absent;
        var presentMembers = st.attendance.present;
        // 車両提供状況（乗車可能な席の数は、車提供で登録した兄弟児などが乗る席を除く）
        var totalCars = st.totalCars;
        var availableCars = st.cars;
        var totalSeats = st.seats;
        // 割り当て状況: 座席が要る人（運転手を除く）のうち、今ある車の座席に割り当て済みの人数。
        // 荷物・メンバー外乗員・割り当て後に「不参加」になった人・削除した車の乗員は数えない
        var needSeatCount = st.need;
        var assignedMembers = st.assigned;
        
        var attendanceOk = respondedMembers >= totalMembers && totalMembers > 0;
        // 座席数は運転席を含まないため、運転手を除いた参加者の数と比べる
        var carsOk = availableCars > 0 && totalSeats >= needSeatCount;
        var assignOk = needSeatCount > 0 && assignedMembers >= needSeatCount;

        statusSummary.innerHTML = `
            <div class="ov-grid">
                <a href="attendance.html" class="ov-card ${attendanceOk ? 'ok' : (respondedMembers > 0 ? 'partial' : '')}">
                    <div class="ov-icon">👥</div>
                    <div class="ov-body">
                        <div class="ov-title">出欠</div>
                        <div class="ov-main">${respondedMembers}<span class="ov-of">/${totalMembers}</span></div>
                        <div class="ov-sub">参加 <strong>${presentMembers}</strong>人</div>
                    </div>
                    <div class="ov-arrow">›</div>
                </a>
                <a href="cars.html" class="ov-card ${carsOk ? 'ok' : (availableCars > 0 ? 'partial' : '')}">
                    <div class="ov-icon">🚗</div>
                    <div class="ov-body">
                        <div class="ov-title">車両</div>
                        <div class="ov-main">${availableCars}<span class="ov-of">/${totalCars}</span></div>
                        <div class="ov-sub">乗車可能 <strong>${totalSeats}</strong>席</div>
                    </div>
                    <div class="ov-arrow">›</div>
                </a>
                <a href="assignments.html" class="ov-card ${assignOk ? 'ok' : (assignedMembers > 0 ? 'partial' : '')}">
                    <div class="ov-icon">🗂</div>
                    <div class="ov-body">
                        <div class="ov-title">割り当て</div>
                        <div class="ov-main">${assignedMembers}<span class="ov-of">/${needSeatCount}</span></div>
                        <div class="ov-sub">人割り当て済み</div>
                    </div>
                    <div class="ov-arrow">›</div>
                </a>
                <a href="notifications.html" class="ov-card">
                    <div class="ov-icon">📣</div>
                    <div class="ov-body">
                        <div class="ov-title">連絡</div>
                        <div class="ov-main">${(eventData.notifications || []).length}<span class="ov-of">件</span></div>
                        <div class="ov-sub">連絡事項</div>
                    </div>
                    <div class="ov-arrow">›</div>
                </a>
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

        var coaches = app.Carpool.eventCoaches ? app.Carpool.eventCoaches() : [];
        if (coaches.length) {
            message += '帯同指導者: ' + coaches.map(function(m) { return m.name; }).join('、') + '\n';
        }

        if (event.notes) {
            message += '\n備考:\n' + event.notes + '\n';
        }

        // 出欠確認URLを追加（イベントID付き。IDがないと別の端末で開いたときにイベントが特定できない）
        message += '\n▼ 出欠確認:\n' + app.Carpool.pageUrl('attendance.html');

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
        // 保存中のデータがあれば書き込み完了を待ってから移動（移動で通信が切られないように）
        app.Carpool.whenSaved().then(function() {
            window.location.href = '../hub/index.html';
        });
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
            ' (' + Utils.formatDateForDisplay(event.date) + ' ' + UI.escapeHTML(event.startTime || '') + ')' +
            Overview.coachesLine('ev-coaches-line');
    };

    /** 帯同指導者の1行（「🧢 帯同指導者: 鈴木 コーチ・佐藤 監督」）。まだ決まっていなければ空 */
    Overview.coachesLine = function(cls) {
        var coaches = app.Carpool.eventCoaches ? app.Carpool.eventCoaches() : [];
        if (!coaches.length) return '';
        return '<div class="' + cls + '"><span class="ev-coaches-label">🧢 帯同指導者</span>' +
            coaches.map(function(m) { return '<span class="ev-coach">' + UI.escapeHTML(m.name) + '</span>'; }).join('') + '</div>';
    };

    /** 概要の「帯同指導者」（予定の詳細の下。HUBで監督が担当を決めたら出る） */
    Overview.renderEventCoaches = function() {
        var slot = document.getElementById('overview-coaches');
        if (slot) slot.innerHTML = Overview.coachesLine('ev-coaches-line ov-coaches');
    };

    // =============================================
    //  イベント固有データ（eventData/{eventId}）の読み込み・保存
    // =============================================
    //
    // 以前の saveData は、出欠・車両・座席割り当て・連絡・コメントの全フィールドを
    // 「ページを開いた時点の手元の内容」で丸ごと上書きしていた。そのため
    //  - 出欠/車両/連絡ページはコメントを読み込んでいないのに空で上書きし、
    //    保護者が出欠を保存するたびに配車担当のコメント履歴が消えていた
    //  - 配車担当が座席を保存すると、ページを開いた後に保護者が回答した出欠が巻き戻った
    //  - 複数の保護者が同時に出欠を回答すると、後から保存した人の古い内容で
    //    先に回答した人の出欠が消えた
    // そこで、読み込んだ時点の内容（基準）と比べて手元で変更したフィールドだけを、
    // トランザクションで最新の内容とマージして書き込む。

    // フィールドごとの同時編集時のマージ方式
    //  keyed  : 要素をkeyで突き合わせ、手元で追加・変更・削除した要素だけを反映（出欠: 氏名）
    //  list   : 手元で追加・変更・削除した要素だけを反映、追加分は末尾（車両登録など）
    //  prepend: list と同じだが追加分は先頭（新しい順に並ぶ連絡・コメント履歴）
    //  replace: 手元で変更した場合のみ丸ごと上書き（座席割り当て・最新コメント）
    var EVENT_DATA_FIELDS = {
        attendance:        { mode: 'keyed', key: function(a) { return a ? String(a.name) : ''; } },
        carRegistrations:  { mode: 'list' },
        assignments:       { mode: 'replace' },
        notifications:     { mode: 'prepend' },
        comment:           { mode: 'replace', empty: '' },
        comments:          { mode: 'prepend' },
        manualDriverNames: { mode: 'list' },
        // 出欠表から手動で外した人（対象学年の選手でも自動で戻さないための記録）
        attendanceRemoved: { mode: 'list' },
        // 座席の割り当てで運転手になった人（運転席から外しても配置待ちに出す。Carpool.driverPool）
        driverPeople:      { mode: 'list' }
    };

    function emptyOf(field) {
        var def = EVENT_DATA_FIELDS[field];
        return (def && def.empty !== undefined) ? def.empty : [];
    }
    function cloneJSON(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
    function sameJSON(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

    /** 要素をkeyで突き合わせる3方向マージ */
    function mergeKeyed(base, local, remote, keyFn) {
        var baseByKey = Object.create(null);
        base.forEach(function(it) { baseByKey[keyFn(it)] = it; });
        var localKeys = Object.create(null);
        local.forEach(function(it) { localKeys[keyFn(it)] = true; });
        var remoteKeys = Object.create(null);
        remote.forEach(function(it) { remoteKeys[keyFn(it)] = true; });

        // 手元で削除した要素を除く
        var result = remote.filter(function(r) {
            var k = keyFn(r);
            return !((k in baseByKey) && !(k in localKeys));
        });
        local.forEach(function(it) {
            var k = keyFn(it);
            if (k in baseByKey) {
                if (sameJSON(baseByKey[k], it)) return; // 手元では変更していない → 最新の内容を尊重
            } else if (k in remoteKeys) {
                return; // 手元で新規追加したが、他の人も同時に追加済み → 先に保存された方を尊重
            }
            var idx = result.findIndex(function(r) { return keyFn(r) === k; });
            if (idx >= 0) result[idx] = it; else result.push(it);
        });
        return result;
    }

    /** 順序つきリストの3方向マージ（要素の同一性は内容で判定） */
    function mergeList(base, local, remote, prepend) {
        var J = function(x) { return JSON.stringify(x); };
        function unmatched(from, against) {
            var pool = Object.create(null);
            against.forEach(function(it) { var k = J(it); pool[k] = (pool[k] || 0) + 1; });
            var idx = [];
            from.forEach(function(it, i) {
                var k = J(it);
                if (pool[k] > 0) pool[k]--; else idx.push(i);
            });
            return idx;
        }
        var removedIdx = unmatched(base, local); // 基準にあって手元から消えた
        var addedIdx = unmatched(local, base);   // 手元で増えた
        var addedSet = new Set(addedIdx);
        var replaced = new Set();
        var result = remote.slice();

        removedIdx.forEach(function(bi) {
            var k = J(base[bi]);
            var ri = result.findIndex(function(r) { return J(r) === k; });
            // 件数が同じで同じ位置が入れ替わっている＝その場での編集（座席数変更など）。
            // 並び順（座席割り当てが車の順番を参照している）を崩さないよう置き換える
            if (base.length === local.length && addedSet.has(bi)) {
                replaced.add(bi);
                if (ri >= 0) result[ri] = local[bi];
                return;
            }
            if (ri >= 0) result.splice(ri, 1);
        });
        var toAdd = addedIdx.filter(function(i) { return !replaced.has(i); })
            .map(function(i) { return local[i]; });
        return prepend ? toAdd.concat(result) : result.concat(toAdd);
    }

    function mergeField(field, base, local, remote) {
        var def = EVENT_DATA_FIELDS[field];
        if (!def || def.mode === 'replace') return local;
        if (!Array.isArray(local) || !Array.isArray(base) || !Array.isArray(remote)) return local;
        // 読み込んだ後に誰も変更していなければ、手元の内容をそのまま書く（通常はこれ）
        if (sameJSON(remote, base)) return local;
        if (def.mode === 'keyed') return mergeKeyed(base, local, remote, def.key);
        return mergeList(base, local, remote, def.mode === 'prepend');
    }

    /** 保存済みの座席割り当てを現在の車両一覧に対応づける（中身は Utils.matchAssignmentsToCars。HUB と共通） */
    app.Carpool.matchAssignmentsToCars = function(cars, assignments) {
        return app.Utils.matchAssignmentsToCars(cars, assignments);
    };

    var _saveChain = Promise.resolve();
    var _savePending = 0;

    /**
     * 読み込んだイベントデータを appData に展開し、保存時の差分判定の基準として記録する。
     * 各ページはイベントデータを読み込んだら必ずこれを通すこと。
     * @param {Object|null} data
     */
    app.Carpool.applyEventData = function(data) {
        data = data || {};
        // 配列のはずの項目が壊れていても（端末キャッシュ・手入力データ）画面が止まらないよう形を整える
        if (FCOjima.DB && FCOjima.DB.normalizeEventData) data = FCOjima.DB.normalizeEventData(Object.assign({}, data));
        var appData = this.appData;
        var base = {};
        Object.keys(EVENT_DATA_FIELDS).forEach(function(f) {
            var v = (data[f] !== undefined && data[f] !== null) ? data[f] : emptyOf(f);
            appData[f] = cloneJSON(v);
            base[f] = cloneJSON(v);
        });
        this._base = base;
        // 上の「連絡」に、この予定の新着の連絡の件数（js/common/inbox.js）
        if (FCOjima.Inbox && appData.eventId != null) FCOjima.Inbox.renderCarpoolNav(appData.eventId, appData.notifications);
    };

    /**
     * 選択中イベントのイベントデータを読み込む（Firestore優先 → localStorageフォールバック）
     * @returns {Promise<boolean>} Firestoreから読めたか
     */
    app.Carpool.loadEventDataForSelected = async function() {
        var event = Storage.getSelectedEvent();
        if (!event) return false;
        this.appData.eventId = event.id;
        // サーバーから読めなかった（通信エラー）か。「まだ配車データが無い」と区別する。
        // 読めなかったときに表示しているのは端末に残っている前回の内容（古いかもしれない）
        this._eventDataLoadFailed = false;
        if (window.FCOjima && FCOjima.DB && FCOjima.DB.loadEventData) {
            try {
                var data = await FCOjima.DB.loadEventData(event.id);
                if (data) {
                    this.applyEventData(data);
                    return true;
                }
            } catch (e) {
                console.warn('Firestoreイベントデータロード失敗:', e);
                this._eventDataLoadFailed = true;
                if (UI && UI.showAlert) {
                    UI.showAlert('サーバーから最新の出欠・配車を読み込めませんでした。この端末に残っている前回の内容を表示しています（変更されている可能性があります）。電波の良い所で再読み込みしてください', 'warning', 10000);
                }
            }
        }
        this.loadData();
        return false;
    };

    /**
     * イベントデータをlocalStorageからロード（Firestoreが使えないときのフォールバック）
     */
    app.Carpool.loadData = function() {
        var event = Storage.getSelectedEvent();
        if (!event) return;
        this.appData.eventId = event.id;
        this.applyEventData(Storage.loadEventData(event.id));
        console.log('イベントデータをロードしました: eventId=' + event.id);
    };

    /**
     * イベントデータを保存（localStorage + Firestore）。
     * Firestoreへは、読み込み後に手元で変更したフィールドだけを最新の内容とマージして書き込む。
     * 保存は順番に1件ずつ処理する。
     * @returns {Promise} Firestoreへの保存完了（失敗時もrejectはせず通知のみ）
     */
    app.Carpool.saveData = function() {
        var self = this;
        var eventId = this.appData.eventId;
        if (!eventId) {
            var event = Storage.getSelectedEvent();
            if (event) eventId = event.id;
        }
        if (!eventId) return Promise.resolve();

        // 端末内キャッシュ（オフライン時のフォールバック用）
        var all = {};
        Object.keys(EVENT_DATA_FIELDS).forEach(function(f) {
            all[f] = (self.appData[f] !== undefined && self.appData[f] !== null) ? self.appData[f] : emptyOf(f);
        });
        Storage.saveEventData(eventId, all);

        if (!(window.FCOjima && FCOjima.DB && FCOjima.DB.updateEventData)) return Promise.resolve();
        _savePending++;
        _saveChain = _saveChain.then(function() {
            return self._syncEventData(eventId);
        }).catch(function(e) {
            console.warn('Firestore saveEventData失敗:', e);
            if (UI && UI.showAlert) {
                UI.showAlert('サーバーへの保存に失敗しました。通信環境を確認して、もう一度保存してください', 'error', 6000);
            }
        }).then(function() {
            _savePending--;
        });
        return _saveChain;
    };

    /** 保存待ちがすべて終わったら解決するPromise（ページ移動前に待つ） */
    app.Carpool.whenSaved = function() {
        return _saveChain;
    };

    app.Carpool._syncEventData = function(eventId) {
        var self = this;
        var base = this._base || {};
        var local = {};
        var changed = [];
        Object.keys(EVENT_DATA_FIELDS).forEach(function(f) {
            var v = (self.appData[f] !== undefined && self.appData[f] !== null) ? self.appData[f] : emptyOf(f);
            local[f] = cloneJSON(v);
            var b = (base[f] !== undefined) ? base[f] : emptyOf(f);
            if (!sameJSON(local[f], b)) changed.push(f);
        });
        if (changed.length === 0) return Promise.resolve();

        var wroteAll = false;
        return FCOjima.DB.updateEventData(eventId, function(remote) {
            var patch = {};
            wroteAll = !remote;
            if (!remote) {
                // まだドキュメントがない（初回保存・localStorageからの移行）: 手元の内容をすべて書く
                Object.keys(EVENT_DATA_FIELDS).forEach(function(f) { patch[f] = local[f]; });
                return patch;
            }
            changed.forEach(function(f) {
                var b = (base[f] !== undefined) ? base[f] : emptyOf(f);
                var r = (remote[f] !== undefined && remote[f] !== null) ? remote[f] : emptyOf(f);
                patch[f] = mergeField(f, b, local[f], r);
            });
            return patch;
        }).then(function() {
            // 保存できた手元の内容を新しい基準にする（次回はここから先の変更だけを反映）
            self._base = self._base || {};
            (wroteAll ? Object.keys(EVENT_DATA_FIELDS) : changed).forEach(function(f) {
                self._base[f] = local[f];
            });
            console.log('イベントデータを保存しました: eventId=' + eventId + ' (' + changed.join(', ') + ')');
        });
    };

    // 保存中にページを離れようとしたら確認（PCブラウザのみ有効）
    window.addEventListener('beforeunload', function(e) {
        if (_savePending > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // 保存中に画面上部のタブや概要のカードなど（ページ内リンク）で移動しようとしたら、保存が
    // 終わってから移動する。スマホでは beforeunload の確認が出ないため、出欠を選んだ直後に
    // 別のタブへ移ると通信が切られて回答が保存されないことがあった
    document.addEventListener('click', function(e) {
        if (_savePending === 0 || e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
        if (a.origin !== window.location.origin) return;
        e.preventDefault();
        var href = a.href;
        app.Carpool.whenSaved().then(function() { window.location.href = href; });
    });

    /**
     * 選択中イベントを確定する。
     * - URLに ?event=ID があればそのイベントを選択（LINEで共有したリンクを別の端末・
     *   ブラウザで開いたときは sessionStorage が空のため、IDなしリンクでは
     *   「イベントが選択されていません」になっていた）
     * - Firestoreから最新のイベント内容を取り直す（HUBで選んだ後に編集された内容を反映）
     * @returns {Promise<Object|null>}
     */
    app.Carpool.ensureSelectedEvent = async function() {
        var urlId = null;
        try { urlId = new URLSearchParams(window.location.search).get('event'); } catch (e) {}
        var current = Storage.getSelectedEvent();
        if (urlId && current && String(current.id) !== String(urlId)) current = null;
        var id = urlId || (current && current.id);
        if (!id) return current;
        try {
            if (window.FCOjimaFirebase && FCOjimaFirebase.Collections) {
                var doc = await FCOjimaFirebase.Collections.events().doc(String(id)).get();
                if (doc.exists) {
                    var ev = Object.assign({}, doc.data(), { id: doc.id });
                    if (FCOjima.DB && FCOjima.DB.normalizeEvent) FCOjima.DB.normalizeEvent(ev);
                    Storage.setSelectedEvent(ev);
                    return ev;
                }
                // サーバーにない＝削除されたイベント。以前は同じタブで選んでいた古い内容のまま
                // 表示を続け、出欠や車両を入力すると削除済みイベントのデータが作られていた
                try { sessionStorage.removeItem(Storage.PREFIX + 'selectedEvent'); } catch (e) {}
                if (UI && UI.showAlert) UI.showAlert('このイベントは削除されています。HUBで予定を確認してください', 'warning', 8000);
                return null;
            }
        } catch (e) {
            console.warn('イベント情報の取得に失敗:', e);
        }
        if (!current) {
            try { sessionStorage.removeItem(Storage.PREFIX + 'selectedEvent'); } catch (e) {}
        }
        return current;
    };

    /**
     * 配車管理ページの共有用URL（イベントID付き）
     * @param {string} page - 'attendance.html' など
     */
    app.Carpool.pageUrl = function(page) {
        var event = Storage.getSelectedEvent();
        var url = window.location.origin + '/carpool/' + page;
        if (event && event.id !== undefined && event.id !== null) url += '?event=' + encodeURIComponent(String(event.id));
        // LINE で押すと Safari・Chrome で開く（LINE の中のブラウザでは Google のログインができない）
        url = app.Utils.lineSafeUrl(url);
        return url;
    };

    /**
     * ファイル添付機能の初期化
     */
    Overview.initFileAttachment = async function(eventId) {
        var section = document.getElementById('overview-files-section');
        var list = document.getElementById('overview-files-list');
        var uploadBtn = document.getElementById('overview-file-upload-btn');
        var fileInput = document.getElementById('overview-file-input');
        if (!section || !list) return;
        section.style.display = 'block';
        await Overview.loadEventFiles(eventId, list);
        if (uploadBtn && fileInput) {
            var newBtn = uploadBtn.cloneNode(true);
            uploadBtn.parentNode.replaceChild(newBtn, uploadBtn);
            newBtn.addEventListener('click', function() {
                fileInput.value = '';
                fileInput.click();
            });
            fileInput.onchange = async function() {
                if (!fileInput.files.length) return;
                newBtn.textContent = 'アップロード中...';
                newBtn.disabled = true;
                await Overview.uploadEventFiles(eventId, fileInput.files, list);
                newBtn.textContent = 'ファイルを追加';
                newBtn.disabled = false;
            };
        }
    };

    Overview.loadEventFiles = async function(eventId, list) {
        list.innerHTML = '<p style="color:#999;font-size:12px;">読み込み中...</p>';
        try {
            if (!firebase.storage || typeof firebase.storage !== 'function') {
                throw new Error('Storage SDK未読み込み');
            }
            var storage = firebase.storage();
            var ref = storage.ref('teams/' + FCOjimaFirebase.TEAM_ID + '/events/' + eventId);
            var timeout = new Promise(function(_, reject) {
                setTimeout(function() { reject(new Error('タイムアウト(10秒)')); }, 10000);
            });
            var result = await Promise.race([ref.listAll(), timeout]);
            if (result.items.length === 0) {
                list.innerHTML = '<p style="color:#999;font-size:12px;">ファイルなし</p>';
                return;
            }
            list.innerHTML = '';
            for (var i = 0; i < result.items.length; i++) {
                var item = result.items[i];
                var url = await item.getDownloadURL();
                var row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:4px;';
                var a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.style.cssText = 'flex:1;padding:6px 10px;background:#f0f4ff;border-radius:6px;font-size:13px;color:#2563eb;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                a.textContent = item.name;
                var delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.textContent = '取消';
                delBtn.style.cssText = 'flex-shrink:0;padding:4px 10px;background:#dc3545;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;';
                delBtn.addEventListener('click', (function(fileRef, rowEl, eventIdForDel, listEl) {
                    return async function() {
                        if (!confirm(fileRef.name + ' を削除しますか？')) return;
                        try {
                            await fileRef.delete();
                            rowEl.remove();
                            var remaining = listEl.querySelectorAll('div');
                            if (remaining.length === 0) listEl.innerHTML = '<p style="color:#999;font-size:12px;">ファイルなし</p>';
                        } catch(e) {
                            UI.showAlert('削除に失敗しました: ' + e.message);
                        }
                    };
                })(item, row, eventId, list));
                row.appendChild(a);
                row.appendChild(delBtn);
                list.appendChild(row);
            }
        } catch(e) {
            list.innerHTML = '<p style="color:#c00;font-size:12px;">読み込みエラー: ' + e.message + '</p>';
            console.error('ファイル読み込みエラー:', e);
        }
    };

    Overview.uploadEventFiles = async function(eventId, files, list) {
        try {
            if (!firebase.storage || typeof firebase.storage !== 'function') {
                throw new Error('Storage SDK未読み込み');
            }
            // 種類・サイズ検証（PDF/Excel/Word/画像/テキスト・10MB。共通モジュールに集約）
            var toUpload = files;
            if (app.EventFiles && app.EventFiles.validate) {
                var v = app.EventFiles.validate(files);
                if (v.errors.length > 0) {
                    UI.showAlert('添付できないファイルがあります:\n' + v.errors.join('\n'));
                }
                toUpload = v.ok;
                if (toUpload.length === 0) return;
            }
            // 1イベントあたりの添付上限（既存分込みで10個。共通モジュールに集約）
            var taken = new Set();
            if (app.EventFiles && app.EventFiles.listNames) {
                var existingCount = 0;
                try {
                    var names = await app.EventFiles.listNames(eventId);
                    existingCount = names.length;
                    names.forEach(function(n) { taken.add(n); });
                } catch (e) { /* 件数取得失敗時はチェックを諦める */ }
                var MAX_FILES = 10;
                var room = MAX_FILES - existingCount;
                if (room <= 0) {
                    UI.showAlert('添付ファイルは1イベントにつき最大' + MAX_FILES + '個までです（現在' + existingCount + '個）。新しいファイルを追加するには、先に不要なファイルを削除してください。');
                    return;
                }
                if (toUpload.length > room) {
                    UI.showAlert('添付ファイルは1イベントにつき最大' + MAX_FILES + '個までです（現在' + existingCount + '個・追加できるのは' + room + '個まで）。先頭' + room + '件のみアップロードします。');
                    toUpload = toUpload.slice(0, room);
                }
            }
            var storage = firebase.storage();
            var basePath = 'teams/' + FCOjimaFirebase.TEAM_ID + '/events/' + eventId + '/';
            for (var i = 0; i < toUpload.length; i++) {
                var file = toUpload[i];
                // 同じ名前の既存ファイルを上書きしないよう名前をずらす
                var fileName = (app.EventFiles && app.EventFiles.uniqueName) ? app.EventFiles.uniqueName(file.name, taken) : file.name;
                var ref = storage.ref(basePath + fileName);
                await ref.put(file);
            }
            await Overview.loadEventFiles(eventId, list);
        } catch(e) {
            console.error('ファイルアップロードエラー:', e);
            UI.showAlert('ファイルのアップロードに失敗しました: ' + e.message);
        }
    };

    /**
     * メンバーを FCOjima.Carpool.members にロード
     */
    app.Carpool.loadMembers = function() {
        this.members = Storage.loadMembers();
        console.log('メンバーをロードしました: ' + this.members.length + '人');
    };

    /**
     * 選択中の予定に監督が決めた帯同指導者（HUBの「指導者の予定・担当」）を読み込む。
     * app.Carpool.coachIds: メンバーIDの配列（まだ決まっていなければ空）。読めなければ null
     * 名前を引くためメンバーがまだ無ければサーバーから読む（共有リンクから直接開いた端末など）
     */
    app.Carpool.loadEventCoaches = async function() {
        var self = this;
        var event = Storage.getSelectedEvent();
        self.coachIds = null;
        if (!event || !(FCOjima.DB && FCOjima.DB.loadCoachAssignment)) return null;
        try {
            self.coachIds = await FCOjima.DB.loadCoachAssignment(event.id);
        } catch (e) {
            console.warn('帯同指導者を読み込めませんでした:', e);
            return null;
        }
        if (self.coachIds.length && !(self.members && self.members.length) && FCOjima.DB.loadMembers) {
            try { self.members = await FCOjima.DB.loadMembers(); } catch (e) { self.loadMembers(); }
        }
        return self.coachIds;
    };

    /** 帯同指導者のメンバー（監督→コーチの順）。まだ決まっていない・読めなければ空 */
    app.Carpool.eventCoaches = function() {
        var members = this.members || [];
        var rank = { coach: 0, assist: 1 };
        return (this.coachIds || []).map(function(id) {
            return members.find(function(m) { return String(m.id) === String(id); });
        }).filter(Boolean).sort(function(a, b) {
            return ((rank[a.role] !== undefined ? rank[a.role] : 2) - (rank[b.role] !== undefined ? rank[b.role] : 2));
        });
    };

    /** 車の持ち主（車提供で登録した人）。座席の割り当てで運転手を替えても変わらない */
    app.Carpool.carOwner = function(car) {
        return app.Utils.carOwner(car);
    };

    /**
     * 運転手としてこの予定に加わる人（提供できる車の持ち主・いま運転席にいる人・座席の割り当てで運転手になった人）。
     * 運転席から外した人も配置待ちに出す。メンバーでない人（車提供で名前を直接入力した人）も、
     * この予定の中だけの参加者として扱う
     */
    app.Carpool.driverPool = function() {
        return app.Utils.driverPool(this.appData);
    };

    /**
     * 座席が要る人（運転する人を除く）: 出欠で「参加」の人・帯同指導者（不参加を除く）・運転手として加わった人。
     * 配車の概要の「割り当て」・車提供の「必要 N席」・HUB の「今週の予定」で同じ数え方にする（Utils.seatNeeders）
     */
    app.Carpool.seatNeeders = function() {
        return app.Utils.seatNeeders(this.appData, this.eventCoaches());
    };

    /** 提供できる車の持ち主（配置待ちから外せない人） */
    app.Carpool.carOwners = function() {
        return (this.appData.carRegistrations || []).filter(function(c) { return c && c.canDrive !== 'no'; })
            .map(function(c) { return app.Carpool.carOwner(c); }).filter(Boolean);
    };

    /** 帯同指導者が決まっているか（決まっていなければ配車では監督・コーチを全員出す） */
    app.Carpool.hasEventCoaches = function() {
        return this.eventCoaches().length > 0;
    };

})(window.FCOjima);