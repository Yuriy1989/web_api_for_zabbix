import { useState } from "react";
import { Select, Space, Button, Card, Spin } from "antd";

import { api } from "../utils/Api";
import TableData from "../components/table/Table";
import exportToExcelDefault from "../utils/exportToExcel";
import exportToExcelHosts from "../utils/exportToExcelHosts";
import TableDataHosts from "../components/table/TableHosts";
import { PASSWORD, USER_NAME, ZABBIX_SERVER } from "../utils/constants";
import "./reportsTemplates.css"; // Подключаем стили

const ReportsTemplates = () => {
  const { Option } = Select;

  const [dataZabbix, setDataZabbix] = useState();
  const [server, setServer] = useState(ZABBIX_SERVER);
  const [userName, setUserName] = useState(USER_NAME);
  const [password, setPassword] = useState(PASSWORD);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState();

  const exportToExcelDefaultService = () => {
    if (dataZabbix) {
      exportToExcelDefault(dataZabbix);
    }
  };

  const HandleGetTemplates = async () => {
    setLoading(true);

    try {

      const data = {
        userName: userName,
        password: password,
        server: server,
      };

      const tempToken = await api.getApi(data);
      setToken(tempToken.result);

      const templates = await api.getTemplates(tempToken.result, server);
      console.log("templates", templates);
      setTemplates(templates.result);

    } catch (error) {
      console.log("Ошибка в запросе", error);
    } finally {
      setLoading(false);
    }
  };

  const HandleGetTriggers = async () => {
    setLoading(true);

    try {
        const hostsResponse = await api.getAllHostsByTemplates(token, server, selectedTemplate);
        const hosts = hostsResponse?.result || []; // Безопасное извлечение списка хостов

        if (hosts.length === 0) {
            console.log("Хосты не найдены для данного шаблона");
            return;
        }

        const hostIds = hosts.map(host => host.hostid); // Получаем список hostid
        const triggersResponse = await api.getTriggers(token, server, hostIds);
        const triggers = triggersResponse?.result || [];

        setDataZabbix(triggers);
    } catch (error) {
      console.log("Ошибка запроса", error)
    } finally {
      setLoading(false);
    }
  }

  return (
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
          title="Нажмите Загрузить, чтобы подгрузить шаблоны из zabbix"
          size="small"
        >
          <Select
            placeholder="Выберите шаблон"
            mode="multiple"
            showSearch // Включаем поиск
            filterOption={(input, option) =>
              option.children.toLowerCase().includes(input.toLowerCase())
            } // Фильтрация по введенному значению
            allowClear
            style={{
              width: "300px",
            }}
            onChange={(value) => setSelectedTemplate(value)} // Устанавливаем выбранное значение
          >
            {templates &&
              templates.map((item) => (
                <Option key={item.templateid} value={`${item?.templateid}`}>{item?.name}</Option>
              ))}
          </Select>
          <Button type="primary" onClick={HandleGetTemplates} style={{'marginLeft': '10px'}}>
            Загрузить
          </Button>
        </Card>
        <Card
          size="small"
        >
          <Button type="primary" disabled={!selectedTemplate} onClick={HandleGetTriggers}>
            Сформировать триггеры
          </Button>
          <Button
          variant="outlined"
          onClick={exportToExcelDefaultService}
          disabled={
            (!dataZabbix || dataZabbix.length === 0)
          }
          style={{'marginLeft': '10px'}}
        >
          Export in Excel
        </Button>
        </Card>
      </Space>
      {loading && (
        <div className="loading-overlay">
          <Spin size="large" />
        </div>
      )}
      {(dataZabbix) && (
        <div className="table">
          {dataZabbix && <TableData dataZabbix={dataZabbix} />}
          <Button
            variant="outlined"
            onClick={exportToExcelDefaultService}
            disabled={
              (!dataZabbix || dataZabbix.length === 0)
            }
          >
            Export in Excel
          </Button>
        </div>
      )}
    </>
  );
};

export default ReportsTemplates;
