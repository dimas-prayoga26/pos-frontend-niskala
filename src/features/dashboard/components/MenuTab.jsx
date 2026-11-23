import MenuManagement from "../../../components/dashboard/MenuManagement";
import useLoyaltyEnabled from "../../../shared/lib/useLoyaltyEnabled";
import { PromoProgramSettings } from "../../settings";

// Dashboard → Menu (admin): Menu Items, Promo (a card per promo, the stamp
// card first with the menu of each reward) and Categories. Without a loyalty
// key (Pengaturan → API) there is no stamp card.
export default function MenuTab({ onCreateIngredient }) {
  const loyalty = useLoyaltyEnabled();

  return (
    <MenuManagement
      onCreateIngredient={onCreateIngredient}
      renderPromoHeader={
        loyalty.enabled ? ({ onEditMenu }) => <PromoProgramSettings onEditMenu={onEditMenu} /> : null
      }
    />
  );
}
