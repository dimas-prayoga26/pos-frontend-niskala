import React, { useState, useEffect, useMemo, useRef } from "react";
import { DateRange } from "react-date-range";
import { MdClose, MdDateRange } from "react-icons/md";
import { BsCashCoin } from "react-icons/bs";
import { MdOutlineReceiptLong } from "react-icons/md";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "../styles/ordersDateRange.css";
import BottomNav from "../components/shared/BottomNav";
import OrderCard from "../components/orders/OrderCard";
import BackButton from "../components/shared/BackButton";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addCateringPayment,
  deleteOrder,
  getOrders,
} from "../https/index";
import { enqueueSnackbar } from "notistack"
import {
  formatCurrency,
  formatJakartaDate,
  formatJakartaReceiptDate,
  getJakartaDateKey,
  getOrderReceivedAmount,
} from "../utils";

const Orders = () => {

  const todayKey = getJakartaDateKey();
  const dateKeyToPickerDate = (dateKey) =>
    new Date(`${dateKey || todayKey}T00:00:00+07:00`);
  const [dateRange, setDateRange] = useState({
    startDate: todayKey,
    endDate: todayKey,
  });
  const [draftDateRange, setDraftDateRange] = useState({
    startDate: dateKeyToPickerDate(todayKey),
    endDate: dateKeyToPickerDate(todayKey),
    key: "selection",
  });
  const [isDateRangePickerOpen, setIsDateRangePickerOpen] = useState(false);
  const dateRangePickerRef = useRef(null);
  const queryClient = useQueryClient();

    useEffect(() => {
      document.title = "POS | Orders"
    }, [])

  useEffect(() => {
    if (!isDateRangePickerOpen) return;

    const handlePointerDown = (event) => {
      if (dateRangePickerRef.current?.contains(event.target)) return;

      setIsDateRangePickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isDateRangePickerOpen]);

  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      return await getOrders();
    },
    placeholderData: keepPreviousData
  })

  if(isError) {
    enqueueSnackbar("Something went wrong!", {variant: "error"})
  }

  const cateringPaymentAddMutation = useMutation({
    mutationFn: addCateringPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      enqueueSnackbar("Pembayaran catering berhasil ditambahkan", {
        variant: "success",
      });
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message ||
          "Gagal menambahkan pembayaran catering",
        {
          variant: "error",
        }
      );
    },
  });

  const orderDeleteMutation = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      enqueueSnackbar("Pesanan berhasil dihapus", {
        variant: "success",
      });
    },
    onError: (error) => {
      enqueueSnackbar(
        error?.response?.data?.message || "Gagal menghapus pesanan",
        {
          variant: "error",
        }
      );
    },
  });

  const orders = useMemo(() => resData?.data.data || [], [resData]);
  const hasActiveDateRange = dateRange.startDate || dateRange.endDate;
  const dateRangeLabel = useMemo(() => {
    if (!dateRange.startDate && !dateRange.endDate) return "Semua tanggal";
    if (dateRange.startDate && dateRange.startDate === dateRange.endDate) {
      return formatJakartaDate(dateRange.startDate);
    }
    if (dateRange.startDate && dateRange.endDate) {
      return `${formatJakartaDate(dateRange.startDate)} - ${formatJakartaDate(
        dateRange.endDate
      )}`;
    }
    if (dateRange.startDate) return `Mulai ${formatJakartaDate(dateRange.startDate)}`;

    return `Sampai ${formatJakartaDate(dateRange.endDate)}`;
  }, [dateRange.startDate, dateRange.endDate]);
  const draftDateRangeLabel = `${formatJakartaReceiptDate(
    draftDateRange.startDate
  )} - ${formatJakartaReceiptDate(draftDateRange.endDate)}`;
  const summaryDateRangeLabel = useMemo(() => {
    if (!dateRange.startDate && !dateRange.endDate) return "Semua Tanggal";
    if (dateRange.startDate && dateRange.startDate === dateRange.endDate) {
      return formatJakartaReceiptDate(dateRange.startDate);
    }
    if (dateRange.startDate && dateRange.endDate) {
      return `${formatJakartaReceiptDate(
        dateRange.startDate
      )} - ${formatJakartaReceiptDate(dateRange.endDate)}`;
    }
    if (dateRange.startDate) {
      return `Mulai ${formatJakartaReceiptDate(dateRange.startDate)}`;
    }

    return `Sampai ${formatJakartaReceiptDate(dateRange.endDate)}`;
  }, [dateRange.startDate, dateRange.endDate]);
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const orderDateKey = getJakartaDateKey(order.orderDate);

        if (!orderDateKey) return false;
        if (dateRange.startDate && orderDateKey < dateRange.startDate) return false;
        if (dateRange.endDate && orderDateKey > dateRange.endDate) return false;

        return true;
      })
      .sort(
        (firstOrder, secondOrder) =>
          new Date(secondOrder.orderDate) - new Date(firstOrder.orderDate)
      );
  }, [orders, dateRange.startDate, dateRange.endDate]);
  const filteredRevenue = useMemo(() => {
    return filteredOrders.reduce((total, order) => {
      return total + getOrderReceivedAmount(order);
    }, 0);
  }, [filteredOrders]);
  const groupedOrders = useMemo(() => {
    return filteredOrders.reduce((groups, order) => {
      const dateKey = getJakartaDateKey(order.orderDate);
      const lastGroup = groups[groups.length - 1];

      if (lastGroup?.dateKey === dateKey) {
        lastGroup.orders.push(order);
      } else {
        groups.push({
          dateKey,
          label: formatJakartaDate(order.orderDate),
          orders: [order],
        });
      }

      return groups;
    }, []);
  }, [filteredOrders]);
  const handleOpenDateRangePicker = () => {
    const startDate = dateKeyToPickerDate(dateRange.startDate || todayKey);
    const endDate = dateKeyToPickerDate(
      dateRange.endDate || dateRange.startDate || todayKey
    );

    setDraftDateRange({
      startDate,
      endDate,
      key: "selection",
    });
    setIsDateRangePickerOpen(true);
  };
  const handleDraftDateRangeChange = (ranges) => {
    setDraftDateRange(ranges.selection);
  };
  const handleApplyDateRange = () => {
    const startDate = draftDateRange.startDate || draftDateRange.endDate;
    const endDate = draftDateRange.endDate || draftDateRange.startDate;

    setDateRange({
      startDate: getJakartaDateKey(startDate),
      endDate: getJakartaDateKey(endDate),
    });
    setIsDateRangePickerOpen(false);
  };
  const handleClearDateRange = () => {
    setDateRange({
      startDate: "",
      endDate: "",
    });
    setIsDateRangePickerOpen(false);
  };
  const handleSelectToday = () => {
    setDateRange({
      startDate: todayKey,
      endDate: todayKey,
    });
    setDraftDateRange({
      startDate: dateKeyToPickerDate(todayKey),
      endDate: dateKeyToPickerDate(todayKey),
      key: "selection",
    });
    setIsDateRangePickerOpen(false);
  };

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] overflow-y-auto pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-10 py-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
            Orders
          </h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto lg:flex-row lg:items-center">
          <label className="text-sm font-semibold text-[#ababab]" htmlFor="order-date-range-filter">
            Filter by date
          </label>
          <div ref={dateRangePickerRef} className="relative w-full sm:w-72">
            <div className="flex items-center gap-2 rounded-lg bg-[#262626] px-3 py-2 text-sm font-semibold text-[#f5f5f5]">
              <MdDateRange className="shrink-0 text-[#a79981]" size={18} />
              <input
                id="order-date-range-filter"
                type="text"
                readOnly
                value={dateRangeLabel}
                onClick={handleOpenDateRangePicker}
                onFocus={handleOpenDateRangePicker}
                className="w-full cursor-pointer bg-transparent text-sm font-semibold text-[#f5f5f5] outline-none"
                aria-label="Pilih rentang tanggal"
                aria-expanded={isDateRangePickerOpen}
              />
            </div>

            {isDateRangePickerOpen && (
              <div className="orders-date-range-picker absolute right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-lg border border-[#333] bg-white shadow-2xl shadow-black/50">
                <DateRange
                  ranges={[draftDateRange]}
                  onChange={handleDraftDateRangeChange}
                  months={1}
                  direction="horizontal"
                  moveRangeOnFirstSelection={false}
                  showDateDisplay={false}
                  rangeColors={["#a79981"]}
                />
                <div className="orders-date-range-footer border-t border-gray-200 bg-white">
                  <p className="orders-date-range-summary font-semibold text-gray-600">
                    {draftDateRangeLabel}
                  </p>
                  <div className="orders-date-range-actions">
                    <button
                      type="button"
                      onClick={() => setIsDateRangePickerOpen(false)}
                      className="rounded-md border border-gray-200 px-2 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectToday}
                      className="rounded-md border border-gray-200 px-2 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyDateRange}
                      className="rounded-md bg-[#a79981] px-2 py-1.5 text-xs font-bold text-[#101010] transition hover:bg-[#b9aa91]"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {hasActiveDateRange && (
            <button
              type="button"
              onClick={handleClearDateRange}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#a79981]/50 px-4 py-2 text-sm font-semibold text-[#a79981] transition hover:bg-[#a79981] hover:text-[#101010]"
            >
              <MdClose size={18} />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 px-4 pb-2 md:grid-cols-2 md:px-10 xl:px-16">
        <div className="rounded-lg bg-[#1a1a1a] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-wide text-[#f5f5f5]">
              Total Pendapatan {summaryDateRangeLabel}
            </h2>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#02ca3a] text-2xl text-[#f5f5f5]">
              <BsCashCoin />
            </div>
          </div>
          <p className="mt-5 text-3xl font-bold text-[#f5f5f5] md:text-4xl">
            {formatCurrency(filteredRevenue)}
          </p>
        </div>

        <div className="rounded-lg bg-[#1a1a1a] px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-wide text-[#f5f5f5]">
              Total Orderan {summaryDateRangeLabel}
            </h2>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#f6b100] text-2xl text-[#f5f5f5]">
              <MdOutlineReceiptLong />
            </div>
          </div>
          <p className="mt-5 text-3xl font-bold text-[#f5f5f5] md:text-4xl">
            {filteredOrders.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 px-4 md:px-10 xl:px-16 py-4">
        {
          groupedOrders.length > 0 ? (
            groupedOrders.map((group) => (
              <React.Fragment key={group.dateKey}>
                <div className="col-span-full mt-2 flex items-center gap-3 first:mt-0">
                  <div className="h-px flex-1 bg-[#3a3a3a]" />
                  <p className="shrink-0 rounded-lg border border-[#a79981]/40 px-3 py-1 text-sm font-bold text-[#a79981]">
                    {group.label}
                  </p>
                  <div className="h-px flex-1 bg-[#3a3a3a]" />
                </div>
                {group.orders.map((order) => {
                  const orderId = order.id || order._id;

                  return (
                    <OrderCard
                      key={orderId}
                      order={order}
                      onCateringPaymentAdd={(amount) =>
                        cateringPaymentAddMutation.mutate({
                          orderId,
                          amount,
                        })
                      }
                      isAddingCateringPayment={
                        cateringPaymentAddMutation.isPending &&
                        (cateringPaymentAddMutation.variables?.orderId ===
                          orderId)
                      }
                      onOrderDelete={() =>
                        orderDeleteMutation.mutate(orderId)
                      }
                      isDeletingOrder={
                        orderDeleteMutation.isPending &&
                        orderDeleteMutation.variables === orderId
                      }
                    />
                  )
                })}
              </React.Fragment>
            ))
          ) : <p className="col-span-3 text-gray-500">No orders available</p>
        }
      </div>

      <BottomNav />
    </section>
  );
};

export default Orders;
