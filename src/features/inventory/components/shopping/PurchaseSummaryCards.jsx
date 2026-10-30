import { useCallback, useEffect, useRef, useState } from "react";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import { getSummaryDateRangeLabel } from "../../../orders/utils/orderFilters";
import { currency } from "../../utils/format";

// Area Widget Ringkasan of the Belanja page (GET /api/shopping/summary): what
// went out in the period per kind of belanja, and the value of the Peralatan
// (assets, lifetime, whatever the period). Laid out like the summary cards of
// Rekap (new): coloured cards in a row that slides, the period on a line under
// each title.
const CARDS = [
  { key: "bahanBaku", title: "Serapan Bahan Baku", color: "#025cca" },
  { key: "peralatan", title: "Pengeluaran Peralatan (Habis Pakai)", color: "#02a05a" },
  { key: "perlengkapan", title: "Pengeluaran Perlengkapan (Habis Pakai)", color: "#b58105" },
  { key: "asetPeralatan", title: "Valuasi Aset (Statis/Lifetime)", color: "#7f167f", lifetime: true },
  { key: "promosi", title: "Serapan Budget Promosi", color: "#0f766e" },
  { key: "lainLain", title: "Biaya Overhead Operasional", color: "#d95f02", note: "Lain-lain" },
];
const CARD_GAP = 16;
// Exactly 1 card in view on phones, 2 on tablets (md, 768px) and 4 on
// desktops (lg, 1024px); the rest slide. A fixed basis (not a min width) keeps
// a long title from widening its card: it wraps instead.
const CARD_WIDTH_CLASS =
  "min-h-[96px] min-w-0 shrink-0 grow-0 basis-full snap-start rounded-lg p-4 shadow-sm md:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-3rem)/4)]";
const scrollButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#444] bg-[#262626] text-[#f5f5f5] transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-[#262626]";

const PurchaseSummaryCards = ({ summary, range = {}, isLoading, isError }) => {
  const cardsRef = useRef(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });
  const periodLabel = getSummaryDateRangeLabel({ startDate: range.from || "", endDate: range.to || "" });

  const updateScrollState = useCallback(() => {
    const container = cardsRef.current;
    if (!container) return;
    setScrollState({
      canScrollLeft: container.scrollLeft > 4,
      canScrollRight: container.scrollLeft + container.clientWidth < container.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [updateScrollState]);

  const scrollCards = (direction) => {
    const container = cardsRef.current;
    if (!container) return;
    const firstCard = container.firstElementChild;
    const step = firstCard ? firstCard.getBoundingClientRect().width + CARD_GAP : container.clientWidth;
    container.scrollBy({ left: direction * step, behavior: "smooth" });
  };
  const isScrollable = scrollState.canScrollLeft || scrollState.canScrollRight;

  return (
    <section aria-label="Ringkasan belanja" className="mb-4">
      {isError && <p className="mb-2 text-sm text-red-400">Ringkasan gagal dimuat.</p>}
      <div className="flex items-center gap-2">
        {isScrollable && (
          <button
            type="button"
            onClick={() => scrollCards(-1)}
            disabled={!scrollState.canScrollLeft}
            className={scrollButtonClass}
            aria-label="Geser kartu ke kiri"
          >
            <MdChevronLeft size={22} />
          </button>
        )}
        <div
          ref={cardsRef}
          onScroll={updateScrollState}
          className="flex min-w-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide"
        >
          {CARDS.map((card) => {
            const data = summary?.[card.key];
            const amount = card.lifetime ? data?.value : data?.total;
            const detail = card.lifetime
              ? `${data?.items ?? 0} barang aktif`
              : [card.note, `${data?.notas ?? 0} nota`].filter(Boolean).join(" · ");

            return (
              <div
                key={card.key}
                role="group"
                aria-label={card.title}
                className={CARD_WIDTH_CLASS}
                style={{ backgroundColor: card.color }}
              >
                <p className="text-xs font-medium leading-snug text-[#f5f5f5]">{card.title}</p>
                {/* The period on its own line under the title; the assets are lifetime. */}
                <p className="mt-0.5 text-[11px] leading-snug text-[#f5f5f5]/80">
                  {card.lifetime ? "Seumur hidup" : periodLabel}
                </p>
                <p className="mt-2 text-xl font-semibold text-[#f5f5f5]">
                  {isLoading || !summary ? "..." : currency(amount)}
                </p>
                {summary && <p className="mt-1 text-[11px] text-[#f5f5f5]/80">{detail}</p>}
              </div>
            );
          })}
        </div>
        {isScrollable && (
          <button
            type="button"
            onClick={() => scrollCards(1)}
            disabled={!scrollState.canScrollRight}
            className={scrollButtonClass}
            aria-label="Geser kartu ke kanan"
          >
            <MdChevronRight size={22} />
          </button>
        )}
      </div>
    </section>
  );
};

export default PurchaseSummaryCards;
