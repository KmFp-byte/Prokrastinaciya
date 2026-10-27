/* hero.js — вкладка «Герой»: создание персонажа, цели, характеристики, уровни, настроение.
   Данные — через window.KvestStore, рисунок — через window.KvestHeroArt. */
(function () {
  "use strict";

  var Store = window.KvestStore;
  var A = window.KvestHeroArt;

  var COSTS = [10, 15, 20, 25, 30];
  var POOL = 20, START = 5;
  var POINTS = { habit: 1, skill: 2, big: 3 };

  var STATS = [
    { id: "health", label: "Здоровье", art: "heart" },
    { id: "beauty", label: "Красота", art: "sparkle" },
    { id: "mind", label: "Ум", art: "star" },
    { id: "home", label: "Быт", art: "house" },
    { id: "calm", label: "Спокойствие", art: "leaf" }
  ];
  var STAT_LABEL = {};
  STATS.forEach(function (s) { STAT_LABEL[s.id] = s.label; });

  var KINDS = [
    { id: "habit", title: "Ежедневные привычки", hint: "+1 балл · можно отметить раз в день", ph: "Например, «выпить 8 стаканов воды»", empty: "Добавьте привычку, которую хотите делать каждый день." },
    { id: "skill", title: "Навыки", hint: "+2 балла · каждый раз, сколько угодно в день", ph: "Например, «позанималась английским»", empty: "Добавьте навык, который хотите прокачивать." },
    { id: "big", title: "Большие дела", hint: "+3 балла · один раз, потом уходит в «Выполнено»", ph: "Например, «разобрать шкаф»", empty: "Добавьте большое дело — и вычеркните его, когда сделаете." }
  ];

  var PART_TABS = [
    { id: "gender", label: "Пол" },
    { id: "hair", label: "Волосы", word: "причёска" },
    { id: "eyes", label: "Глаза", word: "глаза" },
    { id: "mouth", label: "Рот", word: "рот" },
    { id: "accessory", label: "Аксессуар", word: "аксессуар" },
    { id: "top", label: "Верх", word: "верх" },
    { id: "bottom", label: "Низ", word: "низ" },
    { id: "bg", label: "Фон" }
  ];

  /* ---------- состояние ---------- */
  function freshState() {
    return {
      loaded: false, loading: false, error: null,
      hero: null, goals: [], log: [],
      mode: "view", firstTime: false,
      draft: null, draftBg: "room", partTab: "gender",
      editing: null, confirmDel: null, pending: {},
      visitSad: false
    };
  }
  var state = freshState();
  var thumbToken = 0;

  /* ---------- утилиты ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function ui() { return window.KvestUI || { toast: function () {}, errText: function (e, f) { return f || "Ошибка"; } }; }

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
      else if (k === "style") e.setAttribute("style", v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  /** Локальная дата YYYY-MM-DD (не UTC). */
  function localDate(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function yesterday() { var d = new Date(); d.setDate(d.getDate() - 1); return localDate(d); }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function pts(n) { return n + " " + plural(n, "балл", "балла", "баллов"); }
  function fmtDay(day) {
    if (!day) return "";
    var p = day.split("-");
    return p[2] + "." + p[1] + "." + p[0];
  }

  /* ---------- уровни ---------- */
  function cost(level) { return COSTS[(level - 1) % COSTS.length]; }
  function levelInfo(total) {
    var level = 1, rem = total;
    while (rem >= cost(level)) { rem -= cost(level); level++; }
    return { level: level, into: rem, need: cost(level), total: total };
  }
  function unlockedCount(level) { return Math.min(POOL, START + level - 1); }
  function variantUnlockLevel(i) { return i < START ? 1 : i - START + 2; }
  function bgUnlockLevel(j) { return j === 0 ? 1 : j * 3; }
  function bgCount(level) { return Math.min(A.BACKGROUNDS.length, 1 + Math.floor(level / 3)); }

  function totalPoints() { return state.log.reduce(function (s, l) { return s + (l.points || 0); }, 0); }
  function statPoints() {
    var out = {};
    STATS.forEach(function (s) { out[s.id] = 0; });
    state.log.forEach(function (l) { if (out[l.stat] != null) out[l.stat] += l.points || 0; });
    return out;
  }
  function currentLevel() { return levelInfo(totalPoints()).level; }

  /* Последний «увиденный» уровень — чтобы отпраздновать уровни, набранные вне вкладки (раскраски и т.п.). */
  function seenKey() { return "kvest.hero.seenLevel." + Store.mode; }
  function getSeen() { try { var v = parseInt(localStorage.getItem(seenKey()), 10); return isNaN(v) ? null : v; } catch (e) { return null; } }
  function setSeen(v) { try { localStorage.setItem(seenKey(), String(v)); } catch (e) { /* ignore */ } }
  function heroTabVisible() { var p = document.getElementById("panel-hero"); return !!p && !p.hidden; }
  function checkPendingLevel() {
    if (!state.loaded || !state.hero || state.mode !== "view") return;
    var lvl = currentLevel(), seen = getSeen();
    if (seen == null) { setSeen(lvl); return; }
    if (lvl > seen && heroTabVisible()) celebrate(seen, lvl);
    else if (lvl < seen) setSeen(lvl);
  }

  function todayLogs(goalId) {
    var today = localDate();
    return state.log.filter(function (l) { return l.goal_id === goalId && l.day === today; });
  }
  function mood() {
    var today = localDate();
    var any = state.log.some(function (l) { return l.day === today; });
    if (state.visitSad && !any) return "sad";
    return any ? "happy" : null;
  }

  /* ---------- загрузка ---------- */
  async function load() {
    state.loading = true; state.error = null;
    render();
    try {
      var r = await Promise.all([Store.getHero(), Store.listGoals(), Store.listLog()]);
      state.hero = r[0];
      state.goals = r[1] || [];
      state.log = r[2] || [];
      state.loaded = true;
      if (!state.hero) {
        state.firstTime = true;
        openCreator();
      } else {
        await visit();
        state.mode = "view";
      }
    } catch (err) {
      state.error = ui().errText(err, "Не удалось загрузить героя.");
    } finally {
      state.loading = false;
      render();
      checkPendingLevel();
    }
  }

  /** Отмечаем визит: если last_visit не сегодня — сдвигаем в prev_visit. */
  async function visit() {
    var today = localDate(), hero = state.hero;
    if (hero.last_visit !== today) {
      var prev = hero.last_visit || null;
      try {
        state.hero = await Store.saveHero({ last_visit: today, prev_visit: prev });
      } catch (e) {
        hero.prev_visit = prev; hero.last_visit = today;
      }
    }
    var pv = state.hero.prev_visit;
    state.visitSad = !!pv && pv < yesterday();
  }

  /* ---------- рендер ---------- */
  function render() {
    var panel = document.getElementById("panel-hero");
    if (!panel) return;
    var active = document.activeElement;
    var fkey = active && active.dataset ? active.dataset.fkey : null;

    $("#hero-loading").hidden = !state.loading;
    $("#hero-error").hidden = !state.error;
    if (state.error) $("#hero-error p").textContent = state.error;
    var ready = state.loaded && !state.loading && !state.error;
    $("#hero-view").hidden = !(ready && state.mode === "view");
    $("#hero-creator").hidden = !(ready && state.mode === "creator");

    var badge = document.getElementById("count-hero");
    if (badge) {
      badge.hidden = !(state.loaded && state.hero);
      if (state.loaded && state.hero) badge.textContent = "ур. " + currentLevel();
    }

    if (ready && state.mode === "view") renderView();
    if (ready && state.mode === "creator") renderCreator();

    if (fkey) {
      var again = panel.querySelector('[data-fkey="' + fkey + '"]');
      if (again) again.focus({ preventScroll: true });
    }
  }

  function renderView() {
    var look = state.hero.look, bg = state.hero.background || "room";
    var m = mood();
    A.render($("#hero-canvas"), look, { bg: bg, mood: m });
    $("#hero-stage").classList.toggle("is-sad", m === "sad");
    $("#hero-stage").classList.toggle("is-happy", m === "happy");

    var moodEl = $("#hero-mood");
    moodEl.className = "mood mood-" + (m || "calm");
    moodEl.textContent = m === "sad"
      ? "Герой скучал без тебя… Выполни любую цель сегодня — и он снова улыбнётся."
      : m === "happy" ? "Сегодня ты молодец — герой сияет!"
        : "Выполни цель — и герой засияет.";

    var info = levelInfo(totalPoints());
    $("#hero-level").textContent = "Уровень " + info.level;
    $("#hero-points").textContent = info.into + " / " + info.need + " " + plural(info.need, "балла", "баллов", "баллов");
    var bar = $("#hero-bar");
    bar.setAttribute("aria-valuemax", String(info.need));
    bar.setAttribute("aria-valuenow", String(info.into));
    bar.setAttribute("aria-valuetext", info.into + " из " + info.need);
    $("#hero-bar-fill").style.width = Math.round(info.into / info.need * 100) + "%";
    $("#hero-total").textContent = "Всего: " + pts(info.total);

    var next = [];
    if (unlockedCount(info.level) < POOL) next.push("На уровне " + (info.level + 1) + " откроется по новой вещи в каждой категории.");
    else next.push("Все вещи открыты!");
    var bc = bgCount(info.level);
    if (bc < A.BACKGROUNDS.length) next.push("Новый фон — на уровне " + bgUnlockLevel(bc) + ".");
    else next.push("Все фоны открыты.");
    $("#hero-next").textContent = next.join(" ");

    renderStats();
    renderGoals();
  }

  function renderStats() {
    var box = $("#stats-list");
    box.textContent = "";
    var sp = statPoints();
    STATS.forEach(function (s) {
      var p = sp[s.id], lvl = Math.floor(p / 10) + 1, into = p % 10;
      box.appendChild(h("div", { class: "stat stat-" + s.id }, [
        h("span", { class: "stat-icon", art: s.art }),
        h("div", { class: "stat-main" }, [
          h("div", { class: "stat-top" }, [
            h("span", { class: "stat-name", text: s.label }),
            h("span", { class: "stat-lvl", text: "ур. " + lvl }),
            h("span", { class: "stat-pts", text: pts(p) })
          ]),
          h("div", { class: "bar stat-bar", role: "progressbar", "aria-label": s.label + ": до следующего уровня", "aria-valuemin": "0", "aria-valuemax": "10", "aria-valuenow": String(into) }, [
            h("span", { style: "width:" + into * 10 + "%" })
          ])
        ])
      ]));
    });
  }

  function statSelect(id, value) {
    var sel = h("select", { id: id, class: "stat-select" });
    STATS.forEach(function (s) {
      var o = h("option", { value: s.id, text: s.label });
      if (s.id === value) o.selected = true;
      sel.appendChild(o);
    });
    return sel;
  }

  function statChip(stat) {
    return h("span", { class: "stat-chip chip-" + stat }, [h("span", { class: "stat-chip-icon", art: (STATS.filter(function (s) { return s.id === stat; })[0] || STATS[0]).art }), STAT_LABEL[stat] || stat]);
  }

  function goalRow(g) {
    if (state.editing === g.id) {
      var inputId = "edit-title-" + g.id;
      return h("li", { class: "goal-row editing" }, [
        h("form", { class: "goal-edit", dataset: { action: "save-edit", id: g.id } }, [
          h("label", { for: inputId, class: "sr-only", text: "Название цели" }),
          h("input", { id: inputId, type: "text", maxlength: "80", value: g.title, required: true, dataset: { fkey: "edit-" + g.id } }),
          h("label", { for: "edit-stat-" + g.id, class: "sr-only", text: "Характеристика" }),
          statSelect("edit-stat-" + g.id, g.stat),
          h("button", { type: "submit", class: "btn btn-primary btn-sm", text: "Сохранить" }),
          h("button", { type: "button", class: "btn btn-ghost btn-sm", dataset: { action: "cancel-edit" }, text: "Отмена" })
        ])
      ]);
    }
    if (state.confirmDel === g.id) {
      return h("li", { class: "goal-row confirming" }, [
        h("p", { class: "goal-confirm-text", text: "Удалить «" + g.title + "»? Заработанные баллы останутся." }),
        h("div", { class: "goal-confirm-actions" }, [
          h("button", { type: "button", class: "btn btn-danger btn-sm", dataset: { action: "delete-yes", id: g.id, fkey: "del-yes-" + g.id }, text: "Да, удалить" }),
          h("button", { type: "button", class: "btn btn-ghost btn-sm", dataset: { action: "delete-no", id: g.id }, text: "Нет" })
        ])
      ]);
    }
    var busy = !!state.pending[g.id];
    var lead, extra = null, sub = [statChip(g.stat)];
    if (g.kind === "habit") {
      var done = todayLogs(g.id).length > 0;
      lead = h("button", {
        type: "button", class: "goal-check" + (done ? " is-done" : ""), "aria-pressed": done ? "true" : "false",
        "aria-label": (done ? "Снять отметку: " : "Отметить: ") + g.title, disabled: busy ? true : null,
        dataset: { action: "toggle", id: g.id, fkey: "toggle-" + g.id }
      }, [h("span", { "aria-hidden": "true", text: done ? "✓" : "" })]);
      sub.push(h("span", { class: "goal-pts", text: done ? "сегодня +1 ✓" : "+1" }));
    } else if (g.kind === "skill") {
      var n = todayLogs(g.id).length;
      lead = h("button", {
        type: "button", class: "goal-plus", "aria-label": "Записать «" + g.title + "»: +2 балла", disabled: busy ? true : null,
        dataset: { action: "skill", id: g.id, fkey: "skill-" + g.id }
      }, ["+2"]);
      sub.push(h("span", { class: "goal-pts" + (n ? " has" : ""), text: "сегодня: " + n + " " + plural(n, "раз", "раза", "раз") }));
      if (n > 0) extra = h("button", { type: "button", class: "link-btn goal-undo", dataset: { action: "undo", id: g.id, fkey: "undo-" + g.id }, disabled: busy ? true : null, text: "отменить последнее" });
    } else {
      lead = h("button", {
        type: "button", class: "goal-done-btn", "aria-label": "Выполнено: " + g.title + " (+3 балла)", disabled: busy ? true : null,
        dataset: { action: "complete", id: g.id, fkey: "complete-" + g.id }
      }, ["Готово"]);
      sub.push(h("span", { class: "goal-pts", text: "+3" }));
    }
    var doneToday = g.kind === "habit" && todayLogs(g.id).length > 0;
    return h("li", { class: "goal-row kind-" + g.kind + (doneToday ? " done" : "") }, [
      lead,
      h("div", { class: "goal-text" }, [
        h("span", { class: "goal-title", text: g.title }),
        h("span", { class: "goal-sub" }, sub.concat(extra ? [extra] : []))
      ]),
      h("div", { class: "goal-actions" }, [
        h("button", { type: "button", class: "icon-btn icon-sm", "aria-label": "Изменить «" + g.title + "»", title: "Изменить", dataset: { action: "edit", id: g.id, fkey: "edit-btn-" + g.id } }, [h("span", { "aria-hidden": "true", text: "✎" })]),
        h("button", { type: "button", class: "icon-btn icon-sm", "aria-label": "Удалить «" + g.title + "»", title: "Удалить", dataset: { action: "delete", id: g.id, fkey: "del-" + g.id } }, [h("span", { "aria-hidden": "true", text: "✕" })])
      ])
    ]);
  }

  function renderGoals() {
    var root = $("#goals-root");
    root.textContent = "";
    KINDS.forEach(function (k) {
      var list = state.goals.filter(function (g) { return g.kind === k.id && !g.archived; });
      var sec = h("section", { class: "goal-sec px-box kind-" + k.id, "aria-labelledby": "goal-title-" + k.id }, [
        h("div", { class: "goal-head" }, [
          h("h3", { class: "sec-title", id: "goal-title-" + k.id }, [k.title, h("span", { class: "chip-count", text: String(list.length) })]),
          h("p", { class: "goal-hint", text: k.hint })
        ])
      ]);
      if (list.length) {
        var ul = h("ul", { class: "goal-list" });
        list.forEach(function (g) { ul.appendChild(goalRow(g)); });
        sec.appendChild(ul);
      } else {
        sec.appendChild(h("p", { class: "goal-empty", text: k.empty }));
      }
      var inId = "add-" + k.id;
      sec.appendChild(h("form", { class: "goal-add", dataset: { action: "add", kind: k.id }, novalidate: true }, [
        h("label", { for: inId, class: "sr-only", text: "Новая цель: " + k.title }),
        h("input", { id: inId, type: "text", maxlength: "80", placeholder: k.ph, autocomplete: "off", dataset: { fkey: "add-" + k.id } }),
        h("label", { for: "add-stat-" + k.id, class: "sr-only", text: "Характеристика" }),
        statSelect("add-stat-" + k.id, k.id === "habit" ? "health" : k.id === "skill" ? "mind" : "home"),
        h("button", { type: "submit", class: "btn btn-primary btn-sm", text: "Добавить" })
      ]));
      if (k.id === "big") {
        var arch = state.goals.filter(function (g) { return g.kind === "big" && g.archived; });
        if (arch.length) {
          var det = h("details", { class: "archive" }, [h("summary", { text: "Выполнено (" + arch.length + ")" })]);
          if (state.archiveOpen) det.open = true;
          det.addEventListener("toggle", function () { state.archiveOpen = det.open; });
          var ul2 = h("ul", { class: "goal-list" });
          arch.slice().reverse().forEach(function (g) {
            if (state.confirmDel === g.id || state.editing === g.id) { ul2.appendChild(goalRow(g)); return; }
            var lg = state.log.filter(function (l) { return l.goal_id === g.id; })[0];
            ul2.appendChild(h("li", { class: "goal-row archived" }, [
              h("span", { class: "goal-check is-done", "aria-hidden": "true", text: "✓" }),
              h("div", { class: "goal-text" }, [
                h("span", { class: "goal-title", text: g.title }),
                h("span", { class: "goal-sub" }, [statChip(g.stat), h("span", { class: "goal-pts", text: lg ? "+3 · " + fmtDay(lg.day) : "+3" })])
              ]),
              h("div", { class: "goal-actions" }, [
                h("button", { type: "button", class: "btn btn-ghost btn-sm", dataset: { action: "uncomplete", id: g.id, fkey: "unc-" + g.id }, disabled: state.pending[g.id] ? true : null, text: "Вернуть" }),
                h("button", { type: "button", class: "icon-btn icon-sm", "aria-label": "Удалить «" + g.title + "»", dataset: { action: "delete", id: g.id, fkey: "del-" + g.id } }, [h("span", { "aria-hidden": "true", text: "✕" })])
              ])
            ]));
          });
          det.appendChild(ul2);
          sec.appendChild(det);
        }
      }
      root.appendChild(sec);
    });
  }

  /* ---------- действия с целями ---------- */
  function goalById(id) { return state.goals.filter(function (g) { return g.id === id; })[0]; }

  async function withPoints(goalId, fn) {
    var before = currentLevel();
    state.pending[goalId] = true;
    render();
    try {
      await fn();
    } catch (err) {
      if (err && err.code === "duplicate") {
        ui().toast("Уже отмечено сегодня");
        try { state.log = await Store.listLog(); } catch (e) { /* ignore */ }
      } else {
        ui().toast(ui().errText(err, "Не удалось сохранить."), "error");
      }
    } finally {
      delete state.pending[goalId];
      render();
    }
    var after = currentLevel();
    if (after > before) celebrate(before, after);
    else setSeen(after);
  }

  function toggleHabit(g) {
    return withPoints(g.id, async function () {
      var logs = todayLogs(g.id);
      if (logs.length) {
        await Store.deleteLog(logs[0].id);
        state.log = state.log.filter(function (l) { return l.id !== logs[0].id; });
      } else {
        var row = await Store.addLog({ goal_id: g.id, kind: "habit", stat: g.stat, points: POINTS.habit, day: localDate() });
        state.log.push(row);
      }
    });
  }

  function logSkill(g) {
    return withPoints(g.id, async function () {
      var row = await Store.addLog({ goal_id: g.id, kind: "skill", stat: g.stat, points: POINTS.skill, day: localDate() });
      state.log.push(row);
    });
  }

  function undoSkill(g) {
    return withPoints(g.id, async function () {
      var logs = todayLogs(g.id).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
      if (!logs.length) return;
      await Store.deleteLog(logs[0].id);
      state.log = state.log.filter(function (l) { return l.id !== logs[0].id; });
    });
  }

  function completeBig(g) {
    return withPoints(g.id, async function () {
      var row = await Store.addLog({ goal_id: g.id, kind: "big", stat: g.stat, points: POINTS.big, day: localDate() });
      state.log.push(row);
      try {
        var upd = await Store.updateGoal(g.id, { archived: true });
        Object.assign(g, upd);
      } catch (err) {
        // откатываем очки, чтобы не было «выполнено, но не в архиве»
        await Store.deleteLog(row.id).catch(function () {});
        state.log = state.log.filter(function (l) { return l.id !== row.id; });
        throw err;
      }
      ui().toast("Выполнено: " + g.title + " (+3)");
    });
  }

  function uncompleteBig(g) {
    return withPoints(g.id, async function () {
      var logs = state.log.filter(function (l) { return l.goal_id === g.id; });
      for (var i = 0; i < logs.length; i++) await Store.deleteLog(logs[i].id);
      var ids = logs.map(function (l) { return l.id; });
      state.log = state.log.filter(function (l) { return ids.indexOf(l.id) < 0; });
      var upd = await Store.updateGoal(g.id, { archived: false });
      Object.assign(g, upd);
    });
  }

  async function addGoal(kind, form) {
    var input = form.querySelector("input"), sel = form.querySelector("select");
    var title = input.value.trim().replace(/\s+/g, " ");
    if (!title) { input.focus(); return; }
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      var g = await Store.addGoal({ kind: kind, title: title, stat: sel.value });
      state.goals.push(g);
      input.value = "";
      render();
      var again = document.getElementById("add-" + kind);
      if (again) again.focus();
    } catch (err) {
      ui().toast(ui().errText(err, "Не удалось добавить цель."), "error");
    } finally {
      btn.disabled = false;
    }
  }

  async function saveEdit(id, form) {
    var g = goalById(id);
    var title = form.querySelector("input").value.trim().replace(/\s+/g, " ");
    var stat = form.querySelector("select").value;
    if (!title) { form.querySelector("input").focus(); return; }
    try {
      var upd = await Store.updateGoal(id, { title: title, stat: stat });
      Object.assign(g, upd);
      state.editing = null;
      render();
      var b = document.querySelector('[data-fkey="edit-btn-' + id + '"]');
      if (b) b.focus();
    } catch (err) {
      ui().toast(ui().errText(err, "Не удалось сохранить."), "error");
    }
  }

  async function deleteGoal(id) {
    try {
      await Store.deleteGoal(id);
      state.goals = state.goals.filter(function (g) { return g.id !== id; });
      state.log = state.log.map(function (l) { return l.goal_id === id ? Object.assign({}, l, { goal_id: null }) : l; });
      state.confirmDel = null;
      render();
      ui().toast("Цель удалена, баллы остались");
    } catch (err) {
      ui().toast(ui().errText(err, "Не удалось удалить."), "error");
    }
  }

  function bindGoals() {
    var root = $("#goals-root");
    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn || btn.tagName === "FORM") return;
      var id = btn.dataset.id, g = id ? goalById(id) : null, act = btn.dataset.action;
      if (act === "toggle" && g) toggleHabit(g);
      else if (act === "skill" && g) logSkill(g);
      else if (act === "undo" && g) undoSkill(g);
      else if (act === "complete" && g) completeBig(g);
      else if (act === "uncomplete" && g) uncompleteBig(g);
      else if (act === "edit") { state.editing = id; state.confirmDel = null; render(); var inp = document.getElementById("edit-title-" + id); if (inp) inp.focus(); }
      else if (act === "cancel-edit") { var was = state.editing; state.editing = null; render(); var b = document.querySelector('[data-fkey="edit-btn-' + was + '"]'); if (b) b.focus(); }
      else if (act === "delete") { state.confirmDel = id; state.editing = null; if (g && g.archived) state.archiveOpen = true; render(); var y = document.querySelector('[data-fkey="del-yes-' + id + '"]'); if (y) y.focus(); }
      else if (act === "delete-no") { state.confirmDel = null; render(); var d = document.querySelector('[data-fkey="del-' + id + '"]'); if (d) d.focus(); }
      else if (act === "delete-yes") deleteGoal(id);
    });
    root.addEventListener("submit", function (e) {
      var form = e.target.closest("form[data-action]");
      if (!form) return;
      e.preventDefault();
      if (form.dataset.action === "add") addGoal(form.dataset.kind, form);
      else if (form.dataset.action === "save-edit") saveEdit(form.dataset.id, form);
    });
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && (state.editing || state.confirmDel)) { state.editing = null; state.confirmDel = null; render(); }
    });
  }

  /* ---------- празднование ---------- */
  function unlocksForLevel(L) {
    var items = [];
    var idx = START + L - 2;
    var gender = state.hero && state.hero.look ? state.hero.look.gender : "girl";
    PART_TABS.forEach(function (t) {
      if (!A.PARTS[t.id]) return;
      var list = A.variants(t.id, gender);
      if (idx >= START && idx < list.length) items.push(t.word.charAt(0).toUpperCase() + t.word.slice(1) + ": «" + list[idx].n + "»");
    });
    if (L % 3 === 0 && L / 3 < A.BACKGROUNDS.length) items.push("Новый фон: «" + A.BACKGROUNDS[L / 3].n + "»");
    return items;
  }

  function celebrate(from, to) {
    setSeen(to);
    var dlg = document.getElementById("levelup-dialog");
    var items = [];
    for (var L = from + 1; L <= to; L++) items = items.concat(unlocksForLevel(L));
    $("#levelup-title").textContent = "Уровень " + to + "!";
    var ul = $("#levelup-list");
    ul.textContent = "";
    if (!items.length) ul.appendChild(h("li", { text: "Все вещи уже открыты — ты настоящая легенда!" }));
    else {
      ul.appendChild(h("li", { class: "levelup-lead", text: "Открыто:" }));
      items.forEach(function (t) { ul.appendChild(h("li", { text: t })); });
    }
    A.render($("#levelup-canvas"), state.hero.look, { bg: state.hero.background || "room", mood: "happy" });
    var conf = $("#confetti");
    conf.textContent = "";
    var arts = ["heart", "sparkle", "star", "leaf"];
    for (var i = 0; i < 22; i++) {
      conf.appendChild(h("span", { class: "confetto", art: arts[i % arts.length], style: "left:" + ((i * 37) % 100) + "%;animation-delay:" + (i % 7) * 0.12 + "s;--dx:" + (((i * 53) % 40) - 20) + "px" }));
    }
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    setTimeout(function () { $("#levelup-ok").focus(); }, 30);
  }

  /* ---------- конструктор ---------- */
  function openCreator() {
    state.mode = "creator";
    state.draft = A.normalizeLook(state.hero ? state.hero.look : A.DEFAULT_LOOK);
    state.draftBg = (state.hero && state.hero.background) || "room";
    state.partTab = "gender";
  }

  function lvlNow() { return state.loaded ? currentLevel() : 1; }

  /** Смена пола: причёска, глаза и одежда должны существовать в наборе нового пола.
      Если такой вещи нет — берём вещь с тем же названием (если открыта), иначе первую открытую. */
  function withGender(look, gender, level) {
    var out = JSON.parse(JSON.stringify(look));
    var oldGender = out.gender;
    out.gender = gender;
    ["hair", "eyes", "top", "bottom"].forEach(function (part) {
      if (A.variantIndex(part, gender, out[part].v) >= 0) return;
      var list = A.variants(part, gender), uc = unlockedCount(level);
      var oldIdx = A.variantIndex(part, oldGender, out[part].v);
      var oldName = oldIdx >= 0 ? A.variants(part, oldGender)[oldIdx].n : null;
      var same = -1;
      for (var i = 0; i < Math.min(uc, list.length); i++) if (list[i].n === oldName) { same = i; break; }
      out[part].v = list[same >= 0 ? same : 0].id;
    });
    return out;
  }

  function renderCreator() {
    $("#creator-title").textContent = state.firstTime ? "Создай своего героя" : "Изменить внешность";
    $("#creator-lead").textContent = state.firstTime
      ? "Выбери пол, причёску, одежду и цвета. Новые вещи открываются с каждым уровнем."
      : "Новые вещи открываются с каждым уровнем, новые фоны — каждые 3 уровня.";
    $("#creator-cancel").hidden = state.firstTime;
    $("#creator-save").textContent = state.firstTime ? "Готово!" : "Сохранить";
    renderPreview();
    var tabs = $("#part-tabs");
    tabs.textContent = "";
    PART_TABS.forEach(function (t) {
      var on = state.partTab === t.id;
      tabs.appendChild(h("button", {
        type: "button", role: "tab", class: "part-tab", id: "ptab-" + t.id, "aria-selected": on ? "true" : "false",
        "aria-controls": "part-body", tabindex: on ? "0" : "-1", dataset: { part: t.id, fkey: "ptab-" + t.id }
      }, [t.label]));
    });
    $("#part-body").setAttribute("aria-labelledby", "ptab-" + state.partTab);
    renderPartBody();
  }

  function renderPreview() {
    A.render($("#creator-canvas"), state.draft, { bg: state.draftBg });
  }

  function swatches(palKey, current, onPick, label) {
    var pal = A.PAL[palKey], names = A.PAL_NAMES[palKey];
    var row = h("div", { class: "swatches", role: "radiogroup", "aria-label": label });
    pal.forEach(function (c, i) {
      row.appendChild(h("button", {
        type: "button", role: "radio", class: "swatch", "aria-checked": i === current ? "true" : "false",
        "aria-label": names[i] || ("цвет " + (i + 1)), title: names[i] || "",
        style: "--sw:" + A.hex(c), dataset: { fkey: "sw-" + palKey + "-" + label + "-" + i },
        onclick: function () { onPick(i); }
      }));
    });
    return row;
  }

  function scheduleThumbs(jobs) {
    var token = ++thumbToken;
    var i = 0;
    function step() {
      if (token !== thumbToken) return;
      var t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 24) { jobs[i](); i++; }
      if (i < jobs.length) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderPartBody() {
    var body = $("#part-body");
    body.textContent = "";
    var part = state.partTab, level = lvlNow(), jobs = [];

    if (part === "gender") {
      var grid = h("div", { class: "variant-grid gender-grid" });
      [["girl", "Девушка"], ["boy", "Парень"]].forEach(function (g) {
        var cv = h("canvas", { class: "pixel-canvas thumb-canvas", width: "128", height: "128", "aria-hidden": "true" });
        var look = withGender(state.draft, g[0], level);
        jobs.push(function () { A.render(cv, look, { crop: [20, 4, 88, 124] }); });
        grid.appendChild(h("button", {
          type: "button", class: "variant gender-variant", "aria-pressed": state.draft.gender === g[0] ? "true" : "false",
          dataset: { fkey: "gender-" + g[0] },
          onclick: function () {
            if (state.draft.gender === g[0]) return;
            state.draft = withGender(state.draft, g[0], level);
            renderPreview(); markPressed(grid, this);
          }
        }, [cv, h("span", { class: "variant-name", text: g[1] })]));
      });
      body.appendChild(h("h3", { class: "part-sub", text: "Пол" }));
      body.appendChild(grid);
      body.appendChild(h("h3", { class: "part-sub", text: "Тон кожи" }));
      body.appendChild(swatches("skin", state.draft.skin, function (i) { state.draft.skin = i; renderPreview(); renderPartBody(); }, "Тон кожи"));
      scheduleThumbs(jobs);
      return;
    }

    if (part === "bg") {
      var bc = bgCount(level);
      var bgrid = h("div", { class: "variant-grid bg-grid" });
      A.BACKGROUNDS.forEach(function (b, j) {
        var locked = j >= bc;
        var cv = h("canvas", { class: "thumb-canvas bg-thumb", width: "128", height: "128", "aria-hidden": "true" });
        jobs.push(function () { A.renderBackground(cv, b.id); });
        bgrid.appendChild(h("button", {
          type: "button", class: "variant" + (locked ? " is-locked" : ""), "aria-pressed": state.draftBg === b.id ? "true" : "false",
          "aria-disabled": locked ? "true" : null, dataset: { fkey: "bg-" + b.id },
          "aria-label": b.n + (locked ? ", откроется на " + bgUnlockLevel(j) + " уровне" : ""),
          onclick: function () { if (locked) return; state.draftBg = b.id; renderPreview(); markPressed(bgrid, this); }
        }, [cv, h("span", { class: "variant-name", text: b.n }), locked ? h("span", { class: "lock", text: "🔒 откроется на " + bgUnlockLevel(j) + " уровне" }) : null]));
      });
      body.appendChild(h("p", { class: "part-note", text: bc >= A.BACKGROUNDS.length ? "Все фоны открыты" : "Новый фон открывается каждые 3 уровня. Следующий — на уровне " + bgUnlockLevel(bc) + "." }));
      body.appendChild(bgrid);
      scheduleThumbs(jobs);
      return;
    }

    var gender = state.draft.gender;
    var variants = A.variants(part, gender), uc = unlockedCount(level), crop = A.CROPS[part];
    var vgrid = h("div", { class: "variant-grid part-" + part });
    variants.forEach(function (v, i) {
      var locked = i >= uc;
      var cv = h("canvas", { class: "pixel-canvas thumb-canvas", width: String(crop[2]), height: String(crop[3]), "aria-hidden": "true" });
      var val = A.variantValue(part, gender, i);
      var look = JSON.parse(JSON.stringify(state.draft));
      look[part].v = val;
      jobs.push(function () { A.render(cv, look, { crop: crop, focus: part === "eyes" ? "eyes" : null }); });
      var ulv = variantUnlockLevel(i);
      vgrid.appendChild(h("button", {
        type: "button", class: "variant" + (locked ? " is-locked" : ""), "aria-pressed": state.draft[part].v === val ? "true" : "false",
        "aria-disabled": locked ? "true" : null, dataset: { fkey: "var-" + part + "-" + val, value: String(val) },
        "aria-label": v.n + (locked ? ", откроется на " + ulv + " уровне" : ""),
        onclick: function () { if (locked) return; state.draft[part].v = val; renderPreview(); markPressed(vgrid, this); }
      }, [cv, h("span", { class: "variant-name", text: v.n }), locked ? h("span", { class: "lock", text: "🔒 откроется на " + ulv + " уровне" }) : null]));
    });
    var genderNote = A.isGendered(part) ? (gender === "boy" ? " (набор для парня)" : " (набор для девушки)") : "";
    body.appendChild(h("p", { class: "part-note", text: (uc >= POOL ? "Все вещи открыты ✨" : "Открыто " + uc + " из " + POOL + ". Следующая вещь — на уровне " + (level + 1) + ".") + genderNote }));
    body.appendChild(vgrid);
    body.appendChild(h("h3", { class: "part-sub", text: "Цвет" }));
    body.appendChild(swatches(A.PART_PAL[part], state.draft[part].c, function (k) { state.draft[part].c = k; renderPreview(); renderPartBody(); }, "Цвет: " + part));
    scheduleThumbs(jobs);
  }

  function markPressed(grid, btn) {
    Array.prototype.forEach.call(grid.querySelectorAll(".variant"), function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
  }

  async function saveCreator() {
    var btn = $("#creator-save");
    btn.disabled = true;
    try {
      if (state.firstTime) {
        var today = localDate();
        state.hero = await Store.saveHero({ look: state.draft, background: state.draftBg, last_visit: today, prev_visit: null });
        state.firstTime = false;
        setSeen(currentLevel());
        state.visitSad = false;
        ui().toast("Герой создан! Добро пожаловать в квест");
      } else {
        state.hero = await Store.saveHero({ look: state.draft, background: state.draftBg });
        ui().toast("Внешность сохранена");
      }
      state.mode = "view";
      thumbToken++;
      render();
      var e = $("#btn-edit-look");
      if (e) e.focus({ preventScroll: true });
    } catch (err) {
      ui().toast(ui().errText(err, "Не удалось сохранить героя."), "error");
    } finally {
      btn.disabled = false;
    }
  }

  function bindCreator() {
    $("#part-tabs").addEventListener("click", function (e) {
      var b = e.target.closest(".part-tab");
      if (!b) return;
      state.partTab = b.dataset.part;
      renderCreator();
      var again = document.getElementById("ptab-" + state.partTab);
      if (again) again.focus();
    });
    $("#part-tabs").addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var idx = PART_TABS.findIndex(function (t) { return t.id === state.partTab; });
      idx = (idx + (e.key === "ArrowRight" ? 1 : -1) + PART_TABS.length) % PART_TABS.length;
      state.partTab = PART_TABS[idx].id;
      renderCreator();
      var again = document.getElementById("ptab-" + state.partTab);
      if (again) { again.focus(); again.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    });
    $("#creator-save").addEventListener("click", saveCreator);
    $("#creator-cancel").addEventListener("click", function () { thumbToken++; state.mode = "view"; render(); var e = $("#btn-edit-look"); if (e) e.focus(); });
    $("#btn-edit-look").addEventListener("click", function () {
      openCreator(); render();
      var t = document.getElementById("ptab-gender");
      var top = document.getElementById("hero-creator");
      if (top) top.scrollIntoView({ block: "start", behavior: "smooth" });
      if (t) t.focus({ preventScroll: true });
    });
    $("#hero-retry").addEventListener("click", load);
    var dlg = document.getElementById("levelup-dialog");
    $("#levelup-ok").addEventListener("click", function () { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg && dlg.close) dlg.close(); });
  }

  /* ---------- публичное API ---------- */
  window.KvestHero = {
    /** Вызывается при открытии вкладки (после входа). */
    show: function () {
      if (!state.loaded && !state.loading) load();
      else { render(); checkPendingLevel(); }
    },
    /** Баллы, начисленные вне вкладки (например, за раскраску): обновить и при необходимости отпраздновать. */
    externalLog: function (row) {
      if (!state.loaded || !row) return;
      if (!state.log.some(function (l) { return l.id === row.id; })) state.log.push(row);
      render();
      checkPendingLevel();
    },
    /** Сброс при выходе из аккаунта. */
    reset: function () {
      thumbToken++;
      state = freshState();
      var badge = document.getElementById("count-hero");
      if (badge) badge.hidden = true;
      render();
    },
    /** Для отладки и тестов (уровни считаются так же, как в интерфейсе). */
    _levelInfo: levelInfo
  };

  function boot() {
    if (!document.getElementById("panel-hero")) return;
    bindGoals();
    bindCreator();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
