/* art.js — оригинальные «милые» иллюстрации (inline SVG, мягкие формы) и светлый фон
   с размытыми пятнами и мелкими сердечками / листиками / искорками. */
(function () {
  "use strict";

  var C = {
    ink: "#4a4140",
    pink: "#ff9fb7",
    pinkL: "#ffc8d7",
    pinkD: "#ef7c9c",
    blush: "#ff8fa8",
    mint: "#8fd6b4",
    mintL: "#c6eedb",
    mintD: "#5fbf94",
    peach: "#ffd2b3",
    butter: "#ffd979",
    white: "#ffffff",
    cream: "#fffaf6",
    brown: "#a8775c",
    cat: "#4d4646"
  };

  /** Милое личико: глазки, румянец, улыбка. */
  function face(cx, cy, s) {
    s = s || 1;
    var ex = 5.2 * s, bx = 9.5 * s;
    return '<ellipse cx="' + (cx - ex) + '" cy="' + cy + '" rx="' + 1.7 * s + '" ry="' + 2.1 * s + '" fill="' + C.ink + '"/>' +
      '<ellipse cx="' + (cx + ex) + '" cy="' + cy + '" rx="' + 1.7 * s + '" ry="' + 2.1 * s + '" fill="' + C.ink + '"/>' +
      '<circle cx="' + (cx - ex + 0.6 * s) + '" cy="' + (cy - 0.8 * s) + '" r="' + 0.6 * s + '" fill="#fff"/>' +
      '<circle cx="' + (cx + ex + 0.6 * s) + '" cy="' + (cy - 0.8 * s) + '" r="' + 0.6 * s + '" fill="#fff"/>' +
      '<ellipse cx="' + (cx - bx) + '" cy="' + (cy + 3.6 * s) + '" rx="' + 2.6 * s + '" ry="' + 1.6 * s + '" fill="' + C.blush + '" opacity=".75"/>' +
      '<ellipse cx="' + (cx + bx) + '" cy="' + (cy + 3.6 * s) + '" rx="' + 2.6 * s + '" ry="' + 1.6 * s + '" fill="' + C.blush + '" opacity=".75"/>' +
      '<path d="M' + (cx - 2.4 * s) + " " + (cy + 2.6 * s) + " q" + 2.4 * s + " " + 2.6 * s + " " + 4.8 * s + ' 0" stroke="' + C.ink +
      '" stroke-width="' + 1.5 * s + '" stroke-linecap="round" fill="none"/>';
  }

  var ART = {
    food:
      '<path d="M32 40c-6 0-6 0 0 0" fill="none"/>' +
      '<path d="M32 19c-5-4-14-5-19 2-6 8-3 21 4 28 4 4 9 6 15 3 6 3 11 1 15-3 7-7 10-20 4-28-5-7-14-6-19-2z" fill="' + C.pink + '"/>' +
      '<path d="M32 20c0-5 1.5-8.5 4.5-11" stroke="' + C.brown + '" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '<path d="M36 13c4-5.5 11-6.5 15-3.5-3.5 5.5-10 6.5-15 3.5z" fill="' + C.mint + '"/>' +
      '<ellipse cx="19.5" cy="28" rx="2.8" ry="5" fill="#fff" opacity=".65" transform="rotate(22 19.5 28)"/>' +
      face(32, 37, 1),
    meds:
      '<g transform="rotate(-28 32 34)">' +
      '<rect x="9" y="22" width="46" height="24" rx="12" fill="#fff" stroke="' + C.pinkL + '" stroke-width="2.5"/>' +
      '<path d="M32 22H21a12 12 0 0 0 0 24h11z" fill="' + C.pink + '"/>' +
      '<rect x="14" y="26" width="10" height="3.4" rx="1.7" fill="#fff" opacity=".7"/>' +
      face(37, 33, 0.85) +
      "</g>" +
      '<path d="M52 8v10M47 13h10" stroke="' + C.mintD + '" stroke-width="3.4" stroke-linecap="round"/>' +
      '<circle cx="11" cy="52" r="2.4" fill="' + C.mint + '"/>',
    cosmetics:
      '<rect x="24" y="8" width="16" height="11" rx="4.5" fill="' + C.mint + '"/>' +
      '<rect x="27" y="18" width="10" height="8" rx="2" fill="' + C.mintL + '"/>' +
      '<rect x="14" y="25" width="36" height="32" rx="12" fill="' + C.pinkL + '"/>' +
      '<rect x="18" y="29" width="5" height="12" rx="2.5" fill="#fff" opacity=".7"/>' +
      face(32, 41, 1) +
      '<path d="M52 18c1 3 2 4 5 5-3 1-4 2-5 5-1-3-2-4-5-5 3-1 4-2 5-5z" fill="' + C.butter + '"/>',
    skincare:
      '<path d="M32 4c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" fill="' + C.pink + '"/>' +
      '<rect x="12" y="22" width="40" height="11" rx="5.5" fill="' + C.mint + '"/>' +
      '<rect x="14" y="31" width="36" height="25" rx="10" fill="#fff" stroke="' + C.mintL + '" stroke-width="2.5"/>' +
      '<rect x="18" y="25" width="10" height="3" rx="1.5" fill="#fff" opacity=".6"/>' +
      face(32, 42, 1),
    chemicals:
      '<path d="M21 9h17a5 5 0 0 1 5 5v6H21z" fill="' + C.pink + '"/>' +
      '<rect x="43" y="11" width="9" height="5" rx="2.5" fill="' + C.pinkD + '"/>' +
      '<path d="M25 20h12l2 8H23z" fill="#fff" stroke="' + C.mintL + '" stroke-width="2"/>' +
      '<rect x="16" y="27" width="30" height="30" rx="11" fill="' + C.mint + '"/>' +
      '<rect x="20" y="31" width="4.5" height="12" rx="2.25" fill="#fff" opacity=".6"/>' +
      face(31, 41, 1) +
      '<circle cx="56" cy="7" r="3" fill="#fff" stroke="' + C.mint + '" stroke-width="1.6"/>' +
      '<circle cx="59" cy="18" r="2" fill="#fff" stroke="' + C.mint + '" stroke-width="1.4"/>',
    star:
      '<path d="M32 9l6.6 13.8 15.1 2-11 10.6 2.8 15L32 43.2 18.5 50.4l2.8-15-11-10.6 15.1-2z" fill="' + C.butter +
      '" stroke="' + C.butter + '" stroke-width="6" stroke-linejoin="round"/>' + face(32, 32, 0.8),
    sparkle:
      '<path d="M32 6c2.4 14 6 17.6 20 20-14 2.4-17.6 6-20 20-2.4-14-6-17.6-20-20 14-2.4 17.6-6 20-20z" fill="' + C.butter + '"/>' +
      '<path d="M52 40c1 5 2.5 6.5 7.5 7.5-5 1-6.5 2.5-7.5 7.5-1-5-2.5-6.5-7.5-7.5 5-1 6.5-2.5 7.5-7.5z" fill="' + C.pink + '"/>',
    heart:
      '<path d="M32 54C14 42 8 32 8 23c0-7 5-12 12-12 5 0 9 3 12 7 3-4 7-7 12-7 7 0 12 5 12 12 0 9-6 19-24 31z" fill="' + C.pink + '"/>' +
      '<ellipse cx="18" cy="22" rx="3" ry="4.5" fill="#fff" opacity=".6" transform="rotate(-25 18 22)"/>',
    leaf:
      '<path d="M12 52C12 28 28 12 52 12c0 24-16 40-40 40z" fill="' + C.mint + '"/>' +
      '<path d="M14 50C24 38 32 30 44 20" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".8"/>',
    house:
      '<rect x="14" y="27" width="36" height="28" rx="8" fill="#fff" stroke="' + C.pinkL + '" stroke-width="2.5"/>' +
      '<path d="M10 30L32 11l22 19" stroke="' + C.pink + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '<rect x="41" y="12" width="6" height="10" rx="2" fill="' + C.pinkD + '"/>' +
      '<rect x="26" y="39" width="12" height="16" rx="6" fill="' + C.mint + '"/>' +
      '<circle cx="35" cy="47" r="1.2" fill="#fff"/>' +
      '<path d="M44 38.5c-1.2-1.6-4-1.2-4 1 0 1.6 2 3 4 4.2 2-1.2 4-2.6 4-4.2 0-2.2-2.8-2.6-4-1z" fill="' + C.pink + '"/>' +
      '<path d="M20 38.5c-1.2-1.6-4-1.2-4 1 0 1.6 2 3 4 4.2 2-1.2 4-2.6 4-4.2 0-2.2-2.8-2.6-4-1z" fill="' + C.mint + '"/>',
    chest:
      '<rect x="10" y="27" width="44" height="28" rx="9" fill="' + C.mintL + '"/>' +
      '<rect x="7" y="19" width="50" height="12" rx="6" fill="' + C.mint + '"/>' +
      '<path d="M32 36c-1.6-2.2-5.4-1.6-5.4 1.3 0 2.2 2.7 4 5.4 5.7 2.7-1.7 5.4-3.5 5.4-5.7 0-2.9-3.8-3.5-5.4-1.3z" fill="' + C.pink + '"/>',
    bag:
      '<path d="M23 26v-5a9 9 0 0 1 18 0v5" stroke="' + C.pinkD + '" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<rect x="12" y="23" width="40" height="34" rx="10" fill="' + C.pink + '"/>' +
      '<path d="M32 36c-1.8-2.4-6-1.8-6 1.4 0 2.4 3 4.4 6 6.3 3-1.9 6-3.9 6-6.3 0-3.2-4.2-3.8-6-1.4z" fill="#fff"/>',
    oops:
      '<circle cx="32" cy="32" r="24" fill="' + C.pink + '"/>' +
      '<rect x="29" y="16" width="6" height="20" rx="3" fill="#fff"/>' +
      '<circle cx="32" cy="44" r="3.6" fill="#fff"/>',
    cat:
      '<path d="M46 52c10 1 14-8 9-15" stroke="' + C.cat + '" stroke-width="5.5" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="30" cy="46" rx="16" ry="13" fill="' + C.cat + '"/>' +
      '<path d="M17 22L18 7l10 8zM43 22L42 7l-10 8z" fill="' + C.cat + '" stroke="' + C.cat + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M19.5 17l.5-6 4.5 4zM40.5 17l-.5-6-4.5 4z" fill="' + C.pink + '"/>' +
      '<circle cx="30" cy="26" r="14" fill="' + C.cat + '"/>' +
      '<path d="M22.5 25q2.5-2.6 5 0M32.5 25q2.5-2.6 5 0" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="21" cy="30" rx="2.6" ry="1.6" fill="' + C.blush + '" opacity=".85"/>' +
      '<ellipse cx="39" cy="30" rx="2.6" ry="1.6" fill="' + C.blush + '" opacity=".85"/>' +
      '<path d="M28.6 29.2h2.8l-1.4 1.6z" fill="' + C.pink + '"/>' +
      '<path d="M30 30.8q-1.6 2-3.2.8M30 30.8q1.6 2 3.2.8" stroke="#fff" stroke-width="1.2" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="24" cy="57" rx="4.5" ry="3" fill="#6a6262"/><ellipse cx="36" cy="57" rx="4.5" ry="3" fill="#6a6262"/>'
  };

  var cache = {};

  function svg(name) {
    if (cache[name]) return cache[name];
    var body = ART[name];
    if (!body) return "";
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + body + "</svg>";
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

  /* ---------- фон ---------- */

  function el(cls, style, art) {
    var d = document.createElement("div");
    d.className = cls;
    if (style) d.setAttribute("style", style);
    if (art) d.innerHTML = svg(art);
    return d;
  }

  function buildScene(root) {
    if (!root || root.dataset.built) return;
    root.dataset.built = "1";
    var frag = document.createDocumentFragment();
    frag.appendChild(el("blob b1"));
    frag.appendChild(el("blob b2"));
    frag.appendChild(el("blob b3"));
    frag.appendChild(el("blob b4"));
    // мелкие украшения: [left %, top %, размер px, спрайт, поворот]
    [
      [4, 12, 18, "heart", -12], [93, 9, 16, "sparkle", 0], [12, 58, 16, "leaf", 20],
      [88, 44, 20, "leaf", -30], [48, 4, 14, "sparkle", 0], [96, 78, 16, "heart", 14],
      [3, 88, 20, "sparkle", 0], [70, 92, 14, "heart", -8], [28, 30, 12, "sparkle", 0],
      [62, 24, 14, "leaf", 40], [78, 66, 12, "sparkle", 0], [20, 80, 14, "heart", 10]
    ].forEach(function (d, i) {
      frag.appendChild(el("deco" + (i > 6 ? " hide-sm" : ""),
        "left:" + d[0] + "%;top:" + d[1] + "%;width:" + d[2] + "px;height:" + d[2] + "px;--r:" + d[4] + "deg;animation-delay:" + (i * -0.9) + "s",
        d[3]));
    });
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
