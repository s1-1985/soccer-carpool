/**
 * FC尾島ジュニア - Firestore データベース操作
 * 既存のstorage.jsの代替として、Firestoreでデータ管理
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Firestore = FCOjima.Firestore || {};

// Firestoreモジュール
(function () {
    const Firestore = FCOjima.Firestore;
    const db = firebase.firestore();

    // コレクション名の定数
    const COLLECTIONS = {
        TEAMS: 'teams',
        EVENTS: 'events',
        MEMBERS: 'members',
        VENUES: 'venues',
        NOTIFICATIONS: 'notifications',
        CARPOOL: 'carpool',
        USERS: 'users',
        LOGS: 'logs'
    };

    // チームID（固定）
    const TEAM_ID = 'fc-ojima';

    /**
     * チーム用のドキュメント参照を取得
     */
    function getTeamCollection(collectionName) {
        return db.collection(COLLECTIONS.TEAMS).doc(TEAM_ID).collection(collectionName);
    }

    // ==================== イベント管理 ====================

    /**
     * イベント一覧を取得
     */
    Firestore.loadEvents = async function () {
        try {
            const snapshot = await getTeamCollection(COLLECTIONS.EVENTS)
                .orderBy('date', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Timestamp を Date に変換
                date: doc.data().date?.toDate() || new Date(doc.data().date),
                createdAt: doc.data().createdAt?.toDate() || null,
                updatedAt: doc.data().updatedAt?.toDate() || null
            }));
        } catch (error) {
            console.error('イベント読み込みエラー:', error);
            return [];
        }
    };

    /**
     * イベントを保存
     */
    Firestore.saveEvents = async function (events) {
        try {
            const batch = db.batch();
            const eventsRef = getTeamCollection(COLLECTIONS.EVENTS);

            for (const event of events) {
                const eventData = {
                    ...event,
                    date: firebase.firestore.Timestamp.fromDate(new Date(event.date)),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (event.id) {
                    // 既存イベントの更新
                    batch.update(eventsRef.doc(event.id), eventData);
                } else {
                    // 新規イベントの追加
                    const newEventRef = eventsRef.doc();
                    batch.set(newEventRef, {
                        ...eventData,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            await batch.commit();
            return true;
        } catch (error) {
            console.error('イベント保存エラー:', error);
            return false;
        }
    };

    /**
     * イベントをリアルタイム監視
     */
    Firestore.watchEvents = function (callback) {
        return getTeamCollection(COLLECTIONS.EVENTS)
            .orderBy('date', 'desc')
            .onSnapshot((snapshot) => {
                const events = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: doc.data().date?.toDate() || new Date(doc.data().date)
                }));
                callback(events);
            });
    };

    // ==================== メンバー管理 ====================

    /**
     * メンバー一覧を取得
     */
    Firestore.loadMembers = async function () {
        try {
            const snapshot = await getTeamCollection(COLLECTIONS.MEMBERS)
                .orderBy('name')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                birthDate: doc.data().birthDate?.toDate() || new Date(doc.data().birthDate),
                createdAt: doc.data().createdAt?.toDate() || null
            }));
        } catch (error) {
            console.error('メンバー読み込みエラー:', error);
            return [];
        }
    };

    /**
     * メンバーを保存
     */
    Firestore.saveMembers = async function (members) {
        try {
            const batch = db.batch();
            const membersRef = getTeamCollection(COLLECTIONS.MEMBERS);

            for (const member of members) {
                const memberData = {
                    ...member,
                    birthDate: firebase.firestore.Timestamp.fromDate(new Date(member.birthDate)),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (member.id) {
                    batch.update(membersRef.doc(member.id), memberData);
                } else {
                    const newMemberRef = membersRef.doc();
                    batch.set(newMemberRef, {
                        ...memberData,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            await batch.commit();
            return true;
        } catch (error) {
            console.error('メンバー保存エラー:', error);
            return false;
        }
    };

    // ==================== 会場管理 ====================

    /**
     * 会場一覧を取得
     */
    Firestore.loadVenues = async function () {
        try {
            const snapshot = await getTeamCollection(COLLECTIONS.VENUES)
                .orderBy('name')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('会場読み込みエラー:', error);
            return [];
        }
    };

    /**
     * 会場を保存
     */
    Firestore.saveVenues = async function (venues) {
        try {
            const batch = db.batch();
            const venuesRef = getTeamCollection(COLLECTIONS.VENUES);

            for (const venue of venues) {
                const venueData = {
                    ...venue,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (venue.id) {
                    batch.update(venuesRef.doc(venue.id), venueData);
                } else {
                    const newVenueRef = venuesRef.doc();
                    batch.set(newVenueRef, {
                        ...venueData,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            await batch.commit();
            return true;
        } catch (error) {
            console.error('会場保存エラー:', error);
            return false;
        }
    };

    // ==================== 連絡事項管理 ====================

    /**
     * 連絡事項一覧を取得
     */
    Firestore.loadNotifications = async function () {
        try {
            const snapshot = await getTeamCollection(COLLECTIONS.NOTIFICATIONS)
                .orderBy('date', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate() || new Date(doc.data().date),
                createdAt: doc.data().createdAt?.toDate() || null
            }));
        } catch (error) {
            console.error('連絡事項読み込みエラー:', error);
            return [];
        }
    };

    /**
     * 連絡事項を保存
     */
    Firestore.saveNotifications = async function (notifications) {
        try {
            const batch = db.batch();
            const notificationsRef = getTeamCollection(COLLECTIONS.NOTIFICATIONS);

            for (const notification of notifications) {
                const notificationData = {
                    ...notification,
                    date: firebase.firestore.Timestamp.fromDate(new Date(notification.date)),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                if (notification.id) {
                    batch.update(notificationsRef.doc(notification.id), notificationData);
                } else {
                    const newNotificationRef = notificationsRef.doc();
                    batch.set(newNotificationRef, {
                        ...notificationData,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            await batch.commit();
            return true;
        } catch (error) {
            console.error('連絡事項保存エラー:', error);
            return false;
        }
    };

    /**
     * 連絡事項をリアルタイム監視
     */
    Firestore.watchNotifications = function (callback) {
        return getTeamCollection(COLLECTIONS.NOTIFICATIONS)
            .orderBy('date', 'desc')
            .onSnapshot((snapshot) => {
                const notifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: doc.data().date?.toDate() || new Date(doc.data().date)
                }));
                callback(notifications);
            });
    };

    // ==================== ログ管理 ====================

    /**
     * ログを取得
     */
    Firestore.loadLogs = async function () {
        try {
            const snapshot = await getTeamCollection(COLLECTIONS.LOGS)
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date(doc.data().timestamp)
            }));
        } catch (error) {
            console.error('ログ読み込みエラー:', error);
            return [];
        }
    };

    /**
     * ログを追加
     */
    Firestore.addLog = async function (module, message, details = '') {
        try {
            const user = firebase.auth().currentUser;
            await getTeamCollection(COLLECTIONS.LOGS).add({
                module: module,
                message: message,
                details: details,
                user: user ? user.displayName || user.email : '匿名',
                userId: user ? user.uid : null,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('ログ追加エラー:', error);
            return false;
        }
    };

    // ==================== 配車管理 ====================

    /**
     * 配車情報を取得
     */
    Firestore.loadCarpool = async function (eventId) {
        try {
            const doc = await getTeamCollection(COLLECTIONS.CARPOOL).doc(eventId).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            console.error('配車情報読み込みエラー:', error);
            return null;
        }
    };

    /**
     * 配車情報を保存
     */
    Firestore.saveCarpool = async function (eventId, carpoolData) {
        try {
            await getTeamCollection(COLLECTIONS.CARPOOL).doc(eventId).set({
                ...carpoolData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('配車情報保存エラー:', error);
            return false;
        }
    };

    // ==================== ユーティリティ ====================

    /**
     * 単一ドキュメントを追加
     */
    Firestore.addDocument = async function (collectionName, data) {
        try {
            const docRef = await getTeamCollection(collectionName).add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('ドキュメント追加エラー:', error);
            return null;
        }
    };

    /**
     * 単一ドキュメントを更新
     */
    Firestore.updateDocument = async function (collectionName, docId, data) {
        try {
            await getTeamCollection(collectionName).doc(docId).update({
                ...data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('ドキュメント更新エラー:', error);
            return false;
        }
    };

    /**
     * 単一ドキュメントを削除
     */
    Firestore.deleteDocument = async function (collectionName, docId) {
        try {
            await getTeamCollection(collectionName).doc(docId).delete();
            return true;
        } catch (error) {
            console.error('ドキュメント削除エラー:', error);
            return false;
        }
    };

    /**
     * 単一ドキュメントを取得
     */
    Firestore.getDocument = async function (collectionName, docId) {
        try {
            const doc = await getTeamCollection(collectionName).doc(docId).get();
            if (doc.exists) {
                const data = doc.data();
                // 日付フィールドの変換（必要に応じて拡張）
                if (data.date && data.date.toDate) {
                    data.date = data.date.toDate();
                }
                if (data.createdAt && data.createdAt.toDate) {
                    data.createdAt = data.createdAt.toDate();
                }
                if (data.updatedAt && data.updatedAt.toDate) {
                    data.updatedAt = data.updatedAt.toDate();
                }
                return { id: doc.id, ...data };
            }
            return null;
        } catch (error) {
            console.error('ドキュメント取得エラー:', error);
            return null;
        }
    };

    // 公開API
    Firestore.COLLECTIONS = COLLECTIONS;
    Firestore.TEAM_ID = TEAM_ID;

})();