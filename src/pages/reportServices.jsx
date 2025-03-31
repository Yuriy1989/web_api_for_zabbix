import { useState } from "react";
import { Select, Space, Button, Card, Spin } from "antd";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import { api } from "../utils/Api";
import TableData from "../components/table/Table";
import exportToExcelDefault from "../utils/exportToExcel";
import exportToExcelHosts from "../utils/exportToExcelHosts";
import TableDataHosts from "../components/table/TableHosts";
import { PASSWORD, USER_NAME, ZABBIX_SERVER } from "../utils/constants";
const { Option } = Select;

const ReportServices = () => {
  const [dataZabbix, setDataZabbix] = useState();
  const [dataZabbixHosts, setDataZabbixHosts] = useState();
  const [server, setServer] = useState(ZABBIX_SERVER);
  const [userName, setUserName] = useState(USER_NAME);
  const [password, setPassword] = useState(PASSWORD);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [token, setToken] = useState();
  const [selectedValueService, setSelectedValueService] = useState([]);
  const [nameService, setNameService] = useState("service");

  //Запрос на выгрузку всех сервисов в Zabbix
  const HandleGetServices = async () => {
    setLoading(true);

    try {
      const data = {
        userName: userName,
        password: password,
        server: server,
      };

      const token = await api.getApi(data);
      setToken(token.result);

      const services = await api.getTagsWithService(token.result, server);
      const uniqueTags = [...new Set(services)];
      // Формирование массива options
      const options = uniqueTags.map((tag) => ({
        label: tag,
        value: tag.toLowerCase().replace(/\s+/g, "_"),
        desc: `${tag}`,
      }));
      setServices(options);
    } catch (error) {
      console.log("Ошибка в запросе", error);
    } finally {
      setLoading(false);
    }
  };

  //Запрос на выгрузку всех хостов по имени сервисов
  const clickButtonGetAllHostsByTag = async () => {
    setDataZabbix(null);
    setLoading(true);

    let allHosts = [];

    try {
      for (const service of selectedValueService) {
        const hosts = await api.getAllHostsByService(
          token,
          server,
          nameService,
          service
        );
        allHosts = [...allHosts, ...hosts.result];
        setDataZabbixHosts(allHosts);
      }
    } catch (error) {
      console.error("Ошибка при запросе данных:", error);
    } finally {
      setLoading(false);
    }
  };

  //Запрос на выгрузку всех тригеров по хостам в разрезе сервисов
  const clickButtonGetAllTriggers = async () => {
    setDataZabbixHosts(null);
    setLoading(true);
    let allHosts = [];

    try {
      for (const service of selectedValueService) {
        const hosts = await api.getAllHostsByService(
          token,
          server,
          nameService,
          service
        );
        allHosts = [...allHosts, ...hosts.result];
        const hostIds = allHosts.map((host) => host.hostid);
        const tempTriggers = await api.getAllTriggersByHost(token, server, hostIds)
        console.log("triggers", tempTriggers.result);
        const triggers = mergeTagsIntoTriggers(allHosts, tempTriggers.result);
        setDataZabbix(triggers);
      }
    } catch (error) {
      console.log("Ошибка запроса", error);
    } finally {
      setLoading(false);
    }
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
      {loading && (
        <div className="loading-overlay">
          <Spin size="large" />
        </div>
      )}
      <Space
        direction="vertical"
        size="middle"
        style={{
          display: "flex",
          margin: "10px",
        }}
      >
        <Card
          title="Нажмите Загрузить, чтобы подгрузить сервисы из zabbix"
          size="small"
        >
          <Select
            placeholder="Выберите сервис"
            showSearch // Включаем поиск
            mode="multiple"
            filterOption={(input, option) =>
              option.children.toLowerCase().includes(input.toLowerCase())
            } // Фильтрация по введенному значению
            allowClear
            style={{
              width: "300px",
              marginRight: "10px",
            }}
            onChange={(value) => setSelectedValueService(value)} // Устанавливаем выбранное значение
          >
            {services &&
              services.map((item, index) => (
                <Option key={index} value={`${item.value}`}>
                  {item.value}
                </Option>
              ))}
          </Select>
          <Button type="primary" onClick={HandleGetServices}>
            Загрузить
          </Button>
        </Card>
        <Card size="small">
          <Button
            style={{ marginRight: "10px" }}
            onClick={(e) => clickButtonGetAllHostsByTag(e)}
            type="primary"
            disabled={!selectedValueService}
          >
            Выгрузить хосты
          </Button>
          <Button
            style={{ marginRight: "10px" }}
            onClick={(e) => clickButtonGetAllTriggers(e)}
            type="primary"
            disabled={!selectedValueService}
          >
            Выгрузить триггеры
          </Button>
          <Button
            variant="outlined"
            onClick={exportToExcelDefaultService}
            disabled={
              (!dataZabbix || dataZabbix.length === 0) &&
              (!dataZabbixHosts || dataZabbixHosts.length === 0)
            }
          >
            Export in Excel
          </Button>
        </Card>
      </Space>

      <main className="main">
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
};

export default ReportServices;
