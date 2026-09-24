import React, { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  deleteStockItem,
  getStockItems,
  updateStockCogs,
} from "../../https";
import { useSelector } from "react-redux";
import ShoppingManagement from "./ShoppingManagement";

const ITEMS_PER_PAGE = 10;
const formatCurrency = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
const formatRupiahInput = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  return digits ? Number(digits).toLocaleString("id-ID") : "";
};
const parseCostInput = (value) => {
  const normalized = String(value ?? "").trim().replace(",", ".");

  return normalized === "" ? NaN : Number(normalized);
};
const roundCurrency = (value) => Math.round((Number(value) || 0) * 100) / 100;
const roundCost = (value) => Math.round((Number(value) || 0) * 10000) / 10000;
const getCostDisplay = (item) => {
  const unit = String(item.unit || "").toLowerCase();
  const averageCost = Number(item.averageCost || 0);

  if (["gr", "g", "gram"].includes(unit)) {
    return `${formatCurrency(averageCost)} / gr`;
  }

  if (["ml", "milliliter", "mililiter"].includes(unit)) {
    return `${formatCurrency(averageCost)} / ml`;
  }

  return `${formatCurrency(averageCost)} / ${item.unit || "unit"}`;
};
const getAssetDisplay = (item) => formatCurrency(item.stockValue);
const getStockQuantity = (item) => Math.max(Number(item?.stock || 0), 0);
const getDisplayCostUnit = (unit) => {
  const normalizedUnit = String(unit || "").toLowerCase();
  if (["gr", "g", "gram"].includes(normalizedUnit)) return "gr";
  if (["ml", "milliliter", "mililiter"].includes(normalizedUnit)) return "ml";
  return unit || "unit";
};
const getPackageCostValue = (form) => {
  const packageQuantity = parseCostInput(form.packageQuantity);
  const packagePrice = Number(form.packagePrice || 0);

  if (!Number.isFinite(packageQuantity) || packageQuantity <= 0) return 0;

  return roundCost(packagePrice / packageQuantity);
};
const getAssetValueFromPackage = (item, form) =>
  roundCurrency(getStockQuantity(item) * getPackageCostValue(form));

const statusClassNames = {
  "BEBAS STOK": "bg-[#314259] text-blue-200",
  "HARUS ORDER": "bg-[#4a2e2e] text-red-400",
  "HAMPIR HABIS": "bg-[#4a452e] text-yellow-400",
  AMAN: "bg-[#2e4a40] text-green-400",
};

const stockTabs = [
  { key: "stock", label: "Stok Barang" },
  { key: "shopping", label: "Bahan Belanjaan" },
];

const StockManagement = () => {
  const queryClient = useQueryClient();
  const userRole = useSelector((state) => state.user.role);
  const isAdmin = userRole?.toLowerCase() === "admin";
  const [activeStockTab, setActiveStockTab] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [editingCogsItem, setEditingCogsItem] = useState(null);
  const [cogsForm, setCogsForm] = useState({
    packageQuantity: "",
    packagePrice: "",
    supplier: "",
  });

  const { data: stockItemsRes, isError } = useQuery({
    queryKey: ["stock-items"],
    queryFn: getStockItems,
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar("Data stok belum bisa dimuat.", { variant: "error" });
  }

  const stockItems = stockItemsRes?.data?.data || [];
  const refreshStockItems = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
  };

  useEffect(() => {
    if (!pendingDeleteItem && !editingCogsItem) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [pendingDeleteItem, editingCogsItem]);

  const stockItemDeleteMutation = useMutation({
    mutationFn: deleteStockItem,
    onSuccess: () => {
      refreshStockItems();
      enqueueSnackbar("Bahan berhasil dihapus.", { variant: "success" });
      setPendingDeleteItem(null);
    },
    onError: () => {
      enqueueSnackbar("Gagal menghapus bahan.", { variant: "error" });
    },
  });
  const stockItemCogsMutation = useMutation({
    mutationFn: updateStockCogs,
    onSuccess: () => {
      refreshStockItems();
      enqueueSnackbar("COGS awal berhasil diubah.", { variant: "success" });
      setEditingCogsItem(null);
      setCogsForm({ packageQuantity: "", packagePrice: "", supplier: "" });
    },
    onError: () => {
      enqueueSnackbar("Gagal mengubah COGS awal.", { variant: "error" });
    },
  });

  const filteredItems = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) return stockItems;

    return stockItems.filter((item) => {
      const searchableText = [
        item.name,
        item.category,
        item.unit,
        item.stock,
        item.minimumStock,
        item.averageCost,
        item.stockValue,
        item.status,
        item.supplier,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [stockItems, searchQuery]);

  const totalPages = Math.max(
    Math.ceil(filteredItems.length / ITEMS_PER_PAGE),
    1
  );

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredItems]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeStockTab, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleDelete = (item) => {
    setPendingDeleteItem(item);
  };
  const handleEditCogs = (item) => {
    setEditingCogsItem(item);
    setCogsForm({
      packageQuantity: String(getStockQuantity(item) || ""),
      packagePrice: String(Number(item.stockValue || 0)),
      supplier: item.supplier || "",
    });
  };
  const submitCogsEdit = (event) => {
    event.preventDefault();
    if (!editingCogsItem) return;

    const packageQuantity = parseCostInput(cogsForm.packageQuantity);
    const packagePrice = Number(cogsForm.packagePrice || 0);
    if (!Number.isFinite(packageQuantity) || packageQuantity <= 0) {
      enqueueSnackbar("Gramasi kemasan tidak valid.", { variant: "error" });
      return;
    }
    if (!Number.isFinite(packagePrice) || packagePrice < 0) {
      enqueueSnackbar("Harga kemasan tidak valid.", { variant: "error" });
      return;
    }

    stockItemCogsMutation.mutate({
      stockItemId: editingCogsItem.id || editingCogsItem._id,
      averageCost: getPackageCostValue(cogsForm),
      supplier: cogsForm.supplier,
    });
  };

  return (
    <div className="container mx-auto bg-[#262626] p-4 rounded-lg">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[#f5f5f5] text-xl font-semibold">
            Stok Management
          </h2>
          <p className="mt-1 text-sm text-[#ababab]">
            Pantau stok bahan dan status restock.
          </p>
        </div>
        <div className="flex w-full shrink-0 gap-2 rounded-lg bg-[#1f1f1f] p-1 sm:w-fit">
          {stockTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveStockTab(tab.key)}
              className={`flex flex-1 items-center justify-center rounded-md px-4 py-2 text-sm font-bold transition sm:flex-none ${
                activeStockTab === tab.key
                  ? "bg-[#a79981] text-[#101010]"
                  : "text-[#ababab] hover:bg-[#2f2f2f] hover:text-[#f5f5f5]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeStockTab === "shopping" && <ShoppingManagement stockItems={stockItems} isAdmin={isAdmin} />}
      {activeStockTab === "stock" && <div className="rounded-lg bg-[#1f1f1f] p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#f5f5f5]">
              Stok Barang
            </h3>
            <p className="mt-1 text-sm text-[#ababab]">
              Daftar bahan, kategori, jumlah stok, dan status restock.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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
                <tr
                  key={item.id || item._id}
                  className="border-b border-gray-600 hover:bg-[#333]"
                >
                  <td className="p-4">
                    <p className="font-semibold">{item.name}</p>
                    {item.supplier && (
                      <p className="mt-1 text-xs font-medium text-[#ababab]">
                        {item.supplier}
                      </p>
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
                    <span className="whitespace-nowrap font-semibold">
                      {getAssetDisplay(item)}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="whitespace-nowrap font-semibold text-[#f6d365]">
                      {getCostDisplay(item)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {item.isUnlimited ? "-" : item.minimumStock}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`inline-flex min-w-[110px] items-center justify-center rounded-lg px-2 py-1 text-sm font-semibold ${
                        statusClassNames[item.status] ||
                        "bg-[#2e4a40] text-green-400"
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
                          onClick={() => handleEditCogs(item)}
                          className="text-[#d6c7ae] hover:text-[#f5f5f5]"
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
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
                  <td
                    className="p-4 text-center text-[#ababab]"
                    colSpan={isAdmin ? 9 : 8}
                  >
                    No stock data found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-[#ababab] sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing{" "}
            {filteredItems.length === 0
              ? 0
              : (currentPage - 1) * ITEMS_PER_PAGE + 1}
            {" - "}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of{" "}
            {filteredItems.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-lg bg-[#262626] px-3 py-2 font-semibold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 font-semibold text-[#f5f5f5]">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.min(page + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="rounded-lg bg-[#262626] px-3 py-2 font-semibold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>}

      {isAdmin && editingCogsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={submitCogsEdit}
            className="rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
            style={{ width: "min(92vw, 460px)" }}
          >
            <div className="mb-4 border-b border-[#333] pb-3">
              <h3 className="text-lg font-bold">Ubah COGS Awal</h3>
              <p className="mt-1 text-sm text-[#ababab]">
                {editingCogsItem.name} · stok {editingCogsItem.stock}{" "}
                {editingCogsItem.unit}
              </p>
            </div>

            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-semibold">
                  Gramasi Kemasan
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={cogsForm.packageQuantity}
                  onChange={(event) =>
                    setCogsForm((current) => ({
                      ...current,
                      packageQuantity: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]"
                  placeholder={`Contoh: 800 ${getDisplayCostUnit(editingCogsItem.unit)}`}
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">
                  Harga Kemasan
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiahInput(cogsForm.packagePrice)}
                  onChange={(event) =>
                    setCogsForm((current) => ({
                      ...current,
                      packagePrice: event.target.value.replace(/\D/g, ""),
                    }))
                  }
                  className="w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]"
                  placeholder="Contoh: 169000"
                />
              </label>
            </div>

            <div className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold">
                COGS Otomatis
              </span>
              <div className="w-full rounded-lg border border-[#444] bg-[#1f1f1f] px-3 py-2 font-semibold text-[#f5f5f5]">
                {formatCurrency(getPackageCostValue(cogsForm))} /{" "}
                {getDisplayCostUnit(editingCogsItem.unit)}
              </div>
              <span className="mt-1 block text-xs text-[#ababab]">
                Hasil dari harga kemasan dibagi gramasi kemasan.
              </span>
            </div>

            <div className="mb-3 block">
              <span className="mb-1 block text-sm font-semibold">
                Nilai Asset Otomatis
              </span>
              <div className="w-full rounded-lg border border-[#444] bg-[#1f1f1f] px-3 py-2 font-semibold text-[#f5f5f5]">
                {formatCurrency(getAssetValueFromPackage(editingCogsItem, cogsForm))}
              </div>
              <span className="mt-1 block text-xs text-[#ababab]">
                Hasil dari COGS otomatis dikali stok sekarang.
              </span>
            </div>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-semibold">
                Sumber / catatan
              </span>
              <input
                type="text"
                value={cogsForm.supplier}
                onChange={(event) =>
                  setCogsForm((current) => ({
                    ...current,
                    supplier: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[#555] bg-[#1f1f1f] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae]"
                placeholder="Contoh: Setup COGS Awal"
              />
            </label>

            <div className="mb-5 rounded-lg bg-[#1f1f1f] p-3 text-sm">
              <span className="block text-[#ababab]">Ringkasan Setelah Ubah</span>
              <strong className="mt-1 block text-base">
                {formatCurrency(getAssetValueFromPackage(editingCogsItem, cogsForm))} -{" "}
                {formatCurrency(getPackageCostValue(cogsForm))} /{" "}
                {getDisplayCostUnit(editingCogsItem.unit)}
              </strong>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingCogsItem(null);
                  setCogsForm({ packageQuantity: "", packagePrice: "", supplier: "" });
                }}
                className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={stockItemCogsMutation.isPending}
                className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stockItemCogsMutation.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isAdmin && pendingDeleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
            style={{ width: "min(92vw, 380px)" }}
          >
            <h3 className="text-lg font-bold">Hapus bahan?</h3>
            <p className="mt-2 text-sm text-[#ababab]">
              Bahan <span className="font-semibold text-[#f5f5f5]">{pendingDeleteItem.name}</span>{" "}
              akan dihapus dari daftar stok.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteItem(null)}
                className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() =>
                  stockItemDeleteMutation.mutate(
                    pendingDeleteItem.id || pendingDeleteItem._id
                  )
                }
                disabled={stockItemDeleteMutation.isPending}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stockItemDeleteMutation.isPending ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;
