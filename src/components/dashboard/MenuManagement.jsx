import React, { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  addCategory,
  addMenuItem,
  deleteCategory,
  deleteMenuItem,
  getCategories,
  getMenuItems,
  updateCategory,
  updateMenuItem,
} from "../../https";
import { formatCurrency } from "../../utils";

const iconOptions = [
  "☕",
  "🍵",
  "🥤",
  "🧋",
  "🧃",
  "🥛",
  "🍹",
  "🍚",
  "🍛",
  "🍜",
  "🍝",
  "🍲",
  "🥘",
  "🍱",
  "🍙",
  "🍣",
  "🍤",
  "🥟",
  "🍗",
  "🍖",
  "🥩",
  "🍔",
  "🍕",
  "🌭",
  "🥪",
  "🌮",
  "🌯",
  "🍟",
  "🍿",
  "🥨",
  "🥐",
  "🥖",
  "🍞",
  "🧇",
  "🥞",
  "🍳",
  "🥗",
  "🍰",
  "🧁",
  "🥧",
  "🍮",
  "🍩",
  "🍪",
  "🍦",
  "🍨",
  "🍧",
  "🍌",
  "🍓",
  "🥭",
  "🥡",
  "🧾",
  "➕",
];

const emptyCategoryForm = {
  isActive: true,
  name: "",
  icon: "☕",
};

const emptyMenuForm = {
  categoryId: "",
  isAvailable: true,
  name: "",
  price: "",
  imageUrl: "",
};

const ITEMS_PER_PAGE = 10;

const MenuManagement = () => {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("categories");
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [menuForm, setMenuForm] = useState(emptyMenuForm);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState("");
  const [categoryPage, setCategoryPage] = useState(1);
  const [menuPage, setMenuPage] = useState(1);

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories", "management"],
    queryFn: () => getCategories({ includeInactive: true }),
    placeholderData: keepPreviousData,
  });

  const { data: menuItemsRes } = useQuery({
    queryKey: ["menu-items", "management"],
    queryFn: () => getMenuItems({ includeUnavailable: true }),
    placeholderData: keepPreviousData,
  });

  const categories = categoriesRes?.data?.data || [];
  const menuItems = menuItemsRes?.data?.data || [];

  const refreshMenuData = () => {
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    queryClient.invalidateQueries({ queryKey: ["menu-items"] });
  };

  const categoryMutation = useMutation({
    mutationFn: (payload) =>
      editingCategory
        ? updateCategory({ categoryId: editingCategory.id || editingCategory._id, ...payload })
        : addCategory(payload),
    onSuccess: () => {
      refreshMenuData();
      enqueueSnackbar(
        editingCategory ? "Category berhasil diubah." : "Category berhasil ditambahkan.",
        { variant: "success" }
      );
      setCategoryForm(emptyCategoryForm);
      setEditingCategory(null);
    },
    onError: () => {
      enqueueSnackbar("Gagal menyimpan category.", { variant: "error" });
    },
  });

  const menuItemMutation = useMutation({
    mutationFn: (payload) =>
      editingMenuItem
        ? updateMenuItem({
            menuItemId: editingMenuItem.id || editingMenuItem._id,
            ...payload,
          })
        : addMenuItem(payload),
    onSuccess: () => {
      refreshMenuData();
      enqueueSnackbar(
        editingMenuItem ? "Menu berhasil diubah." : "Menu berhasil ditambahkan.",
        { variant: "success" }
      );
      setMenuForm(emptyMenuForm);
      setEditingMenuItem(null);
    },
    onError: () => {
      enqueueSnackbar("Gagal menyimpan menu.", { variant: "error" });
    },
  });

  const categoryDeleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      refreshMenuData();
      enqueueSnackbar("Category berhasil dihapus.", { variant: "success" });
      setCategoryPendingDelete(null);
    },
    onError: () => {
      enqueueSnackbar("Gagal menghapus category.", { variant: "error" });
    },
  });

  const menuDeleteMutation = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => {
      refreshMenuData();
      enqueueSnackbar("Menu berhasil dihapus.", { variant: "success" });
    },
    onError: () => {
      enqueueSnackbar("Gagal menghapus menu.", { variant: "error" });
    },
  });

  const filteredCategories = useMemo(() => {
    const keyword = categorySearch.trim().toLowerCase();
    if (!keyword) return categories;

    return categories.filter((category) =>
      [category.name, category.icon].join(" ").toLowerCase().includes(keyword)
    );
  }, [categories, categorySearch]);

  const filteredMenuItems = useMemo(() => {
    const keyword = menuSearch.trim().toLowerCase();
    const selectedCategoryId = String(menuCategoryFilter || "");

    return menuItems.filter((item) =>
      (!selectedCategoryId ||
        String(item.categoryId || item.category?.id || item.category?._id) ===
          selectedCategoryId) &&
      (!keyword ||
        [item.name, item.category?.name, item.price]
          .join(" ")
          .toLowerCase()
          .includes(keyword))
    );
  }, [menuItems, menuSearch, menuCategoryFilter]);

  const categoryTotalPages = Math.max(
    1,
    Math.ceil(filteredCategories.length / ITEMS_PER_PAGE)
  );
  const menuTotalPages = Math.max(
    1,
    Math.ceil(filteredMenuItems.length / ITEMS_PER_PAGE)
  );
  const paginatedCategories = filteredCategories.slice(
    (categoryPage - 1) * ITEMS_PER_PAGE,
    categoryPage * ITEMS_PER_PAGE
  );
  const paginatedMenuItems = filteredMenuItems.slice(
    (menuPage - 1) * ITEMS_PER_PAGE,
    menuPage * ITEMS_PER_PAGE
  );
  const categoryStart = filteredCategories.length
    ? (categoryPage - 1) * ITEMS_PER_PAGE + 1
    : 0;
  const categoryEnd = Math.min(
    categoryPage * ITEMS_PER_PAGE,
    filteredCategories.length
  );
  const menuStart = filteredMenuItems.length
    ? (menuPage - 1) * ITEMS_PER_PAGE + 1
    : 0;
  const menuEnd = Math.min(menuPage * ITEMS_PER_PAGE, filteredMenuItems.length);

  useEffect(() => {
    setCategoryPage(1);
  }, [categorySearch]);

  useEffect(() => {
    setMenuPage(1);
  }, [menuSearch, menuCategoryFilter]);

  useEffect(() => {
    if (categoryPage > categoryTotalPages) {
      setCategoryPage(categoryTotalPages);
    }
  }, [categoryPage, categoryTotalPages]);

  useEffect(() => {
    if (menuPage > menuTotalPages) {
      setMenuPage(menuTotalPages);
    }
  }, [menuPage, menuTotalPages]);

  const updateCategoryForm = (field, value) => {
    setCategoryForm((current) => ({ ...current, [field]: value }));
  };

  const updateMenuForm = (field, value) => {
    setMenuForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmitCategory = (event) => {
    event.preventDefault();

    if (!categoryForm.name.trim()) {
      enqueueSnackbar("Nama category wajib diisi.", { variant: "warning" });
      return;
    }

    categoryMutation.mutate({
      name: categoryForm.name.trim(),
      icon: categoryForm.icon.trim(),
      isActive: Boolean(categoryForm.isActive),
    });
  };

  const handleSubmitMenuItem = (event) => {
    event.preventDefault();

    if (!menuForm.categoryId || !menuForm.name.trim() || menuForm.price === "") {
      enqueueSnackbar("Category, nama menu, dan harga wajib diisi.", {
        variant: "warning",
      });
      return;
    }

    menuItemMutation.mutate({
      categoryId: menuForm.categoryId,
      name: menuForm.name.trim(),
      price: Number(menuForm.price) || 0,
      imageUrl: menuForm.imageUrl.trim(),
      isAvailable: Boolean(menuForm.isAvailable),
    });
  };

  const startEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      isActive: category.isActive !== false,
      name: category.name,
      icon: category.icon || "☕",
    });
  };

  const startEditMenuItem = (item) => {
    setEditingMenuItem(item);
    setMenuForm({
      categoryId: String(item.categoryId || item.category?.id || ""),
      isAvailable: item.isAvailable !== false,
      name: item.name,
      price: String(item.price),
      imageUrl: item.imageUrl || "",
    });
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
  };

  const resetMenuForm = () => {
    setEditingMenuItem(null);
    setMenuForm(emptyMenuForm);
  };

  const getCategoryMenuCount = (category) => {
    const categoryId = String(category?.id || category?._id || "");

    return menuItems.filter(
      (item) => String(item.categoryId || item.category?.id || item.category?._id) === categoryId
    ).length;
  };

  const confirmDeleteCategory = () => {
    if (!categoryPendingDelete) return;

    categoryDeleteMutation.mutate(
      categoryPendingDelete.id || categoryPendingDelete._id
    );
  };

  return (
    <div className="container mx-auto bg-[#262626] p-4 rounded-lg">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#f5f5f5]">
            Menu Management
          </h2>
          <p className="mt-1 text-sm text-[#ababab]">
            Kelola category dan item menu untuk POS.
          </p>
        </div>
        <div className="flex rounded-lg bg-[#1f1f1f] p-1">
          {[
            ["categories", "Categories"],
            ["menus", "Menu Items"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={`rounded-md px-4 py-2 text-sm font-bold ${
                activeSection === key
                  ? "bg-[#a79981] text-[#101010]"
                  : "text-[#ababab]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === "categories" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleSubmitCategory}
            className="rounded-lg bg-[#1f1f1f] p-4"
          >
            <h3 className="text-lg font-bold text-[#f5f5f5]">
              {editingCategory ? "Ubah Category" : "Tambah Category"}
            </h3>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Nama Category
              <input
                value={categoryForm.name}
                onChange={(event) => updateCategoryForm("name", event.target.value)}
                placeholder="Coffee"
                className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Icon
              <input
                value={categoryForm.icon}
                onChange={(event) => updateCategoryForm("icon", event.target.value)}
                className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
              />
            </label>
            <div className="mt-3 grid max-h-44 grid-cols-5 gap-2 overflow-y-auto pr-1">
              {iconOptions.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => updateCategoryForm("icon", icon)}
                  className={`flex h-10 items-center justify-center rounded-lg text-xl ${
                    categoryForm.icon === icon ? "bg-[#a79981]" : "bg-[#262626]"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Status
              <select
                value={categoryForm.isActive ? "active" : "inactive"}
                onChange={(event) =>
                  updateCategoryForm("isActive", event.target.value === "active")
                }
                className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={categoryMutation.isPending}
                className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-60"
              >
                {categoryMutation.isPending
                  ? "Menyimpan..."
                  : editingCategory
                    ? "Simpan"
                    : "Tambah"}
              </button>
              {editingCategory && (
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
                >
                  Batal
                </button>
              )}
            </div>
          </form>

          <div className="rounded-lg bg-[#1f1f1f] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold text-[#f5f5f5]">
                Categories
              </h3>
              <input
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
                type="search"
                placeholder="Search category"
                className="rounded-lg bg-[#262626] px-4 py-2 text-sm text-[#f5f5f5] outline-none"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[#f5f5f5]">
                <thead className="bg-[#333] text-[#ababab]">
                  <tr>
                    <th className="p-3">Icon</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCategories.map((category) => (
                    <tr
                      key={category.id || category._id}
                      className="border-b border-gray-600 hover:bg-[#333]"
                    >
                      <td className="p-4 text-xl">{category.icon || "-"}</td>
                      <td className="p-4 font-semibold">{category.name}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex rounded-md px-3 py-1 text-xs font-bold ${
                            category.isActive
                              ? "bg-green-900/60 text-green-300"
                              : "bg-red-900/60 text-red-300"
                          }`}
                        >
                          {category.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-4 text-sm font-semibold">
                          <button
                            type="button"
                            onClick={() => startEditCategory(category)}
                            className="text-[#a79981] hover:text-[#d6c7ae]"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryPendingDelete(category)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCategories.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-[#ababab]" colSpan={4}>
                        No categories found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm text-[#ababab] sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {categoryStart} - {categoryEnd} of{" "}
                {filteredCategories.length}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCategoryPage((page) => Math.max(1, page - 1))}
                  disabled={categoryPage === 1}
                  className="rounded-lg bg-[#262626] px-3 py-2 font-bold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="font-bold text-[#f5f5f5]">
                  {categoryPage} / {categoryTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCategoryPage((page) =>
                      Math.min(categoryTotalPages, page + 1)
                    )
                  }
                  disabled={categoryPage === categoryTotalPages}
                  className="rounded-lg bg-[#262626] px-3 py-2 font-bold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === "menus" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleSubmitMenuItem}
            className="rounded-lg bg-[#1f1f1f] p-4"
          >
            <h3 className="text-lg font-bold text-[#f5f5f5]">
              {editingMenuItem ? "Ubah Menu" : "Tambah Menu"}
            </h3>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Category
              <select
                value={menuForm.categoryId}
                onChange={(event) => updateMenuForm("categoryId", event.target.value)}
                className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
              >
                <option value="">Pilih category</option>
                {categories.map((category) => (
                  <option key={category.id || category._id} value={category.id || category._id}>
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Nama Menu
              <input
                value={menuForm.name}
                onChange={(event) => updateMenuForm("name", event.target.value)}
                placeholder="Latte"
                className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Harga
              <input
                value={menuForm.price}
                onChange={(event) => updateMenuForm("price", event.target.value)}
                type="number"
                min="0"
                placeholder="18000"
                className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Image URL
              <input
                value={menuForm.imageUrl}
                onChange={(event) => updateMenuForm("imageUrl", event.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Status
              <select
                value={menuForm.isAvailable ? "available" : "unavailable"}
                onChange={(event) =>
                  updateMenuForm(
                    "isAvailable",
                    event.target.value === "available"
                  )
                }
                className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
              >
                <option value="available">Tersedia</option>
                <option value="unavailable">Tidak Tersedia</option>
              </select>
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={menuItemMutation.isPending}
                className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] disabled:opacity-60"
              >
                {menuItemMutation.isPending
                  ? "Menyimpan..."
                  : editingMenuItem
                    ? "Simpan"
                    : "Tambah"}
              </button>
              {editingMenuItem && (
                <button
                  type="button"
                  onClick={resetMenuForm}
                  className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
                >
                  Batal
                </button>
              )}
            </div>
          </form>

          <div className="rounded-lg bg-[#1f1f1f] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold text-[#f5f5f5]">Menu Items</h3>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={menuCategoryFilter}
                  onChange={(event) => setMenuCategoryFilter(event.target.value)}
                  className="rounded-lg bg-[#262626] px-4 py-2 text-sm text-[#f5f5f5] outline-none"
                >
                  <option value="">Semua kategori</option>
                  {categories.map((category) => (
                    <option
                      key={category.id || category._id}
                      value={category.id || category._id}
                    >
                      {category.icon ? `${category.icon} ` : ""}
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  type="search"
                  placeholder="Search menu"
                  className="rounded-lg bg-[#262626] px-4 py-2 text-sm text-[#f5f5f5] outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[#f5f5f5]">
                <thead className="bg-[#333] text-[#ababab]">
                  <tr>
                    <th className="p-3">Menu</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Harga</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMenuItems.map((item) => (
                    <tr
                      key={item.id || item._id}
                      className="border-b border-gray-600 hover:bg-[#333]"
                    >
                      <td className="p-4 font-semibold">{item.name}</td>
                      <td className="p-4">{item.category?.name || "-"}</td>
                      <td className="p-4">{formatCurrency(item.price)}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex rounded-md px-3 py-1 text-xs font-bold ${
                            item.isAvailable
                              ? "bg-green-900/60 text-green-300"
                              : "bg-red-900/60 text-red-300"
                          }`}
                        >
                          {item.isAvailable ? "Tersedia" : "Tidak Tersedia"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-4 text-sm font-semibold">
                          <button
                            type="button"
                            onClick={() => startEditMenuItem(item)}
                            className="text-[#a79981] hover:text-[#d6c7ae]"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              menuDeleteMutation.mutate(item.id || item._id)
                            }
                            className="text-red-400 hover:text-red-300"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMenuItems.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-[#ababab]" colSpan={5}>
                        No menu items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm text-[#ababab] sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {menuStart} - {menuEnd} of {filteredMenuItems.length}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMenuPage((page) => Math.max(1, page - 1))}
                  disabled={menuPage === 1}
                  className="rounded-lg bg-[#262626] px-3 py-2 font-bold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="font-bold text-[#f5f5f5]">
                  {menuPage} / {menuTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setMenuPage((page) => Math.min(menuTotalPages, page + 1))
                  }
                  disabled={menuPage === menuTotalPages}
                  className="rounded-lg bg-[#262626] px-3 py-2 font-bold text-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {categoryPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg bg-[#262626] p-5 shadow-2xl">
            <div className="mb-4">
              <p className="text-sm font-bold uppercase tracking-wide text-red-400">
                Danger Action
              </p>
              <h3 className="mt-2 text-xl font-bold text-[#f5f5f5]">
                Hapus category?
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#ababab]">
                Category{" "}
                <span className="font-bold text-[#f5f5f5]">
                  {categoryPendingDelete.name}
                </span>{" "}
                akan dihapus permanen. Semua menu di dalam category ini juga
                akan ikut terhapus.
              </p>
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm font-semibold text-red-200">
                {getCategoryMenuCount(categoryPendingDelete)} menu akan ikut
                terdampak oleh penghapusan ini.
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCategoryPendingDelete(null)}
                disabled={categoryDeleteMutation.isPending}
                className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                disabled={categoryDeleteMutation.isPending}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {categoryDeleteMutation.isPending ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
