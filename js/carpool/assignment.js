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
        if (!seatEditForm) return;
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

            // イベント対象者でフィルタリング（欠席者はgetEventFilteredMembers内で除外済み）
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
                        badge.textContent = ['年少', '年中', '年長'].includes(member.grade) ? member.grade : member.grade + '年';
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
        if (!seatEditForm) return;
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
        if (!seatEditForm) return;
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
     * イベント対象者でフィルタリングされたメンバーリストを返す。
     * 配車割り当て画面（メンバードック・統計バー・ランダム配置・座席編集モーダル・
     * 共有カード生成）が参照する唯一の対象者算出ロジック。
     *
     * かつてはこの関数と各呼び出し箇所（updateMembersList/updateStatsBar/
     * generateRandomAssignments）がそれぞれ独自に対象者を再計算しており、
     * 互いの条件が少しずつズレていた（例: 自分自身が出欠で参加表明した保護者が
     * ドック一覧には出ないのに統計バーの人数には数えられる、指導者の欠席が
     * 一部の画面でしか反映されない、等）。ここに一本化し、全呼び出し箇所は
     * この関数の結果を加工するだけにする。
     *
     * 対象の定義:
     *  - 監督・コーチ: 常に対象。ただし本人が「欠席」登録していれば除外
     *  - 選手: 対象学年（event.target）または学年外追加選手（event.extraPlayers）のうち、
     *    出欠で「参加」と回答済みの選手のみ（2026-07-20ユーザー指示:
     *    「出欠の確認がとれた選手しか割り当てには表示されない」。未回答・欠席は出さない）
     *  - 保護者（父・母）: 本人が「参加」登録している、または子供が上記の対象選手として
     *    「参加」登録している場合に対象。本人が「欠席」登録していれば除外
     */
    Assignment.getEventFilteredMembers = function() {
        var event = Storage.getSelectedEvent();
        var members = app.Carpool.members || [];
        var attendance = (app.Carpool.appData && app.Carpool.appData.attendance) || [];
        var targetGrades = (event && event.target && event.target.length > 0) ? event.target : [];

        var absentNames = new Set(
            attendance.filter(function(a) { return a.status === 'absent'; }).map(function(a) { return a.name; })
        );
        var presentNames = new Set(
            attendance.filter(function(a) { return a.status === 'present'; }).map(function(a) { return a.name; })
        );

        // スタッフ（監督・コーチ）：本人が欠席登録していれば除外
        var filtered = members.filter(function(m) {
            return (m.role === 'coach' || m.role === 'assist') && !absentNames.has(m.name);
        });

        // 対象学年の選手
        var players;
        if (targetGrades.length > 0) {
            players = members.filter(function(m) {
                return m.role === 'player' && m.grade && targetGrades.some(function(g) { return String(g) === String(m.grade); });
            });
        } else {
            players = members.filter(function(m) { return m.role === 'player'; });
        }
        // 学年外追加選手
        if (event && event.extraPlayers && event.extraPlayers.length > 0) {
            var existingNames = new Set(players.map(function(m) { return m.name; }));
            event.extraPlayers.forEach(function(name) {
                if (!existingNames.has(name)) {
                    var m = members.find(function(x) { return x.name === name; });
                    if (m) { players.push(m); existingNames.add(name); }
                }
            });
        }
        // 出欠「参加」と回答済みの選手のみ残す（未回答・欠席は割り当てに出さない）
        players = players.filter(function(m) { return presentNames.has(m.name); });
        filtered = filtered.concat(players);

        // 参加確定保護者（自分自身が出欠で参加表明 OR 子供が参加確定）。本人が欠席登録していれば除外
        var presentPlayerIds = new Set(
            members
                .filter(function(p) { return p.role === 'player' && presentNames.has(p.name); })
                .map(function(p) { return String(p.id); })
        );
        var existingNames2 = new Set(filtered.map(function(m) { return m.name; }));
        filtered = filtered.concat(members.filter(function(m) {
            if (m.role !== 'father' && m.role !== 'mother') return false;
            if (existingNames2.has(m.name)) return false;
            if (absentNames.has(m.name)) return false;
            // 自分自身が参加表明している
            if (presentNames.has(m.name)) return true;
            // 子供が参加確定している
            if (m.childrenIds && m.childrenIds.length > 0) {
                return m.childrenIds.some(function(cid) { return presentPlayerIds.has(String(cid)); });
            }
            return false;
        }));

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
        if (carNameEl) {
            var driverMemberModal = (app.Carpool.members || []).find(function(m) { return m.name === car.parent; });
            var driverDisplayModal = (driverMemberModal && driverMemberModal.abbr) ? driverMemberModal.abbr : car.parent;
            carNameEl.textContent = driverDisplayModal + '（座席数変更）';
        }

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
            var candidateMembers = (app.Carpool.members || []).filter(function(m) {
                return m.role !== 'player';
            });
            // 手入力ドライバー（メンバーとして登録されていない）も候補に追加
            var memberNameSet = new Set((app.Carpool.members || []).map(function(m) { return m.name; }));
            var carRegs = app.Carpool.appData.carRegistrations || [];
            var seenManual = new Set();
            var extraDriverNames = [];
            carRegs.forEach(function(reg) {
                if (reg.parent && !memberNameSet.has(reg.parent) && !seenManual.has(reg.parent)) {
                    seenManual.add(reg.parent);
                    extraDriverNames.push(reg.parent);
                }
            });
            // 過去の手入力ドライバー（変更で上書きされたが記憶されている名前）も含める
            var savedManual = app.Carpool.appData.manualDriverNames || [];
            savedManual.forEach(function(n) {
                if (n && !memberNameSet.has(n) && !seenManual.has(n)) {
                    seenManual.add(n);
                    extraDriverNames.push(n);
                }
            });
            // 手入力ドライバーを仮オブジェクトとして追加
            var extraDriverObjs = extraDriverNames.map(function(n) { return { name: n, role: 'manual', _manual: true }; });
            var candidates = candidateMembers.concat(extraDriverObjs);

            if (candidates.length === 0) {
                list.innerHTML = '<p style="padding:10px;color:#999;">候補メンバーがいません</p>';
            } else {
                var roleLabels = { coach: '監督', assist: 'コーチ', father: '父', mother: '母', officer: '役員', manual: '手入力', other: 'その他' };
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
        // 元のドライバーが手入力（メンバー未登録）なら消えないよう保存
        var memberNameSet2 = new Set((app.Carpool.members || []).map(function(m) { return m.name; }));
        if (car.parent && !memberNameSet2.has(car.parent)) {
            if (!app.Carpool.appData.manualDriverNames) app.Carpool.appData.manualDriverNames = [];
            if (!app.Carpool.appData.manualDriverNames.includes(car.parent)) {
                app.Carpool.appData.manualDriverNames.push(car.parent);
            }
        }
        car.parent = newDriver;

        var driverSeat = document.querySelector('.seat.driver-seat[data-car-index="' + carIndex + '"]');
        if (driverSeat) {
            driverSeat.dataset.person = newDriver;
            var driverMemberUpd2 = (app.Carpool.members || []).find(function(m) { return m.name === newDriver; });
            var driverDisplayUpd2 = driverMemberUpd2 ? ((driverMemberUpd2.abbr != null && driverMemberUpd2.abbr !== '') ? driverMemberUpd2.abbr : driverMemberUpd2.name) : (newDriver.length > 4 ? newDriver.substring(0, 4) : newDriver);
            var gcUpd2 = (driverMemberUpd2 && driverMemberUpd2.role === 'player') ? Assignment.getGradeColor(driverMemberUpd2.grade) : null;
            var nameTag = driverSeat.querySelector('.seat-name-tag');
            if (nameTag) { nameTag.textContent = driverDisplayUpd2; nameTag.title = newDriver; nameTag.style.color = gcUpd2 || ''; }
            driverSeat.style.background = gcUpd2 ? Assignment._hexToRgba(gcUpd2, 0.12) : '';
        }
        // カーヘッダーも更新
        var carLayout = document.querySelector('.car-layout[data-car-index="' + carIndex + '"]');
        if (carLayout) {
            var headerName = carLayout.querySelector('.car-header-name');
            if (headerName) {
                var driverMemberUpd = (app.Carpool.members || []).find(function(m) { return m.name === newDriver; });
                var driverDisplayUpd = (driverMemberUpd && driverMemberUpd.abbr) ? driverMemberUpd.abbr : newDriver;
                headerName.textContent = driverDisplayUpd;
                headerName.title = newDriver;
            }
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
        
        // 対象者算出はgetEventFilteredMembersに一本化（欠席確定者は除外済み）
        var eligibleForRandom = Assignment.getEventFilteredMembers();

        let targetPlayers = eligibleForRandom
            .filter(function(m) { return m.role === 'player'; })
            .map(function(m) { return m.name; });
        console.log(`ランダム配置対象選手数: ${targetPlayers.length}人`);

        // ドライバー名セット
        var driverNameSet = new Set(drivers.map(function(d) { return d.parent; }));

        // 非ドライバーのスタッフ（重複排除）
        var seenStaff = new Set();
        var uniqueStaff = eligibleForRandom
            .filter(function(m) { return (m.role === 'coach' || m.role === 'assist') && !driverNameSet.has(m.name); })
            .map(function(m) { return m.name; })
            .filter(function(n) { if (seenStaff.has(n)) return false; seenStaff.add(n); return true; });
        console.log(`非ドライバーのスタッフ: ${uniqueStaff.length}人`);

        // 非ドライバーの参加確定保護者
        var seenParent = new Set();
        var uniqueParents = eligibleForRandom
            .filter(function(m) { return (m.role === 'father' || m.role === 'mother') && !driverNameSet.has(m.name); })
            .map(function(m) { return m.name; })
            .filter(function(n) { if (seenParent.has(n)) return false; seenParent.add(n); return true; });
        console.log(`非ドライバーの参加確定保護者: ${uniqueParents.length}人`);

        // 割り当てリセット
        app.Carpool.appData.assignments = [];

        // ── Step1: 選手を「女子→男子」「学年順」でソート ──
        var gradeOrder = { '年少': 0, '年中': 1, '年長': 2, '1': 3, '2': 4, '3': 5, '4': 6, '5': 7, '6': 8 };
        var sortedPlayers = [...targetPlayers].sort(function(a, b) {
            var mA = app.Carpool.members.find(function(m) { return m.name === a; });
            var mB = app.Carpool.members.find(function(m) { return m.name === b; });
            var gA = (mA && mA.gender === 'female') ? 0 : 1;
            var gB = (mB && mB.gender === 'female') ? 0 : 1;
            if (gA !== gB) return gA - gB;
            var grA = mA ? (gradeOrder[mA.grade] !== undefined ? gradeOrder[mA.grade] : 99) : 99;
            var grB = mB ? (gradeOrder[mB.grade] !== undefined ? gradeOrder[mB.grade] : 99) : 99;
            return grA - grB;
        });

        // ── Step2: 各車の座席プールを構築 ──
        var carSeatPools = drivers.map(function(driver) {
            var front = [], middle = [], back = [];
            for (var i = 0; i < (driver.frontSeat || 0); i++) front.push({ type: '助手席', index: i });
            for (var i = 0; i < (driver.middleSeat || 0); i++) middle.push({ type: '中列', index: i });
            for (var i = 0; i < (driver.backSeat || 0); i++) back.push({ type: '後列', index: i });
            return { front: front, middle: middle, back: back };
        });
        var carSeatsAssigned = drivers.map(function() { return { '助手席': {}, '中列': {}, '後列': {} }; });

        // 指定の座席タイプ優先順で1席割り当てる
        function assignOneSeat(personName, carIdx, typeOrder) {
            for (var t = 0; t < typeOrder.length; t++) {
                var pool = carSeatPools[carIdx][typeOrder[t]];
                if (pool.length > 0) {
                    var slot = pool.splice(0, 1)[0];
                    carSeatsAssigned[carIdx][slot.type][slot.index] = personName;
                    return true;
                }
            }
            return false;
        }

        // ── Step3: スタッフを各車1名まで助手席優先で配置 ──
        var staffIdx = 0;
        for (var ci3 = 0; ci3 < drivers.length && staffIdx < uniqueStaff.length; ci3++) {
            if (assignOneSeat(uniqueStaff[staffIdx], ci3, ['front', 'middle', 'back'])) staffIdx++;
        }
        // 残りのスタッフを前から詰めて配置
        for (var ci3 = 0; ci3 < drivers.length && staffIdx < uniqueStaff.length; ci3++) {
            while (staffIdx < uniqueStaff.length) {
                if (!assignOneSeat(uniqueStaff[staffIdx], ci3, ['front', 'middle', 'back'])) break;
                staffIdx++;
            }
        }

        // ── Step3b: 参加確定保護者を各車1名まで助手席優先で配置 ──
        var parentIdx = 0;
        for (var ci3b = 0; ci3b < drivers.length && parentIdx < uniqueParents.length; ci3b++) {
            if (assignOneSeat(uniqueParents[parentIdx], ci3b, ['front', 'middle', 'back'])) parentIdx++;
        }
        // 残りの保護者も配置
        for (var ci3b = 0; ci3b < drivers.length && parentIdx < uniqueParents.length; ci3b++) {
            while (parentIdx < uniqueParents.length) {
                if (!assignOneSeat(uniqueParents[parentIdx], ci3b, ['front', 'middle', 'back'])) break;
                parentIdx++;
            }
        }

        // ── Step4: 選手を後列→中列→助手席の順（各車の学年グループまとめ配置）──
        // 選手用の座席リスト（後列→中列→助手席の順）
        var carSeatsList = carSeatPools.map(function(p) {
            return [...p.back, ...p.middle, ...p.front];
        });

        var gradeOrder2 = { '年少': 0, '年中': 1, '年長': 2, '1': 3, '2': 4, '3': 5, '4': 6, '5': 7, '6': 8 };
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
                if (carIdx < carSeatsList.length - 1) {
                    var remaining = carSeatsList[carIdx].length;
                    var nextRemaining = carSeatsList[carIdx + 1].length;
                    if (remaining < players.length && nextRemaining >= players.length) carIdx++;
                }
                players.forEach(function(playerName) {
                    var placed = false;
                    while (carIdx < carSeatsList.length && !placed) {
                        if (carSeatsList[carIdx].length > 0) {
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

        // ── Step4b: スキップ空席に未割り当て選手を埋める ──
        if (unassigned.length > 0) {
            var allEmptySlots = [];
            for (var ci2 = 0; ci2 < carSeatsList.length; ci2++) {
                carSeatsList[ci2].forEach(function(slot) { allEmptySlots.push({ carIdx: ci2, slot: slot }); });
            }
            while (unassigned.length > 0 && allEmptySlots.length > 0) {
                var playerName2 = unassigned.shift();
                var ri2 = Math.floor(Math.random() * allEmptySlots.length);
                var target = allEmptySlots.splice(ri2, 1)[0];
                carSeatsAssigned[target.carIdx][target.slot.type][target.slot.index] = playerName2;
            }
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
     * コメントを投稿して履歴に追加
     */
    Assignment.saveComment = function() {
        var textarea = document.getElementById('assignment-comment');
        if (!textarea) return;
        var text = textarea.value.trim();
        if (!text) return;

        // 投稿者名（ログインユーザー）
        var author = (app.Auth && app.Auth.getDisplayName) ? app.Auth.getDisplayName() : 'ユーザー';

        // 履歴配列に追加
        if (!Array.isArray(app.Carpool.appData.comments)) {
            app.Carpool.appData.comments = [];
        }
        var entry = { text: text, author: author, timestamp: Date.now() };
        app.Carpool.appData.comments.unshift(entry); // 最新を先頭に

        // 後方互換: 最新コメントを単一フィールドにもセット（LINEシェア・画像出力用）
        app.Carpool.appData.comment = text;

        app.Carpool.saveData();

        // テキストエリアをクリア
        textarea.value = '';

        // 履歴を再描画
        Assignment.renderCommentHistory();

        // バッジ更新
        Assignment.updateCommentBadge();

        console.log('コメントを投稿しました');
    };

    /**
     * コメント履歴をモーダル内に描画
     */
    Assignment.renderCommentHistory = function() {
        var container = document.getElementById('comment-history');
        if (!container) return;

        var comments = app.Carpool.appData.comments || [];
        if (comments.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:13px;text-align:center;padding:12px 0;">コメントはまだありません</p>';
            return;
        }

        container.innerHTML = '';
        comments.forEach(function(c) {
            var item = document.createElement('div');
            item.className = 'comment-history-item';

            var meta = document.createElement('div');
            meta.className = 'comment-history-meta';
            var d = new Date(c.timestamp);
            var dateStr = (d.getMonth()+1) + '/' + d.getDate() + ' ' +
                          ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
            meta.textContent = (c.author || '') + '　' + dateStr;

            var textEl = document.createElement('div');
            textEl.className = 'comment-history-text';
            textEl.textContent = c.text;

            item.appendChild(meta);
            item.appendChild(textEl);
            container.appendChild(item);
        });
    };

    /**
     * コメントボタンの赤丸バッジを更新
     */
    Assignment.updateCommentBadge = function() {
        var btn = document.getElementById('open-comment-btn');
        if (!btn) return;

        var comments = app.Carpool.appData.comments || [];
        // 既存の単一コメントも考慮
        var hasComment = comments.length > 0 || !!(app.Carpool.appData.comment);

        var badge = btn.querySelector('.comment-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'comment-badge';
            btn.appendChild(badge);
        }
        badge.classList.toggle('has-comment', hasComment);
    };

    /**
     * コメントモーダルを開く
     */
    Assignment.openCommentModal = function() {
        Assignment.renderCommentHistory();
        UI.openModal('comment-modal');
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
        
        // コメントを追加
        var comment = app.Carpool.appData.comment || '';
        if (!comment) {
            var commentTextarea = document.getElementById('assignment-comment');
            if (commentTextarea) comment = commentTextarea.value || '';
        }
        if (comment) {
            message += '\n【コメント】\n' + comment + '\n';
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
            // キャンバスモード中：座席からのドラッグはパン操作と衝突するため無効。
            // メンバー帯（下部ドック＝パン領域外）からのドラッグは許可
            if (Assignment._canvas && Assignment._canvas.active && !el.classList.contains('member-item')) return;
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
                        app.Carpool.appData.comment         = data.comment         || '';
                        app.Carpool.appData.comments        = data.comments        || [];
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

        // コメントバッジ更新（既存コメントがあれば赤丸を表示）
        Assignment.updateCommentBadge();

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

        // コメントボタン：コメントモーダルを開く
        var openCommentBtn = document.getElementById('open-comment-btn');
        if (openCommentBtn) {
            openCommentBtn.addEventListener('click', function() {
                Assignment.openCommentModal();
            });
        }

        // コメントモーダルの閉じるボタン
        var closeCommentBtn = document.getElementById('close-comment-modal');
        if (closeCommentBtn) {
            closeCommentBtn.addEventListener('click', function() {
                UI.closeModal('comment-modal');
            });
        }

        // コメント投稿ボタン
        var saveCommentBtn = document.getElementById('save-comment-btn');
        if (saveCommentBtn) {
            saveCommentBtn.addEventListener('click', function() {
                Assignment.saveComment();
            });
        }

        // コメントテキストエリア：Ctrl+Enter / Cmd+Enter で投稿
        var commentTextarea = document.getElementById('assignment-comment');
        if (commentTextarea) {
            commentTextarea.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    Assignment.saveComment();
                }
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

        // レイアウト切り替え・全画面ボタンの初期化
        Assignment.initLayoutAndFullscreen();

        console.log('割り当てのイベントリスナー設定が完了しました');
    };

    /**
     * レイアウト切り替えと全画面モードの初期化
     */
    Assignment.initLayoutAndFullscreen = function() {
        var workArea = document.getElementById('assignment-work-area');
        if (!workArea) return;

        // 保存済みレイアウト設定を復元
        var layout = localStorage.getItem('assignmentLayout') || 'vertical';
        if (layout === 'horizontal') workArea.classList.add('layout-h');
        Assignment._updateLayoutBtnLabels(layout);

        // ノーマルモードのレイアウトトグルボタン
        var layoutBtn = document.getElementById('layout-toggle-btn');
        if (layoutBtn) layoutBtn.addEventListener('click', Assignment.toggleLayout);

        // 全画面モードのレイアウトトグルボタン
        var fsLayoutBtn = document.getElementById('fs-layout-btn');
        if (fsLayoutBtn) fsLayoutBtn.addEventListener('click', Assignment.toggleLayout);

        // 全画面を開くボタン（キャンバス型全画面モードを開く）
        var openFsBtn = document.getElementById('open-fs-btn');
        if (openFsBtn) openFsBtn.addEventListener('click', Assignment.openCanvasMode);

        // 全画面を閉じるボタン（旧全画面モード用・互換）
        var closeFsBtn = document.getElementById('close-fs-btn');
        if (closeFsBtn) closeFsBtn.addEventListener('click', Assignment.closeFullscreen);

        // キャンバスモードのジェスチャー・ボタン初期化
        Assignment._initCanvasMode();
    };

    /**
     * レイアウト切り替え（縦 ⇄ 横）
     */
    Assignment.toggleLayout = function() {
        var workArea = document.getElementById('assignment-work-area');
        if (!workArea) return;
        var isH = workArea.classList.toggle('layout-h');
        var layout = isH ? 'horizontal' : 'vertical';
        localStorage.setItem('assignmentLayout', layout);
        Assignment._updateLayoutBtnLabels(layout);
    };

    Assignment._updateLayoutBtnLabels = function(layout) {
        var isH = (layout === 'horizontal');
        var normalLabel = document.getElementById('layout-btn-label');
        if (normalLabel) normalLabel.textContent = isH ? '⇅ 縦レイアウトに切り替え' : '⇄ 横レイアウトに切り替え';
        var fsLabel = document.getElementById('fs-layout-label');
        if (fsLabel) fsLabel.textContent = isH ? '⇅ 縦' : '⇄ 横';
        var layoutBtn = document.getElementById('layout-toggle-btn');
        if (layoutBtn) layoutBtn.classList.toggle('is-active', isH);
        var fsLayoutBtn = document.getElementById('fs-layout-btn');
        if (fsLayoutBtn) fsLayoutBtn.classList.toggle('is-active', isH);
    };

    /**
     * 全画面モードを開く
     */
    Assignment.openFullscreen = function() {
        var workArea = document.getElementById('assignment-work-area');
        if (!workArea) return;
        workArea.classList.add('is-fullscreen');
        document.body.style.overflow = 'hidden';
        // 全画面ヘッダーにイベントタイトルを表示
        var event = Storage.getSelectedEvent();
        var fsTitle = document.getElementById('fs-event-title');
        if (fsTitle && event) {
            fsTitle.textContent = (event.title || '座席割り当て') +
                '　' + (Utils.formatDateForDisplay ? Utils.formatDateForDisplay(event.date) : (event.date || ''));
        }
    };

    /**
     * 全画面モードを閉じる
     */
    Assignment.closeFullscreen = function() {
        var workArea = document.getElementById('assignment-work-area');
        if (!workArea) return;
        workArea.classList.remove('is-fullscreen');
        document.body.style.overflow = '';
    };

    /* =============================================
       キャンバス型全画面モード
       車両を大きな紙面（キャンバス）上に並べ、
       ピンチズーム・パンで自由に動き回りながら割り振る
       ============================================= */

    // キャンバスモードの内部状態
    Assignment._canvas = {
        active: false,
        scale: 1, tx: 0, ty: 0,
        minScale: 0.2, maxScale: 3,
        pointers: {},      // pointerId -> {x, y}
        panStart: null,    // 1本指パンの開始状態
        pinchStart: null,  // 2本指ピンチの開始状態
        moved: false,      // パン/ピンチ発生フラグ（タップ誤発火抑止用）
        selected: null,    // タップ選択中のメンバー名
        homes: []          // 移動したDOMノードの戻し先
    };

    /**
     * キャンバスモードを開く
     * 実DOMノード（車両・メンバー・統計・ボタン）をキャンバスへ移動して再利用する
     */
    Assignment.openCanvasMode = function() {
        var c = Assignment._canvas;
        var root = document.getElementById('canvas-mode');
        if (!root || c.active) return;

        // DOMをキャンバスへ移動（元の位置を記録して閉じるとき戻す）
        c.homes = [];
        function moveTo(el, dest) {
            if (!el || !dest) return;
            c.homes.push({ el: el, parent: el.parentNode, next: el.nextSibling });
            dest.appendChild(el);
        }
        moveTo(document.getElementById('cars-container'), document.getElementById('canvas-surface'));
        moveTo(document.getElementById('members-container'), document.getElementById('canvas-members-dock'));
        moveTo(document.getElementById('assignment-stats-bar-fs'), document.getElementById('canvas-stats-dock'));
        moveTo(document.querySelector('.assignment-action-buttons'), document.getElementById('canvas-actions-dock'));

        c.active = true;
        root.classList.add('active');
        document.body.classList.add('canvas-mode-active');
        document.body.style.overflow = 'hidden';

        // イベントタイトルを表示
        var event = Storage.getSelectedEvent();
        var title = document.getElementById('canvas-title');
        if (title && event) {
            title.textContent = (event.title || '') + '　' +
                (Utils.formatDateForDisplay ? Utils.formatDateForDisplay(event.date) : (event.date || ''));
        }

        Assignment._layoutCanvasSurface();
        Assignment._canvasFitAll();
    };

    /**
     * キャンバスモードを閉じる（移動したDOMを元へ戻す）
     */
    Assignment.closeCanvasMode = function() {
        var c = Assignment._canvas;
        var root = document.getElementById('canvas-mode');
        if (!root || !c.active) return;

        Assignment._clearCanvasSelection();

        // 逆順で元の位置へ戻す
        for (var i = c.homes.length - 1; i >= 0; i--) {
            var h = c.homes[i];
            if (h.parent) h.parent.insertBefore(h.el, h.next);
        }
        c.homes = [];
        c.active = false;
        c.pointers = {};
        c.panStart = null;
        c.pinchStart = null;

        root.classList.remove('active');
        document.body.classList.remove('canvas-mode-active');
        document.body.style.overflow = '';
    };

    /**
     * キャンバス紙面のサイズを車両数に応じて決める（ほぼ正方形のグリッド）
     */
    Assignment._layoutCanvasSurface = function() {
        var c = Assignment._canvas;
        if (!c.active) return;
        var surface = document.getElementById('canvas-surface');
        if (!surface) return;
        var carCount = surface.querySelectorAll('.car-layout').length;
        var cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(carCount, 1))));
        var CAR_W = 320, GAP = 16, PAD = 52; // padding 24px × 2 + border 2px × 2
        surface.style.width = (cols * CAR_W + (cols - 1) * GAP + PAD) + 'px';
    };

    /** transform を適用 */
    Assignment._applyCanvasTransform = function() {
        var c = Assignment._canvas;
        var surface = document.getElementById('canvas-surface');
        if (!surface) return;
        surface.style.transform = 'translate(' + c.tx + 'px,' + c.ty + 'px) scale(' + c.scale + ')';
    };

    /**
     * 全体表示：全車両が収まる倍率・位置に戻す
     */
    Assignment._canvasFitAll = function() {
        var c = Assignment._canvas;
        var viewport = document.getElementById('canvas-viewport');
        var surface = document.getElementById('canvas-surface');
        if (!viewport || !surface) return;
        var TOP = 60; // 浮遊コントロールと重ならないためのオフセット
        var vw = viewport.clientWidth, vh = viewport.clientHeight - TOP;
        var sw = surface.offsetWidth, sh = surface.offsetHeight;
        if (!vw || vh <= 0 || !sw || !sh) return;
        var s = Math.min(vw / sw, vh / sh) * 0.95;
        s = Math.max(c.minScale, Math.min(c.maxScale, s));
        c.scale = s;
        c.tx = (vw - sw * s) / 2;
        c.ty = TOP + Math.max((vh - sh * s) / 2, 4);
        Assignment._applyCanvasTransform();
    };

    /**
     * 指定スクリーン座標を固定点にしてズーム
     */
    Assignment._canvasZoomAt = function(clientX, clientY, factor) {
        var c = Assignment._canvas;
        var viewport = document.getElementById('canvas-viewport');
        if (!viewport) return;
        var rect = viewport.getBoundingClientRect();
        var x = clientX - rect.left, y = clientY - rect.top;
        var ns = Math.max(c.minScale, Math.min(c.maxScale, c.scale * factor));
        var applied = ns / c.scale;
        c.tx = x - (x - c.tx) * applied;
        c.ty = y - (y - c.ty) * applied;
        c.scale = ns;
        Assignment._applyCanvasTransform();
    };

    /**
     * メンバーをタップ選択 / 選択解除（タップ配置フローの起点）
     */
    Assignment.toggleCanvasSelect = function(name, el) {
        var c = Assignment._canvas;
        if (c.selected === name) {
            Assignment._clearCanvasSelection();
            return;
        }
        Assignment._clearCanvasSelection();
        c.selected = name;
        if (el) el.classList.add('canvas-selected');
        document.body.classList.add('canvas-select-active');
        var hint = document.getElementById('canvas-hint');
        if (hint) hint.textContent = name + ' を配置する座席をタップ';
    };

    /** 選択状態を解除 */
    Assignment._clearCanvasSelection = function() {
        Assignment._canvas.selected = null;
        document.querySelectorAll('.member-item.canvas-selected').forEach(function(el) {
            el.classList.remove('canvas-selected');
        });
        document.body.classList.remove('canvas-select-active');
    };

    /**
     * キャンバスモードの初期化（ジェスチャー・ボタン）
     * setupEventListeners から1回だけ呼ばれる
     */
    Assignment._initCanvasMode = function() {
        var viewport = document.getElementById('canvas-viewport');
        if (!viewport || viewport.dataset.canvasInit === '1') return;
        viewport.dataset.canvasInit = '1';
        var c = Assignment._canvas;

        // ── コントロールボタン ──
        // touch-action:none のviewport内ではタッチ後にブラウザがclickを合成しない
        // ことがあるため、タッチは pointerup で直接発火し、click（PC/キーボード）は
        // 二重発火ガード付きで併用する
        function bindTap(btn, fn) {
            if (!btn) return;
            var swallowUntil = 0;
            btn.addEventListener('pointerup', function(e) {
                if (e.pointerType === 'mouse') return; // PCはネイティブclickに任せる
                e.stopPropagation();
                swallowUntil = Date.now() + 600;
                fn();
            });
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (Date.now() < swallowUntil) return; // pointerupで処理済み
                fn();
            });
        }
        bindTap(document.getElementById('canvas-fit-btn'), function() { Assignment._canvasFitAll(); });
        bindTap(document.getElementById('canvas-zoom-in-btn'), function() {
            var r = viewport.getBoundingClientRect();
            Assignment._canvasZoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.3);
        });
        bindTap(document.getElementById('canvas-zoom-out-btn'), function() {
            var r = viewport.getBoundingClientRect();
            Assignment._canvasZoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.3);
        });
        bindTap(document.getElementById('canvas-close-btn'), function() { Assignment.closeCanvasMode(); });

        // ── 1本指パン・2本指ピンチ（Pointer Events）──
        viewport.addEventListener('pointerdown', function(e) {
            // コントロールボタン上ではジェスチャーを開始しない
            if (e.target.closest && e.target.closest('.canvas-controls')) return;
            c.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            var ids = Object.keys(c.pointers);
            if (ids.length === 1) {
                c.panStart = { x: e.clientX, y: e.clientY, tx: c.tx, ty: c.ty };
                c.moved = false;
            } else if (ids.length === 2) {
                var p1 = c.pointers[ids[0]], p2 = c.pointers[ids[1]];
                var rect = viewport.getBoundingClientRect();
                c.panStart = null;
                c.pinchStart = {
                    dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
                    cx: (p1.x + p2.x) / 2 - rect.left,
                    cy: (p1.y + p2.y) / 2 - rect.top,
                    scale: c.scale, tx: c.tx, ty: c.ty
                };
                c.moved = true;
            }
        });

        viewport.addEventListener('pointermove', function(e) {
            if (!c.pointers[e.pointerId]) return;
            c.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            var ids = Object.keys(c.pointers);
            if (ids.length === 1 && c.panStart) {
                var dx = e.clientX - c.panStart.x, dy = e.clientY - c.panStart.y;
                if (!c.moved && Math.hypot(dx, dy) > 6) c.moved = true;
                if (c.moved) {
                    c.tx = c.panStart.tx + dx;
                    c.ty = c.panStart.ty + dy;
                    Assignment._applyCanvasTransform();
                }
            } else if (ids.length === 2 && c.pinchStart) {
                var q1 = c.pointers[ids[0]], q2 = c.pointers[ids[1]];
                var rect2 = viewport.getBoundingClientRect();
                var dist = Math.hypot(q2.x - q1.x, q2.y - q1.y) || 1;
                var cx = (q1.x + q2.x) / 2 - rect2.left;
                var cy = (q1.y + q2.y) / 2 - rect2.top;
                var ns = Math.max(c.minScale, Math.min(c.maxScale, c.pinchStart.scale * dist / c.pinchStart.dist));
                var applied = ns / c.pinchStart.scale;
                // ピンチ中心を固定点としてズームし、中心の移動分をパンに反映
                c.tx = cx - (c.pinchStart.cx - c.pinchStart.tx) * applied;
                c.ty = cy - (c.pinchStart.cy - c.pinchStart.ty) * applied;
                c.scale = ns;
                Assignment._applyCanvasTransform();
            }
        });

        function releasePointer(e) {
            delete c.pointers[e.pointerId];
            var ids = Object.keys(c.pointers);
            if (ids.length === 1) {
                // ピンチ→パンへ移行
                var p = c.pointers[ids[0]];
                c.panStart = { x: p.x, y: p.y, tx: c.tx, ty: c.ty };
                c.pinchStart = null;
            } else if (ids.length === 0) {
                c.panStart = null;
                c.pinchStart = null;
                // タッチではパン後にclickが発火しない場合があるため、
                // フラグを短時間で必ずリセットする（残留すると以降のボタンが効かなくなる）
                if (c.moved) {
                    setTimeout(function() { c.moved = false; }, 350);
                }
            }
        }
        viewport.addEventListener('pointerup', releasePointer);
        viewport.addEventListener('pointercancel', releasePointer);

        // ── タッチのタップを pointerup から自前で発火 ──
        // touch-action:none のviewport内ではタッチ後にブラウザがclickを
        // 合成しないことがある（実機で座席タップ・ボタンが効かなくなる原因）。
        // タップ判定（移動なし）なら対象要素の click() を直接呼ぶ。
        var passingSyntheticTap = false;
        var swallowClicksUntil = 0;
        viewport.addEventListener('pointerup', function(e) {
            if (e.pointerType === 'mouse') return;     // PCはネイティブclickでOK
            if (c.moved) return;                       // パン/ピンチはタップではない
            if (!e.target.closest) return;
            if (e.target.closest('.canvas-controls')) return; // ボタンは専用ハンドラ
            var target = e.target.closest('.seat-clear-btn, .seat-count-change-btn, .seat');
            if (!target) return;
            passingSyntheticTap = true;
            try { target.click(); } finally { passingSyntheticTap = false; }
            swallowClicksUntil = Date.now() + 600;     // ブラウザ由来の遅延clickを吸収
        });

        // クリック抑止（キャプチャ段階）:
        // 1) 上記で処理済みタップの重複click  2) パン/ピンチ直後の誤発火click
        viewport.addEventListener('click', function(e) {
            if (passingSyntheticTap) return;           // 自前発火分は通す
            if (e.target.closest && e.target.closest('.canvas-controls')) return; // ボタンは自前ガード持ち
            if (Date.now() < swallowClicksUntil || c.moved) {
                c.moved = false;                       // 誤発火clickを1回吸収したらフラグ消費
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);

        // PC：ホイールでカーソル位置ズーム
        viewport.addEventListener('wheel', function(e) {
            if (!c.active) return;
            e.preventDefault();
            Assignment._canvasZoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
        }, { passive: false });

        // ダブルタップ：等倍ズームイン ⇄ 全体表示
        var lastTap = 0, lastX = 0, lastY = 0;
        viewport.addEventListener('pointerup', function(e) {
            if (e.pointerType !== 'touch' || c.moved) { lastTap = 0; return; }
            var now = Date.now();
            if (now - lastTap < 300 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 40) {
                lastTap = 0;
                if (c.scale < 1) Assignment._canvasZoomAt(e.clientX, e.clientY, 1 / c.scale);
                else Assignment._canvasFitAll();
            } else {
                lastTap = now; lastX = e.clientX; lastY = e.clientY;
            }
        });

        // 画面回転・リサイズ時は全体表示に戻す
        window.addEventListener('resize', function() {
            if (c.active) Assignment._canvasFitAll();
        });
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

        // キャンバスモード中は紙面サイズを再計算（車両数変化に追従）
        if (Assignment._canvas && Assignment._canvas.active) {
            Assignment._layoutCanvasSurface();
        }

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
        
        // 車両ヘッダー（運転手名＋座席数変更ボタンを横並び）
        const carHeader = document.createElement('div');
        carHeader.className = 'car-header';

        // 運転手の略称を取得
        var driverMember = (app.Carpool.members || []).find(function(m) { return m.name === car.parent; });
        var driverDisplayName = (driverMember && driverMember.abbr) ? driverMember.abbr : car.parent;

        // 1行目：運転手名
        var carHeaderName = document.createElement('div');
        carHeaderName.className = 'car-header-name';
        carHeaderName.textContent = driverDisplayName;
        carHeaderName.title = car.parent;
        carHeader.appendChild(carHeaderName);

        // 2行目：座席数変更ボタン
        var seatCountBtn = document.createElement('button');
        seatCountBtn.className = 'seat-count-change-btn';
        seatCountBtn.type = 'button';
        seatCountBtn.textContent = '座席数変更';
        seatCountBtn.addEventListener('click', (function(ci) {
            return function(e) { e.stopPropagation(); Assignment.openSeatCountModal(ci); };
        })(carIndex));
        carHeader.appendChild(seatCountBtn);

        carLayout.appendChild(carHeader);

        // 車両詳細情報（備考を赤字表示）
        if (car.notes) {
            const carInfo = document.createElement('div');
            carInfo.className = 'car-info car-notes-red';
            carInfo.textContent = car.notes;
            carLayout.appendChild(carInfo);
        }
        
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
        var epNames = new Set((car.extraPassengers || []).map(function(ep) { return ep.name; }));
        const carAssignment = existingAssignments.find(a => a.carIndex === carIndex);
        if (carAssignment && carAssignment.seats) {
            Object.keys(carAssignment.seats).forEach(seatType => {
                const seatIndices = Object.keys(carAssignment.seats[seatType]);
                seatIndices.forEach(seatIndex => {
                    const person = carAssignment.seats[seatType][seatIndex];
                    if (person) {
                        const seat = carLayout.querySelector(`.seat[data-seat-type="${seatType}"][data-seat-index="${seatIndex}"]`);
                        if (seat) {
                            if (epNames.has(person)) seat.dataset.isExtraPassenger = 'true';
                            this.setSeatOccupant(seat, person);
                        }
                    }
                });
            });
        }

        // メンバー外乗員をまだ未配置なら自動配置（後列→中列→助手席の順）
        if (car.extraPassengers && car.extraPassengers.length > 0) {
            var alreadyInSeats = new Set();
            carLayout.querySelectorAll('.seat.filled[data-person]').forEach(function(s) {
                if (s.dataset.person) alreadyInSeats.add(s.dataset.person);
            });
            // 空き座席を後→中→前の順で収集
            var emptySeats = [];
            ['後列', '中列', '助手席'].forEach(function(type) {
                carLayout.querySelectorAll('.seat[data-seat-type="' + type + '"]:not(.filled)').forEach(function(s) {
                    emptySeats.push(s);
                });
            });
            var self = this;
            car.extraPassengers.forEach(function(ep) {
                if (!alreadyInSeats.has(ep.name) && emptySeats.length > 0) {
                    var seat = emptySeats.shift();
                    seat.dataset.isExtraPassenger = 'true';
                    self.setSeatOccupant(seat, ep.name);
                }
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

        // メンバー情報を取得して表示名を決定（メンバー座席と同じロジック）
        var member = (app.Carpool.members || []).find(function(m) { return m.name === driverName; });
        var displayName = member ? ((member.abbr != null && member.abbr !== '') ? member.abbr : member.name) : (driverName.length > 4 ? driverName.substring(0, 4) : driverName);
        var gc = (member && member.role === 'player') ? Assignment.getGradeColor(member.grade) : null;
        if (gc) driverSeat.style.background = Assignment._hexToRgba(gc, 0.12);

        const nameTag = document.createElement('div');
        nameTag.className = 'seat-name-tag';
        nameTag.textContent = displayName;
        nameTag.title = driverName;
        if (gc) nameTag.style.color = gc;

        const label = document.createElement('div');
        label.className = 'seat-label';
        label.textContent = '運転手';

        driverSeat.appendChild(nameTag);
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
            // キャンバスモードでメンバー選択中：タップで直接配置
            var c = Assignment._canvas;
            if (c && c.active && c.selected) {
                var name = c.selected;
                Assignment._clearCanvasSelection();
                delete seat.dataset.isExtraPassenger;
                Assignment.setSeatOccupant(seat, name);
                Assignment.saveAssignments();
                Assignment.updateMembersList();
                return;
            }
            if (seat.dataset.isExtraPassenger === 'true') {
                Assignment.openExtraPassengerModal(seat);
            } else {
                this.openSeatEditModal(seat);
            }
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

        // 学年色で座席背景を薄く色づけ（メンバー外乗員はグレー）
        var isEP = seat.dataset.isExtraPassenger === 'true';
        seat.style.background = isEP ? '#f0f0f0' : (gc ? Assignment._hexToRgba(gc, 0.12) : '');

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

        // 対象者算出はgetEventFilteredMembersに一本化（欠席除外・自己出欠登録の保護者を含む）
        let filteredMembers = Assignment.getEventFilteredMembers();

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

        // 選手を高学年順でソート
        var gradeOrderDesc = { '6': 0, '5': 1, '4': 2, '3': 3, '2': 4, '1': 5, '年長': 6, '年中': 7, '年少': 8 };
        roleGroups.player.members.sort(function(a, b) {
            var ga = gradeOrderDesc[a.grade] !== undefined ? gradeOrderDesc[a.grade] : 99;
            var gb = gradeOrderDesc[b.grade] !== undefined ? gradeOrderDesc[b.grade] : 99;
            return ga - gb;
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

        // キャンバスモードの選択状態を復元（再描画で選択ハイライトが消えるため）
        if (Assignment._canvas && Assignment._canvas.selected) {
            var selName = Assignment._canvas.selected;
            var selEl = Array.prototype.find.call(
                membersContainer.querySelectorAll('.member-item'),
                function(el) { return el.dataset.name === selName; }
            );
            if (selEl) selEl.classList.add('canvas-selected');
            else Assignment._clearCanvasSelection();
        }

        this.updateStatsBar();
    };

    /**
     * 統計バーを更新（参加人数/座席数・配置済・空席・配置前）
     */
    Assignment.updateStatsBar = function() {
        var bars = [
            document.getElementById('assignment-stats-bar-fs'),
            document.getElementById('assignment-stats-bar-nav')
        ];
        if (!bars[0] && !bars[1]) return;

        // 参加人数：指導者+選手+保護者（欠席者除く、運転手除く、メンバー外乗員除く）
        // 対象者算出はgetEventFilteredMembersに一本化
        var eligibleAll = Assignment.getEventFilteredMembers();

        // 運転手名セット・車両数
        var carRegistrations = app.Carpool.appData.carRegistrations || [];
        var availableCars = carRegistrations.filter(function(c) { return c.canDrive !== 'no'; });
        var driverNames = new Set(availableCars.map(function(c) { return c.parent; }));
        var carCount = availableCars.length;

        // 参加人数（運転手除く）
        var participantCount = eligibleAll.filter(function(m) { return !driverNames.has(m.name); }).length;

        // 座席数（運転手席除く全席）
        var totalSeats = availableCars.reduce(function(sum, car) {
            return sum + (car.frontSeat || 0) + (car.middleSeat || 0) + (car.backSeat || 0);
        }, 0);

        // 配置済（荷物除く）
        var assignedCount = 0;
        document.querySelectorAll('.seat.filled[data-person]').forEach(function(s) {
            if (s.dataset.person && s.dataset.person !== '荷物') assignedCount++;
        });

        // 空席
        var emptyCount = totalSeats - assignedCount;
        if (emptyCount < 0) emptyCount = 0;

        // 配置前（配置待ちメンバーのうち荷物除く）
        var waitingCount = 0;
        document.querySelectorAll('#members-container .member-item').forEach(function(el) {
            if (el.dataset.memberId !== 'luggage' && el.dataset.memberName !== '荷物') waitingCount++;
        });

        var html =
            '<span class="stats-item"><span class="stats-label">車両</span><span class="stats-value">' + carCount + '</span></span>' +
            '<span class="stats-sep">｜</span>' +
            '<span class="stats-item"><span class="stats-label">参加人数</span><span class="stats-value">' + participantCount + '</span><span class="stats-label">/座席数</span><span class="stats-value">' + totalSeats + '</span></span>' +
            '<span class="stats-sep">｜</span>' +
            '<span class="stats-item"><span class="stats-label">配置済</span><span class="stats-value">' + assignedCount + '</span></span>' +
            '<span class="stats-sep">｜</span>' +
            '<span class="stats-item"><span class="stats-label">空席</span><span class="stats-value">' + emptyCount + '</span></span>' +
            '<span class="stats-sep">｜</span>' +
            '<span class="stats-item"><span class="stats-label">配置前</span><span class="stats-value">' + waitingCount + '</span></span>';

        bars.forEach(function(bar) { if (bar) bar.innerHTML = html; });
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
            badge.textContent = ['年少', '年中', '年長'].includes(member.grade) ? member.grade : member.grade + '年';
            memberItem.appendChild(badge);
        }

        // 名前（略称優先、丸なし）
        const nameLabel = document.createElement('div');
        nameLabel.className = 'member-name';
        nameLabel.textContent = (member.abbr != null && member.abbr !== '') ? member.abbr : member.name;
        memberItem.appendChild(nameLabel);

        // キャンバスモード：タップで選択（→座席タップで配置）
        memberItem.addEventListener('click', function() {
            if (Assignment._canvas && Assignment._canvas.active) {
                Assignment.toggleCanvasSelect(member.name, memberItem);
            }
        });

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
        // キャンバスモード中：座席からのドラッグのみ無効（パン操作と衝突するため）。
        // メンバー帯からのドラッグは許可
        if (Assignment._canvas && Assignment._canvas.active && !el.classList.contains('member-item')) {
            e.preventDefault();
            return;
        }
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

        // 台数・行数に応じて画像サイズを決定（4台/行、5台目以降2行目）
        var carCount = carsContainer.children.length;
        var carsPerRow = Math.min(4, carCount);
        var numRows = Math.ceil(carCount / 4);
        var exportWidth = Math.max(960, carsPerRow * 300 + 48);
        // ヘッダー+情報行の高さ + 車両行ごとの高さ
        var carRowHeight = 480; // 1行分の車両エリア高さ（目安）
        var headerHeight = 120; // ヘッダー・情報エリア高さ
        var exportHeight = headerHeight + carRowHeight * numRows;

        // エクスポート用ラッパー（画面外に配置）
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:absolute;top:0;left:-9999px;background:#fff;padding:14px 16px;font-family:sans-serif;box-sizing:border-box;width:' + exportWidth + 'px;min-height:' + exportHeight + 'px;overflow:visible;display:flex;flex-direction:column;';

        // ヘッダー（コンパクト）
        var header = document.createElement('div');
        header.style.cssText = 'margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #E8A200;display:flex;align-items:baseline;gap:12px;flex-shrink:0;';
        header.innerHTML = '<span style="font-size:15px;font-weight:bold;color:#E8A200;">FC尾島ジュニア　乗車割り当て</span>';
        wrap.appendChild(header);

        // イベント情報サマリー（コンパクト）
        if (event) {
            var infoSection = document.createElement('div');
            infoSection.style.cssText = 'background:#fffbef;border:1px solid #E8A200;border-radius:6px;padding:5px 10px;margin-bottom:8px;font-size:12px;color:#333;display:flex;flex-wrap:wrap;gap:2px 14px;flex-shrink:0;';

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
                // 参加選手は長くなるので折り返し・全幅表示
                if (row.label === '参加選手') {
                    cell.style.cssText = 'display:flex;gap:3px;white-space:normal;flex-wrap:wrap;width:100%;align-items:flex-start;';
                    cell.innerHTML = '<span style="color:#E8A200;font-weight:bold;white-space:nowrap;">' + row.label + ':</span><span style="word-break:break-all;flex:1;">' + UI.escapeHTML(String(row.value)) + '</span>';
                } else {
                    cell.style.cssText = 'display:flex;gap:3px;white-space:nowrap;';
                    cell.innerHTML = '<span style="color:#E8A200;font-weight:bold;">' + row.label + ':</span><span>' + UI.escapeHTML(String(row.value)) + '</span>';
                }
                infoSection.appendChild(cell);
            });
            wrap.appendChild(infoSection);
        }

        // コメント（コンパクト）
        var comment = app.Carpool.appData.comment || '';
        var commentTextarea = document.getElementById('assignment-comment');
        if (!comment && commentTextarea) comment = commentTextarea.value || '';
        if (comment) {
            var commentDiv = document.createElement('div');
            commentDiv.style.cssText = 'margin-bottom:6px;padding:5px 10px;background:#fff5f5;border:1px solid #dc3545;border-radius:6px;flex-shrink:0;';
            var commentLabel = document.createElement('span');
            commentLabel.style.cssText = 'font-size:11px;color:#dc3545;font-weight:bold;margin-right:4px;';
            commentLabel.textContent = 'コメント:';
            var commentText = document.createElement('span');
            commentText.style.cssText = 'font-size:12px;color:#dc3545;font-weight:bold;white-space:pre-wrap;';
            commentText.textContent = comment;
            commentDiv.appendChild(commentLabel);
            commentDiv.appendChild(commentText);
            wrap.appendChild(commentDiv);
        }

        // 実際の cars-container をクローン（4台/行でラップ）
        var carsClone = carsContainer.cloneNode(true);
        var carItemWidth = Math.floor((exportWidth - 32 - (carsPerRow - 1) * 12) / carsPerRow);
        carsClone.style.cssText = 'overflow:visible;max-height:none;height:auto;display:flex;flex-direction:row;flex-wrap:wrap;gap:12px;align-items:flex-start;';
        // 各car-layoutを指定幅で表示（box-sizing:border-boxでpadding込みの幅にする）
        carsClone.querySelectorAll('.car-layout').forEach(function(el) {
            el.style.flexShrink = '0';
            el.style.width = carItemWidth + 'px';
            el.style.marginBottom = '0';
            el.style.boxSizing = 'border-box';
            el.style.minWidth = '0';
            el.style.overflow = 'visible';
            el.style.height = 'auto';
        });
        // クローン内のコンテナ要素のスクロール制限を解除
        carsClone.querySelectorAll('.car-seat-layout, .car-top-view, .seat-row, .car-info').forEach(function(el) {
            el.style.overflow = 'visible';
            el.style.maxHeight = 'none';
            el.style.height = 'auto';
        });
        // car-top-viewの高さ制限解除（3列目の見切れ防止）
        carsClone.querySelectorAll('.car-top-view').forEach(function(el) {
            el.style.overflow = 'visible';
            el.style.maxHeight = 'none';
            el.style.height = 'auto';
            el.style.paddingBottom = '10px';
        });
        // クローン内の不要なボタン類を非表示（座席数変更ボタン含む）
        carsClone.querySelectorAll('.seat-clear-btn, .seat-count-adjuster, .seat-count-change-btn').forEach(function(el) {
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

        // 実際のラッパー高さを取得（コンテンツに合わせる）
        var actualHeight = wrap.scrollHeight || exportHeight;
        html2canvas(wrap, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            windowWidth: exportWidth,
            windowHeight: actualHeight,
            width: exportWidth,
            height: actualHeight
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

    // =============================================
    // メンバー外乗員 編集モーダル
    // =============================================
    Assignment.openExtraPassengerModal = function(seat) {
        var modal = document.getElementById('extra-passenger-modal');
        if (!modal) return;
        var nameEl = document.getElementById('ep-modal-name');
        if (nameEl) nameEl.textContent = seat.dataset.person || '';

        var editBtn = document.getElementById('ep-modal-edit');
        var deleteBtn = document.getElementById('ep-modal-delete');

        // クローン差し替えでリスナー重複防止
        if (editBtn) {
            var newEdit = editBtn.cloneNode(true);
            editBtn.parentNode.replaceChild(newEdit, editBtn);
            newEdit.addEventListener('click', function() {
                var newName = prompt('新しい名前を入力してください', seat.dataset.person || '');
                if (!newName || !newName.trim()) return;
                newName = newName.trim();
                var oldName = seat.dataset.person;
                // carRegistrationsのextraPassengersも更新
                var carIndex = parseInt(seat.dataset.carIndex);
                var cars = app.Carpool.appData.carRegistrations || [];
                var car = cars.filter(function(c) { return c.canDrive !== 'no'; })[carIndex];
                if (car && car.extraPassengers) {
                    car.extraPassengers.forEach(function(ep) {
                        if (ep.name === oldName) ep.name = newName;
                    });
                }
                seat.dataset.person = newName;
                // setSeatOccupantで表示更新
                Assignment.clearSeat(seat);
                seat.dataset.isExtraPassenger = 'true';
                Assignment.setSeatOccupant(seat, newName);
                Assignment.saveAssignments();
                app.Carpool.saveData();
                UI.closeModal('extra-passenger-modal');
            });
        }

        if (deleteBtn) {
            var newDelete = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDelete, deleteBtn);
            newDelete.addEventListener('click', function() {
                var oldName = seat.dataset.person;
                var carIndex = parseInt(seat.dataset.carIndex);
                var cars = app.Carpool.appData.carRegistrations || [];
                var car = cars.filter(function(c) { return c.canDrive !== 'no'; })[carIndex];
                if (car && car.extraPassengers) {
                    car.extraPassengers = car.extraPassengers.filter(function(ep) { return ep.name !== oldName; });
                }
                Assignment.clearSeat(seat);
                Assignment.saveAssignments();
                app.Carpool.saveData();
                UI.closeModal('extra-passenger-modal');
            });
        }

        UI.openModal('extra-passenger-modal');
    };
})(window.FCOjima);
