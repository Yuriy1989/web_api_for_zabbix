export const USER_NAME = "123";
export const PASSWORD = "234";
export const ZABBIX_SERVER = "https://zabbix.vseinstrumenti.ru/api_jsonrpc.php";
export const URL_ZABBIX = "https://zabbix.vseinstrumenti.ru";
export const TOKEN = "22ed6f4b7321e052ea42890066dacf53b61fa7124597903a4ec5f22412c061e4"

export const ALERTS_FOR_ZABBIX = [
  { warning: "2" },
  { average: "3" },
  { high: "4" },
  { disaster: "5" },
];

export const SEVERITY_LABELS = { 2: "Warning", 3: "Average", 4: "High", 5: "Disaster" };
export const SEVERITY_COLORS = {
  Warning: "#ddd431",
  Average: "#ff7300",
  High: "#CD5C5C",
  Disaster: "#FF0000",
};
