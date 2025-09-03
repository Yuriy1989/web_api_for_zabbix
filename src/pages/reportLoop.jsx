// reportError.jsx
import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import {
  ConfigProvider,
  theme,
  Space,
  Button,
  Card,
  Spin,
  Typography,
  Divider,
  Select,
  DatePicker,
} from "antd";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import { api } from "../utils/Api";
import TableEventForTemplates from "../components/table/TableEventForTemplates";
import exportToExcelDefault from "../utils/exportToExcelEventForTemplates";
import {
  ZABBIX_SERVER,
  TOKEN,
  ALERTS_FOR_ZABBIX,
  SEVERITY_LABELS,
} from "../utils/constants";
import "./reportLoop.css";

const { Text } = Typography;

const ReportLoop = () => {
  const { Option } = Select;
  const { RangePicker } = DatePicker;
  const defaultSelectedValues = ALERTS_FOR_ZABBIX.map(
    (item) => Object.values(item)[0]
  );

  const [dateDefaultForDatePicker, setDateDefaultForDatePicker] = useState(); // выбранный период
  const [loading, setLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [selectedValueGroup, setSelectedValueGroup] = useState([]);

  const [hosts, setHosts] = useState([]); // сырые хосты из Zabbix
  const [alertsDataAll, setAlertsDataAll] = useState([]); // сырые события из Zabbix
  const [selectedValues, setSelectedValues] = useState(defaultSelectedValues);

  const [aggRows, setAggRows] = useState([]); // Готовые строки для таблицы/экспорта

  // ===== helpers агрегации  =====
  const getServiceTag = (tags = []) => {
    if (!Array.isArray(tags)) return "";
    const t = tags.find((t) => t?.tag === "service");
    return t?.value ?? "";
  };

  const buildHostsIndex = (arr1 = []) => {
    const byId = new Map();
    const byName = new Map();
    (arr1 || []).forEach((h) => {
      const hostid = String(h?.hostid ?? "");
      const vm = h?.name ?? "";
      const nameKey = String(vm).toLowerCase();
      const service = getServiceTag(h?.tags);
      const rec = { hostid, vm, nameKey, service };
      if (hostid) byId.set(hostid, rec);
      if (nameKey) byName.set(nameKey, rec);
    });
    return { byId, byName };
  };

  // агрегируем события по ключу (severity, service, vm, alertName)
  const buildAggregatedRows = (arr1 = [], arr2 = []) => {
    const { byId, byName } = buildHostsIndex(arr1);
    const counter = new Map();

    (arr2 || []).forEach((ev) => {
      const sev = String(ev?.severity ?? "");
      const alertName = ev?.name ?? "";
      const evHosts = Array.isArray(ev?.hosts) ? ev.hosts : [];

      evHosts.forEach((eh) => {
        const idKey = String(eh?.hostid ?? "");
        const nameKey = String(eh?.name ?? "").toLowerCase();
        const m =
          (idKey && byId.get(idKey)) ||
          (nameKey && byName.get(nameKey)) ||
          null;
        if (!m) return;

        const service = m.service;
        const vm = m.vm;

        const k = `${sev}|${service}|${vm}|${alertName}`;
        if (!counter.has(k)) {
          counter.set(k, {
            sensorType: sev, // 3/4/5
            sensorLabel: SEVERITY_LABELS[sev] || String(sev), // Average/High/Disaster
            service,
            vm,
            alertName,
            count: 0,
          });
        }
        counter.get(k).count += 1;
      });
    });

    return [...counter.values()];
  };
  // ===== /helpers агрегации =====

  const HandleGetGroups = async () => {
    setLoading(true);
    try {
      const tempGroups = await api.getGroups(TOKEN, ZABBIX_SERVER);
      setGroups(tempGroups.result || []);
      console.log("getGroups ->", tempGroups);
    } catch (error) {
      console.log("Ошибка в запросе групп", error);
    } finally {
      setLoading(false);
    }
  };

  const HandleGetAlertsInLoop = async () => {
    setLoading(true);
    try {
      // 1) получаем хосты по выбранным группам
      const hostsResp = await api.getHostsByGroupIds(
        TOKEN,
        ZABBIX_SERVER,
        selectedValueGroup
      );

      // 2) временной диапазон
      const [fromPicked, tillPicked] = dateDefaultForDatePicker || [];
      const selectedDatesUnixFormat = [
        dayjs(fromPicked).unix(), // как выбрано в пикере
        dayjs(tillPicked).unix(), // как выбрано в пикере
      ];

      if (hostsResp?.result?.length) {
        const hostsList = hostsResp.result;
        setHosts(hostsList);

        // 3) события по хостам и выбранным severity
        const hostIds = hostsList.map((h) => h.hostid);
        const alertsData = await api.getEventTag(
          TOKEN,
          ZABBIX_SERVER,
          hostIds,
          selectedDatesUnixFormat[0],
          selectedDatesUnixFormat[1],
          selectedValues
        );

        const _alerts = alertsData?.result || [];
        setAlertsDataAll(_alerts);

        // 4) Готовим строки для таблицы ЗДЕСЬ
        const aggregated = buildAggregatedRows(hostsList, _alerts);
        setAggRows(aggregated);
      } else {
        // нет хостов по выбранным группам
        setHosts([]);
        setAlertsDataAll([]);
        setAggRows([]);
      }
    } catch (error) {
      console.log("Ошибка в запросе алертов", error);
      setHosts([]);
      setAlertsDataAll([]);
      setAggRows([]);
    } finally {
      setLoading(false);
    }
  };

  // === Статистика для панели (считаем по тем же данным, что в таблице) ===
  const stats = useMemo(() => {
    const totalHostsFound = hosts?.length ?? 0;
    const totalAlerts = alertsDataAll?.length ?? 0;

    const from = dateDefaultForDatePicker?.[0];
    const till = dateDefaultForDatePicker?.[1];
    const periodText =
      from && till
        ? `${dayjs(from).format("YYYY-MM-DD HH:mm")} → ${dayjs(till).format(
            "YYYY-MM-DD HH:mm"
          )}`
        : "-";

    const selectedSeverityLabels = (selectedValues || []).map(
      (v) => SEVERITY_LABELS?.[v] || String(v)
    );

    const alertsBySeverityMap = (alertsDataAll || []).reduce((acc, ev) => {
      const sev = String(ev?.severity ?? "");
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, {});
    const alertsBySeverity = Object.entries(alertsBySeverityMap)
      .map(([sev, count]) => ({
        sev,
        label: SEVERITY_LABELS?.[sev] || sev,
        count,
      }))
      .sort((a, b) => Number(a.sev) - Number(b.sev));

    return {
      totalHostsFound,
      totalAlerts,
      periodText,
      selectedSeverityLabels,
      alertsBySeverity,
    };
  }, [hosts, alertsDataAll, dateDefaultForDatePicker, selectedValues]);

  // === Экспорт в Excel — из тех же строк, что в таблице ===
  const exportToExcelDefaultService = () => {
    if (!aggRows || aggRows.length === 0) return;
    exportToExcelDefault(aggRows);
  };

  // дефолтный период — последний месяц
  useEffect(() => {
    const timeTill = Math.floor(Date.now() / 1000);
    const timeFrom = timeTill - 30 * 24 * 60 * 60;
    const tempDate = [dayjs.unix(timeFrom), dayjs.unix(timeTill)];
    setDateDefaultForDatePicker(tempDate);
  }, []);

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
        style={{ display: "flex", padding: 12 }}
      >
        {/* Блок выбора групп/периода/уровней */}
        <Card
          title={
            <Text strong style={{ fontSize: 16 }}>
              Нажмите Загрузить, чтобы подгрузить группы Hosts из Zabbix
            </Text>
          }
          size="small"
          styles={{ body: { paddingTop: 12, paddingBottom: 12 } }}
        >
          <Select
            placeholder="Выберите группу"
            mode="multiple"
            showSearch
            filterOption={(input, option) =>
              option.children.toLowerCase().includes(input.toLowerCase())
            }
            allowClear
            style={{ width: 300, marginRight: 10 }}
            onChange={(value) => setSelectedValueGroup(value)}
          >
            {groups?.map((item) => (
              <Option key={item.groupid} value={item.groupid} label={item.name}>
                {item.name}
              </Option>
            ))}
          </Select>

          <Button type="primary" onClick={HandleGetGroups}>
            Загрузить
          </Button>

          <RangePicker
            size="small"
            style={{ width: 360, marginLeft: 10 }}
            value={dateDefaultForDatePicker}
            showTime={{ format: "HH:mm", minuteStep: 5 }}
            format="YYYY-MM-DD HH:mm"
            onChange={(value) => setDateDefaultForDatePicker(value)}
          />

          <Select
            size="small"
            placeholder="Выберите уровень сработки"
            mode="multiple"
            style={{ width: 300, marginLeft: 10 }}
            value={selectedValues}
            onChange={setSelectedValues}
          >
            {ALERTS_FOR_ZABBIX.map((item, index) => {
              const key = Object.keys(item)[0];
              const value = item[key];
              return (
                <Option key={index} value={value}>
                  {key}
                </Option>
              );
            })}
          </Select>
        </Card>

        {/* Запрос */}
        <Card
          title={
            <Text strong style={{ fontSize: 16 }}>
              Статистика по количеству оповещений в каналы Loop
            </Text>
          }
          size="small"
          styles={{ body: { paddingTop: 12, paddingBottom: 12 } }}
        >
          <Space wrap>
            <Button
              type="primary"
              onClick={HandleGetAlertsInLoop}
              disabled={(selectedValues?.length ?? 0) === 0}
            >
              Выполнить запрос
            </Button>
          </Space>
        </Card>

        {/* Инфо-панель */}
        <Card size="small">
          <Space
            wrap
            split={
              <Divider type="vertical" style={{ borderColor: "#334155" }} />
            }
          >
            <Text>
              Хостов найдено: <Text strong>{stats.totalHostsFound}</Text>
            </Text>

            <Text>
              Сработок (по фильтрам): <Text strong>{stats.totalAlerts}</Text>
            </Text>

            <Text>
              Период: <Text strong>{stats.periodText}</Text>
            </Text>

            <Text>
              Уровни:
              {stats.selectedSeverityLabels.length > 0 ? (
                <Space size={6} style={{ marginLeft: 6 }}>
                  {stats.selectedSeverityLabels.map((lbl) => (
                    <span
                      key={lbl}
                      style={{
                        display: "inline-block",
                        padding: "0 8px",
                        borderRadius: 10,
                        border: "1px solid #334155",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      {lbl}
                    </span>
                  ))}
                </Space>
              ) : (
                <Text type="secondary" style={{ marginLeft: 6 }}>
                  —
                </Text>
              )}
            </Text>

            <Text>
              По уровням:
              <Space size={6} style={{ marginLeft: 6 }}>
                {stats.alertsBySeverity.map((row) => (
                  <span
                    key={row.sev}
                    style={{
                      display: "inline-block",
                      padding: "0 8px",
                      borderRadius: 10,
                      border: "1px solid #334155",
                      background: "rgba(255,255,255,0.02)",
                    }}
                    title={`Severity ${row.sev}`}
                  >
                    {row.label}: <b style={{ marginLeft: 4 }}>{row.count}</b>
                  </span>
                ))}
              </Space>
            </Text>
          </Space>
        </Card>

        {/* Экспорт */}
        <Card
          size="small"
          styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}
        >
          <Button
            onClick={exportToExcelDefaultService}
            disabled={(aggRows?.length ?? 0) === 0}
            icon={<DownloadForOfflineIcon />}
          >
            Export in Excel
          </Button>
        </Card>

        <main className="main">
          {(aggRows?.length ?? 0) > 0 && (
            <Card size="small" style={{ marginTop: 8 }}>
              <TableEventForTemplates rows={aggRows} />
            </Card>
          )}
        </main>
      </Space>
    </ConfigProvider>
  );
};

export default ReportLoop;
