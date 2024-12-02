import { useEffect, useState } from "react";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";

import "./App.css";
import { api } from "../utils/Api";
import TableData from "../table/Table"

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

  const performApiRequests = (res) => {
    // Список значений для запроса
    const services = [
      "home",
      "viru",
      "bffgo",
      "loyal",
      "site-delivery",
      "unmarked-ad-detector",
      "product-review",
      "product-review-ui",
      "discussions",
      "ms-group-products",
      "product-review-automoderation",
      "smart-product-clusterizer",
      "ms-video-processing",
      "ms-widgets",
      "Site Image Resizer",
      "site-redirector",
      "groupproducts",
      "admarker",
      "consumables",
      "site-v3",
      "promo-ui",
      "scrooge-ui",
      "promo",
      "marketing-content",
      "personal-account-notification",
      "Product Composite",
      "Go microservice template",
      "user-log-collector",
      "site-xhprof-aggregator",
      "site-order",
    ];

    // Храним все обещания для запросов
    const requests = services.map((service) =>
      api
        .getAllHostsByService(res.result, "service", service)
        .then((response) => ({ service, response }))
        .catch((error) => ({ service, error }))
    );

    Promise.all(requests)
      .then((results) => {
        const allHosts = [];

        results.forEach(({ service, response, error }) => {
          if (error) {
            console.error(`Ошибка для сервиса ${service}:`, error);
          } else {
            console.log(`Результаты для сервиса ${service}:`, response);
            allHosts.push(...response.result); // Добавляем все хосты для данного сервиса
          }
        });

        const hostIds = allHosts.map((host) => host.hostid);

        // Получение триггеров для всех хостов
        api.getAllTriggersByHost(res.result, hostIds).then((ress) => {
          console.log("triggers = ", ress.result);
          console.log("hosts", allHosts);

          // Создаем объект для быстрого поиска тегов по hostid
          const test = mergeTagsIntoTriggers(allHosts, ress.result);
          console.log(test);

          setDataZabbix(test);
        });
      })
      .catch((error) => {
        console.error("Общая ошибка выполнения запросов:", error);
      });
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
        performApiRequests(res);
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
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Triggers");

    // Определение колонок
    worksheet.columns = [
      { header: "Наименование host", key: "hostName", width: 20 },
      { header: "Примечание по host", key: "hostDescription", width: 20 },
      { header: "Описание tags по host", key: "hostTags", width: 20 },
      { header: "Приоритет", key: "priority", width: 7 },
      { header: "Описание trigger", key: "description", width: 50 },
      { header: "triggerid", key: "triggerId", width: 7 },
      { header: "expression", key: "expression", width: 50 },
      { header: "status (0 - антивен, 1 - выключен)", key: "status", width: 7 },
      { header: "Примечание по триггеру", key: "triggerComments", width: 20 },
    ];

    // Данные для таблицы
    const data = dataZabbix.map(
      ({
        comments,
        description,
        expression,
        hosts,
        priority,
        status,
        triggerid,
      }) => ({
        hostName: hosts?.[0]?.name || "-",
        hostDescription: hosts?.[0]?.description || "-",
        hostTags: Array.isArray(hosts?.[0]?.tags)
          ? hosts[0].tags.map((item) => `${item.tag}: ${item.value}`).join(", ")
          : "-",
        priority: Number(priority),
        description: description,
        triggerId: triggerid,
        expression: expression,
        status: status,
        triggerComments: comments || "-",
      })
    );

    // Добавление строк в таблицу
    // Добавление строк в таблицу
    data.forEach((row) => {
      const newRow = worksheet.addRow(row);

      // Перенос слов для каждой ячейки строки
      newRow.eachCell((cell) => {
        cell.alignment = { wrapText: true, vertical: "middle" }; // Перенос текста
      });

      // Условное форматирование для столбца "Приоритет"
      const priorityCell = newRow.getCell("priority");
      let priorityColor;

      // Определяем цвет на основе значения
      switch (priorityCell.value) {
        case 1:
          priorityColor = "FF87CEEB"; // Голубой
          break;
        case 2:
          priorityColor = "FFFFFF00"; // Желтый
          break;
        case 3:
          priorityColor = "FFFFA500"; // Оранжевый
          break;
        case 4:
          priorityColor = "fc2d51"; // Светло-красный
          break;
        case 5:
          priorityColor = "FFFF0000"; // Яркий красный
          break;
        default:
          priorityColor = "FFFFFFFF"; // Белый
          break;
      }

      // Применяем цвет к ячейке
      priorityCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: priorityColor },
      };
    });

    // Применение стилей к шапке
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 }; // Жирный шрифт, белый цвет
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F81BD" }, // Синий фон
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      }; // Центровка и перенос
    });

    // Добавление границ для всех ячеек
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Сохранение файла
    workbook.xlsx.writeBuffer().then((buffer) => {
      saveAs(
        new Blob([buffer], { type: "application/octet-stream" }),
        "TriggersData.xlsx"
      );
    });
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
        <div className="table">
          <TableData dataZabbix={dataZabbix} />
          <button className="buttonExportToExcel" onClick={exportToExcel}>Export in Excel</button>
        </div>
      </main>
    </>
  );
}

export default App;
