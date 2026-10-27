/* coloring-art.js — 12 оригинальных пиксельных картинок для раскрасок по номерам.
   Каждая картинка рисуется кодом в сетку номеров цветов (1..N). Экспорт: window.KvestColoringArt. */
(function () {
  "use strict";

  /* ---------- фигуры (центр клетки = x+0.5, y+0.5) ---------- */
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
  function N(a, b) { return function (x, y) { return a(x, y) && !b(x, y); }; }
  function I(a, b) { return function (x, y) { return a(x, y) && b(x, y); }; }
  function below(fn) { return function (x, y) { return y > fn(x); }; }
  function heart(cx, cy, s) {
    return U(E(cx - s * 0.5, cy - s * 0.25, s * 0.6, s * 0.55), E(cx + s * 0.5, cy - s * 0.25, s * 0.6, s * 0.55),
      P([[cx - s * 1.05, cy], [cx + s * 1.05, cy], [cx, cy + s * 1.15]]));
  }
  function hash(n) {
    n = (n * 374761393 + 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function Pic(w, h) {
    this.w = w; this.h = h;
    this.g = new Uint8Array(w * h);
    this.g.fill(1);
  }
  Pic.prototype.fill = function (pred, c) {
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) if (pred(x + 0.5, y + 0.5)) this.g[y * this.w + x] = c;
  };
  /** Красит только клетки цвета `only` (число или массив). */
  Pic.prototype.paint = function (pred, c, only) {
    var list = Array.isArray(only) ? only : [only];
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var i = y * this.w + x;
      if (list.indexOf(this.g[i]) >= 0 && pred(x + 0.5, y + 0.5)) this.g[i] = c;
    }
  };
  Pic.prototype.set = function (x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y * this.w + x] = c; };
  Pic.prototype.get = function (x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.g[y * this.w + x] : 0; };
  Pic.prototype.star = function (x, y, c, arm) {
    this.set(x, y, c);
    if (arm) { this.set(x - 1, y, arm); this.set(x + 1, y, arm); this.set(x, y - 1, arm); this.set(x, y + 1, arm); }
  };
  Pic.prototype.pts = function (list, c) { var self = this; list.forEach(function (p) { self.set(p[0], p[1], c); }); };

  /* ---------- картинки ---------- */
  var PICTURES = [
    {
      id: "sakura", name: "Сакура у пруда", w: 36, h: 36,
      palette: ["#fff3f6", "#ffd9e4", "#cfeedd", "#a6dfbd", "#7fc8cc", "#bfe9e6", "#9b6b5a", "#ffb8cc", "#ff8fb0", "#ffffff", "#6fb08e"],
      draw: function (p) {
        p.fill(below(function (x) { return 11 + Math.sin(x / 4) * 1.2; }), 2);
        p.fill(below(function (x) { return 20 + Math.sin(x / 5 + 1) * 2; }), 3);
        p.fill(below(function (x) { return 24 + Math.sin(x / 3) * 0.6; }), 4);
        p.fill(U(E(4, 25.5, 4.5, 2.2), E(32, 24.5, 5, 2.2), E(27, 34.5, 4, 1.8)), 11);
        p.fill(E(22, 30, 13, 4.6), 5);
        p.paint(U(R(14, 29, 21, 30), R(24, 31, 31, 32), R(18, 27, 23, 28)), 6, 5);
        p.paint(E(13.5, 30.2, 3.6, 1.6), 8, [5, 6]);
        p.fill(U(C(7, 36, 7.6, 18, 1.4), C(7.6, 21, 12.5, 13, 0.9), C(7.4, 22, 2.8, 15, 0.8)), 7);
        var canopy = U(E(8, 9, 9, 5.6), E(17, 7, 7, 4.6), E(2.5, 12, 4.6, 3.6), E(13.5, 12, 6.5, 3.4), E(22, 10, 4, 2.6));
        p.fill(canopy, 8);
        p.paint(I(canopy, function (x, y) { return y > 11.3 || (x > 19 && y > 9); }), 9, 8);
        p.paint(U(E(6, 6, 2.4, 1.2), E(15, 4.6, 2.2, 1), E(11, 9, 1.4, 0.8)), 10, 8);
        p.pts([[24, 14], [28, 9], [31, 16], [21, 18], [27, 21], [17, 17], [33, 11], [25, 25]], 9);
        p.pts([[30, 4], [22, 3]], 8);
      }
    },
    {
      id: "moon", name: "Луна и облака", w: 36, h: 36,
      palette: ["#2c4a61", "#476a82", "#7f9db0", "#efc2d0", "#fff3c4", "#efd9a0", "#fff0f4", "#f5b8cb", "#ffe58a", "#ffffff"],
      draw: function (p) {
        p.fill(below(function (x) { return 10 + Math.sin(x / 5) * 1.3; }), 2);
        p.fill(below(function (x) { return 18 + Math.sin(x / 6 + 2) * 1.5; }), 3);
        p.fill(below(function (x) { return 25 + Math.sin(x / 4) * 1; }), 4);
        p.fill(E(24, 11, 6.2, 6.2), 5);
        p.paint(N(E(24, 11, 6.2, 6.2), E(22.6, 9.8, 5.9, 5.9)), 6, 5);
        p.pts([[22, 9], [23, 9], [25, 13], [21, 12]], 6);
        var cloud = U(E(7, 29, 8, 4), E(16, 27, 7, 5), E(25.5, 29.5, 9, 4.2), E(33, 27.5, 5, 3.6), R(0, 30, 36, 36));
        p.fill(cloud, 7);
        p.paint(I(cloud, function (x, y) { return y > 31 + Math.sin(x / 3) * 0.8; }), 8, 7);
        var small = U(E(17, 16.5, 5, 2), E(21.5, 15.5, 4, 2.2), E(13.5, 17, 3, 1.4));
        p.fill(small, 8);
        p.paint(I(small, function (x, y) { return y < 16; }), 7, 8);
        [[5, 4], [31, 3], [10, 13], [33, 17]].forEach(function (s) { p.star(s[0], s[1], 10, 9); });
        p.pts([[13, 6], [17, 3], [3, 11], [28, 21], [7, 20], [34, 10], [19, 9], [2, 2]], 9);
      }
    },
    {
      id: "cat", name: "Кот на подоконнике", w: 36, h: 36,
      palette: ["#ffe6ee", "#ffffff", "#2f4b63", "#55788f", "#fff3c4", "#ffb3c7", "#f294b0", "#d9a58a", "#4a4448", "#ffd66b", "#8fd6b4", "#ffa98f", "#f7d0dc"],
      draw: function (p) {
        p.fill(function (x, y) { return y > 29 && (Math.floor(x) + Math.floor(y)) % 4 === 0; }, 13);
        p.fill(R(6, 3, 30, 27), 2);
        p.fill(R(8, 5, 28, 25), 3);
        p.paint(function (x, y) { return y > 15; }, 4, 3);
        p.fill(E(24, 9, 2.6, 2.6), 5);
        p.paint(E(23, 8.4, 2.2, 2.2), 3, 5);
        p.pts([[11, 7], [14, 10], [21, 18], [11, 20], [26, 21], [16, 6]], 5);
        p.fill(U(R(17, 5, 19, 25), R(8, 14, 28, 16)), 2);
        p.fill(P([[2, 2], [8.5, 2], [7.5, 28], [2.5, 30]]), 6);
        p.fill(P([[27.5, 2], [34, 2], [33.5, 30], [28.5, 28]]), 6);
        p.paint(U(R(5, 3, 6, 29), R(30, 3, 31, 29)), 7, 6);
        p.fill(R(1, 1, 35, 2), 8);
        p.fill(R(3, 26, 33, 29), 8);
        p.paint(R(3, 28, 33, 29), 7, 8);
        // кот
        var cat = U(E(14.5, 22.5, 5, 4.2), E(14.5, 16.5, 3.6, 3.2), P([[11.2, 16], [11.6, 11.8], [14, 14.2]]), P([[17.8, 16], [17.4, 11.8], [15, 14.2]]),
          C(18.5, 25.5, 22.5, 24.8, 1), C(22.5, 24.8, 23.6, 21, 0.9));
        p.fill(cat, 9);
        p.pts([[13, 16], [16, 16]], 10);
        // цветок в горшке
        p.fill(P([[23, 26], [28.5, 26], [28, 22.5], [23.5, 22.5]]), 12);
        p.fill(U(E(24.5, 20, 1.4, 2.6), E(27.5, 19.5, 1.4, 3), E(26, 18, 1.1, 3.2)), 11);
      }
    },
    {
      id: "cocoa", name: "Чашка какао", w: 36, h: 36,
      palette: ["#fff4e8", "#ffdfe8", "#ffb3c7", "#f08eac", "#8a5a44", "#b9805f", "#ffffff", "#ffe2ea", "#e9c9bd", "#c9ecd9", "#a6dcc0", "#ff7f9a"],
      draw: function (p) {
        p.fill(function (x, y) { x = Math.floor(x); y = Math.floor(y); return y < 26 && x % 6 === 2 && y % 6 === 2 || (y < 26 && x % 6 === 5 && y % 6 === 5); }, 2);
        p.fill(function (x, y) { return y >= 26; }, 10);
        p.paint(function (x, y) { return y >= 26 && ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0); }, 11, 10);
        p.fill(E(17, 30, 13, 2.4), 7);
        p.fill(N(E(27, 20.5, 4.4, 4.6), E(27, 20.5, 2.2, 2.6)), 3);
        var mug = function (x, y) { return x > 9 && x < 25 && y > 13 && y < 29.5 && !((x < 10.6 || x > 23.4) && y > 28.2); };
        p.fill(mug, 3);
        p.paint(function (x, y) { return x > 22.4 || y > 28; }, 4, 3);
        p.fill(heart(17, 19.6, 3), 12);
        p.fill(E(17, 13.6, 8, 2), 5);
        p.paint(E(17, 13.6, 6, 1.1), 6, 5);
        p.fill(R(11, 10, 14, 13), 7); p.fill(R(15, 9, 18, 12), 8); p.fill(R(19, 11, 22, 13), 7);
        for (var y = 1; y < 8; y++) {
          p.set(12 + Math.round(Math.sin(y / 1.4)), y, 9);
          p.set(17 + Math.round(Math.sin(y / 1.4 + 2)), y, 9);
          if (y > 2) p.set(22 + Math.round(Math.sin(y / 1.4 + 4)), y, 9);
        }
      }
    },
    {
      id: "rain", name: "Дождь за окном", w: 36, h: 36,
      palette: ["#ffe9de", "#ffffff", "#9ab1c2", "#bfd0dc", "#8aa1b2", "#71889a", "#eef5f9", "#ffe58a", "#ffb3c7", "#e6c6aa", "#fff6e6", "#ffad4d", "#8fd6b4"],
      draw: function (p) {
        p.fill(R(4, 2, 32, 27), 2);
        p.fill(R(6, 4, 30, 25), 3);
        p.paint(function (x, y) { return y > 13; }, 4, 3);
        var tops = [[6, 10, 16], [10, 14, 19], [14, 18, 13], [18, 23, 17], [23, 27, 14], [27, 30, 18]];
        tops.forEach(function (t, i) { p.fill(R(t[0], t[2], t[1], 25), i % 2 ? 6 : 5); });
        p.fill(function (x, y) {
          x = Math.floor(x); y = Math.floor(y);
          return y > 14 && y < 24 && x > 6 && x < 30 && x % 2 === 1 && y % 2 === 0 && hash(x * 37 + y * 11) < 0.45 && p.get(x, y) >= 5;
        }, 8);
        for (var k = 0; k < 26; k++) {
          var rx = 7 + Math.floor(hash(k * 17 + 3) * 22), ry = 5 + Math.floor(hash(k * 29 + 5) * 18);
          p.set(rx, ry, 7); p.set(rx - 1, ry + 1, 7); if (k % 3 === 0) p.set(rx - 2, ry + 2, 7);
        }
        p.fill(U(R(17, 4, 19, 25), R(6, 13, 30, 15)), 2);
        p.fill(P([[0, 0], [5.5, 0], [4.5, 29], [0, 31]]), 9);
        p.fill(P([[30.5, 0], [36, 0], [36, 31], [31.5, 29]]), 9);
        p.fill(R(2, 27, 34, 30), 10);
        p.fill(R(23, 22, 25, 27), 11);
        p.pts([[23, 20], [24, 20], [23, 21], [24, 21]], 12);
        p.fill(R(9, 23, 13, 27), 13);
        p.pts([[13, 24], [13, 25]], 13);
        p.pts([[10, 21], [11, 20], [10, 19]], 2);
      }
    },
    {
      id: "sunset", name: "Закат у моря", w: 36, h: 36,
      palette: ["#ffbfd0", "#ffcdb8", "#ffe0b0", "#fff1c6", "#fff9e8", "#8fd3cf", "#6fbfc0", "#fff1d8", "#fbe4c8", "#f0cba4", "#ffffff", "#7a6a72"],
      draw: function (p) {
        p.fill(below(function (x) { return 6 + Math.sin(x / 5) * 0.8; }), 2);
        p.fill(below(function (x) { return 11 + Math.sin(x / 4 + 1) * 0.8; }), 3);
        p.fill(below(function (x) { return 16 + Math.sin(x / 6) * 0.6; }), 4);
        p.fill(I(E(18, 20.5, 6.5, 6.5), function (x, y) { return y < 20; }), 5);
        p.fill(U(E(7, 8, 5, 1.2), E(10, 7, 3, 1), E(28, 12, 6, 1.3), E(31, 11, 3, 1)), 11);
        p.fill(function (x, y) { return y >= 20 && y < 29; }, 6);
        p.paint(function (x, y) { y = Math.floor(y); return (y === 23 || y === 26) && hash(Math.floor(x / 3) * 7 + y) < 0.6; }, 7, 6);
        p.paint(function (x, y) {
          x = Math.floor(x); y = Math.floor(y);
          var half = 4 - (y - 20) * 0.25;
          return y >= 20 && y < 28 && Math.abs(x - 17.5) < half && (y % 2 === 0 || Math.abs(x - 17.5) < half - 1.5);
        }, 8, [6, 7]);
        p.fill(function (x, y) { return y >= 28.4 + Math.sin(x / 2.5) * 0.7; }, 11);
        p.fill(function (x, y) { return y >= 29.6 + Math.sin(x / 2.5) * 0.7; }, 9);
        p.paint(function (x, y) { x = Math.floor(x); y = Math.floor(y); return y > 30 && hash(x * 5 + y * 31) < 0.12; }, 10, 9);
        p.pts([[7, 33], [8, 33], [7, 32]], 1);
        p.pts([[8, 12], [9, 11], [10, 12], [11, 11], [12, 12], [24, 7], [25, 6], [26, 7], [27, 6], [28, 7]], 12);
      }
    },
    {
      id: "mushroom", name: "Домик-грибок", w: 36, h: 36,
      palette: ["#dcf1ff", "#f4fbff", "#ff8f96", "#e5707b", "#ffffff", "#fff1d6", "#ead2ab", "#b07a5e", "#ffe58a", "#a6dfbd", "#6fb08e", "#ffb3c7", "#ffd66b"],
      draw: function (p) {
        p.fill(U(E(6, 5, 4.5, 1.6), E(9, 4, 3, 1.4), E(29, 7, 5, 1.6), E(31, 6, 3, 1.3)), 2);
        var cap = I(E(18, 15, 14.5, 10), function (x, y) { return y < 17; });
        p.fill(cap, 3);
        p.paint(function (x, y) { return x > 26 || y > 15.4; }, 4, 3);
        p.fill(U(E(11, 11, 1.6, 1.4), E(18, 7.5, 1.8, 1.5), E(25, 11.5, 1.6, 1.4), E(15, 14, 1.1, 1), E(21.5, 14, 1.1, 1), E(7.5, 15, 1, 0.9), E(29, 15, 1, 0.9)), 5);
        p.fill(function (x, y) { return x > 11 && x < 25 && y >= 17 && y < 31; }, 6);
        p.paint(function (x, y) { return x > 22.5 || y < 18; }, 7, 6);
        p.fill(U(E(18, 26, 2.6, 3), R(15.5, 26, 20.5, 31)), 8);
        p.set(19, 28, 9);
        p.fill(U(E(14, 21.5, 1.6, 1.6), E(22.4, 21.5, 1.6, 1.6)), 9);
        p.fill(below(function (x) { return 29.5 + Math.sin(x / 3) * 0.8; }), 10);
        p.paint(function (x, y) { x = Math.floor(x); y = Math.floor(y); return y > 30 && hash(x * 7 + y * 3) < 0.18; }, 11, 10);
        p.fill(P([[15.5, 31], [20.5, 31], [23, 36], [13, 36]]), 7);
        [[4, 31], [8, 33], [29, 32], [33, 30], [26, 34]].forEach(function (f) {
          p.pts([[f[0] - 1, f[1]], [f[0] + 1, f[1]], [f[0], f[1] - 1], [f[0], f[1] + 1]], 12);
          p.set(f[0], f[1], 13);
        });
      }
    },
    {
      id: "cake", name: "Клубничный торт", w: 36, h: 36,
      palette: ["#fff1f5", "#ffe1ea", "#ffffff", "#ece4e8", "#fff3dc", "#ffd59f", "#ffc6d6", "#ff8fab", "#ff5d73", "#6fb08e", "#ffe58a", "#a8d4f5"],
      draw: function (p) {
        p.fill(function (x) { return Math.floor(x) % 6 < 2; }, 2);
        p.fill(E(18, 31, 15.5, 3), 3);
        p.paint(function (x, y) { return y > 31.5; }, 4, 3);
        p.fill(R(7, 18, 29, 30), 5);
        p.paint(function (x, y) { y = Math.floor(y); return y >= 27; }, 7, 5);
        p.paint(function (x, y) { y = Math.floor(y); return y === 23; }, 8, 5);
        p.paint(function (x) { return x > 26.5; }, 6, 5);
        p.fill(E(18, 18, 11, 2.6), 7);
        p.fill(function (x, y) { x = Math.floor(x); y = Math.floor(y); return x >= 7 && x < 29 && (y === 19 || y === 20) && hash(x * 3) < (y === 19 ? 0.85 : 0.45); }, 7);
        [10, 15, 21, 26].forEach(function (cx, i) {
          p.fill(E(cx, 16, 1.7, 1.9), 9);
          p.set(cx, 14, 10);
          if (i % 2) p.set(cx - 1, 14, 10);
        });
        p.fill(R(17, 7, 19, 15), 12);
        p.paint(function (x, y) { return Math.floor(y) % 2 === 0; }, 3, 12);
        p.fill(E(18, 5.2, 1, 1.7), 11);
      }
    },
    {
      id: "lighthouse", name: "Маяк", w: 36, h: 36,
      palette: ["#33546a", "#557a8e", "#f0b6c6", "#fff3b4", "#ffffff", "#ff7f8f", "#4f5a66", "#ffe58a", "#aab5c0", "#7f8b98", "#72c2c3", "#4f9fa8"],
      draw: function (p) {
        p.fill(below(function (x) { return 11 + Math.sin(x / 5) * 1.2; }), 2);
        p.fill(below(function (x) { return 20 + Math.sin(x / 4) * 0.8; }), 3);
        p.fill(P([[20, 8], [-1, 2], [-1, 12], [20, 10]]), 4);
        p.fill(P([[20, 8], [37, 4], [37, 10], [20, 10]]), 4);
        p.fill(function (x, y) { return y >= 24; }, 11);
        p.paint(function (x, y) { y = Math.floor(y); return (y === 26 || y === 29 || y === 33) && hash(Math.floor(x / 3) * 5 + y) < 0.6; }, 12, 11);
        var tower = P([[16.8, 12], [23.2, 12], [25, 30], [15, 30]]);
        p.fill(tower, 5);
        p.paint(I(tower, function (x, y) { return Math.floor((y - 12) / 3.5) % 2 === 0; }), 6, 5);
        p.fill(R(15.5, 11, 24.5, 12.5), 7);
        p.fill(R(18, 7, 22, 11), 8);
        p.fill(P([[16.5, 7.2], [23.5, 7.2], [20, 3.5]]), 7);
        p.set(19, 20, 8); p.set(20, 20, 8);
        var rocks = U(E(20, 31.5, 11, 3.4), E(7, 32.5, 6, 2.8), E(31.5, 33, 4.5, 2));
        p.fill(rocks, 9);
        p.paint(function (x, y) { return y > 32.5; }, 10, 9);
        var foam = N(U(E(20, 31, 12.5, 4.2), E(7, 32, 7.3, 3.5)), U(rocks, function (x, y) { return y < 29.2; }));
        p.paint(foam, 5, [11, 12]);
        [[4, 15], [30, 13], [33, 17], [27, 2], [9, 19], [2, 5]].forEach(function (s, i) { p.star(s[0], s[1], i % 2 ? 8 : 5); });
      }
    },
    {
      id: "fox", name: "Лиса в лесу", w: 36, h: 36,
      palette: ["#e9f8f0", "#cdeedb", "#9fdcb6", "#6fb08e", "#ff9d5f", "#e2793f", "#ffffff", "#4a4448", "#d2ab84", "#ff8f96", "#fff1d6", "#ffd66b"],
      draw: function (p) {
        function pine(cx, top, w, c) { p.fill(P([[cx, top], [cx + w, 29], [cx - w, 29]]), c); }
        pine(3, 6, 5, 2); pine(12, 3, 5, 2); pine(25, 4, 5, 2); pine(33, 7, 5, 2);
        pine(7, 11, 4.5, 3); pine(30, 10, 4.5, 3); pine(19, 13, 3.5, 3);
        pine(1, 16, 3.5, 4); pine(35, 15, 3.5, 4);
        p.fill(function (x, y) { return y >= 28 + Math.sin(x / 3) * 0.6; }, 9);
        p.fill(function (x, y) { return y >= 27.6 + Math.sin(x / 3) * 0.6 && y < 28.8 + Math.sin(x / 3) * 0.6; }, 3);
        var tail = U(C(22, 29, 28.5, 23, 2.8), E(29.5, 21.5, 2.4, 2.3));
        p.fill(tail, 5);
        p.paint(E(29.8, 21, 2, 1.9), 7, 5);
        p.fill(U(E(18, 25, 6, 5.5), R(13, 26, 23, 31)), 5);
        p.paint(function (x) { return x > 21.4; }, 6, 5);
        p.fill(E(18, 25.5, 2.8, 4), 7);
        p.fill(U(E(18, 16, 5.2, 4.2), P([[12.8, 14.5], [13.8, 8.2], [17.2, 12.5]]), P([[23.2, 14.5], [22.2, 8.2], [18.8, 12.5]])), 5);
        p.pts([[14, 9], [22, 9], [14, 10], [22, 10]], 8);
        p.fill(U(E(18, 18.4, 2.8, 1.8), E(14.6, 17.4, 1.6, 1.2), E(21.4, 17.4, 1.6, 1.2)), 7);
        p.pts([[16, 15], [20, 15], [18, 17]], 8);
        p.pts([[15, 30], [16, 30], [20, 30], [21, 30]], 7);
        [[5, 29, 1], [31, 30, 1]].forEach(function (m) {
          p.fill(R(m[0] - 0.4, m[1] - 1, m[0] + 1.4, m[1] + 2), 11);
          p.fill(E(m[0] + 0.5, m[1] - 1.2, 2.6, 1.5), 10);
          p.set(m[0], m[1] - 2, 7);
        });
        p.pts([[9, 21], [27, 13], [4, 24], [33, 25], [15, 5]], 12);
      }
    },
    {
      id: "vase", name: "Цветы в вазе", w: 36, h: 36,
      palette: ["#fff6ee", "#ffeadf", "#a8d4f5", "#7fb4de", "#ff9fb7", "#ff7395", "#ffd66b", "#ffffff", "#ffad4d", "#8fd6b4", "#5fb88f", "#e8c9a8", "#d4b08a"],
      draw: function (p) {
        p.fill(function (x, y) { x = Math.floor(x); y = Math.floor(y); return y < 29 && Math.abs(((x % 6) + 6) % 6 - 3) + Math.abs(((y % 6) + 6) % 6 - 3) === 3; }, 2);
        p.fill(function (x, y) { return y >= 29; }, 12);
        p.fill(R(0, 29, 36, 30), 13);
        [[18, 21, 12, 10], [18, 21, 24, 8], [18, 21, 18, 6], [18, 21, 9, 16], [18, 21, 27, 15], [18, 21, 21, 12]].forEach(function (s) {
          p.fill(C(s[0], s[1], s[2], s[3], 0.5), 11);
        });
        p.fill(U(P([[11, 17], [14, 15.5], [16, 18], [13, 19]]), P([[25, 17], [22, 15.5], [20, 18], [23, 19]]), P([[16, 12], [19, 13], [18, 15]])), 10);
        function flower(cx, cy, r, c, mid) {
          for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3; p.fill(E(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.75, r * 0.75), c); }
          p.fill(E(cx, cy, r * 0.65, r * 0.65), mid);
        }
        flower(12, 10, 2.2, 5, 6);
        flower(24.5, 8, 2, 5, 9);
        flower(18, 5.5, 1.8, 7, 9);
        flower(8.5, 16, 1.7, 8, 7);
        flower(27.5, 15, 1.7, 8, 7);
        flower(21.5, 12, 1.3, 6, 7);
        p.fill(R(15.5, 20, 20.5, 22), 3);
        p.fill(I(E(18, 25.4, 6.2, 5.2), function (x, y) { return y < 30; }), 3);
        p.paint(function (x) { return x > 21.2; }, 4, 3);
        p.pts([[14, 23], [14, 24], [15, 22]], 8);
      }
    },
    {
      id: "mountains", name: "Звёзды над горами", w: 36, h: 36,
      palette: ["#28435a", "#3d6075", "#6a8ca0", "#e7a9bc", "#fff1b0", "#ffffff", "#8aa8b8", "#5f8193", "#46677b", "#2e4e5b", "#8fd3cf", "#6fbcbd"],
      draw: function (p) {
        p.fill(below(function (x) { return 8 + Math.sin(x / 5) * 1; }), 2);
        p.fill(below(function (x) { return 15 + Math.sin(x / 6 + 1) * 1; }), 3);
        p.fill(below(function (x) { return 21 + Math.sin(x / 4) * 0.6; }), 4);
        [[4, 3], [14, 6], [27, 2], [32, 9], [9, 12], [21, 10]].forEach(function (s, i) { p.star(s[0], s[1], 6, i % 2 ? 5 : null); });
        p.pts([[2, 8], [7, 5], [11, 2], [18, 3], [23, 6], [30, 5], [34, 3], [16, 13], [26, 14], [5, 16], [33, 16], [20, 17]], 5);
        function ridge(peaks, base) {
          return function (x) {
            var y = base;
            peaks.forEach(function (pk) { y = Math.min(y, pk[1] + Math.abs(x - pk[0]) * pk[2]); });
            return y;
          };
        }
        var far = ridge([[8, 16, 0.9], [22, 14, 0.8], [33, 17, 1]], 30);
        var mid = ridge([[3, 20, 0.9], [15, 18, 0.85], [28, 20, 0.9]], 32);
        var near = ridge([[10, 25, 0.7], [26, 24, 0.75]], 33);
        p.fill(below(far), 7);
        p.paint(function (x, y) { return y < far(x) + 2.2 && y < 19; }, 6, 7);
        p.fill(below(mid), 8);
        p.paint(function (x, y) { return y < mid(x) + 2 && y < 22; }, 6, 8);
        p.fill(below(near), 9);
        p.fill(function (x, y) { return y >= 31; }, 11);
        p.paint(function (x, y) { y = Math.floor(y); return (y === 32 || y === 34) && hash(Math.floor(x / 2) + y * 7) < 0.55; }, 12, 11);
        function tree(cx, top) { p.fill(P([[cx, top], [cx + 2.2, 31], [cx - 2.2, 31]]), 10); }
        tree(2, 22); tree(5, 25); tree(31, 23); tree(34, 21); tree(28, 26);
      }
    }
  ];

  /* ---------- сборка сетки ---------- */
  var cache = {};
  /** Возвращает { id, name, w, h, palette:[hex...], cells: Uint8Array (номер 1..N), counts } — неиспользуемые цвета выкидываются. */
  function build(id) {
    if (cache[id]) return cache[id];
    var def = PICTURES.filter(function (p) { return p.id === id; })[0];
    if (!def) return null;
    var p = new Pic(def.w, def.h);
    def.draw(p);
    var used = {};
    for (var i = 0; i < p.g.length; i++) used[p.g[i]] = true;
    var map = {}, palette = [], n = 0;
    def.palette.forEach(function (hex, k) { if (used[k + 1]) { n++; map[k + 1] = n; palette.push(hex); } });
    var cells = new Uint8Array(p.g.length), counts = new Array(n + 1).fill(0);
    for (var j = 0; j < p.g.length; j++) { cells[j] = map[p.g[j]] || 1; counts[cells[j]]++; }
    cache[id] = { id: def.id, name: def.name, w: def.w, h: def.h, palette: palette, cells: cells, counts: counts };
    return cache[id];
  }

  window.KvestColoringArt = {
    list: PICTURES.map(function (p) { return { id: p.id, name: p.name }; }),
    build: build
  };
})();
