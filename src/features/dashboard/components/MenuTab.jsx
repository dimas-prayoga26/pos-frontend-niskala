import { useState } from "react";
import MenuManagement from "../../../components/dashboard/MenuManagement";
import { PromoProgramPage } from "../../settings";
import ViewSwitch from "./ViewSwitch";

const VIEWS = [
  { key: "menus", label: "Daftar Menu" },
  { key: "promo", label: "Program Promo" },
];

// Dashboard → Menu (admin): the menus, and Program Promo next to them since
// each reward gives a Kategori Promo menu.
export default function MenuTab({ onCreateIngredient }) {
  const [view, setView] = useState("menus");

  return (
    <>
      <ViewSwitch label="Jenis menu" views={VIEWS} value={view} onChange={setView} />
      {view === "menus" ? <MenuManagement onCreateIngredient={onCreateIngredient} /> : <PromoProgramPage />}
    </>
  );
}
