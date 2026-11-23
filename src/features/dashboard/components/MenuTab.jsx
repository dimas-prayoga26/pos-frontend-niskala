import MenuManagement from "../../../components/dashboard/MenuManagement";
import useLoyaltyEnabled from "../../../shared/lib/useLoyaltyEnabled";
import { PromoProgramSettings } from "../../settings";

// Dashboard → Menu (admin): Menu Items, Promo (the stamp card above the promo
// cards) and Categories. Without a loyalty key (Pengaturan → API) the stamp
// card stays, disabled.
export default function MenuTab({ onCreateIngredient }) {
  const loyalty = useLoyaltyEnabled();

  return (
    <MenuManagement
      onCreateIngredient={onCreateIngredient}
      renderPromoHeader={
        loyalty.known
          ? ({ onEditMenu }) => <PromoProgramSettings onEditMenu={onEditMenu} disabled={!loyalty.enabled} />
          : null
      }
    />
  );
}
