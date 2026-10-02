// src/features/farmshift/screenHelpers.jsx
// Shared helpers for all FarmShift screen modules
import React from "react";

export const num = (n) => Number(n || 0).toLocaleString("vi-VN");
export const money = (n) => num(n) + " ₫";

export const Badge = ({ text, variant = "" }) => {
  const auto = !variant && /Chưa|Mới|chờ|Đang/.test(text) ? "warn" : variant;
  return React.createElement("span", { className: `badge ${auto}` }, text);
};

export const DataTable = ({ headers, rows }) =>
  React.createElement("div", { className: "tablewrap" },
    React.createElement("table", null,
      React.createElement("thead", null,
        React.createElement("tr", null, headers.map(h => React.createElement("th", { key: h }, h)))
      ),
      React.createElement("tbody", null,
        rows.length
          ? rows.map((row, i) =>
              React.createElement("tr", { key: i },
                row.map((c, j) => React.createElement("td", { key: j }, c ?? "—"))
              )
            )
          : React.createElement("tr", null,
              React.createElement("td", { colSpan: headers.length, className: "empty" }, "Chưa có bản ghi phù hợp.")
            )
      )
    )
  );

export const KpiGrid = ({ items }) =>
  React.createElement("div", { className: `grid ${items.length === 3 ? "three" : "four"}` },
    items.map(({ label, value, unit, icon: Icon }) =>
      React.createElement("div", { key: label, className: "card kpi" },
        React.createElement("span", { className: "round" }, Icon && React.createElement(Icon, { size: 20 })),
        React.createElement("div", null,
          React.createElement("span", null, label),
          React.createElement("strong", null, value),
          React.createElement("small", null, unit || "")
        )
      )
    )
  );

export const NoteBanner = ({ children, warn = false }) =>
  React.createElement("div", { className: `note${warn ? " warn" : ""}` }, children);

export const FiltersRow = ({ searchVal, onSearch, statusVal, onStatus, label = "" }) =>
  React.createElement("div", { className: "filters" },
    React.createElement("input", {
      type: "search",
      value: searchVal,
      onChange: e => onSearch(e.target.value),
      placeholder: label || "Tìm kiếm mã, tên hoặc nội dung…"
    }),
    React.createElement("select", { value: statusVal, onChange: e => onStatus(e.target.value) },
      React.createElement("option", { value: "" }, "Tất cả trạng thái"),
      React.createElement("option", null, "Mới"),
      React.createElement("option", null, "Hoàn thành"),
      React.createElement("option", null, "Chưa thanh toán"),
      React.createElement("option", null, "Đang thực hiện")
    ),
    React.createElement("span", { className: "muted" }, "Dữ liệu mẫu · 21/10/2026")
  );

export const LogTable = ({ logs, onDetail }) =>
  React.createElement(DataTable, {
    headers: ["Ngày / Giờ", "Hoạt động", "Chuồng", "Giá trị", "Người ghi", ""],
    rows: logs.map((l, i) => [
      `${l.date} ${l.time}`, l.type, l.coop,
      `${l.amount} ${l.unit}`, l.person,
      React.createElement("button", { key: i, className: "btn small", onClick: () => onDetail(i) }, "Chi tiết")
    ])
  });

export const GrowthChart = () =>
  React.createElement("div", null,
    React.createElement("div", { className: "legend" },
      React.createElement("span", null, React.createElement("i", { className: "dot" }), "Thực tế"),
      React.createElement("span", null, React.createElement("i", { className: "dot", style: { background: "#a9bbad" } }), "Mục tiêu")
    ),
    React.createElement("svg", { className: "chart", viewBox: "0 0 600 190", role: "img" },
      React.createElement("g", { stroke: "#e7eee8" },
        React.createElement("path", { d: "M45 20H580M45 60H580M45 100H580M45 140H580" })
      ),
      React.createElement("path", { d: "M50 129 220 106 390 68 555 27", fill: "none", stroke: "#a9bbad", strokeWidth: "3", strokeDasharray: "6 6" }),
      React.createElement("path", { d: "M50 129 220 109 390 70 555 32", fill: "none", stroke: "#367957", strokeWidth: "3" }),
      React.createElement("g", { fill: "#367957" },
        React.createElement("circle", { cx: "50", cy: "129", r: "4" }),
        React.createElement("circle", { cx: "220", cy: "109", r: "4" }),
        React.createElement("circle", { cx: "390", cy: "70", r: "4" }),
        React.createElement("circle", { cx: "555", cy: "32", r: "4" })
      )
    )
  );
