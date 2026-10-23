/**
 * FC尾島ジュニア - カレンダータブの機能
 * カレンダーとイベント管理に関する機能を提供
 */

FCOjima.Hub = FCOjima.Hub || {};
FCOjima.Hub.Calendar = FCOjima.Hub.Calendar || {};

(function(app) {
    // 名前空間のショートカット
    var Calendar = app.Hub.Calendar;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;
    
    // 「自分の子供のみ」フィルター状態
    Calendar.myChildOnly = false;

    /**
     * カレンダー機能の初期化
     */
    Calendar.init = function() {
        console.log('カレンダー機能を初期化しています...');

        // データの読み込み（main.js の Hub.init で読み込み済み。サーバーから読めた一覧が空のときに
        // 端末に残っている古い一覧へ差し替えないよう、未読み込みの場合だけ端末データを使う）
        if (!Array.isArray(app.Hub.events)) app.Hub.events = Storage.loadEvents();
        
        // 現在の日付を設定
        app.Hub.currentDate = new Date();
        
        // カレンダーの描画
        this.renderCalendar();
        
        // リストビューの描画
        this.renderEventsList();
        
        // イベントリスナーの設定
        this.setupEventListeners();

        // 荷物ピッカーの初期化
        this.initLuggagePicker();

        console.log('カレンダー機能の初期化が完了しました');
    };

    // =============================================
    //  荷物（共用備品）ピッカー
    //  管理タブで登録された荷物マスタから、イベントごとの数量を設定する
    // =============================================

    /** hidden入力(#event-luggage)の現在値をパース */
    Calendar._getLuggageValue = function() {
        var el = document.getElementById('event-luggage');
        if (!el || !el.value) return [];
        try {
            var arr = JSON.parse(el.value);
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    };

    /** hidden入力とサマリー表示（テント×2、ベンチ×3）を更新 */
    Calendar._setLuggageValue = function(luggage) {
        var el = document.getElementById('event-luggage');
        var summary = document.getElementById('event-luggage-summary');
        var clean = (luggage || []).filter(function(it) { return it && it.name && it.count > 0; });
        if (el) el.value = clean.length > 0 ? JSON.stringify(clean) : '';
        if (summary) {
            summary.textContent = clean.length > 0
                ? clean.map(function(it) { return it.name + '×' + it.count; }).join('、')
                : '（荷物なし）';
        }
    };

    Calendar.initLuggagePicker = function() {
        var btn = document.getElementById('event-luggage-btn');
        var modal = document.getElementById('event-luggage-modal');
        var closeBtn = document.getElementById('event-luggage-modal-close');
        var applyBtn = document.getElementById('event-luggage-apply');
        if (!btn || !modal) return;

        btn.addEventListener('click', function() {
            Calendar._openLuggagePicker();
        });
        closeBtn && closeBtn.addEventListener('click', function() { UI.closeModal('event-luggage-modal'); });
        modal.addEventListener('click', function(e) { if (e.target === modal) UI.closeModal('event-luggage-modal'); });
        applyBtn && applyBtn.addEventListener('click', function() {
            // 行から数量を収集してhidden入力へ反映し、イベント登録モーダルに戻る
            var rows = document.querySelectorAll('#event-luggage-rows .luggage-row');
            var luggage = [];
            rows.forEach(function(row) {
                var count = parseInt(row.dataset.count, 10) || 0;
                if (count > 0) luggage.push({ name: row.dataset.name, count: count });
            });
            Calendar._setLuggageValue(luggage);
            UI.closeModal('event-luggage-modal');
        });
    };

    /** 荷物ピッカーを開く（マスタ一覧＋現在の数量を行表示） */
    Calendar._openLuggagePicker = async function() {
        var rowsEl = document.getElementById('event-luggage-rows');
        if (!rowsEl) return;
        UI.openModal('event-luggage-modal');
        rowsEl.innerHTML = '<p class="loading">読み込み中...</p>';

        var items = [];
        try {
            items = await FCOjima.DB.loadLuggageItems();
        } catch (e) {
            rowsEl.innerHTML = '<p style="color:#c00;font-size:12px;">荷物マスタの読み込みに失敗しました</p>';
            return;
        }
        if (items.length === 0) {
            rowsEl.innerHTML = '<p style="color:#999;font-size:12px;">荷物が登録されていません。管理タブの「📦 荷物設定」から登録してください。</p>';
            return;
        }

        var current = {};
        Calendar._getLuggageValue().forEach(function(it) { current[it.name] = it.count; });

        rowsEl.innerHTML = '';
        items.forEach(function(name) {
            var row = document.createElement('div');
            row.className = 'luggage-row';
            row.dataset.name = name;
            row.dataset.count = String(current[name] || 0);

            var label = document.createElement('span');
            label.className = 'luggage-row-name';
            label.textContent = name;

            var minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'luggage-count-btn';
            minus.textContent = '−';

            var countEl = document.createElement('span');
            countEl.className = 'luggage-row-count';
            countEl.textContent = row.dataset.count;

            var plus = document.createElement('button');
            plus.type = 'button';
            plus.className = 'luggage-count-btn';
            plus.textContent = '＋';

            function setCount(n) {
                var v = Math.max(0, n); // 0未満には減らない
                row.dataset.count = String(v);
                countEl.textContent = String(v);
                row.classList.toggle('has-count', v > 0);
            }
            minus.addEventListener('click', function() { setCount((parseInt(row.dataset.count, 10) || 0) - 1); });
            plus.addEventListener('click', function() { setCount((parseInt(row.dataset.count, 10) || 0) + 1); });
            setCount(parseInt(row.dataset.count, 10) || 0);

            row.appendChild(label);
            row.appendChild(minus);
            row.appendChild(countEl);
            row.appendChild(plus);
            rowsEl.appendChild(row);
        });
    };
    
    /**
     * イベントリスナーの設定
     */
    Calendar.setupEventListeners = function() {
        if (Calendar._listenersSetup) return;
        Calendar._listenersSetup = true;
        console.log('カレンダーのイベントリスナーを設定しています...');
        
        // 表示切り替えボタン
        document.getElementById('calendar-view').addEventListener('click', function() {
            document.getElementById('calendar-container').classList.remove('hidden');
            document.getElementById('list-container').classList.add('hidden');
            document.getElementById('calendar-view').classList.add('active');
            document.getElementById('list-view').classList.remove('active');
        });
        
        document.getElementById('list-view').addEventListener('click', function() {
            document.getElementById('calendar-container').classList.add('hidden');
            document.getElementById('list-container').classList.remove('hidden');
            document.getElementById('calendar-view').classList.remove('active');
            document.getElementById('list-view').classList.add('active');
        });
        
        // 月の移動ボタン
        // ※ setMonth(±1) だと、29〜31日に操作したとき存在しない日付（例: 10/31→11/31）が
        //   翌月にずれ込み、月が1つ飛んでいた。必ず1日に揃えてから月を動かす
        document.getElementById('prev-month').addEventListener('click', function() {
            var d = app.Hub.currentDate;
            app.Hub.currentDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
            Calendar.renderCalendar();
            Calendar.renderEventsList();
        });
        
        document.getElementById('next-month').addEventListener('click', function() {
            var d = app.Hub.currentDate;
            app.Hub.currentDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
            Calendar.renderCalendar();
            Calendar.renderEventsList();
        });
        
        // 予定追加ボタン
        document.getElementById('add-event').addEventListener('click', function() {
            Calendar.openAddEventModal();
        });

        // 日付を選ぶと、その日の監督・コーチの都合を出す（マネージャーのみ）
        var eventDateInput = document.getElementById('event-date');
        if (eventDateInput) eventDateInput.addEventListener('change', function() { Calendar._coachHint(); });
        
        // ログ表示ボタン
        document.getElementById('view-logs').addEventListener('click', function() {
            app.Hub.openLogsModal('calendar');
        });
        
        // フォーム送信イベント
        document.getElementById('event-form').addEventListener('submit', function(e) {
            e.preventDefault();
            Calendar.saveEvent();
        });

        // イベント種類変更（ナイター自動設定）
        var eventTypeSelect = document.getElementById('event-type');
        if (eventTypeSelect) {
            eventTypeSelect.addEventListener('change', function() {
                Calendar.onEventTypeChange(this.value);
            });
        }

        // 会場選択ボタン
        document.getElementById('select-venue').addEventListener('click', function() {
            app.Hub.Venues.openVenueSelect('venue');
        });

        document.getElementById('select-meeting-venue').addEventListener('click', function() {
            app.Hub.Venues.openVenueSelect('meeting');
        });
        
        // キャンセルボタン（イベント追加モーダル）
        var cancelEventBtn = document.getElementById('cancel-event');
        if (cancelEventBtn) {
            cancelEventBtn.addEventListener('click', function() {
                UI.closeModal('event-modal');
            });
        }

        // 学年外選手追加ボタン
        var addExtraPlayersBtn = document.getElementById('add-extra-players');
        if (addExtraPlayersBtn) {
            addExtraPlayersBtn.addEventListener('click', function() {
                Calendar.openExtraPlayerModal();
            });
        }

        // 学年外選手確定ボタン
        var confirmExtraBtn = document.getElementById('confirm-extra-players');
        if (confirmExtraBtn) {
            confirmExtraBtn.addEventListener('click', function() {
                Calendar.confirmExtraPlayers();
            });
        }

        // 学年外選手キャンセルボタン
        var cancelExtraBtn = document.getElementById('cancel-extra-players');
        if (cancelExtraBtn) {
            cancelExtraBtn.addEventListener('click', function() {
                UI.closeModal('extra-player-modal');
            });
        }

        // イベント詳細モーダルのボタン
        document.getElementById('manage-event').addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            Calendar.navigateToCarpool(eventId);
        });

        document.getElementById('edit-event').addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            Calendar.editEvent(eventId);
        });

        document.getElementById('delete-event').addEventListener('click', function() {
            const eventId = this.getAttribute('data-event-id');
            Calendar.deleteEvent(eventId);
        });

        // 「わが子の予定だけ」の切り替え（オン・オフが分かるようにチェックの印。以前は「全員」「自分の子供のみ」と
        // 文字が入れ替わるだけで、今の表示なのか押すとそうなるのか分かりにくかった）
        var myChildBtn = document.getElementById('my-child-filter');
        if (myChildBtn) {
            Calendar.updateChildFilter();
            myChildBtn.addEventListener('click', function() {
                Calendar.myChildOnly = !Calendar.myChildOnly;
                Calendar.updateChildFilter();
                Calendar.renderCalendar();
                Calendar.renderEventsList();
            });
        }

        console.log('カレンダーのイベントリスナー設定が完了しました');
    };

    /** 「わが子の予定だけ」ボタンの表示（子どもが紐づいていない人には出さない） */
    Calendar.updateChildFilter = function() {
        var btn = document.getElementById('my-child-filter');
        if (!btn) return;
        var profile = app.Auth && app.Auth.currentUserProfile;
        var hasKids = !!(profile && profile.childrenIds && profile.childrenIds.length);
        btn.style.display = hasKids ? '' : 'none';
        btn.textContent = (Calendar.myChildOnly ? '☑' : '☐') + ' わが子だけ';
        btn.classList.toggle('active', Calendar.myChildOnly);
        btn.setAttribute('aria-pressed', String(Calendar.myChildOnly));
    };

    /**
     * 「自分の子供のみ」フィルター適用
     * @param {Array} events - フィルター前のイベント配列
     * @returns {Array} フィルター後のイベント配列
     */
    Calendar.applyMyChildFilter = function(events) {
        if (!Calendar.myChildOnly) return events;

        var profile = app.Auth && app.Auth.currentUserProfile;
        if (!profile || !profile.childrenIds || profile.childrenIds.length === 0) return events;

        var members = app.Hub.members || [];
        var myChildIds = profile.childrenIds;
        var myChildren = myChildIds
            .map(function(cid) { return Utils.findChildMemberById(members, cid); })
            .filter(Boolean);

        if (myChildren.length === 0) return events;

        // 対象判定はisTargetFor（学年一致 or 学年外追加選手）と揃える。
        // ここを学年一致だけにすると、extraPlayersで学年外追加された自分の子の
        // イベントが「自分の子供のみ」フィルターから消えてしまう
        return events.filter(function(ev) {
            var evTargets = (ev.target && ev.target.length > 0) ? ev.target : null;
            var extraPlayers = ev.extraPlayers || [];
            if (!evTargets) return true; // 対象学年なし＝全員対象
            return myChildren.some(function(child) {
                return (child.grade && evTargets.some(function(g) { return String(g) === String(child.grade); }))
                    || extraPlayers.includes(child.name);
            });
        });
    };
    
    /**
     * カレンダーを描画する関数
     */
    Calendar.renderCalendar = function() {
        const currentDate = app.Hub.currentDate;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // 月の表示を更新
        document.getElementById('current-month').textContent = `${year}年${month + 1}月`;
        
        // 月の最初の日と最後の日を取得
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // 月の最初の日の曜日（月曜始まり: 月=0, 火=1, ..., 土=5, 日=6）
        const firstDayIndex = (firstDay.getDay() + 6) % 7;

        // カレンダーグリッドを取得
        const calendarGrid = document.getElementById('calendar-grid');
        calendarGrid.innerHTML = '';

        // 前月の日を表示
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const dateObj = new Date(year, month - 1, day);
            const dayElement = this.createDayElement(dateObj, true);
            calendarGrid.appendChild(dayElement);
        }

        // 当月の日を表示
        const today = new Date();
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const dateObj = new Date(year, month, i);
            const isToday = dateObj.getDate() === today.getDate() &&
                             dateObj.getMonth() === today.getMonth() &&
                             dateObj.getFullYear() === today.getFullYear();

            const dayElement = this.createDayElement(dateObj, false, isToday);
            calendarGrid.appendChild(dayElement);
        }

        // 翌月の日を表示（6週間表示のために必要な分だけ）
        const daysFromPrevMonth = firstDayIndex;
        const daysFromCurrentMonth = lastDay.getDate();
        const totalCellsFilled = daysFromPrevMonth + daysFromCurrentMonth;
        const cellsToFill = 42 - totalCellsFilled; // 6週間 = 42日

        for (let i = 1; i <= cellsToFill; i++) {
            const dateObj = new Date(year, month + 1, i);
            const dayElement = this.createDayElement(dateObj, true);
            calendarGrid.appendChild(dayElement);
        }
        
        // イベントを表示
        this.displayEvents();
    };
    
    /**
     * 日付要素を作成する関数
     * @param {Date} date - 日付オブジェクト
     * @param {boolean} isOtherMonth - 他の月の日付かどうか
     * @param {boolean} isToday - 今日かどうか
     * @returns {HTMLElement} 日付要素
     */
    Calendar.createDayElement = function(date, isOtherMonth, isToday = false) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        
        // 他の月の日付かどうか
        if (isOtherMonth) {
            day.classList.add('other-month');
        }
        
        // 今日かどうか
        if (isToday) {
            day.classList.add('today');
        }
        
        // 土曜日または日曜日の場合にクラスを追加
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0) {
            day.classList.add('sunday');
        } else if (dayOfWeek === 6) {
            day.classList.add('saturday');
        }
        // 祝日（振替休日を含む）は日付を赤く
        const holiday = app.Holidays ? app.Holidays.nameOf(Utils.formatDate(date)) : '';
        if (holiday) {
            day.classList.add('holiday');
            day.title = holiday;
        }

        // 日付の表示部分
        const dateDiv = document.createElement('div');
        dateDiv.className = 'date';
        dateDiv.textContent = date.getDate();
        day.appendChild(dateDiv);
        
        // データ属性に日付を設定
        day.dataset.date = Utils.formatDate(date);

        // 日付の数字の行をタップするとその日の予定一覧を開く（マスのほかの部分は従来どおり予定追加）
        const dateStr = day.dataset.date;
        dateDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openDayModal(dateStr);
        });
        
        // 日付クリックで予定追加モーダルを開く
        day.addEventListener('click', () => {
            this.openAddEventModal(date);
        });
        
        return day;
    };
    
    /**
     * イベントをカレンダーに表示
     */
    Calendar.displayEvents = function() {
        const events = Calendar.applyMyChildFilter(app.Hub.events).slice().sort(Utils.compareEvents);

        // 日付→マスの対応表（以前は querySelector の属性セレクタに event.date を直接埋め込んでいたため、
        // 想定外の文字を含む日付のイベントが1件あるだけで例外になり、以降の予定が表示されなかった）
        const dayMap = {};
        document.querySelectorAll('#calendar-grid .calendar-day').forEach(function(d) { dayMap[d.dataset.date] = d; });

        events.forEach(event => {
            // 日付要素を取得
            const dayElement = dayMap[event.date];
            if (!dayElement) return;
            
            // イベント要素を作成
            const eventElement = document.createElement('div');
            eventElement.className = `event ${event.type}`;
            eventElement.textContent = event.title;
            eventElement.dataset.eventId = event.id;
            
            // イベントクリックで詳細モーダルを表示
            eventElement.addEventListener('click', (e) => {
                e.stopPropagation(); // 親要素へのクリックイベントの伝播を防止
                this.showEventDetails(event.id);
            });
            
            dayElement.appendChild(eventElement);
        });

        // 指導者に都合を聞く日として追加した日の印（マネージャーのみ）
        if (app.Hub.Coaching && app.Hub.Coaching.markCalendar) app.Hub.Coaching.markCalendar();

        // その日の予定一覧を開いたまま予定が追加・変更・削除されたら一覧も最新にする
        const dayModal = document.getElementById('day-events-modal');
        if (dayModal && dayModal.style.display === 'flex' && Calendar._dayModalDate) {
            Calendar.renderDayModal();
        }
    };

    /**
     * その日の予定一覧モーダルを開く（同じ日に予定が並んで押しにくいとき用）
     * @param {string} dateStr - YYYY-MM-DD
     */
    Calendar.openDayModal = function(dateStr) {
        Calendar._dayModalDate = String(dateStr);
        const addBtn = document.getElementById('day-events-add');
        if (addBtn && !addBtn._bound) {
            addBtn._bound = true;
            addBtn.addEventListener('click', function() {
                const d = Calendar._dayModalDate;
                UI.closeModal('day-events-modal');
                Calendar.openAddEventModal(new Date(d + 'T00:00:00'));
            });
        }
        Calendar.renderDayModal();
        UI.openModal('day-events-modal');
    };

    Calendar.renderDayModal = function() {
        const dateStr = Calendar._dayModalDate;
        const list = document.getElementById('day-events-list');
        const title = document.getElementById('day-events-title');
        if (!list || !dateStr) return;
        // 年は月の見出しにあるので省く（スマホで見出しが2行に折り返さないように）
        const dd = new Date(dateStr + 'T00:00:00');
        const holiday = app.Holidays ? app.Holidays.nameOf(dateStr) : '';
        title.textContent = (dd.getMonth() + 1) + '月' + dd.getDate() + '日(' + ['日', '月', '火', '水', '木', '金', '土'][dd.getDay()] + (holiday ? '・祝' : '') + ') の予定';
        const all = (app.Hub.events || []).filter(function(ev) { return String(ev.date) === dateStr; });
        const shown = Calendar.applyMyChildFilter(all).slice().sort(Utils.compareEvents);
        list.innerHTML = '';
        if (holiday) {
            const hol = document.createElement('div');
            hol.className = 'day-events-holiday';
            hol.textContent = holiday;
            list.appendChild(hol);
        }
        if (shown.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'day-events-empty';
            empty.textContent = 'この日の予定はありません';
            list.appendChild(empty);
        }
        // 詳細はこの一覧の上に重ねて開く（閉じると一覧に戻る）
        shown.forEach(function(ev) { list.appendChild(Calendar.createEventListItem(ev)); });
        const hidden = all.length - shown.length;
        if (hidden > 0) {
            const note = document.createElement('div');
            note.className = 'day-events-hidden';
            // ボタンの名前（「わが子だけ」）と同じ言葉で（以前は古い名前の「自分の子供のみ」のままだった）
            note.textContent = '「わが子だけ」の絞り込みで ' + hidden + '件 を表示していません';
            list.appendChild(note);
        }
        // 指導者に都合を聞く日か（マネージャーのみ）。聞く日にする・外すボタン
        let coach = document.getElementById('day-events-coach');
        if (!coach) {
            coach = document.createElement('div');
            coach.id = 'day-events-coach';
            list.parentNode.insertBefore(coach, list.nextSibling);
        }
        if (app.Hub.Coaching && app.Hub.Coaching.renderDayAsk) app.Hub.Coaching.renderDayAsk(coach, dateStr);
        else coach.style.display = 'none';
    };
    
    Calendar._listShowPast = false; // リスト表示: 今月の今日より前の予定も出す

    /**
     * リスト表示を描画: 予定のある日だけ。今月は今日から（前の予定は「今日より前の予定も見る」で出す）。
     * 以前は月の1日から全部の日を「予定なし」も含めて並べ、今週の予定までスクロールする必要があった
     */
    Calendar.renderEventsList = function() {
        const currentDate = app.Hub.currentDate;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const events = Calendar.applyMyChildFilter(app.Hub.events).slice().sort(Utils.compareEvents);
        const listContainer = document.getElementById('events-list');
        listContainer.innerHTML = '';

        const today = Utils.formatDate(new Date());
        const ym = year + '-' + String(month + 1).padStart(2, '0');
        const inMonth = events.filter(ev => String(ev.date || '').slice(0, 7) === ym);
        const isThisMonth = ym === today.slice(0, 7);
        const past = isThisMonth ? inMonth.filter(ev => ev.date < today) : [];
        const shown = (isThisMonth && !Calendar._listShowPast) ? inMonth.filter(ev => ev.date >= today) : inMonth;

        if (past.length) {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'secondary-button list-past-toggle';
            toggle.textContent = Calendar._listShowPast ? '今日より前の予定を隠す' : '今日より前の予定も見る（' + past.length + '件）';
            toggle.addEventListener('click', () => {
                Calendar._listShowPast = !Calendar._listShowPast;
                this.renderEventsList();
            });
            listContainer.appendChild(toggle);
        }
        if (!shown.length) {
            const empty = document.createElement('div');
            empty.className = 'event-item empty list-empty';
            empty.innerHTML = '<div class="event-title">' + (isThisMonth ? 'この月のこれからの予定はありません' : 'この月の予定はありません') + '</div>';
            listContainer.appendChild(empty);
            return;
        }
        let lastDate = '';
        shown.forEach(event => {
            if (event.date !== lastDate) {
                lastDate = event.date;
                const dateHeading = document.createElement('div');
                dateHeading.className = 'date-heading' + (event.date === today ? ' is-today' : '') + (event.date < today ? ' is-past' : '');
                dateHeading.textContent = Utils.formatDateForDisplay(event.date) + (event.date === today ? '（今日）' : '');
                dateHeading.dataset.date = event.date;
                listContainer.appendChild(dateHeading);
            }
            listContainer.appendChild(this.createEventListItem(event));
        });
    };

    /**
     * イベントリスト項目を作成
     * @param {Object} event - イベントオブジェクト
     * @returns {HTMLElement} イベントリスト項目要素
     */
    Calendar.createEventListItem = function(event) {
        const eventItem = document.createElement('div');
        eventItem.className = `event-item ${event.type}`;
        eventItem.dataset.eventId = event.id;
        
        // 学年ターゲット表示
        let targetDisplay = '';
        if (Array.isArray(event.target) && event.target.length > 0) {
            const targetGrades = event.target.map(grade => UI.escapeHTML(Utils.getGradeLabel(grade))).join(', ');
            targetDisplay = `<span class="badge">${targetGrades}</span> `;
        }

        const title = document.createElement('div');
        title.className = 'event-title';
        title.innerHTML = `${targetDisplay}${UI.escapeHTML(event.title)}`;
        
        const details = document.createElement('div');
        details.className = 'event-details';
        
        let timeDisplay = '';
        if (event.startTime) {
            timeDisplay += event.startTime;
            if (event.endTime) {
                timeDisplay += `-${event.endTime}`;
            }
        }
        
        // 会場が決まっていないときに「@ 未設定」と出ていたので、ある分だけ並べる
        details.textContent = [timeDisplay, event.venue].filter(Boolean).join(' ・ ') || '時間・会場は未定';
        
        eventItem.appendChild(title);
        eventItem.appendChild(details);
        
        // イベントクリックで詳細モーダルを表示
        eventItem.addEventListener('click', () => {
            this.showEventDetails(event.id);
        });
        
        return eventItem;
    };
    
    /**
     * イベント詳細表示
     * @param {number} eventId - イベントID
     */
    Calendar.showEventDetails = async function(eventId) {
        const events = app.Hub.events;
        const event = events.find(e => String(e.id) === String(eventId));
        if (!event) {
            console.warn('イベントが見つかりません: id=' + eventId, events.map(e=>e.id));
            return;
        }
        // 出欠の読み込みを待つ間に別の予定をタップした場合、後から届いた前の予定の内容で
        // 上書きしないよう、最後に開こうとした予定だけを表示する
        const requestToken = (Calendar._detailsToken = (Calendar._detailsToken || 0) + 1);
        
        const content = document.getElementById('event-details-content');
        const esc = UI.escapeHTML;
        // 指導者の担当（読み込めなくても詳細は表示する）
        if (app.Hub.Coaching) await app.Hub.Coaching.ensureLoaded();

        // ---- 見出し: 種類・対象学年・タイトル・日付（あと何日） ----
        const typeKey = { game: 'game', practice: 'practice', nighter: 'nighter', event: 'event' }[event.type] || 'event';
        const grades = (Array.isArray(event.target) && event.target.length > 0)
            ? event.target.map(g => `<span class="ed-grade">${esc(Utils.getGradeLabel(g))}</span>`).join('')
            : '<span class="ed-grade">全学年</span>';
        const dayDiff = Math.round((new Date(event.date + 'T00:00:00') - new Date(Utils.formatDate(new Date()) + 'T00:00:00')) / 86400000);
        const relDay = isNaN(dayDiff) ? '' : dayDiff === 0 ? '今日' : dayDiff === 1 ? '明日' : dayDiff > 1 ? 'あと' + dayDiff + '日' : '終了';

        // ---- 要点: 時間・出発・集合・会場・当番 ----
        const allVenues = app.Hub.venues || [];
        const mapButton = function(place) {
            const v = allVenues.find(x => x.name === place);
            const q = (v && v.address) ? v.address : place;
            return `<button type="button" class="map-button ed-map" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${Utils.encodeForOnclick(q)}','_blank')">🗺️ 地図</button>`;
        };
        const fact = function(icon, label, value, action, extraCls) {
            return `<div class="ed-fact${extraCls ? ' ' + extraCls : ''}"><span class="ed-fact-icon" aria-hidden="true">${icon}</span>` +
                `<div class="ed-fact-body"><span class="ed-fact-label">${label}</span><span class="ed-fact-value">${value}</span></div>${action || ''}</div>`;
        };
        let facts = '';
        facts += fact('🕘', '時間', event.startTime ? esc(event.startTime) + (event.endTime ? '〜' + esc(event.endTime) : '〜') : '未定', '', event.startTime ? '' : 'ed-muted');
        if (event.departureTime) facts += fact('🚗', '出発', esc(event.departureTime));
        // 場所は名前が長く地図ボタンもあるので1行まるごと使う
        if (event.meetingPlace) facts += fact('📍', '集合', esc(event.meetingPlace), mapButton(event.meetingPlace), 'ed-wide');
        facts += fact('🏟️', '会場', esc(event.venue || '未定'), event.venue ? mapButton(event.venue) : '', 'ed-wide' + (event.venue ? '' : ' ed-muted'));
        // 当番グループ（機能が有効かつ割り当てがある場合のみ表示。閲覧のみ・変更は管理タブから）
        if (app.Hub.dutyEnabled) {
            const duty = app.Hub.getDutyAssignment ? app.Hub.getDutyAssignment(event.id) : null;
            if (duty) facts += fact('🔔', '当番', esc(duty.groupName));
        }
        // 帯同指導者（監督が決めた担当の監督・コーチ。配車の割り当てにも🧢で出る）。担当を決めたら全員に表示、
        // マネージャーには未定でも出して「担当」ボタン
        if (app.Hub.Coaching && event.type !== 'nighter') {
            const coachVal = app.Hub.Coaching.detailValue(event);
            const canAssign = app.Auth && app.Auth.isManager && app.Auth.isManager();
            if (coachVal) facts += fact('🧢', '帯同指導者', coachVal, canAssign ? '<button type="button" id="event-coach-btn" class="ed-map ed-coach">担当</button>' : '', 'ed-wide');
        }

        // 出欠一覧（イベントの対象学年メンバー）
        // ※ autoPopulateFromTargetGrades と同じロジックで対象メンバーを決定
        let attendanceDisplay = '';
        const members = app.Hub.members || [];
        const targetGradeValues = (event.target && event.target.length > 0) ? event.target : null;
        const extraPlayers = event.extraPlayers || [];
        const isEventType = event.type === 'event';
        let targetMembers = [];

        // 選手を追加（学年指定あり: 対象学年のみ, なし: 全選手）
        const players = members.filter(function(m) {
            if (m.role !== 'player') return false;
            if (targetGradeValues) {
                return m.grade && targetGradeValues.some(function(g) { return String(g) === String(m.grade); });
            }
            return true;
        });
        targetMembers = players.slice();

        // 学年外追加選手を追加（重複除く）
        const addedNames = new Set(players.map(function(p) { return p.name; }));
        extraPlayers.forEach(function(name) {
            if (!addedNames.has(name)) {
                const m = members.find(function(mem) { return mem.name === name; });
                if (m) targetMembers.push(m);
                addedNames.add(name);
            }
        });

        // イベント種別「イベント」の場合は保護者も表示
        if (isEventType) {
            members.forEach(function(m) {
                // 保護者（父・母・役員、保護者を兼ねるコーチ）。コーチは選手と重複しないよう名前で確認
                if (Utils.isGuardian(m) && !targetMembers.some(function(t) { return t.name === m.name; })) {
                    targetMembers.push(m);
                }
            });
        }

        // 出欠回答期限（あと何日・期限切れ）
        let deadlineHtml = '';
        if (event.attendanceDeadline) {
            const deadline = new Date(event.attendanceDeadline);
            if (!isNaN(deadline.getTime())) {
                const left = deadline - new Date();
                const leftDays = Math.ceil(left / 86400000);
                const state = left < 0 ? 'over' : leftDays <= 2 ? 'soon' : '';
                const leftText = left < 0 ? '締切済み' : leftDays <= 1 ? 'まもなく締切' : 'あと' + leftDays + '日';
                deadlineHtml = `<div class="ed-deadline${state ? ' ed-deadline-' + state : ''}">⏰ 回答期限 ${(deadline.getMonth() + 1)}/${deadline.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][deadline.getDay()]}) ` +
                    `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}<span class="ed-deadline-left">${leftText}</span></div>`;
            }
        }

        // 参加者を追加（管理者・指導者・役員。同じ日の他の試合・練習の選手・その日に予定のない選手から入れる）
        const canAdd = app.PlayerMove && app.PlayerMove.canUse() && app.PlayerMove.isMovableEvent(event);
        const addBtn = canAdd ? '<button type="button" id="event-player-move-btn" class="secondary-button ed-add-btn">＋ 参加者を追加</button>' : '';

        let detailData = null; // この予定の出欠・配車データ（予定ごとの連絡にも使う）
        if (targetMembers.length > 0) {
            // 出欠データはFirestore優先で取得（localStorageのみだと他端末の回答が見えない）
            let eventData = null;
            if (window.FCOjima && FCOjima.DB && FCOjima.DB.loadEventData) {
                try {
                    eventData = await FCOjima.DB.loadEventData(event.id);
                } catch (e) {
                    console.warn('Firestoreイベントデータ取得失敗:', e);
                }
            }
            if (!eventData) eventData = Storage.loadEventData(event.id);
            detailData = eventData;
            const attendance = eventData.attendance || [];
            const statusMap = {};
            attendance.forEach(a => { statusMap[a.name] = a.status; });
            // 出欠ページで参加者から外した人は対象に含めない
            targetMembers = targetMembers.filter(m => !Utils.isRemovedFromEvent(m, eventData));

            // 参加・不参加以外（出欠表に自動で追加された 'unknown' や未登録）はすべて未回答。
            // 以前は 'unknown' をどれにも数えず、自動補完された人の分だけ「未回答」が少なく出ていた
            const stOf = m => statusMap[m.name] === 'present' ? 'p' : statusMap[m.name] === 'absent' ? 'a' : 'u';
            const presentCount = targetMembers.filter(m => stOf(m) === 'p').length;
            const absentCount = targetMembers.filter(m => stOf(m) === 'a').length;
            const pendingCount = targetMembers.length - presentCount - absentCount;
            const pct = n => targetMembers.length ? (n * 100 / targetMembers.length).toFixed(1) : 0;
            // 参加 → 未回答 → 不参加 の順に並べる（同じ回答の中はメンバーの順）
            const order = { p: 0, u: 1, a: 2 };
            const rows = targetMembers.slice().sort((a, b) => order[stOf(a)] - order[stOf(b)]).map(m => {
                const st = stOf(m);
                const icon = st === 'p' ? '○' : st === 'a' ? '×' : '－';
                return `<div class="ed-att ed-att-${st}"><span class="ed-att-icon">${icon}</span><span class="ed-att-name">${esc(m.name)}</span></div>`;
            }).join('');
            // ログインしている保護者のお子さん: ここで「参加／不参加」を答えられる（ボタンは表示したあとに付ける）。
            // 以前は「配車管理へ」→「出欠確認」へ進み、全員の一覧から自分の子を探して答える必要があった
            const myKids = (app.Hub.MyEvents && app.Hub.MyEvents.getChildren) ? app.Hub.MyEvents.getChildren() : [];
            const mine = targetMembers.filter(m => myKids.some(k => k.name === m.name));
            const stName = m => statusMap[m.name] === 'present' ? 'present' : statusMap[m.name] === 'absent' ? 'absent' : 'unknown';
            const mineHtml = mine.length ? `<div class="ed-mine"><div class="ed-mine-head">お子さんの出欠<span>押すとすぐ保存されます</span></div>` +
                mine.map(m => {
                    const car = stName(m) === 'present' ? Utils.carOf(eventData, m.name) : null;
                    const carText = (app.Hub.MyEvents && app.Hub.MyEvents.carText) ? app.Hub.MyEvents.carText(car) : '';
                    return `<div class="ed-mine-row ed-mine-${stName(m)}" data-name="${esc(m.name)}" data-status="${stName(m)}"><div class="ed-mine-info"><span class="ed-mine-name">${esc(m.name)}${stName(m) === 'unknown' ? '<small>未回答</small>' : ''}</span>${carText ? `<span class="ed-mine-car">${esc(carText)}</span>` : ''}</div></div>`;
                }).join('') + '</div>' : '';
            attendanceDisplay = `
            <section class="ed-section ed-attendance">
                <div class="ed-section-head"><h4>出欠確認</h4><span class="ed-section-sub">${targetMembers.length}人</span></div>
                ${mineHtml}
                <div class="ed-att-bar" aria-hidden="true"><span class="ed-bar-p" style="width:${pct(presentCount)}%"></span><span class="ed-bar-u" style="width:${pct(pendingCount)}%"></span><span class="ed-bar-a" style="width:${pct(absentCount)}%"></span></div>
                <div class="ed-att-legend"><span class="ed-leg-p">参加 <b>${presentCount}</b></span><span class="ed-leg-u">未回答 <b>${pendingCount}</b></span><span class="ed-leg-a">不参加 <b>${absentCount}</b></span></div>
                ${deadlineHtml}
                <div class="ed-att-grid">${rows}</div>
                ${addBtn}
            </section>`;
        } else if (deadlineHtml || addBtn) {
            attendanceDisplay = `<section class="ed-section ed-attendance"><div class="ed-section-head"><h4>出欠確認</h4></div>${deadlineHtml}${addBtn}</section>`;
        }

        // ---- この予定の連絡（配車の「連絡」。以前は配車のページを開かないと見られなかった） ----
        if (!detailData && event.type !== 'nighter' && FCOjima.DB && FCOjima.DB.loadEventData) {
            try { detailData = await FCOjima.DB.loadEventData(event.id); } catch (e) { detailData = null; }
        }
        const evNotes = ((detailData && detailData.notifications) || []).filter(n => n && n.text);
        const newNotes = (app.Inbox && evNotes.length) ? app.Inbox.eventUnread(event.id, evNotes).map(app.Inbox.noteKey) : [];
        let notesHtml = '';
        if (evNotes.length) {
            notesHtml = `<section class="ed-section ed-notes">
                <div class="ed-section-head"><h4>📣 この予定の連絡</h4><span class="ed-section-sub">${evNotes.length}件</span></div>` +
                evNotes.slice(0, 3).map(n => {
                    const isNew = app.Inbox && newNotes.indexOf(app.Inbox.noteKey(n)) !== -1;
                    const d = /^\d{4}-\d{2}-\d{2}$/.test(n.date || '') ? new Date(n.date + 'T00:00:00') : null;
                    const when = d ? (d.getMonth() + 1) + '/' + d.getDate() + '(' + ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] + ')' : (n.date || '');
                    return `<div class="ed-note${isNew ? ' is-new' : ''}"><div class="ed-note-meta">${esc(when)}${n.user ? ' ・ ' + esc(n.user) : ''}${isNew ? '<span class="notif-new">新着</span>' : ''}</div>` +
                        `<div class="ed-note-text">${esc(n.text).replace(/\n/g, '<br>')}</div></div>`;
                }).join('') +
                `<a class="ed-notes-link" href="../carpool/notifications.html?event=${encodeURIComponent(String(event.id))}">${evNotes.length > 3 ? 'ほか' + (evNotes.length - 3) + '件・' : ''}連絡を見る・書く ›</a></section>`;
        }

        // ---- 持ち物・荷物 ----
        let itemsHtml = '';
        if (app.Checklist) {
            const personal = app.Checklist.getItems(event.type, event.checklistExtra, event.checklist);
            const luggage = (event.luggage || []).filter(it => it && it.name && parseInt(it.count, 10) > 0);
            const chipRow = (label, chips) => `<div class="ed-chip-row"><span class="ed-chip-label">${label}</span><div class="ed-chips">${chips}</div></div>`;
            if (personal.length) itemsHtml += chipRow('🎒 個人', personal.map(i => `<span class="checklist-chip">${esc(i)}</span>`).join(''));
            if (luggage.length) itemsHtml += chipRow('📦 荷物', luggage.map(it => `<span class="checklist-chip">${esc(it.name)}×${parseInt(it.count, 10)}</span>`).join(''));
            if (itemsHtml) itemsHtml = `<section class="ed-section"><div class="ed-section-head"><h4>持ち物</h4></div>${itemsHtml}</section>`;
        }

        // このイベント固有のログのみ表示する。
        // eventId を持つログはID一致で厳密に絞る。旧フォーマット（eventIdなし）は
        // タイトルだけで近似すると同名イベント（毎週の「岩松」等）のログが全部
        // 混入するため、「タイトル＋日付」の両方が details に含まれる場合のみ表示
        // （2026-07-20実機報告: モーダルに他イベントのログが表示されていた）
        const allLogs = app.Hub.logs || [];
        const eventLogs = allLogs.filter(function(l) {
            if (l.type !== 'calendar') return false;
            if (l.eventId) return String(l.eventId) === String(event.id);
            // 旧フォーマット: details例「「岩松」（2026-07-18）」→ タイトルと日付の両方一致が必須
            return l.details &&
                l.details.includes('「' + event.title + '」') &&
                l.details.includes('（' + event.date + '）');
        });
        let eventLogDisplay = '';
        if (eventLogs.length > 0) {
            // datetime はUTCのISO文字列。文字列を切り出すと9時間ずれた時刻が出るため日本時間に変換して表示
            const fmtLogTime = function(iso) {
                if (!iso) return '';
                const d = new Date(iso);
                if (isNaN(d.getTime())) return '';
                return Utils.formatDate(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
            };
            const logRows = eventLogs.slice(-5).reverse().map(l =>
                `<li><span class="ed-log-time">${fmtLogTime(l.datetime)}</span> <span class="ed-log-user">${esc(l.user || '')}</span> ${esc(l.action || '')} ${esc(l.details || '')}</li>`
            ).join('');
            eventLogDisplay = `<details class="ed-log"><summary>変更履歴（直近${Math.min(5, eventLogs.length)}件）</summary><ul>${logRows}</ul></details>`;
        }

        if (requestToken !== Calendar._detailsToken) return;

        content.innerHTML = `
            <div class="ed-head ed-type-${typeKey}">
                <div class="ed-badges"><span class="ed-type">${esc(Utils.getEventTypeLabel(event.type))}</span>${grades}</div>
                <h3 class="ed-title">${esc(event.title)}</h3>
                <div class="ed-date">${Utils.formatDateForDisplay(event.date)}${relDay ? `<span class="ed-rel${dayDiff < 0 ? ' ed-rel-past' : ''}">${relDay}</span>` : ''}</div>
                ${event.targetNotes ? `<div class="ed-target-notes">対象: ${esc(event.targetNotes)}</div>` : ''}
            </div>
            <div class="ed-facts">${facts}</div>
            <div id="event-weather-${esc(String(event.id))}" class="ed-weather"></div>
            ${notesHtml}
            ${attendanceDisplay}
            ${itemsHtml}
            ${(event.notes || event.description) ? `
            <section class="ed-section detail-item">
                <div class="ed-section-head"><h4>備考</h4></div>
                <div class="detail-notes">${esc(event.notes || event.description)}</div>
            </section>` : ''}
            <section class="ed-section">
                <div class="ed-section-head"><h4>📎 添付ファイル</h4></div>
                <div id="calendar-event-files" class="ed-files"></div>
                <button type="button" id="calendar-event-file-btn" class="secondary-button ed-file-btn">＋ ファイルを追加</button>
                <input type="file" id="calendar-event-file-input" multiple style="display:none;"
                    accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.txt,.md">
            </section>
            ${eventLogDisplay}
        `;

        // この予定の連絡を見たことにする（連絡事項タブ・参加予定の新着が消える）
        if (evNotes.length && app.Inbox) {
            app.Inbox.markEventSeen(event.id, evNotes);
            if (app.Hub.Notifications && app.Hub.Notifications.updateBadge) app.Hub.Notifications.updateBadge();
        }

        // お子さんの「参加／不参加」（押すとすぐ保存して、詳細を出し直す）
        if (app.Hub.MyEvents && app.Hub.MyEvents.answerButtons) {
            content.querySelectorAll('.ed-mine-row').forEach(function(row) {
                row.appendChild(app.Hub.MyEvents.answerButtons(String(event.id), row.dataset.name, row.dataset.status, function() {
                    Calendar.showEventDetails(event.id);
                }));
            });
        }

        // 指導者の担当を決める（監督・コーチの都合の良い順に出る）
        var coachBtn = document.getElementById('event-coach-btn');
        if (coachBtn) {
            coachBtn.addEventListener('click', function() {
                app.Hub.Coaching.openAssign(event, function() { Calendar.showEventDetails(event.id); });
            });
        }

        // 参加者を追加（同じ日の別の予定・その日に予定のない選手をこの予定に入れる。管理者・指導者・役員）
        var moveBtn = document.getElementById('event-player-move-btn');
        if (moveBtn) {
            moveBtn.addEventListener('click', function() {
                app.PlayerMove.open(event, {
                    members: app.Hub.members || [],
                    events: function() { return app.Hub.events || []; },
                    onClose: function(changed) { if (changed) Calendar.showEventDetails(event.id); }
                });
            });
        }

        // 添付ファイル（配車管理画面と同じStorageパスを参照＝同期される）
        if (app.EventFiles) {
            var filesEl = document.getElementById('calendar-event-files');
            app.EventFiles.render(event.id, filesEl);
            var fileBtn = document.getElementById('calendar-event-file-btn');
            var fileInput = document.getElementById('calendar-event-file-input');
            if (fileBtn && fileInput) {
                fileBtn.addEventListener('click', function() { fileInput.value = ''; fileInput.click(); });
                fileInput.addEventListener('change', function() {
                    if (fileInput.files.length) app.EventFiles.upload(event.id, fileInput.files, filesEl);
                });
            }
        }

        // ボタンにイベントIDを設定
        document.getElementById('manage-event').setAttribute('data-event-id', event.id);
        document.getElementById('edit-event').setAttribute('data-event-id', event.id);
        document.getElementById('delete-event').setAttribute('data-event-id', event.id);

        // ナイターは配車管理ボタンを非表示
        var manageBtn = document.getElementById('manage-event');
        if (manageBtn) manageBtn.style.display = (event.type === 'nighter') ? 'none' : '';

        // モーダルを表示
        UI.openModal('event-details-modal');

        // 会場の天気（非同期。取得失敗してもモーダル自体は壊れない）
        Calendar._renderWeatherChip(event);
    };

    /**
     * イベントの会場天気を取得して差し込む
     * @param {Object} event - イベント
     */
    Calendar._renderWeatherChip = function(event) {
        if (!event.venue || !app.Weather || !app.Weather.getDailyForecast) return;
        var target = document.getElementById('event-weather-' + event.id);
        if (!target) return;
        var venueData = (app.Hub.venues || []).find(function(v) { return v.name === event.venue; });
        var address = venueData && venueData.address;
        target.innerHTML = '<span class="weather-chip weather-chip-muted">天気を取得中...</span>';
        app.Weather.getDailyForecast(event.venue, address, event.date, event).then(function(result) {
            var el = document.getElementById('event-weather-' + event.id);
            if (el) el.innerHTML = app.Weather.formatWidget(result, event.venue, address);
        });
    };
    
    /**
     * 予定追加モーダルを開く
     * @param {Date} date - 日付（nullの場合は現在の日付）
     */
    Calendar.openAddEventModal = function(date = null) {
        console.log('予定追加モーダルを開きます...');
        
        // モーダルのタイトルを設定
        document.querySelector('#event-modal h2').textContent = 'イベントを追加';
        
        // フォームをリセット
        // ※ 編集モーダルをキャンセルで閉じると data-event-id が残り、次の「追加」が
        //   前に開いたイベントの「更新」として保存され、そのイベントが上書きされていた。
        //   hidden入力（学年外追加選手）も reset() では消えないため明示的にクリアする
        const eventForm = document.getElementById('event-form');
        eventForm.reset();
        eventForm.removeAttribute('data-event-id');
        const extraInputReset = document.getElementById('event-extra-players');
        if (extraInputReset) extraInputReset.value = '';
        const extraListReset = document.getElementById('extra-players-list');
        if (extraListReset) { extraListReset.innerHTML = ''; extraListReset.style.display = 'none'; }
        
        // 日付を設定（指定があれば）
        if (date) {
            // タイムゾーンによる日付のずれを防ぐため、YYYYMMDDの文字列に変換してからセット
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            document.getElementById('event-date').value = dateString;
            console.log(`日付設定: ${dateString}`);
        } else {
            // 指定がなければ今日の日付
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            document.getElementById('event-date').value = dateString;
            console.log(`今日の日付: ${dateString}`);
        }
        
        // 対象学年のチェックボックスを生成
        this.generateGradeCheckboxes();

        // 出発時間フィールドを有効に戻す
        var depEl = document.getElementById('event-departure-time');
        if (depEl) depEl.disabled = false;

        // 持ち物: 種類のテンプレを初期値としてセット（自由編集可）
        var clEl = document.getElementById('event-checklist');
        if (clEl && app.Checklist) {
            var typeEl = document.getElementById('event-type');
            clEl.value = app.Checklist.getTemplate(typeEl ? typeEl.value : 'game').join('、');
        }

        // 荷物をリセット
        Calendar._setLuggageValue([]);

        // その日の監督・コーチの都合
        Calendar._coachHint();

        // モーダルを表示
        UI.openModal('event-modal');
    };

    /** 予定の追加・編集フォーム: 選んだ日の監督・コーチの都合（js/hub/coaching.js） */
    Calendar._coachHint = function() {
        if (!app.Hub.Coaching) return;
        app.Hub.Coaching.renderFormHint(document.getElementById('event-coach-hint'), document.getElementById('event-date').value);
    };

    /**
     * ナイターイベント種類変更時のデフォルト設定
     * @param {string} type - イベント種類
     */
    Calendar.onEventTypeChange = function(type) {
        var depEl = document.getElementById('event-departure-time');
        if (type === 'nighter') {
            // タイトル（未入力時のみ）
            var titleEl = document.getElementById('event-title');
            if (titleEl && !titleEl.value) titleEl.value = 'ナイター練習';

            // 集合場所
            var meetingEl = document.getElementById('event-meeting-place');
            if (meetingEl && !meetingEl.value) meetingEl.value = '尾島小学校';

            // 会場
            var venueEl = document.getElementById('event-venue');
            if (venueEl && !venueEl.value) venueEl.value = '尾島小学校';

            // 開始・終了時間
            var startEl = document.getElementById('event-start-time');
            if (startEl && !startEl.value) startEl.value = '18:30';
            var endEl = document.getElementById('event-end-time');
            if (endEl && !endEl.value) endEl.value = '20:30';

            // 出発時間を無効化
            if (depEl) { depEl.value = ''; depEl.disabled = true; }

            // 全学年チェック
            document.querySelectorAll('input[name="event-target"]').forEach(function(cb) { cb.checked = true; });
        } else {
            // 出発時間を有効化
            if (depEl) depEl.disabled = false;
        }

        // 持ち物テンプレを種類に合わせて入れ替え（編集はこの後自由にできる）
        var clEl = document.getElementById('event-checklist');
        if (clEl && app.Checklist) {
            clEl.value = app.Checklist.getTemplate(type).join('、');
        }
    };
    
    /**
     * 対象学年のチェックボックスを生成
     */
    Calendar.generateGradeCheckboxes = function(extraGrades) {
        const container = document.getElementById('event-target-grades');
        container.innerHTML = '';
        
        const members = app.Hub.members || [];

        // メンバーから存在する学年を抽出
        const existingGrades = new Set();
        members.forEach(member => {
            if (member.role === 'player' && member.grade) {
                existingGrades.add(member.grade);
            }
        });
        // 編集中のイベントの対象学年も必ず出す（今その学年の選手がいないと
        // チェックボックスが作られず、保存すると対象学年から黙って外れていた）
        const hasPlayerGrades = existingGrades.size > 0;
        (extraGrades || []).forEach(function(g) { if (g) existingGrades.add(String(g)); });
        
        // 学年が存在しない場合は全学年を表示
        if (!hasPlayerGrades) {
            const grades = ['年少', '年中', '年長', '1', '2', '3', '4', '5', '6'];
            grades.forEach(grade => existingGrades.add(grade));
        }
        
        // ソートして表示
        const sortedGrades = Array.from(existingGrades).sort((a, b) => {
            const gradeOrder = {
                '年少': -3,
                '年中': -2,
                '年長': -1
            };
            
            const valA = gradeOrder[a] !== undefined ? gradeOrder[a] : (parseInt(a, 10) || 99);
            const valB = gradeOrder[b] !== undefined ? gradeOrder[b] : (parseInt(b, 10) || 99);
            
            return valA - valB;
        });
        
        sortedGrades.forEach(grade => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `grade-${grade}`;
            checkbox.value = grade;
            checkbox.name = 'event-target';
            
            const label = document.createElement('label');
            label.htmlFor = `grade-${grade}`;
            label.textContent = Utils.getGradeLabel(grade);
            label.style.display = 'inline';
            
            item.appendChild(checkbox);
            item.appendChild(label);
            container.appendChild(item);
        });
    };
    
    // 予定フォームで編集する項目（保存するイベントはこれと id だけで組み立てる）
    var EVENT_FORM_FIELDS = ['date', 'type', 'title', 'target', 'extraPlayers', 'targetNotes', 'attendanceDeadline',
        'departureTime', 'meetingPlace', 'venue', 'startTime', 'endTime', 'notes', 'checklist', 'luggage'];

    /**
     * 予定フォームの入力内容を読み取る
     * @returns {Object} EVENT_FORM_FIELDS の各項目
     */
    Calendar._readEventForm = function() {
        // 対象学年を取得
        const targetCheckboxes = document.querySelectorAll('input[name="event-target"]:checked');
        // 出欠回答期限を取得
        const deadlineDate = document.getElementById('event-attendance-deadline-date').value;
        const deadlineTime = document.getElementById('event-attendance-deadline-time').value;
        let attendanceDeadline = null;
        if (deadlineDate) {
            if (deadlineTime) {
                attendanceDeadline = `${deadlineDate}T${deadlineTime}`;
            } else {
                attendanceDeadline = `${deadlineDate}T23:59`;
            }
        }
        // 持ち物（完全上書きリストとして保存。空でも保存＝持ち物なし）
        // ※ undefinedはFirestoreが拒否するため必ず配列にする
        const checklistEl = document.getElementById('event-checklist');
        const extraPlayersVal = document.getElementById('event-extra-players');
        return {
            date: document.getElementById('event-date').value,
            type: document.getElementById('event-type').value,
            // 空白だけのタイトルで「タイトルなし」の予定ができないよう前後の空白を除く
            title: document.getElementById('event-title').value.trim(),
            target: Array.from(targetCheckboxes).map(cb => cb.value),
            extraPlayers: extraPlayersVal && extraPlayersVal.value ? extraPlayersVal.value.split(',').filter(Boolean) : [],
            targetNotes: document.getElementById('event-target-notes').value,
            attendanceDeadline,
            departureTime: document.getElementById('event-departure-time').value,
            meetingPlace: document.getElementById('event-meeting-place').value,
            venue: document.getElementById('event-venue').value,
            startTime: document.getElementById('event-start-time').value,
            endTime: document.getElementById('event-end-time').value,
            notes: document.getElementById('event-notes').value,
            checklist: (app.Checklist && checklistEl) ? app.Checklist.parseInput(checklistEl.value) : [],
            // 荷物（共用備品）: [{name, count}] の配列
            luggage: Calendar._getLuggageValue()
        };
    };

    /**
     * 新規イベント保存
     */
    Calendar.saveEvent = function() {
        const events = app.Hub.events;
        const logs = app.Hub.logs;

        const form = Calendar._readEventForm();
        const { date, type, title, target, targetNotes, attendanceDeadline, departureTime, meetingPlace,
            venue, startTime, endTime, notes, checklist, luggage } = form;
        
        // バリデーション（タイトルのみ必須）
        if (!date || !title) {
            UI.showAlert('日付とタイトルは必須です');
            return;
        }

        // 同日同選手の重複チェック
        const eventFormId = document.getElementById('event-form').getAttribute('data-event-id');
        if (target && target.length > 0) {
            const members = app.Hub.members || [];
            const extraPlayers = (document.getElementById('event-extra-players').value || '').split(',').filter(Boolean);
            // 対象選手一覧を構築（学年対象 + 追加選手）
            const targetPlayerNames = new Set();
            members.forEach(function(m) {
                if (m.role === 'player' && target.some(function(g) { return String(g) === String(m.grade); })) targetPlayerNames.add(m.name);
            });
            extraPlayers.forEach(function(n) { targetPlayerNames.add(n); });

            const conflicts = [];
            events.forEach(function(ev) {
                if (String(ev.id) === String(eventFormId)) return; // 自分自身は除外
                if (ev.date !== date) return;
                if (!ev.target || ev.target.length === 0) return;
                const evPlayerNames = new Set();
                members.forEach(function(m) {
                    if (m.role === 'player' && ev.target.some(function(g) { return String(g) === String(m.grade); })) evPlayerNames.add(m.name);
                });
                (ev.extraPlayers || []).forEach(function(n) { evPlayerNames.add(n); });
                evPlayerNames.forEach(function(n) {
                    if (targetPlayerNames.has(n)) {
                        conflicts.push({ player: n, event: ev.title });
                    }
                });
            });

            if (conflicts.length > 0) {
                // ハードエラーにすると「4〜6年イベントに3年生を1人だけ追加した後、
                // 同日に1〜3年イベントを作れない」という運用上の詰みが起きる
                // （2026-07-20ユーザー報告）。重複を提示した上で登録を続行できるようにする。
                const msgs = conflicts.map(function(c) {
                    return '・' + c.player + ' が「' + c.event + '」と重複しています';
                });
                const proceed = confirm(
                    '同日の他イベントと対象選手が重複しています:\n' + msgs.join('\n') +
                    '\n\nこのまま登録しますか？\n（学年外追加などで意図した重複であればOKを押してください）'
                );
                if (!proceed) return;
            }
        }

        // 新しいイベントID（タイムスタンプベースでユニーク）
        const newId = Date.now();

        // 追加選手
        const extraPlayers = form.extraPlayers;

        if (eventFormId) {
            // 既存イベントの更新
            const index = events.findIndex(e => String(e.id) === String(eventFormId));
            if (index === -1) {
                // 編集中に他の人がこの予定を削除した（リアルタイム同期で一覧から消えた）。
                // 以前は何も保存せずに「イベントを保存しました」と表示していた
                UI.showAlert('この予定は編集中に他の人によって削除されたため、保存できませんでした', 'error', 8000);
                UI.closeModal('event-modal');
                return;
            }
            if (index !== -1) {
                const current = events[index];
                // フォームを開いたときの内容から自分が変えていない項目は、今の（リアルタイム同期で届いた
                // 最新の）内容を残す。以前はフォームの内容で丸ごと置き換えていたため、編集中に他の人が
                // 変えた開始時刻や、出欠状況の表から追加された学年外の選手などを古い内容で上書きしていた
                const base = (Calendar._editBaseline && Calendar._editBaseline.id === String(eventFormId))
                    ? Calendar._editBaseline.values : null;
                const updated = { id: current.id };
                EVENT_FORM_FIELDS.forEach(function(f) {
                    const unchanged = base && JSON.stringify(form[f]) === JSON.stringify(base[f]);
                    updated[f] = (unchanged && current[f] !== undefined) ? current[f] : form[f];
                });
                events[index] = updated;
                
                // ログに記録（eventId付き）
                const updatedEventId = events[events.findIndex(e => String(e.id) === String(eventFormId))].id;
                app.Hub.logs = Storage.addLog('calendar', 'イベント更新', `「${title}」（${date}）`, logs, { eventId: updatedEventId });
            }
        } else {
            // 新規イベントを追加
            events.push({
                id: newId,
                date,
                type,
                title,
                target,
                extraPlayers,
                targetNotes,
                attendanceDeadline,
                departureTime,
                meetingPlace,
                venue,
                startTime,
                endTime,
                notes,
                checklist,
                luggage
            });

            // ログに記録（eventId付き）
            app.Hub.logs = Storage.addLog('calendar', 'イベント追加', `「${title}」（${date}）`, logs, { eventId: newId });
        }
        
        // イベントを保存してUIを更新
        Storage.saveEvents(events);

        // フォームで選択された添付ファイルをアップロード（保存されたイベントIDに紐付け）
        var formFilesInput = document.getElementById('event-form-files');
        if (formFilesInput && formFilesInput.files.length > 0 && app.EventFiles) {
            var savedEventId = eventFormId || newId;
            app.EventFiles.upload(savedEventId, formFilesInput.files, null).then(function() {
                console.log('イベント登録時の添付ファイルをアップロードしました');
            });
            formFilesInput.value = '';
        }

        this.renderCalendar();
        this.renderEventsList();
        
        // モーダルを閉じてフォームをリセット
        UI.closeModal('event-modal');
        document.getElementById('event-form').reset();
        document.getElementById('event-form').removeAttribute('data-event-id');
        var extraInput = document.getElementById('event-extra-players');
        if (extraInput) extraInput.value = '';
        var extraListEl = document.getElementById('extra-players-list');
        if (extraListEl) { extraListEl.innerHTML = ''; extraListEl.style.display = 'none'; }
        UI.showAlert('イベントを保存しました', 'success');
    };
    
    /**
     * イベント編集
     * @param {number} eventId - イベントID
     */
    Calendar.editEvent = function(eventId) {
        const events = app.Hub.events;
        const event = events.find(e => String(e.id) === String(eventId));
        if (!event) return;
        
        // モーダルのタイトル設定
        document.querySelector('#event-modal h2').textContent = 'イベントを編集';
        
        // フォームにイベントIDを設定
        document.getElementById('event-form').setAttribute('data-event-id', event.id);

        // 添付ファイルの選択は持ち越さない（編集フォームは reset() しないため、前に開いて
        // キャンセルしたフォームで選んだファイルが、この予定に添付されてしまっていた）
        var formFiles = document.getElementById('event-form-files');
        if (formFiles) formFiles.value = '';
        
        // フォームに値を設定
        document.getElementById('event-date').value = event.date;
        Calendar._coachHint();
        document.getElementById('event-type').value = event.type;
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-target-notes').value = event.targetNotes || '';
        
        // 出欠回答期限を設定
        if (event.attendanceDeadline) {
            const deadline = new Date(event.attendanceDeadline);
            const deadlineDate = Utils.formatDate(deadline);
            const hours = String(deadline.getHours()).padStart(2, '0');
            const minutes = String(deadline.getMinutes()).padStart(2, '0');
            const deadlineTime = `${hours}:${minutes}`;
            
            document.getElementById('event-attendance-deadline-date').value = deadlineDate;
            document.getElementById('event-attendance-deadline-time').value = deadlineTime;
        } else {
            document.getElementById('event-attendance-deadline-date').value = '';
            document.getElementById('event-attendance-deadline-time').value = '';
        }
        
        document.getElementById('event-departure-time').value = event.departureTime || '';
        // ナイターは出発時間なし（直前に開いたフォームの状態を引き継がないよう毎回設定）
        document.getElementById('event-departure-time').disabled = (event.type === 'nighter');
        document.getElementById('event-meeting-place').value = event.meetingPlace || '';
        document.getElementById('event-venue').value = event.venue || '';
        document.getElementById('event-start-time').value = event.startTime || '';
        document.getElementById('event-end-time').value = event.endTime || '';
        // 旧データは備考を description に持っている（表示側は notes || description）。
        // フォームに出さないと、編集して保存したときに備考が消えていた
        document.getElementById('event-notes').value = event.notes || event.description || '';

        // 持ち物を復元（個別リストがあればそれ、なければテンプレ+旧extra）
        var clEl = document.getElementById('event-checklist');
        if (clEl && app.Checklist) {
            clEl.value = app.Checklist.getItems(event.type, event.checklistExtra, event.checklist).join('、');
        }

        // 荷物を復元
        Calendar._setLuggageValue(event.luggage || []);

        // 対象学年のチェックボックスを生成（イベントの対象学年は選手がいなくても出す）
        this.generateGradeCheckboxes(Array.isArray(event.target) ? event.target : []);
        
        // 対象学年のチェックボックスを設定
        if (Array.isArray(event.target) && event.target.length > 0) {
            event.target.forEach(grade => {
                const checkbox = document.getElementById(`grade-${grade}`);
                if (checkbox) checkbox.checked = true;
            });
        }
        
        // 学年外追加選手を復元
        var extraInput = document.getElementById('event-extra-players');
        var extraListEl = document.getElementById('extra-players-list');
        if (extraInput) {
            var extraPlayers = event.extraPlayers || [];
            extraInput.value = extraPlayers.join(',');
            if (extraListEl) {
                if (extraPlayers.length > 0) {
                    extraListEl.innerHTML = '<b>追加選手: </b>' + extraPlayers.map(function(name) {
                        return '<span style="background:#fff3cd;padding:2px 6px;border-radius:4px;margin:2px;">' + UI.escapeHTML(name) + '</span>';
                    }).join('');
                    extraListEl.style.display = 'block';
                } else {
                    extraListEl.innerHTML = '';
                    extraListEl.style.display = 'none';
                }
            }
        }

        // 開いた時点のフォームの内容（保存時に、自分が変えた項目だけを反映するため）
        Calendar._editBaseline = { id: String(event.id), values: Calendar._readEventForm() };

        // 詳細モーダルを閉じて編集モーダルを開く
        UI.closeModal('event-details-modal');
        UI.openModal('event-modal');
    };

    /**
     * イベント削除
     * @param {number} eventId - イベントID
     */
    Calendar.deleteEvent = function(eventId) {
        const events = app.Hub.events;
        const logs = app.Hub.logs;

        const event = events.find(e => String(e.id) === String(eventId));
        if (!event) return;

        if (UI.showConfirm(`イベント「${event.title}」を削除してもよろしいですか？`)) {
            // ログに記録（eventId付き）※ Hub.events から削除する前に呼ぶこと（バックアップデータ取得のため）
            app.Hub.logs = Storage.addLog('calendar', 'イベント削除', `「${event.title}」（${event.date}）`, logs, { eventId: event.id });

            // イベントを削除
            app.Hub.events = events.filter(e => String(e.id) !== String(eventId));

            // イベントを保存してUIを更新
            Storage.saveEvents(app.Hub.events);

            // イベント固有データ（出欠・配車等）も削除
            Storage.deleteEventData(eventId);
            if (window.FCOjima && FCOjima.DB && FCOjima.DB.deleteEventData) {
                FCOjima.DB.deleteEventData(eventId).catch(function(e) {
                    console.warn('Firestoreイベントデータ削除失敗:', e);
                });
            }

            this.renderCalendar();
            this.renderEventsList();

            // モーダルを閉じる
            UI.closeModal('event-details-modal');
        }
    };
    
    /**
     * 配車管理画面へ移動
     * @param {number} eventId - イベントID
     */
    Calendar.navigateToCarpool = function(eventId) {
        const events = app.Hub.events;

        // イベント情報をセッションストレージに保存
        const event = events.find(e => String(e.id) === String(eventId));
        if (event) {
            Storage.setSelectedEvent(event);
            // 配車管理ページに移動（再読み込みやURL共有でもイベントが特定できるようIDを付ける）
            window.location.href = '../carpool/index.html?event=' + encodeURIComponent(String(event.id));
        }
    };

    /**
     * 学年外選手追加モーダルを開く
     */
    Calendar.openExtraPlayerModal = function() {
        var members = app.Hub.members || [];
        var checkedGrades = Array.from(document.querySelectorAll('input[name="event-target"]:checked')).map(cb => cb.value);

        // 指定学年外の選手を抽出
        var extraCandidates = members.filter(function(m) {
            return m.role === 'player' && (!checkedGrades.length || !checkedGrades.some(function(g) { return String(g) === String(m.grade); }));
        });

        // 現在選択中の追加選手
        var currentExtra = (document.getElementById('event-extra-players').value || '').split(',').filter(Boolean);

        var listEl = document.getElementById('extra-player-list');
        listEl.innerHTML = '';

        if (extraCandidates.length === 0) {
            listEl.innerHTML = '<p style="padding:10px;color:#999;">対象外の選手はいません。</p>';
        } else {
            extraCandidates.forEach(function(m) {
                var item = document.createElement('label');
                item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #eee;cursor:pointer;';

                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = m.name;
                cb.checked = currentExtra.includes(m.name);

                var gradeLabel = Utils.getGradeLabel(m.grade || '');
                item.appendChild(cb);
                item.appendChild(document.createTextNode(m.name + (gradeLabel ? ' (' + gradeLabel + ')' : '')));
                listEl.appendChild(item);
            });
        }

        UI.openModal('extra-player-modal');
    };

    /**
     * 学年外選手選択を確定
     */
    Calendar.confirmExtraPlayers = function() {
        var checked = Array.from(document.querySelectorAll('#extra-player-list input[type=checkbox]:checked')).map(cb => cb.value);

        document.getElementById('event-extra-players').value = checked.join(',');

        var listEl = document.getElementById('extra-players-list');
        if (checked.length > 0) {
            listEl.innerHTML = '<b>追加選手: </b>' + checked.map(name => '<span style="background:#fff3cd;padding:2px 6px;border-radius:4px;margin:2px;">' + UI.escapeHTML(name) + '</span>').join('');
            listEl.style.display = 'block';
        } else {
            listEl.innerHTML = '';
            listEl.style.display = 'none';
        }

        UI.closeModal('extra-player-modal');
    };

})(window.FCOjima);