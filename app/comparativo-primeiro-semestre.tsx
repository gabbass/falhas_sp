"use client";

import data2024 from "../data/ocorrencias-summary-2024-1sem.json";
import data2025 from "../data/ocorrencias-summary-2025-1sem.json";
import data2026 from "../data/ocorrencias-summary-2026.json";
import { useRouter } from "next/navigation";
import DocumentacaoPopup from "./documentacao-popup";

type Summary = typeof data2026;
type KpiKey = keyof Summary["kpis"];

const bases = [
  { ano: "2026", data: data2026 },
  { ano: "2025", data: data2025 },
  { ano: "2024", data: data2024 },
] as const;

const metricas: Array<{
  label: string;
  chave: KpiKey;
  formato: "percentual" | "horas" | "inteiro";
  detalhe: string;
}> = [
  { label: "Disponibilidade", chave: "disponibilidadePct", formato: "percentual", detalhe: "Percentual do tempo operacional esperado classificado como disponível." },
  { label: "Manutenção programada", chave: "horasManutencaoProgramada", formato: "horas", detalhe: "Tempo associado a manutenção ou atividade explicitamente programada." },
  { label: "Ocorrências operacionais", chave: "horasFalhaParcial", formato: "horas", detalhe: "Tempo de circulação parcial, maiores intervalos ou falhas operacionais." },
  { label: "Paralisação total", chave: "horasFalhaTotal", formato: "horas", detalhe: "Tempo em que a linha foi classificada como paralisada." },
  { label: "Eventos especiais", chave: "horasEventoEspecial", formato: "horas", detalhe: "Tempo de operação diferenciada ou evento especial." },
  { label: "Registros normalizados", chave: "qtdRegistros", formato: "inteiro", detalhe: "Quantidade de mudanças de status aproveitadas pelo algoritmo." },
];

function numero(valor: number, formato: "percentual" | "horas" | "inteiro") {
  if (formato === "percentual") return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (formato === "horas") return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
  return Math.round(valor).toLocaleString("pt-BR");
}

function linhasPorNome(data: Summary) {
  return new Map(data.rankings.linhas.map((linha) => [linha.nome, linha]));
}

function numeroLinha(nome: string) {
  return Number(nome.match(/linha\s*0*(\d+)/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function displayLinhaName(nome: string) {
  return nome.replace(/^(Linha\s+)0*(\d+)/i, (_match, prefixo: string, numero: string) =>
    `${prefixo}${numero.padStart(2, "0")}`,
  );
}

export default function ComparativoPrimeiroSemestre() {
  const router = useRouter();
  const mapas = bases.map((base) => linhasPorNome(base.data as Summary));
  const nomesLinhas = Array.from(new Set(mapas.flatMap((mapa) => Array.from(mapa.keys())))).sort(
    (a, b) => numeroLinha(a) - numeroLinha(b) || a.localeCompare(b, "pt-BR"),
  );

  const navegar = (ano: "2024" | "2025" | "2026" | "comparativo") => {
    router.push(`/?ano=${ano}`, { scroll: false });
  };

  return (
    <main className="page dashboard-page comparison-only-page">
      <section className="panel comparison-year-controls" aria-label="Base analisada">
        <div className="hero-actions">
          <div className="hero-control-stack">
            <span className="hero-control-label">Base analisada</span>
            <div className="hero-tabbar">
              <button type="button" onClick={() => navegar("2026")}>2026 · 1º semestre</button>
              <button type="button" onClick={() => navegar("2025")}>2025</button>
              <button type="button" onClick={() => navegar("2024")}>2024</button>
              <button type="button" className="is-active" aria-pressed="true" onClick={() => navegar("comparativo")}>Comparativo 1º semestre · 2026 × 2025 × 2024</button>
              <DocumentacaoPopup />
            </div>
          </div>
        </div>
      </section>

      <section className="panel comparison-panel" aria-labelledby="comparativo-semestral-title">
        <div className="comparison-heading">
          <div>
            <h2 id="comparativo-semestral-title">Primeiro semestre de 2026, 2025 e 2024</h2>
            <p>
              Comparação em uma janela equivalente, de 1º de janeiro a 30 de junho. Os percentuais
              neutralizam a diferença do ano bissexto; 2024 possui um dia operacional a mais.
            </p>
          </div>
          <span className="comparison-badge">1º semestre</span>
        </div>

        <div className="comparison-grid">
          {metricas.map((metrica) => (
            <article className="comparison-card" key={metrica.chave}>
              <span>{metrica.label}</span>
              <strong>{numero(Number(data2026.kpis[metrica.chave]), metrica.formato)}</strong>
              <small>2026 · principal</small>
              <small>2025: {numero(Number(data2025.kpis[metrica.chave]), metrica.formato)}</small>
              <small>2024: {numero(Number(data2024.kpis[metrica.chave]), metrica.formato)}</small>
              <p>{metrica.detalhe}</p>
            </article>
          ))}
        </div>

        <div className="comparison-lines-block">
          <div className="comparison-subheading">
            <h3>Disponibilidade e horas de ocorrência por linha</h3>
            <p>Cada célula mostra disponibilidade e, abaixo, horas de ocorrência operacional no semestre.</p>
          </div>
          <div className="table-wrap comparison-lines-table-wrap">
            <table className="comparison-lines-table">
              <thead><tr><th>Linha</th>{bases.map((base) => <th key={base.ano}>{base.ano}</th>)}</tr></thead>
              <tbody>
                {nomesLinhas.map((nome) => (
                  <tr key={nome}>
                    <td><strong>{displayLinhaName(nome)}</strong></td>
                    {mapas.map((mapa, indice) => {
                      const linha = mapa.get(nome);
                      return (
                        <td key={`${nome}-${bases[indice].ano}`}>
                          {linha ? (
                            <>
                              <strong className="comparison-line-main-value">{numero(linha.disponibilidadePct, "percentual")}</strong>
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
      </section>
    </main>
  );
}
