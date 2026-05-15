"use client";

import eventosData from "../data/eventos-relevantes.json";
import { ExternalLink, Newspaper, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type AnoEvento = "2024" | "2025";
type AnoFiltro = AnoEvento | "todos";

type EventoRelevante = {
  ano: AnoEvento;
  data: string;
  dataLabel: string;
  operador: string;
  linhas: string;
  eventoEstrutural: string;
  tituloFonte: string;
  link: string;
};

type EventosRelevantesPayload = {
  metadata: {
    fonte: string;
    descricao: string;
    totalEventos: number;
    total2024: number;
    total2025: number;
  };
  eventos: EventoRelevante[];
};

type EventosRelevantesPopupProps = {
  anoInicial?: AnoFiltro;
};

const payload = eventosData as EventosRelevantesPayload;
const eventos = payload.eventos;

function rotuloFiltro(ano: AnoFiltro) {
  if (ano === "todos") return "Todos";
  return ano;
}

export default function EventosRelevantesPopup({ anoInicial = "todos" }: EventosRelevantesPopupProps) {
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState<AnoFiltro>(anoInicial);
  const [portalPronto, setPortalPronto] = useState(false);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    setAno(anoInicial);
  }, [aberto, anoInicial]);

  useEffect(() => {
    if (!aberto) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAberto(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [aberto]);

  const eventosFiltrados = useMemo(() => {
    if (ano === "todos") return eventos;
    return eventos.filter((evento) => evento.ano === ano);
  }, [ano]);

  return (
    <>
      <button
        type="button"
        className="hero-tab-action eventos-relevantes-trigger"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        Eventos relevantes
      </button>

      {aberto && portalPronto
        ? createPortal(
            <div
              className="eventos-relevantes-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setAberto(false);
                }
              }}
            >
              <section
                className="eventos-relevantes-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="eventos-relevantes-title"
                aria-describedby="eventos-relevantes-description"
              >
                <header className="eventos-relevantes-header">
                  <div>
                    <span className="eventos-relevantes-kicker">
                      <Newspaper size={16} aria-hidden="true" />
                      Referências públicas
                    </span>
                    <h2 id="eventos-relevantes-title">Eventos relevantes</h2>
                    <p id="eventos-relevantes-description">
                      Marcos estruturais, operacionais e contratuais relevantes para interpretar o período analisado,
                      consolidados a partir da planilha anexada ao painel.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="eventos-relevantes-close"
                    onClick={() => setAberto(false)}
                    aria-label="Fechar eventos relevantes"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </header>

                <div className="eventos-relevantes-toolbar" aria-label="Filtro de eventos relevantes por ano">
                  {(["todos", "2025", "2024"] as AnoFiltro[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={ano === item ? "is-active" : ""}
                      onClick={() => setAno(item)}
                      aria-pressed={ano === item}
                    >
                      {rotuloFiltro(item)}
                    </button>
                  ))}
                  <span>
                    {eventosFiltrados.length} evento{eventosFiltrados.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="eventos-relevantes-lista">
                  {eventosFiltrados.map((evento) => (
                    <article className="evento-relevante-card" key={`${evento.ano}-${evento.data}-${evento.tituloFonte}`}>
                      <div className="evento-relevante-meta">
                        <span>{evento.dataLabel}</span>
                        <strong>{evento.ano}</strong>
                      </div>
                      <div className="evento-relevante-conteudo">
                        <h3>{evento.eventoEstrutural}</h3>
                        <p>
                          <strong>{evento.operador}</strong> · {evento.linhas}
                        </p>
                        <p>Fonte: {evento.tituloFonte}</p>
                        <a href={evento.link} target="_blank" rel="noreferrer">
                          Abrir fonte
                          <ExternalLink size={15} aria-hidden="true" />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>

                <footer className="eventos-relevantes-footer">
                  <span>
                    {payload.metadata.total2025} eventos de 2025 · {payload.metadata.total2024} eventos de 2024
                  </span>
                  <small>Fonte de consolidação: planilha de ocorrências e eventos relevantes anexada ao painel.</small>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
