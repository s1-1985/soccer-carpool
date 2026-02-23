/**
 * FC尾島ジュニア - 認証モジュール
 * Google認証によるログイン管理
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Auth = FCOjima.Auth || {};

(function(Auth) {
    const auth = window.FCOjimaFirebase.auth;
    const db   = window.FCOjimaFirebase.db;
    const TEAM_ID = window.FCOjimaFirebase.TEAM_ID;

    // ログインページのパス（ルートからの相対パス）
    const LOGIN_PAGE = '/hub/login.html';

    /**
     * ログイン状態の監視を開始
     * 未ログインならログインページへリダイレクト
     */
    Auth.requireLogin = function() {
        return new Promise(function(resolve) {
            auth.onAuthStateChanged(function(user) {
                if (user) {
                    Auth.currentUser = user;
                    console.log('ログイン済み:', user.email || user.displayName);
                    resolve(user);
                } else {
                    console.log('未ログイン → ログインページへ');
                    window.location.href = LOGIN_PAGE;
                }
            });
        });
    };

    /**
     * Googleアカウントでサインイン
     */
    Auth.signInWithGoogle = function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        return auth.signInWithPopup(provider)
            .then(function(result) {
                console.log('Googleサインイン成功:', result.user.displayName);
                return result.user;
            })
            .catch(function(error) {
                console.error('サインインエラー:', error.message);
                throw error;
            });
    };

    /**
     * サインアウト
     */
    Auth.signOut = function() {
        return auth.signOut().then(function() {
            window.location.href = LOGIN_PAGE;
        });
    };

    /**
     * 現在のユーザー情報を取得
     */
    Auth.getCurrentUser = function() {
        return auth.currentUser;
    };

    /**
     * ログインしているかどうか確認
     */
    Auth.isLoggedIn = function() {
        return auth.currentUser !== null;
    };

    /**
     * ユーザー表示名を取得（ログ記録に使用）
     */
    Auth.getDisplayName = function() {
        const user = auth.currentUser;
        if (!user) return 'ゲスト';
        if (Auth.currentUserProfile && Auth.currentUserProfile.name) {
            return Auth.currentUserProfile.name;
        }
        return user.displayName || user.email || 'ユーザー';
    };

    /**
     * ログイン確認 + 承認ステータスチェック
     * 未登録 → /hub/register.html へ
     * 承認待ち → /hub/pending.html へ
     * 承認済み → userProfile を返す
     */
    Auth.requireApproved = async function() {
        const user = await Auth.requireLogin();
        if (!user) return null;

        try {
            const doc = await db.collection('teams').doc(TEAM_ID)
                .collection('users').doc(user.uid).get();

            if (!doc.exists) {
                // 未登録 → 新規登録フォームへ
                window.location.href = '/hub/register.html';
                return null;
            }

            const profile = { uid: user.uid, ...doc.data() };

            if (profile.status === 'pending') {
                window.location.href = '/hub/pending.html';
                return null;
            }
            if (profile.status === 'rejected') {
                document.body.innerHTML = '<div style="text-align:center;padding:60px;font-family:sans-serif;">' +
                    '<h2>アクセスが拒否されました</h2>' +
                    '<p>管理者にお問い合わせください。</p></div>';
                return null;
            }

            Auth.currentUserProfile = profile;
            return profile;
        } catch (e) {
            console.error('ユーザー情報の取得に失敗:', e);
            // Firestoreエラー時は管理者扱いで続行しない → ログインのみ確認
            Auth.currentUserProfile = null;
            return null;
        }
    };

    /**
     * 現在のユーザーがマネージャー権限を持つか確認
     */
    Auth.isManager = function() {
        const p = Auth.currentUserProfile;
        return p && ['admin', 'coach', 'assist', 'officer'].includes(p.role);
    };

})(FCOjima.Auth);
