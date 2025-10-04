// utils/exportToExcelSeverityOnly.js
import * as XLSX from "xlsx";
import { SEVERITY_LABELS } from "./constants";

/**
 * Экспорт «итого по severity» в Excel.
 *
 * @param {Object} params
 * @param {number[]} params.selectedSeverities - список severity, порядок = порядок колонок
 * @param {Object} params.countsBySeverity - объект { "0": n, "1": n, ... }
 * @param {string} [params.fileName="severity_counters.xlsx"] - имя файла
 * @param {string} [params.periodText=""] - человекочитаемый период, напр. "2025-04-01 00:00 → 2025-09-30 23:59"
 * @param {string} [params.modeLabel="Итого"] - режим расчёта (для листа «Параметры»)
 */
export default function exportToExcelSeverityOnly({
  selectedSeverities = [],
  countsBySeverity = {},
  fileName = "severity_counters.xlsx",
  periodText = "",
  modeLabel = "Итого",
}) {
  // единственная строка «итого»
  const row = {};
  selectedSeverities.forEach((sev) => {
    const key = String(sev);
    row[SEVERITY_LABELS[key] || key] = countsBySeverity[key] || 0;
  });

  // Основной лист
  const ws = XLSX.utils.json_to_sheet([row]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Summary");

  // Лист «Параметры»
  const severitiesLabel = (selectedSeverities || [])
    .map((s) => SEVERITY_LABELS[String(s)] || String(s))
    .join(", ");

  const metaAoA = [
    ["Параметр", "Значение"],
    ["Период", periodText || "-"],
    ["Режим", modeLabel || "Итого"],
    ["Выбранные уровни", severitiesLabel || "-"],
    ["Сформировано", new Date().toISOString().replace("T", " ").slice(0, 19)],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaAoA);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Параметры");

  // Сохранение
  XLSX.writeFile(wb, fileName);
}
