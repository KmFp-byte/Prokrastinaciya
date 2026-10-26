/* store.js — единый слой данных.
   Два режима:
   - demo: нет ключей в config.js → localStorage, фото как data URL;
   - supabase: ключи заданы → Supabase Auth + таблицы items / shopping_items + приватный бакет item-photos.
   UI работает только через window.KvestStore и не знает, какой режим включён. */
(function () {
  "use strict";

  var SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.min.js";
  var BUCKET = "item-photos";
  var SIGNED_TTL = 3600; // секунд
  var CATEGORIES = ["food", "meds", "cosmetics", "skincare", "chemicals"];
  var STATUSES = ["ok", "mid", "low", "out"];

  var cfg = window.KVEST_CONFIG || {};
  var url = String(cfg.SUPABASE_URL || "").trim();
  var key = String(cfg.SUPABASE_ANON_KEY || "").trim();
  var mode = url && key ? "supabase" : "demo";

  /* ---------- helpers ---------- */

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      try { return window.crypto.randomUUID(); } catch (e) { /* не secure context */ }
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function KvestError(code, message, cause) {
    var e = new Error(message || code);
    e.code = code;
    e.cause = cause;
    return e;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(KvestError("network", "script load failed")); };
      document.head.appendChild(s);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(KvestError("upload", "read failed")); };
      fr.readAsDataURL(blob);
    });
  }

  function byCreatedDesc(a, b) {
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
  }

  /* Разбирает адрес страницы до того, как supabase-js его очистит:
     ссылки из писем приходят как #access_token=...&type=recovery|invite
     или с ошибкой #error=...&error_code=otp_expired. */
  function readAuthLink() {
    var raw = (location.hash || "").replace(/^#/, "") + "&" + (location.search || "").replace(/^\?/, "");
    var p = new URLSearchParams(raw);
    return {
      type: p.get("type") || "",
      error: p.get("error_code") || p.get("error") || "",
      errorDescription: p.get("error_description") || ""
    };
  }

  /* ---------- demo backend (localStorage) ---------- */

  var LS_ITEMS = "kvest.demo.items";
  var LS_SHOP = "kvest.demo.shopping";
  var LS_PHOTO = "kvest.demo.photo.";
  var memory = {}; // запасной вариант, если localStorage недоступен

  function lsGet(k, fallback) {
    try {
      var v = window.localStorage.getItem(k);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return k in memory ? memory[k] : fallback;
    }
  }
  function lsSet(k, v) {
    try {
      window.localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
        throw KvestError("quota", "storage full", e);
      }
      memory[k] = v;
    }
  }
  function lsRemove(k) {
    try { window.localStorage.removeItem(k); } catch (e) { delete memory[k]; }
  }

  var demo = {
    async getSession() { return { user: { id: "demo", email: "демо" } }; },
    onAuthChange() { return function () {}; },
    async signIn() { return { user: { id: "demo", email: "демо" } }; },
    async signOut() {},
    async resetPassword() {},
    async updatePassword() {},

    async listItems() { return lsGet(LS_ITEMS, []).slice().sort(byCreatedDesc); },

    async addItem(fields) {
      var items = lsGet(LS_ITEMS, []);
      var item = {
        id: uuid(),
        user_id: "demo",
        name: fields.name,
        category: fields.category,
        status: fields.status || "ok",
        photo_path: null,
        skip_shopping: false,
        created_at: new Date().toISOString()
      };
      items.push(item);
      lsSet(LS_ITEMS, items);
      return item;
    },

    async updateItem(id, patch) {
      var items = lsGet(LS_ITEMS, []);
      var found = null;
      items = items.map(function (it) {
        if (it.id !== id) return it;
        found = Object.assign({}, it, patch);
        return found;
      });
      if (!found) throw KvestError("notfound", "item not found");
      lsSet(LS_ITEMS, items);
      return found;
    },

    async deleteItem(item) {
      lsSet(LS_ITEMS, lsGet(LS_ITEMS, []).filter(function (it) { return it.id !== item.id; }));
      if (item.photo_path) lsRemove(LS_PHOTO + item.id);
    },

    async uploadPhoto(itemId, blob) {
      var dataUrl = await blobToDataUrl(blob);
      try {
        window.localStorage.setItem(LS_PHOTO + itemId, dataUrl);
      } catch (e) {
        if (e && (e.name === "QuotaExceededError" || e.code === 22)) throw KvestError("quota", "storage full", e);
        memory[LS_PHOTO + itemId] = dataUrl;
      }
      return "demo/" + itemId + ".jpg";
    },

    async photoUrl(path) {
      if (!path) return null;
      var id = path.replace(/^demo\//, "").replace(/\.jpg$/, "");
      try { return window.localStorage.getItem(LS_PHOTO + id) || memory[LS_PHOTO + id] || null; }
      catch (e) { return memory[LS_PHOTO + id] || null; }
    },

    forgetPhoto() {},

    async listShopping() { return lsGet(LS_SHOP, []).slice().sort(byCreatedDesc); },

    async addShopping(name) {
      var list = lsGet(LS_SHOP, []);
      var entry = { id: uuid(), user_id: "demo", name: name, done: false, created_at: new Date().toISOString() };
      list.push(entry);
      lsSet(LS_SHOP, list);
      return entry;
    },

    async updateShopping(id, patch) {
      var found = null;
      var list = lsGet(LS_SHOP, []).map(function (e) {
        if (e.id !== id) return e;
        found = Object.assign({}, e, patch);
        return found;
      });
      lsSet(LS_SHOP, list);
      return found;
    },

    async deleteShopping(id) {
      lsSet(LS_SHOP, lsGet(LS_SHOP, []).filter(function (e) { return e.id !== id; }));
    }
  };

  /* ---------- supabase backend ---------- */

  var sb = null;
  var currentUser = null;
  var signedCache = new Map(); // path -> { url, expires }

  function check(res) {
    if (res.error) throw KvestError("supabase", res.error.message, res.error);
    return res.data;
  }

  var remote = {
    async getSession() {
      var data = check(await sb.auth.getSession());
      currentUser = data.session ? data.session.user : null;
      return data.session;
    },

    onAuthChange(cb) {
      var sub = sb.auth.onAuthStateChange(function (event, session) {
        currentUser = session ? session.user : null;
        if (event === "SIGNED_OUT") signedCache.clear();
        // Колбэк вызываем асинхронно: внутри onAuthStateChange нельзя ждать других вызовов supabase.
        setTimeout(function () { cb(event, session); }, 0);
      });
      return function () { sub.data.subscription.unsubscribe(); };
    },

    async signIn(email, password) {
      var data = check(await sb.auth.signInWithPassword({ email: email, password: password }));
      currentUser = data.user;
      return data.session;
    },

    async signOut() {
      signedCache.clear();
      var res = await sb.auth.signOut();
      currentUser = null;
      if (res.error) throw KvestError("supabase", res.error.message, res.error);
    },

    async resetPassword(email) {
      var redirectTo = location.origin + location.pathname;
      check(await sb.auth.resetPasswordForEmail(email, { redirectTo: redirectTo }));
    },

    async updatePassword(password) {
      check(await sb.auth.updateUser({ password: password }));
    },

    async listItems() {
      return check(await sb.from("items").select("*").order("created_at", { ascending: false }));
    },

    async addItem(fields) {
      return check(await sb.from("items").insert({
        name: fields.name,
        category: fields.category,
        status: fields.status || "ok"
      }).select().single());
    },

    async updateItem(id, patch) {
      return check(await sb.from("items").update(patch).eq("id", id).select().single());
    },

    async deleteItem(item) {
      check(await sb.from("items").delete().eq("id", item.id));
      if (item.photo_path) {
        signedCache.delete(item.photo_path);
        var res = await sb.storage.from(BUCKET).remove([item.photo_path]);
        if (res.error) console.warn("Не удалось удалить фото", res.error);
      }
    },

    async uploadPhoto(itemId, blob) {
      if (!currentUser) await remote.getSession();
      if (!currentUser) throw KvestError("auth", "no session");
      var path = currentUser.id + "/" + itemId + ".jpg";
      var res = await sb.storage.from(BUCKET).upload(path, blob, {
        upsert: true,
        contentType: "image/jpeg",
        cacheControl: "3600"
      });
      if (res.error) throw KvestError("upload", res.error.message, res.error);
      signedCache.delete(path);
      return path;
    },

    async photoUrl(path) {
      if (!path) return null;
      var hit = signedCache.get(path);
      if (hit && hit.expires > Date.now()) return hit.url;
      var res = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
      if (res.error) { console.warn("Нет ссылки на фото", path, res.error); return null; }
      // обновляем за 5 минут до истечения
      signedCache.set(path, { url: res.data.signedUrl, expires: Date.now() + (SIGNED_TTL - 300) * 1000 });
      return res.data.signedUrl;
    },

    forgetPhoto(path) { signedCache.delete(path); },

    async listShopping() {
      return check(await sb.from("shopping_items").select("*").order("created_at", { ascending: false }));
    },

    async addShopping(name) {
      return check(await sb.from("shopping_items").insert({ name: name }).select().single());
    },

    async updateShopping(id, patch) {
      return check(await sb.from("shopping_items").update(patch).eq("id", id).select().single());
    },

    async deleteShopping(id) {
      check(await sb.from("shopping_items").delete().eq("id", id));
    }
  };

  /* ---------- public API ---------- */

  var backend = mode === "supabase" ? remote : demo;
  var authLink = readAuthLink();

  var api = {
    mode: mode,
    CATEGORIES: CATEGORIES,
    STATUSES: STATUSES,
    /** Тип ссылки из письма: "recovery" | "invite" | "" и возможная ошибка. */
    authLink: authLink,

    async init() {
      if (mode !== "supabase") return;
      if (!window.supabase || !window.supabase.createClient) await loadScript(SUPABASE_CDN);
      sb = window.supabase.createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    },

    getSession: function () { return backend.getSession(); },
    onAuthChange: function (cb) { return backend.onAuthChange(cb); },
    signIn: function (email, password) { return backend.signIn(email, password); },
    signOut: function () { return backend.signOut(); },
    resetPassword: function (email) { return backend.resetPassword(email); },
    updatePassword: function (password) { return backend.updatePassword(password); },

    listItems: function () { return backend.listItems(); },

    /** Создаёт предмет; если передан blob — загружает фото и записывает photo_path.
        Возвращает { item, photoError } — фото может не загрузиться, а предмет уже сохранён. */
    async addItem(fields, photoBlob) {
      var item = await backend.addItem(fields);
      var photoError = null;
      if (photoBlob) {
        try {
          var path = await backend.uploadPhoto(item.id, photoBlob);
          item = await backend.updateItem(item.id, { photo_path: path });
        } catch (e) { photoError = e; }
      }
      return { item: item, photoError: photoError };
    },

    /** Обновляет поля предмета и, при наличии, фото. */
    async updateItem(id, patch, photoBlob) {
      var photoError = null;
      var full = Object.assign({}, patch);
      if (photoBlob) {
        try { full.photo_path = await backend.uploadPhoto(id, photoBlob); }
        catch (e) { photoError = e; }
      }
      var item = await backend.updateItem(id, full);
      return { item: item, photoError: photoError };
    },

    /** Смена статуса всегда сбрасывает skip_shopping. */
    setStatus: function (id, status) {
      return backend.updateItem(id, { status: status, skip_shopping: false });
    },

    skipShopping: function (id) { return backend.updateItem(id, { skip_shopping: true }); },

    deleteItem: function (item) { return backend.deleteItem(item); },
    photoUrl: function (path) { return backend.photoUrl(path); },

    listShopping: function () { return backend.listShopping(); },
    addShopping: function (name) { return backend.addShopping(name); },
    updateShopping: function (id, patch) { return backend.updateShopping(id, patch); },
    deleteShopping: function (id) { return backend.deleteShopping(id); },

    /** Уменьшает фото до 800px по длинной стороне и сжимает в JPEG 0.8. */
    async downscale(file, maxSide, quality) {
      maxSide = maxSide || 800;
      quality = quality || 0.8;
      var source, w, h, cleanup = function () {};
      try {
        if (window.createImageBitmap) {
          source = await createImageBitmap(file, { imageOrientation: "from-image" });
          w = source.width; h = source.height;
          cleanup = function () { if (source.close) source.close(); };
        }
      } catch (e) { source = null; }
      if (!source) {
        var objUrl = URL.createObjectURL(file);
        source = await new Promise(function (resolve, reject) {
          var img = new Image();
          img.onload = function () { resolve(img); };
          img.onerror = function () { reject(KvestError("decode", "cannot decode image")); };
          img.src = objUrl;
        }).finally(function () { setTimeout(function () { URL.revokeObjectURL(objUrl); }, 0); });
        w = source.naturalWidth; h = source.naturalHeight;
      }
      if (!w || !h) throw KvestError("decode", "empty image");
      var scale = Math.min(1, maxSide / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, cw, ch);
      cleanup();
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/jpeg", quality); });
      if (!blob) throw KvestError("decode", "toBlob failed");
      return blob;
    }
  };

  window.KvestStore = api;
})();
