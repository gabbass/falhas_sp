import DashboardOcorrencias2024 from "./dashboard-2024";
import DashboardOcorrencias2025 from "./dashboard-2025";

type PageProps = {
  searchParams: Promise<{
    ano?: string | string[];
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const anoParam = Array.isArray(params?.ano) ? params.ano[0] : params?.ano;

  if (anoParam === "2024") {
    return <DashboardOcorrencias2024 />;
  }

  if (anoParam === "comparativo") {
    return <DashboardOcorrencias2025 modo="comparativo" />;
  }

  return <DashboardOcorrencias2025 />;
}
