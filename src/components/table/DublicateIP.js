// components/table/DublicateIPAntd.jsx
import { useMemo, useRef, useState } from "react";
import { Table, Input, Button, Space, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";

const summarizeStatus = (hosts = []) => {
  const enabled = hosts.filter(
    (h) => h?.status === 0 || h?.status === "0"
  ).length;
  const disabled = hosts.filter(
    (h) => h?.status === 1 || h?.status === "1"
  ).length;
  if (enabled && disabled)
    return {
      kind: "Mixed",
      text: `Enabled: ${enabled} / Disabled: ${disabled}`,
    };
  if (enabled) return { kind: "Enabled", text: "Enabled" };
  if (disabled) return { kind: "Disabled", text: "Disabled" };
  return { kind: "Unknown", text: "-" };
};

const uniqueServicesFromHosts = (hosts = []) => {
  const uniq = [
    ...new Set((hosts || []).map((h) => h?.service).filter(Boolean)),
  ];
  return uniq;
};

const DublicateIPAntd = ({ dataZabbix = [] }) => {
  const safeData = Array.isArray(dataZabbix) ? dataZabbix : [];
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });

  const dataSource = useMemo(() => {
    return safeData.map((row, idx) => {
      const hosts = Array.isArray(row?.hosts) ? row.hosts : [];
      const services = uniqueServicesFromHosts(hosts);
      const status = summarizeStatus(hosts);
      return {
        key: `${row?.ip ?? "no-ip"}-${idx}`,
        ip: row?.ip ?? "-",
        hostCount: hosts.length,
        hosts,
        hostNames: hosts
          .map((h) => h?.name)
          .filter(Boolean)
          .join(", "),
        services,
        statusKind: status.kind,
        statusText: status.text,
      };
    });
  }, [safeData]);

  const serviceFilters = useMemo(() => {
    const set = new Set();
    dataSource.forEach((r) => (r.services || []).forEach((s) => set.add(s)));
    return [...set].sort().map((s) => ({ text: s, value: s }));
  }, [dataSource]);

  // --- поиск в колонках (AntD шаблон)
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
    onFilterDropdownOpenChange: (visible) => {
      if (visible) setTimeout(() => searchInput.current?.select(), 100);
    },
    render: (text) => text,
  });

  const columns = [
    {
      title: "#",
      dataIndex: "idx",
      key: "idx",
      width: 70,
      align: "center",
      render: (_v, _r, index) => index + 1,
    },
    {
      title: "IP",
      dataIndex: "ip",
      key: "ip",
      width: 180,
      sorter: (a, b) =>
        (a.ip || "").localeCompare(b.ip || "", undefined, { numeric: true }),
      ...getColumnSearchProps("ip", "Search IP"),
    },
    {
      title: "Hosts",
      dataIndex: "hostNames",
      key: "hosts",
      render: (_text, record) => {
        const parts = (record?.hostNames || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (!parts.length) return "-";

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {parts.map((p, idx) => (
              <span
                key={idx}
                style={{
                  display: "block",
                  maxWidth: 520,
                  wordBreak: "break-word",
                  opacity: 0.95,
                }}
              >
                {p}
              </span>
            ))}
          </div>
        );
      },
      sorter: (a, b) => (a.hostCount ?? 0) - (b.hostCount ?? 0),
      ...getColumnSearchProps("hostNames", "Search host"),
    },
    {
      title: "Service",
      dataIndex: "services",
      key: "services",
      width: 260,
      render: (services) =>
        services?.length ? services.map((s) => <Tag key={s}>{s}</Tag>) : "-",
      filters: serviceFilters,
      onFilter: (value, record) => (record?.services || []).includes(value),
    },
    {
      title: "Status",
      dataIndex: "statusText",
      key: "status",
      width: 220,
      render: (_v, record) => {
        const kind = record?.statusKind;
        const color =
          kind === "Enabled"
            ? "green"
            : kind === "Disabled"
            ? "red"
            : kind === "Mixed"
            ? "gold"
            : "default";
        return <Tag color={color}>{record?.statusText}</Tag>;
      },
      filters: [
        { text: "Enabled", value: "Enabled" },
        { text: "Disabled", value: "Disabled" },
        { text: "Mixed", value: "Mixed" },
      ],
      onFilter: (value, record) => record?.statusKind === value,
      sorter: (a, b) => {
        const order = { Enabled: 1, Mixed: 2, Disabled: 3, Unknown: 4 };
        return (order[a?.statusKind] || 99) - (order[b?.statusKind] || 99);
      },
    },
    {
      title: "Count",
      dataIndex: "hostCount",
      key: "hostCount",
      width: 100,
      align: "center",
      sorter: (a, b) => (a.hostCount ?? 0) - (b.hostCount ?? 0),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      size="small"
      bordered
      sticky
      rowKey="key"
      rowClassName={(_, idx) => (idx % 2 === 0 ? "row-even" : "row-odd")}
      scroll={{ x: 900, y: 520 }}
      pagination={{
        current: pagination.current,
        pageSize: pagination.pageSize,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        // AntD v5: size приходит вторым аргументом
        onChange: (current, size) => {
          setPagination((prev) => ({
            current,
            pageSize: size ?? prev.pageSize,
          }));
        },
        // Для совместимости (если используете v4)
        onShowSizeChange: (current, size) => {
          setPagination({ current, pageSize: size });
        },
      }}
    />
  );
};

export default DublicateIPAntd;
