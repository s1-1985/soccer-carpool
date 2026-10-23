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
                    // ログイン後に元のページ（共有リンクの ?event=ID 付きなど）へ戻れるよう記録
                    try {
                        sessionStorage.setItem('fcojima_return_to', window.location.pathname + window.location.search);
                    } catch (e) {}
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
            // Firebase Console で手入力したプロフィールでも画面が止まらないよう、配列の項目の形を整える
            ['childrenIds', 'childrenNames'].forEach(function(k) {
                const v = profile[k];
                if (v !== undefined && !Array.isArray(v)) profile[k] = (v === null || v === '' || typeof v === 'object') ? [] : [String(v)];
            });

            if (profile.status === 'pending') {
                window.location.href = '/hub/pending.html';
                return null;
            }
            if (profile.status === 'rejected') {
                // 却下の案内は承認待ちページで出す（サインアウトボタンがあるため）。以前はこの場で
                // 画面を「アクセスが拒否されました」だけに差し替えており、ログアウトする手段がなく、
                // 間違ったGoogleアカウントで申請した人が別のアカウントで入り直せなかった
                window.location.href = '/hub/pending.html';
                return null;
            }

            Auth.currentUserProfile = profile;
            await Auth.loadPermissions();
            return profile;
        } catch (e) {
            console.error('ユーザー情報の取得に失敗:', e);
            // Firestoreエラー時は管理者扱いで続行しない → ログインのみ確認
            Auth.currentUserProfile = null;
            // 以前は何も表示されず、画面の枠だけが出たまま操作できない状態になっていた
            Auth.showLoadError();
            return null;
        }
    };

    /**
     * 読み込み失敗（オフライン・通信エラー）を画面に表示する
     */
    Auth.showLoadError = function() {
        if (document.getElementById('fcojima-load-error')) return;
        var box = document.createElement('div');
        box.id = 'fcojima-load-error';
        box.setAttribute('role', 'alert');
        box.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(28,22,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;';
        var card = document.createElement('div');
        card.style.cssText = 'background:#fff;border-radius:12px;padding:20px;max-width:360px;width:100%;text-align:center;font-family:sans-serif;';
        var msg = document.createElement('p');
        msg.style.cssText = 'margin:0 0 14px;line-height:1.6;color:#333;';
        msg.textContent = 'データを読み込めませんでした。通信環境の良い所で、もう一度読み込んでください。';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '再読み込み';
        btn.addEventListener('click', function() { window.location.reload(); });
        card.appendChild(msg);
        card.appendChild(btn);
        box.appendChild(card);
        (document.body || document.documentElement).appendChild(box);
    };

    /**
     * 現在のユーザーがマネージャー（管理者・監督・コーチ・役員）か。管理タブ・権限の設定・役割の変更に使う。
     * 機能ごとの権限は Auth.can（権限の設定で役割ごとに変えられる）
     */
    Auth.isManager = function() {
        const p = Auth.currentUserProfile;
        return p && ['admin', 'coach', 'assist', 'officer'].includes(p.role);
    };

    Auth.isAdmin = function() {
        const p = Auth.currentUserProfile;
        return !!(p && p.role === 'admin');
    };

    /**
     * 権限の設定（settings/permissions）と、いまの監督（settings/roles の kantoku）を読む。
     * 読めなければ初期値（以前と同じ動き）で動く
     */
    Auth.permissions = null;
    Auth.kantokuUid = '';
    Auth.loadPermissions = async function() {
        const settings = db.collection('teams').doc(TEAM_ID).collection('settings');
        const [perm, roles] = await Promise.all([
            settings.doc('permissions').get().catch(function(e) { console.warn('権限の設定を読み込めませんでした（初期値で動きます）:', e); return null; }),
            settings.doc('roles').get().catch(function(e) { console.warn('監督の設定を読み込めませんでした:', e); return null; })
        ]);
        Auth.permissions = (perm && perm.exists) ? (perm.data() || {}) : {};
        Auth.kantokuUid = (roles && roles.exists) ? String((roles.data() || {}).kantoku || '') : '';
        return Auth.permissions;
    };

    /**
     * 連絡（チームの連絡事項・予定ごとの連絡）に付ける、書いた人の印。
     * uid は消せる人の判定（Firestore のルール: 本人・管理者・「ほかの人の連絡の削除」の権限がある人。管理者が書いたものは管理者だけ）、
     * byAdmin は画面で削除ボタンを出すかどうかに使う
     */
    Auth.authorStamp = function() {
        const u = auth.currentUser;
        const stamp = {};
        if (u) stamp.uid = u.uid;
        if (Auth.isAdmin()) stamp.byAdmin = true;
        return stamp;
    };

    /**
     * その連絡を消せるか（画面の削除ボタン）。自分が書いたもの（uid、uid のない以前の連絡は名前）・管理者は消せる。
     * ほかの人のものは「ほかの人の連絡の削除」の権限がある人だけ。管理者が書いたものは管理者だけ
     * @param {Object} n - { uid, byAdmin, user }
     */
    Auth.canDeleteNote = function(n) {
        if (!n) return false;
        const u = auth.currentUser;
        if (Auth.isAdmin()) return true;
        if (n.uid ? (u && n.uid === u.uid) : (n.user && n.user === Auth.getDisplayName())) return true;
        if (n.byAdmin) return false;
        return Auth.can('notices_delete');
    };

    /**
     * その機能を使えるか（js/common/permissions.js の機能。管理者は常に使える）
     * @param {string} feature - 'events' | 'members' | 'approve' など
     */
    Auth.can = function(feature) {
        const p = Auth.currentUserProfile;
        if (!p || p.status !== 'approved' || !window.FCOjima.Perm) return false;
        return FCOjima.Perm.can(p.role, feature, Auth.permissions);
    };

})(FCOjima.Auth);
