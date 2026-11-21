/* Sample data stays on this phone. A saved script URL shares one Google Sheet.
   The access code is sent with each request and is not written into the repo.
   Device commands are never queued: a light should not turn on hours later. */
(function () {
  const L = globalThis.HubLogic;
  const Sample = globalThis.HubSample;
  const SAMPLE_KEY = "hub-sample-v1";
  const CACHE_KEY = "hub-cache-v1";
  const QUEUE_KEY = "hub-queue-v1";
  const CODE_KEY = "hub-code";
  const USER_KEY = "hub-user";
  const PERMANENT = {
    "bad batch": true,
    "bad id": true,
    "bad op": true,
    "bad request": true,
    "unknown collection": true
  };

  function scriptUrl() {
    let saved = "";
    try { saved = localStorage.getItem("hub-script-url") || ""; } catch (e) {}
    const url = String(globalThis.HUB_SCRIPT_URL || saved || "").trim();
    if (!url || /PASTE|YOUR_URL|example\.com/i.test(url)) return "";
    return url;
  }
  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || ""); } catch (e) { return null; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function readQueue() {
    const q = readJson(QUEUE_KEY);
    return Array.isArray(q) ? q : [];
  }
  function code() {
    try { return localStorage.getItem(CODE_KEY) || ""; } catch (e) { return ""; }
  }

  async function call(action, payload) {
    const url = scriptUrl();
    if (!url) throw { code: "unconfigured" };
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({ action: action, code: code() }, payload || {}))
      });
    } catch (e) { throw { code: "unavailable" }; }
    let json;
    try { json = await res.json(); } catch (e) { throw { code: "unavailable" }; }
    if (!json || json.ok === false) {
      if (json && json.error === "unauthorized") throw { code: "unauthorized" };
      throw { code: "server", message: (json && json.error) || "The sheet rejected that save.", body: json };
    }
    return json;
  }

  const Store = {
    mode: "sample",
    pending: 0,
    unreachable: false,
    authProblem: false,
    scriptUrl: scriptUrl,
    code: code,
    load() {
      const live = !!scriptUrl();
      this.mode = live ? "live" : "sample";
      this.unreachable = false;
      this.authProblem = false;
      let userId = "user_randy";
      try { userId = localStorage.getItem(USER_KEY) || "user_randy"; } catch (e) {}
      if (!live) {
        const saved = readJson(SAMPLE_KEY);
        const state = saved ? L.normalize(saved) : Sample.build(L.today());
        if (!saved) writeJson(SAMPLE_KEY, state);
        this.pending = 0;
        return { state: state, mode: "sample", needsCode: false, userId: userId };
      }
      const cache = readJson(CACHE_KEY);
      const q = readQueue();
      this.pending = q.length;
      this.authProblem = !code();
      const state = cache && cache.state ? L.normalize(cache.state) : L.emptyState();
      return {
        state: state,
        mode: "live",
        needsCode: !code(),
        fromCache: !!(cache && cache.state),
        cacheAt: cache && cache.savedAt,
        pending: q.length,
        userId: userId
      };
    },
    saveCode(value) {
      try { localStorage.setItem(CODE_KEY, value || ""); } catch (e) {}
    },
    saveUser(id) {
      try { localStorage.setItem(USER_KEY, id || "user_randy"); } catch (e) {}
    },
    remember(state) {
      if (scriptUrl()) writeJson(CACHE_KEY, { state: state, savedAt: new Date().toISOString() });
      else writeJson(SAMPLE_KEY, state);
    },
    resetSample() {
      const fresh = Sample.build(L.today());
      writeJson(SAMPLE_KEY, fresh);
      this.mode = "sample";
      return fresh;
    },
    async persist(state, ops) {
      this.remember(state);
      if (!scriptUrl()) return { ok: true, queued: false };
      if (!ops || !ops.length) return { ok: true, queued: false };
      const items = L.chunkOps(ops, 80).map(function (part) { return { batchId: L.uid("batch"), ops: part }; });
      const queued = [];
      let rejected = "";
      for (let i = 0; i < items.length; i++) {
        try {
          await call("batch", items[i]);
        } catch (e) {
          if (e && e.code === "unauthorized") {
            this.authProblem = true;
            for (let j = i; j < items.length; j++) queued.push(items[j]);
            break;
          }
          if (e && e.code === "server" && PERMANENT[e.message]) {
            rejected = e.message;
            continue;
          }
          this.unreachable = true;
          for (let j = i; j < items.length; j++) queued.push(items[j]);
          break;
        }
      }
      if (queued.length) {
        const q = readQueue();
        writeJson(QUEUE_KEY, q.concat(queued));
        this.pending = q.length + queued.length;
      }
      if (this.authProblem) {
        return { ok: false, unauthorized: true, queued: true, message: "That access code was not accepted. The change is on this phone and will sync after the right code is entered." };
      }
      if (rejected && !queued.length) return { ok: false, rejected: true, message: "The sheet rejected a save (" + rejected + ")." };
      if (queued.length) return { ok: false, queued: true, message: "Saved on this phone. It will sync when the sheet answers." };
      this.unreachable = false;
      this.authProblem = false;
      return { ok: true, queued: false };
    },
    async flush() {
      if (!scriptUrl()) return { ok: true };
      let q = readQueue();
      while (q.length) {
        try {
          await call("batch", q[0]);
        } catch (e) {
          if (e && e.code === "server" && PERMANENT[e.message]) {
            q.shift();
            writeJson(QUEUE_KEY, q);
            this.pending = q.length;
            continue;
          }
          writeJson(QUEUE_KEY, q);
          this.pending = q.length;
          if (e && e.code === "unauthorized") {
            this.authProblem = true;
            return { ok: false, unauthorized: true };
          }
          this.unreachable = true;
          return { ok: false, offline: true };
        }
        q.shift();
        writeJson(QUEUE_KEY, q);
        this.pending = q.length;
      }
      this.unreachable = false;
      this.authProblem = false;
      return { ok: true };
    },
    async refresh() {
      if (!scriptUrl()) {
        const saved = readJson(SAMPLE_KEY);
        return { ok: true, state: saved ? L.normalize(saved) : Sample.build(L.today()) };
      }
      const flushed = await this.flush();
      if (!flushed.ok) return flushed;
      try {
        const json = await call("list");
        const state = L.normalize(json);
        writeJson(CACHE_KEY, { state: state, savedAt: new Date().toISOString() });
        this.unreachable = false;
        this.authProblem = false;
        return { ok: true, state: state };
      } catch (e) {
        if (e && e.code === "unauthorized") {
          this.authProblem = true;
          return { ok: false, unauthorized: true };
        }
        this.unreachable = true;
        return { ok: false, offline: true };
      }
    },
    /* SmartThings, Blink, calendar, and the test digest. Not queued. */
    async command(action, payload) {
      if (!scriptUrl()) return { ok: false, sample: true, error: "Sample data is on this phone. Nothing was sent." };
      try { return await call(action, payload); }
      catch (e) {
        if (e && e.code === "unauthorized") return { ok: false, unauthorized: true, error: "The access code was not accepted." };
        if (e && e.body) return e.body;
        return { ok: false, error: (e && e.message) || "The sheet did not answer." };
      }
    }
  };
  globalThis.Store = Store;
})();
