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
          // filter: {
          //   priority: [1, 2, 3], // Только disaster и high
          // },
          time_from: timeFrom,
          time_till: timeTill,
        },
        id: 3,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  //Быстрый подсчёт количества событий PROBLEM по ВСЕМ хостам
  // за период и выбранные severity
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
    const {
      onProgress,
      windowDays = 14,
      timeoutMs = 20000,
      pauseMs = 120,
    } = opts;
    // 14-дневные окна, чтоб не бить по БД гигантским сканом
    const WINDOW = Number(windowDays) * 24 * 60 * 60;
    const windows = [];
    for (let t = Number(timeFrom); t < Number(timeTill); t += WINDOW) {
      const a = t;
      const b = Math.min(t + WINDOW, Number(timeTill));
      windows.push([a, b]);
    }
    const totalWindows = windows.length;
    // сумматор по severity
    const totals = Object.fromEntries(
      severitiesValues.map((s) => [String(s), 0])
    );

    // идём последовательно по окнам (чтобы не словить rate-limit/таймауты)
    for (let w = 0; w < windows.length; w++) {
      const [tf, tt] = windows[w];
      // по окну — параллельно по severity, но с увеличенным timeout
      const batch = await Promise.all(
        severitiesValues.map((sev, i) =>
          this.rpc({
            server,
            auth: authToken,
            method: "event.get",
            params: {
              value: 1,
              time_from: tf,
              time_till: tt,
              trigger_severities: [sev],
              countOutput: true,
            },
            id: 8000 + w * 20 + i,
            timeoutMs,
          })
            .then((res) => Number(res) || 0)
            .catch(() => 0)
        )
      );
      batch.forEach((cnt, idx) => {
        const key = String(severitiesValues[idx]);
        totals[key] = (totals[key] || 0) + cnt;
      });
      if (typeof onProgress === "function") onProgress(w + 1, totalWindows);
      // лёгкий backoff между окнами
      await new Promise((r) => setTimeout(r, pauseMs));
    }

    return totals;
  }

  /**
   * Разбивка по дням (все хосты): для каждого дня и каждого severity — countOutput: true.
   * Возвращает массив дней: [{ date: 'YYYY-MM-DD', counts: { '3': n, '4': n, ... } }, ...]
   */
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

    const days = [];
    for (let t = start; t < end; t += daySec) {
      days.push([t, Math.min(t + daySec, end)]);
    }
    const {
      concurrency = 3,
      timeoutMs = 20000,
      pauseMs = 80,
      onProgress,
    } = opts;
    const totalDays = days.length;

    // ограничим одновременные RPC, чтобы не перегружать Zabbix и сеть
    const queue = [...days];
    const results = [];
    let done = 0;

    // воркер обрабатывает по одному дню: для дня — параллельно по severity
    const worker = async () => {
      while (queue.length) {
        const [tf, tt] = queue.shift();
        const batch = await Promise.all(
          severitiesValues.map((sev, i) =>
            this.rpc({
              server,
              auth: authToken,
              method: "event.get",
              params: {
                value: 1,
                time_from: tf,
                time_till: tt,
                trigger_severities: [sev],
                countOutput: true,
              },
              id: 9000 + tf + i, // уникальность не критична, лишь для отладки
              timeoutMs, // 20 сек на день+severity
            })
              .then((res) => [String(sev), Number(res) || 0])
              .catch(() => [String(sev), 0])
          )
        );
        results.push({
          time_from: tf,
          time_till: tt,
          counts: Object.fromEntries(batch),
        });
        done += 1;
        if (typeof onProgress === "function") onProgress(done, totalDays);
        // маленькая пауза, чтобы не долбить сервер
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    };

    // запустим N воркеров
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    // вернём в исходном порядке по времени
    results.sort((a, b) => a.time_from - b.time_from);
    return results;
  }

  /**
   * Разбивка по месяцам (все хосты): для каждого месяца и каждого severity — countOutput: true.
   * Возвращает массив: [{ time_from, time_till, counts: { '3': n, '4': n, ... } }, ...]
   * opts: { concurrency=2, timeoutMs=20000, pauseMs=120, onProgress }
   */
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
    } = opts;

    const start = Number(timeFrom);
    const end = Number(timeTill);

    // UTC start of month
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
      const till = Math.min(next, end);
      months.push([from, till, cur]); // cur — «ярлык» месяца
      cur = next;
    }
    const totalMonths = months.length;

    const queue = [...months];
    const results = [];
    let done = 0;

    const worker = async () => {
      while (queue.length) {
        const [tf, tt, labelStart] = queue.shift();
        const batch = await Promise.all(
          severitiesValues.map((sev, i) =>
            this.rpc({
              server,
              auth: authToken,
              method: "event.get",
              params: {
                value: 1,
                time_from: tf,
                time_till: tt,
                trigger_severities: [sev],
                countOutput: true,
              },
              id: 9500 + labelStart + i,
              timeoutMs,
            })
              .then((res) => [String(sev), Number(res) || 0])
              .catch(() => [String(sev), 0])
          )
        );

        results.push({
          time_from: tf,
          time_till: tt,
          counts: Object.fromEntries(batch),
        });
        done += 1;
        if (typeof onProgress === "function") onProgress(done, totalMonths);
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    };

    const workers = Array.from(
      { length: Math.max(1, Math.min(concurrency, totalMonths)) },
      () => worker()
    );
    await Promise.all(workers);

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
          hostids: hostIds,
          output: "extend", // Запросим только количество событий
          trigger_severities: severitiesValues,
          value: 1,
          time_from: timeFrom, // Начало временного интервала
          time_till: timeTill, // Конец временного интервала
          selectHosts: ["hostid", "name", "description"], // Связанные хосты
          // suppressed: true,
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
