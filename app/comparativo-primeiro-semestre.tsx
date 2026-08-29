"use client";

import data2024 from "../data/ocorrencias-summary-2024-1sem.json";
import data2024SegundoSemestre from "../data/ocorrencias-summary-2024-2sem.json";
import data2025 from "../data/ocorrencias-summary-2025-1sem.json";
import data2025SegundoSemestre from "../data/ocorrencias-summary-2025-2sem.json";
import data2026 from "../data/ocorrencias-summary-2026.json";
import { Info } from "lucide-react";
import { useState } from "react";
import LineBadge from "./line-badge";

type Summary = typeof data2026;
type KpiKey = keyof Summary["kpis"];

const bases = [
  { id: "2026-1", ano: "2026", semestre: 1, rotulo: "1º sem. 2026", data: data2026 },
  { id: "2025-1", ano: "2025", semestre: 1, rotulo: "1º sem. 2025", data: data2025 },
  { id: "2024-1", ano: "2024", semestre: 1, rotulo: "1º sem. 2024", data: data2024 },
  { id: "2025-2", ano: "2025", semestre: 2, rotulo: "2º sem. 2025", data: data2025SegundoSemestre },
  { id: "2024-2", ano: "2024", semestre: 2, rotulo: "2º sem. 2024", data: data2024SegundoSemestre },
] as const;

type BaseId = (typeof bases)[number]["id"];
type BaseComparavel = (typeof bases)[number];
type FormatoMetrica = "percentual" | "horas" | "inteiro";
type SentidoMetrica = "maior-melhor" | "menor-melhor" | "contextual";

const metricas: Array<{
  label: string;
  chave: KpiKey;
  formato: FormatoMetrica;
  sentido: SentidoMetrica;
  detalhe: string;
}> = [
  { label: "Disponibilidade", chave: "disponibilidadePct", formato: "percentual", sentido: "maior-melhor", detalhe: "Percentual do tempo operacional esperado classificado como disponível." },
  { label: "Manutenção programada", chave: "horasManutencaoProgramada", formato: "horas", sentido: "menor-melhor", detalhe: "Tempo associado a manutenção ou atividade explicitamente programada." },
  { label: "Ocorrências operacionais", chave: "horasFalhaParcial", formato: "horas", sentido: "menor-melhor", detalhe: "Tempo de circulação parcial, maiores intervalos ou falhas operacionais." },
  { label: "Paralisação total", chave: "horasFalhaTotal", formato: "horas", sentido: "menor-melhor", detalhe: "Tempo em que a linha foi classificada como paralisada." },
  { label: "Eventos especiais", chave: "horasEventoEspecial", formato: "horas", sentido: "contextual", detalhe: "Tempo de operação diferenciada ou evento especial." },
  { label: "Registros normalizados", chave: "qtdRegistros", formato: "inteiro", sentido: "contextual", detalhe: "Quantidade de mudanças de status aproveitadas pelo algoritmo." },
];

function numero(valor: number, formato: FormatoMetrica) {
  if (formato === "percentual") return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (formato === "horas") return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
  return Math.round(valor).toLocaleString("pt-BR");
}

function rotuloPercentualDelta(atual: number, referencia: number) {
  if (referencia === 0) return atual === 0 ? "0,00%" : "sem base %";
  const variacao = ((atual - referencia) / Math.abs(referencia)) * 100;
  const sinal = variacao > 0 ? "+" : variacao < 0 ? "−" : "";
  return `${sinal}${Math.abs(variacao).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function rotuloDelta(atual: number, referencia: number, formato: FormatoMetrica) {
  const delta = atual - referencia;
  const sinal = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const absoluto = Math.abs(delta);
  const valor = formato === "percentual"
    ? `${absoluto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`
    : numero(absoluto, formato);
  return `${sinal}${valor} (${rotuloPercentualDelta(atual, referencia)})`;
}

function classeTendencia(atual: number, referencia: number, sentido: SentidoMetrica) {
  const delta = atual - referencia;
  if (delta === 0 || sentido === "contextual") return "is-contextual";
  const melhorou = sentido === "maior-melhor" ? delta > 0 : delta < 0;
  return melhorou ? "is-favorable" : "is-unfavorable";
}

function Tendencia({
  atual,
  referencia,
  rotuloReferencia,
  sentido,
  formato,
}: {
  atual: number;
  referencia: number;
  rotuloReferencia: string;
  sentido: SentidoMetrica;
  formato: FormatoMetrica;
}) {
  const delta = atual - referencia;
  const simbolo = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  return (
    <span
      className={`comparison-trend ${classeTendencia(atual, referencia, sentido)}`}
      title={`Variação percentual em relação a ${rotuloReferencia}`}
    >
      <span className="comparison-trend-icon" aria-hidden="true">{simbolo}</span>
      <span>{rotuloDelta(atual, referencia, formato)}</span>
      <small>vs. {rotuloReferencia}</small>
    </span>
  );
}

function linhasPorNome(data: Summary) {
  return new Map(data.rankings.linhas.map((linha) => [linha.nome, linha]));
}

function valorBaseMedia(basesReferencia: BaseComparavel[], chave: KpiKey) {
  if (chave === "disponibilidadePct") {
    const disponivel = basesReferencia.reduce((total, base) => total + Number(base.data.kpis.horasDisponivel), 0);
    const esperado = basesReferencia.reduce((total, base) => total + Number(base.data.kpis.horasTotaisOperacao), 0);
    return esperado > 0 ? (disponivel / esperado) * 100 : 0;
  }
  if (!basesReferencia.length) return 0;
  return basesReferencia.reduce((total, base) => total + Number(base.data.kpis[chave]), 0) / basesReferencia.length;
}

function linhaBaseMedia(basesReferencia: BaseComparavel[], nome: string) {
  const linhas = basesReferencia
    .map((base) => base.data.rankings.linhas.find((linha) => linha.nome === nome))
    .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
  if (!linhas.length) return null;
  const horasTotaisOperacao = linhas.reduce((total, linha) => total + linha.horasTotaisOperacao, 0);
  const horasDisponivel = linhas.reduce((total, linha) => total + linha.horasDisponivel, 0);
  return {
    disponibilidadePct: horasTotaisOperacao > 0 ? (horasDisponivel / horasTotaisOperacao) * 100 : 0,
    horasFalhaParcial: linhas.reduce((total, linha) => total + linha.horasFalhaParcial, 0) / linhas.length,
    horasManutencaoProgramada: linhas.reduce((total, linha) => total + linha.horasManutencaoProgramada, 0) / linhas.length,
  };
}

function numeroLinha(nome: string) {
  return Number(nome.match(/linha\s*0*(\d+)/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function displayLinhaName(nome: string) {
  return nome.replace(/^(Linha\s+)0*(\d+)/i, (_match, prefixo: string, valor: string) =>
    `${prefixo}${valor.padStart(2, "0")}`,
  );
}

export default function ComparativoPrimeiroSemestre({ embedded = false }: { embedded?: boolean }) {
  const [basePrincipalId, setBasePrincipalId] = useState<BaseId>("2026-1");
  const [basesReferenciaIds, setBasesReferenciaIds] = useState<BaseId[]>(["2025-1", "2024-1"]);
  const [usarMediaReferencias, setUsarMediaReferencias] = useState(false);

  const basePrincipal = bases.find((base) => base.id === basePrincipalId)!;
  const basesCompativeis = bases.filter((base) => base.semestre === basePrincipal.semestre && base.id !== basePrincipalId);
  const basesReferencia = bases.filter((base) => basesReferenciaIds.includes(base.id));
  const rotuloReferencias = basesReferencia.map((base) => base.rotulo).join(" + ");
  const baseMediaAtiva = usarMediaReferencias && basesReferencia.length === 2;
  const basesEmUso = [basePrincipal, ...basesReferencia];
  const basesVisiveis = [basePrincipal, ...basesReferencia];
  const mapasPorBase = new Map(basesEmUso.map((base) => [base.id, linhasPorNome(base.data as Summary)]));
  const nomesLinhas = Array.from(
    new Set(basesEmUso.flatMap((base) => base.data.rankings.linhas.map((linha) => linha.nome))),
  ).sort((a, b) => numeroLinha(a) - numeroLinha(b) || a.localeCompare(b, "pt-BR"));

  const escolherPrincipal = (id: BaseId) => {
    if (id === basePrincipalId) return;
    const proximaBase = bases.find((base) => base.id === id)!;
    setBasePrincipalId(id);
    setBasesReferenciaIds(
      bases.filter((base) => base.semestre === proximaBase.semestre && base.id !== id).map((base) => base.id),
    );
    setUsarMediaReferencias(false);
  };

  const alternarReferencia = (id: BaseId) => {
    if (id === basePrincipalId) return;
    if (basesReferenciaIds.includes(id)) {
      if (basesReferenciaIds.length === 1) return;
      const proximos = basesReferenciaIds.filter((item) => item !== id);
      setBasesReferenciaIds(proximos);
      if (proximos.length !== 2) setUsarMediaReferencias(false);
      return;
    }
    setBasesReferenciaIds(basesCompativeis.map((base) => base.id).filter((item) => item === id || basesReferenciaIds.includes(item)));
  };

  const selecionarTodasReferencias = () => {
    setBasesReferenciaIds(basesCompativeis.map((base) => base.id));
  };

  const Root = embedded ? "div" : "main";

  return (
    <Root
      id={embedded ? "comparativo" : undefined}
      className={embedded ? "comparison-embedded" : "page dashboard-page comparison-only-page"}
    >
      <section className="panel comparison-panel" aria-labelledby="comparativo-semestral-title">
        <div className="comparison-heading">
          <div>
            <h2 id="comparativo-semestral-title">Comparativo</h2>
            <p>
              Compare o período analisado com períodos de referência do mesmo semestre.
              A diferença é sempre calculada como analisado menos comparado, em valor absoluto e percentual.
            </p>
          </div>
          <span className="comparison-badge">{basePrincipal.semestre}º semestre</span>
        </div>
        <div className="comparison-scroll-content">
        <div className="comparison-period-controls">
        <fieldset className="comparison-year-selector">
          <legend>Período analisado</legend>
          <div>
            {bases.map((base) => (
              <label key={`principal-${base.id}`} className={basePrincipalId === base.id ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="periodo-principal"
                  checked={basePrincipalId === base.id}
                  onChange={() => escolherPrincipal(base.id)}
                />
                <span>{base.rotulo}</span>
              </label>
            ))}
          </div>
          <small>Este é o período cujo resultado será avaliado.</small>
        </fieldset>

        <fieldset className="comparison-reference-selector">
          <legend>Comparar com</legend>
          <div>
            {bases.map((base) => {
              const ehPrincipal = base.id === basePrincipalId;
              const semestreIncompativel = base.semestre !== basePrincipal.semestre;
              const marcado = basesReferenciaIds.includes(base.id);
              const ultimaReferencia = marcado && basesReferenciaIds.length === 1;
              const desabilitado = ehPrincipal || semestreIncompativel || ultimaReferencia;
              return (
                <label
                  key={`referencia-${base.id}`}
                  className={`${marcado ? "is-selected" : ""} ${ehPrincipal || semestreIncompativel ? "is-disabled" : ""}`.trim()}
                  title={semestreIncompativel ? "Primeiro e segundo semestre não podem ser comparados entre si." : ehPrincipal ? "O período analisado não pode ser referência para si próprio." : undefined}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={desabilitado}
                    onChange={() => alternarReferencia(base.id)}
                  />
                  <span>{base.rotulo}{ehPrincipal ? " · analisado" : ""}</span>
                </label>
              );
            })}
            <button type="button" className="comparison-select-all" onClick={selecionarTodasReferencias}>
              Todos os outros períodos
            </button>
          </div>
          <small>Pelo menos uma referência do mesmo semestre deve permanecer marcada. Semestres diferentes ficam bloqueados.</small>
        </fieldset>

        <div className="comparison-sum-option">
          <label className={baseMediaAtiva ? "is-selected" : ""}>
            <input
              type="checkbox"
              checked={baseMediaAtiva}
              disabled={basesReferencia.length !== 2}
              onChange={(event) => setUsarMediaReferencias(event.target.checked)}
            />
            <span>Usar a média das duas referências</span>
          </label>
          {baseMediaAtiva ? <span className="comparison-sum-badge">MÉDIA: {rotuloReferencias}</span> : null}
          <small>
            {basesReferencia.length === 2
              ? "Horas e quantidades usam a média aritmética; a disponibilidade usa a média ponderada pelo tempo operacional."
              : "Selecione exatamente dois períodos de referência para habilitar a média."}
          </small>
        </div>
        </div>

        <div className="comparison-grid">
          {metricas.map((metrica) => {
            const valorPrincipal = Number(basePrincipal.data.kpis[metrica.chave]);
            const explicacao = `${metrica.detalhe} A diferença sempre parte do período comparado para o analisado: período analisado − período comparado. Por exemplo, comparado 5 e analisado 1 resulta em queda de 4.`;
            return (
              <article className="comparison-card" key={metrica.chave}>
                <header className="comparison-card-header">
                  <span>{metrica.label}</span>
                  <span className="kpi-info">
                    <button type="button" aria-label={`Informações sobre ${metrica.label}: ${explicacao}`}>
                      <Info size={15} aria-hidden="true" />
                    </button>
                    <span className="kpi-tooltip" role="tooltip">{explicacao}</span>
                  </span>
                </header>
                <div className="comparison-card-columns">
                  {baseMediaAtiva ? (
                    <>
                      <span className="comparison-card-column comparison-primary-value">
                        <small>{basePrincipal.rotulo}</small>
                        <strong>{numero(valorPrincipal, metrica.formato)}</strong>
                        <em>Analisado</em>
                      </span>
                      <span className="comparison-card-column comparison-secondary-value is-summed">
                        <small>Média {rotuloReferencias}</small>
                        <b>{numero(valorBaseMedia(basesReferencia, metrica.chave), metrica.formato)}</b>
                        <Tendencia
                          atual={valorPrincipal}
                          referencia={valorBaseMedia(basesReferencia, metrica.chave)}
                          rotuloReferencia={`média ${rotuloReferencias}`}
                          sentido={metrica.sentido}
                          formato={metrica.formato}
                        />
                      </span>
                    </>
                  ) : basesVisiveis.map((base) => {
                    const ehPrincipal = base.id === basePrincipalId;
                    const valor = Number(base.data.kpis[metrica.chave]);
                    return (
                      <span
                        className={`comparison-card-column ${ehPrincipal ? "comparison-primary-value" : "comparison-secondary-value"}`}
                        key={`${metrica.chave}-${base.id}`}
                      >
                        <small>{base.rotulo}</small>
                        {ehPrincipal
                          ? <strong>{numero(valor, metrica.formato)}</strong>
                          : <b>{numero(valor, metrica.formato)}</b>}
                        {ehPrincipal ? <em>Analisado</em> : null}
                        {!ehPrincipal ? (
                          <Tendencia
                            atual={valorPrincipal}
                            referencia={valor}
                            rotuloReferencia={base.rotulo}
                            sentido={metrica.sentido}
                            formato={metrica.formato}
                          />
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
        <div className="comparison-lines-block">
          <div className="comparison-subheading">
            <h3>Disponibilidade e horas de ocorrência por linha</h3>
            <p>A diferença de disponibilidade é calculada do período comparado para o analisado.</p>
          </div>
          <div className="table-wrap comparison-lines-table-wrap">
            <table className="comparison-lines-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  {baseMediaAtiva ? (
                    <>
                      <th>{basePrincipal.rotulo} · analisado</th>
                      <th className="is-summed">Média {rotuloReferencias}</th>
                    </>
                  ) : basesVisiveis.map((base) => (
                    <th key={base.id}>{base.rotulo} · {base.id === basePrincipalId ? "analisado" : "referência"}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nomesLinhas.map((nome) => (
                  <tr key={nome}>
                    <td><LineBadge nome={nome} /></td>
                    {baseMediaAtiva ? (() => {
                      const linhaPrincipal = mapasPorBase.get(basePrincipalId)?.get(nome);
                      const linhaMedia = linhaBaseMedia(basesReferencia, nome);
                      return (
                        <>
                          <td>
                            {linhaPrincipal ? (
                              <>
                                <strong className="comparison-line-main-value">{numero(linhaPrincipal.disponibilidadePct, "percentual")}</strong>
                                <span className="comparison-line-reference">Ocorrências: {numero(linhaPrincipal.horasFalhaParcial, "horas")}</span>
                                <span className="comparison-line-reference">Manutenção: {numero(linhaPrincipal.horasManutencaoProgramada, "horas")}</span>
                              </>
                            ) : <span className="muted">Sem dados</span>}
                          </td>
                          <td className="is-summed">
                            {linhaMedia && linhaPrincipal ? (
                              <>
                                <strong className="comparison-line-main-value">{numero(linhaMedia.disponibilidadePct, "percentual")}</strong>
                                <Tendencia
                                  atual={linhaPrincipal.disponibilidadePct}
                                  referencia={linhaMedia.disponibilidadePct}
                                  rotuloReferencia={`média ${rotuloReferencias}`}
                                  sentido="maior-melhor"
                                  formato="percentual"
                                />
                                <span className="comparison-line-reference">Ocorrências: {numero(linhaMedia.horasFalhaParcial, "horas")}</span>
                                <span className="comparison-line-reference">Manutenção: {numero(linhaMedia.horasManutencaoProgramada, "horas")}</span>
                              </>
                            ) : <span className="muted">Sem dados</span>}
                          </td>
                        </>
                      );
                    })() : basesVisiveis.map((base) => {
                      const linha = mapasPorBase.get(base.id)?.get(nome);
                      const linhaPrincipal = mapasPorBase.get(basePrincipalId)?.get(nome);
                      const ehPrincipal = base.id === basePrincipalId;
                      return (
                        <td key={`${nome}-${base.id}`}>
                          {linha ? (
                            <>
                              <strong className="comparison-line-main-value">{numero(linha.disponibilidadePct, "percentual")}</strong>
                              {!ehPrincipal && linhaPrincipal ? (
                                <Tendencia
                                  atual={linhaPrincipal.disponibilidadePct}
                                  referencia={linha.disponibilidadePct}
                                  rotuloReferencia={base.rotulo}
                                  sentido="maior-melhor"
                                  formato="percentual"
                                />
                              ) : null}
                              <span className="comparison-line-reference">Ocorrências: {numero(linha.horasFalhaParcial, "horas")}</span>
                              <span className="comparison-line-reference">Manutenção: {numero(linha.horasManutencaoProgramada, "horas")}</span>
                            </>
                          ) : <span className="muted">Sem dados</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </section>
    </Root>
  );
}
