/* pwa.js — регистрация сервис-воркера, кнопка «Установить приложение», подсказка для iPhone. */
(function () {
  "use strict";

  var HINT_KEY = "kvest.iosHintDismissed";
  var deferred = null;

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  // сервис-воркер: относительный путь — сайт живёт в подпапке GitHub Pages
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(function (e) { console.warn("SW не зарегистрирован", e); });
    });
  }

  function installBtn() { return document.getElementById("btn-install"); }
  function updateUI() {
    var btn = installBtn();
    if (btn) btn.hidden = !deferred || isStandalone();
    var hint = document.getElementById("ios-hint");
    var showHint = isIOS() && !isStandalone() && !lsGet(HINT_KEY);
    if (hint) hint.hidden = !showHint;
    document.documentElement.classList.toggle("has-ios-hint", !!(hint && showHint));
    document.documentElement.classList.toggle("is-standalone", isStandalone());
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    updateUI();
  });
  window.addEventListener("appinstalled", function () {
    deferred = null;
    updateUI();
    if (window.KvestUI) window.KvestUI.toast("Приложение установлено");
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(display-mode: standalone)");
    if (mq.addEventListener) mq.addEventListener("change", updateUI);
  }

  function boot() {
    var btn = installBtn();
    if (btn) btn.addEventListener("click", async function () {
      if (!deferred) return;
      var ev = deferred;
      deferred = null;
      updateUI();
      try { ev.prompt(); await ev.userChoice; } catch (err) { /* пользователь закрыл окно */ }
    });
    var close = document.getElementById("ios-hint-close");
    if (close) close.addEventListener("click", function () { lsSet(HINT_KEY, "1"); updateUI(); });
    updateUI();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
