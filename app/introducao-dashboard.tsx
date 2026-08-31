"use client";

import DocumentacaoPopup from "./documentacao-popup";

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const categorias = [
  {
    nome: "Disponível",
    cor: "#007A5E",
    regra: "Tempo operacional esperado sem falha, manutenção, paralisação ou ausência de dado. No modo geral é calculado por diferença contra o total esperado.",
    aparece: "Cartões, distribuição do tempo operacional, distribuição por quantidade, evolução mensal e tabela analítica por linha.",
  },
  {
    nome: "Evento especial",
    cor: "#1C2C8C",
    regra: "Acréscimo de operação ou atendimento especial. É contabilizado separadamente e não reduz a disponibilidade esperada.",
    aparece: "Cartões, distribuição do tempo operacional, distribuição por quantidade, evolução mensal, tabela analítica por linha e bloco recolhível de eventos especiais.",
  },
  {
    nome: "Manutenção programada",
    cor: "#FFD200",
    regra: "Evento planejado que reduz a disponibilidade esperada, mas é mantido separado das falhas operacionais. Descrições com obras de melhoria ou obras de modernização entram nesta categoria, inclusive quando o status bruto da fonte vier como paralisação.",
    aparece: "Rankings, gráficos analíticos, distribuições, evolução mensal, ocorrências e tabela analítica.",
  },
  {
    nome: "Ocorrência operacional / Com falha ou parcial",
    cor: "#F57C00",
    regra: "Ocorrência operacional. Inclui situações em que a linha funcionou com restrição, lentidão, operação parcial ou falha não total.",
    aparece: "Rankings, mapas/horários analíticos, distribuições, evolução mensal, ocorrências e tabela analítica.",
  },
  {
    nome: "Falha total / paralisação",
    cor: "#EE2E3B",
    regra: "Interrupção total ou paralisação da linha/trecho conforme classificação do registro.",
    aparece: "Rankings, mapas/horários analíticos, distribuições, evolução mensal, ocorrências e tabela analítica.",
  },
  {
    nome: "Indefinido",
    cor: "#9E9E9E",
    regra: "Evento com duração indefinida por gap de coleta. É mantido para auditoria, aparece em contagens e filtros, mas não soma horas nas classes operacionais.",
    aparece: "Distribuições, evolução mensal e tabela analítica; não entra nos rankings de tipo de falha.",
  },
  {
    nome: "Operação encerrada",
    cor: "#64748B",
    regra: "Registro fora da operação, usado para rastreabilidade e auditoria. Não soma horas de indisponibilidade.",
    aparece: "Bloco recolhível de operações encerradas, mantido minimizado por padrão.",
  },
];

export default function IntroducaoDashboard() {
  return (
    <article className="hero-card dashboard-introduction-card">
      <div className="dashboard-introduction-media">
        <img
          src={`${assetBase}/images/pexels-tiago-bellato-1677269835-34468477.jpg`}
          alt="Trem em circulação na paisagem urbana de São Paulo"
        />
      </div>

      <div className="dashboard-introduction-copy">
        <header className="dashboard-introduction-heading">
          <span>Antes de explorar os dados</span>
          <h2>Como interpretar o painel</h2>
          <p>Conheça as premissas e as categorias que orientam todos os indicadores apresentados nas próximas páginas.</p>
        </header>
      <section className="documentacao-section doc-section dashboard-introduction-section">
        <h2>1. Premissas principais</h2>
        <div className="doc-grid-2">
          <div className="note explain-card">
            <strong>Janela operacional padrão</strong><br />
            O painel usa a janela <b>04:30 até 00:00</b>. Portanto, cada linha tem
            <b> 19,5 horas esperadas por dia</b>. Esse é o denominador
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

      <section className="documentacao-section doc-section dashboard-introduction-section">
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
                <th>Regra de leitura</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((categoria) => (
                <tr key={categoria.nome}>
                  <td><span className="state-chip"><span className="doc-color" style={{ background: categoria.cor }} />{categoria.nome}</span></td>
                  <td>{categoria.regra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="dashboard-introduction-more">
        <div>
          <strong>Quer entender o restante da metodologia?</strong>
          <p>Leia as fórmulas, os tratamentos das durações, as agregações e a rastreabilidade da base.</p>
        </div>
        <DocumentacaoPopup compactLabel />
      </div>
      </div>
    </article>
  );
}
