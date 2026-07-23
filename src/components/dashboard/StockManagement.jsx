import React, { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  addStockItem,
  deleteStockItem,
  getStockItems,
  updateStockItem,
  updateStockQuantity,
} from "../../https";
import { useSelector } from "react-redux";

const ITEMS_PER_PAGE = 10;

const emptyStockForm = {
  name: "",
  category: "",
  unit: "pcs",
  stock: "0",
  minimumStock: "0",
  supplier: "",
};

const statusClassNames = {
  "HARUS ORDER": "bg-[#4a2e2e] text-red-400",
  "HAMPIR HABIS": "bg-[#4a452e] text-yellow-400",
  AMAN: "bg-[#2e4a40] text-green-400",
};

const StockManagement = () => {
  const queryClient = useQueryClient();
  const userRole = useSelector((state) => state.user.role);
  const isAdmin = userRole?.toLowerCase() === "admin";
  const [activeStockTab, setActiveStockTab] = useState("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [editingStockId, setEditingStockId] = useState(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);

  const { data: stockItemsRes, isError } = useQuery({
    queryKey: ["stock-items"],
    queryFn: getStockItems,
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar("Data stok belum bisa dimuat.", { variant: "error" });
  }

  const stockItems = stockItemsRes?.data?.data || [];
  const shoppingItems = useMemo(() => {
    return stockItems.filter((item) =>
      ["HAMPIR HABIS", "HARUS ORDER"].includes(item.status)
    );
  }, [stockItems]);
  const visibleItems = activeStockTab === "shopping" ? shoppingItems : stockItems;

  const refreshStockItems = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-items"] });
  };

  const stockItemAddMutation = useMutation({
    mutationFn: addStockItem,
    onSuccess: () => {
      refreshStockItems();
      enqueueSnackbar("Bahan berhasil ditambahkan.", { variant: "success" });
      setStockForm(emptyStockForm);
      setShowAddModal(false);
      setCurrentPage(1);
    },
    onError: () => {
      enqueueSnackbar("Gagal menambahkan bahan.", { variant: "error" });
    },
  });

  const stockQuantityMutation = useMutation({
    mutationFn: updateStockQuantity,
    onSuccess: refreshStockItems,
    onError: () => {
      enqueueSnackbar("Gagal mengubah stok.", { variant: "error" });
    },
  });

  const stockItemUpdateMutation = useMutation({
    mutationFn: updateStockItem,
    onSuccess: () => {
      refreshStockItems();
      enqueueSnackbar("Bahan berhasil diubah.", { variant: "success" });
      setStockForm(emptyStockForm);
      setEditingStockId(null);
      setShowAddModal(false);
    },
    onError: () => {
      enqueueSnackbar("Gagal mengubah bahan.", { variant: "error" });
    },
  });

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

  const filteredItems = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) return visibleItems;

    return visibleItems.filter((item) => {
      const searchableText = [
        item.name,
        item.category,
        item.unit,
        item.stock,
        item.minimumStock,
        item.status,
        item.supplier,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [visibleItems, searchQuery]);

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

  const updateStockForm = (field, value) => {
    setStockForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setStockForm(emptyStockForm);
    setEditingStockId(null);
  };

  const handleSubmitStock = (event) => {
    event.preventDefault();

    if (
      !stockForm.name.trim() ||
      !stockForm.category.trim() ||
      !stockForm.unit.trim()
    ) {
      enqueueSnackbar("Bahan, kategori, dan satuan wajib diisi.", {
        variant: "warning",
      });
      return;
    }

    const payload = {
      name: stockForm.name.trim(),
      category: stockForm.category.trim(),
      unit: stockForm.unit.trim(),
      stock: Math.max(Number(stockForm.stock) || 0, 0),
      minimumStock: Math.max(Number(stockForm.minimumStock) || 0, 0),
      supplier: stockForm.supplier.trim(),
    };

    if (editingStockId) {
      stockItemUpdateMutation.mutate({
        stockItemId: editingStockId,
        ...payload,
      });
      return;
    }

    stockItemAddMutation.mutate(payload);
  };

  const adjustStock = (item, amount) => {
    stockQuantityMutation.mutate({
      stockItemId: item.id || item._id,
      stock: Math.max(Number(item.stock) + amount, 0),
    });
  };

  const handleEdit = (item) => {
    setEditingStockId(item.id || item._id);
    setStockForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      stock: String(item.stock),
      minimumStock: String(item.minimumStock),
      supplier: item.supplier || "",
    });
    setShowAddModal(true);
  };

  const handleDelete = (item) => {
    setPendingDeleteItem(item);
  };

  const getShoppingSuggestion = (item) => {
    const stock = Number(item.stock) || 0;
    const minimumStock = Number(item.minimumStock) || 0;
    const unit = item.unit || "";
    const neededToMinimum = Math.max(minimumStock - stock, 0);

    if (item.status === "HARUS ORDER") {
      if (neededToMinimum > 0) {
        return `Beli min. ${neededToMinimum.toLocaleString("id-ID")} ${unit}`;
      }

      return "Beli segera";
    }

    return "Siapkan restock";
  };

  return (
    <div className="container mx-auto bg-[#262626] p-4 rounded-lg">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[#f5f5f5] text-xl font-semibold">
            Stock Management
          </h2>
          <p className="mt-1 text-sm text-[#ababab]">
            Pantau stok bahan dan status restock.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:flex-nowrap lg:items-center lg:justify-end">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            type="search"
            placeholder={
              activeStockTab === "shopping"
                ? "Cari bahan belanjaan"
                : "Search stock"
            }
            className="w-full rounded-lg bg-[#1f1f1f] px-4 py-2 text-sm font-semibold text-[#f5f5f5] outline-none placeholder:text-[#777] lg:w-72"
          />
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setStockForm(emptyStockForm);
                setEditingStockId(null);
                setShowAddModal(true);
              }}
              className="shrink-0 rounded-lg bg-[#025cca] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#0969df]"
            >
              Tambah Stok
            </button>
          )}
          <div className="flex w-full shrink-0 gap-2 rounded-lg bg-[#1f1f1f] p-1 sm:w-fit">
            {[
              { key: "stock", label: "Stok Barang" },
              { key: "shopping", label: "Bahan Belanjaan" },
            ].map((tab) => (
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
      </div>

      <div className="overflow-x-auto">
        {activeStockTab === "shopping" ? (
          <table className="w-full text-left text-[#f5f5f5]">
            <thead className="bg-[#333] text-[#ababab]">
              <tr>
                <th className="p-3">Bahan</th>
                <th className="p-3">Kategori</th>
                <th className="p-3 text-center">Stok Saat Ini</th>
                <th className="p-3 text-center">Minimum</th>
                <th className="p-3">Saran Belanja</th>
                <th className="p-3">Supplier</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => (
                <tr
                  key={item.id || item._id}
                  className="border-b border-gray-600 hover:bg-[#333]"
                >
                  <td className="p-4 font-semibold">{item.name}</td>
                  <td className="p-4">{item.category || "-"}</td>
                  <td className="p-4 text-center">
                    {item.stock} {item.unit || ""}
                  </td>
                  <td className="p-4 text-center">
                    {item.minimumStock} {item.unit || ""}
                  </td>
                  <td className="p-4 font-semibold text-[#d6c7ae]">
                    {getShoppingSuggestion(item)}
                  </td>
                  <td className="p-4">{item.supplier || "-"}</td>
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
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-[#ababab]" colSpan={7}>
                    Tidak ada bahan belanjaan saat ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-[#f5f5f5]">
            <thead className="bg-[#333] text-[#ababab]">
              <tr>
                <th className="p-3">Bahan</th>
                <th className="p-3">Kategori</th>
                <th className="p-3 text-center">Satuan</th>
                <th className="p-3 text-center">Stok</th>
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
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => adjustStock(item, -1)}
                        disabled={stockQuantityMutation.isPending}
                        className="h-7 w-7 rounded-md bg-[#1f1f1f] font-bold text-[#ababab] hover:bg-[#333] disabled:opacity-60"
                      >
                        -
                      </button>
                      <span className="min-w-8 text-center font-semibold">
                        {item.stock}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustStock(item, 1)}
                        disabled={stockQuantityMutation.isPending}
                        className="h-7 w-7 rounded-md bg-[#1f1f1f] font-bold text-[#ababab] hover:bg-[#333] disabled:opacity-60"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-center">{item.minimumStock}</td>
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
                          onClick={() => handleEdit(item)}
                          className="text-[#a79981] hover:text-[#d6c7ae]"
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
                    colSpan={isAdmin ? 7 : 6}
                  >
                    No stock data found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
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
            className="rounded-lg bg-[#1f1f1f] px-3 py-2 font-semibold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
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
            className="rounded-lg bg-[#1f1f1f] px-3 py-2 font-semibold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {isAdmin && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleSubmitStock}
            className="w-full max-w-xl rounded-lg bg-[#262626] p-5 text-[#f5f5f5] shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-bold">
                {editingStockId ? "Ubah Stok" : "Tambah Stok"}
              </h3>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-lg bg-[#333] px-3 py-1 text-sm text-[#ababab] hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[#ababab]">
                Bahan
                <input
                  value={stockForm.name}
                  onChange={(event) => updateStockForm("name", event.target.value)}
                  placeholder="Sirup vanila"
                  className="mt-2 w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
                />
              </label>
              <label className="text-sm font-semibold text-[#ababab]">
                Kategori
                <input
                  value={stockForm.category}
                  onChange={(event) =>
                    updateStockForm("category", event.target.value)
                  }
                  placeholder="Kopi"
                  className="mt-2 w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
                />
              </label>
              <label className="text-sm font-semibold text-[#ababab]">
                Satuan
                <input
                  value={stockForm.unit}
                  onChange={(event) => updateStockForm("unit", event.target.value)}
                  placeholder="kg"
                  className="mt-2 w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
                />
              </label>
              <label className="text-sm font-semibold text-[#ababab]">
                Stok
                <input
                  value={stockForm.stock}
                  onChange={(event) => updateStockForm("stock", event.target.value)}
                  type="number"
                  min="0"
                  step="0.1"
                  className="mt-2 w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
                />
              </label>
              <label className="text-sm font-semibold text-[#ababab]">
                Minimum
                <input
                  value={stockForm.minimumStock}
                  onChange={(event) =>
                    updateStockForm("minimumStock", event.target.value)
                  }
                  type="number"
                  min="0"
                  step="0.1"
                  className="mt-2 w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
                />
              </label>
              <label className="text-sm font-semibold text-[#ababab]">
                Supplier
                <input
                  value={stockForm.supplier}
                  onChange={(event) =>
                    updateStockForm("supplier", event.target.value)
                  }
                  placeholder="Toko bahan"
                  className="mt-2 w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-lg bg-[#333] px-4 py-2 text-sm font-semibold text-[#f5f5f5]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  stockItemAddMutation.isPending ||
                  stockItemUpdateMutation.isPending
                }
                className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stockItemAddMutation.isPending ||
                stockItemUpdateMutation.isPending
                  ? "Menyimpan..."
                  : editingStockId
                    ? "Simpan Perubahan"
                    : "Tambah Stok"}
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
