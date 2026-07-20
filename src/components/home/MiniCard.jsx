import React from "react";
import { formatCurrency } from "../../utils";

const MiniCard = ({
  title,
  icon,
  number,
  footerNum,
  footerText,
  percentageChange,
  isCurrency = false,
}) => {
  const hasPercentageChange = typeof percentageChange === "number";
  const percentageColor =
    percentageChange > 0
      ? "text-[#02ca3a]"
      : percentageChange < 0
        ? "text-red-400"
        : "text-[#ababab]";
  const percentagePrefix = percentageChange > 0 ? "+" : "";

  return (
    <div className='bg-[#1a1a1a] py-5 px-5 rounded-lg w-full'>
        <div className='flex items-start justify-between'>
            <h1 className='text-[#f5f5f5] text-lg font-semibold tracking-wide'>{title}</h1>
            <button className={`${isCurrency ? "bg-[#02ca3a]" : "bg-[#f6b100]"} p-3 rounded-lg text-[#f5f5f5] text-2xl`}>{icon}</button>
        </div>
        <div>
            <h1 className='text-[#f5f5f5] text-3xl md:text-4xl font-bold mt-5'>{
              isCurrency ? formatCurrency(number) : number}</h1>
            <h1 className='text-[#f5f5f5] text-lg mt-2'>
              {hasPercentageChange ? (
                <>
                  <span className={percentageColor}>
                    {percentagePrefix}
                    {percentageChange}%
                  </span>{" "}
                  dibanding kemarin
                </>
              ) : footerText || (
                <>
                  <span className='text-[#02ca3a]'>{footerNum}%</span> than yesterday
                </>
              )}
            </h1>
        </div>
    </div>
  )
}

export default MiniCard
