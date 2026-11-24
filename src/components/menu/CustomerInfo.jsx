import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { enqueueSnackbar } from "notistack";
import { setCustomer } from "../../redux/slices/customerSlice";
import {
  CREW_ORDER_TYPE,
  formatDate,
  formatNominalInput,
  getJakartaDateKey,
  getAvatarName,
  normalizeNominalInput,
} from "../../utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getLoyaltyVoucher, getOrderPlatforms } from "../../https";
import { MdKeyboardArrowDown, MdQrCodeScanner } from "react-icons/md";
import LoyaltyStatus from "./LoyaltyStatus";
import LoyaltyQrScanner from "./LoyaltyQrScanner";
import useLoyaltyEnabled from "../../shared/lib/useLoyaltyEnabled";
import { isLoyaltyVoucherCode, localPhone } from "../../features/pos/utils/loyaltyVoucher";

const voucherErrorMessage = (error) =>
  error?.response?.data?.message || "Voucher tidak bisa dicek. Coba lagi.";

const CustomerInfo = () => {
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);
  // Stamp card voucher QR: the camera, the lookup, and the reward to put in
  // the order once LoyaltyStatus has looked the number up ({ id, phone, stamps, label }).
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);
  const [voucherClaim, setVoucherClaim] = useState(null);
  const loyaltyApi = useLoyaltyEnabled();
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
  const isOnlineOrder = customerData.orderType === "Online";
  // Konsumsi Crew: the name is the crew member's, there is no phone.
  const isCrewOrder = customerData.orderType === CREW_ORDER_TYPE;
  const todayKey = getJakartaDateKey();
  const displayOrderDate =
    isOnlineOrder && customerData.orderDate ? customerData.orderDate : new Date();

  const updateCustomer = (field, value) => {
    dispatch(
      setCustomer({
        name:
          field === "name"
            ? value
            : customerData.customerName || "",
        phone:
          field === "phone"
            ? value
            : customerData.customerPhone || "",
      })
    );
  };

  // A scanned voucher fills in its customer's name and number; a ready
  // reward then goes in the order like Tukar.
  const applyVoucher = async (code) => {
    setIsScannerOpen(false);
    if (!isLoyaltyVoucherCode(code)) {
      enqueueSnackbar("QR ini bukan voucher Stamp Card Niskala.", { variant: "warning" });
      return;
    }

    setIsCheckingVoucher(true);
    try {
      const response = await getLoyaltyVoucher(code);
      const voucher = response?.data?.data;
      const phone = localPhone(voucher?.customer?.phone);
      if (!phone) throw new Error("voucher without phone");

      // Customer Name and Nomor Telepon fill in from the card; a card
      // without a name keeps what was typed.
      dispatch(
        setCustomer({
          phone,
          name: voucher.customer?.name?.trim() || customerData.customerName || "",
        })
      );

      if (voucher.ready) {
        setVoucherClaim({
          id: `${code}-${Date.now()}`,
          phone,
          stamps: Number(voucher.reward?.stamps),
          label: voucher.reward?.label || "Hadiah",
        });
      } else {
        enqueueSnackbar(voucher.message || "Hadiah ini belum bisa ditukar.", { variant: "warning" });
      }
    } catch (error) {
      // What a scanner gun typed before the code was complete is no number.
      if (/^NSKV/i.test(String(customerData.customerPhone || "").trim())) {
        updateCustomer("phone", "");
      }
      enqueueSnackbar(voucherErrorMessage(error), { variant: "error" });
    } finally {
      setIsCheckingVoucher(false);
    }
  };

  // A scanner gun types the voucher into Nomor Telepon.
  const updatePhone = (value) => {
    if (isLoyaltyVoucherCode(value)) {
      applyVoucher(value.trim());
      return;
    }
    updateCustomer("phone", value);
  };

  const closeScanner = useCallback(() => setIsScannerOpen(false), []);
  const finishVoucherClaim = useCallback(() => setVoucherClaim(null), []);
  const loyaltyOff = loyaltyApi.known && !loyaltyApi.enabled;

  const updateCatering = (field, value) => {
    dispatch(
      setCustomer({
        catering: {
          [field]: value,
        },
      })
    );
  };
  const updateOrderPlatform = (platform = null) => {
    dispatch(
      setCustomer({
        orderPlatformId: platform?.id || platform?._id || null,
        orderPlatform: platform?.name || "",
        // Biaya Platform is typed per order, never taken from the platform.
      })
    );
    setIsPlatformOpen(false);
  };
  const updatePlatformTax = (value) => {
    dispatch(setCustomer({ platformTax: normalizeNominalInput(value) }));
  };
  const updateOrderDate = (value) => {
    dispatch(setCustomer({ orderDate: value }));
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
            {formatDate(displayOrderDate)}
          </p>
        </div>
        <button className="bg-[#a79981] p-3 text-xl font-bold rounded-lg shrink-0 text-[#101010]">
          {getAvatarName(displayCustomerName)}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="customer-name"
            className="block text-[#ababab] mb-2 text-xs font-medium"
          >
            {isCrewOrder ? "Nama Crew" : "Customer Name"}
          </label>
          <input
            id="customer-name"
            value={customerData.customerName}
            onChange={(event) => updateCustomer("name", event.target.value)}
            type="text"
            placeholder={isCrewOrder ? "Nama crew" : "Guest"}
            className="w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        {!isOnlineOrder && !isCrewOrder && (
          <div>
            <label
              htmlFor="customer-phone"
              className="block text-[#ababab] mb-2 text-xs font-medium"
            >
              Nomor Telepon
            </label>
            <div className="relative">
              <input
                id="customer-phone"
                value={customerData.customerPhone}
                onChange={(event) => updatePhone(event.target.value)}
                type="tel"
                inputMode="tel"
                placeholder="0812-xxxx-xxxx"
                className="w-full rounded-lg bg-[#1f1f1f] py-3 pl-4 pr-12 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                disabled={loyaltyOff || isCheckingVoucher}
                aria-label="Scan QR Stamp Card"
                title={loyaltyOff ? "Loyalty nonaktif" : "Scan QR Stamp Card"}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#ababab] transition hover:bg-[#2a2a2a] hover:text-[#a79981] disabled:cursor-not-allowed disabled:text-[#555] disabled:hover:bg-transparent"
              >
                {isCheckingVoucher ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#a79981] border-t-transparent" />
                ) : (
                  <MdQrCodeScanner size={20} />
                )}
              </button>
            </div>
            <LoyaltyStatus
              phone={customerData.customerPhone}
              claim={voucherClaim}
              onClaimDone={finishVoucherClaim}
            />
            <LoyaltyQrScanner open={isScannerOpen} onClose={closeScanner} onDetected={applyVoucher} />
          </div>
        )}

        {isOnlineOrder && (
          <>
            <div>
              <label className="block text-[#ababab] mb-2 text-xs font-medium">
                Tanggal Order
              </label>
              <input
                value={customerData.orderDate || todayKey}
                onChange={(event) => updateOrderDate(event.target.value)}
                type="date"
                max={todayKey}
                className="w-full rounded-lg bg-[#1f1f1f] px-4 py-3 text-sm text-white outline-none [color-scheme:dark]"
              />
            </div>

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
                    onClick={() => updateOrderPlatform()}
                    className="block w-full px-4 py-3 text-left text-sm font-semibold text-[#ababab] hover:bg-[#262626] hover:text-white"
                  >
                    Pilih platform
                  </button>
                  {orderPlatforms.map((platform) => (
                    <button
                      key={platform.id || platform._id}
                      type="button"
                      onClick={() => updateOrderPlatform(platform)}
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

              {customerData.orderPlatform && (
                <label className="mt-3 block text-[#ababab] text-xs font-medium">
                  Biaya Platform
                  <div className="mt-2 flex overflow-hidden rounded-lg bg-[#1f1f1f] ring-1 ring-transparent transition focus-within:ring-[#a79981]/50">
                    <span className="flex shrink-0 items-center px-4 text-sm font-bold text-[#a79981]">
                      Rp
                    </span>
                    <input
                      value={formatNominalInput(customerData.platformTax)}
                      onChange={(event) => updatePlatformTax(event.target.value)}
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      className="min-w-0 w-full bg-transparent py-3 pr-4 text-sm text-white outline-none"
                    />
                  </div>
                </label>
              )}
            </div>
          </>
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
