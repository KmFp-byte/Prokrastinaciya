/* coloring.js — раскраски по номерам: галерея и экран раскрашивания (canvas, зум, панорама, касания и мышь).
   Картинки — window.KvestColoringArt; прогресс — Store.listColorings / saveColoring.
   За первое завершение картинки: +1 балл к «Спокойствию» (goal_log, kind 'coloring'). */
(function () {
  "use strict";

  var Store = window.KvestStore;
  var Art = window.KvestColoringArt;

  var state = freshState();
  function freshState() {
    return { loaded: false, loading: false, error: null, progress: {}, current: null, visible: false };
  }
  var ed = null; // состояние редактора

  function $(sel, root) { return (root || document).querySelector(sel); }
  function ui() { return window.KvestUI || { toast: function () {}, errText: function (e, f) { return f || "Ошибка"; } }; }
  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.keys(v).forEach(function (d) { e.dataset[d] = v[d]; });
      else if (k === "style") e.setAttribute("style", v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  /* ---------- цвета ---------- */
  function hexRgb(hx) { var n = parseInt(hx.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbStr(a) { return "rgb(" + a[0] + "," + a[1] + "," + a[2] + ")"; }
  function mixRgb(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  /** Незакрашенная клетка: очень светлый серый, чуть темнее для тёмных цветов — видно силуэт картинки. */
  function ghost(hx) {
    var c = hexRgb(hx), l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    var g = Math.round(212 + (l / 255) * 36);
    return [g, g, g];
  }
  function lum(hx) { var c = hexRgb(hx); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }

  /* ---------- прогресс ---------- */
  function decode(str, n) {
    var a = new Uint8Array(n);
    if (str) for (var i = 0; i < n && i < str.length; i++) a[i] = str.charCodeAt(i) === 49 ? 1 : 0;
    return a;
  }
  function encode(a) { var s = ""; for (var i = 0; i < a.length; i++) s += a[i] ? "1" : "0"; return s; }
  function progressOf(id) {
    var b = Art.build(id), p = state.progress[id];
    var filled = p ? decode(p.filled, b.cells.length) : new Uint8Array(b.cells.length);
    var n = 0;
    for (var i = 0; i < filled.length; i++) n += filled[i];
    return { filled: filled, done: n, total: filled.length, pct: Math.floor(n / filled.length * 100), completed_at: p ? p.completed_at : null };
  }

  async function load() {
    if (state.loading) return;
    state.loading = true; state.error = null;
    renderGallery();
    try {
      var rows = await Store.listColorings();
      state.progress = {};
      (rows || []).forEach(function (r) { state.progress[r.picture_id] = { filled: r.filled || "", completed_at: r.completed_at || null }; });
      state.loaded = true;
    } catch (err) {
      state.error = ui().errText(err, "Не удалось загрузить раскраски.");
    } finally {
      state.loading = false;
      renderGallery();
    }
  }

  /* ---------- галерея ---------- */
  function drawThumb(canvas, id, clean) {
    var b = Art.build(id), pr = progressOf(id);
    canvas.width = b.w; canvas.height = b.h;
    var ctx = canvas.getContext("2d");
    var img = ctx.createImageData(b.w, b.h);
    for (var i = 0; i < b.cells.length; i++) {
      var hx = b.palette[b.cells[i] - 1];
      var c = (clean || pr.filled[i]) ? hexRgb(hx) : ghost(hx);
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function renderGallery() {
    var gal = $("#color-gallery");
    if (!gal) return;
    gal.hidden = !!state.current;
    $("#color-editor").hidden = !state.current;
    if (state.current) return;
    gal.textContent = "";
    if (state.error) {
      gal.appendChild(h("div", { class: "inline-error px-box" }, [h("p", { text: state.error }), h("button", { type: "button", class: "btn btn-sm", onclick: load }, ["Повторить"])]));
      return;
    }
    if (!state.loaded) { gal.appendChild(h("p", { class: "goal-empty", text: "Загружаем раскраски…" })); return; }
    gal.appendChild(h("div", { class: "color-intro" }, [
      h("h2", { class: "hero-title", text: "Раскраски по номерам" }),
      h("p", { class: "hero-sub", text: "Выбери картинку и раскрашивай клеточки по номерам. За каждую законченную картинку — +1 к «Спокойствию» героя." })
    ]));
    var grid = h("div", { class: "color-grid" });
    Art.list.forEach(function (it) {
      var pr = progressOf(it.id), done = pr.done === pr.total;
      var cv = h("canvas", { class: "pixel-canvas color-thumb", "aria-hidden": "true" });
      drawThumb(cv, it.id);
      grid.appendChild(h("button", {
        type: "button", class: "color-card px-box" + (done ? " is-done" : ""), dataset: { pic: it.id, fkey: "pic-" + it.id },
        "aria-label": it.name + ": " + (done ? "готово" : pr.pct + "%"),
        onclick: function () { openPicture(it.id); }
      }, [
        h("span", { class: "color-thumb-wrap" }, [cv, done ? h("span", { class: "done-badge", text: "готово ✓" }) : null]),
        h("span", { class: "color-name", text: it.name }),
        h("span", { class: "color-meta" }, [
          h("span", { class: "bar color-bar" }, [h("span", { style: "width:" + pr.pct + "%" })]),
          h("span", { class: "color-pct", text: pr.pct + "%" })
        ])
      ]));
    });
    gal.appendChild(grid);
  }

  /* ---------- редактор ---------- */
  function openPicture(id) {
    var b = Art.build(id), pr = progressOf(id);
    state.current = id;
    ed = {
      id: id, b: b, filled: pr.filled, completed_at: pr.completed_at,
      remaining: new Array(b.palette.length + 1).fill(0),
      sel: 1, s: 10, ox: 0, oy: 0, panMode: false,
      pointers: new Map(), stroke: null, pinch: null, dirty: false, saveTimer: null, raf: 0, confirmReset: false
    };
    for (var i = 0; i < b.cells.length; i++) if (!ed.filled[i]) ed.remaining[b.cells[i]]++;
    ed.sel = firstOpenColor(1) || 1;
    renderGallery();
    $("#color-title").textContent = b.name;
    $("#color-reset-confirm").hidden = true;
    renderPalette();
    updateProgress();
    requestAnimationFrame(function () { resizeCanvas(); fit(); draw(); });
    var back = $("#color-back");
    if (back) back.focus({ preventScroll: true });
  }

  function firstOpenColor(from) {
    var n = ed.b.palette.length;
    for (var k = 0; k < n; k++) { var c = ((from - 1 + k) % n) + 1; if (ed.remaining[c] > 0) return c; }
    return 0;
  }

  function renderPalette() {
    var box = $("#color-palette");
    box.textContent = "";
    ed.b.palette.forEach(function (hx, k) {
      var c = k + 1, rem = ed.remaining[c], done = rem === 0;
      box.appendChild(h("button", {
        type: "button", class: "pal-btn" + (done ? " is-done" : "") + (ed.sel === c ? " is-sel" : ""),
        style: "--pc:" + hx + ";--pt:" + (lum(hx) > 160 ? "#3b3436" : "#ffffff"),
        "aria-pressed": ed.sel === c ? "true" : "false",
        "aria-label": "Цвет " + c + (done ? ", готово" : ", осталось " + rem),
        dataset: { c: String(c) },
        onclick: function () { ed.sel = c; renderPalette(); draw(); }
      }, [h("span", { class: "pal-num", text: String(c) }), h("span", { class: "pal-rem", text: done ? "✓" : String(rem) })]));
    });
  }

  function updateProgress() {
    var n = 0;
    for (var i = 0; i < ed.filled.length; i++) n += ed.filled[i];
    var pct = Math.floor(n / ed.filled.length * 100);
    $("#color-progress").textContent = pct + "%";
    $("#color-progress-bar").style.width = pct + "%";
    return n === ed.filled.length;
  }

  function resizeCanvas() {
    var cv = $("#color-canvas"), wrap = $("#color-stage-inner");
    var r = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    ed.cw = Math.max(1, Math.round(r.width)); ed.ch = Math.max(1, Math.round(r.height));
    cv.width = Math.round(ed.cw * dpr); cv.height = Math.round(ed.ch * dpr);
    ed.dpr = dpr;
  }
  function fit() {
    var s = Math.min(ed.cw / ed.b.w, ed.ch / ed.b.h) * 0.96;
    ed.s = s; ed.minS = s * 0.6; ed.maxS = Math.max(48, s * 6);
    ed.ox = (ed.cw - ed.b.w * s) / 2; ed.oy = (ed.ch - ed.b.h * s) / 2;
  }
  function clampView() {
    var W = ed.b.w * ed.s, H = ed.b.h * ed.s, m = 40;
    ed.ox = Math.min(ed.cw - m, Math.max(m - W, ed.ox));
    ed.oy = Math.min(ed.ch - m, Math.max(m - H, ed.oy));
  }
  function zoomAt(px, py, factor) {
    var ns = Math.min(ed.maxS, Math.max(ed.minS, ed.s * factor));
    var k = ns / ed.s;
    ed.ox = px - (px - ed.ox) * k; ed.oy = py - (py - ed.oy) * k; ed.s = ns;
    ed.userView = true;
    clampView();
    draw();
  }

  function draw() {
    if (!ed) return;
    cancelAnimationFrame(ed.raf);
    ed.raf = requestAnimationFrame(drawNow);
  }
  function drawNow() {
    if (!ed) return;
    var cv = $("#color-canvas"), ctx = cv.getContext("2d"), b = ed.b, s = ed.s;
    var complete = ed.remaining.every(function (r, i) { return i === 0 || r === 0; });
    ctx.setTransform(ed.dpr, 0, 0, ed.dpr, 0, 0);
    ctx.fillStyle = "#faf6f7";
    ctx.fillRect(0, 0, ed.cw, ed.ch);
    var x0 = Math.max(0, Math.floor(-ed.ox / s)), y0 = Math.max(0, Math.floor(-ed.oy / s));
    var x1 = Math.min(b.w, Math.ceil((ed.cw - ed.ox) / s)), y1 = Math.min(b.h, Math.ceil((ed.ch - ed.oy) / s));
    var selRgb = hexRgb(b.palette[ed.sel - 1] || "#ffffff");
    var selFill = rgbStr(mixRgb(selRgb, [255, 255, 255], 0.5));
    var showNum = s >= 13 && !complete, showGrid = s >= 9 && !complete;
    ctx.font = "700 " + Math.max(8, Math.round(s * 0.46)) + "px Nunito, system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
      var i = y * b.w + x, c = b.cells[i], px = ed.ox + x * s, py = ed.oy + y * s;
      var sw = Math.ceil(px + s) - Math.floor(px), sh = Math.ceil(py + s) - Math.floor(py);
      if (ed.filled[i]) ctx.fillStyle = b.palette[c - 1];
      else if (c === ed.sel) ctx.fillStyle = selFill;
      else ctx.fillStyle = rgbStr(ghost(b.palette[c - 1]));
      ctx.fillRect(Math.floor(px), Math.floor(py), sw, sh);
      if (!ed.filled[i]) {
        if (showGrid) { ctx.strokeStyle = "rgba(90,70,80,0.1)"; ctx.lineWidth = 1; ctx.strokeRect(Math.floor(px) + 0.5, Math.floor(py) + 0.5, sw - 1, sh - 1); }
        if (showNum) { ctx.fillStyle = c === ed.sel ? "#3b3436" : "#9a9196"; ctx.fillText(String(c), px + s / 2, py + s / 2 + 0.5); }
      }
    }
    if (complete) { ctx.strokeStyle = "rgba(90,70,80,0.15)"; ctx.lineWidth = 2; ctx.strokeRect(ed.ox, ed.oy, b.w * s, b.h * s); }
    $("#zoom-hint").hidden = s >= 13 || complete;
  }

  function cellAt(clientX, clientY) {
    var r = $("#color-canvas").getBoundingClientRect();
    var x = Math.floor((clientX - r.left - ed.ox) / ed.s), y = Math.floor((clientY - r.top - ed.oy) / ed.s);
    if (x < 0 || y < 0 || x >= ed.b.w || y >= ed.b.h) return -1;
    return y * ed.b.w + x;
  }

  /** Красит клетку, если номер совпадает. Возвращает "ok" | "wrong" | "none". */
  function paintCell(i) {
    if (i < 0 || ed.filled[i]) return "none";
    var c = ed.b.cells[i];
    if (c !== ed.sel) return "wrong";
    ed.filled[i] = 1;
    ed.remaining[c]--;
    ed.dirty = true;
    if (ed.remaining[c] === 0) {
      var next = firstOpenColor(c);
      if (next) ed.sel = next;
      renderPalette();
    } else {
      var btn = document.querySelector('.pal-btn[data-c="' + c + '"] .pal-rem');
      if (btn) btn.textContent = String(ed.remaining[c]);
    }
    return "ok";
  }

  function paintLine(a, b) {
    // все клетки вдоль отрезка между двумя точками экрана
    var dx = b[0] - a[0], dy = b[1] - a[1], dist = Math.hypot(dx, dy);
    var steps = Math.max(1, Math.ceil(dist / Math.max(2, ed.s / 3))), any = false;
    for (var k = 1; k <= steps; k++) {
      var r = paintCell(cellAt(a[0] + dx * k / steps, a[1] + dy * k / steps));
      if (r === "ok") any = true;
    }
    return any;
  }

  function shake() {
    var el = $("#color-stage-inner");
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  function afterPaint() {
    draw();
    var complete = updateProgress();
    scheduleSave();
    if (complete) onComplete();
  }

  function scheduleSave() {
    clearTimeout(ed.saveTimer);
    ed.saveTimer = setTimeout(save, 1000);
  }
  async function save() {
    if (!ed || !ed.dirty) return;
    clearTimeout(ed.saveTimer);
    var id = ed.id, filled = encode(ed.filled), completed_at = ed.completed_at;
    ed.dirty = false;
    state.progress[id] = { filled: filled, completed_at: completed_at };
    try { await Store.saveColoring(id, { filled: filled, completed_at: completed_at }); }
    catch (err) { if (ed && ed.id === id) ed.dirty = true; ui().toast(ui().errText(err, "Прогресс не сохранился."), "error"); }
  }

  async function onComplete() {
    var first = !ed.completed_at;
    if (first) ed.completed_at = new Date().toISOString();
    ed.dirty = true;
    await save();
    var gotPoint = false;
    if (first) {
      try {
        var row = await Store.addLog({ goal_id: null, kind: "coloring", stat: "calm", points: 1, day: today() });
        gotPoint = true;
        if (window.KvestHero && window.KvestHero.externalLog) window.KvestHero.externalLog(row);
      } catch (err) {
        ui().toast(ui().errText(err, "Балл за раскраску не начислился."), "error");
      }
    }
    showDone(gotPoint);
  }

  function showDone(gotPoint) {
    var dlg = document.getElementById("color-done");
    drawThumb($("#color-done-canvas"), ed.id, true);
    $("#color-done-title").textContent = "«" + ed.b.name + "» готова!";
    $("#color-done-text").textContent = gotPoint ? "+1 к «Спокойствию» героя. Красота!" : "Картинка снова раскрашена — приятно, правда?";
    var conf = $("#color-confetti");
    conf.textContent = "";
    var arts = ["heart", "sparkle", "star", "leaf"];
    for (var i = 0; i < 18; i++) {
      var sp = h("span", { class: "confetto", style: "left:" + ((i * 41) % 100) + "%;animation-delay:" + (i % 6) * 0.12 + "s;--dx:" + (((i * 37) % 40) - 20) + "px" });
      sp.innerHTML = window.KvestArt.svg(arts[i % arts.length]);
      conf.appendChild(sp);
    }
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    setTimeout(function () { $("#color-done-ok").focus(); }, 30);
    renderPalette();
  }

  function closeEditor() {
    if (ed) { save(); cancelAnimationFrame(ed.raf); }
    ed = null;
    state.current = null;
    renderGallery();
  }

  function resetPicture() {
    ed.filled = new Uint8Array(ed.b.cells.length);
    ed.remaining = new Array(ed.b.palette.length + 1).fill(0);
    for (var i = 0; i < ed.b.cells.length; i++) ed.remaining[ed.b.cells[i]]++;
    ed.sel = 1; ed.dirty = true;
    $("#color-reset-confirm").hidden = true;
    renderPalette(); updateProgress(); draw(); save();
  }

  /* ---------- ввод: мышь, касания, перо ---------- */
  function bindCanvas() {
    var cv = $("#color-canvas");
    cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    cv.addEventListener("pointerdown", function (e) {
      if (!ed) return;
      cv.setPointerCapture(e.pointerId);
      ed.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (ed.pointers.size === 2) {
        // начало щипка: отменяем «ожидающее» касание
        ed.stroke = null;
        var pts = Array.from(ed.pointers.values());
        ed.pinch = { d: Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]), mx: (pts[0][0] + pts[1][0]) / 2, my: (pts[0][1] + pts[1][1]) / 2 };
        return;
      }
      if (ed.pointers.size > 2) return;
      var pan = ed.panMode || e.button === 1 || e.button === 2 || e.shiftKey || ed.space;
      ed.stroke = { pan: pan, start: [e.clientX, e.clientY], last: [e.clientX, e.clientY], touch: e.pointerType !== "mouse", started: false, t: Date.now() };
      if (!pan && e.pointerType === "mouse") {
        ed.stroke.started = true;
        var r = paintCell(cellAt(e.clientX, e.clientY));
        if (r === "wrong") shake();
        if (r === "ok") afterPaint();
      }
    });
    cv.addEventListener("pointermove", function (e) {
      if (!ed || !ed.pointers.has(e.pointerId)) return;
      ed.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (ed.pinch && ed.pointers.size >= 2) {
        var pts = Array.from(ed.pointers.values());
        var d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
        var mx = (pts[0][0] + pts[1][0]) / 2, my = (pts[0][1] + pts[1][1]) / 2;
        var r = cv.getBoundingClientRect();
        ed.ox += mx - ed.pinch.mx; ed.oy += my - ed.pinch.my;
        zoomAt(mx - r.left, my - r.top, d / (ed.pinch.d || d));
        ed.pinch = { d: d, mx: mx, my: my };
        return;
      }
      var st = ed.stroke;
      if (!st) return;
      if (st.pan) {
        ed.ox += e.clientX - st.last[0]; ed.oy += e.clientY - st.last[1];
        st.last = [e.clientX, e.clientY];
        ed.userView = true;
        clampView(); draw();
        return;
      }
      if (!st.started) {
        if (Math.hypot(e.clientX - st.start[0], e.clientY - st.start[1]) < 5) return;
        st.started = true;
        paintCell(cellAt(st.start[0], st.start[1]));
      }
      var any = paintLine(st.last, [e.clientX, e.clientY]);
      st.last = [e.clientX, e.clientY];
      if (any) afterPaint();
    });
    function up(e) {
      if (!ed) return;
      var st = ed.stroke;
      ed.pointers.delete(e.pointerId);
      if (ed.pointers.size < 2) ed.pinch = null;
      if (e.type === "pointercancel") { ed.stroke = null; return; }
      if (st && !st.pan && !st.started && ed.pointers.size === 0) {
        // короткое касание пальцем = закрасить одну клетку
        var r = paintCell(cellAt(st.start[0], st.start[1]));
        if (r === "wrong") shake();
        if (r === "ok") afterPaint();
      }
      if (ed.pointers.size === 0) ed.stroke = null;
    }
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", function (e) {
      if (!ed) return;
      e.preventDefault();
      var r = cv.getBoundingClientRect();
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0022));
      else { ed.ox -= e.deltaX; clampView(); draw(); }
    }, { passive: false });
    window.addEventListener("keydown", function (e) { if (ed && e.code === "Space" && e.target === document.body) { ed.space = true; e.preventDefault(); } });
    window.addEventListener("keyup", function (e) { if (ed && e.code === "Space") ed.space = false; });
    window.addEventListener("resize", function () {
      if (!ed || $("#color-editor").hidden) return;
      resizeCanvas();
      if (ed.userView) clampView(); else fit(); // пока пользователь не двигал картинку — держим её целиком по центру
      draw();
    });
  }

  function bind() {
    bindCanvas();
    $("#color-back").addEventListener("click", closeEditor);
    $("#zoom-in").addEventListener("click", function () { zoomAt(ed.cw / 2, ed.ch / 2, 1.35); });
    $("#zoom-out").addEventListener("click", function () { zoomAt(ed.cw / 2, ed.ch / 2, 1 / 1.35); });
    $("#zoom-fit").addEventListener("click", function () { fit(); ed.userView = false; draw(); });
    $("#pan-toggle").addEventListener("click", function () {
      ed.panMode = !ed.panMode;
      this.setAttribute("aria-pressed", ed.panMode ? "true" : "false");
      $("#color-stage-inner").classList.toggle("is-pan", ed.panMode);
    });
    $("#color-reset").addEventListener("click", function () { $("#color-reset-confirm").hidden = false; $("#color-reset-no").focus(); });
    $("#color-reset-no").addEventListener("click", function () { $("#color-reset-confirm").hidden = true; });
    $("#color-reset-yes").addEventListener("click", resetPicture);
    var dlg = document.getElementById("color-done");
    $("#color-done-ok").addEventListener("click", function () { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); });
    $("#color-done-gallery").addEventListener("click", function () { if (dlg.close) dlg.close(); closeEditor(); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && ed) save(); });
  }

  window.KvestColoring = {
    show: function () {
      state.visible = true;
      if (!state.loaded && !state.loading) load(); else renderGallery();
      if (ed) requestAnimationFrame(function () { resizeCanvas(); clampView(); draw(); });
    },
    hide: function () { state.visible = false; if (ed) save(); },
    reset: function () { if (ed) cancelAnimationFrame(ed.raf); ed = null; state = freshState(); renderGallery(); },
    /** Для тестов: раскрасить всё, кроме n клеток. */
    _fillAllBut: function (n) {
      if (!ed) return;
      var left = n || 0;
      for (var i = ed.b.cells.length - 1; i >= 0; i--) {
        if (ed.filled[i]) continue;
        if (left > 0) { left--; continue; }
        ed.filled[i] = 1; ed.remaining[ed.b.cells[i]]--;
      }
      ed.dirty = true;
      ed.sel = firstOpenColor(1) || ed.sel;
      renderPalette(); afterPaint();
    },
    _view: function () { return ed ? { s: ed.s, ox: ed.ox, oy: ed.oy, sel: ed.sel } : null; }
  };

  function boot() { if (document.getElementById("color-canvas")) bind(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
