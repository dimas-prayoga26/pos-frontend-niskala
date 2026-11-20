import { useState } from "react";
import MenuManagement from "../../../components/dashboard/MenuManagement";
// LOYALTY: dimatikan sementara di main (aktif di develop).
// import { PromoProgramPage } from "../../settings";
import ViewSwitch from "./ViewSwitch";

const VIEWS = [
  { key: "menus", label: "Daftar Menu" },
  // LOYALTY: dimatikan sementara di main (aktif di develop).
  // { key: "promo", label: "Program Promo" },
];

// Dashboard → Menu (admin): the menus, and Program Promo next to them since
// each reward gives a Kategori Promo menu. One view only: no switch.
export default function MenuTab({ onCreateIngredient }) {
  const [view, setView] = useState("menus");

  return (
    <>
      {VIEWS.length > 1 && <ViewSwitch label="Jenis menu" views={VIEWS} value={view} onChange={setView} />}
      {view === "menus" && <MenuManagement onCreateIngredient={onCreateIngredient} />}
      {/* LOYALTY: dimatikan sementara di main (aktif di develop). */}
      {/* {view === "promo" && <PromoProgramPage />} */}
    </>
  );
}
