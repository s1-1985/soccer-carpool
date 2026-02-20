<<<<<<< HEAD
/**
 * FC尾島ジュニア - Firebase設定
 * Firebase SDK の初期化と基本設定
 */

// Firebase設定情報
const firebaseConfig = {
  apiKey: "AIzaSyCl0IRIfTqha2fMXr8txR-yXVWF_rsEk9g",
  authDomain: "fc-ojima-hub.firebaseapp.com",
  projectId: "fc-ojima-hub",
  storageBucket: "fc-ojima-hub.firebasestorage.app",
  messagingSenderId: "1083019779081",
  appId: "1:1083019779081:web:961713d0e0ad191d28ecd8",
  measurementId: "G-S6GGREV245"
};

// Firebase SDKの初期化（重複防止）
let app;
try {
    app = firebase.app(); // 既存のアプリインスタンスをチェック
    console.log('🔥 既存のFirebaseアプリを使用します');
} catch (e) {
    app = firebase.initializeApp(firebaseConfig);
    console.log('🔥 新しいFirebaseアプリを初期化しました');
}

// Firebase サービスの初期化
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();

// 名前空間にFirebaseサービスを追加
window.FCOjima = window.FCOjima || {};
FCOjima.Firebase = {
  auth: auth,
  db: db,
  analytics: analytics
};

// Firebase初期化完了ログ
console.log('🔥 Firebase初期化完了:', firebaseConfig.projectId);

// オフライン対応の有効化（重複防止）
if (!window.FCOjima.Firebase.persistenceEnabled) {
    db.enablePersistence()
      .then(() => {
        console.log('📱 オフラインサポート有効化完了');
        window.FCOjima.Firebase.persistenceEnabled = true;
      })
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('⚠️ 複数タブでの利用によりオフライン機能は無効');
        } else if (err.code === 'unimplemented') {
          console.warn('⚠️ ブラウザがオフライン機能をサポートしていません');
        } else if (err.code === 'already-enabled') {
          console.log('📱 オフラインサポートは既に有効化済みです');
        }
        window.FCOjima.Firebase.persistenceEnabled = false;
      });
} else {
    console.log('📱 オフラインサポートは既に設定済みです');
}

// 認証状態の監視開始
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('✅ ユーザーログイン:', user.email);
    // ユーザー情報を名前空間に保存
    FCOjima.currentUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
    
    // ログインイベントを発火
    document.dispatchEvent(new CustomEvent('userLoggedIn', { 
      detail: FCOjima.currentUser 
    }));
  } else {
    console.log('❌ ユーザーログアウト');
    FCOjima.currentUser = null;
    
    // ログアウトイベントを発火
    document.dispatchEvent(new CustomEvent('userLoggedOut'));
  }
});

// Firestore設定の最適化
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// エラーハンドリング
window.addEventListener('error', (e) => {
  if (e.message.includes('firebase')) {
    console.error('🔥 Firebase エラー:', e.error);
  }
});

// Analytics設定（プロダクション環境のみ）
if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  analytics.logEvent('app_initialized', {
    timestamp: new Date().toISOString()
  });
}
=======
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
>>>>>>> 3f29fdc53b2c8f871d428ea6715327a2f2c4429e
