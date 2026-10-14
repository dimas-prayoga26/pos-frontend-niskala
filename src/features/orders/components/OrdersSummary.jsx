import { BsCashCoin } from "react-icons/bs";
import { MdOutlineReceiptLong } from "react-icons/md";
import { formatCurrency } from "../../../shared/lib/format";

const SummaryCard = ({ title, icon, iconClassName, value }) => (
  <div className="rounded-lg bg-[#1a1a1a] px-5 py-5">
    <div className="flex items-start justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-wide text-[#f5f5f5]">{title}</h2>
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${iconClassName} text-2xl text-[#f5f5f5]`}
      >
        {icon}
      </div>
    </div>
    <p className="mt-5 text-3xl font-bold text-[#f5f5f5] md:text-4xl">{value}</p>
  </div>
);

const OrdersSummary = ({ rangeLabel, grossRevenue, orderCount }) => (
  <div className="grid grid-cols-1 gap-3 px-4 pb-2 md:grid-cols-2 md:px-10 xl:px-16">
    <SummaryCard
      title={`Total Penjualan ${rangeLabel}`}
      icon={<BsCashCoin />}
      iconClassName="bg-[#025cca]"
      value={formatCurrency(grossRevenue)}
    />
    <SummaryCard
      title={`Total Orderan ${rangeLabel}`}
      icon={<MdOutlineReceiptLong />}
      iconClassName="bg-[#f6b100]"
      value={orderCount}
    />
  </div>
);

export default OrdersSummary;
