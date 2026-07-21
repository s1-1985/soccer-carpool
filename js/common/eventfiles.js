/**
 * FC尾島ジュニア - イベント添付ファイル（共通モジュール）
 *
 * 保存先はFirebase Storageの teams/{TEAM_ID}/events/{eventId}/ で、
 * hubのイベントモーダル・配車管理画面のどこから添付しても同じ場所を参照する（＝同期）。
 *
 * 制限（2026-07-21ユーザー指定）:
 *  - 種類: PDF / Excel / Word / 画像 / テキスト
 *  - 1ファイル 10MB まで（storage.rules でもサーバー側で強制）
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
        listEl.innerHTML = '<p style="color:#999;font-size:12px;">読み込み中...</p>';
        try {
            var ref = firebase.storage().ref(basePath(eventId));
            var result = await ref.listAll();
            if (result.items.length === 0) {
                listEl.innerHTML = '<p style="color:#999;font-size:12px;">ファイルなし</p>';
                return;
            }
            listEl.innerHTML = '';
            for (var i = 0; i < result.items.length; i++) {
                var item = result.items[i];
                var url = await item.getDownloadURL();
                var a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.className = 'event-file-link';
                a.textContent = item.name;
                listEl.appendChild(a);
            }
        } catch (e) {
            listEl.innerHTML = '<p style="color:#c00;font-size:12px;">読み込みエラー</p>';
            console.error('添付ファイル読み込みエラー:', e);
        }
    };

    /**
     * ファイルを検証してアップロードし、一覧を再描画する
     */
    EventFiles.upload = async function(eventId, files, listEl) {
        var v = EventFiles.validate(files);
        if (v.errors.length > 0) {
            alert('添付できないファイルがあります:\n' + v.errors.join('\n'));
        }
        if (v.ok.length === 0) {
            if (listEl) await EventFiles.render(eventId, listEl);
            return;
        }
        try {
            for (var i = 0; i < v.ok.length; i++) {
                var file = v.ok[i];
                if (listEl) listEl.innerHTML = '<p style="color:#999;font-size:12px;">アップロード中... (' + (i + 1) + '/' + v.ok.length + ')</p>';
                await firebase.storage().ref(basePath(eventId) + '/' + file.name).put(file);
            }
        } catch (e) {
            alert('アップロードに失敗しました: ' + e.message);
            console.error('アップロードエラー:', e);
        }
        if (listEl) await EventFiles.render(eventId, listEl);
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
