import { useEffect, useState } from "react";
import { Select, Space, Button, Card, Spin } from "antd";

import { api } from "../utils/Api";
import exportToExcelHostsWithScripts from "../utils/exportToExcelHostsWithScripts";
import "./reportsScripts.css"; // Подключаем стили
import TableHostsWithScripts from "../components/table/TableHostsWithScripts";
import { PASSWORD, USER_NAME, ZABBIX_SERVER } from "../utils/constants";

const ReportsScripts = () => {
  const { Option } = Select;

  const [dataZabbix, setDataZabbix] = useState();
  const [server, setServer] = useState(ZABBIX_SERVER);
  const [userName, setUserName] = useState(USER_NAME);
  const [password, setPassword] = useState(PASSWORD);
  const [services, setServices] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState();

  const exportToExcelDefaultService = () => {
    exportToExcelHostsWithScripts(dataZabbix);
  };

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
      console.log(services);
      const uniqueTags = [...new Set(services)];
      console.log(uniqueTags);
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

  const HandleGetScripts = async () => {
    setLoading(true);
    try {
      const service = "service";
      const hostsResponse = await api.getAllHostsByService(
        token,
        server,
        service,
        selectedTemplate
      );
      const hosts = hostsResponse?.result.map((item) => item.hostid);

      const items = await api.getItemByHosts(token, server, hosts);
      console.log("items", items);

      const transformedItems = items?.result.map((item) => {
        const match = item.key_.match(/\[(.*?)\]/);
        return {
          key: item.key_,
          url: match ? match[1] : item.key_,
          hosts: item.hosts,
          name: item.name,
        };
      });

      console.log("transformedItems", transformedItems);

      if (hosts.length === 0) {
        console.log("Хосты не найдены для данного шаблона");
        return;
      }

      setDataZabbix(transformedItems);
    } catch (error) {
      console.log("Ошибка запроса", error);
    } finally {
      setLoading(false);
    }
  };

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
          title="Нажмите Загрузить, чтобы подгрузить сервисы из zabbix"
          size="small"
        >
          <Select
            placeholder="Выберите сервис"
            showSearch // Включаем поиск
            filterOption={(input, option) =>
              option.children.toLowerCase().includes(input.toLowerCase())
            } // Фильтрация по введенному значению
            allowClear
            style={{
              width: "300px",
              marginRight: '10px',
            }}
            onChange={(value) => setSelectedTemplate(value)} // Устанавливаем выбранное значение
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
            type="primary"
            disabled={!selectedTemplate}
            onClick={HandleGetScripts}
          >
            Выгрузить скрипты
          </Button>
          <Button
            variant="outlined"
            onClick={exportToExcelDefaultService}
            disabled={
              (!dataZabbix || dataZabbix.length === 0)
            }
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
      {dataZabbix && (
        <div className="table">
          {dataZabbix && <TableHostsWithScripts dataZabbix={dataZabbix} />}
        </div>
      )}
    </>
  );
};

export default ReportsScripts;
