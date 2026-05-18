"use client";

import { BookOpenText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import data2025 from "../data/ocorrencias-summary.json";
import data2024 from "../data/ocorrencias-summary-2024.json";

const JANELA_INICIO_MINUTOS = 4 * 60 + 30;
const JANELA_FIM_MINUTOS = 24 * 60;
const HORAS_DIA = (JANELA_FIM_MINUTOS - JANELA_INICIO_MINUTOS) / 60;

const fmtInt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);

const fmtHoras = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n);

const metadata = data2025.metadata;
const basesDisponiveis = [data2025.metadata, data2024.metadata];

const estados = [
  {
    nome: "Disponível",
    cor: "#007A5E",
    regra:
      "Tempo operacional esperado sem falha, manutenção, paralisação ou ausência de dado. No modo geral é calculado por diferença contra o total esperado.",
    aparece:
      "Cartões, distribuição do tempo operacional, distribuição por quantidade, evolução mensal e tabela analítica por linha.",
  },
  {
    nome: "Evento especial",
    cor: "#1C2C8C",
    regra:
      "Acréscimo de operação ou atendimento especial. É contabilizado separadamente e não reduz a disponibilidade esperada.",
    aparece:
      "Cartões, distribuição do tempo operacional, distribuição por quantidade, evolução mensal, tabela analítica por linha e bloco recolhível de eventos especiais.",
  },
  {
    nome: "Manutenção programada",
    cor: "#FFD200",
    regra:
      "Evento planejado que reduz a disponibilidade esperada, mas é mantido separado das falhas operacionais. Descrições com obras de melhoria ou obras de modernização entram nesta categoria, inclusive quando o status bruto da fonte vier como paralisação.",
    aparece: "Rankings, gráficos analíticos, distribuições, evolução mensal, ocorrências e tabela analítica.",
  },
  {
    nome: "Ocorrência operacional / Com falha ou parcial",
    cor: "#F57C00",
    regra:
      "Ocorrência operacional. Inclui situações em que a linha funcionou com restrição, lentidão, operação parcial ou falha não total.",
    aparece: "Rankings, mapas/horários analíticos, distribuições, evolução mensal, ocorrências e tabela analítica.",
  },
  {
    nome: "Falha total / paralisação",
    cor: "#EE2E3B",
    regra:
      "Interrupção total ou paralisação da linha/trecho conforme classificação do registro.",
    aparece: "Rankings, mapas/horários analíticos, distribuições, evolução mensal, ocorrências e tabela analítica.",
  },
  {
    nome: "Indefinido",
    cor: "#9E9E9E",
    regra:
      "Evento com duração indefinida por gap de coleta. É mantido para auditoria, aparece em contagens e filtros, mas não soma horas nas classes operacionais.",
    aparece: "Distribuições, evolução mensal e tabela analítica; não entra nos rankings de tipo de falha.",
  },
  {
    nome: "Operação encerrada",
    cor: "#64748B",
    regra:
      "Registro fora da operação, usado para rastreabilidade e auditoria. Não soma horas de indisponibilidade.",
    aparece: "Bloco recolhível de operações encerradas, mantido minimizado por padrão.",
  },
];

const formulas = [
  {
    titulo: "Horas operacionais por dia",
    formula: "horas_dia = (00:00 - 04:30) / 60 = (1440 - 270) / 60 = 19,50 h",
    uso: "Define o denominador diário de cada linha. O painel não considera operação 24h.",
  },
  {
    titulo: "Dias do período",
    formula: "dias = floor((data_fim_UTC - data_inicio_UTC) / 86.400.000) + 1",
    uso: "Conta os dias de forma inclusiva entre o início e o fim da base.",
  },
  {
    titulo: "Horas esperadas por linha no período",
    formula: "horas_esperadas_linha = dias_do_período × 19,50",
    uso: "Para 2025 completo: 365 × 19,50 = 7.117,50 h por linha.",
  },
  {
    titulo: "Horas esperadas totais",
    formula: "horas_esperadas_total = quantidade_de_linhas_filtradas × horas_esperadas_linha",
    uso: "É o denominador dos cartões e percentuais gerais após aplicar filtros de linha/operador.",
  },
  {
    titulo: "Recorte de uma ocorrência na janela operacional",
    formula: "horas_contadas_dia = max(0, min(fim_evento, fim_janela) - max(início_evento, início_janela)) / 3.600.000",
    uso: "Cada evento é cortado dia a dia dentro de 04:30–00:00. O que cai fora da janela padrão não entra como falha operacional.",
  },
  {
    titulo: "Fim do evento",
    formula: "fim_evento = fechamentoAte válido; senão, início_evento + horas_original_do_evento",
    uso: "Quando a base tem horário de retorno/fechamento, ele prevalece. Sem isso, usa-se a duração já inferida no resumo. Em eventos em cascata com causa rastreável, o retorno da linha causadora também pode encerrar o evento derivado.",
  },
  {
    titulo: "Efeito cascata entre linhas",
    formula: "cascata = ocorrência em uma linha causada por restrições operacionais de outra linha",
    uso: "Esses registros são marcados e filtráveis. Quando a linha causadora possui retorno operacional compatível no mesmo dia, a duração da cascata é limitada a esse retorno para evitar prolongamento artificial até 00h00.",
  },
  {
    titulo: "Horas disponíveis no modo geral",
    formula: "disponível = max(horas_esperadas_total - manutenção - falha_parcial - falha_total - horas_indefinidas, 0)",
    uso: "Evento especial não é subtraído, pois é acréscimo de atendimento. Na base v3, horas_indefinidas é zero: a classe Indefinido é contada, mas não acrescenta duração.",
  },
  {
    titulo: "Tempo em manutenção programada",
    formula: "manutenção_h = soma das horas de manutenção programada recortadas na janela operacional",
    uso: "Mostra perda de janela operacional por intervenções planejadas, sem confundir com ocorrência operacional.",
  },
  {
    titulo: "Tempo em ocorrência operacional",
    formula: "ocorrência_h = soma das horas de ocorrência operacional recortadas na janela operacional",
    uso: "Mostra degradação de serviço por eventos operacionais não classificados como manutenção programada ou paralisação total.",
  },
  {
    titulo: "Disponibilidade total percentual geral",
    formula: "disponibilidade_% = horas_disponíveis / horas_esperadas_total × 100",
    uso: "Indicador dos cartões principais. Mantém evento especial fora do numerador para não inflar a disponibilidade-base.",
  },
  {
    titulo: "Disponibilidade parcial — conceito de leitura",
    formula: "disponibilidade_parcial = disponibilidade_total + ocorrência_operacional + manutenção_programada",
    uso: "A disponibilidade parcial não substitui a disponibilidade total. Ela serve para leituras em que serviço com restrição e manutenção entram como condição parcialmente ofertada, preservando a separação conceitual entre operação plena e operação não totalmente interrompida.",
  },
  {
    titulo: "Disponibilidade total percentual por linha/tabela",
    formula: "disponibilidade_linha_% = horas_disponíveis / horas_totais_da_linha × 100",
    uso: "Na tabela analítica por linha, evento especial segue em coluna própria e não entra no numerador da disponibilidade.",
  },
  {
    titulo: "Médias por categoria",
    formula: "média_categoria = horas_categoria / max(quantidade_categoria, 1)",
    uso: "Evita divisão por zero e mostra duração média por registro de cada tipo.",
  },
  {
    titulo: "Média entre novas falhas",
    formula: "média_entre_falhas = média dos intervalos em horas operacionais, dentro da janela 04h30–00h00, entre falhas consecutivas da mesma linha",
    uso: "Ordena os eventos por data/hora dentro de cada linha e calcula somente o tempo operacional acumulado entre ocorrências de falha, excluindo a madrugada fora da janela.",
  },
];

type DocumentacaoPopupProps = {
  compactLabel?: boolean;
};

export default function DocumentacaoPopup({ compactLabel = false }: DocumentacaoPopupProps) {
  const [aberto, setAberto] = useState(false);
  const [portalPronto, setPortalPronto] = useState(false);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

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

  return (
    <>
      <button
        type="button"
        className="hero-tab-action documentacao-trigger"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        {compactLabel ? "Documentação" : "Documentação"}
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
                className="documentacao-modal eventos-relevantes-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="documentacao-modal-title"
                aria-describedby="documentacao-modal-description"
              >
                <header className="eventos-relevantes-header documentacao-modal-header">
                  <div>
                    <span className="eventos-relevantes-kicker">
                      <BookOpenText size={16} aria-hidden="true" />
                      Metodologia e rastreabilidade
                    </span>
                    <h2 id="documentacao-modal-title">Documentação</h2>
                    <p id="documentacao-modal-description">
                      Regras, fórmulas, premissas e critérios de leitura usados no painel de disponibilidade e ocorrências.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="eventos-relevantes-close"
                    onClick={() => setAberto(false)}
                    aria-label="Fechar documentação"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </header>

                <div className="documentacao-modal-body doc-popup-content">
                  <section className="hero doc-hero">
                          <div className="hero-card">
                            <span className="badge">Documentação metodológica</span>
                            <h1>Regras, fórmulas e tratamento dos dados</h1>
                            <p>
                              Esta seção documenta como o painel calcula disponibilidade, ocorrências,
                              paralisações, eventos especiais, registros indefinidos por gap de coleta, efeitos cascata e agregações por linha,
                              operador e mês. O objetivo é deixar o painel auditável: cada número precisa
                              ter trilho, dormente e lastro.
                            </p>
                          </div>
                          <div className="hero-side hero-card">
                            <strong>Resumo da base</strong>
                            <div className="doc-facts">
                              {basesDisponiveis.map((base) => (
                                <span key={base.fonte}>
                                  <b>{base.periodoLabel}</b>: {fmtInt(base.registrosNormalizados)} registros normalizados · {fmtInt(base.linhas)} linhas · fonte {base.fonte}
                                </span>
                              ))}
                            </div>
                          </div>
                        </section>

                        <section className="documentacao-section doc-section">
                          <h2>1. Premissas principais</h2>
                          <div className="doc-grid-2">
                            <div className="note explain-card">
                              <strong>Janela operacional padrão</strong><br />
                              O painel usa a janela <b>04:30 até 00:00</b>. Portanto, cada linha tem
                              <b> {fmtHoras(HORAS_DIA)} horas esperadas por dia</b>. Esse é o denominador
                              correto para metrô e trem metropolitano neste estudo; não se usa 24h.
                            </div>
                            <div className="note explain-card">
                              <strong>Evento especial</strong><br />
                              Evento especial é tratado como <b>acréscimo de operação/serviço</b>. Ele
                              aparece em cartões, distribuições, evolução mensal, tabela analítica e em
                              bloco próprio, mas <b>não reduz</b> a disponibilidade esperada.
                            </div>
                            <div className="note explain-card">
                              <strong>Operação encerrada</strong><br />
                              Operação encerrada é mantida para consulta e auditoria, porém não entra
                              como falha, manutenção ou tempo disponível.
                            </div>
                            <div className="note explain-card">
                              <strong>Indefinido</strong><br />
                              Esta categoria representa evento com duração indefinida por gap de coleta. Ela
                              permanece auditável no painel, mas não soma horas nem entra como tipo de falha.
                            </div>
                          </div>
                        </section>

                        <section className="documentacao-section doc-section">
                          <h2>2. Separação dos dados por categoria operacional</h2>
                          <p>
                            Cada registro recebe um estado operacional padronizado. Esses estados controlam
                            onde o registro aparece, se soma horas, se entra em ranking e se afeta a disponibilidade.
                          </p>
                          <div className="table-wrap doc-table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Categoria</th>
                                  <th>Cor</th>
                                  <th>Regra de leitura</th>
                                  <th>Onde aparece</th>
                                </tr>
                              </thead>
                              <tbody>
                                {estados.map((estado) => (
                                  <tr key={estado.nome}>
                                    <td><span className="state-chip"><span className="doc-color" style={{ background: estado.cor }} />{estado.nome}</span></td>
                                    <td className="nowrap"><code>{estado.cor}</code></td>
                                    <td>{estado.regra}</td>
                                    <td>{estado.aparece}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>

                        <section className="documentacao-section doc-section">
                          <h2>3. Fórmulas utilizadas</h2>
                          <p>
                            As fórmulas abaixo são as regras centrais usadas pelo painel após a normalização dos registros.
                          </p>
                          <div className="doc-formula-list">
                            {formulas.map((item) => (
                              <article className="doc-formula-card" key={item.titulo}>
                                <h3>{item.titulo}</h3>
                                <code>{item.formula}</code>
                                <p>{item.uso}</p>
                              </article>
                            ))}
                          </div>
                        </section>

                        <section className="documentacao-section doc-section">
                          <h2>4. Tratamento das durações</h2>
                          <ol className="doc-steps">
                            <li>
                              O registro é lido com <b>linha</b>, <b>operador</b>, <b>status</b>,
                              <b> classificação</b>, <b>descrição</b>, <b>data/hora</b>, duração estimada e,
                              quando existir, <b>fechamentoAte</b>.
                            </li>
                            <li>
                              Se houver horário explícito de encerramento/retorno, esse horário prevalece.
                              Caso contrário, a duração já inferida na base resumida é aplicada ao horário inicial.
                            </li>
                            <li>
                              Para falhas, manutenções e disponibilidade, a duração é
                              recortada dentro de cada dia pela janela <b>04:30–00:00</b>. Eventos Indefinidos não carregam duração contabilizada.
                            </li>
                            <li>
                              As distâncias médias entre falhas, entre manutenções e entre manutenção e falha são calculadas em <b>tempo operacional acumulado</b>, respeitando a mesma janela <b>04:30–00:00</b>; o intervalo da madrugada fora de operação é excluído.
                            </li>
                            <li>
                              Registros cuja descrição cite <b>obras de melhoria</b> ou <b>obras de modernização</b> são tratados como
                              <b> Manutenção programada</b>, inclusive quando o status bruto da fonte vier
                              como paralisação, para não misturar intervenção planejada com falha operacional.
                            </li>
                            <li>
                              Se uma ocorrência atravessar meses, as horas são distribuídas por mês conforme
                              a sobreposição efetiva em cada mês.
                            </li>
                            <li>
                              Eventos especiais usam suas horas próprias como acréscimo de atendimento e não
                              passam pela subtração de disponibilidade-base.
                            </li>
                            <li>
                              Operação encerrada preserva o registro, mas soma <b>0 hora</b> nos cálculos de duração operacional.
                            </li>
                          </ol>
                          <div className="note disclaimer-note compact-disclaimer">
                            <strong>Duração original x duração contabilizada</strong><br />
                            Um evento pode ter duração original maior que a duração contabilizada. A duração
                            contabilizada é apenas a parte que cruza a janela operacional padrão. Isso evita
                            cobrar da linha um período em que ela não deveria estar operando.
                          </div>
                        </section>

                        <section className="documentacao-section doc-section">
                          <h2>5. Agregações e filtros</h2>
                          <div className="doc-grid-2">
                            <div>
                              <h3>Agregação por linha</h3>
                              <p>
                                Cada linha começa com o total esperado do período. Depois, os eventos filtrados
                                somam horas e quantidades nas colunas de disponível, evento especial, manutenção,
                                falha parcial, falha total e indefinidos.
                              </p>
                            </div>
                            <div>
                              <h3>Agregação por operador</h3>
                              <p>
                                O operador soma as linhas sob sua responsabilidade. O denominador é
                                <b> número de linhas do operador × horas esperadas por linha</b>.
                              </p>
                            </div>
                            <div>
                              <h3>Agregação mensal</h3>
                              <p>
                                O denominador mensal usa os dias existentes naquele mês dentro do período da
                                base. As horas de eventos são distribuídas pelo mês de ocorrência efetiva.
                              </p>
                            </div>
                            <div>
                              <h3>Filtros globais</h3>
                              <p>
                                Filtros de linha, operador e status alteram cartões, gráficos, rankings,
                                evolução mensal, mapa horário das ocorrências, histograma temporal de disponibilidade, nuvem de palavras e tabelas. Os filtros locais apenas refinam
                                a visualização do componente em que aparecem.
                              </p>
                            </div>
                          </div>
                        </section>

                        <section className="documentacao-section doc-section">
                          <h2>6. Regras de exibição</h2>
                          <ul className="doc-list">
                            <li><b>Disponível</b> e <b>Evento especial</b> ficam fora dos rankings de registros classificados; aparecem nos cartões, distribuições, evolução mensal e tabela analítica por linha.</li>
                            <li><b>Evento especial</b> também possui bloco recolhível próprio no final da página, igual ao bloco de operações encerradas.</li>
                            <li><b>Operações encerradas</b> e <b>Eventos especiais</b> permanecem minimizados por padrão.</li>
                            <li>Tabelas extensas usam paginação de <b>20 registros por página</b>, inclusive as seções minimizadas.</li>
                            <li>Rankings de tipos de falha excluem Disponível, Evento especial e Indefinido.</li>
                            <li>A lista pesquisável de falhas e paralisações considera apenas manutenção programada, ocorrência operacional, falha parcial e falha total/paralisação.</li>
                            <li>O <b>Comparativo 2025 × 2024</b> é tratado como uma base analisada própria. Quando selecionado, a página exibe apenas os cartões e a tabela comparativa, sem misturar KPIs ou gráficos anuais.</li>
                            <li>O <b>histograma temporal de disponibilidade</b> usa dias no eixo horizontal, faixas horárias no eixo vertical e cor por estado dominante. A malha completa nasce como <b>Disponível</b>; os eventos restritivos sobrepõem apenas as células atingidas. Quando dois estados se cruzam na mesma célula, prevalece o estado mais crítico para leitura operacional. Os <b>Filtros globais</b> são aplicados primeiro; depois, o seletor local refina apenas a linha exibida no histograma.</li>
                            <li>A <b>nuvem de palavras</b> ignora palavras muito comuns, operação normal, operação encerrada e dados indisponíveis, para destacar termos com significado operacional. O tamanho representa frequência; a classificação operacional segue a legenda geral.</li>
                            <li>Quando o painel mencionar apenas <b>Disponibilidade</b>, o rótulo correto é <b>Disponibilidade total</b>. <b>Disponibilidade parcial</b> é um conceito distinto: disponibilidade total + ocorrência operacional + manutenção programada.</li>
                          </ul>
                        </section>

                        <section className="documentacao-section doc-section">
                          <h2>7. Rastreabilidade da base atual</h2>
                          <div className="doc-grid-3">
                            <div className="kpi"><small>Janela operacional</small><strong>04:30–00:00</strong><span>{fmtHoras(HORAS_DIA)} h por linha/dia</span></div>
                            <div className="kpi"><small>Horas/ano por linha</small><strong>{fmtHoras(metadata.horasOperacaoAnoPorLinha)} h</strong><span>{metadata.periodoLabel}</span></div>
                            <div className="kpi"><small>Base normalizada</small><strong>{fmtInt(metadata.registrosNormalizados)}</strong><span>{fmtInt(metadata.duplicidadesRemovidasLinhaHorario)} duplicidades removidas</span></div>
                          </div>
                          <p className="doc-muted">
                            Observação do denominador: {metadata.observacaoDenominador}
                          </p>
                        </section>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

// Regra documental: Obras de melhoria, obras de modernização, manutenção programada e atividade programada são tratadas como manutenção programada. Falha em veículo de manutenção permanece como ocorrência operacional, pois é evento não planejado.
