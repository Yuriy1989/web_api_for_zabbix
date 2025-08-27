import { saveAs } from "file-saver";
import ExcelJS from "exceljs";

const exportToExcelDefault = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Duplicate IPs");

  worksheet.columns = [
    { header: "IP", key: "ip", width: 18 },
    { header: "Host ID", key: "hostid", width: 12 },
    { header: "Host name", key: "name", width: 36 },
    { header: "Status", key: "status", width: 12 },
    { header: "Service", key: "service", width: 18 },
  ];

  worksheet.mergeCells("A1:E1");
  worksheet.getCell("A1").value = "Дубли IP-адресов";
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).font = { bold: true, size: 12 };

  worksheet.getRow(2).values = ["IP", "Host ID", "Host name", "Status", "Service"];
  worksheet.getRow(2).font = { bold: true, size: 10 };

  // --- Группировка по IP
  const grouped = rows.reduce((acc, row) => {
    if (!acc[row.ip]) acc[row.ip] = [];
    acc[row.ip].push(row);
    return acc;
  }, {});

  let currentRowIndex = 3;

  Object.entries(grouped).forEach(([ip, hosts]) => {
    const startRow = currentRowIndex;

    hosts.forEach((h) => {
      const newRow = worksheet.addRow({
        ip: h.ip,
        hostid: h.hostid ?? "-",
        name: h.name ?? "-",
        status: h.status ?? "-",
        service: h.service ?? "-",
      });

      newRow.eachCell((cell) => {
        cell.alignment = { wrapText: true, vertical: "middle" };
      });

      // --- статус: текст + цвет
      const statusCell = newRow.getCell("status");
      const raw = String(h.status ?? "").trim();

      if (raw === "0") {
        statusCell.value = "enabled";
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF92D050" }, // зелёный
        };
      } else if (raw === "1") {
        statusCell.value = "disabled";
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFF0000" }, // красный
        };
      } else {
        statusCell.value = raw || "-";
      }

      statusCell.alignment = { horizontal: "center", vertical: "middle" };
      currentRowIndex++;
    });

    // Объединяем ячейки IP
    if (hosts.length > 1) {
      worksheet.mergeCells(`A${startRow}:A${currentRowIndex - 1}`);
      const cell = worksheet.getCell(`A${startRow}`);
      cell.value = ip;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.font = { bold: true };
    }
  });

  // --- границы
  worksheet.eachRow((row, rowNumber) => {
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

  worksheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: 5 } };
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 2 }];

  workbook.xlsx.writeBuffer().then((buffer) => {
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), "DuplicateIPs.xlsx");
  });
};

export default exportToExcelDefault;
