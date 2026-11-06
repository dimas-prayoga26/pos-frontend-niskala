import { useState } from "react";
import { GrRadialSelected } from "react-icons/gr";
import { MdKeyboardArrowDown } from "react-icons/md";

// One colour for every category; the selected one is outlined in the accent.
const CARD_COLOR = "#262626";
const ACCENT_COLOR = "#a79981";

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
            style={{ backgroundColor: CARD_COLOR, borderColor: ACCENT_COLOR }}
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
                    <span className="block text-base font-semibold text-[#f5f5f5]">
                      <CategoryLabel menu={menu} />
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-[#ababab]">
                      {menu.items.length} Items
                    </span>
                  </span>
                  {selected?.id === menu.id && (
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: ACCENT_COLOR }}
                    />
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
            className="flex min-w-0 flex-col items-start justify-between gap-3 p-3 rounded-lg border min-h-[88px] cursor-pointer transition-colors hover:bg-[#2e2e2e]"
            style={{
              backgroundColor: CARD_COLOR,
              borderColor: selected?.id === menu.id ? ACCENT_COLOR : "#333333",
            }}
            onClick={() => onSelect(menu)}
          >
            <div className="flex items-start justify-between gap-2 w-full">
              <h1 className="min-w-0 text-[#f5f5f5] text-base font-semibold leading-snug">
                <CategoryLabel menu={menu} />
              </h1>
              {selected?.id === menu.id && (
                <GrRadialSelected className="mt-0.5 shrink-0 text-[#a79981]" size={18} />
              )}
            </div>
            <p className="text-[#ababab] text-sm font-semibold">{menu.items.length} Items</p>
          </div>
        ))}
      </div>
    </>
  );
};

export default CategorySelector;
