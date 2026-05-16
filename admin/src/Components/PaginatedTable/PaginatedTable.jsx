import React, { useState, useEffect } from "react";
import "./PaginatedTable.css";

const getValue = (obj, path) => {
  if (!path || typeof path !== "string") return null;
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
};

const PaginatedTable = ({
  data,
  columns,
  columnMap = {},
  rowsPerPage = 10,
  disableSorting = false
}) => {
  const [page, setPage] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    const container = document.querySelector(".paginated-table");
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [page]);

  if (!Array.isArray(data) || data.length === 0) {
    return <p style={{ padding: "16px" }}>No data available.</p>;
  }

  const handleSort = col => {
    if (disableSorting) return;
    const key = columnMap[col] ?? col.toLowerCase();
    const direction = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });
  };

  const sortedData = disableSorting
    ? data
    : [...data].sort((a, b) => {
        const key = sortConfig.key;
        let aVal = getValue(a, key);
        let bVal = getValue(b, key);

        if (key === "size") {
          aVal = Number(aVal);
          bVal = Number(bVal);
        }

        if (aVal === undefined || bVal === undefined) return 0;

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }

        return sortConfig.direction === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const start = page * rowsPerPage;
  const currentRows = sortedData.slice(start, start + rowsPerPage);

  return (
    <div className="paginated-table">
      <table className="orders-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col}
                onClick={!disableSorting ? () => handleSort(col) : undefined}
                style={{ cursor: disableSorting ? "default" : "pointer" }}
              >
                {col}
                {!disableSorting && sortConfig.key === (columnMap[col] ?? col.toLowerCase()) && (
                  <span>{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {currentRows.map((row, i) => (
            <tr key={i}>
              {columns.map((col, j) => (
                <td key={j}>
                  {getValue(row, columnMap[col] ?? col.toLowerCase()) ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage(0)}>⏮ First</button>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>◀ Prev</button>
        <span>Page {page + 1} of {totalPages}</span>
        <button disabled={page + 1 === totalPages} onClick={() => setPage(p => p + 1)}>Next ▶</button>
        <button disabled={page + 1 === totalPages} onClick={() => setPage(totalPages - 1)}>Last ⏭</button>
      </div>
    </div>
  );
};

export default PaginatedTable;
