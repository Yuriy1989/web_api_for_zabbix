// utils/exportToExcelAllHostsDaily.js
import * as XLSX from "xlsx";
import { SEVERITY_LABELS } from "./constants";

/**
 * Универсальный экспорт «разбивки» (по дням / по месяцам).
 * Формат входа одинаковый для обоих режимов.
 *
 * @param {Object} params
 * @param {Array<{date:string, counts:Object}>} params.rows - [{ date: 'YYYY-MM-DD' | 'YYYY-MM', counts: { '3': n, '4': n, ... } }, ...]
 * @param {number[]} params.severities - список severity для колонок
 * @param {string} [params.fileName="severity_all_hosts_daily.xlsx"] - имя файла
 * @param {string} [params.periodText=""] - человекочитаемый период, напр. "2025-04-01 00:00 → 2025-09-30 23:59"
 * @param {string} [params.modeLabel="По дням"] - "По дням" | "По месяцам"
 */
export default function exportToExcelAllHostsDaily({
  rows = [],
  severities = [],
  fileName = "severity_all_hosts_daily.xlsx",
  periodText = "",
  modeLabel = "По дням",
}) {
  // Преобразуем строки в JSON-таблицу
  const data = rows.map((r) => {
    const out = { Дата: r.date };
    severities.forEach((sev) => {
      const key = String(sev);
      out[SEVERITY_LABELS[key] || key] = r.counts?.[key] ?? 0;
    });
    return out;
  });

  // Основной лист
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    modeLabel === "По месяцам" ? "ByMonth" : "ByDay"
  );

  // Лист «Параметры»
  const severitiesLabel = (severities || [])
    .map((s) => SEVERITY_LABELS[String(s)] || String(s))
    .join(", ");

  const metaAoA = [
    ["Параметр", "Значение"],
    ["Период", periodText || "-"],
    ["Режим", modeLabel],
    ["Выбранные уровни", severitiesLabel || "-"],
    ["Сформировано", new Date().toISOString().replace("T", " ").slice(0, 19)],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(metaAoA);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Параметры");

  // Сохранение
  XLSX.writeFile(wb, fileName);
}
