import { useState } from "react";
import Metrics from "../../../components/dashboard/Metrics";
import MenuPerformance from "./MenuPerformance";
import ViewSwitch from "./ViewSwitch";

const VIEWS = [
  { key: "summary", label: "Ringkasan" },
  { key: "menu-performance", label: "Menu Paling Laku" },
];

// Dashboard → Metrik: the business summary and the menus selling most (and
// least), one at a time, so the dashboard keeps one menu for its reports.
export default function MetricsTab() {
  const [view, setView] = useState("summary");

  return (
    <>
      <ViewSwitch label="Jenis metrik" views={VIEWS} value={view} onChange={setView} />
      {view === "summary" ? <Metrics /> : <MenuPerformance />}
    </>
  );
}
