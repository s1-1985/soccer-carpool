/**
 * FC尾島ジュニア - 認証管理システム
 * ユーザーログイン、登録、権限管理
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Auth = FCOjima.Auth || {};

// 認証モジュール
(function() {
    const Auth = FCOjima.Auth;
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // ユーザー権限レベル
    const USER_ROLES = {
        ADMIN: 'admin',      // 監督・コーチ（全権限）
        MANAGER: 'manager',  // 保護者会長（編集権限）
        PARENT: 'parent',    // 一般保護者（自分の操作のみ）
        READONLY: 'readonly' // 読み取り専用（元メンバー等）
    };
    
    /**
     * メール/パスワードでログイン
     */
    Auth.signInWithEmail = async function(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // ユーザー情報を取得
            await loadUserProfile(user.uid);
            
            // Analytics記録
            if (firebase.analytics) {
                firebase.analytics().logEvent('login', {
                    method: 'email'
                });
            }
            
            return { success: true, user: user };
        } catch (error) {
            console.error('メールログインエラー:', error);
            return { success: false, error: getErrorMessage(error) };
        }
    };
    
    /**
     * Googleアカウントでログイン
     */
    Auth.signInWithGoogle = async function() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            const result = await auth.signInWithPopup(provider);
            const user = result.user;
            
            // 初回ログインの場合、ユーザープロファイルを作成
            await createUserProfileIfNeeded(user);
            
            // Analytics記録
            if (firebase.analytics) {
                firebase.analytics().logEvent('login', {
                    method: 'google'
                });
            }
            
            return { success: true, user: user };
        } catch (error) {
            console.error('Googleログインエラー:', error);
            return { success: false, error: getErrorMessage(error) };
        }
    };
    
    /**
     * メール/パスワードでユーザー登録
     */
    Auth.registerWithEmail = async function(email, password, profileData) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // プロファイル更新
            await user.updateProfile({
                displayName: profileData.name
            });
            
            // Firestoreにユーザー情報を保存
            await createUserProfile(user.uid, {
                ...profileData,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                role: USER_ROLES.PARENT // デフォルトは保護者
            });
            
            // Analytics記録
            if (firebase.analytics) {
                firebase.analytics().logEvent('sign_up', {
                    method: 'email'
                });
            }
            
            return { success: true, user: user };
        } catch (error) {
            console.error('ユーザー登録エラー:', error);
            return { success: false, error: getErrorMessage(error) };
        }
    };
    
    /**
     * ログアウト
     */
    Auth.signOut = async function() {
        try {
            await auth.signOut();
            
            // Analytics記録
            if (firebase.analytics) {
                firebase.analytics().logEvent('logout');
            }
            
            return { success: true };
        } catch (error) {
            console.error('ログアウトエラー:', error);
            return { success: false, error: getErrorMessage(error) };
        }
    };
    
    /**
     * パスワードリセット
     */
    Auth.resetPassword = async function(email) {
        try {
            await auth.sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            console.error('パスワードリセットエラー:', error);
            return { success: false, error: getErrorMessage(error) };
        }
    };
    
    /**
     * 現在のユーザー情報を取得
     */
    Auth.getCurrentUser = function() {
        return auth.currentUser;
    };
    
    /**
     * ユーザーがログインしているかチェック
     */
    Auth.isLoggedIn = function() {
        return auth.currentUser !== null;
    };
    
    /**
     * ユーザーの権限レベルを取得
     */
    Auth.getUserRole = function() {
        if (!FCOjima.currentUser || !FCOjima.currentUser.profile) {
            return null;
        }
        return FCOjima.currentUser.profile.role || USER_ROLES.PARENT;
    };
    
    /**
     * 権限チェック
     */
    Auth.hasPermission = function(requiredRole) {
        const currentRole = Auth.getUserRole();
        if (!currentRole) return false;
        
        const roleHierarchy = {
            [USER_ROLES.READONLY]: 1,
            [USER_ROLES.PARENT]: 2,
            [USER_ROLES.MANAGER]: 3,
            [USER_ROLES.ADMIN]: 4
        };
        
        const userLevel = roleHierarchy[currentRole] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;
        
        return userLevel >= requiredLevel;
    };
    
    /**
     * 管理者権限チェック
     */
    Auth.isAdmin = function() {
        return Auth.hasPermission(USER_ROLES.ADMIN);
    };
    
    /**
     * マネージャー権限チェック
     */
    Auth.isManager = function() {
        return Auth.hasPermission(USER_ROLES.MANAGER);
    };
    
    /**
     * ユーザープロファイルを読み込み
     */
    async function loadUserProfile(userId) {
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists) {
                FCOjima.currentUser = FCOjima.currentUser || {};
                FCOjima.currentUser.profile = doc.data();
            }
        } catch (error) {
            console.error('ユーザープロファイル読み込みエラー:', error);
        }
    }
    
    /**
     * ユーザープロファイルを作成（初回ログイン時）
     */
    async function createUserProfileIfNeeded(user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                await createUserProfile(user.uid, {
                    name: user.displayName || user.email,
                    email: user.email,
                    photoURL: user.photoURL,
                    role: USER_ROLES.PARENT,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            await loadUserProfile(user.uid);
        } catch (error) {
            console.error('ユーザープロファイル作成エラー:', error);
        }
    }
    
    /**
     * ユーザープロファイルを作成
     */
    async function createUserProfile(userId, profileData) {
        try {
            await db.collection('users').doc(userId).set(profileData);
        } catch (error) {
            console.error('ユーザープロファイル保存エラー:', error);
            throw error;
        }
    }
    
    /**
     * エラーメッセージを日本語に変換
     */
    function getErrorMessage(error) {
        const errorMessages = {
            'auth/user-not-found': 'ユーザーが見つかりません',
            'auth/wrong-password': 'パスワードが間違っています',
            'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
            'auth/weak-password': 'パスワードが弱すぎます（6文字以上必要）',
            'auth/invalid-email': 'メールアドレスの形式が正しくありません',
            'auth/popup-closed-by-user': 'ログインがキャンセルされました',
            'auth/network-request-failed': 'ネットワークエラーが発生しました'
        };
        
        return errorMessages[error.code] || error.message || '不明なエラーが発生しました';
    }
    
    /**
     * 認証状態の監視イベントを設定
     */
    Auth.onAuthStateChanged = function(callback) {
        return auth.onAuthStateChanged(callback);
    };
    
    // 公開API
    Auth.USER_ROLES = USER_ROLES;
    
})();

// ページ読み込み時の認証状態チェック
document.addEventListener('DOMContentLoaded', function() {
    // 認証が必要なページの場合、ログインページにリダイレクト
    const publicPages = ['login.html', 'register.html', 'index.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    firebase.auth().onAuthStateChanged((user) => {
        if (!user && !publicPages.includes(currentPage)) {
            // 未ログインで保護されたページにアクセスした場合
            window.location.href = '../auth/login.html';
        }
    });
});