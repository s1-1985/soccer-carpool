// スマホ表示の「見切れ」検出（ページ内で実行する関数を返す）
export const detectFn = () => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const out = [];
  const cs = el => getComputedStyle(el);
  const visible = el => {
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const deepVisible = el => { for (let p = el; p && p !== document.body; p = p.parentElement) { const s = cs(p); if (s.display === 'none' || s.visibility === 'hidden') return false; } return visible(el); };
  const label = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    const t = (el.value !== undefined && el.tagName !== 'BUTTON' && el.tagName !== 'LI' ? el.value : (el.innerText || '')).toString().trim().replace(/\s+/g, ' ').slice(0, 28);
    return s + (t ? ` "${t}"` : '');
  };
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const clipAncestor = el => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = cs(p);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') return { p, s };
    }
    return null;
  };
  const els = [...document.querySelectorAll('body *')].filter(el => !['SCRIPT', 'STYLE', 'OPTION', 'BR', 'svg', 'path', 'TEMPLATE'].includes(el.tagName) && deepVisible(el));
  const seen = new Set();
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const s = cs(el);
    const ca = clipAncestor(el);
    // 1) 祖先の枠（overflow:hidden）で切れている文字・部品
    if (ca && (ownText(el) || ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'A'].includes(el.tagName))) {
      const pr = ca.p.getBoundingClientRect();
      const scrollable = /(auto|scroll)/.test(ca.s.overflowX + ca.s.overflowY);
      const over = Math.max(pr.left - r.left, r.right - pr.right, pr.top - r.top, r.bottom - pr.bottom);
      if (!scrollable && over > 2 && !(s.position === 'fixed')) {
        out.push({ k: 'clipped-by-parent', el: label(el), by: label(ca.p).slice(0, 40), px: Math.round(over) });
      }
    }
    // 2) 画面の左右からはみ出し（横スクロールできる枠の中は除く）
    if ((r.right > vw + 1 || r.left < -1) && s.position !== 'fixed') {
      let inScroller = false;
      for (let p = el.parentElement; p; p = p.parentElement) { const ps = cs(p); if (/(auto|scroll|hidden|clip)/.test(ps.overflowX)) { inScroller = true; break; } }
      if (!inScroller && !(el.parentElement && seen.has(el.parentElement))) {
        out.push({ k: 'off-screen-x', el: label(el), left: Math.round(r.left), right: Math.round(r.right), vw });
      }
      seen.add(el);
    }
    // 3) 自分の幅に文字が収まらず切れている（… で省略している場合も報告）
    if ((ownText(el) || el.tagName === 'BUTTON') && /(hidden|clip)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1) {
      out.push({ k: s.textOverflow === 'ellipsis' ? 'ellipsis' : 'text-cut', el: label(el), sw: el.scrollWidth, cw: el.clientWidth });
    }
    // 4) ボタンの文字がボタンからはみ出す（overflow:visible のまま）
    if (el.tagName === 'BUTTON' && s.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 2) {
      out.push({ k: 'button-text-overflow', el: label(el), sw: el.scrollWidth, cw: el.clientWidth });
    }
  }
  return out;
};

// 押せるか（固定ナビ・他の要素に隠れていないか）を、要素を画面内にスクロールしてから確認する
export const tappableFn = (rootSel) => {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return [];
  const out = [];
  const visible = el => { for (let p = el; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const label = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/)[0]; const t = (el.innerText || el.value || el.placeholder || '').toString().trim().replace(/\s+/g, ' ').slice(0, 24); return s + (t ? ` "${t}"` : ''); };
  const items = [...root.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')].filter(visible);
  for (const el of items) {
    if (el.closest('.global-navigation') || el.closest('.carpool-nav') || el.closest('nav')) continue;
    if (getComputedStyle(el).position === 'fixed') continue;
    if (el.type === 'file') continue;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 2), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 2);
    const hit = document.elementFromPoint(x, y);
    const ok = hit && (hit === el || el.contains(hit) || (el.labels && [...el.labels].some(l => l.contains(hit))) || (hit.tagName === 'LABEL' && hit.control === el));
    if (!ok) out.push({ k: 'not-tappable', el: label(el), coveredBy: hit ? label(hit).slice(0, 50) : null, y: Math.round(y) });
  }
  return out;
};
