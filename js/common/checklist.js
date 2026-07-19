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
     * @param {string[]} [extra] - イベント個別の追加持ち物
     * @returns {string[]}
     */
    Checklist.getItems = function(type, extra) {
        var base = ITEMS_BY_TYPE[type] || ITEMS_BY_TYPE.other;
        var list = base.slice();
        (extra || []).forEach(function(item) {
            if (item && list.indexOf(item) === -1) list.push(item);
        });
        return list;
    };

    /**
     * 持ち物チップ群のHTML文字列を返す（呼び出し側でコンテナに差し込む）
     * @param {string} type
     * @param {string[]} [extra]
     * @returns {string}
     */
    Checklist.formatChips = function(type, extra) {
        var items = Checklist.getItems(type, extra);
        if (items.length === 0) return '';
        var UI = app.UI;
        var chips = items.map(function(item) {
            return '<span class="checklist-chip">' + UI.escapeHTML(item) + '</span>';
        }).join('');
        return '<div class="checklist-chips"><span class="checklist-label">🎒 持ち物:</span>' + chips + '</div>';
    };

})(window.FCOjima);
