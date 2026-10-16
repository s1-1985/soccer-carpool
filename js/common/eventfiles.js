/**
 * FC尾島ジュニア - イベント添付ファイル（共通モジュール）
 *
 * 保存先はFirebase Storageの teams/{TEAM_ID}/events/{eventId}/ で、
 * hubのイベントモーダル・配車管理画面のどこから添付しても同じ場所を参照する（＝同期）。
 *
 * 制限（2026-07-21ユーザー指定）:
 *  - 種類: PDF / Excel / Word / 画像 / テキスト
 *  - 1ファイル 10MB まで（storage.rules でもサーバー側で強制）
 *  - 1イベントにつき添付は 10個 まで（既存分も含めて数える）
 *
 * 自動削除:
 *  - イベント終了後 30日 経過した添付はクライアント起動時に自動削除する
 *    （このアプリはCloud Functionsを持たない静的構成のため、マネージャーが
 *    hubを開いたタイミングで1日1回だけ掃除する方式）
 */

window.FCOjima = window.FCOjima || {};
FCOjima.EventFiles = FCOjima.EventFiles || {};

(function(EventFiles) {
    var MAX_SIZE = 10 * 1024 * 1024; // 10MB
    var MAX_FILES = 10;              // 1イベントあたりの添付上限（既存分込み）
    var RETENTION_DAYS = 30;         // イベント終了後の保持日数

    // 許可する拡張子（PDF / Excel / Word / 画像 / テキスト）
    var ALLOWED_EXT = [
        'pdf',
        'xls', 'xlsx', 'csv',
        'doc', 'docx',
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'bmp',
        'txt', 'md'
    ];

    function extOf(name) {
        var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        return m ? m[1] : '';
    }

    function basePath(eventId) {
        return 'teams/' + FCOjimaFirebase.TEAM_ID + '/events/' + eventId;
    }

    /**
     * ファイル群を検証する。
     * @returns {{ok: File[], errors: string[]}}
     */
    EventFiles.validate = function(files) {
        var ok = [], errors = [];
        Array.prototype.forEach.call(files || [], function(f) {
            if (!ALLOWED_EXT.includes(extOf(f.name))) {
                errors.push(f.name + '：この形式は添付できません（PDF・Excel・Word・画像・テキストのみ）');
            } else if (f.size > MAX_SIZE) {
                errors.push(f.name + '：10MBを超えています（' + (f.size / 1024 / 1024).toFixed(1) + 'MB）');
            } else {
                ok.push(f);
            }
        });
        return { ok: ok, errors: errors };
    };

    /**
     * 添付一覧をコンテナに描画する
     * @param {string|number} eventId
     * @param {HTMLElement} listEl
     */
    EventFiles.render = async function(eventId, listEl) {
        if (!listEl) return;
        // 同じ一覧の要素（管理タブのイベント概要など）で別の予定を開き直したとき、前の予定の読み込みが
        // 後から終わって一覧に混ざらないよう、最後に始めた描画だけを反映する。以前は前の予定の添付
        // （とその削除ボタン）が今の予定の一覧に並ぶことがあった
        var token = {};
        listEl._filesRenderToken = token;
        listEl._filesEventId = String(eventId);
        function stale() { return listEl._filesRenderToken !== token; }
        listEl.innerHTML = '<p style="color:#999;font-size:12px;">読み込み中...</p>';
        try {
            var ref = firebase.storage().ref(basePath(eventId));
            var result = await ref.listAll();
            if (stale()) return;
            var countLabel = '<p class="event-file-count" style="color:#999;font-size:11px;margin:2px 0 6px;">添付 ' + result.items.length + '/' + MAX_FILES + '</p>';
            if (result.items.length === 0) {
                listEl.innerHTML = countLabel + '<p style="color:#999;font-size:12px;">ファイルなし</p>';
                return;
            }
            // ダウンロード用URLはまとめて取得する（1件ずつ待つと件数分だけ表示が遅れる）
            var urls = await Promise.all(result.items.map(function(it) {
                return it.getDownloadURL().catch(function(e) { console.warn('添付ファイルのURL取得に失敗:', it.name, e); return null; });
            }));
            if (stale()) return;
            listEl.innerHTML = countLabel;
            for (var i = 0; i < result.items.length; i++) {
                var item = result.items[i];
                var url = urls[i];
                // 1行 = リンク＋削除ボタン。以前はHUBの予定詳細に削除手段がなく、上限（10個）に
                // 達すると「先に不要なファイルを削除してください」と出るのに消せなかった
                // （配車管理の概要ページにだけ削除ボタンがあった）
                var row = document.createElement('div');
                row.className = 'event-file-row';
                row.style.cssText = 'display:flex;align-items:center;gap:8px;';
                var a = document.createElement('a');
                if (url) a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.className = 'event-file-link';
                a.style.cssText = 'flex:1;min-width:0;padding:6px 10px;background:#f0f4ff;border-radius:6px;font-size:13px;color:#2563eb;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                a.textContent = item.name;
                var del = document.createElement('button');
                del.type = 'button';
                del.className = 'event-file-delete';
                del.textContent = '削除';
                del.style.cssText = 'flex-shrink:0;padding:4px 10px;background:#dc3545;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;';
                del.addEventListener('click', (function(fileRef) {
                    return async function() {
                        if (!confirm('「' + fileRef.name + '」を削除しますか？')) return;
                        try {
                            await fileRef.delete();
                        } catch (e) {
                            alert('削除に失敗しました: ' + e.message);
                        }
                        if (EventFiles._isShowing(listEl, eventId)) await EventFiles.render(eventId, listEl);
                    };
                })(item));
                row.appendChild(a);
                row.appendChild(del);
                listEl.appendChild(row);
            }
        } catch (e) {
            if (stale()) return;
            listEl.innerHTML = '<p style="color:#c00;font-size:12px;">読み込みエラー</p>';
            console.error('添付ファイル読み込みエラー:', e);
        }
    };

    /** その一覧の要素が、今もこの予定の添付を表示しているか（別の予定を開き直していないか） */
    EventFiles._isShowing = function(listEl, eventId) {
        return !!listEl && (listEl._filesEventId === undefined || listEl._filesEventId === String(eventId));
    };

    /**
     * イベントの現在の添付件数を返す
     */
    EventFiles.countFiles = async function(eventId) {
        var result = await firebase.storage().ref(basePath(eventId)).listAll();
        return result.items.length;
    };

    /** イベントの添付ファイル名一覧 */
    EventFiles.listNames = async function(eventId) {
        var result = await firebase.storage().ref(basePath(eventId)).listAll();
        return result.items.map(function(it) { return it.name; });
    };

    /**
     * 既存の添付と名前が重ならないファイル名を返す（「案内.pdf」→「案内 (2).pdf」）。
     * 保存先パスはファイル名そのものなので、同じ名前のファイルを添付すると
     * 既存のファイルが警告なしに上書きされていた
     * @param {string} name
     * @param {Set<string>} taken - 使用済みの名前（呼び出し後、返した名前を追加する）
     */
    EventFiles.uniqueName = function(name, taken) {
        var result = name;
        if (taken.has(result)) {
            var m = String(name).match(/^(.*?)(\.[^.]*)?$/);
            var base = m[1], ext = m[2] || '';
            for (var n = 2; taken.has(result); n++) result = base + ' (' + n + ')' + ext;
        }
        taken.add(result);
        return result;
    };

    /**
     * ファイルを検証してアップロードし、一覧を再描画する。
     * 既存分込みで1イベント10個までに制限する（超える分はアップロードしない）。
     */
    EventFiles.upload = async function(eventId, files, listEl) {
        var v = EventFiles.validate(files);
        if (v.errors.length > 0) {
            alert('添付できないファイルがあります:\n' + v.errors.join('\n'));
        }
        if (v.ok.length === 0) {
            if (EventFiles._isShowing(listEl, eventId)) await EventFiles.render(eventId, listEl);
            return;
        }

        // 既存の添付数を数え、上限(10個)を超える分は弾く
        var existingCount = 0;
        var taken = new Set();
        try {
            var names = await EventFiles.listNames(eventId);
            existingCount = names.length;
            names.forEach(function(n) { taken.add(n); });
        } catch (e) {
            // 件数取得に失敗してもアップロード自体は試みる（上限チェックだけ諦める）
            console.warn('添付件数の取得に失敗:', e);
        }
        var room = MAX_FILES - existingCount;
        if (room <= 0) {
            alert('添付ファイルは1イベントにつき最大' + MAX_FILES + '個までです（現在' + existingCount + '個）。新しいファイルを追加するには、先に不要なファイルを削除してください。');
            if (EventFiles._isShowing(listEl, eventId)) await EventFiles.render(eventId, listEl);
            return;
        }
        var toUpload = v.ok;
        if (toUpload.length > room) {
            alert('添付ファイルは1イベントにつき最大' + MAX_FILES + '個までです（現在' + existingCount + '個・追加できるのは' + room + '個まで）。先頭' + room + '件のみアップロードします。');
            toUpload = toUpload.slice(0, room);
        }

        try {
            for (var i = 0; i < toUpload.length; i++) {
                var file = toUpload[i];
                // アップロード中に別の予定を開き直していたら、その予定の一覧には進み具合を書かない
                if (EventFiles._isShowing(listEl, eventId)) listEl.innerHTML = '<p style="color:#999;font-size:12px;">アップロード中... (' + (i + 1) + '/' + toUpload.length + ')</p>';
                await firebase.storage().ref(basePath(eventId) + '/' + EventFiles.uniqueName(file.name, taken)).put(file);
            }
        } catch (e) {
            alert('アップロードに失敗しました: ' + e.message);
            console.error('アップロードエラー:', e);
        }
        if (EventFiles._isShowing(listEl, eventId)) await EventFiles.render(eventId, listEl);
    };

    /**
     * イベント終了後 RETENTION_DAYS 日を過ぎた添付を削除する。
     * 1日1回だけ実行（localStorageで抑制）。マネージャーのhub起動時に呼ぶ。
     * @param {Array} events - 全イベント（FCOjima.Hub.events）
     */
    EventFiles.cleanupOldFiles = async function(events) {
        try {
            var todayKey = new Date().toISOString().slice(0, 10);
            var lastRun = localStorage.getItem('fcojima_files_cleanup');
            if (lastRun === todayKey) return; // 今日は実行済み
            localStorage.setItem('fcojima_files_cleanup', todayKey);

            var cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);
            var cutoffISO = cutoff.getFullYear() + '-' +
                ('0' + (cutoff.getMonth() + 1)).slice(-2) + '-' +
                ('0' + cutoff.getDate()).slice(-2);

            var eventById = {};
            (events || []).forEach(function(ev) { eventById[String(ev.id)] = ev; });

            // Storage上のイベントフォルダを列挙し、期限切れのものを削除
            var root = firebase.storage().ref('teams/' + FCOjimaFirebase.TEAM_ID + '/events');
            var listing = await root.listAll();
            for (var i = 0; i < listing.prefixes.length; i++) {
                var prefix = listing.prefixes[i];
                var evId = prefix.name;
                var ev = eventById[evId];
                var expired = false;
                if (ev) {
                    expired = !!(ev.date && ev.date < cutoffISO);
                } else {
                    // イベント自体が削除済み。IDがタイムスタンプ形式なら作成日から判断
                    var ts = parseInt(evId, 10);
                    expired = !isNaN(ts) && ts > 1000000000000 && ts < cutoff.getTime();
                }
                if (!expired) continue;

                var filesRes = await prefix.listAll();
                for (var j = 0; j < filesRes.items.length; j++) {
                    try { await filesRes.items[j].delete(); } catch (e) { /* 個別失敗は無視 */ }
                }
                if (filesRes.items.length > 0) {
                    console.log('期限切れ添付を削除: イベント' + evId + ' (' + filesRes.items.length + '件)');
                }
            }
        } catch (e) {
            // 掃除の失敗はアプリ動作に影響させない
            console.warn('添付ファイルの自動削除に失敗:', e);
        }
    };

})(window.FCOjima.EventFiles);
