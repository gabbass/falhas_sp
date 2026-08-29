"use client";

import { useSearchParams } from "next/navigation";
import DashboardOcorrencias2024 from "./dashboard-2024";
import DashboardOcorrencias2025 from "./dashboard-2025";
import DashboardOcorrencias2026 from "./dashboard-2026";

export default function HomeDashboardRouter() {
  const searchParams = useSearchParams();
  const anoParam = searchParams.get("ano");
  const comparativoAberto = searchParams.get("comparativo") === "1" || anoParam === "comparativo";

  if (anoParam === "2024") {
    return <DashboardOcorrencias2024 comparativoAberto={comparativoAberto} />;
  }

  if (anoParam === "2025") {
    return <DashboardOcorrencias2025 comparativoAberto={comparativoAberto} />;
  }

  return <DashboardOcorrencias2026 comparativoAberto={comparativoAberto} />;
}
