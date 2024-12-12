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
    console.log('options', options);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal,
      });
      console.log('response', response)
      console.log('controller.signal', controller.signal)
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
    return fetch(`${data.server}`, {
      method: "POST",
      headers: this._headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          output: ["hostid", "host", "name"], // Какие поля выгружать
          selectInterfaces: ["interfaceid", "ip"], // Дополнительно можно выбрать интерфейсы
        },
        auth: `${authToken}`,
        id: 2,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getGroupIdByNameGroup(authToken, nameHostGroup, server) {
    return fetch(`${server}`, {
      method: "POST",
      headers: this._headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "hostgroup.get",
        params: {
          filter: {
            name: [nameHostGroup]
          }
        },
        auth: authToken,
        id: 2,
      })
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getAllHostsByService(authToken, server, nameTag, valueTag) {
    console.log(authToken, server, nameTag, valueTag);
    return fetch(`${server}`, {
      method: "POST",
      headers: this._headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          // output: ["hostid", "host", "name"], // Какие поля выгружать
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
        auth: `${authToken}`,
        id: 2,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }

  getAllTriggersByHost(authToken, server, hostIds) {
    return fetch(`${server}`, {
      method: "POST",
      headers: this._headers,
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
        },
        auth: `${authToken}`,
        id: 3,
      }),
    })
      .then((res) => this._getResponse(res))
      .catch(console.log);
  }
}

export const api = new Api({
  // baseUrl: 'http://192.168.2.36:8080/api_jsonrpc.php',
  // baseUrl: 'https://zabbix.vseinstrumenti.ru/api_jsonrpc.php',
  headers: {
    "Content-Type": "application/json",
    // "Access-Control-Allow-Origin": "*",
  },
});
