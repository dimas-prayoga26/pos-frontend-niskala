import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCustomer } from "../../redux/slices/customerSlice";
import { formatDate, getAvatarName } from "../../utils";

const CustomerInfo = () => {
  const dispatch = useDispatch();
  const customerData = useSelector((state) => state.customer);
  const cartData = useSelector((state) => state.cart);
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
