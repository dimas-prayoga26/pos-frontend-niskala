import { currency, formatRupiahInput } from "../../utils/format";
import { inputClass } from "./styles";

const toggleClass = (active) =>
  `px-3 py-2 text-sm font-bold transition-colors ${
    active ? "bg-[#a79981] text-[#101010]" : "bg-[#262626] text-[#ababab] hover:text-white"
  }`;
const Row = ({ label, children, value, valueClassName = "" }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 py-2">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-[#ababab]">{label}</span>
      {children}
    </div>
    <strong className={`min-w-[120px] text-right ${valueClassName}`.trim()}>{value}</strong>
  </div>
);

// Ringkasan & Finalisasi of a nota: Subtotal of the lines, Ongkos Kirim,
// Diskon Nota (Rp or %), PPN when the supplier charges it, and the Grand Total
// that leaves the chosen payment source.
const NotaSummary = ({ form, setForm, totals, sourceName, disabled }) => {
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const isPercent = form.discountType === "percent";

  return (
    <section aria-label="Ringkasan nota" className="mt-5 rounded-lg border border-[#444] p-4">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-[#d6c7ae]">Ringkasan</h3>
      <div className="divide-y divide-[#333]">
        <Row label="Subtotal" value={currency(totals.subtotal)} />
        <Row
          label="Ongkos Kirim / Ekspedisi"
          value={currency(totals.shippingCost)}
        >
          <input
            type="text"
            inputMode="numeric"
            aria-label="Ongkos Kirim / Ekspedisi"
            placeholder="0"
            disabled={disabled}
            value={formatRupiahInput(form.shippingCost)}
            onChange={(event) => setField("shippingCost", event.target.value.replace(/\D/g, ""))}
            className={`${inputClass} w-36`}
          />
        </Row>
        <Row label="Diskon Nota" value={totals.discountAmount ? `-${currency(totals.discountAmount)}` : currency(0)} valueClassName="text-green-400">
          <div role="group" aria-label="Jenis diskon" className="flex overflow-hidden rounded-lg border border-[#555]">
            {[
              ["amount", "Rp"],
              ["percent", "%"],
            ].map(([type, label]) => (
              <button
                key={type}
                type="button"
                aria-pressed={form.discountType === type}
                disabled={disabled}
                onClick={() => setForm((current) => ({ ...current, discountType: type, discountValue: "" }))}
                className={toggleClass(form.discountType === type)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text"
            inputMode={isPercent ? "decimal" : "numeric"}
            aria-label="Diskon Nota"
            placeholder="0"
            disabled={disabled}
            value={isPercent ? form.discountValue : formatRupiahInput(form.discountValue)}
            onChange={(event) =>
              setField(
                "discountValue",
                isPercent ? event.target.value.replace(/[^\d.,]/g, "") : event.target.value.replace(/\D/g, "")
              )
            }
            className={`${inputClass} w-28`}
          />
        </Row>
        <Row label="Pajak (PPN)" value={currency(totals.taxAmount)}>
          <label className="flex items-center gap-2 text-sm text-[#ababab]">
            <input
              type="checkbox"
              checked={form.taxEnabled}
              disabled={disabled}
              onChange={(event) => setField("taxEnabled", event.target.checked)}
              className="h-4 w-4 accent-[#a79981]"
            />
            Supplier mengenakan PPN
          </label>
          {form.taxEnabled && (
            <span className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                aria-label="PPN (%)"
                disabled={disabled}
                value={form.taxPercent}
                onChange={(event) => setField("taxPercent", event.target.value.replace(/[^\d.,]/g, ""))}
                className={`${inputClass} w-20`}
              />
              <span className="text-sm text-[#ababab]">%</span>
            </span>
          )}
        </Row>
        <div className="flex flex-wrap items-end justify-between gap-2 pt-3">
          <div>
            <span className="block text-base font-bold">Grand Total</span>
            <span className="text-xs text-[#ababab]">
              Memotong saldo {sourceName || "sumber pembayaran"} saat diposting. Ongkir, diskon, dan PPN dibagi ke
              barang sebanding nilainya (masuk COGS).
            </span>
          </div>
          <strong className="text-xl" data-testid="nota-grand-total">
            {currency(totals.total)}
          </strong>
        </div>
      </div>
    </section>
  );
};

export default NotaSummary;
