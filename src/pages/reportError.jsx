// reportError.jsx
import { useMemo, useState } from "react";
import { ConfigProvider, theme, Space, Button, Card, Spin, Checkbox, Typography, Divider } from "antd";
import DownloadForOfflineIcon from "@mui/icons-material/DownloadForOffline";
import { api } from "../utils/Api";
import DublicateIPAntd from "../components/table/DublicateIP";
import exportToExcelDefault from "../utils/exportToExcelDublicateIP";
import { PASSWORD, USER_NAME, ZABBIX_SERVER } from "../utils/constants";
import "./reportError.css";

// --- утилита взять значение тега service
const getTagValue = (host, tagName) =>
  (host?.tags || []).find((t) => t?.tag === tagName)?.value ?? null;

// --- поиск дублей по IP (возвращает массив групп)
const findDuplicateIps = (hostsPayload) => {
  const list = Array.isArray(hostsPayload) ? hostsPayload : hostsPayload?.result || [];
  const ipMap = new Map();

  for (const host of list) {
    const entry = {
      hostid: host?.hostid,
      name: host?.name,
      status: host?.status ?? null,
      service: getTagValue(host, "service"),
    };
    const ifaces = host?.interfaces || [];
    for (const intf of ifaces) {
      const ip = intf?.ip;
      if (!ip) continue;
      if (!ipMap.has(ip)) ipMap.set(ip, []);
      ipMap.get(ip).push(entry);
    }
  }

  return [...ipMap.entries()]
    .filter(([, arr]) => (arr?.length ?? 0) > 1)
    .map(([ip, hosts]) => ({ ip, hosts }));
};

// --- для экспорта — плоский список
const flattenDuplicateIps = (groups = []) =>
  (Array.isArray(groups) ? groups : []).flatMap((g) =>
    (g?.hosts || []).map((h) => ({
      ip: g?.ip ?? "",
      hostid: h?.hostid ?? "",
      name: h?.name ?? "",
      status: h?.status ?? "",
      service: h?.service ?? "",
    }))
  );

// --- распознать IP-макрос {#SOMETHING}
const isMacroIp = (ip) => {
  if (!ip || typeof ip !== "string") return false;
  return /^\s*\{#?[A-Za-z0-9_]+\}\s*$/.test(ip);
};

const { Text } = Typography;

const ReportError = () => {
  const [loading, setLoading] = useState(false);
  const [hosts, setHosts] = useState([]);
  const [duplicateIps, setDuplicateIps] = useState([]);

  const [hideSameHost, setHideSameHost] = useState(false);
  const [hideMacroIps, setHideMacroIps] = useState(false);

  const filteredDuplicateIps = useMemo(() => {
    let data = duplicateIps || [];
    if (hideSameHost) {
      data = data.filter((g) => {
        const ids = new Set((g?.hosts || []).map((h) => String(h?.hostid ?? "")));
        return ids.size > 1;
      });
    }
    if (hideMacroIps) data = data.filter((g) => !isMacroIp(g?.ip));
    return data;
  }, [duplicateIps, hideSameHost, hideMacroIps]);

  const HandleGetDoubleIpHosts = async () => {
    setLoading(true);
    try {
      const auth = { userName: USER_NAME, password: PASSWORD, server: ZABBIX_SERVER };
      const token = await api.getApi(auth);
      const hostsPayload = await api.getAllHosts(token?.result, ZABBIX_SERVER);
      const list = hostsPayload?.result || [];
      setHosts(list);
      setDuplicateIps(findDuplicateIps(hostsPayload));
    } catch (error) {
      console.log("Ошибка в запросе", error);
      setHosts([]);
      setDuplicateIps([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcelDefaultService = () => {
    const rows = flattenDuplicateIps(filteredDuplicateIps);
    if (rows.length === 0) return;
    exportToExcelDefault(rows);
  };

  const totalHosts = hosts?.length ?? 0;
  const totalDupGroups = duplicateIps?.length ?? 0;
  const totalDupGroupsShown = filteredDuplicateIps?.length ?? 0;

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#7c3aed",     // фиолетовый акцент
          colorInfo: "#7c3aed",
          colorBgBase: "#0b1221",      // общий фон
          colorBgContainer: "#111a2c", // фон карточек/таблиц
          colorBorder: "#1e293b",
          borderRadius: 12,
          fontSize: 13,
        },
        components: {
          Card: { headerBg: "#0f172a", colorBorderSecondary: "#1e293b" },
          Table: { headerBg: "#0f172a", headerSplitColor: "#1e293b", borderColor: "#1e293b" },
          Tag: { defaultColor: "#1f2937" },
        },
      }}
    >
      {loading && (
        <div className="loading-overlay">
          <Spin size="large" />
        </div>
      )}

      <Space direction="vertical" size="middle" style={{ display: "flex", padding: 12 }}>
        <Card
          title={<Text strong style={{ fontSize: 16 }}>Проверка задублирование IP адресов</Text>}
          size="small"
          bordered
          styles={{ body: { paddingTop: 12, paddingBottom: 12 } }}
        >
          <Space wrap>
            <Button type="primary" onClick={HandleGetDoubleIpHosts}>
              Загрузить
            </Button>

            <Checkbox
              checked={hideSameHost}
              onChange={(e) => setHideSameHost(e.target.checked)}
            >
              Скрывать дубли внутри одного хоста
            </Checkbox>

            <Checkbox
              checked={hideMacroIps}
              onChange={(e) => setHideMacroIps(e.target.checked)}
            >
              Скрывать IP-макросы вида {'{#...}'}
            </Checkbox>
          </Space>
        </Card>

        <Card size="small">
          <Space split={<Divider type="vertical" style={{ borderColor: "#334155" }} />}>
            <Text>Всего хостов: <Text strong>{totalHosts}</Text></Text>
            <Text>Групп с задублированными IP: <Text strong>{totalDupGroups}</Text></Text>
            {(hideSameHost || hideMacroIps) && (
              <Text>Показано: <Text strong>{totalDupGroupsShown}</Text></Text>
            )}
          </Space>
        </Card>

        <Card
          size="small"
          styles={{ body: { paddingTop: 10, paddingBottom: 10 } }}
        >
          <Button
            onClick={exportToExcelDefaultService}
            disabled={(filteredDuplicateIps?.length ?? 0) === 0}
            icon={<DownloadForOfflineIcon />}
          >
            Export in Excel
          </Button>
        </Card>

        <main className="main">
          {(filteredDuplicateIps?.length ?? 0) > 0 && (
            <div className="table">
              <DublicateIPAntd dataZabbix={filteredDuplicateIps} />
            </div>
          )}
        </main>
      </Space>
    </ConfigProvider>
  );
};

export default ReportError;
