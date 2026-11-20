/* 工作日誌產生器
   簡→繁用內建字典（由 OpenCC s2tw 字典裁剪而來，只留會產生差異的片語）。
   「主要獲利 / 主因」依需求不轉換，其餘欄位自動轉繁。 */
(function () {
  'use strict';

  /* ───────── 簡轉繁 ───────── */
  var DICT = window.S2T || { c: {}, p: {} };
  var MAXP = 1;
  for (var k in DICT.p) { if (k.length > MAXP) MAXP = k.length; }

  function s2t(src) {
    if (!src) return '';
    var out = '', i = 0, n = src.length;
    while (i < n) {
      var hit = null;
      for (var L = Math.min(MAXP, n - i); L > 1; L--) {
        var w = src.substr(i, L);
        if (DICT.p[w] !== undefined) { hit = [w, DICT.p[w]]; break; }
      }
      if (hit) { out += hit[1]; i += hit[0].length; }
      else { var c = src[i]; out += (DICT.c[c] !== undefined ? DICT.c[c] : c); i++; }
    }
    return out;
  }

  /* ───────── 小工具 ───────── */
  var $ = function (s) { return document.querySelector(s); };
  var IDENT = '　';                      // 全形空白：內容縮排
  var WHY_1 = '      ';                  // 主要獲利／主因 第一行縮排
  var WHY_N = '　　　　　 ';              // 同上 第二行以後的對齊縮排

  function lines(v) {
    return String(v || '').split('\n').map(function (x) { return x.trim(); })
      .filter(function (x) { return x !== ''; });
  }
  function zh(v) { return s2t(String(v || '').trim()); }

  /* 把「主要獲利 / 主因」這種區塊排版：第一行帶標籤，之後對齊 */
  function whyBlock(label, text) {
    var ls = lines(text);                // 這裡刻意不轉繁體
    if (!ls.length) return [];
    var out = [WHY_1 + label + '-' + ls[0]];
    for (var i = 1; i < ls.length; i++) out.push(WHY_N + ls[i]);
    return out;
  }

  /* ▌項目：無內容只出標題；單行且未勾換行→同行；其餘→換行條列 */
  function routine(title, text, newline) {
    var ls = lines(text).map(zh);
    if (!ls.length) return ['▌' + title];
    if (ls.length === 1 && !newline) return ['▌' + title + '：' + ls[0]];
    return ['▌' + title + '：'].concat(ls.map(function (x) { return IDENT + x; }));
  }

  function fmtDate(v) {
    var d = v ? new Date(v + 'T00:00:00') : new Date();
    if (isNaN(d)) d = new Date();
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '號';
  }

  /* 廳主那一行：　●標題　@代碼：數值 [獲利率] */
  function pnlLine(title, hall, val, rate) {
    hall = String(hall || '').trim().replace(/^@/, '');
    val = String(val || '').trim();
    rate = String(rate || '').trim();
    if (!hall && !val && !rate) return null;
    var s = IDENT + '●' + title;
    if (hall) s += '　@' + hall;
    if (val) s += '：' + val;
    if (rate) s += ' [' + (/%$/.test(rate) ? rate : rate + '%') + ']';
    return s;
  }

  /* ───────── 負損益組別 ───────── */
  var negList = $('#negList'), tpl = $('#negTpl');

  function renumber() {
    var cards = negList.querySelectorAll('.neg');
    cards.forEach(function (c, i) {
      c.querySelector('.negno').textContent = '● 負損益' + (cards.length > 1 ? (i + 1) : '');
      c.querySelector('.negdel').style.visibility = cards.length > 1 ? 'visible' : 'hidden';
    });
  }
  function addNeg() {
    negList.appendChild(tpl.content.cloneNode(true));
    renumber(); render();
  }
  negList.addEventListener('click', function (e) {
    if (!e.target.classList.contains('negdel')) return;
    e.target.closest('.neg').remove();
    if (!negList.querySelector('.neg')) addNeg();
    renumber(); render();
  });
  $('#btnAddNeg').addEventListener('click', addNeg);

  /* ───────── 產生全文 ───────── */
  function build() {
    var L = [];
    L.push('Mike_Chou [工作日誌]　' + fmtDate($('#theDate').value));
    L.push('');
    L.push('Trista 代班業務學習');
    L.push('');

    L.push('【客戶服務】');
    lines($('#service').value).forEach(function (x) { L.push(IDENT + zh(x)); });
    L.push('');

    L.push('【例行工作】');
    var nl = function (id) { return document.querySelector('[data-nl="' + id + '"]').checked; };

    L = L.concat(routine('確認中晚班服務內容', $('#shift').value, nl('shift')));
    L = L.concat(routine('檢查前假日與晚間站長入款', $('#deposit').value, nl('deposit')));

    // ACC
    var acc = document.querySelector('input[name=acc]:checked').value;
    if (acc === 'ok') {
      L.push('▌ACC入帳檢查：入款無誤');
    } else {
      var note = zh($('#accNote').value);
      L.push('▌ACC入帳檢查：入款異常已回報' + (note ? '，' + note : ''));
    }

    L = L.concat(routine('網站檢查', $('#site').value, nl('site')));
    L = L.concat(routine('開立需求單', $('#ticket').value, nl('ticket')));

    // 網站資料抓取與檢視
    var pnl = [];
    var pos = pnlLine('正損益最多', $('#pHall').value, $('#pVal').value, $('#pRate').value);
    if (pos) { pnl.push(pos); pnl = pnl.concat(whyBlock('主要獲利', $('#pWhy').value)); }

    if (document.querySelector('input[name=neg]:checked').value === 'yes') {
      var cards = Array.prototype.slice.call(negList.querySelectorAll('.neg'));
      var filled = cards.filter(function (c) {
        return ['.nHall', '.nVal', '.nRate', '.nWhy'].some(function (s) {
          return c.querySelector(s).value.trim() !== '';
        });
      });
      filled.forEach(function (c, i) {
        var title = '負損益' + (filled.length > 1 ? (i + 1) : '');
        var ln = pnlLine(title, c.querySelector('.nHall').value,
          c.querySelector('.nVal').value, c.querySelector('.nRate').value);
        if (ln) { pnl.push(ln); pnl = pnl.concat(whyBlock('主因', c.querySelector('.nWhy').value)); }
      });
    }
    L.push('▌網站資料抓取與檢視');
    L = L.concat(pnl);

    L.push('');
    L = L.concat(routine('分析異常資料', $('#abnormal').value, nl('abnormal')));

    if (document.querySelector('input[name=case]:checked').value === 'done') {
      L.push('▌檢視案件單');
    }

    L.push('');
    L.push('【額外學習】');
    lines($('#learn').value).forEach(function (x) { L.push(IDENT + '●' + zh(x)); });

    // 收尾：砍掉結尾多餘空行
    while (L.length && L[L.length - 1] === '') L.pop();
    return L.join('\n');
  }

  /* ───────── 事件 ───────── */
  var preview = $('#preview');
  function render() { preview.textContent = build(); }

  document.addEventListener('input', render);
  document.addEventListener('change', function (e) {
    if (e.target.name === 'acc') {
      $('#accNote').classList.toggle('hidden', e.target.value !== 'ng');
    }
    render();
  });

  var toastT = 0;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2200);
  }

  $('#btnCopy').addEventListener('click', function () {
    var txt = build();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已複製'); }
      catch (err) { toast('複製失敗，請手動選取'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(function () { toast('已複製'); }, fallback);
    } else { fallback(); }
  });

  $('#btnClear').addEventListener('click', function () {
    if (!confirm('清空所有填寫內容？')) return;
    document.querySelectorAll('textarea, input[type=text]').forEach(function (el) { el.value = ''; });
    document.querySelector('input[name=acc][value=ok]').checked = true;
    document.querySelector('input[name=neg][value=yes]').checked = true;
    document.querySelector('input[name=case][value=done]').checked = true;
    $('#accNote').classList.add('hidden');
    negList.replaceChildren(); addNeg();
    render();
  });

  /* ───────── 啟動 ───────── */
  (function init() {
    var d = new Date(), p = function (x) { return String(x).padStart(2, '0'); };
    $('#theDate').value = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    addNeg();
    render();
  })();
})();
