/* diary.js — вкладка «Ежедневник»: трекер настроения и записи по дням.
   Раскраски — в coloring.js (подраздел «Раскраски» переключается отсюда). */
(function () {
  "use strict";

  var Store = window.KvestStore;

  /* ---------- настроения ---------- */
  var MOODS = [
    { id: "joy", label: "Радость", color: "#ffd66b" },
    { id: "calm", label: "Спокойствие", color: "#8fd8cf" },
    { id: "love", label: "Любовь", color: "#ff8fb8" },
    { id: "inspiration", label: "Вдохновение", color: "#c4e67c" },
    { id: "tiredness", label: "Усталость", color: "#d4c2ae" },
    { id: "sadness", label: "Грусть", color: "#8ec5f2" },
    { id: "anxiety", label: "Тревога", color: "#a9b4c6" },
    { id: "irritation", label: "Раздражённость", color: "#ffb070" },
    { id: "anger", label: "Злость", color: "#ff8a7a" }
  ];
  var MOOD = {};
  MOODS.forEach(function (m) { MOOD[m.id] = m; });

  var INK = "#4a4140";
  /** Маленькая милая мордочка настроения (SVG). */
  function moodFace(id) {
    var m = MOOD[id], c = m ? m.color : "#eee";
    var eyes = '<circle cx="11.5" cy="14" r="1.6" fill="' + INK + '"/><circle cx="20.5" cy="14" r="1.6" fill="' + INK + '"/>';
    var blush = '<ellipse cx="8.5" cy="18.5" rx="2.3" ry="1.3" fill="#ff8fa8" opacity=".6"/><ellipse cx="23.5" cy="18.5" rx="2.3" ry="1.3" fill="#ff8fa8" opacity=".6"/>';
    var f = "";
    switch (id) {
      case "joy":
        f = '<path d="M9 14.5q2.5-3 5 0M18 14.5q2.5-3 5 0" stroke="' + INK + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' + blush +
          '<path d="M11 18.5h10q-.5 5-5 5t-5-5z" fill="' + INK + '"/><path d="M13.5 21.6q2.5-1.6 5 0q-1 1.6-2.5 1.6t-2.5-1.6z" fill="#ff8fa8"/>';
        break;
      case "sadness":
        f = eyes + '<path d="M12 22.5q4-3.4 8 0" stroke="' + INK + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
          '<path d="M23 16.5q1.8 2.6 0 3.6q-1.8-1 0-3.6z" fill="#5fa8e8"/>';
        break;
      case "anger":
        f = '<path d="M8.5 10.5l5 2M23.5 10.5l-5 2" stroke="' + INK + '" stroke-width="1.7" stroke-linecap="round"/>' + eyes +
          '<path d="M12 22.5q4-3 8 0" stroke="' + INK + '" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
        break;
      case "anxiety":
        f = '<circle cx="11.5" cy="14" r="2.2" fill="#fff" stroke="' + INK + '" stroke-width="1.2"/><circle cx="20.5" cy="14" r="2.2" fill="#fff" stroke="' + INK + '" stroke-width="1.2"/>' +
          '<circle cx="11.5" cy="14.3" r="1" fill="' + INK + '"/><circle cx="20.5" cy="14.3" r="1" fill="' + INK + '"/>' +
          '<path d="M11 21.5q1.25-1.5 2.5 0t2.5 0t2.5 0t2.5 0" stroke="' + INK + '" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
          '<path d="M25 7q2 3 0 4q-2-1 0-4z" fill="#7fc8f0"/>';
        break;
      case "tiredness":
        f = '<path d="M9 14.5h5M18 14.5h5" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>' +
          '<ellipse cx="16" cy="21" rx="1.8" ry="1.4" fill="' + INK + '"/>' +
          '<path d="M22 5h3.5l-3.5 3.5h3.5" stroke="' + INK + '" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
        break;
      case "calm":
        f = '<path d="M9 13.5q2.5 2.6 5 0M18 13.5q2.5 2.6 5 0" stroke="' + INK + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' + blush +
          '<path d="M13.5 20q2.5 2 5 0" stroke="' + INK + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
        break;
      case "irritation":
        f = '<path d="M9 13h5M18 13h5" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>' +
          '<path d="M9.5 15.2h4M18.5 15.2h4" stroke="' + INK + '" stroke-width="1" stroke-linecap="round" opacity=".5"/>' +
          '<path d="M12.5 21.5h7" stroke="' + INK + '" stroke-width="1.7" stroke-linecap="round"/>' +
          '<path d="M23 6.5l1 2.5M25.5 6l-1 2.5M22.5 9.8l2.6-.6M26.5 9.8l-2.6-.6" stroke="#e5534b" stroke-width="1.2" stroke-linecap="round"/>';
        break;
      case "inspiration":
        f = '<path d="M11.5 11l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9zM20.5 11l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="' + INK + '"/>' + blush +
          '<path d="M12 19h8q-.5 4-4 4t-4-4z" fill="' + INK + '"/>' +
          '<path d="M26 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#fff8c4" stroke="' + INK + '" stroke-width=".5"/>';
        break;
      case "love":
        f = '<path d="M11.5 16.5q-3.6-2.4-2.4-4.1q1.2-1.4 2.4.1q1.2-1.5 2.4-.1q1.2 1.7-2.4 4.1zM20.5 16.5q-3.6-2.4-2.4-4.1q1.2-1.4 2.4.1q1.2-1.5 2.4-.1q1.2 1.7-2.4 4.1z" fill="#e8435f"/>' + blush +
          '<path d="M12.5 20q3.5 3.4 7 0" stroke="' + INK + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
        break;
    }
    return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="17" r="13.5" fill="' + c + '"/>' +
      '<ellipse cx="11" cy="9.5" rx="4" ry="2.2" fill="#fff" opacity=".45"/>' + f + "</svg>";
  }

  /* ---------- оформление записи ---------- */
  var BGS = [
    { id: "white", label: "белый", color: "#ffffff" },
    { id: "pink", label: "розовый", color: "#ffeef3" },
    { id: "peach", label: "персиковый", color: "#fff1e6" },
    { id: "butter", label: "лимонный", color: "#fff8dc" },
    { id: "mint", label: "мятный", color: "#ebf8f1" },
    { id: "sky", label: "голубой", color: "#eaf4fd" },
    { id: "cream", label: "кремовый", color: "#fdf6ee" },
    { id: "rose", label: "пудровый", color: "#ffe0ea" }
  ];
  var FRAMES = [
    { id: "none", label: "Без рамки" },
    { id: "dotted", label: "Пунктир" },
    { id: "hearts", label: "Сердечки" },
    { id: "flowers", label: "Цветочки" },
    { id: "stars", label: "Звёздочки" },
    { id: "washi", label: "Скотч" }
  ];

  /* 20 оригинальных стикеров (SVG 40×40, белая «наклеечная» обводка) */
  var O = ' stroke="#fff" stroke-width="3" paint-order="stroke" stroke-linejoin="round"';
  var STICKERS = [
    { id: "heart", label: "сердечко", svg: '<path d="M20 34C8 26 4 19 6 13c2-6 9-7 14-1c5-6 12-5 14 1c2 6-2 13-14 21z" fill="#ff8fab"' + O + '/><ellipse cx="13" cy="14" rx="3" ry="2" fill="#fff" opacity=".6"/>' },
    { id: "star", label: "звёздочка", svg: '<path d="M20 4l4.6 9.6 10.4 1.4-7.6 7.2 2 10.4L20 27.6l-9.4 5 2-10.4L5 15l10.4-1.4z" fill="#ffd66b"' + O + '/><circle cx="16" cy="19" r="1.3" fill="' + INK + '"/><circle cx="24" cy="19" r="1.3" fill="' + INK + '"/><path d="M18 22q2 1.8 4 0" stroke="' + INK + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>' },
    { id: "cat", label: "котик", svg: '<path d="M8 14L9 5l7 5h8l7-5 1 9c2 3 2 6 2 8 0 8-7 12-14 12S6 30 6 22c0-2 0-5 2-8z" fill="#5a5052"' + O + '/><path d="M12 19q2-2 4 0M24 19q2-2 4 0" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M19 23h2l-1 1.2z" fill="#ff9fb7"/><ellipse cx="11" cy="24" rx="2" ry="1.2" fill="#ff8fa8" opacity=".7"/><ellipse cx="29" cy="24" rx="2" ry="1.2" fill="#ff8fa8" opacity=".7"/>' },
    { id: "flower", label: "цветочек", svg: '<g fill="#ffb3c7"' + O + '><circle cx="20" cy="10" r="6"/><circle cx="29.5" cy="17" r="6"/><circle cx="26" cy="28" r="6"/><circle cx="14" cy="28" r="6"/><circle cx="10.5" cy="17" r="6"/></g><circle cx="20" cy="20" r="5" fill="#ffd66b"/>' },
    { id: "coffee", label: "кофе", svg: '<path d="M27 16h3a4 4 0 0 1 0 8h-3" stroke="#d99a7a" stroke-width="3" fill="none"/><path d="M8 13h20l-2 18a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3z" fill="#ffc9a8"' + O + '/><path d="M8 13h20" stroke="#8a5a44" stroke-width="3"/><path d="M15 5q2 2 0 4M21 4q2 2 0 4" stroke="#e8cfc0" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M16 22q2-2 4 0q2-2 4 0q-4 5-8 0" fill="#ff8fab"/>' },
    { id: "cloud", label: "облачко", svg: '<path d="M11 31a7 7 0 0 1-1-14 9 9 0 0 1 17-3 7 7 0 0 1 3 17z" fill="#eaf4fd"' + O + '/><circle cx="16" cy="23" r="1.3" fill="' + INK + '"/><circle cx="24" cy="23" r="1.3" fill="' + INK + '"/><path d="M18.5 26q1.5 1.2 3 0" stroke="' + INK + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>' },
    { id: "moon", label: "луна", svg: '<path d="M27 6a14 14 0 1 0 7 22A12 12 0 0 1 27 6z" fill="#fff0a8"' + O + '/><circle cx="17" cy="20" r="1.3" fill="' + INK + '"/><path d="M19 25q2 1.5 4 0" stroke="' + INK + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>' },
    { id: "strawberry", label: "клубничка", svg: '<path d="M20 35C10 30 7 22 9 16c3-4 19-4 22 0 2 6-1 14-11 19z" fill="#ff6f7f"' + O + '/><path d="M12 12l4 2 4-4 4 4 4-2-2 5H14z" fill="#6fb08e"/><g fill="#fff6c4"><circle cx="15" cy="21" r="1"/><circle cx="22" cy="20" r="1"/><circle cx="18" cy="26" r="1"/><circle cx="25" cy="25" r="1"/><circle cx="20" cy="30" r="1"/></g>' },
    { id: "sparkles", label: "искорки", svg: '<path d="M16 4c1.4 8 3.6 10.2 11.6 11.6C19.6 17 17.4 19.2 16 27.2 14.6 19.2 12.4 17 4.4 15.6 12.4 14.2 14.6 12 16 4z" fill="#ffe58a"' + O + '/><path d="M29 22c.7 4 1.8 5.1 5.8 5.8-4 .7-5.1 1.8-5.8 5.8-.7-4-1.8-5.1-5.8-5.8 4-.7 5.1-1.8 5.8-5.8z" fill="#ffb3c7"' + O + '/>' },
    { id: "book", label: "книжка", svg: '<path d="M5 9c6-2 11-1 15 2 4-3 9-4 15-2v22c-6-2-11-1-15 2-4-3-9-4-15-2z" fill="#a8d4f5"' + O + '/><path d="M20 11v22" stroke="#7fb4de" stroke-width="1.5"/><path d="M8 14q5-1 9 1M8 18q5-1 9 1M23 15q4-2 9-1M23 19q4-2 9-1" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/>' },
    { id: "rainbow", label: "радуга", svg: '<path d="M4 30a16 16 0 0 1 32 0" stroke="#ff9fb7" stroke-width="4" fill="none"/><path d="M8.5 30a11.5 11.5 0 0 1 23 0" stroke="#ffd66b" stroke-width="4" fill="none"/><path d="M13 30a7 7 0 0 1 14 0" stroke="#8fd6b4" stroke-width="4" fill="none"/><ellipse cx="7" cy="31" rx="5" ry="3" fill="#fff"/><ellipse cx="33" cy="31" rx="5" ry="3" fill="#fff"/>' },
    { id: "sun", label: "солнышко", svg: '<g stroke="#ffc94d" stroke-width="3" stroke-linecap="round"><path d="M20 3v4M20 33v4M3 20h4M33 20h4M8 8l3 3M29 29l3 3M8 32l3-3M29 11l3-3"/></g><circle cx="20" cy="20" r="9" fill="#ffd66b"' + O + '/><circle cx="17" cy="19" r="1.2" fill="' + INK + '"/><circle cx="23" cy="19" r="1.2" fill="' + INK + '"/><path d="M18 22.5q2 1.6 4 0" stroke="' + INK + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>' },
    { id: "cherry", label: "вишенки", svg: '<path d="M14 26C16 16 20 10 28 6M26 26C25 17 26 11 28 6" stroke="#6fb08e" stroke-width="2" fill="none"/><path d="M28 6q6 0 6 5-5 1-6-5z" fill="#8fd6b4"/><circle cx="13" cy="28" r="6" fill="#ff5d73"' + O + '/><circle cx="26" cy="28" r="6" fill="#ff5d73"' + O + '/><circle cx="11" cy="26" r="1.5" fill="#fff" opacity=".7"/><circle cx="24" cy="26" r="1.5" fill="#fff" opacity=".7"/>' },
    { id: "bow", label: "бантик", svg: '<path d="M20 19C14 10 5 10 5 18s9 9 15 1zM20 19c6-9 15-9 15-1s-9 9-15 1z" fill="#ff9fb7"' + O + '/><path d="M18 21l-5 12 4-1 2 3 1-13zM22 21l5 12-4-1-2 3-1-13z" fill="#ff8fab"' + O + '/><circle cx="20" cy="19" r="3.2" fill="#ffc6d6"/>' },
    { id: "cake", label: "тортик", svg: '<path d="M6 20l28-8v20H6z" fill="#fff3dc"' + O + '/><path d="M6 20l28-8v6L6 26z" fill="#ffc6d6"/><path d="M6 30h28" stroke="#ff8fab" stroke-width="2"/><circle cx="26" cy="10" r="3.4" fill="#ff5d73"/><path d="M26 7l1-3" stroke="#6fb08e" stroke-width="1.5"/>' },
    { id: "leaf", label: "листик", svg: '<path d="M7 33C7 17 17 7 33 7c0 16-10 26-26 26z" fill="#8fd6b4"' + O + '/><path d="M9 31L27 13" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' },
    { id: "mushroom", label: "грибочек", svg: '<path d="M4 20a16 13 0 0 1 32 0z" fill="#ff8f96"' + O + '/><path d="M14 20h12v10a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" fill="#fff1d6"' + O + '/><circle cx="13" cy="14" r="2.4" fill="#fff"/><circle cx="23" cy="11" r="2" fill="#fff"/><circle cx="29" cy="16" r="1.6" fill="#fff"/>' },
    { id: "note", label: "нотка", svg: '<path d="M15 28V9l16-4v19" stroke="#7fb4de" stroke-width="3" fill="none"' + O + '/><ellipse cx="11" cy="29" rx="5" ry="4" fill="#a8d4f5"' + O + '/><ellipse cx="27" cy="25" rx="5" ry="4" fill="#a8d4f5"' + O + '/>' },
    { id: "letter", label: "письмо", svg: '<rect x="5" y="10" width="30" height="21" rx="3" fill="#fff8dc"' + O + '/><path d="M6 12l14 11 14-11" stroke="#e8c98a" stroke-width="1.8" fill="none"/><path d="M20 27q-4-2.7-3-4.6t3 0q2-1.9 3 0t-3 4.6z" fill="#ff7f9a"/>' },
    { id: "paw", label: "лапка", svg: '<g fill="#ffc9a8"' + O + '><ellipse cx="20" cy="26" rx="8" ry="7"/><ellipse cx="10" cy="17" rx="3.2" ry="4"/><ellipse cx="16" cy="11" rx="3.2" ry="4"/><ellipse cx="24" cy="11" rx="3.2" ry="4"/><ellipse cx="30" cy="17" rx="3.2" ry="4"/></g><ellipse cx="20" cy="27" rx="4" ry="3" fill="#ffb3c7"/>' }
  ];
  var STICKER = {};
  STICKERS.forEach(function (s) { STICKER[s.id] = s; });
  function stickerSvg(id) { var s = STICKER[id]; return s ? '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' + s.svg + "</svg>" : ""; }

  /* ---------- даты ---------- */
  var MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  var MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  var WEEKDAY_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return ymd(new Date()); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function monthKey(s) { return s.slice(0, 7); }
  function monthStart(key) { return key + "-01"; }
  function monthEnd(key) { var p = key.split("-"); return ymd(new Date(+p[0], +p[1], 0)); }
  function addMonths(key, n) { var p = key.split("-"); return ymd(new Date(+p[0], +p[1] - 1 + n, 1)).slice(0, 7); }
  function dayLabel(s) { var d = parse(s); return d.getDate() + " " + MONTHS_GEN[d.getMonth()]; }
  function dayLabelFull(s) { var d = parse(s); var w = WEEKDAY_FULL[d.getDay()]; return w.charAt(0).toUpperCase() + w.slice(1) + ", " + dayLabel(s); }

  /* ---------- состояние ---------- */
  function freshState() {
    return {
      loaded: false, loading: false, error: null, seg: "mood",
      day: today(), month: monthKey(today()),
      moods: {}, entryDays: {}, loadedMonths: {},
      entry: null, entryDay: null, entryLoading: false,
      saveTimer: null, saving: false, saveState: "", noteTimer: null
    };
  }
  var state = freshState();
  // последний открытый подраздел — восстанавливаем сразу (данные могут загрузиться раньше DOMContentLoaded)
  try {
    var savedSeg = sessionStorage.getItem("kvest.diary.seg");
    if (["mood", "entry", "color"].indexOf(savedSeg) >= 0) state.seg = savedSeg;
  } catch (e) { /* ignore */ }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function ui() { return window.KvestUI || { toast: function () {}, errText: function (e, f) { return f || "Ошибка"; } }; }
  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.keys(v).forEach(function (d) { e.dataset[d] = v[d]; });
      else if (k === "style") e.setAttribute("style", v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  /* ---------- загрузка ---------- */
  async function loadMonth(key, force) {
    if (state.loadedMonths[key] && !force) return;
    var from = monthStart(key), to = monthEnd(key);
    var r = await Promise.all([Store.listMoods(from, to), Store.listDiaryDays(from, to)]);
    for (var d = from; d <= to; d = addDays(d, 1)) { delete state.moods[d]; delete state.entryDays[d]; }
    (r[0] || []).forEach(function (m) { state.moods[m.day] = { mood: m.mood, note: m.note || "" }; });
    (r[1] || []).forEach(function (e) { state.entryDays[e.day] = true; });
    state.loadedMonths[key] = true;
  }

  async function load() {
    if (state.loading) return;
    state.loading = true; state.error = null;
    render();
    try {
      await loadMonth(state.month, true);
      if (monthKey(state.day) !== state.month) await loadMonth(monthKey(state.day));
      state.loaded = true;
    } catch (err) {
      state.error = ui().errText(err, "Не удалось загрузить ежедневник.");
    } finally {
      state.loading = false;
      render();
    }
  }

  /* ---------- рендер ---------- */
  function render() {
    var panel = document.getElementById("panel-diary");
    if (!panel) return;
    $("#diary-loading").hidden = !(state.loading && !state.loaded);
    $("#diary-error").hidden = !state.error;
    if (state.error) $("#diary-error p").textContent = state.error;
    Array.prototype.forEach.call(panel.querySelectorAll(".seg-btn"), function (b) {
      var on = b.dataset.seg === state.seg;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    var ready = state.loaded;
    $("#seg-panel-mood").hidden = !(ready && state.seg === "mood");
    $("#seg-panel-entry").hidden = !(ready && state.seg === "entry");
    $("#seg-panel-color").hidden = state.seg !== "color";
    if (ready && state.seg === "mood") renderMood();
    if (ready && state.seg === "entry") renderEntry();
  }

  function renderMood() {
    var day = state.day, isToday = day === today(), cur = state.moods[day];
    $("#mood-q").textContent = isToday ? "Как ты сегодня?" : "Настроение за " + dayLabel(day);
    $("#mood-day-label").textContent = isToday ? dayLabelFull(day) + " · можно поменять в любой момент" : dayLabelFull(day);
    var picker = $("#mood-picker");
    picker.textContent = "";
    MOODS.forEach(function (m) {
      var on = cur && cur.mood === m.id;
      picker.appendChild(h("button", {
        type: "button", role: "radio", class: "mood-btn" + (on ? " is-on" : ""), "aria-checked": on ? "true" : "false",
        style: "--mc:" + m.color, dataset: { fkey: "mood-" + m.id },
        onclick: function () { setMood(day, m.id); }
      }, [h("span", { class: "mood-face", html: moodFace(m.id) }), h("span", { class: "mood-name", text: m.label })]));
    });
    var note = $("#mood-note");
    if (document.activeElement !== note) note.value = cur ? cur.note || "" : "";
    note.disabled = !cur;
    note.placeholder = cur ? "Пара слов о дне (необязательно)" : "Сначала выбери настроение";
    $("#mood-clear").hidden = !cur;
    renderCalendar();
    renderSummary();
  }

  function renderCalendar() {
    var key = state.month, p = key.split("-"), y = +p[0], mo = +p[1] - 1;
    $("#cal-title").textContent = MONTHS[mo].charAt(0).toUpperCase() + MONTHS[mo].slice(1) + " " + y;
    var grid = $("#cal-grid");
    grid.textContent = "";
    WEEKDAYS.forEach(function (w) { grid.appendChild(h("span", { class: "cal-wd", text: w, "aria-hidden": "true" })); });
    var first = new Date(y, mo, 1), lead = (first.getDay() + 6) % 7, last = new Date(y, mo + 1, 0).getDate();
    for (var i = 0; i < lead; i++) grid.appendChild(h("span", { class: "cal-blank", "aria-hidden": "true" }));
    var t = today();
    for (var d = 1; d <= last; d++) {
      var ds = ymd(new Date(y, mo, d)), m = state.moods[ds], mm = m ? MOOD[m.mood] : null;
      (function (ds, mm) {
        grid.appendChild(h("button", {
          type: "button",
          class: "cal-day" + (mm ? " has-mood" : "") + (ds === t ? " is-today" : "") + (ds === state.day ? " is-selected" : "") + (ds > t ? " is-future" : ""),
          style: mm ? "--mc:" + mm.color : null,
          "aria-label": dayLabel(ds) + (mm ? ": " + mm.label : ": настроение не отмечено") + (state.entryDays[ds] ? ", есть запись" : ""),
          "aria-pressed": ds === state.day ? "true" : "false",
          dataset: { fkey: "cal-" + ds, day: ds },
          onclick: function () { selectDay(ds); }
        }, [h("span", { class: "cal-num", text: String(d) }), state.entryDays[ds] ? h("span", { class: "cal-dot", "aria-hidden": "true" }) : null]));
      })(ds, mm);
    }
    var legend = $("#mood-legend");
    if (!legend.childNodes.length) {
      MOODS.forEach(function (m) {
        legend.appendChild(h("span", { class: "legend-item" }, [h("span", { class: "legend-face", html: moodFace(m.id) }), m.label]));
      });
    }
  }

  function renderSummary() {
    var key = state.month, from = monthStart(key), to = monthEnd(key), counts = {}, total = 0;
    MOODS.forEach(function (m) { counts[m.id] = 0; });
    for (var d = from; d <= to; d = addDays(d, 1)) { var m = state.moods[d]; if (m && counts[m.mood] != null) { counts[m.mood]++; total++; } }
    var box = $("#mood-summary");
    box.textContent = "";
    var daysInMonth = parse(to).getDate();
    if (!total) {
      box.appendChild(h("p", { class: "goal-empty", text: "В этом месяце настроение ещё не отмечено. Каждый день — новая клеточка в картинке месяца." }));
      return;
    }
    var top = MOODS.slice().sort(function (a, b) { return counts[b.id] - counts[a.id]; })[0];
    box.appendChild(h("div", { class: "sum-top" }, [
      h("span", { class: "sum-top-face", html: moodFace(top.id) }),
      h("div", {}, [
        h("p", { class: "sum-top-title", text: "Чаще всего: " + top.label }),
        h("p", { class: "sum-top-sub", text: "Отмечено " + total + " из " + daysInMonth + " дней" })
      ])
    ]));
    var max = Math.max.apply(null, MOODS.map(function (m) { return counts[m.id]; }));
    var ul = h("ul", { class: "sum-bars" });
    MOODS.forEach(function (m) {
      if (!counts[m.id]) return;
      ul.appendChild(h("li", { class: "sum-bar-row" }, [
        h("span", { class: "sum-bar-face", html: moodFace(m.id) }),
        h("span", { class: "sum-bar-name", text: m.label }),
        h("span", { class: "sum-bar-track" }, [h("span", { class: "sum-bar-fill", style: "width:" + Math.round(counts[m.id] / max * 100) + "%;background:" + m.color })]),
        h("span", { class: "sum-bar-n", text: String(counts[m.id]) })
      ]));
    });
    box.appendChild(ul);
  }

  /* ---------- действия: настроение ---------- */
  async function selectDay(ds) {
    state.day = ds;
    render();
    if (state.seg === "entry") openEntry(ds);
  }

  async function setMood(day, mood) {
    var before = state.moods[day];
    var note = before ? before.note : "";
    state.moods[day] = { mood: mood, note: note };
    render();
    try { await Store.setMood(day, mood, note || null); }
    catch (err) {
      if (before) state.moods[day] = before; else delete state.moods[day];
      render();
      ui().toast(ui().errText(err, "Не удалось сохранить настроение."), "error");
    }
  }

  async function clearMood() {
    var day = state.day, before = state.moods[day];
    if (!before) return;
    delete state.moods[day];
    render();
    try { await Store.clearMood(day); }
    catch (err) { state.moods[day] = before; render(); ui().toast(ui().errText(err, "Не удалось убрать настроение."), "error"); }
  }

  function onNoteInput() {
    var day = state.day, cur = state.moods[day];
    if (!cur) return;
    cur.note = $("#mood-note").value.slice(0, 140);
    $("#mood-saved").textContent = "…";
    clearTimeout(state.noteTimer);
    state.noteTimer = setTimeout(async function () {
      try { await Store.setMood(day, cur.mood, cur.note || null); $("#mood-saved").textContent = "Сохранено ✓"; }
      catch (err) { $("#mood-saved").textContent = "Не сохранилось"; }
    }, 700);
  }

  async function goMonth(delta) {
    state.month = addMonths(state.month, delta);
    render();
    try { await loadMonth(state.month); } catch (err) { ui().toast(ui().errText(err, "Не удалось загрузить месяц."), "error"); }
    render();
  }

  /* ---------- записи ---------- */
  function emptyEntry() { return { body: "", background: "white", frame: "none", stickers: [] }; }

  async function openEntry(day) {
    await flushSave();
    state.day = day;
    state.entryDay = day;
    state.entry = null;
    state.entryLoading = true;
    state.saveState = "";
    render();
    try {
      var row = await Store.getDiary(day);
      if (state.entryDay !== day) return;
      state.entry = row ? {
        body: row.body || "", background: row.background || "white", frame: row.frame || "none",
        stickers: Array.isArray(row.stickers) ? row.stickers : []
      } : emptyEntry();
    } catch (err) {
      state.entry = emptyEntry();
      ui().toast(ui().errText(err, "Не удалось загрузить запись."), "error");
    } finally {
      state.entryLoading = false;
      render();
    }
  }

  function setSaveState(s) {
    state.saveState = s;
    var el = $("#entry-saved");
    if (!el) return;
    el.textContent = s === "pending" ? "Есть изменения…" : s === "saving" ? "Сохраняем…" : s === "saved" ? "Сохранено ✓" : s === "error" ? "Не сохранилось — проверьте интернет" : "";
    el.className = "save-ind" + (s === "error" ? " is-error" : s === "saved" ? " is-ok" : "");
  }

  function scheduleSave(delay) {
    setSaveState("pending");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(doSave, delay == null ? 800 : delay);
  }

  async function doSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    var day = state.entryDay, e = state.entry;
    if (!day || !e) return;
    state.saving = true;
    setSaveState("saving");
    try {
      await Store.saveDiary(day, e);
      if ((e.body && e.body.trim()) || e.stickers.length) state.entryDays[day] = true; else delete state.entryDays[day];
      if (state.entryDay === day) setSaveState("saved");
    } catch (err) {
      setSaveState("error");
    } finally {
      state.saving = false;
    }
  }

  async function flushSave() {
    if (state.saveTimer) await doSave();
  }

  function renderEntry() {
    var day = state.day;
    if (state.entryDay !== day && !state.entryLoading) { openEntry(day); return; }
    $("#entry-date").textContent = dayLabelFull(day);
    var m = state.moods[day];
    var moodBox = $("#entry-mood");
    moodBox.textContent = "";
    if (m && MOOD[m.mood]) moodBox.appendChild(h("span", { class: "entry-mood-chip", style: "--mc:" + MOOD[m.mood].color }, [h("span", { class: "legend-face", html: moodFace(m.mood) }), MOOD[m.mood].label]));
    $("#entry-today").hidden = day === today();
    var card = $("#entry-card"), ta = $("#entry-text");
    var e = state.entry;
    ta.disabled = !e;
    if (!e) { card.className = "entry-card bg-white frame-none is-loading"; return; }
    card.className = "entry-card bg-" + e.background + " frame-" + e.frame;
    if (document.activeElement !== ta) ta.value = e.body;
    ta.placeholder = day === today() ? "Как прошёл день? Что порадовало?" : "Запись за " + dayLabel(day);
    renderPlacedStickers();
    renderTools();
    setSaveState(state.saveState);
  }

  function renderTools() {
    var e = state.entry;
    var bgs = $("#entry-bgs");
    bgs.textContent = "";
    BGS.forEach(function (b) {
      bgs.appendChild(h("button", {
        type: "button", role: "radio", class: "swatch", "aria-checked": e.background === b.id ? "true" : "false",
        "aria-label": "Фон: " + b.label, title: b.label, style: "--sw:" + b.color, dataset: { fkey: "bg-" + b.id },
        onclick: function () { e.background = b.id; renderEntry(); scheduleSave(250); }
      }));
    });
    var frames = $("#entry-frames");
    frames.textContent = "";
    FRAMES.forEach(function (f) {
      frames.appendChild(h("button", {
        type: "button", role: "radio", class: "frame-pick", "aria-checked": e.frame === f.id ? "true" : "false", dataset: { fkey: "frame-" + f.id },
        onclick: function () { e.frame = f.id; renderEntry(); scheduleSave(250); }
      }, [h("span", { class: "frame-sample frame-" + f.id, "aria-hidden": "true" }), h("span", { class: "frame-name", text: f.label })]));
    });
    var pal = $("#entry-sticker-palette");
    if (!pal.childNodes.length) {
      STICKERS.forEach(function (s) {
        pal.appendChild(h("button", {
          type: "button", class: "sticker-pick", "aria-label": "Добавить стикер: " + s.label, title: s.label, dataset: { sticker: s.id },
          html: stickerSvg(s.id)
        }));
      });
    }
  }

  function renderPlacedStickers() {
    var layer = $("#entry-stickers");
    layer.textContent = "";
    var e = state.entry;
    e.stickers.forEach(function (st, i) {
      var meta = STICKER[st.id];
      if (!meta) return;
      layer.appendChild(h("button", {
        type: "button", class: "placed-sticker", dataset: { idx: String(i), fkey: "placed-" + i },
        style: "left:" + (st.x * 100).toFixed(2) + "%;top:" + (st.y * 100).toFixed(2) + "%;--r:" + (st.r || 0) + "deg",
        "aria-label": "Стикер «" + meta.label + "»: нажми, чтобы убрать; стрелки — подвинуть",
        html: stickerSvg(st.id)
      }));
    });
  }

  function addSticker(id) {
    var e = state.entry;
    if (!e) return;
    if (e.stickers.length >= 30) { ui().toast("Не больше 30 стикеров на странице"); return; }
    var n = e.stickers.length;
    // раскладываем по краям карточки, чтобы не закрывать текст
    var spots = [[0.9, 0.1], [0.1, 0.9], [0.9, 0.88], [0.5, 0.92], [0.12, 0.1], [0.92, 0.5], [0.3, 0.92], [0.7, 0.92], [0.7, 0.08], [0.3, 0.08]];
    var s = spots[n % spots.length];
    var jitter = Math.floor(n / spots.length) * 0.04;
    e.stickers.push({ id: id, x: Math.min(0.95, Math.max(0.05, s[0] - jitter)), y: Math.min(0.95, Math.max(0.05, s[1] + (n % 2 ? jitter : -jitter))), r: Math.round(Math.random() * 24 - 12) });
    renderPlacedStickers();
    scheduleSave(300);
  }

  function removeSticker(i) {
    state.entry.stickers.splice(i, 1);
    renderPlacedStickers();
    scheduleSave(300);
  }

  function bindStickerDrag() {
    var layer = $("#entry-stickers");
    var drag = null;
    layer.addEventListener("pointerdown", function (ev) {
      var el = ev.target.closest(".placed-sticker");
      if (!el) return;
      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);
      drag = { el: el, idx: +el.dataset.idx, x0: ev.clientX, y0: ev.clientY, moved: false, rect: $("#entry-card").getBoundingClientRect() };
      el.classList.add("is-drag");
    });
    layer.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      var st = state.entry.stickers[drag.idx];
      st.x = Math.min(0.97, Math.max(0.03, (ev.clientX - drag.rect.left) / drag.rect.width));
      st.y = Math.min(0.97, Math.max(0.03, (ev.clientY - drag.rect.top) / drag.rect.height));
      drag.el.style.left = (st.x * 100) + "%";
      drag.el.style.top = (st.y * 100) + "%";
    });
    function end(ev) {
      if (!drag) return;
      var d = drag;
      drag = null;
      d.el.classList.remove("is-drag");
      if (ev.type === "pointercancel") return;
      if (d.moved) scheduleSave(300);
      else removeSticker(d.idx);
    }
    layer.addEventListener("pointerup", end);
    layer.addEventListener("pointercancel", end);
    // клавиатура: Enter/Space — убрать (через click), стрелки — подвинуть
    layer.addEventListener("click", function (ev) {
      var el = ev.target.closest(".placed-sticker");
      if (el && ev.detail === 0) removeSticker(+el.dataset.idx);
    });
    layer.addEventListener("keydown", function (ev) {
      var el = ev.target.closest(".placed-sticker");
      if (!el) return;
      var st = state.entry.stickers[+el.dataset.idx], step = 0.03;
      var map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
      if (!map) return;
      ev.preventDefault();
      st.x = Math.min(0.97, Math.max(0.03, st.x + map[0]));
      st.y = Math.min(0.97, Math.max(0.03, st.y + map[1]));
      el.style.left = (st.x * 100) + "%";
      el.style.top = (st.y * 100) + "%";
      scheduleSave(500);
    });
  }

  /* ---------- сегменты ---------- */
  async function setSeg(seg, focus) {
    if (state.seg === "entry" && seg !== "entry") await flushSave();
    state.seg = seg;
    try { sessionStorage.setItem("kvest.diary.seg", seg); } catch (e) { /* ignore */ }
    render();
    if (seg === "color" && window.KvestColoring) window.KvestColoring.show();
    if (seg !== "color" && window.KvestColoring) window.KvestColoring.hide();
    if (focus) { var b = document.getElementById("seg-" + seg); if (b) b.focus(); }
  }

  function bind() {
    var segs = ["mood", "entry", "color"];
    Array.prototype.forEach.call(document.querySelectorAll("#panel-diary .seg-btn"), function (b) {
      b.addEventListener("click", function () { setSeg(b.dataset.seg); });
      b.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        var i = segs.indexOf(state.seg) + (e.key === "ArrowRight" ? 1 : -1);
        setSeg(segs[(i + segs.length) % segs.length], true);
      });
    });
    $("#cal-prev").addEventListener("click", function () { goMonth(-1); });
    $("#cal-next").addEventListener("click", function () { goMonth(1); });
    $("#mood-note").addEventListener("input", onNoteInput);
    $("#mood-clear").addEventListener("click", clearMood);
    $("#mood-open-entry").addEventListener("click", function () { setSeg("entry"); });
    $("#entry-prev").addEventListener("click", function () { selectDay(addDays(state.day, -1)); syncMonth(); });
    $("#entry-next").addEventListener("click", function () { selectDay(addDays(state.day, 1)); syncMonth(); });
    $("#entry-today").addEventListener("click", function () { selectDay(today()); syncMonth(); });
    $("#entry-text").addEventListener("input", function (e) { if (!state.entry) return; state.entry.body = e.target.value; scheduleSave(); });
    $("#entry-sticker-palette").addEventListener("click", function (e) { var b = e.target.closest(".sticker-pick"); if (b) addSticker(b.dataset.sticker); });
    $("#diary-retry").addEventListener("click", load);
    bindStickerDrag();
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flushSave(); });
    window.addEventListener("pagehide", function () { flushSave(); });
    render();
  }

  async function syncMonth() {
    var key = monthKey(state.day);
    if (key !== state.month) { state.month = key; try { await loadMonth(key); } catch (e) { /* ignore */ } render(); }
  }

  window.KvestDiary = {
    show: function () {
      if (!state.loaded && !state.loading) load(); else render();
      if (state.seg === "color" && window.KvestColoring) window.KvestColoring.show();
    },
    hide: function () { flushSave(); if (window.KvestColoring) window.KvestColoring.hide(); },
    reset: function () { clearTimeout(state.saveTimer); clearTimeout(state.noteTimer); var seg = state.seg; state = freshState(); state.seg = seg; render(); },
    MOODS: MOODS, moodFace: moodFace, STICKERS: STICKERS
  };

  function boot() { if (document.getElementById("panel-diary")) bind(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
