import { saveAs } from "file-saver";
import ExcelJS from "exceljs";

const exportToExcelHostsWithGroups = (dataZabbixHosts) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Hosts");

  // Определение колонок
  worksheet.columns = [
    { header: "№", key: "number", width: 5 },
    { header: "Наименование группы", key: "name", width: 25 },
    { header: "Наименование host", key: "host", width: 20 },
    { header: "hostid", key: "hostId", width: 20 },
    { header: "Примечание по host", key: "description", width: 20 },

  ];

  // Устанавливаем значения заголовков для нижнего уровня (в строке 2)
  worksheet.getRow(1).values = [
    "№",
    "Наименование группы",
    "Наименование host",
    "hostid",
    "Примечание по host",
  ];

  // Стилизация заголовков
  worksheet.getRow(1).font = { bold: true, size: 12 }; // Верхний уровень заголовков

  // Добавление данных
  const data = dataZabbixHosts.map(
    ({
      name,
      host,
      hostid,
      description,
    }, index) => ({
      number: index + 1,
      name: name || "-",
      host: host || "-",
      hostId: hostid || "-",
      description: description || "-",
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

export default exportToExcelHostsWithGroups;
