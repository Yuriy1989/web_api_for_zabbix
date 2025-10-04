// pages/reportLoop.jsx
import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import {
  ConfigProvider,
  theme,
  Space,
  Button,
  Card,
  Typography,
  Divider,
  Select,
  DatePicker,
  Table,
  Flex,
  Progress,
  Segmented,
} from "antd";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import { api } from "../utils/Api";
import TableEventForTemplates from "../components/table/TableEventForTemplates";
import SeverityCountersTable from "../components/table/SeverityCountersTable";
import exportToExcelDefault from "../utils/exportToExcelEventForTemplates";
import exportToExcelSeverityOnly from "../utils/exportToExcelSeverityOnly";
import exportToExcelAllHostsDaily from "../utils/exportToExcelAllHostsDaily";
import {
  ZABBIX_SERVER,
  TOKEN,
  ALERTS_FOR_ZABBIX,
  SEVERITY_LABELS,
} from "../utils/constants";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import "./reportLoop.css";

const { Text, Title } = Typography;

const SEVERITY_COLORS = {
  0: "#64748b",
  1: "#3b82f6",
  2: "#eab308",
  3: "#f59e0b",
  4: "#ef4444",
  5: "#a21caf",
};

// --- helper: слить дубликаты периодов (YYYY-MM / YYYY-MM-DD) с суммированием по severity
const dedupByPeriod = (rows = [], severities = []) => {
  const map = new Map();
  for (const r of rows) {
    const key = r.date;
    if (!map.has(key)) {
      map.set(key, { date: key, counts: { ...(r.counts || {}) } });
    } else {
      const cur = map.get(key);
      const out = { ...cur.counts };
      (severities || []).forEach((sev) => {
        const k = String(sev);
        out[k] = (out[k] || 0) + (r.counts?.[k] || 0);
      });
      map.set(key, { date: key, counts: out });
    }
  }
  return Array.from(map.values());
};

// 🎉 Забавный оверлей загрузки с хомяком и прогресс-баром
const FunnyLoadingOverlay = ({ visible, progress, label }) => {
  const tips = [
    "Хомяк крутит колёсико…",
    "Считаем пиксели и пакеты…",
    "Уговариваем триггеры успокоиться…",
    "Оптимизируем оповещения на лету…",
    "Выгуливаем базу Zabbix…",
    "Ещё чуть-чуть магии… ✨",
  ];
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setTipIdx(0);
    const id = setInterval(() => setTipIdx((i) => (i + 1) % tips.length), 1600);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="loading-overlay">
      <div className="funny-box">
        <div className="funny-scene" aria-hidden="true">
          <div className="funny-wheel" />
          <div className="funny-hamster" role="img" aria-label="hamster">
            🐹
          </div>
          <div className="funny-paws">
            <span>🐾</span><span>🐾</span><span>🐾</span><span>🐾</span>
          </div>
        </div>

        <Text strong className="funny-title">{label || tips[tipIdx]}</Text>
        <Text type="secondary" className="funny-tip">
          {label ? tips[tipIdx] : "Подождите, всё посчитаем…"}
        </Text>

        <div className="loading-progress">
          {progress > 0 ? (
            <Progress percent={progress} status={progress < 100 ? "active" : "normal"} />
          ) : (
            <Progress percent={30} status="active" showInfo={false} />
          )}
        </div>
      </div>
    </div>
  );
};

const ReportLoop = () => {
  const { Option } = Select;
  const { RangePicker } = DatePicker;
  const defaultSelectedValues = ALERTS_FOR_ZABBIX.map(
    (item) => Object.values(item)[0]
  );

  // ===== Общие состояния =====
  const [dateRange, setDateRange] = useState();
  const [selectedValues, setSelectedValues] = useState(defaultSelectedValues);

  // Режим разбиения: total | daily | monthly
  const [splitMode, setSplitMode] = useState("daily");

  // Лоадер + прогресс (в оверлее)
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  // ===== Старый функционал (по группам) =====
  const [groups, setGroups] = useState([]);
  const [selectedValueGroup, setSelectedValueGroup] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [alertsDataAll, setAlertsDataAll] = useState([]);
  const [aggRows, setAggRows] = useState([]);

  // 🔢 Кол-во хостов по каждой выбранной группе { groupid: count }
  const [groupHostCounts, setGroupHostCounts] = useState({});

  // ===== Новое: все хосты =====
  const [countsAllHosts, setCountsAllHosts] = useState({});
  const [dailyAllHosts, setDailyAllHosts] = useState([]);     // [{date:'YYYY-MM-DD', counts:{'3':n,...}}]
  const [monthlyAllHosts, setMonthlyAllHosts] = useState([]); // [{date:'YYYY-MM',     counts:{'3':n,...}}]

  // Пагинация
  const [dailyPageSize, setDailyPageSize] = useState(14);
  const [monthlyPageSize, setMonthlyPageSize] = useState(12);

  // Пресет «неделя»
  const setLastWeek = () => {
    const till = dayjs();
    const from = till.subtract(7, "day");
    setDateRange([from, till]);
  };

  // Дефолт — месяц
  useEffect(() => {
    const t = Math.floor(Date.now() / 1000);
    const f = t - 30 * 24 * 60 * 60;
    setDateRange([dayjs.unix(f), dayjs.unix(t)]);
  }, []);

  // ====== По группам (как было) ======
  const HandleGetGroups = async () => {
    setLoading(true);
    try {
      const tempGroups = await api.getGroups(TOKEN, ZABBIX_SERVER);
      setGroups(tempGroups.result || []);
    } finally {
      setLoading(false);
    }
  };

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

        const k = `${sev}|${m.service}|${m.vm}|${alertName}`;
        if (!counter.has(k)) {
          counter.set(k, {
            sensorType: sev,
            sensorLabel: SEVERITY_LABELS[sev] || String(sev),
            service: m.service,
            vm: m.vm,
            alertName,
            count: 0,
          });
        }
        counter.get(k).count += 1;
      });
    });

    return [...counter.values()];
  };

  const HandleGetAlertsInLoop = async () => {
    setLoading(true);
    try {
      const [fromPicked, tillPicked] = dateRange || [];
      const [tf, tt] = [dayjs(fromPicked).unix(), dayjs(tillPicked).unix()];

      const hostsResp = await api.getHostsByGroupIds(
        TOKEN,
        ZABBIX_SERVER,
        selectedValueGroup
      );

      // 👇 Дополнительно подтягиваем число хостов по каждой группе
      if ((selectedValueGroup?.length ?? 0) > 0) {
        try {
          const groupsWithHosts = await api.rpc({
            server: ZABBIX_SERVER,
            auth: TOKEN,
            method: "hostgroup.get",
            params: {
              groupids: selectedValueGroup,
              output: ["groupid", "name"],
              selectHosts: ["hostid"],
            },
            id: 701,
            timeoutMs: 15000,
          });
          const counts = {};
          (groupsWithHosts || []).forEach(
            (g) => (counts[g.groupid] = (g.hosts?.length ?? 0))
          );
          setGroupHostCounts(counts);
        } catch (e) {
          setGroupHostCounts({});
        }
      } else {
        setGroupHostCounts({});
      }

      if (hostsResp?.result?.length) {
        const hostsList = hostsResp.result;
        setHosts(hostsList);

        const hostIds = hostsList.map((h) => h.hostid);
        const alertsData = await api.getEventTag(
          TOKEN,
          ZABBIX_SERVER,
          hostIds,
          tf,
          tt,
          selectedValues
        );

        const _alerts = alertsData?.result || [];
        setAlertsDataAll(_alerts);

        const aggregated = buildAggregatedRows(hostsList, _alerts);
        setAggRows(aggregated);
      } else {
        setHosts([]);
        setAlertsDataAll([]);
        setAggRows([]);
      }
    } catch {
      setHosts([]);
      setAlertsDataAll([]);
      setAggRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Короткая сводка по текущим данным «по группам»
  const stats = useMemo(() => {
    const totalHostsFound = hosts?.length ?? 0;
    const totalAlerts = alertsDataAll?.length ?? 0;

    const from = dateRange?.[0];
    const till = dateRange?.[1];
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
  }, [hosts, alertsDataAll, dateRange, selectedValues]);

  // Сводка по выбранным группам: [{id,name,count}]
  const selectedGroupsInfo = useMemo(() => {
    return (selectedValueGroup || []).map((gid) => {
      const g = (groups || []).find((x) => x.groupid === gid);
      return {
        id: gid,
        name: g?.name || gid,
        count: groupHostCounts?.[gid] ?? 0,
      };
    });
  }, [selectedValueGroup, groups, groupHostCounts]);

  // ===== Все хосты: единый обработчик с режимами =====
  const handleAllHostsCounts = async () => {
    const [fromPicked, tillPicked] = dateRange || [];
    if (!fromPicked || !tillPicked) return;
    if ((selectedValues?.length ?? 0) === 0) return;

    setLoading(true);
    setProgress(0);
    setProgressLabel("Подсчёт итогов…");

    try {
      const tf = dayjs(fromPicked).unix();
      const tt = dayjs(tillPicked).unix();

      // 1) Суммарно
      const summary = await api.getEventCountsAll(
        TOKEN,
        ZABBIX_SERVER,
        tf,
        tt,
        selectedValues,
        {
          onProgress: (done, total) => {
            if (splitMode === "total") {
              const pct = total > 0 ? (done / total) * 100 : 100;
              setProgress(Math.min(100, Math.floor(pct)));
            } else {
              const pct = total > 0 ? (done / total) * 30 : 30;
              setProgress(Math.min(30, Math.floor(pct)));
            }
          },
          windowDays: 14,
          timeoutMs: 20000,
          pauseMs: 120,
        }
      );
      setCountsAllHosts(summary || {});

      if (splitMode === "total") {
        setProgressLabel("Готово");
        setTimeout(() => setProgress(0), 900);
        setDailyAllHosts([]);
        setMonthlyAllHosts([]);
        setLoading(false);
        return;
      }

      // 2) Разбивка
      if (splitMode === "daily") {
        setProgressLabel("Разбивка по дням…");
        const byDay = await api.getEventCountsAllByDay(
          TOKEN,
          ZABBIX_SERVER,
          tf,
          tt,
          selectedValues,
          {
            concurrency: 3,
            timeoutMs: 20000,
            pauseMs: 80,
            onProgress: (done, total) => {
              const pct = 30 + (total > 0 ? (done / total) * 70 : 70);
              setProgress(Math.min(100, Math.floor(pct)));
            },
          }
        );
        const rows = (byDay || []).map((d) => ({
          date: dayjs.unix(d.time_from).format("YYYY-MM-DD"),
          counts: d.counts || {},
        }));
        setDailyAllHosts(rows);
        setMonthlyAllHosts([]);
      } else if (splitMode === "monthly") {
        setProgressLabel("Разбивка по месяцам…");
        const byMonth = await api.getEventCountsAllByMonth(
          TOKEN,
          ZABBIX_SERVER,
          tf,
          tt,
          selectedValues,
          {
            concurrency: 2,
            timeoutMs: 20000,
            pauseMs: 120,
            onProgress: (done, total) => {
              const pct = 30 + (total > 0 ? (done / total) * 70 : 70);
              setProgress(Math.min(100, Math.floor(pct)));
            },
          }
        );
        const rows = (byMonth || []).map((m) => ({
          date: dayjs.unix(m.time_from).format("YYYY-MM"),
          counts: m.counts || {},
        }));
        setMonthlyAllHosts(dedupByPeriod(rows, selectedValues));
        setDailyAllHosts([]);
      }

      setProgressLabel("Готово");
      setTimeout(() => setProgress(0), 900);
    } catch (e) {
      setProgressLabel("Ошибка");
      setProgress(0);
      setCountsAllHosts({});
      setDailyAllHosts([]);
      setMonthlyAllHosts([]);
      console.log("handleAllHostsCounts error:", e);
    } finally {
      setLoading(false);
    }
  };

  // ===== Экспорт «все хосты» под выбранный режим =====
  const exportAllHostsSummary = () => {
    if (!selectedValues?.length) return;
    const [from, till] = dateRange || [];
    const fileName =
      from && till
        ? `severity_all_hosts_${dayjs(from).format("YYYYMMDD")}__${dayjs(
            till
          ).format("YYYYMMDD")}.xlsx`
        : "severity_all_hosts.xlsx";
    const periodText =
      from && till
        ? `${dayjs(from).format("YYYY-MM-DD HH:mm")} → ${dayjs(till).format(
            "YYYY-MM-DD HH:mm"
          )}`
        : "";

    exportToExcelSeverityOnly({
      selectedSeverities: selectedValues,
      countsBySeverity: countsAllHosts,
      fileName,
      periodText,
      modeLabel: "Итого",
    });
  };

  const exportAllHostsBreakdown = () => {
    if (!selectedValues?.length) return;
    const [from, till] = dateRange || [];
    const suffix = splitMode === "daily" ? "daily" : "monthly";
    const fileName =
      from && till
        ? `severity_all_hosts_${suffix}_${dayjs(from).format(
            "YYYYMMDD"
          )}__${dayjs(till).format("YYYYMMDD")}.xlsx`
        : `severity_all_hosts_${suffix}.xlsx`;
    const periodText =
      from && till
        ? `${dayjs(from).format("YYYY-MM-DD HH:mm")} → ${dayjs(till).format(
            "YYYY-MM-DD HH:mm"
          )}`
        : "";
    const modeLabel = splitMode === "monthly" ? "По месяцам" : "По дням";

    const rows =
      splitMode === "daily"
        ? dailyAllHosts
        : splitMode === "monthly"
        ? monthlyAllHosts
        : [];

    exportToExcelAllHostsDaily({
      severities: selectedValues,
      rows,
      fileName,
      periodText,
      modeLabel,
    });
  };

  // ===== Данные таблиц/графиков =====
  const makeColumns = () => [
    {
      title: splitMode === "monthly" ? "Месяц" : "Дата",
      dataIndex: "date",
      key: "date",
      fixed: "left",
    },
    ...selectedValues.map((sev) => ({
      title: (
        <span style={{ color: "#fff" }}>
          {SEVERITY_LABELS[String(sev)] || String(sev)}
        </span>
      ),
      dataIndex: String(sev),
      key: String(sev),
      align: "right",
      onHeaderCell: () => ({
        style: {
          background: SEVERITY_COLORS[String(sev)] || "#334155",
          color: "#fff",
        },
      }),
    })),
  ];

  const toTableData = (rows) =>
    rows.map((r, idx) => {
      const row = { key: idx, date: r.date };
      selectedValues.forEach((sev) => {
        row[String(sev)] = r.counts[String(sev)] || 0;
      });
      return row;
    });

  const dailyTableColumns = makeColumns();
  const monthlyTableColumns = makeColumns();

  const dailyTableData = toTableData(dailyAllHosts);
  const monthlyTableData = toTableData(monthlyAllHosts);

  const dailyChartData = dailyAllHosts.map((r) => {
    const point = { date: r.date };
    selectedValues.forEach(
      (sev) => (point[String(sev)] = r.counts[String(sev)] || 0)
    );
    return point;
  });

  const monthlyChartData = monthlyAllHosts.map((r) => {
    const point = { date: r.date };
    selectedValues.forEach(
      (sev) => (point[String(sev)] = r.counts[String(sev)] || 0)
    );
    return point;
  });

  // ===== Экспорт «по группам» (как было) =====
  const exportToExcelDefaultService = () => {
    if (!aggRows || aggRows.length === 0) return;
    exportToExcelDefault(aggRows);
  };

  const exportSeverityOnlyGroups = () => {
    if (!selectedValues || selectedValues.length === 0) return;
    const [from, till] = dateRange || [];
    const periodText =
      from && till
        ? `${dayjs(from).format("YYYY-MM-DD HH:mm")} → ${dayjs(till).format(
            "YYYY-MM-DD HH:mm"
          )}`
        : "";
    const counts = (alertsDataAll || []).reduce((acc, ev) => {
      const sev = String(ev?.severity ?? "");
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, {});
    exportToExcelSeverityOnly({
      selectedSeverities: selectedValues,
      countsBySeverity: counts,
      fileName: "severity_counters.xlsx",
      periodText,
      modeLabel: "Итого (по выбранным группам)",
    });
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
          Button: { borderRadius: 10 },
        },
      }}
    >
      {/* ВЕСЁЛЫЙ ОВЕРЛЕЙ С ПРОГРЕССОМ */}
      <FunnyLoadingOverlay
        visible={loading}
        progress={progress}
        label={progressLabel}
      />

      <Space direction="vertical" size="large" style={{ display: "flex", padding: 12 }}>
        {/* ====== ФИЛЬТРЫ ====== */}
        <Card size="small">
          <Flex align="center" gap={12} wrap>
            <Title level={4} style={{ margin: 0 }}>
              Фильтры
            </Title>
            <Divider type="vertical" />
            <RangePicker
              size="small"
              style={{ width: 360 }}
              value={dateRange}
              showTime={{ format: "HH:mm", minuteStep: 5 }}
              format="YYYY-MM-DD HH:mm"
              onChange={(value) => setDateRange(value)}
            />
            <Button size="small" onClick={setLastWeek}>
              Последняя неделя
            </Button>
            <Divider type="vertical" />
            <Select
              size="small"
              mode="multiple"
              style={{ minWidth: 280 }}
              value={selectedValues}
              onChange={setSelectedValues}
              placeholder="Уровни сработок"
              maxTagCount="responsive"
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
          </Flex>
        </Card>

        {/* ====== ДЕЙСТВИЯ ====== */}
        <Card size="small">
          <Title level={5} style={{ marginTop: 0 }}>
            Действия
          </Title>
          <Space wrap>
            <Button type="primary" onClick={HandleGetGroups}>
              Загрузить группы
            </Button>
            <Select
              placeholder="Выберите группу"
              mode="multiple"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
              allowClear
              style={{ minWidth: 280 }}
              value={selectedValueGroup}
              onChange={setSelectedValueGroup}
            >
              {groups?.map((item) => (
                <Option key={item.groupid} value={item.groupid} label={item.name}>
                  {item.name}
                </Option>
              ))}
            </Select>
            <Button
              onClick={HandleGetAlertsInLoop}
              disabled={(selectedValueGroup?.length ?? 0) === 0}
            >
              Выполнить запрос (по группам)
            </Button>

            <Divider type="vertical" style={{ borderColor: "#334155" }} />

            <Segmented
              value={splitMode}
              onChange={setSplitMode}
              options={[
                { label: "Итого", value: "total" },
                { label: "По дням", value: "daily" },
                { label: "По месяцам", value: "monthly" },
              ]}
            />

            <Button
              type="primary"
              onClick={handleAllHostsCounts}
              disabled={
                !(dateRange?.[0] && dateRange?.[1]) || (selectedValues?.length ?? 0) === 0
              }
            >
              Выполнить запрос (все хосты)
            </Button>
          </Space>
        </Card>

        {/* ====== РЕЗУЛЬТАТЫ: ВСЕ ХОСТЫ ====== */}
        <Card
          size="small"
          title={<Text strong>Результаты — все хосты</Text>}
          extra={
            <Space>
              <Button
                onClick={exportAllHostsSummary}
                disabled={(selectedValues?.length ?? 0) === 0}
                icon={<DownloadForOfflineIcon />}
              >
                Выгрузить (итого)
              </Button>

              <Button
                onClick={exportAllHostsBreakdown}
                disabled={
                  splitMode === "total" ||
                  (splitMode === "daily" && (dailyAllHosts?.length ?? 0) === 0) ||
                  (splitMode === "monthly" && (monthlyAllHosts?.length ?? 0) === 0)
                }
                icon={<DownloadForOfflineIcon />}
              >
                {splitMode === "daily"
                  ? "Выгрузить (по дням)"
                  : splitMode === "monthly"
                  ? "Выгрузить (по месяцам)"
                  : "Выгрузить"}
              </Button>
            </Space>
          }
        >
          {/* Сводка */}
          <Space wrap size="large" style={{ marginBottom: 12 }}>
            <Text>
              Период:{" "}
              <Text strong>
                {dateRange?.[0] && dateRange?.[1]
                  ? `${dayjs(dateRange[0]).format("YYYY-MM-DD HH:mm")} → ${dayjs(
                      dateRange[1]
                    ).format("YYYY-MM-DD HH:mm")}`
                  : "-"}
              </Text>
            </Text>
            <Text>
              Всего (сумма выбранных):{" "}
              <Text strong>
                {selectedValues.reduce(
                  (s, sev) => s + (countsAllHosts[String(sev)] || 0),
                  0
                )}
              </Text>
            </Text>
            <Text>
              По уровням:
              <Space size={6} style={{ marginLeft: 6 }}>
                {selectedValues.map((sev) => (
                  <span
                    key={sev}
                    style={{
                      display: "inline-block",
                      padding: "0 8px",
                      borderRadius: 10,
                      border: "1px solid #334155",
                      background: "rgba(255,255,255,0.02)",
                      color: "#fff",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: SEVERITY_COLORS[String(sev)],
                        marginRight: 6,
                        verticalAlign: "middle",
                      }}
                    />
                    {SEVERITY_LABELS[String(sev)] || sev}:{" "}
                    <b style={{ marginLeft: 4 }}>
                      {countsAllHosts[String(sev)] || 0}
                    </b>
                  </span>
                ))}
              </Space>
            </Text>
          </Space>

          {/* График */}
          {(splitMode === "daily" || splitMode === "monthly") && (
            <Card size="small" style={{ marginBottom: 12 }}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                График ({splitMode === "daily" ? "по дням" : "по месяцам"})
              </Text>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={splitMode === "daily" ? dailyChartData : monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {selectedValues.map((sev) => (
                      <Line
                        key={sev}
                        type="monotone"
                        dataKey={String(sev)}
                        name={SEVERITY_LABELS[String(sev)] || String(sev)}
                        stroke={SEVERITY_COLORS[String(sev)]}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Таблицы */}
          {splitMode === "daily" && (
            <Card size="small">
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                Разбивка по дням (все хосты)
              </Text>
              <Table
                size="small"
                pagination={{
                  pageSize: dailyPageSize,
                  showSizeChanger: true,
                  pageSizeOptions: ["7", "14", "30", "60", "90"],
                  onShowSizeChange: (_, size) => setDailyPageSize(size),
                }}
                columns={dailyTableColumns}
                dataSource={dailyTableData}
              />
            </Card>
          )}

          {splitMode === "monthly" && (
            <Card size="small">
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                Разбивка по месяцам (все хосты)
              </Text>
              <Table
                size="small"
                pagination={{
                  pageSize: monthlyPageSize,
                  showSizeChanger: true,
                  pageSizeOptions: ["6", "12", "24", "36", "60"],
                  onShowSizeChange: (_, size) => setMonthlyPageSize(size),
                }}
                columns={monthlyTableColumns}
                dataSource={monthlyTableData}
              />
            </Card>
          )}
        </Card>

        {/* ====== РЕЗУЛЬТАТЫ: ПО ГРУППАМ (как было) ====== */}
        <Card size="small" title={<Text strong>Результаты — по выбранным группам</Text>}>
          <Space
            wrap
            split={<Divider type="vertical" style={{ borderColor: "#334155" }} />}
            style={{ marginBottom: 12 }}
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
                <Text type="secondary" style={{ marginLeft: 6 }}>—</Text>
              )}
            </Text>

            {/* 🧮 Новое: по каждой выбранной группе — сколько в ней хостов */}
            <Text>
              Группы (хостов):
              {selectedGroupsInfo.length > 0 ? (
                <Space size={6} style={{ marginLeft: 6 }}>
                  {selectedGroupsInfo.map((g) => (
                    <span
                      key={g.id}
                      style={{
                        display: "inline-block",
                        padding: "0 8px",
                        borderRadius: 10,
                        border: "1px solid #334155",
                        background: "rgba(255,255,255,0.02)",
                      }}
                      title={`groupid: ${g.id}`}
                    >
                      {g.name}: <b style={{ marginLeft: 4 }}>{g.count}</b>
                    </span>
                  ))}
                </Space>
              ) : (
                <Text type="secondary" style={{ marginLeft: 6 }}>—</Text>
              )}
            </Text>
          </Space>

          <Space style={{ marginBottom: 12 }}>
            <Button
              onClick={exportToExcelDefaultService}
              disabled={(aggRows?.length ?? 0) === 0}
              icon={<DownloadForOfflineIcon />}
            >
              Export in Excel
            </Button>

            <Button
              onClick={exportSeverityOnlyGroups}
              disabled={
                (alertsDataAll?.length ?? 0) === 0 ||
                (selectedValues?.length ?? 0) === 0
              }
              icon={<DownloadForOfflineIcon />}
            >
              Выгрузить события (цифры)
            </Button>
          </Space>

          {(alertsDataAll?.length ?? 0) > 0 &&
            (selectedValues?.length ?? 0) > 0 && (
              <Card size="small" style={{ marginTop: 8, marginBottom: 8 }}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Сработки за период (по severity, выбранные группы)
                </Text>
                <SeverityCountersTable
                  alerts={alertsDataAll}
                  selectedSeverities={selectedValues}
                />
              </Card>
            )}

          {(aggRows?.length ?? 0) > 0 && (
            <Card size="small" style={{ marginTop: 8 }}>
              <TableEventForTemplates rows={aggRows} />
            </Card>
          )}
        </Card>
      </Space>
    </ConfigProvider>
  );
};

export default ReportLoop;
