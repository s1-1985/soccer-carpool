/**
 * FC尾島ジュニア - Firestore データベースモジュール
 * localStorageの代わりにFirestoreを使用する非同期データ操作
 */

window.FCOjima = window.FCOjima || {};
FCOjima.DB = FCOjima.DB || {};

(function(DB) {
    const { db, Collections, TEAM_ID } = window.FCOjimaFirebase;

    // ========== 一覧保存の共通処理（差分のみ書き込み） ==========
    //
    // 以前の saveMembers/saveVenues/saveEvents/saveNotifications は
    // 「コレクションを全件削除 → 手元の配列で全件書き直し」方式で、次の問題があった:
    //  1) 他の人が後から追加したドキュメントを、古い手元の配列で消してしまう
    //     （例: 2人がほぼ同時に連絡事項を投稿すると先の投稿が消える）
    //  2) 1件変えるだけでも全件の読み直し＋削除＋書き込みが走る。イベントは削除されず
    //     毎年増え続けるため、保存が年々重くなり無料枠（書き込み2万/日）も圧迫する
    // 最後に読み込んだ／保存した内容（baseline）と比べ、変わったドキュメントだけを
    // 書き込み、手元で削除されたものだけを削除する。baselineに無いドキュメント
    // （読み込み後に他の人が追加したもの）には触れない。
    const _baselines = {}; // { members: Map<id, stableJSON>, ... }

    /** キー順に依存しないJSON文字列（変更検出用） */
    function stableStringify(v) {
        if (v === undefined) return 'null';
        if (v === null || typeof v !== 'object') return JSON.stringify(v);
        if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
        return '{' + Object.keys(v).filter(function(k) { return v[k] !== undefined; }).sort()
            .map(function(k) { return JSON.stringify(k) + ':' + stableStringify(v[k]); }).join(',') + '}';
    }

    /** Firestoreが拒否する undefined を除去（プレーンなオブジェクト・配列のみ辿る） */
    function cleanForFirestore(v) {
        if (Array.isArray(v)) return v.map(function(x) { return x === undefined ? null : cleanForFirestore(x); });
        if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
            const out = {};
            Object.keys(v).forEach(function(k) { if (v[k] !== undefined) out[k] = cleanForFirestore(v[k]); });
            return out;
        }
        return v;
    }

    /**
     * 一覧の読み込み結果がサーバーからのものか確認する。
     * オフライン時、一覧の get() はエラーにならず端末内キャッシュ（初回は空）を返すため、
     * そのまま「サーバーのデータ」として扱うと、空の一覧を見た画面が端末に残っている古いデータに
     * 差し替え、その古い内容で保存して他の人の変更を上書きしていた
     */
    function ensureFromServer(snapshot) {
        if (snapshot && snapshot.metadata && snapshot.metadata.fromCache) {
            const err = new Error('サーバーに接続できません（オフライン）');
            err.code = 'unavailable';
            throw err;
        }
    }
    DB.ensureFromServer = ensureFromServer;

    /** 読み込んだドキュメント群をbaselineとして記録する */
    function rememberDocs(name, docs) {
        const m = new Map();
        docs.forEach(function(doc) { m.set(String(doc.id), stableStringify(doc.data())); });
        _baselines[name] = m;
    }

    /**
     * Firestoreのスナップショットをbaselineとして記録する
     * （リアルタイムリスナーで一覧を差し替えたときに呼ぶ）
     */
    DB.rememberSnapshot = function(name, snapshot) {
        rememberDocs(name, snapshot.docs);
    };

    async function syncCollection(name, colRef, items) {
        // 一度もサーバーから読み込めていない（オフライン等で端末内の古いデータにフォールバック中）
        // ときは、手元のどれが変更なのか判断できない。そのまま書くと古い内容で他の人の変更を
        // 上書きしてしまうため保存しない
        if (!_baselines[name]) {
            const err = new Error('サーバーから最新のデータを読み込めていないため保存できません。電波の良い所でページを再読み込みしてから、もう一度操作してください');
            err.code = 'not-loaded';
            throw err;
        }
        const base = _baselines[name];
        const next = new Map(base);
        const ops = [];
        const seen = new Set();
        (items || []).forEach(function(item) {
            if (!item || item.id === undefined || item.id === null || item.id === '') return; // IDなしはスキップ
            const id = String(item.id);
            seen.add(id);
            const data = cleanForFirestore(Object.assign({}, item));
            delete data.id;
            const json = stableStringify(data);
            if (base.get(id) === json) return; // 変更なし
            ops.push({ type: 'set', id: id, data: data });
            next.set(id, json);
        });
        base.forEach(function(_, id) {
            if (!seen.has(id)) {
                ops.push({ type: 'delete', id: id });
                next.delete(id);
            }
        });
        if (ops.length === 0) return;

        // 連続保存で同じ書き込みを繰り返さないよう先にbaselineを進め、失敗したら戻す
        _baselines[name] = next;
        try {
            // 初回の大量移行などで1回のバッチが大きくなりすぎないよう分割する
            for (let i = 0; i < ops.length; i += 400) {
                const batch = db.batch();
                ops.slice(i, i + 400).forEach(function(op) {
                    const ref = colRef.doc(op.id);
                    if (op.type === 'set') batch.set(ref, op.data);
                    else batch.delete(ref);
                });
                await batch.commit();
            }
        } catch (e) {
            if (_baselines[name] === next) _baselines[name] = base;
            throw e;
        }
    }

    // ========== 読み込んだデータの形を整える ==========
    //
    // Firebase Console での手入力や古いバージョンのデータで、配列のはずの項目が文字列だったり
    // 配列の中に null が混ざっていたりすると、その1件のせいで画面の初期化全体が例外で止まり
    // （例: メンバーの childrenIds が文字列 → HUBが開けない）、全員がアプリを使えなくなっていた。
    // 存在する項目の型だけを直す（無い項目は足さない。足すと保存時に全件が「変更あり」になり、
    // 他の人が変えたドキュメントまで書き戻してしまうため）
    function toArray(v) {
        if (Array.isArray(v)) return v;
        if (v === undefined || v === null || v === '') return [];
        return (typeof v === 'object') ? [] : [v];
    }
    function fixArrayField(obj, key, mapFn) {
        if (obj && obj[key] !== undefined && (!Array.isArray(obj[key]) || mapFn)) {
            var arr = toArray(obj[key]);
            obj[key] = mapFn ? arr.filter(function(x) { return x !== null && x !== undefined; }).map(mapFn) : arr;
        }
    }
    DB.normalizeMember = function(m) {
        fixArrayField(m, 'childrenIds', String);
        fixArrayField(m, 'formerNames', String);
        // 兄弟児（チームに所属していない子）: [{ name, note }]。名前のない要素は除く
        if (m && m.siblings !== undefined) {
            m.siblings = toArray(m.siblings).filter(function(s) {
                return s && typeof s === 'object' && typeof s.name === 'string' && s.name.trim() !== '';
            });
        }
        return m;
    };
    DB.normalizeEvent = function(ev) {
        fixArrayField(ev, 'target', String);
        fixArrayField(ev, 'extraPlayers', String);
        if (ev && ev.luggage !== undefined && !Array.isArray(ev.luggage)) ev.luggage = [];
        return ev;
    };
    /** イベントデータ（出欠・配車）。配列でない項目は空に、配列内の壊れた要素は除く */
    DB.normalizeEventData = function(data) {
        if (!data || typeof data !== 'object') return data;
        var isObj = function(x) { return x && typeof x === 'object' && !Array.isArray(x); };
        ['attendance', 'carRegistrations', 'assignments', 'notifications', 'comments'].forEach(function(k) {
            if (data[k] === undefined) return;
            data[k] = toArray(data[k]).filter(isObj);
        });
        if (Array.isArray(data.attendance)) {
            data.attendance = data.attendance.filter(function(a) { return typeof a.name === 'string' && a.name !== ''; });
        }
        ['attendanceRemoved', 'manualDriverNames'].forEach(function(k) {
            if (data[k] !== undefined) data[k] = toArray(data[k]).filter(function(x) { return typeof x === 'string'; });
        });
        return data;
    };

    // ========== メンバー ==========

    DB.loadMembers = async function() {
        // ※ orderBy('role') だと role の無いメンバー（Firebase Console での手入力など）が結果に含まれず、
        //   名簿にも出欠にも出てこない（予定の orderBy('date') と同じ）。全件取得して役割順に並べる
        //   （以前と同じ並び: 役割の文字列順、同じ役割の中はドキュメントID順）
        const snapshot = await Collections.members().get();
        ensureFromServer(snapshot);
        rememberDocs('members', snapshot.docs);
        const members = snapshot.docs.map(doc => DB.normalizeMember({ id: doc.id, ...doc.data() }));
        members.sort(function(a, b) {
            const ra = String(a.role || ''), rb = String(b.role || '');
            return ra < rb ? -1 : ra > rb ? 1 : 0;
        });
        // 4月1日を過ぎると学年が変わるため、birthから毎回再計算して上書き
        const Utils = window.FCOjima && FCOjima.Utils;
        if (Utils && Utils.calculateGrade) {
            members.forEach(function(m) {
                if (m.role === 'player' && m.birth) {
                    m.grade = Utils.calculateGrade(m.birth);
                }
            });
        }
        return members;
    };

    DB.saveMember = async function(member) {
        if (member.id) {
            const id = String(member.id);
            const data = Object.assign({}, member);
            delete data.id;
            await Collections.members().doc(id).set(data, { merge: true });
        } else {
            const ref = await Collections.members().add(member);
            member.id = ref.id; // 新規追加時はidをメンバーオブジェクトに反映
            return ref.id;
        }
    };

    DB.deleteMember = async function(memberId) {
        await Collections.members().doc(String(memberId)).delete();
    };

    DB.saveMembers = async function(members) {
        await syncCollection('members', Collections.members(), members);
    };

    /**
     * 保護者のメンバー情報に兄弟児を1人加える／外す（兄弟児の項目だけを書き換える。
     * 保護者本人も自分の家族の分だけ変更できる: firestore.rules の members を参照）
     * @param {string} memberId
     * @param {{name:string, note:string}} sibling - 外すときは読み込んだときの内容そのもの
     */
    DB.addMemberSibling = async function(memberId, sibling) {
        await Collections.members().doc(String(memberId)).update({
            siblings: firebase.firestore.FieldValue.arrayUnion({ name: String(sibling.name), note: String(sibling.note || '') })
        });
    };
    DB.removeMemberSibling = async function(memberId, sibling) {
        await Collections.members().doc(String(memberId)).update({
            siblings: firebase.firestore.FieldValue.arrayRemove(sibling)
        });
    };

    // ========== 会場 ==========

    DB.loadVenues = async function() {
        const snapshot = await Collections.venues().get();
        ensureFromServer(snapshot);
        rememberDocs('venues', snapshot.docs);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    DB.saveVenues = async function(venues) {
        await syncCollection('venues', Collections.venues(), venues);
    };

    // ========== イベント（予定） ==========

    DB.loadEvents = async function() {
        // ※ orderBy('date') だと date の無いイベントは結果に含まれない（Firestoreの仕様）。
        //   並べ替えは表示側（Utils.compareEvents）で行うため、ここでは全件取得する
        const snapshot = await Collections.events().get();
        ensureFromServer(snapshot);
        rememberDocs('events', snapshot.docs);
        return snapshot.docs.map(doc => DB.normalizeEvent({ id: doc.id, ...doc.data() }));
    };

    DB.saveEvents = async function(events) {
        await syncCollection('events', Collections.events(), events);
    };

    /**
     * 予定の学年外追加選手（extraPlayers）に1人加える（他の項目・他の人の追加には触れない）
     */
    DB.addEventExtraPlayer = async function(eventId, name) {
        await Collections.events().doc(String(eventId)).update({
            extraPlayers: firebase.firestore.FieldValue.arrayUnion(String(name))
        });
    };
    DB.removeEventExtraPlayer = async function(eventId, name) {
        await Collections.events().doc(String(eventId)).update({
            extraPlayers: firebase.firestore.FieldValue.arrayRemove(String(name))
        });
    };

    /** 指定した日の予定（配車管理のページなど、予定の一覧を読み込んでいない画面から使う） */
    DB.loadEventsOnDate = async function(date) {
        const snapshot = await Collections.events().where('date', '==', String(date)).get();
        ensureFromServer(snapshot);
        return snapshot.docs.map(doc => DB.normalizeEvent({ id: doc.id, ...doc.data() }));
    };

    // ========== 連絡事項 ==========

    DB.loadNotifications = async function() {
        // 3ヶ月より古い連絡事項は表示しない（次回保存時に削除される）。
        // 以前は where('date','>=', 'YYYY-MM-DD') で絞っていたが、保存される日付は
        // 'YYYY/MM/DD HH:MM' 形式で文字列比較が噛み合わず、絞り込みが効いていなかった。
        // 件数はたかが知れているので全件読み、日付を解釈して判定する
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const snapshot = await Collections.notifications().get();
        ensureFromServer(snapshot);
        // 期限切れも含めてbaselineに記録 → 返り値から外れたものは次回保存で削除される
        rememberDocs('notifications', snapshot.docs);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(function(n) {
                const t = new Date(n.date).getTime();
                return isNaN(t) || t >= threeMonthsAgo.getTime();
            })
            .sort(function(a, b) {
                return (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0);
            });
    };

    DB.saveNotifications = async function(notifications) {
        (notifications || []).forEach((n, i) => {
            // ID未付与の旧データはここで採番（String(undefined)="undefined" の
            // 同一ドキュメントに全件が上書きされ消失するのを防ぐ）
            if (!n.id) n.id = Date.now().toString() + '_' + i;
        });
        await syncCollection('notifications', Collections.notifications(), notifications);
    };

    /** 連絡事項を1件、ID を指定して書き込む／消す（一覧全体の保存を経由しない） */
    DB.putNotification = async function(notification) {
        const data = Object.assign({}, notification);
        const id = String(data.id);
        delete data.id;
        await Collections.notifications().doc(id).set(cleanForFirestore(data));
    };
    DB.deleteNotification = async function(id) {
        await Collections.notifications().doc(String(id)).delete();
    };

    DB.addNotification = async function(notification) {
        const ref = await Collections.notifications().add(notification);
        return ref.id;
    };

    // ========== ログ ==========

    DB.loadLogs = async function() {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        // 古い順で返す（Storage.addLog が新しいログを末尾に追加し、ログ表示側は
        // 末尾＝最新として扱うため。降順で返すとログ画面に最古の50件が並び、
        // イベント詳細の「直近5件」も最古の5件になっていた）
        const snapshot = await Collections.logs()
            .where('datetime', '>=', threeMonthsAgo.toISOString())
            .orderBy('datetime', 'asc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    /**
     * @param {Object} [extra] - 追加フィールド（例: { eventId }。イベント詳細のログ絞り込みに使う）
     */
    DB.addLog = async function(type, action, details, extra) {
        const user = FCOjima.Auth ? FCOjima.Auth.getDisplayName() : 'システム';
        const now = new Date();
        const canRestore = action.includes('削除');

        const log = {
            datetime: now.toISOString(),
            user: user,
            type: type,
            action: action,
            details: details || '',
            canRestore: canRestore,
            restoreDeadline: canRestore
                ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
                : null
        };
        if (extra && extra.eventId !== undefined && extra.eventId !== null) {
            log.eventId = String(extra.eventId);
        }

        await Collections.logs().add(log);
    };

    // ========== イベント固有データ（配車・出欠） ==========

    DB.loadEventData = async function(eventId) {
        const doc = await Collections.eventData(eventId).get();
        if (doc.exists) {
            return DB.normalizeEventData(doc.data());
        }
        return null; // ドキュメントが存在しない場合は null を返す（呼び出し側で localStorage にフォールバック）
    };

    DB.saveEventData = async function(eventId, data) {
        await Collections.eventData(eventId).set(cleanForFirestore(data), { merge: true });
    };

    /**
     * イベント固有データをトランザクションで読み込み→更新する。
     * updater(現在のデータ or null) が返したフィールドだけを書き込む（merge）。
     * 保護者が同時に出欠を回答したときなどに、古い手元の内容で他の人の変更を
     * 上書きしないために使う。
     * @param {string|number} eventId
     * @param {function(Object|null): Object} updater
     */
    DB.updateEventData = async function(eventId, updater) {
        const ref = Collections.eventData(eventId);
        return db.runTransaction(async function(tx) {
            const snap = await tx.get(ref);
            const patch = updater(snap.exists ? snap.data() : null);
            if (patch && Object.keys(patch).length > 0) {
                tx.set(ref, cleanForFirestore(patch), { merge: true });
            }
            return patch;
        });
    };

    DB.deleteEventData = async function(eventId) {
        await Collections.eventData(eventId).delete();
    };

    // ========== 全データ一括ロード ==========

    DB.loadAllData = async function() {
        // members/venues/events/notifications は承認済みなら全員読める。
        // logs だけはマネージャー限定（Firestoreルール）なので、一般保護者では
        // permission-denied になる。これを Promise.all に含めると失敗が伝播して
        // 全データがロードできず、保護者の画面が空になる（重大バグ）。
        // logs は別扱いにして失敗を握りつぶす。
        const [members, venues, events, notifications] = await Promise.all([
            DB.loadMembers(),
            DB.loadVenues(),
            DB.loadEvents(),
            DB.loadNotifications()
        ]);
        let logs = [];
        try {
            logs = await DB.loadLogs();
        } catch (e) {
            console.warn('ログの読み込みをスキップ（権限がない可能性）:', e && e.code ? e.code : e);
        }

        let dutySettings = { enabled: false }, dutyGroups = [], dutyAssignments = [];
        try {
            const [ds, dg, da] = await Promise.all([
                DB.loadDutySettings(),
                DB.loadDutyGroups(),
                DB.loadDutyAssignments()
            ]);
            dutySettings = ds;
            dutyGroups = dg;
            dutyAssignments = da;
        } catch (e) {
            console.warn('当番表データの読み込みをスキップ:', e && e.code ? e.code : e);
        }

        return { members, venues, events, notifications, logs, dutySettings, dutyGroups, dutyAssignments };
    };

    // ========== ユーザー管理（保護者承認・役割管理） ==========

    DB.loadUserProfile = async function(uid) {
        const doc = await db.collection('teams').doc(TEAM_ID)
            .collection('users').doc(uid).get();
        return doc.exists ? { uid, ...doc.data() } : null;
    };

    DB.createUserProfile = async function(uid, data) {
        await db.collection('teams').doc(TEAM_ID)
            .collection('users').doc(uid).set({
                ...data,
                status: 'pending',
                registeredAt: firebase.firestore.FieldValue.serverTimestamp()
            });
    };

    DB.loadPendingUsers = async function() {
        const snap = await db.collection('teams').doc(TEAM_ID)
            .collection('users').where('status', '==', 'pending').get();
        const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        users.sort(function(a, b) {
            var ta = a.registeredAt ? (a.registeredAt.seconds || 0) : 0;
            var tb = b.registeredAt ? (b.registeredAt.seconds || 0) : 0;
            return ta - tb;
        });
        return users;
    };

    DB.loadAllUsers = async function() {
        const snap = await db.collection('teams').doc(TEAM_ID)
            .collection('users').get();
        const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        users.sort(function(a, b) {
            var ta = a.registeredAt ? (a.registeredAt.seconds || 0) : 0;
            var tb = b.registeredAt ? (b.registeredAt.seconds || 0) : 0;
            return ta - tb;
        });
        return users;
    };

    /**
     * @param {Array<string>|null} [childrenIds] - 承認時に管理者が照合した子供（null/省略なら変更しない）
     */
    DB.approveUser = async function(uid, approvedByUid, childrenIds) {
        const data = {
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: approvedByUid
        };
        if (Array.isArray(childrenIds)) {
            data.childrenIds = childrenIds.map(String);
            data.childrenLinked = true; // 管理者が照合済み（入力された氏名での自動照合はしない）
        }
        await db.collection('teams').doc(TEAM_ID)
            .collection('users').doc(uid).update(data);
    };

    DB.rejectUser = async function(uid) {
        await db.collection('teams').doc(TEAM_ID)
            .collection('users').doc(uid).update({
                status: 'rejected'
            });
    };

    DB.updateUserRole = async function(uid, role) {
        await db.collection('teams').doc(TEAM_ID)
            .collection('users').doc(uid).update({ role });
    };

    // ========== 当番表（グループ設定）==========

    DB.loadDutySettings = async function() {
        const doc = await Collections.dutySettings().get();
        return doc.exists ? doc.data() : { enabled: false };
    };

    DB.saveDutySettings = async function(settings) {
        await Collections.dutySettings().set(settings, { merge: true });
    };

    DB.loadDutyGroups = async function() {
        const snapshot = await Collections.dutyGroups().get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    DB.saveDutyGroup = async function(group) {
        if (group.id) {
            const id = String(group.id);
            const data = Object.assign({}, group);
            delete data.id;
            await Collections.dutyGroups().doc(id).set(data, { merge: true });
            return id;
        } else {
            const ref = await Collections.dutyGroups().add({
                name: group.name,
                memberIds: group.memberIds || []
            });
            return ref.id;
        }
    };

    // メンバーの追加・削除はarrayUnion/arrayRemoveで行う（読み取り→全件書き戻し方式だと、
    // 複数マネージャーが同時に別メンバーを追加/削除した場合に後勝ちで一方が消える）
    DB.addDutyGroupMember = async function(groupId, memberId) {
        await Collections.dutyGroups().doc(String(groupId)).update({
            memberIds: firebase.firestore.FieldValue.arrayUnion(String(memberId))
        });
    };

    DB.removeDutyGroupMember = async function(groupId, memberId) {
        await Collections.dutyGroups().doc(String(groupId)).update({
            memberIds: firebase.firestore.FieldValue.arrayRemove(String(memberId))
        });
    };

    DB.deleteDutyGroup = async function(groupId) {
        await Collections.dutyGroups().doc(String(groupId)).delete();
    };

    // ========== 荷物（共用備品）マスタ ==========

    DB.loadLuggageItems = async function() {
        const doc = await Collections.luggageSettings().get();
        return (doc.exists && Array.isArray(doc.data().items)) ? doc.data().items : [];
    };

    DB.saveLuggageItems = async function(items) {
        await Collections.luggageSettings().set({ items: items }, { merge: true });
    };

    // 荷物の追加・削除は arrayUnion/arrayRemove で行う（読み込み→全件書き戻しだと、
    // 2人の管理者がほぼ同時に追加すると後から保存した方に上書きされて片方が消える）
    DB.addLuggageItem = async function(name) {
        await Collections.luggageSettings().set({
            items: firebase.firestore.FieldValue.arrayUnion(String(name))
        }, { merge: true });
    };

    DB.removeLuggageItem = async function(name) {
        await Collections.luggageSettings().set({
            items: firebase.firestore.FieldValue.arrayRemove(String(name))
        }, { merge: true });
    };

    // ========== 指導者（監督・コーチ）の都合と担当 ==========
    // coachAvailability/{メンバーID}: { name, answers: { 'YYYY-MM-DD': { s: 'ok'|'am'|'pm'|'ng', note } } }
    // coachAssignments/{予定ID}: { memberIds: [メンバーID] }
    // 新しいコレクションのルールは main へのマージ時にデプロイされるため、読み込みは呼び出し側で失敗しても
    // 他の画面に影響しないようにする（loadAllData の Promise.all には入れない）
    function coachAvailabilityCol() { return Collections.members().parent.collection('coachAvailability'); }
    function coachAssignmentsCol() { return Collections.members().parent.collection('coachAssignments'); }

    DB.loadCoachAvailability = async function() {
        const snapshot = await coachAvailabilityCol().get();
        ensureFromServer(snapshot);
        const map = {};
        snapshot.docs.forEach(doc => {
            const d = doc.data() || {};
            map[doc.id] = { name: d.name || '', answers: (d.answers && typeof d.answers === 'object') ? d.answers : {} };
        });
        return map;
    };

    /**
     * 指導者のある日の都合を保存する（その日の分だけ。他の日の回答には触れない）
     * @param {Object|null} value - { s, note }。null なら回答を取り消す
     */
    DB.setCoachAvailability = async function(memberId, name, date, value) {
        const answers = {};
        answers[String(date)] = value ? { s: String(value.s), note: String(value.note || '') } : firebase.firestore.FieldValue.delete();
        await coachAvailabilityCol().doc(String(memberId)).set({ name: String(name || ''), answers: answers }, { merge: true });
    };

    DB.loadCoachAssignments = async function() {
        const snapshot = await coachAssignmentsCol().get();
        const map = {};
        snapshot.docs.forEach(doc => {
            const ids = (doc.data() || {}).memberIds;
            map[doc.id] = Array.isArray(ids) ? ids.map(String) : [];
        });
        return map;
    };

    /** 予定に指導者を付ける／外す（その1人だけ。同時に他の人が付けた分は消えない） */
    DB.setCoachAssigned = async function(eventId, memberId, on) {
        const op = on ? firebase.firestore.FieldValue.arrayUnion(String(memberId)) : firebase.firestore.FieldValue.arrayRemove(String(memberId));
        await coachAssignmentsCol().doc(String(eventId)).set({ memberIds: op }, { merge: true });
    };

    // ========== 当番割り当て（イベント×グループ）==========

    DB.loadDutyAssignments = async function() {
        const snapshot = await Collections.dutyAssignments().get();
        return snapshot.docs.map(doc => ({ eventId: doc.id, ...doc.data() }));
    };

    DB.saveDutyAssignment = async function(eventId, data) {
        await Collections.dutyAssignments().doc(String(eventId)).set(data);
    };

    DB.deleteDutyAssignment = async function(eventId) {
        await Collections.dutyAssignments().doc(String(eventId)).delete();
    };

    /** グループ名の変更を、そのグループを割り当てた予定の割り当てにも反映する */
    DB.renameDutyAssignmentsGroup = async function(groupId, groupName) {
        const snap = await Collections.dutyAssignments().where('groupId', '==', String(groupId)).get();
        if (snap.empty) return;
        const batch = db.batch();
        snap.docs.forEach(function(doc) { batch.update(doc.ref, { groupName: groupName }); });
        await batch.commit();
    };

    /** 削除したグループを割り当てていた予定の割り当てを削除する */
    DB.deleteDutyAssignmentsForGroup = async function(groupId) {
        const snap = await Collections.dutyAssignments().where('groupId', '==', String(groupId)).get();
        if (snap.empty) return;
        const batch = db.batch();
        snap.docs.forEach(function(doc) { batch.delete(doc.ref); });
        await batch.commit();
    };

})(FCOjima.DB);
