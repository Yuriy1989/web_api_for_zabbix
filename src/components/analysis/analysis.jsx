import { useState, useEffect } from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx"; // Импортируем библиотеку для экспорта в Excel
import "dayjs/locale/ru";
import {
  Select,
  Space,
  Card,
  Button,
  Spin,
  Table,
  Tag,
  DatePicker,
} from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { api } from "../../utils/Api";
import "./analysis.css"; // Подключаем стили
import {
  ALERTS_FOR_ZABBIX,
  PASSWORD,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  URL_ZABBIX,
  USER_NAME,
  ZABBIX_SERVER,
} from "../../utils/constants";

const Analysis = () => {
  dayjs.locale("ru");
  const defaultSelectedValues = ALERTS_FOR_ZABBIX.map(
    (item) => Object.values(item)[0]
  );
  const { Option } = Select;
  const { RangePicker } = DatePicker;
  const [server, setServer] = useState(ZABBIX_SERVER);
  const [userName, setUserName] = useState(USER_NAME);
  const [password, setPassword] = useState(PASSWORD);
  const [services, setServices] = useState([]);
  const [token, setToken] = useState();
  const [dateDefaultForDatePicker, setDateDefaultForDatePicker] = useState(); // Выбранный промежуток времени
  const [alertsDataAll, setAlertsDataAll] = useState([]);
  const [hostsByServices, setHostsByServices] = useState([]);
  const [selectedValues, setSelectedValues] = useState(defaultSelectedValues);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]); // Выбранные сервисы
  const [formattedRange, setFormattedRange] = useState(null);

  // Используем useState для управления текущей страницей и размеров
  const [pagination, setPagination] = useState({ pageSize: 15, current: 1 });

  // Опции фильтрации уровней важности
  const severityFilters = Object.keys(SEVERITY_LABELS).map((key) => ({
    text: SEVERITY_LABELS[key],
    value: key,
  }));

  // Опции фильтрации сервисов
  const serviceFilters = [
    ...new Set(alertsDataAll.map((alert) => alert.serviceName)),
  ].map((service) => ({
    text: service,
    value: service,
  }));

  // Опции фильтрации hosts
  const hostsFilters = [
    ...new Set(alertsDataAll.map((alert) => alert.hosts[0].name)),
  ].map((hosts) => ({
    text: hosts,
    value: hosts,
  }));

  // Определяем колонки для таблицы "Детализация сработок"
  const columns = [
    {
      title: "Дата",
      dataIndex: "clock",
      key: "clock",
      sorter: (a, b) => a.clock - b.clock,
      render: (timestamp) => new Date(timestamp * 1000).toLocaleString(),
    },
    {
      title: "Сервис",
      dataIndex: "serviceName",
      key: "serviceName",
      filters: serviceFilters,
      onFilter: (value, record) => record.serviceName === value,
    },
    {
      title: "Host",
      dataIndex: "hosts",
      key: "hosts[0].name",
      filters: hostsFilters,
      onFilter: (value, record) => record.hosts[0].name === value,
      render: (hosts) => hosts[0].name, // Добавлен render, чтобы правильно вывести имя хоста
    },
    {
      title: "Уровень важности",
      dataIndex: "severity",
      key: "severity",
      filters: severityFilters,
      onFilter: (value, record) => record.severity === value,
      sorter: (a, b) => a.severity - b.severity,
      render: (severity) => {
        const label = SEVERITY_LABELS[severity];
        const color = SEVERITY_COLORS[label] || "default";
        return (
          <Tag color={color} style={{ fontSize: "12px" }}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: "Название алерта",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Ссылка на Zabbix",
      dataIndex: "eventid",
      key: "eventid",
      render: (_, record) => (
        <a
          href={`${URL_ZABBIX}/tr_events.php?triggerid=${record.objectid}&eventid=${record.eventid}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть
        </a>
      ),
    },
  ];

  const columns_2 = [
    {
      title: "Сервис",
      dataIndex: "serviceName",
      key: "serviceName",
    },
    {
      title: "Количество хостов",
      dataIndex: "count",
      key: "count",
    },
    {
      title: "Average",
      dataIndex: "Average",
      key: "Average",
      render: (value) => (
        <div
          style={{
            backgroundColor: SEVERITY_COLORS.Average,
            color: "white",
            textAlign: "center",
            borderRadius: 4,
          }}
        >
          {value}
        </div>
      ),
    },
    {
      title: "High",
      dataIndex: "High",
      key: "High",
      render: (value) => (
        <div
          style={{
            backgroundColor: SEVERITY_COLORS.High,
            color: "white",
            textAlign: "center",
            borderRadius: 4,
          }}
        >
          {value}
        </div>
      ),
    },
    {
      title: "Disaster",
      dataIndex: "Disaster",
      key: "Disaster",
      render: (value) => (
        <div
          style={{
            backgroundColor: SEVERITY_COLORS.Disaster,
            color: "white",
            textAlign: "center",
            borderRadius: 4,
          }}
        >
          {value}
        </div>
      ),
    },
  ];

  //Получение всех сервисов
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

  // Функция для преобразования Unix timestamp в читаемую дату
  const convertTimestampToDate = (timestamp) => {
    return dayjs.unix(timestamp).format("YYYY-MM-DD HH:mm:ss");
  };

  // Функция для экспорта данных в Excel (Детализация сработок)
  const exportToExcelAlerts = () => {
    // Преобразуем данные в читаемые даты
    const modifiedData = alertsDataAll.map((alert) => ({
      ...alert,
      clock: convertTimestampToDate(alert.clock), // Преобразуем время в дату
    }));

    const ws = XLSX.utils.json_to_sheet(modifiedData); // Для первой таблицы (детализация сработок)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alert Details");

    // Генерируем файл Excel и инициируем его скачивание
    XLSX.writeFile(wb, "alert_details.xlsx");
  };

  // Функция для экспорта данных в Excel (Сводная информация)
  const exportToExcelSummary = () => {
    const ws = XLSX.utils.json_to_sheet(tableData_3); // Для второй таблицы (сводная информация)
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alerts Summary");

    // Генерируем файл Excel и инициируем его скачивание
    XLSX.writeFile(wb, "alerts_summary.xlsx");
  };

  //Запрос на выгрузку все алертов за выбранный период
  const handleAlertMonth = async () => {
    if (selectedServices.length === 0) {
      alert("Пожалуйста, выберите сервис!");
      return;
    }
    setLoading(true);

    try {
      let allHostIds = [];
      let alertsDataAll = []; // Инициализируем массив для всех алертов
      let allHostsByServices = []; //кол-во хостов по сервисам

      //Преобразуем время в unix формат
      const selectedDatesUnixFormat = dateDefaultForDatePicker.map((date) =>
        Math.floor(new Date(date).getTime() / 1000)
      );

      // Запрос хостов для каждого сервиса
      for (const service of selectedServices) {
        const hosts = await api.getAllHostsByService(
          token,
          server,
          "service",
          service
        );

        allHostsByServices = [
          ...allHostsByServices,
          { [`${service}`]: hosts.result.length },
        ];
        setHostsByServices(allHostsByServices);

        //Если хосты по данному сервису есть, запрашиваем по ним алерты
        if (hosts?.result) {
          const hostIds = hosts.result.map((host) => host.hostid); //формируем id хостов

          const alertsData = await api.getEventTag(
            token,
            server,
            hostIds,
            selectedDatesUnixFormat[0],
            selectedDatesUnixFormat[1],
            selectedValues
          );

          allHostIds = [...allHostIds, ...hostIds]; // Собираем все хосты по всем сервисам

          // Добавляем serviceName в каждый объект алерта и объединяем в один массив
          const alertsWithService = alertsData.result.map((alert) => ({
            ...alert,
            serviceName: service,
          }));

          alertsDataAll = [...alertsDataAll, ...alertsWithService]; //Собираем все алерты по всем хостам и всем сервисам
        }
      }

      // Убираем дубликаты хостов (если сервисы могут пересекаться)
      allHostIds = [...new Set(allHostIds)];
      // console.log("Итоговый список ID хостов:", allHostIds);
      // console.log("Итоговый массив алертов:", alertsDataAll);
      setAlertsDataAll(alertsDataAll);
      const tempRangeDate = `от ${dayjs(dateDefaultForDatePicker[0]).format(
        "D MMMM YYYY"
      )} до ${dayjs(dateDefaultForDatePicker[1]).format("D MMMM YYYY")}`;
      setFormattedRange(tempRangeDate);
      setError(null);
      setLoading(false);
    } catch (error) {
      console.error("Ошибка при запросе данных:", error);
      setError("Ошибка при запросе данных.", error);
      setLoading(false);
    }
  };

  const groupServicesBySeverity = (data) => {
    const result = {};
    console.log("data", data);

    data.forEach((alert) => {
      const service = alert.serviceName || "unknown";
      const severityLabel = SEVERITY_LABELS[alert.severity];

      if (!severityLabel) return; // игнорировать неизвестные уровни

      if (!result[service]) {
        result[service] = { Average: 0, High: 0, Disaster: 0 };
      }

      result[service][severityLabel]++;
    });

    // console.log("result", result);
    return result;
  };

  const grouped = groupServicesBySeverity(alertsDataAll);
  // console.log("grouped", grouped);

  // Преобразуем массив с хостами в объект для более удобного поиска
  const hostsObject = hostsByServices.reduce((acc, item) => {
    const [key, value] = Object.entries(item)[0];
    acc[key] = value;
    return acc;
  }, {});

  const tableData = Object.entries(grouped).map(
    ([serviceName, severities]) => ({
      key: serviceName,
      serviceName,
      ...severities,
      count: hostsObject[serviceName], // Добавляем количество хостов для каждого сервиса
    })
  );
  // console.log("tableData", tableData);

  // Функция для группировки данных по serviceName и датам
  const processAlertsData = (alertsDataAll) => {
    if (!alertsDataAll.length) return [];

    const nameServices = [
      ...new Set(alertsDataAll.map((alert) => alert.serviceName)),
    ];

    const severityMap = {
      3: "Average",
      4: "High",
      5: "Disaster",
    };
    // Группируем данные по дате, сервису и уровню важности
    const alertsByServiceDateSeverity = {};

    alertsDataAll.forEach((alert) => {
      const date = new Date(parseInt(alert.clock) * 1000)
        .toISOString()
        .split("T")[0];
      const service = alert.serviceName;
      const severity = severityMap[alert.severity]; // Преобразуем числовой код в строку

      if (!severity) return; // Пропускаем, если уровень не входит в нужные

      if (!alertsByServiceDateSeverity[date]) {
        alertsByServiceDateSeverity[date] = {};
      }
      if (!alertsByServiceDateSeverity[date][service]) {
        alertsByServiceDateSeverity[date][service] = {
          Average: 0,
          High: 0,
          Disaster: 0,
        }; // Инициализация уровней
      }

      alertsByServiceDateSeverity[date][service][severity] += 1;
    });

    // Создаём массив данных для графика
    const chartData = Object.keys(alertsByServiceDateSeverity).map((date) => {
      const entry = { date };

      nameServices.forEach((service) => {
        const serviceData = alertsByServiceDateSeverity[date][service] || {};
        ["Average", "High", "Disaster"].forEach((severity) => {
          entry[`${service}_${severity}`] = serviceData[severity] || 0;
        });
      });

      return entry;
    });

    return { chartData, nameServices };
  };

  const { chartData, nameServices } = processAlertsData(alertsDataAll);

  // Пример данных для таблицы
  const columns_3 = [
    {
      title: "Название сработки",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Уровень важности",
      dataIndex: "severity",
      key: "severity",
      filters: severityFilters,
      onFilter: (value, record) => record.severity === value,
      sorter: (a, b) => a.severity - b.severity,
      render: (severity) => {
        const label = SEVERITY_LABELS[severity];
        const color = SEVERITY_COLORS[label] || "default";
        return (
          <Tag color={color} style={{ fontSize: "12px" }}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: "Количество сработок",
      dataIndex: "count",
      key: "count",
      sorter: (a, b) => a.count - b.count,
    },
  ];

  // Функция для группировки алертов по имени (name) и подсчета их количества
  const groupAlertsByName = (alertsData) => {
    const groupedAlerts = {};

    alertsData.forEach((alert) => {
      const alertName = alert.name;

      // Если уже есть такая группа для этого имени, увеличиваем счетчик
      if (groupedAlerts[alertName]) {
        groupedAlerts[alertName].count += 1;
      } else {
        // Если это первый раз, создаем новую запись
        groupedAlerts[alertName] = {
          name: alertName,
          count: 1,
          severity: alert.severity,
        };
      }
    });
    console.log("groupedAlerts", groupedAlerts);

    // Преобразуем объект в массив для удобства отображения в таблице
    return Object.values(groupedAlerts);
  };

  // Пример использования этой функции
  const groupedAlertData = groupAlertsByName(alertsDataAll); // alertsDataAll - это ваш массив с данными

  console.log("alertsDataAll", alertsDataAll);
  console.log("alertsDataAll.length", alertsDataAll.length);
  // Данные для таблицы (сгруппированные данные)
  const tableData_3 = groupedAlertData;

  useEffect(() => {
    const timeTill = Math.floor(Date.now() / 1000);
    const timeFrom = timeTill - 30 * 24 * 60 * 60;
    const tempDate = [dayjs.unix(timeFrom), dayjs.unix(timeTill)];
    setDateDefaultForDatePicker(tempDate);
  }, []);

  return (
    <>
      <Card
        title="Нажмите Загрузить, чтобы подгрузить сервисы из zabbix"
        size="small"
        style={{ margin: "10px" }}
      >
        <Select
          size="small"
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
          onChange={(value) => setSelectedServices(value)} // Устанавливаем выбранное значение
        >
          {services &&
            services.map((item, index) => (
              <Option key={index} value={`${item.value}`}>
                {item.value}
              </Option>
            ))}
        </Select>
        <Button size="small" type="primary" onClick={HandleGetServices}>
          Загрузить
        </Button>
        <RangePicker
          size="small"
          style={{
            width: "300px",
            marginLeft: "10px",
          }}
          value={dateDefaultForDatePicker}
          onChange={(value) => {
            setDateDefaultForDatePicker(value);
          }} // Устанавливаем выбранное значение
        />
        <Select
          size="small"
          placeholder="Выберите уровень сработки"
          mode="multiple"
          style={{
            width: "300px",
            marginLeft: "10px",
          }}
          value={selectedValues} // Управляемое значение
          onChange={setSelectedValues} // Устанавливаем выбранное значение
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
        <div style={{ marginTop: "10px" }}>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleAlertMonth}
            size="small"
          >
            Выполнить запрос
          </Button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      </Card>
      {loading && (
        <div className="loading-overlay">
          <Spin size="large" />
        </div>
      )}
      <>
        {alertsDataAll.length !== 0 && (
          <>
            <Space
              direction="vertical"
              size="middle"
              style={{
                display: "flex",
                margin: "10px",
              }}
            >
              <Card
                title={
                  formattedRange
                    ? `Аналитика по алертам за период: ${formattedRange}`
                    : ""
                }
                size="small"
              >
                <Table
                  columns={columns_2}
                  dataSource={tableData}
                  pagination={false}
                  size="small" // Уменьшенный стиль
                  style={{ fontSize: "12px" }} // Минималистичный дизайн
                />
              </Card>
            </Space>
            <Space
              direction="vertical"
              size="middle"
              style={{
                display: "flex",
                margin: "10px",
              }}
            >
              <Card title="Сводная информация по алертам" size="small">
                <Table
                  columns={columns_3}
                  dataSource={tableData_3}
                  pagination={false}
                  rowKey="name"
                  size="small" // Уменьшенный стиль
                  style={{ fontSize: "12px" }} // Минималистичный дизайн
                />
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={exportToExcelSummary} // Добавляем обработчик для экспорта
                  style={{ marginTop: "10px" }}
                >
                  Выгрузить в Excel
                </Button>
              </Card>
            </Space>
            <Space
              direction="vertical"
              size="middle"
              style={{ display: "flex", margin: "10px" }}
            >
              <Card
                title="Гистограмма количества алертов по сервисам"
                size="small"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {nameServices?.map((service) =>
                      ["Average", "High", "Disaster"].map((severity) => (
                        <Bar
                          key={`${service}_${severity}`}
                          dataKey={`${service}_${severity}`}
                          stackId={service}
                          fill={SEVERITY_COLORS[severity]}
                          name={`${service} (${severity})`}
                        />
                      ))
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              {/* Таблица с группировкой по сервису */}
              <Card
                title="Детализация сработок"
                size="small"
                style={{ fontSize: "12px" }}
              >
                <Table
                  columns={columns}
                  dataSource={alertsDataAll}
                  rowKey="eventid"
                  pagination={{
                    pageSize: pagination.pageSize,
                    current: pagination.current,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "15", "20", "50"],
                    onChange: (page, pageSize) =>
                      setPagination({ current: page, pageSize }),
                  }}
                  size="small" // Уменьшенный стиль
                  style={{ fontSize: "12px" }} // Минималистичный дизайн
                />
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={exportToExcelAlerts} // Добавляем обработчик для экспорта
                  style={{ marginTop: "10px" }}
                >
                  Выгрузить в Excel (Сводная информация)
                </Button>
              </Card>
            </Space>
          </>
        )}
      </>
    </>
  );
};

export default Analysis;
