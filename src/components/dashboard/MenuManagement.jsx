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
  getSemiItems,
  getStockItems,
  uploadMenuImage,
  updateCategory,
  updateCategoryPositions,
  updateMenuItem,
} from "../../https";
import { formatCurrency } from "../../utils";
import { backendBaseUrl } from "../../https/backendUrl";
import CreatableSelect2 from "../shared/CreatableSelect2";
import { bundleContentsText } from "../../features/pos/utils/bundleChoices";
import { MdErrorOutline } from "react-icons/md";

const iconOptions = [
  "☕",
  "🍵",
  "🥤",
  "🧋",
  "🧃",
  "🥛",
  "🍹",
  "🍾",
  "🍶",
  "🫙",
  "🫖",
  "🔥",
  "♨️",
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
  "🏷️",
  "🎟️",
  "➕",
];

const categoryStatusOptions = [
  { id: "active", text: "Aktif" },
  { id: "inactive", text: "Nonaktif" },
];
const menuAvailabilityOptions = [
  { id: "available", text: "Tersedia" },
  { id: "unavailable", text: "Tidak Tersedia" },
];

const emptyCategoryForm = {
  isActive: true,
  isBundle: false,
  name: "",
  icon: "☕",
  taxRate: "",
};

const emptyMenuForm = {
  categoryId: "",
  isAvailable: true,
  name: "",
  regularPrice: "",
  includeOnlinePlatform: false,
  onlinePrice: "",
  hppCost: "",
  grossProfit: "",
  ingredients: [],
  bundleItems: [],
  discountPercent: "",
  imageFile: null,
  imagePath: "",
};

const ITEMS_PER_PAGE = 10;
const HIDE_AUTO_HPP_FIELD = true;

const resolveMenuImageUrl = (imagePath) => {
  if (!imagePath) return "";
  if (/^(https?:|data:|blob:)/.test(imagePath)) return imagePath;
  if (imagePath.startsWith("/uploads/")) return `${backendBaseUrl}${imagePath}`;

  return imagePath;
};

const normalizeMoneyInput = (value) => {
  const text = String(value ?? "").trim().replace(/\s/g, "");
  if (!text) return "";

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    return text.replace(/\./g, "").replace(",", ".");
  }

  if (hasComma) {
    return text.replace(",", ".");
  }

  if (hasDot) {
    const parts = text.split(".");
    const lastPart = parts[parts.length - 1];
    const looksLikeThousands =
      parts.length > 1 &&
      lastPart.length === 3 &&
      parts.every((part) => /^\d+$/.test(part));

    return looksLikeThousands ? text.replace(/\./g, "") : text;
  }

  return text;
};

const parseMoneyInput = (value, fallback = 0) => {
  const normalized = normalizeMoneyInput(value);
  if (!normalized) return fallback;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isValidMoneyInput = (value) => {
  if (value === "" || value === null || value === undefined) return true;

  const normalized = normalizeMoneyInput(value);
  return normalized !== "" && Number.isFinite(Number(normalized));
};

const getCategoryId = (category) => String(category?.id || category?._id || "");
const getMenuItemId = (item) => String(item?.id || item?._id || "");

// Kategori Promo: a menu of a promo category (isBundle) is a package of other
// menus (bundleItems), never of another package.
const isPackageMenu = (item) =>
  Boolean(item?.isBundle) ||
  (item?.bundleItems?.length || 0) > 0 ||
  (item?.bundleChoices?.length || 0) > 0;
// A package line is a menu ({ menuItemId }) or a choice ({ isChoice,
// categoryId, label, menuItemIds }: N of its menus, of any category, that the
// cashier picks when ordering). A choice is named after its category unless
// it has a label; one whose category was deleted only has its label.
const bundleLineKey = (line) => {
  if (!line.isChoice) return String(line.menuItemId);
  return line.categoryId ? `category:${line.categoryId}` : `choice:${line.choiceId}`;
};
// Persentase Keuntungan: untung kotor (harga reguler - HPP) over the harga
// reguler, e.g. Americano Rp 12.444 of Rp 15.000 = 83%; null without a price.
const profitPercentOf = (item) => {
  const price = Number(item?.regularPrice ?? item?.price ?? 0);
  if (!(price > 0)) return null;
  return (Number(item.grossProfit ?? item.profit ?? 0) / price) * 100;
};
const formatPercent = (percent) =>
  `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(percent)}%`;
// Normal price of one portion of a line; a choice has none (the cashier
// picks the menus).
const getBundleLinePrice = (line, menuItemsById) => {
  if (line.isChoice) return 0;

  const item = menuItemsById.get(String(line.menuItemId));
  return Number(item?.regularPrice ?? item?.price ?? 0);
};
const normalizeStockUnit = (unit) => String(unit || "").trim().toLowerCase();

// A recipe line uses a bahan baku (stockItemId) or a bahan olahan
// (semiItemId); the form keys both as "raw:<id>" / "semi:<id>" and picks the
// kind first.
const INGREDIENT_KINDS = [
  { key: "raw", label: "Bahan Baku" },
  { key: "semi", label: "Bahan Olahan" },
];
const kindOfKey = (key) => (String(key || "").startsWith("semi:") ? "semi" : "raw");

const getIngredientKey = (ingredient) => {
  if (ingredient?.semiItemId) return `semi:${ingredient.semiItemId}`;
  if (ingredient?.stockItemId) return `raw:${ingredient.stockItemId}`;
  return "";
};

const fromIngredientKey = (key) => {
  const [kind, id] = String(key || "").split(":");
  const itemId = Number(id) || null;

  return kind === "semi"
    ? { stockItemId: null, semiItemId: itemId }
    : { stockItemId: itemId, semiItemId: null };
};

const getCogsDisplay = (stockItem) => {
  if (!stockItem) return "COGS: -";

  const unit = normalizeStockUnit(stockItem.unit);
  const averageCost = Number(stockItem.averageCost || 0);

  if (["gr", "g", "gram"].includes(unit)) {
    return `COGS: ${formatCurrency(averageCost)} / gr`;
  }

  if (["ml", "milliliter", "mililiter"].includes(unit)) {
    return `COGS: ${formatCurrency(averageCost)} / ml`;
  }

  return `COGS: ${formatCurrency(averageCost)} / ${stockItem.unit || "unit"}`;
};

// Quantities are in the item's own unit: a bahan olahan (Nasi) in portions.
const roundRecipeQuantity = (value) => Math.round((Number(value) || 0) * 10000) / 10000;

const getIngredientCost = (ingredient, stockItem) => {
  if (!stockItem) return 0;

  const quantity = Number(ingredient.quantity || 0);
  const averageCost = Number(stockItem.averageCost || 0);

  if (!Number.isFinite(quantity) || !Number.isFinite(averageCost)) return 0;

  return quantity * averageCost;
};

const getIngredientCostDescription = (ingredient, stockItem, cost) => {
  if (!stockItem) return "Pilih bahan stok dulu untuk menghitung cost.";

  const quantity = Number(ingredient.quantity || 0);
  const averageCost = Number(stockItem.averageCost || 0);

  return `${formatMoneyDisplay(averageCost)} x ${quantity || 0} ${stockItem.unit || ""} = ${formatMoneyDisplay(cost)}`;
};

const roundMoney = (value) =>
  Math.round((Number(value) || 0) * 100) / 100;

const formatMoneyDisplay = (value) =>
  Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });

// onCreateIngredient(kind, name): a recipe bahan the search did not find,
// made at Stok Bahan ("raw" Tambah Bahan, "semi" Tambah Bahan Olahan).
const MenuManagement = ({ onCreateIngredient }) => {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("categories");
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [menuForm, setMenuForm] = useState(emptyMenuForm);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [isMenuFormOpen, setIsMenuFormOpen] = useState(false);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState("");
  const [categoryPage, setCategoryPage] = useState(1);
  const [menuPage, setMenuPage] = useState(1);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [draggedCategoryId, setDraggedCategoryId] = useState("");

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

  const { data: stockItemsRes } = useQuery({
    queryKey: ["stock-items", "menu-management"],
    queryFn: getStockItems,
    placeholderData: keepPreviousData,
  });

  const { data: semiItemsRes } = useQuery({
    queryKey: ["semi-items", "menu-management"],
    queryFn: getSemiItems,
    placeholderData: keepPreviousData,
  });

  const categoriesData = categoriesRes?.data?.data;
  const categories = useMemo(() => categoriesData || [], [categoriesData]);
  const menuItemsData = menuItemsRes?.data?.data;
  const menuItems = useMemo(() => menuItemsData || [], [menuItemsData]);
  const stockItemsData = stockItemsRes?.data?.data;
  const semiItemsData = semiItemsRes?.data?.data;
  // Bahan baku, then bahan olahan (e.g. Nasi, used per portion).
  const stockItems = useMemo(
    () => [
      ...(stockItemsData || []).map((item) => ({ ...item, key: `raw:${item.id || item._id}` })),
      ...(semiItemsData || []).map((item) => ({ ...item, key: `semi:${item.id || item._id}` })),
    ],
    [stockItemsData, semiItemsData]
  );
  const findIngredientItem = (key) =>
    stockItems.find((stockItem) => stockItem.key === String(key || ""));
  const menuItemsById = useMemo(
    () => new Map(menuItems.map((item) => [getMenuItemId(item), item])),
    [menuItems]
  );
  const isBundleForm = Boolean(
    categories.find((category) => getCategoryId(category) === String(menuForm.categoryId))
      ?.isBundle
  );
  const editingMenuItemId = editingMenuItem ? getMenuItemId(editingMenuItem) : "";
  const bundleKeys = menuForm.bundleItems.map(bundleLineKey).join("|");
  // A promo sells at its price less its discount percent (e.g. 100% for a
  // Google Maps review).
  const discountText = String(menuForm.discountPercent ?? "").trim().replace(",", ".");
  const promoDiscount = isBundleForm && discountText ? Number(discountText) : 0;
  // Choices of ordinary categories and ordinary menus not yet in the package
  // (and never the package itself).
  const bundleMenuOptions = useMemo(() => {
    const chosen = new Set(bundleKeys.split("|"));
    return [
      { id: "", text: "Pilih menu" },
      ...categories
        .filter(
          (category) =>
            !category.isBundle &&
            category.isActive !== false &&
            !chosen.has(`category:${getCategoryId(category)}`)
        )
        .map((category) => ({
          id: `category:${getCategoryId(category)}`,
          text: `Pilihan ${category.name}`,
        })),
      ...menuItems
        .filter(
          (item) =>
            !isPackageMenu(item) &&
            getMenuItemId(item) !== editingMenuItemId &&
            !chosen.has(getMenuItemId(item))
        )
        .map((item) => ({
          id: getMenuItemId(item),
          text: item.isAvailable === false ? `${item.name} (tidak tersedia)` : item.name,
        })),
    ];
  }, [categories, menuItems, bundleKeys, editingMenuItemId]);
  // Ordinary menus of a category: what a package's choice can offer.
  const categoryMenusOf = (categoryId) =>
    menuItems.filter(
      (item) =>
        !isPackageMenu(item) &&
        String(item.categoryId ?? item.category?.id ?? "") === String(categoryId)
    );
  // A choice's name: its label, else its category's.
  const choiceNameOf = (line) =>
    String(line.label || "").trim() ||
    categories.find((category) => getCategoryId(category) === String(line.categoryId))?.name ||
    line.name ||
    "-";
  // Ordinary menus a choice can still offer, grouped per category (its own
  // first): Pilihan Coffee can offer Black Coffee and White Coffee menus.
  const choiceMenuOptionsOf = (line) => {
    const offered = new Set(line.menuItemIds || []);
    const own = String(line.categoryId || "");
    const ordered = [
      ...categories.filter((category) => own && getCategoryId(category) === own),
      ...categories.filter(
        (category) =>
          getCategoryId(category) !== own && !category.isBundle && category.isActive !== false
      ),
    ];
    return [
      { id: "", text: "Pilih menu" },
      ...ordered
        .map((category) => ({
          text: category.name,
          children: categoryMenusOf(getCategoryId(category))
            .filter((item) => !offered.has(getMenuItemId(item)))
            .map((item) => ({
              id: getMenuItemId(item),
              text: item.isAvailable === false ? `${item.name} (tidak tersedia)` : item.name,
            })),
        }))
        .filter((group) => group.children.length),
    ];
  };
  const hppOf = (item) => Number(item?.hppCost ?? item?.hpp ?? 0);
  // Menus a choice line offers (its selected chips).
  const offeredMenusOf = (line) =>
    (line.menuItemIds || []).map((id) => menuItemsById.get(String(id))).filter(Boolean);
  // HPP of a promo's menus for its gross profit: a choice counts the dearest
  // menu it offers.
  const bundleHpp = menuForm.bundleItems.reduce((total, line) => {
    const quantity = Number(line.quantity) || 0;
    if (line.isChoice) {
      const hpps = offeredMenusOf(line).map(hppOf);
      return total + (hpps.length ? quantity * Math.max(...hpps) : 0);
    }

    return total + quantity * hppOf(menuItemsById.get(String(line.menuItemId)));
  }, 0);
  const isDiscountPromo = promoDiscount > 0;
  const positionCategories = useMemo(
    () => categories.filter((category) => category.isActive !== false),
    [categories]
  );
  const categorySelectOptions = useMemo(
    () =>
      categories.map((category) => ({
        id: String(category.id || category._id),
        text: `${category.icon ? `${category.icon} ` : ""}${category.name}`,
      })),
    [categories]
  );
  // The menu form groups the Kategori Promo apart: their menus are packages of
  // menus already listed in the other categories.
  const menuFormCategoryOptions = useMemo(() => {
    const isPromo = (option) =>
      categories.some(
        (category) => getCategoryId(category) === option.id && category.isBundle
      );
    const ordinary = categorySelectOptions.filter((option) => !isPromo(option));
    const promos = categorySelectOptions.filter(isPromo);

    return [
      { id: "", text: "Pilih category" },
      ...(promos.length && ordinary.length
        ? [{ text: "Category Menu", children: ordinary }]
        : ordinary),
      ...(promos.length ? [{ text: "Kategori Promo (isi dari menu yang sudah ada)", children: promos }] : []),
    ];
  }, [categories, categorySelectOptions]);
  const menuCategoryFilterOptions = useMemo(
    () => [{ id: "", text: "Semua kategori" }, ...categorySelectOptions],
    [categorySelectOptions]
  );
  // The options of each kind. Only bahan resep are offered (Stok → Bahan
  // Baku), plus what the form already uses.
  const ingredientKeys = menuForm.ingredients.map((ingredient) => ingredient.itemKey).join("|");
  const ingredientOptionsByKind = useMemo(() => {
    const selectedKeys = new Set(ingredientKeys.split("|"));
    const optionsOf = (kind, emptyText) => [
      { id: "", text: emptyText },
      ...stockItems
        .filter(
          (stockItem) =>
            kindOfKey(stockItem.key) === kind &&
            (stockItem.isRecipeIngredient !== false || selectedKeys.has(stockItem.key))
        )
        .map((stockItem) => ({ id: stockItem.key, text: stockItem.name })),
    ];
    return { raw: optionsOf("raw", "Pilih bahan baku"), semi: optionsOf("semi", "Pilih bahan olahan") };
  }, [stockItems, ingredientKeys]);

  useEffect(() => {
    if (!isCategoryFormOpen && !isMenuFormOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCategoryFormOpen, isMenuFormOpen]);

  useEffect(() => {
    if (menuForm.imageFile) {
      const nextPreviewUrl = URL.createObjectURL(menuForm.imageFile);
      setImagePreviewUrl(nextPreviewUrl);

      return () => URL.revokeObjectURL(nextPreviewUrl);
    }

    setImagePreviewUrl(resolveMenuImageUrl(menuForm.imagePath));
    return undefined;
  }, [menuForm.imageFile, menuForm.imagePath]);

  useEffect(() => {
    if (!isMenuFormOpen || !imagePreviewUrl) {
      setIsImagePreviewOpen(false);
    }
  }, [isMenuFormOpen, imagePreviewUrl]);

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
      setIsCategoryFormOpen(false);
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal menyimpan category.", {
        variant: "error",
      });
    },
  });

  const categoryPositionMutation = useMutation({
    mutationFn: updateCategoryPositions,
    onMutate: async (categoryIds) => {
      await queryClient.cancelQueries({ queryKey: ["categories", "management"] });
      const previousCategories = queryClient.getQueryData([
        "categories",
        "management",
      ]);

      queryClient.setQueryData(["categories", "management"], (current) => {
        const currentCategories = current?.data?.data || [];
        const orderById = new Map(
          categoryIds.map((categoryId, index) => [String(categoryId), index])
        );
        const nextCategories = [...currentCategories]
          .sort(
            (firstCategory, secondCategory) =>
              (orderById.get(getCategoryId(firstCategory)) ?? 9999) -
              (orderById.get(getCategoryId(secondCategory)) ?? 9999)
          )
          .map((category, index) => ({
            ...category,
            sortOrder: (index + 1) * 10,
            position: index + 1,
          }));

        return current
          ? { ...current, data: { ...current.data, data: nextCategories } }
          : current;
      });

      return { previousCategories };
    },
    onSuccess: () => {
      refreshMenuData();
      enqueueSnackbar("Position category berhasil disimpan.", {
        variant: "success",
      });
    },
    onError: (_error, _categoryIds, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(
          ["categories", "management"],
          context.previousCategories
        );
      }
      enqueueSnackbar("Gagal menyimpan position category.", { variant: "error" });
    },
  });

  const menuItemMutation = useMutation({
    mutationFn: async ({ imageFile, ...payload }) => {
      let imagePath = payload.imagePath;

      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        const uploadRes = await uploadMenuImage(formData);
        imagePath = uploadRes.data?.data?.imagePath || imagePath;
      }

      const nextPayload = { ...payload, imagePath };

      return editingMenuItem
        ? updateMenuItem({
            menuItemId: editingMenuItem.id || editingMenuItem._id,
            ...nextPayload,
          })
        : addMenuItem(nextPayload);
    },
    onSuccess: () => {
      refreshMenuData();
      enqueueSnackbar(
        editingMenuItem ? "Menu berhasil diubah." : "Menu berhasil ditambahkan.",
        { variant: "success" }
      );
      setMenuForm(emptyMenuForm);
      setEditingMenuItem(null);
      setIsMenuFormOpen(false);
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal menyimpan menu.", {
        variant: "error",
      });
    },
  });

  const categoryDeleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      refreshMenuData();
      enqueueSnackbar("Category berhasil dihapus.", { variant: "success" });
      setCategoryPendingDelete(null);
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal menghapus category.", {
        variant: "error",
      });
    },
  });

  const menuDeleteMutation = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => {
      refreshMenuData();
      enqueueSnackbar("Menu berhasil dihapus.", { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar(error?.response?.data?.message || "Gagal menghapus menu.", {
        variant: "error",
      });
    },
  });

  const filteredCategories = useMemo(() => {
    const keyword = categorySearch.trim().toLowerCase();
    if (!keyword) return categories;

    return categories.filter((category) =>
      [category.name, category.icon, category.taxRate ?? category.tax ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
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
        [
          item.name,
          item.category?.name,
          item.regularPrice ?? item.price,
          item.includeOnlinePlatform ? "online" : "offline",
          item.onlinePrice,
        ]
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
  const autoIngredientCostTotal = useMemo(
    () =>
      menuForm.ingredients.reduce((total, ingredient) => {
        const selectedStockItem = stockItems.find(
          (stockItem) => stockItem.key === String(ingredient.itemKey || "")
        );

        return total + getIngredientCost(ingredient, selectedStockItem);
      }, 0),
    [menuForm.ingredients, stockItems]
  );
  // A promo package has no HPP of its own (each sale counts the HPP of its
  // menus). With a discount its gross profit is the price less the discount
  // less its menus' HPP; without one it is entered by hand.
  const autoHppCost = isBundleForm ? 0 : roundMoney(autoIngredientCostTotal);
  const autoGrossProfit = !isBundleForm
    ? roundMoney(parseMoneyInput(menuForm.regularPrice) - autoHppCost)
    : isDiscountPromo
      ? roundMoney(
          Math.round(
            (parseMoneyInput(menuForm.regularPrice) * (100 - Math.min(promoDiscount, 100))) / 100
          ) - bundleHpp
        )
      : roundMoney(parseMoneyInput(menuForm.grossProfit));
  const isGrossProfitAuto = !isBundleForm || isDiscountPromo;

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

  const updateMenuIngredient = (index, field, value) => {
    setMenuForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
      ),
    }));
  };

  const selectIngredientStockItem = (index, itemKey) => {
    const selectedStockItem = findIngredientItem(itemKey);

    setMenuForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index
          ? {
              ...ingredient,
              itemKey,
              ingredientName:
                selectedStockItem?.name || ingredient.ingredientName || "",
            }
          : ingredient
      ),
    }));
  };

  // Switching the kind clears an item of the other kind.
  const selectIngredientKind = (index, kind) => {
    setMenuForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index && ingredient.kind !== kind
          ? { ...ingredient, kind, itemKey: "", ingredientName: "" }
          : ingredient
      ),
    }));
  };

  // What the recipe search did not find: a bahan baku that is not a Bahan
  // Resep, or a bahan that does not exist yet (Buat → Stok Bahan, see
  // onCreateIngredient; the menu form is left).
  const ingredientNotFound = (kind) => (term) => {
    const key = term.toLowerCase();
    const existing =
      key &&
      stockItems.find(
        (stockItem) =>
          kindOfKey(stockItem.key) === kind && String(stockItem.name).trim().toLowerCase() === key
      );
    if (existing && existing.isRecipeIngredient === false) {
      return { message: `${existing.name} bukan Bahan Resep. Aktifkan di Stok Bahan → Bahan Baku.` };
    }
    const label = kind === "semi" ? "Bahan Olahan" : "Bahan Baku";
    return {
      message: key ? `${label} "${term}" tidak ada.` : `Belum ada ${label.toLowerCase()}.`,
      action: onCreateIngredient && `Buat ${label}`,
      onAction: onCreateIngredient && (() => onCreateIngredient(kind, term)),
    };
  };

  const addMenuIngredientField = () => {
    setMenuForm((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          kind: "raw",
          itemKey: "",
          ingredientName: "",
          quantity: "",
          note: "",
        },
      ],
    }));
  };

  const removeMenuIngredientField = (index) => {
    setMenuForm((current) => ({
      ...current,
      ingredients: current.ingredients.filter(
        (_, ingredientIndex) => ingredientIndex !== index
      ),
    }));
  };

  const addBundleMenu = (optionId) => {
    if (!optionId) return;

    const id = String(optionId);
    const categoryId = id.startsWith("category:") ? id.slice("category:".length) : "";
    // A choice starts empty: its menus are picked one by one.
    const line = categoryId
      ? { isChoice: true, categoryId, label: "", quantity: "1", menuItemIds: [] }
      : { menuItemId: id, quantity: "1" };

    setMenuForm((current) =>
      current.bundleItems.some((existing) => bundleLineKey(existing) === bundleLineKey(line))
        ? current
        : { ...current, bundleItems: [...current.bundleItems, line] }
    );
  };

  // Offers or withdraws a menu in a package's choice.
  const toggleChoiceMenu = (index, menuItemId) => {
    setMenuForm((current) => ({
      ...current,
      bundleItems: current.bundleItems.map((line, lineIndex) => {
        if (lineIndex !== index) return line;

        const ids = line.menuItemIds || [];
        return {
          ...line,
          menuItemIds: ids.includes(menuItemId)
            ? ids.filter((id) => id !== menuItemId)
            : [...ids, menuItemId],
        };
      }),
    }));
  };

  const addChoiceMenu = (index, menuItemId) => {
    setMenuForm((current) => ({
      ...current,
      bundleItems: current.bundleItems.map((line, lineIndex) =>
        lineIndex === index && !(line.menuItemIds || []).includes(menuItemId)
          ? { ...line, menuItemIds: [...(line.menuItemIds || []), menuItemId] }
          : line
      ),
    }));
  };

  const setChoiceLabel = (index, label) => {
    setMenuForm((current) => ({
      ...current,
      bundleItems: current.bundleItems.map((line, lineIndex) =>
        lineIndex === index ? { ...line, label } : line
      ),
    }));
  };

  const removeBundleMenu = (index) => {
    setMenuForm((current) => ({
      ...current,
      bundleItems: current.bundleItems.filter((_, lineIndex) => lineIndex !== index),
    }));
  };

  const handleSubmitCategory = (event) => {
    event.preventDefault();

    if (!categoryForm.name.trim()) {
      enqueueSnackbar("Nama category wajib diisi.", { variant: "warning" });
      return;
    }

    const parsedTaxRate =
      categoryForm.taxRate === "" ? null : Number(categoryForm.taxRate);

    if (
      parsedTaxRate !== null &&
      (!Number.isFinite(parsedTaxRate) || parsedTaxRate < 0 || parsedTaxRate > 100)
    ) {
      enqueueSnackbar("Tax category harus di antara 0 sampai 100%.", {
        variant: "warning",
      });
      return;
    }

    categoryMutation.mutate({
      name: categoryForm.name.trim(),
      icon: categoryForm.icon.trim(),
      taxRate: parsedTaxRate,
      isActive: Boolean(categoryForm.isActive),
      isBundle: Boolean(categoryForm.isBundle),
    });
  };

  const handleSubmitMenuItem = (event) => {
    event.preventDefault();

    // Recipe rows must reference a stock item; rows without one are not saved.
    // Quantities are in the stock item's unit (Nasi: portions).
    const ingredients = menuForm.ingredients
      .map((ingredient) => ({
        ...fromIngredientKey(ingredient.itemKey),
        quantity: roundRecipeQuantity(ingredient.quantity),
        note: ingredient.note.trim(),
      }))
      .filter(
        (ingredient) =>
          (ingredient.stockItemId || ingredient.semiItemId) && ingredient.quantity >= 0
      );
    const basePrice = parseMoneyInput(menuForm.regularPrice);
    const onlinePrice =
      menuForm.includeOnlinePlatform && menuForm.onlinePrice !== ""
        ? parseMoneyInput(menuForm.onlinePrice)
        : null;
    const hppCost = autoHppCost;
    const grossProfit = autoGrossProfit;
    const bundleLines = isBundleForm
      ? menuForm.bundleItems.map((line) => ({ ...line, quantity: Number(line.quantity) }))
      : [];
    const bundleItems = bundleLines
      .filter((line) => !line.isChoice)
      .map((line) => ({ menuItemId: Number(line.menuItemId), quantity: line.quantity }));
    const bundleChoices = bundleLines
      .filter((line) => line.isChoice)
      .map((line) => ({
        categoryId: line.categoryId ? Number(line.categoryId) : null,
        // Left blank: named after its category, or keeps its name without one.
        label: String(line.label || "").trim() || (line.categoryId ? null : line.name || null),
        quantity: line.quantity,
        menuItemIds: (line.menuItemIds || []).map(Number),
      }));

    const hasMenuImage =
      Boolean(menuForm.imageFile) || Boolean(menuForm.imagePath.trim());

    if (
      !menuForm.categoryId ||
      !menuForm.name.trim() ||
      menuForm.regularPrice === "" ||
      !hasMenuImage
    ) {
      enqueueSnackbar(
        "Field wajib: category, nama menu, harga reguler, upload image, dan status.",
        {
          variant: "warning",
        }
      );
      return;
    }

    if (
      bundleLines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1)
    ) {
      enqueueSnackbar("Jumlah menu paket minimal 1.", { variant: "warning" });
      return;
    }

    const emptyChoice = bundleLines.find(
      (line) => line.isChoice && !(line.menuItemIds || []).length
    );
    if (emptyChoice) {
      enqueueSnackbar(`Pilih minimal 1 menu untuk Pilihan ${choiceNameOf(emptyChoice)}.`, {
        variant: "warning",
      });
      return;
    }

    if (
      isBundleForm &&
      bundleLines.reduce((total, line) => total + line.quantity, 0) < 1
    ) {
      enqueueSnackbar("Paket minimal berisi 1 menu.", { variant: "warning" });
      return;
    }

    if (
      isBundleForm &&
      (!Number.isFinite(promoDiscount) || promoDiscount < 0 || promoDiscount > 100)
    ) {
      enqueueSnackbar("Diskon harus 0-100%.", { variant: "warning" });
      return;
    }

    if (menuForm.includeOnlinePlatform && menuForm.onlinePrice === "") {
      enqueueSnackbar("Harga online wajib diisi jika platform online disertakan.", {
        variant: "warning",
      });
      return;
    }

    const baseMoneyFields = [menuForm.regularPrice];
    if (isBundleForm && !isDiscountPromo) baseMoneyFields.push(menuForm.grossProfit);

    if (menuForm.includeOnlinePlatform) {
      baseMoneyFields.push(menuForm.onlinePrice);
    }

    if (baseMoneyFields.some((value) => !isValidMoneyInput(value))) {
      enqueueSnackbar(
        "Format nominal tidak valid. Contoh yang benar: 20000, 20.000, atau 5440,5.",
        { variant: "warning" }
      );
      return;
    }

    if (basePrice < 0 || hppCost < 0 || (onlinePrice !== null && onlinePrice < 0)) {
      enqueueSnackbar("Harga dan HPP tidak boleh minus.", {
        variant: "warning",
      });
      return;
    }

    menuItemMutation.mutate({
      categoryId: menuForm.categoryId,
      name: menuForm.name.trim(),
      includeOnlinePlatform: Boolean(menuForm.includeOnlinePlatform),
      regularPrice: basePrice,
      onlinePrice,
      hppCost,
      grossProfit,
      ingredients: isBundleForm ? [] : ingredients,
      bundleItems,
      bundleChoices,
      discountPercent: isBundleForm ? promoDiscount : 0,
      imageFile: menuForm.imageFile,
      imagePath: menuForm.imagePath.trim(),
      isAvailable: Boolean(menuForm.isAvailable),
    });
  };

  const startEditCategory = (category) => {
    setEditingCategory(category);
    setIsCategoryFormOpen(true);
    setCategoryForm({
      isActive: category.isActive !== false,
      isBundle: Boolean(category.isBundle),
      name: category.name,
      icon: category.icon || "☕",
      taxRate:
        category.taxRate === null || category.taxRate === undefined
          ? ""
          : String(category.taxRate),
    });
  };

  const startCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setIsCategoryFormOpen(true);
  };

  const startEditMenuItem = (item) => {
    setEditingMenuItem(item);
    setIsMenuFormOpen(true);
    setMenuForm({
      categoryId: String(item.categoryId || item.category?.id || ""),
      isAvailable: item.isAvailable !== false,
      name: item.name,
      regularPrice: String(item.regularPrice ?? item.price ?? ""),
      discountPercent: Number(item.discountPercent) > 0 ? String(item.discountPercent) : "",
      includeOnlinePlatform: Boolean(item.includeOnlinePlatform),
      onlinePrice:
        item.onlinePrice === null || item.onlinePrice === undefined
          ? ""
          : String(item.onlinePrice),
      hppCost: String(item.hppCost ?? item.hpp ?? ""),
      grossProfit: String(item.grossProfit ?? item.profit ?? ""),
      ingredients: (item.ingredients || []).map((ingredient) => {
        const itemKey = getIngredientKey(ingredient);

        return {
          kind: kindOfKey(itemKey),
          itemKey,
          ingredientName: ingredient.ingredientName || ingredient.name || "",
          quantity: String(ingredient.quantity ?? ""),
          note: ingredient.note || "",
        };
      }),
      bundleItems: [
        ...(item.bundleItems || []).map((line) => ({
          menuItemId: String(line.menuItemId),
          name: line.name,
          quantity: String(line.quantity ?? 1),
        })),
        ...(item.bundleChoices || []).map((choice) => ({
          isChoice: true,
          choiceId: String(choice.id),
          categoryId: choice.categoryId ? String(choice.categoryId) : "",
          label: choice.label || "",
          name: choice.categoryName,
          quantity: String(choice.quantity ?? 1),
          // A choice saved without its menus offers every menu of its category.
          menuItemIds: choice.menuItemIds?.length
            ? choice.menuItemIds.map(String)
            : categoryMenusOf(choice.categoryId).map(getMenuItemId),
        })),
      ],
      imageFile: null,
      imagePath: item.imagePath || "",
    });
  };

  const startCreateMenuItem = () => {
    setEditingMenuItem(null);
    setMenuForm(emptyMenuForm);
    setIsMenuFormOpen(true);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setIsCategoryFormOpen(false);
  };

  const resetMenuForm = () => {
    setEditingMenuItem(null);
    setMenuForm(emptyMenuForm);
    setIsMenuFormOpen(false);
  };

  const handleCategoryDragStart = (category) => {
    setDraggedCategoryId(getCategoryId(category));
  };

  const handleCategoryDrop = (targetCategory) => {
    const targetCategoryId = getCategoryId(targetCategory);

    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      setDraggedCategoryId("");
      return;
    }

    const draggedIndex = positionCategories.findIndex(
      (category) => getCategoryId(category) === draggedCategoryId
    );
    const targetIndex = positionCategories.findIndex(
      (category) => getCategoryId(category) === targetCategoryId
    );

    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedCategoryId("");
      return;
    }

    const nextPositionCategories = [...positionCategories];
    const inactiveCategories = categories.filter(
      (category) => category.isActive === false
    );
    const [draggedCategory] = nextPositionCategories.splice(draggedIndex, 1);
    nextPositionCategories.splice(targetIndex, 0, draggedCategory);
    setDraggedCategoryId("");
    categoryPositionMutation.mutate(
      [...nextPositionCategories, ...inactiveCategories].map(getCategoryId)
    );
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
        <div className="space-y-4">
          {isCategoryFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-4">
              <form
                onSubmit={handleSubmitCategory}
                className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-[#1f1f1f] p-4 pb-0 shadow-2xl scrollbar-hide"
              >
                <div className="mb-4 flex flex-col gap-2 border-b border-[#333] pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#f5f5f5]">
                      {editingCategory ? "Ubah Category" : "Tambah Category"}
                    </h3>
                    <p className="mt-1 text-sm text-[#ababab]">
                      Isi nama, icon, tax, dan status category.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="w-fit rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
                  >
                    Tutup
                  </button>
                </div>
                <label className="mt-4 block text-sm font-semibold text-[#ababab]">
                  Nama Category
                  <input
                    value={categoryForm.name}
                    onChange={(event) =>
                      updateCategoryForm("name", event.target.value)
                    }
                    placeholder="Coffee"
                    className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
                  />
                </label>
                <label className="mt-4 block text-sm font-semibold text-[#ababab]">
                  Icon
                  <input
                    value={categoryForm.icon}
                    onChange={(event) =>
                      updateCategoryForm("icon", event.target.value)
                    }
                    className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
                  />
                </label>
                <div className="mt-3 grid max-h-44 grid-cols-5 gap-2 overflow-y-auto pr-1 scrollbar-hide sm:grid-cols-8">
                  {iconOptions.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => updateCategoryForm("icon", icon)}
                      className={`flex h-10 items-center justify-center rounded-lg text-xl ${
                        categoryForm.icon === icon
                          ? "bg-[#a79981]"
                          : "bg-[#262626]"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-sm font-semibold text-[#ababab]">
                  Tax (%)
                  <input
                    value={categoryForm.taxRate}
                    onChange={(event) =>
                      updateCategoryForm("taxRate", event.target.value)
                    }
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="Kosong = 0%"
                    className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
                  />
                </label>
                <label className="mt-4 flex w-fit items-center gap-3 text-sm font-semibold text-[#ababab]">
                  <span>Kategori Promo</span>
                  <input
                    type="checkbox"
                    checked={Boolean(categoryForm.isBundle)}
                    onChange={(event) =>
                      updateCategoryForm("isBundle", event.target.checked)
                    }
                    className="peer sr-only"
                  />
                  <span className="relative h-7 w-12 rounded-full bg-[#333] transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-[#f5f5f5] after:transition peer-checked:bg-[#a79981] peer-checked:after:translate-x-5" />
                </label>
                <label className="mt-4 block text-sm font-semibold text-[#ababab]">
                  Status
                  <div className="mt-2">
                    <CreatableSelect2
                      options={categoryStatusOptions}
                      value={categoryForm.isActive ? "active" : "inactive"}
                      onSelect={(option) =>
                        updateCategoryForm("isActive", option?.id === "active")
                      }
                      placeholder="Pilih status"
                      label="Status"
                    />
                  </div>
                </label>
                <div className="sticky bottom-0 -mx-4 mt-5 flex gap-2 border-t border-[#333] bg-[#1f1f1f] px-4 py-4">
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
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="rounded-lg bg-[#1f1f1f] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#f5f5f5]">
                  Position Categories
                </h3>
                <p className="mt-1 text-sm text-[#ababab]">
                  Atur posisi card category yang tampil di POS.
                </p>
              </div>
              <span
                className={`w-fit rounded-md px-3 py-1 text-xs font-bold ${
                  categoryPositionMutation.isPending
                    ? "bg-amber-900/50 text-amber-200"
                    : "bg-[#262626] text-[#ababab]"
                }`}
              >
                {categoryPositionMutation.isPending ? "Menyimpan..." : "Auto save"}
              </span>
            </div>
            <div className="rounded-lg border border-[#333] bg-[#262626] p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                {positionCategories.map((category, index) => {
                  const categoryId = getCategoryId(category);
                  const isDragging = draggedCategoryId === categoryId;

                  return (
                    <div
                      key={categoryId}
                      draggable
                      onDragStart={() => handleCategoryDragStart(category)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleCategoryDrop(category);
                      }}
                      onDragEnd={() => setDraggedCategoryId("")}
                      className={`flex min-h-[52px] cursor-move items-center gap-3 rounded-lg border px-3 py-2 transition ${
                        isDragging
                          ? "border-[#a79981] bg-[#3a342b] opacity-70"
                          : "border-[#3a3a3a] bg-[#1f1f1f] hover:border-[#a79981]"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#333] text-lg">
                        {category.icon || "-"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#f5f5f5]">
                          {category.name}
                        </p>
                        <p className="text-xs font-semibold text-[#777]">
                          Position {index + 1}
                        </p>
                      </div>
                      <span className="text-lg leading-none text-[#777]">⋮⋮</span>
                    </div>
                  );
                })}
              </div>
              {positionCategories.length === 0 && (
                <div className="rounded-lg bg-[#1f1f1f] p-4 text-center text-sm text-[#ababab]">
                  No active categories found
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-[#1f1f1f] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#f5f5f5]">
                  Categories
                </h3>
                <p className="mt-1 text-sm text-[#ababab]">
                  Daftar category, tax, dan status.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={startCreateCategory}
                  className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] hover:bg-[#b7aa94]"
                >
                  Tambah Category
                </button>
                <input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  type="search"
                  placeholder="Search category"
                  className="rounded-lg bg-[#262626] px-4 py-2 text-sm text-[#f5f5f5] outline-none"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[#f5f5f5]">
                <thead className="bg-[#333] text-[#ababab]">
                  <tr>
                    <th className="p-3 text-center">Position</th>
                    <th className="p-3">Icon</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Tax</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCategories.map((category, index) => (
                    <tr
                      key={category.id || category._id}
                      className="border-b border-gray-600 hover:bg-[#333]"
                    >
                      <td className="p-4 text-center font-bold text-[#ababab]">
                        {(categoryPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </td>
                      <td className="p-4 text-xl">{category.icon || "-"}</td>
                      <td className="p-4 font-semibold">
                        {category.name}
                        {/* No badge when the name already says Promo. */}
                        {category.isBundle &&
                          String(category.name || "").trim().toLowerCase() !== "promo" && (
                          <span className="ml-2 rounded-md bg-amber-900/50 px-2 py-0.5 text-xs font-bold text-amber-200">
                            Promo
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {category.taxRate ?? category.tax ?? 0}%
                      </td>
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
                      <td className="p-4 text-center text-[#ababab]" colSpan={6}>
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
        <div className="space-y-4">
          {isMenuFormOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/70 p-4">
              <form
                id="menu-form-panel"
                onSubmit={handleSubmitMenuItem}
                className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-[#1f1f1f] p-4 pb-0 shadow-2xl scrollbar-hide"
              >
            <div className="mb-4 flex flex-col gap-2 border-b border-[#333] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#f5f5f5]">
                  {editingMenuItem ? "Ubah Menu" : "Tambah Menu"}
                </h3>
                <p className="mt-1 text-sm text-[#ababab]">
                  {isBundleForm
                    ? "Isi data paket, harga, dan menu isinya."
                    : "Isi data menu, harga, dan komposisi resep."}
                </p>
              </div>
              <button
                type="button"
                onClick={resetMenuForm}
                className="w-fit rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
              >
                Tutup
              </button>
            </div>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Category
              <div className="mt-2">
                <CreatableSelect2
                  options={menuFormCategoryOptions}
                  value={menuForm.categoryId}
                  onSelect={(option) => updateMenuForm("categoryId", option?.id || "")}
                  placeholder="Pilih category"
                  label="Category"
                />
              </div>
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
            {isBundleForm ? (
            <div className="mt-4">
              <span className="text-sm font-semibold text-[#ababab]">Isi Paket</span>
              <div className="mt-2">
                <CreatableSelect2
                  options={bundleMenuOptions}
                  value=""
                  onSelect={(option) => addBundleMenu(option?.id || "")}
                  placeholder="Pilih menu"
                  label="Tambah menu paket"
                />
              </div>
              <div className="mt-3 space-y-2">
                {menuForm.bundleItems.map((line, index) => {
                  const choiceCategory = line.categoryId
                    ? categories.find(
                        (category) => getCategoryId(category) === String(line.categoryId)
                      )
                    : null;
                  const bundleMenuName = line.isChoice
                    ? `Pilihan ${choiceNameOf(line)}`
                    : menuItemsById.get(String(line.menuItemId))?.name || line.name || "-";
                  const bundleMenuPrice = getBundleLinePrice(line, menuItemsById);
                  // The POS hides the package while a line has no available menu.
                  // A choice needs one available menu among those it offers.
                  const isLineUnavailable = line.isChoice
                    ? !(line.menuItemIds?.length
                        ? offeredMenusOf(line)
                        : categoryMenusOf(line.categoryId)
                      ).some((item) => item.isAvailable !== false)
                    : menuItemsById.get(String(line.menuItemId))?.isAvailable === false;

                  return (
                    <div
                      key={bundleLineKey(line)}
                      className="rounded-lg border border-[#333] bg-[#202020] p-2"
                    >
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_40px] items-center gap-2">
                      <div className="min-w-0 px-1">
                        <p className="truncate text-sm font-semibold text-[#f5f5f5]">
                          {bundleMenuName}
                        </p>
                        {isLineUnavailable && (
                          <p className="text-xs font-semibold text-red-300">Tidak tersedia</p>
                        )}
                      </div>
                      <span className="truncate text-right text-sm font-semibold text-[#ababab]">
                        {line.isChoice
                          ? ""
                          : formatCurrency(bundleMenuPrice * (Number(line.quantity) || 0))}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBundleMenu(index)}
                        aria-label={`Hapus ${bundleMenuName}`}
                        className="h-10 w-10 rounded-lg bg-[#333] text-sm font-bold text-red-300"
                      >
                        X
                      </button>
                    </div>
                    {line.isChoice && (
                      <div className="mt-2 space-y-2 px-1">
                        <input
                          value={line.label || ""}
                          onChange={(event) => setChoiceLabel(index, event.target.value)}
                          maxLength={100}
                          placeholder={choiceCategory?.name || "Nama pilihan"}
                          aria-label={`Nama ${bundleMenuName}`}
                          className="w-full rounded-lg border border-transparent bg-[#262626] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#a79981]"
                        />
                        <CreatableSelect2
                          options={choiceMenuOptionsOf(line)}
                          value=""
                          onSelect={(option) => option?.id && addChoiceMenu(index, String(option.id))}
                          placeholder="Pilih menu"
                          label={`Tambah menu ke ${bundleMenuName}`}
                        />
                        {offeredMenusOf(line).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {offeredMenusOf(line).map((item) => (
                              <span
                                key={getMenuItemId(item)}
                                className="flex items-center gap-2 rounded-lg border border-[#a79981] bg-[#a79981]/20 py-1 pl-3 pr-1 text-xs font-semibold text-[#f5f5f5]"
                              >
                                {item.name}
                                <span className="font-normal text-amber-200">
                                  {formatCurrency(hppOf(item))}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleChoiceMenu(index, getMenuItemId(item))}
                                  aria-label={`Hapus ${item.name} dari ${bundleMenuName}`}
                                  className="h-6 w-6 rounded-md bg-[#333] font-bold text-red-300"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>
            </div>
            ) : (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#ababab]">
                  Komposisi Bahan <span className="text-xs text-[#777]">(Opsional)</span>
                </span>
                <button
                  type="button"
                  onClick={addMenuIngredientField}
                  className="rounded-md bg-[#333] px-3 py-1 text-xs font-bold text-[#f5f5f5]"
                >
                  Tambah
                </button>
              </div>
              <div className="space-y-3">
                {menuForm.ingredients.map((ingredient, index) => {
                  const selectedIngredientStockItem = findIngredientItem(
                    ingredient.itemKey
                  );
                  const ingredientCost = getIngredientCost(
                    ingredient,
                    selectedIngredientStockItem
                  );
                  const isSemi = ingredient.kind === "semi";

                  return (
                    <div
                      key={index}
                      className="rounded-lg border border-[#333] bg-[#202020] p-3"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
                        <div
                          role="group"
                          aria-label="Jenis bahan"
                          className="flex rounded-lg bg-[#262626] p-1"
                        >
                          {INGREDIENT_KINDS.map((kind) => (
                            <button
                              key={kind.key}
                              type="button"
                              aria-pressed={ingredient.kind === kind.key}
                              onClick={() => selectIngredientKind(index, kind.key)}
                              className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold ${
                                ingredient.kind === kind.key
                                  ? "bg-[#a79981] text-[#101010]"
                                  : "text-[#ababab]"
                              }`}
                            >
                              {kind.label}
                            </button>
                          ))}
                        </div>
                        <CreatableSelect2
                          options={ingredientOptionsByKind[isSemi ? "semi" : "raw"]}
                          value={ingredient.itemKey}
                          onSelect={(option) =>
                            selectIngredientStockItem(index, option?.id || "")
                          }
                          placeholder={isSemi ? "Pilih bahan olahan" : "Pilih bahan baku"}
                          label="Stok bahan"
                          maxResults={5}
                          notFound={ingredientNotFound(isSemi ? "semi" : "raw")}
                        />
                        <input
                          value={getCogsDisplay(selectedIngredientStockItem)}
                          disabled
                          aria-label="COGS sekarang"
                          className="min-w-0 rounded-lg bg-[#262626] px-3 py-3 text-sm font-semibold text-[#f5f5f5] outline-none disabled:opacity-100"
                        />
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_84px_minmax(0,0.8fr)_42px]">
                        <input
                          value={ingredient.quantity}
                          onChange={(event) =>
                            updateMenuIngredient(
                              index,
                              "quantity",
                              event.target.value
                            )
                          }
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder={isSemi ? "Jumlah porsi, mis. 1" : "Gramasi"}
                          aria-label="Jumlah bahan"
                          className="min-w-0 rounded-lg bg-[#262626] px-3 py-3 text-sm text-[#f5f5f5] outline-none"
                        />
                        <input
                          value={selectedIngredientStockItem?.unit || ""}
                          disabled
                          placeholder={isSemi ? "porsi" : "gr"}
                          aria-label="Satuan bahan"
                          className="min-w-0 rounded-lg bg-[#262626] px-3 py-3 text-sm font-semibold text-[#ababab] outline-none disabled:opacity-100"
                        />
                        <div className="group relative flex min-w-0 items-center rounded-lg bg-[#262626]">
                          <input
                            value={formatCurrency(ingredientCost)}
                            disabled
                            aria-label="Cost bahan"
                            className="min-w-0 flex-1 bg-transparent px-3 py-3 pr-10 text-sm font-semibold text-[#f5f5f5] outline-none disabled:opacity-100"
                          />
                          <button
                            type="button"
                            title={getIngredientCostDescription(
                              ingredient,
                              selectedIngredientStockItem,
                              ingredientCost
                            )}
                            className="absolute right-3 inline-flex h-5 w-5 items-center justify-center text-[#f5f5f5] outline-none"
                            aria-label="Keterangan perhitungan cost"
                          >
                            <MdErrorOutline size={18} />
                          </button>
                          <span className="pointer-events-none absolute bottom-[calc(100%+8px)] right-0 z-20 hidden w-72 rounded-lg border border-[#444] bg-[#151515] px-3 py-2 text-xs font-semibold leading-relaxed text-[#f5f5f5] shadow-xl group-hover:block group-focus-within:block">
                            {getIngredientCostDescription(
                              ingredient,
                              selectedIngredientStockItem,
                              ingredientCost
                            )}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMenuIngredientField(index)}
                          className="w-10 rounded-lg bg-[#333] text-sm font-bold text-red-300"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[#777]">
                Boleh kosong. Dipakai sebagai catatan resep dan pengurangan stok otomatis. Bahan baku yang
                muncul hanya yang bertanda Bahan Resep di Stok Bahan → Bahan Baku.
              </p>
            </div>
            )}
            <div className="mt-4">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-[#ababab]">
                  Harga
                </span>
                <label className="flex w-fit items-center gap-3 text-sm font-bold text-[#ababab]">
                  <span>Include online platform</span>
                  <input
                    type="checkbox"
                    checked={Boolean(menuForm.includeOnlinePlatform)}
                    onChange={(event) =>
                      setMenuForm((current) => ({
                        ...current,
                        includeOnlinePlatform: event.target.checked,
                        onlinePrice: event.target.checked
                          ? current.onlinePrice
                          : "",
                      }))
                    }
                    className="peer sr-only"
                  />
                  <span className="relative h-7 w-12 rounded-full bg-[#333] transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-[#f5f5f5] after:transition peer-checked:bg-[#a79981] peer-checked:after:translate-x-5" />
                </label>
              </div>
              <div
                className={`grid grid-cols-1 gap-3 ${
                  menuForm.includeOnlinePlatform || isBundleForm ? "sm:grid-cols-2" : ""
                }`}
              >
                <label className="block text-sm font-semibold text-[#ababab]">
                  {isBundleForm ? "Harga" : "Harga Reguler"}
                  <div className="mt-2 flex overflow-hidden rounded-lg bg-[#262626]">
                    <span className="flex shrink-0 items-center px-4 text-sm font-bold text-[#a79981]">
                      Rp
                    </span>
                    <input
                      value={menuForm.regularPrice}
                      onChange={(event) =>
                        updateMenuForm("regularPrice", event.target.value)
                      }
                      aria-label={isBundleForm ? "Harga" : "Harga Reguler"}
                      type="text"
                      inputMode="decimal"
                      placeholder="18000"
                      className="min-w-0 w-full bg-transparent py-3 pr-4 text-sm text-[#f5f5f5] outline-none placeholder:text-[#5a5a5a]"
                    />
                  </div>
                </label>
                {isBundleForm && (
                  <label className="block text-sm font-semibold text-[#ababab]">
                    Diskon (%)
                    <div className="mt-2 flex overflow-hidden rounded-lg bg-[#262626]">
                      <input
                        value={menuForm.discountPercent}
                        onChange={(event) => updateMenuForm("discountPercent", event.target.value)}
                        aria-label="Diskon (%)"
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        className="min-w-0 w-full bg-transparent py-3 pl-4 text-sm text-[#f5f5f5] outline-none placeholder:text-[#5a5a5a]"
                      />
                      <span className="flex shrink-0 items-center px-4 text-sm font-bold text-[#a79981]">
                        %
                      </span>
                    </div>
                  </label>
                )}
                {menuForm.includeOnlinePlatform && (
                  <label className="block text-sm font-semibold text-sky-200">
                    Harga Online
                    <div className="mt-2 flex overflow-hidden rounded-lg border border-sky-500/30 bg-sky-500/10">
                      <span className="flex shrink-0 items-center px-4 text-sm font-bold text-sky-200">
                        Rp
                      </span>
                      <input
                        value={menuForm.onlinePrice}
                        onChange={(event) =>
                          updateMenuForm("onlinePrice", event.target.value)
                        }
                        type="text"
                        inputMode="decimal"
                        placeholder="21000"
                        className="min-w-0 w-full bg-transparent py-3 pr-4 text-sm text-[#f5f5f5] outline-none"
                      />
                    </div>
                  </label>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2">
              {!HIDE_AUTO_HPP_FIELD && (
                <label className="block text-sm font-semibold text-amber-200">
                  HPP <span className="text-xs text-[#777]">(Auto)</span>
                  <div className="mt-2 flex overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/10">
                    <span className="flex shrink-0 items-center px-4 text-sm font-bold text-amber-200">
                      Rp
                    </span>
                    <input
                      value={formatMoneyDisplay(autoHppCost)}
                      disabled
                      type="text"
                      placeholder="0"
                      className="min-w-0 w-full bg-transparent py-3 pr-4 text-sm text-[#f5f5f5] outline-none disabled:opacity-100"
                    />
                  </div>
                </label>
              )}
              <label className="block text-sm font-semibold text-emerald-200">
                Gross Profit{" "}
                {isGrossProfitAuto && <span className="text-xs text-[#777]">(Auto)</span>}
                <div className="mt-2 flex overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <span className="flex shrink-0 items-center px-4 text-sm font-bold text-emerald-200">
                    Rp
                  </span>
                  {!isGrossProfitAuto ? (
                    <input
                      value={menuForm.grossProfit}
                      onChange={(event) => updateMenuForm("grossProfit", event.target.value)}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      aria-label="Gross Profit"
                      className="min-w-0 w-full bg-transparent py-3 pr-4 text-sm text-[#f5f5f5] outline-none placeholder:text-[#5a5a5a]"
                    />
                  ) : (
                    <input
                      value={formatMoneyDisplay(autoGrossProfit)}
                      disabled
                      type="text"
                      placeholder="0"
                      aria-label="Gross Profit"
                      className="min-w-0 w-full bg-transparent py-3 pr-4 text-sm text-[#f5f5f5] outline-none disabled:opacity-100"
                    />
                  )}
                </div>
              </label>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-semibold text-[#ababab]">
                Upload Image
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(event) =>
                    updateMenuForm("imageFile", event.target.files?.[0] || null)
                  }
                  className="mt-2 w-full rounded-lg bg-[#262626] px-4 py-3 text-sm text-[#f5f5f5] outline-none file:mr-3 file:rounded-md file:border-0 file:bg-[#a79981] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[#101010]"
                />
              </label>
              {imagePreviewUrl ? (
                <button
                  type="button"
                  onClick={() => setIsImagePreviewOpen(true)}
                  className="mt-3 rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3d3d3d]"
                >
                  Lihat
                </button>
              ) : null}
              {menuForm.imageFile ? (
                <span className="mt-2 block truncate text-xs text-[#ababab]">
                  File baru: {menuForm.imageFile.name}
                </span>
              ) : null}
            </div>
            <label className="mt-4 block text-sm font-semibold text-[#ababab]">
              Status
              <div className="mt-2">
                <CreatableSelect2
                  options={menuAvailabilityOptions}
                  value={menuForm.isAvailable ? "available" : "unavailable"}
                  onSelect={(option) =>
                    updateMenuForm("isAvailable", option?.id === "available")
                  }
                  placeholder="Pilih status"
                  label="Status menu"
                />
              </div>
            </label>
            <div className="sticky bottom-0 -mx-4 mt-5 flex gap-2 border-t border-[#333] bg-[#1f1f1f] px-4 py-4">
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
              <button
                type="button"
                onClick={resetMenuForm}
                className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold text-[#f5f5f5]"
              >
                Batal
              </button>
            </div>
              </form>
            </div>
          )}

          <div className="rounded-lg bg-[#1f1f1f] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#f5f5f5]">Menu Items</h3>
                <p className="mt-1 text-sm text-[#ababab]">
                  Daftar menu, harga reguler, harga online, HPP, dan untung kotor.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={startCreateMenuItem}
                  className="rounded-lg bg-[#a79981] px-4 py-2 text-sm font-bold text-[#101010] hover:bg-[#b7aa94]"
                >
                  Tambah Menu
                </button>
                <div className="min-w-[210px]">
                  <CreatableSelect2
                    options={menuCategoryFilterOptions}
                    value={menuCategoryFilter}
                    onSelect={(option) => setMenuCategoryFilter(option?.id || "")}
                    placeholder="Semua kategori"
                    label="Filter kategori"
                  />
                </div>
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
                    <th className="p-3 text-center">Online</th>
                    <th className="p-3">Harga Reguler</th>
                    <th className="p-3">Harga Online</th>
                    <th className="p-3">HPP</th>
                    <th className="p-3">Untung Kotor</th>
                    <th className="p-3" title="Untung kotor ÷ harga reguler">Persentase Keuntungan</th>
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
                      <td className="p-4 font-semibold">
                        {item.name}
                        {(item.bundleItems?.length > 0 || item.bundleChoices?.length > 0) && (
                          <p className="mt-1 text-xs font-normal text-[#ababab]">
                            {bundleContentsText(item)}
                          </p>
                        )}
                      </td>
                      <td className="p-4">{item.category?.name || "-"}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex rounded-md px-3 py-1 text-xs font-bold ${
                            item.includeOnlinePlatform
                              ? "bg-sky-900/60 text-sky-300"
                              : "bg-[#333] text-[#ababab]"
                          }`}
                        >
                          {item.includeOnlinePlatform ? "Ya" : "Tidak"}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-semibold">
                        {formatCurrency(item.regularPrice ?? item.price)}
                        {Number(item.discountPercent) > 0 && (
                          <p className="text-xs font-normal text-emerald-300">
                            Diskon {Number(item.discountPercent)}%
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-sm font-semibold text-sky-200">
                        {item.onlinePrice === null || item.onlinePrice === undefined
                          ? "-"
                          : formatCurrency(item.onlinePrice)}
                      </td>
                      <td className="p-4 text-sm font-semibold text-amber-200">
                        {/* A package's HPP is counted per sale from its menus. */}
                        {isPackageMenu(item) ? "-" : formatCurrency(item.hppCost || item.hpp || 0)}
                      </td>
                      <td className="p-4 text-sm font-semibold text-emerald-200">
                        {formatCurrency(item.grossProfit || item.profit || 0)}
                      </td>
                      <td className="p-4 text-sm font-semibold">
                        {(() => {
                          const percent = profitPercentOf(item);
                          if (percent === null) return <span className="text-[#ababab]">-</span>;
                          return (
                            <span className={percent < 0 ? "text-red-300" : "text-emerald-200"}>
                              {formatPercent(percent)}
                            </span>
                          );
                        })()}
                      </td>
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
                      <td className="p-4 text-center text-[#ababab]" colSpan={10}>
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

      {isImagePreviewOpen && imagePreviewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-[#262626] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="truncate text-base font-bold text-[#f5f5f5]">
                {menuForm.name || "Preview Image"}
              </h3>
              <button
                type="button"
                onClick={() => setIsImagePreviewOpen(false)}
                className="rounded-lg bg-[#333] px-3 py-2 text-sm font-bold text-[#f5f5f5] hover:bg-[#3d3d3d]"
              >
                Tutup
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#333] bg-[#202020]">
              <img
                src={imagePreviewUrl}
                alt={menuForm.name ? `Preview ${menuForm.name}` : "Preview menu"}
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}    </div>
  );
};

export default MenuManagement;
