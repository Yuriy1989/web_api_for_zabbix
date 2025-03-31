import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import 'dayjs/locale/ru'
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
import { ALERTS_FOR_ZABBIX, PASSWORD, SEVERITY_COLORS, SEVERITY_LABELS, URL_ZABBIX, USER_NAME, ZABBIX_SERVER } from "../../utils/constants";


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

  //Запрос на выгрузку все алертов за выбранный период
  const handleAlertMonth = async () => {
    if (selectedServices.length === 0) {
      alert("Пожалуйста, выберите сервис.");
      return;
    }
    setLoading(true);

    try {
      let allHostIds = [];
      let alertsDataAll = []; // Инициализируем массив для всех алертов

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

        console.log(
          "По сервису",
          service,
          "найдено",
          hosts.result.length,
          "hosts из них",
          hosts.result
        );

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

      console.log("Итоговый список ID хостов:", allHostIds);
      console.log("Итоговый массив алертов:", alertsDataAll);
      setAlertsDataAll(alertsDataAll);
      const tempRangeDate = `от ${dayjs(dateDefaultForDatePicker[0]).format("D MMMM YYYY")} до ${dayjs(dateDefaultForDatePicker[1]).format("D MMMM YYYY")}`;
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

    data.forEach((alert) => {
      const service = alert.serviceName || "unknown";
      const severityLabel = SEVERITY_LABELS[alert.severity];

      if (!severityLabel) return; // игнорировать неизвестные уровни

      if (!result[service]) {
        result[service] = { Average: 0, High: 0, Disaster: 0 };
      }

      result[service][severityLabel]++;
    });

    return result;
  };

  const grouped = groupServicesBySeverity(alertsDataAll);

  const tableData = Object.entries(grouped).map(
    ([serviceName, severities]) => ({
      key: serviceName,
      serviceName,
      ...severities,
    })
  );

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
      </Card>
      <Space
        direction="vertical"
        size="middle"
        style={{
          display: "flex",
        }}
      >
        <Card title={formattedRange ? `Аналитика по алертам за период: ${formattedRange}`: ""} size="small">
          {loading && (
            <div className="loading-overlay">
              <Spin size="large" />
            </div>
          )}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleAlertMonth}
            size="small"
          >
            Выполнить запрос
          </Button>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <Table columns={columns_2} dataSource={tableData} pagination={false} />
        </Card>
      </Space>

      <Space direction="vertical" size="middle" style={{ display: "flex" }}>
        <Card title="Гистограмма количества алертов по сервисам" size="small">
          {loading && (
            <div className="loading-overlay">
              <Spin size="large" />
            </div>
          )}
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
        </Card>
      </Space>
    </>
  );
};

export default Analysis;
