// components/table/TableEventForTemplates.jsx
import { useMemo, useRef, useState } from "react";
import { Table, Input, Button, Space, Tag, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { SEVERITY_COLORS, SEVERITY_LABELS } from "../../utils/constants";

const { Text } = Typography;

/** Нормализуем входные строки (rows приходят из ReportLoop) */
const normalizeRows = (rows = []) =>
  (rows || []).map((r) => {
    const sensorType = String(r?.sensorType ?? r?.severity ?? "");
    const sensorLabel =
      r?.sensorLabel ?? SEVERITY_LABELS?.[sensorType] ?? sensorType;

    return {
      sensorType,
      sensorLabel,
      service: r?.service ?? "",
      vm: r?.vm ?? r?.name ?? "",
      alertName: r?.alertName ?? r?.name ?? "",
      count: Number(r?.count ?? r?.total ?? 0),
    };
  });

// ---- шаблон поиска в колонках (AntD)
const useColumnSearch = () => {
  const [searchText, setSearchText] = useState("");
  const [searchedColumn, setSearchedColumn] = useState("");
  const searchInput = useRef(null);

  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setSearchText(selectedKeys[0] || "");
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters) => {
    clearFilters?.();
    setSearchText("");
  };

  const getColumnSearchProps = (dataIndex, placeholder = "Search") => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInput}
          placeholder={placeholder}
          value={selectedKeys?.[0]}
          onChange={(e) =>
            setSelectedKeys(e.target.value ? [e.target.value] : [])
          }
          onPressEnter={() =>
            handleSearch(selectedKeys ?? [], confirm, dataIndex)
          }
          style={{ marginBottom: 8, display: "block" }}
          allowClear
        />
        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys ?? [], confirm, dataIndex)}
            icon={<SearchOutlined />}
            size="small"
          >
            Search
          </Button>
          <Button onClick={() => handleReset(clearFilters)} size="small">
            Reset
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              confirm({ closeDropdown: false });
              setSearchText(selectedKeys?.[0] || "");
              setSearchedColumn(dataIndex);
            }}
          >
            Filter
          </Button>
          <Button type="link" size="small" onClick={close}>
            Close
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
    onFilter: (value, record) => {
      const v = (record?.[dataIndex] ?? "").toString().toLowerCase();
      return v.includes((value ?? "").toString().toLowerCase());
    },
    // ⬇️ новый способ: вместо onFilterDropdownOpenChange
    filterDropdownProps: {
      onOpenChange: (open) => {
        if (open) setTimeout(() => searchInput.current?.select(), 100);
      },
    },
    render: (text) => text,
  });

  return { getColumnSearchProps };
};


const TableEventForTemplates = ({ rows = [] }) => {
  const { getColumnSearchProps } = useColumnSearch();

  const dataSource = useMemo(() => normalizeRows(rows), [rows]);

  const serviceFilters = useMemo(() => {
    const set = new Set();
    dataSource.forEach((r) => r?.service && set.add(r.service));
    return [...set].sort().map((s) => ({ text: s, value: s }));
  }, [dataSource]);

  const severityFilters = useMemo(() => {
    const set = new Set();
    dataSource.forEach(
      (r) => r?.sensorLabel && set.add(String(r.sensorLabel))
    );
    return [...set].sort().map((s) => ({ text: s, value: s }));
  }, [dataSource]);

  const totalAlerts = useMemo(
    () => dataSource.reduce((acc, r) => acc + (r.count || 0), 0),
    [dataSource]
  );

  const columns = [
    {
      title: "Тип датчика",
      dataIndex: "sensorLabel",
      key: "sensorType",
      width: 160,
      sorter: (a, b) =>
        String(a.sensorLabel).localeCompare(String(b.sensorLabel)),
      filters: severityFilters,
      onFilter: (value, record) => String(record?.sensorLabel) === String(value),
      render: (_label, record) => {
        const label =
          record?.sensorLabel ?? String(record?.sensorType ?? "");
        const color = SEVERITY_COLORS?.[label];
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "Service (tag)",
      dataIndex: "service",
      key: "service",
      width: 260,
      sorter: (a, b) => (a.service || "").localeCompare(b.service || ""),
      filters: serviceFilters,
      onFilter: (value, record) => record?.service === value,
      ...getColumnSearchProps("service", "Search service"),
    },
    {
      title: "VM",
      dataIndex: "vm",
      key: "vm",
      width: 280,
      sorter: (a, b) => (a.vm || "").localeCompare(b.vm || ""),
      ...getColumnSearchProps("vm", "Search VM"),
    },
    {
      title: "Название алерта",
      dataIndex: "alertName",
      key: "alertName",
      width: 480,
      ellipsis: true,
      sorter: (a, b) => (a.alertName || "").localeCompare(b.alertName || ""),
      ...getColumnSearchProps("alertName", "Search alert name"),
    },
    {
      title: "Сработок",
      dataIndex: "count",
      key: "count",
      width: 120,
      align: "center",
      sorter: (a, b) => (a.count ?? 0) - (b.count ?? 0),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      size="small"
      bordered
      sticky
      locale={{ emptyText: <Text type="secondary">Нет данных</Text> }}
      rowKey={(r) => `${r.sensorType}|${r.service}|${r.vm}|${r.alertName}`}
      scroll={{ x: 1100, y: 520 }}
      pagination={{
        defaultPageSize: 20,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
      }}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0}>
            <Text strong>Итого</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={1} />
          <Table.Summary.Cell index={2} />
          <Table.Summary.Cell index={3} align="right">
            <Text strong>Сработок:</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="center">
            <Text strong>{totalAlerts}</Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
  );
};

export default TableEventForTemplates;
