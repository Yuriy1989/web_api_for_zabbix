import { useState } from "react";
import { Select, Space, Button, Card, Spin, ConfigProvider, theme } from "antd";
import { api } from "../utils/Api";
import exportToExcelDefault from "../utils/exportToExcel";
import exportToExcelGroupForTriggers from "../utils/exportToExcelGroupForTriggers";
import exportToExcelHosts from "../utils/exportToExcelHosts";
import TableHostsWithGroups from "../components/table/TableHostsWithGroups";
import { ZABBIX_SERVER, TOKEN } from "../utils/constants";
import "./reportsGroups.css"; // Подключаем стили
import TableTriggersDark from "../components/table/TableTriggersDark";

const ReportsGroups = () => {
  const { Option } = Select;

  const [dataZabbix, setDataZabbix] = useState();
  const [dataTriggers, setDataTriggers] = useState();
  const [dataZabbixHosts, setDataZabbixHosts] = useState();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedValueGroup, setSelectedValueGroup] = useState(null);

  const HandleGetGroups = async () => {
    setLoading(true);
    try {
      const tempGroups = await api.getGroups(TOKEN, ZABBIX_SERVER);
      setGroups(tempGroups.result);
    } catch (error) {
      console.log("Ошибка в запросе", error);
    } finally {
      setLoading(false);
    }
  };

  const flattenZabbixData = (groups = []) => {
    const flatList = [];

    groups.forEach((group) => {
      const groupName = group.name;

      if (Array.isArray(group.hosts) && group.hosts.length > 0) {
        group.hosts.forEach((host) => {
          flatList.push({
            name: groupName, // Название группы
            host: host.name || "-", // Имя хоста
            hostid: host.hostid || "-", // ID хоста
            description: host.description || "-", // Описание
            interfaces: host.interfaces || [], // Интерфейсы (может быть пусто)
            tags: host.tags || [], // Теги
            status: host.status || "-", // Статус
          });
        });
      }
    });

    return flatList;
  };

  const clickButtonGetAllHostsByNameHostGroup = async () => {
    // setDataZabbix(null);
    setDataTriggers(null);
    setLoading(true);
    try {
      const tempGroups = await api.getHostsIdByNameGroup(
        TOKEN,
        selectedValueGroup,
        ZABBIX_SERVER
      );
      setDataZabbixHosts(flattenZabbixData(tempGroups.result));
    } catch (error) {
      console.log("Ошибка в запросе", error);
    } finally {
      setLoading(false);
    }
  };

  const performApiRequests = async () => {
    setDataZabbix(null);
    setDataZabbixHosts(null);
    setLoading(true);
    let alltrigers = [];
    try {
      const temp = await api.getHostsIdByNameGroup(
        TOKEN,
        selectedValueGroup,
        ZABBIX_SERVER
      );

      // Формируем массив промисов
      const requests = temp.result[0].hosts.map((item) =>
        api.getAllTriggersByHost(TOKEN, ZABBIX_SERVER, item.hostid)
      );
      const results = await Promise.allSettled(requests);

      results.forEach((item) => {
        if (item.status === "fulfilled") {
          alltrigers.push(...item.value.result);
        }
      });

      const data = mergeTagsIntoTriggers(temp.result[0].hosts, alltrigers);
      console.log("data", data);
      setDataTriggers(data);
    } catch (err) {
      console.error("Общая ошибка выполнения:", err);
    } finally {
      setLoading(false);
    }
  };

  const clickButtonGetAllTriggers = (e) => {
    e.preventDefault();
    setDataZabbixHosts(null);
    performApiRequests();
  };

  function mergeTagsIntoTriggers(hostsArray, triggersArray) {
    console.log("hostsArray", hostsArray);
    console.log("triggersArray", triggersArray);
    if (!hostsArray || !triggersArray) return [];
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
    console.log("dataZabbixHosts", dataZabbixHosts);
    console.log("dataTriggers", dataTriggers);
    if (dataZabbixHosts) {
      exportToExcelHosts(dataZabbixHosts);
    }
    if (dataTriggers) {
      exportToExcelGroupForTriggers(dataTriggers);
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#7c3aed",
          colorInfo: "#7c3aed",
          colorBgBase: "#0b1221",
          colorBgContainer: "#111a2c",
          colorBorder: "#1e293b",
          borderRadius: 12,
          fontSize: 13,
        },
        components: {
          Card: { headerBg: "#0f172a", colorBorderSecondary: "#1e293b" },
          Table: {
            headerBg: "#0f172a",
            headerSplitColor: "#1e293b",
            borderColor: "#1e293b",
          },
          Tag: { defaultColor: "#1f2937" },
        },
      }}
    >
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
                <Option
                  key={index}
                  value={`${item.name}`}
                  groupid={`${item.name}`}
                >
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
            onClick={() => exportToExcelDefaultService(dataZabbixHosts)} // ХОСТЫ
            disabled={(!dataZabbixHosts || dataZabbixHosts.length === 0) && (!dataTriggers || dataTriggers.length === 0)}
          >
            Export in Excel
          </Button>
        </Card>
      </Space>

      <main className="main">
        {dataZabbixHosts && (
          <div className="table">
            {dataZabbixHosts && (
              <TableHostsWithGroups dataZabbixHosts={dataZabbixHosts} />
            )}
          </div>
        )}
        {/* Таблица триггеров */}
        {Array.isArray(dataTriggers) && dataTriggers.length > 0 && (
          <Card size="small" title="Триггеры">
            <TableTriggersDark rows={dataTriggers} loading={loading} />
          </Card>
        )}
      </main>
    </ConfigProvider>
  );
};

export default ReportsGroups;
