"use client";

import { UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function AnaliseHumanaPopup({ embedded = false }: { embedded?: boolean }) {
  const [aberto, setAberto] = useState(embedded);
  const [portalPronto, setPortalPronto] = useState(false);
  const embedHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    if (!aberto || embedded) return;

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
  }, [aberto, embedded]);

  return (
    <>
      {embedded ? <div className="analysis-embed-host" ref={embedHost} /> : <button
        type="button"
        className="hero-tab-action analise-humana-trigger"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        Análise humana
      </button>}

      {aberto && portalPronto
        ? createPortal(
            <div
              className={`eventos-relevantes-backdrop analise-ia-backdrop ${embedded ? "analysis-embedded-backdrop" : ""}`}
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setAberto(false);
                }
              }}
            >
              <section
                className={`eventos-relevantes-modal analise-ia-modal analise-humana-modal ${embedded ? "analysis-embedded-modal" : ""}`}
                role={embedded ? "region" : "dialog"}
                aria-modal={embedded ? undefined : "true"}
                aria-labelledby="analise-humana-title"
                aria-describedby="analise-humana-description"
              >
                <header className="eventos-relevantes-header analise-humana-header">
                  <div>
                    <span className="eventos-relevantes-kicker">
                      <UserRound size={16} aria-hidden="true" />
                      Leitura crítica dos dados
                    </span>
                    <h2 id="analise-humana-title">Análise humana</h2>
                    <p id="analise-humana-description">
                      Interpretação autoral sobre disponibilidade, manutenção, falhas, percepção do passageiro e lacunas de dados necessárias para aprofundar o diagnóstico técnico.
                    </p>
                  </div>
                  {!embedded ? <button
                    type="button"
                    className="eventos-relevantes-close"
                    onClick={() => setAberto(false)}
                    aria-label="Fechar análise humana"
                  >
                    <X size={20} aria-hidden="true" />
                  </button> : null}
                </header>

                <div className="analise-ia-panels-container">
                  <div className="analise-ia-body analise-humana-body">
                    <section className="analise-ia-card analise-ia-sintese">
                      <span className="analise-ia-section-tag">Síntese</span>
                      <h3>Alta disponibilidade agregada, com impactos que dependem da estrutura da rede</h3>
                      <p>
                        A rede de trens e metrô de São Paulo apresenta alta disponibilidade operacional agregada quando observada pela proporção de horas sem restrição relevante de serviço. Em comparação contextual com redes internacionais que publicam indicadores de desempenho, esse resultado sugere um sistema majoritariamente disponível, embora a comparação direta exija cautela, pois cada rede utiliza métricas próprias, como pontualidade, serviço entregue, distância média entre falhas, disponibilidade operacional e confiabilidade por evento.
                      </p>
                      <p>
                        Os dados sugerem três associações importantes. A primeira é entre manutenção pesada e possível redução posterior de falhas, embora essa relação deva ser lida com cuidado, já que maior manutenção também pode ser resposta a ativos mais degradados. A segunda é entre falhas e períodos ou corredores de demanda elevada, nos quais a pressão operacional tende a ampliar o efeito de qualquer intercorrência. A terceira é entre manutenção, falhas e idade ou complexidade das linhas, indicando que sistemas mais antigos, extensos ou tecnicamente complexos tendem a exigir maior esforço de conservação.
                      </p>
                    </section>

                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">Manutenção programada</span>
                      <h3>Manutenção preventiva não é falha, mas pode ser percebida como degradação do serviço</h3>
                      <p>
                        Os registros de manutenção preventiva parecem coerentes em primeira análise, pois apresentam regularidade, ocorrem majoritariamente em horários de vale e possuem marcação precisa de início e fim. Ainda assim, não está claramente explicitado nos dados o nível de aviso prévio dessas ações nem o impacto percebido pelo passageiro.
                      </p>
                      <p>
                        Isso pode produzir uma diferença importante entre a leitura técnica e a experiência cotidiana: do ponto de vista operacional e legal, uma manutenção programada não é uma falha; do ponto de vista do usuário mal informado, porém, ela pode ser percebida como degradação inesperada do serviço.
                      </p>
                    </section>

                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">Critério estatístico</span>
                      <h3>Por que a mediana não foi adotada como indicador principal</h3>
                      <p>
                        Para este tipo de análise, a mediana não foi adotada como indicador principal porque ela representa o comportamento central da distribuição, mas não expressa adequadamente o impacto agregado da rede. Em sistemas metroferroviários, eventos extremos não são meras distorções estatísticas: uma falha longa em uma linha estrutural pode afetar grande volume de passageiros e comprometer conexões em cadeia.
                      </p>
                      <p>
                        Usar a mediana poderia suavizar justamente os episódios mais relevantes do ponto de vista operacional e social. Por isso, a análise prioriza médias agregadas, horas afetadas e disponibilidade operacional, que capturam melhor o efeito total das ocorrências sobre a rede. Quando disponíveis, métricas ponderadas por demanda, trem-km, carro-km ou passageiro-km seriam ainda mais adequadas.
                      </p>
                    </section>

                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">Estrutura da rede</span>
                      <h3>Falhas precisam ser lidas dentro da dependência entre linhas</h3>
                      <p>
                        As falhas também precisam ser interpretadas dentro da estrutura da rede. Para o passageiro, “trem e metrô” aparecem como uma rede integrada. Na prática, porém, trata-se de um conjunto de eixos radiais e diametrais fortemente carregados, que concentram a demanda de grandes regiões e oferecem poucas alternativas equivalentes quando há interrupção.
                      </p>
                      <p>
                        Nesses casos, a contingência frequentemente depende do PAESE, que funciona como resposta emergencial, mas não substitui plenamente a capacidade, a velocidade e a previsibilidade do modo metroferroviário.
                      </p>
                    </section>

                    <section className="analise-ia-card analise-ia-fecho">
                      <span className="analise-ia-section-tag">Lacunas de dados</span>
                      <h3>Dados ainda ausentes limitam o diagnóstico técnico das falhas</h3>
                      <p>
                        Por fim, há dados que ainda não estão publicamente disponíveis e que seriam fundamentais para aprofundar a análise: falhas por trem-km, falhas por carro-km, falhas por composição, idade e série do material rodante, além de indicadores de passageiros afetados, viagens canceladas e atrasos acumulados.
                      </p>
                      <p>
                        Sem esses dados, é possível avaliar a disponibilidade e o impacto agregado das ocorrências, mas ainda não é possível diagnosticar com precisão a natureza técnica das falhas nem comparar plenamente a confiabilidade entre linhas, operadores e frotas.
                      </p>
                    </section>
                  </div>
                </div>

                <footer className="eventos-relevantes-footer analise-ia-footer">
                  <strong>Gabriel Bassotto Quintiliano</strong>
                  <small>
                    <a href="https://www.linkedin.com/in/gabriel-bassotto/" target="_blank" rel="noreferrer">
                      https://www.linkedin.com/in/gabriel-bassotto/
                    </a>
                  </small>
                </footer>
              </section>
            </div>,
            embedded && embedHost.current ? embedHost.current : document.body,
          )
        : null}
    </>
  );
}
