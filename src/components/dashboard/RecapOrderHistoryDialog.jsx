import { useEffect } from "react";
import { formatCurrency, formatJakartaTime, getDisplayOrderCode } from "../../utils";

const cellClass = "px-3 py-2.5";
const numberCellClass = `${cellClass} whitespace-nowrap text-right`;

const typeOf = ({ order, kind }) => {
  if (kind === "crew") return "Crew";
  if (kind === "catering") return "Catering";
  if (kind === "online") return order.orderPlatform || "Online";
  return "Offline";
};

// Riwayat of the Rekap Harian: every nota of the day being recapped, with
// what each brought in after its fee (QRIS MDR or platform), and the money
// per channel to match against the drawer and the accounts. system: from
// getDailyRecapSystem.
const RecapOrderHistoryDialog = ({ dateLabel, system, onClose }) => {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const { lines } = system;
  const totalOf = (pick) => lines.reduce((total, line) => total + pick(line), 0);
  const channels = [
    { label: "Cash masuk", value: system.cash.net },
    { label: "QRIS masuk", value: system.qris.net },
    { label: "Saldo online masuk", value: system.online.net },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recap-history-title"
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-lg bg-[#1f1f1f] p-5 text-[#f5f5f5] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="recap-history-title" className="text-xl font-bold">
              Riwayat Pesanan
            </h3>
            <p className="mt-1 text-sm text-[#ababab]">
              {dateLabel} · {system.transactionTotal} nota
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg bg-[#333] px-4 py-2 text-sm font-bold">
            Tutup
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {channels.map((channel) => (
            <div key={channel.label} className="rounded-lg bg-[#262626] px-3 py-2">
              <p className="text-xs text-[#ababab]">{channel.label}</p>
              <p className="font-bold">{formatCurrency(channel.value)}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-[#333]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#202020] text-[#ababab]">
              <tr>
                <th className={cellClass}>No. Nota</th>
                <th className={cellClass}>Jam</th>
                <th className={cellClass}>Jenis</th>
                <th className={cellClass}>Bayar</th>
                <th className={`${cellClass} text-right`}>Total</th>
                <th className={`${cellClass} text-right`}>Potongan</th>
                <th className={`${cellClass} text-right`}>Masuk</th>
                <th className={`${cellClass} text-right`}>HPP</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const { order, gross, fee, net, hpp } = line;
                return (
                <tr key={order._id || order.id} className="border-t border-[#333]">
                  <td className={`${cellClass} font-semibold`}>{getDisplayOrderCode(order)}</td>
                  <td className={cellClass}>{formatJakartaTime(order.orderDate, { second: undefined })}</td>
                  <td className={cellClass}>{typeOf(line)}</td>
                  <td className={cellClass}>{order.paymentMethod || "-"}</td>
                  <td className={numberCellClass}>{formatCurrency(gross)}</td>
                  <td className={`${numberCellClass} ${fee > 0 ? "text-red-300" : "text-[#777]"}`}>
                    {fee > 0 ? `-${formatCurrency(Math.round(fee))}` : "-"}
                  </td>
                  <td className={`${numberCellClass} font-semibold text-emerald-300`}>{formatCurrency(Math.round(net))}</td>
                  <td className={`${numberCellClass} text-[#f6d365]`}>{formatCurrency(Math.round(hpp))}</td>
                </tr>
                );
              })}
              {!lines.length && (
                <tr>
                  <td className="p-4 text-center text-[#ababab]" colSpan={8}>
                    Belum ada pesanan di tanggal ini.
                  </td>
                </tr>
              )}
            </tbody>
            {lines.length > 0 && (
              <tfoot className="border-t-2 border-[#a79981]/60 bg-[#202020] font-bold">
                <tr>
                  <td className={cellClass} colSpan={4}>
                    Total
                  </td>
                  <td className={numberCellClass}>{formatCurrency(Math.round(totalOf((line) => line.gross)))}</td>
                  <td className={`${numberCellClass} text-red-300`}>
                    -{formatCurrency(Math.round(totalOf((line) => line.fee)))}
                  </td>
                  <td className={`${numberCellClass} text-emerald-300`}>
                    {formatCurrency(Math.round(totalOf((line) => line.net)))}
                  </td>
                  <td className={`${numberCellClass} text-[#f6d365]`}>
                    {formatCurrency(Math.round(totalOf((line) => line.hpp)))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecapOrderHistoryDialog;
