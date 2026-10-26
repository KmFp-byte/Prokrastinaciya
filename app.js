/* app.js — интерфейс «Домашнего квеста». Все данные идут через window.KvestStore. */
(function () {
  "use strict";

  var Store = window.KvestStore;
  var Art = window.KvestArt;

  var CATS = [
    { id: "food", label: "Еда" },
    { id: "meds", label: "Лекарства" },
    { id: "cosmetics", label: "Косметика" },
    { id: "skincare", label: "Средства для кожи" },
    { id: "chemicals", label: "Бытовая химия" }
  ];
  var CAT_LABEL = {};
  CATS.forEach(function (c) { CAT_LABEL[c.id] = c.label; });

  var STATUSES = [
    { id: "ok", label: "Достаточно", short: "Много" },
    { id: "mid", label: "Средне", short: "Средне" },
    { id: "low", label: "Кончается", short: "Мало" },
    { id: "out", label: "Закончился", short: "Нет" }
  ];
  var STATUS_LABEL = {};
  STATUSES.forEach(function (s) { STATUS_LABEL[s.id] = s.label; });

  var state = {
    items: [],
    shopping: [],
    filter: "all",
    tab: "inventory",
    loaded: false,
    editing: null,      // предмет в форме (null = новый)
    pendingBlob: null,  // уменьшенное фото, ещё не загруженное
    pendingUrl: null,
    busy: false
  };

  /* ---------- утилиты ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** Создание элемента. Текст всегда через textContent — пользовательский ввод не попадает в HTML. */
  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k === "art") { e.innerHTML = Art.svg(v); e.classList.add("px-art"); }
        else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
        else if (k === "dataset") Object.keys(v).forEach(function (d) { e.dataset[d] = v[d]; });
        else e.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function show(id) {
    ["screen-loading", "screen-fatal", "screen-auth", "screen-app"].forEach(function (s) {
      document.getElementById(s).hidden = s !== id;
    });
  }

  function errText(err, fallback) {
    var msg = String((err && (err.message || err.error_description)) || "");
    var code = err && err.code;
    var low = msg.toLowerCase();
    if (code === "quota") return "В браузере закончилось место для демо-данных. Удалите пару фото или предметов.";
    if (code === "decode") return "Не получилось прочитать это изображение. Попробуйте другое фото.";
    if (code === "upload") return "Фото не загрузилось. Проверьте интернет и попробуйте ещё раз.";
    if (low.indexOf("invalid login credentials") >= 0) return "Неверная почта или пароль.";
    if (low.indexOf("email not confirmed") >= 0) return "Почта ещё не подтверждена. Откройте ссылку из письма-приглашения.";
    if (low.indexOf("for security purposes") >= 0 || low.indexOf("rate limit") >= 0 || low.indexOf("too many") >= 0)
      return "Слишком много попыток. Подождите минуту и попробуйте снова.";
    if (low.indexOf("should be different") >= 0) return "Новый пароль должен отличаться от старого.";
    if (low.indexOf("password should be") >= 0 || low.indexOf("weak") >= 0) return "Пароль слишком простой или короткий.";
    if (low.indexOf("jwt") >= 0 || low.indexOf("session") >= 0 || code === "auth") return "Сессия истекла. Войдите заново.";
    if (low.indexOf("failed to fetch") >= 0 || low.indexOf("network") >= 0 || low.indexOf("load failed") >= 0 || code === "network" || !navigator.onLine)
      return "Нет связи с сервером. Проверьте интернет.";
    return fallback || "Что-то пошло не так. Попробуйте ещё раз.";
  }

  function toast(text, kind) {
    var box = document.getElementById("toasts");
    var t = h("div", { class: "toast px-box" + (kind ? " toast-" + kind : ""), role: kind === "error" ? "alert" : "status" }, [
      h("span", { class: "toast-icon", art: kind === "error" ? "oops" : "sparkle" }),
      h("span", { text: text })
    ]);
    while (box.children.length >= 2) box.removeChild(box.firstChild);
    box.appendChild(t);
    setTimeout(function () { t.classList.add("out"); }, 3600);
    setTimeout(function () { t.remove(); }, 4000);
  }

  function setMsg(form, text, ok) {
    var p = $(".form-msg", form);
    p.textContent = text || "";
    p.classList.toggle("ok", !!ok);
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.textContent;
      btn.textContent = label || "Минутку…";
      btn.disabled = true;
    } else {
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
      btn.disabled = false;
    }
  }

  /* ---------- авторизация ---------- */

  function authView(view) {
    ["login", "forgot", "setpass"].forEach(function (v) {
      document.getElementById("form-" + v).hidden = v !== view;
    });
    var form = document.getElementById("form-" + view);
    setMsg(form, "");
    var first = $("input", form);
    if (first) setTimeout(function () { first.focus(); }, 30);
  }

  function showSetPassword(kind) {
    show("screen-auth");
    $("#setpass-lead").textContent = kind === "invite"
      ? "Добро пожаловать! Придумайте пароль — с ним вы будете входить в квест."
      : "Придумайте новый пароль для входа.";
    authView("setpass");
  }

  function bindAuth() {
    $all("[data-auth-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        var target = b.dataset.authView;
        if (target === "forgot") $("#forgot-email").value = $("#login-email").value;
        authView(target);
      });
    });

    $("#form-login").addEventListener("submit", async function (e) {
      e.preventDefault();
      var form = e.currentTarget;
      var email = form.email.value.trim();
      var pass = form.password.value;
      if (!email || !pass) return setMsg(form, "Введите почту и пароль.");
      var btn = $("button[type=submit]", form);
      setBusy(btn, true, "Входим…");
      setMsg(form, "");
      try {
        await Store.signIn(email, pass);
        form.password.value = "";
        await enterApp();
      } catch (err) {
        setMsg(form, errText(err, "Не удалось войти."));
      } finally {
        setBusy(btn, false);
      }
    });

    $("#form-forgot").addEventListener("submit", async function (e) {
      e.preventDefault();
      var form = e.currentTarget;
      var email = form.email.value.trim();
      if (!email || email.indexOf("@") < 1) return setMsg(form, "Введите почту, на которую создан аккаунт.");
      var btn = $("button[type=submit]", form);
      setBusy(btn, true, "Отправляем…");
      try {
        await Store.resetPassword(email);
        setMsg(form, "Если такой аккаунт есть, письмо уже летит. Откройте ссылку из него на этом устройстве.", true);
      } catch (err) {
        setMsg(form, errText(err, "Не удалось отправить письмо."));
      } finally {
        setBusy(btn, false);
      }
    });

    $("#form-setpass").addEventListener("submit", async function (e) {
      e.preventDefault();
      var form = e.currentTarget;
      var p1 = form.password.value;
      var p2 = form.password2.value;
      if (p1.length < 6) return setMsg(form, "Пароль должен быть не короче 6 символов.");
      if (p1 !== p2) return setMsg(form, "Пароли не совпадают.");
      var btn = $("button[type=submit]", form);
      setBusy(btn, true, "Сохраняем…");
      try {
        await Store.updatePassword(p1);
        form.reset();
        // убираем токены из адреса
        history.replaceState(null, "", location.pathname);
        toast("Пароль сохранён. Добро пожаловать!");
        await enterApp();
      } catch (err) {
        setMsg(form, errText(err, "Не удалось сохранить пароль."));
      } finally {
        setBusy(btn, false);
      }
    });

    $("#btn-logout").addEventListener("click", async function () {
      try { await Store.signOut(); } catch (err) { /* выходим локально в любом случае */ }
      state.items = []; state.shopping = []; state.loaded = false; state.entered = false;
      if (window.KvestHero) window.KvestHero.reset();
      if (window.KvestMenu) window.KvestMenu.reset();
      renderAll();
      show("screen-auth");
      authView("login");
    });
  }

  /* ---------- загрузка данных ---------- */

  async function loadData() {
    $("#inv-error").hidden = true;
    try {
      var res = await Promise.all([Store.listItems(), Store.listShopping()]);
      state.items = res[0] || [];
      state.shopping = res[1] || [];
      state.loaded = true;
    } catch (err) {
      $("#inv-error p").textContent = errText(err, "Не удалось загрузить данные.");
      $("#inv-error").hidden = false;
    }
    renderAll();
  }

  async function enterApp() {
    var session = await Store.getSession();
    if (Store.mode === "supabase" && !session) { show("screen-auth"); authView("login"); return; }
    $("#user-email").textContent = Store.mode === "demo" ? "гость" : (session.user && session.user.email) || "";
    $("#btn-logout").hidden = Store.mode === "demo";
    $("#demo-banner").hidden = Store.mode !== "demo";
    show("screen-app");
    state.entered = true;
    state.loaded = false;
    renderAll();
    if (state.tab === "hero" && window.KvestHero) window.KvestHero.show();
    if (window.KvestMenu) window.KvestMenu.load();
    await loadData();
  }

  /* ---------- рендер: запасы ---------- */

  function visibleItems() {
    return state.filter === "all" ? state.items : state.items.filter(function (i) { return i.category === state.filter; });
  }

  function shoppingAuto() {
    return state.items.filter(function (i) { return (i.status === "low" || i.status === "out") && !i.skip_shopping; });
  }

  function renderSummary() {
    var low = state.items.filter(function (i) { return i.status === "low"; }).length;
    var out = state.items.filter(function (i) { return i.status === "out"; }).length;
    var box = $("#summary");
    box.textContent = "";
    box.appendChild(h("span", { class: "sum-pill sum-total" }, [h("b", { text: String(state.items.length) }), " в инвентаре"]));
    box.appendChild(h("span", { class: "sum-pill sum-low" }, [h("i", { class: "dot dot-low", "aria-hidden": "true" }), h("b", { text: String(low) }), " кончается"]));
    box.appendChild(h("span", { class: "sum-pill sum-out" }, [h("i", { class: "dot dot-out", "aria-hidden": "true" }), h("b", { text: String(out) }), " закончилось"]));
  }

  function renderChips() {
    var box = $("#chips");
    box.textContent = "";
    var counts = { all: state.items.length };
    CATS.forEach(function (c) { counts[c.id] = 0; });
    state.items.forEach(function (i) { if (counts[i.category] != null) counts[i.category]++; });
    [{ id: "all", label: "Все" }].concat(CATS).forEach(function (c) {
      box.appendChild(h("button", {
        type: "button",
        class: "chip chip-" + c.id,
        "aria-pressed": state.filter === c.id ? "true" : "false",
        dataset: { fkey: "chip-" + c.id },
        onclick: function () { state.filter = c.id; renderAll(); }
      }, [
        c.id !== "all" ? h("span", { class: "chip-art", art: c.id }) : h("span", { class: "chip-art", art: "star" }),
        h("span", { class: "chip-label", text: c.label }),
        h("span", { class: "chip-count", text: String(counts[c.id]) })
      ]));
    });
  }

  function photoEl(item, cls) {
    var wrap = h("div", { class: cls + " cat-bg-" + item.category });
    if (item.photo_path) {
      var img = h("img", { alt: "", loading: "lazy", decoding: "async" });
      img.addEventListener("error", function () { img.remove(); wrap.appendChild(h("span", { class: "ph-art", art: item.category })); });
      wrap.appendChild(img);
      Store.photoUrl(item.photo_path).then(function (u) {
        if (u) img.src = u;
        else { img.remove(); wrap.appendChild(h("span", { class: "ph-art", art: item.category })); }
      });
    } else {
      wrap.appendChild(h("span", { class: "ph-art", art: item.category }));
    }
    return wrap;
  }

  function card(item) {
    var statusRow = h("div", { class: "status-row", role: "group", "aria-label": "Статус: " + item.name });
    STATUSES.forEach(function (s) {
      statusRow.appendChild(h("button", {
        type: "button",
        class: "st-btn st-" + s.id,
        "aria-pressed": item.status === s.id ? "true" : "false",
        title: s.label,
        dataset: { fkey: "st-" + item.id + "-" + s.id },
        onclick: function () { changeStatus(item, s.id); }
      }, [h("i", { class: "dot dot-" + s.id, "aria-hidden": "true" }), h("span", { class: "st-label", text: s.short }), h("span", { class: "sr-only", text: " — " + s.label })]));
    });

    return h("article", { class: "card px-box is-" + item.status }, [
      h("button", {
        type: "button",
        class: "card-photo-btn",
        "aria-label": "Изменить «" + item.name + "»",
        dataset: { fkey: "edit-" + item.id },
        onclick: function () { openItemDialog(item); }
      }, [
        photoEl(item, "card-photo"),
        h("span", { class: "marker marker-" + item.status, "aria-hidden": "true" }),
        h("span", { class: "edit-hint", "aria-hidden": "true", text: "✎" })
      ]),
      h("div", { class: "card-body" }, [
        h("h3", { class: "card-name", text: item.name }),
        h("p", { class: "card-meta" }, [
          h("span", { class: "card-cat", text: CAT_LABEL[item.category] || item.category }),
          h("span", { class: "card-status st-text-" + item.status, text: STATUS_LABEL[item.status] })
        ]),
        statusRow
      ])
    ]);
  }

  function renderGrid() {
    var grid = $("#grid");
    grid.textContent = "";
    if (!state.loaded) {
      for (var i = 0; i < 4; i++) grid.appendChild(h("div", { class: "card px-box skeleton", "aria-hidden": "true" }));
      return;
    }
    var list = visibleItems();
    if (!list.length) {
      var empty = state.items.length === 0;
      grid.appendChild(h("div", { class: "empty px-box" }, [
        h("span", { class: "empty-art", art: "cat" }),
        h("p", { class: "empty-title", text: empty ? "Инвентарь пока пуст" : "В этой категории ничего нет" }),
        h("p", { class: "empty-sub", text: empty ? "Добавьте первый предмет — можно сразу сфотографировать его телефоном." : "Выберите другую категорию или добавьте предмет." }),
        h("button", { type: "button", class: "btn btn-primary", onclick: function () { openItemDialog(null); } }, ["+ Добавить предмет"])
      ]));
      return;
    }
    list.forEach(function (item) { grid.appendChild(card(item)); });
  }

  function renderInventory() {
    renderSummary();
    renderChips();
    renderGrid();
  }

  /* ---------- рендер: покупки ---------- */

  function renderShopping() {
    var root = $("#shop-lists");
    root.textContent = "";
    var auto = shoppingAuto();
    var manual = state.shopping.slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); });

    var autoSec = h("section", { class: "shop-sec px-box", "aria-labelledby": "shop-auto-title" }, [
      h("h3", { class: "shop-title", id: "shop-auto-title" }, [h("span", { class: "shop-title-art", art: "chest" }), "Из запасов", h("span", { class: "chip-count", text: String(auto.length) })])
    ]);
    if (!auto.length) {
      autoSec.appendChild(h("p", { class: "shop-empty", text: state.loaded ? "Всё на месте — ничего не кончается." : "Загружаем…" }));
    } else {
      var ul = h("ul", { class: "shop-list" });
      auto.forEach(function (item) {
        ul.appendChild(h("li", { class: "shop-row" }, [
          h("button", {
            type: "button",
            class: "shop-bought",
            title: "Купила — отметить как «Достаточно»",
            "aria-label": "Купила «" + item.name + "» — отметить как «Достаточно»",
            dataset: { fkey: "buy-" + item.id },
            onclick: function () { changeStatus(item, "ok", "Куплено: " + item.name); }
          }, [photoEl(item, "shop-thumb is-" + item.status), h("span", { class: "shop-check", "aria-hidden": "true", text: "✓" })]),
          h("div", { class: "shop-text" }, [
            h("span", { class: "shop-name", text: item.name }),
            h("span", { class: "shop-meta" }, [h("i", { class: "dot dot-" + item.status, "aria-hidden": "true" }), STATUS_LABEL[item.status] + " · " + (CAT_LABEL[item.category] || "")])
          ]),
          h("button", {
            type: "button",
            class: "icon-btn",
            "aria-label": "Убрать «" + item.name + "» из списка",
            title: "Убрать из списка",
            onclick: function () { skipItem(item); }
          }, [h("span", { "aria-hidden": "true", text: "✕" })])
        ]));
      });
      autoSec.appendChild(ul);
    }
    root.appendChild(autoSec);

    // v3: недостающие продукты для меню
    var menuSec = window.KvestMenu ? window.KvestMenu.shoppingSection() : null;
    if (menuSec) root.appendChild(menuSec);

    var manSec = h("section", { class: "shop-sec px-box", "aria-labelledby": "shop-man-title" }, [
      h("h3", { class: "shop-title", id: "shop-man-title" }, [h("span", { class: "shop-title-art", art: "bag" }), "Свои записи", h("span", { class: "chip-count", text: String(manual.filter(function (m) { return !m.done; }).length) })])
    ]);
    if (!manual.length) {
      manSec.appendChild(h("p", { class: "shop-empty", text: state.loaded ? "Пока пусто. Добавьте запись в поле выше." : "Загружаем…" }));
    } else {
      var ul2 = h("ul", { class: "shop-list" });
      manual.forEach(function (m) {
        var cbId = "cb-" + m.id;
        ul2.appendChild(h("li", { class: "shop-row" + (m.done ? " done" : "") }, [
          h("input", {
            type: "checkbox",
            id: cbId,
            class: "px-check",
            checked: m.done ? true : null,
            dataset: { fkey: "cb-" + m.id },
            onchange: function (e) { toggleManual(m, e.target.checked); }
          }),
          h("label", { for: cbId, class: "shop-text" }, [h("span", { class: "shop-name", text: m.name })]),
          h("button", {
            type: "button",
            class: "icon-btn",
            "aria-label": "Удалить «" + m.name + "»",
            title: "Удалить",
            onclick: function () { deleteManual(m); }
          }, [h("span", { "aria-hidden": "true", text: "✕" })])
        ]));
      });
      manSec.appendChild(ul2);
    }
    root.appendChild(manSec);
  }

  function renderCounts() {
    $("#count-inventory").textContent = String(state.items.length);
    var n = shoppingAuto().length + state.shopping.filter(function (m) { return !m.done; }).length +
      (window.KvestMenu ? window.KvestMenu.shoppingCount() : 0);
    $("#count-shopping").textContent = String(n);
  }

  function renderAll() {
    var active = document.activeElement;
    var fkey = active && active.dataset ? active.dataset.fkey : null;
    renderInventory();
    renderShopping();
    renderCounts();
    if (window.KvestMenu) window.KvestMenu.refresh();
    if (fkey) {
      var again = document.querySelector('[data-fkey="' + fkey + '"]');
      if (again) again.focus({ preventScroll: true });
    }
  }

  /* ---------- действия ---------- */

  function replaceItem(updated) {
    state.items = state.items.map(function (i) { return i.id === updated.id ? updated : i; });
  }

  /** Короткая «радостная» анимация карточки после смены статуса. */
  function popCard(id) {
    var btn = document.querySelector('[data-fkey^="st-' + id + '-"]');
    var c = btn && btn.closest(".card");
    if (!c) return;
    c.classList.remove("pop");
    void c.offsetWidth;
    c.classList.add("pop");
  }

  async function changeStatus(item, status, okMsg) {
    if (item.status === status && !item.skip_shopping) return;
    var before = Object.assign({}, item);
    replaceItem(Object.assign({}, item, { status: status, skip_shopping: false }));
    renderAll();
    try {
      replaceItem(await Store.setStatus(item.id, status));
      renderAll();
      popCard(item.id);
      if (okMsg) toast(okMsg);
    } catch (err) {
      replaceItem(before);
      renderAll();
      toast(errText(err, "Не удалось сменить статус."), "error");
    }
  }

  async function skipItem(item) {
    var before = Object.assign({}, item);
    replaceItem(Object.assign({}, item, { skip_shopping: true }));
    renderAll();
    try {
      replaceItem(await Store.skipShopping(item.id));
      renderAll();
    } catch (err) {
      replaceItem(before);
      renderAll();
      toast(errText(err, "Не удалось убрать из списка."), "error");
    }
  }

  async function toggleManual(m, done) {
    var before = state.shopping;
    state.shopping = state.shopping.map(function (x) { return x.id === m.id ? Object.assign({}, x, { done: done }) : x; });
    renderAll();
    try {
      await Store.updateShopping(m.id, { done: done });
    } catch (err) {
      state.shopping = before;
      renderAll();
      toast(errText(err, "Не удалось отметить."), "error");
    }
  }

  async function deleteManual(m) {
    var before = state.shopping;
    state.shopping = state.shopping.filter(function (x) { return x.id !== m.id; });
    renderAll();
    try {
      await Store.deleteShopping(m.id);
    } catch (err) {
      state.shopping = before;
      renderAll();
      toast(errText(err, "Не удалось удалить запись."), "error");
    }
  }

  function bindShopForm() {
    $("#form-shop").addEventListener("submit", async function (e) {
      e.preventDefault();
      var input = $("#shop-input");
      var name = input.value.trim();
      if (!name) { input.focus(); return; }
      var btn = $("button[type=submit]", e.currentTarget);
      setBusy(btn, true, "…");
      try {
        var entry = await Store.addShopping(name);
        state.shopping = [entry].concat(state.shopping);
        input.value = "";
        renderAll();
      } catch (err) {
        toast(errText(err, "Не удалось добавить запись."), "error");
      } finally {
        setBusy(btn, false);
        input.focus();
      }
    });
  }

  /* ---------- вкладки ---------- */

  var TABS = ["inventory", "shopping", "menu", "hero"];

  function setTab(tab, focus) {
    if (TABS.indexOf(tab) < 0) tab = "inventory";
    state.tab = tab;
    $all(".tab").forEach(function (b) {
      var on = b.dataset.tab === tab;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    TABS.forEach(function (t) { var p = document.getElementById("panel-" + t); if (p) p.hidden = t !== tab; });
    try { sessionStorage.setItem("kvest.tab", tab); } catch (e) { /* ignore */ }
    if (tab === "hero" && state.entered && window.KvestHero) window.KvestHero.show();
    if (tab === "menu" && state.entered && window.KvestMenu) window.KvestMenu.show();
  }

  function bindTabs() {
    $all(".tab").forEach(function (b) {
      b.addEventListener("click", function () { setTab(b.dataset.tab); });
      b.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          var i = TABS.indexOf(state.tab) + (e.key === "ArrowRight" ? 1 : -1);
          setTab(TABS[(i + TABS.length) % TABS.length], true);
        }
      });
    });
    var saved = null;
    try { saved = sessionStorage.getItem("kvest.tab"); } catch (e) { /* ignore */ }
    setTab(TABS.indexOf(saved) >= 0 ? saved : "inventory");
  }

  /* ---------- форма предмета ---------- */

  var dialog = document.getElementById("item-dialog");
  var formItem = document.getElementById("form-item");

  function buildDialogControls() {
    var cats = $("#item-cats");
    CATS.forEach(function (c, i) {
      var id = "cat-" + c.id;
      cats.appendChild(h("div", { class: "rc" }, [
        h("input", { type: "radio", name: "category", id: id, value: c.id, class: "sr-only", checked: i === 0 ? true : null }),
        h("label", { for: id, class: "rc-label" }, [h("span", { class: "chip-art", art: c.id }), c.label])
      ]));
    });
    var sts = $("#item-statuses");
    STATUSES.forEach(function (s, i) {
      var id = "status-" + s.id;
      sts.appendChild(h("div", { class: "rc" }, [
        h("input", { type: "radio", name: "status", id: id, value: s.id, class: "sr-only", checked: i === 0 ? true : null }),
        h("label", { for: id, class: "rc-label rs-" + s.id }, [h("i", { class: "dot dot-" + s.id, "aria-hidden": "true" }), s.label])
      ]));
    });
  }

  function clearPending() {
    if (state.pendingUrl) URL.revokeObjectURL(state.pendingUrl);
    state.pendingBlob = null;
    state.pendingUrl = null;
    $("#item-photo").value = "";
    $("#photo-undo").hidden = true;
  }

  function renderPreview() {
    var box = $("#photo-preview");
    box.textContent = "";
    var cat = (formItem.category.value) || "food";
    box.className = "photo-preview cat-bg-" + cat;
    var status = formItem.status.value;
    box.classList.toggle("is-out", status === "out");
    if (state.pendingUrl) {
      box.appendChild(h("img", { src: state.pendingUrl, alt: "Новое фото" }));
    } else if (state.editing && state.editing.photo_path) {
      var img = h("img", { alt: "Текущее фото" });
      box.appendChild(img);
      Store.photoUrl(state.editing.photo_path).then(function (u) { if (u) img.src = u; else img.replaceWith(h("span", { class: "ph-art", art: cat })); });
    } else {
      box.appendChild(h("span", { class: "ph-art", art: cat }));
    }
    var hasPhoto = !!(state.pendingUrl || (state.editing && state.editing.photo_path));
    $("#photo-btn-text").textContent = hasPhoto ? "Заменить фото" : "Сфотографировать / выбрать";
  }

  function openItemDialog(item) {
    state.editing = item;
    clearPending();
    formItem.reset();
    setMsg(formItem, "");
    $("#photo-status").textContent = "";
    $("#delete-confirm").hidden = true;
    $("#item-dialog-title").textContent = item ? "Изменить предмет" : "Новый предмет";
    $("#btn-delete").hidden = !item;
    formItem.name.value = item ? item.name : "";
    var cat = item ? item.category : (state.filter !== "all" ? state.filter : "food");
    $("#cat-" + cat).checked = true;
    $("#status-" + (item ? item.status : "ok")).checked = true;
    renderPreview();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (!item) setTimeout(function () { formItem.name.focus(); }, 30);
  }

  function closeItemDialog() {
    if (state.busy) return;
    clearPending();
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function bindDialog() {
    buildDialogControls();
    $all("[data-close]", dialog).forEach(function (b) { b.addEventListener("click", closeItemDialog); });
    dialog.addEventListener("cancel", function (e) { if (state.busy) e.preventDefault(); else clearPending(); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) closeItemDialog(); });
    formItem.addEventListener("change", function (e) {
      if (e.target.name === "category" || e.target.name === "status") renderPreview();
    });

    $("#item-photo").addEventListener("change", async function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.type && file.type.indexOf("image/") !== 0) { $("#photo-status").textContent = "Это не изображение."; return; }
      $("#photo-status").textContent = "Уменьшаем фото…";
      try {
        var blob = await Store.downscale(file, 800, 0.8);
        if (state.pendingUrl) URL.revokeObjectURL(state.pendingUrl);
        state.pendingBlob = blob;
        state.pendingUrl = URL.createObjectURL(blob);
        $("#photo-status").textContent = "Готово: " + Math.max(1, Math.round(blob.size / 1024)) + " КБ";
        $("#photo-undo").hidden = false;
        renderPreview();
      } catch (err) {
        $("#photo-status").textContent = errText(err);
      }
    });

    $("#photo-undo").addEventListener("click", function () {
      clearPending();
      $("#photo-status").textContent = "";
      renderPreview();
    });

    formItem.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = formItem.name.value.trim().replace(/\s+/g, " ");
      if (!name) { setMsg(formItem, "Введите название предмета."); formItem.name.focus(); return; }
      var fields = { name: name, category: formItem.category.value, status: formItem.status.value };
      var btn = $("#btn-save");
      state.busy = true;
      setBusy(btn, true, state.pendingBlob ? "Загружаем фото…" : "Сохраняем…");
      setMsg(formItem, "");
      try {
        var res;
        if (state.editing) {
          var patch = { name: fields.name, category: fields.category };
          if (fields.status !== state.editing.status) { patch.status = fields.status; patch.skip_shopping = false; }
          res = await Store.updateItem(state.editing.id, patch, state.pendingBlob);
          replaceItem(res.item);
        } else {
          res = await Store.addItem(fields, state.pendingBlob);
          state.items = [res.item].concat(state.items);
        }
        state.busy = false;
        closeItemDialog();
        renderAll();
        if (res.photoError) toast("Предмет сохранён, но " + errText(res.photoError).charAt(0).toLowerCase() + errText(res.photoError).slice(1), "error");
        else toast(state.editing ? "Сохранено" : "Добавлено: " + res.item.name);
      } catch (err) {
        setMsg(formItem, errText(err, "Не удалось сохранить."));
      } finally {
        state.busy = false;
        setBusy(btn, false);
      }
    });

    $("#btn-delete").addEventListener("click", function () {
      if (!state.editing) return;
      $("#delete-confirm-text").textContent = "Удалить «" + state.editing.name + "»? Это нельзя отменить.";
      $("#delete-confirm").hidden = false;
      $("#delete-no").focus();
    });
    $("#delete-no").addEventListener("click", function () {
      $("#delete-confirm").hidden = true;
      $("#btn-delete").focus();
    });
    $("#delete-yes").addEventListener("click", async function () {
      var item = state.editing;
      if (!item) return;
      var btn = $("#delete-yes");
      state.busy = true;
      setBusy(btn, true, "Удаляем…");
      try {
        await Store.deleteItem(item);
        state.items = state.items.filter(function (i) { return i.id !== item.id; });
        state.busy = false;
        closeItemDialog();
        renderAll();
        toast("Удалено: " + item.name);
      } catch (err) {
        setMsg(formItem, errText(err, "Не удалось удалить."));
      } finally {
        state.busy = false;
        setBusy(btn, false);
      }
    });
  }

  /* ---------- запуск ---------- */

  async function start() {
    show("screen-loading");
    try {
      await Store.init();
    } catch (err) {
      $("#fatal-text").textContent = "Не удалось загрузить модуль входа. Проверьте интернет и попробуйте ещё раз.";
      show("screen-fatal");
      return;
    }

    if (Store.mode === "demo") { await enterApp(); return; }

    var link = Store.authLink;
    var recoveryShown = false;

    Store.onAuthChange(function (event) {
      if (event === "PASSWORD_RECOVERY" && !recoveryShown) { recoveryShown = true; showSetPassword("recovery"); }
      if (event === "SIGNED_OUT" && !$("#screen-app").hidden) {
        state.entered = false;
        if (window.KvestHero) window.KvestHero.reset();
        if (window.KvestMenu) window.KvestMenu.reset();
        show("screen-auth"); authView("login");
      }
    });

    if (link.error) {
      show("screen-auth");
      authView("login");
      var expired = /expired|invalid/i.test(link.error + " " + link.errorDescription);
      setMsg($("#form-login"), expired
        ? "Ссылка из письма устарела или уже использована. Нажмите «Забыли пароль?», чтобы получить новую."
        : "Ссылка из письма не сработала. Попробуйте запросить новую через «Забыли пароль?».");
      history.replaceState(null, "", location.pathname);
      return;
    }

    var session;
    try {
      session = await Store.getSession();
    } catch (err) {
      $("#fatal-text").textContent = errText(err, "Не удалось подключиться к серверу.");
      show("screen-fatal");
      return;
    }

    if ((link.type === "recovery" || link.type === "invite") && session) {
      recoveryShown = true;
      showSetPassword(link.type);
      return;
    }
    if (session) { await enterApp(); return; }
    show("screen-auth");
    authView("login");
  }

  /* общие помощники для hero.js */
  window.KvestUI = { toast: toast, errText: errText };

  /* мост для menu.js: запасы читаются и меняются только здесь */
  window.KvestApp = {
    items: function () { return state.items; },
    setStatus: function (item, status, msg) { return changeStatus(item, status, msg); },
    addFoodItem: async function (name) {
      var res = await Store.addItem({ name: name, category: "food", status: "ok" }, null);
      state.items = [res.item].concat(state.items);
      renderAll();
      return res.item;
    },
    refresh: function () { renderAll(); }
  };

  bindAuth();
  bindTabs();
  bindShopForm();
  bindDialog();
  $("#btn-add").addEventListener("click", function () { openItemDialog(null); });
  $("#btn-retry").addEventListener("click", loadData);
  $("#fatal-retry").addEventListener("click", function () { location.reload(); });
  start();
})();
