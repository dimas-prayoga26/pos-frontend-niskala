import { useEffect, useMemo, useState } from "react";
import { costDisplay, currency } from "../../utils/format";
import {
  STOCK_PAGE_SIZE,
  STOCK_STATUS_CLASS_NAMES,
  filterStockItems,
} from "../../utils/stockItems";

const pagerButtonClass =
  "rounded-lg bg-[#262626] px-3 py-2 font-semibold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40";

// "Stok Barang" tab: searchable, paged stock list. The page resets whenever
// the tab is reopened or the search changes.
const StockItemsPanel = ({ stockItems, searchQuery, onSearchChange, isAdmin, onEditCogs, onDelete }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const filteredItems = useMemo(
    () => filterStockItems(stockItems, searchQuery),
    [stockItems, searchQuery]
  );
  const totalPages = Math.max(Math.ceil(filteredItems.length / STOCK_PAGE_SIZE), 1);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * STOCK_PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + STOCK_PAGE_SIZE);
  }, [currentPage, filteredItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="rounded-lg bg-[#1f1f1f] p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#f5f5f5]">Stok Barang</h3>
          <p className="mt-1 text-sm text-[#ababab]">
            Daftar bahan, kategori, jumlah stok, dan status restock.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            type="search"
            placeholder="Search stock"
            className="rounded-lg bg-[#262626] px-4 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[#f5f5f5]">
          <thead className="bg-[#333] text-[#ababab]">
            <tr>
              <th className="p-3">Bahan</th>
              <th className="p-3">Kategori</th>
              <th className="p-3 text-center">Satuan</th>
              <th className="p-3 text-center">Stok</th>
              <th className="p-3 text-right">Nilai Asset</th>
              <th className="p-3 text-right">COGS Sekarang</th>
              <th className="p-3 text-center">Minimum</th>
              <th className="p-3 text-center">Status</th>
              {isAdmin && <th className="p-3 text-center">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => (
              <tr key={item.id || item._id} className="border-b border-gray-600 hover:bg-[#333]">
                <td className="p-4">
                  <p className="font-semibold">{item.name}</p>
                  {item.supplier && (
                    <p className="mt-1 text-xs font-medium text-[#ababab]">{item.supplier}</p>
                  )}
                </td>
                <td className="p-4">{item.category || "-"}</td>
                <td className="p-4 text-center">{item.unit || "-"}</td>
                <td className="p-4">
                  <span className="block text-center font-semibold">
                    {item.isUnlimited ? "Bebas Stok" : item.stock}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="whitespace-nowrap font-semibold">{currency(item.stockValue)}</span>
                </td>
                <td className="p-4 text-right">
                  <span className="whitespace-nowrap font-semibold text-[#f6d365]">
                    {costDisplay(item.averageCost, item.unit)}
                  </span>
                </td>
                <td className="p-4 text-center">{item.isUnlimited ? "-" : item.minimumStock}</td>
                <td className="p-4 text-center">
                  <span
                    className={`inline-flex min-w-[110px] items-center justify-center rounded-lg px-2 py-1 text-sm font-semibold ${
                      STOCK_STATUS_CLASS_NAMES[item.status] || "bg-[#2e4a40] text-green-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                {isAdmin && (
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-4 text-sm font-semibold">
                      <button
                        type="button"
                        onClick={() => onEditCogs(item)}
                        className="text-[#d6c7ae] hover:text-[#f5f5f5]"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td className="p-4 text-center text-[#ababab]" colSpan={isAdmin ? 9 : 8}>
                  No stock data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm text-[#ababab] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {filteredItems.length === 0 ? 0 : (currentPage - 1) * STOCK_PAGE_SIZE + 1}
          {" - "}
          {Math.min(currentPage * STOCK_PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            disabled={currentPage === 1}
            className={pagerButtonClass}
          >
            Prev
          </button>
          <span className="px-2 font-semibold text-[#f5f5f5]">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={pagerButtonClass}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockItemsPanel;
