/**
 * FC尾島ジュニア - Firebase設定
 * プロジェクト: fc-ojimajr-hub
 */

const firebaseConfig = {
  apiKey: "AIzaSyAM3ukhgT-5ITkaputyom6xxSM5B9Uio3A",
  authDomain: "fc-ojimajr-hub.firebaseapp.com",
  projectId: "fc-ojimajr-hub",
  storageBucket: "fc-ojimajr-hub.firebasestorage.app",
  messagingSenderId: "583979255748",
  appId: "1:583979255748:web:095b681f0b16e7ee0bc691",
  measurementId: "G-CGRS4SE133"
};

// Firebase 初期化
firebase.initializeApp(firebaseConfig);

// Auth（全ページで使用）
const _auth = firebase.auth();

// Firestore（SDKが読み込まれている場合のみ）
const _db = (typeof firebase.firestore === 'function') ? firebase.firestore() : null;

// チームID（固定）
const TEAM_ID = 'fc-ojima';

// Firestoreのコレクション参照
const Collections = {
  members:       () => _db.collection('teams').doc(TEAM_ID).collection('members'),
  venues:        () => _db.collection('teams').doc(TEAM_ID).collection('venues'),
  events:        () => _db.collection('teams').doc(TEAM_ID).collection('events'),
  notifications: () => _db.collection('teams').doc(TEAM_ID).collection('notifications'),
  logs:          () => _db.collection('teams').doc(TEAM_ID).collection('logs'),
  eventData:     (eventId) => _db.collection('teams').doc(TEAM_ID).collection('eventData').doc(String(eventId))
};

window.FCOjimaFirebase = { db: _db, auth: _auth, Collections, TEAM_ID };
console.log('Firebase 初期化完了 (プロジェクト: fc-ojimajr-hub)');
