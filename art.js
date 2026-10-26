/* art.js — оригинальная пиксель-арт графика: спрайты из текстовых сеток → inline SVG
   (shape-rendering="crispEdges") и ночная сцена на фоне. */
(function () {
  "use strict";

  var PAL = {
    K: "#120a2e", // контур
    k: "#0b0618", // кошка
    V: "#4b2c8f",
    L: "#b69cff",
    l: "#e2d6ff",
    P: "#ff8fc7",
    p: "#ffc8e6",
    O: "#ff9a3c",
    o: "#ffc37a",
    Y: "#fff3b0",
    W: "#ffffff",
    G: "#6ee7a8",
    g: "#2f9e6a",
    R: "#ff5d73",
    r: "#c2334a",
    B: "#7ad7ff",
    b: "#3d8fd1",
    S: "#8a83a8",
    s: "#5a4f86"
  };

  var SPRITES = {
    moon: [
      ".....oooooo.....",
      "...ooYYYYYYoo...",
      "..oYYYYYYYYYYo..",
      ".oYYYYYYYooYYYo.",
      ".oYYYYYYYooYYYo.",
      "oYYooYYYYYYYYYYo",
      "oYYooYYYYYYYYYYo",
      "oYYYYYYYYYYYYYYo",
      "oYYYYYYYYYoYYYYo",
      "oYYYYYYYYYYYYYYo",
      "oYYYYooYYYYYYYYo",
      ".oYYYooYYYYYYYo.",
      ".oYYYYYYYYYYYYo.",
      "..oYYYYYYYYYYo..",
      "...ooYYYYYYoo...",
      ".....oooooo....."
    ],
    door: [
      ".KKKKKKKK.",
      "KLLLLLLLLK",
      "KLOOOOOOLK",
      "KLOooooOLK",
      "KLOoOOoOLK",
      "KLOoOOoOLK",
      "KLOooooOLK",
      "KLOOOOOOLK",
      "KLOOOOYOLK",
      "KLOOOOOOLK",
      "KLOooooOLK",
      "KLOoOOoOLK",
      "KLOoOOoOLK",
      "KLOooooOLK",
      "KLOOOOOOLK",
      "KKKKKKKKKK"
    ],
    doorOpen: [
      ".KKKKKKKK.",
      "KLLLLLLLLK",
      "KLYYYYYOLK",
      "KLYWWYYOLK",
      "KLYWYYYoLK",
      "KLYYYYYoLK",
      "KLYYYYYOLK",
      "KLYYYYYOLK",
      "KLYYYYYYLK",
      "KLYYYYYOLK",
      "KLYYYYYoLK",
      "KLYYYYYoLK",
      "KLYYYYYOLK",
      "KLYYYYYOLK",
      "KLYYYYYOLK",
      "KKKKKKKKKK"
    ],
    frame: [
      "OOOOOOOOOOOO",
      "OooooooooooO",
      "Oo........oO",
      "Oo........oO",
      "Oo........oO",
      "Oo........oO",
      "Oo........oO",
      "OooooooooooO",
      "OOOOOOOOOOOO"
    ],
    frameL: [
      "LLLLLLLLLL",
      "LllllllllL",
      "Ll......lL",
      "Ll......lL",
      "Ll......lL",
      "Ll......lL",
      "Ll......lL",
      "Ll......lL",
      "LllllllllL",
      "LLLLLLLLLL"
    ],
    chest: [
      "..KKKKKKKK..",
      ".KOOOOOOOOK.",
      "KOooooooooOK",
      "KKKKKKKKKKKK",
      "KOOOOYYOOOOK",
      "KOOOOYYOOOOK",
      "KOooooooooOK",
      "KOOOOOOOOOOK",
      "KKKKKKKKKKKK"
    ],
    bag: [
      "...KKKK...",
      "..K....K..",
      "..K....K..",
      "KKKKKKKKKK",
      "KPPPPPPPPK",
      "KPppPPPPPK",
      "KPpPPPPPPK",
      "KPPPPPPPPK",
      "KPPPPPPPPK",
      "KPPPPPPPPK",
      "KKKKKKKKKK"
    ],
    cat: [
      ".k.......k....",
      ".kk.....kk....",
      ".kkkkkkkkk....",
      ".kkYkkkYkk....",
      ".kkkkPkkkk....",
      "..kkkkkkk.....",
      "..kkkkkkk.....",
      ".kkkkkkkkk....",
      ".kkkkkkkkk..k.",
      "kkkkkkkkkkk.k.",
      "kkkkkkkkkkk.k.",
      "kkkkkkkkkkkkk.",
      ".kkkkkkkkkkk..",
      "..kk.kk.kk...."
    ],
    flower: [
      "..P.P..",
      ".PpYpP.",
      "..PPP..",
      "...g...",
      ".G.g...",
      "..Gg.G.",
      "...gG..",
      "...g..."
    ],
    flowerL: [
      "..L.L..",
      ".LlYlL.",
      "..LLL..",
      "...g...",
      "...gG..",
      ".Gg....",
      "..g....",
      "..g...."
    ],
    star: [
      "..Y..",
      "..Y..",
      "YYWYY",
      "..Y..",
      "..Y.."
    ],
    sparkle: [
      ".Y.",
      "YWY",
      ".Y."
    ],
    cloud: [
      ".......pppp.............",
      ".....ppppppp...ppp......",
      "..pppppppppppppppppp....",
      ".pppppppppppppppppppppp.",
      "pppppPPPpppppppppppppppp",
      "PPPPPPPPPPPPPPPPPPPPPPPP",
      ".PPPPPPPPPPPPPPPPPPPPPP."
    ],
    key: [
      ".OOO........",
      "OoYoO.......",
      "OYoYOOOOOOOO",
      "OoYoO...O.O.",
      ".OOO........"
    ],
    /* заглушки по категориям */
    food: [
      ".....K.GG...",
      ".....KGG....",
      "..RRRKRRR...",
      ".RRWRRRRRR..",
      "RRWRRRRRRRR.",
      "RRRRRRRRRRR.",
      "RRRRRRRRRRR.",
      "rRRRRRRRRRr.",
      ".rRRRRRRRr..",
      ".rrRRRRRrr..",
      "..rrr.rrr..."
    ],
    meds: [
      "...KKKKKK...",
      "...KWWWWK...",
      "...KKKKKK...",
      "..KBBBBBBK..",
      "..KWWWWWWK..",
      "..KWWRRWWK..",
      "..KWRRRRWK..",
      "..KWRRRRWK..",
      "..KWWRRWWK..",
      "..KWWWWWWK..",
      "..KbbbbbbK..",
      "..KKKKKKKK.."
    ],
    cosmetics: [
      ".....KK.....",
      "....KPPK....",
      "....KPpK....",
      "....KPPK....",
      "...KKKKKK...",
      "...KYYYYK...",
      "...KYoYYK...",
      "..KKKKKKKK..",
      "..KLLLLLLK..",
      "..KLllLLLK..",
      "..KLlLLLLK..",
      "..KLLLLLLK..",
      "..KKKKKKKK.."
    ],
    skincare: [
      "............",
      "..KKKKKKKK..",
      ".KLLLLLLLLK.",
      ".KKKKKKKKKK.",
      "KWWWWWWWWWWK",
      "KWppWWWWWWWK",
      "KWpWPPPPWWWK",
      "KWWWPPPPWWWK",
      "KWWWWWWWWWWK",
      "KWWWWWWWWWWK",
      ".KKKKKKKKKK."
    ],
    chemicals: [
      "..KKKKK.....",
      ".KBBBBBK....",
      "KBBKKKKK....",
      "KK..KK......",
      "...KGGK.....",
      "..KGGGGK....",
      ".KGWGGGGK...",
      ".KGWGGGGK...",
      ".KGGGGGGK...",
      ".KGGYYGGK...",
      ".KGGYYGGK...",
      ".KgGGGGgK...",
      ".KKKKKKKK..."
    ]
  };

  var cache = {};

  /** SVG-строка спрайта; горизонтальные отрезки одного цвета склеиваются в один rect. */
  function svg(name) {
    if (cache[name]) return cache[name];
    var rows = SPRITES[name];
    if (!rows) return "";
    var w = 0;
    rows.forEach(function (r) { if (r.length > w) w = r.length; });
    var h = rows.length;
    var out = [];
    rows.forEach(function (row, y) {
      var x = 0;
      while (x < row.length) {
        var c = row[x];
        if (c === "." || !PAL[c]) { x++; continue; }
        var start = x;
        while (x < row.length && row[x] === c) x++;
        out.push('<rect x="' + start + '" y="' + y + '" width="' + (x - start) + '" height="1" fill="' + PAL[c] + '"/>');
      }
    });
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h +
      '" shape-rendering="crispEdges" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">' +
      out.join("") + "</svg>";
    cache[name] = s;
    return s;
  }

  function hydrate(root) {
    (root || document).querySelectorAll("[data-art]").forEach(function (el) {
      if (el.dataset.artDone === el.dataset.art) return;
      el.innerHTML = svg(el.dataset.art);
      el.dataset.artDone = el.dataset.art;
      el.classList.add("px-art");
    });
  }

  /* ---------- сцена ---------- */

  // детерминированный ГПСЧ, чтобы небо не «прыгало» между загрузками
  function rng(seed) {
    return function () {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }

  function el(cls, style, art) {
    var d = document.createElement("div");
    d.className = cls;
    if (style) d.setAttribute("style", style);
    if (art) d.innerHTML = svg(art);
    return d;
  }

  function stairsSvg() {
    // лестница, уходящая в небо: ступени уменьшаются и светлеют
    var parts = [];
    var steps = 9;
    for (var i = 0; i < steps; i++) {
      var x = i * 10;
      var y = 90 - i * 10;
      var light = i % 2 === 0 ? "#b69cff" : "#9a7ef0";
      parts.push('<rect x="' + x + '" y="' + y + '" width="14" height="4" fill="' + light + '"/>');
      parts.push('<rect x="' + x + '" y="' + (y + 4) + '" width="14" height="6" fill="#4b2c8f"/>');
      parts.push('<rect x="' + x + '" y="' + (y + 10) + '" width="14" height="2" fill="#2a1a5e"/>');
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 104" shape-rendering="crispEdges" aria-hidden="true">' + parts.join("") + "</svg>";
  }

  function buildScene(root) {
    if (!root || root.dataset.built) return;
    root.dataset.built = "1";
    var r = rng(20261026);
    var frag = document.createDocumentFragment();

    // звёзды-точки
    var stars = el("scene-stars");
    for (var i = 0; i < 110; i++) {
      var s = document.createElement("span");
      var size = r() < 0.15 ? 4 : r() < 0.5 ? 3 : 2;
      s.className = "s-dot" + (r() < 0.35 ? " tw" : "");
      s.style.left = (r() * 100).toFixed(2) + "%";
      s.style.top = (r() * 72).toFixed(2) + "%";
      s.style.width = s.style.height = size + "px";
      s.style.animationDelay = (r() * 4).toFixed(2) + "s";
      if (r() < 0.25) s.style.background = r() < 0.5 ? "#ffc8e6" : "#e2d6ff";
      stars.appendChild(s);
    }
    frag.appendChild(stars);

    // крупные звёзды-крестики
    [[8, 10, "star"], [30, 6, "sparkle"], [46, 18, "star"], [62, 9, "sparkle"], [90, 30, "star"], [18, 38, "sparkle"], [74, 44, "sparkle"], [55, 33, "star"]]
      .forEach(function (p, idx) {
        frag.appendChild(el("s-big tw" + (idx > 4 ? " hide-sm" : ""), "left:" + p[0] + "%;top:" + p[1] + "%;animation-delay:" + idx * 0.7 + "s", p[2]));
      });

    frag.appendChild(el("s-moon", "", "moon"));

    frag.appendChild(el("s-cloud c1", "", "cloud"));
    frag.appendChild(el("s-cloud c2", "", "cloud"));
    frag.appendChild(el("s-cloud c3 hide-sm", "", "cloud"));

    frag.appendChild(el("s-door d1", "", "doorOpen"));
    frag.appendChild(el("s-door d2 hide-sm", "", "door"));
    frag.appendChild(el("s-door d3", "", "door"));
    frag.appendChild(el("s-frame f1 hide-sm", "", "frame"));
    frag.appendChild(el("s-frame f2", "", "frameL"));
    frag.appendChild(el("s-key hide-sm", "", "key"));

    var stairs = el("s-stairs");
    stairs.innerHTML = stairsSvg();
    frag.appendChild(stairs);

    frag.appendChild(el("s-floor"));
    frag.appendChild(el("s-floor-glow"));

    [[3, "flower"], [9, "flowerL"], [15, "flower"], [80, "flowerL"], [88, "flower"], [95, "flowerL"], [26, "flowerL"], [70, "flower"]]
      .forEach(function (p, idx) {
        frag.appendChild(el("s-flower" + (idx > 5 ? " hide-sm" : ""), "left:" + p[0] + "%;animation-delay:" + idx * 0.5 + "s", p[1]));
      });

    frag.appendChild(el("s-cat", "", "cat"));

    root.appendChild(frag);
  }

  window.KvestArt = { svg: svg, hydrate: hydrate, buildScene: buildScene };

  function boot() {
    buildScene(document.getElementById("scene"));
    hydrate(document);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
