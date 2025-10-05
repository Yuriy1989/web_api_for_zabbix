// utils/ApiReportsEvent.js
class Api {
  constructor(options = {}) {
    this._baseUrl = options.baseUrl || "";
    this._headers = options.headers || { "Content-Type": "application/json" };
  }

  _getResponse(res) {
    return res.ok
      ? res.json().catch(() => Promise.reject("Некорректный формат ответа"))
      : Promise.reject(`Ошибка: ${res.status} ${res.statusText}`);
  }

  // Добавили { silent } — чтобы уметь "тихо" переживать таймауты в вспомогательных местах
  async _fetchWithTimeout(resource, options, timeout = 5000, { silent = false } = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      if (error.name === "AbortError") {
        if (!silent) console.debug("Timeout/abort", { timeout, method: options?.method });
        throw new Error("Время ожидания истекло");
      }
      if (!silent) console.debug("Ошибка подключения:", error);
      throw error;
    }
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  _isTransient(err) {
    const msg = String(err && (err.message || err));
    return (
      err?.name === "AbortError" ||
      /timeout/i.test(msg) ||
      /(?:^|[^\d])(429|502|503|504)(?:[^\d]|$)/.test(msg)
    );
  }

  // Универсальный вызов JSON-RPC с ретраями и экспоненциальным джиттером
  async rpc({
    server,
    auth,
    method,
    params,
    id = 2,
    timeoutMs = 5000,
    retries = 2,
    retryDelayMs = 700,
    silent = false,
  }) {
    let attempt = 0;
    const backoff = (k) => {
      const base = retryDelayMs * Math.pow(1.8, k);
      const jitter = 0.8 + Math.random() * 0.4;
      return Math.round(base * jitter);
    };

    while (true) {
      try {
        const res = await this._fetchWithTimeout(
          server,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${auth}`,
            },
            body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
          },
          timeoutMs,
          { silent }
        );
        const data = await this._getResponse(res);
        if (data.error)
          throw new Error(`${data.error.message}: ${data.error.data || ""}`);
        return data.result;
      } catch (err) {
        if (attempt < retries && this._isTransient(err)) {
          await this._sleep(backoff(attempt));
          attempt += 1;
          continue;
        }
        throw err;
      }
    }
  }

  // ===== Вспомогательные методы, используемые страницей =====
  async getGroups(auth, server) {
    return this.rpc({
      server,
      auth,
      method: "hostgroup.get",
      params: { output: ["groupid", "name"], sortfield: "name" },
      id: 600,
      timeoutMs: 15000,
      retries: 2,
    }).then((result) => ({ result }));
  }

  async getHostsByGroupIds(auth, server, groupIds = []) {
    if (!Array.isArray(groupIds) || groupIds.length === 0)
      return { result: [] };
    return this.rpc({
      server,
      auth,
      method: "host.get",
      params: {
        groupids: groupIds,
        output: ["hostid", "name"],
        selectTags: ["tag", "value"],
        sortfield: "name",
      },
      id: 601,
      timeoutMs: 20000,
      retries: 2,
    }).then((result) => ({ result }));
  }

  async getEventTag(
    auth,
    server,
    hostIds = [],
    timeFrom,
    timeTill,
    severitiesValues = []
  ) {
    if (!Array.isArray(hostIds) || hostIds.length === 0) return { result: [] };
    const params = {
      source: 0,
      object: 0,
      value: 1,
      time_from: Number(timeFrom),
      time_till: Number(timeTill),
      selectHosts: ["hostid", "name"],
      output: ["eventid", "severity", "name", "clock"],
      severities: (severitiesValues || []).map(Number),
      sortfield: "clock",
      sortorder: "ASC",
      hostids: hostIds,
    };
    return this.rpc({
      server,
      auth,
      method: "event.get",
      params,
      id: 602,
      timeoutMs: 20000,
      retries: 2,
    }).then((result) => ({ result }));
  }

  // === Список событий для аудита (без дробления окна) ===
  async getEventsAudit(
    authToken,
    server,
    {
      timeFrom,
      timeTill,
      severitiesValues = [],
      includeSuppressedMM = false,
      includeSymptoms = false,
      timeoutMs = 20000,
      limit = 10000,
    }
  ) {
    const params = {
      source: 0,
      object: 0,
      value: 1,
      time_from: Number(timeFrom),
      time_till: Number(timeTill),
      symptom: !!includeSymptoms,
      countOutput: false,
      output: [
        "eventid",
        "clock",
        "severity",
        "name",
        "suppressed",
        "r_eventid",
      ],
      selectRelatedObject: "extend",
      selectHosts: ["hostid", "name"],
      sortfield: "clock",
      sortorder: "ASC",
      limit,
    };
    if (Array.isArray(severitiesValues) && severitiesValues.length) {
      params.severities = severitiesValues.map(Number);
    }
    if (!includeSuppressedMM) {
      params.suppressed = false;
    }
    return this.rpc({
      server,
      auth: authToken,
      method: "event.get",
      params,
      id: 12001,
      timeoutMs,
      retries: 2,
    });
  }

  // === Порционная выборка с рекурсивным делением окон (для модалки) ===
  async getEventsAuditPaged(
    authToken,
    server,
    {
      timeFrom,
      timeTill,
      severitiesValues = [],
      includeSuppressedMM = false,
      includeSymptoms = false,
      timeoutMs = 20000,
      windowSeconds = 6 * 3600,
      perWindowLimit = 5000,
      concurrency = 2,
      pauseMs = 60,
      onProgress,
    }
  ) {
    const start = Number(timeFrom);
    const end = Number(timeTill);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
      return [];

    const severities =
      Array.isArray(severitiesValues) && severitiesValues.length
        ? [...new Set(severitiesValues.map(Number))]
        : null;

    const windows = [];
    for (let t = start; t < end; t += windowSeconds) {
      const next = Math.min(t + windowSeconds, end);
      const isLast = next === end;
      windows.push([t, isLast ? next : next - 1]);
    }

    const results = [];
    const seen = new Set();
    let done = 0;

    const baseParams = {
      source: 0,
      object: 0,
      value: 1,
      symptom: !!includeSymptoms,
      countOutput: false,
      output: [
        "eventid",
        "clock",
        "severity",
        "name",
        "suppressed",
        "r_eventid",
      ],
      selectRelatedObject: "extend",
      selectHosts: ["hostid", "name"],
      sortfield: "clock",
      sortorder: "ASC",
    };

    const buildParams = (tf, tt) => {
      const p = { ...baseParams, time_from: tf, time_till: tt };
      if (severities) p.severities = severities;
      if (!includeSuppressedMM) p.suppressed = false;
      p.limit = perWindowLimit + 1; // +1, чтобы детектить переполнение
      return p;
    };

    const MIN_SPLIT_SECONDS = 15 * 60; // минимум 15 минут для деления

    const fetchRange = async (tf, tt) => {
      if (tf > tt) return;

      let data = [];
      try {
        data = await this.rpc({
          server,
          auth: authToken,
          method: "event.get",
          params: buildParams(tf, tt),
          id: 12100 + tf,
          timeoutMs,
          retries: 2,
        });
      } catch (e) {
        // При ошибке делим окно, если оно достаточно широкое
        const span = tt - tf + 1;
        if (span > MIN_SPLIT_SECONDS) {
          const mid = Math.floor((tf + tt) / 2);
          await fetchRange(tf, mid);
          await fetchRange(mid + 1, tt);
        }
        return;
      }

      const arr = Array.isArray(data) ? data : [];

      // Переполнение — делим окно
      if (arr.length > perWindowLimit) {
        const mid = Math.floor((tf + tt) / 2);
        if (mid > tf && mid < tt) {
          await fetchRange(tf, mid);
          await fetchRange(mid + 1, tt);
          return;
        }
      }

      // Сбор результатов с дедупликацией eventid
      for (const e of arr) {
        const id = String(e.eventid);
        if (!seen.has(id)) {
          seen.add(id);
          results.push(e);
        }
      }
    };

    const queue = [...windows];
    const worker = async () => {
      while (queue.length) {
        const [tf, tt] = queue.shift();
        await fetchRange(tf, tt);
        done += 1;
        if (typeof onProgress === "function") onProgress(done, windows.length);
        if (pauseMs > 0 && queue.length) await this._sleep(pauseMs);
      }
    };

    const workers = Math.max(1, Math.min(concurrency, windows.length));
    await Promise.all(Array.from({ length: workers }, () => worker()));

    results.sort((a, b) => Number(a.clock) - Number(b.clock));
    return results;
  }

  // === БЫСТРЫЙ СУММАРНЫЙ ПОДСЧЁТ (все хосты) с автодроблением при ошибках ===
  async getEventCountsAll(
    authToken,
    server,
    timeFrom,
    timeTill,
    severitiesValues = [],
    opts = {}
  ) {
    if (!Array.isArray(severitiesValues) || severitiesValues.length === 0)
      return {};
    const start = Number(timeFrom);
    const end = Number(timeTill);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
      return {};

    const {
      onProgress,
      windowDays = 14,
      timeoutMs = 30000,
      pauseMs = 120,
      includeSuppressedMM = false,
      minWindowSeconds = 2 * 3600, // до 2 часов дробим при ошибках
      rpcRetries = 2,
    } = opts;

    const severities = [...new Set(severitiesValues.map((v) => String(v)))];

    const WINDOW = Number(windowDays) * 24 * 60 * 60;
    const windows = [];
    for (let t = start; t < end; t += WINDOW) {
      const next = Math.min(t + WINDOW, end);
      const isLast = next === end;
      windows.push([t, isLast ? next : next - 1]);
    }

    const totals = Object.fromEntries(severities.map((s) => [s, 0]));

    const countRange = async (tf, tt, sev) => {
      const params = {
        source: 0,
        object: 0,
        value: 1,
        time_from: tf,
        time_till: tt,
        severities: [Number(sev)],
        symptom: false,
        countOutput: true,
        ...(includeSuppressedMM ? {} : { suppressed: false }),
      };
      try {
        const n = await this.rpc({
          server,
          auth: authToken,
          method: "event.get",
          params,
          id: 8000 + tf + Number(sev),
          timeoutMs,
          retries: rpcRetries,
        });
        return Number(n) || 0;
      } catch (e) {
        const span = tt - tf + 1;
        if (span <= minWindowSeconds) {
          // слишком узко — сдаёмся, но не роняем
          return 0;
        }
        const mid = Math.floor((tf + tt) / 2);
        const a = await countRange(tf, mid, sev);
        const b = await countRange(mid + 1, tt, sev);
        return a + b;
      }
    };

    for (let w = 0; w < windows.length; w++) {
      const [tf, tt] = windows[w];

      // последовательно по severity — стабильнее под тяжёлой нагрузкой
      for (const sev of severities) {
        const cnt = await countRange(tf, tt, sev);
        totals[sev] = (totals[sev] || 0) + cnt;
      }

      if (typeof onProgress === "function") onProgress(w + 1, windows.length);
      if (pauseMs > 0 && w < windows.length - 1) await this._sleep(pauseMs);
    }

    return totals;
  }

  // === РАЗБИВКА ПО ДНЯМ (все хосты) с ретраями ===
  async getEventCountsAllByDay(
    authToken,
    server,
    timeFrom,
    timeTill,
    severitiesValues = [],
    opts = {}
  ) {
    if (!Array.isArray(severitiesValues) || severitiesValues.length === 0)
      return [];

    const start = Number(timeFrom);
    const end = Number(timeTill);
    const daySec = 24 * 60 * 60;

    const {
      concurrency = 3,
      timeoutMs = 30000,
      pauseMs = 80,
      onProgress,
      includeSuppressedMM = true,
    } = opts;

    const days = [];
    for (let t = start; t < end; t += daySec) {
      const next = Math.min(t + daySec, end);
      const isLast = next === end;
      days.push([t, isLast ? next : next - 1]);
    }

    const queue = [...days];
    const results = [];
    let done = 0;

    const worker = async () => {
      while (queue.length) {
        const [tf, tt] = queue.shift();

        const batch = await Promise.all(
          severitiesValues.map(async (sev, i) => {
            const base = {
              source: 0,
              object: 0,
              value: 1,
              time_from: tf,
              time_till: tt,
              severities: [Number(sev)],
              symptom: false,
              countOutput: true,
            };
            const params = includeSuppressedMM ? base : { ...base, suppressed: false };
            const cnt = await this.rpc({
              server,
              auth: authToken,
              method: "event.get",
              params,
              id: 9000 + tf + i,
              timeoutMs,
              retries: 2,
            })
              .then((r) => Number(r) || 0)
              .catch(() => 0);
            return [String(sev), cnt];
          })
        );

        results.push({
          time_from: tf,
          time_till: tt,
          counts: Object.fromEntries(batch),
        });

        done += 1;
        if (typeof onProgress === "function") onProgress(done, days.length);
        await this._sleep(pauseMs);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    results.sort((a, b) => a.time_from - b.time_from);
    return results;
  }

  // === РАЗБИВКА ПО МЕСЯЦАМ (все хосты) с ретраями ===
  async getEventCountsAllByMonth(
    authToken,
    server,
    timeFrom,
    timeTill,
    severitiesValues = [],
    opts = {}
  ) {
    if (!Array.isArray(severitiesValues) || severitiesValues.length === 0)
      return [];

    const {
      concurrency = 2,
      timeoutMs = 30000,
      pauseMs = 120,
      onProgress,
      includeSuppressedMM = true,
    } = opts;

    const start = Number(timeFrom);
    const end = Number(timeTill);

    const monthStartUTC = (ts) => {
      const d = new Date(ts * 1000);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
    };
    const addMonthUTC = (ts) => {
      const d = new Date(ts * 1000);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
    };

    let cur = monthStartUTC(start);
    const months = [];
    while (cur < end) {
      const next = addMonthUTC(cur);
      const from = Math.max(cur, start);
      const tillRaw = Math.min(next, end);
      const isLast = tillRaw === end;
      const till = isLast ? tillRaw : tillRaw - 1;
      months.push([from, till, cur]);
      cur = next;
    }

    const queue = [...months];
    const results = [];
    let done = 0;

    const worker = async () => {
      while (queue.length) {
        const [tf, tt, labelStart] = queue.shift();

        const batch = await Promise.all(
          severitiesValues.map(async (sev, i) => {
            const base = {
              source: 0,
              object: 0,
              value: 1,
              time_from: tf,
              time_till: tt,
              severities: [Number(sev)],
              symptom: false,
              countOutput: true,
            };
            const params = includeSuppressedMM ? base : { ...base, suppressed: false };
            const cnt = await this.rpc({
              server,
              auth: authToken,
              method: "event.get",
              params,
              id: 9500 + labelStart + i,
              timeoutMs,
              retries: 2,
            })
              .then((r) => Number(r) || 0)
              .catch(() => 0);
            return [String(sev), cnt];
          })
        );

        results.push({
          time_from: tf,
          time_till: tt,
          counts: Object.fromEntries(batch),
        });

        done += 1;
        if (typeof onProgress === "function") onProgress(done, months.length);
        await this._sleep(pauseMs);
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.max(1, Math.min(concurrency, months.length)) },
        () => worker()
      )
    );

    results.sort((a, b) => a.time_from - b.time_from);
    return results;
  }
}

export const api = new Api({
  headers: {
    "Content-Type": "application/json",
  },
});

export default Api;
