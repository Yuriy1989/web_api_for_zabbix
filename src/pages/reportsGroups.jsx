import { useEffect, useState } from "react";
import { Select, Space, Button, Card, Spin } from "antd";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import { api } from "../utils/Api";
import TableData from "../components/table/Table";
import exportToExcelDefault from "../utils/exportToExcel";
import TableDataHosts from "../components/table/TableHosts";
import exportToExcelHostsWithGroups from "../utils/exportToExcelHostsWithGroups";
import TableHostsWithGroups from "../components/table/TableHostsWithGroups";
import { PASSWORD, USER_NAME, ZABBIX_SERVER } from "../utils/constants";

const ReportsGroups = () => {
  const { Option } = Select;

  const [dataZabbix, setDataZabbix] = useState();
  const [dataZabbixHosts, setDataZabbixHosts] = useState();
  const [server, setServer] = useState(ZABBIX_SERVER);
  const [userName, setUserName] = useState(USER_NAME);
  const [password, setPassword] = useState(PASSWORD);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [token, setToken] = useState();
  const [selectedValueGroup, setSelectedValueGroup] = useState(null);

  const HandleGetGroups = async () => {
    setLoading(true);
    try {
      const data = {
        userName: userName,
        password: password,
        server: server,
      };

      const tempToken = await api.getApi(data);
      setToken(tempToken.result);

      const tempGroups = await api.getGroups(tempToken.result, server);
      console.log('tempGroups', tempGroups);
      setGroups(tempGroups.result);
    } catch (error) {
      console.log("Ошибка в запросе", error);
    } finally {
      setLoading(false);
    }
  };

  const flattenZabbixData = (groups = []) => {
    const flatList = [];

    groups.forEach(group => {
      const groupName = group.name;

      if (Array.isArray(group.hosts) && group.hosts.length > 0) {
        group.hosts.forEach(host => {
          flatList.push({
            name: groupName,                // Название группы
            host: host.name || "-",         // Имя хоста
            hostid: host.hostid || "-",     // ID хоста
            description: host.description || "-", // Описание
            interfaces: host.interfaces || [],    // Интерфейсы (может быть пусто)
            tags: host.tags || [],               // Теги
            status: host.status || "-",          // Статус
          });
        });
      }
    });

    return flatList;
  };

  const clickButtonGetAllHostsByNameHostGroup = async () => {
    setDataZabbix(null);
    setLoading(true);
    const data = {
      userName: userName,
      password: password,
      server: server,
    };

    try {
      const tempGroups = await api.getHostsIdByNameGroup(token, selectedValueGroup, server)
      setDataZabbixHosts(flattenZabbixData(tempGroups.result));

    } catch (error) {
      console.log("Ошибка в запросе", error);
    } finally {
      setLoading(false);
    }
  };

  const performApiRequests = (res) => {
    // Список значений для запроса

    // Храним все обещания для запросов
    const requests = groups.map((service) =>
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
          // setLoad(false);
        });
      })
      .catch((error) => {
        // setLoad(false);
        console.error("Общая ошибка выполнения запросов:", error);
      });
  };

  const clickButtonGetAllTriggers = (e) => {
    setDataZabbixHosts();
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
      exportToExcelHostsWithGroups(dataZabbixHosts);
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
          title="Нажмите Загрузить, чтобы подгрузить группы Hosts из zabbix"
          size="small"
        >
          <Select
            placeholder="Выберите группу"
            mode="multiple"
            showSearch // Включаем поиск
            filterOption={(input, option) =>
              option.children.toLowerCase().includes(input.toLowerCase())
            } // Фильтрация по введенному значению
            allowClear
            style={{
              width: "300px",
              marginRight: "10px",
            }}
            onChange={(value) => setSelectedValueGroup(value)} // Устанавливаем выбранное значение
          >
            {groups &&
              groups.map((item, index) => (
                <Option key={index} value={`${item.name}`} groupid={`${item.name}`}>
                  {item.name}
                </Option>
              ))}
          </Select>
          <Button type="primary" onClick={HandleGetGroups}>
            Загрузить
          </Button>
        </Card>
        <Card size="small">
          <Button
            style={{ marginRight: "10px" }}
            onClick={(e) => clickButtonGetAllHostsByNameHostGroup(e)}
            type="primary"
            disabled={!selectedValueGroup}
          >
            Выгрузить хосты
          </Button>
          <Button
            style={{ marginRight: "10px" }}
            onClick={(e) => clickButtonGetAllTriggers(e)}
            type="primary"
            disabled={!selectedValueGroup}
          >
            Выгрузить триггеры
          </Button>
          <Button
            variant="outlined"
            onClick={exportToExcelDefaultService}
            disabled={!dataZabbixHosts || dataZabbixHosts.length === 0}
          >
            Export in Excel
          </Button>
        </Card>
      </Space>

      <main className="main">
        {(dataZabbixHosts) && (
          <div className="table">
            {dataZabbixHosts && (
              <TableHostsWithGroups dataZabbixHosts={dataZabbixHosts} />
            )}
            <Button
              variant="outlined"
              onClick={exportToExcelDefaultService}
              disabled={
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

export default ReportsGroups;
