import React, { useState, useEffect } from "react";
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
import { getJakartaDateKey } from "../utils";

const Orders = () => {

  const [selectedDate, setSelectedDate] = useState(getJakartaDateKey);
  const queryClient = useQueryClient();

    useEffect(() => {
      document.title = "POS | Orders"
    }, [])

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
    onError: () => {
      enqueueSnackbar("Gagal menambahkan pembayaran catering", {
        variant: "error",
      });
    },
  });

  const orderDeleteMutation = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      enqueueSnackbar("Pesanan berhasil dihapus", {
        variant: "success",
      });
    },
    onError: () => {
      enqueueSnackbar("Gagal menghapus pesanan", {
        variant: "error",
      });
    },
  });

  const orders = resData?.data.data || [];
  const filteredOrders = orders.filter((order) => {
    if (!selectedDate) return true;

    return getJakartaDateKey(order.orderDate) === selectedDate;
  });

  return (
    <section className="bg-[#1f1f1f] min-h-[calc(100vh-5rem)] overflow-y-auto pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-10 py-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-[#f5f5f5] text-2xl font-bold tracking-wider">
            Orders
          </h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <label className="text-sm font-semibold text-[#ababab]" htmlFor="order-date-filter">
            Filter by date
          </label>
          <input
            id="order-date-filter"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-lg bg-[#262626] px-4 py-2 text-sm font-semibold text-[#f5f5f5] outline-none [color-scheme:dark]"
          />
          {selectedDate && (
            <button
              onClick={() => setSelectedDate("")}
              className="rounded-lg border border-[#a79981]/50 px-4 py-2 text-sm font-semibold text-[#a79981] hover:bg-[#a79981] hover:text-[#101010]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 px-4 md:px-10 xl:px-16 py-4">
        {
          filteredOrders.length > 0 ? (
            filteredOrders.map((order) => {
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
            })
          ) : <p className="col-span-3 text-gray-500">No orders available</p>
        }
      </div>

      <BottomNav />
    </section>
  );
};

export default Orders;
