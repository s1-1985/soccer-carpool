/**
 * FC尾島ジュニア - ユーティリティ関数
 * 共通で使用するユーティリティ関数の集まり
 */

// 名前空間の確保
window.FCOjima = window.FCOjima || {};
FCOjima.Utils = FCOjima.Utils || {};

// ユーティリティモジュール
(function() {
    // 名前空間のショートカット
    const Utils = FCOjima.Utils;
    
    /**
     * 日付をYYYY-MM-DD形式にフォーマット
     * @param {Date} date - 日付オブジェクト
     * @returns {string} YYYY-MM-DD形式の日付文字列
     */
    Utils.formatDate = function(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    };
    
    /**
     * 日付を人間が読みやすい形式にフォーマット
     * @param {string} dateString - YYYY-MM-DD形式の日付文字列
     * @returns {string} 「YYYY年MM月DD日(曜日)」形式の日付文字列
     */
    Utils.formatDateForDisplay = function(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
        
        return year + '年' + month + '月' + day + '日(' + dayOfWeek + ')';
    };
    
    /**
     * イベントタイプのラベルを取得
     * @param {string} type - イベントタイプ識別子
     * @returns {string} 表示用ラベル
     */
    Utils.getEventTypeLabel = function(type) {
        const types = {
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
        const today = new Date();
        const birth = new Date(birthDate);
        
        // 日本の学年制度は4月1日開始
        const schoolYearStartMonth = 3; // 0-indexedで3が4月
        const schoolYearStartDay = 1;
        
        // 現在の学年年度の開始日を計算
        let currentSchoolYearStart = new Date(today.getFullYear(), schoolYearStartMonth, schoolYearStartDay);
        
        // 今日が4月1日より前なら、前年度が現在の学年年度
        if (today < currentSchoolYearStart) {
            currentSchoolYearStart.setFullYear(currentSchoolYearStart.getFullYear() - 1);
        }
        
        // 生まれた年を取得
        const birthYear = birth.getFullYear();
        
        // 生まれた月日が4月2日以降なら次の年度扱い
        const isAfterSchoolYearStart = 
            birth.getMonth() > schoolYearStartMonth || 
            (birth.getMonth() === schoolYearStartMonth && birth.getDate() > schoolYearStartDay);
        
        // 小学校入学年度を計算（生まれた年から6年後、ただし4月2日以降生まれは7年後）
        const elementarySchoolEntryYear = birthYear + (isAfterSchoolYearStart ? 7 : 6);
        
        // 今年の4月1日時点での学年を計算
        const currentSchoolYear = currentSchoolYearStart.getFullYear();
        
        // 学年を算出
        const gradeOffset = currentSchoolYear - elementarySchoolEntryYear;
        
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
        const newArray = array.slice();
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = newArray[i];
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
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';  // スクロールを防止
            textArea.style.opacity = '0';       // 非表示に
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const success = document.execCommand('copy');
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
            const encodedMessage = encodeURIComponent(message);
            // window.open()を使用してユーザーブロックを回避
            window.open('https://line.me/R/msg/text/?' + encodedMessage, '_blank');
            console.log('LINEで共有を開始しました');
            return true;
        } else {
            console.log('このデバイスではLINE共有がサポートされていません');
            return false;
        }
    };
    
    /**
     * 日付の差分を計算（日数）
     * @param {string|Date} date1 - 日付1
     * @param {string|Date} date2 - 日付2
     * @returns {number} 日数の差
     */
    Utils.dateDiffInDays = function(date1, date2) {
        // 日付オブジェクトに変換
        const d1 = date1 instanceof Date ? date1 : new Date(date1);
        const d2 = date2 instanceof Date ? date2 : new Date(date2);
        
        // 時間部分を無視して日付のみで計算
        const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
        
        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        return Math.floor((utc2 - utc1) / MS_PER_DAY);
    };
    
    /**
     * 日付が範囲内にあるか確認
     * @param {string|Date} date - 確認する日付
     * @param {string|Date} startDate - 開始日
     * @param {string|Date} endDate - 終了日
     * @returns {boolean} 範囲内にあるか
     */
    Utils.isDateInRange = function(date, startDate, endDate) {
        // 日付オブジェクトに変換
        const d = date instanceof Date ? date : new Date(date);
        const start = startDate instanceof Date ? startDate : new Date(startDate);
        const end = endDate instanceof Date ? endDate : new Date(endDate);
        
        // 時間部分を無視して日付のみで比較
        d.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        
        return d >= start && d <= end;
    };
    
    /**
     * 日付に日数を加算
     * @param {string|Date} date - 元の日付
     * @param {number} days - 加算する日数
     * @returns {Date} 加算後の日付
     */
    Utils.addDays = function(date, days) {
        const result = date instanceof Date ? new Date(date) : new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };
    
    /**
     * URLパラメータを取得
     * @param {string} name - パラメータ名
     * @returns {string|null} パラメータの値
     */
    Utils.getUrlParameter = function(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    };
    
    /**
     * オブジェクトを深くコピー
     * @param {Object} obj - コピーするオブジェクト
     * @returns {Object} コピーされたオブジェクト
     */
    Utils.deepCopy = function(obj) {
        return JSON.parse(JSON.stringify(obj));
    };
    
    /**
     * 文字列が数値かどうか
     * @param {string} str - 確認する文字列
     * @returns {boolean} 数値かどうか
     */
    Utils.isNumeric = function(str) {
        if (typeof str !== "string") return false;
        return !isNaN(str) && !isNaN(parseFloat(str));
    };
    
    /**
     * Google Mapリンクを生成
     * @param {string} address - 住所
     * @param {string} label - ラベル
     * @returns {string} Google MapのURL
     */
    Utils.createMapUrl = function(address, label = '') {
        if (!address) return '';
        
        const encodedAddress = encodeURIComponent(address);
        let mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        
        if (label) {
            mapUrl += `&query_place_id=${encodeURIComponent(label)}`;
        }
        
        return mapUrl;
    };
    
    /**
     * Map表示ボタンを生成
     * @param {string} address - 住所
     * @param {string} buttonText - ボタンテキスト
     * @returns {string} ボタンのHTML
     */
    Utils.createMapButton = function(address, buttonText = 'Google Mapで開く') {
        if (!address) return '';
        
        const mapUrl = Utils.createMapUrl(address);
        return `<button type="button" class="map-button" onclick="window.open('${mapUrl}', '_blank')">${buttonText}</button>`;
    };
})();