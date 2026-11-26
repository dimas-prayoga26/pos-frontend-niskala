import MenuManagement from "../../../components/dashboard/MenuManagement";
import useLoyaltyEnabled from "../../../shared/lib/useLoyaltyEnabled";
import { PromoProgramSettings } from "../../settings";

// Dashboard → Menu: Menu Items, Promo (the stamp card above the promo cards)
// and Categories; without a loyalty key (Pengaturan → API) the stamp card
// stays, disabled. Kasir (canManage false) add menus, promos and categories
// but change or delete nothing.
export default function MenuTab({ onCreateIngredient, canManage = true }) {
  const loyalty = useLoyaltyEnabled();

  return (
    <MenuManagement
      onCreateIngredient={onCreateIngredient}
      canManage={canManage}
      renderPromoHeader={
        loyalty.known
          ? ({ onEditMenu, readOnly }) => (
              <PromoProgramSettings onEditMenu={onEditMenu} readOnly={readOnly} disabled={!loyalty.enabled} />
            )
          : null
      }
    />
  );
}
