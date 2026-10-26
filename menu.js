/* menu.js — вкладка «Меню»: мои блюда, рандомайзер ужина, план на неделю,
   недостающие продукты для списка покупок («Для меню»).
   Данные — через window.KvestStore; запасы — через мост window.KvestApp (app.js). */
(function () {
  "use strict";

  var Store = window.KvestStore;

  var DAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  var DAY_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
  var MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

  var SAMPLE_DISHES = [
    { name: "Гречка с курицей", ingredients: ["гречка", "курица", "лук", "морковь"] },
    { name: "Паста с сыром", ingredients: ["макароны", "сыр", "сливочное масло"] },
    { name: "Картошка с котлетами", ingredients: ["картофель", "фарш", "лук", "яйца"] },
    { name: "Омлет с овощами", ingredients: ["яйца", "молоко", "помидоры", "перец"] },
    { name: "Рис с овощами и яйцом", ingredients: ["рис", "яйца", "морковь", "горошек"] },
    { name: "Суп с фрикадельками", ingredients: ["фарш", "картофель", "морковь", "лук"] }
  ];

  function freshState() {
    return {
      loaded: false, loading: false, error: null,
      dishes: [], plan: {}, loadedWeeks: {}, skips: {},
      weekOffset: 0, rollId: null, rolling: false,
      editing: null, confirmDel: null, busy: false
    };
  }
  var state = freshState();

  /* ---------- утилиты ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function ui() { return window.KvestUI || { toast: function () {}, errText: function (e, f) { return f || "Ошибка"; } }; }
  function app() { return window.KvestApp; }
  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "art") { e.innerHTML = window.KvestArt.svg(v); e.classList.add("px-art"); }
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.keys(v).forEach(function (d) { e.dataset[d] = v[d]; });
      else e.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  /* ---------- даты (локальные, неделя с понедельника) ---------- */
  function ymd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseYmd(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function today() { return ymd(new Date()); }
  function weekStartOf(s) { var d = parseYmd(s); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return ymd(d); }
  function currentWeekStart() { return weekStartOf(today()); }
  function shownWeekStart() { return addDays(currentWeekStart(), state.weekOffset * 7); }
  function weekDays(ws) { var out = []; for (var i = 0; i < 7; i++) out.push(addDays(ws, i)); return out; }
  function fmtShort(s) { var d = parseYmd(s); return d.getDate() + " " + MONTHS[d.getMonth()]; }

  /* ---------- продукты и запасы ---------- */
  function norm(s) { return String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim(); }
  function nameMatch(a, b) { a = norm(a); b = norm(b); return !!a && !!b && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0); }
  function items() { return (app() && app().items()) || []; }
  function atHome(ing) {
    return items().some(function (it) { return (it.status === "ok" || it.status === "mid") && nameMatch(it.name, ing); });
  }
  function allHome(d) { return d.ingredients.length > 0 && d.ingredients.every(atHome); }
  function parseIngredients(text) {
    var seen = {}, out = [];
    String(text || "").split(/[,;\n]+/).forEach(function (p) {
      var t = p.replace(/\s+/g, " ").trim();
      if (!t) return;
      var k = norm(t);
      if (seen[k]) return;
      seen[k] = true;
      out.push(t.slice(0, 40));
    });
    return out.slice(0, 30);
  }
  function dishById(id) { return state.dishes.filter(function (d) { return d.id === id; })[0]; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---------- загрузка ---------- */
  async function loadWeek(ws) {
    if (state.loadedWeeks[ws]) return;
    var rows = await Store.listPlan(ws, addDays(ws, 6));
    weekDays(ws).forEach(function (d) { delete state.plan[d]; });
    (rows || []).forEach(function (r) { state.plan[r.day] = r.dish_id; });
    state.loadedWeeks[ws] = true;
  }

  async function load() {
    if (state.loading) return;
    state.loading = true; state.error = null;
    render();
    try {
      var cws = currentWeekStart();
      var r = await Promise.all([Store.listDishes(), Store.listSkips(cws)]);
      state.dishes = r[0] || [];
      state.skips[cws] = {};
      (r[1] || []).forEach(function (s) { state.skips[cws][norm(s.name)] = true; });
      state.loadedWeeks = {};
      await loadWeek(cws);
      if (state.weekOffset) await loadWeek(shownWeekStart());
      state.loaded = true;
    } catch (err) {
      state.error = ui().errText(err, "Не удалось загрузить меню.");
    } finally {
      state.loading = false;
      render();
      if (app()) app().refresh();
    }
  }

  /* ---------- выбор блюд ---------- */
  function plannedIdsInWeek(ws) {
    var ids = {};
    weekDays(ws).forEach(function (d) { if (state.plan[d]) ids[state.plan[d]] = true; });
    return ids;
  }
  function pickFrom(pools, exclude) {
    for (var i = 0; i < pools.length; i++) {
      var p = pools[i].filter(function (d) { return d.id !== exclude; });
      if (!p.length && pools[i].length) p = pools[i];
      if (p.length) return p[Math.floor(Math.random() * p.length)];
    }
    return null;
  }
  /** Приоритет: всё есть дома и ещё не в плане → не в плане → всё есть дома → любое. */
  function pickDish(ws, exclude, usedExtra) {
    var used = plannedIdsInWeek(ws);
    Object.keys(usedExtra || {}).forEach(function (k) { used[k] = true; });
    var all = state.dishes;
    var fresh = all.filter(function (d) { return !used[d.id]; });
    return pickFrom([
      fresh.filter(allHome),
      fresh,
      all.filter(allHome),
      all
    ], exclude);
  }

  /* ---------- для покупок ---------- */
  /** Недостающие продукты для ужинов с сегодня до конца текущей недели. */
  function shoppingEntries() {
    if (!state.loaded) return [];
    var cws = currentWeekStart(), t = today(), end = addDays(cws, 6);
    var skips = state.skips[cws] || {};
    var map = {}, order = [];
    for (var d = t; d <= end; d = addDays(d, 1)) {
      var dish = dishById(state.plan[d]);
      if (!dish) continue;
      dish.ingredients.forEach(function (ing) {
        var k = norm(ing);
        if (!k || skips[k] || atHome(ing)) return;
        if (!map[k]) { map[k] = { key: k, name: ing, dishes: [] }; order.push(k); }
        if (map[k].dishes.indexOf(dish.name) < 0) map[k].dishes.push(dish.name);
      });
    }
    return order.map(function (k) { return map[k]; });
  }

  async function markBought(entry) {
    var a = app();
    if (!a) return;
    var match = items().filter(function (it) { return nameMatch(it.name, entry.name); })[0];
    try {
      if (match) await a.setStatus(match, "ok", "Куплено: " + match.name);
      else { await a.addFoodItem(cap(entry.name)); ui().toast("Куплено и добавлено в запасы: " + cap(entry.name)); }
    } catch (err) {
      ui().toast(ui().errText(err, "Не удалось отметить покупку."), "error");
    }
    render();
  }

  async function skipEntry(entry) {
    var cws = currentWeekStart();
    state.skips[cws] = state.skips[cws] || {};
    state.skips[cws][entry.key] = true;
    if (app()) app().refresh();
    try { await Store.addSkip(cws, entry.key); }
    catch (err) {
      delete state.skips[cws][entry.key];
      if (app()) app().refresh();
      ui().toast(ui().errText(err, "Не удалось убрать из списка."), "error");
    }
  }

  /** Секция «Для меню» для вкладки «Покупки» (рисует app.js). */
  function shoppingSection() {
    if (!state.loaded) return null;
    var list = shoppingEntries();
    var sec = h("section", { class: "shop-sec px-box shop-menu", "aria-labelledby": "shop-menu-title" }, [
      h("h3", { class: "shop-title", id: "shop-menu-title" }, [h("span", { class: "shop-title-art", art: "bowl" }), "Для меню", h("span", { class: "chip-count", text: String(list.length) })])
    ]);
    if (!list.length) {
      var anyPlanned = false, cws = currentWeekStart();
      for (var d = today(); d <= addDays(cws, 6); d = addDays(d, 1)) if (state.plan[d]) anyPlanned = true;
      sec.appendChild(h("p", { class: "shop-empty", text: anyPlanned ? "Для ужинов на эту неделю всё есть дома." : "Запланируйте ужины во вкладке «Меню» — сюда попадут недостающие продукты." }));
      return sec;
    }
    var ul = h("ul", { class: "shop-list" });
    list.forEach(function (e) {
      ul.appendChild(h("li", { class: "shop-row" }, [
        h("button", {
          type: "button", class: "menu-bought", title: "Куплено",
          "aria-label": "Куплено: " + e.name, dataset: { fkey: "mbuy-" + e.key },
          onclick: function () { markBought(e); }
        }, [h("span", { "aria-hidden": "true", text: "✓" })]),
        h("div", { class: "shop-text" }, [
          h("span", { class: "shop-name", text: cap(e.name) }),
          h("span", { class: "shop-meta", text: "для: " + e.dishes.join(", ") })
        ]),
        h("button", {
          type: "button", class: "icon-btn", title: "Убрать на эту неделю",
          "aria-label": "Убрать «" + e.name + "» из списка на эту неделю",
          onclick: function () { skipEntry(e); }
        }, [h("span", { "aria-hidden": "true", text: "✕" })])
      ]));
    });
    sec.appendChild(ul);
    return sec;
  }

  /* ---------- рендер вкладки ---------- */
  function render() {
    var panel = document.getElementById("panel-menu");
    if (!panel) return;
    var active = document.activeElement;
    var fkey = active && active.dataset ? active.dataset.fkey : null;
    $("#menu-loading").hidden = !(state.loading && !state.loaded);
    $("#menu-error").hidden = !state.error;
    if (state.error) $("#menu-error p").textContent = state.error;
    $("#menu-view").hidden = !state.loaded;
    if (!state.loaded) return;
    renderRoll();
    renderWeek();
    renderDishes();
    if (fkey) {
      var again = panel.querySelector('[data-fkey="' + fkey + '"]');
      if (again) again.focus({ preventScroll: true });
    }
  }

  function ingChips(d) {
    var box = h("div", { class: "ing-chips" });
    d.ingredients.forEach(function (ing) {
      var home = atHome(ing);
      box.appendChild(h("span", { class: "ing " + (home ? "ing-home" : "ing-miss"), title: home ? "есть дома" : "нужно купить" }, [
        h("span", { class: "ing-dot", "aria-hidden": "true" }), ing, h("span", { class: "sr-only", text: home ? " — есть дома" : " — нужно купить" })
      ]));
    });
    return box;
  }

  function renderRoll() {
    var box = $("#roll-result");
    box.textContent = "";
    $("#btn-roll").disabled = !state.dishes.length || state.rolling;
    if (!state.dishes.length) {
      box.appendChild(h("p", { class: "roll-hint", text: "Сначала добавьте пару блюд в «Мои блюда» — и я подскажу, что приготовить." }));
      return;
    }
    var d = dishById(state.rollId);
    if (!d) return;
    var todayDish = state.plan[today()] === d.id;
    box.appendChild(h("div", { class: "roll-card-inner" + (state.rolling ? " is-rolling" : "") }, [
      h("span", { class: "roll-art", art: "bowl" }),
      h("div", { class: "roll-main" }, [
        h("p", { class: "roll-name", text: d.name }),
        allHome(d) ? h("span", { class: "home-badge", text: "всё есть дома" }) : null,
        ingChips(d)
      ])
    ]));
    if (!state.rolling) {
      box.appendChild(h("div", { class: "roll-actions" }, [
        h("button", { type: "button", class: "btn btn-ghost", dataset: { fkey: "roll-again" }, onclick: function () { roll(); } }, ["Другое блюдо"]),
        h("button", { type: "button", class: "btn btn-primary", disabled: todayDish ? true : null, dataset: { fkey: "roll-today" }, onclick: function () { planToday(d); } }, [todayDish ? "Уже на сегодня ✓" : "Поставить на сегодня"])
      ]));
    }
  }

  function roll() {
    if (!state.dishes.length || state.rolling) return;
    var final = pickDish(currentWeekStart(), state.rollId);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || state.dishes.length < 2) { state.rollId = final.id; render(); return; }
    state.rolling = true;
    var ticks = 0;
    var timer = setInterval(function () {
      ticks++;
      var r = state.dishes[Math.floor(Math.random() * state.dishes.length)];
      state.rollId = r.id;
      if (ticks >= 9) { clearInterval(timer); state.rolling = false; state.rollId = final.id; }
      render();
      if (!state.rolling) { var b = $('[data-fkey="roll-again"]'); if (b && document.activeElement && document.activeElement.id === "btn-roll") b.focus({ preventScroll: true }); }
    }, 70);
  }

  async function setDay(day, dishId) {
    var before = state.plan[day];
    if (dishId) state.plan[day] = dishId; else delete state.plan[day];
    render();
    if (app()) app().refresh();
    try {
      if (dishId) await Store.setPlan(day, dishId); else await Store.clearPlan(day);
    } catch (err) {
      if (before) state.plan[day] = before; else delete state.plan[day];
      render();
      if (app()) app().refresh();
      ui().toast(ui().errText(err, "Не удалось сохранить план."), "error");
    }
  }

  async function planToday(d) {
    state.weekOffset = 0;
    await setDay(today(), d.id);
    ui().toast("На ужин сегодня: " + d.name);
  }

  async function fillWeek() {
    var ws = shownWeekStart(), t = today();
    var empty = weekDays(ws).filter(function (d) { return !state.plan[d] && d >= t; });
    if (!state.dishes.length) { ui().toast("Сначала добавьте блюда"); return; }
    if (!empty.length) { ui().toast("Все дни уже заполнены"); return; }
    var btn = $("#btn-fill-week");
    btn.disabled = true;
    var usedNow = {};
    try {
      for (var i = 0; i < empty.length; i++) {
        var d = pickDish(ws, null, usedNow);
        usedNow[d.id] = true;
        state.plan[empty[i]] = d.id;
      }
      render();
      if (app()) app().refresh();
      for (var j = 0; j < empty.length; j++) await Store.setPlan(empty[j], state.plan[empty[j]]);
      ui().toast("Неделя заполнена: " + empty.length + " " + (empty.length === 1 ? "ужин" : empty.length < 5 ? "ужина" : "ужинов"));
    } catch (err) {
      ui().toast(ui().errText(err, "Не удалось заполнить неделю."), "error");
      state.loadedWeeks[ws] = false;
      try { await loadWeek(ws); } catch (e) { /* ignore */ }
      render();
      if (app()) app().refresh();
    } finally {
      btn.disabled = false;
    }
  }

  function renderWeek() {
    var ws = shownWeekStart(), t = today(), days = weekDays(ws);
    var lbl = fmtShort(days[0]) + " – " + fmtShort(days[6]);
    var rel = state.weekOffset === 0 ? "эта неделя" : state.weekOffset === 1 ? "следующая неделя" : state.weekOffset === -1 ? "прошлая неделя" : "";
    $("#week-label").textContent = lbl;
    $("#week-rel").textContent = rel;
    var ol = $("#week-days");
    ol.textContent = "";
    var sorted = state.dishes.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "ru"); });
    days.forEach(function (day, i) {
      var dishId = state.plan[day], dish = dishById(dishId), isToday = day === t, past = day < t;
      var selId = "day-" + day;
      var sel = h("select", { id: selId, class: "stat-select day-select", dataset: { fkey: "daysel-" + day }, disabled: !state.dishes.length ? true : null });
      sel.appendChild(h("option", { value: "", text: state.dishes.length ? "— выбрать блюдо —" : "нет блюд" }));
      sorted.forEach(function (d) {
        var o = h("option", { value: d.id, text: d.name + (allHome(d) ? " ✓" : "") });
        if (d.id === dishId) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () { setDay(day, sel.value || null); });
      var miss = dish ? dish.ingredients.filter(function (x) { return !atHome(x); }) : [];
      ol.appendChild(h("li", { class: "day-row" + (isToday ? " is-today" : "") + (past ? " is-past" : "") + (dish ? " has-dish" : "") }, [
        h("div", { class: "day-label" }, [
          h("span", { class: "day-name", text: DAY_SHORT[i] }),
          h("span", { class: "day-date", text: fmtShort(day) }),
          isToday ? h("span", { class: "today-badge", text: "сегодня" }) : null
        ]),
        h("div", { class: "day-main" }, [
          h("label", { for: selId, class: "sr-only", text: "Ужин: " + DAY_FULL[i] + ", " + fmtShort(day) }),
          sel,
          dish ? h("span", { class: "day-status " + (miss.length ? "is-miss" : "is-home"), text: miss.length ? "не хватает: " + miss.join(", ") : "всё есть дома" }) : null
        ]),
        dish ? h("button", { type: "button", class: "icon-btn icon-sm", "aria-label": "Очистить " + DAY_FULL[i], title: "Очистить", dataset: { fkey: "dayclr-" + day }, onclick: function () { setDay(day, null); } }, [h("span", { "aria-hidden": "true", text: "✕" })]) : h("span", { class: "day-spacer", "aria-hidden": "true" })
      ]));
    });
  }

  function renderDishes() {
    $("#dish-count").textContent = String(state.dishes.length);
    var list = $("#dish-list");
    list.textContent = "";
    if (!state.dishes.length) {
      list.appendChild(h("div", { class: "empty dish-empty" }, [
        h("span", { class: "empty-art", art: "bowl" }),
        h("p", { class: "empty-title", text: "Пока ни одного блюда" }),
        h("p", { class: "empty-sub", text: "Добавьте ужины, которые вы обычно готовите, — один раз. Потом можно будет планировать неделю в пару нажатий." }),
        h("button", { type: "button", class: "btn btn-ghost", id: "btn-samples", onclick: addSamples }, ["Добавить примеры блюд"])
      ]));
      return;
    }
    var ul = h("ul", { class: "dish-list" });
    state.dishes.forEach(function (d) {
      if (state.editing === d.id) {
        var nId = "edit-dish-name-" + d.id, iId = "edit-dish-ings-" + d.id;
        var preview = h("div", { class: "ing-chips ing-preview" });
        var ingInput = h("input", { id: iId, type: "text", value: d.ingredients.join(", "), maxlength: "400", autocomplete: "off" });
        var upd = function () { fillPreview(preview, ingInput.value); };
        ingInput.addEventListener("input", upd);
        upd();
        ul.appendChild(h("li", { class: "dish-card editing" }, [
          h("form", { class: "dish-edit", novalidate: true, onsubmit: function (e) { e.preventDefault(); saveEdit(d, e.currentTarget); } }, [
            h("label", { for: nId, text: "Название" }),
            h("input", { id: nId, type: "text", value: d.name, maxlength: "80", required: true, dataset: { fkey: "editname-" + d.id } }),
            h("label", { for: iId, text: "Ингредиенты через запятую" }),
            ingInput, preview,
            h("div", { class: "dish-edit-actions" }, [
              h("button", { type: "submit", class: "btn btn-primary btn-sm" }, ["Сохранить"]),
              h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { state.editing = null; render(); } }, ["Отмена"])
            ])
          ])
        ]));
        return;
      }
      if (state.confirmDel === d.id) {
        ul.appendChild(h("li", { class: "dish-card confirming" }, [
          h("p", { class: "goal-confirm-text", text: "Удалить «" + d.name + "»? Оно пропадёт и из плана на неделю." }),
          h("div", { class: "goal-confirm-actions" }, [
            h("button", { type: "button", class: "btn btn-danger btn-sm", dataset: { fkey: "dishdel-yes-" + d.id }, onclick: function () { deleteDish(d); } }, ["Да, удалить"]),
            h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { state.confirmDel = null; render(); } }, ["Нет"])
          ])
        ]));
        return;
      }
      var home = allHome(d);
      ul.appendChild(h("li", { class: "dish-card" + (home ? " all-home" : "") }, [
        h("div", { class: "dish-head" }, [
          h("div", { class: "dish-title" }, [
            h("h3", { class: "dish-name", text: d.name }),
            home ? h("span", { class: "home-badge", text: "всё есть дома" }) : null
          ]),
          h("div", { class: "goal-actions" }, [
            h("button", { type: "button", class: "icon-btn icon-sm", "aria-label": "Изменить «" + d.name + "»", title: "Изменить", dataset: { fkey: "dishedit-" + d.id },
              onclick: function () { state.editing = d.id; state.confirmDel = null; render(); var i = document.getElementById("edit-dish-name-" + d.id); if (i) i.focus(); } }, [h("span", { "aria-hidden": "true", text: "✎" })]),
            h("button", { type: "button", class: "icon-btn icon-sm", "aria-label": "Удалить «" + d.name + "»", title: "Удалить", dataset: { fkey: "dishdel-" + d.id },
              onclick: function () { state.confirmDel = d.id; state.editing = null; render(); var y = document.querySelector('[data-fkey="dishdel-yes-' + d.id + '"]'); if (y) y.focus(); } }, [h("span", { "aria-hidden": "true", text: "✕" })])
          ])
        ]),
        d.ingredients.length ? ingChips(d) : h("p", { class: "goal-empty", text: "Ингредиенты не указаны" })
      ]));
    });
    list.appendChild(ul);
  }

  function fillPreview(box, text) {
    box.textContent = "";
    parseIngredients(text).forEach(function (ing) {
      var home = atHome(ing);
      box.appendChild(h("span", { class: "ing " + (home ? "ing-home" : "ing-miss") }, [h("span", { class: "ing-dot", "aria-hidden": "true" }), ing]));
    });
  }

  /* ---------- действия с блюдами ---------- */
  async function addDish(e) {
    e.preventDefault();
    var form = e.currentTarget;
    var name = $("#dish-name").value.trim().replace(/\s+/g, " ");
    var ings = parseIngredients($("#dish-ings").value);
    var msg = $(".form-msg", form);
    if (!name) { msg.textContent = "Введите название блюда."; $("#dish-name").focus(); return; }
    msg.textContent = "";
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      var d = await Store.addDish({ name: name, ingredients: ings });
      state.dishes.push(d);
      form.reset();
      fillPreview($("#dish-preview"), "");
      render();
      ui().toast("Добавлено: " + d.name);
      $("#dish-name").focus();
    } catch (err) {
      msg.textContent = ui().errText(err, "Не удалось добавить блюдо.");
    } finally {
      btn.disabled = false;
    }
  }

  async function saveEdit(d, form) {
    var name = form.querySelector('input[id^="edit-dish-name-"]').value.trim().replace(/\s+/g, " ");
    var ings = parseIngredients(form.querySelector('input[id^="edit-dish-ings-"]').value);
    if (!name) { form.querySelector("input").focus(); return; }
    try {
      var upd = await Store.updateDish(d.id, { name: name, ingredients: ings });
      Object.assign(d, upd);
      state.editing = null;
      render();
      if (app()) app().refresh();
      var b = document.querySelector('[data-fkey="dishedit-' + d.id + '"]');
      if (b) b.focus();
    } catch (err) {
      ui().toast(ui().errText(err, "Не удалось сохранить блюдо."), "error");
    }
  }

  async function deleteDish(d) {
    try {
      await Store.deleteDish(d.id);
      state.dishes = state.dishes.filter(function (x) { return x.id !== d.id; });
      Object.keys(state.plan).forEach(function (day) { if (state.plan[day] === d.id) delete state.plan[day]; });
      if (state.rollId === d.id) state.rollId = null;
      state.confirmDel = null;
      render();
      if (app()) app().refresh();
      ui().toast("Блюдо удалено");
    } catch (err) {
      ui().toast(ui().errText(err, "Не удалось удалить блюдо."), "error");
    }
  }

  async function addSamples() {
    var btn = document.getElementById("btn-samples");
    if (btn) btn.disabled = true;
    try {
      for (var i = 0; i < SAMPLE_DISHES.length; i++) state.dishes.push(await Store.addDish(SAMPLE_DISHES[i]));
      render();
      ui().toast("Добавлено " + SAMPLE_DISHES.length + " блюд — их можно менять");
    } catch (err) {
      ui().toast(ui().errText(err, "Не удалось добавить примеры."), "error");
      render();
    }
  }

  async function goWeek(delta) {
    state.weekOffset += delta;
    render();
    try { await loadWeek(shownWeekStart()); }
    catch (err) { ui().toast(ui().errText(err, "Не удалось загрузить неделю."), "error"); }
    render();
  }

  function bind() {
    $("#btn-roll").addEventListener("click", roll);
    $("#btn-fill-week").addEventListener("click", fillWeek);
    $("#week-prev").addEventListener("click", function () { goWeek(-1); });
    $("#week-next").addEventListener("click", function () { goWeek(1); });
    $("#week-today").addEventListener("click", function () { if (state.weekOffset) goWeek(-state.weekOffset); });
    $("#form-dish").addEventListener("submit", addDish);
    $("#dish-ings").addEventListener("input", function (e) { fillPreview($("#dish-preview"), e.target.value); });
    $("#menu-retry").addEventListener("click", load);
    $("#dish-list").addEventListener("keydown", function (e) {
      if (e.key === "Escape" && (state.editing || state.confirmDel)) { state.editing = null; state.confirmDel = null; render(); }
    });
  }

  window.KvestMenu = {
    /** Загрузка после входа (нужна и для вкладки «Покупки»). */
    load: load,
    show: function () { if (!state.loaded && !state.loading) load(); else render(); },
    reset: function () { state = freshState(); render(); },
    /** Запасы изменились — пересчитать «есть дома». */
    refresh: function () { if (state.loaded) render(); },
    shoppingSection: shoppingSection,
    shoppingCount: function () { return shoppingEntries().length; },
    _norm: norm
  };

  function boot() { if (document.getElementById("panel-menu")) bind(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
