// export const USER_NAME="DudinIuV";
// export const PASSWORD="combRin2in^g";
// export const ZABBIX_SERVER="https://zabbix.vseinstrumenti.ru/api_jsonrpc.php";

export const USER_NAME = "Admin";
export const PASSWORD = "zabbix";
export const ZABBIX_SERVER = "http://192.168.2.101:8080/api_jsonrpc.php";

export const URL_ZABBIX = "https://zabbix.vseinstrumenti.ru";
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
