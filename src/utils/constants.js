export const USER_NAME = "1111111111";
export const PASSWORD = "11111111111111";
export const ZABBIX_SERVER = "https://zabbix.vseimain.ru/api_jsonrpc.php";
export const URL_ZABBIX = "https://zabbix.ru";

export const ALERTS_FOR_ZABBIX = [
  { average: "3" },
  { high: "4" },
  { disaster: "5" },
];

export const SEVERITY_LABELS = { 3: "Average", 4: "High", 5: "Disaster" };
export const SEVERITY_COLORS = {
  Average: "#ff7300",
  High: "#CD5C5C",
  Disaster: "#FF0000",
};
