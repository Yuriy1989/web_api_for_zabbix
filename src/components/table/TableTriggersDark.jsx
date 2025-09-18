// components/table/TableEventForTemplates.jsx
import { useMemo, useRef, useState } from "react";
import { Table, Input, Button, Space, Tag, Typography, Tooltip } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { SEVERITY_COLORS, SEVERITY_LABELS } from "../../utils/constants";

const { Text } = Typography;

/** Детерминированный цвет для тегов */
const TAG_COLOR_POOL = [
  "geekblue",
  "purple",
  "magenta",
  "volcano",
  "orange",
  "gold",
  "lime",
  "green",
  "cyan",
  "blue",
];
const colorByString = (s = "") => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_COLOR_POOL[h % TAG_COLOR_POOL.length];
};

/** Нормализуем входные объекты */
const normalizeRows = (rows = []) =>
  (rows || []).map((r) => {
    const priorityCode = String(r?.priority ?? "");
    const priorityLabel = SEVERITY_LABELS?.[priorityCode] ?? priorityCode;

    const host = r?.hosts?.[0]?.name ?? r?.hosts?.[0]?.host ?? "";

    const tagsArr = Array.isArray(r?.tags)
      ? r.tags.map((t) => ({
          key: String(t?.tag ?? ""),
          value: String(t?.value ?? ""),
          text:
            t?.tag && t?.value
              ? `${t.tag}=${t.value}`
              : String(t?.tag ?? t?.value ?? ""),
        }))
      : [];

    const statusNum = Number(r?.status ?? 0);
    const statusLabel = statusNum === 1 ? "отключен" : "в работе";

    return {
      triggerid: r?.triggerid ?? "",
      priority: priorityLabel,
      priorityCode,
      tags: tagsArr, // массив для отрисовки набора <Tag/>
      tagsFlat: tagsArr.map((t) => t.text).join(", "), // для поиска/сортировки
      hosts: host,
      description: r?.description ?? "",
      comments: r?.comments ?? "",
      expression: r?.expression ?? "", // с expandExpression: true будет полным
      statusNum,
      statusLabel,
    };
  });

// ---- поиск в колонках (AntD)
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
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
      close,
    }) => (
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
    filterDropdownProps: {
      onOpenChange: (open) => {
        if (open) setTimeout(() => searchInput.current?.select(), 100);
      },
    },
    render: (text) => text,
  });

  return { getColumnSearchProps };
};

const TableTriggersDark = ({ rows = [] }) => {
  const { getColumnSearchProps } = useColumnSearch();

  const dataSource = useMemo(() => normalizeRows(rows), [rows]);

  const severityFilters = useMemo(() => {
    const set = new Set();
    dataSource.forEach((r) => r?.priority && set.add(String(r.priority)));
    return [...set].sort().map((s) => ({ text: s, value: s }));
  }, [dataSource]);

  const statusFilters = useMemo(
    () => [
      { text: "в работе (0)", value: 0 },
      { text: "отключен (1)", value: 1 },
    ],
    []
  );

  const counts = useMemo(() => {
    let on = 0;
    let off = 0;
    dataSource.forEach((r) => (r.statusNum === 1 ? off++ : on++));
    return { on, off, total: dataSource.length };
  }, [dataSource]);

  const columns = [
    {
      title: "Приоритет",
      dataIndex: "priority",
      key: "priority",
      width: 140,
      sorter: (a, b) => String(a.priority).localeCompare(String(b.priority)),
      filters: severityFilters,
      onFilter: (value, record) => String(record?.priority) === String(value),
      render: (_label, record) => {
        const label = record?.priority ?? "";
        const color =
          SEVERITY_COLORS?.[label] ?? SEVERITY_COLORS?.[record?.priorityCode];
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "Tags",
      dataIndex: "tags",
      key: "tags",
      width: 360,
      sorter: (a, b) => (a.tagsFlat || "").localeCompare(b.tagsFlat || ""),
      ...getColumnSearchProps("tagsFlat", "Search tags"),
      // ⬇️ важно: даём ячейке стиль переноса
      onCell: () => ({
        style: {
          whiteSpace: "normal",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        },
      }),
      render: (_tags, record) => (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {record.tags?.length ? (
            record.tags.map((t, idx) => (
              <Tag
                key={`${record.triggerid}-tag-${idx}`}
                color={colorByString(t.key || t.text)}
                style={{
                  marginBottom: 4,
                  maxWidth: "100%",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  display: "inline-flex",
                }}
              >
                {t.text}
              </Tag>
            ))
          ) : (
            <Tag>—</Tag>
          )}
        </div>
      ),
    },
    {
      title: "Host",
      dataIndex: "hosts",
      key: "hosts",
      width: 220,
      sorter: (a, b) => (a.hosts || "").localeCompare(b.hosts || ""),
      ...getColumnSearchProps("hosts", "Search hosts"),
    },
    {
      title: "Название алерта",
      dataIndex: "description",
      key: "description",
      width: 420,
      ellipsis: true,
      sorter: (a, b) =>
        (a.description || "").localeCompare(b.description || ""),
      ...getColumnSearchProps("description", "Search alert name"),
    },
    {
      title: "Выражение",
      dataIndex: "expression",
      key: "expression",
      width: 420,
      ellipsis: true,
      sorter: (a, b) => (a.expression || "").localeCompare(b.expression || ""),
      ...getColumnSearchProps("expression", "Search expression"),
      render: (expr) =>
        expr ? (
          <Tooltip title={expr}>
            <Text
              code
              ellipsis={{ tooltip: expr }}
              style={{ maxWidth: 380, display: "inline-block" }}
            >
              {expr}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Комментарии",
      dataIndex: "comments",
      key: "comments",
      width: 380,
      ellipsis: true,
      sorter: (a, b) => (a.comments || "").localeCompare(b.comments || ""),
      ...getColumnSearchProps("comments", "Search comments"),
    },
    {
      title: "Статус",
      dataIndex: "statusLabel",
      key: "status",
      width: 140,
      align: "center",
      filters: statusFilters,
      onFilter: (value, record) => Number(record?.statusNum) === Number(value),
      sorter: (a, b) => (a.statusNum ?? 0) - (b.statusNum ?? 0),
      render: (_label, r) =>
        r.statusNum === 1 ? (
          <Tag color="default">отключен</Tag>
        ) : (
          <Tag color="success">в работе</Tag>
        ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      tableLayout="fixed"
      size="small"
      bordered
      sticky
      locale={{ emptyText: <Text type="secondary">Нет данных</Text> }}
      rowKey={(r) => r.triggerid || `${r.hosts}|${r.description}`}
      scroll={{ x: 1600, y: 520 }}
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
          <Table.Summary.Cell index={3} />
          <Table.Summary.Cell index={4} />
          <Table.Summary.Cell index={5} align="right">
            <Text strong>В работе / Отключено:</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={6} align="center">
            <Text strong>
              {counts.on} / {counts.off} (всего: {counts.total})
            </Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
  );
};

export default TableTriggersDark;
