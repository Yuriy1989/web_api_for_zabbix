class Api {
  constructor(options) {
    this._baseUrl = options.baseUrl;
    this._headers = options.headers;
  }

  _getResponse(res) {
    return res.ok
      ? res.json().catch(() => Promise.reject("Некорректный формат ответа"))
      : Promise.reject(`Ошибка: ${res.status} ${res.statusText}`);
  }

  async _fetchWithTimeout(resource, options, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id); // Убираем тайм-аут при успешном ответе
      return response;
    } catch (error) {
      clearTimeout(id);
      if (error.name === "AbortError") {
        console.error("Ошибка: запрос был прерван из-за тайм-аута.");
        throw new Error("Время ожидания истекло");
      }
      console.error("Ошибка подключения:", error);
      throw error; // Повторно выбрасываем ошибку для обработки в `getApi`
    }
  }

  async login({ server, userName, password }) {
    const res = await this._fetchWithTimeout(server, {
      method: "POST",
      headers: this._headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "user.login",
        params: { username: userName, password },
        id: 1,
      }),
    });
    const data = await this._getResponse(res);
    if (data.error) throw new Error(data.error.data || data.error.message);
    return data.result; // auth token
  }

  // Универсальный вызов JSON-RPC c auth
  // + timeoutMs можно передавать на каждый вызов
  async rpc({ server, auth, method, params, id = 2, timeoutMs = 5000 }) {
    const res = await this._fetchWithTimeout(
      server,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method,
          params,
          id,
        }),
      },
      timeoutMs
    );
    const data = await this._getResponse(res);
    if (data.error)
      throw new Error(`${data.error.message}: ${data.error.data || ""}`);
    return data.result;
  }

  getApi(data) {
    return fetch(`${data.server}`, {
      method: "POST",
      headers: this._headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "user.login",
        params: {
          username: data.userName,
          password: data.password,
        },
        id: 1,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch((err) => {
        console.error("Ошибка запроса:", err);
        return Promise.reject(err.message || "Ошибка подключения"); // Передаем ошибку дальше для обработки
      });
  }

  getAllHosts(authToken, data) {
    return fetch(`${data}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          output: ["name", "status"],
          selectInterfaces: ["interfaceid", "ip"],
          selectTags: "extend",
        },
        id: 2,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getAllHostsByTemplates(authToken, server, selectedTemplate) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          output: ["hostid", "host", "name"], // Какие поля выгружать
          selectInterfaces: ["interfaceid", "ip"], // Дополнительно можно выбрать интерфейсы
          templateids: selectedTemplate,
        },
        id: 2,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getGroupIdsByNames(authToken, server, groupNames) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "hostgroup.get",
        params: {
          output: ["groupid", "name"],
          filter: { name: groupNames },
        },
        id: 11,
      }),
    }).then((res) => this._getResponse(res));
  }

  // По groupids забрать хосты с тегами и инвентарём
  getHostsByGroupIds(authToken, server, groupIds) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          groupids: groupIds,
          output: ["hostid", "name"],
          selectTags: "extend",
          selectInventory: "extend",
          selectInterfaces: ["interfaceid", "ip"],
        },
        id: 2,
      }),
    }).then((res) => this._getResponse(res));
  }

  // События по hostids за период, вместе с триггером
  getEventsWithTriggers(
    authToken,
    server,
    hostIds,
    timeFrom,
    timeTill,
    severitiesValues
  ) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "event.get",
        params: {
          hostids: hostIds,
          value: 1, // PROBLEM
          time_from: timeFrom,
          time_till: timeTill,
          output: ["eventid", "clock", "value", "severity", "objectid"],
          selectRelatedObject: "extend", // вернёт сам триггер
          selectHosts: ["hostid", "name"],
          ...(Array.isArray(severitiesValues) && severitiesValues.length
            ? { trigger_severities: severitiesValues }
            : {}),
        },
        id: 13,
      }),
    }).then((res) => this._getResponse(res));
  }

  getHostsIdByNameGroup(authToken, nameHostGroup, server) {
    console.log("nameHostGroup", nameHostGroup, authToken, server);
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "hostgroup.get",
        params: {
          filter: {
            name: nameHostGroup,
          },
          selectHosts: ["hostid", "name", "description"], // Связанные хосты
        },
        id: 2,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getTemplates(authToken, server) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "template.get",
        params: {
          output: ["templateid", "name"],
          // sortorder: "DESC",
          sortfiled: "name",
        },
        id: 1,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getHostsByTemplates(authToken, server) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "template.get",
        params: {
          output: ["templateid", "name"],
          sortfiled: "name",
        },
        id: 1,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getTriggers(authToken, server, hostids) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "trigger.get",
        params: {
          hostids: hostids,
          selectHosts: ["hostid", "name", "description"], // Связанные хосты
          sortfield: "priority",
          expandExpression: true,
          sortorder: "DESC",
          min_severity: 3,

          output: [
            "triggerid",
            "expression",
            "description",
            "comments",
            "priority",
            "status",
          ], // Какие поля выгружать
        },
        id: 3,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getAllHostsByService(authToken, server, nameTag, valueTag) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          output: ["hostid", "host", "name"], // Какие поля выгружать
          selectTags: "extend", // Выгружаем все теги
          selectInterfaces: ["interfaceid", "ip"],
          evaltype: 0,
          tags: [
            {
              tag: `${nameTag}`,
              value: valueTag,
            },
          ],
        },
        id: 2,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getItemByHosts(authToken, server, hosts) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "item.get",
        params: {
          output: "extend",
          hostids: hosts,
          search: {
            key_: "wtis",
          },
          selectHosts: ["hostid", "name", "description"], // Связанные хосты
        },
        id: 2,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getAllTriggersByHost(authToken, server, hostIds) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "trigger.get",
        params: {
          output: [
            "triggerid",
            "expression",
            "description",
            "comments",
            "priority",
            "status",
          ], // Какие поля выгружать
          selectHosts: ["hostid", "name", "description"], // Связанные хосты
          selectTags: "extend",
          sortfield: "priority",
          sortorder: "DESC",
          hostids: hostIds, // Указываем список ID хостов
          expandExpression: true,
          expandDescription: true,
        },
        id: 3,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getAllTriggersByHostAlert(authToken, server, hostIds, timeFrom, timeTill) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "trigger.get",
        params: {
          output: [
            "triggerid",
            "expression",
            "description",
            "comments",
            "priority",
            "status",
            "lastchange", // Время последнего изменения
          ],
          selectHosts: ["hostid", "name", "description"],
          selectTags: "extend",
          sortfield: "priority",
          sortorder: "DESC",
          hostids: hostIds,
          time_from: timeFrom,
          time_till: timeTill,
        },
        id: 3,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  // === БЫСТРЫЙ СУММАРНЫЙ ПОДСЧЁТ (все хосты) ===
  // Быстрый подсчёт количества событий PROBLEM по ВСЕМ хостам
  // за период и выбранные severity, с опцией включать/не включать события в maintenance (MM)
  async getEventCountsAll(
    authToken,
    server,
    timeFrom,
    timeTill,
    severitiesValues = [],
    opts = {}
  ) {
    // валидация входа
    if (!Array.isArray(severitiesValues) || severitiesValues.length === 0)
      return {};
    const start = Number(timeFrom);
    const end = Number(timeTill);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
      return {};

    // опции
    const {
      onProgress,
      windowDays = 14, // размер окна в днях (для устойчивости к тайм-аутам)
      timeoutMs = 20000, // таймаут одного RPC
      pauseMs = 120, // пауза между окнами
      includeSuppressedMM = false, // по умолчанию как в Problems/History (MM скрыты)
    } = opts;

    // уникальные severities (на всякий случай)
    const severities = [...new Set(severitiesValues.map((v) => String(v)))];

    // полуоткрытые окна [from; next-1], кроме последнего, где до end включительно
    const WINDOW = Number(windowDays) * 24 * 60 * 60;
    const windows = [];
    for (let t = start; t < end; t += WINDOW) {
      const next = Math.min(t + WINDOW, end);
      const isLast = next === end;
      windows.push([t, isLast ? next : next - 1]);
    }

    const totals = Object.fromEntries(severities.map((s) => [s, 0]));
    const totalWindows = windows.length;

    // итерируем последовательно по окнам; внутри окна — параллельно по severity
    for (let w = 0; w < windows.length; w++) {
      const [tf, tt] = windows[w];

      const batch = await Promise.all(
        severities.map(async (sev, i) => {
          const base = {
            source: 0,
            object: 0, // объект: trigger
            value: 1,
            time_from: tf,
            time_till: tt,
            severities: [Number(sev)],
            symptom: false, // ← брать только cause
            countOutput: true,
          };
          const params = includeSuppressedMM
            ? base
            : { ...base, suppressed: false };
          const cnt = await this.rpc({
            server,
            auth: authToken,
            method: "event.get",
            params,
            id: 8000 + w * 40 + i,
            timeoutMs,
          })
            .then((r) => Number(r) || 0)
            .catch(() => 0);
          return [sev, cnt];
        })
      );

      // суммируем
      for (const [sev, cnt] of batch) {
        totals[sev] = (totals[sev] || 0) + (cnt || 0);
      }

      // прогресс + бэкофф
      if (typeof onProgress === "function") onProgress(w + 1, totalWindows);
      if (pauseMs > 0 && w < windows.length - 1) {
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    }

    return totals;
  }

  // === РАЗБИВКА ПО ДНЯМ (все хосты) ===
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
      timeoutMs = 20000,
      pauseMs = 80,
      onProgress,
      includeSuppressedMM = true,
    } = opts;

    // генерируем полуоткрытые интервалы по дням
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
              object: 0, // объект: trigger
              value: 1,
              time_from: tf,
              time_till: tt,
              severities: [Number(sev)],
              symptom: false, // ← брать только cause
              countOutput: true,
            };
            const params = includeSuppressedMM
              ? base
              : { ...base, suppressed: false };
            const cnt = await this.rpc({
              server,
              auth: authToken,
              method: "event.get",
              params,
              id: 9000 + tf + i,
              timeoutMs,
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
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    results.sort((a, b) => a.time_from - b.time_from);
    return results;
  }

  // Список событий для аудита: показывает поштучно, с именем триггера
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
      limit = 10000, // чтобы не уронить браузер на очень длинных периодах
    }
  ) {
    const params = {
      source: 0, // события триггеров
      object: 0, // объект: trigger
      value: 1, // PROBLEM
      time_from: Number(timeFrom),
      time_till: Number(timeTill),
      symptom: !!includeSymptoms ? true : false, // по умолчанию без симптомов
      countOutput: false, // нужен список
      output: [
        "eventid",
        "clock",
        "severity",
        "name",
        "suppressed",
        "r_eventid",
      ],
      selectRelatedObject: "extend", // получим триггер (description/priority и т.п.)
      selectHosts: ["hostid", "name"],
      sortfield: "clock",
      sortorder: "ASC",
      limit,
    };
    if (Array.isArray(severitiesValues) && severitiesValues.length) {
      params.severities = severitiesValues.map(Number);
    }
    if (!includeSuppressedMM) {
      params.suppressed = false; // как в GUI без "Show suppressed problems"
    }
    return this.rpc({
      server,
      auth: authToken,
      method: "event.get",
      params,
      id: 12001,
      timeoutMs,
    });
  }

  // === РАЗБИВКА ПО МЕСЯЦАМ (все хосты) ===
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
      timeoutMs = 20000,
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
      const till = isLast ? tillRaw : tillRaw - 1; // полуоткрытый интервал
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
              object: 0, // объект: trigger
              value: 1,
              time_from: tf,
              time_till: tt,
              severities: [Number(sev)],
              symptom: false, // ← брать только cause
              countOutput: true,
            };
            const params = includeSuppressedMM
              ? base
              : { ...base, suppressed: false };
            const cnt = await this.rpc({
              server,
              auth: authToken,
              method: "event.get",
              params,
              id: 9500 + labelStart + i,
              timeoutMs,
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
        await new Promise((r) => setTimeout(r, pauseMs));
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

  getEventTag(
    authToken,
    server,
    hostIds,
    timeFrom,
    timeTill,
    severitiesValues
  ) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "event.get",
        params: {
          source: 0,
          object: 0,
          hostids: hostIds,
          output: "extend",
          severities: severitiesValues, // ← тут
          value: 1,
          time_from: timeFrom,
          time_till: timeTill,
          selectHosts: ["hostid", "name", "description"],
        },
        id: 3,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  //Получения всех тегов с именем service
  getTagsWithService(authToken, server) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          output: ["hostid", "name"], // Получаем hostid и имя хоста
          selectTags: "extend", // Загружаем все теги хостов
        },
        id: 1,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        // Извлекаем только теги с именем "service"
        const serviceTags = [];
        data.result.forEach((host) => {
          if (host.tags) {
            host.tags.forEach((tag) => {
              if (tag.tag === "service") {
                serviceTags.push(tag.value); // Добавляем значение тега
              }
            });
          }
        });
        return serviceTags; // Возвращаем все значения тега "service"
      })
      .catch((err) => console.error("Ошибка запроса:", err));
  }

  //Получения всех групп
  getGroups(authToken, server) {
    return fetch(`${server}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "hostgroup.get",
        params: {
          output: "extend",
        },
        id: 1,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }
}

export const api = new Api({
  headers: {
    "Content-Type": "application/json",
    // "Access-Control-Allow-Origin": "*",
  },
});
