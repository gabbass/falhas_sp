import { Suspense } from "react";
import HomeDashboardRouter from "./home-dashboard-router";

export default function Page() {
  return (
    <Suspense fallback={<main className="dashboard-shell" aria-live="polite">Carregando painel...</main>}>
      <HomeDashboardRouter />
    </Suspense>
  );
}
