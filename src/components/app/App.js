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
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";

import "./App.css";
import { api } from "../utils/Api";
import TableData from "../table/Table";
import exportToExcelDefault from "../utils/exportToExcel";
import exportToExcelHosts from "../utils/exportToExcelHosts";
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
  const [nameHostGroup, setValueNameHostGroup] = useState([]);
  const [template, setTemplate] = useState("");
  const [load, setLoad] = useState(false);
  const [connect, setConnect] = useState();

  const clickButtonGetToken2 = async (e) => {
    e.preventDefault();
    setLoad(true);

    const data = {
      userName: userName,
      password: password,
      server: server,
    };

    try {
      const res = await api.getApi(data);
      console.log("Успешный ответ:", res);
      setConnect({ status: "connected", data: res });
    } catch (err) {
      setConnect({
        status: "error",
        message: typeof err === "string" ? err : "Сервер недоступен",
      });
    } finally {
      setLoad(false); // Снимаем флаг загрузки
    }
  };

  const clickButtonGetToken = (e) => {
    console.log("test");
    e.preventDefault();
    setLoad(true);

    const data = {
      userName: userName,
      password: password,
      server: server,
    };

    api
      .getApi(data)
      .then((res) => {
        console.log("clickButtonGetToken", res);
        setConnect({ status: "connected", data: res });
        setLoad(false); // Снимаем флаг загрузки
        setConnect({
          status: "successful",
          message: res.result,
        });
      })
      .catch((err) => {
        setLoad(false); // Снимаем флаг загрузки
        console.log(err);
        setConnect({
          status: "error",
          message: err,
        });
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
    setDataZabbix();
    setLoad(true);
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
            setDataZabbixHosts(res.result);
            console.log("clickButtonGetAllHostsByTag", res);
            setLoad(false);
          })
          .catch((res) => {
            setLoad(false);
            console.log(res);
          });
      })
      .catch((res) => {
        setLoad(false);
        console.log(res);
      });
  };

  const handleChange = (event) => {
    setTemplate(event.target.value);
  };

  const clickButtonGetAllHostsByNameHostGroup = (e) => {
    setDataZabbix();
    setDataZabbixHosts();
    setLoad(true);
    e.preventDefault();
    console.log("clickButtonGetAllHostsByNameHostGroup");
    const data = {
      userName: userName,
      password: password,
      server: server,
    };

    api
      .getApi(data)
      .then((res) => {
        api
          .getGroupIdByNameGroup(res.result, nameHostGroup, server)
          .then((res) => {
            // setDataZabbixHosts(res.result);
            console.log("clickButtonGetAllHostsByNameHostGroup", res);
            setLoad(false);
          })
          .catch((res) => {
            setLoad(false);
            console.log(res);
          });
      })
      .catch((res) => {
        setLoad(false);
        console.log(res);
      });
  };

  const clickButtonAddHosts = () => {
    console.log("clickButtonAddHosts");
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
          // Создаем объект для быстрого поиска тегов по hostid
          const triggers = mergeTagsIntoTriggers(allHosts, ress.result);
          setDataZabbix(triggers);
          console.log("triggers", triggers);
          setLoad(false);
        });
      })
      .catch((error) => {
        setLoad(false);
        console.error("Общая ошибка выполнения запросов:", error);
      });
  };

  const clickButtonGetAllTriggers = (e) => {
    setDataZabbixHosts();
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
        performApiRequests(res);
      })
      .catch((res) => {
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

  const exportToExcelDefaultService = () => {
    if (dataZabbix) {
      exportToExcelDefault(dataZabbix);
    } else {
      console.log("exportToExcelHosts");
      exportToExcelHosts(dataZabbixHosts);
    }
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
                {connect?.status === "successful" && (
                  <Alert
                    severity="success"
                    sx={{ fontSize: "12px", padding: "0px" }}
                  >
                    {connect?.status} {connect?.message}
                  </Alert>
                )}
                {connect?.status === "error" && (
                  <Alert
                    severity="error"
                    sx={{ fontSize: "12px", padding: "0px" }}
                  >
                    {connect?.status} {connect?.message}
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
                Поиск по tags
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
          <Card sx={{ ml: 2, minWidth: 275 }}>
            <CardContent>
              <Typography
                gutterBottom
                sx={{ color: "text.secondary", fontSize: 14 }}
              >
                Поиск по Host group
              </Typography>
              <Box
                component="form"
                sx={{ "& > :not(style)": { marginBottom: 1, width: "25ch" } }}
                noValidate
                autoComplete="off"
              >
                <div>
                  <TextField
                    multiline
                    rows={4}
                    // id="outlined-basic"
                    size="small"
                    label="Наименование групп(ы)"
                    variant="outlined"
                    sx={{
                      width: "285px", // Устанавливаем ширину
                      "& .MuiInputBase-input": { fontSize: "12px" }, // Уменьшаем размер текста и внутренний отступ
                      "& .MuiInputLabel-root": { fontSize: "12px" }, // Уменьшаем размер текста лейбла
                    }}
                    onChange={(e) => setValueNameHostGroup(e.target.value)} // Обновляем состояние при изменении
                  />
                </div>
                <Button
                  onClick={(e) => clickButtonGetAllHostsByNameHostGroup(e)}
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
          <Card sx={{ ml: 2, minWidth: 275 }}>
            <CardContent>
              <Typography
                gutterBottom
                sx={{ color: "text.secondary", fontSize: 14 }}
              >
                Добавление Hosts
              </Typography>
              <Box
                component="form"
                sx={{ "& > :not(style)": { marginBottom: 1, width: "25ch" } }}
                noValidate
                autoComplete="off"
              >
                <div>
                  <TextField
                    multiline
                    rows={4}
                    size="small"
                    label="Наименование host(s)"
                    variant="outlined"
                    sx={{
                      width: "240px", // Устанавливаем ширину
                      "& .MuiInputBase-input": { fontSize: "12px" }, // Уменьшаем размер текста и внутренний отступ
                      "& .MuiInputLabel-root": { fontSize: "12px" }, // Уменьшаем размер текста лейбла
                    }}
                    onChange={(e) => setValueService(e.target.value)} // Обновляем состояние при изменении
                  />

                  <FormControl
                    sx={{
                      mt: 1,
                      width: "240px", // Устанавливаем ширину
                      "& .MuiInputBase-input": { fontSize: "12px" }, // Уменьшаем размер текста и внутренний отступ
                      "& .MuiInputLabel-root": { fontSize: "12px" }, // Уменьшаем размер текста лейбла
                    }}
                    size="small"
                  >
                    <InputLabel id="demo-select-small-label">
                      Template
                    </InputLabel>
                    <Select
                      labelId="demo-select-small-label"
                      id="demo-select-small"
                      value={template}
                      label="Age"
                      onChange={handleChange}

                    >
                      <MenuItem sx={{ color: "text.secondary", fontSize: 12 }} value="">
                        <em>None</em>
                      </MenuItem>
                      <MenuItem value={10}>Ten</MenuItem>
                      <MenuItem value={20}>Twenty</MenuItem>
                      <MenuItem value={30}>Thirty</MenuItem>
                    </Select>
                  </FormControl>
                </div>
                <Button
                  onClick={clickButtonAddHosts}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: "10px", // Уменьшает размер текста
                    padding: "1px 1px", // Уменьшает внутренние отступы
                  }}
                >
                  Добавить
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
            {dataZabbix && <TableData dataZabbix={dataZabbix} />}
            {dataZabbixHosts && (
              <TableDataHosts dataZabbixHosts={dataZabbixHosts} />
            )}
            <Button
              variant="outlined"
              onClick={exportToExcelDefaultService}
              disabled={
                (!dataZabbix || dataZabbix.length === 0) &&
                (!dataZabbixHosts || dataZabbixHosts.length === 0)
              }
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
