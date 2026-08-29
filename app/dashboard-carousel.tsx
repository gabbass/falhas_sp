"use client";

import { Filter, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Children,
  createContext,
  isValidElement,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const DASHBOARD_SCREENS = [
  { id: "abertura", label: "Abertura" },
  { id: "resumo", label: "Resumo" },
  { id: "rankings", label: "Rankings" },
  { id: "tempo", label: "Tempo" },
  { id: "diagnosticos", label: "Diagnósticos" },
  { id: "linhas", label: "Linhas" },
  { id: "registros", label: "Registros" },
  { id: "comparativo", label: "Comparativo" },
] as const;

export type DashboardScreenId = (typeof DASHBOARD_SCREENS)[number]["id"];

const ScreenContext = createContext<DashboardScreenId>("abertura");
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

export function DashboardLegend({ children }: { children: ReactNode }) {
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
  const pointerStart = useRef<number | null>(null);

  useEffect(() => {
    setActiveScreen(isDashboardScreen(requestedScreen) ? requestedScreen : legacyComparison ? "comparativo" : "abertura");
  }, [legacyComparison, requestedScreen]);

  const activeIndex = DASHBOARD_SCREENS.findIndex((screen) => screen.id === activeScreen);
  const activeLabel = DASHBOARD_SCREENS[activeIndex]?.label ?? "Abertura";

  const navigate = (next: DashboardScreenId) => {
    if (next === activeScreen) return;
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

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, select, textarea, button, a")) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStart.current = event.clientX;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) < 70) return;
    move(delta > 0 ? -1 : 1);
  };

  const childElements = useMemo(() => Children.toArray(children).filter(isValidElement), [children]);
  const filterElement = childElements.find((child) => child.type === DashboardFilterPanel);
  const chromeElement = childElements.find((child) => child.type === DashboardChrome);
  const legendElement = childElements.find((child) => child.type === DashboardLegend);
  const slides = childElements.filter(
    (child) =>
      child.type !== DashboardFilterPanel &&
      child.type !== DashboardChrome &&
      child.type !== DashboardLegend,
  );

  useEffect(() => {
    if (!filtersOpen) return;
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [filtersOpen]);

  return (
    <ScreenContext.Provider value={activeScreen}>
      <div
        className="dashboard-carousel"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        aria-roledescription="carrossel"
        aria-label="Telas do painel"
      >
        {activeIndex >= 1 && activeScreen !== "comparativo" ? (
          <div className="dashboard-carousel-toolbar">
            <div className="dashboard-carousel-chrome">{chromeElement}</div>
            <div className="dashboard-carousel-toolbar-row">
              <button
                type="button"
                className="dashboard-filter-trigger dashboard-toolbar-filter-trigger"
                onClick={() => setFiltersOpen(true)}
                aria-expanded={filtersOpen}
              >
                <Filter size={16} />
                Filtros
                {activeFilterCount ? <em>{activeFilterCount}</em> : null}
              </button>
              <div className="dashboard-carousel-legend">{legendElement}</div>
            </div>
          </div>
        ) : null}
        <div className="dashboard-screen-status" aria-live="polite">
          <span>{activeIndex + 1} de {DASHBOARD_SCREENS.length}</span>
          <strong>{activeLabel}</strong>
        </div>

        <div className="dashboard-slide-viewport">{slides}</div>

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
    </ScreenContext.Provider>
  );
}
