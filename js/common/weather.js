/**
 * FC尾島ジュニア - 会場天気予報
 *
 * 目的: 「今のリアルタイム天気」ではなく「イベント当日の会場の天気」を数日前から確認できること。
 *
 * 使用API（すべて無料・APIキー不要・クライアント端末から直接アクセス）:
 * 1. 国土地理院 住所検索API（msearch.gsi.go.jp）
 *    会場の登録住所 → ピンポイント座標（町丁目レベル）。CORS許可済み（実測確認）。
 *    市の中心座標に固定しないための要。住所が未登録の会場のみOpen-Meteoの地名検索に
 *    フォールバックする（市区町村レベルの精度になる）
 * 2. Open-Meteo 予報API（api.open-meteo.com）
 *    座標 → 日別予報（16日先まで）。今日〜イベント当日の数日分をウィジェット表示する。
 *    無料枠は1日1万リクエスト/IP。座標はlocalStorageに永続キャッシュ・予報は
 *    sessionStorageに当日中キャッシュするため、70人規模でも1人1日数リクエスト程度
 *
 * ネットワーク不可・座標特定失敗などはすべて静かに劣化し、
 * 「当日の会場の天気を調べる」外部リンク（Google検索）だけでも必ず出す。
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Weather = FCOjima.Weather || {};

(function(Weather) {
    var GSI_URL = 'https://msearch.gsi.go.jp/address-search/AddressSearch';
    var GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
    var FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
    var MAX_FORECAST_DAYS = 15; // Open-Meteoの予報上限（16日分＝今日+15日）
    var MAX_WIDGET_DAYS = 6;    // ウィジェットに表示する最大日数

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
    var DOW = ['日', '月', '火', '水', '木', '金', '土'];

    function todayISO() {
        var d = new Date();
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    function daysUntil(dateISO) {
        var today = new Date(todayISO() + 'T00:00:00');
        var target = new Date(dateISO + 'T00:00:00');
        return Math.round((target - today) / 86400000);
    }

    /** 国土地理院APIで住所→ピンポイント座標 */
    function geocodeGSI(address) {
        if (!address) return Promise.resolve(null);
        var url = GSI_URL + '?q=' + encodeURIComponent(address);
        return fetch(url).then(function(res) {
            if (!res.ok) throw new Error('gsi http ' + res.status);
            return res.json();
        }).then(function(data) {
            var f = Array.isArray(data) && data[0];
            var c = f && f.geometry && f.geometry.coordinates;
            // GeoJSONは [経度, 緯度] 順
            return (c && typeof c[1] === 'number') ? { lat: c[1], lon: c[0], precise: true } : null;
        }).catch(function() {
            return null;
        });
    }

    /** Open-Meteo地名検索（1クエリ） */
    function geocodeQuery(query) {
        var url = GEOCODE_URL + '?name=' + encodeURIComponent(query) + '&count=1&language=ja&format=json';
        return fetch(url).then(function(res) {
            if (!res.ok) throw new Error('geocode http ' + res.status);
            return res.json();
        }).then(function(data) {
            var r = data && data.results && data.results[0];
            return r ? { lat: r.latitude, lon: r.longitude, precise: false } : null;
        }).catch(function() {
            return null;
        });
    }

    /**
     * 会場名・住所 → 座標。
     * ①住所があれば国土地理院でピンポイント座標（最優先）
     * ②失敗時はOpen-Meteo地名検索（市区町村名→接尾辞除去会場名→会場名）
     * 成功はlocalStorageに永続キャッシュ、失敗は当日中のみキャッシュ
     */
    function geocode(venueName, address) {
        // v4: GSIピンポイント対応。旧バージョンの市区町村レベル座標キャッシュを引き継がない
        var cacheKey = 'fcojima_geocode_v4_' + (venueName || '') + '|' + (address || '');
        try {
            var cached = localStorage.getItem(cacheKey);
            if (cached) {
                var parsed = JSON.parse(cached);
                if (parsed && typeof parsed.lat === 'number') return Promise.resolve(parsed);
                if (parsed && parsed.miss === todayISO()) return Promise.resolve(null);
            }
        } catch (e) { /* キャッシュ読み込み失敗は無視して再取得 */ }

        return geocodeGSI(address).then(function(loc) {
            if (loc) return loc;
            // フォールバック: Open-Meteo地名検索の連鎖
            // （GeoNamesは「太田市」で当たるが「群馬県太田市」では当たらない・実測確認済み）
            var queries = [];
            if (address) {
                var m = address.match(/^(.{2,4}[都道府県])?(.{1,10}?[市区町村])/);
                if (m && m[2]) {
                    var city = m[2];
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
            queries = queries.filter(function(q, i) { return q && queries.indexOf(q) === i; });

            var chain = Promise.resolve(null);
            queries.forEach(function(q) {
                chain = chain.then(function(hit) { return hit || geocodeQuery(q); });
            });
            return chain;
        }).then(function(loc) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify(loc || { miss: todayISO() }));
            } catch (e) {}
            return loc;
        });
    }

    /**
     * 今日〜イベント当日の日別予報を取得する。
     * @returns {Promise<{ok:boolean, reason?:string, precise?:boolean,
     *   days?:Array<{date:string, md:string, dow:string, emoji:string, label:string,
     *                tempMax:number, tempMin:number, pop:number|null, isEventDay:boolean}>}>}
     */
    Weather.getDailyForecast = function(venueName, address, eventDateISO) {
        if (!eventDateISO) return Promise.resolve({ ok: false, reason: 'no-date' });

        var diff = daysUntil(eventDateISO);
        if (diff < 0) return Promise.resolve({ ok: false, reason: 'past' });
        if (diff > MAX_FORECAST_DAYS) return Promise.resolve({ ok: false, reason: 'too-far' });
        if (!venueName && !address) return Promise.resolve({ ok: false, reason: 'no-venue' });

        var sessionKey = 'fcojima_weatherdays_v1_' + (venueName || address) + '_' + eventDateISO + '_' + todayISO();
        try {
            var cached = sessionStorage.getItem(sessionKey);
            if (cached) return Promise.resolve(JSON.parse(cached));
        } catch (e) {}

        return geocode(venueName, address).then(function(loc) {
            if (!loc) return { ok: false, reason: 'geocode-failed' };
            var url = FORECAST_URL +
                '?latitude=' + loc.lat + '&longitude=' + loc.lon +
                '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
                '&timezone=Asia%2FTokyo&start_date=' + todayISO() + '&end_date=' + eventDateISO;
            return fetch(url).then(function(res) {
                if (!res.ok) throw new Error('forecast http ' + res.status);
                return res.json();
            }).then(function(data) {
                var d = data && data.daily;
                if (!d || !d.time || d.time.length === 0) return { ok: false, reason: 'no-data' };
                var days = d.time.map(function(dateStr, i) {
                    var disp = CODE_MAP[d.weathercode[i]] || ['🌡️', ''];
                    var dt = new Date(dateStr + 'T00:00:00');
                    return {
                        date: dateStr,
                        md: (dt.getMonth() + 1) + '/' + dt.getDate(),
                        dow: DOW[dt.getDay()],
                        emoji: disp[0],
                        label: disp[1],
                        tempMax: Math.round(d.temperature_2m_max[i]),
                        tempMin: Math.round(d.temperature_2m_min[i]),
                        pop: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
                        isEventDay: dateStr === eventDateISO
                    };
                });
                // 長期間の場合は当日側（末尾）を優先して最大6日分
                if (days.length > MAX_WIDGET_DAYS) days = days.slice(-MAX_WIDGET_DAYS);
                return { ok: true, precise: !!loc.precise, days: days };
            });
        }).catch(function() {
            return { ok: false, reason: 'network-error' };
        }).then(function(result) {
            try { sessionStorage.setItem(sessionKey, JSON.stringify(result)); } catch (e) {}
            return result;
        });
    };

    /** 「当日の会場の天気を調べる」外部リンク（Google検索の天気カードに飛ぶ） */
    Weather.buildExternalLink = function(venueName, address) {
        // 会場名だけだとGoogleが場所を特定できないことがあるため、住所の市区町村を添える
        var q = venueName || '';
        if (address) {
            var m = address.match(/^(.{2,4}[都道府県])?(.{1,10}?[市区町村])/);
            if (m && m[2]) q = m[2] + ' ' + q;
        }
        return 'https://www.google.com/search?q=' + encodeURIComponent((q + ' 天気').trim());
    };

    /**
     * 数日分予報ウィジェットのHTMLを生成する。
     * 予報が取得できない場合も外部リンクだけは必ず表示する。
     */
    Weather.formatWidget = function(result, venueName, address) {
        var esc = (FCOjima.UI && FCOjima.UI.escapeHTML) ? FCOjima.UI.escapeHTML : function(s) { return s; };
        var link = '<a class="weather-ext-link" href="' + Weather.buildExternalLink(venueName, address) +
            '" target="_blank" rel="noopener">🔗 当日の会場の天気を調べる</a>';

        if (!result || !result.ok) {
            var reason = result ? result.reason : '';
            if (reason === 'past' || reason === 'no-date' || reason === 'no-venue') return '';
            var msg = {
                'too-far': '天気予報は開催約2週間前から表示されます',
                'geocode-failed': '', // 場所を特定できなくてもリンクは出す
                'no-data': '',
                'network-error': ''
            }[reason] || '';
            return '<div class="weather-widget weather-widget-fallback">' +
                (msg ? '<span class="weather-chip weather-chip-muted">' + msg + '</span>' : '') +
                link + '</div>';
        }

        var cells = result.days.map(function(day) {
            var pop = (day.pop != null) ? day.pop + '%' : '-';
            return '<div class="weather-day' + (day.isEventDay ? ' weather-day-event' : '') + '"' +
                ' title="' + esc(day.label) + '">' +
                '<div class="wd-date">' + day.md + '<span class="wd-dow">(' + day.dow + ')</span></div>' +
                '<div class="wd-emoji">' + day.emoji + '</div>' +
                '<div class="wd-temp"><span class="wd-max">' + day.tempMax + '</span>/<span class="wd-min">' + day.tempMin + '</span>℃</div>' +
                '<div class="wd-pop">💧' + pop + '</div>' +
                (day.isEventDay ? '<div class="wd-event-label">当日</div>' : '') +
                '</div>';
        }).join('');

        return '<div class="weather-widget">' +
            '<div class="weather-days">' + cells + '</div>' +
            '<div class="weather-widget-foot">' +
            '<span class="weather-precision">' + (result.precise ? '📍 会場周辺の予報' : '📍 市区町村の予報') + '</span>' +
            link +
            '</div></div>';
    };

    // ───── 旧API互換（他の呼び出し元が残っていても壊さない） ─────
    Weather.getForecast = function(venueName, address, dateISO) {
        return Weather.getDailyForecast(venueName, address, dateISO).then(function(r) {
            if (!r.ok) return { ok: false, reason: r.reason };
            var ev = r.days.filter(function(d) { return d.isEventDay; })[0] || r.days[r.days.length - 1];
            return { ok: true, emoji: ev.emoji, label: ev.label, tempMax: ev.tempMax, tempMin: ev.tempMin, pop: ev.pop };
        });
    };
    Weather.formatChip = function(result) {
        if (!result || !result.ok) return '';
        var pop = (result.pop != null) ? '　降水' + result.pop + '%' : '';
        return '<span class="weather-chip">' + result.emoji + ' 現地 ' +
            result.tempMax + '℃/' + result.tempMin + '℃' + pop + '</span>';
    };

})(window.FCOjima.Weather);
