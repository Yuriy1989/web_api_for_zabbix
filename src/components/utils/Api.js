class Api {
  constructor(options) {
    this._baseUrl = options.baseUrl;
    this._headers = options.headers;
  }

  _getResponse(res) {
    return res.ok ? res.json() : Promise.reject(res.status)
  }

  getApi(data) {
    console.log('data', data);
    return fetch(`${this._baseUrl}`, {
      method: 'POST',
      headers: this._headers,
      body: JSON.stringify({
        jsonrpc:"2.0",
        method: "user.login",
        params: {
          username: `${data.name}`,
          password: `${data.password}`,
        },
        id: 1,
      })
    })
     .then(res => this._getResponse(res))
     .catch(console.log)
  }

  getAllHosts(authToken) {
    return fetch(`${this._baseUrl}`, {
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
    .then(res => this._getResponse(res))
    .catch(console.log)
  }

  getAllHostsByService(authToken, nameTag, valueTag) {
    return fetch(`${this._baseUrl}`, {
      method: "POST",
      headers: this._headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "host.get",
        params: {
          output: ["hostid", "host", "name"], // Какие поля выгружать
          selectTags: "extend", // Выгружаем все теги
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

  getAllTriggersByHost(authToken, hostIds) {
    return fetch(`${this._baseUrl}`, {
      method: "POST",
      headers: this._headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "trigger.get",
        params: {
          output: ["triggerid", "description", "priority", "value"], // Какие поля выгружать
          selectHosts: ["hostid", "name"], // Связанные хосты
          hostids: hostIds // Указываем список ID хостов
        },
        auth: `${authToken}`,
        id: 3,
      }),
    })
    .then(res => this._getResponse(res))
    .catch(console.log)
  }

}

export const api = new Api({
  baseUrl: 'http://zabbix.lan:8080/api_jsonrpc.php',
  headers: {
    'Content-Type': 'application/json',
    // "Access-Control-Allow-Origin": "*",
  }
})