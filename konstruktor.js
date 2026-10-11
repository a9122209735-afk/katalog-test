/* Конструктор типового решения узла ООО «ПРОМБУРГ»: квиз из четырёх шагов, результат подбора, заказ.
   Подбор делает podbor.js по данным window.KONSTR; этот файл — только интерфейс. ES5, без зависимостей, работает с file://.
   Адрес: konstruktor.html?dn=219&s=6&l=60&pn=1.6&t1=150&t0=-30&pr=kanalnaya  (то же после # — тоже читается)
     dn — наружный диаметр, мм; s — стенка, мм; l — длина, м (l=max — «не знаю»); sr — voda | par; pn — 1.6 | 2.5;
     t1, t0 — температуры, °С; pr — nadzemnaya | kanalnaya; tm — температура монтажа; iz — вес изоляции, кг/м; h — высота опор;
     pb — код позиции каталога (подставляет её Dн); shag — открыть шаг 1…4; zakaz — izdeliya | komplekt | vse.
   Сервис заказов: если в konstruktor-servis.js задан адрес window.KONSTR_SERVIS (POST …/zakaz), заказ комплекта уходит на сервис
     (оплата на сайте или по счёту); адрес не задан или сервис недоступен — как раньше, готовится письмо (mailto).
   Заявка каталога: localStorage['pbSpec2'] — тот же ключ и та же запись, что у kat.js. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var KAT = window.KAT || {}, D = window.KONSTR, podbor = window.podbor;
  var BRAND = KAT.brand || {};
  var EMAIL = BRAND.email || 'promburg@yandex.ru';
  var BASE = typeof KAT.base === 'string' ? KAT.base : '';
  var KQ = window.KQ || '';
  var SPEC_KEY = 'pbSpec2';
  var MAILTO_MAX = 1800;
  var SERVIS = typeof window.KONSTR_SERVIS === 'string' ? window.KONSTR_SERVIS.replace(/^\s+|\s+$/g, '') : '';
  var OFERTA = typeof window.KONSTR_OFERTA === 'string' ? window.KONSTR_OFERTA : '';
  var SERVIS_ZHDAT = 30000;
  if (!app) { return; }
  if (!D || !podbor) {
    app.innerHTML = '<div class="panel">Не загрузились данные конструктора. Обновите страницу или отправьте задание на <a href="mailto:' + EMAIL + '">' + EMAIL + '</a>.</div>';
    return;
  }

  var VARIANTY = [
    { id: 'el', nazv: 'Электронная версия', kratko: 'электронная версия', cena: 20000,
      opis: 'Альбом PDF, спецификация XLSX, расчётная записка PDF, модели STEP. Отправляется на электронную почту после поступления оплаты.' },
    { id: 'eks', nazv: 'С экспертизой инженера', kratko: 'с экспертизой инженера', cena: 100000,
      opis: 'Комплект электронной версии и сканы листов с подписью конструктора. Срок — 10 дней после оплаты.' }
  ];
  var SHAGI = ['Труба', 'Участок', 'Среда', 'Условия'];
  var PROKL = { nadzemnaya: 'надземная', kanalnaya: 'подземная канальная' };
  var ROLI = { kompensator: 'Компенсатор', no_koncevaya: 'Неподвижная опора', no_promezhutochnaya: 'Неподвижная опора', skolzyashchaya: 'Скользящая опора', otvod: 'Отвод' };

  /* ---------- состояние ---------- */
  var f = { dn: '', s: '', l: '', lx: false, sr: 'voda', pn: '', t1: '', t0: '', pr: '', tm: '', iz: '', h: '100' };
  var ui = { view: 'shag', shag: 1, doshel: 1, errs: {}, sSam: false, zakaz: '', pbNote: '', dobavleno: '', pismo: null,
    zf: { v: 'el', org: '', inn: '', kont: '', mail: '', opl: 'online', sogl: false }, zerrs: {}, srv: null, kl: null };
  var RES = null;

  /* ---------- мелочи ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function P(v) {
    if (v === null || v === undefined) { return null; }
    v = String(v).replace(/\s+/g, '').replace(',', '.').replace('−', '-');
    if (v === '') { return null; }
    if (!/^-?\d+(\.\d+)?$/.test(v)) { return NaN; }
    return Number(v);
  }
  function ok(x) { return typeof x === 'number' && isFinite(x); }
  function nf(x, nd) {
    if (!ok(x)) { return '—'; }
    if (nd === undefined) { nd = 2; }
    var neg = x < 0, s = Math.abs(x).toFixed(nd);
    if (nd > 0) { s = s.replace(/0+$/, '').replace(/\.$/, ''); }
    var p = s.split('.');
    if (p[0].length > 4) { p[0] = p[0].replace(/\B(?=(\d{3})+$)/g, ' '); }
    if (Number(s) === 0) { neg = false; }
    return (neg ? '−' : '') + p[0] + (p[1] ? ',' + p[1] : '');
  }
  function rub(x) { return String(x).replace(/\B(?=(\d{3})+$)/g, ' ') + ' ₽'; }
  function mn(n, a, b, c) { var m = n % 100, k = n % 10; return (m > 10 && m < 20) ? c : k === 1 ? a : (k >= 2 && k <= 4) ? b : c; }
  function truba(dn) { for (var i = 0; i < D.truby.length; i++) { if (D.truby[i].d_nar === dn) { return D.truby[i]; } } return null; }
  function kopiya(o) { var r = {}, k; for (k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) { r[k] = o[k]; } } return r; }
  function kody(res) { var r = []; for (var i = 0; i < res.prichiny_otkaza.length; i++) { r.push(res.prichiny_otkaza[i].kod); } return r; }
  function img(png) { return png ? BASE + png : ''; }
  function mini(png) { return png ? BASE + png.replace(/\.(png|webp)$/, '-thumb.$1') : ''; }
  function kartochka(slug, pb) { return 'atlas.html#/c/' + encodeURIComponent(slug) + '/' + encodeURIComponent(pb); }
  function kopirovat(text, btn) {
    function gotovo() { if (!btn) { return; } var t = btn.textContent; btn.textContent = 'Скопировано'; setTimeout(function () { btn.textContent = t; }, 1600); }
    function zapasnoj() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); gotovo(); } catch (e) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(gotovo, zapasnoj); } else { zapasnoj(); }
  }

  /* ---------- очистка текстов движка для показа ---------- */
  /* Покупателю не показывается название руководящего документа изготовителя компенсаторов (с номерами его пунктов, формул и таблиц):
     где источник нужен по смыслу, он назван «методика производителя компенсаторов». Обозначения изделий — как в каталоге. Движок и данные не меняются: чистится всё, что из них попадает на страницу, в письмо и в буфер.
     Ссылки на СП 124.13330.2012, ГОСТ и серию 5.903-13 остаются. */
  /* ochistka:start */
  function ochistitTekst(s) {
    if (typeof s !== 'string' || !/РД|ВЭП|редакци/.test(s)) { return s; }
    var DOK = '(?:РД-3-ВЭП(?:-\\d{4})?|РД(?![A-Za-zА-Яа-яЁё\\d-]))';
    var NOM = '\\(?[0-9Е]+(?:\\.[0-9]+)*\\)?';
    var SSYL = '(?:,\\s*(?:п|ф|табл)\\.\\s*' + NOM + '(?:\\s*[,–-]\\s*' + NOM + ')*)?';
    /* обороты, где документ стоит вне скобок */
    s = s.replace(new RegExp(':\\s*' + DOK + '\\s*\\([^()]*\\)\\s*допускает применение', 'g'), ': по методике производителя компенсаторов применение допускается');
    s = s.replace(new RegExp('подобраны по формулам?\\s*\\([\\d.]+\\)(?:\\s*,\\s*\\([\\d.]+\\))*\\s*' + DOK + '\\s*—\\s*', 'g'), 'подобраны по методике производителя компенсаторов — ');
    s = s.replace(new RegExp('\\s*по формулам?\\s*\\([\\d.]+\\)(?:\\s*,\\s*\\([\\d.]+\\))*\\s*' + DOK, 'g'), '');
    s = s.replace(new RegExp('в формуле\\s*\\([\\d.]+\\)\\s*' + DOK, 'g'), 'в расчёте силы трения');
    s = s.replace(new RegExp('размеры и масса по ' + DOK + ',\\s*табл\\.\\s*[^,()]+,\\s*', 'g'), 'размеры и масса ');
    s = s.replace(new RegExp('в таблицах[\\d\\sи,]*' + DOK, 'g'), 'в таблицах методики производителя компенсаторов');
    /* скобки со ссылкой: части через «;» с документом убираются, остальные остаются; пустая скобка убирается целиком */
    s = s.replace(/(\s*)\(((?:[^()]|\([^()]*\))*)\)/g, function (vse, probel, vnutri) {
      if (!/РД|ВЭП/.test(vnutri)) { return vse; }
      var ch = vnutri.split(';'), ost = [], i;
      for (i = 0; i < ch.length; i++) { if (!/РД|ВЭП/.test(ch[i])) { ost.push(ch[i].replace(/^\s+|\s+$/g, '')); } }
      return ost.length ? probel + '(' + ost.join('; ') + ')' : '';
    });
    /* что осталось: название документа и редакция — нейтрально */
    s = s.replace(new RegExp('по\\s+' + DOK + SSYL, 'g'), 'по методике производителя компенсаторов');
    s = s.replace(new RegExp(',?\\s*' + DOK + '(?:,\\s*шестая редакция(?:,\\s*\\d{4})?)?' + SSYL, 'g'), '');
    s = s.replace(/,?\s*шестая редакция(?:,\s*\d{4})?/g, '');
    /* следы */
    s = s.replace(/\(\s*\)/g, '').replace(/\(\s*;\s*/g, '(').replace(/\s*;\s*\)/g, ')').replace(/ {2,}/g, ' ').replace(/\s+([.,;:)])/g, '$1').replace(/^\s+|\s+$/g, '');
    return s;
  }
  /* ochistka:end */
  function ochistit(o) {
    var k;
    if (typeof o === 'string') { return ochistitTekst(o); }
    if (o && typeof o === 'object') {
      /* ссылки на формулы и страницы документа в интерфейсе не нужны */
      delete o.formuly; delete o.oboznachenie_rd; delete o.rd_page; delete o.rd_page_pech; /* показывается oboznachenie — как в каталоге */
      for (k in o) { if (Object.prototype.hasOwnProperty.call(o, k) && k !== 'tz' && k !== 'shifr_kanon' && k !== 'slug' && k !== 'png' && k !== 'step') { o[k] = ochistit(o[k]); } }
    }
    return o;
  }
  /* единственная точка входа в движок: результат сразу очищен */
  var podborDvizhka = podbor;
  podbor = function (tz) { return ochistit(podborDvizhka(tz)); };
  podbor.podskazka = podborDvizhka.podskazka;
  podbor.ogovorka = ochistitTekst(podborDvizhka.ogovorka);

  /* ---------- ТЗ ---------- */
  function tzOf() {
    var tz = { sreda: f.sr }, v;
    v = P(f.dn); if (v !== null) { tz.dn_truby = v; }
    v = P(f.s); if (v !== null) { tz.stenka = v; }
    v = P(f.pn); if (v !== null) { tz.pn = v; }
    v = P(f.t1); if (v !== null) { tz.t1 = v; }
    v = P(f.t0); if (v !== null) { tz.t0 = v; }
    v = P(f.tm); if (v !== null) { tz.t_mont = v; }
    if (f.pr) { tz.prokladka = f.pr; }
    if (!f.lx) { v = P(f.l); if (v !== null) { tz.dlina = v; } }
    v = P(f.iz); if (v !== null) { tz.izolyaciya_kg_m = v; }
    v = P(f.h); if (v !== null) { tz.vysota_opory = v; }
    return tz;
  }
  /* строка ТЗ латиницей — в том же виде, что shifr_kanon движка: короткая для письма и однозначная */
  function tzStroka(res) {
    if (res && res.shifr_kanon) { return res.shifr_kanon; }
    function k(x) { return ok(x) ? String(x) : '?'; }
    var tz = tzOf();
    return 'd=' + k(tz.dn_truby) + '|s=' + (ok(tz.stenka) ? tz.stenka : 'std') + '|pn=' + k(tz.pn) + '|' + (tz.sreda || '?') + '|t1=' + k(tz.t1) + '|t0=' + k(tz.t0) +
      '|tm=' + (ok(tz.t_mont) ? tz.t_mont : 10) + '|' + (tz.prokladka || '?') + '|L=' + (ok(tz.dlina) ? tz.dlina : 'max') + '|iz=' + (ok(tz.izolyaciya_kg_m) ? tz.izolyaciya_kg_m : 0) +
      '|H=' + k(tz.vysota_opory);
  }
  function tzSlovami() {
    var tz = tzOf(), t = truba(tz.dn_truby);
    return 'Dн ' + nf(tz.dn_truby) + (ok(tz.stenka) ? '×' + nf(tz.stenka) : '') + ' мм' + (t ? ' (Ду ' + t.du + ')' : '') + ', PN ' + nf(tz.pn, 1) + ' МПа, ' +
      (tz.sreda === 'par' ? 'пар' : 'вода') + ' ' + nf(tz.t1) + ' °С, наружный воздух ' + nf(tz.t0) + ' °С, прокладка ' + (PROKL[tz.prokladka] || '—') +
      ', длина ' + (ok(tz.dlina) ? nf(tz.dlina) + ' м' : 'не задана');
  }
  /* пробный подбор для подсказок: недостающее — типовые значения, длина и стенка — по умолчанию, если не сказано иное */
  function proba(over, svoyaStenka) {
    var tz = tzOf(), k;
    var tOk = ok(tz.t1) && ok(tz.t0) && tz.t1 > tz.t0;
    if (!tOk) { tz.t1 = ok(tz.t1) && tz.t1 > -30 ? tz.t1 : 150; tz.t0 = ok(tz.t0) && tz.t0 < tz.t1 ? tz.t0 : -30; }
    if (tz.pn !== 1.6 && tz.pn !== 2.5) { tz.pn = 1.6; }
    tz.sreda = 'voda';
    delete tz.t_mont; delete tz.dlina; delete tz.izolyaciya_kg_m;
    if (!svoyaStenka) { delete tz.stenka; }
    for (k in over) { if (Object.prototype.hasOwnProperty.call(over, k)) { tz[k] = over[k]; } }
    return podbor(tz);
  }
  function probaUsl() {
    var tz = tzOf(), tOk = ok(tz.t1) && ok(tz.t0) && tz.t1 > tz.t0;
    return 'вода, t1 = ' + nf(tOk ? tz.t1 : (ok(tz.t1) && tz.t1 > -30 ? tz.t1 : 150)) + ' °С, t0 = ' + nf(tOk ? tz.t0 : (ok(tz.t0) && tz.t0 < 150 ? tz.t0 : -30)) + ' °С';
  }

  /* ---------- адрес ---------- */
  function chitatAdres() {
    var q = {}, src = [location.hash.replace(/^#\??/, ''), location.search.replace(/^\?/, '')], i, j, p, kv;
    for (i = 0; i < src.length; i++) {
      p = src[i].split('&');
      for (j = 0; j < p.length; j++) {
        kv = p[j].split('=');
        if (kv[0] && kv.length > 1) { try { q[kv[0]] = decodeURIComponent(kv.slice(1).join('=').replace(/\+/g, ' ')); } catch (e) {} }
      }
    }
    return q;
  }
  function adres(polnyj) {
    var a = [];
    function add(k, v) { if (v !== '' && v !== null && v !== undefined) { a.push(k + '=' + encodeURIComponent(v)); } }
    add('dn', f.dn); add('s', f.s); add('l', f.lx ? 'max' : f.l);
    if (f.sr === 'par') { add('sr', 'par'); }
    add('pn', f.pn); add('t1', f.t1); add('t0', f.t0); add('pr', f.pr); add('tm', f.tm); add('iz', f.iz);
    if (f.h !== '100') { add('h', f.h); }
    if (!polnyj) { return a.join('&'); }
    if (ui.view === 'shag') { add('shag', ui.shag); } else if (ui.zakaz) { add('zakaz', ui.zakaz); }
    return a.join('&');
  }
  function zapisatAdres() {
    var q = adres(true), url = location.pathname + (q ? '?' + q : '');
    try { history.replaceState(null, '', url); } catch (e) { try { location.replace('#' + q); } catch (e2) {} }
  }
  function ssylka() { return location.href.split('#')[0].split('?')[0] + '?' + adres(false); }
  function chislo(v) { var n = P(v); return ok(n) ? String(n) : ''; }
  function polnoe() { return f.dn !== '' && f.pn !== '' && f.t1 !== '' && f.t0 !== '' && f.pr !== '' && (f.lx || f.l !== ''); }
  function izAdresa() {
    var q = chitatAdres(), t;
    if (q.dn !== undefined) { f.dn = chislo(q.dn); }
    if (q.s !== undefined) { f.s = chislo(q.s); ui.sSam = f.s !== ''; }
    if (q.l !== undefined) { if (q.l === 'max') { f.lx = true; } else { f.l = chislo(q.l); } }
    if (q.sr === 'par' || q.sr === 'voda') { f.sr = q.sr; }
    if (q.pn !== undefined) { t = P(q.pn); f.pn = t === 1.6 ? '1.6' : t === 2.5 ? '2.5' : ''; }
    if (q.t1 !== undefined) { f.t1 = chislo(q.t1); }
    if (q.t0 !== undefined) { f.t0 = chislo(q.t0); }
    if (q.tm !== undefined) { f.tm = chislo(q.tm); }
    if (q.iz !== undefined) { f.iz = chislo(q.iz); }
    if (q.pr === 'nadzemnaya' || q.pr === 'n') { f.pr = 'nadzemnaya'; }
    if (q.pr === 'kanalnaya' || q.pr === 'k') { f.pr = 'kanalnaya'; }
    if (q.h === '150' || q.h === '200' || q.h === '100') { f.h = q.h; }
    if (f.dn !== '' && !ui.sSam) { t = truba(P(f.dn)); if (t) { f.s = String(t.s); } }
    /* длина в адресе не указана, остальное задано — считаем, что покупатель её не знает */
    if (q.l === undefined && f.dn !== '' && f.pn !== '' && f.t1 !== '' && f.t0 !== '' && f.pr !== '') { f.lx = true; }
    if (q.zakaz === 'izdeliya' || q.zakaz === 'komplekt' || q.zakaz === 'vse') { ui.zakaz = q.zakaz; }
    t = parseInt(q.shag, 10);
    if (t >= 1 && t <= 4) { ui.view = 'shag'; ui.shag = t; ui.doshel = polnoe() ? 4 : t; } else if (polnoe()) { ui.view = 'rez'; ui.doshel = 4; }
    if (q.pb && q.dn === undefined) { poPB(q.pb); }
  }
  /* Dн по коду позиции каталога: сначала в данных конструктора, затем в общем списке позиций data/items.js */
  function poPB(pb) {
    var sp = [D.kompensatory, D.opory_nepodvizhnye, D.opory_skolzyashchie, D.otvody], i, j, o, dn = null, des = '';
    for (i = 0; i < sp.length && dn === null; i++) {
      for (j = 0; j < sp[i].length; j++) {
        o = sp[i][j];
        if (o.pb === pb) { dn = typeof o.d_nar === 'number' ? o.d_nar : o.d_nar[0]; des = o.des; break; }
      }
    }
    if (dn !== null) { return postavitDn(pb, des, dn); }
    function izSpiska() {
      var I = window.KATI || [], n;
      for (n = 0; n < I.length; n++) { if (I[n][2] === pb) { return postavitDn(pb, I[n][1], I[n][3], true); } }
      ui.pbNote = 'Позиция ' + pb + ' в каталоге не найдена — выберите диаметр трубы.';
      if (ui.view === 'shag' && ui.shag === 1) { risovat(); }
    }
    if (window.KATI) { return izSpiska(); }
    var sc = document.createElement('script');
    sc.src = 'data/items.js' + KQ; sc.onload = izSpiska; sc.onerror = izSpiska;
    document.head.appendChild(sc);
  }
  function postavitDn(pb, des, dn, pozzhe) {
    var t = truba(dn), i;
    des = ochistitTekst(des);
    if (!t && ok(dn)) { for (i = 0; i < D.truby.length; i++) { if (D.truby[i].du === dn) { t = D.truby[i]; } } }
    if (t) {
      f.dn = String(t.d_nar);
      if (!ui.sSam) { f.s = String(t.s); }
      ui.pbNote = 'Диаметр Dн ' + t.d_nar + ' мм подставлен по позиции каталога ' + pb + (des ? ' (' + des + ')' : '') + '.';
    } else {
      ui.pbNote = 'У позиции ' + pb + (des ? ' (' + des + ')' : '') + ' диаметр ' + (ok(dn) ? nf(dn) + ' мм ' : '') + 'не входит в ряд типового решения — выберите диаметр трубы.';
    }
    if (pozzhe && ui.view === 'shag') { risovat(); }
  }

  /* ---------- шаги ---------- */
  function znachenieShaga(n) {
    if (n === 1) { return f.dn ? 'Dн ' + f.dn + (f.s ? '×' + nf(P(f.s)) : '') : ''; }
    if (n === 2) { return f.lx ? 'длина — наибольшая' : f.l ? nf(P(f.l)) + ' м' : ''; }
    if (n === 3) { return (f.pn || f.t1) ? (f.sr === 'par' ? 'пар' : 'вода') + (f.t1 ? ' ' + nf(P(f.t1)) + ' °С' : '') + (f.pn ? ', PN ' + nf(P(f.pn), 1) : '') : ''; }
    return f.pr ? (f.pr === 'kanalnaya' ? 'канальная' : 'надземная') + (f.t0 ? ', ' + nf(P(f.t0)) + ' °С' : '') : '';
  }
  function polosa() {
    var h = '<ol class="k-steps">', i, n, cls, dis;
    for (i = 0; i < 4; i++) {
      n = i + 1;
      cls = (ui.view === 'shag' && ui.shag === n) ? 'cur' : (n <= ui.doshel && znachenieShaga(n)) ? 'done' : '';
      dis = n > ui.doshel && !(ui.view === 'shag' && n === ui.shag);
      h += '<li class="' + cls + '"><button type="button" data-shag="' + n + '"' + (dis ? ' disabled' : '') + (cls === 'cur' ? ' aria-current="step"' : '') +
        '><span class="n">' + n + '</span><span class="tv"><span class="t">' + SHAGI[i] + '</span><span class="v">' + esc(znachenieShaga(n) || ' ') + '</span></span></button></li>';
    }
    h += '<li class="' + (ui.view === 'rez' ? 'cur' : '') + '"><button type="button" data-shag="5"' + (polnoe() && ui.doshel >= 4 ? '' : ' disabled') + (ui.view === 'rez' ? ' aria-current="step"' : '') +
      '><span class="n">✓</span><span class="tv"><span class="t">Результат</span><span class="v">' + (RES && ui.view === 'rez' ? (RES.ok ? esc(RES.shifr) : 'подбор инженером') : ' ') + '</span></span></button></li>';
    return h + '</ol>';
  }
  function oshibka(id) { return ui.errs[id] ? '<p class="k-errmsg" id="e-' + id + '" role="alert">' + esc(ui.errs[id]) + '</p>' : ''; }
  function inAttr(id, hint) {
    return ' id="f-' + id + '" name="' + id + '" data-f="' + id + '" value="' + esc(f[id]) + '" autocomplete="off"' +
      (ui.errs[id] ? ' aria-invalid="true"' : '') + ' aria-describedby="' + (ui.errs[id] ? 'e-' + id + ' ' : '') + (hint ? 'h-' + hint : '') + '"';
  }
  function radio(name, val, html, cls) {
    return '<label class="k-chip' + (cls ? ' ' + cls : '') + '"><input type="radio" name="' + name + '" data-f="' + name + '" value="' + val + '"' + (f[name] === val ? ' checked' : '') + '><span>' + html + '</span></label>';
  }

  function oblast() {
    var h = '<div class="tbl-scroll"><table class="tbl k-area"><thead><tr><th class="l">Dн, мм</th><th>Ду</th><th>Стенка, мм</th><th>PN 1,6<small>надземная</small></th><th>PN 1,6<small>канальная</small></th><th>PN 2,5<small>надземная</small></th><th>PN 2,5<small>канальная</small></th></tr></thead><tbody>';
    var i, t, c, v, da = '<span class="k-yes">есть</span>', net = '<span class="k-nope">—</span>';
    var vars = [[1.6, 'nadzemnaya'], [1.6, 'kanalnaya'], [2.5, 'nadzemnaya'], [2.5, 'kanalnaya']];
    for (i = 0; i < D.truby.length; i++) {
      t = D.truby[i];
      h += '<tr><td class="l des">' + t.d_nar + '</td><td>' + t.du + '</td><td>' + nf(t.s) + '</td>';
      for (c = 0; c < 4; c++) { v = proba({ dn_truby: t.d_nar, pn: vars[c][0], prokladka: vars[c][1] }); h += '<td>' + (v.ok ? da : net) + '</td>'; }
      h += '</tr>';
    }
    return h + '</tbody></table></div><p class="note" style="margin:0 0 12px">Посчитано сейчас для условий: ' + probaUsl() + ', стенка трубы по умолчанию, высота опор ' + esc(f.h) +
      ' мм, один участок наибольшей длины. «—» — типового решения нет: неподвижной или скользящей опоры каталога для такого узла не хватает, нужен подбор инженером. Бо́льшая стенка трубы или другая высота опор могут изменить результат.</p>';
  }

  function shag1() {
    var h = '<h2 tabindex="-1">Шаг 1. Труба</h2><p class="k-sub">Наружный диаметр и толщина стенки трубы на участке.</p>', i, t, a, b, ps = podbor.podskazka(tzOf());
    if (ui.pbNote) { h += '<p class="k-info">' + esc(ui.pbNote) + '</p><div style="height:14px"></div>'; }
    h += '<fieldset class="k-f"><legend>Наружный диаметр трубы Dн <span class="unit">мм</span></legend><div class="k-chips" role="radiogroup" aria-label="Наружный диаметр трубы">';
    for (i = 0; i < D.truby.length; i++) {
      t = D.truby[i];
      a = proba({ dn_truby: t.d_nar, pn: 1.6, prokladka: 'nadzemnaya' }).ok; b = proba({ dn_truby: t.d_nar, pn: 1.6, prokladka: 'kanalnaya' }).ok;
      h += radio('dn', String(t.d_nar), '<b>' + t.d_nar + '</b><i>Ду ' + t.du + (a || b ? '' : '<u>по запросу</u>') + '</i>', a || b ? '' : 'off');
    }
    h += '</div>' + oshibka('dn') + '<p class="k-hint">Пунктиром отмечены диаметры, для которых типового решения сейчас нет: задание по ним уйдёт инженеру.</p></fieldset>';
    h += '<div class="k-f"><label for="f-s">Толщина стенки трубы <span class="unit">мм</span></label><input class="k-in" type="text" inputmode="decimal"' + inAttr('s', 's') + '>' + oshibka('s') +
      '<p class="k-hint" id="h-s" data-hint="s">' + hintS(ps) + '</p></div>';
    h += '<details class="k-more"><summary>Что закрывает конструктор</summary><div><p class="k-hint" style="margin:0 0 10px">Узел — прямой участок тепловой сети с осевым сильфонным компенсатором СКУ.М между неподвижными опорами. Теплоноситель — вода до 200 °С; надземная и подземная канальная прокладка. Для пара, бесканальной прокладки и диаметров вне таблицы — подбор инженером.</p>' + oblast() + '</div></details>';
    return h;
  }
  function hintS(ps) {
    if (!ps.dn_ok) { return 'Выберите диаметр — подставим стенку по умолчанию.'; }
    return 'По умолчанию — <b>' + nf(ps.stenka_po_umolchaniyu) + ' мм</b>, как у патрубков компенсатора.' +
      (ps.stenki_opor.length > 1 ? ' Неподвижные опоры каталога для этого диаметра есть под стенку от ' + ps.stenki_opor.map(function (x) { return nf(x); }).join(' и от ') + ' мм: более толстая стенка открывает опоры с большей несущей способностью.' : '');
  }
  function hintL() {
    var tz = tzOf(), tOk = ok(tz.t1) && ok(tz.t0) && tz.t1 > tz.t0 && (tz.pn === 1.6 || tz.pn === 2.5), ps, l, r;
    if (!ok(tz.dn_truby)) { return ''; }
    if (!tOk) { tz.t1 = 150; tz.t0 = -30; tz.pn = 1.6; }
    ps = podbor.podskazka(tz);
    if (ps.Lm === null) { return ''; }
    r = 'Наибольшая длина участка на один компенсатор для Dн ' + tz.dn_truby + ' — <b>' + nf(ps.Lm, 1) + ' м</b> ' +
      (tOk ? 'при ваших температурах.' : 'при воде 150 °С и наружном воздухе −30 °С; точное значение покажем после шагов 3 и 4.');
    l = f.lx ? null : P(f.l);
    if (f.lx) { r += ' Соберём один типовой участок наибольшей длины.'; }
    else if (ok(l) && l > ps.Lm) { r += ' Участок длиннее — он будет разделён на равные части, на каждую свой компенсатор.'; }
    else if (ok(l) && ps.L_min !== null && l <= ps.L_min) { r += ' Участок короче ' + nf(ps.L_min, 1) + ' м не вмещает расстановку опор у компенсатора — подбор инженером.'; }
    return r;
  }
  function shag2() {
    return '<h2 tabindex="-1">Шаг 2. Участок</h2><p class="k-sub">Длина прямого участка между концевыми неподвижными опорами. Длинный участок конструктор сам разделит на равные части с компенсатором на каждой.</p>' +
      '<div class="k-f"><label for="f-l">Длина участка <span class="unit">м</span></label><div class="k-row"><input class="k-in" type="text" inputmode="decimal"' + inAttr('l', 'l') + (f.lx ? ' disabled' : '') + '>' +
      '<label class="k-check"><input type="checkbox" id="f-lx" data-f="lx"' + (f.lx ? ' checked' : '') + '> Не знаю длину</label></div>' + oshibka('l') +
      '<p class="k-hint" id="h-l" data-hint="l">' + hintL() + '</p></div>';
  }
  function hintPn() {
    var tz = tzOf(), a, b;
    if (f.sr === 'par') { return '<p class="k-info no">Для паропровода типового решения нет: ход компенсатора и наработка определяются иначе. Заполните остальное — задание можно будет отправить инженеру.</p>'; }
    if (!ok(tz.dn_truby) || tz.pn !== 2.5) { return ''; }
    a = proba({ pn: 2.5, prokladka: 'nadzemnaya' }, true).ok; b = proba({ pn: 2.5, prokladka: 'kanalnaya' }, true).ok;
    if (a || b) { return ''; }
    return '<p class="k-info no">Для Dн ' + tz.dn_truby + (ok(tz.stenka) ? '×' + nf(tz.stenka) : '') + ' мм при PN 2,5 МПа типового решения сейчас нет ни для надземной, ни для канальной прокладки (' + probaUsl() +
      '). Причину покажем в результате, задание можно будет отправить инженеру.</p>';
  }
  function shag3() {
    return '<h2 tabindex="-1">Шаг 3. Среда</h2><p class="k-sub">Теплоноситель, номинальное давление и наибольшая температура.</p>' +
      '<fieldset class="k-f"><legend>Теплоноситель</legend><div class="k-chips wide" role="radiogroup" aria-label="Теплоноситель">' +
      radio('sr', 'voda', '<b>Вода</b><i>до 200 °С</i>') + radio('sr', 'par', '<b>Пар</b><i>подбор инженером</i>', 'off') + '</div></fieldset>' +
      '<fieldset class="k-f"><legend>Номинальное давление PN <span class="unit">МПа</span></legend><div class="k-chips wide" role="radiogroup" aria-label="Номинальное давление">' +
      radio('pn', '1.6', '<b>1,6</b><i>16 кгс/см²</i>') + radio('pn', '2.5', '<b>2,5</b><i>25 кгс/см²</i>') + '</div>' + oshibka('pn') + '<div data-hint="pn">' + hintPn() + '</div></fieldset>' +
      '<div class="k-f"><label for="f-t1">Наибольшая температура теплоносителя <span class="unit">°С</span></label><div class="k-row"><input class="k-in" type="text" inputmode="decimal"' + inAttr('t1', 't1') + '>' +
      '<span class="k-quick" aria-label="Частые значения"><button type="button" data-set="t1" data-val="95">95</button><button type="button" data-set="t1" data-val="115">115</button><button type="button" data-set="t1" data-val="130">130</button><button type="button" data-set="t1" data-val="150">150</button></span></div>' +
      oshibka('t1') + '<p class="k-hint" id="h-t1">Для воды — не выше 200 °С.</p></div>';
  }
  function hintItog() {
    var tz = tzOf(), r, ps, h = '';
    if (!ok(tz.dn_truby) || !ok(tz.pn) || !ok(tz.t1) || !ok(tz.t0) || !tz.prokladka || tz.t1 <= tz.t0) { return ''; }
    ps = podbor.podskazka(tz); r = podbor(tz);
    if (ps.Lm !== null) { h += 'Наибольшая длина участка на один компенсатор для ваших условий — <b>' + nf(ps.Lm, 1) + ' м</b>. '; }
    if (r.ok) {
      h += f.lx ? 'Соберём один участок этой длины.' : (r.uchastkov > 1 ? 'Ваши ' + nf(tz.dlina) + ' м будут разделены на ' + r.uchastkov + ' ' + mn(r.uchastkov, 'участок', 'участка', 'участков') + ' по ' + nf(r.dlina_uchastka, 1) + ' м.' : 'Ваш участок закрывается одним компенсатором.');
      return '<p class="k-info ok">' + h + ' Типовое решение подбирается.</p>';
    }
    return '<p class="k-info no">' + h + 'Для этих условий типового решения нет — на следующем экране покажем причину, задание можно будет отправить инженеру.</p>';
  }
  function shag4() {
    return '<h2 tabindex="-1">Шаг 4. Условия</h2><p class="k-sub">Способ прокладки и расчётная температура наружного воздуха — температура наиболее холодной пятидневки для вашего города.</p>' +
      '<fieldset class="k-f"><legend>Способ прокладки</legend><div class="k-chips wide" role="radiogroup" aria-label="Способ прокладки">' +
      radio('pr', 'nadzemnaya', '<b>Надземная</b><i>на эстакадах и отдельных опорах</i>') + radio('pr', 'kanalnaya', '<b>Подземная канальная</b><i>в канале, камере, тоннеле</i>') + '</div>' + oshibka('pr') +
      '<p class="k-hint">Для бесканальной прокладки применяются другие компенсационные устройства — подбор инженером.</p></fieldset>' +
      '<div class="k-f"><label for="f-t0">Расчётная температура наружного воздуха <span class="unit">°С</span></label><div class="k-row"><input class="k-in" type="text" inputmode="text"' + inAttr('t0', 't0') + '>' +
      '<span class="k-quick" aria-label="Частые значения"><button type="button" data-set="t0" data-val="-25">−25</button><button type="button" data-set="t0" data-val="-30">−30</button><button type="button" data-set="t0" data-val="-35">−35</button><button type="button" data-set="t0" data-val="-40">−40</button></span></div>' +
      oshibka('t0') + '<p class="k-hint" id="h-t0">Выше −60 °С. Например, −25 для Москвы.</p></div>' +
      '<details class="k-more"' + (f.tm !== '' || f.iz !== '' || f.h !== '100' || ui.errs.tm || ui.errs.iz ? ' open' : '') + '><summary>Дополнительно: температура монтажа, изоляция, высота опор</summary><div>' +
      '<div class="k-f"><label for="f-tm">Температура воздуха при монтаже <span class="unit">°С</span></label><input class="k-in" type="text" inputmode="text" placeholder="10"' + inAttr('tm', 'tm') + '>' + oshibka('tm') +
      '<p class="k-hint" id="h-tm">Если не задать — принимается 10 °С.</p></div>' +
      '<div class="k-f"><label for="f-iz">Вес тепловой изоляции на метр трубы <span class="unit">кг/м</span></label><input class="k-in" type="text" inputmode="decimal" placeholder="0"' + inAttr('iz', 'iz') + '>' + oshibka('iz') +
      '<p class="k-hint" id="h-iz">Если не задать — сила трения считается для трубы с водой без изоляции; в результате будет показано, какой вес изоляции допускает опора.</p></div>' +
      '<div class="k-f"><label for="f-h">Высота опор — от опорной поверхности до низа трубы <span class="unit">мм</span></label><select class="k-in" id="f-h" name="h" data-f="h">' +
      ['100', '150', '200'].map(function (v) { return '<option value="' + v + '"' + (f.h === v ? ' selected' : '') + '>' + v + (v === '100' ? ' — по умолчанию' : '') + '</option>'; }).join('') +
      '</select><p class="k-hint">Выбирают по толщине изоляции.</p></div></div></details>' +
      '<div data-hint="itog">' + hintItog() + '</div>';
  }

  function proverit(n) {
    var e = {}, tz = tzOf(), v, ps;
    if (n === 1) {
      if (!truba(tz.dn_truby)) { e.dn = 'Выберите наружный диаметр трубы.'; }
      v = P(f.s);
      if (v !== null && (!ok(v) || v <= 0)) { e.s = 'Толщина стенки — число больше нуля, например 6.'; }
      else if (v !== null && ok(tz.dn_truby) && v * 2 >= tz.dn_truby) { e.s = 'Стенка должна быть меньше половины наружного диаметра.'; }
    }
    if (n === 2 && !f.lx) {
      v = P(f.l); ps = podbor.podskazka(tz);
      if (v === null) { e.l = 'Укажите длину участка в метрах или отметьте «Не знаю длину».'; }
      else if (!ok(v) || v <= 0) { e.l = 'Длина — число больше нуля, например 60.'; }
      else if (v > ps.dlina_max) { e.l = 'Длина — не больше ' + nf(ps.dlina_max) + ' м. Более длинную трассу разбейте на участки или отправьте задание инженеру.'; }
    }
    if (n === 3) {
      if (f.pn !== '1.6' && f.pn !== '2.5') { e.pn = 'Выберите номинальное давление.'; }
      v = P(f.t1);
      if (v === null) { e.t1 = 'Укажите наибольшую температуру теплоносителя.'; }
      else if (!ok(v)) { e.t1 = 'Температура — число, например 150.'; }
    }
    if (n === 4) {
      if (!f.pr) { e.pr = 'Выберите способ прокладки.'; }
      v = P(f.t0);
      if (v === null) { e.t0 = 'Укажите расчётную температуру наружного воздуха.'; }
      else if (!ok(v)) { e.t0 = 'Температура — число, например −30.'; }
      else if (ok(tz.t1) && v >= tz.t1) { e.t0 = 'Температура наружного воздуха должна быть ниже температуры теплоносителя (' + nf(tz.t1) + ' °С).'; }
      v = P(f.tm);
      if (v !== null && !ok(v)) { e.tm = 'Температура монтажа — число, например 10.'; }
      v = P(f.iz);
      if (v !== null && (!ok(v) || v < 0)) { e.iz = 'Вес изоляции — число не меньше нуля.'; }
    }
    ui.errs = e;
    for (v in e) { if (Object.prototype.hasOwnProperty.call(e, v)) { return false; } }
    return true;
  }

  function risovatShag() {
    var telo = ui.shag === 1 ? shag1() : ui.shag === 2 ? shag2() : ui.shag === 3 ? shag3() : shag4();
    app.innerHTML = polosa() + '<form class="panel k-form" novalidate data-form="shag">' + telo + '<div class="k-nav">' +
      (ui.shag > 1 ? '<button type="button" class="btn ghost" data-act="nazad">Назад</button>' : '') +
      '<button type="submit" class="btn">' + (ui.shag < 4 ? 'Далее' : 'Подобрать узел') + '</button></div></form>';
  }

  /* ---------- результат ---------- */
  function shema(res) {
    var pk = 1, pn = res.opory_nepodvizhnye.koncevye.poz, ps = res.opory_skolzyashchie.poz, c = '#1E2328', a = '#F26A21', g = '#9AA0A6', i, x, h;
    function bad(x, n, col) { return '<line x1="' + x + '" y1="34" x2="' + x + '" y2="52" stroke="' + (col || c) + '" stroke-width="1.2"/><circle cx="' + x + '" cy="22" r="13" fill="#fff" stroke="' + (col || c) + '" stroke-width="1.6"/><text x="' + x + '" y="27.5" text-anchor="middle" font-size="16" font-weight="700" fill="' + (col || c) + '">' + n + '</text>'; }
    function no(x) { return '<path d="M' + (x - 9) + ' 47L' + (x + 9) + ' 73M' + (x - 9) + ' 73L' + (x + 9) + ' 47" stroke="' + c + '" stroke-width="3.2"/><path d="M' + (x - 16) + ' 92H' + (x + 16) + 'M' + x + ' 68V92" stroke="' + c + '" stroke-width="2.4"/>'; }
    function so(x, col) { return '<path d="M' + (x - 10) + ' 82H' + (x + 10) + 'L' + x + ' 67Z" fill="#fff" stroke="' + col + '" stroke-width="2"/><path d="M' + (x - 15) + ' 92H' + (x + 15) + '" stroke="' + col + '" stroke-width="2.4"/><circle cx="' + (x - 5) + '" cy="87" r="2.6" fill="' + col + '"/><circle cx="' + (x + 5) + '" cy="87" r="2.6" fill="' + col + '"/>'; }
    h = '<svg viewBox="0 0 640 104" role="img" aria-label="Принципиальная схема участка: неподвижные опоры по концам, компенсатор и две скользящие опоры рядом с ним" font-family="Segoe UI,Arial,sans-serif">';
    h += '<rect x="24" y="54" width="592" height="12" fill="#E9E6E0" stroke="' + c + '" stroke-width="1.4"/>';
    h += '<rect x="372" y="52" width="150" height="16" fill="#fff"/><path d="M372 54H522M372 66H522" stroke="' + c + '" stroke-width="1.4" stroke-dasharray="7 6"/>';
    h += '<rect x="118" y="44" width="66" height="32" rx="5" fill="' + a + '"/>';
    for (i = 0; i < 6; i++) { x = 128 + i * 9.2; h += '<line x1="' + x + '" y1="46" x2="' + x + '" y2="74" stroke="#fff" stroke-width="2.2"/>'; }
    h += no(48) + no(592) + so(240, c) + so(330, c) + so(410, g) + so(480, g);
    h += bad(48, pn) + bad(592, pn) + bad(151, pk, a) + bad(240, ps) + bad(330, ps);
    return h + '</svg>';
  }
  function fakty(res) {
    var p = res.parametry, pr = p.prinyato, h = '';
    function st(k) { return pr.indexOf(k) >= 0 ? ' <span class="unit" style="color:#6A7178">— принято по умолчанию</span>' : ''; }
    h += '<dt>Труба</dt><dd>Dн ' + nf(p.dn_truby) + '×' + nf(p.stenka, 1) + ' мм, Ду ' + p.du + st('stenka') + '</dd>';
    h += '<dt>Длина участка</dt><dd>' + nf(p.dlina, 2) + ' м' + (res.dlina_prinyata_Lm ? ' <span style="color:#6A7178">— не задана, принята наибольшая для одного компенсатора</span>' : '') + '</dd>';
    h += '<dt>Теплоноситель</dt><dd>' + (p.sreda === 'par' ? 'пар' : 'вода') + ', до ' + nf(p.t1) + ' °С</dd>';
    h += '<dt>Давление</dt><dd>PN ' + nf(p.pn, 1) + ' МПа</dd>';
    h += '<dt>Прокладка</dt><dd>' + PROKL[p.prokladka] + '</dd>';
    h += '<dt>Наружный воздух</dt><dd>' + nf(p.t0) + ' °С</dd>';
    h += '<dt>Температура монтажа</dt><dd>' + nf(p.t_mont) + ' °С' + st('t_mont') + '</dd>';
    h += '<dt>Вес изоляции</dt><dd>' + (pr.indexOf('izolyaciya_kg_m') >= 0 ? 'не задан' : nf(p.izolyaciya_kg_m) + ' кг/м') + '</dd>';
    h += '<dt>Высота опор</dt><dd>' + nf(p.vysota_opory) + ' мм</dd>';
    return '<dl class="facts">' + h + '</dl>';
  }
  function pngRoli(res, rol) {
    if (rol === 'kompensator') { return res.kompensator.png; }
    if (rol === 'no_koncevaya') { return res.opory_nepodvizhnye.koncevye.png; }
    if (rol === 'no_promezhutochnaya') { return res.opory_nepodvizhnye.promezhutochnye ? res.opory_nepodvizhnye.promezhutochnye.png : null; }
    if (rol === 'skolzyashchaya') { return res.opory_skolzyashchie.png; }
    if (rol === 'otvod') { return res.otvod ? res.otvod.png : null; }
    return null;
  }
  function kolTxt(s) { return s.kol === null ? 'по проекту' : s.kol + ' ' + s.ed; }

  function rezOk(res) {
    var p = res.parametry, n = res.uchastkov, nk = res.opory_nepodvizhnye.koncevye, npz = res.opory_nepodvizhnye.promezhutochnye, i, s, png, h = '';
    var nNo = 2 + (n - 1);
    h += '<div class="k-reshead"><div><div class="kicker" style="color:#B8480C">' + esc(res.shifr) + ' · типовое решение узла</div><h2 tabindex="-1">Узел подобран</h2>' +
      '<p class="lead">Прямой участок Dн ' + nf(p.dn_truby) + '×' + nf(p.stenka, 1) + ' мм длиной ' + nf(p.dlina, 1) + ' м, прокладка ' + PROKL[p.prokladka] + ', вода до ' + nf(p.t1) + ' °С, PN ' + nf(p.pn, 1) + ' МПа.</p></div>' +
      '<div class="k-acts"><button type="button" class="btn ghost small" data-act="izmenit">Изменить данные</button><button type="button" class="btn ghost small" data-act="ssylka">Скопировать ссылку</button><a class="btn small" href="#zakaz" data-act="kzakazu">Заказать</a></div></div>';
    h += '<div class="k-tiles"><div class="k-tile acc"><b>' + esc(res.shifr) + '</b><span>шифр типового решения</span></div>' +
      '<div class="k-tile"><b>' + n + '</b><span>' + mn(n, 'участок', 'участка', 'участков') + (n > 1 ? ' по ' + nf(res.dlina_uchastka, 1) + ' м' : '') + '</span></div>' +
      '<div class="k-tile"><b>' + res.kompensator.kol + '</b><span>' + mn(res.kompensator.kol, 'компенсатор', 'компенсатора', 'компенсаторов') + '</span></div>' +
      '<div class="k-tile"><b>' + nNo + '</b><span>' + mn(nNo, 'неподвижная опора', 'неподвижные опоры', 'неподвижных опор') + '</span></div>' +
      '<div class="k-tile"><b>' + res.opory_skolzyashchie.kol + '</b><span>' + mn(res.opory_skolzyashchie.kol, 'скользящая опора', 'скользящие опоры', 'скользящих опор') + ' у компенсаторов</span></div>' +
      '<div class="k-tile"><b>' + nf(res.massa_itogo, 1) + '</b><span>кг — масса изделий</span></div></div>';
    h += '<p class="k-ogov"><b>Важно.</b> ' + esc(res.ogovorka) + '</p>';

    h += '<h3>Состав узла</h3><div class="panel k-scheme"><div class="sv">' + shema(res) + '</div><p>Принципиальная схема одного участка, без масштаба и размеров. Цифры — позиции спецификации; серым показаны скользящие опоры в пролёте — их шаг и число определяет проект привязки.' +
      (n > 1 ? ' Участков — ' + n + ', между ними стоят промежуточные неподвижные опоры' + (npz ? ' (поз. ' + npz.poz + ')' : '') + '.' : '') + '</p></div><div class="k-cards">';
    for (i = 0; i < res.spec.length; i++) {
      s = res.spec[i]; png = pngRoli(res, s.rol);
      h += '<a class="k-card" href="' + kartochka(s.slug, s.pb) + '"><span class="im">' + (png ? '<img src="' + esc(mini(png)) + '" data-full="' + esc(img(png)) + '" alt="' + esc(s.oboznachenie) + '" loading="lazy">' : '') +
        '<span class="pz">' + s.poz + '</span><span class="q">' + (s.kol === null ? 'по проекту' : '× ' + s.kol) + '</span></span><span class="tx"><span class="r">' + esc(ROLI[s.rol] || s.razdel) + (s.rol === 'no_koncevaya' ? ' · ' + esc(s.primechanie) : s.rol === 'no_promezhutochnaya' ? ' · промежуточные' : '') + '</span>' +
        '<span class="d">' + esc(s.oboznachenie) + '</span><span class="p">' + esc(s.pb) + '</span><span class="m">' + nf(s.massa, 2) + ' кг за штуку</span><span class="go">Карточка в каталоге</span></span></a>';
    }
    h += '</div>';

    h += '<h3>Спецификация</h3><div class="tbl-scroll" tabindex="0" role="region" aria-label="Спецификация узла"><table class="tbl"><thead><tr><th>Поз.</th><th class="l">Обозначение</th><th class="l">Наименование</th><th class="l">Код каталога</th><th>Кол.</th><th>Масса ед., кг</th><th>Масса, кг</th><th class="l">Примечание</th></tr></thead><tbody>';
    for (i = 0; i < res.spec.length; i++) {
      s = res.spec[i];
      h += '<tr><td>' + s.poz + '</td><td class="l des"><a href="' + kartochka(s.slug, s.pb) + '">' + esc(s.oboznachenie) + '</a></td><td class="l nm">' + esc(s.naimenovanie) + '</td><td class="l pb">' + esc(s.pb) + '</td><td>' +
        (s.kol === null ? '—' : s.kol + ' ' + s.ed) + '</td><td>' + nf(s.massa, 2) + '</td><td>' + (s.kol === null ? '—' : nf(s.kol * s.massa, 2)) + '</td><td class="l nm">' + esc(s.primechanie) + '</td></tr>';
    }
    h += '</tbody><tfoot><tr><td></td><td class="l" colspan="5">Масса изделий с известным количеством</td><td>' + nf(res.massa_itogo, 2) + '</td><td></td></tr></tfoot></table></div>';
    h += '<p class="note">Почему такая неподвижная опора: расчётная осевая нагрузка на концевую опору ' + esc(nk.oboznachenie) + ' — ' + nf(nk.nagruzka, 1) + ' кН при несущей способности ' + nf(nk.q) + ' кН, запас ' + nf(nk.zapas, 1) + ' кН; расчёт — по методике производителя компенсаторов. ' +
      'Наибольшая длина участка на один компенсатор при заданных температурах — ' + nf(res.Lm, 1) + ' м.</p>';
    h += '<p class="k-paid"><b>В комплекте документации:</b> схема узла с размерами расстановки опор, листы изделий, спецификация по ГОСТ 21.110-2013, расчётная записка с нагрузками на опоры и монтажной растяжкой компенсатора, 3D-модели STEP.</p>';

    h += '<div class="cols" style="margin-top:8px"><div><h3>Исходные данные</h3><div class="panel">' + fakty(res) + '</div></div><div><h3>Обратите внимание</h3>';
    if (res.preduprezhdeniya.length) {
      h += '<ul class="k-list">';
      for (i = 0; i < res.preduprezhdeniya.length; i++) { h += '<li>' + esc(res.preduprezhdeniya[i].tekst) + '</li>'; }
      h += '</ul>';
    } else { h += '<p>Замечаний к подбору нет.</p>'; }
    h += '</div></div>';
    h += '<h3>Что остаётся проектировщику</h3><ol class="k-list small">';
    for (i = 0; i < res.ostaetsya_proektirovshchiku.length; i++) { h += '<li>' + esc(res.ostaetsya_proektirovshchiku[i]) + '</li>'; }
    h += '</ol>';

    h += '<h2 id="zakaz" tabindex="-1">Что дальше</h2><div class="k-fork">' +
      knFork('izdeliya', 'Заказать изделия', 'Позиции узла — в заявку каталога') + knFork('komplekt', 'Заказать комплект документации', 'От ' + rub(VARIANTY[0].cena) + ', альбом по вашему заданию') +
      knFork('vse', 'И то, и другое', 'Изделия и комплект одним обращением') + '</div><div class="k-order" id="k-order">' + zakaz(res) + '</div>';
    return h;
  }
  function knFork(id, t, s) { return '<button type="button" data-zakaz="' + id + '" aria-pressed="' + (ui.zakaz === id ? 'true' : 'false') + '"><b>' + t + '</b><span>' + s + '</span></button>'; }

  /* ---------- отказ ---------- */
  function alternativy(tz, res) {
    var out = [], kd = kody(res), i, r, t, ps, hs, drugaya;
    if (tz.sreda !== 'voda' || kd.indexOf('E_DN') >= 0 || kd.indexOf('E_T1') >= 0 || kd.indexOf('E_T0') >= 0) { return out; }
    function prob(over) { var z = kopiya(tz), k; for (k in over) { if (Object.prototype.hasOwnProperty.call(over, k)) { z[k] = over[k]; } } return podbor(z); }
    drugaya = tz.prokladka === 'nadzemnaya' ? 'kanalnaya' : 'nadzemnaya';
    r = prob({ prokladka: drugaya });
    if (r.ok) {
      out.push({ t: drugaya === 'kanalnaya' ? 'Если участок можно проложить в канале: при подземной канальной прокладке узел подбирается — неподвижная опора ' + r.opory_nepodvizhnye.koncevye.oboznachenie + '.'
        : 'При надземной прокладке узел подбирается — неподвижная опора ' + r.opory_nepodvizhnye.koncevye.oboznachenie + '.', set: { pr: drugaya } });
    }
    ps = podbor.podskazka(tz);
    t = ok(tz.stenka) ? tz.stenka : ps.stenka_po_umolchaniyu;
    for (i = 0; i < ps.stenki_opor.length; i++) {
      if (ps.stenki_opor[i] > t) {
        r = prob({ stenka: ps.stenki_opor[i] });
        if (r.ok) { out.push({ t: 'Если труба со стенкой ' + nf(ps.stenki_opor[i]) + ' мм: узел подбирается — неподвижная опора ' + r.opory_nepodvizhnye.koncevye.oboznachenie + '.', set: { s: String(ps.stenki_opor[i]) } }); break; }
      }
    }
    hs = ps.vysoty_opor;
    for (i = 0; i < hs.length; i++) {
      if (hs[i] !== tz.vysota_opory) {
        r = prob({ vysota_opory: hs[i] });
        if (r.ok) { out.push({ t: 'При высоте опор ' + hs[i] + ' мм узел подбирается.', set: { h: String(hs[i]) } }); break; }
      }
    }
    if (tz.pn === 2.5) {
      r = prob({ pn: 1.6 });
      if (r.ok) { out.push({ t: 'Если давление в трубопроводе позволяет принять PN 1,6 МПа: узел подбирается.', set: { pn: '1.6' } }); }
    }
    return out;
  }
  function pismoInzheneru(res) {
    var str = ['Типовое решение в конструкторе не подобрано, прошу подобрать узел.', 'ТЗ: ' + tzStroka(res), tzSlovami() + '.', 'Причины: ' + kody(res).join(', '), '', 'Организация:', 'Контакт:'];
    return mailto('ТЗ на подбор узла инженером', [{ t: str[0] }, { t: str[1] }, { t: str[2], p: 1 }, { t: str[3] }, { t: '' }, { t: str[5] }, { t: str[6] }]);
  }
  function rezOtkaz(res) {
    var tz = tzOf(), alt = alternativy(tz, res), p = res.parametry, k = res.kompensator, ng = res.nagruzki, i, h, m = pismoInzheneru(res);
    ui.alt = alt;
    h = '<div class="panel k-otkaz" style="margin-top:8px"><div class="kicker" style="color:#B3261E">подбор инженером</div><h2 tabindex="-1">Типового решения для этих условий нет</h2><ul class="k-list">';
    for (i = 0; i < res.prichiny_otkaza.length; i++) { h += '<li>' + esc(res.prichiny_otkaza[i].tekst) + '</li>'; }
    h += '</ul><p class="k-hint" style="margin-top:10px">Ваше задание: ' + esc(tzSlovami()) + '.</p>' +
      '<div class="k-nav"><a class="btn" href="' + esc(m.href) + '" id="k-inzh">Отправить ТЗ инженеру</a><button type="button" class="btn ghost" data-kopir="inzh">Скопировать ТЗ</button><button type="button" class="btn ghost" data-act="izmenit">Изменить данные</button></div>' +
      '<p class="k-hint">Кнопка откроет письмо на ' + EMAIL + ' с вашим заданием — допишите организацию и контакт. Инженер подберёт узел и ответит.</p></div>';
    if (alt.length) {
      h += '<h3>Что можно изменить</h3><ul class="k-alt">';
      for (i = 0; i < alt.length; i++) { h += '<li><span>' + esc(alt[i].t) + '</span><button type="button" class="btn ghost small" data-alt="' + i + '">Пересчитать</button></li>'; }
      h += '</ul>';
    }
    if (p && k) {
      h += '<h3>Что посчитано</h3><div class="panel"><dl class="facts"><dt>Труба</dt><dd>Dн ' + nf(p.dn_truby) + '×' + nf(p.stenka, 1) + ' мм, Ду ' + p.du + '</dd>' +
        '<dt>Компенсатор</dt><dd><a href="' + kartochka(k.slug, k.pb) + '">' + esc(k.oboznachenie) + '</a>, ход ' + nf(k.hod) + ' мм, код ' + esc(k.pb) + ' — ' + k.kol + ' шт.</dd>' +
        '<dt>Наибольшая длина участка на один компенсатор</dt><dd>' + nf(res.Lm, 1) + ' м</dd>' +
        '<dt>Участков</dt><dd>' + res.uchastkov + (res.uchastkov > 1 ? ' по ' + nf(res.dlina_uchastka, 1) + ' м' : ', длина ' + nf(res.dlina_uchastka, 1) + ' м') + '</dd>' +
        (ng ? '<dt>Тепловое удлинение участка</dt><dd>' + nf(ng.dl_uch, 0) + ' мм</dd><dt>Осевая нагрузка на концевую неподвижную опору</dt><dd>' + nf(ng.Pkno_proverka, 1) + ' кН</dd>' : '') +
        '</dl></div>' + (kody(res).indexOf('E_KOROTKIJ') < 0 ? '<p class="note">Компенсатор под эти условия в каталоге есть — не подобраны опоры: их подбирает инженер по запросу.</p>' : '');
    }
    h += '<p class="k-ogov"><b>Важно.</b> ' + esc(podbor.ogovorka) + '</p>';
    ui.inzh = m;
    return h;
  }

  /* ---------- письма ---------- */
  /* строки: {t — текст; p — очередь сокращения, если ссылка длиннее MAILTO_MAX: строка заменяется на kor или убирается; rezat — с какого знака можно обрезать}.
     Кириллица в ссылке занимает по 6 знаков на букву, поэтому ТЗ идёт латиницей (строка shifr_kanon), а текст короткий. Полный текст всегда показан рядом. */
  function mailto(tema, stroki) {
    function sobrat(ss) { return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(tema) + '&body=' + encodeURIComponent(ss.join('\n')); }
    function teksty() { return stroki.map(function (s) { return s.t; }); }
    var polnyj = teksty().join('\n'), href = sobrat(teksty()), sokr = false, i, s, lim, och = [];
    for (i = 0; i < stroki.length; i++) { if (stroki[i].p) { och.push(stroki[i]); } }
    och.sort(function (a, b) { return a.p - b.p; });
    for (i = 0; i < och.length && href.length > MAILTO_MAX; i++) {
      s = och[i]; sokr = true;
      if (s.kor !== undefined) { s.t = s.kor; } else { stroki.splice(stroki.indexOf(s), 1); }
      href = sobrat(teksty());
    }
    lim = 60;
    while (href.length > MAILTO_MAX && lim >= 10) {
      for (i = 0; i < stroki.length; i++) { s = stroki[i]; if (s.rezat && s.t.length > s.rezat + lim) { s.t = s.t.substring(0, s.rezat + lim) + '…'; sokr = true; } }
      href = sobrat(teksty()); lim -= 10;
    }
    return { href: href, len: href.length, tema: tema, tekst: polnyj, sokrashcheno: sokr };
  }
  function poziciiStrokoj(res, kratko) {
    var a = [], i, s;
    for (i = 0; i < res.spec.length; i++) {
      s = res.spec[i];
      if (s.kol !== null) { a.push(kratko ? s.pb + ' x' + s.kol :s.oboznachenie + ' (' + s.pb + ') — ' + s.kol + ' ' + s.ed); }
    }
    return a.join('; ');
  }
  function pismoZakaz(res) {
    var z = ui.zf, v = z.v === 'eks' ? VARIANTY[1] : VARIANTY[0], izd = ui.zakaz === 'vse';
    var s = [
      { t: 'Прошу выставить счёт на комплект документации.', p: 1 },
      { t: 'Шифр: ' + res.shifr },
      { t: 'Вариант: ' + v.kratko + ', ' + v.cena + ' руб. с НДС' },
      { t: 'ТЗ: ' + tzStroka(res) },
      { t: 'Организация: ' + z.org, rezat: 13 },
      { t: 'ИНН: ' + z.inn },
      { t: 'Контакт: ' + z.kont, rezat: 9 },
      { t: 'Почта для комплекта: ' + z.mail, kor: 'Почта: ' + z.mail, p: 2 }
    ];
    if (izd) { s.push({ t: 'Изделия, цена и срок: ' + poziciiStrokoj(res, true), kor: 'И цену изделий узла.', p: 3 }); }
    return mailto('Заказ комплекта ' + res.shifr, s);
  }

  /* ---------- заказ ---------- */
  function specChitat() { var s = {}; try { s = JSON.parse(localStorage.getItem(SPEC_KEY) || '{}') || {}; } catch (e) { s = {}; } return (s && typeof s === 'object') ? s : {}; }
  function schetchik() {
    var el = document.getElementById('k-count'), n = 0, s = specChitat(), k;
    for (k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) { n++; } }
    if (el) { el.textContent = n; el.hidden = !n; }
  }
  /* запись позиции — как в kat.js: { qty, slug, des, name, std, dn, mass, price, art }, ключ — код ПБ; данные берём из карточки категории */
  function vZayavku(res, gotovo) {
    var poz = [], i, zhdem;
    for (i = 0; i < res.spec.length; i++) { if (res.spec[i].kol !== null) { poz.push(res.spec[i]); } }
    zhdem = poz.length;
    function zapisat() {
      var spec = specChitat(), j, s, cat, it, n, kt, zap = true;
      for (j = 0; j < poz.length; j++) {
        s = poz[j]; cat = (window.KATC || {})[s.slug]; it = null;
        if (cat && cat.items) { for (n = 0; n < cat.items.length; n++) { if (cat.items[n].pb === s.pb) { it = cat.items[n]; } } }
        if (spec[s.pb] && typeof spec[s.pb].qty === 'number') { spec[s.pb].qty += s.kol; continue; }
        if (it) {
          spec[s.pb] = { qty: s.kol, slug: cat.slug, des: it.des, name: (cat.nm || it.nm || cat.title) + ' ' + it.des, std: cat.std, dn: it.dn,
            mass: it.v && typeof it.v.mass === 'number' ? it.v.mass : null, price: it.v && typeof it.v.price === 'number' ? it.v.price : null, art: it.sh ? it.sh[2] : null };
        } else {
          kt = (D.kategorii || {})[s.slug] || {};
          spec[s.pb] = { qty: s.kol, slug: s.slug, des: s.oboznachenie, name: bezPovtora(String(kt.title || s.naimenovanie).replace(/\s*\([^()]*\)$/, ''), s.oboznachenie) + ' ' + s.oboznachenie, std: kt.std || '', dn: res.parametry.dn_truby, mass: s.massa, price: null, art: null };
        }
      }
      try { localStorage.setItem(SPEC_KEY, JSON.stringify(spec)); } catch (e) { zap = false; }
      schetchik();
      gotovo(zap, poz, spec);
    }
    function odin() { zhdem--; if (zhdem === 0) { zapisat(); } }
    if (!zhdem) { return zapisat(); }
    poz.forEach(function (s) {
      if ((window.KATC || {})[s.slug]) { return odin(); }
      var sc = document.createElement('script');
      sc.src = 'data/c/' + s.slug + '.js' + KQ; sc.onload = odin; sc.onerror = odin;
      document.head.appendChild(sc);
    });
  }
  /* «Компенсатор сильфонный СКУ.М» + «СКУ.М-16-200-160»: тип в названии не повторяем */
  function bezPovtora(nazv, des) {
    var sl = nazv.split(' '), posl = sl[sl.length - 1];
    if (sl.length > 1 && posl && des.indexOf(posl) === 0) { sl.pop(); return sl.join(' '); }
    return nazv;
  }
  function zerr(id) { return ui.zerrs[id] ? '<p class="k-errmsg" id="ze-' + id + '" role="alert">' + esc(ui.zerrs[id]) + '</p>' : ''; }
  function zin(id, label, type, extra, hint) {
    return '<div class="k-f"><label for="z-' + id + '">' + label + '</label><input class="k-in" type="' + type + '" id="z-' + id + '" name="' + id + '" data-z="' + id + '" value="' + esc(ui.zf[id]) + '"' + (extra || '') +
      (ui.zerrs[id] ? ' aria-invalid="true" aria-describedby="ze-' + id + '"' : '') + '>' + zerr(id) + (hint ? '<p class="k-hint">' + hint + '</p>' : '') + '</div>';
  }
  function blokIzdeliya(res) {
    var h = '<div class="panel"><h3>Изделия узла — в заявку каталога</h3><ul class="k-pos">', i, s, otv = false;
    for (i = 0; i < res.spec.length; i++) {
      s = res.spec[i];
      if (s.kol === null) { otv = true; continue; }
      h += '<li><span><b>' + esc(s.oboznachenie) + '</b> <span class="p">' + esc(s.pb) + '</span></span><span>' + s.kol + ' ' + s.ed + '</span></li>';
    }
    h += '</ul>' + (otv ? '<p class="k-hint" style="margin:0 0 12px">Отвод в заявку не кладём: его количество определяет проект привязки. Добавить можно из карточки отвода.</p>' : '') +
      '<div class="k-row"><button type="button" class="btn" data-act="vzayavku"' + (ui.dobavleno === res.shifr ? ' disabled' : '') + '>' + (ui.dobavleno === res.shifr ? 'Позиции в заявке' : 'Добавить позиции в заявку') + '</button>' +
      '<a class="btn ghost" href="atlas.html#/spec">Открыть заявку</a></div><p class="k-status" id="k-zst" role="status">' + (ui.zst || '') + '</p>' +
      '<p class="k-hint">Заявка общая с каталогом: в ней можно изменить количество, скачать список для Excel и отправить запрос цены и срока.</p></div>';
    return h;
  }
  function blokKomplekt(res) {
    var h = '<form class="panel" novalidate data-form="zakaz"><h3>Комплект документации ' + esc(res.shifr) + '</h3><fieldset class="k-f" style="margin-bottom:0"><legend>Вариант комплекта</legend><div class="k-vars" role="radiogroup" aria-label="Вариант комплекта">', i, v;
    for (i = 0; i < VARIANTY.length; i++) {
      v = VARIANTY[i];
      h += '<label class="k-chip"><input type="radio" name="v" data-z="v" value="' + v.id + '"' + (ui.zf.v === v.id ? ' checked' : '') + '><span><b>' + v.nazv + '</b><em>' + rub(v.cena) + '</em><i>' + v.opis + '</i></span></label>';
    }
    if (SERVIS) { return h + blokServis(res); }
    h += '</div></fieldset><p class="k-hint" style="margin:-8px 0 18px">Цены указаны с НДС 22 % и одинаковы для любого узла. Комплект по вашему заданию собирает ПРОМБУРГ и отправляет на электронную почту; автоматической выдачи файлов на сайте нет. Оплата по счёту; банковской картой и через СБП — скоро.</p>' +
      '<div class="k-grid">' + zin('org', 'Организация', 'text', ' autocomplete="organization"') + zin('inn', 'ИНН', 'text', ' inputmode="numeric" autocomplete="off"', '10 или 12 цифр.') +
      zin('kont', 'Контактное лицо и телефон', 'text', ' autocomplete="name"') + zin('mail', 'Электронная почта для комплекта', 'email', ' autocomplete="email"') + '</div>' +
      '<div class="k-row"><button type="submit" class="btn">Сформировать заказ</button></div><p class="k-hint">Сайт ничего не отправляет сам: будет подготовлено письмо на ' + EMAIL + ' с шифром, вариантом и вашим заданием — отправите его из своей почты.</p>' +
      '<div id="k-pismo">' + pismoGotovo() + '</div></form>';
    return h;
  }
  /* ---------- заказ через сервис (только при заданном KONSTR_SERVIS) ---------- */
  function blokServis(res) {
    var opl = [['online', 'Картой или через СБП', 'Оплата на сайте, чек — на электронную почту'], ['schet', 'По счёту', 'Безналичная оплата для организаций и предпринимателей']], i;
    var h = '</div></fieldset><p class="k-hint" style="margin:-8px 0 18px">Цены указаны с НДС 22 % и одинаковы для любого узла. Электронная версия приходит на электронную почту после поступления оплаты, вариант с экспертизой инженера — в течение 10 дней после оплаты.</p>' +
      '<fieldset class="k-f" style="margin-bottom:0"><legend>Способ оплаты</legend><div class="k-vars" role="radiogroup" aria-label="Способ оплаты">';
    for (i = 0; i < opl.length; i++) {
      h += '<label class="k-chip"><input type="radio" name="opl" data-z="opl" value="' + opl[i][0] + '"' + (ui.zf.opl === opl[i][0] ? ' checked' : '') + '><span><b>' + opl[i][1] + '</b><i>' + opl[i][2] + '</i></span></label>';
    }
    h += '</div></fieldset><div class="k-grid">' + zin('org', 'Организация', 'text', ' autocomplete="organization"') + zin('inn', 'ИНН', 'text', ' inputmode="numeric" autocomplete="off"', '10 или 12 цифр.') +
      zin('kont', 'Контактное лицо и телефон', 'text', ' autocomplete="name"') + zin('mail', 'Электронная почта для комплекта', 'email', ' autocomplete="email"') + '</div>' +
      '<div class="k-f k-sogl"><label class="k-check"><input type="checkbox" id="z-sogl" data-z="sogl"' + (ui.zf.sogl ? ' checked' : '') + (ui.zerrs.sogl ? ' aria-invalid="true" aria-describedby="ze-sogl"' : '') +
      '><span>Согласен с ' + (OFERTA ? '<a href="' + esc(OFERTA) + '" target="_blank" rel="noopener">условиями оферты и обработкой персональных данных</a>' : 'условиями оферты и обработкой персональных данных') + '</span></label>' + zerr('sogl') + '</div>' +
      '<div class="k-row"><button type="submit" class="btn" id="k-otpravit"' + (ui.srv && ui.srv.st === 'otpravka' ? ' disabled' : '') + '>' + (ui.srv && ui.srv.st === 'otpravka' ? 'Отправляем…' : 'Оформить заказ') + '</button></div>' +
      '<p class="k-hint">Типовое решение, не проектная документация: привязку к объекту выполняет проектная организация заказчика.</p>' +
      '<div id="k-pismo">' + servisGotovo() + pismoGotovo() + '</div></form>';
    return h;
  }
  function servisGotovo() {
    var s = ui.srv, h, i;
    if (!s || s.st === 'otpravka') { return ''; }
    if (s.st === 'ok') {
      h = '<div class="k-ready" role="status" id="k-srv-ok"><b>Заказ ' + esc(s.d.id) + ' принят.</b> Комплект ' + esc(s.d.shifr) + ', ' + rub(s.d.summa) + ' с НДС.';
      if (s.d.oplata_url) {
        h += ' Сейчас откроется страница оплаты.<div class="k-row" style="margin-top:10px"><a class="btn" id="k-oplata" href="' + esc(s.d.oplata_url) + '">Перейти к оплате</a></div>';
      } else {
        h += ' Счёт на оплату отправим на ' + esc(ui.zf.mail) + '. В назначении платежа укажите номер счёта ' + esc(s.d.id) + ' — комплект придёт на эту же почту после поступления оплаты.';
      }
      if (s.d.status_url) { h += '<p class="k-hint"><a id="k-status-url" href="' + esc(s.d.status_url) + '" target="_blank" rel="noopener">Состояние заказа</a></p>'; }
      return h + '</div>';
    }
    h = '<div class="k-ready k-srv-err" role="alert" id="k-srv-err"><b>' + esc(s.tekst) + '</b>';
    if (s.prichiny && s.prichiny.length) { h += '<ul>'; for (i = 0; i < s.prichiny.length; i++) { h += '<li>' + esc(ochistitTekst(s.prichiny[i])) + '</li>'; } h += '</ul>'; }
    return h + '</div>';
  }
  function httpAdres(u) { return typeof u === 'string' && /^https?:\/\//.test(u); }
  function klyuchPovtora(sig) {
    var a = 'abcdefghijklmnopqrstuvwxyz0123456789', k = '', i;
    if (ui.kl && ui.kl.sig === sig) { return ui.kl.k; }
    for (i = 0; i < 24; i++) { k += a.charAt(Math.floor(Math.random() * a.length)); }
    ui.kl = { sig: sig, k: k };
    return k;
  }
  function risovatZakaz(fokus) {
    var el;
    document.getElementById('k-order').innerHTML = zakaz(RES);
    el = fokus ? document.querySelector(fokus) : null;
    if (el) { try { el.focus(); } catch (e) {} }
  }
  /* сеть или сервис подвели — откат на письмо, как без сервиса */
  function otkatNaPismo(prichina) {
    ui.srv = { st: 'oshibka', tekst: prichina + ' Подготовили письмо с заказом — отправьте его из своей почты, счёт придёт в ответ.' };
    ui.pismo = pismoZakaz(RES);
    risovatZakaz('#k-mailto');
  }
  function otpravitZakaz() {
    var z = ui.zf, res = RES, x, telo, gotovo = false;
    var POLYA = { organizaciya: 'org', inn: 'inn', kontakt: 'kont', pochta: 'mail', oferta: 'sogl' };
    telo = { tz: tzOf(), variant: z.v === 'eks' ? 'ekspertiza' : 'elektronnaya', sposob_oplaty: z.opl === 'schet' ? 'schet' : 'online',
      pokupatel: { organizaciya: z.org, inn: z.inn, kontakt: z.kont, pochta: z.mail }, soglasie_s_ofertoj: true };
    telo.klyuch_povtora = klyuchPovtora(JSON.stringify(telo));
    ui.srv = { st: 'otpravka' }; ui.pismo = null;
    risovatZakaz();
    function konec(fn) { if (gotovo || RES !== res) { return; } gotovo = true; fn(); }
    try {
      x = new XMLHttpRequest();
      x.open('POST', SERVIS, true);
      x.timeout = SERVIS_ZHDAT;
      x.setRequestHeader('Content-Type', 'application/json');
      x.onload = function () {
        konec(function () {
          var d = null, k, e = {};
          try { d = JSON.parse(x.responseText); } catch (er) { d = null; }
          if (x.status === 200 && d && d.ok && d.id) {
            ui.srv = { st: 'ok', d: d };
            if (!httpAdres(d.oplata_url)) { delete d.oplata_url; }
            if (!httpAdres(d.status_url)) { delete d.status_url; }
            risovatZakaz(d.oplata_url ? '#k-oplata' : '#k-srv-ok');
            if (d.oplata_url) { setTimeout(function () { window.location.href = d.oplata_url; }, 1200); }
            return;
          }
          if (d && d.kod === 'podbor') { ui.srv = { st: 'oshibka', tekst: String(d.tekst || ''), prichiny: d.prichiny || [] }; ui.pismo = pismoZakaz(RES); risovatZakaz('#k-srv-err'); return; }
          if (d && d.ok === false && x.status >= 400 && x.status < 500 && x.status !== 429) {
            for (k in (d.polya || {})) { if (Object.prototype.hasOwnProperty.call(d.polya, k) && POLYA[k]) { e[POLYA[k]] = String(d.polya[k]); } }
            ui.zerrs = e; ui.srv = { st: 'oshibka', tekst: String(d.tekst || 'Заказ не принят.') };
            risovatZakaz('#k-order [aria-invalid=true]');
            return;
          }
          otkatNaPismo(x.status === 429 ? 'Сервис заказа перегружен.' : 'Сервис заказа сейчас недоступен.');
        });
      };
      x.onerror = x.ontimeout = x.onabort = function () { konec(function () { otkatNaPismo('Сервис заказа сейчас недоступен.'); }); };
      x.send(JSON.stringify(telo));
    } catch (er2) {
      konec(function () { otkatNaPismo('Сервис заказа сейчас недоступен.'); });
    }
  }

  function pismoGotovo() {
    var m = ui.pismo;
    if (!m) { return ''; }
    return '<div class="k-ready" role="status"><b>Письмо готово.</b> Откройте его в почтовой программе и отправьте — счёт придёт в ответ.' +
      '<div class="k-row" style="margin-top:10px"><a class="btn" id="k-mailto" href="' + esc(m.href) + '">Открыть письмо</a><button type="button" class="btn ghost" data-kopir="zakaz">Скопировать текст</button></div>' +
      '<label for="k-ptext" class="k-hint" style="display:block">Если почтовая программа не открылась — скопируйте текст и отправьте на ' + EMAIL + ', тема «' + esc(m.tema) + '»' +
      (m.sokrashcheno ? '. В ссылку помещён сокращённый текст, полный — ниже' : '') + ':</label>' +
      '<textarea id="k-ptext" readonly>' + esc(m.tekst) + '</textarea></div>';
  }
  function zakaz(res) {
    if (!ui.zakaz) { return ''; }
    return (ui.zakaz !== 'komplekt' ? blokIzdeliya(res) : '') + (ui.zakaz !== 'izdeliya' ? blokKomplekt(res) : '');
  }
  function proveritZakaz() {
    var e = {}, z = ui.zf, k;
    if (!z.org.replace(/\s/g, '')) { e.org = 'Укажите название организации.'; }
    if (!/^(\d{10}|\d{12})$/.test(z.inn.replace(/\s/g, ''))) { e.inn = 'ИНН — 10 цифр для организации или 12 для предпринимателя.'; }
    if (!z.kont.replace(/\s/g, '')) { e.kont = 'Укажите, с кем связаться, и телефон.'; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(z.mail.replace(/^\s+|\s+$/g, ''))) { e.mail = 'Укажите адрес электронной почты, на который отправить комплект.'; }
    if (SERVIS && !z.sogl) { e.sogl = 'Отметьте согласие с условиями — без него заказ не оформить.'; }
    ui.zerrs = e;
    for (k in e) { if (Object.prototype.hasOwnProperty.call(e, k)) { return false; } }
    z.inn = z.inn.replace(/\s/g, ''); z.mail = z.mail.replace(/^\s+|\s+$/g, ''); z.org = z.org.replace(/^\s+|\s+$/g, ''); z.kont = z.kont.replace(/^\s+|\s+$/g, '');
    return true;
  }

  /* ---------- отрисовка и события ---------- */
  function risovat(fokus) {
    var el;
    if (ui.view === 'rez') {
      RES = podbor(tzOf());
      app.innerHTML = polosa() + (RES.ok ? rezOk(RES) : rezOtkaz(RES));
    } else {
      RES = null;
      risovatShag();
    }
    zapisatAdres();
    if (fokus) {
      el = typeof fokus === 'string' ? app.querySelector(fokus) : app.querySelector('h2[tabindex]');
      if (el) { try { el.focus({ preventScroll: typeof fokus === 'string' }); } catch (e) { el.focus(); } }
      if (typeof fokus !== 'string') { try { app.scrollIntoView({ block: 'start' }); } catch (e2) {} }
    }
  }
  function kShagu(n, fokus) { ui.view = 'shag'; ui.shag = n; if (n > ui.doshel) { ui.doshel = n; } ui.errs = {}; risovat(fokus === undefined ? true : fokus); }
  function kRezultatu() { ui.view = 'rez'; ui.doshel = 4; ui.errs = {}; ui.pismo = null; ui.srv = null; ui.zst = ''; risovat(true); }
  function dalshe() {
    var i;
    if (!proverit(ui.shag)) { risovat(); i = app.querySelector('[aria-invalid=true]') || app.querySelector('.k-errmsg'); if (i) { (i.closest('.k-f').querySelector('input,select') || i).focus(); } return; }
    if (ui.shag < 4) { return kShagu(ui.shag + 1); }
    for (i = 1; i <= 3; i++) { if (!proverit(i)) { ui.view = 'shag'; ui.shag = i; risovat(true); return; } }
    kRezultatu();
  }
  function obnovitPodskazki() {
    var m = { s: function () { return hintS(podbor.podskazka(tzOf())); }, l: hintL, pn: hintPn, itog: hintItog }, els = app.querySelectorAll('[data-hint]'), i, k;
    for (i = 0; i < els.length; i++) { k = els[i].getAttribute('data-hint'); if (m[k]) { els[i].innerHTML = m[k](); } }
    els = app.querySelectorAll('.k-steps li'); /* подпись шага в полосе */
    if (ui.view === 'shag' && els[ui.shag - 1]) { k = els[ui.shag - 1].querySelector('.v'); if (k) { k.textContent = znachenieShaga(ui.shag) || ' '; } }
  }
  function snyatOshibku(id) {
    var e = document.getElementById('e-' + id), inp = document.getElementById('f-' + id);
    if (ui.errs[id]) { delete ui.errs[id]; if (e) { e.parentNode.removeChild(e); } if (inp) { inp.removeAttribute('aria-invalid'); } }
  }

  app.addEventListener('input', function (ev) {
    var t = ev.target, k = t.getAttribute('data-f'), z = t.getAttribute('data-z');
    if (z && t.type !== 'radio' && t.type !== 'checkbox') { ui.zf[z] = t.value; return; }
    if (!k || t.type === 'radio' || t.type === 'checkbox' || t.tagName === 'SELECT') { return; }
    f[k] = t.value.replace(/^\s+|\s+$/g, '');
    if (k === 's') { ui.sSam = f.s !== ''; }
    snyatOshibku(k); obnovitPodskazki(); zapisatAdres();
  });
  app.addEventListener('change', function (ev) {
    var t = ev.target, k = t.getAttribute('data-f'), z = t.getAttribute('data-z'), tr;
    if (z === 'opl') { ui.zf.opl = t.value; return; }
    if (z === 'sogl') { ui.zf.sogl = !!t.checked; return; }
    if (z === 'v') { ui.zf.v = t.value; if (ui.pismo && RES) { ui.pismo = pismoZakaz(RES); document.getElementById('k-pismo').innerHTML = pismoGotovo(); } return; }
    if (!k) { return; }
    if (k === 'lx') { f.lx = t.checked; if (f.lx) { delete ui.errs.l; } risovat('#f-lx'); return; }
    if (t.type === 'radio') {
      f[k] = t.value; delete ui.errs[k];
      if (k === 'dn') { tr = truba(P(f.dn)); if (tr && !ui.sSam) { f.s = String(tr.s); } risovat('input[name=dn]:checked'); return; }
      snyatOshibku(k); obnovitPodskazki(); zapisatAdres(); return;
    }
    if (t.tagName === 'SELECT') { f[k] = t.value; obnovitPodskazki(); zapisatAdres(); }
  });
  app.addEventListener('submit', function (ev) {
    var kind = ev.target.getAttribute('data-form'), el;
    ev.preventDefault();
    if (kind === 'shag') { dalshe(); }
    if (kind === 'zakaz' && RES && RES.ok && SERVIS) {
      if (ui.srv && ui.srv.st === 'otpravka') { return; }
      ui.srv = null; ui.pismo = null;
      if (proveritZakaz()) { otpravitZakaz(); } else { risovatZakaz('#k-order [aria-invalid=true]'); }
      return;
    }
    if (kind === 'zakaz' && RES && RES.ok) {
      if (proveritZakaz()) { ui.pismo = pismoZakaz(RES); } else { ui.pismo = null; }
      document.getElementById('k-order').innerHTML = zakaz(RES);
      el = ui.pismo ? document.getElementById('k-mailto') : app.querySelector('#k-order [aria-invalid=true]');
      if (el) { el.focus(); }
    }
  });
  app.addEventListener('click', function (ev) {
    var t = ev.target, b, v, a;
    if (!t.closest) { return; }
    if ((b = t.closest('[data-shag]'))) {
      v = parseInt(b.getAttribute('data-shag'), 10);
      if (v === 5) { if (ui.view === 'shag' && !proverit(ui.shag)) { risovat(); return; } for (a = 1; a <= 4; a++) { if (!proverit(a)) { ui.view = 'shag'; ui.shag = a; risovat(true); return; } } return kRezultatu(); }
      if (ui.view === 'shag' && v > ui.shag && !proverit(ui.shag)) { risovat(); return; }
      return kShagu(v);
    }
    if ((b = t.closest('[data-set]'))) {
      v = b.getAttribute('data-set'); f[v] = b.getAttribute('data-val');
      a = document.getElementById('f-' + v); if (a) { a.value = f[v]; }
      snyatOshibku(v); obnovitPodskazki(); zapisatAdres(); return;
    }
    if ((b = t.closest('[data-alt]'))) {
      a = ui.alt[parseInt(b.getAttribute('data-alt'), 10)];
      for (v in a.set) { if (Object.prototype.hasOwnProperty.call(a.set, v)) { f[v] = a.set[v]; if (v === 's') { ui.sSam = true; } } }
      return kRezultatu();
    }
    if ((b = t.closest('[data-zakaz]'))) {
      ui.zakaz = b.getAttribute('data-zakaz'); ui.pismo = null; ui.zerrs = {}; ui.srv = null;
      a = app.querySelectorAll('[data-zakaz]');
      for (v = 0; v < a.length; v++) { a[v].setAttribute('aria-pressed', a[v] === b ? 'true' : 'false'); }
      document.getElementById('k-order').innerHTML = zakaz(RES); zapisatAdres();
      a = document.querySelector('#k-order h3'); if (a) { a.setAttribute('tabindex', '-1'); a.focus({ preventScroll: true }); a.scrollIntoView({ block: 'nearest' }); }
      return;
    }
    if ((b = t.closest('[data-kopir]'))) {
      v = b.getAttribute('data-kopir');
      kopirovat(v === 'zakaz' ? (ui.pismo ? ui.pismo.tekst : '') : (ui.inzh ? 'Кому: ' + EMAIL + '\nТема: ' + ui.inzh.tema + '\n\n' + ui.inzh.tekst : ''), b);
      return;
    }
    b = t.closest('[data-act]');
    if (!b) { return; }
    v = b.getAttribute('data-act');
    if (v === 'nazad') { kShagu(ui.shag - 1); }
    if (v === 'izmenit') { kShagu(1); }
    if (v === 'ssylka') { kopirovat(ssylka(), b); }
    if (v === 'kzakazu') { ev.preventDefault(); a = document.getElementById('zakaz'); a.scrollIntoView({ block: 'start' }); a.focus({ preventScroll: true }); }
    if (v === 'vzayavku' && RES && RES.ok && ui.dobavleno !== RES.shifr) {
      b.disabled = true;
      vZayavku(RES, function (zap, poz, spec) {
        var n = 0, i, st = document.getElementById('k-zst');
        for (i = 0; i < poz.length; i++) { n += poz[i].kol; }
        if (zap) {
          ui.dobavleno = RES.shifr; b.textContent = 'Позиции в заявке';
          ui.zst = 'Добавлено: ' + poz.length + ' ' + mn(poz.length, 'позиция', 'позиции', 'позиций') + ', ' + n + ' шт. Сейчас в заявке: ' +
            poz.map(function (s) { return esc(s.pb) + ' — ' + spec[s.pb].qty + ' шт'; }).join('; ') + '.';
        } else {
          b.disabled = false;
          ui.zst = 'Браузер не дал сохранить заявку (хранилище отключено). Скопируйте коды из спецификации или отправьте их на ' + EMAIL + '.';
        }
        if (st) { st.innerHTML = ui.zst; }
      });
    }
  });

  app.addEventListener('error', function (ev) {
    var t = ev.target, full;
    if (!t || t.tagName !== 'IMG') { return; }
    full = t.getAttribute('data-full');
    if (full && t.getAttribute('src') !== full) { t.setAttribute('src', full); } else { t.style.display = 'none'; }
  }, true);

  /* ---------- старт ---------- */
  izAdresa();
  schetchik();
  (function () {
    var el = document.getElementById('k-ver');
    if (el && D.versiya) { el.textContent = 'Данные конструктора от ' + (D.versiya.kat_built || '') + ', версия ' + (D.v || ''); }
  }());
  risovat();
  window.KONSTRUKTOR = { tz: tzOf, rezultat: function () { return RES; }, sostoyanie: function () { return { f: f, ui: ui }; }, adres: ssylka, servis: SERVIS };
}());
