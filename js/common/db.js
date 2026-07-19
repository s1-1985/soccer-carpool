/**
 * FC尾島ジュニア - Firestore データベースモジュール
 * localStorageの代わりにFirestoreを使用する非同期データ操作
 */

window.FCOjima = window.FCOjima || {};
FCOjima.DB = FCOjima.DB || {};

(function(DB) {
    const { db, Collections, TEAM_ID } = window.FCOjimaFirebase;

    // ========== メンバー ==========

    DB.loadMembers = async function() {
        const snapshot = await Collections.members().orderBy('role').get();
        const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        const batch = db.batch();
        // 既存ドキュメントをすべて削除してから書き直す
        const snapshot = await Collections.members().get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        members.forEach(member => {
            if (!member.id) return; // IDなしメンバーはスキップ
            const data = Object.assign({}, member);
            const id = String(data.id);
            delete data.id;
            batch.set(Collections.members().doc(id), data);
        });
        await batch.commit();
    };

    // ========== 会場 ==========

    DB.loadVenues = async function() {
        const snapshot = await Collections.venues().get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    DB.saveVenues = async function(venues) {
        const batch = db.batch();
        const snapshot = await Collections.venues().get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        venues.forEach(venue => {
            if (!venue.id) return; // IDなし会場はスキップ
            const data = Object.assign({}, venue);
            const id = String(data.id);
            delete data.id;
            batch.set(Collections.venues().doc(id), data);
        });
        await batch.commit();
    };

    // ========== イベント（予定） ==========

    DB.loadEvents = async function() {
        const snapshot = await Collections.events().orderBy('date').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    DB.saveEvents = async function(events) {
        const batch = db.batch();
        const snapshot = await Collections.events().get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        events.forEach(event => {
            if (!event.id) return; // IDなしイベントはスキップ
            const data = Object.assign({}, event);
            const id = String(data.id);
            delete data.id;
            batch.set(Collections.events().doc(id), data);
        });
        await batch.commit();
    };

    // ========== 連絡事項 ==========

    DB.loadNotifications = async function() {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const cutoff = threeMonthsAgo.toISOString().split('T')[0];

        const snapshot = await Collections.notifications()
            .where('date', '>=', cutoff)
            .orderBy('date', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    DB.saveNotifications = async function(notifications) {
        const batch = db.batch();
        const snapshot = await Collections.notifications().get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        notifications.forEach((n, i) => {
            // ID未付与の旧データはここで採番（String(undefined)="undefined" の
            // 同一ドキュメントに全件が上書きされ消失するのを防ぐ）
            if (!n.id) n.id = Date.now().toString() + '_' + i;
            const data = Object.assign({}, n);
            const id = String(data.id);
            delete data.id;
            batch.set(Collections.notifications().doc(id), data);
        });
        await batch.commit();
    };

    DB.addNotification = async function(notification) {
        const ref = await Collections.notifications().add(notification);
        return ref.id;
    };

    // ========== ログ ==========

    DB.loadLogs = async function() {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const snapshot = await Collections.logs()
            .where('datetime', '>=', threeMonthsAgo.toISOString())
            .orderBy('datetime', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    DB.addLog = async function(type, action, details) {
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

        await Collections.logs().add(log);
    };

    // ========== イベント固有データ（配車・出欠） ==========

    DB.loadEventData = async function(eventId) {
        const doc = await Collections.eventData(eventId).get();
        if (doc.exists) {
            return doc.data();
        }
        return null; // ドキュメントが存在しない場合は null を返す（呼び出し側で localStorage にフォールバック）
    };

    DB.saveEventData = async function(eventId, data) {
        await Collections.eventData(eventId).set(data, { merge: true });
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

    DB.approveUser = async function(uid, approvedByUid) {
        await db.collection('teams').doc(TEAM_ID)
            .collection('users').doc(uid).update({
                status: 'approved',
                approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                approvedBy: approvedByUid
            });
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

})(FCOjima.DB);
