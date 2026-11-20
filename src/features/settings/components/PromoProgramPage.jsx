import PromoProgramSettings from "./PromoProgramSettings";

// Dashboard → Menu → Program Promo (admin): the stamp card on/off, the
// menu each reward gives, and the rewards handed over (Riwayat).
export default function PromoProgramPage() {
  return (
    <div className="container mx-auto rounded-lg bg-[#262626] p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#f5f5f5]">Program Promo</h2>
        <p className="mt-1 text-sm text-[#ababab]">
          Nyalakan atau matikan program promo, pilih menu hadiahnya, dan lihat riwayat penukaran.
        </p>
      </div>
      <PromoProgramSettings />
    </div>
  );
}
