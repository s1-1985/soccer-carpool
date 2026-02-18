/**
 * FC尾島ジュニア - Firebase設定
 *
 * ★セットアップ手順★
 * 1. Firebase Console (https://console.firebase.google.com) を開く
 * 2. プロジェクト「fc-ojimajr-hub」を選択
 * 3. 「プロジェクトの設定」→「マイアプリ」→ </> (ウェブ) をクリック
 * 4. アプリ名「FC尾島JrHUB」で登録
 * 5. 表示された firebaseConfig の値をここに貼り付ける
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "fc-ojimajr-hub.firebaseapp.com",
  projectId: "fc-ojimajr-hub",
  storageBucket: "fc-ojimajr-hub.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase 初期化
firebase.initializeApp(firebaseConfig);

// サービスのエクスポート
const db = firebase.firestore();
const auth = firebase.auth();

// チームID（固定）
const TEAM_ID = 'fc-ojima';

// Firestoreのコレクション参照
const Collections = {
  members:       () => db.collection('teams').doc(TEAM_ID).collection('members'),
  venues:        () => db.collection('teams').doc(TEAM_ID).collection('venues'),
  events:        () => db.collection('teams').doc(TEAM_ID).collection('events'),
  notifications: () => db.collection('teams').doc(TEAM_ID).collection('notifications'),
  logs:          () => db.collection('teams').doc(TEAM_ID).collection('logs'),
  eventData:     (eventId) => db.collection('teams').doc(TEAM_ID).collection('eventData').doc(String(eventId))
};

window.FCOjimaFirebase = { db, auth, Collections, TEAM_ID };
console.log('Firebase 初期化完了 (プロジェクト: fc-ojimajr-hub)');
