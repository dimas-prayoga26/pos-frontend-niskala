// The views of one dashboard tab (Metrik: Ringkasan | Menu Paling Laku;
// Menu: Daftar Menu | Program Promo), one shown at a time.
export default function ViewSwitch({ label, views, value, onChange }) {
  return (
    <div className="container mx-auto px-4 pb-4 md:px-6">
      <div role="group" aria-label={label} className="inline-flex gap-1 rounded-lg bg-[#262626] p-1">
        {views.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6c7ae] ${
              value === option.key ? "bg-[#a79981] text-[#101010]" : "text-[#ababab] hover:text-[#f5f5f5]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
