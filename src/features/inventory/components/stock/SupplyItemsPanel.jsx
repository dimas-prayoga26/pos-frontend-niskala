import { useEffect, useMemo, useState } from "react";
import { costDisplay, currency } from "../../utils/format";
import { SUPPLY_CATEGORIES } from "../../utils/purchaseKinds";
import { STOCK_PAGE_SIZE, STOCK_STATUS_CLASS_NAMES, filterStockItems } from "../../utils/stockItems";

const pagerButtonClass =
  "rounded-lg bg-[#262626] px-3 py-2 font-semibold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40";
const chipClass = (active) =>
  `rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
    active ? "bg-[#a79981] text-[#101010]" : "bg-[#262626] text-[#ababab] hover:text-white"
  }`;

// "Perlengkapan" tab: peralatan, operasional and promosi items, stocked like
// bahan baku but never used by menu recipes. New items and stock only come in
// through the one "Tambah Belanja" form (Jenis Belanja: Perlengkapan;
// opening stock as a belanja too), so this tab has no create button.
const SupplyItemsPanel = ({ supplyItems, isAdmin, onEdit, onAdjust, onDelete }) => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const filteredItems = useMemo(
    () =>
      filterStockItems(supplyItems, search).filter((item) => !category || item.category === category),
    [supplyItems, search, category]
  );
  const totalPages = Math.max(Math.ceil(filteredItems.length / STOCK_PAGE_SIZE), 1);
  const pageItems = filteredItems.slice((currentPage - 1) * STOCK_PAGE_SIZE, currentPage * STOCK_PAGE_SIZE);
  const totalValue = filteredItems.reduce((sum, item) => sum + Number(item.stockValue || 0), 0);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, category]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="rounded-lg bg-[#1f1f1f] p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#f5f5f5]">Perlengkapan</h3>
          <p className="mt-1 text-sm text-[#ababab]">
            Peralatan, operasional, dan promosi. Belanjanya lewat menu Belanja, Jenis Belanja
            Perlengkapan; tidak masuk resep dan HPP.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            type="search"
            aria-label="Cari perlengkapan"
            placeholder="Cari perlengkapan"
            className="rounded-lg bg-[#262626] px-4 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#777]"
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Kategori perlengkapan" className="flex flex-wrap gap-1">
          {["", ...SUPPLY_CATEGORIES].map((option) => (
            <button
              key={option || "all"}
              type="button"
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
              className={chipClass(category === option)}
            >
              {option || "Semua"}
            </button>
          ))}
        </div>
        <p className="text-sm text-[#ababab]">
          Nilai perlengkapan: <strong className="text-[#f5f5f5]">{currency(totalValue)}</strong>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[#f5f5f5]">
          <thead className="bg-[#333] text-[#ababab]">
            <tr>
              <th className="p-3">Barang</th>
              <th className="p-3">Kategori</th>
              <th className="p-3 text-center">Satuan</th>
              <th className="p-3 text-center">Stok</th>
              <th className="p-3 text-right">Nilai</th>
              <th className="p-3 text-right">Harga per Satuan</th>
              <th className="p-3 text-center">Minimum</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-600 hover:bg-[#333]">
                <td className="p-4">
                  <p className="font-semibold">{item.name}</p>
                  {item.supplier && <p className="mt-1 text-xs font-medium text-[#ababab]">{item.supplier}</p>}
                </td>
                <td className="p-4">{item.category}</td>
                <td className="p-4 text-center">{item.unit || "-"}</td>
                <td className="p-4 text-center font-semibold">{item.isUnlimited ? "Bebas Stok" : item.stock}</td>
                <td className="whitespace-nowrap p-4 text-right font-semibold">{currency(item.stockValue)}</td>
                <td className="whitespace-nowrap p-4 text-right font-semibold text-[#f6d365]">
                  {costDisplay(item.averageCost, item.unit)}
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
                <td className="p-4">
                  <div className="flex items-center justify-center gap-4 text-sm font-semibold">
                    {!item.isUnlimited && (
                      <button
                        type="button"
                        onClick={() => onAdjust(item)}
                        className="text-[#9fd6d2] hover:text-[#f5f5f5]"
                      >
                        Sesuaikan
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
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
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!filteredItems.length && (
              <tr>
                <td className="p-4 text-center text-[#ababab]" colSpan={9}>
                  {supplyItems.length
                    ? "Perlengkapan tidak ditemukan."
                    : "Belum ada perlengkapan. Catat lewat menu Belanja, Jenis Belanja Perlengkapan."}
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

export default SupplyItemsPanel;
