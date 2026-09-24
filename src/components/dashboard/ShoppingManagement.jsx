/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FiTrash2 } from "react-icons/fi";
import CreatableSelect2 from "../shared/CreatableSelect2";
import {
  deletePurchaseItem,
  getShoppingSuppliers,
  getPurchases,
  savePurchase,
  updatePurchaseItem,
} from "../../https";

const inputClass =
  "w-full rounded-lg border border-[#555] bg-[#262626] px-3 py-2 text-[#f5f5f5] outline-none focus:border-[#d6c7ae] disabled:opacity-60";
const buttonClass =
  "rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-50";
const paymentOptions = ["Cash", "Rekening Penjualan", "Transfer", "QRIS"].map((name) => ({
  id: name,
  text: name,
}));
const unitOptions = ["gr", "pcs", "ml"].map((unit) => ({
  id: unit,
  text: unit,
}));

let rowKey = 0;

const requestId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0")
  ).join("");
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const blankRow = () => ({
  key: ++rowKey,
  stockItemId: "",
  quantity: "",
  unit: "",
  unitPrice: "",
});
const currency = (n) =>
  `Rp ${Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
const quantityDisplay = (quantity, unit) =>
  `${Number(quantity || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  })} ${unit || ""}`.trim();
const costDisplay = (cost, unit) => {
  const normalizedUnit = String(unit || "").toLowerCase();
  const numericCost = Number(cost || 0);

  if (["gr", "g", "gram"].includes(normalizedUnit)) {
    return `${currency(numericCost)} / gr`;
  }

  if (["ml", "milliliter", "mililiter"].includes(normalizedUnit)) {
    return `${currency(numericCost)} / ml`;
  }

  return `${currency(numericCost)} / ${unit || "unit"}`;
};
const assetDisplay = (value) => currency(value);
const buildFallbackItemGroups = (purchases = [], stockItems = []) => {
  const stockById = new Map(stockItems.map((item) => [Number(item.id || item._id), item]));
  const groups = new Map();

  purchases.forEach((purchase) => {
    (purchase.items || []).forEach((item) => {
      const stockItemId = Number(item.stock_item_id);
      const key = stockItemId || item.item_name;
      const stockItem = stockById.get(stockItemId);

      if (!groups.has(key)) {
        groups.set(key, {
          stockItemId: stockItemId || null,
          itemName: item.item_name,
          stock: stockItem ? Number(stockItem.stock || 0) : null,
          stockUnit: stockItem?.unit || item.stock_unit,
          averageCost: Number(stockItem?.averageCost || item.stock_average_cost || 0),
          stockValue: Number(stockItem?.stockValue || item.stock_value_after || 0),
          purchaseCount: 0,
          histories: [],
        });
      }

      const group = groups.get(key);
      group.purchaseCount += 1;
        group.histories.push({
          id: item.id,
          purchaseId: purchase.id,
          itemName: item.item_name,
          purchaseDate: purchase.purchase_date,
        supplierName: purchase.suplier_name,
        paymentMethod: purchase.payment_method,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unit_price),
        total: Number(item.total),
        stockQuantity: Number(item.stock_quantity),
        stockUnit: item.stock_unit,
        stockAverageCost: Number(item.stock_average_cost || 0),
        stockValueAfter: Number(item.stock_value_after || 0),
      });
    });
  });

  return Array.from(groups.values());
};
const parseShoppingQuantity = (value) => {
  const input = String(value ?? "").trim().replace(",", ".");

  if (!input) return NaN;

  const fraction = input.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);

  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);

    return denominator > 0 ? numerator / denominator : NaN;
  }

  return Number(input);
};
const shoppingQuantity = (value) => {
  const quantity = parseShoppingQuantity(value);

  return Number.isFinite(quantity) ? quantity : 0;
};
const purchaseUnitForStockUnit = (unit) => {
  const normalizedUnit = String(unit || "").trim().toLowerCase();

  if (["gr", "g", "gram"].includes(normalizedUnit)) return "gr";
  if (["ml", "milliliter", "mililiter"].includes(normalizedUnit)) return "ml";

  return unit || "";
};
const lineTotal = (row) =>
  Math.round(Number(row.unitPrice || 0) * 100) / 100;
const unitPriceFromTotal = (quantity, total) =>
  Math.round((Number(total || 0) / Math.max(Number(quantity || 0), 1)) * 100) / 100;
const formatRupiahInput = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  return digits ? Number(digits).toLocaleString("id-ID") : "";
};

export default function ShoppingManagement({ stockItems, isAdmin }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: today(),
    suplierId: "",
    paymentMethod: "Cash",
    note: "",
  });
  const [rows, setRows] = useState(() => [blankRow()]);
  const [extraItems, setExtraItems] = useState([]);
  const [extraSuppliers, setExtraSuppliers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedHistoryGroup, setSelectedHistoryGroup] = useState(null);
  const [historyDetailTab, setHistoryDetailTab] = useState("history");
  const [editingHistoryItem, setEditingHistoryItem] = useState(null);
  const [editHistoryForm, setEditHistoryForm] = useState({
    quantity: "",
    unit: "",
    unitPrice: "",
  });
  const lock = useRef(false);
  const submission = useRef(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const suppliers = useQuery({
    queryKey: ["shopping-suppliers"],
    queryFn: getShoppingSuppliers,
  });
  const history = useQuery({
    queryKey: ["purchases", search, page],
    queryFn: () => getPurchases({ search, page }),
    placeholderData: keepPreviousData,
  });
  const supplierOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [...(suppliers.data?.data?.data || []), ...extraSuppliers].map((item) => [
            item.id,
            { id: item.id, text: item.name },
          ])
        ).values()
      ),
    [suppliers.data, extraSuppliers]
  );
  const itemOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [...stockItems, ...extraItems].map((item) => [
            item.id,
            { id: item.id, text: item.name, unit: item.unit },
          ])
        ).values()
      ),
    [stockItems, extraItems]
  );
  const historyData = history.data?.data?.data;
  const itemGroups =
    historyData?.itemGroups ||
    buildFallbackItemGroups(historyData?.purchases || [], stockItems);
  const totalPages = Math.max(
    1,
    Math.ceil((historyData?.groupTotal || historyData?.total || 0) / 10)
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!selectedHistoryGroup) return;

    const freshGroup = itemGroups.find(
      (group) =>
        String(group.stockItemId || group.itemName) ===
        String(selectedHistoryGroup.stockItemId || selectedHistoryGroup.itemName)
    );

    if (freshGroup) {
      setSelectedHistoryGroup(freshGroup);
    } else if (!history.isFetching) {
      setSelectedHistoryGroup(null);
    }
  }, [history.isFetching, itemGroups, selectedHistoryGroup]);

  useEffect(() => {
    if (!showForm && !selectedHistoryGroup && !editingHistoryItem) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [showForm, selectedHistoryGroup, editingHistoryItem]);

  const updateRow = (key, patch) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  const closeForm = () => setShowForm(false);
  const openHistoryDetail = (group) => {
    setSelectedHistoryGroup(group);
    setHistoryDetailTab("history");
  };
  const closeHistoryDetail = () => {
    setSelectedHistoryGroup(null);
    setHistoryDetailTab("history");
  };
  const resetForm = () => {
    setRows([blankRow()]);
    setForm({ date: today(), suplierId: "", paymentMethod: "Cash", note: "" });
    setExtraItems([]);
    setExtraSuppliers([]);
    submission.current = null;
  };
  const addSupplier = (name) => {
    const existing = supplierOptions.find(
      (item) => item.text.toLowerCase() === name.toLowerCase()
    );

    if (existing) return existing;

    const created = { id: `draft:${name.toLowerCase()}`, name };
    setExtraSuppliers((current) => [
      ...current.filter((item) => item.id !== created.id),
      created,
    ]);
    return { id: created.id, text: created.name };
  };
  const addItem = (name) => {
    const existing = itemOptions.find(
      (item) => item.text.toLowerCase() === name.toLowerCase()
    );

    if (existing) return existing;

    const created = { id: `draft:${name.toLowerCase()}`, name, unit: "" };
    setExtraItems((current) => [
      ...current.filter((item) => item.id !== created.id),
      created,
    ]);
    return { id: created.id, text: created.name, unit: created.unit };
  };
  const submit = async (event) => {
    event.preventDefault();
    if (lock.current) return;

    if (
      !form.suplierId ||
      rows.some(
        (row) =>
          !row.stockItemId ||
          !row.unit.trim() ||
          !Number.isFinite(parseShoppingQuantity(row.quantity)) ||
          parseShoppingQuantity(row.quantity) <= 0 ||
          row.unitPrice === ""
      )
    ) {
      enqueueSnackbar("Lengkapi toko, barang, gramasi, satuan, dan harga total.", {
        variant: "error",
      });
      return;
    }

    const supplierDraft = extraSuppliers.find((item) => item.id === form.suplierId);
    const { suplierId, ...details } = form;
    const payload = {
      ...details,
      ...(supplierDraft ? { suplierName: supplierDraft.name } : { suplierId }),
      items: rows.map(({ stockItemId, quantity, unit, unitPrice }) => {
        const draft = extraItems.find((item) => item.id === stockItemId);
        const parsedQuantity = parseShoppingQuantity(quantity);

        return {
          ...(draft ? { itemName: draft.name } : { stockItemId }),
          quantity: parsedQuantity,
          unit,
          unitPrice: unitPriceFromTotal(parsedQuantity, unitPrice),
        };
      }),
    };
    const signature = JSON.stringify(payload);

    if (!submission.current || submission.current.signature !== signature) {
      submission.current = { signature, id: requestId() };
    }

    lock.current = true;
    setSaving(true);
    try {
      await savePurchase({ ...payload, requestId: submission.current.id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-items"] }),
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["shopping-suppliers"] }),
      ]);
      enqueueSnackbar("Belanja tersimpan dan stok berhasil ditambahkan.", {
        variant: "success",
      });
      closeForm();
      resetForm();
      setPage(1);
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.message ||
          "Belum mendapat konfirmasi penyimpanan. Coba simpan lagi dengan data yang sama.",
        { variant: "error" }
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  const refreshAfterItemChange = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stock-items"] }),
      queryClient.invalidateQueries({ queryKey: ["purchases"] }),
    ]);
  };
  const updateItemMutation = useMutation({
    mutationFn: updatePurchaseItem,
    onSuccess: async () => {
      enqueueSnackbar("Item belanja berhasil diubah.", { variant: "success" });
      setEditingHistoryItem(null);
      await refreshAfterItemChange();
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal mengubah item belanja.",
        { variant: "error" }
      );
    },
  });
  const deleteItemMutation = useMutation({
    mutationFn: deletePurchaseItem,
    onSuccess: async () => {
      enqueueSnackbar("Item belanja berhasil dihapus.", { variant: "success" });
      await refreshAfterItemChange();
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal menghapus item belanja.",
        { variant: "error" }
      );
    },
  });
  const openEditHistoryItem = (item) => {
    setEditingHistoryItem(item);
    setEditHistoryForm({
      quantity: String(item.quantity ?? ""),
      unit: item.unit || "",
      unitPrice: String(item.total ?? ""),
    });
  };
  const submitEditHistoryItem = (event) => {
    event.preventDefault();
    const quantity = parseShoppingQuantity(editHistoryForm.quantity);

    if (
      !editingHistoryItem ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !editHistoryForm.unit ||
      editHistoryForm.unitPrice === ""
    ) {
      enqueueSnackbar("Lengkapi gramasi, satuan, dan harga total.", {
        variant: "error",
      });
      return;
    }

    updateItemMutation.mutate({
      id: editingHistoryItem.id,
      quantity,
      unit: editHistoryForm.unit,
      unitPrice: unitPriceFromTotal(quantity, editHistoryForm.unitPrice),
    });
  };
  const removeHistoryItem = (item) => {
    if (!window.confirm(`Hapus belanja ${item.itemName || "barang"} ini?`)) return;

    deleteItemMutation.mutate(item.id);
  };

  return (
    <section className="mb-5 rounded-lg bg-[#1f1f1f] p-4 text-[#f5f5f5]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Bahan Belanjaan</h3>
          <p className="mt-1 text-sm text-[#ababab]">
            Riwayat belanja dikelompokkan per bahan.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {isAdmin && (
            <button
              className={`${buttonClass} whitespace-nowrap`}
              onClick={() => setShowForm(true)}
              type="button"
            >
              Tambah Bahan Belanjaan
            </button>
          )}
          <input
            className={`${inputClass} sm:w-64`}
            type="search"
            aria-label="Cari riwayat belanja"
            placeholder="Nama toko atau barang"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {history.isError && (
        <p role="alert" className="text-red-400">
          Riwayat belanja gagal dimuat.{" "}
          <button onClick={() => history.refetch()} className="underline" type="button">
            Coba lagi
          </button>
        </p>
      )}
      {history.isPending && <p>Memuat riwayat belanja...</p>}
      {!history.isPending && !history.isError && !itemGroups.length && (
        <p className="py-5 text-center text-[#ababab]">
          Belum ada belanja tersimpan.
        </p>
      )}

      {!history.isPending && !history.isError && itemGroups.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#444]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#202020] text-[#ababab]">
              <tr>
                <th className="p-3">Barang</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Toko</th>
                <th className="p-3">Gramasi</th>
                <th className="p-3 text-right">Harga Satuan</th>
                <th className="p-3 text-right">Jumlah</th>
                <th className="p-3 text-right">Masuk Stok</th>
                <th className="p-3 text-right">COGS Setelah</th>
              </tr>
            </thead>
            <tbody>
              {itemGroups.map((group) => {
                const item = group.histories[0];

                if (!item) return null;

                return (
                  <tr
                    key={group.stockItemId || group.itemName}
                    className="cursor-pointer border-t border-[#444] transition-colors hover:bg-[#262626]"
                    onClick={() => openHistoryDetail(group)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openHistoryDetail(group);
                      }
                    }}
                  >
                    <td className="p-3">
                      <strong className="block font-bold">{group.itemName}</strong>
                      <span className="mt-1 inline-flex rounded-md bg-[#262626] px-2 py-1 text-xs font-semibold text-[#ababab]">
                        {group.purchaseCount} history
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-3">
                      {String(item.purchaseDate).slice(0, 10)}
                      <p className="text-xs text-[#ababab]">
                        #{item.purchaseId} - {item.paymentMethod}
                      </p>
                    </td>
                    <td className="p-3">{item.supplierName}</td>
                    <td className="p-3">
                      {quantityDisplay(item.quantity, item.unit)}
                    </td>
                    <td className="p-3 text-right">{currency(item.unitPrice)}</td>
                    <td className="p-3 text-right">{currency(item.total)}</td>
                    <td className="p-3 text-right">
                      {quantityDisplay(item.stockQuantity, item.stockUnit)}
                    </td>
                    <td className="p-3 text-right">
                      {costDisplay(item.stockAverageCost, item.stockUnit)}
                      <p className="text-xs text-[#ababab]">
                        Nilai: {currency(item.stockValueAfter)}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        <button
          disabled={page <= 1 || history.isFetching}
          onClick={() => setPage((current) => current - 1)}
          className="disabled:opacity-40"
          type="button"
        >
          Sebelumnya
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages || history.isFetching}
          onClick={() => setPage((current) => current + 1)}
          className="disabled:opacity-40"
          type="button"
        >
          Berikutnya
        </button>
      </div>

      {selectedHistoryGroup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shopping-history-title"
          onClick={closeHistoryDetail}
        >
          <div
            className="max-h-[88vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex flex-col gap-3 border-b border-[#333] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="shopping-history-title" className="text-xl font-bold">
                  {selectedHistoryGroup.itemName}
                </h2>
                <p className="mt-1 text-sm text-[#ababab]">
                  {selectedHistoryGroup.purchaseCount} history pembelian
                </p>
              </div>
              <button
                type="button"
                onClick={closeHistoryDetail}
                className="w-fit rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
              >
                Tutup
              </button>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-[#262626] p-3">
                <span className="block text-xs font-semibold text-[#ababab]">
                  Stok Sekarang
                </span>
                <strong className="mt-1 block">
                  {selectedHistoryGroup.stock == null
                    ? "-"
                    : quantityDisplay(
                        selectedHistoryGroup.stock,
                        selectedHistoryGroup.stockUnit
                      )}
                </strong>
              </div>
              <div className="rounded-lg bg-[#262626] p-3">
                <span className="block text-xs font-semibold text-[#ababab]">
                  Nilai Asset
                </span>
                <strong className="mt-1 block">
                  {assetDisplay(
                    selectedHistoryGroup.stockValue,
                    selectedHistoryGroup.stockUnit
                  )}
                </strong>
              </div>
              <div className="rounded-lg bg-[#262626] p-3">
                <span className="block text-xs font-semibold text-[#ababab]">
                  COGS Sekarang
                </span>
                <strong className="mt-1 block text-[#f6d365]">
                  {costDisplay(
                    selectedHistoryGroup.averageCost,
                    selectedHistoryGroup.stockUnit
                  )}
                </strong>
              </div>
            </div>
            <div className="mb-4 flex w-fit rounded-lg bg-[#181818] p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => {
                  setHistoryDetailTab("history");
                }}
                className={`rounded-md px-4 py-2 transition-colors ${
                  historyDetailTab === "history"
                    ? "bg-[#a79981] text-[#101010]"
                    : "text-[#ababab] hover:bg-[#333] hover:text-white"
                }`}
              >
                Riwayat
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryDetailTab("logs");
                }}
                className={`rounded-md px-4 py-2 transition-colors ${
                  historyDetailTab === "logs"
                    ? "bg-[#a79981] text-[#101010]"
                    : "text-[#ababab] hover:bg-[#333] hover:text-white"
                }`}
              >
                Log Aktivitas
              </button>
            </div>

            {historyDetailTab === "history" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[#ababab]">
                    <tr>
                      <th className="p-2">Tanggal</th>
                      <th className="p-2">Toko</th>
                      <th className="p-2">Gramasi</th>
                      <th className="p-2 text-right">Harga Satuan</th>
                      <th className="p-2 text-right">Jumlah</th>
                      <th className="p-2 text-right">Masuk Stok</th>
                      <th className="p-2 text-right">COGS Setelah</th>
                      {isAdmin && <th className="p-2 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHistoryGroup.histories.map((item) => (
                      <tr key={item.id} className="border-t border-[#444]">
                        <td className="whitespace-nowrap p-2">
                          {String(item.purchaseDate).slice(0, 10)}
                          <p className="text-xs text-[#ababab]">
                            #{item.purchaseId} - {item.paymentMethod}
                          </p>
                        </td>
                        <td className="p-2">{item.supplierName}</td>
                        <td className="p-2">
                          {quantityDisplay(item.quantity, item.unit)}
                        </td>
                        <td className="p-2 text-right">
                          {currency(item.unitPrice)}
                        </td>
                        <td className="p-2 text-right">{currency(item.total)}</td>
                        <td className="p-2 text-right">
                          {quantityDisplay(item.stockQuantity, item.stockUnit)}
                        </td>
                        <td className="p-2 text-right">
                          {costDisplay(item.stockAverageCost, item.stockUnit)}
                          <p className="text-xs text-[#ababab]">
                            Nilai: {currency(item.stockValueAfter)}
                          </p>
                        </td>
                        {isAdmin && (
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditHistoryItem(item)}
                                className="rounded-md bg-[#2b2b2b] px-3 py-1.5 text-sm font-semibold text-[#f5f5f5] hover:bg-[#3a3a3a]"
                              >
                                Update
                              </button>
                              <button
                                type="button"
                                onClick={() => removeHistoryItem(item)}
                                disabled={deleteItemMutation.isPending}
                                className="rounded-md bg-[#331f1f] px-3 py-1.5 text-sm font-semibold text-red-300 hover:bg-[#442424] disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[#ababab]">
                    <tr>
                      <th className="p-2">Waktu</th>
                      <th className="p-2">User</th>
                      <th className="p-2">Aksi</th>
                      <th className="p-2">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedHistoryGroup.logs || []).map((log) => (
                      <tr key={log.id} className="border-t border-[#444]">
                        <td className="whitespace-nowrap p-2">
                          {new Date(log.createdAt).toLocaleString("id-ID")}
                        </td>
                        <td className="p-2">{log.userName || "-"}</td>
                        <td className="p-2 font-semibold">
                          {log.action === "create"
                            ? "Tambah"
                            : log.action === "delete"
                              ? "Hapus"
                              : "Edit"}
                        </td>
                        <td className="p-2 text-[#ababab]">
                          {log.action === "create"
                            ? `${quantityDisplay(log.newData?.quantity, log.newData?.unit)} ditambahkan, harga ${currency(log.newData?.unitPrice)}`
                            : log.action === "delete"
                              ? `${quantityDisplay(log.oldData?.quantity, log.oldData?.unit)} dihapus`
                              : `${quantityDisplay(log.oldData?.quantity, log.oldData?.unit)} -> ${quantityDisplay(log.newData?.quantity, log.newData?.unit)}, ${currency(log.oldData?.unitPrice)} -> ${currency(log.newData?.unitPrice)}`}
                        </td>
                      </tr>
                    ))}
                    {!(selectedHistoryGroup.logs || []).length && (
                      <tr>
                        <td className="p-3 text-center text-[#ababab]" colSpan={4}>
                          Belum ada log aktivitas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {editingHistoryItem && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shopping-item-edit-title"
        >
          <form
            onSubmit={submitEditHistoryItem}
            className="w-full max-w-xl rounded-xl bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#333] pb-4">
              <div>
                <h2 id="shopping-item-edit-title" className="text-xl font-bold">
                  Edit Belanja {editingHistoryItem.itemName || selectedHistoryGroup?.itemName}
                </h2>
                <p className="mt-1 text-sm text-[#ababab]">
                  Perubahan akan tercatat di log aktivitas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingHistoryItem(null)}
                className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold"
              >
                Tutup
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label>
                <span className="mb-1 block text-sm">Gramasi</span>
                <input
                  value={editHistoryForm.quantity}
                  onChange={(event) =>
                    setEditHistoryForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                />
              </label>
              <div>
                <span className="mb-1 block text-sm">Satuan</span>
                <CreatableSelect2
                  options={unitOptions}
                  value={editHistoryForm.unit}
                  onSelect={(option) =>
                    setEditHistoryForm((current) => ({
                      ...current,
                      unit: option?.id || "",
                    }))
                  }
                  placeholder="Pilih satuan"
                  label="Satuan"
                  disabled={updateItemMutation.isPending}
                />
              </div>
              <label>
                <span className="mb-1 block text-sm">
                  Harga Total
                </span>
                <input
                  value={formatRupiahInput(editHistoryForm.unitPrice)}
                  onChange={(event) =>
                    setEditHistoryForm((current) => ({
                      ...current,
                      unitPrice: event.target.value.replace(/\D/g, ""),
                    }))
                  }
                  type="text"
                  inputMode="numeric"
                  className={inputClass}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingHistoryItem(null)}
                className="px-4 py-2"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={updateItemMutation.isPending}
                className={buttonClass}
              >
                {updateItemMutation.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shopping-form-title"
        >
          <form
            onSubmit={submit}
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-[#1f1f1f] p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="shopping-form-title" className="text-xl font-bold">
                  Tambah Bahan Belanjaan
                </h2>
                <p className="mt-1 text-sm text-[#ababab]">
                  Pilih "Buat" jika nama belum tersedia. Toko dan barang baru
                  tersimpan saat klik Simpan Belanjaan.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={closeForm}
                aria-label="Tutup form"
                className="p-2"
              >
                x
              </button>
            </div>
            <fieldset disabled={saving} className="min-w-0">
              <div className="grid gap-4 md:grid-cols-3">
                <label>
                  <span className="mb-1 block text-sm">Tanggal</span>
                  <input
                    required
                    type="date"
                    className={inputClass}
                    value={form.date}
                    onChange={(event) =>
                      setForm({ ...form, date: event.target.value })
                    }
                  />
                </label>
                <div>
                  <span className="mb-1 block text-sm">Toko / Sumber</span>
                  <CreatableSelect2
                    options={supplierOptions}
                    value={form.suplierId}
                    onSelect={(option) =>
                      setForm((current) => ({
                        ...current,
                        suplierId: option?.id || "",
                      }))
                    }
                    onCreate={addSupplier}
                    placeholder="Cari atau buat toko/sumber"
                    disabled={saving}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-sm">Pembayaran</span>
                  <CreatableSelect2
                    options={paymentOptions}
                    value={form.paymentMethod}
                    onSelect={(option) =>
                      setForm((current) => ({
                        ...current,
                        paymentMethod: option?.id || "Cash",
                      }))
                    }
                    placeholder="Pilih pembayaran"
                    label="Pembayaran"
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="my-5 space-y-3">
                {rows.map((row, index) => {
                  const selectedItem = itemOptions.find(
                    (item) => String(item.id) === String(row.stockItemId)
                  );

                  return (
                    <div key={row.key} className="rounded-lg border border-[#444] p-3">
                      <div className="mb-3 flex items-center justify-between gap-3 text-sm text-[#ababab]">
                        <span>Barang {index + 1}</span>
                        <button
                          type="button"
                          disabled={rows.length === 1}
                          aria-label={`Hapus barang ${index + 1}`}
                          title={
                            rows.length === 1
                              ? "Minimal satu barang dalam belanja"
                              : "Hapus barang ini"
                          }
                          onClick={() =>
                            setRows((current) =>
                              current.filter((item) => item.key !== row.key)
                            )
                          }
                          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:border-red-400/60 hover:bg-red-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:border-[#444] disabled:bg-[#262626] disabled:text-[#777]"
                        >
                          <FiTrash2 size={15} aria-hidden="true" />
                          Hapus
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_minmax(80px,.6fr)_minmax(90px,.7fr)_minmax(120px,1fr)_minmax(120px,1fr)]">
                        <div>
                          <span className="mb-1 block text-sm">Nama Barang</span>
                          <CreatableSelect2
                            options={itemOptions}
                            value={row.stockItemId}
                            onSelect={(option) =>
                              updateRow(row.key, {
                                stockItemId: option?.id || "",
                                unit: purchaseUnitForStockUnit(option?.unit),
                              })
                            }
                            onCreate={addItem}
                            placeholder="Cari atau buat barang"
                            disabled={saving}
                          />
                        </div>
                        <label>
                          <span className="mb-1 block text-sm">Gramasi</span>
                          <input
                            required
                            type="text"
                            inputMode="decimal"
                            value={row.quantity}
                            onChange={(event) =>
                              updateRow(row.key, { quantity: event.target.value })
                            }
                            className={inputClass}
                          />
                        </label>
                        <div>
                          <span className="mb-1 block text-sm">Satuan</span>
                          <CreatableSelect2
                            options={unitOptions}
                            value={row.unit}
                            onSelect={(option) =>
                              updateRow(row.key, { unit: option?.id || "" })
                            }
                            placeholder="Pilih satuan"
                            label="Satuan"
                            disabled={saving}
                          />
                        </div>
                        <label>
                          <span className="mb-1 block text-sm">
                            Harga Total
                          </span>
                          <input
                            required
                            type="text"
                            inputMode="numeric"
                            value={formatRupiahInput(row.unitPrice)}
                            onChange={(event) =>
                              updateRow(row.key, {
                                unitPrice: event.target.value.replace(/\D/g, ""),
                              })
                            }
                            className={inputClass}
                          />
                        </label>
                        <div>
                          <span className="mb-1 block text-sm">Jumlah</span>
                          <p className="py-2 font-bold">{currency(lineTotal(row))}</p>
                        </div>
                      </div>
                      {selectedItem?.unit && (
                        <p className="mt-2 text-xs text-[#ababab]">
                          Satuan stok: {selectedItem.unit}. Isi gramasi sesuai satuan
                          stok; COGS dihitung otomatis dari harga total.
                          otomatis.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={rows.length >= 100}
                onClick={() => setRows((current) => [...current, blankRow()])}
                className="mb-4 rounded-lg border border-[#a79981] px-4 py-2 text-sm text-[#d6c7ae]"
              >
                + Tambah Barang
              </button>
              <label className="block">
                <span className="mb-1 block text-sm">Catatan (opsional)</span>
                <textarea
                  className={inputClass}
                  maxLength={500}
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                />
              </label>
            </fieldset>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <strong>
                Total: {currency(rows.reduce((sum, row) => sum + lineTotal(row), 0))}
              </strong>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeForm}
                  className="px-4 py-2"
                >
                  Tutup
                </button>
                <button type="submit" disabled={saving} className={buttonClass}>
                  {saving ? "Menyimpan..." : "Simpan Belanjaan"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
