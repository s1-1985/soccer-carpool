/**
 * FC尾島ジュニア - 座席割り振り補助関数
 * ※ このブロックは下部の Assignment IIFE と同じオブジェクトを操作する
 */
FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Assignment = FCOjima.Carpool.Assignment || {};

(function(app) {
    var Assignment = app.Carpool.Assignment;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;

    /**
     * 座席をクリア
     * @param {HTMLElement} seat - 座席要素
     */
    Assignment.clearSeat = function(seat) {
        seat.classList.remove('filled');
        delete seat.dataset.person;
        delete seat.dataset.gradeColor;
        seat.style.background = '';

        // 追加した要素をすべて削除
        ['member-icon', 'seat-name-tag', 'seat-clear-btn'].forEach(function(cls) {
            var el = seat.querySelector('.' + cls);
            if (el) el.remove();
        });

        // ラベルが消えていたら復元
        var label = seat.querySelector('.seat-label');
        if (!label) {
            label = document.createElement('div');
            label.className = 'seat-label';
            label.textContent = (seat.dataset.seatType || '') + ' ' + (parseInt(seat.dataset.seatIndex || 0) + 1);
            seat.appendChild(label);
        }
    };
    
    /**
     * 座席編集モーダルを開く
     * @param {HTMLElement} seat - 座席要素
     */
    Assignment.openSeatEditModal = function(seat) {
        console.log('座席編集モーダルを開きます...');

        const seatEditModal = document.getElementById('seat-edit-modal');
        if (!seatEditModal) return;

        const seatEditForm = document.getElementById('seat-edit-form');
        seatEditForm.dataset.carIndex = seat.dataset.carIndex;
        seatEditForm.dataset.seatType = seat.dataset.seatType;
        seatEditForm.dataset.seatIndex = seat.dataset.seatIndex;

        // 現在の配置状況を表示
        const currentInfo = document.getElementById('seat-current-info');
        const currentPerson = seat.dataset.person;
        if (currentInfo) {
            currentInfo.textContent = currentPerson
                ? '現在: ' + currentPerson + '（別の名前をタップで変更）'
                : '空席 — 配置するメンバーをタップしてください';
        }

        // メンバーリストを生成（イベント対象者 + 荷物、割り当て済みを除く）
        const memberList = document.getElementById('seat-member-list');
        if (memberList) {
            memberList.innerHTML = '';

            const assignedPeople = [];
            // filledクラスを持つ通常座席 + ドライバー座席（filledクラスなし）の両方を除外
            document.querySelectorAll('.seat.filled, .seat.driver-seat').forEach(function(s) {
                if (s !== seat && s.dataset.person) assignedPeople.push(s.dataset.person);
            });

            // イベント対象者でフィルタリング（右側メンバーリストと同じロジック）
            const available = Assignment.getEventFilteredMembers().filter(function(m) {
                return !assignedPeople.includes(m.name);
            });
            available.push({ id: 'luggage', name: '荷物', role: 'other' });

            const roleOrder = { coach: 1, assist: 2, player: 3, father: 4, mother: 4, other: 5 };
            available.sort(function(a, b) {
                return (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5);
            });

            if (available.length === 0) {
                memberList.innerHTML = '<p style="padding:10px;color:#999;">配置できるメンバーがいません</p>';
            } else {
                available.forEach(function(member) {
                    var item = document.createElement('div');
                    item.style.cssText = 'padding:10px 14px;border-bottom:1px solid #eee;cursor:pointer;display:flex;align-items:center;gap:8px;';
                    if (currentPerson === member.name) item.style.background = '#fff3cd';

                    // 学年バッジ（選手のみ）
                    var gc = Assignment.getGradeColor(member.grade);
                    if (gc && member.role === 'player') {
                        var badge = document.createElement('span');
                        badge.style.cssText = 'min-width:22px;height:18px;border-radius:9px;background:' + gc + ';color:#fff;font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;padding:0 4px;flex-shrink:0;';
                        badge.textContent = member.grade + '年';
                        item.appendChild(badge);
                    }

                    var nameSpan = document.createElement('span');
                    nameSpan.textContent = (member.abbr != null && member.abbr !== '') ? member.abbr : member.name;
                    nameSpan.style.fontSize = '14px';
                    item.appendChild(nameSpan);

                    item.addEventListener('click', function() {
                        Assignment.setSeatOccupant(seat, member.name);
                        UI.closeModal('seat-edit-modal');
                        Assignment.saveAssignments();
                        Assignment.updateMembersList();
                    });

                    memberList.appendChild(item);
                });
            }
        }

        UI.openModal('seat-edit-modal');
    };
    
    /**
     * 座席編集を保存
     */
    Assignment.saveSeatEdit = function() {
        console.log('座席編集を保存します...');
        
        const seatEditForm = document.getElementById('seat-edit-form');
        const carIndex = seatEditForm.dataset.carIndex;
        const seatType = seatEditForm.dataset.seatType;
        const seatIndex = seatEditForm.dataset.seatIndex;
        
        const person = document.getElementById('seat-person').value;
        
        // 対象の座席要素を取得
        const seat = document.querySelector(`.seat[data-car-index="${carIndex}"][data-seat-type="${seatType}"][data-seat-index="${seatIndex}"]`);
        
        if (seat) {
            if (person) {
                // 乗車メンバーを設定
                this.setSeatOccupant(seat, person);
                console.log(`座席に乗車メンバーを設定しました: ${person}`);
            } else {
                // 座席をクリア
                this.clearSeat(seat);
                console.log('座席をクリアしました');
            }
        } else {
            console.log('対象の座席要素が見つかりません');
        }
        
        // モーダルを閉じる
        UI.closeModal('seat-edit-modal');
        
        // 配置データを保存
        this.saveAssignments();
        
        // メンバーリストを更新
        this.updateMembersList();
        
        console.log('座席編集を保存しました');
    };
    
    /**
     * 選択した座席をクリア
     */
    Assignment.clearSelectedSeat = function() {
        console.log('選択した座席をクリアします...');
        
        const seatEditForm = document.getElementById('seat-edit-form');
        const carIndex = seatEditForm.dataset.carIndex;
        const seatType = seatEditForm.dataset.seatType;
        const seatIndex = seatEditForm.dataset.seatIndex;
        
        // 対象の座席要素を取得
        const seat = document.querySelector(`.seat[data-car-index="${carIndex}"][data-seat-type="${seatType}"][data-seat-index="${seatIndex}"]`);
        
        if (seat) {
            // 座席をクリア
            this.clearSeat(seat);
            console.log('座席をクリアしました');
        } else {
            console.log('対象の座席要素が見つかりません');
        }
        
        // モーダルを閉じる
        UI.closeModal('seat-edit-modal');
        
        // 配置データを保存
        this.saveAssignments();
        
        // メンバーリストを更新
        this.updateMembersList();
        
        console.log('選択した座席のクリアが完了しました');
    };

    /**
     * イベント対象者でフィルタリングされたメンバーリストを返す
     * openSeatEditModal, generateRandomAssignments で共用
     */
    Assignment.getEventFilteredMembers = function() {
        var event = Storage.getSelectedEvent();
        var members = app.Carpool.members || [];
        var targetGrades = (event && event.target && event.target.length > 0) ? event.target : [];

        // スタッフは常に含む
        var filtered = members.filter(function(m) { return m.role === 'coach' || m.role === 'assist'; });

        // 対象学年の選手
        if (targetGrades.length > 0) {
            filtered = filtered.concat(members.filter(function(m) {
                return m.role === 'player' && m.grade && targetGrades.includes(m.grade);
            }));
        } else {
            filtered = filtered.concat(members.filter(function(m) { return m.role === 'player'; }));
        }

        // 学年外追加選手
        if (event && event.extraPlayers && event.extraPlayers.length > 0) {
            var existingNames = new Set(filtered.map(function(m) { return m.name; }));
            event.extraPlayers.forEach(function(name) {
                if (!existingNames.has(name)) {
                    var m = members.find(function(x) { return x.name === name; });
                    if (m) { filtered.push(m); existingNames.add(name); }
                }
            });
        }

        // 参加確定選手の保護者
        var attendance = app.Carpool.appData.attendance;
        if (attendance && attendance.length > 0) {
            var presentPlayerNames = attendance
                .filter(function(a) { return a.status === 'present'; })
                .map(function(a) { return a.name; });
            var presentPlayerIds = new Set(
                members
                    .filter(function(p) { return p.role === 'player' && presentPlayerNames.includes(p.name); })
                    .map(function(p) { return String(p.id); })
            );
            var existingNames2 = new Set(filtered.map(function(m) { return m.name; }));
            filtered = filtered.concat(members.filter(function(m) {
                if (m.role !== 'father' && m.role !== 'mother') return false;
                if (existingNames2.has(m.name)) return false;
                if (!m.childrenIds || !m.childrenIds.length) return false;
                return m.childrenIds.some(function(cid) { return presentPlayerIds.has(String(cid)); });
            }));
        }

        // 重複排除
        var seen = new Set();
        return filtered.filter(function(m) {
            var key = String(m.id || m.name);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    /**
     * 全座席割り当てをリセット
     */
    Assignment.resetAllAssignments = function() {
        if (!confirm('すべての座席割り当てをリセットしますか？')) return;
        document.querySelectorAll('.seat:not(.driver-seat)').forEach(function(seat) {
            Assignment.clearSeat(seat);
        });
        app.Carpool.appData.assignments = [];
        app.Carpool.saveData();
        Assignment.updateMembersList();
        UI.showAlert('座席割り当てをリセットしました。');
    };

    /**
     * 車の座席数を増減する
     * @param {number} carIndex - 車インデックス（availableCars内）
     * @param {string} seatKey - 'frontSeat'|'middleSeat'|'backSeat'
     * @param {number} delta - +1 or -1
     */
    Assignment.adjustCarSeat = function(carIndex, seatKey, delta) {
        var availableCars = (app.Carpool.appData.carRegistrations || []).filter(function(c) {
            return c.canDrive !== 'no';
        });
        var car = availableCars[carIndex];
        if (!car) return;
        var maxSeats = { frontSeat: 2, middleSeat: 4, backSeat: 4 };
        var current = car[seatKey] || 0;
        var next = Math.max(0, Math.min(maxSeats[seatKey] || 4, current + delta));
        if (next === current) return;
        car[seatKey] = next;
        app.Carpool.saveData();
        this.updateAssignments();
    };

    /**
     * 座席数変更モーダルを開く
     * @param {number} carIndex - 車両インデックス
     */
    Assignment.openSeatCountModal = function(carIndex) {
        var availableCars = (app.Carpool.appData.carRegistrations || []).filter(function(c) {
            return c.canDrive !== 'no';
        });
        var car = availableCars[carIndex];
        if (!car) return;

        var modal = document.getElementById('seat-count-modal');
        if (!modal) return;

        var carNameEl = document.getElementById('seat-count-car-name');
        if (carNameEl) carNameEl.textContent = car.parent + 'の車';

        var formRows = document.getElementById('seat-count-form-rows');
        if (!formRows) return;
        formRows.innerHTML = '';

        var seatDefs = [
            { label: '助手席', key: 'frontSeat', max: 2 },
            { label: '中列',   key: 'middleSeat', max: 4 },
            { label: '後列',   key: 'backSeat',   max: 4 }
        ];

        seatDefs.forEach(function(def) {
            var current = car[def.key] || 0;
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;';

            var lbl = document.createElement('span');
            lbl.style.cssText = 'min-width:4em;font-size:14px;font-weight:bold;color:#444;';
            lbl.textContent = def.label;

            var minusBtn = document.createElement('button');
            minusBtn.type = 'button';
            minusBtn.className = 'seat-count-btn';
            minusBtn.textContent = '−';

            var countSpan = document.createElement('span');
            countSpan.style.cssText = 'min-width:2em;text-align:center;font-size:20px;font-weight:bold;';
            countSpan.textContent = current;
            countSpan.dataset.key = def.key;
            countSpan.dataset.value = String(current);

            var plusBtn = document.createElement('button');
            plusBtn.type = 'button';
            plusBtn.className = 'seat-count-btn';
            plusBtn.textContent = '+';

            var maxLbl = document.createElement('span');
            maxLbl.style.cssText = 'font-size:11px;color:#999;';
            maxLbl.textContent = '(最大' + def.max + ')';

            minusBtn.addEventListener('click', function() {
                var v = parseInt(countSpan.dataset.value, 10);
                if (v > 0) { v--; countSpan.textContent = v; countSpan.dataset.value = v; }
            });
            plusBtn.addEventListener('click', function() {
                var v = parseInt(countSpan.dataset.value, 10);
                if (v < def.max) { v++; countSpan.textContent = v; countSpan.dataset.value = v; }
            });

            row.appendChild(lbl);
            row.appendChild(minusBtn);
            row.appendChild(countSpan);
            row.appendChild(plusBtn);
            row.appendChild(maxLbl);
            formRows.appendChild(row);
        });

        modal.dataset.carIndex = carIndex;
        UI.openModal('seat-count-modal');
    };

    /**
     * 車のドライバーを編集（モーダル経由）
     * @param {number} carIndex - 車両インデックス
     */
    Assignment.editCarDriver = function(carIndex) {
        console.log(`車のドライバーを編集します: インデックス=${carIndex}`);

        var availableCars = (app.Carpool.appData.carRegistrations || []).filter(function(c) {
            return c.canDrive !== 'no';
        });
        var car = availableCars[carIndex];
        if (!car) { console.log('指定された車両が見つかりません'); return; }

        var modal = document.getElementById('driver-edit-modal');
        if (!modal) {
            // フォールバック: prompt
            var nd = prompt('ドライバー名を入力してください', car.parent);
            if (nd && nd !== car.parent) Assignment._applyDriverChange(carIndex, nd);
            return;
        }

        var carInfo = document.getElementById('driver-modal-car-info');
        if (carInfo) carInfo.textContent = '現在: ' + car.parent + ' — タップして変更';

        var list = document.getElementById('driver-modal-list');
        if (list) {
            list.innerHTML = '';
            // 運転手候補: 選手以外のメンバー全員
            var candidates = (app.Carpool.members || []).filter(function(m) {
                return m.role !== 'player';
            });
            if (candidates.length === 0) {
                list.innerHTML = '<p style="padding:10px;color:#999;">候補メンバーがいません</p>';
            } else {
                var roleLabels = { coach: '監督', assist: 'コーチ', father: '父', mother: '母', officer: '役員', other: 'その他' };
                candidates.forEach(function(member) {
                    var item = document.createElement('div');
                    item.style.cssText = 'padding:12px 16px;border-bottom:1px solid #eee;cursor:pointer;display:flex;align-items:center;gap:8px;';
                    if (car.parent === member.name) item.style.background = '#fff3cd';

                    var rl = roleLabels[member.role] || '';
                    if (rl) {
                        var badge = document.createElement('span');
                        badge.style.cssText = 'font-size:10px;background:#6c757d;color:#fff;border-radius:4px;padding:1px 6px;flex-shrink:0;';
                        badge.textContent = rl;
                        item.appendChild(badge);
                    }
                    var nameSpan = document.createElement('span');
                    nameSpan.textContent = member.name;
                    nameSpan.style.fontSize = '15px';
                    item.appendChild(nameSpan);

                    item.addEventListener('click', (function(ci, name) {
                        return function() {
                            Assignment._applyDriverChange(ci, name);
                            UI.closeModal('driver-edit-modal');
                        };
                    })(carIndex, member.name));
                    list.appendChild(item);
                });
            }
        }
        UI.openModal('driver-edit-modal');
    };

    /**
     * 運転手変更を実際に適用
     */
    Assignment._applyDriverChange = function(carIndex, newDriver) {
        var availableCars = (app.Carpool.appData.carRegistrations || []).filter(function(c) {
            return c.canDrive !== 'no';
        });
        var car = availableCars[carIndex];
        if (!car) return;
        car.parent = newDriver;

        var driverSeat = document.querySelector('.seat.driver-seat[data-car-index="' + carIndex + '"]');
        if (driverSeat) {
            driverSeat.dataset.person = newDriver;
            var icon = driverSeat.querySelector('.member-icon');
            if (icon) { icon.textContent = Assignment.getNameInitials(newDriver); icon.dataset.name = newDriver; }
        }
        // カーヘッダーも更新
        var carLayout = document.querySelector('.car-layout[data-car-index="' + carIndex + '"]');
        if (carLayout) {
            var header = carLayout.querySelector('.car-header');
            if (header) header.textContent = newDriver + 'の車 ✏';
        }
        app.Carpool.saveData();
        Assignment.updateMembersList();
        console.log('ドライバーを更新しました: ' + newDriver);
    };
    
    /**
     * ランダム割り当て生成
     */
    Assignment.generateRandomAssignments = function() {
        console.log('ランダム割り当てを生成します...');
        
        const carRegistrations = app.Carpool.appData.carRegistrations;
        
        if (!carRegistrations || carRegistrations.length === 0) {
            UI.showAlert('この予定には車両登録がありません');
            console.log('車両登録がありません');
            return;
        }
        
        // 運転可能な保護者リスト
        const drivers = carRegistrations.filter(reg => reg.canDrive !== 'no');
        
        if (drivers.length === 0) {
            UI.showAlert('運転可能な保護者がいません');
            console.log('運転可能な保護者がいません');
            return;
        }
        
        // イベント対象学年でフィルタリングされた選手リスト
        const eventFilteredPlayers = Assignment.getEventFilteredMembers()
            .filter(function(m) { return m.role === 'player'; })
            .map(function(m) { return m.name; });

        // 出欠で参加確定している選手（イベント対象内のみ）
        const attendance = app.Carpool.appData.attendance;
        const presentPlayers = [];
        if (attendance && attendance.length > 0) {
            attendance
                .filter(a => a.status === 'present')
                .forEach(a => {
                    if (eventFilteredPlayers.includes(a.name)) {
                        presentPlayers.push(a.name);
                    }
                });
        }

        console.log(`参加確定している対象選手数: ${presentPlayers.length}人`);

        // 参加確定選手がいない場合はイベント対象全選手を使う
        let targetPlayers = presentPlayers.length > 0 ? presentPlayers : eventFilteredPlayers;
        console.log(`ランダム配置対象選手数: ${targetPlayers.length}人`);
        
        // 監督・コーチのリスト
        const staffMembers = app.Carpool.members
            .filter(m => m.role === 'coach' || m.role === 'assist')
            .map(m => m.name);
        
        console.log(`監督・コーチ数: ${staffMembers.length}人`);
        
        // 割り当てリセット
        app.Carpool.appData.assignments = [];

        // ── Step1: 対象メンバーを「女子→男子」「学年順」でソート ──
        // 女子はなるべく同じ車にまとまるよう先頭に配置する
        var gradeOrder = { '年少': 0, '年中': 1, '年長': 2, '1': 3, '2': 4, '3': 5, '4': 6, '5': 7, '6': 8 };
        var sortedPlayers = [...targetPlayers].sort(function(a, b) {
            var mA = app.Carpool.members.find(function(m) { return m.name === a; });
            var mB = app.Carpool.members.find(function(m) { return m.name === b; });
            // 性別: female=0, male=1
            var gA = (mA && mA.gender === 'female') ? 0 : 1;
            var gB = (mB && mB.gender === 'female') ? 0 : 1;
            if (gA !== gB) return gA - gB;
            // 同性別内は学年順
            var grA = mA ? (gradeOrder[mA.grade] !== undefined ? gradeOrder[mA.grade] : 99) : 99;
            var grB = mB ? (gradeOrder[mB.grade] !== undefined ? gradeOrder[mB.grade] : 99) : 99;
            return grA - grB;
        });

        // スタッフも重複なしで準備（重複排除）
        var seenStaff = new Set();
        var uniqueStaff = staffMembers.filter(function(n) {
            if (seenStaff.has(n)) return false;
            seenStaff.add(n);
            return true;
        });

        // ── Step2: 各車の利用可能座席数を計算し、配置先リストを作成 ──
        // carSeatsList[carIdx] = [{ type, index }, ...]
        var carSeatsList = drivers.map(function(driver) {
            var list = [];
            for (var i = 0; i < (driver.frontSeat || 0); i++) list.push({ type: '助手席', index: i });
            for (var i = 0; i < (driver.middleSeat || 0); i++) list.push({ type: '中列', index: i });
            for (var i = 0; i < (driver.backSeat || 0); i++) list.push({ type: '後列', index: i });
            return list;
        });

        // ── Step3: スタッフを各車に先行配置（各車1名まで、助手席優先）──
        var carSeatsAssigned = drivers.map(function() { return { '助手席': {}, '中列': {}, '後列': {} }; });
        var staffIdx = 0;
        drivers.forEach(function(driver, ci) {
            if (staffIdx >= uniqueStaff.length) return;
            var frontSeats = carSeatsList[ci].filter(function(s) { return s.type === '助手席'; });
            if (frontSeats.length > 0) {
                carSeatsAssigned[ci]['助手席'][frontSeats[0].index] = uniqueStaff[staffIdx++];
                // 使用済み座席をリストから除去
                carSeatsList[ci] = carSeatsList[ci].filter(function(s) {
                    return !(s.type === '助手席' && s.index === frontSeats[0].index);
                });
            }
        });

        // ── Step4: 同学年グループ単位で各車に割り当て（同学年は同じ車に集める）──
        var gradeOrder2 = { '年少': 0, '年中': 1, '年長': 2, '1': 3, '2': 4, '3': 5, '4': 6, '5': 7, '6': 8 };

        // 選手を学年別にグループ化
        var gradeGroups = {};
        sortedPlayers.forEach(function(name) {
            var m = app.Carpool.members.find(function(x) { return x.name === name; });
            var grade = m ? (m.grade || '_') : '_';
            if (!gradeGroups[grade]) gradeGroups[grade] = [];
            gradeGroups[grade].push(name);
        });

        var sortedGrades = Object.keys(gradeGroups).sort(function(a, b) {
            return (gradeOrder2[a] !== undefined ? gradeOrder2[a] : 99) -
                   (gradeOrder2[b] !== undefined ? gradeOrder2[b] : 99);
        });

        var carIdx = 0;
        var unassigned = [];

        if (carSeatsList.every(function(l) { return l.length === 0; })) {
            console.log('空き座席がありません。選手の割り当てをスキップします');
            unassigned = sortedPlayers.slice();
        } else {
            sortedGrades.forEach(function(grade) {
                var players = gradeGroups[grade];
                // この学年グループが次の車に全員収まるなら次の車へ移動（同学年をまとめる）
                if (carIdx < carSeatsList.length - 1) {
                    var remaining = carSeatsList[carIdx].length;
                    var nextRemaining = carSeatsList[carIdx + 1].length;
                    if (remaining < players.length && nextRemaining >= players.length) {
                        carIdx++;
                    }
                }
                players.forEach(function(playerName) {
                    var placed = false;
                    while (carIdx < carSeatsList.length && !placed) {
                        if (carSeatsList[carIdx].length > 0) {
                            // 座席位置はランダム（同学年は同じ車内でシャッフル）
                            var ri = Math.floor(Math.random() * carSeatsList[carIdx].length);
                            var slot = carSeatsList[carIdx].splice(ri, 1)[0];
                            carSeatsAssigned[carIdx][slot.type][slot.index] = playerName;
                            placed = true;
                        } else {
                            carIdx++;
                        }
                    }
                    if (!placed) unassigned.push(playerName);
                });
            });
        }

        // ── Step5: 結果を保存 ──
        drivers.forEach(function(driver, ci) {
            app.Carpool.appData.assignments.push({
                carIndex: ci,
                driver: driver.parent,
                seats: carSeatsAssigned[ci]
            });
        });

        // targetPlayers を残り分に更新（通知用）
        targetPlayers = unassigned;
        
        // データ保存とUI更新
        app.Carpool.saveData();
        this.updateAssignments();
        
        // 割り当てられなかった選手がいれば通知
        if (targetPlayers.length > 0) {
            UI.showAlert(`注意: ${targetPlayers.length}名のメンバーに乗車スペースがありません。必要に応じて手動で調整してください。`);
            console.log(`未割り当てのメンバー: ${targetPlayers.length}人`);
        } else {
            UI.showAlert('乗車割り当てが完了しました！');
            console.log('すべてのメンバーの割り当てが完了しました');
        }
    };
    
    /**
     * 割り当て結果の保存
     */
    Assignment.saveAssignments = function() {
        console.log('割り当て結果を保存します...');
        
        // 現在の割り当て状態を取得
        const carLayouts = document.querySelectorAll('.car-layout');
        const assignments = [];
        
        carLayouts.forEach(carLayout => {
            const carIndex = parseInt(carLayout.dataset.carIndex);
            const seats = {
                '助手席': {},
                '中列': {},
                '後列': {}
            };
            
            // 各座席の情報を取得
            const seatElements = carLayout.querySelectorAll('.seat:not(.driver-seat)');
            seatElements.forEach(seat => {
                const seatType = seat.dataset.seatType;
                const seatIndex = seat.dataset.seatIndex;
                const person = seat.dataset.person;
                
                if (person) {
                    seats[seatType][seatIndex] = person;
                }
            });
            
            // 運転手を取得
            const driverSeat = carLayout.querySelector('.seat.driver-seat');
            const driver = driverSeat ? driverSeat.dataset.person : '';
            
            assignments.push({
                carIndex,
                driver,
                seats
            });
        });
        
        // 割り当て結果を保存
        app.Carpool.appData.assignments = assignments;
        
        // データ保存
        app.Carpool.saveData();
        
        console.log(`割り当て結果を保存しました: ${assignments.length}台`);
    };
    
    /**
     * 割り当て結果の共有
     */
    Assignment.shareAssignments = function() {
        console.log('割り当て結果を共有します...');
        
        // 割り当て結果をテキスト形式で生成
        let message = '【乗車割り当て】\n';
        
        // イベント情報を取得
        const event = Storage.getSelectedEvent();
        if (event) {
            message += `${Utils.formatDateForDisplay(event.date)} ${event.title}\n\n`;
        }
        
        const assignments = app.Carpool.appData.assignments;
        const carRegistrations = app.Carpool.appData.carRegistrations;
        
        if (assignments && assignments.length > 0) {
            assignments.forEach((assignment, index) => {
                message += `■ ${assignment.driver}の車\n`;
                
                // 各座席タイプごとに乗車メンバーを表示
                Object.keys(assignment.seats).forEach(seatType => {
                    const seatIndices = Object.keys(assignment.seats[seatType]);
                    if (seatIndices.length === 0) return;
                    
                    message += `  ${seatType}: `;
                    
                    const passengers = seatIndices.map(seatIndex => {
                        return assignment.seats[seatType][seatIndex];
                    }).filter(Boolean);
                    
                    message += passengers.join(', ') + '\n';
                });
                
                message += '\n';
            });
        } else {
            message += '配車割り当てが設定されていません。';
        }
        
        // 出欠確認・割り当てページのURLを追加
        var baseUrl = window.location.origin;
        message += '\n\n▼ 出欠確認:\n' + baseUrl + '/carpool/attendance.html';
        message += '\n▼ 座席割り当て:\n' + baseUrl + '/carpool/assignments.html';
        message += '\n\n※リンクはSafari/Chromeで開いてください（LINEブラウザ非対応）';

        // テキストをクリップボードにコピー
        if (Utils.copyToClipboard(message)) {
            UI.showAlert('配車情報をクリップボードにコピーしました。LINEなどに貼り付けて共有できます。');

            // LINEでの共有（モバイルのみ）
            if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                var lineUrl = 'https://line.me/R/msg/text/?' + encodeURIComponent(message);
                window.location.href = lineUrl;
            }
        } else {
            UI.showAlert('クリップボードへのコピーに失敗しました');
        }
        
        console.log('割り当て結果の共有が完了しました');
    };
    
})(window.FCOjima);/**
 * FC尾島ジュニア - 割り当てタブの機能
 * 乗車割り当てに関する機能を提供
 */

FCOjima.Carpool = FCOjima.Carpool || {};
FCOjima.Carpool.Assignment = FCOjima.Carpool.Assignment || {};

(function(app) {
    // 名前空間のショートカット
    var Assignment = app.Carpool.Assignment;
    var UI = app.UI;
    var Utils = app.Utils;
    var Storage = app.Storage;

    // タッチドラッグ内部状態
    var _td = { el: null, ghost: null, data: null, x: 0, y: 0, on: false };

    /**
     * タッチドラッグ&ドロップ初期化
     * @param {HTMLElement} el - ドラッグ元要素
     * @param {Function|Object} dataFn - ドラッグデータ（関数の場合は呼び出し時に評価）
     */
    Assignment.initTouchDrag = function(el, dataFn) {
        el.addEventListener('touchstart', function(e) {
            var d = typeof dataFn === 'function' ? dataFn() : dataFn;
            if (!d) return;
            _td = { el: el, ghost: null, data: d, x: e.touches[0].clientX, y: e.touches[0].clientY, on: false };
        }, { passive: true });

        el.addEventListener('touchmove', function(e) {
            if (_td.el !== el) return;
            var t = e.touches[0], dx = t.clientX - _td.x, dy = t.clientY - _td.y;
            if (!_td.on) {
                if (Math.sqrt(dx * dx + dy * dy) < 8) return;
                _td.on = true;
                var g = el.cloneNode(true);
                g.style.cssText = 'position:fixed;opacity:0.75;pointer-events:none;z-index:9999;transition:none;';
                g.style.width = el.offsetWidth + 'px';
                document.body.appendChild(g);
                _td.ghost = g;
                el.classList.add('dragging');
            }
            e.preventDefault();
            var g = _td.ghost;
            g.style.left = (t.clientX - g.offsetWidth / 2) + 'px';
            g.style.top = (t.clientY - g.offsetHeight / 2) + 'px';
            g.style.display = 'none';
            var below = document.elementFromPoint(t.clientX, t.clientY);
            g.style.display = '';
            document.querySelectorAll('.seat.dragover').forEach(function(s) { s.classList.remove('dragover'); });
            var dropSeat = below && below.closest && below.closest('.seat:not(.driver-seat)');
            if (dropSeat) dropSeat.classList.add('dragover');
        }, { passive: false });

        el.addEventListener('touchend', function(e) {
            if (_td.el !== el) return;
            document.querySelectorAll('.seat.dragover').forEach(function(s) { s.classList.remove('dragover'); });
            if (!_td.on) { _td = { el: null, ghost: null, data: null, x: 0, y: 0, on: false }; return; }
            var t = e.changedTouches[0];
            if (_td.ghost) _td.ghost.style.display = 'none';
            var below = document.elementFromPoint(t.clientX, t.clientY);
            if (_td.ghost) { _td.ghost.remove(); _td.ghost = null; }
            el.classList.remove('dragging');
            var dropSeat = below && below.closest && below.closest('.seat:not(.driver-seat)');
            var backToList = below && below.closest && below.closest('#members-container');
            var d = _td.data;
            _td = { el: null, ghost: null, data: null, x: 0, y: 0, on: false };
            if (dropSeat && d) {
                if (d.type === 'member') {
                    Assignment.setSeatOccupant(dropSeat, d.name);
                    Assignment.saveAssignments();
                    Assignment.updateMembersList();
                } else if (d.type === 'seat') {
                    Assignment.handleSeatExchange(
                        d.fromCarIndex, d.fromSeatType, d.fromSeatIndex,
                        dropSeat.dataset.carIndex, dropSeat.dataset.seatType, dropSeat.dataset.seatIndex
                    );
                    Assignment.saveAssignments();
                    Assignment.updateMembersList();
                }
            } else if (backToList && d && d.type === 'seat') {
                var seat = document.querySelector(
                    '.seat[data-car-index="' + d.fromCarIndex + '"][data-seat-type="' + d.fromSeatType + '"][data-seat-index="' + d.fromSeatIndex + '"]'
                );
                if (seat) { Assignment.clearSeat(seat); Assignment.saveAssignments(); Assignment.updateMembersList(); }
            }
        });
    };

    /**
     * 割り当て機能の初期化
     */
    Assignment.init = async function() {
        console.log('割り当て機能を初期化しています...');

        // メンバーをロード（Firestore優先 → localStorageフォールバック）
        if (window.FCOjima && FCOjima.DB && FCOjima.DB.loadMembers) {
            try {
                app.Carpool.members = await FCOjima.DB.loadMembers();
                console.log('メンバーをFirestoreからロードしました: ' + app.Carpool.members.length + '人');
            } catch (e) {
                console.warn('Firestoreメンバーロード失敗、localStorageにフォールバック:', e);
                app.Carpool.loadMembers();
            }
        } else {
            app.Carpool.loadMembers();
        }

        // イベントデータをロード（Firestore優先 → localStorage フォールバック → Firestore移行）
        var event = Storage.getSelectedEvent();
        if (event) {
            app.Carpool.appData.eventId = event.id;
            var firestoreLoaded = false;
            if (window.FCOjima && FCOjima.DB && FCOjima.DB.loadEventData) {
                try {
                    var data = await FCOjima.DB.loadEventData(event.id);
                    // Firestoreにデータがある場合（ドキュメントが存在する）はそれを使う
                    if (data) {
                        app.Carpool.appData.carRegistrations = data.carRegistrations || [];
                        app.Carpool.appData.assignments     = data.assignments     || [];
                        app.Carpool.appData.attendance      = data.attendance      || [];
                        app.Carpool.appData.notifications   = data.notifications   || [];
                        firestoreLoaded = true;
                        console.log('イベントデータをFirestoreからロードしました: 車両=' + app.Carpool.appData.carRegistrations.length + '台');
                    }
                } catch (e) {
                    console.warn('Firestoreイベントデータロード失敗:', e);
                }
            }
            if (!firestoreLoaded) {
                // localStorageからロード（既存データを引き継ぐ）
                app.Carpool.loadData();
                console.log('localStorageからイベントデータをロードしました: 車両=' + app.Carpool.appData.carRegistrations.length + '台');
                // localStorageのデータがある場合はFirestoreに移行
                if (app.Carpool.appData.carRegistrations.length > 0 &&
                    window.FCOjima && FCOjima.DB && FCOjima.DB.saveEventData) {
                    var migrateData = {
                        carRegistrations: app.Carpool.appData.carRegistrations,
                        assignments:      app.Carpool.appData.assignments,
                        attendance:       app.Carpool.appData.attendance,
                        notifications:    app.Carpool.appData.notifications
                    };
                    FCOjima.DB.saveEventData(event.id, migrateData)
                        .then(function() { console.log('localStorageデータをFirestoreに移行完了'); })
                        .catch(function(e) { console.warn('Firestore移行失敗:', e); });
                }
            }
        }

        // イベント情報を表示
        this.updateEventInfo();

        // 割り当て一覧を更新
        this.updateAssignments();

        // イベントリスナーの設定
        this.setupEventListeners();

        console.log('割り当て機能の初期化が完了しました');
    };
    
    /**
     * イベントリスナーの設定
     */
    Assignment.setupEventListeners = function() {
        console.log('割り当てのイベントリスナーを設定しています...');
        
        // ランダム割り当てボタン
        var generateRandomButton = document.getElementById('generate-random');
        if (generateRandomButton) {
            generateRandomButton.addEventListener('click', function() {
                Assignment.generateRandomAssignments();
            });
        }
        
        // 割り当て保存ボタン
        var saveAssignmentsButton = document.getElementById('save-assignments');
        if (saveAssignmentsButton) {
            saveAssignmentsButton.addEventListener('click', function() {
                Assignment.saveAssignments();
            });
        }
        
        // 割り当て共有ボタン
        var shareAssignmentsButton = document.getElementById('share-assignments');
        if (shareAssignmentsButton) {
            shareAssignmentsButton.addEventListener('click', function() {
                Assignment.shareAssignments();
            });
        }
        
        // 座席編集モーダルの保存ボタン
        var seatEditForm = document.getElementById('seat-edit-form');
        if (seatEditForm) {
            seatEditForm.addEventListener('submit', function(e) {
                e.preventDefault();
                Assignment.saveSeatEdit();
            });
        }
        
        // 座席クリアボタン
        var clearSeatButton = document.getElementById('clear-seat');
        if (clearSeatButton) {
            clearSeatButton.addEventListener('click', function() {
                Assignment.clearSelectedSeat();
            });
        }

        // キャンセルボタン（座席編集）
        var cancelSeatBtn = document.getElementById('cancel-seat-edit');
        if (cancelSeatBtn) {
            cancelSeatBtn.addEventListener('click', function() {
                UI.closeModal('seat-edit-modal');
            });
        }

        // リセットボタン
        var resetBtn = document.getElementById('reset-assignments');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                Assignment.resetAllAssignments();
            });
        }

        // 座席数変更モーダル：キャンセルボタン
        var cancelSeatCountBtn = document.getElementById('cancel-seat-count');
        if (cancelSeatCountBtn) {
            cancelSeatCountBtn.addEventListener('click', function() {
                UI.closeModal('seat-count-modal');
            });
        }

        // 座席数変更モーダル：確定ボタン
        var applySeatCountBtn = document.getElementById('apply-seat-count');
        if (applySeatCountBtn) {
            applySeatCountBtn.addEventListener('click', function() {
                var modal = document.getElementById('seat-count-modal');
                var carIndex = parseInt(modal.dataset.carIndex, 10);
                var availableCars = (app.Carpool.appData.carRegistrations || []).filter(function(c) {
                    return c.canDrive !== 'no';
                });
                var car = availableCars[carIndex];
                if (!car) { UI.closeModal('seat-count-modal'); return; }

                modal.querySelectorAll('[data-key]').forEach(function(span) {
                    car[span.dataset.key] = parseInt(span.dataset.value, 10) || 0;
                });

                app.Carpool.saveData();
                UI.closeModal('seat-count-modal');
                Assignment.updateAssignments();
            });
        }

        // 運転手変更モーダル：キャンセルボタン
        var cancelDriverBtn = document.getElementById('cancel-driver-edit');
        if (cancelDriverBtn) {
            cancelDriverBtn.addEventListener('click', function() {
                UI.closeModal('driver-edit-modal');
            });
        }

        // メンバーコンテナへのドロップ（座席 → メンバーリストに戻す）
        // ここに設定することでsetupDragAndDropが複数回呼ばれても重複しない
        var membersContainer = document.getElementById('members-container');
        if (membersContainer) {
            membersContainer.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            membersContainer.addEventListener('drop', function(e) {
                e.preventDefault();
                try {
                    const jsonData = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (jsonData.type === 'seat') {
                        const seat = document.querySelector(
                            `.seat[data-car-index="${jsonData.fromCarIndex}"][data-seat-type="${jsonData.fromSeatType}"][data-seat-index="${jsonData.fromSeatIndex}"]`
                        );
                        if (seat) {
                            Assignment.clearSeat(seat);
                            Assignment.saveAssignments();
                            Assignment.updateMembersList();
                        }
                    }
                } catch (err) {
                    console.error('ドロップデータの解析に失敗しました', err);
                }
            });
        }

        console.log('割り当てのイベントリスナー設定が完了しました');
    };
    
    /**
     * イベント情報を表示
     */
    Assignment.updateEventInfo = function() {
        console.log('イベント情報を表示します...');

        const eventInfo = document.getElementById('assignment-event-info');
        if (!eventInfo) {
            console.log('イベント情報表示領域が見つかりません');
            return;
        }

        const event = Storage.getSelectedEvent();
        if (!event) {
            eventInfo.innerHTML = '<div class="alert alert-info">ℹ️ イベントが選択されていません。<br><br><a href="../hub/index.html" style="display:inline-block;margin-top:6px;padding:8px 16px;background:#E8A200;color:#1C1600;border-radius:4px;text-decoration:none;font-weight:bold;">HUBからイベントを選択 →</a></div>';
            console.log('選択されたイベントがありません');
            return;
        }
        
        // イベントタイプのクラスを付与
        eventInfo.className = `event-summary ${event.type || 'other'}`;
        
        // イベント情報を表示
        eventInfo.innerHTML = `
            <strong>${UI.escapeHTML(event.title)}</strong>
            (${Utils.formatDateForDisplay(event.date)} ${event.startTime || ''})
        `;
        
        console.log('イベント情報の表示が完了しました');
    };
    
    /**
     * 割り当て一覧を更新
     */
    Assignment.updateAssignments = function() {
        console.log('割り当て一覧を更新しています...');
        
        const carsContainer = document.getElementById('cars-container');
        if (!carsContainer) {
            console.log('車両コンテナが見つかりません');
            return;
        }
        
        carsContainer.innerHTML = '';
        
        const carRegistrations = app.Carpool.appData.carRegistrations;
        
        if (!carRegistrations || carRegistrations.length === 0) {
            carsContainer.innerHTML = '<div class="alert alert-info">ℹ️ 車両登録がありません。<br><br><a href="cars.html" style="display:inline-block;margin-top:6px;padding:8px 16px;background:#E8A200;color:#1C1600;border-radius:4px;text-decoration:none;font-weight:bold;">車提供タブで登録する →</a></div>';
            console.log('車両登録がありません');
            // 車両がなくてもメンバーリストは更新する
            this.updateMembersList();
            return;
        }

        // 車両提供者のみフィルタリング
        const availableCars = carRegistrations.filter(car => car.canDrive !== 'no');

        if (availableCars.length === 0) {
            carsContainer.innerHTML = '<div class="alert alert-info">ℹ️ 車両提供可能な登録がありません。<br><br><a href="cars.html" style="display:inline-block;margin-top:6px;padding:8px 16px;background:#E8A200;color:#1C1600;border-radius:4px;text-decoration:none;font-weight:bold;">車提供タブで変更する →</a></div>';
            console.log('車両提供可能な登録がありません');
            // 車両がなくてもメンバーリストは更新する
            this.updateMembersList();
            return;
        }
        
        console.log(`利用可能な車両数: ${availableCars.length}台`);
        
        // 既存の配置データを取得
        const existingAssignments = app.Carpool.appData.assignments || [];
        
        // 車両ごとに配置レイアウトを作成
        availableCars.forEach((car, carIndex) => {
            const carLayout = this.createCarLayout(car, carIndex, existingAssignments);
            carsContainer.appendChild(carLayout);
        });
        
        // メンバーリストを更新
        this.updateMembersList();
        
        // ドラッグ＆ドロップのセットアップ
        this.setupDragAndDrop();
        
        console.log('割り当て一覧の更新が完了しました');
    };
    
    /**
     * 車両レイアウトを作成
     * @param {Object} car - 車両情報
     * @param {number} carIndex - 車両インデックス
     * @param {Array} existingAssignments - 既存の配置データ
     * @returns {HTMLElement} 車両レイアウト要素
     */
    Assignment.createCarLayout = function(car, carIndex, existingAssignments) {
        // 車両レイアウトのコンテナ
        const carLayout = document.createElement('div');
        carLayout.className = 'car-layout';
        carLayout.dataset.carIndex = carIndex;
        
        // 車両ヘッダー（クリックで運転手変更 — 運転手座席アイコンでも変更可）
        const carHeader = document.createElement('div');
        carHeader.className = 'car-header';
        carHeader.textContent = `${car.parent}の車 ✏`;
        carHeader.title = '運転手アイコンをタップして変更';
        carLayout.appendChild(carHeader);
        
        // 車両詳細情報
        const carInfo = document.createElement('div');
        carInfo.className = 'car-info';
        carInfo.innerHTML = `
            <div class="car-info-item">提供: ${this.getProvideTypeLabel(car.canDrive)}</div>
            ${car.notes ? '<div class="car-info-item">備考: ' + UI.escapeHTML(car.notes) + '</div>' : ''}
        `;
        carLayout.appendChild(carInfo);

        // 座席数変更ボタン（タップでモーダルを開く）
        var seatCountBtn = document.createElement('button');
        seatCountBtn.className = 'seat-count-change-btn';
        seatCountBtn.type = 'button';
        var seatSummary = [
            car.frontSeat ? '助手席×' + car.frontSeat : null,
            car.middleSeat ? '中列×' + car.middleSeat : null,
            car.backSeat ? '後列×' + car.backSeat : null
        ].filter(Boolean).join('　');
        seatCountBtn.textContent = '座席数変更　' + (seatSummary || '未設定');
        seatCountBtn.addEventListener('click', (function(ci) {
            return function(e) { e.stopPropagation(); Assignment.openSeatCountModal(ci); };
        })(carIndex));
        carLayout.appendChild(seatCountBtn);
        
        // 車両座席レイアウト
        const carSeatLayout = document.createElement('div');
        carSeatLayout.className = 'car-seat-layout';
        
        // 車の表現（上から見た図）を作成
        const carView = document.createElement('div');
        carView.className = 'car-top-view';
        
        // 前列：助手席（左）+ 運転席（右）を同じ行に並べる（右ハンドル車）
        const driverRow = document.createElement('div');
        driverRow.className = 'seat-row driver-row';

        // 助手席を左側に配置
        const frontCount = car.frontSeat || 0;
        for (let i = 0; i < frontCount; i++) {
            const seat = this.createSeat('助手席', i, carIndex);
            driverRow.appendChild(seat);
        }
        // 助手席ゼロの場合はスペーサーで運転席を右端に寄せる
        if (frontCount === 0) {
            const spacer = document.createElement('div');
            spacer.className = 'seat-spacer';
            driverRow.appendChild(spacer);
        }

        // 運転席を右側に配置
        const driverSeat = this.createDriverSeat(car.parent, carIndex);
        driverRow.appendChild(driverSeat);

        carView.appendChild(driverRow);
        
        // 中列
        if (car.middleSeat > 0) {
            const middleRow = document.createElement('div');
            middleRow.className = 'seat-row middle-row';
            
            for (let i = 0; i < car.middleSeat; i++) {
                const seat = this.createSeat('中列', i, carIndex);
                middleRow.appendChild(seat);
            }
            
            carView.appendChild(middleRow);
        }
        
        // 後列
        if (car.backSeat > 0) {
            const backRow = document.createElement('div');
            backRow.className = 'seat-row back-row';
            
            for (let i = 0; i < car.backSeat; i++) {
                const seat = this.createSeat('後列', i, carIndex);
                backRow.appendChild(seat);
            }
            
            carView.appendChild(backRow);
        }
        
        carSeatLayout.appendChild(carView);
        carLayout.appendChild(carSeatLayout);
        
        // 既存の配置データを反映
        const carAssignment = existingAssignments.find(a => a.carIndex === carIndex);
        if (carAssignment && carAssignment.seats) {
            Object.keys(carAssignment.seats).forEach(seatType => {
                const seatIndices = Object.keys(carAssignment.seats[seatType]);
                
                seatIndices.forEach(seatIndex => {
                    const person = carAssignment.seats[seatType][seatIndex];
                    if (person) {
                        const seat = carLayout.querySelector(`.seat[data-seat-type="${seatType}"][data-seat-index="${seatIndex}"]`);
                        if (seat) {
                            this.setSeatOccupant(seat, person);
                        }
                    }
                });
            });
        }
        
        return carLayout;
    };
    
    /**
     * 運転席を作成
     * @param {string} driverName - 運転者名
     * @param {number} carIndex - 車両インデックス
     * @returns {HTMLElement} 運転席要素
     */
    Assignment.createDriverSeat = function(driverName, carIndex) {
        const driverSeat = document.createElement('div');
        driverSeat.className = 'seat driver-seat';
        driverSeat.dataset.seatType = 'driver';
        driverSeat.dataset.carIndex = carIndex;
        driverSeat.dataset.person = driverName;
        driverSeat.title = 'タップして運転手を変更';

        const icon = document.createElement('div');
        icon.className = 'member-icon driver-icon';
        icon.textContent = this.getNameInitials(driverName);
        icon.dataset.name = driverName;

        const label = document.createElement('div');
        label.className = 'seat-label';
        label.textContent = '運転手 ✏';

        driverSeat.appendChild(icon);
        driverSeat.appendChild(label);

        // タップ/クリックで運転手変更モーダルを開く
        driverSeat.addEventListener('click', (function(ci) {
            return function(e) {
                e.stopPropagation();
                Assignment.editCarDriver(ci);
            };
        })(carIndex));

        driverSeat.draggable = true;
        driverSeat.addEventListener('dragstart', this.handleDragStart.bind(this));

        return driverSeat;
    };
    
    /**
     * 座席を作成
     * @param {string} seatType - 座席タイプ（助手席/中列/後列）
     * @param {number} seatIndex - 座席インデックス
     * @param {number} carIndex - 車両インデックス
     * @returns {HTMLElement} 座席要素
     */
    Assignment.createSeat = function(seatType, seatIndex, carIndex) {
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.dataset.seatType = seatType;
        seat.dataset.seatIndex = seatIndex;
        seat.dataset.carIndex = carIndex;
        
        const label = document.createElement('div');
        label.className = 'seat-label';
        label.textContent = `${seatType} ${seatIndex + 1}`;
        
        seat.appendChild(label);
        
        // 座席クリック時の処理（PCクリック・モバイルタップ両対応）
        seat.addEventListener('click', () => {
            this.openSeatEditModal(seat);
        });

        // HTML5ドラッグ（PC）
        seat.draggable = true;
        seat.addEventListener('dragstart', Assignment.handleDragStart.bind(Assignment));
        seat.addEventListener('dragend', function() { this.classList.remove('dragging'); });

        // タッチドラッグ（スマホ）
        Assignment.initTouchDrag(seat, function() {
            if (!seat.dataset.person) return null;
            return {
                type: 'seat',
                name: seat.dataset.person,
                fromCarIndex: seat.dataset.carIndex,
                fromSeatType: seat.dataset.seatType,
                fromSeatIndex: seat.dataset.seatIndex
            };
        });

        return seat;
    };
    
    /**
     * 座席に乗車メンバーを設定
     * @param {HTMLElement} seat - 座席要素
     * @param {string} personName - 乗車メンバー名
     */
    Assignment.setSeatOccupant = function(seat, personName) {
        seat.classList.add('filled');
        seat.dataset.person = personName;

        // 既存の表示要素をクリア
        ['member-icon', 'seat-name-tag', 'seat-clear-btn'].forEach(function(cls) {
            var el = seat.querySelector('.' + cls);
            if (el) el.remove();
        });

        // メンバー情報を取得
        var member = app.Carpool.members.find(function(m) { return m.name === personName; });
        var displayName = member ? ((member.abbr != null && member.abbr !== '') ? member.abbr : member.name) : (personName.length > 4 ? personName.substring(0, 4) : personName);
        var gc = (member && member.role === 'player') ? Assignment.getGradeColor(member.grade) : null;

        // 学年色で座席背景を薄く色づけ
        seat.style.background = gc ? Assignment._hexToRgba(gc, 0.12) : '';

        // × 解除ボタン（座席左上）
        var clearBtn = document.createElement('button');
        clearBtn.className = 'seat-clear-btn';
        clearBtn.textContent = '×';
        clearBtn.title = '座席から外す';
        clearBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            Assignment.clearSeat(seat);
            Assignment.saveAssignments();
            Assignment.updateMembersList();
        });
        seat.insertBefore(clearBtn, seat.firstChild);

        // 名前タグ（丸なし、abbr優先）
        var nameTag = document.createElement('div');
        nameTag.className = 'seat-name-tag';
        nameTag.textContent = displayName;
        nameTag.title = personName;
        if (gc) nameTag.style.color = gc;
        seat.insertBefore(nameTag, clearBtn.nextSibling);
    };

    /** hex色をrgba文字列に変換 */
    Assignment._hexToRgba = function(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    };
    
    /**
     * 名前からイニシャルを取得
     * @param {string} name - 名前
     * @returns {string} イニシャル（最大2文字）
     */
    Assignment.getNameInitials = function(name) {
        if (!name) return '';
        
        // 名前を分割（空白または記号で区切る）
        const parts = name.split(/[\s\-_,\.]/);
        
        if (parts.length > 1) {
            // 複数の部分があれば、最初の部分の最初の文字と次の部分の最初の文字
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        } else {
            // 単一の名前の場合は、最初の1〜2文字
            return name.substring(0, 2);
        }
    };
    
    /**
     * 提供タイプのラベルを取得
     * @param {string} type - 提供タイプ
     * @returns {string} ラベル
     */
    /**
     * 学年に対応する色を返す
     * @param {string|null} grade - 学年（'1'〜'6', '年少'等）
     * @returns {string|null} CSSカラー文字列
     */
    Assignment.getGradeColor = function(grade) {
        var colors = {
            '1': '#e74c3c',
            '2': '#e67e22',
            '3': '#27ae60',
            '4': '#16a085',
            '5': '#2980b9',
            '6': '#8e44ad',
            '年少': '#95a5a6',
            '年中': '#7f8c8d',
            '年長': '#636e72'
        };
        return colors[grade] || null;
    };

    Assignment.getProvideTypeLabel = function(type) {
        const types = {
            'both': '行き帰り可能',
            'no': '不可',
            'to': '行きのみ可能',
            'from': '帰りのみ可能'
        };
        
        return types[type] || type;
    };
    
    /**
     * メンバーリストを更新
     */
    Assignment.updateMembersList = function() {
        console.log('メンバーリストを更新しています...');
        
        const membersContainer = document.getElementById('members-container');
        if (!membersContainer) {
            console.log('メンバーコンテナが見つかりません');
            return;
        }
        
        membersContainer.innerHTML = '';
        
        // イベントの対象学年を取得
        const event = Storage.getSelectedEvent();
        let targetGrades = [];
        
        if (event && event.target && event.target.length > 0) {
            targetGrades = event.target;
            console.log(`対象学年: ${targetGrades.join(', ')}`);
        } else {
            console.log('対象学年が指定されていません');
        }
        
        // 対象学年のメンバーと監督・コーチをフィルタリング
        let filteredMembers = [];
        const members = app.Carpool.members;
        
        // 監督・コーチは常に表示
        const staffMembers = members.filter(m => m.role === 'coach' || m.role === 'assist');
        filteredMembers = [...staffMembers];
        
        // 対象学年の選手を追加
        if (targetGrades.length > 0) {
            const targetPlayers = members.filter(m =>
                m.role === 'player' &&
                m.grade &&
                targetGrades.includes(m.grade)
            );
            filteredMembers = [...filteredMembers, ...targetPlayers];
        } else {
            // 対象学年が指定されていない場合は全選手
            const allPlayers = members.filter(m => m.role === 'player');
            filteredMembers = [...filteredMembers, ...allPlayers];
        }

        // 学年外追加選手を追加（重複を除く）
        if (event && event.extraPlayers && event.extraPlayers.length > 0) {
            const existingNames = new Set(filteredMembers.map(m => m.name));
            event.extraPlayers.forEach(name => {
                if (!existingNames.has(name)) {
                    const m = members.find(m => m.name === name);
                    if (m) {
                        filteredMembers.push(m);
                        existingNames.add(name);
                    }
                }
            });
        }

        // 出欠で参加確定している選手の保護者を追加
        const attendance = app.Carpool.appData.attendance;
        if (attendance && attendance.length > 0) {
            const presentPlayerNames = attendance
                .filter(a => a.status === 'present')
                .map(a => a.name);

            // presentPlayerNames に対応する選手IDを取得
            const presentPlayerIds = new Set(
                members
                    .filter(function(p) { return p.role === 'player' && presentPlayerNames.includes(p.name); })
                    .map(function(p) { return String(p.id); })
            );

            // childrenIds に参加確定選手が含まれる保護者を追加
            const existingNames = new Set(filteredMembers.map(function(m) { return m.name; }));
            const parentMembers = members.filter(function(m) {
                if (m.role !== 'father' && m.role !== 'mother') return false;
                if (existingNames.has(m.name)) return false;
                if (!m.childrenIds || !m.childrenIds.length) return false;
                return m.childrenIds.some(function(cid) { return presentPlayerIds.has(String(cid)); });
            });

            filteredMembers = [...filteredMembers, ...parentMembers];
        }
        
        // 既に座席に配置されているメンバーを除外（ドライバー座席も含む）
        const assignedMembers = [];
        document.querySelectorAll('.seat.filled, .seat.driver-seat').forEach(seat => {
            if (seat.dataset.person) {
                assignedMembers.push(seat.dataset.person);
            }
        });
        
        filteredMembers = filteredMembers.filter(m => 
            !assignedMembers.includes(m.name)
        );
        
        // 重複排除（同じid/nameが複数ある場合）
        var seenKeys = new Set();
        filteredMembers = filteredMembers.filter(function(m) {
            var key = String(m.id || m.name);
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });

        // 荷物アイテムを追加
        filteredMembers.push({
            id: 'luggage',
            name: '荷物',
            role: 'other'
        });
        
        console.log(`配置可能なメンバー数: ${filteredMembers.length}人`);
        
        // メンバーリストに表示
        if (filteredMembers.length === 0) {
            membersContainer.innerHTML = UI.createAlert('info', '配置可能なメンバーがいません。');
            return;
        }
        
        // 役割ごとに分類
        const roleGroups = {
            coach: { title: '監督・コーチ', members: [] },
            player: { title: '選手', members: [] },
            parent: { title: '保護者', members: [] },
            other: { title: 'その他', members: [] }
        };
        
        filteredMembers.forEach(member => {
            if (member.role === 'coach' || member.role === 'assist') {
                roleGroups.coach.members.push(member);
            } else if (member.role === 'player') {
                roleGroups.player.members.push(member);
            } else if (member.role === 'father' || member.role === 'mother') {
                roleGroups.parent.members.push(member);
            } else {
                roleGroups.other.members.push(member);
            }
        });
        
        // 各グループを表示
        Object.values(roleGroups).forEach(group => {
            if (group.members.length === 0) return;
            
            const groupHeader = document.createElement('h3');
            groupHeader.textContent = group.title;
            groupHeader.className = 'member-group-header';
            membersContainer.appendChild(groupHeader);
            
            const membersList = document.createElement('div');
            membersList.className = 'members-list';
            
            group.members.forEach(member => {
                const memberItem = this.createMemberItem(member);
                membersList.appendChild(memberItem);
            });
            
            membersContainer.appendChild(membersList);
        });
        
        console.log('メンバーリストの更新が完了しました');
    };
    
    /**
     * メンバーアイテムを作成
     * @param {Object} member - メンバー情報
     * @returns {HTMLElement} メンバーアイテム要素
     */
    Assignment.createMemberItem = function(member) {
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        memberItem.classList.add(member.role || 'other');
        memberItem.dataset.memberId = member.id;
        memberItem.dataset.name = member.name;

        // 学年バッジ（選手のみ）
        var gc = (member.role === 'player') ? Assignment.getGradeColor(member.grade) : null;
        if (gc) {
            var badge = document.createElement('span');
            badge.className = 'grade-badge';
            badge.style.background = gc;
            badge.textContent = member.grade + '年';
            memberItem.appendChild(badge);
        }

        // 名前（略称優先、丸なし）
        const nameLabel = document.createElement('div');
        nameLabel.className = 'member-name';
        nameLabel.textContent = (member.abbr != null && member.abbr !== '') ? member.abbr : member.name;
        memberItem.appendChild(nameLabel);

        // HTML5ドラッグ（PC）
        memberItem.draggable = true;
        memberItem.addEventListener('dragstart', Assignment.handleDragStart.bind(Assignment));
        memberItem.addEventListener('dragend', function() { this.classList.remove('dragging'); });

        // タッチドラッグ（スマホ）— 関数クロージャで各アイテム固有のデータを保持
        Assignment.initTouchDrag(memberItem, (function(n) {
            return function() { return { type: 'member', name: n }; };
        })(member.name));

        return memberItem;
    };
    
    /**
     * ドラッグ開始ハンドラ
     * @param {DragEvent} e - ドラッグイベント
     */
    Assignment.handleDragStart = function(e) {
        var el = e.currentTarget;
        // 要素がメンバーアイテムの場合
        if (el.classList.contains('member-item')) {
            e.dataTransfer.setData('text/plain', el.dataset.name);
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'member',
                name: el.dataset.name
            }));
            e.dataTransfer.effectAllowed = 'move';
            el.classList.add('dragging');
        }
        // 要素が座席の場合（人が設定されている場合のみ）
        else if (el.classList.contains('seat') && el.dataset.person) {
            e.dataTransfer.setData('text/plain', el.dataset.person);
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'seat',
                name: el.dataset.person,
                fromCarIndex: el.dataset.carIndex,
                fromSeatType: el.dataset.seatType,
                fromSeatIndex: el.dataset.seatIndex
            }));
            e.dataTransfer.effectAllowed = 'move';
            el.classList.add('dragging');
        } else {
            e.preventDefault();
        }
    };
    
    /**
     * ドラッグ＆ドロップのセットアップ
     */
    Assignment.setupDragAndDrop = function() {
        console.log('ドラッグ＆ドロップをセットアップします...');
        
        // 全ての座席要素に対してイベントリスナーを設定
        const seats = document.querySelectorAll('.seat');

        seats.forEach(seat => {
            // 運転席へは専用モーダル経由でのみ変更可（ドラッグ禁止）
            if (seat.classList.contains('driver-seat')) return;

            seat.addEventListener('dragover', function(e) {
                e.preventDefault(); // ドロップを許可
                e.dataTransfer.dropEffect = 'move';
                this.classList.add('dragover');
            });

            seat.addEventListener('dragleave', function(e) {
                this.classList.remove('dragover');
            });

            seat.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('dragover');

                // ドロップされたデータを取得
                const memberName = e.dataTransfer.getData('text/plain');

                try {
                    const jsonData = JSON.parse(e.dataTransfer.getData('application/json'));

                    // 座席データの場合は交換処理
                    if (jsonData.type === 'seat') {
                        Assignment.handleSeatExchange(
                            jsonData.fromCarIndex,
                            jsonData.fromSeatType,
                            jsonData.fromSeatIndex,
                            this.dataset.carIndex,
                            this.dataset.seatType,
                            this.dataset.seatIndex
                        );
                        // 座席移動後はメンバーリストを再描画（空席になった座席の人が一覧に戻る場合がある）
                        Assignment.updateMembersList();
                    } else {
                        // 新規配置
                        Assignment.setSeatOccupant(this, memberName);
                        
                        // 配置データを保存
                        Assignment.saveAssignments();
                        
                        // 配置された人をリストから削除
                        Assignment.updateMembersList();
                    }
                } catch (e) {
                    console.error('ドロップデータの解析に失敗しました', e);
                    
                    // 単純に配置
                    Assignment.setSeatOccupant(this, memberName);
                    
                    // 配置データを保存
                    Assignment.saveAssignments();
                    
                    // 配置された人をリストから削除
                    Assignment.updateMembersList();
                }
            });
        });
        
        console.log('ドラッグ＆ドロップのセットアップが完了しました（メンバーコンテナへのドロップはsetupEventListenersで設定）');
    };
    
    /**
     * 座席交換処理
     * @param {number} fromCarIndex - 元の車両インデックス
     * @param {string} fromSeatType - 元の座席タイプ
     * @param {number} fromSeatIndex - 元の座席インデックス
     * @param {number} toCarIndex - 先の車両インデックス
     * @param {string} toSeatType - 先の座席タイプ
     * @param {number} toSeatIndex - 先の座席インデックス
     */
    Assignment.handleSeatExchange = function(fromCarIndex, fromSeatType, fromSeatIndex, toCarIndex, toSeatType, toSeatIndex) {
        console.log(`座席交換: 車${fromCarIndex}の${fromSeatType}${fromSeatIndex} -> 車${toCarIndex}の${toSeatType}${toSeatIndex}`);
        
        // 元の座席と先の座席を取得
        const fromSeat = document.querySelector(`.seat[data-car-index="${fromCarIndex}"][data-seat-type="${fromSeatType}"][data-seat-index="${fromSeatIndex}"]`);
        const toSeat = document.querySelector(`.seat[data-car-index="${toCarIndex}"][data-seat-type="${toSeatType}"][data-seat-index="${toSeatIndex}"]`);
        
        if (!fromSeat || !toSeat) {
            console.error('座席要素が見つかりません');
            return;
        }
        
        // 交換データの一時保存
        const fromPerson = fromSeat.dataset.person;
        const toPerson = toSeat.dataset.person;
        
        // 両方とも人が設定されていれば交換
        if (fromPerson && toPerson) {
            this.setSeatOccupant(fromSeat, toPerson);
            this.setSeatOccupant(toSeat, fromPerson);
        }
        // 元だけ人が設定されていれば移動
        else if (fromPerson) {
            this.setSeatOccupant(toSeat, fromPerson);
            this.clearSeat(fromSeat);
        }
        // 先だけ人が設定されていれば移動
        else if (toPerson) {
            this.setSeatOccupant(fromSeat, toPerson);
            this.clearSeat(toSeat);
        }
        
        // 配置データを保存
        this.saveAssignments();
    };

    /**
     * 画像をダウンロードする（PC Chrome 対応フォールバック）
     */
    Assignment._downloadImage = function(blob, fileName) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
    };

    /**
     * 全車両の座席割り当てを画像として出力
     * html2canvas でキャプチャし、Web Share API または直接ダウンロード
     */
    Assignment.exportAssignmentsAsImage = function() {
        console.log('画像エクスポートを開始します...');

        if (typeof html2canvas === 'undefined') {
            UI.showAlert('画像出力ライブラリを読み込み中です。少し待って再試行してください。');
            return;
        }

        var carsContainer = document.getElementById('cars-container');
        if (!carsContainer || carsContainer.children.length === 0) {
            UI.showAlert('車両情報が表示されていません。割り当てを保存してから再試行してください。');
            return;
        }

        // 処理中表示
        var exportBtn = document.getElementById('export-image');
        var origText = exportBtn ? exportBtn.textContent : '';
        if (exportBtn) { exportBtn.textContent = '生成中...'; exportBtn.disabled = true; }

        var event = Storage.getSelectedEvent();

        // 画像用幅（スマホ画面幅に関係なく十分な幅を確保）
        var exportWidth = Math.max(window.innerWidth, 800);

        // エクスポート用ラッパー（画面外に配置）
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;top:-9999px;left:0;background:#fff;padding:20px;font-family:sans-serif;box-sizing:border-box;width:' + exportWidth + 'px;';

        // ヘッダー（タイトル）
        var header = document.createElement('div');
        header.style.cssText = 'margin-bottom:12px;padding-bottom:10px;border-bottom:3px solid #E8A200;';
        header.innerHTML = '<div style="font-size:18px;font-weight:bold;color:#E8A200;">FC尾島ジュニア　乗車割り当て</div>';
        wrap.appendChild(header);

        // イベント情報サマリー
        if (event) {
            var infoSection = document.createElement('div');
            infoSection.style.cssText = 'background:#fffbef;border:1px solid #E8A200;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#333;display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;';

            var infoRows = [
                { label: '日時', value: Utils.formatDateForDisplay(event.date) + (event.startTime ? '　' + event.startTime + '〜' : '') },
                { label: 'イベント名', value: event.title || '' },
                { label: '集合時間', value: event.departureTime || '未設定' },
                { label: '集合場所', value: event.meetingPlace || '未設定' },
                { label: '会場', value: event.venue || '未設定' }
            ];

            // 当日参加する指導者（ドライバーまたは座席に配置されたコーチ/アシスト）
            var coachNames = [];
            document.querySelectorAll('.seat.driver-seat, .seat.filled').forEach(function(s) {
                if (!s.dataset.person) return;
                var m = (app.Carpool.members || []).find(function(x) { return x.name === s.dataset.person; });
                if (m && (m.role === 'coach' || m.role === 'assist') && !coachNames.includes(m.name)) {
                    coachNames.push(m.name);
                }
            });
            // ドライバーシートから取得（coach/assistでなくても運転手に登録されているケース）
            if (coachNames.length === 0) {
                var filtered = Assignment.getEventFilteredMembers();
                coachNames = filtered.filter(function(m) { return m.role === 'coach' || m.role === 'assist'; }).map(function(m) { return m.name; });
            }
            infoRows.push({ label: '参加指導者', value: coachNames.length > 0 ? coachNames.join('、') : '未設定' });

            // 参加選手名（座席に配置された選手 + 未配置の対象選手）
            var playerNames = [];
            document.querySelectorAll('.seat.filled').forEach(function(s) {
                if (!s.dataset.person) return;
                var m = (app.Carpool.members || []).find(function(x) { return x.name === s.dataset.person; });
                if (m && m.role === 'player' && !playerNames.includes(m.name)) playerNames.push(m.name);
            });
            infoRows.push({ label: '参加選手', value: playerNames.length > 0 ? playerNames.join('、') : '未設定' });

            infoRows.forEach(function(row) {
                var cell = document.createElement('div');
                cell.style.cssText = 'display:flex;gap:4px;';
                cell.innerHTML = '<span style="color:#E8A200;font-weight:bold;white-space:nowrap;">' + row.label + ':</span><span>' + UI.escapeHTML(String(row.value)) + '</span>';
                infoSection.appendChild(cell);
            });
            wrap.appendChild(infoSection);
        }

        // 実際の cars-container をクローン（見た目をそのまま使う）
        var carsClone = carsContainer.cloneNode(true);
        carsClone.style.cssText = 'overflow:visible;max-height:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;';
        // クローン内のスクロール制限をすべて解除（画像に全車が写るように）
        carsClone.querySelectorAll('*').forEach(function(el) {
            var s = el.style;
            var cs = window.getComputedStyle(el);
            if (cs.overflow === 'hidden' || cs.overflow === 'auto' || cs.overflowY === 'hidden' || cs.overflowY === 'auto') {
                s.overflow = 'visible';
                s.overflowY = 'visible';
            }
            if (cs.maxHeight && cs.maxHeight !== 'none') {
                s.maxHeight = 'none';
            }
            if (cs.height && cs.height !== 'auto' && cs.height.indexOf('calc') !== -1) {
                s.height = 'auto';
            }
        });
        // クローン内の不要なボタン類を非表示
        carsClone.querySelectorAll('.seat-clear-btn, .seat-count-adjuster').forEach(function(el) {
            el.style.display = 'none';
        });
        // 座席・アイコンをやや大きく
        carsClone.querySelectorAll('.seat').forEach(function(s) {
            s.style.minWidth = '72px';
            s.style.minHeight = '72px';
        });
        carsClone.querySelectorAll('.member-icon').forEach(function(ic) {
            ic.style.width = '44px';
            ic.style.height = '44px';
        });
        carsClone.querySelectorAll('.seat-name-tag').forEach(function(t) {
            t.style.fontSize = '12px';
            t.style.padding = '0 6px';
            t.style.whiteSpace = 'normal';
            t.style.wordBreak = 'break-all';
            t.style.overflow = 'visible';
            t.style.textOverflow = 'clip';
        });
        wrap.appendChild(carsClone);

        document.body.appendChild(wrap);

        html2canvas(wrap, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            windowWidth: wrap.scrollWidth,
            windowHeight: wrap.scrollHeight
        }).then(function(canvas) {
            document.body.removeChild(wrap);
            if (exportBtn) { exportBtn.textContent = origText; exportBtn.disabled = false; }
            canvas.toBlob(function(blob) {
                var fileName = '乗車割り当て' + (event ? '_' + event.date : '') + '.png';

                // モバイルのWeb Share API（ファイル共有対応）を試みる
                var canShareFiles = false;
                try {
                    var testFile = new File([blob], fileName, { type: 'image/png' });
                    canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [testFile] }));
                } catch (e) {}

                if (canShareFiles) {
                    var file = new File([blob], fileName, { type: 'image/png' });
                    navigator.share({ title: '乗車割り当て', files: [file] })
                        .catch(function(err) {
                            console.warn('share cancelled or failed:', err);
                            // share失敗時はダウンロードにフォールバック
                            Assignment._downloadImage(blob, fileName);
                        });
                } else {
                    // PC Chrome など：直接ダウンロード
                    Assignment._downloadImage(blob, fileName);
                }
            }, 'image/png');
        }).catch(function(err) {
            if (document.body.contains(wrap)) document.body.removeChild(wrap);
            if (exportBtn) { exportBtn.textContent = origText; exportBtn.disabled = false; }
            console.error('html2canvas エラー:', err);
            UI.showAlert('画像の生成に失敗しました。');
        });
    };
})(window.FCOjima);
