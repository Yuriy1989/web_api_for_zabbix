// components/table/TableHostsAntd.jsx
import React, { useMemo, useRef, useState } from "react";
import { Table, Input, Button, Space, Tag, Tooltip } from "antd";
import { SearchOutlined } from "@ant-design/icons";

const TableDataHostsAntd = ({ dataZabbixHosts = [] }) => {
  const safeRows = Array.isArray(dataZabbixHosts) ? dataZabbixHosts : [];

  // ---------- helpers ----------
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const dataSource = useMemo(() => {
    return safeRows.map((row, idx) => {
      const ip = row?.interfaces?.[0]?.ip ?? "-";
      return {
        key: row?.hostid ?? `${idx}-${row?.host ?? "h"}`,
        idx: idx + 1,
        host: row?.host ?? "-",
        hostid: row?.hostid ?? "-",
        name: row?.name ?? "-",
        ip,
        description: row?.description ?? "-",
        tags: Array.isArray(row?.tags) ? row.tags : [],
        status: row?.status, // 0 enabled, 1 disabled
      };
    });
  }, [safeRows]);

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
      <SearchOutlined style={{ color: filtered ? "#7c3aed" : undefined }} />
    ),
    onFilter: (value, record) => {
      const v = (record?.[dataIndex] ?? "").toString().toLowerCase();
      return v.includes((value ?? "").toString().toLowerCase());
    },
    onFilterDropdownOpenChange: (visible) => {
      if (visible) setTimeout(() => searchInput.current?.select(), 100);
    },
    render: (text) =>
      typeof text === "string" || typeof text === "number" ? (
        String(text).length > 24 ? (
          <Tooltip title={String(text)} placement="top">
            <span
              style={{
                display: "inline-block",
                maxWidth: 260,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {String(text)}
            </span>
          </Tooltip>
        ) : (
          String(text)
        )
      ) : (
        "-" // для нестрок — дефолт
      ),
  });

  // ---------- columns ----------
  const columns = [
    {
      title: "#",
      dataIndex: "idx",
      key: "idx",
      width: 70,
      align: "center",
      sorter: (a, b) => (a.idx ?? 0) - (b.idx ?? 0),
    },
    {
      title: "host",
      dataIndex: "host",
      key: "host",
      width: 180,
      sorter: (a, b) =>
        (a.host || "").localeCompare(b.host || "", undefined, {
          numeric: true,
        }),
      ...getColumnSearchProps("host", "Search host"),
    },
    {
      title: "hostid",
      dataIndex: "hostid",
      key: "hostid",
      width: 140,
      sorter: (a, b) =>
        (String(a.hostid) || "").localeCompare(
          String(b.hostid) || "",
          undefined,
          {
            numeric: true,
          }
        ),
      ...getColumnSearchProps("hostid", "Search hostid"),
    },
    {
      title: "name",
      dataIndex: "name",
      key: "name",
      width: 220,
      sorter: (a, b) => (a.name || "").localeCompare(b.name || ""),
      ...getColumnSearchProps("name", "Search name"),
    },
    {
      title: "ip",
      dataIndex: "ip",
      key: "ip",
      width: 160,
      sorter: (a, b) =>
        (a.ip || "").localeCompare(b.ip || "", undefined, { numeric: true }),
      ...getColumnSearchProps("ip", "Search IP"),
    },
    {
      title: "description",
      dataIndex: "description",
      key: "description",
      width: 320,
      ...getColumnSearchProps("description", "Search description"),
      render: (text) =>
        text && text !== "-" ? (
          <Tooltip title={text} placement="top">
            <span
              style={{
                display: "inline-block",
                maxWidth: 480,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                opacity: 0.95,
              }}
            >
              {text}
            </span>
          </Tooltip>
        ) : (
          "-"
        ),
    },
    {
      title: "tags",
      dataIndex: "tags",
      key: "tags",
      width: 360,
      render: (tags, record) =>
        Array.isArray(tags) && tags.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tags.map((t, i) => (
              <Tag key={`${t?.tag}-${t?.value}-${i}`}>
                {(t?.tag ?? "") + (t?.value ? `: ${t.value}` : "")}
              </Tag>
            ))}
          </div>
        ) : (
          "-"
        ),
      // свой текстовый фильтр по tagsForFilter
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
        close,
      }) => (
        <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
          <Input
            placeholder="Search tags"
            value={selectedKeys?.[0]}
            onChange={(e) =>
              setSelectedKeys(e.target.value ? [e.target.value] : [])
            }
            onPressEnter={() => confirm()}
            style={{ marginBottom: 8, display: "block" }}
            allowClear
          />
          <Space>
            <Button type="primary" onClick={() => confirm()} size="small">
              Search
            </Button>
            <Button onClick={() => clearFilters?.()} size="small">
              Reset
            </Button>
            <Button type="link" size="small" onClick={close}>
              Close
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered) => (
        <SearchOutlined style={{ color: filtered ? "#7c3aed" : undefined }} />
      ),
      onFilter: (value, record) =>
        (record?.tagsForFilter || "")
          .toString()
          .toLowerCase()
          .includes((value ?? "").toString().toLowerCase()),
    },
    {
      title: "status",
      dataIndex: "status",
      key: "status",
      width: 140,
      align: "center",
      render: (v) => {
        const s = typeof v === "string" ? parseInt(v, 10) : v;
        const kind =
          s === 0
            ? "Enabled"
            : s === 1
            ? "Disabled"
            : typeof s === "number"
            ? String(s)
            : "-";
        const color =
          kind === "Enabled"
            ? "green"
            : kind === "Disabled"
            ? "red"
            : "default";
        return <Tag color={color}>{kind}</Tag>;
      },
      filters: [
        { text: "Enabled", value: "Enabled" },
        { text: "Disabled", value: "Disabled" },
      ],
      onFilter: (value, record) => {
        const s =
          typeof record.status === "string"
            ? parseInt(record.status, 10)
            : record.status;
        const kind = s === 0 ? "Enabled" : s === 1 ? "Disabled" : "-";
        return kind === value;
      },
      sorter: (a, b) => {
        const norm = (x) => {
          const s = typeof x === "string" ? parseInt(x, 10) : x;
          if (s === 0) return 1; // Enabled
          if (s === 1) return 2; // Disabled
          return 99;
        };
        return norm(a.status) - norm(b.status);
      },
    },
  ];

  // для текстового фильтра по тегам создадим поле tagsForFilter
  const dataWithTagFilter = useMemo(
    () =>
      dataSource.map((r) => ({
        ...r,
        tagsForFilter: Array.isArray(r.tags)
          ? r.tags
              .map((t) => `${t?.tag ?? ""}${t?.value ? `:${t.value}` : ""}`)
              .join(", ")
          : "",
      })),
    [dataSource]
  );

  return (
    <Table
      columns={columns}
      dataSource={dataWithTagFilter}
      size="small"
      bordered
      sticky
      rowKey="key"
      rowClassName={(_, idx) => (idx % 2 === 0 ? "row-even" : "row-odd")}
      scroll={{ x: 1200, y: 520 }}
      pagination={{
        current: pagination.current,
        pageSize: pagination.pageSize,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        onChange: (current, size) => {
          setPagination((prev) => ({
            current,
            pageSize: size ?? prev.pageSize,
          }));
        },
        onShowSizeChange: (current, size) => {
          setPagination({ current, pageSize: size });
        },
      }}
    />
  );
};

export default TableDataHostsAntd;
