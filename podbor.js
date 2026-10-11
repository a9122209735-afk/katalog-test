/* Конструктор типового решения узла ООО «ПРОМБУРГ»: расчётно-подборочный движок.
   window.podbor(tz) -> результат; window.podbor.podskazka(tz) -> подсказки для квиза по мере ввода. Чистая функция, ES5, без зависимостей и сетевых запросов; работает с file://.
   Данные: window.KONSTR (data/konstruktor.js, сборка tipovye-resheniya/_src/build_konstruktor.py).
   Алгоритм построчно повторяет tipovye-resheniya/_src/podbor.py; соответствие проверяет test_js.py.
   Вид узла: прямой участок трубопровода тепловой сети с осевым сильфонным компенсационным устройством СКУ.М
   между неподвижными опорами, надземная и подземная канальная прокладка, вода.
   Расчёт — по методике производителя компенсаторов (подписи формул — в nagruzki.formuly). Типовое решение, не проектная документация. */
(function (root) {
  'use strict';
  var VERSIYA_DVIZHKA = '1.0';
  var OGOVORKA = 'Типовое решение, не проектная документация. Привязку к объекту, расчёт трубопровода на прочность и устойчивость, ' +
    'шаг опор и нагрузки на строительные конструкции определяет проектная организация заказчика.';
  var T1S = [95, 115, 130, 150], T0S = [-20, -25, -30, -35, -40], TMS = [30, 20, 10, 0, -10, -20];
  var P10 = [1, 10, 100, 1000, 10000, 100000, 1000000];

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function nul(x) { return x === undefined ? null : x; }

  function rnd(x, nd) {
    var p = P10[nd];
    if (x < 0) { return -Math.floor(-x * p + 0.5) / p; }
    return Math.floor(x * p + 0.5) / p;
  }

  function fmt(x, nd) {
    var p = P10[nd], neg = x < 0;
    var n = Math.floor(Math.abs(x) * p + 0.5 + 1e-9);
    var s = String(n);
    if (nd > 0) {
      while (s.length < nd + 1) { s = '0' + s; }
      s = s.substring(0, s.length - nd) + ',' + s.substring(s.length - nd);
    }
    if (neg && n !== 0) { s = '−' + s; }
    return s;
  }

  function fmt0(x) {
    var s = fmt(x, 2);
    if (s.indexOf(',') >= 0) {
      while (s.charAt(s.length - 1) === '0') { s = s.substring(0, s.length - 1); }
      if (s.charAt(s.length - 1) === ',') { s = s.substring(0, s.length - 1); }
    }
    return s;
  }

  function kanon(x) { return fmt0(x).replace(',', '.').replace('−', '-'); }

  function fnv1a(s) {
    var h = 0x811C9DC5, i, lo, hi, r = '';
    for (i = 0; i < s.length; i++) {
      h = (h ^ (s.charCodeAt(i) & 0xFF)) >>> 0;
      lo = (h & 0xFFFF) * 0x0193;
      hi = (((h >>> 16) * 0x0193) + ((h & 0xFFFF) * 0x0100)) & 0xFFFF;
      h = (lo + hi * 65536) % 4294967296;
    }
    for (i = 0; i < 8; i++) {
      r = '0123456789ABCDEF'.charAt(h % 16) + r;
      h = Math.floor(h / 16);
    }
    return r;
  }

  function msg(kod, tekst) { return { kod: kod, tekst: tekst }; }

  /* сравнение ключей [число, число, ..., строка] как в Python */
  function less(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] < b[i]) { return true; }
      if (a[i] > b[i]) { return false; }
    }
    return false;
  }

  function vyborNo(D, dNar, s, prokladka, H, nagruzka, bezUp) {
    var best = null, i, j, o, p, para, rank, key, r, kk;
    var info = { q_max: null, q_max_des: null, q_max_s: null, q_s_max: null, q_drugoj_prokladki: null, q_upornoj: null, est: false,
      q_bez_upornyh: null };
    for (i = 0; i < D.opory_nepodvizhnye.length; i++) {
      o = D.opory_nepodvizhnye[i];
      if (o.d_nar !== dNar) { continue; }
      if (o.vid === 'korpusnaya' && o.h !== H) { continue; }
      /* пара «Q — S» исполнения по стенке трубы: с наибольшей S, не превышающей стенку */
      para = null;
      for (j = 0; j < o.pary.length; j++) {
        p = o.pary[j];
        if (p.s <= s + 1e-9 && (para === null || p.s > para.s)) { para = p; }
      }
      if (o.vid === 'shchitovaya' && prokladka !== 'kanalnaya') {
        if (para !== null && para.q >= nagruzka && (info.q_drugoj_prokladki === null || para.q < info.q_drugoj_prokladki)) {
          info.q_drugoj_prokladki = para.q;
        }
        continue;
      }
      if (o.vid === 'upornaya' && bezUp) {
        /* упорные опоры отключены в ТЗ: запомнить, что подошла бы */
        if (para !== null && para.q >= nagruzka && (info.q_upornoj === null || para.q < info.q_upornoj)) { info.q_upornoj = para.q; }
        continue;
      }
      info.est = true;
      if (o.vid !== 'upornaya' && para !== null && (info.q_bez_upornyh === null || para.q > info.q_bez_upornyh)) { info.q_bez_upornyh = para.q; }
      for (j = 0; j < o.pary.length; j++) {
        p = o.pary[j];
        if (info.q_max === null || p.q > info.q_max) { info.q_max = p.q; info.q_max_des = o.des; info.q_max_s = p.s; }
      }
      if (para === null) { continue; }
      if (info.q_s_max === null || para.q > info.q_s_max) { info.q_s_max = para.q; }
      if (para.q < nagruzka) { continue; }
      /* порядок предпочтения: корпусные, затем щитовые (только в канале), затем упорные — только если первые не проходят */
      rank = o.vid === 'korpusnaya' ? 0 : (o.vid === 'shchitovaya' ? 1 : 2);
      key = [rank, para.q, o.massa, o.pb];
      if (best === null || less(key, best[0])) { best = [key, o, para]; }
    }
    if (best === null) { return [null, info]; }
    r = {};
    for (kk in best[1]) { if (Object.prototype.hasOwnProperty.call(best[1], kk)) { r[kk] = best[1][kk]; } }
    r.q = best[2].q; r.s = best[2].s;
    r.q_bez_upornyh = info.q_bez_upornyh;
    return [r, info];
  }

  function vyborSk(D, dNar, H, peremeshchenie) {
    var best = null, est = false, i, o, key;
    for (i = 0; i < D.opory_skolzyashchie.length; i++) {
      o = D.opory_skolzyashchie[i];
      if (o.d_nar.indexOf(dNar) < 0 || o.h !== H) { continue; }
      est = true;
      if (o.peremeshchenie < peremeshchenie) { continue; }
      key = [o.l, o.massa, o.pb];
      if (best === null || less(key, best[0])) { best = [key, o]; }
    }
    return [best ? best[1] : null, est];
  }

  function oporaOut(o, kol, nagruzka, rol) {
    var r = { pb: o.pb, oboznachenie: o.des, slug: o.slug, code: o.code, kol: kol, massa: o.massa, l: o.l, h: nul(o.h), rol: rol,
      step: nul(o.step), png: nul(o.png) };
    if (o.q !== undefined) {
      r.vid = o.vid; r.q = o.q; r.s = o.s; r.p = nul(o.p); r.t = nul(o.t);
      r.pary = o.pary; r.para = { q: o.q, s: o.s };
      r.title = nul(o.title); r.gab = nul(o.gab); r.b = nul(o.b);
      r.nagruzka = rnd(nagruzka, 6); r.zapas = rnd(o.q - nagruzka, 6);
    } else {
      r.peremeshchenie_do = o.peremeshchenie; r.vert_nagruzka = nul(o.nagruzka); r.peremeshchenie = rnd(nagruzka, 6);
    }
    return r;
  }

  function podbor(tz, D) {
    D = D || root.KONSTR;
    var K = D.konst, PR = D.predely;
    var otkaz = [], pred = [], prinyato = [];
    var res = { ok: false, prichiny_otkaza: otkaz, preduprezhdeniya: pred, ogovorka: OGOVORKA,
      versiya_dannyh: D.versiya, versiya_dvizhka: VERSIYA_DVIZHKA, tz: nul(tz) };
    var isObj = tz !== null && typeof tz === 'object' && Object.prototype.toString.call(tz) !== '[object Array]';
    function g(k) {
      if (!isObj || !Object.prototype.hasOwnProperty.call(tz, k)) { return null; }
      return nul(tz[k]);
    }
    var i, j, t, hv, k, v, n, o, p, s;

    /* ---- 1. разбор ТЗ ---- */
    if (!isObj) {
      otkaz.push(msg('E_TZ', 'Техническое задание не передано.'));
      return res;
    }
    var dNar = g('dn_truby'), stenka = g('stenka'), pn = g('pn'), sreda = g('sreda'), t1 = g('t1'), t0 = g('t0'), tMont = g('t_mont');
    var prokladka = g('prokladka'), dlina = g('dlina'), izol = g('izolyaciya_kg_m'), H = g('vysota_opory');
    var bezUp = g('bez_upornyh') === true;
    if (sreda === null) { sreda = 'voda'; prinyato.push('sreda'); }
    if (tMont === null) { tMont = 10; prinyato.push('t_mont'); }
    if (izol === null) { izol = 0; prinyato.push('izolyaciya_kg_m'); }
    if (H === null) { H = K.h_opory.v; prinyato.push('vysota_opory'); }
    var truba = null;
    if (!isNum(dNar)) {
      otkaz.push(msg('E_DN', 'Не задан наружный диаметр трубы.'));
    } else {
      for (i = 0; i < D.truby.length; i++) { if (D.truby[i].d_nar === dNar) { truba = D.truby[i]; } }
      if (truba === null) {
        var ryad = [];
        for (i = 0; i < D.truby.length; i++) { ryad.push(fmt0(D.truby[i].d_nar)); }
        otkaz.push(msg('E_DN', 'Наружный диаметр трубы ' + fmt0(dNar) + ' мм не входит в ряд типового решения (' + ryad.join(', ') + ' мм). Нужен подбор инженером.'));
      }
    }
    if (!isNum(pn) || (pn !== 1.6 && pn !== 2.5)) {
      otkaz.push(msg('E_PN', 'Номинальное давление должно быть 1,6 или 2,5 МПа. Для другого давления нужен подбор инженером.'));
    }
    if (sreda === 'par') {
      otkaz.push(msg('E_SREDA', 'Типовое решение рассчитано на воду. Для паропровода ход компенсатора и наработка определяются иначе ' +
        '— нужен подбор инженером.'));
    } else if (sreda !== 'voda') {
      otkaz.push(msg('E_SREDA', 'Теплоноситель должен быть указан: вода или пар.'));
    }
    if (prokladka !== 'nadzemnaya' && prokladka !== 'kanalnaya') {
      otkaz.push(msg('E_PROKLADKA', 'Способ прокладки должен быть указан: надземная или подземная канальная. ' +
        'Для бесканальной прокладки применяются другие компенсационные устройства — нужен подбор инженером.'));
    }
    if (!isNum(t1) || !isNum(t0) || !isNum(tMont)) {
      otkaz.push(msg('E_T', 'Не заданы температуры: максимальная теплоносителя и расчётная наружного воздуха.'));
    } else {
      if (t1 > PR.t1_max.v) {
        otkaz.push(msg('E_T1', 'Температура теплоносителя ' + fmt0(t1) + ' °С выше 200 °С — предела для воды у СКУ.М ' +
          'по данным производителя. Нужен подбор инженером.'));
      }
      if (t0 <= PR.t0_min.v) {
        otkaz.push(msg('E_T0', 'Расчётная температура наружного воздуха ' + fmt0(t0) + ' °С: производитель компенсаторов допускает применение ' +
          'при температуре выше минус 60 °С. Нужен подбор инженером.'));
      }
      if (t1 <= t0) {
        otkaz.push(msg('E_T', 'Температура теплоносителя должна быть выше расчётной температуры наружного воздуха.'));
      } else if (tMont < t0 || tMont >= t1) {
        otkaz.push(msg('E_TMONT', 'Температура монтажа ' + fmt0(tMont) + ' °С должна быть не ниже расчётной температуры наружного воздуха (' +
          fmt0(t0) + ' °С) и ниже температуры теплоносителя. Иначе монтажную растяжку определяет инженер.'));
      }
    }
    if (stenka !== null && (!isNum(stenka) || stenka <= 0 || (isNum(dNar) && stenka * 2 >= dNar))) {
      otkaz.push(msg('E_STENKA', 'Толщина стенки трубы задана неверно.'));
    }
    if (dlina !== null && (!isNum(dlina) || dlina <= 0 || dlina > PR.dlina_max.v)) {
      otkaz.push(msg('E_DLINA', 'Длина прямого участка должна быть больше 0 и не больше ' + fmt0(PR.dlina_max.v) + ' м.'));
    }
    if (!isNum(izol) || izol < 0) {
      otkaz.push(msg('E_IZOL', 'Вес изоляции на метр трубы задан неверно.'));
    }
    var hOk = false;
    for (i = 0; i < K.h_opory.dopustimo.length; i++) { hv = K.h_opory.dopustimo[i]; if (hv === H) { hOk = true; } }
    if (!hOk) {
      otkaz.push(msg('E_H', 'Высота опор должна быть 100, 150 или 200 мм (исполнения серии 5.903-13).'));
    }
    if (otkaz.length > 0) { return res; }

    /* ---- 2. принятые параметры ---- */
    var du = truba.du;
    if (stenka === null) { stenka = truba.s; prinyato.push('stenka'); }
    var alpha = K.alpha.v, mu = K.mu.v, grav = K.g.v, rhoSt = K.rho_st.v, rhoW = K.rho_w.v;
    var pnKod = pn === 1.6 ? 16 : 25;
    var kand = [];
    for (i = 0; i < D.kompensatory.length; i++) {
      k = D.kompensatory[i];
      if (k.d_nar === dNar && k.pn === pnKod) { kand.push(k); }
    }
    if (kand.length === 0) {
      otkaz.push(msg('E_KOMP', 'Для Dн ' + fmt0(dNar) + ' мм (DN ' + fmt0(du) + '), PN ' + fmt(pn, 1) + ' МПа в каталоге нет компенсатора СКУ.М ' +
        'с полным набором размеров. Нужен подбор инженером.'));
      return res;
    }
    var dt = t1 - t0;
    var dvn = dNar - 2 * stenka;
    var mTr = Math.PI * (dNar - stenka) * stenka * rhoSt * 1e-6;
    var mW = Math.PI / 4 * ((dvn / 1000.0) * (dvn / 1000.0)) * rhoW;
    var q0 = (mTr + mW) * grav;
    var qIz = izol * grav;
    var q = q0 + qIz;
    var ftr = mu * q;

    /* ---- 3. перебор компенсаторов: меньше участков, затем меньший ход ---- */
    var varianty = [], Lm, L, Lu;
    for (i = 0; i < kand.length; i++) {
      k = kand[i];
      Lm = K.k_hod.v * k.hod / (alpha * dt);
      L = dlina !== null ? dlina : Lm;
      n = Math.ceil(L / Lm - 1e-9);
      if (n < 1) { n = 1; }
      varianty.push([n, k.hod, k, Lm, L]);
    }
    /* устойчивая сортировка вставками по [n, ход] */
    for (i = 1; i < varianty.length; i++) {
      v = varianty[i];
      j = i - 1;
      while (j >= 0 && less([v[0], v[1]], [varianty[j][0], varianty[j][1]])) { varianty[j + 1] = varianty[j]; j--; }
      varianty[j + 1] = v;
    }
    var vybran = null, pervyj = null, X;
    var Pp, PpTab, Pzh, Ptr, Pkno, PknoProv, Ppno, dlUch, a, b1, b2, prich, rk, noK, infK, noP, rsk, sk, skEst, txt, vr;
    for (i = 0; i < varianty.length; i++) {
      v = varianty[i];
      n = v[0]; k = v[2]; Lm = v[3]; L = v[4];
      Lu = L / n;
      Pp = K.k_prob.v * pn * k.S_ef * 100 / 1000.0;
      PpTab = k.Pp_tab[pnKod === 16 ? '16_125' : '25_125'];
      Pzh = k.C * k.amp / 1000.0;
      Ptr = ftr * Lu / 1000.0;
      Pkno = Pp + Pzh + Ptr;
      PknoProv = (Pp > PpTab ? Pp : PpTab) + Pzh + Ptr;
      Ppno = K.k_pno_zh.v * Pzh + K.k_pno_tr.v * Ptr;
      dlUch = alpha * dt * Lu;
      a = K.a_dn.v * du; b1 = K.b1_dn.v * du; b2 = K.b2_dn.v * du;
      prich = [];
      if (a + k.L + b2 >= Lu * 1000) {
        prich.push(msg('E_KOROTKIJ', 'Участок ' + fmt(Lu, 2) + ' м короче, чем нужно для расстановки опор у компенсатора: ' +
          fmt0(K.a_dn.v) + 'DN + длина компенсатора + ' + fmt0(K.b2_dn.v) + 'DN = ' +
          fmt((a + k.L + b2) / 1000.0, 2) + ' м (по методике производителя компенсаторов). Нужен подбор инженером.'));
      }
      rk = vyborNo(D, dNar, stenka, prokladka, H, PknoProv, bezUp); noK = rk[0]; infK = rk[1];
      noP = null;
      if (n > 1) { noP = vyborNo(D, dNar, stenka, prokladka, H, Ppno, bezUp)[0]; }
      rsk = vyborSk(D, dNar, H, dlUch); sk = rsk[0]; skEst = rsk[1];
      if (noK === null) {
        txt = 'Расчётная осевая нагрузка на концевую неподвижную опору — ' + fmt(PknoProv, 1) + ' кН (по методике производителя компенсаторов). ';
        if (!infK.est) {
          txt += 'В каталоге нет неподвижной опоры серии 5.903-13 для Dн ' + fmt0(dNar) + ' мм при выбранной прокладке. ';
        } else if (infK.q_s_max === null) {
          txt += 'Опоры каталога для Dн ' + fmt0(dNar) + ' мм рассчитаны на стенку трубы не менее ' + fmt0(infK.q_max_s) +
            ' мм, задана стенка ' + fmt0(stenka) + ' мм. ';
        } else if (infK.q_max !== null && infK.q_max >= PknoProv) {
          txt += 'Опора с достаточной несущей способностью (' + infK.q_max_des + ', ' + fmt0(infK.q_max) + ' кН) рассчитана на стенку трубы не менее ' +
            fmt0(infK.q_max_s) + ' мм, задана стенка ' + fmt0(stenka) + ' мм. ';
        } else {
          txt += 'Наибольшая несущая способность опор каталога для Dн ' + fmt0(dNar) + ' мм при ' + (prokladka === 'nadzemnaya' ? 'надземной' : 'канальной') +
            ' прокладке — ' + fmt0(infK.q_s_max) + ' кН. ';
        }
        if (infK.q_drugoj_prokladki !== null) {
          txt += 'При канальной прокладке подходит щитовая опора (' + fmt0(infK.q_drugoj_prokladki) + ' кН), её ставят в стенке канала или камеры. ';
        }
        if (infK.q_upornoj !== null) {
          txt += 'Проходит упорная опора (' + fmt0(infK.q_upornoj) + ' кН), но упорные опоры в исходных данных исключены: им нужна опорная конструкция из балок вокруг трубы. ';
        }
        txt += 'Неподвижная опора — по запросу, нужен подбор инженером.';
        prich.push(msg('E_NO', txt));
      }
      if (n > 1 && noP === null) {
        prich.push(msg('E_NO_PROM', 'Для промежуточной неподвижной опоры (нагрузка ' + fmt(Ppno, 1) + ' кН) в каталоге нет исполнения для Dн ' +
          fmt0(dNar) + ' мм и стенки ' + fmt0(stenka) + ' мм. Неподвижная опора — по запросу, нужен подбор инженером.'));
      }
      if (sk === null) {
        if (skEst) {
          prich.push(msg('E_SK', 'Тепловое перемещение трубы на участке ' + fmt(dlUch, 0) + ' мм больше допустимого для скользящих опор каталога. ' +
            'Нужен подбор инженером.'));
        } else {
          prich.push(msg('E_SK', 'В каталоге нет скользящей опоры серии 5.903-13 для Dн ' + fmt0(dNar) + ' мм с высотой ' + fmt0(H) +
            ' мм. Нужен подбор инженером.'));
        }
      }
      vr = { n: n, k: k, Lm: Lm, L: L, Lu: Lu, Pp: Pp, Pp_tab: PpTab, Pzh: Pzh, Ptr: Ptr, Pkno: Pkno, Pkno_prov: PknoProv, Ppno: Ppno,
        dl_uch: dlUch, a: a, b1: b1, b2: b2, no_k: noK, no_p: noP, sk: sk, prich: prich };
      if (pervyj === null) { pervyj = vr; }
      if (prich.length === 0) { vybran = vr; break; }
    }
    X = vybran !== null ? vybran : pervyj;
    k = X.k; n = X.n;

    /* ---- 4. общая часть результата ---- */
    if (dlina === null) { prinyato.push('dlina'); }
    res.parametry = { dn_truby: dNar, du: du, stenka: stenka, pn: pn, sreda: sreda, t1: t1, t0: t0, t_mont: tMont, prokladka: prokladka,
      dlina: rnd(X.L, 6), izolyaciya_kg_m: izol, vysota_opory: H, bez_upornyh: bezUp, alpha: alpha, mu: mu, rho_st: rhoSt, rho_w: rhoW, g: grav,
      prinyato: prinyato.concat(['alpha', 'mu', 'rho_st', 'rho_w', 'g', 'rasstanovka']) };
    res.shifr_kanon = 'v1|d=' + kanon(dNar) + '|s=' + kanon(stenka) + '|pn=' + kanon(pn) + '|' + sreda + '|t1=' + kanon(t1) + '|t0=' + kanon(t0) +
      '|tm=' + kanon(tMont) + '|' + prokladka + '|L=' + kanon(X.L) + '|iz=' + kanon(izol) + '|H=' + kanon(H);
    if (bezUp) { res.shifr_kanon += '|bu=1'; }
    res.shifr = 'ПБ-ТР-' + fmt0(du) + '-' + fnv1a(res.shifr_kanon);
    res.uchastkov = n;
    res.dlina_prinyata_Lm = dlina === null;
    res.dlina_uchastka = rnd(X.Lu, 6);
    res.Lm = rnd(X.Lm, 6);
    var zap = X.no_k !== null ? X.no_k.q - X.Pkno : null;
    res.nagruzki = {
      dt: dt, dl_1m: rnd(alpha * dt, 6), dl_uch: rnd(X.dl_uch, 6), dl_Lm: rnd(alpha * dt * X.Lm, 6),
      dvn: rnd(dvn, 6), m_tr: rnd(mTr, 6), m_w: rnd(mW, 6), q_truby: rnd(q0, 6), q_izol: rnd(qIz, 6), q: rnd(q, 6), ftr: rnd(ftr, 6),
      Pp: rnd(X.Pp, 6), Pp_tab: X.Pp_tab, Pzh: rnd(X.Pzh, 6), Ptr: rnd(X.Ptr, 6), Pkno: rnd(X.Pkno, 6),
      Pkno_proverka: rnd(X.Pkno_prov, 6), Ppno: rnd(X.Ppno, 6), Pbok: rnd(K.k_bok.v * X.Pp, 6),
      Q_kno: X.no_k !== null ? X.no_k.q : null,
      zapas_kno: zap !== null ? rnd(zap, 6) : null,
      dq_dop: zap !== null ? rnd(zap * 1000.0 / (mu * X.Lu), 6) : null,
      formuly: { numeraciya: 'номера формул — как в расчётной записке комплекта; расчёт по методике производителя компенсаторов',
        dl_1m: 'формула (1)', Lm: 'формула (2)', Pp: 'формула (3)', Pp_tab: 'таблица распорных усилий методики производителя',
        Pzh: 'формула (4)', ftr: 'формула (5)', Ptr: 'формула (6)', Pkno: 'формула (7)', Ppno: 'формула (8)',
        Pbok: '15 % распорного усилия', rastyazhka: 'формулы (9), (10)',
        Pkno_proverka: 'формула (7) с распорным усилием — большим из формулы (3) и таблицы распорных усилий' } };
    res.kompensator = { pb: k.pb, oboznachenie: k.des, oboznachenie_rd: k.obozn_rd, slug: k.slug, kol: n, du: k.du, d_nar: k.d_nar,
      s: k.s, pn_izd: k.pn_izd, zamena_pn: k.zamena_pn, hod: k.hod, amp: k.amp, L: k.L, L1: k.L1, D1: k.D1,
      massa: k.massa, S_ef: k.S_ef, C: k.C, zeta: k.zeta, nesoosn: k.nesoosn, usl: k.usl,
      rd_page: k.rd_page, rd_page_pech: k.rd_page_pech, step: nul(k.step), png: nul(k.png) };
    if (vybran === null) {
      for (i = 0; i < pervyj.prich.length; i++) { otkaz.push(pervyj.prich[i]); }
      return res;
    }

    /* ---- 5. опоры, расстановка, растяжка ---- */
    noK = X.no_k; noP = X.no_p; sk = X.sk;
    res.opory_nepodvizhnye = { koncevye: oporaOut(noK, 2, X.Pkno, 'концевая'),
      promezhutochnye: n > 1 ? oporaOut(noP, n - 1, X.Ppno, 'промежуточная') : null };
    res.opory_skolzyashchie = oporaOut(sk, 2 * n, X.dl_uch, 'у компенсатора');
    res.rasstanovka = { a: X.a, a_dn: K.a_dn.v, b1: X.b1, b1_dn: K.b1_dn.v, b2: X.b2, b2_dn: K.b2_dn.v,
      a_min: K.a_dn.min * du, a_max: K.a_dn.max * du, b1_min: K.b1_dn.min * du, b1_max: K.b1_dn.max * du,
      b2_min: K.b2_dn.min * du, b2_max: K.b2_dn.max * du,
      opisanie: 'a — от неподвижной опоры до сварного шва компенсатора; b1, b2 — от сварного шва компенсатора до первой и второй скользящих опор' };
    var kM = alpha * (0.5 * (t1 + t0) - tMont);
    var dL = kM * X.Lu;
    if (dL < 0) { dL = 0.0; }
    var tabl = [], tm, kk, d;
    for (i = 0; i < TMS.length; i++) {
      tm = TMS[i];
      kk = alpha * (0.5 * (t1 + t0) - tm);
      if (tm < t0 || tm >= t1) { continue; }
      d = kk * X.Lu;
      if (d < 0) { d = 0.0; }
      tabl.push({ t_mont: tm, k: rnd(kk, 6), dL: rnd(d, 6), L_mont: rnd(k.L + d, 6) });
    }
    var kt = null, tab = null, row;
    if (t1 === 150) { tab = D.tab14; }
    if (t1 === 70) { tab = D.tab15; }
    if (tab !== null) {
      row = tab.rows[kanon(t0)];
      if (row !== undefined && row !== null) {
        for (i = 0; i < tab.tmont.length; i++) { if (tab.tmont[i] === tMont) { kt = nul(row[i]); } }
      }
    }
    res.rastyazhka = { t_mont: tMont, k: rnd(kM, 6), dL: rnd(dL, 6), L_mont: rnd(k.L + dL, 6), L_postavki: k.L, amp: k.amp,
      tablica: tabl, Kt_tabl: kt, ne_rastyagivat: dL <= 0 };
    var lt = [], r;
    for (i = 0; i < T0S.length; i++) {
      r = [];
      for (j = 0; j < T1S.length; j++) { r.push(rnd(K.k_hod.v * k.hod / (alpha * (T1S[j] - T0S[i])),6)); }
      lt.push(r);
    }
    res.Lm_tablica = { t1: T1S, t0: T0S, rows: lt };

    /* ---- 6. спецификация ---- */
    var spec = [], poz = 1, zamTxt = '';
    if (k.zamena_pn) { zamTxt = '; исполнение PN 2,5 МПа'; }
    spec.push({ poz: poz, razdel: 'Компенсаторы', pb: k.pb, oboznachenie: k.des, naimenovanie:
      'Компенсатор сильфонный осевой (сильфонное компенсационное устройство) СКУ.М, PN ' + fmt(k.pn_izd / 10.0, 1) + ' МПа, DN ' + fmt0(k.du) +
      ', ход 2λ = ' + fmt0(k.hod) + ' мм, патрубки ' + fmt0(k.d_nar) + '×' + fmt(k.s, 1) + ' мм',
      kol: n, ed: 'шт.', massa: k.massa, slug: k.slug, primechanie: 'по одному на участок' + zamTxt, rol: 'kompensator' });
    poz += 1;
    var obe = n > 1 && noP.pb === noK.pb;
    function noNaim(o) {
      if (o.vid === 'korpusnaya') {
        return 'Опора неподвижная ' + (o.code === 'ТС-670' ? 'хомутовая' : 'бугельная') + ' с корпусом, Dн ' + fmt0(o.d_nar) + ', Q = ' + fmt0(o.q) + ' кН, H = ' + fmt0(o.h) + ' мм';
      }
      if (o.vid === 'upornaya') {
        return o.title + ', Dн ' + fmt0(o.d_nar) + ', Q = ' + fmt0(o.q) + ' кН';
      }
      return 'Опора неподвижная щитовая' + (o.code === 'ТС-667' ? ' усиленная' : '') + ', Dн ' + fmt0(o.d_nar) + ', Q = ' + fmt0(o.q) + ' кН';
    }
    spec.push({ poz: poz, razdel: 'Опоры трубопровода', pb: noK.pb, oboznachenie: noK.des, naimenovanie: noNaim(noK),
      kol: obe ? n + 1 : 2, ed: 'шт.', massa: noK.massa, slug: noK.slug,
      primechanie: obe ? 'концевые и промежуточные' : 'концевые', rol: 'no_koncevaya' });
    res.opory_nepodvizhnye.koncevye.poz = poz;
    if (n > 1) {
      if (!obe) {
        poz += 1;
        spec.push({ poz: poz, razdel: 'Опоры трубопровода', pb: noP.pb, oboznachenie: noP.des, naimenovanie: noNaim(noP),
          kol: n - 1, ed: 'шт.', massa: noP.massa, slug: noP.slug, primechanie: 'промежуточные', rol: 'no_promezhutochnaya' });
      }
      res.opory_nepodvizhnye.promezhutochnye.poz = poz;
    }
    poz += 1;
    spec.push({ poz: poz, razdel: 'Опоры трубопровода', pb: sk.pb, oboznachenie: sk.des,
      naimenovanie: 'Опора скользящая приварная, Dн ' + fmt0(dNar) + ', H = ' + fmt0(sk.h) + ' мм, L = ' + fmt0(sk.l) + ' мм',
      kol: 2 * n, ed: 'шт.', massa: sk.massa, slug: sk.slug,
      primechanie: 'у компенсатора; в пролёте — дополнительно, по проекту привязки', rol: 'skolzyashchaya' });
    res.opory_skolzyashchie.poz = poz;
    var otv = null;
    for (i = 0; i < D.otvody.length; i++) {
      o = D.otvody[i];
      if (o.d_nar === dNar && o.t === stenka) {
        if (otv === null || o.pb < otv.pb) { otv = o; }
      }
    }
    res.otvod = null;
    if (otv !== null) {
      poz += 1;
      spec.push({ poz: poz, razdel: 'Детали трубопровода', pb: otv.pb, oboznachenie: otv.des,
        naimenovanie: 'Отвод крутоизогнутый 90° ' + otv.des + ', сталь 20', kol: null, ed: 'шт.', massa: otv.massa, slug: otv.slug,
        primechanie: 'количество — по проекту привязки', rol: 'otvod' });
      res.otvod = { pb: otv.pb, oboznachenie: otv.des, slug: otv.slug, d_nar: otv.d_nar, t: otv.t, du: nul(otv.du), f: nul(otv.f),
        r: nul(otv.r), massa: otv.massa, poz: poz, step: nul(otv.step), png: nul(otv.png) };
    }
    var massa = 0.0;
    for (i = 0; i < spec.length; i++) {
      s = spec[i];
      if (s.kol !== null) { massa += s.kol * s.massa; }
    }
    res.spec = spec;
    res.massa_itogo = rnd(massa, 2);

    /* ---- 7. предупреждения ---- */
    if (prinyato.indexOf('dlina') >= 0) {
      pred.push(msg('W_DLINA', 'Длина участка не задана: принята наибольшая для одного компенсатора — ' + fmt(X.Lm, 2) + ' м.'));
    }
    if (n > 1) {
      pred.push(msg('W_UCHASTKI', 'Длина ' + fmt0(X.L) + ' м больше наибольшей для одного компенсатора (' + fmt(X.Lm, 2) + ' м): участок разделён на ' +
        fmt0(n) + ' равных по ' + fmt(X.Lu, 2) + ' м, между ними — промежуточные неподвижные опоры.'));
      pred.push(msg('W_PNO', 'Промежуточные неподвижные опоры подобраны по методике производителя компенсаторов — для равных участков одного диаметра, ' +
        'работающих одновременно. Если участки испытываются или вводятся в работу по отдельности, промежуточная опора работает как концевая ' +
        '(нагрузка ' + fmt(X.Pkno_prov, 1) + ' кН) — тогда её принимают такой же, как концевую.'));
    }
    if (k.zamena_pn) {
      pred.push(msg('W_PN_IZD', 'В каталоге нет СКУ.М DN ' + fmt0(du) + ' на PN 1,6 МПа: принято исполнение PN 2,5 МПа (размеры и масса по данным производителя ' +
        'у обоих исполнений одинаковые). Нагрузки посчитаны для давления трубопровода ' + fmt(pn, 1) + ' МПа.'));
    }
    if (k.dn50_stroka !== undefined && k.dn50_stroka !== null) {
      pred.push(msg('W_DN50', 'Для DN 50 в таблицах методики производителя по две строки; эффективная площадь и жёсткость для хода ' + fmt0(k.hod) +
        ' мм приняты по порядку строк. Требует подтверждения инженером.'));
    }
    if (stenka !== k.s) {
      pred.push(msg('W_STENKA', 'Стенка трубы ' + fmt0(stenka) + ' мм отличается от стенки патрубков компенсатора (' + fmt0(k.s) +
        ' мм). Стык труб разной толщины — по проекту привязки.'));
    }
    if (stenka > noK.s || (n > 1 && stenka > noP.s)) {
      pred.push(msg('W_S_OPORY', 'В таблице неподвижной опоры указана стенка трубы S = ' + fmt0(noK.s) + ' мм, стенка трубы узла — ' + fmt0(stenka) +
        ' мм. Графа S принята как наименьшая толщина стенки, при которой действует несущая способность опоры. ' +
        'Требует подтверждения инженером.'));
    }
    var spis = (n > 1 && noP.pb !== noK.pb) ? [noK, noP] : [noK], tp;
    for (i = 0; i < spis.length; i++) {
      o = spis[i];
      if (o.pary.length > 1) {
        tp = '';
        for (j = 0; j < o.pary.length; j++) {
          p = o.pary[j];
          tp += (tp !== '' ? '; ' : '') + 'при стенке трубы от ' + fmt0(p.s) + ' мм — ' + fmt0(p.q) + ' кН';
        }
        pred.push(msg('W_PARY', 'У опоры ' + o.des + ' несущая способность зависит от стенки трубы: ' + tp + '. Для стенки ' + fmt0(stenka) +
          ' мм принято ' + fmt0(o.q) + ' кН.'));
      }
    }
    var upor = null, tu;
    if (noK.vid === 'upornaya') {
      upor = noK;
    } else if (n > 1 && noP.vid === 'upornaya') {
      upor = noP;
    }
    if (upor !== null) {
      tu = 'Подобрана упорная неподвижная опора ' + upor.des + ': упоры приваривают к трубе, осевую силу они передают на балки опорной конструкции, ' +
        'которая охватывает трубу. Эта конструкция в комплект не входит — её проектирует и рассчитывает проектировщик привязки на осевую нагрузку ' +
        fmt(upor === noK ? X.Pkno_prov : X.Ppno, 1) + ' кН. Вертикальную и боковую нагрузку упорная опора не воспринимает: труба опирается на нижнюю балку конструкции.';
      if (upor.q_bez_upornyh !== null) {
        tu += ' Опоры с корпусом и щитовые для этого диаметра не проходят по несущей способности (наибольшая ' + fmt0(upor.q_bez_upornyh) + ' кН).';
      }
      pred.push(msg('W_UPOR', tu));
    }
    if (noK.vid === 'shchitovaya' || (n > 1 && noP.vid === 'shchitovaya')) {
      pred.push(msg('W_SHCHIT', 'Подобрана щитовая неподвижная опора: её ставят в железобетонной стенке канала или камеры с проёмом под трубу. ' +
        'Стенку рассчитывает проектировщик привязки.'));
    }
    if (zap !== null && zap < 0.1 * noK.q) {
      pred.push(msg('W_ZAPAS', 'Запас несущей способности концевой неподвижной опоры меньше 10 %: ' + fmt(X.Pkno, 1) + ' кН при допустимых ' +
        fmt0(noK.q) + ' кН. Дополнительные нагрузки объекта могут потребовать другой опоры.'));
    }
    if (prinyato.indexOf('izolyaciya_kg_m') >= 0) {
      pred.push(msg('W_IZOL', 'Вес изоляции не задан: сила трения посчитана для трубы с водой без изоляции. Запас концевой опоры допускает дополнительный вес до ' +
        fmt(res.nagruzki.dq_dop / grav, 0) + ' кг на метр трубы.'));
    }
    if (t0 < PR.t0_uglerod.v) {
      pred.push(msg('W_T0_STAL', 'Расчётная температура наружного воздуха ниже минус 30 °С: опоры изготавливают из низколегированной стали ' +
        '(серия 5.903-13, технические требования, п. 3.3); размеры опор не меняются. Укажите это при заказе.'));
    }
    if (t1 > 170 || t0 < -40) {
      pred.push(msg('W_SILFON', 'Материальное исполнение сильфона и патрубков уточняется при заказе: ' +
        'температура теплоносителя выше 170 °С или наружного воздуха ниже минус 40 °С.'));
    }
    if (res.rastyazhka.ne_rastyagivat) {
      pred.push(msg('W_RAST0', 'При заданной температуре монтажа компенсатор растяжке не подлежит (по методике производителя компенсаторов).'));
    }

    /* ---- 8. что остаётся проектировщику привязки ---- */
    res.ostaetsya_proektirovshchiku = [
      'Расчёт трубопровода на прочность (СП 124.13330.2012, п. 10.1).',
      'Проверка устойчивости трубопровода и необходимость направляющих опор вместо скользящих у компенсатора (СП 124.13330.2012, п. 10.37). ' +
      'Направляющие опоры в комплект не входят.',
      'Проверка живучести системы при надземной прокладке (по методике производителя компенсаторов).',
      'Шаг скользящих опор в пролёте и их количество — расчёт на прочность и по допускаемому прогибу (СП 124.13330.2012, п. 10.5); вертикальные нагрузки на опоры.',
      'Вес тепловой изоляции, пригруз, ветровая, гололёдная и снеговая нагрузки в формуле удельной силы трения, если они не заданы в исходных данных.',
      'Силы от углов поворота и участков самокомпенсации, боковые нагрузки на неподвижные опоры при поворотах и ответвлениях.',
      'Нагрузки на промежуточные неподвижные опоры при разных диаметрах или длинах смежных участков.',
      'Расчётные температуры, температура монтажа и материал трубы для конкретного объекта; значение коэффициента линейного расширения.',
      'Опорные строительные конструкции под неподвижные и скользящие опоры, закладные детали, узлы приварки.',
      'Тепловая изоляция, защитный кожух компенсатора при надземной прокладке (СП 124.13330.2012, п. 10.29), антикоррозионная защита.',
      'Высота опор по толщине изоляции: исполнения 100, 150, 200 мм; для неподвижных и скользящих опор участка — одинаковая.'
    ];
    if (upor !== null) {
      res.ostaetsya_proektirovshchiku.push('Опорная конструкция из балок для упорной неподвижной опоры (рама вокруг трубы): схема, расчёт на осевую нагрузку, ' +
        'опирание трубы на нижнюю балку, зазоры по альбому серии 5.903-13 вып. 7-95.');
    }
    res.ok = true;
    return res;
  }

  /* Подсказки для квиза по мере ввода: что доступно для уже выбранных значений. Ничего не подбирает. */
  function podskazka(tz, D) {
    D = D || root.KONSTR;
    var K = D.konst, PR = D.predely, i, j, t, k, o, v, pns, Lm;
    var r = { truby: [], dn_ok: false, pn_dostupny: [], stenka_po_umolchaniyu: null, stenki_opor: [], Lm: null, hod: null, L_min: null,
      vysoty_opor: K.h_opory.dopustimo, t1_max: PR.t1_max.v, t0_min: PR.t0_min.v, dlina_max: PR.dlina_max.v,
      t_mont_po_umolchaniyu: 10, versiya_dannyh: D.versiya };
    if (tz === null || typeof tz !== 'object') { tz = {}; }
    var dNar = nul(tz.dn_truby), pn = nul(tz.pn), t1 = nul(tz.t1), t0 = nul(tz.t0), prokladka = nul(tz.prokladka);
    var truba = null;
    function numSort(a, b) { return a - b; }
    for (i = 0; i < D.truby.length; i++) {
      t = D.truby[i];
      pns = [];
      for (j = 0; j < D.kompensatory.length; j++) {
        k = D.kompensatory[j];
        v = k.pn === 16 ? 1.6 : 2.5;
        if (k.d_nar === t.d_nar && pns.indexOf(v) < 0) { pns.push(v); }
      }
      pns.sort(numSort);
      r.truby.push({ d_nar: t.d_nar, du: t.du, stenka: t.s, pn: pns });
      if (isNum(dNar) && t.d_nar === dNar) { truba = t; r.pn_dostupny = pns; }
    }
    if (truba === null) { return r; }
    r.dn_ok = true;
    r.stenka_po_umolchaniyu = truba.s;
    var ss = [];
    for (i = 0; i < D.opory_nepodvizhnye.length; i++) {
      o = D.opory_nepodvizhnye[i];
      if (o.d_nar !== dNar) { continue; }
      if (o.vid === 'shchitovaya' && prokladka === 'nadzemnaya') { continue; }
      for (j = 0; j < o.pary.length; j++) { if (ss.indexOf(o.pary[j].s) < 0) { ss.push(o.pary[j].s); } }
    }
    ss.sort(numSort);
    r.stenki_opor = ss;
    if (isNum(pn) && (pn === 1.6 || pn === 2.5) && isNum(t1) && isNum(t0) && t1 > t0) {
      var pnKod = pn === 1.6 ? 16 : 25;
      for (i = 0; i < D.kompensatory.length; i++) {
        k = D.kompensatory[i];
        if (k.d_nar === dNar && k.pn === pnKod) {
          Lm = K.k_hod.v * k.hod / (K.alpha.v * (t1 - t0));
          if (r.Lm === null || Lm > r.Lm) {
            r.Lm = rnd(Lm, 6);
            r.hod = k.hod;
            r.L_min = rnd((K.a_dn.v * truba.du + k.L + K.b2_dn.v * truba.du) / 1000.0, 6);
          }
        }
      }
    }
    return r;
  }
  podbor.podskazka = podskazka;
  podbor.versiya = VERSIYA_DVIZHKA;
  podbor.ogovorka = OGOVORKA;
  root.podbor = podbor;
}(typeof window !== 'undefined' ? window : this));
