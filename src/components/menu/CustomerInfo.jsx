import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCustomer } from "../../redux/slices/customerSlice";
import { formatDate, getAvatarName } from "../../utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getOrderPlatforms } from "../../https";
import { MdKeyboardArrowDown } from "react-icons/md";

const CustomerInfo = () => {
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  const dispatch = useDispatch();
  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
  const { data: orderPlatformsRes } = useQuery({
    queryKey: ["order-platforms"],
    queryFn: () => getOrderPlatforms(),
    placeholderData: keepPreviousData,
  });
  const orderPlatforms = orderPlatformsRes?.data?.data || [];
  const displayCustomerName = customerData.customerName?.trim() || "Guest";
  const showCateringForm =
    customerData.selectedCategoryName === "Catering" ||
    cartData.some((item) => item.categoryName === "Catering");

  const updateCustomer = (field, value) => {
    dispatch(
      setCustomer({
        name:
          field === "name"
            ? value
            : customerData.customerName || "",
      })
    );
  };

  const updateCatering = (field, value) => {
    dispatch(
      setCustomer({
        catering: {
          [field]: value,
        },
      })
    );
  };
  const updateOrderPlatform = (platformName) => {
    dispatch(setCustomer({ orderPlatform: platformName }));
    setIsPlatformOpen(false);
  };

  const cateringFields = [
    {
      id: "institution",
      label: "Instansi / Lembaga",
      type: "text",
      placeholder: "Nama instansi",
    },
    {
      id: "whatsapp",
      label: "No. WhatsApp",
      type: "tel",
      placeholder: "0812-xxxx-xxxx",
    },
    {
      id: "orderDate",
      label: "Tanggal Order",
      type: "date",
    },
    {
      id: "eventDate",
      label: "Tanggal Acara",
      type: "date",
    },
    {
      id: "deliveryTime",
      label: "Jam Kirim",
      type: "time",
    },
  ];

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-md text-[#f5f5f5] font-semibold tracking-wide">
            {displayCustomerName}
          </h1>
          <p className="text-xs text-[#ababab] font-medium mt-1">
            #New / {customerData.orderType || "Offline"}
            {customerData.orderPlatform ? ` / ${customerData.orderPlatform}` : ""}
          </p>
          <p className="text-xs text-[#ababab] font-medium mt-2">
            {formatDate(new Date())}
          </p>
        </div>
        <button className="bg-[#a79981] p-3 text-xl font-bold rounded-lg shrink-0 text-[#101010]">
          {getAvatarName(displayCustomerName)}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-[#ababab] mb-2 text-xs font-medium">
            Customer Name
          </label>
          <input
            value={customerData.customerName}
            onChange={(event) => updateCustomer("name", event.target.value)}
            type="text"
            placeholder="Guest"
            className="w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        {customerData.orderType === "Online" && (
          <div className="relative">
            <label className="block text-[#ababab] mb-2 text-xs font-medium">
              Platform
            </label>
            <button
              type="button"
              onClick={() => setIsPlatformOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-lg bg-[#1f1f1f] px-4 py-3 text-left text-sm font-semibold text-white outline-none ring-1 ring-transparent transition hover:bg-[#242424] focus:ring-[#a79981]/50"
            >
              <span
                className={`flex min-w-0 items-center gap-3 ${
                  customerData.orderPlatform ? "text-white" : "text-[#ababab]"
                }`}
              >
                <span className="truncate">
                  {customerData.orderPlatform || "Pilih platform"}
                </span>
              </span>
              <MdKeyboardArrowDown
                size={20}
                className={`shrink-0 text-[#ababab] transition-transform ${
                  isPlatformOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isPlatformOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-lg border border-[#333] bg-[#1a1a1a] shadow-2xl shadow-black/40">
                <button
                  type="button"
                  onClick={() => updateOrderPlatform("")}
                  className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#ababab] hover:bg-[#262626] hover:text-white"
                >
                  Pilih platform
                </button>
                {orderPlatforms.map((platform) => (
                  <button
                    key={platform.id || platform._id}
                    type="button"
                    onClick={() => updateOrderPlatform(platform.name)}
                    className={`block w-full px-4 py-3 text-left text-sm font-semibold hover:bg-[#262626] ${
                      customerData.orderPlatform === platform.name
                        ? "bg-[#a79981] text-[#101010]"
                        : "text-white"
                    }`}
                  >
                    {platform.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showCateringForm && (
          <div className="rounded-lg border border-[#2a2a2a] bg-[#181818] p-3">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[#f5f5f5]">
                Detail Catering
              </h2>
              <p className="mt-1 text-xs text-[#ababab]">
                Lengkapi data acara dan follow-up.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cateringFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-[#ababab] mb-2 text-xs font-medium">
                    {field.label}
                  </label>
                  <input
                    value={customerData.catering?.[field.id] || ""}
                    onChange={(event) =>
                      updateCatering(field.id, event.target.value)
                    }
                    type={field.type}
                    min={field.type === "number" ? "0" : undefined}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="mt-3">
              <label className="block text-[#ababab] mb-2 text-xs font-medium">
                Catatan / Follow-up
              </label>
              <textarea
                value={customerData.catering?.note || ""}
                onChange={(event) => updateCatering("note", event.target.value)}
                placeholder="Menu tanpa sambal 5 box; ingatkan pelunasan H-1"
                rows={3}
                className="w-full resize-none rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CustomerInfo;
