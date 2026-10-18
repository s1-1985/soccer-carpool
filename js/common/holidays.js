/**
 * FC尾島ジュニア - 日本の祝日（国民の祝日・振替休日・国民の休日）
 *
 * 2020年以降の祝日法にもとづいて計算する（外部のデータは使わない）。
 * 春分・秋分の日は計算式（2099年まで有効）で求める。
 * 法改正などで臨時に祝日が動いた年は、指導者の画面の「聞く日を追加」「この日は聞かない」で補う
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Holidays = FCOjima.Holidays || {};

(function(H) {
    var cache = {};

    function pad(n) { return ('0' + n).slice(-2); }
    function key(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
    function keyOf(dt) { return key(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()); }

    /** その月の第 n 月曜日 */
    function nthMonday(y, m, n) {
        var first = new Date(y, m - 1, 1).getDay();
        return 1 + ((8 - first) % 7) + (n - 1) * 7;
    }

    /** その年の祝日 { 'YYYY-MM-DD': 名前 } */
    function ofYear(y) {
        if (cache[y]) return cache[y];
        var map = {};
        var a = y - 1980;
        var add = function(m, d, name) { map[key(y, m, d)] = name; };
        add(1, 1, '元日');
        add(1, nthMonday(y, 1, 2), '成人の日');
        add(2, 11, '建国記念の日');
        add(2, 23, '天皇誕生日');
        add(3, Math.floor(20.8431 + 0.242194 * a - Math.floor(a / 4)), '春分の日');
        add(4, 29, '昭和の日');
        add(5, 3, '憲法記念日');
        add(5, 4, 'みどりの日');
        add(5, 5, 'こどもの日');
        add(7, nthMonday(y, 7, 3), '海の日');
        add(8, 11, '山の日');
        add(9, nthMonday(y, 9, 3), '敬老の日');
        add(9, Math.floor(23.2488 + 0.242194 * a - Math.floor(a / 4)), '秋分の日');
        add(10, nthMonday(y, 10, 2), 'スポーツの日');
        add(11, 3, '文化の日');
        add(11, 23, '勤労感謝の日');

        var base = Object.keys(map);
        var isBase = {};
        base.forEach(function(k) { isBase[k] = true; });
        // 国民の休日: 祝日にはさまれた日（9月の敬老の日と秋分の日の間など）
        base.forEach(function(k) {
            var d = new Date(k + 'T00:00:00');
            d.setDate(d.getDate() + 2);
            var after = keyOf(d);
            d.setDate(d.getDate() - 1);
            var mid = keyOf(d);
            if (isBase[after] && !isBase[mid]) map[mid] = '国民の休日';
        });
        // 振替休日: 日曜の祝日のあと、最初の祝日でない日
        base.forEach(function(k) {
            var d = new Date(k + 'T00:00:00');
            if (d.getDay() !== 0) return;
            do { d.setDate(d.getDate() + 1); } while (map[keyOf(d)]);
            map[keyOf(d)] = '振替休日';
        });
        cache[y] = map;
        return map;
    }

    /**
     * 祝日の名前（祝日でなければ空文字）
     * @param {string} date - YYYY-MM-DD
     */
    H.nameOf = function(date) {
        var s = String(date || '');
        var y = parseInt(s.slice(0, 4), 10);
        if (!(y >= 2020 && y <= 2099)) return '';
        return ofYear(y)[s.slice(0, 10)] || '';
    };

    H.isHoliday = function(date) { return !!H.nameOf(date); };
})(FCOjima.Holidays);
