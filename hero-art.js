/* hero-art.js — пиксельный аниме-герой 128×128, рисуется кодом на canvas.
   Слои: волосы сзади → тело → низ → верх → руки → рукава → лицо (глаза, рот) → волосы спереди → аксессуар.
   Всё процедурное и оригинальное. Экспорт: window.KvestHeroArt. */
(function () {
  "use strict";

  var W = 128, H = 128;
  var INK = 0x3d2a33;
  var WHITE = 0xfdfbf7;

  /* ---------- цвет ---------- */
  function rgb(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
  function mix(a, b, t) {
    var A = rgb(a), B = rgb(b);
    return (Math.round(A[0] + (B[0] - A[0]) * t) << 16) | (Math.round(A[1] + (B[1] - A[1]) * t) << 8) | Math.round(A[2] + (B[2] - A[2]) * t);
  }
  function dk(c, t) { return mix(c, INK, t == null ? 0.3 : t); }
  function lt(c, t) { return mix(c, 0xffffff, t == null ? 0.35 : t); }
  function lum(c) { var a = rgb(c); return 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]; }
  function hash(n) {
    n = (n * 374761393 + 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* ---------- буфер-слой ---------- */
  function Buf() { this.d = new Int32Array(W * H); this.d.fill(-1); }
  var BP = Buf.prototype;
  BP.set = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.d[y * W + x] = c;
  };
  BP.get = function (x, y) { if (x < 0 || y < 0 || x >= W || y >= H) return -1; return this.d[y * W + x]; };
  BP.fill = function (test, c, box) {
    var x0 = 0, y0 = 0, x1 = W, y1 = H, fn = typeof c === "function";
    if (box) { x0 = Math.max(0, Math.floor(box[0])); y0 = Math.max(0, Math.floor(box[1])); x1 = Math.min(W, Math.ceil(box[2])); y1 = Math.min(H, Math.ceil(box[3])); }
    for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
      if (test(x + 0.5, y + 0.5)) this.d[y * W + x] = fn ? c(x, y, this.d[y * W + x]) : c;
    }
  };
  /** Красит только уже заполненные пиксели. */
  BP.paint = function (test, c) {
    var fn = typeof c === "function";
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x;
      if (this.d[i] !== -1 && test(x + 0.5, y + 0.5)) this.d[i] = fn ? c(x, y, this.d[i]) : c;
    }
  };
  BP.clear = function (test) {
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (test(x + 0.5, y + 0.5)) this.d[y * W + x] = -1;
  };
  /** Тень по краю: пиксель цвета `only`, у которого сосед со смещением (ox,oy) пуст. */
  BP.rim = function (shade, ox, oy, only) {
    var src = this.d.slice();
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x;
      if (src[i] === -1 || (only != null && src[i] !== only)) continue;
      var nx = x + ox, ny = y + oy;
      var n = (nx < 0 || ny < 0 || nx >= W || ny >= H) ? -1 : src[ny * W + nx];
      if (n === -1) this.d[i] = shade;
    }
  };
  BP.outline = function (c) {
    var src = this.d.slice();
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x;
      if (src[i] !== -1) continue;
      if ((x > 0 && src[i - 1] !== -1) || (x < W - 1 && src[i + 1] !== -1) || (y > 0 && src[i - W] !== -1) || (y < H - 1 && src[i + W] !== -1)) this.d[i] = c;
    }
  };
  BP.onto = function (dst) { for (var i = 0; i < this.d.length; i++) if (this.d[i] !== -1) dst.d[i] = this.d[i]; };
  BP.sprite = function (rows, x0, y0, map) {
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) {
      var ch = rows[y][x];
      if (map[ch] != null) this.set(x0 + x, y0 + y, map[ch]);
    }
  };

  /* ---------- фигуры (предикаты по центру пикселя) ---------- */
  function E(cx, cy, rx, ry) { return function (x, y) { var a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b <= 1; }; }
  function R(x0, y0, x1, y1) { return function (x, y) { return x >= x0 && x < x1 && y >= y0 && y < y1; }; }
  function C(x1, y1, x2, y2, r) {
    var dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    return function (x, y) {
      var t = L ? ((x - x1) * dx + (y - y1) * dy) / L : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var px = x1 + t * dx - x, py = y1 + t * dy - y;
      return px * px + py * py <= r * r;
    };
  }
  function P(pts) {
    return function (x, y) {
      var ins = false;
      for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
      }
      return ins;
    };
  }
  function U() { var fs = arguments; return function (x, y) { for (var i = 0; i < fs.length; i++) if (fs[i](x, y)) return true; return false; }; }
  function I(a, b) { return function (x, y) { return a(x, y) && b(x, y); }; }
  function N(a, b) { return function (x, y) { return a(x, y) && !b(x, y); }; }
  function M(f) { return function (x, y) { return f(x, y) || f(128 - x, y); }; }
  /** Эллипс с «волнистым» краем (кудри, пушистость, шипы). */
  function Wob(cx, cy, rx, ry, amp, freq, kind, topOnly) {
    return function (x, y) {
      var dx = (x - cx) / rx, dy = (y - cy) / ry;
      var a = Math.atan2(dy, dx);
      var w;
      if (kind === "tri") { var u = ((a * freq / Math.PI) % 2 + 2) % 2; w = 1 - Math.abs(u - 1) * 2; }
      else w = Math.sin(a * freq);
      var k = topOnly && dy > 0 ? 0 : amp;
      var r = 1 + k * w;
      return dx * dx + dy * dy <= r * r;
    };
  }
  function heartP(cx, cy, s) {
    return U(E(cx - s * 0.5, cy - s * 0.2, s * 0.62, s * 0.55), E(cx + s * 0.5, cy - s * 0.2, s * 0.62, s * 0.55),
      P([[cx - s * 1.08, cy], [cx + s * 1.08, cy], [cx, cy + s * 1.1]]));
  }
  function starP(cx, cy, ro, ri) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return P(pts);
  }

  /* ---------- палитры ---------- */
  var PAL = {
    skin: [0xffeadf, 0xffdcc8, 0xf7c8a6, 0xe7ad88, 0xc68a62, 0x95603f],
    hair: [0x6b4532, 0xa06a46, 0xf0cf8a, 0xffbfd1, 0xff94ad, 0xa3dcc4, 0xa6ccef, 0xf2a06e, 0xece8e6, 0x3e3438],
    eyes: [0x8a5236, 0x4f8fd8, 0x46a878, 0xef6a9b, 0xe0a030, 0x2fa3a0, 0x8a9098, 0xd8444f, 0x3d6fb0, 0x3a2e2e],
    mouth: [0xd8546e, 0xe8707e, 0xc24a5a, 0xf08aa0, 0xb84a4a, 0xe27a68, 0xd65f84, 0xa63f4d, 0xf2a0a0, 0x9a4a40],
    cloth: [0xffb3c7, 0x9ad8bc, WHITE, 0xffe6a8, 0xa8d4f5, 0xffc9a8, 0x6fb08e, 0xff8f96, 0xd9b48f, 0x4f4a55],
    acc: [0xff8fab, 0xffd36e, 0x8fd6b4, WHITE, 0xa8d4f5, 0xff6f7f, 0xffc9a8, 0x6fb08e, 0xd9b48f, 0x4f4a55]
  };
  var PAL_NAMES = {
    skin: ["фарфоровый", "светлый", "тёплый", "загорелый", "смуглый", "тёмный"],
    hair: ["каштановый", "русый", "блонд", "розовый", "клубничный", "мятный", "голубой", "рыжий", "серебристый", "чёрный"],
    eyes: ["карие", "голубые", "зелёные", "розовые", "янтарные", "бирюзовые", "серые", "красные", "синие", "тёмные"],
    mouth: ["розовый", "коралловый", "вишнёвый", "светло-розовый", "ягодный", "персиковый", "малиновый", "винный", "нежный", "терракотовый"],
    cloth: ["розовый", "мятный", "белый", "лимонный", "голубой", "персиковый", "шалфей", "коралловый", "карамельный", "графитовый"],
    acc: ["розовый", "золотой", "мятный", "белый", "голубой", "красный", "персиковый", "зелёный", "карамельный", "графитовый"]
  };

  /* ---------- варианты частей (по 20) ---------- */
  /* Волосы: отдельные наборы для девушки и парня. Первые 5 в каждом наборе открыты сразу. */
  var HAIR_G = [
    { id: "g-bob", n: "Каре", back: "bob", bang: "blunt", side: 62 },
    { id: "g-long", n: "Длинные", back: "long", bang: "spiky", side: 72 },
    { id: "g-twintails", n: "Хвостики", back: "twintails", bang: "spiky", side: 58 },
    { id: "g-sidebangs", n: "Чёлка по бокам", back: "long", bang: "curtain", side: 84, frame: true, lockW: 1.35 },
    { id: "g-wavybob", n: "Волнистое каре", back: "wavybob", bang: "wispy", side: 64, wave: true },
    { id: "g-buns", n: "Пучки", back: "buns", bang: "parted", side: 62 },
    { id: "g-ponytail", n: "Хвост", back: "ponytail", bang: "side", side: 60 },
    { id: "g-braid", n: "Коса", back: "short", braid: 1, bang: "wispy", side: 60 },
    { id: "g-wavy", n: "Волнистые", back: "wavy", bang: "parted", side: 72 },
    { id: "g-verylong", n: "Очень длинные", back: "verylong", bang: "blunt", side: 74 },
    { id: "g-sidebob", n: "Косое каре", back: "bob", bang: "side", side: 66 },
    { id: "g-curly", n: "Кудряшки", back: "curly", bang: "wispy", side: 64, vol: 2, fluffy: true },
    { id: "g-lowtails", n: "Низкие хвостики", back: "lowtails", bang: "blunt", side: 60 },
    { id: "g-princess", n: "Принцесса", back: "long", bang: "blunt", side: 80 },
    { id: "g-pixie", n: "Пикси", back: "short", bang: "wispy", ahoge: true, side: 54 },
    { id: "g-topbun", n: "Гулька", back: "topbun", bang: "parted", side: 60 },
    { id: "g-sidetail", n: "Боковой хвост", back: "sidetail", bang: "side", side: 60 },
    { id: "g-fluffy", n: "Пушистые", back: "short", bang: "spiky", vol: 2, side: 58, fluffy: true },
    { id: "g-twinbraids", n: "Две косички", back: "short", braid: 2, bang: "blunt", side: 56 },
    { id: "g-wavyahoge", n: "Волна с антенкой", back: "wavy", bang: "spiky", ahoge: true, side: 70 }
  ];
  /* Мужские причёски. «custom» — форма задаётся функцией в BOY_HAIR (по референсу заказчицы). */
  var HAIR_B = [
    { id: "b-middle", n: "Пробор посередине", custom: "middle" },
    { id: "b-korean", n: "Корейская шторка", custom: "korean" },
    { id: "b-comma", n: "Запятая", custom: "comma" },
    { id: "b-sidepart", n: "Пробор набок", custom: "sidepart" },
    { id: "b-messyfringe", n: "Растрёпанная чёлка", custom: "messy" },
    { id: "b-texture", n: "Текстурный объём", custom: "texture" },
    { id: "b-wolf", n: "Вулф-кат", custom: "wolf" },
    { id: "b-slick", n: "Зачёс назад", custom: "slick" },
    { id: "b-undercut", n: "Андеркат с объёмом", custom: "undercut" },
    { id: "b-bob", n: "Каре", custom: "bob" },
    { id: "b-crop", n: "Кроп", custom: "crop" },
    { id: "b-mullet", n: "Маллет", back: "mullet", bang: "fringe", side: 56 },
    { id: "b-buzz", n: "Ёжик", back: "tight", bang: "buzz", fade: true, capR: [24.6, 23.6], top: { amp: 0.04, freq: 20, kind: "tri" }, side: 0 },
    { id: "b-classic", n: "Короткая классика", back: "short", bang: "side", side: 50, capR: [25.5, 24.5] },
    { id: "b-curly", n: "Кудряшки", back: "short", bang: "messy", top: { amp: 0.07, freq: 12, kind: "sin", all: true }, vol: 2, side: 52 },
    { id: "b-nape", n: "Хвостик на затылке", back: "nape", bang: "curtain", side: 58 },
    { id: "b-eye", n: "Длинная чёлка на глаз", back: "short", bang: "eye", side: 58 },
    { id: "b-samurai", n: "Пучок-самурай", back: "topknot", bang: "slick", fade: true, side: 0 },
    { id: "b-quiff", n: "Квифф", back: "tight", bang: "quiff", fade: true, quiff: true, side: 0 },
    { id: "b-wavy", n: "Волнистые до плеч", back: "shoulder", bang: "parted", side: 74, wave: true }
  ];
  /* удалённые id → ближайшая новая причёска */
  var HAIR_ALIAS = { "b-curtain": "b-korean", "b-messy": "b-messyfringe", "b-spiky": "b-texture", "b-fluffy": "b-messyfringe", "b-ponytail": "b-nape" };

  /* v2.0 хранил номер причёски из общего списка — переводим в новые id */
  var LEGACY_HAIR = ["g-bob", "g-long", "g-twintails", "b-classic", "g-buns", "g-ponytail", "g-braid", "g-wavy", "b-buzz", "g-verylong",
    "g-sidebob", "g-curly", "g-lowtails", "g-princess", "g-pixie", "g-topbun", "g-sidetail", "g-fluffy", "g-twinbraids", "g-wavyahoge"];

  var EYES_G = [
    { id: "g-eyes-round", n: "Круглые", shape: "round", hl: "classic" },
    { id: "g-eyes-shine", n: "Сияющие", shape: "round", hl: "star" },
    { id: "g-eyes-almond", n: "Миндальные", shape: "sharp", hl: "classic" },
    { id: "g-eyes-soft", n: "Мягкие", shape: "droopy", hl: "classic" },
    { id: "g-eyes-sleepy", n: "Сонные", shape: "sleepy", hl: "classic" },
    { id: "g-eyes-hearts", n: "Сердечки", shape: "round", hl: "heart" },
    { id: "g-eyes-big", n: "Большие", shape: "tall", hl: "classic" },
    { id: "g-eyes-wink", n: "Подмигивание", shape: "round", hl: "classic", wink: true },
    { id: "g-eyes-happy", n: "Счастливые", shape: "closed" },
    { id: "g-eyes-sparkle", n: "Искорки", shape: "tall", hl: "sparkle" },
    { id: "g-eyes-cat", n: "Кошачьи", shape: "sharp", hl: "classic", slit: true },
    { id: "g-eyes-dots", n: "Точечки", shape: "tiny" },
    { id: "g-eyes-stars", n: "Звёздные", shape: "tall", hl: "star" },
    { id: "g-eyes-lashes", n: "С ресничками", shape: "round", hl: "classic", lash: true },
    { id: "g-eyes-gentle", n: "Нежные", shape: "droopy", hl: "sparkle" },
    { id: "g-eyes-sly", n: "Озорные", shape: "sharp", hl: "star" },
    { id: "g-eyes-sleepyhearts", n: "Сонные сердечки", shape: "sleepy", hl: "heart" },
    { id: "g-eyes-double", n: "Двойной блик", shape: "round", hl: "double" },
    { id: "g-eyes-dreamy", n: "Мечтательные", shape: "droopy", hl: "double", lash: true },
    { id: "g-eyes-brave", n: "Решительные", shape: "sharp", hl: "double", thick: true }
  ];
  /* Мужские глаза: миндалевидные, горизонтальные, без ресниц, с бровями. */
  var EYES_B = [
    { id: "b-eyes-calm", n: "Спокойные", shape: "calm", brow: "flat", hl: "dot" },
    { id: "b-eyes-sharp", n: "Острые", shape: "sharp", tilt: 1, brow: "angled", hl: "dot" },
    { id: "b-eyes-sleepy", n: "Сонные", shape: "sleepy", brow: "flat", hl: "dot", browY: -0.5 },
    { id: "b-eyes-squint", n: "Прищур", shape: "squint", tilt: 0.5, brow: "angled", hl: "dot", browY: 0.5 },
    { id: "b-eyes-soft", n: "Круглые-мягкие", shape: "soft", brow: "arched", hl: "big", iris: 1.1 },
    { id: "b-eyes-confident", n: "Уверенные", shape: "sharp", tilt: 1, brow: "angled", hl: "two", thick: true },
    { id: "b-eyes-frown", n: "Хмурые брови", shape: "calm", brow: "angry", hl: "dot" },
    { id: "b-eyes-shine", n: "С бликом", shape: "calm", brow: "flat", hl: "big" },
    { id: "b-eyes-narrow", n: "Узкие", shape: "narrow", brow: "flat", hl: "dot", iris: 0.9 },
    { id: "b-eyes-happy", n: "Весёлые", shape: "happy", brow: "raised" },
    { id: "b-eyes-wink", n: "Подмигивание", shape: "calm", wink: true, brow: "raised", hl: "dot" },
    { id: "b-eyes-cool", n: "Холодные", shape: "sharp", tilt: 0.8, brow: "flat", hl: "none", iris: 0.9 },
    { id: "b-eyes-kind", n: "Добрые", shape: "droopy", tilt: -0.8, brow: "worried", hl: "big" },
    { id: "b-eyes-bright", n: "Яркие", shape: "soft", brow: "flat", hl: "two", lower: true },
    { id: "b-eyes-focused", n: "Сосредоточенные", shape: "narrow", tilt: 0.6, brow: "angry", hl: "dot", thick: true },
    { id: "b-eyes-lazy", n: "Ленивые", shape: "sleepy", brow: "flat", hl: "none", browY: 0.5 },
    { id: "b-eyes-star", n: "Звёздочка", shape: "calm", brow: "arched", hl: "star" },
    { id: "b-eyes-tired", n: "Уставшие", shape: "sleepy", brow: "worried", hl: "dot", bags: true },
    { id: "b-eyes-fierce", n: "Дерзкие", shape: "sharp", tilt: 1.3, brow: "angry", hl: "dot", iris: 0.85, thick: true },
    { id: "b-eyes-gentle", n: "Нежные", shape: "soft", tilt: -0.5, brow: "raised", hl: "two" }
  ];
  var MOUTHS = [
    { n: "Улыбка", g: ["o....o", ".oooo."] },
    { n: "Радость", g: ["oooooo", "ommmmo", ".otto.", "..oo.."] },
    { n: "Котик", g: ["o..oo..o", ".oo..oo."] },
    { n: "Удивление", g: [".oo.", "ommo", "ommo", ".oo."] },
    { n: "Ухмылка", g: [".....o", "oooooo"] },
    { n: "Язычок", g: ["oooooo", "..otto", "...oo."] },
    { n: "Клычок", g: ["oooooo", "ofmmmo", ".oooo."] },
    { n: "Зубки", g: ["oooooooo", "owwwwwwo", ".ommmmo.", "..oooo.."] },
    { n: "Точка", g: ["oo"] },
    { n: "Губки", g: [".mm.", "mmmm", ".mm."] },
    { n: "Сердечко", g: [".oo.oo.", "ommommo", ".ommmo.", "..omo..", "...o..."] },
    { n: "Восторг", g: ["oooooooo", "ommmmmmo", ".otttto.", "..oooo.."] },
    { n: "Волнение", g: [".o..o.", "o.oo.o"] },
    { n: "Скромная", g: ["o..o", ".oo."] },
    { n: "Хи-хи", g: ["o......o", ".oooooo."] },
    { n: "Ой", g: [".oo.", "omm.", ".oo."] },
    { n: "Белозубая", g: ["oooooo", "owwwwo", ".oooo."] },
    { n: "Спокойная", g: ["oooo"] },
    { n: "Чмок", g: ["oo.", "..o", "oo.", "..o", "oo."] },
    { n: "Два клычка", g: ["oooooo", "ofmmfo", ".oooo."] }
  ];
  var SAD_MOUTH = [".oooo.", "o....o"];
  var ACCS = [
    { n: "Нет", id: "none" }, { n: "Бантик", id: "bow" }, { n: "Кошачьи ушки", id: "cat" }, { n: "Цветок", id: "flower" },
    { n: "Очки", id: "glasses" }, { n: "Звёздочка", id: "star" }, { n: "Ободок", id: "band" }, { n: "Берет", id: "beret" },
    { n: "Заячьи ушки", id: "bunny" }, { n: "Тиара", id: "tiara" }, { n: "Наушники", id: "phones" }, { n: "Два бантика", id: "bows" },
    { n: "Сердечко", id: "heart" }, { n: "Нимб", id: "halo" }, { n: "Росток", id: "sprout" }, { n: "Шарф", id: "scarf" },
    { n: "Чокер", id: "choker" }, { n: "Серёжки", id: "earrings" }, { n: "Шляпка", id: "hat" }, { n: "Венок", id: "wreath" }
  ];
  var TOPS_G = [
    { id: "g-tee", n: "Футболка", sl: "short", hem: 99, neck: "crew" },
    { id: "g-hoodie", n: "Худи", sl: "long", hem: 102, neck: "crew", hood: true, pocket: true, strings: true },
    { id: "g-sweater", n: "Свитер", sl: "long", hem: 101, neck: "crew", rib: true },
    { id: "g-sarafan", n: "Сарафан", sl: "none", hem: 110, flare: 0.55, neck: "square", straps: true },
    { id: "g-blouse", n: "Блузка", sl: "puff", hem: 100, neck: "crew", collar: true },
    { id: "g-sailor", n: "Матроска", sl: "short", hem: 100, neck: "v", sailor: true },
    { id: "g-jacket", n: "Курточка", sl: "long", hem: 101, neck: "crew", open: true, lapels: true },
    { id: "g-tank", n: "Майка", sl: "none", hem: 100, neck: "scoop" },
    { id: "g-stripes", n: "Полоска", sl: "short", hem: 101, neck: "crew", stripes: true },
    { id: "g-cardigan", n: "Кардиган", sl: "long", hem: 101, neck: "v", open: true, buttons: true },
    { id: "g-turtle", n: "Водолазка", sl: "long", hem: 101, neck: "turtle" },
    { id: "g-heart", n: "С сердечком", sl: "short", hem: 101, neck: "crew", print: "heart" },
    { id: "g-shirt", n: "Рубашка", sl: "long", hem: 101, neck: "v", collar: true, buttons: true },
    { id: "g-crop", n: "Кроп-топ", sl: "puff", hem: 93, neck: "scoop" },
    { id: "g-diamond", n: "Ромбики", sl: "long", hem: 101, neck: "crew", pattern: "diamond", rib: true },
    { id: "g-starhoodie", n: "Худи со звездой", sl: "long", hem: 102, neck: "crew", hood: true, print: "star" },
    { id: "g-vest", n: "Жилетка", sl: "long", sleeve: WHITE, hem: 100, neck: "v", vest: true },
    { id: "g-frilldress", n: "Платье с оборкой", sl: "puff", hem: 112, flare: 0.7, neck: "crew", frill: true },
    { id: "g-pajama", n: "Пижамка", sl: "long", hem: 102, neck: "v", dots: true, collar: true },
    { id: "g-yukata", n: "Юката", sl: "wide", hem: 104, neck: "wrap", obi: true }
  ];
  var TOPS_B = [
    { id: "b-tee", n: "Футболка", sl: "short", hem: 101, neck: "crew" },
    { id: "b-hoodie", n: "Худи", sl: "long", hem: 102, neck: "crew", hood: true, pocket: true, strings: true },
    { id: "b-shirt", n: "Рубашка", sl: "long", hem: 101, neck: "v", collar: true, buttons: true },
    { id: "b-sweater", n: "Свитер", sl: "long", hem: 101, neck: "crew", rib: true },
    { id: "b-plaid", n: "Рубашка в клетку", sl: "long", hem: 101, neck: "v", collar: true, buttons: true, pattern: "plaid" },
    { id: "b-denim", n: "Джинсовка", sl: "long", hem: 101, neck: "crew", open: true, lapels: true, seams: true },
    { id: "b-bomber", n: "Бомбер", sl: "long", hem: 100, neck: "crew", rib: true, zip: true, cuffRib: true },
    { id: "b-turtle", n: "Водолазка", sl: "long", hem: 101, neck: "turtle" },
    { id: "b-polo", n: "Поло", sl: "short", hem: 101, neck: "crew", collar: true, placket: 2 },
    { id: "b-vest", n: "Жилетка с рубашкой", sl: "long", sleeve: WHITE, hem: 100, neck: "v", vest: true, collar: true },
    { id: "b-cardigan", n: "Кардиган", sl: "long", hem: 101, neck: "v", open: true, buttons: true },
    { id: "b-track", n: "Спортивная куртка", sl: "long", hem: 100, neck: "crew", zip: true, sleeveStripe: true, cuffRib: true },
    { id: "b-print", n: "Футболка с принтом", sl: "short", hem: 101, neck: "crew", print: "star" },
    { id: "b-sweatshirt", n: "Свитшот", sl: "long", hem: 101, neck: "crew", rib: true, cuffRib: true, print: "wave" },
    { id: "b-longsleeve", n: "Лонгслив", sl: "long", hem: 101, neck: "crew" },
    { id: "b-stripes", n: "Тельняшка", sl: "long", hem: 101, neck: "crew", stripes: true },
    { id: "b-raglan", n: "Реглан", sl: "long", sleeve: WHITE, hem: 101, neck: "crew", raglan: true },
    { id: "b-henley", n: "Хенли", sl: "long", hem: 101, neck: "crew", placket: 3 },
    { id: "b-hawaii", n: "Гавайская рубашка", sl: "short", hem: 101, neck: "v", collar: true, buttons: true, flowers: true },
    { id: "b-coat", n: "Пальто", sl: "long", hem: 108, neck: "crew", open: true, lapels: true, double: true }
  ];
  var BOTTOMS_G = [
    { id: "g-shorts", n: "Шорты", t: "shorts", len: 106, shoe: "sneaker" },
    { id: "g-skirt", n: "Юбка", t: "skirt", len: 107, flare: 0.55, shoe: "mary", socks: "short" },
    { id: "g-jeans", n: "Джинсы", t: "pants", len: 116, shoe: "sneaker", seam: true },
    { id: "g-pleated", n: "Плиссе", t: "skirt", len: 108, flare: 0.6, pleats: true, shoe: "mary", socks: "knee" },
    { id: "g-longskirt", n: "Длинная юбка", t: "skirt", len: 116, flare: 0.45, shoe: "mary" },
    { id: "g-cuffshorts", n: "Шорты с отворотом", t: "shorts", len: 105, cuff: true, shoe: "sneaker", socks: "short" },
    { id: "g-plaidskirt", n: "Клетчатая юбка", t: "skirt", len: 107, flare: 0.6, pattern: "plaid", pleats: true, shoe: "mary", socks: "knee" },
    { id: "g-leggings", n: "Леггинсы", t: "pants", len: 116, slim: true, shoe: "sneaker" },
    { id: "g-bowskirt", n: "Юбка с бантом", t: "skirt", len: 106, flare: 0.5, bow: true, shoe: "mary", socks: "short" },
    { id: "g-cargo", n: "Карго", t: "pants", len: 116, wide: 1.4, pockets: true, shoe: "boot" },
    { id: "g-dotskirt", n: "Юбка в горошек", t: "skirt", len: 108, flare: 0.55, pattern: "dots", shoe: "mary", socks: "knee" },
    { id: "g-bermuda", n: "Бермуды", t: "shorts", len: 110, shoe: "sneaker" },
    { id: "g-tiered", n: "Юбка с оборками", t: "skirt", len: 110, flare: 0.6, tiers: true, shoe: "mary" },
    { id: "g-stripepants", n: "Брюки в полоску", t: "pants", len: 116, pattern: "vstripes", shoe: "mary" },
    { id: "g-beltmini", n: "Мини с поясом", t: "skirt", len: 104, flare: 0.45, belt: true, shoe: "boot", socks: "knee" },
    { id: "g-joggers", n: "Джоггеры", t: "pants", len: 116, cuff: true, shoe: "sneaker" },
    { id: "g-starskirt", n: "Миди со звёздами", t: "skirt", len: 112, flare: 0.5, pattern: "stars", shoe: "mary" },
    { id: "g-plaidshorts", n: "Клетчатые шорты", t: "shorts", len: 106, pattern: "plaid", shoe: "sneaker", socks: "knee" },
    { id: "g-wide", n: "Широкие брюки", t: "pants", len: 117, wide: 2.6, shoe: "mary" },
    { id: "g-tutu", n: "Юбка-пачка", t: "skirt", len: 105, flare: 0.95, tutu: true, shoe: "mary", socks: "knee" }
  ];
  var BOTTOMS_B = [
    { id: "b-jeans", n: "Джинсы", t: "pants", len: 116, shoe: "sneaker", seam: true },
    { id: "b-chinos", n: "Брюки чинос", t: "pants", len: 116, shoe: "mary", crease: true },
    { id: "b-shorts", n: "Шорты", t: "shorts", len: 107, shoe: "sneaker", socks: "short" },
    { id: "b-cargo", n: "Карго", t: "pants", len: 116, wide: 1.4, pockets: true, shoe: "boot" },
    { id: "b-trackpants", n: "Спортивные штаны", t: "pants", len: 116, sideStripe: true, cuff: true, shoe: "sneaker" },
    { id: "b-joggers", n: "Джоггеры", t: "pants", len: 116, cuff: true, shoe: "sneaker" },
    { id: "b-wide", n: "Широкие брюки", t: "pants", len: 117, wide: 2.6, shoe: "mary" },
    { id: "b-breeches", n: "Бриджи", t: "pants", len: 111, shoe: "sneaker", socks: "short" },
    { id: "b-plaidpants", n: "Брюки в клетку", t: "pants", len: 116, pattern: "plaid", shoe: "mary" },
    { id: "b-cargoshorts", n: "Шорты карго", t: "shorts", len: 108, pockets: true, shoe: "boot" },
    { id: "b-ripped", n: "Рваные джинсы", t: "pants", len: 116, seam: true, rips: true, shoe: "sneaker" },
    { id: "b-bermuda", n: "Бермуды", t: "shorts", len: 111, shoe: "sneaker" },
    { id: "b-sportshorts", n: "Спортивные шорты", t: "shorts", len: 106, sideStripe: true, shoe: "sneaker", socks: "knee" },
    { id: "b-slim", n: "Узкие брюки", t: "pants", len: 116, slim: true, shoe: "boot" },
    { id: "b-stripes", n: "Брюки в полоску", t: "pants", len: 116, pattern: "vstripes", shoe: "mary" },
    { id: "b-cord", n: "Вельветовые", t: "pants", len: 116, cord: true, shoe: "boot" },
    { id: "b-cuffjeans", n: "Джинсы с подворотом", t: "pants", len: 114, seam: true, cuff: true, shoe: "mary", socks: "short" },
    { id: "b-belt", n: "Брюки с ремнём", t: "pants", len: 116, belt: true, crease: true, shoe: "mary" },
    { id: "b-plaidshorts", n: "Клетчатые шорты", t: "shorts", len: 107, pattern: "plaid", shoe: "sneaker" },
    { id: "b-pajama", n: "Пижамные штаны", t: "pants", len: 116, pattern: "dots", cuff: true, shoe: "mary" }
  ];
  var BACKGROUNDS = [
    { id: "room", n: "Уютная комната" },
    { id: "garden", n: "Сад с цветами" },
    { id: "sakura", n: "Сакура в парке" },
    { id: "beach", n: "Пляж на закате" },
    { id: "night", n: "Звёздная ночь" },
    { id: "cafe", n: "Кафе" },
    { id: "plants", n: "Спальня с растениями" },
    { id: "rain", n: "Дождливое окно" }
  ];

  var DEFAULT_LOOK = {
    gender: "girl", skin: 1,
    hair: { v: "g-bob", c: 3 }, eyes: { v: "g-eyes-round", c: 1 }, mouth: { v: 0, c: 0 },
    accessory: { v: 1, c: 0 }, top: { v: "g-tee", c: 1 }, bottom: { v: "g-skirt", c: 0 }
  };
  /* Части, зависящие от пола: значение v — строковый id, уникальный для обоих наборов. */
  var GENDERED = {
    hair: { girl: HAIR_G, boy: HAIR_B },
    eyes: { girl: EYES_G, boy: EYES_B },
    top: { girl: TOPS_G, boy: TOPS_B },
    bottom: { girl: BOTTOMS_G, boy: BOTTOMS_B }
  };
  var PARTS = { hair: HAIR_G, eyes: EYES_G, mouth: MOUTHS, accessory: ACCS, top: TOPS_G, bottom: BOTTOMS_G };
  function variants(part, gender) {
    return GENDERED[part] ? GENDERED[part][gender === "boy" ? "boy" : "girl"] : PARTS[part];
  }
  function variantValue(part, gender, i) { return GENDERED[part] ? variants(part, gender)[i].id : i; }
  function variantIndex(part, gender, v) {
    if (!GENDERED[part]) return v;
    var list = variants(part, gender);
    for (var i = 0; i < list.length; i++) if (list[i].id === v) return i;
    return -1;
  }
  function spec(look, part) {
    if (!GENDERED[part]) return PARTS[part][look[part].v];
    var list = variants(part, look.gender), i = variantIndex(part, look.gender, look[part].v);
    return list[i < 0 ? 0 : i];
  }
  var PART_PAL = { hair: "hair", eyes: "eyes", mouth: "mouth", accessory: "acc", top: "cloth", bottom: "cloth" };

  function clampInt(v, max, def) { v = parseInt(v, 10); return isNaN(v) || v < 0 || v >= max ? def : v; }
  function normalizeLook(look) {
    look = look || {};
    var gender = look.gender === "boy" ? "boy" : "girl";
    var out = { gender: gender, skin: clampInt(look.skin, PAL.skin.length, DEFAULT_LOOK.skin) };
    Object.keys(PARTS).forEach(function (p) {
      var src = look[p] || {}, def = DEFAULT_LOOK[p];
      var c = clampInt(src.c, PAL[PART_PAL[p]].length, def.c);
      if (!GENDERED[p]) { out[p] = { v: clampInt(src.v, PARTS[p].length, def.v), c: c }; return; }
      var list = variants(p, gender), v = src.v;
      if (typeof v === "number") v = p === "hair" ? LEGACY_HAIR[v] : (GENDERED[p].girl[v] || {}).id;
      if (p === "hair" && HAIR_ALIAS[v]) v = HAIR_ALIAS[v];
      if (variantIndex(p, gender, v) < 0) v = list[0].id;
      out[p] = { v: v, c: c };
    });
    return out;
  }

  /* ---------- геометрия тела ---------- */
  function geom(gender) {
    var girl = gender !== "boy";
    return {
      girl: girl,
      hw: function (y) {
        if (girl) { if (y < 78) return 9 + (y - 74) * 1.5; if (y < 90) return 15 - (y - 78) * 0.25; return 12 + (y - 90) * 0.25; }
        if (y < 78) return 10 + (y - 74) * 2; return 18 - (y - 78) * 0.12;
      },
      arm: girl ? [47.5, 79, 43.5, 98.5, 3.1] : [45, 80, 42, 98.5, 3.5],
      hand: girl ? [43.5, 101.5, 3.3, 3.5] : [42, 101.5, 3.6, 3.7],
      leg: girl ? [58.5, 99, 58.8, 116.5, 3.4] : [58, 99, 58, 116.5, 3.9]
    };
  }
  function torso(G, y0, y1, extra) {
    extra = extra || 0;
    return function (x, y) { return y >= y0 && y < y1 && Math.abs(x - 64) <= G.hw(y) + extra; };
  }
  function armSeg(G, t0, t1, extra) {
    var a = G.arm;
    return M(C(a[0] + (a[2] - a[0]) * t0, a[1] + (a[3] - a[1]) * t0, a[0] + (a[2] - a[0]) * t1, a[1] + (a[3] - a[1]) * t1, a[4] + (extra || 0)));
  }
  function facePredBoy(x, y) {
    var dx = Math.abs(x - 64);
    if (y < 22 || y > 71.5) return false;
    if (y <= 46) { var b = (y - 46) / 24; return dx <= 23 * Math.sqrt(Math.max(0, 1 - b * b)); }
    var t = (y - 46) / 25.5;
    var w = 23 * (1 - 0.6 * Math.pow(t, 1.45));
    if (y > 68) w -= (y - 68) * 1.6;
    return dx <= w;
  }
  function facePred(x, y) {
    var dx = Math.abs(x - 64);
    if (y < 22 || y > 69.5) return false;
    if (y <= 46) { var b = (y - 46) / 24; return dx <= 23 * Math.sqrt(Math.max(0, 1 - b * b)); }
    var t = (y - 46) / 23.5;
    var w = 23 * (1 - 0.66 * Math.pow(t, 1.7));
    if (y > 66) w -= (y - 66) * 1.3;
    return dx <= w;
  }

  /* ---------- слои ---------- */

  function hairColor(look) { return PAL.hair[look.hair.c]; }

  function bangY(x, type) {
    var dx = x - 64, u, k, y;
    switch (type) {
      case "blunt":
        y = 43.5 + (Math.floor(x / 3) % 2 ? 0 : 1) + Math.max(0, Math.abs(dx) - 14) * 0.35;
        break;
      case "side": {
        var base = 35 + (x - 38) * 0.17;
        u = ((x + 200) % 9) / 9;
        var tt = u < 0.7 ? u / 0.7 : (1 - u) / 0.3;
        y = base + 6 * tt;
        break;
      }
      case "parted": {
        u = ((Math.abs(dx) + 60) % 6) / 6;
        y = 31 + Math.abs(dx) * 0.72 + 3 * (1 - Math.abs(2 * u - 1));
        break;
      }
      case "wispy": {
        k = Math.floor((dx + 100) / 5); u = ((dx + 100) % 5) / 5;
        y = 37 + (4 + hash(k + 7) * 6) * Math.pow(1 - Math.abs(2 * u - 1), 1.2);
        break;
      }
      case "fringe": // прямая мужская чёлка до бровей
        y = 41 + (Math.floor(x / 4) % 3 === 0 ? 1.2 : 0) + Math.max(0, Math.abs(dx) - 15) * 0.4;
        break;
      case "crop": // короткая текстурная прямая чёлка
        y = 35.5 + (hash(Math.floor(x / 2) + 3) < 0.45 ? 1.6 : 0);
        break;
      case "buzz":
        y = 31.5 + (Math.floor(x) % 3 === 0 ? 0.8 : 0);
        break;
      case "slick":
        y = 28.5 + Math.max(0, Math.abs(dx) - 13) * 0.45;
        break;
      case "quiff":
        y = 29.5 + Math.abs(dx) * 0.22;
        break;
      case "swept": { // косая чёлка, зачёсанная набок
        u = ((x + 200) % 6) / 6;
        y = 30 + (x - 40) * 0.36 + 2.5 * (1 - Math.abs(2 * u - 1));
        break;
      }
      case "curtain": { // шторка: пробор посередине, пряди уходят к вискам
        u = ((Math.abs(dx) + 60) % 5) / 5;
        y = 28 + Math.abs(dx) * 1.05 + 2 * (1 - Math.abs(2 * u - 1));
        break;
      }
      case "messy": {
        k = Math.floor((dx + 100) / 4); u = ((dx + 100) % 4) / 4;
        y = 35 + (3 + hash(k * 3 + 1) * 8) * (1 - Math.abs(2 * u - 1));
        break;
      }
      case "eye": { // длинная чёлка, закрывающая правый глаз
        u = ((x + 200) % 5) / 5;
        var tooth = 2.5 * (1 - Math.abs(2 * u - 1));
        if (x < 60) return 35 + tooth + Math.max(0, 50 - x) * 0.1;
        return Math.min(57, 38 + (x - 60) * 0.95 + tooth);
      }
      default: { // spiky
        k = Math.floor((dx + 3.5 + 70) / 7); u = ((dx + 3.5 + 70) % 7) / 7;
        var depth = [9, 7, 9, 6, 9, 8, 7, 9, 6, 8, 9, 7, 9, 8, 6][k % 15];
        y = 37.5 + depth * Math.pow(1 - Math.abs(2 * u - 1), 1.25);
      }
    }
    return Math.min(46, y);
  }

  /* ---------- мужские причёски по референсу ---------- */
  /** Острые «пряди»: глубина зубца для координаты x. */
  function piece(x, w, d0, d1, seed, pw) {
    var k = Math.floor((x + 256) / w), u = ((x + 256) % w) / w;
    var d = d0 + (d1 - d0) * hash(k * 7 + seed);
    return d * Math.pow(1 - Math.abs(2 * u - 1), pw || 1.2);
  }
  function adx(x) { return Math.abs(x - 64); }
  var boyHairCache = {};
  function boyHair(name) {
    if (boyHairCache[name]) return boyHairCache[name];
    var st;
    switch (name) {
      case "middle": // пробор посередине, шторка до скул, кончики наружу на затылке
        st = {
          cap: E(64, 41, 25.5, 25.5),
          fringe: function (x) {
            var d = adx(x);
            var y = d < 17 ? 27 + d * 1.15 : 46.5 + (d - 17) * 4;
            return y + (d > 4 && d < 17 ? piece(x, 4, 0.5, 2.5, 1) : 0);
          },
          sides: function (x, y) {
            var d = adx(x) - Math.max(0, y - 57) * 0.55;
            return y >= 42 && d >= 19 && d <= 24.3 && y < 62 + piece(adx(x) * 2, 3, 1, 4, 5);
          },
          back: U(E(64, 46, 24.5, 22), function (x, y) {
            var d = adx(x) - Math.max(0, y - 62) * 0.7;
            return y >= 44 && d <= 21.5 && y < 70 - piece(adx(x) * 1.5, 3, 0, 4, 9);
          }),
          part: [64, 17, 27]
        };
        break;
      case "korean": // мягкая округлая шторка, закрывает уши, длинный затылок
        st = {
          cap: E(64, 41.5, 26, 25.5),
          fringe: function (x) {
            var d = adx(x);
            var y = d < 13 ? 33 + d * 0.95 : 45.4 + (d - 13) * 1.55;
            return y + piece(x, 5, 0.5, 1.5, 2, 2);
          },
          sides: function (x, y) {
            var d = adx(x), outer = 25.2 - Math.max(0, y - 54) * 0.45;
            var q = (d - 22) / 3.6;
            return y >= 42 && d >= 19 && d <= outer && y < 57.5 + Math.sqrt(Math.max(0, 1 - q * q)) * 3.5;
          },
          back: U(E(64, 45, 26, 24), function (x, y) {
            var d = adx(x);
            return y >= 44 && d <= 21 - Math.max(0, y - 64) * 0.6 && y < 72 - piece(d, 4, 0, 2, 4, 2);
          })
        };
        break;
      case "comma": // чёлка набок, прядь-запятая завивается внутрь у брови
        st = {
          cap: E(64, 41, 25.5, 25),
          fringe: function (x) { return Math.min(46.5, 37.5 + (x - 38) * 0.2 + piece(x, 5, 1, 3, 6, 1.3)); },
          extra: U(C(67, 36, 76.5, 45.5, 2.7), I(N(E(74, 47.5, 4.6, 3.8), E(72.6, 46.6, 2.2, 1.7)), function (x, y) { return y > 46.4 || x < 72; })),
          sides: function (x, y) {
            var d = adx(x);
            return y >= 42 && d >= 19 && d <= 24.3 - Math.max(0, y - 50) * 0.4 && y < 54 + piece(d * 2, 3, 0, 3, 7);
          },
          back: U(E(64, 46, 24, 22), function (x, y) { var d = adx(x); return y >= 44 && d <= 21 && y < 66 - piece(d, 4, 0, 3, 2); })
        };
        break;
      case "sidepart": // глубокий пробор слева, объёмная чёлка зачёсана вправо
        st = {
          cap: U(E(64, 41, 25.5, 25), E(70, 25, 21.5, 11.5)),
          fringe: function (x) {
            if (x < 48) return 33 + (48 - x) * 0.25;
            return Math.min(47, 31 + (x - 48) * 0.55 + piece(x, 6, 0.5, 2.5, 8));
          },
          sides: function (x, y) {
            var d = adx(x), L = x > 64 ? 57 : 51;
            return y >= 42 && d >= 19 && d <= 24.3 && y < L + piece(d * 2, 3, 0, 3, 3);
          },
          back: U(E(64, 46, 24, 22), function (x, y) {
            var d = adx(x) - Math.max(0, y - 60) * 0.6;
            return y >= 44 && d <= 21.5 && y < 67 - piece(adx(x), 3, 0, 3, 12);
          }),
          part: [48, 18, 31]
        };
        break;
      case "messy": // густая растрёпанная чёлка до бровей
        st = {
          cap: Wob(64, 41, 25.5, 25.5, 0.1, 12, "tri", true),
          fringe: function (x) { return 41.5 + piece(x, 4, 1, 4.5, 11, 1.1); },
          sides: function (x, y) { var d = adx(x); return y >= 42 && d >= 19 && d <= 24.3 && y < 53 + piece(d * 2.2, 3, 1, 4, 13); },
          back: U(E(64, 46, 25, 22), function (x, y) { var d = adx(x); return y >= 44 && d <= 21 && y < 65 - piece(d, 3, 0, 3, 6); })
        };
        break;
      case "texture": // объёмный текстурный верх, пряди, рваные виски
        st = {
          cap: U(Wob(64, 40, 26.5, 26.5, 0.12, 9, "tri", true), E(64, 21, 21, 9)),
          capR: [26, 26],
          fringe: function (x) { return Math.min(46.5, 38.5 + piece(x, 5, 2, 7.5, 13, 1.4)); },
          sides: function (x, y) { var d = adx(x); return y >= 42 && d >= 19 && d <= 25 && y < 59 - piece(d * 2, 3, 0, 6, 17); },
          back: U(E(64, 45, 25, 23), function (x, y) {
            var d = adx(x) - Math.max(0, y - 62) * 0.8;
            return y >= 44 && d <= 22 && y < 70 - piece(adx(x), 3, 0, 5, 21);
          })
        };
        break;
      case "wolf": // лохматый слоистый верх и длинные тонкие пряди на затылке
        st = {
          cap: U(Wob(64, 41, 26.5, 26, 0.07, 10, "tri", true), E(56, 18, 7, 4), E(72, 18, 7, 4)),
          capR: [26, 26],
          fringe: function (x) { return Math.min(47, 39.5 + piece(x, 4, 2, 7, 23, 1.1)); },
          sides: function (x, y) {
            var d = adx(x) - Math.max(0, y - 56) * 0.5;
            return y >= 42 && d >= 19 && d <= 26 && y < 64 - piece(adx(x) * 2, 3, 0, 5, 27);
          },
          back: U(E(64, 46, 25, 22), function (x, y) {
            var d = adx(x) - Math.max(0, y - 64) * 0.35;
            if (y < 44 || d > 26) return false;
            if (y < 68) return d <= 24;
            var k = Math.floor(d / 3), len = 70 + hash(k * 5 + 3) * 15;
            var w = 2.3 * (1 - (y - 68) / (len - 68 + 0.01)) + 0.5;
            return d >= 12 && y < len && (d % 3) < w;
          })
        };
        break;
      case "slick": // зачёс назад, открытый лоб, аккуратные короткие виски
        st = {
          cap: U(E(64, 40, 25.5, 24.5), E(64, 21, 21, 9.5)),
          capR: [25.5, 24.5],
          fringe: function (x) { var d = adx(x); return d < 15 ? 27.5 + (hash(Math.floor(x / 3)) < 0.4 ? 1 : 0) : 27.5 + (d - 15) * 2.2; },
          cutY: 46,
          back: U(E(64, 40, 25, 24), E(64, 52, 20, 10)),
          lines: function (f, c) {
            [-14, -8, -2, 4, 10, 16].forEach(function (k) {
              for (var t = 0; t < 9; t++) {
                var x = Math.round(64 + k * (1 - t * 0.04)), y = 29 - t;
                if (f.get(x, y) !== -1) f.set(x, y, dk(c, 0.25));
              }
            });
          }
        };
        break;
      case "undercut": // длинный верх, падающий набок, выбритые виски, уши видны
        st = {
          cap: U(E(64, 40, 25, 24), E(62, 21, 22, 10)),
          capR: [25, 24],
          fringe: function (x) {
            if (x < 56) return 30 + (x - 40) * 0.2;
            return Math.min(50, 31.5 + (x - 56) * 0.75 + piece(x, 4, 1, 3, 29));
          },
          fade: true,
          back: E(64, 40, 24.6, 23.6)
        };
        break;
      case "bob": // мягкое мужское каре до подбородка, концы подвёрнуты внутрь
        st = {
          cap: E(64, 41.5, 26.5, 26),
          fringe: function (x) {
            var d = adx(x);
            return Math.min(47, 40.5 + piece(x, 5, 0.5, 3, 31, 1.6) - (d < 2.5 ? 2.5 : 0) + Math.max(0, d - 15) * 0.6);
          },
          sides: function (x, y) {
            var d = adx(x), inner = 19 - Math.max(0, y - 60) * 0.6;
            var q = (d - 22.5) / 4;
            return y >= 42 && d >= inner && d <= 26.5 - Math.max(0, y - 62) * 0.5 && y < 64 + 2.5 * Math.sqrt(Math.max(0, 1 - q * q));
          },
          back: U(E(64, 45, 26.5, 24), function (x, y) { var d = adx(x); return y >= 44 && d <= 24.5 - Math.max(0, y - 62) * 0.8 && y < 69; })
        };
        break;
      default: // crop: короткий текстурный, мягкая рваная чёлка, мягкие короткие виски
        st = {
          cap: Wob(64, 40.5, 25, 24.5, 0.07, 13, "tri", true),
          capR: [24.5, 24],
          fringe: function (x) { return 37 + piece(x, 3.5, 1.5, 4.5, 37, 1.2); },
          cutY: 47,
          fade: true, fadeSoft: true,
          back: U(E(64, 41, 24.5, 23.5), E(64, 52, 20, 9))
        };
    }
    boyHairCache[name] = st;
    return st;
  }

  function hairBack(dst, look) {
    var h = spec(look, "hair"), c = hairColor(look), vol = h.vol || 0;
    var b = new Buf(), base = dk(c, 0.12);
    if (h.custom) {
      b.fill(boyHair(h.custom).back, base);
      b.rim(dk(c, 0.3), 1, 1, base);
      b.outline(dk(c, 0.55));
      b.onto(dst);
      return;
    }
    var tight = h.back === "tight" || h.back === "topknot";
    var skull = tight ? E(64, 40, 24.6, 23.6)
      : h.top ? Wob(64, 41, 26 + vol, 25 + vol, h.top.amp, h.top.freq, h.top.kind, !h.top.all)
      : h.fluffy ? Wob(64, 41, 27 + vol, 26 + vol, 0.05, 9, "sin") : E(64, 41, 26 + vol, 25 + vol);
    var shapes = tight ? [skull] : [skull, E(64, 50, 22, 13)];
    switch (h.back) {
      case "topknot":
        shapes.push(E(64, 12, 6.5, 5.5), R(61, 15, 67, 19));
        break;
      case "mullet":
        shapes.push(function (x, y) {
          var dx = Math.abs(x - 64), tooth = 4 * (1 - Math.abs(2 * (((dx + 30) % 5) / 5) - 1));
          return y >= 40 && y < 84 - tooth && dx <= 19 - Math.max(0, y - 66) * 0.15;
        });
        break;
      case "nape":
        shapes.push(C(80, 54, 87, 66, 3.6), C(87, 66, 88, 74, 2.4));
        break;
      case "wavybob":
        shapes.push(function (x, y) {
          var dx = Math.abs(x - 64), hw = 27.5 + 1.8 * Math.sin(y / 3) - Math.pow(Math.max(0, y - 60), 1.4) * 0.45;
          var tooth = 3 * (1 - Math.abs(2 * (((dx + 30) % 5) / 5) - 1));
          return y >= 30 && dx <= hw && y < 70 - tooth;
        });
        break;
      case "shoulder":
        shapes.push(function (x, y) {
          var dx = Math.abs(x - 64), hw = 26.5 + 2 * Math.sin(y / 4) + (y - 40) * 0.04;
          var tooth = 4 * (1 - Math.abs(2 * (((dx + 30) % 6) / 6) - 1));
          return y >= 34 && dx <= hw && y < 84 - tooth;
        });
        break;
      case "wolf":
        shapes.push(function (x, y) {
          var dx = Math.abs(x - 64), hw = 27 - Math.max(0, y - 62) * 0.35;
          var tooth = 8 * (1 - Math.abs(2 * (((dx + 30) % 5) / 5) - 1));
          return y >= 34 && dx <= hw && y < 80 - tooth;
        });
        break;
      case "bob":
        shapes.push(function (x, y) {
          var dx = Math.abs(x - 64), hw = 26.5 + Math.min(3, Math.max(0, y - 36) * 0.15) - Math.pow(Math.max(0, y - 58), 1.4) * 0.45;
          var tooth = 3 * (1 - Math.abs(2 * (((dx + 30) % 6) / 6) - 1));
          return y >= 30 && dx <= hw && y < 69 - tooth - Math.pow(dx / 28, 4) * 3;
        });
        break;
      case "long": case "verylong": {
        var L = h.back === "long" ? 100 : 120;
        shapes.push(function (x, y) {
          var dx = Math.abs(x - 64), hw = 27 + Math.min(y - 34, 34) * 0.12;
          var tooth = 5 * (1 - Math.abs(2 * (((dx + 30) % 6) / 6) - 1));
          return y >= 34 && dx <= hw && y < L - tooth - (dx / hw) * 4;
        });
        break;
      }
      case "wavy":
        shapes.push(function (x, y) {
          var dx = Math.abs(x - 64), hw = 27 + 2.4 * Math.sin(y / 4.5) + (y - 40) * 0.06;
          var tooth = 4 * (1 - Math.abs(2 * (((dx + 30) % 7) / 7) - 1));
          return y >= 34 && dx <= hw && y < 104 - tooth;
        });
        break;
      case "curly":
        shapes.push(I(Wob(64, 54, 33, 38, 0.06, 11, "sin"), R(0, 30, 128, 94)));
        break;
      case "twintails":
        [-1, 1].forEach(function (s) {
          shapes.push(function (x, y) {
            if (y < 24 || y > 106) return false;
            var cx = 64 + s * (31 + 5 * Math.sin((y - 24) / 14));
            var hw = y < 34 ? 4 + (y - 24) * 0.5 : 9 - Math.max(0, y - 84) * 0.36;
            return Math.abs(x - cx) <= hw;
          });
        });
        break;
      case "lowtails":
        [-1, 1].forEach(function (s) {
          shapes.push(function (x, y) {
            if (y < 52 || y > 110) return false;
            var cx = 64 + s * (25 + (y - 52) * 0.1);
            var hw = 5 + (y - 52) * 0.08 - Math.max(0, y - 98) * 0.45;
            return Math.abs(x - cx) <= hw;
          });
        });
        break;
      case "ponytail":
        shapes.push(C(78, 24, 95, 36, 6), C(95, 36, 100, 62, 7), C(100, 62, 97, 88, 5.5), C(97, 88, 93, 98, 3));
        break;
      case "sidetail":
        shapes.push(C(44, 36, 31, 52, 6), C(31, 52, 28, 80, 7), C(28, 80, 32, 100, 5), C(32, 100, 36, 108, 2.5));
        break;
      case "buns":
        shapes.push(E(43, 21, 9, 9), E(85, 21, 9, 9));
        break;
      case "topbun":
        shapes.push(E(64, 13, 11, 9));
        break;
    }
    b.fill(U.apply(null, shapes), base);
    b.rim(dk(c, 0.3), 1, 1, base);
    b.outline(dk(c, 0.55));
    // резинки для хвостиков
    if (h.back === "twintails" || h.back === "lowtails") {
      var low = h.back === "lowtails";
      b.paint(function (x, y) {
        var s2 = x < 64 ? -1 : 1;
        var cx = low ? 64 + s2 * (25 + (y - 52) * 0.1) : 64 + s2 * (31 + 5 * Math.sin((y - 24) / 14));
        return y > (low ? 58 : 36) && y < (low ? 100 : 96) && Math.abs(x - (cx - 3)) < 0.6;
      }, lt(c, 0.25));
      var ty = low ? 55 : 28, tx = low ? 25 : 31;
      b.fill(M(E(64 - tx, ty, 3, 1.8)), 0xff9fb7);
    }
    b.onto(dst);
  }

  function hairFront(dst, look) {
    var h = spec(look, "hair"), c = hairColor(look), vol = h.vol || 0;
    var f = new Buf();
    var capR = h.capR || [26 + vol, 25 + vol];
    var cap = h.spiky ? Wob(64, 41, 26.5, 26, 0.09, 8, "tri", true)
      : h.top ? Wob(64, 41, capR[0], capR[1], h.top.amp, h.top.freq, h.top.kind, !h.top.all)
      : h.fluffy ? Wob(64, 41, 26 + vol, 25 + vol, 0.05, 9, "sin")
      : E(64, 41, capR[0], capR[1]);
    var win = function (x, y) { return Math.abs(x - 64) < 20.5 && y > bangY(x, h.bang); };
    var L = h.side, lw = h.lockW || 1;
    var lock = M(function (x, y) {
      if (y < 40 || y > L) return false;
      var cx = 41.5 + (y - 50) * 0.05 + (h.frame ? 1.2 : 0);
      if (h.wave || h.frame) cx += Math.sin(y / 3.5) * 1.1;
      var hw = 3.4 * lw * (1 - Math.max(0, (y - (L - 8)) / 8));
      return Math.abs(x - cx) <= hw;
    });
    var st = h.custom ? boyHair(h.custom) : null;
    var fringeY = st ? st.fringe : function (x) { return bangY(x, h.bang); };
    if (st) {
      capR = st.capR || [25.5, 25];
      cap = st.cap;
      win = function (x, y) { return Math.abs(x - 64) < 20.5 && y > st.fringe(x); };
    }
    var fade = st ? st.fade : h.fade;
    var cutY = st ? (st.cutY || (st.fade ? 38.5 : null)) : (h.fade ? 38.5 : null);
    var cut = win;
    if (cutY) cut = U(win, function (x, y) { return y > cutY && Math.abs(x - 64) > 19.5; });
    var shapes = [N(cap, cut)];
    if (st) { if (st.sides) shapes.push(st.sides); if (st.extra) shapes.push(st.extra); }
    else if (L > 0) shapes.push(lock);
    if (!st && h.swoop) shapes.push(N(U(E(57, 25, 21, 10.5), E(70, 22, 14, 8)), win));
    if (!st && h.quiff) shapes.push(U(E(64, 17, 14, 8), E(60, 13, 9, 6)));
    // выбритые виски (фейд): кожа с «щетиной», уши видны
    if (fade) {
      var S = PAL.skin[look.skin], fb = new Buf(), soft = st && st.fadeSoft;
      fb.fill(N(function (x, y) {
        var dx = Math.abs(x - 64);
        return y > 36 && y < 54 && dx > 19 && E(64, 41, capR[0] - 1.6, capR[1] - 0.8)(x, y);
      }, M(E(41.5, 52, 3.4, 4.9))), function (x, y) {
        // плавный фейд: темнее у макушки, светлее к ушам, одна «ступенька» с редкими точками
        var a = soft ? 0.22 : 0.38, b2 = soft ? 0.42 : 0.6;
        if (y < 42) return mix(c, S, a);
        if (y < 44) return (x + y) % 3 === 0 ? mix(c, S, a) : mix(c, S, b2);
        return mix(c, S, b2);
      });
      fb.outline(dk(S, 0.45));
      fb.onto(dst);
    }
    if (h.ahoge) shapes.push(C(64, 18, 66, 10, 1.3), C(66, 10, 71, 8, 1.1));
    f.fill(U.apply(null, shapes), c);
    f.rim(dk(c, 0.2), 1, 2, c);
    // блик-ободок
    var boyHairLook = look.gender === "boy";
    var shine = lt(c, boyHairLook ? 0.3 : 0.5);
    f.paint(function (x, y) {
      if (!(y < 33 && E(64, 37, 21, 17)(x, y) && !E(64, 39.5, 21, 17)(x, y))) return false;
      return boyHairLook ? (Math.floor(x / 2) % 4 === 0 && x < 76) : Math.floor(x) % 6 !== 0;
    }, shine);
    // пряди: тёмные линии от впадин чёлки вверх
    var strandN = 0;
    for (var x = 42; x <= 86; x++) {
      var y0 = fringeY(x + 0.5), yl = fringeY(x - 0.5), yr = fringeY(x + 1.5);
      if (y0 < yl && y0 <= yr) {
        if (boyHairLook && (strandN++ % 2)) continue;
        for (var yy = Math.floor(y0) - (boyHairLook ? 5 : 4); yy < Math.floor(y0); yy++) if (f.get(x, yy) !== -1) f.set(x, yy, dk(c, 0.3));
      }
    }
    if (st && st.part) { for (var py = st.part[1]; py < st.part[2]; py++) if (f.get(st.part[0], py) !== -1) f.set(st.part[0], py, dk(c, 0.35)); }
    if (st && st.lines) st.lines(f, c);
    f.outline(dk(c, 0.55));
    f.onto(dst);

    if (h.braid) {
      var br = new Buf(), sides = h.braid === 2 ? [-1, 1] : [1];
      sides.forEach(function (s) {
        for (var k = 0; k < 7; k++) {
          var cx = 64 + s * (22 + k * 0.4), cy = 62 + k * 6;
          br.fill(E(cx, cy, 4.6 - k * 0.12, 3.8), c, [cx - 6, cy - 5, cx + 6, cy + 5]);
          br.paint(I(E(cx, cy, 4.6, 3.8), function (x, y) { return y > cy + 1; }), dk(c, 0.2));
        }
        br.fill(R(64 + s * 25 - 2.5, 103, 64 + s * 25 + 2.5, 105), dk(c, 0.5));
        br.fill(P([[64 + s * 25 - 3, 105], [64 + s * 25 + 3, 105], [64 + s * 25, 111]]), c);
      });
      br.outline(dk(c, 0.55));
      br.onto(dst);
    }
  }

  function drawBodyBase(dst, look, G) {
    var S = PAL.skin[look.skin], sh = dk(S, 0.16), ol = dk(S, 0.5);
    var b = new Buf(), l = G.leg;
    var neckW = G.girl ? 0 : 1;
    b.fill(U(torso(G, 72, 101), R(60 - neckW, 60, 68 + neckW, 78), M(C(l[0], l[1], l[2], l[3], l[4]))), S);
    b.paint(R(60, 60, 68, 69), sh);
    b.rim(sh, 1, 0, S);
    b.outline(ol);
    b.onto(dst);
  }

  function drawArms(dst, look, G) {
    var S = PAL.skin[look.skin], sh = dk(S, 0.16), ol = dk(S, 0.5);
    var a = new Buf(), ar = G.arm, hd = G.hand;
    a.fill(U(M(C(ar[0], ar[1], ar[2], ar[3], ar[4])), M(E(hd[0], hd[1], hd[2], hd[3]))), S);
    a.rim(sh, 1, 1, S);
    a.outline(ol);
    a.onto(dst);
  }

  function patternPaint(buf, kind, c, x0) {
    var light = lum(c) > 225;
    var p1 = light ? dk(c, 0.14) : lt(c, 0.45);
    if (kind === "plaid") {
      buf.paint(function (x, y) { var a = Math.floor(x) % 6 < 2, b = Math.floor(y) % 6 < 2; return a || b; }, function (x, y, cur) {
        var a = x % 6 < 2, b = y % 6 < 2; return a && b ? dk(c, 0.25) : dk(c, 0.12);
      });
    } else if (kind === "dots") {
      buf.paint(function (x, y) { x = Math.floor(x); y = Math.floor(y); return y % 4 === 0 && (x + ((y >> 2) & 1) * 2) % 4 === 0; }, p1);
    } else if (kind === "vstripes") {
      buf.paint(function (x) { return Math.floor(x) % 4 === 0; }, p1);
    } else if (kind === "stripes") {
      buf.paint(function (x, y) { return (Math.floor(y) - (x0 || 0)) % 5 < 2; }, p1);
    } else if (kind === "stars") {
      buf.paint(function (x, y) {
        x = Math.floor(x); y = Math.floor(y);
        var cx = Math.floor(x / 7) * 7 + 3, cy = Math.floor(y / 7) * 7 + 3 + ((Math.floor(x / 7) & 1) ? 3 : 0);
        return (x === cx && Math.abs(y - cy) <= 1) || (y === cy && Math.abs(x - cx) <= 1);
      }, 0xffe08a);
    } else if (kind === "diamond") {
      buf.paint(function (x, y) {
        x = Math.floor(x); y = Math.floor(y);
        return Math.abs(((x - 64) % 8 + 8) % 8 - 4) + Math.abs(((y - 73) % 8 + 8) % 8 - 4) === 4;
      }, dk(c, 0.15));
    }
  }

  function drawBow(buf, cx, cy, s, c) {
    var shape = U(E(cx - 4 * s, cy, 4 * s, 3 * s), E(cx + 4 * s, cy, 4 * s, 3 * s),
      C(cx - 1, cy + 1, cx - 3.5 * s, cy + 5 * s, 1.1 * s), C(cx + 1, cy + 1, cx + 3.5 * s, cy + 5 * s, 1.1 * s));
    var b = new Buf();
    b.fill(shape, c);
    b.paint(U(E(cx - 4.4 * s, cy + 0.6, 1.6 * s, 1.2 * s), E(cx + 4.4 * s, cy + 0.6, 1.6 * s, 1.2 * s)), dk(c, 0.22));
    b.fill(E(cx, cy, 1.7 * s, 2 * s), lt(c, 0.2));
    b.outline(dk(c, 0.5));
    b.onto(buf);
  }

  function drawShoes(dst, bt, c) {
    var b = new Buf();
    var col, sole = null;
    if (bt.shoe === "sneaker") { col = WHITE; sole = lum(c) > 225 ? 0xffb3c7 : c; }
    else if (bt.shoe === "boot") col = 0x8a6050;
    else col = 0x7a4f45;
    var shape = bt.shoe === "boot" ? M(U(E(57.5, 119.6, 4.9, 3.4), R(53.5, 110, 62.2, 120))) : M(U(E(57.5, 119.6, 4.8, 3.4), R(53.5, 116, 62, 120)));
    b.fill(shape, col);
    b.rim(dk(col, 0.18), 1, 1, col);
    if (sole != null) b.paint(function (x, y) { return y >= 121.5; }, sole);
    if (bt.shoe === "mary") b.paint(R(53, 116, 63, 117), dk(col, 0.35)), b.paint(R(65, 116, 75, 117), dk(col, 0.35));
    if (bt.shoe === "sneaker") { b.set(57, 118, dk(sole, 0.2)); b.set(70, 118, dk(sole, 0.2)); }
    if (bt.shoe === "mary" || bt.shoe === "boot") { b.set(55, 118, lt(col, 0.4)); b.set(68, 118, lt(col, 0.4)); }
    b.outline(dk(col, 0.55));
    b.onto(dst);
  }

  function drawBottom(dst, look, G) {
    var bt = spec(look, "bottom"), c = PAL.cloth[look.bottom.c], ol = dk(c, 0.5), l = G.leg;
    // носки
    if (bt.socks) {
      var s = new Buf(), top = bt.socks === "knee" ? 106 : 113;
      s.fill(I(M(C(l[0], l[1], l[2], l[3], l[4] + 0.3)), function (x, y) { return y >= top; }), WHITE);
      s.paint(function (x, y) { return y >= top && y < top + 1.5; }, lt(c, 0.1));
      s.outline(dk(WHITE, 0.4));
      s.onto(dst);
    }
    drawShoes(dst, bt, c);

    var b = new Buf(), pred;
    if (bt.t === "skirt") {
      pred = function (x, y) {
        var dx = Math.abs(x - 64), hw = 14.2 + (y - 93) * bt.flare;
        var hem = bt.len + (1 - Math.min(1, dx / hw) * Math.min(1, dx / hw)) * 1.5;
        if (bt.tutu) hem += Math.sin(x * 1.3) * 1.2;
        return y >= 93 && y < hem && dx <= hw;
      };
    } else {
      var extra = bt.slim ? 0.4 : 1.3;
      var leg = function (x, y) {
        if (y < 96 || y >= bt.len) return false;
        var lx = l[0] + (l[2] - l[0]) * (y - l[1]) / (l[3] - l[1]);
        var hw = l[4] + extra + (bt.wide ? Math.max(0, y - 98) / 18 * bt.wide : 0);
        if (bt.t === "shorts") hw += (y - 96) * 0.12;
        return Math.abs(x - lx) <= hw;
      };
      pred = N(U(torso(G, 93, 101, 1), M(leg)), function (x, y) { return y > 103 && Math.abs(x - 64) < 1; });
    }
    b.fill(pred, c);
    b.rim(dk(c, 0.15), 1, 1, c);
    if (bt.pattern) patternPaint(b, bt.pattern, c);
    // пояс
    b.paint(R(0, 93, 128, 95), bt.belt ? dk(c, 0.45) : dk(c, 0.1));
    if (bt.belt) { b.paint(R(62, 93, 66, 95), 0xffd36e); }
    if (bt.t !== "skirt") { b.set(64, 96, dk(c, 0.35)); }
    if (bt.pleats) b.paint(function (x, y) { var hw = 14.2 + (y - 93) * bt.flare; return y > 96 && Math.round((x - 64) * 14 / hw) % 4 === 0; }, dk(c, 0.18));
    if (bt.tiers) b.paint(function (x, y) { y = Math.floor(y); return y === 100 || y === 105; }, lt(c, 0.45));
    if (bt.tutu) b.paint(function (x, y) { return (Math.floor(x) + Math.floor(y)) % 5 === 0; }, lt(c, 0.5));
    if (bt.cuff) b.paint(function (x, y) { return y >= bt.len - 2.5; }, lt(c, 0.25));
    if (bt.seam) b.paint(function (x, y) { var dx = Math.abs(x - 64); return y > 100 && Math.abs(dx - 5.6) < 0.5; }, dk(c, 0.15));
    if (bt.pockets) { b.paint(M(R(45, 104, 51, 110)), dk(c, 0.15)); }
    if (bt.sideStripe) b.paint(M(function (x, y) {
      var lx = l[0] + (l[2] - l[0]) * (y - l[1]) / (l[3] - l[1]);
      var hw = l[4] + 1.3 + (bt.t === "shorts" ? (y - 96) * 0.12 : 0);
      return y > 96 && Math.abs(x - (lx - hw + 0.8)) < 0.6;
    }), lum(c) > 225 ? 0xff9fb7 : WHITE);
    if (bt.rips) b.paint(M(function (x, y) { return Math.abs(y - 107.5) < 0.6 && x > 55 && x < 61; }), lt(c, 0.6));
    if (bt.crease) b.paint(M(function (x, y) { return y > 100 && Math.abs(x - 58.6) < 0.5; }), dk(c, 0.12));
    if (bt.cord) b.paint(function (x, y) { return y > 96 && Math.floor(x) % 2 === 0; }, dk(c, 0.07));
    b.outline(ol);
    if (bt.bow) drawBow(b, 72, 96, 0.6, lum(c) > 225 ? 0xff9fb7 : lt(c, 0.5));
    b.onto(dst);
  }

  function topBodyPred(G, t) {
    var hem = t.hem, flare = t.flare || 0;
    var body = function (x, y) {
      if (y < 72.5) return false;
      var dx = Math.abs(x - 64), hw = G.hw(Math.min(y, 100)) + 1;
      if (flare && y > 94) hw = Math.max(hw, 14 + (y - 94) * flare * 1.6);
      var h2 = hem + (flare ? (1 - Math.min(1, dx / hw) * Math.min(1, dx / hw)) * 1.5 : 0);
      return y < h2 && dx <= hw;
    };
    var neck;
    switch (t.neck) {
      case "v": neck = P([[58, 72], [70, 72], [64, 81]]); break;
      case "scoop": neck = E(64, 73, 8, 5); break;
      case "square": neck = R(55, 72, 73, 79); break;
      case "wrap": neck = P([[57, 72], [70, 72], [61, 82]]); break;
      case "turtle": neck = function () { return false; }; break;
      default: neck = E(64, 73.5, 5.5, 3.5);
    }
    var p = N(body, neck);
    if (t.neck === "turtle") p = U(p, R(59, 63, 69, 79));
    if (t.straps) p = U(N(p, R(0, 72, 128, 79)), M(R(54, 72, 57.5, 80)));
    return p;
  }

  function drawTop(dst, look, G) {
    var t = spec(look, "top"), c = PAL.cloth[look.top.c], ol = dk(c, 0.5), light = lum(c) > 225;
    var b = new Buf();
    if (t.hood) {
      var hood = new Buf();
      hood.fill(function (x, y) { return y < 80 && y > 66 && E(64, 74, 15, 7)(x, y) && !E(64, 73, 6.5, 4)(x, y); }, lt(c, 0.1));
      hood.outline(ol);
      hood.onto(dst);
    }
    b.fill(topBodyPred(G, t), c);
    b.rim(dk(c, 0.15), 1, 1, c);
    if (t.stripes) patternPaint(b, "stripes", c, 73);
    if (t.dots) patternPaint(b, "dots", c);
    if (t.pattern) patternPaint(b, t.pattern, c);
    if (t.open) {
      b.paint(function (x, y) { return Math.abs(x - 64) < 4.5 && y > 73; }, WHITE);
      b.paint(function (x, y) { var dx = Math.abs(x - 64); return dx >= 4.5 && dx < 5.5 && y > 73; }, dk(c, 0.3));
    }
    if (t.vest) {
      b.paint(function (x, y) { return Math.abs(x - 64) < 4 && y > 73; }, WHITE);
    }
    if (t.rib) b.paint(function (x, y) { return y >= t.hem - 3 && Math.floor(x) % 2 === 0; }, dk(c, 0.14));
    if (t.pocket) { b.paint(R(55, 90, 73, 98), dk(c, 0.08)); b.paint(R(55, 90, 73, 91), dk(c, 0.3)); }
    if (t.strings) { [60, 67].forEach(function (x) { for (var y = 76; y < 86; y++) b.set(x, y, light ? 0xffb3c7 : lt(c, 0.6)); b.set(x, 86, dk(c, 0.4)); }); }
    if (t.buttons) { var bx = t.open ? 59 : 64; [80, 85, 90, 95].forEach(function (y) { b.set(bx, y, light ? dk(c, 0.35) : lt(c, 0.6)); }); }
    if (t.collar) {
      var cc = t.dots ? lt(c, 0.5) : WHITE;
      b.fill(I(M(E(60, 75.5, 4.6, 3)), function (x, y) { return y >= 73; }), cc);
      b.paint(function (x, y) { return y >= 73 && y < 79 && Math.abs(x - 64) < 0.6; }, dk(cc, 0.35));
    }
    if (t.sailor) {
      b.fill(N(M(P([[57, 72], [47, 76], [49, 83], [64, 87]])), P([[58, 72], [70, 72], [64, 81]])), WHITE);
      b.paint(N(M(P([[56.5, 74], [49, 77], [50.5, 81], [62, 84.5]])), M(P([[57, 75.5], [51, 78], [51.5, 80], [61, 83]]))), light ? 0xa8d4f5 : c);
    }
    if (t.lapels) b.fill(M(P([[59, 73], [55, 74], [59.5, 85]])), lt(c, 0.15));
    if (t.obi) { var oc = (c === 0xffb3c7) ? 0x8fd6b4 : 0xff9fb7; b.paint(R(0, 89, 128, 95), oc); b.paint(R(0, 91, 128, 92), lt(oc, 0.4)); }
    if (t.neck === "wrap") { for (var i = 0; i < 18; i++) b.set(Math.round(70 - i * 0.62), 73 + i, dk(c, 0.35)); }
    if (t.neck === "turtle") b.paint(function (x, y) { return y < 77 && Math.floor(y) % 2 === 0; }, dk(c, 0.12));
    if (t.frill) b.paint(function (x, y) { return y >= t.hem - 3; }, lt(c, 0.45));
    if (t.print === "heart") b.sprite([".aa.aa.", "aaaaaaa", "aaaaaaa", ".aaaaa.", "..aaa..", "...a..."], 61, 82, { a: c === 0xffb3c7 ? WHITE : 0xff8fab });
    if (t.flowers) b.paint(function (x, y) {
      x = Math.floor(x); y = Math.floor(y);
      var cx = Math.floor(x / 6) * 6 + 3, cy = Math.floor(y / 6) * 6 + 3 + ((Math.floor(x / 6) & 1) ? 3 : 0);
      return Math.abs(x - cx) + Math.abs(y - cy) === 1;
    }, light ? 0xff9fb7 : WHITE);
    if (t.zip) b.paint(function (x, y) { return y > 74 && Math.abs(x - 64) < 0.6; }, light ? dk(c, 0.35) : lt(c, 0.55));
    if (t.placket) { for (var py = 74; py < 74 + t.placket * 4; py++) b.set(64, py, dk(c, 0.2)); for (var k2 = 0; k2 < t.placket; k2++) b.set(63, 76 + k2 * 4, light ? dk(c, 0.4) : lt(c, 0.6)); }
    if (t.seams) b.paint(function (x, y) { var dx = Math.abs(x - 64); return (y > 82 && y < 83.2 && dx > 6) || (Math.abs(dx - 10) < 0.5 && y > 83); }, lt(c, 0.3));
    if (t.double) { [80, 86, 92].forEach(function (y) { b.set(57, y, dk(c, 0.4)); b.set(71, y, dk(c, 0.4)); }); }
    if (t.print === "wave") b.sprite(["..aa...aa", ".a..a.a..", "a....a..."], 60, 84, { a: light ? 0x8fd6b4 : WHITE });
    if (t.print === "star") b.sprite(["...a...", "..aaa..", "aaaaaaa", ".aaaaa.", "..aaa..", ".aa.aa.", ".a...a."], 61, 82, { a: 0xffd36e });
    b.outline(ol);
    if (t.sailor) drawBow(b, 64, 86, 0.55, 0xff8f96);
    b.onto(dst);
  }

  function drawSleeves(dst, look, G) {
    var t = spec(look, "top");
    if (t.sl === "none") return;
    var c = t.sleeve != null ? t.sleeve : PAL.cloth[look.top.c], ol = dk(c, 0.5);
    var b = new Buf(), pred;
    var a = G.arm;
    if (t.sl === "short") pred = armSeg(G, 0, 0.38, 1.3);
    else if (t.sl === "puff") pred = U(M(E(a[0] - 0.5, a[1] + 2, 5, 5)), armSeg(G, 0, 0.3, 1.2));
    else if (t.sl === "wide") pred = U(armSeg(G, 0, 0.88, 1.4), M(P([[39, 84], [48, 81], [49, 98], [37, 99]])));
    else pred = armSeg(G, 0, 0.92, 1.2);
    b.fill(pred, c);
    b.rim(dk(c, 0.16), 1, 1, c);
    if (t.stripes) patternPaint(b, "stripes", c, 73);
    if (t.dots && t.sleeve == null) patternPaint(b, "dots", c);
    if (t.sl === "long" || t.sl === "wide") b.paint(function (x, y) { return y > 95.5; }, dk(c, 0.12));
    if (t.cuffRib) b.paint(function (x, y) { return y > 94.5 && Math.floor(x) % 2 === 0; }, dk(c, 0.2));
    if (t.sleeveStripe) {
      var a2 = G.arm, outerStripe = M(C(a2[0] - a2[4] - 0.6, a2[1] + 1, a2[2] - a2[4] - 0.6, a2[3] - 3, 0.7));
      b.paint(outerStripe, lum(c) > 225 ? 0xff9fb7 : WHITE);
    }
    b.outline(ol);
    b.onto(dst);
  }

  function closedEye(d, cx) {
    for (var i = -5; i <= 4; i++) {
      var dist = Math.abs(i + 0.5);
      var y = 50 + Math.round(dist * 0.8);
      d.set(cx + i, y, INK);
      if (dist < 4) d.set(cx + i, y + 1, INK);
    }
  }

  function highlights(d, cx, icy, type, tiny) {
    var w = 0xffffff, a = cx - 3, t = Math.round(icy - 4.6);
    if (tiny) { d.set(cx - 1, 52, w); return; }
    function rect(x, y, ww, hh) { for (var yy = 0; yy < hh; yy++) for (var xx = 0; xx < ww; xx++) d.set(x + xx, y + yy, w); }
    switch (type) {
      case "star":
        [[0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [-2, 0], [-1, 0], [1, 0], [2, 0]].forEach(function (p) { d.set(a - 1 + p[0], t + 2 + p[1], w); });
        d.set(cx + 2, t + 7, w); break;
      case "heart":
        d.sprite(["w.w", "www", ".w."], a - 1, t, { w: w }); d.set(cx + 2, t + 7, w); break;
      case "sparkle":
        rect(a, t, 2, 2); d.set(cx + 1, t + 3, w); d.set(cx + 2, t + 7, w); d.set(cx - 2, t + 8, w); break;
      case "double":
        rect(a, t, 2, 3); rect(cx + 1, t + 5, 2, 2); break;
      default:
        rect(a, t, 2, 3); d.set(cx + 2, t + 7, w);
    }
  }

  /** Мужской глаз: горизонтальный миндаль, маленькая радужка, тонкое веко, без ресниц. */
  function drawBoyEye(d, cx, side, sp, c, S) {
    var shape = sp.shape;
    if (shape === "happy" || (sp.wink && side === 1)) {
      for (var i = -5; i <= 4; i++) { var dd = Math.abs(i + 0.5); d.set(cx + i, 52 + Math.round(dd * 0.55), INK); }
      return;
    }
    var halfW = shape === "narrow" ? 6.4 : 6;
    var open = { calm: 3.6, sharp: 3.4, sleepy: 2.4, soft: 4.4, squint: 2.2, narrow: 2.6, droopy: 3.6 }[shape] || 3.6;
    var cy = 54.5, tilt = sp.tilt || 0;
    function u(x) { return (x - cx) / halfW; }
    function outer(x) { var o = (x - cx) * side; return o > 0 ? o / halfW : 0; }
    var top = function (x) { var q = u(x); return cy - open * Math.pow(Math.max(0, 1 - q * q), 0.6) - outer(x) * tilt * 1.6; };
    var bot = function (x) { var q = u(x); return cy + open * 0.75 * Math.pow(Math.max(0, 1 - q * q), 0.9) - outer(x) * tilt * 0.7; };
    var opening = function (x, y) { return Math.abs(x - cx) <= halfW && y > top(x) && y < bot(x); };
    var box = [cx - 8, 44, cx + 8, 62];
    d.fill(opening, 0xffffff, box);
    var k = sp.iris || 1, iry = 3.8 * k, icy = cy - 0.2;
    var iris = I(E(cx, icy, 3.1 * k, iry), opening);
    d.fill(iris, function (x, y) { var yy = y + 0.5; return yy < icy - iry * 0.25 ? dk(c, 0.42) : yy < icy + iry * 0.4 ? c : lt(c, 0.3); }, box);
    d.fill(I(E(cx, icy, 1.2 * k, 1.8 * k), opening), dk(c, 0.65), box);
    var w = 0xffffff;
    var tx = cx - 2, ty = Math.round(icy - 1.6);
    if (sp.hl === "dot") d.set(tx, ty, w);
    else if (sp.hl === "big") { d.set(tx, ty, w); d.set(tx + 1, ty, w); d.set(tx, ty + 1, w); d.set(tx + 1, ty + 1, w); }
    else if (sp.hl === "two") { d.set(tx, ty, w); d.set(tx, ty + 1, w); d.set(cx + 1, ty + 3, w); }
    else if (sp.hl === "star") { d.set(tx, ty, w); d.set(tx - 1, ty, w); d.set(tx + 1, ty, w); d.set(tx, ty - 1, w); d.set(tx, ty + 1, w); }
    // верхнее веко: 1px, у внешнего уголка толще
    for (var x = cx - 6; x <= cx + 6; x++) {
      if (Math.abs(x + 0.5 - cx) > halfW + 0.3) continue;
      var y0 = Math.floor(top(x + 0.5));
      d.set(x, y0, INK);
      var o = (x + 0.5 - cx) * side;
      if (sp.thick || o > halfW * 0.45) d.set(x, y0 - 1, INK);
    }
    // острый внешний уголок
    var ox = side < 0 ? cx - 7 : cx + 6;
    d.set(ox, Math.floor(top(ox + 0.5 - side)) + (tilt > 0 ? -1 : 0), INK);
    // нижнее веко — только внешняя половина, мягко
    var lc = mix(INK, S, 0.6);
    for (var x2 = cx - 5; x2 <= cx + 5; x2++) {
      var o2 = (x2 + 0.5 - cx) * side;
      if (o2 > 0.5 || sp.lower) d.set(x2, Math.ceil(bot(x2 + 0.5)), lc);
    }
    if (sp.bags) for (var x3 = cx - 3; x3 <= cx + 2; x3++) d.set(x3, Math.ceil(bot(x3 + 0.5)) + 2, mix(INK, S, 0.8));
  }

  /** Мужские брови: прямые, плотные, близко к глазам; рисуются поверх чёлки (как в аниме). */
  function drawBoyBrows(dst, look, mood) {
    if (look.gender !== "boy") return;
    var sp = spec(look, "eyes"), type = mood === "sad" ? "worried" : (sp.brow || "flat");
    var col = dk(hairColor(look), 0.5), base = 46.2 + (sp.browY || 0);
    if (sp.shape === "sleepy" || sp.shape === "squint") base += 0.6;
    [[-1, 52], [1, 76]].forEach(function (e) {
      var side = e[0], cx = e[1];
      for (var i = 0; i < 10; i++) {
        var x = side < 0 ? cx + 4 - i : cx - 4 + i, t = i / 9, y = base;
        if (type === "angry") y += (1 - t) * 2.4 - 0.6;
        else if (type === "angled") y += (1 - t) * 1.2;
        else if (type === "worried") y -= (1 - t) * 2.2 - 0.6;
        else if (type === "raised") y -= 1 + Math.sin(Math.PI * t) * 0.8;
        else if (type === "arched") y -= Math.sin(Math.PI * t) * 1.3;
        else y += t * 0.7;
        var yy = Math.round(y);
        dst.set(x, yy, col);
        if (i > 0 && i < 8) dst.set(x, yy + 1, col);
      }
    });
  }

  function drawEye(d, cx, side, sp, c, S, girl) {
    var shape = sp.shape;
    if (shape === "closed" || (sp.wink && side === 1)) { closedEye(d, cx); return; }
    var tiny = shape === "tiny";
    var rx = tiny ? 3.1 : 4.7, ry = tiny ? 3.6 : shape === "tall" ? 6.6 : 5.8, icy = tiny ? 54 : 53.6;
    if (!girl && !tiny) { ry -= 0.5; icy += 0.3; }
    var box = [cx - 8, 42, cx + 8, 62];
    if (!tiny) d.fill(E(cx, 54.3, 6.1, 5.1), 0xffffff, box);
    var iris = E(cx, icy, rx, ry);
    d.fill(iris, function (x, y) {
      var yy = y + 0.5;
      if (yy < icy - ry * 0.3) return dk(c, 0.42);
      if (yy < icy + ry * 0.3) return c;
      return lt(c, 0.38);
    }, box);
    for (var y = 42; y < 62; y++) for (var x = cx - 8; x < cx + 8; x++) {
      if (iris(x + 0.5, y + 0.5) && (!iris(x - 0.5, y + 0.5) || !iris(x + 1.5, y + 0.5))) d.set(x, y, dk(c, 0.3));
    }
    if (sp.slit) d.fill(E(cx, icy, 0.9, ry * 0.62), dk(c, 0.7), box);
    else d.fill(E(cx, icy - 0.4, rx * 0.42, ry * 0.42), dk(c, 0.62), box);
    highlights(d, cx, icy, sp.hl, tiny);
    var lidBase = 47.6, curve = 2.4;
    if (shape === "sleepy") {
      d.fill(function (x, y) { return y < 51.5 && E(cx, 54, 7, 7.5)(x, y); }, S, box);
      lidBase = 51.6; curve = 0.8;
    }
    if (tiny) { lidBase = 50.6; curve = 1.2; }
    var lw = sp.thick ? 3 : 2, lidAt = {};
    for (var x2 = cx - 7; x2 <= cx + 6; x2++) {
      var u = (x2 + 0.5 - cx) / 6.6;
      if (Math.abs(u) > 1) continue;
      if (tiny && Math.abs(u) > 0.62) continue;
      var outer = (x2 + 0.5 - cx) * side;
      var y0 = lidBase - curve * (1 - u * u);
      if (shape === "droopy" && outer > 0) y0 += outer * 0.28;
      if (shape === "sharp" && outer > 0) y0 -= outer * 0.3;
      y0 = Math.round(y0);
      lidAt[x2] = y0;
      for (var k = 0; k < (tiny ? 1 : lw); k++) d.set(x2, y0 + k, INK);
    }
    if (!tiny && (girl || sp.lash)) {
      var ox = side < 0 ? cx - 7 : cx + 6, oy = lidAt[ox];
      d.set(ox + side, oy - 1, INK);
      d.set(ox + side, oy, INK);
      if (sp.lash) { d.set(ox + 2 * side, oy - 2, INK); d.set(ox, oy - 1, INK); }
    }
    if (!tiny) {
      var lc = mix(INK, S, 0.55);
      for (var x3 = cx - 3; x3 <= cx + 2; x3++) d.set(x3, 59, lc);
      if (sp.lash) d.set(side < 0 ? cx - 5 : cx + 4, 58, lc);
    }
  }

  function drawFace(dst, look, mood) {
    var S = PAL.skin[look.skin], sh = dk(S, 0.16), ol = dk(S, 0.5);
    var boy = look.gender === "boy";
    var f = new Buf();
    f.fill(U(boy ? facePredBoy : facePred, M(E(41.5, 52, 3, 4.5))), S, [34, 18, 94, 76]);
    f.rim(sh, 1, 1, S);
    f.outline(ol);
    if (!boy || mood === "happy") f.paint(M(E(47.5, 61.6, 3.4, 1.5)), mix(S, 0xff7f9a, boy ? 0.22 : mood === "happy" ? 0.55 : 0.38));
    f.set(64, 61, dk(S, 0.22));
    if (boy) f.set(64, 62, dk(S, 0.12));
    var sp = spec(look, "eyes"), ec = PAL.eyes[look.eyes.c];
    if (boy) { drawBoyEye(f, 52, -1, sp, ec, S); drawBoyEye(f, 76, 1, sp, ec, S); }
    else { drawEye(f, 52, -1, sp, ec, S, true); drawEye(f, 76, 1, sp, ec, S, true); }
    // рот
    var mc = PAL.mouth[look.mouth.c];
    var g = mood === "sad" ? SAD_MOUTH : MOUTHS[look.mouth.v].g;
    var w = g[0].length, x0 = 64 - Math.floor(w / 2), y0 = 64 - Math.floor((g.length - 1) / 2) + (boy ? 1 : 0);
    if (w % 2) x0 = 64 - Math.floor(w / 2);
    f.sprite(g, x0, y0, { o: dk(mc, 0.5), m: mc, t: lt(mc, 0.45), w: 0xffffff, f: 0xffffff });
    f.onto(dst);
  }

  function drawAccessory(dst, look) {
    var a = ACCS[look.accessory.v].id;
    if (a === "none") return;
    var c = PAL.acc[look.accessory.c], ol = dk(c, 0.5), b = new Buf();
    var pink = c === 0xff8fab ? 0xffd0dc : 0xffb3c7;
    switch (a) {
      case "bow": drawBow(b, 83, 21, 1.15, c); break;
      case "bows": drawBow(b, 39, 34, 0.7, c); drawBow(b, 89, 34, 0.7, c); break;
      case "cat":
        b.fill(M(P([[40, 28], [45, 7], [58, 19]])), c);
        b.fill(M(P([[44, 22], [46, 12], [53, 19]])), pink);
        break;
      case "bunny":
        b.fill(U(E(53, 7, 4.5, 13), E(75, 7, 4.5, 13)), c);
        b.fill(U(E(53, 8, 2, 9), E(75, 8, 2, 9)), pink);
        break;
      case "flower":
        for (var i = 0; i < 5; i++) { var an = -Math.PI / 2 + i * 2 * Math.PI / 5; b.fill(E(84 + Math.cos(an) * 3.6, 25 + Math.sin(an) * 3.6, 2.8, 2.8), c); }
        b.fill(E(84, 25, 2, 2), 0xffd36e);
        break;
      case "glasses":
        b.fill(U(M(N(E(52, 53.5, 8, 7.5), E(52, 53.5, 6.6, 6.1))), R(59, 52, 69, 53.2), M(R(37, 51, 44.5, 52.2))), c);
        break;
      case "star": b.fill(starP(83, 29, 6, 2.6), c); b.set(81, 27, lt(c, 0.6)); break;
      case "heart": b.fill(heartP(83, 28, 4), c); b.set(81, 26, lt(c, 0.6)); break;
      case "band":
        b.fill(function (x, y) { return y < 31 && E(64, 40, 27.5, 26)(x, y) && !E(64, 41, 25, 23.5)(x, y); }, c);
        break;
      case "beret":
        b.fill(U(E(60, 18, 25, 8.5), C(60, 10, 61, 7, 1.3)), c);
        b.paint(function (x, y) { return y > 22; }, dk(c, 0.18));
        break;
      case "tiara":
        b.fill(U(R(54, 16, 74, 20), P([[54, 17], [56, 9], [59, 17]]), P([[60, 17], [64, 6], [68, 17]]), P([[69, 17], [72, 9], [74, 17]])), c);
        b.set(64, 13, 0xff8fab); b.set(64, 14, 0xff8fab); b.set(56, 14, 0xa8d4f5); b.set(72, 14, 0xa8d4f5);
        break;
      case "phones":
        b.fill(function (x, y) { return y < 46 && E(64, 41, 29.5, 27.5)(x, y) && !E(64, 42, 27, 25)(x, y); }, dk(c, 0.15));
        b.fill(M(E(37.5, 51, 4.6, 7)), c);
        b.paint(M(E(36.5, 50, 1.6, 3)), lt(c, 0.45));
        break;
      case "halo":
        b.fill(N(E(64, 8, 14, 3.6), E(64, 8, 10.5, 1.8)), c);
        break;
      case "sprout":
        b.fill(R(63.5, 9, 65, 18), 0x6fb08e);
        b.fill(U(E(60, 8, 4, 2.2), E(69, 7, 4, 2.2)), c);
        break;
      case "scarf":
        b.fill(U(function (x, y) { return y >= 69 && y < 78 && Math.abs(x - 64) <= 13 - Math.max(0, 72 - y) * 1.5; }, R(66, 76, 72, 92)), c);
        b.paint(function (x, y) { return Math.floor(y) % 3 === 0; }, dk(c, 0.15));
        b.paint(R(66, 90, 72, 92), lt(c, 0.4));
        break;
      case "choker":
        b.fill(R(59, 70, 69, 72), dk(c, 0.2));
        b.fill(heartP(64, 73.5, 1.6), c);
        break;
      case "earrings":
        b.fill(M(U(R(40, 60, 41, 63), E(40.5, 64.5, 1.8, 1.8))), c);
        break;
      case "hat":
        b.fill(U(I(E(64, 18, 22, 13), function (x, y) { return y < 24; }), E(64, 24, 38, 6.5)), c);
        b.paint(R(0, 19, 128, 22.5), pink === 0xffd0dc ? 0x8fd6b4 : 0xff9fb7);
        b.paint(function (x, y) { return y > 25; }, dk(c, 0.12));
        break;
      case "wreath":
        for (var k = 0; k < 9; k++) {
          var ang = Math.PI + (k + 0.5) * Math.PI / 9;
          var fx = 64 + Math.cos(ang) * 25, fy = 38 + Math.sin(ang) * 21;
          b.fill(E(fx, fy, 3, 3), k % 2 ? lt(c, 0.45) : c, [fx - 4, fy - 4, fx + 4, fy + 4]);
          b.set(Math.floor(fx), Math.floor(fy), 0xffd36e);
          if (k < 8) { var ang2 = ang + Math.PI / 18; b.fill(E(64 + Math.cos(ang2) * 26.5, 38 + Math.sin(ang2) * 22.5, 1.6, 1.2), 0x6fb08e); }
        }
        break;
    }
    b.outline(ol);
    b.onto(dst);
  }

  function drawMood(dst, look, mood) {
    if (mood === "sad") {
      var hc = dk(hairColor(look), 0.35);
      if (look.gender !== "boy") [-1, 1].forEach(function (s) {
        var pts = [[-4, 44], [-3, 44], [-2, 43], [-1, 43], [0, 42], [1, 42]];
        pts.forEach(function (p) { var x = s < 0 ? 52 + p[0] : 75 - p[0]; dst.set(x, p[1], hc); });
      });
      [[45, 58], [45, 59], [44, 60], [83, 58], [83, 59], [84, 60]].forEach(function (p) { dst.set(p[0], p[1], 0x8fd0f2); });
      var cl = new Buf();
      cl.fill(U(E(55, 8, 9, 5), E(65, 6, 9, 6), E(74, 9, 8, 4.5), R(48, 8, 80, 13)), 0xdfe8f0);
      cl.paint(function (x, y) { return y > 10.5; }, 0xc6d4e1);
      cl.outline(0x8fa3b5);
      cl.onto(dst);
      [[54, 17], [62, 20], [70, 17], [78, 21], [58, 25]].forEach(function (p) { dst.set(p[0], p[1], 0x7fb8e6); dst.set(p[0], p[1] + 1, 0x7fb8e6); });
    } else if (mood === "happy") {
      var spark = function (x, y, c, big) {
        dst.set(x, y, 0xffffff);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (p) { dst.set(x + p[0], y + p[1], c); });
        if (big) [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(function (p) { dst.set(x + p[0], y + p[1], c); });
      };
      spark(24, 34, 0xffd36e, true); spark(104, 26, 0xff9fb7, true); spark(102, 72, 0xffd36e, false);
      spark(26, 80, 0xff9fb7, false); spark(16, 56, 0xa3dcc4, false); spark(112, 50, 0xa3dcc4, false);
      var hb = new Buf(); hb.fill(heartP(98, 40, 3), 0xff8fab); hb.outline(0xd65f84); hb.onto(dst);
    }
  }

  /* ---------- фоны ---------- */
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function vgrad(b, y0, y1, cols, x0, x1) {
    x0 = x0 || 0; x1 = x1 == null ? W : x1;
    var n = cols.length - 1;
    for (var y = y0; y < y1; y++) {
      var t = (y - y0) / Math.max(1, y1 - y0 - 1) * n;
      var base = Math.min(n - 1, Math.floor(t)), fr = t - base;
      var lvl = fr * 3, li = Math.floor(lvl), lf = lvl - li;
      for (var x = x0; x < x1; x++) {
        var th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        var step = li + (lf > th ? 1 : 0);
        b.set(x, y, mix(cols[base], cols[base + 1], Math.min(1, step / 3)));
      }
    }
  }
  function shape(b, pred, c, ol) { var t = new Buf(); t.fill(pred, c); if (ol != null) t.outline(ol); t.onto(b); }
  function flowerAt(b, x, y, c) {
    b.set(x, y - 1, c); b.set(x - 1, y, c); b.set(x + 1, y, c); b.set(x, y + 1, c); b.set(x, y, 0xffd36e);
  }
  function cloud(b, x, y, s, c) { shape(b, U(E(x, y, 9 * s, 4 * s), E(x + 6 * s, y - 3 * s, 6 * s, 4.5 * s), E(x - 6 * s, y + 0.5, 5 * s, 3 * s)), c); }

  var SCENES = {
    room: function (b) {
      vgrad(b, 0, 92, [0xfff0f4, 0xffdce7]);
      for (var y = 6; y < 88; y += 12) for (var x = ((y / 12) & 1) * 6 + 3; x < 128; x += 12) { b.set(x, y, 0xffc4d4); b.set(x - 1, y, 0xffc4d4); b.set(x + 1, y, 0xffc4d4); b.set(x, y + 1, 0xffc4d4); }
      shape(b, R(14, 14, 50, 56), 0xffffff, 0xe6b5c4);
      vgrad(b, 17, 53, [0xbfe6ff, 0xe8f7ff], 17, 47);
      cloud(b, 28, 30, 0.7, 0xffffff);
      shape(b, U(R(31, 16, 33, 54), R(16, 34, 48, 36)), 0xffffff);
      shape(b, R(5, 8, 59, 10), 0xd9a58a, 0xb88468);
      shape(b, U(P([[7, 10], [19, 10], [16, 60], [8, 62]]), P([[45, 10], [57, 10], [56, 62], [48, 60]])), 0xffb3c7, 0xe68aa5);
      for (var cy = 14; cy < 58; cy += 2) { b.set(12, cy, 0xf59ab4); b.set(52, cy, 0xf59ab4); }
      shape(b, R(90, 50, 124, 53), 0xe0b48f, 0xb88a6a);
      shape(b, R(93, 38, 97, 50), 0xa3dcc4, 0x6fae94); shape(b, R(97, 41, 101, 50), 0xffb3c7, 0xe68aa5); shape(b, R(101, 36, 105, 50), 0xffe6a8, 0xd6b67a);
      shape(b, P([[110, 44], [120, 44], [118, 50], [112, 50]]), 0xffa98f, 0xd9806a);
      shape(b, U(E(113, 40, 3, 4), E(117, 39, 3, 4.5), E(115, 36, 2.5, 4)), 0x8fd6b4, 0x5fa884);
      shape(b, R(0, 89, 128, 93), 0xffffff, 0xe6c8b8);
      vgrad(b, 93, 128, [0xf8dcc4, 0xefc6a6]);
      [100, 110, 121].forEach(function (y) { for (var x = 0; x < 128; x++) b.set(x, y, 0xe2b493); });
      for (var r = 0; r < 4; r++) { var yy = [93, 101, 111, 122][r]; for (var xx = (r * 23) % 40; xx < 128; xx += 40) for (var k = yy; k < yy + 7 && k < 128; k++) b.set(xx, k, 0xe2b493); }
      shape(b, P([[100, 96], [120, 96], [117, 114], [103, 114]]), 0xffa98f, 0xd9806a);
      shape(b, U(E(104, 86, 6, 9), E(114, 84, 6, 10), E(109, 79, 5, 9), E(98, 92, 5, 4), E(120, 91, 5, 4)), 0x8fd6b4, 0x5fa884);
      b.fill(U(E(104, 86, 2, 5), E(114, 84, 2, 6)), 0xb5e8cf);
      shape(b, E(64, 119, 46, 8), 0xbfeedd, 0x8fcdb2);
      b.fill(N(E(64, 119, 40, 6), E(64, 119, 37, 5)), 0xffffff);
    },
    garden: function (b) {
      vgrad(b, 0, 82, [0xc4e8ff, 0xeaf7ff, 0xfff6f8]);
      cloud(b, 24, 18, 1, 0xffffff); cloud(b, 98, 12, 0.8, 0xffffff); cloud(b, 70, 30, 0.6, 0xffffff);
      for (var x = 0; x < 128; x++) {
        var top = Math.round(64 + 3 * Math.sin(x / 6) + 2 * Math.sin(x / 2.3));
        for (var y = top; y < 92; y++) b.set(x, y, (hash(x * 131 + y * 7) < 0.15) ? 0x86cfa5 : 0x9bdcb6);
        b.set(x, top, 0x7fc49c);
      }
      var r = rng(11);
      for (var i = 0; i < 26; i++) flowerAt(b, Math.floor(r() * 128), 66 + Math.floor(r() * 22), [0xffb3c7, 0xffffff, 0xffe6a8][i % 3]);
      for (var px = 2; px < 128; px += 11) shape(b, U(R(px, 76, px + 6, 94), P([[px, 76], [px + 3, 72], [px + 6, 76]])), 0xffffff, 0xd7c9c4);
      shape(b, U(R(0, 79, 128, 81), R(0, 87, 128, 89)), 0xffffff);
      vgrad(b, 93, 128, [0xc4efd5, 0xa4dfbc]);
      for (var j = 0; j < 60; j++) {
        var fx = Math.floor(r() * 128), fy = 96 + Math.floor(r() * 30);
        b.set(fx, fy + 2, 0x6fb08e); b.set(fx, fy + 3, 0x6fb08e);
        flowerAt(b, fx, fy, [0xffb3c7, 0xffffff, 0xffe6a8, 0xffc9a8, 0xff8fab][j % 5]);
      }
      [[22, 40], [104, 46]].forEach(function (p) { b.sprite(["p.p", ".k.", "p.p"], p[0], p[1], { p: 0xff9fb7, k: 0x6b4532 }); });
    },
    sakura: function (b) {
      vgrad(b, 0, 96, [0xffe0ec, 0xfff4ef]);
      for (var x = 0; x < 128; x++) { var top = Math.round(80 + 4 * Math.sin(x / 13 + 1)); for (var y = top; y < 96; y++) b.set(x, y, 0xd3eedf); }
      shape(b, U(R(7, 30, 18, 128), C(13, 62, 36, 36, 2.6), C(12, 50, 0, 32, 2.2), C(16, 40, 26, 22, 2)), 0xb98b76, 0x8c6454);
      shape(b, U(R(112, 20, 120, 128), C(116, 44, 96, 24, 2.2)), 0xb98b76, 0x8c6454);
      var canopy = U(E(14, 18, 30, 18), E(36, 28, 16, 11), E(-4, 34, 14, 10), E(112, 12, 26, 16), E(96, 22, 14, 9), E(126, 30, 12, 10));
      b.fill(canopy, function (x, y) { var hv = hash(x * 57 + y * 911); return hv < 0.2 ? 0xffa6c2 : hv < 0.75 ? 0xffc2d6 : 0xffe0ea; });
      shape(b, P([[44, 128], [84, 128], [70, 96], [58, 96]]), 0xf7e7d8);
      vgrad(b, 96, 128, [0xccefd9, 0xb5e6c9], 0, 1);
      for (var yy = 96; yy < 128; yy++) for (var xx = 0; xx < 128; xx++) {
        var edgeL = 58 - (yy - 96) * 0.44, edgeR = 70 + (yy - 96) * 0.44;
        if (xx < edgeL || xx > edgeR) b.set(xx, yy, hash(xx * 13 + yy * 71) < 0.1 ? 0xa8dfbe : 0xc4ecd4);
      }
      var r = rng(5);
      for (var i = 0; i < 34; i++) { var px = Math.floor(r() * 128), py = Math.floor(r() * 124); b.set(px, py, 0xff9fbd); b.set(px + 1, py, 0xffc2d6); }
    },
    beach: function (b) {
      vgrad(b, 0, 72, [0xffbfd0, 0xffd6b8, 0xfff0c8]);
      shape(b, I(E(96, 72, 14, 14), R(0, 0, 128, 72)), 0xfff6dc);
      b.fill(I(N(E(96, 72, 17, 17), E(96, 72, 14, 14)), function (x, y) { return y < 72 && (Math.floor(x) + Math.floor(y)) % 2 === 0; }), 0xfff0d0);
      cloud(b, 28, 22, 1.1, 0xffe4ec); cloud(b, 70, 36, 0.7, 0xffeef2);
      vgrad(b, 72, 98, [0xa3dfd3, 0x7fcfc4]);
      var r = rng(9);
      for (var i = 0; i < 14; i++) { var y = 74 + Math.floor(r() * 22), x0 = 84 + Math.floor(r() * 18), len = 2 + Math.floor(r() * 6); for (var k = 0; k < len; k++) b.set(x0 + k, y, 0xfff4dc); }
      for (var j = 0; j < 16; j++) { var wy = 76 + Math.floor(r() * 20), wx = Math.floor(r() * 120); for (var q = 0; q < 4; q++) b.set(wx + q, wy, 0xd4f3ec); }
      vgrad(b, 98, 128, [0xfbe8cf, 0xf3d6b4]);
      for (var x = 0; x < 128; x++) { var fy = 98 + Math.round(1.5 * Math.sin(x / 5)); b.set(x, fy, 0xffffff); b.set(x, fy + 1, 0xffffff); }
      shape(b, starP(20, 116, 6, 2.6), 0xffa98f, 0xd9806a);
      shape(b, U(E(108, 120, 5, 4), R(103, 120, 113, 123)), 0xffd0dc, 0xe68aa5);
      for (var s = 0; s < 3; s++) b.set(105 + s * 3, 118, 0xe68aa5);
    },
    night: function (b) {
      vgrad(b, 0, 100, [0x2c4b5e, 0x4f7f8c, 0xe9aabd]);
      var r = rng(21);
      for (var i = 0; i < 48; i++) {
        var x = Math.floor(r() * 128), y = Math.floor(r() * 70), c = i % 4 ? 0xffffff : 0xffe6a8;
        b.set(x, y, c);
        if (i % 9 === 0) { b.set(x - 1, y, c); b.set(x + 1, y, c); b.set(x, y - 1, c); b.set(x, y + 1, c); }
      }
      shape(b, N(E(100, 22, 10, 10), E(105, 18, 9, 9)), 0xfff2c4);
      for (var x2 = 0; x2 < 128; x2++) { var t1 = Math.round(84 + 5 * Math.sin(x2 / 11)); for (var y2 = t1; y2 < 128; y2++) b.set(x2, y2, 0x6fae9c); }
      for (var x3 = 0; x3 < 128; x3++) { var t2 = Math.round(98 + 4 * Math.sin(x3 / 9 + 2)); for (var y3 = t2; y3 < 128; y3++) b.set(x3, y3, hash(x3 * 31 + y3 * 17) < 0.08 ? 0x5a9a88 : 0x4f8f80); }
      for (var j = 0; j < 22; j++) { var fx = Math.floor(r() * 128), fy = 100 + Math.floor(r() * 26); b.set(fx, fy, j % 2 ? 0xff9fbd : 0xfff2c4); }
      [[20, 70], [108, 64], [84, 80]].forEach(function (p) { b.set(p[0], p[1], 0xfff2a0); b.set(p[0] + 1, p[1], 0xfff8d0); });
    },
    cafe: function (b) {
      vgrad(b, 0, 74, [0xfff6ea, 0xffeedd]);
      shape(b, R(0, 72, 128, 100), 0xbfe8d4);
      for (var px = 8; px < 128; px += 16) for (var y = 76; y < 97; y++) b.set(px, y, 0xa3d9c0);
      shape(b, R(0, 70, 128, 73), 0xffffff, 0xd7c9c4);
      for (var ty = 100; ty < 128; ty++) for (var tx = 0; tx < 128; tx++) b.set(tx, ty, ((tx >> 3) + (ty >> 3)) & 1 ? 0xdff5ea : 0xffffff);
      for (var ax = 0; ax < 128; ax++) for (var ay = 0; ay < 16; ay++) {
        var stripe = Math.floor(ax / 8) & 1, edge = 12 + Math.round(2.5 * Math.sin(((ax % 8) / 8) * Math.PI));
        if (ay < edge) b.set(ax, ay, stripe ? 0xffb3c7 : 0xffffff);
      }
      shape(b, R(8, 22, 42, 58), 0xffffff, 0xd9b8a8);
      vgrad(b, 25, 55, [0xcdeeff, 0xf1faff], 11, 39);
      shape(b, U(R(24, 24, 26, 56), R(10, 39, 40, 41)), 0xffffff);
      shape(b, R(86, 22, 120, 50), 0x4f7d70, 0xb88a6a);
      for (var ly = 27; ly < 46; ly += 5) for (var lx = 90; lx < 90 + 16 + (ly % 3) * 3; lx++) if (lx % 3) b.set(lx, ly, 0xeaf6f0);
      b.fill(heartP(112, 28, 2.4), 0xffb3c7);
      shape(b, R(50, 34, 78, 36), 0xe0b48f, 0xb88a6a);
      [52, 60, 68].forEach(function (cx, i) { shape(b, U(R(cx, 28, cx + 6, 34), R(cx + 6, 30, cx + 8, 32)), [0xffb3c7, 0xffffff, 0xa3dcc4][i], 0xb88a8a); });
      [30, 98].forEach(function (lx) { for (var y = 14; y < 20; y++) b.set(lx, y, 0x8c6454); shape(b, I(E(lx, 24, 6, 5), R(0, 19, 128, 25)), 0xffe6a8, 0xd6b67a); b.set(lx, 25, 0xfff6dc); });
    },
    plants: function (b) {
      vgrad(b, 0, 96, [0xeefaf3, 0xdcf2e6]);
      for (var x = 0; x < 128; x++) { var y = Math.round(14 + 5 * Math.sin(x / 10)); b.set(x, y, 0x9a8a7a); if (x % 8 === 4) { b.set(x, y + 1, 0xffe08a); b.set(x, y + 2, 0xffe08a); b.set(x - 1, y + 2, 0xfff4c4); b.set(x + 1, y + 2, 0xfff4c4); } }
      shape(b, R(0, 56, 38, 100), 0xe8c9a8, 0xc49a7a);
      shape(b, E(18, 72, 14, 6), 0xffffff, 0xd7c9c4);
      shape(b, R(0, 78, 46, 104), 0xffb3c7, 0xe68aa5);
      b.fill(function (x, y) { return x < 46 && y > 79 && y < 103 && (Math.floor(x) + Math.floor(y) * 3) % 7 === 0; }, 0xffffff);
      vgrad(b, 96, 128, [0xf7e0cc, 0xefcfb6]);
      for (var fx = 46; fx < 128; fx++) b.set(fx, 104, 0xe2b493);
      shape(b, P([[98, 96], [120, 96], [117, 116], [101, 116]]), 0xffffff, 0xd7c9c4);
      shape(b, U(E(103, 84, 6, 12), E(115, 82, 6, 13), E(109, 74, 5, 11), E(96, 92, 6, 5), E(122, 91, 6, 5)), 0x8fd6b4, 0x5fa884);
      b.fill(U(E(103, 84, 2, 7), E(115, 82, 2, 8), E(109, 74, 1.5, 6)), 0xb5e8cf);
      shape(b, P([[94, 22], [108, 22], [106, 30], [96, 30]]), 0xffc9a8, 0xd99a7a);
      for (var v = 0; v < 4; v++) for (var vy = 30; vy < 30 + 10 + v * 5; vy++) { var vx = 95 + v * 4 + Math.round(Math.sin(vy / 3 + v)); b.set(vx, vy, 0x6fb08e); if (vy % 4 === 0) { b.set(vx + 1, vy, 0x8fd6b4); b.set(vx - 1, vy, 0x8fd6b4); } }
      shape(b, R(56, 40, 84, 43), 0xe0b48f, 0xb88a6a);
      shape(b, R(78, 34, 83, 40), 0xffb3c7, 0xe68aa5); shape(b, U(R(79, 28, 82, 34)), 0x8fd6b4, 0x5fa884);
    },
    rain: function (b) {
      vgrad(b, 0, 128, [0xfff0e6, 0xffe2d6]);
      shape(b, R(12, 8, 116, 94), 0xffffff, 0xd9c2b8);
      vgrad(b, 12, 90, [0x9fb6c6, 0xcbd9e2], 16, 112);
      for (var bx = 16; bx < 112; bx += 9) { var h = 18 + Math.floor(hash(bx) * 22); for (var by = 90 - h; by < 90; by++) for (var k = 0; k < 7; k++) b.set(bx + k, by, 0xb2c6d2); }
      var r = rng(3);
      for (var i = 0; i < 70; i++) { var x = 16 + Math.floor(r() * 94), y = 12 + Math.floor(r() * 74); for (var q = 0; q < 4; q++) b.set(x + Math.floor(q / 2), y + q, 0xe8f1f6); }
      for (var j = 0; j < 14; j++) { var dx = 18 + Math.floor(r() * 90), dy = 16 + Math.floor(r() * 70); b.set(dx, dy, 0xffffff); b.set(dx, dy + 1, 0xd5e4ee); b.set(dx + 1, dy + 1, 0xd5e4ee); b.set(dx, dy + 2, 0xc2d6e3); }
      shape(b, U(R(62, 10, 66, 92), R(14, 48, 114, 52)), 0xffffff);
      shape(b, R(6, 92, 122, 98), 0xf3e2d6, 0xd9c2b8);
      shape(b, U(P([[0, 4], [14, 4], [11, 100], [0, 104]]), P([[114, 4], [128, 4], [128, 104], [117, 100]])), 0xffb3c7, 0xe68aa5);
      shape(b, U(R(20, 84, 28, 92), R(28, 86, 30, 90)), 0xffb3c7, 0xc97a90);
      [[22, 81], [24, 79], [23, 77]].forEach(function (p) { b.set(p[0], p[1], 0xffffff); });
      shape(b, R(100, 84, 104, 92), 0xfff6e6, 0xd6c0a8); b.set(102, 82, 0xffb84d); b.set(102, 83, 0xffe08a);
      shape(b, P([[108, 86], [116, 86], [115, 92], [109, 92]]), 0xffa98f, 0xd9806a);
      shape(b, U(E(110, 82, 2.5, 3.5), E(114, 81, 2.5, 4)), 0x8fd6b4, 0x5fa884);
    }
  };

  /* ---------- сборка ---------- */
  function compose(look, opts) {
    opts = opts || {};
    look = normalizeLook(look);
    var dst = new Buf();
    if (opts.bg && SCENES[opts.bg]) {
      SCENES[opts.bg](dst);
      var sh = E(64, 123.5, 24, 3.2);
      for (var y = 118; y < 128; y++) for (var x = 36; x < 92; x++) if (sh(x + 0.5, y + 0.5)) dst.d[y * W + x] = mix(dst.d[y * W + x], 0x6a4450, 0.2);
    }
    var G = geom(look.gender);
    hairBack(dst, look);
    drawBodyBase(dst, look, G);
    drawBottom(dst, look, G);
    drawTop(dst, look, G);
    drawArms(dst, look, G);
    drawSleeves(dst, look, G);
    drawFace(dst, look, opts.mood);
    var eyesOnly = opts.focus === "eyes"; // миниатюры глаз: без чёлки и аксессуаров
    if (!eyesOnly) hairFront(dst, look);
    drawBoyBrows(dst, look, opts.mood);
    if (!eyesOnly) drawAccessory(dst, look);
    drawMood(dst, look, opts.mood);
    return dst;
  }

  function toCanvas(buf, canvas, crop) {
    var cx = 0, cy = 0, cw = W, ch = H;
    if (crop) { cx = crop[0]; cy = crop[1]; cw = crop[2]; ch = crop[3]; }
    canvas.width = cw; canvas.height = ch;
    var ctx = canvas.getContext("2d");
    var img = ctx.createImageData(cw, ch);
    for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
      var sx = x + cx, sy = y + cy, o = (y * cw + x) * 4;
      var c = (sx < 0 || sy < 0 || sx >= W || sy >= H) ? -1 : buf.d[sy * W + sx];
      if (c === -1) { img.data[o + 3] = 0; continue; }
      img.data[o] = (c >> 16) & 255; img.data[o + 1] = (c >> 8) & 255; img.data[o + 2] = c & 255; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Рисует героя на canvas. opts: { bg, mood: "sad"|"happy"|null, crop:[x,y,w,h], focus: "eyes" } */
  function render(canvas, look, opts) {
    opts = opts || {};
    toCanvas(compose(look, opts), canvas, opts.crop);
  }
  function renderBackground(canvas, id) {
    var b = new Buf();
    if (SCENES[id]) SCENES[id](b);
    toCanvas(b, canvas);
  }
  function hex(c) { return "#" + ("000000" + c.toString(16)).slice(-6); }

  window.KvestHeroArt = {
    render: render,
    renderBackground: renderBackground,
    normalizeLook: normalizeLook,
    DEFAULT_LOOK: DEFAULT_LOOK,
    PARTS: PARTS,
    variants: variants,
    variantValue: variantValue,
    variantIndex: variantIndex,
    isGendered: function (part) { return !!GENDERED[part]; },
    PART_PAL: PART_PAL,
    PAL: PAL,
    PAL_NAMES: PAL_NAMES,
    BACKGROUNDS: BACKGROUNDS,
    hex: hex,
    CROPS: {
      hair: [22, 0, 84, 84], eyes: [40, 41, 48, 24], mouth: [48, 52, 32, 22], accessory: [18, 0, 92, 92],
      top: [28, 62, 72, 52], bottom: [30, 88, 68, 40]
    }
  };
})();
