import { useState } from "react";
import { GrRadialSelected } from "react-icons/gr";
import { MdKeyboardArrowDown } from "react-icons/md";

// One colour for every category; the selected one is outlined in the accent.
// A Kategori Promo looks like a voucher: a dashed accent edge, and a "Promo"
// tag unless its name already says so.
const CARD_COLOR = "#262626";
const ACCENT_COLOR = "#a79981";

const isNamedPromo = (menu) => String(menu?.name || "").trim().toLowerCase() === "promo";

const cardStyle = (menu, isSelected) =>
  menu?.isBundle
    ? { backgroundColor: CARD_COLOR, borderColor: isSelected ? "#e6d5b8" : ACCENT_COLOR }
    : { backgroundColor: CARD_COLOR, borderColor: isSelected ? ACCENT_COLOR : "#333333" };

const PromoTag = ({ menu }) =>
  menu?.isBundle && !isNamedPromo(menu) ? (
    <span className="shrink-0 rounded-md bg-[#a79981]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#e6d5b8]">
      Promo
    </span>
  ) : null;


const CategoryLabel = ({ menu }) => (
  <span className="inline-flex items-center gap-2">
    {menu?.icon ? <span className="shrink-0">{menu.icon}</span> : null}
    <span>{menu?.name}</span>
  </span>
);

// Category choice: a dropdown on phones, a card grid from the sm breakpoint.
const CategorySelector = ({ categories, selected, onSelect }) => {
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const handleCategorySelect = (nextCategory) => {
    onSelect(nextCategory);
    setIsCategoryOpen(false);
  };

  return (
    <>
      <div className="sticky top-0 z-30 bg-[#1f1f1f] px-4 py-4 md:px-10 sm:hidden">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCategoryOpen((current) => !current)}
            className="flex min-h-[94px] w-full items-center justify-between rounded-lg border px-4 py-4 text-left shadow-[0_10px_26px_rgba(0,0,0,0.2)]"
            style={cardStyle(selected, true)}
          >
            <span>
              <span className="block text-lg font-semibold text-[#f5f5f5]">
                <CategoryLabel menu={selected} />
              </span>
              <span className="mt-4 block text-sm font-semibold text-[#d0d0d0]">
                {selected?.items?.length || 0} Items
              </span>
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white">
              <MdKeyboardArrowDown
                size={26}
                className={`transition-transform ${isCategoryOpen ? "rotate-180" : ""}`}
              />
            </span>
          </button>

          {isCategoryOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-lg border border-[#2f2f2f] bg-[#181818] shadow-[0_18px_42px_rgba(0,0,0,0.42)]">
              {categories.map((menu) => (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => handleCategorySelect(menu)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#242424]"
                >
                  <span>
                    <span className="flex items-center gap-2 text-base font-semibold text-[#f5f5f5]">
                      <CategoryLabel menu={menu} />
                      <PromoTag menu={menu} />
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-[#ababab]">
                      {menu.items.length} Items
                    </span>
                  </span>
                  {selected?.id === menu.id ? (
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: ACCENT_COLOR }} />
                  ) : (
                    menu.isBundle && (
                      <span className="h-3 w-3 rounded-full border-2 border-dashed border-[#a79981]" />
                    )
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 px-4 md:px-10 py-4 w-full">
        {categories.map((menu) => (
          <div
            key={menu.id}
            data-promo={menu.isBundle ? "true" : undefined}
            className={`flex min-w-0 flex-col items-start justify-between gap-3 p-3 rounded-lg min-h-[88px] cursor-pointer transition hover:bg-[#2e2e2e] ${
              menu.isBundle ? "border-2 border-dashed" : "border"
            }`}
            style={cardStyle(menu, selected?.id === menu.id)}
            onClick={() => onSelect(menu)}
          >
            <div className="flex items-start justify-between gap-2 w-full">
              <h1 className="min-w-0 text-[#f5f5f5] text-base font-semibold leading-snug">
                <CategoryLabel menu={menu} />
              </h1>
              <PromoTag menu={menu} />
              {selected?.id === menu.id && (
                <GrRadialSelected
                  className={`mt-0.5 shrink-0 ${menu.isBundle ? "text-[#e6d5b8]" : "text-[#a79981]"}`}
                  size={18}
                />
              )}
            </div>
            <p
              className={`text-sm font-semibold ${menu.isBundle ? "text-[#d6c7ae]" : "text-[#ababab]"}`}
            >
              {menu.items.length} Items
            </p>
          </div>
        ))}
      </div>
    </>
  );
};

export default CategorySelector;
