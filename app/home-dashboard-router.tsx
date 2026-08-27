"use client";

import { useSearchParams } from "next/navigation";
import DashboardOcorrencias2024 from "./dashboard-2024";
import DashboardOcorrencias2025 from "./dashboard-2025";
import DashboardOcorrencias2026 from "./dashboard-2026";
import ComparativoPrimeiroSemestre from "./comparativo-primeiro-semestre";

export default function HomeDashboardRouter() {
  const searchParams = useSearchParams();
  const anoParam = searchParams.get("ano");

  if (anoParam === "2024") {
    return <DashboardOcorrencias2024 />;
  }

  if (anoParam === "comparativo") {
    return <ComparativoPrimeiroSemestre />;
  }

  if (anoParam === "2025") {
    return <DashboardOcorrencias2025 />;
  }

  return <DashboardOcorrencias2026 />;
}
