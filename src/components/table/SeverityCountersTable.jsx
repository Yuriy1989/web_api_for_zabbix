import React, { useMemo } from "react";
import { Table } from "antd";
import { SEVERITY_LABELS } from "../../utils/constants";

/**
 * props:
 *  - alerts: массив событий (как alertsDataAll)
 *  - selectedSeverities: массив выбранных severity (например [3,4,5])
 */
const SeverityCountersTable = ({ alerts = [], selectedSeverities = [] }) => {
  // считаем кол-ва по severity
  const counts = useMemo(() => {
    const acc = {};
    alerts.forEach((ev) => {
      const sev = String(ev?.severity ?? "");
      acc[sev] = (acc[sev] || 0) + 1;
    });
    return acc;
  }, [alerts]);

  // строим колонки строго по выбранным severity
  const columns = (selectedSeverities || []).map((sev) => ({
    title: SEVERITY_LABELS?.[String(sev)] || String(sev),
    dataIndex: String(sev),
    key: String(sev),
    align: "right",
  }));

  // одна строка с числами
  const dataSource = [
    Object.fromEntries(
      (selectedSeverities || []).map((sev) => [
        String(sev),
        counts[String(sev)] || 0,
      ])
    ),
  ].map((row, idx) => ({ key: idx, ...row }));

  return (
    <Table
      size="small"
      pagination={false}
      columns={columns}
      dataSource={dataSource}
    />
  );
};

export default SeverityCountersTable;
