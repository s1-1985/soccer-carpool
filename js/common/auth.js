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
        return user.displayName || user.email || 'ユーザー';
    };

})(FCOjima.Auth);
