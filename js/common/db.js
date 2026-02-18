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
        return snapshot.docs.map(doc => ({ id: Number(doc.id) || doc.id, ...doc.data() }));
    };

    DB.saveMember = async function(member) {
        if (member.id) {
            const id = String(member.id);
            const data = Object.assign({}, member);
            delete data.id;
            await Collections.members().doc(id).set(data, { merge: true });
        } else {
            const ref = await Collections.members().add(member);
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
        return snapshot.docs.map(doc => ({ id: Number(doc.id) || doc.id, ...doc.data() }));
    };

    DB.saveVenues = async function(venues) {
        const batch = db.batch();
        const snapshot = await Collections.venues().get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        venues.forEach(venue => {
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
        return snapshot.docs.map(doc => ({ id: Number(doc.id) || doc.id, ...doc.data() }));
    };

    DB.saveEvents = async function(events) {
        const batch = db.batch();
        const snapshot = await Collections.events().get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        events.forEach(event => {
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
        notifications.forEach(n => {
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
        return { carRegistrations: [], assignments: [], attendance: [], notifications: [] };
    };

    DB.saveEventData = async function(eventId, data) {
        await Collections.eventData(eventId).set(data, { merge: true });
    };

    // ========== 全データ一括ロード ==========

    DB.loadAllData = async function() {
        const [members, venues, events, notifications, logs] = await Promise.all([
            DB.loadMembers(),
            DB.loadVenues(),
            DB.loadEvents(),
            DB.loadNotifications(),
            DB.loadLogs()
        ]);
        return { members, venues, events, notifications, logs };
    };

})(FCOjima.DB);
