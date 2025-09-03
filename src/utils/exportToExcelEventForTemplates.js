import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import { SEVERITY_LABELS, SEVERITY_COLORS } from "./constants";

const hexToExcelARGB = (hex) => {
  if (!hex) return null;
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  return `FF${clean.toUpperCase()}`;
};

const exportToExcelDefault = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const data = rows
    .map((r) => {
      const code = String(r?.sensorType ?? "");
      const label = r?.sensorLabel || SEVERITY_LABELS?.[code] || code;
      return {
        severityCode: code,
        severityLabel: label,
        service: r?.service || "-",
        vm: r?.vm || "-",
        alertName: r?.alertName || "-",
        count: Number(r?.count ?? 0),
      };
    })
    .sort((a, b) => {
      const s = Number(a.severityCode) - Number(b.severityCode);
      return s !== 0 ? s : (b.count || 0) - (a.count || 0);
    });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Alerts");

  ws.columns = [
    { header: "Severity", key: "severityLabel", width: 14 },
    { header: "Service", key: "service", width: 28 },
    { header: "VM", key: "vm", width: 36 },
    { header: "Название алерта", key: "alertName", width: 60 },
    { header: "Сработок", key: "count", width: 12 },
  ];

  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = "Alerts Summary";
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).font = { bold: true, size: 12 };

  // Шапка колонок
  ws.getRow(2).values = ["Severity", "Service", "VM", "Название алерта", "Сработок"];
  ws.getRow(2).font = { bold: true, size: 10 };

  // ---- ДАННЫЕ (БЕЗ ОБЪЕДИНЕНИЯ СТРОК) ----
  data.forEach((it) => {
    const row = ws.addRow({
      severityLabel: it.severityLabel,
      service: it.service,
      vm: it.vm,
      alertName: it.alertName,
      count: it.count,
    });

    // выравнивание
    row.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: "middle" };
    });

    // подсветка severity
    const rowNum = row.number;
    const sevCell = ws.getCell(`A${rowNum}`);
    const argb = hexToExcelARGB(SEVERITY_COLORS?.[it.severityLabel]);
    if (argb) {
      sevCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb },
      };
    }
    sevCell.alignment = { horizontal: "center", vertical: "middle" };

    // числовой формат для count
    ws.getCell(`E${rowNum}`).numFmt = "0";
  });

  // Границы
  ws.eachRow((row, rowNumber) => {
    if (rowNumber >= 2) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }
  });

  // Итог без merge
  const totalRow = ws.addRow({
    severityLabel: "",
    service: "",
    vm: "",
    alertName: "Итого",
    count: data.reduce((sum, r) => sum + (r.count || 0), 0),
  });
  totalRow.font = { bold: true };
  ws.getCell(`E${totalRow.number}`).numFmt = "0";

  // Фильтр + заморозка шапки
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 5 } };
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];

  workbook.xlsx.writeBuffer().then((buffer) => {
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), "Alerts.xlsx");
  });
};

export default exportToExcelDefault;
