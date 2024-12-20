import { saveAs } from "file-saver";
import ExcelJS from "exceljs";

const exportToExcelDefault = (dataZabbix) => {
  console.log("dataZabbix----", dataZabbix);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Triggers");

  // Определение колонок
  worksheet.columns = [
    { header: "Наименование host", key: "hostName", width: 20 },
    { header: "Примечание по host", key: "hostDescription", width: 20 },
    { header: "Описание tags по host", key: "hostTags", width: 20 },
    { header: "Приоритет", key: "priority", width: 7 },
    { header: "Описание trigger", key: "description", width: 50 },
    { header: "triggerid", key: "triggerId", width: 7 },
    { header: "expression", key: "expression", width: 50 },
    { header: "status (0 - антивен, 1 - выключен)", key: "status", width: 7 },
    { header: "Примечание по триггеру", key: "triggerComments", width: 20 },
  ];

  // Объединение заголовков
  worksheet.mergeCells("A1:C1"); // Объединение A1 до C1
  worksheet.getCell("A1").value = "Информация о хостах"; // Заголовок для объединенных колонок
  worksheet.getCell("A1").alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.mergeCells("D1:I1"); // Объединение D1 до I1
  worksheet.getCell("D1").value = "Информация о триггерах"; // Заголовок для объединенных колонок
  worksheet.getCell("D1").alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  // Устанавливаем значения заголовков для нижнего уровня (в строке 2)
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
  worksheet.getRow(1).font = { bold: true, size: 12 }; // Верхний уровень заголовков
  worksheet.getRow(2).font = { bold: true, size: 10 }; // Подзаголовки

  // Добавление данных
  const data = dataZabbix.map(
    ({
      comments,
      description,
      expression,
      hosts,
      priority,
      status,
      triggerid,
    }) => ({
      hostName: hosts?.[0]?.name || "-",
      hostDescription: hosts?.[0]?.description || "-",
      hostTags: Array.isArray(hosts?.[0]?.tags)
        ? hosts[0].tags.map((item) => `${item.tag}: ${item.value}`).join(", ")
        : "-",
      priority: Number(priority),
      description: description,
      triggerId: triggerid,
      expression: expression,
      status: status,
      triggerComments: comments || "-",
    })
  );

  // Добавление строк в таблицу
  data.forEach((row) => {
    const newRow = worksheet.addRow(row);

    // Перенос слов для каждой ячейки строки
    newRow.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: "middle" }; // Перенос текста
    });

    // Условное форматирование для столбца "Приоритет"
    const priorityCell = newRow.getCell("priority");
    let priorityColor;

    // Определяем цвет на основе значения
    switch (priorityCell.value) {
      case 1:
        priorityColor = "FF87CEEB"; // Голубой
        break;
      case 2:
        priorityColor = "FFFFFF00"; // Желтый
        break;
      case 3:
        priorityColor = "FFFFA500"; // Оранжевый
        break;
      case 4:
        priorityColor = "fc2d51"; // Светло-красный
        break;
      case 5:
        priorityColor = "FFFF0000"; // Яркий красный
        break;
      default:
        priorityColor = "FFFFFFFF"; // Белый
        break;
    }

    // Применяем цвет к ячейке
    priorityCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: priorityColor },
    };
  });

  // Применение стилей к шапке
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 }; // Жирный шрифт, белый цвет
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F81BD" }, // Синий фон
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    }; // Центровка и перенос
  });

  // Добавление границ для всех ячеек
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

  // Сохранение файла
  workbook.xlsx.writeBuffer().then((buffer) => {
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      "TriggersData.xlsx"
    );
  });
};

export default exportToExcelDefault;
