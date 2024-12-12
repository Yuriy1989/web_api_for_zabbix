import { saveAs } from "file-saver";
import ExcelJS from "exceljs";

const exportToExcelHosts = (dataZabbixHosts) => {
  console.log("dataZabbixHosts---", dataZabbixHosts);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Hosts");

  // Определение колонок
  worksheet.columns = [
    { header: "№", key: "number", width: 5 },
    { header: "Наименование host", key: "hostName", width: 20 },
    { header: "hostid", key: "hostId", width: 20 },
    { header: "Примечание по host", key: "hostDescription", width: 20 },
    { header: "Описание tags по host", key: "hostTags", width: 20 },
    { header: "status (0 - активен, 1 - выключен)", key: "status", width: 7 },
  ];

  // Устанавливаем значения заголовков для нижнего уровня (в строке 2)
  worksheet.getRow(1).values = [
    "№",
    "Наименование host",
    "hostid",
    "Примечание по host",
    "Описание tags по host",
    "status (0 - антивен, 1 - выключен)",
  ];

  // Стилизация заголовков
  worksheet.getRow(1).font = { bold: true, size: 12 }; // Верхний уровень заголовков

  // Добавление данных
  const data = dataZabbixHosts.map(
    ({
      description,
      host,
      hostid,
      status,
      tags,
    }, index) => ({
      number: index + 1,
      hostName: host || "-",
      hostId: hostid || "-",
      hostDescription: description || "-",
      hostTags: Array.isArray(tags)
        ? tags.map((item) => `${item.tag}: ${item.value}`).join(", ")
        : "-",
      description: description,
      status: status,
    })
  );

  // Добавление строк в таблицу
  data.forEach((row) => {
    const newRow = worksheet.addRow(row);

    // Перенос слов для каждой ячейки строки
    newRow.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: "middle" }; // Перенос текста
    });
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
      "HostsData.xlsx"
    );
  });
};

export default exportToExcelHosts;
