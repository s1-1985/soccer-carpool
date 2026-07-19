/**
 * FC尾島ジュニア - 持ち物チェックリスト
 * イベント種別ごとの持ち物テンプレを返す
 */

window.FCOjima = window.FCOjima || {};
FCOjima.Checklist = FCOjima.Checklist || {};

(function(app) {
    var Checklist = app.Checklist;

    var ITEMS_BY_TYPE = {
        game: ['ゼッケン', 'すね当て', '水筒', '着替え', '雨具（念のため）'],
        practice: ['水筒', 'すね当て', 'ボール（自分の）'],
        event: ['筆記用具', '水筒'],
        nighter: ['ライト付きシューズ推奨', '防寒着'],
        other: ['水筒']
    };

    /**
     * イベント種別に対応する持ち物リストを返す
     * @param {string} type - イベントタイプ識別子
     * @param {string[]} [extra] - イベント個別の追加持ち物（旧形式）
     * @param {string[]} [override] - イベント個別の完全上書きリスト（編集UI保存値。
     *   配列が存在する場合はテンプレを使わずこれをそのまま表示。空配列なら持ち物なし）
     * @returns {string[]}
     */
    Checklist.getItems = function(type, extra, override) {
        if (Array.isArray(override)) return override.slice();
        var base = ITEMS_BY_TYPE[type] || ITEMS_BY_TYPE.other;
        var list = base.slice();
        (extra || []).forEach(function(item) {
            if (item && list.indexOf(item) === -1) list.push(item);
        });
        return list;
    };

    /**
     * イベント種別のテンプレ持ち物を返す（イベントフォームの初期値用）
     */
    Checklist.getTemplate = function(type) {
        return (ITEMS_BY_TYPE[type] || ITEMS_BY_TYPE.other).slice();
    };

    /**
     * 「、」「,」区切りの文字列を持ち物配列にパースする（編集UIの保存用）
     */
    Checklist.parseInput = function(text) {
        if (!text) return [];
        return String(text).split(/[、,，\n]/)
            .map(function(s) { return s.trim(); })
            .filter(function(s, i, arr) { return s && arr.indexOf(s) === i; });
    };

    /**
     * 持ち物チップ群のHTML文字列を返す（呼び出し側でコンテナに差し込む）
     * @param {string} type
     * @param {string[]} [extra]
     * @param {string[]} [override] - イベント個別の完全上書きリスト
     * @returns {string}
     */
    Checklist.formatChips = function(type, extra, override) {
        var items = Checklist.getItems(type, extra, override);
        if (items.length === 0) return '';
        var UI = app.UI;
        var chips = items.map(function(item) {
            return '<span class="checklist-chip">' + UI.escapeHTML(item) + '</span>';
        }).join('');
        return '<div class="checklist-chips"><span class="checklist-label">🎒 持ち物:</span>' + chips + '</div>';
    };

})(window.FCOjima);
