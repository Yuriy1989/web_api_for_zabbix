import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";
import { api } from "../utils/Api";

function App() {
  const [dataZabbix, setDataZabbix] = useState();

  const clickButtonGetAPI = (e) => {
    e.preventDefault();
    console.log("clickButtonGetAPI");
    const data = {
      name: "Admin",
      password: "zabbix",
    };
    api
      .getApi(data)
      .then((res) => {
        console.log("res", res);
      })
      .catch((res) => console.log(res));
  };

  const clickButtonGetAllHosts = (e) => {
    e.preventDefault();
    console.log("clickButtonGetAllHosts");
    const data = {
      name: "Admin",
      password: "zabbix",
    };
    api
      .getApi(data)
      .then((res) => {
        console.log("res", res);
        api
          .getAllHosts(res.result)
          .then((res) => {
            console.log("clickButtonGetAllHosts", res);
          })
          .catch((res) => console.log(res));
      })
      .catch((res) => console.log(res));
  };

  const clickButtonGetAllHostsByTag = (e) => {
    e.preventDefault();
    console.log("clickButtonGetAllHostsByTag");
    const data = {
      name: "Admin",
      password: "zabbix",
    };
    api
      .getApi(data)
      .then((res) => {
        console.log("res", res);
        api
          .getAllHostsByService(res.result, "service", "home")
          .then((res) => {
            console.log("clickButtonGetAllHostsByTag", res);
          })
          .catch((res) => console.log(res));
      })
      .catch((res) => console.log(res));
  };

  const clickButtonGetAllTriggers = (e) => {
    e.preventDefault();
    const data = {
      name: "Admin",
      password: "zabbix",
    };
    api
      .getApi(data)
      .then((res) => {
        console.log("res", res);
        api
          .getAllHostsByService(res.result, "service", "home")
          .then((results) => {
            console.log("clickButtonGetAllHostsByTag", results);

            const hostIds = results.result.map((host) => host.hostid);
            console.log("hostIds", hostIds, res.result);
            api.getAllTriggersByHost(res.result, hostIds).then((ress) => {
              console.log("triggers = ", ress.result);
              console.log("hosts", results.result);

              // Создаем объект для быстрого поиска тегов по hostid
              const test = mergeTagsIntoTriggers(results.result, ress.result);
              console.log(test);

              setDataZabbix(test);
            });
          })
          .catch((res) => console.log(res));
      })
      .catch((res) => console.log(res));
  };

  function mergeTagsIntoTriggers(hostsArray, triggersArray) {
    // Создаем объект для быстрого поиска тегов по hostid
    const hostTagsMap = hostsArray.reduce((map, host) => {
      map[host.hostid] = host.tags || []; // Сопоставляем hostid с tags
      return map;
    }, {});

    // Проходим по каждому триггеру
    return triggersArray.map((trigger) => {
      const updatedHosts = trigger.hosts.map((host) => {
        // Если для hostid есть соответствующие теги, добавляем их
        return {
          ...host,
          tags: hostTagsMap[host.hostid] || [], // Добавляем теги или оставляем пустой массив
        };
      });

      // Возвращаем обновленный триггер с обновленным массивом hosts
      return {
        ...trigger,
        hosts: updatedHosts,
      };
    });
  }

  const exportToExcel = () => {

    const mas = dataZabbix.map(
      ({
        comments,
        description,
        expression,
        hosts,
        priority,
        status,
        triggerid,
      }) => ({
        "Наименование host": hosts?.[0]?.name || "Не указано",
        Приоритет: priority,
        Описание: description,
        triggerid: triggerid,
        expression: expression,
        status: status,
        "Примечание по триггеру": comments || "Нет примечаний",
        "Примечание по hosts": hosts?.[0]?.description || "Нет описания",
        "Описание tags по hosts": Array.isArray(hosts?.[0]?.tags)
          ? hosts[0].tags.map((item) => `${item.tag}: ${item.value}`).join(", ") // Преобразуем массив в строку
          : "Нет тегов", // Если теги отсутствуют
      })
    );
    console.log(mas);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(mas);
    XLSX.utils.book_append_sheet(wb, ws, "Triggers");
    XLSX.writeFile(wb, "TriggersData.xlsx");
  };

  return (
    <>
      <div className="App">
        <header className="App-header">
          <p>Web API for zabbix</p>
        </header>
      </div>
      <main className="main">
        <form className="form">
          <div className="blockAuth">
            <div className="block">
              <p>Адрес сервера zabbix</p>
              <input className="serviceName"></input>
            </div>
            <div className="block">
              <p>Имя пользователя с правами администратора</p>
              <input className="serviceName"></input>
            </div>
            <div className="block">
              <p>Пароль от пользователя</p>
              <input className="serviceName"></input>
            </div>
            <div className="blockButton">
              <button onClick={(e) => clickButtonGetAPI(e)} className="button">
                проверка связи с сервером zabbix
              </button>
              <button
                onClick={(e) => clickButtonGetAllHosts(e)}
                className="button"
              >
                Выгрузить все хосты
              </button>
            </div>
          </div>
          <div className="blockTag">
            <div className="block">
              <p>Наименование тега</p>
              <input className="serviceName"></input>
            </div>
            <div className="block">
              <p>Значение тега</p>
              <input className="serviceName"></input>
            </div>
            <button
              onClick={(e) => clickButtonGetAllHostsByTag(e)}
              className="button"
            >
              Выгрузить хосты по наименования тега
            </button>
            <button
              onClick={(e) => clickButtonGetAllTriggers(e)}
              className="button"
            >
              Выгрузить триггеры по наименования тега
            </button>
          </div>
        </form>
        <button onClick={exportToExcel}>Export in Excel</button>
      </main>
    </>
  );
}

export default App;
