import { useState } from "react";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

import "./App.css";
import { api } from "../utils/Api";
import TableData from "../table/Table";
import exportToExcelDefault from "../utils/exportToExcel";
import TableDataHosts from "../table/TableHosts";

function App() {
  const [dataZabbix, setDataZabbix] = useState();
  const [dataZabbixHosts, setDataZabbixHosts] = useState();
  const [server, setServer] = useState(
    "http://192.168.2.36:8080/api_jsonrpc.php"
  );
  const [userName, setUserName] = useState("Admin");
  const [password, setPassword] = useState("zabbix");
  const [nameService, setNameService] = useState("service");
  const [valueService, setValueService] = useState("home");
  const [load, setLoad] = useState(false);
  const [connect, setConnect] = useState();

  const clickButtonGetToken = (e) => {
    e.preventDefault();
    const data = {
      userName: userName,
      password: password,
      server: server,
    };
    api
      .getApi(data)
      .then((res) => {
        setConnect(res);
      })
      .catch((res) => {
        setConnect(res);
      });
  };

  const clickButtonGetAllHosts = (e) => {
    setDataZabbix(null);
    e.preventDefault();
    const data = {
      userName: userName,
      password: password,
      server: server,
    };
    api
      .getApi(data)
      .then((res) => {
        api
          .getAllHosts(res.result, data)
          .then((res) => {
            setDataZabbixHosts(res.result);
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
      userName: userName,
      password: password,
      server: server,
    };
    api
      .getApi(data)
      .then((res) => {
        api
          .getAllHostsByService(res.result, server, nameService, valueService)
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

    console.log("nameService", nameService);

    // Храним все обещания для запросов
    const requests = services.map((service) =>
      api
        .getAllHostsByService(res.result, server, "service", service)
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
        api.getAllTriggersByHost(res.result, server, hostIds).then((ress) => {
          console.log("triggers = ", ress.result);
          console.log("hosts", allHosts);

          // Создаем объект для быстрого поиска тегов по hostid
          const test = mergeTagsIntoTriggers(allHosts, ress.result);
          console.log(test);

          setDataZabbix(test);
          setLoad(false);
        });
      })
      .catch((error) => {
        setLoad(false);
        console.error("Общая ошибка выполнения запросов:", error);
      });
  };

  const clickButtonGetAllTriggers = (e) => {
    setDataZabbixHosts(null);
    setLoad(true);
    e.preventDefault();
    const data = {
      userName: userName,
      password: password,
      server: server,
    };
    api
      .getApi(data)
      .then((res) => {
        setLoad(false);
        performApiRequests(res);
      })
      .catch((res) => {
        setLoad(false);
        console.log(res);
      });
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

  const exportToExcelDefaultService = () => {
    exportToExcelDefault(dataZabbix);
  };

  return (
    <>
      <div className="App">
        <header className="App-header">
          <p>Web API for zabbix</p>
        </header>
      </div>
      <main className="main">
        <div className="form">
          <Card sx={{ minWidth: 275 }}>
            <CardContent>
              <Typography
                gutterBottom
                sx={{ color: "text.secondary", fontSize: 14 }}
              >
                Настройки подключения
              </Typography>
              <Box
                component="form"
                sx={{ "& > :not(style)": { marginBottom: 1, width: "25ch" } }}
                noValidate
                autoComplete="off"
              >
                <div>
                  <TextField
                    // id="outlined-basic"
                    size="small"
                    label="Адрес сервера"
                    variant="outlined"
                    sx={{
                      "& .MuiInputBase-input": { fontSize: "12px" }, // Уменьшаем размер текста и внутренний отступ
                      "& .MuiInputLabel-root": { fontSize: "12px" }, // Уменьшаем размер текста лейбла
                    }}
                    onChange={(e) => setServer(e.target.value)} // Обновляем состояние при изменении
                  />
                </div>
                <div>
                  <TextField
                    // id="outlined-basic"
                    size="small"
                    label="Имя пользователя"
                    variant="outlined"
                    sx={{
                      "& .MuiInputBase-input": { fontSize: "12px" }, // Уменьшаем размер текста и внутренний отступ
                      "& .MuiInputLabel-root": { fontSize: "12px" }, // Уменьшаем размер текста лейбла
                    }}
                    onChange={(e) => setUserName(e.target.value)} // Обновляем состояние при изменении
                  />
                </div>
                <div>
                  <TextField
                    // id="outlined-basic"
                    size="small"
                    label="Пароль"
                    type="password"
                    variant="outlined"
                    sx={{
                      "& .MuiInputBase-input": { fontSize: "12px" }, // Уменьшаем размер текста и внутренний отступ
                      "& .MuiInputLabel-root": { fontSize: "12px" }, // Уменьшаем размер текста лейбла
                    }}
                    onChange={(e) => setPassword(e.target.value)} // Обновляем состояние при изменении
                  />
                </div>
              </Box>
              <Button
                onClick={(e) => clickButtonGetToken(e)}
                size="small"
                variant="outlined"
                sx={{ fontSize: "10px", padding: "1px 1px" }}
              >
                Проверка связи
              </Button>
              <Button
                onClick={(e) => clickButtonGetAllHosts(e)}
                size="small"
                variant="outlined"
                sx={{
                  marginLeft: 1,
                  fontSize: "10px", // Уменьшает размер текста
                  padding: "1px 1px", // Уменьшает внутренние отступы
                }}
              >
                Выгрузить все хосты
              </Button>
              <Stack sx={{ mt: 1, width: "100%" }}>
                {connect?.result && (
                  <Alert severity="success" sx={{ fontSize: "12px", padding: "0px" }}>Success {connect?.result}</Alert>
                )}
                {connect?.error && (
                  <Alert severity="error" sx={{ fontSize: "12px", padding: "0px" }}>
                    Error: {connect?.error?.code} {connect?.error?.message}{" "}
                    {connect?.error?.data}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ ml: 2, minWidth: 275 }}>
            <CardContent>
              <Typography
                gutterBottom
                sx={{ color: "text.secondary", fontSize: 14 }}
              >
                Параметры запроса
              </Typography>
              <Box
                component="form"
                sx={{ "& > :not(style)": { marginBottom: 1, width: "25ch" } }}
                noValidate
                autoComplete="off"
              >
                <div>
                  <TextField
                    // id="outlined-basic"
                    size="small"
                    label="Наименование тега"
                    variant="outlined"
                    sx={{
                      "& .MuiInputBase-input": { fontSize: "12px" }, // Уменьшаем размер текста и внутренний отступ
                      "& .MuiInputLabel-root": { fontSize: "12px" }, // Уменьшаем размер текста лейбла
                    }}
                    onChange={(e) => setNameService(e.target.value)}
                  />
                </div>
                <div>
                  <TextField
                    multiline
                    rows={4}
                    // id="outlined-basic"
                    size="small"
                    label="Значение тега"
                    variant="outlined"
                    sx={{
                      width: "285px", // Устанавливаем ширину
                      "& .MuiInputBase-input": { fontSize: "12px" }, // Уменьшаем размер текста и внутренний отступ
                      "& .MuiInputLabel-root": { fontSize: "12px" }, // Уменьшаем размер текста лейбла
                    }}
                    onChange={(e) => setValueService(e.target.value)} // Обновляем состояние при изменении
                  />
                </div>
                <Button
                  onClick={(e) => clickButtonGetAllHostsByTag(e)}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: "10px", // Уменьшает размер текста
                    padding: "1px 1px", // Уменьшает внутренние отступы
                  }}
                >
                  Выгрузить хосты
                </Button>
                <Button
                  onClick={(e) => clickButtonGetAllTriggers(e)}
                  size="small"
                  variant="outlined"
                  sx={{
                    marginLeft: 1,
                    fontSize: "10px", // Уменьшает размер текста
                    padding: "1px 1px", // Уменьшает внутренние отступы
                  }}
                >
                  Выгрузить триггеры
                </Button>
              </Box>
            </CardContent>
          </Card>
        </div>
        {load && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {(dataZabbix || dataZabbixHosts) && (
          <div className="table">
            { dataZabbix && <TableData dataZabbix={dataZabbix} /> }
            { dataZabbixHosts && <TableDataHosts dataZabbixHosts={dataZabbixHosts}/> }
            {/* <Button
              variant="outlined"
              onClick={exportToExcel}
              disabled={!dataZabbix || dataZabbix.length === 0}
              startIcon={<DownloadForOfflineIcon />}
            >
              Export in Excel
            </Button> */}
            <Button
              variant="outlined"
              onClick={exportToExcelDefaultService}
              disabled={!dataZabbix || !dataZabbixHosts || dataZabbix.length === 0}
              startIcon={<DownloadForOfflineIcon />}
            >
              Export in Excel
            </Button>
          </div>
        )}
      </main>
    </>
  );
}

export default App;
