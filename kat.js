/* тестовая выкладка: модели и ролики лежат в соседних репозиториях */
function GB(s) { return (/^komp-(ks|kso|ksof)$/.test(s) ? '/katalog-test-gif-a/' : '/katalog-test-gif-b/') + 'gif/'; }
/* Общий движок каталога ПРОМБУРГ: данные window.KAT (лёгкий индекс), карточки категорий догружаются из data/c/<slug>.js,
   маршруты по #, 3D-просмотр, таблицы, заявка. Вид задаёт window.VARIANT = { id, home(el), card(cat, item), group(g) } до подключения файла. */
(function () {
  'use strict';
  var K = window.KAT, V = window.VARIANT || {};
  var ASSETS = K.base, OPORY = K.step_base;
  var PRINT = /[?&]print=1/.test(location.search);
  var ONLY = (location.search.match(/[?&]g=([\w-]+)/) || [])[1];
  var VIEWS = [['atlas', 'Атлас', 'atlas.html', 'закупщику'], ['spravochnik', 'Справочник', 'spravochnik.html', 'проектировщику'], ['uzel', 'Трасса', 'uzel.html', 'инженеру']];
  var FNS = [['shchitovaya', 'Закрепить в проходе через стенку', 'неподвижная щитовая, боковая'], ['nepodvizhnaya', 'Закрепить трубу', 'неподвижная хомутовая, упорная, бугельная'],
    ['skolzyashchaya', 'Дать трубе скользить', 'скользящая'], ['napravlyayushchaya', 'Направить вдоль оси', 'направляющая'], ['katkovaya', 'Снизить трение на большом диаметре', 'катковая'],
    ['podvesnaya', 'Подвесить трубу', 'подвеска жёсткая или пружинная'], ['prochee', 'Детали и узлы опор', 'подушки, прокладки, блоки, крепления'],
    ['detali', 'Собрать трубопровод', 'отводы, переходы, фланцы, заглушки, тройники'],
    ['kompensator', 'Принять тепловое удлинение', 'компенсаторы сильфонные и резиновые']];
  var unit = 'кН';
  window.KATC = window.KATC || {};

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(v) { return typeof v === 'number' ? String(v).replace('.', ',') : (v == null || v === '' ? '—' : esc(v)); }
  function load(v, sw) {
    if (typeof v !== 'number') return num(v);
    if (unit === 'кН' || sw === false) return num(v);
    var t = v / 9.80665; return num(Math.round(t * (t < 10 ? 100 : 10)) / (t < 10 ? 100 : 10));
  }
  function rub(v) { return typeof v === 'number' ? v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : num(v); }
  function plural(n, a, b, c) { var m = n % 100, k = n % 10; return n + ' ' + (m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c); }
  function range(a, f) { f = f || num; return !a ? '—' : a[0] === a[1] ? f(a[0]) : f(a[0]) + '–' + f(a[1]); }
  function catBy(key) { for (var i = 0; i < K.cats.length; i++) if (K.cats[i].slug === key || K.cats[i].code === key) return K.cats[i]; }
  function groupBy(id) { return K.groups.filter(function (g) { return g.id === id; })[0]; }
  // ссылка «Скачать раздел в PDF»: раздел берётся из адреса (страница раздела или карточка типа из него)
  function pdfSec() {
    var p = location.hash.replace('#/', '').split('/'), c = p[0] === 'c' && catBy(decodeURIComponent(p[1] || '')), g = p[0] === 'g' ? groupBy(p[1]) : c ? groupBy(c.g) : null;
    [].forEach.call(document.querySelectorAll('a.pdf-sec'), function (a) {
      a.hidden = !g || !window.VARIANT || !VARIANT.id; if (a.hidden) return;
      a.href = 'pdf/katalog-promburg-atlas-' + g.id + '.pdf';     // PDF раздела один на все три вида (решение Ольги 10.10.2026) a.textContent = 'Скачать раздел «' + g.title.split(' (')[0] + '» в PDF';
    });
  }
  window.addEventListener('hashchange', function () { setTimeout(pdfSec, 60); }); window.addEventListener('load', function () { setTimeout(pdfSec, 300); setTimeout(pdfSec, 1500); });
  function catsOf(gid) { return K.cats.filter(function (c) { return c.g === gid; }); }
  function href(route) { return PRINT ? '#p-' + route.replace(/^\//, '').replace(/[^\wа-яА-ЯёЁ-]+/g, '-') : '#' + route; }
  function catLink(code, text) {
    var c = catBy(code);
    return c ? '<a class="xl" href="' + href('/c/' + c.slug) + '">' + esc(text || code) + '</a>' : esc(text || code);
  }
  // перелинковка: обозначения типов в тексте становятся ссылками на карточки
  var CODE_RE = new RegExp('(^|[^0-9A-Za-zА-Яа-яЁё-])(' + K.cats.map(function (c) { return c.code; }).sort(function (a, b) { return b.length - a.length; })
    .map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![0-9A-Za-zА-Яа-яЁё]|-\\d)', 'g');
  // названия нормативных документов становятся ссылками на официальную публикацию
  var DOC_RE = new RegExp('(' + Object.keys(K.docs).map(function (c) { return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?![0-9])', 'g');
  function docLinks(html) { return html.replace(DOC_RE, function (m) { var d = K.docs[m]; return '<a class="xl doc" href="' + d[0] + '" target="_blank" rel="nofollow noopener" title="' + esc(d[1]) + '">' + m + '</a>'; }); }
  function linkify(text, self) { return docLinks(esc(text).replace(CODE_RE, function (m, pre, code) { return pre + (code === self ? code : catLink(code)); })); }

  /* ---------- догрузка данных ---------- */
  function script(src, ok, fail) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail || function () {}; document.head.appendChild(s); }
  function loadCat(slug, cb) { if (window.KATC[slug]) return cb(window.KATC[slug]); script('data/c/' + slug + '.js?v=' + K.v, function () { cb(window.KATC[slug]); }); }
  var itemsWait = null;
  function loadItems(cb) {
    if (window.KATI) return cb(window.KATI);
    if (itemsWait) return itemsWait.push(cb);
    itemsWait = [cb]; script('data/items.js?v=' + K.v, function () { itemsWait.forEach(function (f) { f(window.KATI); }); itemsWait = null; });
  }
  function itemIn(cat, pb) { for (var j = 0; j < cat.items.length; j++) if (cat.items[j].pb === pb) return cat.items[j]; }
  function maxOf(cat, key) { var m = 0; cat.items.forEach(function (i) { [i.v].concat(i.alt).forEach(function (v) { if (typeof v[key] === 'number' && v[key] > m) m = v[key]; }); }); return m; }
  function fullName(cat, item) { return (cat.nm || item.nm || cat.title) + ' ' + item.des; }

  var LOGO = '<svg class="logo-mark" viewBox="0 0 120 120" aria-hidden="true"><polygon points="116,60 88,108.5 32,108.5 4,60 32,11.5 88,11.5" fill="var(--logo-bg)"/><path d="M30 84V38H54V84" fill="none" stroke="var(--logo-fg)" stroke-width="9"/><path d="M94 38H68V84H82A12.5 12.5 0 0 0 82 59H68" fill="none" stroke="var(--acc)" stroke-width="9"/></svg>';
  function logo() { return '<a class="logo" href="index.html" title="Выбор вида каталога">' + LOGO + '<span><b>ПРОМБУРГ</b><i>каталог продукции</i></span></a>'; }

  /* ---------- заявка: общая для трёх видов, хранит снимок позиции ---------- */
  var spec = {};
  try { spec = JSON.parse(localStorage.getItem('pbSpec2') || '{}'); } catch (e) {}
  function saveSpec() { try { localStorage.setItem('pbSpec2', JSON.stringify(spec)); } catch (e) {} $$('[data-spec-count]').forEach(function (n) { var c = Object.keys(spec).length; n.textContent = c; n.hidden = !c; }); }
  function specRows() { return Object.keys(spec).map(function (pb) { var r = spec[pb]; r.pb = pb; return r; }); }
  function stdOrd(cat) { return /^Собственная конструкция/.test(cat.std || '') ? '' : cat.std; }   // в строку заказа идёт документ, а не пометка о собственной конструкции
  function specText() { return specRows().map(function (r, i) { return (i + 1) + '. ' + r.name + (r.std ? ', ' + r.std : '') + (r.dn ? ', Dн ' + r.dn + ' мм' : '') + ', код ' + r.pb + ' — ' + r.qty + ' шт.'; }).join('\n'); }
  function addSpec(pb) {
    if (spec[pb]) { spec[pb].qty++; return saveSpec(); }
    var done = function (cat) { var it = itemIn(cat, pb); if (!it) return; spec[pb] = { qty: 1, slug: cat.slug, des: it.des, name: fullName(cat, it), std: stdOrd(cat), dn: it.dn, mass: typeof it.v.mass === 'number' ? it.v.mass : null, price: typeof it.v.price === 'number' ? it.v.price : null, art: it.sh ? it.sh[2] : null }; saveSpec(); };
    if (curCat && itemIn(curCat, pb)) return done(curCat);
    loadItems(function (I) { for (var i = 0; i < I.length; i++) if (I[i][2] === pb) return loadCat(K.cats[I[i][0]].slug, done); });
  }
  function download(name, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  function copy(text, btn) {
    var done = function () { if (!btn) return; var t = btn.textContent; btn.textContent = 'Скопировано'; setTimeout(function () { btn.textContent = t; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
  }

  /* ---------- 3D ---------- */
  var Viewer = (function () {
    var T = window.THREE, renderer, scene, camera, controls, current, radius = 100, seq = 0, host, showPipe = true, raf, failed = !T;
    var AZ = 38 * Math.PI / 180, EL = 24 * Math.PI / 180;
    function init() {
      if (renderer || failed) return;
      try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { failed = true; return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = T.sRGBEncoding;
      scene = new T.Scene();
      scene.environment = new T.PMREMGenerator(renderer).fromScene(new T.RoomEnvironment(), 0.04).texture;
      scene.add(new T.HemisphereLight(0xffffff, 0x8a94a0, 0.22));
      camera = new T.PerspectiveCamera(28, 1, 1, 100000);
      var key = new T.DirectionalLight(0xffffff, 0.42); camera.add(key); key.position.set(-0.6, 0.8, 1); scene.add(camera);
      controls = new T.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.autoRotate = true; controls.autoRotateSpeed = 1.1;
      controls.enableZoom = false;
      renderer.domElement.addEventListener('pointerdown', function () { setAuto(false); controls.enableZoom = true; });
      renderer.domElement.addEventListener('pointerleave', function () { controls.enableZoom = false; });
      window.addEventListener('resize', resize);
    }
    function setAuto(on) { if (!controls) return; controls.autoRotate = on; var b = host && $('[data-v=auto]', host); if (b) b.classList.toggle('on', on); }
    function resize() {
      if (!host || !renderer) return; var st = $('.v3d-stage', host), w = st.clientWidth, h = st.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    function reset() {
      var fov = camera.fov * Math.PI / 180, fit = radius / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * camera.aspect)) / 2);
      controls.target.set(0, 0, 0);
      camera.position.set(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL)).multiplyScalar(fit * 0.84);
      camera.near = fit / 100; camera.far = fit * 20; camera.updateProjectionMatrix();
      controls.minDistance = radius * 0.3; controls.maxDistance = fit * 6; controls.update();
    }
    function loop() { raf = requestAnimationFrame(loop); if (!host || !host.isConnected) { cancelAnimationFrame(raf); raf = 0; return; } controls.update(); renderer.render(scene, camera); }
    function pipe() { if (current) current.traverse(function (o) { var g = o.userData.role === 'pipe' || o.userData.role === 'context' || o.userData.ghost; if (g && (o.isMesh || o.isLineSegments)) o.visible = showPipe; }); }
    function attach(el) {
      host = el; init();
      if (failed) { el.classList.add('no3d'); return; }
      $('.v3d-stage', el).appendChild(renderer.domElement);
      $$('[data-v]', el).forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-v');
          if (k === 'reset') reset();
          if (k === 'auto') setAuto(!controls.autoRotate);
          if (k === 'pipe') { showPipe = !showPipe; b.classList.toggle('on', showPipe); pipe(); }
        };
      });
      resize(); if (!raf) loop();
    }
    function parse(buf, my, el, id) {
      new T.GLTFLoader().parse(buf, '', function (gltf) {
        if (my !== seq) return;
        if (current) { scene.remove(current); current.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
        current = gltf.scene;
        var meshes = []; current.traverse(function (o) { if (o.isMesh) meshes.push(o); });
        meshes.forEach(function (o) {
          var ghost = o.userData.role === 'pipe' || o.userData.role === 'context';
          if (ghost) { o.material.depthWrite = false; o.renderOrder = 2; }
          o.material.envMapIntensity = ghost ? 0.3 : 0.22;
          if (!ghost) { o.material.metalness = 0.1; o.material.roughness = 0.62; }
          var ln = new T.LineSegments(new T.EdgesGeometry(o.geometry, 28), new T.LineBasicMaterial({ color: ghost ? 0x8a949d : 0x0b1c29, transparent: true, opacity: ghost ? 0.6 : 0.75 }));
          ln.userData.ghost = ghost; ln.renderOrder = ghost ? 3 : 1; o.add(ln);
        });
        scene.add(current);
        radius = new T.Box3().setFromObject(current).getSize(new T.Vector3()).length() / 2;
        pipe(); resize(); reset();
        el.classList.remove('loading'); el.classList.add('live'); document.body.setAttribute('data-3d', id);
      }, function () { el.classList.remove('loading'); });
    }
    function show(id) {
      if (failed || !host || !id) return;
      var my = ++seq, el = host, url = (id.indexOf('uslovnye/') === 0 ? '/katalog-test-3d-a/' : '/katalog-test-3d-b/') + 'assets/3d/' + id.split('/').map(encodeURIComponent).join('/') + '.glb'; el.classList.add('loading');
      window.OPORY_GLB = window.OPORY_GLB || {};
      // на сайте — обычная загрузка .glb; с диска (file://) — через .glb.js с base64
      if (location.protocol !== 'file:') {
        fetch(url).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (b) { if (my === seq) parse(b, my, el, id); }).catch(function () { el.classList.remove('loading'); });
        return;
      }
      function ready() {
        if (my !== seq) return;
        var bin = atob(window.OPORY_GLB[id]), u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        parse(u8.buffer, my, el, id);
      }
      if (window.OPORY_GLB[id]) return ready();
      script(url + '.js', ready, function () { el.classList.remove('loading'); });
    }
    return { attach: attach, show: show };
  })();

  /* ---------- значки типов для позиций без модели ---------- */
  var GLYPH = {
    nepodvizhnaya: '<path d="M38 30a22 22 0 0 1 44 0v30h12v34H26V60h12z"/><path d="M36 66l48 24M84 66L36 90"/>',
    shchitovaya: '<rect x="50" y="14" width="20" height="92"/><path d="M10 60h100" stroke-width="12"/><path d="M40 40l40 40M80 40L40 80"/>',
    skolzyashchaya: '<circle cx="60" cy="38" r="24"/><path d="M42 62h36v14h10v10H32V76h10z"/><path d="M16 96h88"/>',
    katkovaya: '<circle cx="60" cy="34" r="22"/><path d="M34 58h52v8H34z"/><circle cx="46" cy="76" r="8"/><circle cx="74" cy="76" r="8"/><path d="M16 88h88v10H16z"/>',
    napravlyayushchaya: '<circle cx="60" cy="50" r="22"/><path d="M26 22v72M94 22v72M16 94h88"/>',
    podvesnaya: '<path d="M14 14h92"/><path d="M60 14v44"/><circle cx="60" cy="82" r="22"/><path d="M38 76a22 22 0 0 1 44 0"/>',
    prochee: '<path d="M60 12l42 24v48l-42 24-42-24V36z"/><circle cx="60" cy="60" r="16"/>',
    kompensator: '<path d="M8 46h26M86 46h26M8 74h26M86 74h26"/><path d="M34 46v-10h8v48h8V36h8v48h8V36h8v48h8V74"/><path d="M34 74v10"/>',
    detali: '<path d="M22 100V62a40 40 0 0 1 40-40h38"/><path d="M48 100V68a14 14 0 0 1 14-14h38"/><path d="M14 100h42M100 14v48"/>'
  };
  function glyph(fn) { return '<svg class="glyph" viewBox="0 0 120 120" aria-hidden="true">' + (GLYPH[fn] || GLYPH.prochee) + '</svg>'; }
  function thumb(c, big) { var src = big ? c.png : c.thumb; return src ? '<img src="' + ASSETS + src + '" alt="" loading="lazy">' : glyph(c.fn); }

  /* ---------- блоки карточки ---------- */
  var ui = {};
  ui.viewer = function (cat, item) {
    if (!item.model) {
      if (cat.png) return '<div class="v3d nomodel tip' + (PRINT ? ' print' : '') + '" data-slot="viewer"><img class="v3d-tip" src="' + ASSETS + cat.png + '" alt=""><span class="wm"></span>' +
        '<div class="v3d-usl">Типовой вид изделий этого типа. Размеры исполнения — по запросу</div></div>';
      return '<div class="v3d nomodel' + (PRINT ? ' print' : '') + '" data-slot="viewer">' + (cat.schema ? '<img class="v3d-flat" src="' + cat.schema + '" alt="">' : glyph(cat.fn)) +
        '<span class="wm"></span>' + (PRINT ? '' : '<div class="v3d-hint">3D-модель этой позиции готовится. Размеры — в таблице исполнений</div>') + '</div>';
    }
    var png = ASSETS + item.png;
    if (PRINT) return '<div class="v3d print"><img src="' + (cat.pimg || png) + '" alt=""><span class="wm"></span>' + (item.usl ? '<div class="v3d-usl">Модель условная: общий вид по габаритам</div>' : '') + '</div>';
    return '<div class="v3d" data-slot="viewer"><div class="v3d-stage"><img class="v3d-poster" src="' + png + '" alt="' + esc(cat.title) + '"></div><span class="wm"></span>' +
      '<div class="v3d-bar"><button data-v="reset">Сбросить вид</button><button data-v="auto" class="on">Автоповорот</button><button data-v="pipe" class="on">Труба</button>' +
      (item.models ? item.models.map(function (m, i) { return '<button data-model="' + esc(m.id) + '"' + (i ? '' : ' class="on"') + '>' + m.label + '</button>'; }).join('') : '') + '</div>' +
      (item.usl ? '<div class="v3d-usl">Модель условная: показывает общий вид по габаритам, не для производства</div>' : '') +
      '<div class="v3d-hint">3D-модель: вращение — левой кнопкой, масштаб — колесом после щелчка по модели</div></div>';
  };
  var ARROW = { q: '<line x1="14" y1="40" x2="66" y2="40"/><path d="M58 34l10 6-10 6z"/>', t: '<line x1="96" y1="58" x2="64" y2="26"/><path d="M62 36l-1-13 13 1z"/>', p: '<line x1="40" y1="8" x2="40" y2="32"/><path d="M34 26l6 10 6-10z"/>' };
  ui.loadsLegend = function (cat) {
    var ls = cat.params.filter(function (p) { return p.ld && maxOf(cat, p.key); }).slice(0, 3);
    return '<div class="loads">' + ls.map(function (p) {
      var a = ARROW[p.key.charAt(0) === 'q' ? 'q' : p.key === 't' ? 't' : 'p'];
      return '<div class="load"><svg viewBox="0 0 110 70"><ellipse cx="40" cy="48" rx="26" ry="9" class="lp"/><g class="la">' + a + '</g></svg><div><b>' + esc(p.name) + '</b><span>до ' + load(maxOf(cat, p.key), !!p.sw) + ' ' + (p.sw ? unit : esc(p.unit)) + '</span></div></div>';
    }).join('') + '</div>';
  };
  ui.facts = function (cat) {
    var rows = cat.std ? [['Документ', cat.std]] : [];
    if (cat.stdn) rows.push(['Статус документа', cat.stdn + ' Изделие изготавливается по прежнему обозначению.']);
    if (cat.dn) rows.unshift(['Диаметр трубы Dн', range(cat.dn) + ' мм']);
    rows.push(['Исполнений', cat.n]);
    if (cat.mass) rows.push(['Масса', range(cat.mass) + ' кг']);
    if (cat.price && !PRINT) rows.push(['Цена в магазине', range(cat.price, rub) + ' ₽']);
    if (cat.steel) rows.push(['Сталь', cat.steel]);
    if (cat.coat) rows.push(['Покрытие', cat.coat]);
    rows.push(['3D-модели', (cat.m ? (cat.m === cat.n ? 'у всех исполнений' : 'у ' + cat.m + ' из ' + cat.n + ' исполнений') : cat.tip ? 'типовой вид; размеры исполнения — по запросу' : 'готовятся') + (cat.items.some(function (i) { return i.usl; }) ? ' (условные: общий вид по габаритам)' : '')]);
    return '<dl class="facts">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + docLinks(esc(r[1])) + '</dd>'; }).join('') + '</dl>';
  };
  ui.about = function (cat) {
    var t = cat.text, b = [['use', 'Где применяется'], ['how', 'Как монтируется'], ['diff', 'Чем отличается от соседних типов']].filter(function (x) { return t[x[0]]; });
    if (!b.length) return '';
    return '<div class="about n' + b.length + '">' + b.map(function (x) { return '<div' + (x[0] === 'diff' ? ' class="diff"' : '') + '><h4>' + x[1] + '</h4><p>' + linkify(t[x[0]], cat.code) + '</p></div>'; }).join('') + '</div>';
  };
  function sameDn(cat, item) { return cat.items.filter(function (i) { return i.dn === item.dn && i.tb === item.tb; }); }
  function variantLabel(cat, item, same) {
    if (same.length < 2) return 'единственное';
    var keys = cat.params.filter(function (p) { return p.key !== 'mass' && p.key !== 'dn' && !p.pr && same.some(function (i) { return i.v[p.key] !== same[0].v[p.key]; }); }).slice(0, 2);
    if (keys.some(function (p) { return p.key === 'h'; })) keys = keys.filter(function (p) { return p.key === 'h'; });
    return keys.length ? keys.map(function (p) { return p.h.replace('Стенка ', '') + ' ' + num(item.v[p.key]); }).join(', ') : item.des;
  }
  /* компенсаторы: выбор по Ду, давлению, ходу и длине вместо списка одинаковых «исполнений» */
  var STUP = [['ser', 'Серия'], ['du', 'Ду, мм'], ['pn', 'Давление, кгс/см²'], ['hod', 'Ход, мм'], ['l', 'Длина L, мм']];
  function stupVal(i, k) { var x = k === 'du' ? i.du : i.v[k]; return x == null ? '' : x; }
  function stupeni(cat) {
    if (cat.g !== 'kompensatory' || cat.params.some(function (p) { return p.key === 'isp'; }) || cat.items.some(function (i) { return i.du == null; })) return null;
    return STUP.filter(function (f) { return cat.items.some(function (i) { return stupVal(i, f[0]) !== stupVal(cat.items[0], f[0]); }); });
  }
  function stupRest(cat, item, fs) { return cat.items.filter(function (i) { return fs.every(function (f) { return stupVal(i, f[0]) === stupVal(item, f[0]); }); }); }
  function stupLabel(i, rest) {
    var p = rest[0].des, t;
    rest.forEach(function (r) { var n = 0; while (n < p.length && n < r.des.length && p[n] === r.des[n]) n++; p = p.slice(0, n); });
    if (!rest.some(function (r) { return r.des === p; })) p = p.slice(0, p.lastIndexOf(', ') + 1);
    t = i.des.slice(p.length).replace(/^[,\s]+/, '') || (rest.some(function (r) { return r.v.vid === 'НЖ'; }) ? 'углеродистая сталь' : 'базовое');
    return t + (i.v.nal ? ' · ' + i.v.nal : '');
  }
  function stupPick(cat, item) {
    var fs = stupeni(cat); if (!fs) return null;
    var h = fs.map(function (f, n) {
      var pool = stupRest(cat, item, fs.slice(0, n)), vals = [];
      pool.forEach(function (i) { var x = stupVal(i, f[0]); if (vals.indexOf(x) < 0) vals.push(x); });
      if (typeof vals[0] === 'number') vals.sort(function (a, b) { return a - b; });
      if (f[0] === 'l') vals = vals.filter(function (x) { return stupPrio(pool, f[0], x); }).concat(vals.filter(function (x) { return !stupPrio(pool, f[0], x); }));   // позиции с приоритетом показа — первыми
      return '<label>' + f[1] + '<select data-pick="st" data-st="' + n + '">' + vals.map(function (x) { return '<option value="' + esc(x) + '"' + (x === stupVal(item, f[0]) ? ' selected' : '') + '>' + (x === '' ? '—' : num(x)) + '</option>'; }).join('') + '</select></label>';
    }).join('');
    var rest = stupRest(cat, item, fs);
    rest = rest.filter(function (i) { return i.v.prio; }).concat(rest.filter(function (i) { return !i.v.prio; }));
    if (rest.length > 1) h += '<label class="wide">Исполнение<select data-pick="pb">' + rest.map(function (i) { return '<option value="' + i.pb + '"' + (i === item ? ' selected' : '') + '>' + esc(stupLabel(i, rest)) + '</option>'; }).join('') + '</select></label>';
    return '<div class="order-pick st">' + h + '</div>';
  }
  function stupChange(cat, item, n, val) {
    var fs = stupeni(cat), pool = stupRest(cat, item, fs.slice(0, n)).filter(function (i) { return String(stupVal(i, fs[n][0])) === val; });
    fs.slice(n + 1).forEach(function (f) { var m = pool.filter(function (i) { return stupVal(i, f[0]) === stupVal(item, f[0]); }); if (m.length) pool = m; });
    return pool.filter(function (i) { return i.v.prio; })[0] || pool[0];
  }
  function stupPrio(pool, k, x) { return pool.some(function (i) { return i.v.prio && stupVal(i, k) === x; }); }
  ui.order = function (cat, item) {
    var dns = []; cat.items.forEach(function (i) { if (i.dn != null && dns.indexOf(i.dn) < 0) dns.push(i.dn); });
    var same = sameDn(cat, item), full = fullName(cat, item) + (stdOrd(cat) ? ', ' + stdOrd(cat) : '');
    var pick = '';
    if (!PRINT && stupeni(cat)) pick = stupPick(cat, item);
    else if (!PRINT) {
      pick = '<div class="order-pick">' + (dns.length > 1 ? '<label>Dн, мм<select data-pick="dn">' + dns.map(function (d) { return '<option' + (d === item.dn ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></label>' : '') +
        '<label>Исполнение<select data-pick="pb">' + (dns.length > 1 ? same : cat.items).map(function (i) { return '<option value="' + i.pb + '"' + (i === item ? ' selected' : '') + '>' + esc(dns.length > 1 ? variantLabel(cat, i, same) : i.des) + '</option>'; }).join('') + '</select></label></div>';
    }
    return '<div class="order" data-slot="order"><h4>Обозначение для заказа</h4>' + pick +
      '<div class="order-out"><code>' + esc(full) + '</code><div class="order-pb">Код ПРОМБУРГ <b>' + item.pb + '</b></div></div>' +
      '<ol class="decode"><li><b>' + esc(item.des) + '</b> — обозначение по документу' + (item.dn ? ', Dн ' + esc(item.dn) + ' мм' : '') + (same.length > 1 && !stupeni(cat) ? ', ' + esc(variantLabel(cat, item, same)) : '') + '</li><li><b>' + item.pb + '</b> — код ПРОМБУРГ: тип, Dн, номер исполнения</li></ol>' +
      (item.v.price != null && !PRINT ? '<div class="order-price"><b>' + rub(item.v.price) + ' ₽</b><span>цена магазина promburg.ru' + (item.sh && item.sh[2] ? ', артикул ' + esc(item.sh[2]) : '') + '</span></div>' : '') +
      (!PRINT && K.resh && K.resh[item.pb] ? K.resh[item.pb].map(function (r) { return '<a class="resh" href="' + esc(r[1]) + '"><b>Типовое решение узла с этим изделием</b><span>' + esc(r[0].replace(/^Типовое решение узла:\s*/, '')) + '</span></a>'; }).join('') : '') +
      (!PRINT && KONSTR_CODES.indexOf(cat.code) >= 0 ? '<a class="resh konstr" href="konstruktor.html?pb=' + encodeURIComponent(item.pb) + '"><b>Собрать узел с этим изделием</b><span>Конструктор подберёт компенсатор и опоры на участок по вашим данным и покажет спецификацию</span></a>' : '') +
      (PRINT ? '' : '<div class="order-act"><button class="btn" data-copy="' + esc(full + ', код ' + item.pb) + '">Скопировать</button><button class="btn acc" data-add="' + item.pb + '">В заявку</button>' +
        (item.sh && item.sh[0] ? '<a class="btn" href="' + esc(item.sh[0]) + '" target="_blank" rel="noopener">Купить в магазине</a>' : '') + '</div>') + '</div>';
  };
  ui.files = function (cat, item) {
    var h = '<div class="files" data-slot="files"><h4>Файлы исполнения ' + esc(item.des) + '</h4>';
    if (item.model) h += (K.step && !item.usl ? '<a href="' + OPORY + encodeURI(item.step) + '" download>3D-модель STEP</a>' : '') + '<a href="' + ASSETS + item.png + '" target="_blank">Изображение</a>';
    if (cat.schema) h += '<a href="' + cat.schema + '" target="_blank">Габаритная схема</a>';
    if (!PRINT) h += '<a href="t/' + cat.slug + '.html">Страница типа</a>';
    return h + (item.box && !item.usl ? '<span>Габарит ' + item.box.join(' × ') + ' мм</span>' : '') + (!item.model && !cat.schema ? '<span>Модель и чертёж — по запросу</span>' : '') + '</div>';
  };
  ui.schema = function (cat) {
    if (!cat.schema) return '';
    return '<figure class="schema"><div class="schema-img"><img src="' + cat.schema + '" alt="Габаритная схема ' + esc(cat.code) + '"><span class="wm"></span></div>' + (cat.text.note ? '<figcaption>' + esc(cat.text.note) + '</figcaption>' : '') + '</figure>';
  };
  ui.kit = function (cat) {
    if (!cat.text.kit) return '';
    return '<div class="kit"><h4>Состав комплекта на одну опору</h4><table>' + cat.text.kit.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table></div>';
  };
  ui.table = function (cat, item) {
    var hasLoad = cat.params.some(function (p) { return p.sw; }), byKey = {}; cat.params.forEach(function (p) { byKey[p.key] = p; });
    var dns = []; cat.items.forEach(function (i) { (i.dl || [i.dn]).forEach(function (d) { if (d != null && dns.indexOf(d) < 0) dns.push(d); }); });
    var h = '<div class="tbl-wrap" data-slot="table"><div class="tbl-tools">' +
      (PRINT || dns.length < 2 ? '<span></span>' : '<div class="chips"><span>Dн:</span><button class="chip on" data-dn="">все</button>' + dns.map(function (d) { return '<button class="chip" data-dn="' + esc(d) + '">' + esc(d) + '</button>'; }).join('') + '</div>') +
      (hasLoad && !PRINT ? '<div class="units"><button class="chip' + (unit === 'кН' ? ' on' : '') + '" data-unit="кН">кН</button><button class="chip' + (unit === 'тс' ? ' on' : '') + '" data-unit="тс">тс</button></div>' : '') + '</div>';
    cat.tables.forEach(function (tb) {
      var rows = cat.items.filter(function (i) { return i.tb === tb.n; }); if (!rows.length) return;
      var ord = function (p) { return p.key === 'dn' ? 0 : p.key === 's' ? 1 : p.ld ? 2 : /^mass/.test(p.key) ? 4 : 3; };
      var cols = tb.params.map(function (k) { return byKey[k]; }).filter(function (c) { return c && !(PRINT && c.pr); }).sort(function (a, b) { return ord(a) - ord(b); });
      if (tb.title) h += '<h5 class="tbl-title">' + esc(tb.title) + '</h5>';
      h += '<div class="tbl-scroll"><table class="tbl' + (cols.length > 8 ? ' wide' : '') + (cols.length > 10 ? ' xwide' : '') + '"><thead><tr><th>Обозначение</th><th>Код ПРОМБУРГ</th>' + cols.map(function (c) {
        return '<th class="' + (c.ld ? 'c-load' : c.pr ? 'c-price' : '') + '" title="' + esc(c.label) + '">' + esc(c.h) + '<small>' + (c.sw ? unit : esc(c.unit || '')) + '</small></th>';
      }).join('') + (PRINT ? '' : '<th></th>') + '</tr></thead><tbody>';
      rows.forEach(function (i) {
        h += '<tr data-pb="' + i.pb + '" data-rdn="' + esc((i.dl || [i.dn]).join(' ')) + '"' + (item && i === item ? ' class="sel"' : '') + (PRINT ? ' id="' + href('/c/' + cat.slug + '/' + i.pb).slice(1) + '"' : '') + '><td class="des">' + (i.model && !PRINT ? '<i class="has3d" title="Есть 3D-модель"></i>' : '') + esc(i.des) + (i.fix.length ? '<sup title="' + esc(i.fix.join('; ')) + '">*</sup>' : '') + '</td><td class="pb">' + i.pb + '</td>' +
          cols.map(function (c) {
            var f = c.ld ? function (v) { return load(v, !!c.sw); } : c.pr ? rub : num, v = f(i.v[c.key]);
            i.alt.forEach(function (a) { if (a[c.key] != null) v += ' / ' + f(a[c.key]); });
            return '<td class="' + (c.ld ? 'c-load' : c.pr ? 'c-price' : '') + '">' + v + '</td>';
          }).join('') + (PRINT ? '' : '<td><button class="add" data-add="' + i.pb + '" title="Добавить в заявку">+</button></td>') + '</tr>';
      });
      h += '</tbody></table></div>';
    });
    if (cat.items.some(function (i) { return i.fix.length; })) h += '<p class="tbl-note">' + (PRINT ? '* Значение уточнено по рабочим чертежам серии или смежным таблицам документа.' : '* Значение уточнено по рабочим чертежам серии; что именно — в подсказке при наведении на звёздочку.') + '</p>';
    if (cat.items.some(function (i) { return i.alt.length; })) h += '<p class="tbl-note">Два значения через дробь — исполнение рассчитано на две толщины стенки трубы.</p>';
    if (cat.m && cat.m < cat.n && !PRINT) h += '<p class="tbl-note"><i class="has3d"></i> — у исполнения есть 3D-модель.</p>';
    return h + '</div>';
  };
  ui.related = function (cat) {
    if (!cat.related.length) return '';
    return '<div class="related"><h4>Связанные позиции</h4><ul>' + cat.related.map(function (r) {
      return '<li><span>' + esc(r.kind) + '</span>' + catLink(r.code, r.code + (r.title ? ' — ' + r.title.replace(/^Опора /, '') : '')) + (r.note ? '<i>' + esc(r.note) + '</i>' : '') + '</li>';
    }).join('') + '</ul></div>';
  };
  ui.faqItem = function (f, open) {
    return '<details class="faq-i" id="' + (PRINT ? href('/faq/' + f.id).slice(1) : 'faq-' + f.id) + '"' + (open || PRINT ? ' open' : '') + '><summary><span class="who" title="П — чаще спрашивает проектировщик, З — закупщик">' + f.who + '</span>' + esc(f.q) + '</summary><p>' + linkify(f.a) + '</p></details>';
  };
  // вопросы карточки: заданные в тексте категории либо общий набор по функции опоры
  var KONSTR_CODES = ['СКУМИ', 'ТС-670', 'ТС-671', 'ТС-666', 'ТС-667', 'ТС-661', 'ТС-664', 'ТС-623', 'ТС-624'];   // изделия, из которых собирает узел конструктор (konstruktor.html)
  var FAQ_FN = { nepodvizhnaya: [1, 2, 7, 9, 11, 30], shchitovaya: [1, 2, 8, 9, 11, 30], skolzyashchaya: [1, 4, 7, 13, 22, 36], katkovaya: [1, 4, 7, 13, 22, 36], napravlyayushchaya: [1, 7, 13, 22, 36], podvesnaya: [7, 10, 22, 26, 36], prochee: [7, 22, 26, 36], detali: [211, 203, 207, 212, 36], kompensator: [104, 101, 102, 114, 115, 110, 36] };
  ui.faqFor = function (cat) {
    var ids = cat.text.faq || FAQ_FN[cat.fn] || [];
    return '<div class="faq-for"><h4>Частые вопросы по этой позиции</h4>' + K.faq.filter(function (f) { return ids.indexOf(f.id) >= 0; }).map(function (f) { return ui.faqItem(f); }).join('') +
      '<a class="more" href="' + href('/faq') + '">Все вопросы и ответы</a></div>';
  };
  ui.tasks = function (fn) {
    return '<table class="tasks"><thead><tr><th>Задача</th><th>Тип опоры</th><th>Обозначение</th></tr></thead><tbody>' + K.tasks.filter(function (t) { return !fn || t.fn === fn; }).map(function (t) {
      return '<tr><td>' + esc(t.task) + '</td><td>' + esc(t.type) + '</td><td>' + t.codes.map(function (c) { return catLink(c); }).join(' ') + '</td></tr>';
    }).join('') + '</tbody></table>';
  };
  ui.matrix = function (m) {
    var dns = []; m.rows.forEach(function (f) { Object.keys(f.rows).forEach(function (d) { if (dns.indexOf(+d) < 0) dns.push(+d); }); }); dns.sort(function (a, b) { return a - b; });
    var h = '<div class="tbl-scroll"><table class="matrix"><thead><tr><th>Тип опоры</th>' + dns.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr></thead><tbody>';
    m.rows.forEach(function (f) {
      h += '<tr><th>' + catLink(f.code) + '<small>' + esc(f.title.replace(/^Опор[аы] (неподвижн\S+ )?/, '')) + '</small></th>' + dns.map(function (d) {
        var r = f.rows[d]; if (!r) return '<td></td>';
        var lvl = Math.min(5, Math.max(1, Math.ceil(Math.log(Math.max(r.max, 1.1)) / Math.log(10) * 1.4)));
        var txt = (r.min !== r.max && !PRINT ? load(r.min) + '–' : '') + load(r.max);
        return '<td class="m' + lvl + '"><a href="' + href('/c/' + f.slug + '/' + r.pb) + '" title="' + esc(f.code + ', Dн ' + d + ': ' + f.ln + ' ' + txt + ' ' + unit) + '">' + txt + '</a></td>';
      }).join('') + '</tr>';
    });
    var names = []; m.rows.forEach(function (f) { if (names.indexOf(f.ln) < 0) names.push(f.ln); });
    return h + '</tbody></table></div><p class="tbl-note">В ячейке — допускаемая нагрузка, ' + unit + ' (' + esc(names.join('; ')) + '). Насыщенность цвета растёт с нагрузкой. Столбцы — наружный диаметр трубы Dн, мм.</p>';
  };
  ui.groups = function () {
    return '<div class="groups">' + K.groups.filter(function (g) { return g.cats; }).map(function (g) {
      return '<a class="group" href="' + href('/g/' + g.id) + '" style="--c:' + g.color + '"><b>' + (g.n < 10 ? '0' : '') + g.n + '</b><h4>' + esc(g.title) + '</h4><p>' + esc(g.short) + '</p><span>' + plural(g.cats, 'тип', 'типа', 'типов') + ' · ' + plural(g.items, 'позиция', 'позиции', 'позиций') + (g.m ? ' · 3D' : '') + '</span></a>';
    }).join('') + '</div>';
  };
  // плитки категорий: изображение или значок, название, диапазоны
  ui.tiles = function (cats) {
    return '<div class="tiles">' + cats.map(function (c) {
      return '<a class="tile" href="' + href('/c/' + c.slug) + '"><div class="tile-img' + (c.thumb ? '' : ' flat') + '"><span class="tile-code" style="background:' + c.color + '">' + esc(c.code) + '</span>' + thumb(c) + (c.thumb ? '<span class="wm"></span>' : '') + (c.m ? '<span class="tile-3d">3D</span>' : '') + '</div><div class="tile-body"><h3>' + esc(c.title) + '</h3><p>' + esc(c.lead) + '</p>' +
        '<div class="tile-nums"><div><b>' + (c.dn ? range(c.dn) : '—') + '</b><span>Dн, мм</span></div>' + (c.price && !PRINT ? '<div><b>от ' + rub(c.price[0]) + '</b><span>цена, ₽</span></div>' : (c.kn ? '<div><b>до ' + num(c.kn[1]) + '</b><span>нагрузка, кН</span></div>' : '')) + '<div><b>' + c.n + '</b><span>' + plural(c.n, 'исполнение', 'исполнения', 'исполнений').replace(/^\d+ /, '') + '</span></div></div></div></a>';
    }).join('') + '</div>';
  };
  // строки категорий: компактный список для справочника и подбора
  ui.rows = function (cats) {
    return '<div class="crows">' + cats.map(function (c) {
      return '<a class="crow" href="' + href('/c/' + c.slug) + '"><span class="crow-img">' + thumb(c) + '</span><span class="crow-t"><em style="color:' + c.color + '">' + esc(c.sec + ' · ' + c.code) + '</em><b>' + esc(c.title) + '</b><i>' + esc(c.std) + '</i></span><span class="crow-n"><b>' + (c.dn ? range(c.dn) : '—') + '</b>Dн, мм</span><span class="crow-n"><b>' + (c.price && !PRINT ? 'от ' + rub(c.price[0]) : c.kn ? 'до ' + num(c.kn[1]) : '—') + '</b>' + (c.price && !PRINT ? '₽' : 'кН') + '</span><span class="crow-n"><b>' + c.n + '</b>исп.</span></a>';
    }).join('') + '</div>';
  };
  // подбор исполнений по индексу: o = { fn, g, slug, dn, kn } -> строки [категория, обозначение, код, Dн, нагрузка кН, масса]
  function hasDn(d, dn) { return Array.isArray(d) ? d.indexOf(+dn) >= 0 : String(d) === String(dn); }
  function dnText(d) { return Array.isArray(d) ? d.join(', ') : num(d); }
  ui.find = function (o, cb) {
    loadItems(function (I) {
      var out = [];
      for (var i = 0; i < I.length; i++) {
        var r = I[i], c = K.cats[r[0]];
        if ((o.fn && c.fn !== o.fn) || (o.g && c.g !== o.g) || (o.slug && c.slug !== o.slug) || (o.dn && !hasDn(r[3], o.dn)) || (o.kn && !(r[4] >= o.kn))) continue;
        out.push(r);
      }
      cb(out);
    });
  };
  ui.itemRows = function (rows, limit) {
    if (!rows.length) return '';
    return '<div class="tbl-scroll" style="max-height:420px"><table class="tbl"><thead><tr><th>Обозначение</th><th>Код ПРОМБУРГ</th><th style="text-align:left">Тип</th><th>Dн<small>мм</small></th><th class="c-load">Нагрузка<small>кН</small></th><th>Масса<small>кг</small></th><th></th></tr></thead><tbody>' +
      rows.slice(0, limit).map(function (r) { var c = K.cats[r[0]]; return '<tr data-go="/c/' + c.slug + '/' + r[2] + '"><td class="des">' + esc(r[1]) + '</td><td class="pb">' + r[2] + '</td><td style="text-align:left;white-space:normal">' + esc(c.code + ' · ' + c.title) + '</td><td>' + dnText(r[3]) + '</td><td class="c-load">' + num(r[4]) + '</td><td>' + num(r[5]) + '</td><td><button class="add" data-add="' + r[2] + '" title="Добавить в заявку">+</button></td></tr>'; }).join('') +
      '</tbody></table></div>' + (rows.length > limit ? '<p class="tbl-note">Показано ' + limit + ' из ' + rows.length + '. Уточните диаметр, нагрузку или тип.</p>' : '');
  };
  // перелинковка по диаметру: что ещё есть в каталоге на трубу того же Dн — детали для опоры, опоры для детали
  // ряды диаметров у деталей и опор записаны по-разному (42,4 и 42,25; 48,3 и 48; 60,3 и 60) — совпадением считается разница до 0,6 мм
  function nearDn(d, dn) { return (Array.isArray(d) ? d : [d]).some(function (x) { return typeof x === 'number' && Math.abs(x - dn) <= 0.6; }); }
  // блок «Как работает»: ролик с направлениями компенсации для выбранного исполнения
  function fillHow() {
    var old = $('[data-slot=how]', view); if (old) old.remove();
    if (PRINT || !curCat || !curItem || !curItem.gif) return;
    var anchor = $('[data-slot=table]', view), sec = anchor && (anchor.closest('.c-sec') || anchor.closest('.sec')); if (!sec) return;
    var src = GB(curCat.slug) + encodeURIComponent(curCat.slug) + '/' + encodeURIComponent(typeof curItem.gif === 'string' ? curItem.gif : curItem.pb.replace('/', '-')) + '.gif';
    sec.insertAdjacentHTML(sec.classList.contains('sec') ? 'afterend' : 'beforebegin', '<div class="' + sec.className.split(' ')[0] + ' how" data-slot="how"><h4>Как работает</h4>' +
      '<div class="how-in"><img src="' + src + '" alt="Как работает ' + esc(curItem.des) + ': направления компенсации" loading="lazy" width="600" height="600">' +
      '<p>На ролике показано, в каких направлениях компенсатор принимает перемещения трубопровода. Движение увеличено для наглядности; величины — в таблице исполнений. Модель условная.</p></div></div>');
  }
  function fillSameDn() {
    var old = $('[data-slot=samedn]', view); if (old) old.remove();
    if (PRINT || !curCat || !curItem) return;
    var dns = (curItem.dl || [curItem.dn]).filter(function (d) { return typeof d === 'number'; }); if (!dns.length) return;
    var anchor = $('[data-slot=table]', view), sec = anchor && (anchor.closest('.c-sec') || anchor.closest('.sec')); if (!sec) return;
    var mine = curCat, pbNow = curItem.pb;
    loadItems(function (I) {
      if (!curItem || curItem.pb !== pbNow) return;
      var by = {}, order = [];
      for (var i = 0; i < I.length; i++) {
        var r = I[i], c = K.cats[r[0]]; if (c.slug === mine.slug) continue;
        if (!dns.some(function (d) { return nearDn(r[3], d); })) continue;
        if (!by[c.slug]) { by[c.slug] = { c: c, n: 0, pb: r[2] }; order.push(c.slug); }
        by[c.slug].n++;
      }
      var chips = function (list) {
        return list.map(function (k) { var x = by[k]; return '<a class="sd-chip" href="#/c/' + x.c.slug + '/' + x.pb + '" style="--c:' + x.c.color + '"><b>' + esc(x.c.code) + '</b><span>' + esc(x.c.title.replace(/^Опор[аы] /, '')) + '</span><i>' + x.n + ' исп.</i></a>'; }).join('');
      };
      var cls = function (c) { return c.fn === 'detali' ? 'd' : c.fn === 'kompensator' ? 'k' : 'o'; }, my = cls(mine);
      var title = { o: ['Опоры и подвески', 'Другие опоры'], d: ['Детали трубопровода', 'Другие детали'], k: ['Компенсаторы', 'Другие компенсаторы'] };
      var seq = ['o', 'd', 'k'].filter(function (x) { return x !== my; }).concat([my]), any = false;
      var h = '<div class="' + sec.className.split(' ')[0] + ' samedn" data-slot="samedn"><h4>На трубу Dн ' + esc(dns.join(', ')) + ' мм в каталоге</h4>';
      seq.forEach(function (x) {
        var list = order.filter(function (k) { return cls(by[k].c) === x; }); if (!list.length) return; any = true;
        var lim = x === my ? 10 : 14;
        h += '<div class="sd-row"><span>' + title[x][x === my ? 1 : 0] + '</span><div>' + chips(list.slice(0, lim)) + (list.length > lim ? '<span class="sd-more">и ещё ' + (list.length - lim) + ' типов — подбор по Dн в «Справочнике»</span>' : '') + '</div></div>';
      });
      if (!any) return;
      sec.insertAdjacentHTML(sec.classList.contains('sec') ? 'afterend' : 'beforebegin', h + '</div>');   // в справочнике таблица идёт первой — блок ставится под неё
    });
  }
  ui.search = function () { return '<div class="search"><input type="search" placeholder="Обозначение, код ПБ или Dн" aria-label="Поиск по каталогу"><div class="search-res" hidden></div></div>'; };
  ui.specBtn = function () { return '<a class="spec-btn" href="' + href('/spec') + '">Заявка<span data-spec-count hidden>0</span></a>'; };
  ui.views = function () {
    return '<div class="views" title="Вид каталога">' + VIEWS.map(function (v) { return '<a href="' + v[2] + '" data-view="' + v[0] + '"' + (v[0] === V.id ? ' class="on"' : '') + ' title="Вид для того, кто ближе к роли: ' + v[3] + '">' + v[1] + '</a>'; }).join('') + '</div>';
  };
  ui.contacts = function () {
    var b = K.brand;
    return '<div class="contacts"><div>' + LOGO + '</div><div><b>' + esc(b.name) + '</b><span>' + esc(b.addr) + ' · ' + esc(b.hours) + '</span></div><div><a href="tel:' + b.phone.replace(/[^+\d]/g, '') + '">' + b.phone + '</a><a href="mailto:' + b.email + '">' + b.email + '</a><a href="' + b.site_url + '" target="_blank" rel="noopener">' + b.site + '</a></div><div class="built">' + (PRINT ? '' : '<a href="t/index.html">Все типы списком</a>') + (PRINT || !V.id ? '' : '<a class="pdf-sec" target="_blank" hidden></a><a href="pdf/katalog-promburg-' + V.id + '.pdf" target="_blank">Скачать каталог в PDF</a>') + 'Редакция каталога от ' + K.built + '</div></div>';
  };
  ui.logo = logo; ui.catLink = catLink; ui.linkify = linkify; ui.href = href; ui.load = load; ui.num = num; ui.range = range; ui.maxOf = maxOf; ui.esc = esc;
  ui.catBy = catBy; ui.catsOf = catsOf; ui.groupBy = groupBy; ui.loadItems = loadItems; ui.thumb = thumb; ui.glyph = glyph; ui.FNS = FNS; ui.PRINT = PRINT; ui.base = ASSETS;
  ui.unit = function () { return unit; };
  ui.heroOf = function (cat) { return itemIn(cat, cat.hero); };
  window.KATUI = ui;

  /* ---------- общие страницы ---------- */
  function pageFaq(openId) {
    var topics = []; K.faq.forEach(function (f) { if (topics.indexOf(f.topic) < 0) topics.push(f.topic); });
    return '<section class="page"><h1>Частые вопросы</h1><p class="lead">Ответы опираются на рабочие чертежи серии 5.903-13, ' + docLinks('СП 124.13330.2012') + ' и ГОСТ 22130-2018. Метка у вопроса: П — чаще спрашивает проектировщик, З — закупщик.</p>' +
      topics.map(function (t) { return '<h3>' + esc(t) + '</h3>' + K.faq.filter(function (f) { return f.topic === t; }).map(function (f) { return ui.faqItem(f, String(f.id) === String(openId)); }).join(''); }).join('') + '</section>';
  }
  function pageGlossary() {
    return '<section class="page"><h1>Словарь</h1><p class="lead">Термины каталога простыми словами.</p><dl class="glossary">' + K.glossary.map(function (g) { return '<dt>' + esc(g[0]) + '</dt><dd>' + linkify(g[1]) + '</dd>'; }).join('') + '</dl></section>';
  }
  function pageGroup(g) {
    var cs = catsOf(g.id), m = K.matrix.filter(function (x) { return x.g === g.id; })[0];
    return '<section class="page wide"><div class="kicker" style="color:' + g.color + '">РАЗДЕЛ ' + (g.n < 10 ? '0' : '') + g.n + '</div><h1>' + esc(g.title) + '</h1><p class="lead">' + esc(g.short) + ' В разделе ' + g.cats + ' типов, ' + g.items + ' исполнений.</p>' +
      (V.id === 'atlas' ? ui.tiles(cs) : ui.rows(cs)) + (m ? '<h3>Матрица подбора: тип × Dн</h3>' + ui.matrix(m) : '') + '<p class="tbl-note"><a class="xl" href="t/g-' + g.id + '.html">Раздел одной страницей, списком</a></p></section>';
  }
  // категории под заказ: таблицы исполнений нет, подбор по опросному листу
  function zakazOf(gid) { return (K.zakaz || []).filter(function (z) { return z.g === gid; }); }
  function zakazBy(slug) { return (K.zakaz || []).filter(function (z) { return z.slug === slug; })[0]; }
  function zakazBlock(g) {
    var zs = zakazOf(g.id); if (!zs.length) return '';
    return '<section class="page wide zak-list"><h3>Под заказ</h3><p class="lead">В таблицах раздела этих изделий нет: исполнение подбирается по опросному листу.</p><div class="tiles">' + zs.map(function (z) {
      return '<a class="tile" href="' + href('/z/' + z.slug) + '"><div class="tile-img"><span class="tile-code" style="background:' + z.color + '">' + esc(z.code) + '</span>' + (z.img ? '<img src="' + GB('_') + z.img + '" alt="' + esc(z.title) + '" loading="lazy">' : '') + '<span class="tile-3d">под заказ</span></div><div class="tile-body"><h3>' + esc(z.title) + '</h3><p>' + esc(z.lead) + '</p></div></a>';
    }).join('') + '</div></section>';
  }
  function pageZakaz(z) {
    var b = K.brand, pre = PRINT ? b.site_url.replace(/\/$/, '') + '/katalog/' : '', f = K.faq.filter(function (x) { return x.id === 113; })[0];
    var mail = 'mailto:' + b.email + '?subject=' + encodeURIComponent('Заявка: ' + z.title) + '&body=' + encodeURIComponent('Прошу подобрать исполнение и сообщить цену и срок.\n\n' + z.grafy.map(function (x) { return x.charAt(0).toUpperCase() + x.slice(1) + ':'; }).join('\n') + '\n');
    return '<section class="page zak"><div class="kicker" style="color:' + z.color + '">ПОД ЗАКАЗ · ' + esc(z.code) + '</div><h1>' + esc(z.title) + '</h1><p class="lead">' + esc(z.lead) + '</p>' +
      '<div class="how-in">' + (z.gif ? '<img src="' + GB('_') + (PRINT ? z.img : z.gif) + '" alt="Как работает ' + esc(z.title) + ': направления компенсации" width="600" height="600">' : '<span></span>') +
      '<div class="zak-in"><h4>Виды</h4><table class="tbl zak-vidy"><thead><tr><th style="text-align:left">Исполнение</th><th style="text-align:left">Что компенсирует</th></tr></thead><tbody>' +
      z.vidy.map(function (v) { return '<tr><td style="text-align:left;white-space:normal">' + esc(v[0]) + '</td><td style="text-align:left;white-space:normal">' + esc(v[1]) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h4>Что указать в заявке</h4><p>' + esc(z.grafy.join(', ')) + '. Полный перечень — в опросном листе.</p>' +
      '<div class="order-act">' + (z.list_docx ? '<a class="btn acc" href="' + pre + z.list_docx + '"' + (PRINT ? '' : ' download') + '>Опросный лист (Word)</a>' : '') + (z.list_pdf ? '<a class="btn" href="' + pre + z.list_pdf + '" target="_blank">Опросный лист (PDF)</a>' : '') + (PRINT ? '' : '<a class="btn" href="' + mail + '">Отправить заявку письмом</a>') + '</div>' +
      '<p>Заполненный лист отправьте на <a class="xl" href="mailto:' + b.email + '">' + b.email + '</a> или сообщите данные по телефону ' + b.phone + '.</p></div></div>' +
      '<p class="tbl-note">Ролик показывает принцип работы: модель условная, типовая, движение увеличено для наглядности. Размеры, перемещения и масса определяются при подборе.</p>' +
      (f && !PRINT ? '<h3>Частый вопрос</h3>' + ui.faqItem(f, true) : '') + '</section>';
  }
  function pageSpec() {
    var rows = specRows();
    if (!rows.length) return '<section class="page"><h1>Заявка</h1><p class="lead">Список пуст. Добавляйте позиции кнопкой «+» в таблицах исполнений — здесь соберётся спецификация для запроса цены. Заявка общая для всех трёх видов каталога.</p></section>';
    return '<section class="page"><h1>Заявка</h1><p class="lead">Спецификация для запроса цены и срока. Количество можно менять.</p><div class="tbl-scroll"><table class="tbl spec"><thead><tr><th>№</th><th>Наименование</th><th>Документ</th><th>Код ПРОМБУРГ</th><th>Dн<small>мм</small></th><th>Масса<small>кг</small></th><th>Кол-во</th><th></th></tr></thead><tbody>' +
      rows.map(function (r, i) { return '<tr><td>' + (i + 1) + '</td><td class="des"><a class="xl" href="' + href('/c/' + r.slug + '/' + r.pb) + '">' + esc(r.name) + '</a></td><td>' + esc(r.std) + '</td><td class="pb">' + r.pb + '</td><td>' + num(r.dn) + '</td><td>' + num(r.mass) + '</td><td><input type="number" min="1" value="' + r.qty + '" data-qty="' + r.pb + '"></td><td><button class="add" data-del="' + r.pb + '" title="Убрать">×</button></td></tr>'; }).join('') +
      '</tbody></table></div><p class="tbl-note">Общая масса: ' + num(Math.round(rows.reduce(function (s, r) { return s + (r.mass || 0) * r.qty; }, 0) * 10) / 10) + ' кг.</p>' +
      '<div class="order-act"><button class="btn acc" data-spec="csv">Скачать для Excel</button><button class="btn" data-spec="copy">Скопировать текстом</button><a class="btn" href="mailto:' + K.brand.email + '?subject=' + encodeURIComponent('Запрос цены: опоры трубопроводов') + '&body=' + encodeURIComponent('Прошу сообщить цену и срок изготовления:\n\n' + specText() + '\n\nСтенка трубы, мм:\nРасчётная температура воздуха:\nПокрытие:\nГород доставки:\n') + '">Отправить письмом</a><button class="btn" data-spec="clear">Очистить</button></div></section>';
  }

  /* ---------- маршруты и события ---------- */
  var view, curCat, curItem, rseq = 0, BASE_TITLE = document.title;
  function showModel(item, id) {
    var p = $('.v3d-poster', view), m = item.models && item.models.filter(function (x) { return x.id === id; })[0];
    if (p) p.src = ASSETS + (m ? m.png : item.png);
    $$('[data-model]', view).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-model') === (id || item.model)); });
    Viewer.show(id || item.model);
  }
  function selectItem(pb, quiet) {
    var it = curCat && itemIn(curCat, pb); if (!it) return;
    var had = !!curItem.model; curItem = it;
    $$('[data-slot=table] tr.sel', view).forEach(function (r) { r.classList.remove('sel'); });
    var row = $('[data-slot=table] tr[data-pb="' + pb + '"]', view); if (row) row.classList.add('sel');
    ['order', 'files'].forEach(function (s) { var el = $('[data-slot=' + s + ']', view); if (el) el.outerHTML = ui[s](curCat, curItem); });
    var v = $('[data-slot=viewer]', view);
    if (v && (had !== !!it.model || it.models || $('[data-model]', v))) { v.outerHTML = ui.viewer(curCat, it); v = $('[data-slot=viewer]', view); if (it.model) Viewer.attach(v); }
    if (it.model) showModel(it);
    fillHow(); fillSameDn();
    $$('[data-cur]', view).forEach(function (n) { n.textContent = n.getAttribute('data-cur') === 'pb' ? curItem.pb : curItem.des; });
    if (!quiet) history.replaceState(null, '', '#/c/' + curCat.slug + '/' + pb);
  }
  function route() {
    var p = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/'), my = ++rseq;
    curCat = curItem = null; document.body.setAttribute('data-route', p[0] || 'home');
    document.title = BASE_TITLE; $$('.search-res').forEach(function (r) { r.hidden = true; });
    var g = p[0] === 'g' && groupBy(p[1]);
    if (p[0] === 'c' && catBy(p[1])) {
      view.innerHTML = '<section class="page"><p class="lead">Загрузка…</p></section>';
      loadCat(catBy(p[1]).slug, function (cat) {
        if (my !== rseq) return;
        curCat = cat; curItem = (p[2] && itemIn(cat, p[2])) || ui.heroOf(cat);
        view.innerHTML = V.card(cat, curItem);
        var v = $('[data-slot=viewer]', view); if (v && curItem.model) { Viewer.attach(v); Viewer.show(curItem.model); }
        fillHow(); fillSameDn();
        if (p[2]) { var row = $('tr.sel', view), sc = row && row.closest('.tbl-scroll'); if (sc) sc.scrollTop = row.offsetTop - 80; }
        document.title = cat.code + ' — ' + cat.title + ' · ПРОМБУРГ'; document.body.setAttribute('data-ready', '1');
      });
    } else if (g) view.innerHTML = (V.group ? V.group(g) : pageGroup(g)) + zakazBlock(g);
    else if (p[0] === 'z' && zakazBy(p[1])) { var zk = zakazBy(p[1]); view.innerHTML = pageZakaz(zk); document.title = zk.code + ' — ' + zk.title + ' · ПРОМБУРГ'; }
    else if (p[0] === 'faq') view.innerHTML = pageFaq(p[1]);
    else if (p[0] === 'glossary') view.innerHTML = pageGlossary();
    else if (p[0] === 'spec') view.innerHTML = pageSpec();
    else if (p[0] === 's' && p[1]) {
      var sq = p.slice(1).join('/'); view.innerHTML = '<section class="page"><p class="lead">Поиск…</p></section>'; document.title = 'Поиск: ' + sq + ' · ПРОМБУРГ';
      loadItems(function (I) { if (my !== rseq) return; view.innerHTML = pageSearch(poisk(I, sq, { groups: 8, cats: 40, items: 300 })); document.body.setAttribute('data-ready', '1'); });
    }
    else if (p[0] && p[0] !== 'home') view.innerHTML = '<section class="page"><h1>Страница не найдена</h1><p class="lead">Такого адреса в каталоге нет. Возможно, изменилось обозначение. <a class="xl" href="#/">Перейти на главную</a> или воспользуйтесь поиском.</p></section>';
    else { view.innerHTML = ''; V.home(view); }
    var key = p[0] === 'c' || p[0] === 'g' ? p[1] : p[0] || 'home', cc = (p[0] === 'c' && catBy(p[1])) || (p[0] === 'z' && zakazBy(p[1]));
    $$('[data-nav]').forEach(function (a) { var n = a.getAttribute('data-nav'); a.classList.toggle('on', n === key || !!(cc && n === cc.g)); });
    $$('[data-view]').forEach(function (a) { a.href = a.getAttribute('href').split('#')[0] + location.hash; });
    var t = p[0] === 'faq' && p[1] && document.getElementById('faq-' + p[1]);
    if (t) t.scrollIntoView(); else if (!(p[0] === 'c' && p[2])) window.scrollTo(0, 0);
    if (V.onRoute) V.onRoute(p);
    saveSpec();
  }
  function onClick(e) {
    var t = e.target, b;
    if ((b = t.closest('[data-add]'))) { var pb = b.getAttribute('data-add'); addSpec(pb); b.classList.add('done'); if (b.classList.contains('btn')) b.textContent = 'В заявке'; e.stopPropagation(); e.preventDefault(); return; }
    if ((b = t.closest('[data-go]'))) { location.hash = '#' + b.getAttribute('data-go'); return; }
    if ((b = t.closest('[data-del]'))) { delete spec[b.getAttribute('data-del')]; saveSpec(); route(); return; }
    if ((b = t.closest('[data-copy]'))) return copy(b.getAttribute('data-copy'), b);
    if ((b = t.closest('[data-model]')) && curItem) return showModel(curItem, b.getAttribute('data-model'));
    if ((b = t.closest('[data-spec]'))) {
      var k = b.getAttribute('data-spec');
      if (k === 'copy') copy(specText(), b);
      if (k === 'clear') { spec = {}; saveSpec(); route(); }
      if (k === 'csv') download('zayavka-promburg.csv', ['№;Наименование;Документ;Код ПРОМБУРГ;Dн, мм;Масса, кг;Количество'].concat(specRows().map(function (r, i) { return [i + 1, r.name, r.std, r.pb, r.dn == null ? '' : r.dn, num(r.mass), r.qty].join(';'); })).join('\r\n'));
      return;
    }
    if ((b = t.closest('[data-dn]'))) {
      var dn = b.getAttribute('data-dn'), w = b.closest('[data-slot=table]');
      $$('[data-dn]', w).forEach(function (c) { c.classList.toggle('on', c === b); });
      $$('tbody tr', w).forEach(function (r) { r.hidden = !!dn && r.getAttribute('data-rdn').split(' ').indexOf(dn) < 0; });
      return;
    }
    if ((b = t.closest('[data-unit]'))) { unit = b.getAttribute('data-unit'); var keep = curItem && curItem.pb, y = window.scrollY; route(); if (keep && curCat) selectItem(keep, true); window.scrollTo(0, y); return; }
    if ((b = t.closest('[data-slot=table] tbody tr'))) return selectItem(b.getAttribute('data-pb'));
    if (!t.closest('.search')) $$('.search-res').forEach(function (r) { r.hidden = true; });
  }
  function onChange(e) {
    var t = e.target;
    if (t.matches('[data-pick=dn]')) selectItem(curCat.items.filter(function (i) { return String(i.dn) === t.value; })[0].pb);
    else if (t.matches('[data-pick=st]')) { var si = stupChange(curCat, curItem, +t.getAttribute('data-st'), t.value); if (si) selectItem(si.pb); }
    else if (t.matches('[data-pick=pb]')) selectItem(t.value);
    else if (t.matches('[data-qty]')) { spec[t.getAttribute('data-qty')].qty = Math.max(1, parseInt(t.value, 10) || 1); saveSpec(); }
  }
  /* ---------- поиск: слова запроса в любом порядке; раскладка, знаки и окончания не мешают (эталон — _src/poisk-etalon.js) ---------- */
  var S_LAT = { a: 'а', b: 'в', c: 'с', e: 'е', f: 'ф', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у' };   // «KCO», «TC-659» набирают латиницей; в «КСОF» латинская F
  function sNorm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[a-z]/g, function (ch) { return S_LAT[ch] || ch; })
      .replace(/[×xх*]/g, 'х').replace(/[^0-9a-zа-я]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var S_STOP = { 'компенсатор': 1, 'компенсаторы': 1, 'опора': 1, 'опоры': 1, 'для': 1, 'ду': 1, 'dn': 1, 'дн': 1, 'мм': 1 };   // общие слова не сужают поиск, если есть другие
  function sTokens(q) {
    var all = sNorm(q).split(' ').filter(Boolean), strong = all.filter(function (t) { return !S_STOP[t]; });
    return (strong.length ? strong : all).map(function (t) { return /^[а-я]{6,}$/.test(t) ? t.slice(0, t.length - 2) : t; });   // «подвеска пружинная» находит «Подвески пружинные»
  }
  // число ищется целиком: «100» не должно находить «1000»
  function sHas1(hay, t) {
    if (!/^[0-9]+$/.test(t)) return hay.indexOf(t) >= 0;
    for (var i = hay.indexOf(t); i >= 0; i = hay.indexOf(t, i + 1)) if (!/[0-9]/.test(hay.charAt(i - 1)) && !/[0-9]/.test(hay.charAt(i + t.length))) return true;
    return false;
  }
  function sHas(hay, toks) { for (var i = 0; i < toks.length; i++) if (!sHas1(hay, toks[i])) return false; return true; }
  var S_TOP = ['komp-kso', 'komp-sku-m', 'komp-sku-m-iyansh', 'ts-670'];   // самые заказываемые типы: при равном совпадении идут первыми, в этом порядке
  var sCat, sGroup, sItem;
  // -> { groups, cats, zakaz, items, total }: всё, что содержит все слова запроса
  function poisk(I, q, lim) {
    var toks = sTokens(q), nq = sNorm(q), nk = toks.join(' '), res = { q: q, groups: [], cats: [], zakaz: [], items: [], total: 0 };
    if (!toks.length || nq.length < 2) return res;
    if (!sCat) {
      sGroup = {}; K.groups.forEach(function (g) { sGroup[g.id] = sNorm(g.title + ' ' + (g.short || '')); });
      sCat = K.cats.map(function (c) { return { code: sNorm(c.code), title: sNorm(c.title), hay: sNorm([c.code, c.title, c.std, c.slug].join(' ')), top: S_TOP.indexOf(c.slug) >= 0 ? S_TOP.indexOf(c.slug) : 99 }; });
    }
    if (!sItem || sItem.length !== I.length) sItem = I.map(function (r) { return [sNorm(r[1]), sNorm(r[2]) + ' ' + (r[3] == null ? '' : [].concat(r[3]).join(' '))]; });
    var lead = function (n) { return sCat[n].title.indexOf(toks[0]) === 0 || sCat[n].code.indexOf(toks[0]) === 0 ? 0 : 1; };   // слово запроса открывает название типа — выше, чем «встречается где-то»
    res.groups = K.groups.filter(function (g) { return g.cats && sHas(sGroup[g.id], toks); }).slice(0, lim.groups);
    var cats = [];
    K.cats.forEach(function (c, n) {
      var x = sCat[n]; if (!sHas(x.hay + ' ' + sGroup[c.g], toks)) return;
      cats.push([x.code === nk || x.code === nq ? 0 : x.code.indexOf(nk) === 0 ? 1 : sHas(x.hay, toks) ? 2 + lead(n) : 4, n, c]);
    });
    cats.sort(function (a, b) { return a[0] - b[0] || sCat[a[1]].top - sCat[b[1]].top || a[1] - b[1]; });
    res.cats = cats.slice(0, lim.cats).map(function (x) { return x[2]; }); res.ncats = cats.length;
    res.zakaz = (K.zakaz || []).filter(function (z) { return sHas(sNorm([z.code, z.title, z.lead, z.vidy.join(' ')].join(' ')), toks); });
    var items = [];
    for (var i = 0; i < I.length; i++) {
      var r = I[i], des = sItem[i][0];
      if (!sHas(des + ' ' + sItem[i][1] + ' ' + sCat[r[0]].hay, toks)) continue;
      items.push([des === nq ? 0 : des.indexOf(nq) === 0 ? 1 : des.indexOf(nq) >= 0 ? 2 : sHas(des, toks) ? 3 : 4 + lead(r[0]), i, r]);
    }
    items.sort(function (a, b) { return a[0] - b[0] || sCat[a[2][0]].top - sCat[b[2][0]].top || a[1] - b[1]; });
    res.total = items.length; res.items = items.slice(0, lim.items).map(function (x) { return x[2]; });
    return res;
  }
  function sQuery(t) { return t.value.trim(); }
  // куда вести по Enter: один тип — в его карточку, одна позиция — в неё, иначе на страницу результатов
  function sTarget(res) {
    if (res.ncats === 1 && !res.zakaz.length) return '/c/' + res.cats[0].slug;
    if (!res.ncats && res.zakaz.length === 1 && !res.total) return '/z/' + res.zakaz[0].slug;
    if (!res.ncats && !res.zakaz.length && res.total === 1) return '/c/' + K.cats[res.items[0][0]].slug + '/' + res.items[0][2];
    return '/s/' + encodeURIComponent(res.q);
  }
  function onSearch(e) {
    var t = e.target; if (!t.matches('.search input')) return;
    var q = sQuery(t), box = t.parentNode.querySelector('.search-res');
    if (q.length < 2) { box.hidden = true; return; }
    loadItems(function (I) {
      if (sQuery(t) !== q) return;
      var res = poisk(I, q, { groups: 3, cats: 8, items: 10 }), out = [], head = function (x) { out.push('<i class="sr-h">' + x + '</i>'); };
      if (res.groups.length) { head('Разделы'); res.groups.forEach(function (g) { out.push('<a href="#/g/' + g.id + '"><b>Раздел ' + (g.n < 10 ? '0' : '') + g.n + '</b> ' + esc(g.title) + '</a>'); }); }
      if (res.cats.length) { head('Типы'); res.cats.forEach(function (c) { out.push('<a href="#/c/' + c.slug + '"><b>' + esc(c.code) + '</b> ' + esc(c.title) + '</a>'); }); }
      if (res.zakaz.length) { head('Под заказ'); res.zakaz.forEach(function (z) { out.push('<a href="#/z/' + z.slug + '"><b>' + esc(z.code) + '</b> ' + esc(z.title) + '</a>'); }); }
      if (res.items.length) { head('Исполнения'); res.items.forEach(function (r) { out.push('<a href="#/c/' + K.cats[r[0]].slug + '/' + r[2] + '"><b>' + esc(r[1]) + '</b> ' + (r[3] ? 'Dн ' + dnText(r[3]) + ' · ' : '') + r[2] + '</a>'); }); }
      var nf = sNorm(q); K.faq.forEach(function (f) { if (out.length < 30 && sNorm(f.q).indexOf(nf) >= 0) out.push('<a href="#/faq/' + f.id + '"><b>Вопрос</b> ' + esc(f.q) + '</a>'); });
      if (res.total > res.items.length || res.ncats > res.cats.length) out.push('<a class="sr-all" href="#/s/' + encodeURIComponent(q) + '">Показать все результаты: типов ' + res.ncats + ', исполнений ' + res.total + '</a>');
      box.innerHTML = out.join('') || '<span>Ничего не найдено. Попробуйте обозначение (КСО, ТС-659), код ПБ или наружный диаметр.</span>'; box.hidden = false;
    });
  }
  function onSearchKey(e) {
    if (!e.target.matches || !e.target.matches('.search input')) return;
    var t = e.target, q = sQuery(t), box = t.parentNode.querySelector('.search-res'), links = $$('a', box), cur = links.indexOf($('a.on', box));
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && links.length && !box.hidden) {      // стрелки — по строкам списка
      e.preventDefault();
      if (cur >= 0) links[cur].classList.remove('on');
      cur = e.key === 'ArrowDown' ? (cur + 1) % links.length : (cur <= 0 ? links.length : cur) - 1;
      links[cur].classList.add('on'); links[cur].scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key !== 'Enter' || q.length < 2) return;
    e.preventDefault();
    if (cur >= 0 && !box.hidden) { location.hash = links[cur].getAttribute('href'); box.hidden = true; t.blur(); return; }   // выбранная стрелками строка
    loadItems(function (I) { location.hash = '#' + sTarget(poisk(I, q, { groups: 3, cats: 2, items: 2 })); t.blur(); });
  }
  function pageSearch(res) {
    var h = '<section class="page wide"><div class="kicker">ПОИСК</div><h1>' + esc(res.q) + '</h1>';
    if (!res.groups.length && !res.ncats && !res.zakaz.length && !res.total) return h + '<p class="lead">Ничего не найдено. Попробуйте обозначение (КСО, ТС-659), код ПБ или наружный диаметр трубы. Не нашли нужное изделие — напишите на <a class="xl" href="mailto:' + K.brand.email + '">' + K.brand.email + '</a>.</p></section>';
    h += '<p class="lead">Найдено: типов ' + res.ncats + ', исполнений ' + res.total + (res.zakaz.length ? ', под заказ ' + res.zakaz.length : '') + '.</p>';
    if (res.groups.length) h += '<h3>Разделы</h3><p class="sr-links">' + res.groups.map(function (g) { return '<a class="xl" href="' + href('/g/' + g.id) + '">' + esc(g.title) + '</a>'; }).join('') + '</p>';
    if (res.zakaz.length) h += '<h3>Под заказ</h3><p class="sr-links">' + res.zakaz.map(function (z) { return '<a class="xl" href="' + href('/z/' + z.slug) + '">' + esc(z.code + ' — ' + z.title) + '</a>'; }).join('') + '</p>';
    if (res.cats.length) h += '<h3>Типы</h3>' + ui.rows(res.cats);
    if (res.items.length) h += '<h3>Исполнения</h3>' + ui.itemRows(res.items, 300).replace('Уточните диаметр, нагрузку или тип.', 'Уточните запрос: добавьте диаметр или обозначение.');
    return h + '</section>';
  }

  /* ---------- версия для PDF: всё подряд, ссылки — внутренние якоря. ?g=<раздел> — один раздел ---------- */
  function renderPrint() {
    document.body.classList.add('print');
    var gs = K.groups.filter(function (g) { return g.cats && (!ONLY || g.id === ONLY); });
    var sub = ONLY ? gs[0].title : 'Полный каталог: ' + K.total.cats + ' типов, ' + K.total.items + ' исполнений';
    var h = '<section class="p-cover"><div class="p-cover-in">' + LOGO + '<h1>' + (ONLY ? esc(gs[0].title.replace(/\s*\(.*$/, '')) : 'Опоры, детали трубопроводов, компенсаторы') + '</h1><p>' + esc(ONLY ? 'Каталог продукции. Раздел ' + gs[0].n : sub) + '</p><div class="p-cover-foot"><b>' + esc(K.brand.name) + '</b><span>' + K.brand.phone + ' · ' + K.brand.email + ' · ' + K.brand.site + '</span></div></div></section>';
    h += '<section class="page"><h1>Содержание</h1><ol class="toc"><li><a href="#p-choose">Как выбрать опору</a></li>' + gs.map(function (g) {
      return '<li><a href="' + href('/g/' + g.id) + '">' + esc(g.title) + '</a><ol>' + catsOf(g.id).map(function (c) { return '<li><a href="' + href('/c/' + c.slug) + '">' + esc(c.code + ' — ' + c.title) + (c.dn ? ', Dн ' + range(c.dn) : '') + '</a></li>'; }).join('') + zakazOf(g.id).map(function (z) { return '<li><a href="' + href('/z/' + z.slug) + '">' + esc(z.code + ' — ' + z.title) + ', под заказ</a></li>'; }).join('') + '</ol></li>';
    }).join('') + '<li><a href="#p-faq">Частые вопросы</a></li><li><a href="#p-glossary">Словарь</a></li><li><a href="#p-contacts">Контакты</a></li></ol></section>';
    h += '<section class="page" id="p-choose"><h1>Как выбрать опору</h1><p class="lead">Три шага: что должна делать опора, какой диаметр трубы и нагрузка, какое исполнение.</p>' + ui.tasks() + '</section>';
    gs.forEach(function (g) {
      var m = K.matrix.filter(function (x) { return x.g === g.id; })[0];
      h += '<section class="page p-group" id="' + href('/g/' + g.id).slice(1) + '"><div class="kicker">РАЗДЕЛ ' + (g.n < 10 ? '0' : '') + g.n + '</div><h1>' + esc(g.title) + '</h1><p class="lead">' + esc(g.short) + '</p>' + ui.rows(catsOf(g.id)) + (m ? '<div class="p-matrix"><h3>Матрица подбора: тип × Dн</h3>' + ui.matrix(m) + '</div>' : '') + '</section>';
      catsOf(g.id).forEach(function (c) { var cat = window.KATC[c.slug]; h += '<div id="' + href('/c/' + c.slug).slice(1) + '" class="p-card">' + V.card(cat, ui.heroOf(cat)) + '</div>'; });
      zakazOf(g.id).forEach(function (z) { h += '<div id="' + href('/z/' + z.slug).slice(1) + '" class="p-card">' + pageZakaz(z) + '</div>'; });
    });
    h += '<div id="p-faq">' + pageFaq() + '</div><div id="p-glossary">' + pageGlossary() + '</div><section class="page" id="p-contacts"><h1>Контакты</h1>' + ui.contacts() + '</section>';
    document.body.innerHTML = '<main id="view">' + h + '</main>';
    var imgs = $$('img'), left = imgs.length, fin = function () { if (--left <= 0) document.body.setAttribute('data-ready', '1'); };
    if (!left) fin(); imgs.forEach(function (i) { if (i.complete) fin(); else { i.loading = 'eager'; i.onload = i.onerror = fin; } });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (PRINT) return script('data/all.js?v=' + K.v, renderPrint);
    view = $('#view');
    document.addEventListener('click', onClick); document.addEventListener('change', onChange); document.addEventListener('input', onSearch);
    window.addEventListener('hashchange', route);
    document.addEventListener('keydown', onSearchKey);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $$('.search-res').forEach(function (r) { r.hidden = true; }); });
    $$('[data-ui]').forEach(function (n) { n.outerHTML = ui[n.getAttribute('data-ui')](); });
    route(); if (!curCat && !/^#\/?c\//.test(location.hash)) document.body.setAttribute('data-ready', '1');
  });
})();
