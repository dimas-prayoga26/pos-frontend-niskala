import React from "react";
import { GrUpdate } from "react-icons/gr";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders, updateOrderStatus } from "../../https/index";
import { formatCurrency, formatDateAndTime } from "../../utils";
import { useSelector } from "react-redux";

const RecentOrders = () => {
  const queryClient = useQueryClient();
  const userData = useSelector((state) => state.user);
  const canUpdateStatus = userData.role?.toLowerCase() === "cashier";

  const handleStatusChange = ({orderId, orderStatus}) => {
    console.log(orderId)
    orderStatusUpdateMutation.mutate({orderId, orderStatus});
  };

  const orderStatusUpdateMutation = useMutation({
    mutationFn: ({orderId, orderStatus}) => updateOrderStatus({orderId, orderStatus}),
    onSuccess: (data) => {
      enqueueSnackbar("Order status updated successfully!", { variant: "success" });
      queryClient.invalidateQueries(["orders"]); // Refresh order list
    },
    onError: () => {
      enqueueSnackbar("Failed to update order status!", { variant: "error" });
    }
  })

  const { data: resData, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      return await getOrders();
    },
    placeholderData: keepPreviousData,
  });

  if (isError) {
    enqueueSnackbar("Something went wrong!", { variant: "error" });
  }

  return (
    <div className="container mx-auto bg-[#262626] p-4 rounded-lg">
      <h2 className="text-[#f5f5f5] text-xl font-semibold mb-4">
        Recent Orders
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[#f5f5f5]">
          <thead className="bg-[#333] text-[#ababab]">
            <tr>
              <th className="p-3">Order ID</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Status</th>
              <th className="p-3">Date & Time</th>
              <th className="p-3">Items</th>
              <th className="p-3">Order Type</th>
              <th className="p-3">Total</th>
              <th className="p-3 text-center">Payment Method</th>
            </tr>
          </thead>
          <tbody>
            {resData?.data.data.map((order, index) => (
              <tr
                key={index}
                className="border-b border-gray-600 hover:bg-[#333]"
              >
                <td className="p-4">
                  #{order.orderId || order.orderCode || `ORD-${String(order.id).padStart(6, "0")}`}
                </td>
                <td className="p-4">{order.customerDetails.name}</td>
                <td className="p-4">
                  {canUpdateStatus ? (
                    <select
                      className={`bg-[#1a1a1a] border border-gray-500 p-2 rounded-lg focus:outline-none ${
                        order.orderStatus === "Completed"
                          ? "text-green-500"
                          : "text-yellow-500"
                      }`}
                      value={order.orderStatus}
                      onChange={(e) => handleStatusChange({orderId: order._id, orderStatus: e.target.value})}
                    >
                      <option className="text-yellow-500" value="In Progress">
                        In Progress
                      </option>
                      <option className="text-green-500" value="Completed">
                        Completed
                      </option>
                    </select>
                  ) : (
                    <span
                      className={`rounded-lg px-2 py-1 text-sm font-semibold ${
                        order.orderStatus === "Completed"
                          ? "bg-[#2e4a40] text-green-500"
                          : "bg-[#4a452e] text-yellow-500"
                      }`}
                    >
                      {order.orderStatus}
                    </span>
                  )}
                </td>
                <td className="p-4">{formatDateAndTime(order.orderDate)}</td>
                <td className="p-4">{order.items.length} Items</td>
                <td className="p-4">Customer</td>
                <td className="p-4">{formatCurrency(order.bills.totalWithTax)}</td>
                <td className="p-4">
                  {order.paymentMethod}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentOrders;
