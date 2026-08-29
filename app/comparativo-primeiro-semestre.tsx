"use client";

import data2024 from "../data/ocorrencias-summary-2024-1sem.json";
import data2025 from "../data/ocorrencias-summary-2025-1sem.json";
import data2026 from "../data/ocorrencias-summary-2026.json";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DocumentacaoPopup from "./documentacao-popup";

type Summary = typeof data2026;
type KpiKey = keyof Summary["kpis"];

const bases = [
  { ano: "2026", data: data2026 },
  { ano: "2025", data: data2025 },
  { ano: "2024", data: data2024 },
] as const;

type AnoComparavel = (typeof bases)[number]["ano"];
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

function rotuloDelta(atual: number, referencia: number) {
  if (referencia === 0) return atual === 0 ? "0,00%" : "sem base %";
  const variacao = ((atual - referencia) / Math.abs(referencia)) * 100;
  const sinal = variacao > 0 ? "+" : variacao < 0 ? "−" : "";
  return `${sinal}${Math.abs(variacao).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
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
}: {
  atual: number;
  referencia: number;
  rotuloReferencia: string;
  sentido: SentidoMetrica;
}) {
  const delta = atual - referencia;
  const simbolo = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  return (
    <span
      className={`comparison-trend ${classeTendencia(atual, referencia, sentido)}`}
      title={`Variação percentual em relação a ${rotuloReferencia}`}
    >
      <span className="comparison-trend-icon" aria-hidden="true">{simbolo}</span>
      <span>{rotuloDelta(atual, referencia)}</span>
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
  const router = useRouter();
  const [anoPrincipal, setAnoPrincipal] = useState<AnoComparavel>("2026");
  const [anosReferencia, setAnosReferencia] = useState<AnoComparavel[]>(["2025", "2024"]);
  const [usarMediaReferencias, setUsarMediaReferencias] = useState(false);
  const [abaComparativo, setAbaComparativo] = useState<"sintese" | "linhas">("sintese");

  const basePrincipal = bases.find((base) => base.ano === anoPrincipal)!;
  const basesReferencia = bases.filter((base) => anosReferencia.includes(base.ano));
  const rotuloReferencias = anosReferencia.join(" + ");
  const baseMediaAtiva = usarMediaReferencias && basesReferencia.length === 2;
  const basesEmUso = [basePrincipal, ...basesReferencia];
  const basesVisiveis = bases.filter((base) => base.ano === anoPrincipal || anosReferencia.includes(base.ano));
  const mapasPorAno = new Map(basesEmUso.map((base) => [base.ano, linhasPorNome(base.data as Summary)]));
  const nomesLinhas = Array.from(
    new Set(basesEmUso.flatMap((base) => base.data.rankings.linhas.map((linha) => linha.nome))),
  ).sort((a, b) => numeroLinha(a) - numeroLinha(b) || a.localeCompare(b, "pt-BR"));

  const escolherPrincipal = (ano: AnoComparavel) => {
    if (ano === anoPrincipal) return;
    setAnoPrincipal(ano);
    setAnosReferencia(bases.filter((base) => base.ano !== ano).map((base) => base.ano));
    setUsarMediaReferencias(false);
  };

  const alternarReferencia = (ano: AnoComparavel) => {
    if (ano === anoPrincipal) return;
    if (anosReferencia.includes(ano)) {
      if (anosReferencia.length === 1) return;
      const proximos = anosReferencia.filter((item) => item !== ano);
      setAnosReferencia(proximos);
      if (proximos.length !== 2) setUsarMediaReferencias(false);
      return;
    }
    setAnosReferencia(
      bases.map((base) => base.ano).filter((item) => item !== anoPrincipal && (item === ano || anosReferencia.includes(item))),
    );
  };

  const selecionarTodasReferencias = () => {
    setAnosReferencia(bases.filter((base) => base.ano !== anoPrincipal).map((base) => base.ano));
  };

  const navegar = (ano: "2024" | "2025" | "2026" | "comparativo") => {
    router.push(`/?ano=${ano}`, { scroll: false });
  };

  const Root = embedded ? "div" : "main";

  return (
    <Root
      id={embedded ? "comparativo" : undefined}
      className={embedded ? "comparison-embedded" : "page dashboard-page comparison-only-page"}
    >
      {!embedded ? <section className="panel comparison-year-controls" aria-label="Base analisada">
        <div className="hero-actions">
          <div className="hero-control-stack">
            <span className="hero-control-label">Base analisada</span>
            <div className="hero-tabbar">
              <button type="button" onClick={() => navegar("2026")}>2026 · 1º semestre</button>
              <button type="button" onClick={() => navegar("2025")}>2025</button>
              <button type="button" onClick={() => navegar("2024")}>2024</button>
              <button type="button" className="is-active" aria-pressed="true">Comparativo</button>
              <DocumentacaoPopup />
            </div>
          </div>
        </div>
      </section> : null}

      <section className="panel comparison-panel" aria-labelledby="comparativo-semestral-title">
        <div className="comparison-heading">
          <div>
            <h2 id="comparativo-semestral-title">Comparativo</h2>
            <p>
              Compare o período analisado com um ou dois períodos de referência.
              A variação mostra quanto o valor aumentou ou diminuiu em porcentagem.
            </p>
          </div>
          <span className="comparison-badge">1º semestre</span>
        </div>

        <div className="dashboard-subtabs comparison-view-tabs" role="tablist" aria-label="Conteúdo do comparativo">
          <button type="button" role="tab" aria-selected={abaComparativo === "sintese"} className={abaComparativo === "sintese" ? "is-active" : ""} onClick={() => setAbaComparativo("sintese")}>Síntese</button>
          <button type="button" role="tab" aria-selected={abaComparativo === "linhas"} className={abaComparativo === "linhas" ? "is-active" : ""} onClick={() => setAbaComparativo("linhas")}>Comparação por linha</button>
        </div>

        {abaComparativo === "sintese" ? (
        <div className="comparison-summary-view">
        <div className="comparison-period-controls">
        <fieldset className="comparison-year-selector">
          <legend>Período analisado</legend>
          <div>
            {bases.map((base) => (
              <label key={`principal-${base.ano}`} className={anoPrincipal === base.ano ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="ano-principal"
                  checked={anoPrincipal === base.ano}
                  onChange={() => escolherPrincipal(base.ano)}
                />
                <span>1º sem. {base.ano}</span>
              </label>
            ))}
          </div>
          <small>Este é o período cujo resultado será avaliado.</small>
        </fieldset>

        <fieldset className="comparison-reference-selector">
          <legend>Comparar com</legend>
          <div>
            {bases.map((base) => {
              const ehPrincipal = base.ano === anoPrincipal;
              const marcado = anosReferencia.includes(base.ano);
              const ultimaReferencia = marcado && anosReferencia.length === 1;
              return (
                <label
                  key={`referencia-${base.ano}`}
                  className={`${marcado ? "is-selected" : ""} ${ehPrincipal ? "is-disabled" : ""}`.trim()}
                  title={ehPrincipal ? "O período analisado não pode ser referência para si próprio." : undefined}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={ehPrincipal || ultimaReferencia}
                    onChange={() => alternarReferencia(base.ano)}
                  />
                  <span>1º sem. {base.ano}{ehPrincipal ? " · analisado" : ""}</span>
                </label>
              );
            })}
            <button type="button" className="comparison-select-all" onClick={selecionarTodasReferencias}>
              Todos os outros períodos
            </button>
          </div>
          <small>Pelo menos uma referência deve permanecer marcada; o período analisado fica sempre indisponível aqui.</small>
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
            const explicacao = `${metrica.detalhe} O selo identifica o período analisado, que funciona como base do cálculo. Em cada outra coluna, a seta e o percentual indicam quanto aquele período aumentou ou diminuiu em relação ao analisado: (período da coluna − período analisado) ÷ período analisado × 100.`;
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
                        <small>1º sem. {anoPrincipal}</small>
                        <strong>{numero(valorPrincipal, metrica.formato)}</strong>
                        <em>Analisado</em>
                      </span>
                      <span className="comparison-card-column comparison-secondary-value is-summed">
                        <small>Média {rotuloReferencias}</small>
                        <b>{numero(valorBaseMedia(basesReferencia, metrica.chave), metrica.formato)}</b>
                        <Tendencia
                          atual={valorBaseMedia(basesReferencia, metrica.chave)}
                          referencia={valorPrincipal}
                          rotuloReferencia={anoPrincipal}
                          sentido={metrica.sentido}
                        />
                      </span>
                    </>
                  ) : basesVisiveis.map((base) => {
                    const ehPrincipal = base.ano === anoPrincipal;
                    const valor = Number(base.data.kpis[metrica.chave]);
                    return (
                      <span
                        className={`comparison-card-column ${ehPrincipal ? "comparison-primary-value" : "comparison-secondary-value"}`}
                        key={`${metrica.chave}-${base.ano}`}
                      >
                        <small>1º sem. {base.ano}</small>
                        {ehPrincipal
                          ? <strong>{numero(valor, metrica.formato)}</strong>
                          : <b>{numero(valor, metrica.formato)}</b>}
                        {ehPrincipal ? <em>Analisado</em> : null}
                        {!ehPrincipal ? (
                          <Tendencia
                            atual={valor}
                            referencia={valorPrincipal}
                            rotuloReferencia={anoPrincipal}
                            sentido={metrica.sentido}
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
        </div>
        ) : null}

        {abaComparativo === "linhas" ? (
        <div className="comparison-lines-block">
          <div className="comparison-subheading">
            <h3>Disponibilidade e horas de ocorrência por linha</h3>
            <p>O período analisado mostra a variação percentual em relação a cada referência escolhida.</p>
          </div>
          <div className="table-wrap comparison-lines-table-wrap">
            <table className="comparison-lines-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  {baseMediaAtiva ? (
                    <>
                      <th>{anoPrincipal} · analisado</th>
                      <th className="is-summed">Média {rotuloReferencias}</th>
                    </>
                  ) : basesVisiveis.map((base) => (
                    <th key={base.ano}>{base.ano} · {base.ano === anoPrincipal ? "analisado" : "referência"}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nomesLinhas.map((nome) => (
                  <tr key={nome}>
                    <td><strong>{displayLinhaName(nome)}</strong></td>
                    {baseMediaAtiva ? (() => {
                      const linhaPrincipal = mapasPorAno.get(anoPrincipal)?.get(nome);
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
                                  atual={linhaMedia.disponibilidadePct}
                                  referencia={linhaPrincipal.disponibilidadePct}
                                  rotuloReferencia={anoPrincipal}
                                  sentido="maior-melhor"
                                />
                                <span className="comparison-line-reference">Ocorrências: {numero(linhaMedia.horasFalhaParcial, "horas")}</span>
                                <span className="comparison-line-reference">Manutenção: {numero(linhaMedia.horasManutencaoProgramada, "horas")}</span>
                              </>
                            ) : <span className="muted">Sem dados</span>}
                          </td>
                        </>
                      );
                    })() : basesVisiveis.map((base) => {
                      const linha = mapasPorAno.get(base.ano)?.get(nome);
                      const linhaPrincipal = mapasPorAno.get(anoPrincipal)?.get(nome);
                      const ehPrincipal = base.ano === anoPrincipal;
                      return (
                        <td key={`${nome}-${base.ano}`}>
                          {linha ? (
                            <>
                              <strong className="comparison-line-main-value">{numero(linha.disponibilidadePct, "percentual")}</strong>
                              {!ehPrincipal && linhaPrincipal ? (
                                <Tendencia
                                  atual={linha.disponibilidadePct}
                                  referencia={linhaPrincipal.disponibilidadePct}
                                  rotuloReferencia={anoPrincipal}
                                  sentido="maior-melhor"
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
        ) : null}
      </section>
    </Root>
  );
}
