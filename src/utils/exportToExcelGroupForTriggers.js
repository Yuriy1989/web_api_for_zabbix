import { saveAs } from "file-saver";
import ExcelJS from "exceljs";

const exportToExcelGroupForTriggers = (dataZabbix = []) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Triggers");

  // Определение колонок
  worksheet.columns = [
    { header: "Наименование host", key: "hostName", width: 20 },
    { header: "Примечание по host", key: "hostDescription", width: 20 },
    { header: "Описание tags по host", key: "hostTags", width: 20 },
    { header: "Приоритет", key: "priority", width: 7 },
    { header: "Описание trigger", key: "description", width: 50 },
    { header: "triggerid", key: "triggerId", width: 10 },
    { header: "expression", key: "expression", width: 60 },
    { header: "status (0 - антивен, 1 - выключен)", key: "status", width: 12 },
    { header: "Примечание по триггеру", key: "triggerComments", width: 30 },
  ];

  // Объединение заголовков
  worksheet.mergeCells("A1:C1");
  worksheet.getCell("A1").value = "Информация о хостах";
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  worksheet.mergeCells("D1:I1");
  worksheet.getCell("D1").value = "Информация о триггерах";
  worksheet.getCell("D1").alignment = { horizontal: "center", vertical: "middle" };

  // Нижний уровень заголовков (строка 2)
  worksheet.getRow(2).values = [
    "Наименование host",
    "Примечание по host",
    "Описание tags по host",
    "Приоритет",
    "Описание trigger",
    "triggerid",
    "expression",
    "status (0 - антивен, 1 - выключен)",
    "Примечание по триггеру",
  ];

  // Стилизация заголовков
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(2).font = { bold: true, size: 10 };

  // Подготовка данных
  const data = (dataZabbix || []).map(({
    comments,
    description,
    expression,
    hosts,
    priority,
    status,
    triggerid,
    tags, // теги триггера
  }) => {
    const host = hosts?.[0] ?? {};
    const hostName = host?.name || "-";
    const hostDescription = host?.description || "-";

    // пытаемся взять теги хоста; если их нет — используем теги триггера
    const hostTagsStr = Array.isArray(host?.tags) && host.tags.length
      ? host.tags.map((t) => `${t.tag}: ${t.value}`).join(", ")
      : Array.isArray(tags) && tags.length
        ? tags.map((t) => `${t.tag}: ${t.value}`).join(", ")
        : "-";

    return {
      hostName,
      hostDescription,
      hostTags: hostTagsStr,
      priority: Number(priority ?? 0),
      description: description ?? "-",
      triggerId: triggerid ?? "-",
      expression: expression ?? "-",
      status: Number(status ?? 0),
      triggerComments: comments ?? "-",
    };
  });

  // Добавление строк + стили
  data.forEach((row) => {
    const newRow = worksheet.addRow(row);

    // перенос слов/выравнивание
    newRow.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: "middle" };
    });

    // Заливка по приоритету
    const priorityCell = newRow.getCell("priority");
    const p = Number(priorityCell.value);
    let priorityColor;
    switch (p) {
      case 1: priorityColor = "FF87CEEB"; break; // Голубой
      case 2: priorityColor = "FFFFFF00"; break; // Жёлтый
      case 3: priorityColor = "FFFFA500"; break; // Оранжевый
      case 4: priorityColor = "FFFC2D51"; break; // Светло-красный (исправлен ARGB)
      case 5: priorityColor = "FFFF0000"; break; // Красный
      default: priorityColor = "FFFFFFFF"; break; // Белый
    }
    priorityCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: priorityColor },
    };
  });

  // Шапка (строка 1)
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  // Границы для всех ячеек
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Сохранение
  workbook.xlsx.writeBuffer().then((buffer) => {
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), "TriggersData.xlsx");
  });
};

export default exportToExcelGroupForTriggers;
