/**
 * FC尾島ジュニア - 車の絵（上から見た図）
 *
 * 座席割り当ての車（.car-top-view）と、車提供の座席の図（.cp-car）に、同じ車のSVGを敷く。
 * 席の数で箱の高さが変わるので、箱の実際の大きさに合わせて描き直す（ResizeObserver）。
 * 席は箱の中の本物のボタン・要素で、絵はその後ろ（pointer-events なし）。
 *   図 = 左右のタイヤとミラー・ボディ（丸い鼻先とヘッドライト・テールランプ）・フロント/リアガラス・車室
 */

window.FCOjima = window.FCOjima || {};
FCOjima.CarArt = FCOjima.CarArt || {};

(function(CarArt) {
    var NS = 'http://www.w3.org/2000/svg';
    var SIDE = 9;   // 左右にはみ出す分（タイヤ・ミラー）
    var VERT = 5;   // 上下にはみ出す分
    var uid = 0;

    function el(name, attrs) {
        var n = document.createElementNS(NS, name);
        Object.keys(attrs || {}).forEach(function(k) { n.setAttribute(k, attrs[k]); });
        return n;
    }

    /** 箱の幅 w・高さ h に合わせた車のSVGを作る */
    CarArt.build = function(w, h) {
        var id = 'carart' + (++uid);
        var W = Math.max(60, w), H = Math.max(80, h);
        var x0 = SIDE, y0 = VERT, x1 = x0 + W, y1 = y0 + H;
        var rn = Math.min(W * 0.26, 72);     // 鼻先の丸み（横）
        var rv = Math.min(H * 0.22, 52);     // 鼻先の丸み（縦）
        var rr = Math.min(W * 0.1, 26);      // 後ろの丸み
        var svg = el('svg', { 'class': 'car-art', viewBox: '0 0 ' + (W + SIDE * 2) + ' ' + (H + VERT * 2), preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });

        var defs = el('defs');
        var body = el('linearGradient', { id: id + 'b', x1: '0', y1: '0', x2: '0', y2: '1' });
        body.appendChild(el('stop', { offset: '0', 'stop-color': '#ffffff' }));
        body.appendChild(el('stop', { offset: '1', 'stop-color': '#edf0f3' }));
        var glass = el('linearGradient', { id: id + 'g', x1: '0', y1: '0', x2: '0', y2: '1' });
        glass.appendChild(el('stop', { offset: '0', 'stop-color': '#b9cfdf' }));
        glass.appendChild(el('stop', { offset: '1', 'stop-color': '#dbe8f1' }));
        var shadow = el('filter', { id: id + 's', x: '-10%', y: '-10%', width: '120%', height: '125%' });
        shadow.appendChild(el('feDropShadow', { dx: '0', dy: '2', stdDeviation: '2.5', 'flood-color': '#1f2a37', 'flood-opacity': '0.16' }));
        defs.appendChild(body); defs.appendChild(glass); defs.appendChild(shadow);
        svg.appendChild(defs);

        // タイヤ（前後2本ずつ。ボディの下に敷いて外側だけ見せる）
        var wh = Math.max(26, Math.min(48, H * 0.2));
        [0.2, 0.8].forEach(function(f) {
            var cy = y0 + H * f - wh / 2;
            svg.appendChild(el('rect', { x: x0 - 5, y: cy, width: 12, height: wh, rx: 5, fill: '#3b4048' }));
            svg.appendChild(el('rect', { x: x1 - 7, y: cy, width: 12, height: wh, rx: 5, fill: '#3b4048' }));
        });

        // ボディ
        var d = 'M' + x0 + ',' + (y0 + rv) +
            ' A' + rn + ',' + rv + ' 0 0 1 ' + (x0 + rn) + ',' + y0 +
            ' L' + (x1 - rn) + ',' + y0 +
            ' A' + rn + ',' + rv + ' 0 0 1 ' + x1 + ',' + (y0 + rv) +
            ' L' + x1 + ',' + (y1 - rr) +
            ' A' + rr + ',' + rr + ' 0 0 1 ' + (x1 - rr) + ',' + y1 +
            ' L' + (x0 + rr) + ',' + y1 +
            ' A' + rr + ',' + rr + ' 0 0 1 ' + x0 + ',' + (y1 - rr) + ' Z';
        svg.appendChild(el('path', { d: d, fill: 'url(#' + id + 'b)', stroke: '#c3cad2', 'stroke-width': 2, filter: 'url(#' + id + 's)' }));

        // サイドミラー
        var my = y0 + Math.min(54, H * 0.2);
        [[x0 - 7, 'M' + (x0 + 1) + ',' + (my + 10) + ' L' + (x0 - 6) + ',' + (my + 8) + ' Q' + (x0 - 9) + ',' + (my + 2) + ' ' + (x0 - 4) + ',' + my + ' L' + (x0 + 1) + ',' + (my + 1) + ' Z'],
         [x1 + 7, 'M' + (x1 - 1) + ',' + (my + 10) + ' L' + (x1 + 6) + ',' + (my + 8) + ' Q' + (x1 + 9) + ',' + (my + 2) + ' ' + (x1 + 4) + ',' + my + ' L' + (x1 - 1) + ',' + (my + 1) + ' Z']
        ].forEach(function(m) { svg.appendChild(el('path', { d: m[1], fill: '#e4e8ec', stroke: '#c3cad2', 'stroke-width': 1.5, 'stroke-linejoin': 'round' })); });

        // ヘッドライト（鼻先の左右）とテールランプ（後ろの左右）
        var lw = Math.min(26, W * 0.1);
        [x0 + rn * 0.42, x1 - rn * 0.42 - lw].forEach(function(lx) {
            svg.appendChild(el('rect', { x: lx, y: y0 + 7, width: lw, height: 6, rx: 3, fill: '#fff1b8', stroke: '#e3c25b', 'stroke-width': 1 }));
        });
        [x0 + rr * 0.55, x1 - rr * 0.55 - lw].forEach(function(lx) {
            svg.appendChild(el('rect', { x: lx, y: y1 - 11, width: lw, height: 5, rx: 2.5, fill: '#f08a8a', stroke: '#d65c5c', 'stroke-width': 1 }));
        });

        // フロントガラス（前＝上）とリアガラス（後ろ＝下）
        var gi = Math.min(rn * 0.7, W * 0.16);
        var fg = 'M' + (x0 + 9) + ',' + (y0 + 34) + ' L' + (x0 + gi + 6) + ',' + (y0 + 17) + ' Q' + (x0 + W / 2) + ',' + (y0 + 9) + ' ' + (x1 - gi - 6) + ',' + (y0 + 17) + ' L' + (x1 - 9) + ',' + (y0 + 34) + ' Z';
        var rg = 'M' + (x0 + 11) + ',' + (y1 - 31) + ' L' + (x1 - 11) + ',' + (y1 - 31) + ' L' + (x1 - 19) + ',' + (y1 - 16) + ' Q' + (x0 + W / 2) + ',' + (y1 - 11) + ' ' + (x0 + 19) + ',' + (y1 - 16) + ' Z';
        svg.appendChild(el('path', { d: fg, fill: 'url(#' + id + 'g)', stroke: '#a9bccb', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }));
        svg.appendChild(el('path', { d: rg, fill: 'url(#' + id + 'g)', stroke: '#a9bccb', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }));

        // 車室（席が並ぶ天井側）
        svg.appendChild(el('rect', { x: x0 + 7, y: y0 + 38, width: W - 14, height: Math.max(20, H - 74), rx: 14, fill: '#f6f8fa', stroke: '#e0e5ea', 'stroke-width': 1.5 }));
        return svg;
    };

    function redraw(box) {
        var old = box.querySelector(':scope > .car-art');
        var w = box.clientWidth, h = box.clientHeight;
        if (!w || !h) return;
        if (old && old.dataset.w === String(w) && old.dataset.h === String(h)) return;
        var svg = CarArt.build(w, h);
        svg.dataset.w = String(w);
        svg.dataset.h = String(h);
        svg.style.left = (-SIDE) + 'px';
        svg.style.top = (-VERT) + 'px';
        svg.style.width = (w + SIDE * 2) + 'px';
        svg.style.height = (h + VERT * 2) + 'px';
        if (old) old.remove();
        box.insertBefore(svg, box.firstChild);
    }

    /**
     * 箱に車の絵を敷く（何度呼んでもよい。箱の中身を作り直したあとも呼ぶ）
     * @param {HTMLElement} box - .car-top-view / .cp-car
     */
    CarArt.attach = function(box) {
        if (!box) return;
        box.classList.add('has-car-art');
        redraw(box);
        if (!box._carArtObserver && typeof ResizeObserver === 'function') {
            box._carArtObserver = new ResizeObserver(function() { redraw(box); });
            box._carArtObserver.observe(box);
        }
    };
})(FCOjima.CarArt);
