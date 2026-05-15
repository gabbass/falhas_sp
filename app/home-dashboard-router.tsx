"use client";

import { useSearchParams } from "next/navigation";
import DashboardOcorrencias2024 from "./dashboard-2024";
import DashboardOcorrencias2025 from "./dashboard-2025";

export default function HomeDashboardRouter() {
  const searchParams = useSearchParams();
  const anoParam = searchParams.get("ano");

  if (anoParam === "2024") {
    return <DashboardOcorrencias2024 />;
  }

  if (anoParam === "comparativo") {
    return <DashboardOcorrencias2025 modo="comparativo" />;
  }

  return <DashboardOcorrencias2025 />;
}
