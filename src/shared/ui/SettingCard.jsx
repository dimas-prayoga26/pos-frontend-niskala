// The one card of Menu → Promo and Pengaturan → API (the stamp card, each
// promo, each API): icon, title, info lines, actions on the right (a switch),
// what it holds below, and a footer of buttons. A region named after its
// title (or label). Cards side by side get one height, footers in line.
export const cardButtonClass =
  "rounded-lg bg-[#333] px-3 py-1.5 text-sm font-semibold text-[#f5f5f5] transition hover:bg-[#3d3d3d] disabled:opacity-60";
export const cardDangerButtonClass =
  "rounded-lg px-3 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-950/30 disabled:opacity-60";
export const cardPrimaryButtonClass =
  "rounded-lg bg-[#a79981] px-4 py-1.5 text-sm font-bold text-[#101010] transition hover:bg-[#b7aa94] disabled:opacity-60";

export default function SettingCard({ icon, title, label, subtitle, note, warning, actions, footer, children }) {
  return (
    <section aria-label={label || title} className="flex h-full flex-col rounded-lg bg-[#1f1f1f] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#AFA087]/15 text-[#AFA087]">
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#f5f5f5]">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-[#ababab]">{subtitle}</p>}
            {note && <p className="mt-1 text-xs text-[#8a8a8a]">{note}</p>}
            {warning && <p className="mt-1 text-sm font-semibold text-amber-300">{warning}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
      {footer && (
        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-center gap-2 border-t border-[#2e2e2e] pt-3">{footer}</div>
        </div>
      )}
    </section>
  );
}
