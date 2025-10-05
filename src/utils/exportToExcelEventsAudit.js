import * as XLSX from "xlsx";

export default function exportToExcelEventsAudit({
  rows = [],
  fileName = "events_audit.xlsx",
  periodText = "",
  mmMode = "",
  severityLabel = "",
}) {
  // Метаданные (верхние строки)
  const meta = [
    ["Период", periodText],
    ["MM", mmMode],
    ["Severity", severityLabel || "—"],
    [""],
  ];

  // Табличные данные
  const header = [
    "Время",
    "Severity",
    "Host",
    "Trigger",
    "В ММ",       // явная метка
    "eventid",
    "r_eventid",
  ];

  const data = rows.map((r) => ({
    "Время": r.time,
    "Severity": r.severityLabel || r.severity,
    "Host": r.host,
    "Trigger": r.trigger,
    "В ММ": r.suppressed ? "Да" : "Нет",
    "eventid": r.eventid,
    "r_eventid": r.r_eventid || "",
  }));

  // Лист
  const ws = XLSX.utils.aoa_to_sheet(meta);
  XLSX.utils.sheet_add_aoa(ws, [header], { origin: -1 });
  XLSX.utils.sheet_add_json(ws, data, { origin: -1, skipHeader: true });

  // Ширина колонок
  ws["!cols"] = [
    { wch: 20 }, // Время
    { wch: 12 }, // Severity
    { wch: 28 }, // Host
    { wch: 70 }, // Trigger
    { wch: 8 },  // В ММ
    { wch: 14 }, // eventid
    { wch: 14 }, // r_eventid
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "events");

  XLSX.writeFile(wb, fileName);
}
