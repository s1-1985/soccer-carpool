/**
 * FC尾島ジュニア - ユーティリティ関数
 * 共通で使用するユーティリティ関数の集まり
 */

// 名前空間の定義はglobal.jsで行うため削除

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 * @param {Date} date - 日付オブジェクト
 * @returns {string} YYYY-MM-DD形式の日付文字列
 */
FCOjima.Utils.formatDate = function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * 日付を人間が読みやすい形式にフォーマット
 * @param {string} dateString - YYYY-MM-DD形式の日付文字列
 * @returns {string} 「YYYY年MM月DD日(曜日)」形式の日付文字列
 */
FCOjima.Utils.formatDateForDisplay = function(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    
    return `${year}年${month}月${day}日(${dayOfWeek})`;
};

/**
 * イベントタイプのラベルを取得
 * @param {string} type - イベントタイプ識別子
 * @returns {string} 表示用ラベル
 */
FCOjima.Utils.getEventTypeLabel = function(type) {
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
FCOjima.Utils.getGradeLabel = function(grade) {
    if (grade === '年少' || grade === '年中' || grade === '年長') {
        return grade;
    }
    return `${grade}年`;
};

/**
 * 生年月日から学年を計算
 * @param {string} birthDate - YYYY-MM-DD形式の生年月日
 * @returns {string} 学年識別子
 */
FCOjima.Utils.calculateGrade = function(birthDate) {
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
    
    // 学年の基準は「何年度に小学校に入学するか」
    // 生まれた年の翌々年の4月に幼稚園年少に入園
    // 生まれた年の翌々々々年の4月に小学校入学（満6歳の4月）
    
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
FCOjima.Utils.shuffleArray = function(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

/**
 * 指定されたURLを新しいタブで開く
 * @param {string} url - 開くURL
 */
FCOjima.Utils.openNewTab = function(url) {
    window.open(url, '_blank');
};

/**
 * テキストをクリップボードにコピー
 * @param {string} text - コピーするテキスト
 * @returns {boolean} コピー成功したかどうか
 */
FCOjima.Utils.copyToClipboard = function(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
};

/**
 * LINEで共有（モバイルのみ）
 * @param {string} message - 共有するメッセージ
 */
FCOjima.Utils.shareViaLINE = function(message) {
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        const encodedMessage = encodeURIComponent(message);
        FCOjima.Utils.openNewTab(`https://line.me/R/msg/text/?${encodedMessage}`);
        return true;
    }
    return false;
};