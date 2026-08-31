"use client";

import { Filter, Info, List, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const DASHBOARD_SCREENS = [
  { id: "abertura", label: "Abertura" },
  { id: "introducao", label: "Introdução" },
  { id: "resumo", label: "Resumo" },
  { id: "rankings", label: "Rankings" },
  { id: "tempo", label: "Tempo" },
  { id: "diagnosticos", label: "Diagnósticos" },
  { id: "linhas", label: "Linhas" },
  { id: "comparativo", label: "Comparativo" },
  { id: "registros", label: "Análises" },
] as const;

const SCREEN_DESCRIPTIONS: Record<DashboardScreenId, string> = {
  abertura: "Apresenta o propósito do Falhas SP, o período analisado, a fonte dos dados e a janela operacional adotada.",
  introducao: "Reúne as premissas centrais da metodologia e explica como cada categoria operacional é interpretada no painel.",
  resumo: "Sintetiza os principais indicadores do período selecionado, como horas esperadas, disponibilidade, manutenção e falhas.",
  rankings: "Compara a distribuição operacional e destaca linhas e operadores com maior concentração de horas ou registros.",
  tempo: "Mostra quando as ocorrências aconteceram e como os estados operacionais se distribuíram ao longo do período.",
  diagnosticos: "Explora padrões mensais, termos recorrentes e tipos de registro para apoiar a interpretação dos dados.",
  comparativo: "Compara períodos equivalentes e mostra variações de disponibilidade, horas e registros entre as bases.",
  linhas: "Detalha os indicadores de cada linha e permite comparar seu desempenho dentro do recorte aplicado.",
  registros: "Reúne, em abas, a leitura humana e a análise produzida com apoio de inteligência artificial.",
};

export type DashboardScreenId = (typeof DASHBOARD_SCREENS)[number]["id"];

const ScreenContext = createContext<DashboardScreenId>("abertura");
const ToolbarActionsContext = createContext<{
  activeFilterCount: number;
  filtersOpen: boolean;
  legendOpen: boolean;
  openFilters: () => void;
  openLegend: () => void;
} | null>(null);
const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function isDashboardScreen(value: string | null): value is DashboardScreenId {
  return DASHBOARD_SCREENS.some((screen) => screen.id === value);
}

export function DashboardSlide({
  id,
  children,
  className = "",
}: {
  id: DashboardScreenId;
  children: ReactNode;
  className?: string;
}) {
  const activeScreen = useContext(ScreenContext);
  return (
    <section
      className={`dashboard-slide dashboard-slide-${id} ${className}`.trim()}
      aria-labelledby={`dashboard-screen-${id}`}
      aria-hidden={activeScreen !== id}
      hidden={activeScreen !== id}
    >
      <h2 id={`dashboard-screen-${id}`} className="sr-only">
        {DASHBOARD_SCREENS.find((screen) => screen.id === id)?.label}
      </h2>
      {children}
    </section>
  );
}

export function DashboardFilterPanel({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function DashboardChrome({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function DashboardToolbarActions() {
  const actions = useContext(ToolbarActionsContext);
  if (!actions) return null;

  return (
    <div className="dashboard-toolbar-actions" aria-label="Ferramentas do painel">
      <button
        type="button"
        className="dashboard-filter-trigger dashboard-toolbar-filter-trigger"
        onClick={actions.openFilters}
        aria-expanded={actions.filtersOpen}
        aria-haspopup="dialog"
      >
        <Filter size={16} />
        Filtros
        {actions.activeFilterCount ? <em>{actions.activeFilterCount}</em> : null}
      </button>
      <button
        type="button"
        className="dashboard-filter-trigger dashboard-legend-trigger"
        onClick={actions.openLegend}
        aria-expanded={actions.legendOpen}
        aria-haspopup="dialog"
      >
        <List size={16} />
        Legenda
      </button>
    </div>
  );
}

export function DashboardLegend({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function DashboardOverlay({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default function DashboardCarousel({
  children,
  activeFilterCount,
}: {
  children: ReactNode;
  activeFilterCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedScreen = searchParams.get("tela");
  const legacyComparison = searchParams.get("comparativo") === "1" || searchParams.get("ano") === "comparativo";
  const initialScreen = isDashboardScreen(requestedScreen) ? requestedScreen : legacyComparison ? "comparativo" : "abertura";
  const [activeScreen, setActiveScreen] = useState<DashboardScreenId>(initialScreen);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [screenInfoOpen, setScreenInfoOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">("forward");
  const activeScreenRef = useRef<DashboardScreenId>(initialScreen);

  useEffect(() => {
    const nextScreen = isDashboardScreen(requestedScreen) ? requestedScreen : legacyComparison ? "comparativo" : "abertura";
    const currentScreen = activeScreenRef.current;
    if (nextScreen === currentScreen) return;

    const currentIndex = DASHBOARD_SCREENS.findIndex((screen) => screen.id === currentScreen);
    const nextIndex = DASHBOARD_SCREENS.findIndex((screen) => screen.id === nextScreen);
    setSlideDirection(nextIndex > currentIndex ? "forward" : "backward");
    activeScreenRef.current = nextScreen;
    setActiveScreen(nextScreen);
  }, [legacyComparison, requestedScreen]);

  const activeIndex = DASHBOARD_SCREENS.findIndex((screen) => screen.id === activeScreen);
  const activeLabel = DASHBOARD_SCREENS[activeIndex]?.label ?? "Abertura";

  const navigate = (next: DashboardScreenId) => {
    if (next === activeScreen) return;
    const nextIndex = DASHBOARD_SCREENS.findIndex((screen) => screen.id === next);
    setSlideDirection(nextIndex > activeIndex ? "forward" : "backward");
    activeScreenRef.current = next;
    setActiveScreen(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "abertura") params.delete("tela");
    else params.set("tela", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const move = (direction: -1 | 1) => {
    const next = DASHBOARD_SCREENS[activeIndex + direction];
    if (next) navigate(next.id);
  };

  const childElements = useMemo(() => Children.toArray(children).filter(isValidElement), [children]);
  const filterElement = childElements.find((child) => child.type === DashboardFilterPanel);
  const chromeElement = childElements.find((child) => child.type === DashboardChrome);
  const legendElement = childElements.find((child) => child.type === DashboardLegend);
  const overlayElement = childElements.find((child) => child.type === DashboardOverlay);
  const slides = childElements.filter(
    (child) =>
      child.type !== DashboardFilterPanel &&
      child.type !== DashboardChrome &&
      child.type !== DashboardLegend &&
      child.type !== DashboardOverlay,
  );

  useEffect(() => {
    if (!filtersOpen && !legendOpen) return;
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
        setLegendOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [filtersOpen, legendOpen]);

  return (
    <ScreenContext.Provider value={activeScreen}>
      <ToolbarActionsContext.Provider value={{
        activeFilterCount,
        filtersOpen,
        legendOpen,
        openFilters: () => setFiltersOpen(true),
        openLegend: () => setLegendOpen(true),
      }}>
      <div
        className="dashboard-carousel"
        aria-roledescription="carrossel"
        aria-label="Telas do painel"
      >
        {activeIndex >= 2 ? (
          <div className="dashboard-carousel-toolbar">
            <div className="dashboard-carousel-chrome">{chromeElement}</div>
          </div>
        ) : null}
        <div className="dashboard-screen-status" aria-live="polite">
          <span>{activeIndex + 1} de {DASHBOARD_SCREENS.length}</span>
          <div className="dashboard-screen-title">
            <strong>{activeLabel}</strong>
            <button
              type="button"
              className="dashboard-screen-info-trigger"
              onClick={() => setScreenInfoOpen(true)}
              aria-label={`Sobre a página ${activeLabel}`}
              aria-haspopup="dialog"
            >
              <Info size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="dashboard-slide-viewport" data-slide-direction={slideDirection}>{slides}</div>

        <nav className="dashboard-carousel-nav" aria-label="Navegação entre telas">
          <button type="button" onClick={() => move(-1)} disabled={activeIndex === 0} aria-label="Tela anterior">
            <img src={`${assetBase}/images/seta_esquerda.svg`} alt="" aria-hidden="true" />
          </button>
          <div className="dashboard-carousel-dots">
            {DASHBOARD_SCREENS.map((screen, index) => {
              const isActive = screen.id === activeScreen;
              const indicatorImage = index === 0
                ? isActive
                  ? "arte-linhas_Inicio.svg"
                  : "arte-linhas_Inicio_off.svg"
                : index === DASHBOARD_SCREENS.length - 1
                  ? isActive
                    ? "arte-linhas_Fim.svg"
                    : "arte-linhas_Fim_off.svg"
                  : isActive
                    ? "arte-linhas_Meio%20On.svg"
                    : "arte-linhas_Meio%20off.svg";

              return (
                <button
                  key={screen.id}
                  type="button"
                  className={isActive ? "is-active" : ""}
                  onClick={() => navigate(screen.id)}
                  aria-label={`Abrir tela ${index + 1}: ${screen.label}`}
                  aria-current={isActive ? "step" : undefined}
                  title={screen.label}
                >
                  <img src={`${assetBase}/images/${indicatorImage}`} alt="" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => move(1)} disabled={activeIndex === DASHBOARD_SCREENS.length - 1} aria-label="Próxima tela">
            <img src={`${assetBase}/images/seta_direita.svg`} alt="" aria-hidden="true" />
          </button>
        </nav>
      </div>

      {filtersOpen ? (
        <div className="dashboard-filter-backdrop" role="presentation" onMouseDown={() => setFiltersOpen(false)}>
          <div className="dashboard-filter-dialog" role="dialog" aria-modal="true" aria-label="Filtros globais" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="dashboard-filter-close" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros">
              <X size={19} />
            </button>
            {filterElement}
          </div>
        </div>
      ) : null}

      {legendOpen ? (
        <div className="dashboard-filter-backdrop dashboard-legend-backdrop" role="presentation" onMouseDown={() => setLegendOpen(false)}>
          <div className="dashboard-filter-dialog dashboard-legend-dialog" role="dialog" aria-modal="true" aria-label="Legenda do painel" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="dashboard-filter-close" onClick={() => setLegendOpen(false)} aria-label="Fechar legenda">
              <X size={19} />
            </button>
            {legendElement}
          </div>
        </div>
      ) : null}

      {screenInfoOpen ? (
        <div className="dashboard-info-backdrop" role="presentation" onMouseDown={() => setScreenInfoOpen(false)}>
          <section
            className="dashboard-info-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-info-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="dashboard-info-close" onClick={() => setScreenInfoOpen(false)} aria-label="Fechar explicação">
              <X size={18} aria-hidden="true" />
            </button>
            <span>Sobre esta página</span>
            <h2 id="dashboard-info-title">{activeLabel}</h2>
            <p>{SCREEN_DESCRIPTIONS[activeScreen]}</p>
          </section>
        </div>
      ) : null}
      {overlayElement}
      </ToolbarActionsContext.Provider>
    </ScreenContext.Provider>
  );
}
