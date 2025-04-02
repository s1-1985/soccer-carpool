/**
 * FC尾島ジュニア - ユーティリティ関数
 * 共通で使用するユーティリティ関数の集まり
 */

(function(app) {
    // 名前空間のショートカット
    var Utils = app.Utils;
    
    /**
     * 日付をYYYY-MM-DD形式にフォーマット
     * @param {Date} date - 日付オブジェクト
     * @returns {string} YYYY-MM-DD形式の日付文字列
     */
    Utils.formatDate = function(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    };
    
    /**
     * 日付を人間が読みやすい形式にフォーマット
     * @param {string} dateString - YYYY-MM-DD形式の日付文字列
     * @returns {string} 「YYYY年MM月DD日(曜日)」形式の日付文字列
     */
    Utils.formatDateForDisplay = function(dateString) {
        var date = new Date(dateString);
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
        
        return year + '年' + month + '月' + day + '日(' + dayOfWeek + ')';
    };
    
    /**
     * イベントタイプのラベルを取得
     * @param {string} type - イベントタイプ識別子
     * @returns {string} 表示用ラベル
     */
    Utils.getEventTypeLabel = function(type) {
        var types = {
            'game': '試合',
            'practice': '練習',
            'other': 'その他'
        };
        return types[type] || type;
    };
    
    /**
     * 学年ラベルを取得
     * @param {string} grade - 学年識別子
     * @returns {string} 表示用ラベル
     */
    Utils.getGradeLabel = function(grade) {
        if (grade === '年少' || grade === '年中' || grade === '年長') {
            return grade;
        }
        return grade + '年';
    };
    
    /**
     * 生年月日から学年を計算
     * @param {string} birthDate - YYYY-MM-DD形式の生年月日
     * @returns {string} 学年識別子
     */
    Utils.calculateGrade = function(birthDate) {
        var today = new Date();
        var birth = new Date(birthDate);
        
        // 日本の学年制度は4月1日開始
        var schoolYearStartMonth = 3; // 0-indexedで3が4月
        var schoolYearStartDay = 1;
        
        // 現在の学年年度の開始日を計算
        var currentSchoolYearStart = new Date(today.getFullYear(), schoolYearStartMonth, schoolYearStartDay);
        
        // 今日が4月1日より前なら、前年度が現在の学年年度
        if (today < currentSchoolYearStart) {
            currentSchoolYearStart.setFullYear(currentSchoolYearStart.getFullYear() - 1);
        }
        
        // 生まれた年を取得
        var birthYear = birth.getFullYear();
        
        // 生まれた月日が4月2日以降なら次の年度扱い
        var isAfterSchoolYearStart = 
            birth.getMonth() > schoolYearStartMonth || 
            (birth.getMonth() === schoolYearStartMonth && birth.getDate() > schoolYearStartDay);
        
        // 小学校入学年度を計算（生まれた年から6年後、ただし4月2日以降生まれは7年後）
        var elementarySchoolEntryYear = birthYear + (isAfterSchoolYearStart ? 7 : 6);
        
        // 今年の4月1日時点での学年を計算
        var currentSchoolYear = currentSchoolYearStart.getFullYear();
        
        // 学年を算出
        var gradeOffset = currentSchoolYear - elementarySchoolEntryYear;
        
        // 学年を決定
        if (gradeOffset < -3) {
            return null; // まだ集団教育の年齢に達していない
        } else if (gradeOffset === -3) {
            return '年少'; // 3歳児
        } else if (gradeOffset === -2) {
            return '年中'; // 4歳児
        } else if (gradeOffset === -1) {
            return '年長'; // 5歳児
        } else if (gradeOffset >= 0 && gradeOffset <= 5) {
            return String(gradeOffset + 1); // 小学1年〜6年
        } else {
            return null; // 小学生を超える年齢
        }
    };
    
    /**
     * 配列をシャッフル（ランダム化）
     * @param {Array} array - シャッフルする配列
     * @returns {Array} シャッフルされた新しい配列
     */
    Utils.shuffleArray = function(array) {
        var newArray = array.slice();
        for (var i = newArray.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = newArray[i];
            newArray[i] = newArray[j];
            newArray[j] = temp;
        }
        return newArray;
    };
    
    /**
     * 指定されたURLを新しいタブで開く
     * @param {string} url - 開くURL
     */
    Utils.openNewTab = function(url) {
        window.open(url, '_blank');
    };
    
    /**
     * テキストをクリップボードにコピー
     * @param {string} text - コピーするテキスト
     * @returns {boolean} コピー成功したかどうか
     */
    Utils.copyToClipboard = function(text) {
        // 新しい実装（navigator.clipboard APIが使用可能な場合はそちらを優先）
        if (navigator.clipboard && window.isSecureContext) {
            // 非同期だが、プロミスを返す
            navigator.clipboard.writeText(text)
                .then(function() {
                    console.log('テキストをクリップボードにコピーしました');
                    return true;
                })
                .catch(function(err) {
                    console.error('クリップボードへのコピーに失敗しました', err);
                    return false;
                });
            return true;
        } else {
            // 以前のアプローチ（互換性のため）
            var textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';  // スクロールを防止
            textArea.style.opacity = '0';       // 非表示に
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                var success = document.execCommand('copy');
                document.body.removeChild(textArea);
                return success;
            } catch (err) {
                console.error('クリップボードへのコピーに失敗しました', err);
                document.body.removeChild(textArea);
                return false;
            }
        }
    };
    
    /**
     * LINEで共有（モバイルのみ）
     * @param {string} message - 共有するメッセージ
     * @returns {boolean} 共有処理が開始されたかどうか
     */
    Utils.shareViaLINE = function(message) {
        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            var encodedMessage = encodeURIComponent(message);
            // window.open()を使用してユーザーブロックを回避
            window.open('https://line.me/R/msg/text/?' + encodedMessage, '_blank');
            console.log('LINEで共有を開始しました');
            return true;
        } else {
            console.log('このデバイスではLINE共有がサポートされていません');
            return false;
        }
    };
    
})(window.FCOjima);
