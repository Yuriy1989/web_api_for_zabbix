import { saveAs } from "file-saver";
import ExcelJS from "exceljs";

const exportToExcelHostsWithScripts = (dataZabbixHosts) => {
  console.log("dataZabbixHosts---", dataZabbixHosts);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Hosts");

  // Определение колонок
  worksheet.columns = [
    { header: "№", key: "number", width: 5 },
    { header: "Наименование host", key: "hostName", width: 20 },
    { header: "Примечание по host", key: "hostDescription", width: 20 },
    { header: "item name", key: "itemName", width: 20 },
    { header: "item key", key: "itemKey", width: 20 },
    { header: "url", key: "url", width: 20 },
  ];

  // Устанавливаем значения заголовков для нижнего уровня (в строке 2)
  worksheet.getRow(1).values = [
    "№",
    "Наименование host",
    "Примечание по host",
    "item name",
    "item key",
    "url",
  ];

  // Стилизация заголовков
  worksheet.getRow(1).font = { bold: true, size: 12 }; // Верхний уровень заголовков

  // Добавление данных
  const data = dataZabbixHosts.map(
    ({
      hosts,
      name,
      key,
      url,
    }, index) => ({
      number: index + 1,
      hostName: hosts?.[0]?.name || "-",
      hostDescription: hosts?.[0]?.description?.trim() ? hosts[0].description : "-",
      itemName: name,
      itemKey: key,
      url: url,
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

export default exportToExcelHostsWithScripts;
