import {
  theme,
  Typography,
  Space,
  Card,
  Button,
  Divider,
  ConfigProvider,
  Input,
  Form,
  Table,
  message,
  Checkbox,
  Modal,
  Tag,
  Progress,
} from "antd";
import { useState, useMemo } from "react";
import { api } from "../utils/Api";

const Macros = () => {
  const { Text } = Typography;

  const [loading, setLoading] = useState(false);           // загрузка предпросмотра
  const [applyLoading, setApplyLoading] = useState(false); // загрузка применения
  const [form] = Form.useForm();

  const [report, setReport] = useState([]);
  const [foundHosts, setFoundHosts] = useState(0);
  const [affected, setAffected] = useState(0);

  // прогресс применения
  const [progress, setProgress] = useState(0);
  const [progressMeta, setProgressMeta] = useState({ done: 0, total: 0, lastHost: "", lastAction: "" });

  // прогресс предпросмотра
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewMeta, setPreviewMeta] = useState({ done: 0, total: 0, lastHost: "" });

  // состояние предпросмотра
  const [planVisible, setPlanVisible] = useState(false);
  const [planItems, setPlanItems] = useState([]); // [{host, hostid, action, detail, hostmacroid?, key}]
  const [planStats, setPlanStats] = useState({
    toCreate: 0,
    toUpdate: 0,
    unchanged: 0,
    skipped: 0,
    notFound: 0,
  });
  const [lastValues, setLastValues] = useState(null); // значения формы для повторного использования

  const columns = [
    { title: "Хост", dataIndex: "host", key: "host", width: 240 },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (v) => {
        const map = {
          created: { color: "success", text: "created" },
          updated: { color: "processing", text: "updated" },
          unchanged: { color: "default", text: "unchanged" },
          skipped: { color: "warning", text: "skipped" },
          not_found: { color: "error", text: "not_found" },
        };
        const t = map[v] || { color: "default", text: v };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    { title: "Детали", dataIndex: "detail", key: "detail" },
  ];

  const planColumns = [
    { title: "Хост", dataIndex: "host", key: "host", width: 240 },
    {
      title: "Действие",
      dataIndex: "action",
      key: "action",
      width: 180,
      render: (v) => {
        const dict = {
          create: { color: "success", text: "создать" },
          update: { color: "processing", text: "обновить" },
          unchanged: { color: "default", text: "без изменений" },
          skip_no_trigger: { color: "warning", text: "пропустить (нет триггера)" },
          skip_no_macro: { color: "warning", text: "пропустить (макрос не в выраж.)" },
          not_found: { color: "error", text: "хост не найден" },
        };
        const t = dict[v] || { color: "default", text: v };
        return <Tag color={t.color}>{t.text}</Tag>;
      },
    },
    { title: "Описание", dataIndex: "detail", key: "detail" },
  ];

  const parseHosts = (text) =>
    (text || "")
      .split(/\r?\n|,|;/)
      .map((s) => s.trim())
      .filter(Boolean);

  // === утилиты работы с макросами/триггерами ===

  // корень семейства макроса: {$LOAD_AVG_PER_CPU.TIME} -> {$LOAD_AVG_PER_CPU}
  const macroFamilyRoot = (macroName) =>
    (macroName || "").replace(/:\s*".*?"(?=})/g, "").replace(/(\.[^}:}]+).*$/, "");

  // true, если в expr есть либо точный macroName (с контекстом), либо любой макрос того же "семейства"
  const macroInExpression = (expr = "", macroName = "") => {
    if (!expr || !macroName) return false;
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const exactBase = macroName.replace(/:\s*".*?"(?=})/g, "");
    const exactRe = new RegExp(`\\{${esc(exactBase)}(?:\\s*:\\s*".*?")?\\}`, "i");
    if (exactRe.test(expr)) return true;
    const familyRoot = exactBase.replace(/(\.[^}:}]+).*$/, "");
    const familyRe = new RegExp(`\\{${esc(familyRoot)}(?:[.:][^}"]+|:\\s*".*?")*\\}`, "i");
    return familyRe.test(expr);
  };

  // кеши
  const templateMacroCache = new Map(); // key:`${templateid}|${familyRoot}` -> boolean
  const triggerCache = new Map();       // triggerid -> trigger

  const templateHasMacroFamily = async (server, auth, templateid, familyRoot) => {
    const key = `${templateid}|${familyRoot}`;
    if (templateMacroCache.has(key)) return templateMacroCache.get(key);

    const macros = await api.rpc({
      server,
      auth,
      method: "usermacro.get",
      params: { hostids: [templateid], output: ["macro"] },
    });

    const has = (macros || []).some((m) => {
      const name = (m.macro || "").replace(/:\s*".*?"(?=})/g, "");
      return name === familyRoot || name.startsWith(familyRoot.replace(/\}$/, ""));
    });

    templateMacroCache.set(key, !!has);
    return !!has;
  };

  const getTriggerById = async (server, auth, triggerid) => {
    if (!triggerid) return null;
    if (triggerCache.has(triggerid)) return triggerCache.get(triggerid);
    const res = await api.rpc({
      server,
      auth,
      method: "trigger.get",
      params: {
        triggerids: [triggerid],
        output: ["triggerid", "templateid", "description", "expression", "recovery_expression"],
      },
    });
    const trg = Array.isArray(res) && res[0] ? res[0] : null;
    triggerCache.set(triggerid, trg);
    return trg;
  };

  const macroInTriggerOrParents = async (server, auth, trigger, macroName, alsoCheckRecovery = true) => {
    let cur = trigger;
    while (cur) {
      const expr = cur.expression || "";
      const rexpr = cur.recovery_expression || "";
      if (macroInExpression(expr, macroName) || (alsoCheckRecovery && macroInExpression(rexpr, macroName))) {
        return true;
      }
      if (!cur.templateid || cur.templateid === "0") break;
      cur = await getTriggerById(server, auth, cur.templateid);
    }
    return false;
  };

  const makePlanKey = ({ hostid, host, action, hostmacroid }) =>
    `${hostid || "nf"}|${host}|${action}|${hostmacroid || ""}`;

  // ----- ШАГ 1: построение плана (с прогрессом предпросмотра) -----
  const buildPlan = async (
    {
      server,
      userName,
      password,
      hostNames,
      macroName,
      macroValue,
      triggerDescription,
      mustExistInExpression = true,
      alsoCheckRecovery = true,
    },
    onProgress
  ) => {
    const auth = await api.login({ server, userName, password });
    const total = hostNames.length || 0;
    let done = 0;

    // Хосты по technical name (host)
    const hosts = await api.rpc({
      server,
      auth,
      method: "host.get",
      params: {
        output: ["hostid", "host", "name"],
        filter: { host: hostNames },
        selectParentTemplates: ["templateid", "name"],
      },
    });

    const parentTplMap = new Map(hosts.map((h) => [h.hostid, h.parentTemplates || []]));
    const hostMap = new Map(hosts.map((h) => [h.host, h.hostid]));
    setFoundHosts(hosts.length);

    const items = [];
    let toCreate = 0,
      toUpdate = 0,
      unchanged = 0,
      skipped = 0,
      notFound = 0;

    for (const requestedName of hostNames) {
      const hostid = hostMap.get(requestedName);
      if (!hostid) {
        items.push({
          host: requestedName,
          action: "not_found",
          detail: "Хост не найден",
          key: makePlanKey({ host: requestedName, action: "not_found" }),
        });
        notFound += 1;
        done += 1;
        onProgress?.(done, total, requestedName);
        continue;
      }

      // Триггеры по description
      const triggers = await api.rpc({
        server,
        auth,
        method: "trigger.get",
        params: {
          hostids: [hostid],
          output: [
            "triggerid",
            "description",
            "expression",
            "recovery_expression",
            "status",
            "priority",
            "templateid",
          ],
          filter: { description: triggerDescription },
        },
      });

      if (!triggers || triggers.length === 0) {
        items.push({
          host: requestedName,
          hostid,
          action: "skip_no_trigger",
          detail: `Триггер '${triggerDescription}' не найден`,
          key: makePlanKey({ hostid, host: requestedName, action: "skip_no_trigger" }),
        });
        skipped += 1;
        done += 1;
        onProgress?.(done, total, requestedName);
        continue;
      }

      // Проверяем, что макрос действительно используется в выражении(ях)
      if (mustExistInExpression) {
        const familyRoot = macroFamilyRoot(macroName);

        // 1) проверка по триггерам и их родителям
        let hasMacro = false;
        for (const tr of triggers) {
          if (await macroInTriggerOrParents(server, auth, tr, macroName, alsoCheckRecovery)) {
            hasMacro = true;
            break;
          }
        }

        // 2) фолбэк: макросы в шаблонах
        if (!hasMacro) {
          const templates = parentTplMap.get(hostid) || [];
          for (const tpl of templates) {
            if (await templateHasMacroFamily(server, auth, tpl.templateid, familyRoot)) {
              hasMacro = true;
              break;
            }
          }
        }

        if (!hasMacro) {
          items.push({
            host: requestedName,
            hostid,
            action: "skip_no_macro",
            detail: `Макрос ${macroName} (семейство ${familyRoot}) не найден ни в выражениях триггеров/родителей, ни среди макросов шаблонов`,
            key: makePlanKey({ hostid, host: requestedName, action: "skip_no_macro" }),
          });
          skipped += 1;
          done += 1;
          onProgress?.(done, total, requestedName);
          continue;
        }
      }

      // Текущие макросы на хосте
      const macros = await api.rpc({
        server,
        auth,
        method: "usermacro.get",
        params: { hostids: [hostid], output: ["hostmacroid", "macro", "value"] },
      });

      const existing = macros.find((m) => m.macro === macroName);

      if (existing) {
        if (String(existing.value) !== String(macroValue)) {
          items.push({
            host: requestedName,
            hostid,
            action: "update",
            detail: `Обновить ${macroName}: '${existing.value}' → '${macroValue}'`,
            hostmacroid: existing.hostmacroid,
            key: makePlanKey({ hostid, host: requestedName, action: "update", hostmacroid: existing.hostmacroid }),
          });
          toUpdate += 1;
        } else {
          items.push({
            host: requestedName,
            hostid,
            action: "unchanged",
            detail: `Без изменений (${macroName}=${macroValue})`,
            hostmacroid: existing.hostmacroid,
            key: makePlanKey({ hostid, host: requestedName, action: "unchanged", hostmacroid: existing.hostmacroid }),
          });
          unchanged += 1;
        }
      } else {
        items.push({
          host: requestedName,
          hostid,
          action: "create",
          detail: `Создать ${macroName}='${macroValue}'`,
          key: makePlanKey({ hostid, host: requestedName, action: "create" }),
        });
        toCreate += 1;
      }

      // прогресс по хостам
      done += 1;
      onProgress?.(done, total, requestedName);
    }

    setPlanItems(items);
    setPlanStats({ toCreate, toUpdate, unchanged, skipped, notFound });
    return items;
  };

  // ----- ШАГ 2: применение плана (с прогрессом) -----
  const applyPlan = async (values, items, onProgress) => {
    const { server, username: userName, password, macroName, macroValue } = values;
    const auth = await api.login({ server, userName, password });

    const results = [];
    let changed = 0;

    const makeReportKey = ({ hostid, host, status }) => `${hostid || "nf"}|${host}|${status}`;

    const total = items.length || 0;
    let done = 0;
    if (total === 0) {
      onProgress?.(1, 1, "", "");
      setAffected(0);
      setReport([]);
      return [];
    }

    for (const it of items) {
      if (it.action === "create") {
        try {
          await api.rpc({
            server,
            auth,
            method: "usermacro.create",
            params: { hostid: it.hostid, macro: macroName.trim(), value: String(macroValue).trim() },
          });
          results.push({
            host: it.host,
            status: "created",
            detail: `Добавлен ${macroName}=${macroValue}`,
            key: makeReportKey({ hostid: it.hostid, host: it.host, status: "created" }),
          });
          changed += 1;
        } catch (e) {
          results.push({
            host: it.host,
            status: "skipped",
            detail: `Ошибка создания: ${e?.message || e}`,
            key: makeReportKey({ hostid: it.hostid, host: it.host, status: "skipped" }),
          });
        }
      } else if (it.action === "update") {
        try {
          await api.rpc({
            server,
            auth,
            method: "usermacro.update",
            params: { hostmacroid: it.hostmacroid, value: String(macroValue).trim() },
          });
          results.push({
            host: it.host,
            status: "updated",
            detail: `Обновлён ${macroName}=${macroValue}`,
            key: makeReportKey({ hostid: it.hostid, host: it.host, status: "updated" }),
          });
          changed += 1;
        } catch (e) {
          results.push({
            host: it.host,
            status: "skipped",
            detail: `Ошибка обновления: ${e?.message || e}`,
            key: makeReportKey({ hostid: it.hostid, host: it.host, status: "skipped" }),
          });
        }
      } else if (it.action === "unchanged") {
        results.push({
          host: it.host,
          status: "unchanged",
          detail: it.detail,
          key: makeReportKey({ hostid: it.hostid, host: it.host, status: "unchanged" }),
        });
      } else if (it.action === "skip_no_trigger" || it.action === "skip_no_macro") {
        results.push({
          host: it.host,
          status: "skipped",
          detail: it.detail,
          key: makeReportKey({ hostid: it.hostid, host: it.host, status: "skipped" }),
        });
      } else if (it.action === "not_found") {
        results.push({
          host: it.host,
          status: "not_found",
          detail: it.detail,
          key: makeReportKey({ hostid: it.hostid, host: it.host, status: "not_found" }),
        });
      } else {
        results.push({
          host: it.host,
          status: "skipped",
          detail: "Неизвестное действие",
          key: makeReportKey({ hostid: it.hostid, host: it.host, status: "skipped" }),
        });
      }

      done += 1;
      onProgress?.(done, total, it.host, it.action);
    }

    setAffected(changed);
    setReport(results);
    return results;
  };

  // Кнопка «Предпросмотр изменений»
  const HandlePreview = async () => {
    try {
      const values = await form.validateFields();
      const hostNames = parseHosts(values.hostsRaw);
      if (hostNames.length === 0) {
        message.warning("Добавьте хотя бы один хост");
        return;
      }

      setLoading(true);
      setPreviewProgress(0);
      setPreviewMeta({ done: 0, total: hostNames.length, lastHost: "" });

      setReport([]);
      setAffected(0);
      setLastValues(values);

      await buildPlan(
        {
          server: values.server.trim(),
          userName: values.username.trim(),
          password: values.password,
          hostNames,
          macroName: values.macroName.trim(),
          macroValue: values.macroValue.trim(),
          triggerDescription: values.triggerName.trim(),
          mustExistInExpression: values.mustExistInExpression,
          alsoCheckRecovery: values.alsoCheckRecovery,
        },
        (done, total, lastHost) => {
          const pct = total ? Math.round((done / total) * 100) : 100;
          setPreviewProgress(pct);
          setPreviewMeta({ done, total, lastHost });
        }
      );

      setPlanVisible(true);
    } catch (e) {
      if (e?.errorFields) return; // ошибки валидации
      console.error(e);
      message.error(e?.message || "Ошибка предпросмотра");
    } finally {
      setLoading(false);
    }
  };

  // Кнопка «Запустить скрипт» в модалке
  const HandleApply = async () => {
    if (!lastValues) return;
    const actionable = planItems.filter(
      (it) =>
        it.action === "create" ||
        it.action === "update" ||
        it.action === "unchanged" ||
        it.action.startsWith("skip_") ||
        it.action === "not_found"
    );

    // сброс прогресса
    setProgress(0);
    setProgressMeta({ done: 0, total: actionable.length, lastHost: "", lastAction: "" });

    setApplyLoading(true);
    try {
      await applyPlan(lastValues, actionable, (done, total, lastHost, lastAction) => {
        const pct = total ? Math.round((done / total) * 100) : 100;
        setProgress(pct);
        setProgressMeta({ done, total, lastHost, lastAction });
      });
      setPlanVisible(false);
      message.success("Скрипт выполнен");
    } catch (e) {
      console.error(e);
      message.error(e?.message || "Ошибка выполнения скрипта");
    } finally {
      setApplyLoading(false);
    }
  };

  const planHeader = useMemo(() => {
    const { toCreate, toUpdate, unchanged, skipped, notFound } = planStats;
    return (
      <Space wrap split={<Divider type="vertical" style={{ borderColor: "#334155" }} />}>
        <span>Будет создано: <Text strong>{toCreate}</Text></span>
        <span>Будет обновлено: <Text strong>{toUpdate}</Text></span>
        <span>Без изменений: <Text strong>{unchanged}</Text></span>
        <span>Пропущено: <Text strong>{skipped}</Text></span>
        <span>Хостов не найдено: <Text strong>{notFound}</Text></span>
      </Space>
    );
  }, [planStats]);

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
          Table: { headerBg: "#0f172a", headerSplitColor: "#1e293b", borderColor: "#1e293b" },
          Tag: { defaultColor: "#1f2937" },
        },
      }}
    >
      {(loading || applyLoading) && (
        <div className="loading-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {applyLoading ? (
            <div style={{ padding: 16, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, minWidth: 260, textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
              <Progress type="circle" percent={progress} />
              <div style={{ marginTop: 10 }}>
                <Text style={{ color: "#cbd5e1" }}>
                  Выполнено: <b>{progressMeta.done}</b> из <b>{progressMeta.total}</b>
                </Text>
              </div>
              {progressMeta.lastHost && (
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Текущий хост: {progressMeta.lastHost}</Text>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 16, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, minWidth: 420, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
              <Text style={{ color: "#e5e7eb", display: "block", marginBottom: 8 }}>Формирую план изменений…</Text>
              <Progress percent={previewProgress} status="active" />
              <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                <Text style={{ color: "#cbd5e1" }}>
                  Обработано: <b>{previewMeta.done}</b> из <b>{previewMeta.total}</b>
                </Text>
                {previewMeta.lastHost && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Текущий хост: {previewMeta.lastHost}
                  </Text>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Space direction="vertical" size="middle" style={{ display: "flex", padding: 12 }}>
        <Card
          title={<Text strong style={{ fontSize: 16 }}>Выберите Hosts по которым будете изменять макросы</Text>}
          size="small"
          styles={{ body: { paddingTop: 12, paddingBottom: 12 } }}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              triggerName: "Load average is too high",
              macroName: "{$LOAD_AVG_PER_CPU.TIME}",
              macroValue: "15",
              mustExistInExpression: true,
              alsoCheckRecovery: true,
            }}
          >
            <Form.Item
              label="Zabbix JSON-RPC URL"
              name="server"
              rules={[{ required: true, message: "Укажите адрес API, например https://zabbix.example.com/api_jsonrpc.php" }]}
            >
              <Input placeholder="https://zabbix.example.com/api_jsonrpc.php" />
            </Form.Item>

            <Space.Compact block style={{ gap: 12 }}>
              <Form.Item label="Логин" name="username" style={{ flex: 1 }} rules={[{ required: true, message: "Укажите логин" }]}>
                <Input placeholder="Admin" />
              </Form.Item>
              <Form.Item label="Пароль" name="password" style={{ flex: 1 }} rules={[{ required: true, message: "Укажите пароль" }]}>
                <Input.Password placeholder="••••••••" />
              </Form.Item>
            </Space.Compact>

            <Form.Item
              label="Перечень хостов (по одному в строке, либо через запятую/точку с запятой)"
              name="hostsRaw"
              rules={[{ required: true, message: "Укажите хосты" }]}
            >
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder={`dc1-k8s-airbyte01\ndc1-k8s-dev-jaeger01, dc1-k8s-dev-linkerd01`} />
            </Form.Item>

            <Form.Item
              label="Название триггера (description)"
              name="triggerName"
              tooltip="Точное имя триггера в Zabbix (поле description)"
              rules={[{ required: true, message: "Укажите имя триггера" }]}
            >
              <Input placeholder="Load average is too high" />
            </Form.Item>

            <Space.Compact block style={{ gap: 12 }}>
              <Form.Item label="Имя макроса" name="macroName" style={{ flex: 1 }} rules={[{ required: true, message: "Укажите имя макроса" }]}>
                <Input placeholder="{$LOAD_AVG_PER_CPU.TIME}" />
              </Form.Item>
              <Form.Item label="Значение макроса" name="macroValue" style={{ flex: 1 }} rules={[{ required: true, message: "Укажите значение макроса" }]}>
                <Input placeholder="15" />
              </Form.Item>
            </Space.Compact>

            <Space.Compact block style={{ gap: 12, marginTop: 8 }}>
              <Form.Item name="mustExistInExpression" valuePropName="checked">
                <Checkbox>Добавлять, только если макрос есть в выражении</Checkbox>
              </Form.Item>
              <Form.Item name="alsoCheckRecovery" valuePropName="checked">
                <Checkbox>Проверять recovery expression</Checkbox>
              </Form.Item>
            </Space.Compact>

            <Space style={{ marginTop: 8 }}>
              <Button type="primary" onClick={HandlePreview}>Предпросмотр изменений</Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setReport([]);
                  setFoundHosts(0);
                  setAffected(0);
                }}
              >
                Сбросить
              </Button>
            </Space>
          </Form>
        </Card>

        {/* Инфо-панель */}
        <Card size="small">
          <Space wrap split={<Divider type="vertical" style={{ borderColor: "#334155" }} />}>
            <Text>Хостов найдено: <Text strong>{foundHosts}</Text></Text>
            <Text>Изменений (создано/обновлено): <Text strong>{affected}</Text></Text>
            <Text>Всего записей в отчёте: <Text strong>{report.length}</Text></Text>
          </Space>
        </Card>

        <main className="main">
          <Table
            size="small"
            rowKey="key"
            dataSource={report}
            columns={columns}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
          />
        </main>
      </Space>

      {/* Модалка предпросмотра */}
      <Modal
        title="Предпросмотр изменений"
        open={planVisible}
        onCancel={() => setPlanVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setPlanVisible(false)}>Отмена</Button>,
          <Button key="run" type="primary" loading={applyLoading} onClick={HandleApply}>Запустить скрипт</Button>,
        ]}
        width={900}
      >
        <div style={{ marginBottom: 12 }}>{planHeader}</div>
        <Table
          size="small"
          rowKey="key"
          dataSource={planItems}
          columns={planColumns}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
        />
        <div style={{ marginTop: 8, opacity: 0.9 }}>
          <Text type="secondary">
            Скрипт изменит только те хосты, для которых действие: <b>создать</b> или <b>обновить</b>. Остальные будут пропущены.
          </Text>
        </div>
      </Modal>
    </ConfigProvider>
  );
};

export default Macros;
