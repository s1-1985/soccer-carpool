/**
 * FC尾島ジュニア - 会場天気予報
 * Open-Meteo（APIキー不要・無料・商用利用制限なし）でジオコーディング＋天気予報を取得する。
 * ネットワーク不可・地名が当たらない等はすべて静かに失敗し、呼び出し元の画面を壊さない。
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Weather = FCOjima.Weather || {};

(function(Weather) {
    var GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
    var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
    var MAX_FORECAST_DAYS = 16; // Open-Meteoの予報上限

    // WMO weathercode → 絵文字・ラベル
    var CODE_MAP = {
        0: ['☀️', '快晴'], 1: ['🌤️', '晴れ'], 2: ['⛅', '一部曇り'], 3: ['☁️', '曇り'],
        45: ['🌫️', '霧'], 48: ['🌫️', '霧'],
        51: ['🌦️', '弱い霧雨'], 53: ['🌦️', '霧雨'], 55: ['🌧️', '強い霧雨'],
        56: ['🌧️', '着氷性霧雨'], 57: ['🌧️', '着氷性霧雨'],
        61: ['🌧️', '弱い雨'], 63: ['🌧️', '雨'], 65: ['🌧️', '強い雨'],
        66: ['🌧️', '着氷性の雨'], 67: ['🌧️', '着氷性の雨'],
        71: ['🌨️', '弱い雪'], 73: ['🌨️', '雪'], 75: ['❄️', '強い雪'], 77: ['🌨️', '霧雪'],
        80: ['🌦️', 'にわか雨'], 81: ['🌧️', 'にわか雨'], 82: ['⛈️', '激しいにわか雨'],
        85: ['🌨️', 'にわか雪'], 86: ['❄️', '強いにわか雪'],
        95: ['⛈️', '雷雨'], 96: ['⛈️', '雷雨（雹）'], 99: ['⛈️', '雷雨（雹）']
    };

    function todayISO() {
        var d = new Date();
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    function daysUntil(dateISO) {
        var today = new Date(todayISO() + 'T00:00:00');
        var target = new Date(dateISO + 'T00:00:00');
        return Math.round((target - today) / 86400000);
    }

    /**
     * 1クエリぶんのジオコーディング検索
     * @returns {Promise<{lat:number, lon:number}|null>}
     */
    function geocodeQuery(query) {
        var url = GEOCODE_URL + '?name=' + encodeURIComponent(query) + '&count=1&language=ja&format=json';
        return fetch(url).then(function(res) {
            if (!res.ok) throw new Error('geocode http ' + res.status);
            return res.json();
        }).then(function(data) {
            var r = data && data.results && data.results[0];
            return r ? { lat: r.latitude, lon: r.longitude } : null;
        }).catch(function() {
            return null;
        });
    }

    /**
     * 会場名・住所からジオコーディングする。結果はlocalStorageに永続キャッシュ（緯度経度は変わらないため）。
     *
     * Open-Meteoのジオコーディングは地名DB（GeoNames）ベースで
     * 「〇〇グラウンド」「〇〇小学校」のような施設名では当たらないことが多い。
     * そのため複数クエリを順に試す: ①住所の市区町村部分 ②施設種別の接尾辞を
     * 除いた会場名 ③会場名そのまま。
     * ※ キャッシュキーは v2。旧実装が失敗結果(null)を永続キャッシュしており、
     *    ロジック改善後も旧キーのままだと失敗が固定化されるためキーを変更した
     * @returns {Promise<{lat:number, lon:number}|null>}
     */
    function geocode(venueName, address) {
        // v3: v2は都道府県付きクエリで失敗した当日missキャッシュが残っている可能性があるため更新
        var cacheKey = 'fcojima_geocode_v3_' + (venueName || '') + '|' + (address || '');
        try {
            var cached = localStorage.getItem(cacheKey);
            if (cached) {
                var parsed = JSON.parse(cached);
                if (parsed && typeof parsed.lat === 'number') return Promise.resolve(parsed);
                // 失敗キャッシュ(null)は当日中のみ有効（翌日に再試行できるようにする）
                if (parsed && parsed.miss === todayISO()) return Promise.resolve(null);
            }
        } catch (e) { /* キャッシュ読み込み失敗は無視して再取得 */ }

        var queries = [];
        if (address) {
            // GeoNames（Open-Meteoの地名DB）は「太田市」で当たるが「群馬県太田市」では
            // 当たらない（実測確認済み）。都道府県を除いた市区町村名を最優先で試す
            var m = address.match(/^(.{2,4}[都道府県])?(.{1,10}?[市区町村])/);
            if (m && m[2]) {
                var city = m[2];
                // 「邑楽郡大泉町」のような郡付きは町村名だけでも試す
                var gunIdx = city.indexOf('郡');
                if (gunIdx > 0 && gunIdx < city.length - 1) queries.push(city.slice(gunIdx + 1));
                queries.push(city);
            } else {
                queries.push(address);
            }
        }
        if (venueName) {
            var stripped = venueName.replace(/(グラウンド|グランド|サッカー場|野球場|運動公園|総合公園|公園|小学校|中学校|高校|高等学校|体育館|運動場|競技場|スポーツ広場|多目的広場|河川敷|緑地)$/, '');
            if (stripped && stripped !== venueName) queries.push(stripped);
            queries.push(venueName);
        }
        // 重複除去
        queries = queries.filter(function(q, i) { return q && queries.indexOf(q) === i; });
        if (queries.length === 0) return Promise.resolve(null);

        // 順に試して最初に当たったものを使う
        var chain = Promise.resolve(null);
        queries.forEach(function(q) {
            chain = chain.then(function(loc) {
                return loc || geocodeQuery(q);
            });
        });
        return chain.then(function(loc) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify(loc || { miss: todayISO() }));
            } catch (e) {}
            return loc;
        });
    }

    /**
     * 指定日の天気予報を取得する。当日中だけ有効なsessionStorageキャッシュを使う。
     * @param {string} venueName - 会場名（登録済み venue.name）
     * @param {string} address - 会場住所（あれば精度が上がる）
     * @param {string} dateISO - イベント日付 'YYYY-MM-DD'
     * @returns {Promise<{ok:boolean, reason?:string, emoji?:string, label?:string, tempMax?:number, tempMin?:number, pop?:number}>}
     */
    Weather.getForecast = function(venueName, address, dateISO) {
        if (!dateISO) return Promise.resolve({ ok: false, reason: 'no-date' });

        var diff = daysUntil(dateISO);
        if (diff < 0) return Promise.resolve({ ok: false, reason: 'past' });
        if (diff > MAX_FORECAST_DAYS) return Promise.resolve({ ok: false, reason: 'too-far' });
        if (!venueName && !address) return Promise.resolve({ ok: false, reason: 'no-venue' });

        var sessionKey = 'fcojima_weather_v2_' + (venueName || address) + '_' + dateISO + '_' + todayISO();
        try {
            var cached = sessionStorage.getItem(sessionKey);
            if (cached) return Promise.resolve(JSON.parse(cached));
        } catch (e) {}

        return geocode(venueName, address).then(function(loc) {
            if (!loc) return { ok: false, reason: 'geocode-failed' };
            var url = FORECAST_URL +
                '?latitude=' + loc.lat + '&longitude=' + loc.lon +
                '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
                '&timezone=Asia%2FTokyo&start_date=' + dateISO + '&end_date=' + dateISO;
            return fetch(url).then(function(res) {
                if (!res.ok) throw new Error('forecast http ' + res.status);
                return res.json();
            }).then(function(data) {
                var d = data && data.daily;
                if (!d || !d.weathercode || d.weathercode.length === 0) return { ok: false, reason: 'no-data' };
                var code = d.weathercode[0];
                var disp = CODE_MAP[code] || ['🌡️', ''];
                return {
                    ok: true,
                    emoji: disp[0],
                    label: disp[1],
                    tempMax: Math.round(d.temperature_2m_max[0]),
                    tempMin: Math.round(d.temperature_2m_min[0]),
                    pop: d.precipitation_probability_max ? d.precipitation_probability_max[0] : null
                };
            });
        }).catch(function() {
            return { ok: false, reason: 'network-error' };
        }).then(function(result) {
            try { sessionStorage.setItem(sessionKey, JSON.stringify(result)); } catch (e) {}
            return result;
        });
    };

    /**
     * 表示用HTML断片を生成（呼び出し元は返り値を innerHTML に差し込むだけでよい）
     */
    Weather.formatChip = function(result) {
        if (!result || !result.ok) {
            var msg = {
                'past': '', // 過去イベントは何も出さない
                'too-far': '天気予報はまだ取得できません（開催16日前頃から表示）',
                'no-venue': '',
                'geocode-failed': '天気: 会場の場所を特定できません（会場登録で住所を設定すると表示されます）',
                'no-data': '天気情報を取得できませんでした',
                'network-error': '天気情報を取得できませんでした',
                'no-date': ''
            }[result ? result.reason : ''] || '';
            if (!msg) return '';
            return '<span class="weather-chip weather-chip-muted">' + msg + '</span>';
        }
        var pop = (result.pop != null) ? '　降水' + result.pop + '%' : '';
        return '<span class="weather-chip">' + result.emoji + ' 現地 ' +
            result.tempMax + '℃/' + result.tempMin + '℃' + pop + '</span>';
    };

})(window.FCOjima.Weather);
