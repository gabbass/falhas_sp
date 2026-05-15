"use client";

import data2025Raw from "../data/ocorrencias-summary.json";
import data2024Raw from "../data/ocorrencias-summary-2024.json";
import { Bot, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type LinhaRanking = {
  nome: string;
  disponibilidadePct: number;
  horasFalha: number;
  horasManutencaoProgramada: number;
};

type SummaryPayload = {
  metadata: {
    periodoLabel: string;
    jornadaOperacionalPadrao: string;
    regraDisponibilidade: string;
    regraIndefinidos: string;
  };
  kpis: {
    disponibilidadePct: number;
    horasFalha: number;
    horasFalhaParcial: number;
    horasFalhaTotal: number;
    horasManutencaoProgramada: number;
    qtdIndefinidos: number;
    qtdEncerramentos: number;
    qtdManutencaoProgramada: number;
  };
  rankings: {
    linhas: LinhaRanking[];
  };
  events: Array<{
    dataHora: string;
    estado: string;
    horas?: number;
    descricao?: string;
    linha?: string;
    operador?: string;
  }>;
};

type ResumoFalha = {
  qtd: number;
  totalHoras: number;
  media: number;
  mediana: number;
  p90: number;
  p95: number;
  maximo: number;
  diaMaisComum: string;
  horaMaisComum: string;
};

type CausaResumo = {
  nome: string;
  qtd: number;
  horas: number;
  participacaoPct: number;
};

type MesResumo = {
  mes: string;
  label: string;
  qtd: number;
  horas: number;
  participacaoPct: number;
};

const data2025 = data2025Raw as SummaryPayload;
const data2024 = data2024Raw as SummaryPayload;

const diasSemana = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const fmtInt = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(valor);

const fmtHoras = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(valor);

const fmtPct = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(valor);

const fmtPct1 = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor);

const fmtPp = (valor: number) =>
  `${valor >= 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(valor)} p.p.`;

const pctChange = (atual: number, anterior: number) =>
  anterior === 0 ? 0 : ((atual - anterior) / anterior) * 100;

const ehFalhaOperacional = (estado: string) =>
  estado === "Ocorrência operacional" || estado === "Falha total / paralisação";

const normalizarTexto = (valor: string | undefined) =>
  (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const CAUSAS_REGRAS = [
  {
    nome: "Dados indisponíveis",
    padroes: ["dados indisponiveis", "dados/status indisponiveis"],
  },
  {
    nome: "Clima, chuva e alagamento",
    padroes: [
      "chuva",
      "alagamento",
      "descarga atmosferica",
      "descarga eletrica atmosferica",
      "tempestade",
      "fortes ventos",
    ],
  },
  {
    nome: "Energia e rede aérea",
    padroes: [
      "energia",
      "rede aerea",
      "sistema eletrico",
      "alimentacao eletrica",
      "falha eletrica",
    ],
  },
  {
    nome: "Sinalização, controle e equipamento de via",
    padroes: [
      "sinaliz",
      "controle de trens",
      "equipamento de via",
      "equipamentos de via",
      "falha em equipamento",
      "via unica",
      "via singela",
      "aparelho de mudanca de via",
      "trilho partido",
      "falha na via",
    ],
  },
  {
    nome: "Material rodante e avaria de trem",
    padroes: [
      "avaria de trem",
      "trem de carga",
      "falha no trem",
      "falha em trem",
      "falha de trem",
      "avaria de um trem",
    ],
  },
  {
    nome: "Obras ou manutenção com impacto operacional",
    padroes: [
      "obras",
      "manutencao de ponte",
      "atividades de manutencao",
      "servicos de manutencao",
    ],
  },
  {
    nome: "Pessoas na via e segurança operacional",
    padroes: [
      "pessoas na via",
      "pessoa na via",
      "usuario na via",
      "presenca de pessoa",
      "presenca de usuario",
      "passageiros na via",
    ],
  },
  {
    nome: "Interferência externa, objetos e vandalismo",
    padroes: [
      "vandalismo",
      "interferencia na via",
      "interferencia externa",
      "objeto na via",
      "ato de vandalismo",
    ],
  },
  {
    nome: "Cascata ou restrição de outra linha",
    padroes: [
      "restricoes operacionais da linha",
      "devido a restricoes operacionais da linha",
      "restricoes operacionais na cptm",
      "ocorrencia registrada na linha",
    ],
  },
  {
    nome: "Problema técnico sem detalhamento",
    padroes: ["problemas tecnicos"],
  },
  {
    nome: "Interrupção sem causa explicitada no informe",
    padroes: [
      "circulacao de trens entre",
      "nao estao circulando",
      "interrompida temporariamente",
      "servico direto do metro indisponivel",
    ],
  },
] as const;

const causasEstruturaisChave = new Set([
  "Sinalização, controle e equipamento de via",
  "Clima, chuva e alagamento",
  "Energia e rede aérea",
]);

function obterEventosFalha(data: SummaryPayload) {
  return data.events.filter((evento) => ehFalhaOperacional(evento.estado));
}

function obterPercentil(valores: number[], percentual: number) {
  if (valores.length === 0) return 0;
  const indice = Math.max(0, Math.ceil(valores.length * percentual) - 1);
  return valores[indice] ?? 0;
}

function obterEstatisticasFalha(data: SummaryPayload): ResumoFalha {
  const eventos = obterEventosFalha(data);
  const duracoes = eventos
    .map((evento) => evento.horas ?? 0)
    .filter((valor) => Number.isFinite(valor))
    .sort((a, b) => a - b);

  const totalHoras = duracoes.reduce((acc, valor) => acc + valor, 0);
  const media = duracoes.length > 0 ? totalHoras / duracoes.length : 0;
  const meio = Math.floor(duracoes.length / 2);
  const mediana =
    duracoes.length === 0
      ? 0
      : duracoes.length % 2 === 0
        ? ((duracoes[meio - 1] ?? 0) + (duracoes[meio] ?? 0)) / 2
        : (duracoes[meio] ?? 0);

  const porDia = new Map<string, number>();
  const porHora = new Map<number, number>();

  eventos.forEach((evento) => {
    const diaReferencia = new Date(`${evento.dataHora.slice(0, 10)}T12:00:00`);
    const dia = diasSemana[diaReferencia.getDay()];
    const hora = Number(evento.dataHora.slice(11, 13));

    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    porHora.set(hora, (porHora.get(hora) ?? 0) + 1);
  });

  const diaMaisComum = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0];
  const horaMaisComum = [...porHora.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    qtd: eventos.length,
    totalHoras,
    media,
    mediana,
    p90: obterPercentil(duracoes, 0.9),
    p95: obterPercentil(duracoes, 0.95),
    maximo: duracoes[duracoes.length - 1] ?? 0,
    diaMaisComum: diaMaisComum
      ? `${diaMaisComum[0]} (${fmtInt(diaMaisComum[1])})`
      : "Sem registro",
    horaMaisComum: horaMaisComum
      ? `${String(horaMaisComum[0]).padStart(2, "0")}h (${fmtInt(horaMaisComum[1])})`
      : "Sem registro",
  };
}

function obterVariacoesPorLinha() {
  const mapa2024 = new Map(data2024.rankings.linhas.map((linha) => [linha.nome, linha]));

  return data2025.rankings.linhas
    .map((linha2025) => {
      const linha2024 = mapa2024.get(linha2025.nome);

      if (!linha2024) return null;

      return {
        nome: linha2025.nome,
        disp2024: linha2024.disponibilidadePct,
        disp2025: linha2025.disponibilidadePct,
        deltaDisponibilidade: linha2025.disponibilidadePct - linha2024.disponibilidadePct,
        falha24: linha2024.horasFalha,
        falha25: linha2025.horasFalha,
        deltaFalhaHoras: linha2025.horasFalha - linha2024.horasFalha,
        deltaManutencaoHoras:
          linha2025.horasManutencaoProgramada - linha2024.horasManutencaoProgramada,
      };
    })
    .filter((linha): linha is NonNullable<typeof linha> => linha !== null);
}

function classificarCausa(descricao: string | undefined) {
  const texto = normalizarTexto(descricao);

  for (const causa of CAUSAS_REGRAS) {
    if (causa.padroes.some((padrao) => texto.includes(padrao))) {
      return causa.nome;
    }
  }

  return "Registros sem enquadramento claro";
}

function obterCausas(data: SummaryPayload): CausaResumo[] {
  const eventos = obterEventosFalha(data);
  const totalHoras = eventos.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);
  const acumulado = new Map<string, { qtd: number; horas: number }>();

  eventos.forEach((evento) => {
    const causa = classificarCausa(evento.descricao);
    const atual = acumulado.get(causa) ?? { qtd: 0, horas: 0 };
    acumulado.set(causa, {
      qtd: atual.qtd + 1,
      horas: atual.horas + (evento.horas ?? 0),
    });
  });

  return [...acumulado.entries()]
    .map(([nome, valor]) => ({
      nome,
      qtd: valor.qtd,
      horas: valor.horas,
      participacaoPct: totalHoras === 0 ? 0 : (valor.horas / totalHoras) * 100,
    }))
    .sort((a, b) => b.horas - a.horas);
}

function formatarMes(mes: string) {
  const [ano, numeroMes] = mes.split("-");
  const data = new Date(Number(ano), Number(numeroMes) - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(data);
}

function obterMesesMaisCriticos(data: SummaryPayload, limite = 3): MesResumo[] {
  const eventos = obterEventosFalha(data);
  const totalHoras = eventos.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);
  const acumulado = new Map<string, { qtd: number; horas: number }>();

  eventos.forEach((evento) => {
    const mes = evento.dataHora.slice(0, 7);
    const atual = acumulado.get(mes) ?? { qtd: 0, horas: 0 };
    acumulado.set(mes, {
      qtd: atual.qtd + 1,
      horas: atual.horas + (evento.horas ?? 0),
    });
  });

  return [...acumulado.entries()]
    .map(([mes, valor]) => ({
      mes,
      label: formatarMes(mes),
      qtd: valor.qtd,
      horas: valor.horas,
      participacaoPct: totalHoras === 0 ? 0 : (valor.horas / totalHoras) * 100,
    }))
    .sort((a, b) => b.horas - a.horas)
    .slice(0, limite);
}

function obterParticipacaoTopDescricoes(data: SummaryPayload, limite = 10) {
  const eventos = obterEventosFalha(data);
  const totalHoras = eventos.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);
  const acumulado = new Map<string, number>();

  eventos.forEach((evento) => {
    const descricao = evento.descricao?.trim() || "Sem descrição";
    acumulado.set(descricao, (acumulado.get(descricao) ?? 0) + (evento.horas ?? 0));
  });

  const horasTop = [...acumulado.values()]
    .sort((a, b) => b - a)
    .slice(0, limite)
    .reduce((acc, valor) => acc + valor, 0);

  return totalHoras === 0 ? 0 : (horasTop / totalHoras) * 100;
}

function formatarDataISO(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function obterConcentracaoLinhaMes(
  data: SummaryPayload,
  linhaAlvo: string,
  mesAlvo: string,
) {
  const eventosRede = obterEventosFalha(data);
  const eventosLinha = eventosRede.filter((evento) => evento.linha === linhaAlvo);
  const eventosMes = eventosLinha.filter((evento) => evento.dataHora.startsWith(mesAlvo));

  const horasRede = eventosRede.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);
  const horasLinha = eventosLinha.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);
  const horasMes = eventosMes.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);
  const datasUnicas = new Set(eventosMes.map((evento) => evento.dataHora.slice(0, 10)));

  return {
    linha: linhaAlvo,
    mes: mesAlvo,
    mesLabel: formatarMes(mesAlvo),
    qtd: eventosMes.length,
    dias: datasUnicas.size,
    horas: horasMes,
    participacaoLinhaPct: horasLinha === 0 ? 0 : (horasMes / horasLinha) * 100,
    participacaoRedePct: horasRede === 0 ? 0 : (horasMes / horasRede) * 100,
  };
}

function obterResumoDataMultilinha(data: SummaryPayload, dataIso: string) {
  const eventosRede = obterEventosFalha(data);
  const eventosDia = eventosRede.filter((evento) => evento.dataHora.startsWith(dataIso));
  const horasRede = eventosRede.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);
  const horasDia = eventosDia.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);
  const linhas = [...new Set(eventosDia.map((evento) => evento.linha).filter(Boolean))] as string[];

  return {
    dataIso,
    dataLabel: formatarDataISO(dataIso),
    qtd: eventosDia.length,
    horas: horasDia,
    linhas,
    participacaoRedePct: horasRede === 0 ? 0 : (horasDia / horasRede) * 100,
  };
}

function obterResumoLinhaPorPadroes(
  data: SummaryPayload,
  linhaAlvo: string,
  padroes: string[],
) {
  const eventosLinha = obterEventosFalha(data).filter((evento) => evento.linha === linhaAlvo);
  const eventosSelecionados = eventosLinha.filter((evento) => {
    const descricao = normalizarTexto(evento.descricao);
    return padroes.every((padrao) => descricao.includes(normalizarTexto(padrao)));
  });

  const horasLinha = eventosLinha.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);
  const horasSelecionadas = eventosSelecionados.reduce((acc, evento) => acc + (evento.horas ?? 0), 0);

  return {
    linha: linhaAlvo,
    qtd: eventosSelecionados.length,
    horas: horasSelecionadas,
    participacaoLinhaPct: horasLinha === 0 ? 0 : (horasSelecionadas / horasLinha) * 100,
  };
}

const estatisticas2024 = obterEstatisticasFalha(data2024);
const estatisticas2025 = obterEstatisticasFalha(data2025);
const variacoesLinhas = obterVariacoesPorLinha();
const causas2025 = obterCausas(data2025);
const causas2025Exibidas = causas2025.filter(
  (causa) => causa.nome !== "Registros sem enquadramento claro",
);
const residuoClassificacao2025 = causas2025.find(
  (causa) => causa.nome === "Registros sem enquadramento claro",
) ?? {
  nome: "Registros sem enquadramento claro",
  qtd: 0,
  horas: 0,
  participacaoPct: 0,
};
const mesesCriticos2025 = obterMesesMaisCriticos(data2025);
const participacaoTop10Descricoes2024 = obterParticipacaoTopDescricoes(data2024);
const participacaoTop10Descricoes2025 = obterParticipacaoTopDescricoes(data2025);

const concentracaoLinha4Setembro = obterConcentracaoLinhaMes(
  data2025,
  "Linha 4-Amarela",
  "2025-09",
);
const concentracaoLinha11Abril = obterConcentracaoLinhaMes(
  data2025,
  "Linha 11-Coral",
  "2025-04",
);
const eventoMultilinha20Abril = obterResumoDataMultilinha(data2025, "2025-04-20");
const efeitoCascataLinha13PorLinha11 = obterResumoLinhaPorPadroes(
  data2025,
  "Linha 13-Jade",
  ["linha 11", "sistema de energia"],
);

const linhasComMaiorPressao = [...variacoesLinhas]
  .sort((a, b) => a.deltaDisponibilidade - b.deltaDisponibilidade)
  .slice(0, 5);

const linhasComMaiorRecuperacao = [...variacoesLinhas]
  .sort((a, b) => b.deltaDisponibilidade - a.deltaDisponibilidade)
  .slice(0, 3);

const linhasComMaiorAumentoBrutoFalha = [...variacoesLinhas]
  .sort((a, b) => b.deltaFalhaHoras - a.deltaFalhaHoras)
  .slice(0, 5);

const deltaDisponibilidade = data2025.kpis.disponibilidadePct - data2024.kpis.disponibilidadePct;
const deltaLiquidoHorasFalha = data2025.kpis.horasFalha - data2024.kpis.horasFalha;
const somaAumentoBrutoTop5 = linhasComMaiorAumentoBrutoFalha.reduce(
  (acc, linha) => acc + Math.max(0, linha.deltaFalhaHoras),
  0,
);
const variacaoHorasFalha = pctChange(data2025.kpis.horasFalha, data2024.kpis.horasFalha);
const variacaoHorasFalhaParcial = pctChange(
  data2025.kpis.horasFalhaParcial,
  data2024.kpis.horasFalhaParcial,
);
const variacaoHorasFalhaTotal = pctChange(
  data2025.kpis.horasFalhaTotal,
  data2024.kpis.horasFalhaTotal,
);
const variacaoManutencao = pctChange(
  data2025.kpis.horasManutencaoProgramada,
  data2024.kpis.horasManutencaoProgramada,
);
const variacaoQtdFalhasOperacionais = pctChange(estatisticas2025.qtd, estatisticas2024.qtd);
const variacaoDuracaoMedia = pctChange(estatisticas2025.media, estatisticas2024.media);

const horasCausasEstruturais = causas2025
  .filter((causa) => causasEstruturaisChave.has(causa.nome))
  .reduce((acc, causa) => acc + causa.horas, 0);

const participacaoCausasEstruturais =
  estatisticas2025.totalHoras === 0
    ? 0
    : (horasCausasEstruturais / estatisticas2025.totalHoras) * 100;

const participacaoMesesCriticos = mesesCriticos2025.reduce(
  (acc, mes) => acc + mes.participacaoPct,
  0,
);

const fontesContexto = [
  {
    rotulo: "Agência SP — transição e assunção integral da operação da Linha 7-Rubi pela TIC Trens",
    href: "https://www.agenciasp.sp.gov.br/tic-trens-inicia-operacao-e-manutencao-da-linha-7-rubi-nesta-quarta-feira-26/",
  },
  {
    rotulo: "CPTM — restrição e normalização da Linha 11-Coral após obra emergencial em ponte ferroviária",
    href: "https://www.cptm.sp.gov.br/cptm/noticias/cptm-normaliza-a-circulacao-da-linha-11-coral-com-dois-meses-de-antecedencia",
  },
  {
    rotulo: "Agência SP — aditivo de modernização das Linhas 8-Diamante e 9-Esmeralda com novo sistema de sinalização",
    href: "https://www.agenciasp.sp.gov.br/governo-de-sp-assina-aditivo-para-investir-r-1-bilhao-na-modernizacao-das-linhas-8-diamante-e-9-esmeralda/",
  },
  {
    rotulo: "Metrô SP — novos trens da Linha 15-Prata e etapa de testes antes da entrada em operação",
    href: "https://www.metro.sp.gov.br/2025/02/27/novos-trens-para-a-linha-15-prata/",
  },
  {
    rotulo: "Daniotti et al. — análise de cascatas de atraso em redes ferroviárias",
    href: "https://arxiv.org/abs/2310.13773",
  },
  {
    rotulo: "Costa et al. — adaptação de sistemas de transporte a alagamentos urbanos",
    href: "https://arxiv.org/abs/2409.18574",
  },
];

export default function AnaliseIaPopup() {
  const [aberto, setAberto] = useState(false);
  const [portalPronto, setPortalPronto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"tecnica" | "claude">("tecnica");

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
        className="hero-tab-action analise-ia-trigger"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        Análise IA
      </button>

      {aberto && portalPronto
        ? createPortal(
            <div
              className="eventos-relevantes-backdrop analise-ia-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setAberto(false);
                }
              }}
            >
              <section
                className="eventos-relevantes-modal analise-ia-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="analise-ia-title"
                aria-describedby="analise-ia-description"
              >
                <header className="eventos-relevantes-header analise-ia-header">
                  <div>
                    <span className="eventos-relevantes-kicker">
                      <Bot size={16} aria-hidden="true" />
                      Análise dos eventos e das ocorrências
                    </span>
                    <h2 id="analise-ia-title">Análise IA</h2>
                    <p id="analise-ia-description">
                      Leitura dos registros de 2024 e 2025 com foco em eventos, volumes, concentração temporal e qualidade da informação.
                      O objetivo é apoiar apuração operacional, fiscalização e padronização da coleta.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="eventos-relevantes-close"
                    onClick={() => setAberto(false)}
                    aria-label="Fechar análise IA"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </header>

                <nav className="analise-ia-tab-nav" role="tablist" aria-label="Abas de análise">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={abaAtiva === "tecnica"}
                    className={"analise-ia-tab-btn" + (abaAtiva === "tecnica" ? " analise-ia-tab-btn--ativa" : "")}
                    onClick={() => setAbaAtiva("tecnica")}
                  >
                    ChatGPT 5.5 Raciocínio Expandido
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={abaAtiva === "claude"}
                    className={"analise-ia-tab-btn" + (abaAtiva === "claude" ? " analise-ia-tab-btn--ativa" : "")}
                    onClick={() => setAbaAtiva("claude")}
                  >
                    Claude IA Sonnet 4.6
                  </button>
                </nav>

                <div className="analise-ia-panels-container">
                {abaAtiva === "tecnica" && (
                <div className="analise-ia-body">
                  <section className="analise-ia-grid-resumo" aria-label="Resumo executivo">
                    <article className="analise-ia-kpi-card">
                      <span>Falha inesperada / operacional</span>
                      <strong>{fmtHoras(data2025.kpis.horasFalha)} h</strong>
                      <p>
                        2024: {fmtHoras(data2024.kpis.horasFalha)} h · {fmtPct1(variacaoHorasFalha)}%
                      </p>
                    </article>

                    <article className="analise-ia-kpi-card">
                      <span>Manutenção programada</span>
                      <strong>{fmtHoras(data2025.kpis.horasManutencaoProgramada)} h</strong>
                      <p>
                        2024: {fmtHoras(data2024.kpis.horasManutencaoProgramada)} h · {fmtPct1(variacaoManutencao)}%
                      </p>
                    </article>

                    <article className="analise-ia-kpi-card">
                      <span>Disponibilidade global</span>
                      <strong>{fmtPct(data2025.kpis.disponibilidadePct)}%</strong>
                      <p>
                        2024: {fmtPct(data2024.kpis.disponibilidadePct)}% · {fmtPp(deltaDisponibilidade)}
                      </p>
                    </article>

                    <article className="analise-ia-kpi-card">
                      <span>Falha total / paralisação</span>
                      <strong>{fmtHoras(data2025.kpis.horasFalhaTotal)} h</strong>
                      <p>
                        2024: {fmtHoras(data2024.kpis.horasFalhaTotal)} h · {fmtPct1(variacaoHorasFalhaTotal)}%
                      </p>
                    </article>
                  </section>

                  <section className="analise-ia-card analise-ia-sintese">
                    <span className="analise-ia-section-tag">Síntese executiva</span>
                    <h3>2025 preservou disponibilidade elevada, mas expôs uma deterioração relevante nas falhas não programadas</h3>
                    <p>
                      A rede metroferroviária analisada manteve disponibilidade global acima de 99% em 2025, porém esse indicador isolado
                      não resume a experiência operacional do ano. As horas de <strong>falha inesperada</strong> cresceram de
                      <strong> {fmtHoras(data2024.kpis.horasFalha)} h</strong> em 2024 para
                      <strong> {fmtHoras(data2025.kpis.horasFalha)} h</strong> em 2025, avanço de
                      <strong> {fmtPct1(variacaoHorasFalha)}%</strong>. No mesmo período, a
                      <strong> manutenção programada</strong> caiu de
                      <strong> {fmtHoras(data2024.kpis.horasManutencaoProgramada)} h</strong> para
                      <strong> {fmtHoras(data2025.kpis.horasManutencaoProgramada)} h</strong>.
                    </p>
                    <p>
                      O retrato, portanto, não é o de uma rede simplesmente “mais indisponível”. É o de um sistema que registrou
                      <strong> menos interrupção planejada</strong>, mas <strong>mais perda de regularidade por ocorrências operacionais</strong>.
                      Para passageiros, operadores e autoridades, esse contraste importa: manutenção programada costuma ser previsível e comunicável;
                      falhas inesperadas quebram a rotina da viagem, concentram impactos e exigem resposta imediata.
                    </p>
                    <div className="analise-ia-callout">
                      <strong>Diagnóstico central:</strong> a piora de 2025 está nas falhas não programadas, especialmente em eventos concentrados por linha,
                      mês e família causal. A manutenção programada deve ser lida separadamente e não explica, por si, o aumento das horas de falha.
                    </div>
                  </section>

                  <section className="analise-ia-card">
                    <span className="analise-ia-section-tag">Nota de leitura</span>
                    <h3>Manutenção programada e falha inesperada são fenômenos diferentes</h3>
                    <p>
                      Nesta análise, <strong>falha inesperada</strong> reúne apenas registros de
                      <strong> ocorrência operacional</strong> e <strong>falha total / paralisação</strong>.
                      Em 2025, esse conjunto soma <strong>{fmtInt(estatisticas2025.qtd)} ocorrências</strong> e
                      <strong> {fmtHoras(estatisticas2025.totalHoras)} h</strong>.
                      <strong> Manutenção programada</strong> permanece em classe própria, com
                      <strong> {fmtInt(data2025.kpis.qtdManutencaoProgramada)} registros</strong> e
                      <strong> {fmtHoras(data2025.kpis.horasManutencaoProgramada)} h</strong>.
                    </p>
                    <p className="analise-ia-observacao">
                      Encerramentos de operação representam o fechamento normal do serviço e não são tratados como falhas.
                      Registros indefinidos permanecem visíveis como pendência de qualificação da informação.
                    </p>
                  </section>

                  <section className="analise-ia-card">
                    <span className="analise-ia-section-tag">1. O que aconteceu?</span>
                    <h3>As ocorrências ficaram mais numerosas, mais longas e mais concentradas em 2025</h3>
                    <p>
                      O número de falhas inesperadas aumentou de <strong>{fmtInt(estatisticas2024.qtd)}</strong> em 2024 para
                      <strong> {fmtInt(estatisticas2025.qtd)}</strong> em 2025. A duração média subiu de
                      <strong> {fmtHoras(estatisticas2024.media)} h</strong> para
                      <strong> {fmtHoras(estatisticas2025.media)} h</strong>.
                      O p95 também avançou de <strong>{fmtHoras(estatisticas2024.p95)} h</strong> para
                      <strong> {fmtHoras(estatisticas2025.p95)} h</strong>, sinal de que os episódios mais severos ficaram mais pesados.
                    </p>
                    <p>
                      Em termos de natureza do impacto, as horas de <strong>ocorrência operacional parcial</strong> cresceram
                      <strong> {fmtPct1(variacaoHorasFalhaParcial)}%</strong>, enquanto as horas de
                      <strong> falha total / paralisação</strong> registraram variação de <strong>{fmtPct1(variacaoHorasFalhaTotal)}%</strong>.
                      Isso sugere uma operação menos marcada por paralisações completas, mas mais pressionada por restrições,
                      lentidões e interrupções parciais capazes de degradar a regularidade cotidiana.
                    </p>

                    <div className="analise-ia-tabela-wrap">
                      <table className="analise-ia-tabela">
                        <thead>
                          <tr>
                            <th>Linha</th>
                            <th>Disponibilidade 2024</th>
                            <th>Disponibilidade 2025</th>
                            <th>Variação</th>
                            <th>Δ horas de falha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhasComMaiorPressao.map((linha) => (
                            <tr key={linha.nome}>
                              <td>{linha.nome}</td>
                              <td>{fmtPct(linha.disp2024)}%</td>
                              <td>{fmtPct(linha.disp2025)}%</td>
                              <td>{fmtPp(linha.deltaDisponibilidade)}</td>
                              <td>{fmtHoras(linha.deltaFalhaHoras)} h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="analise-ia-observacao">
                      As linhas com maior deterioração de disponibilidade em 2025 foram Linha 11-Coral, Linha 10-Turquesa,
                      Linha 7-Rubi, Linha 13-Jade e Linha 4-Amarela. Essa hierarquia reforça que a piora anual não foi homogênea:
                      ela se concentrou em corredores específicos.
                    </p>
                  </section>

                  <section className="analise-ia-duas-colunas">
                    <article className="analise-ia-card">
                      <span className="analise-ia-section-tag">2. Por que isso aconteceu?</span>
                      <h3>Três famílias causais concentram a maior parte das horas de falha</h3>
                      <p>
                        A classificação das descrições mostra que <strong>sinalização, controle e equipamento de via</strong>,
                        <strong> clima, chuva e alagamento</strong> e <strong>energia e rede aérea</strong> respondem juntas por
                        <strong> {fmtPct1(participacaoCausasEstruturais)}%</strong> das horas de falha inesperada em 2025.
                        Não se trata de um único problema recorrente, mas de uma combinação de fragilidades de infraestrutura,
                        exposição climática e eventos de alimentação elétrica.
                      </p>
                      <div className="analise-ia-mini-ranking">
                        {causas2025Exibidas.slice(0, 6).map((causa) => (
                          <div key={causa.nome} className="analise-ia-mini-ranking-item">
                            <strong>{causa.nome}</strong>
                            <span>
                              {fmtHoras(causa.horas)} h · {fmtPct1(causa.participacaoPct)}% · {fmtInt(causa.qtd)} registros
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="analise-ia-observacao">
                        Há ainda <strong>{fmtHoras(residuoClassificacao2025.horas)} h</strong> em registros sem enquadramento claro.
                        Esse resíduo não altera o diagnóstico principal, mas reduz a precisão da fiscalização e deve ser progressivamente eliminado.
                      </p>
                    </article>

                    <article className="analise-ia-card">
                      <span className="analise-ia-section-tag">Concentração temporal</span>
                      <h3>Poucos meses carregaram grande parte do problema anual</h3>
                      <p>
                        Os três meses com maior volume de horas de falha em 2025 concentraram
                        <strong> {fmtPct1(participacaoMesesCriticos)}%</strong> do total anual. Esse padrão mostra que a rede não operou
                        sob pressão constante e uniforme: houve janelas críticas capazes de distorcer fortemente o resultado do ano.
                      </p>
                      <div className="analise-ia-mini-ranking">
                        {mesesCriticos2025.map((mes) => (
                          <div key={mes.mes} className="analise-ia-mini-ranking-item">
                            <strong>{mes.label}</strong>
                            <span>
                              {fmtHoras(mes.horas)} h · {fmtPct1(mes.participacaoPct)}% · {fmtInt(mes.qtd)} ocorrências
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="analise-ia-observacao">
                        A leitura por mês ajuda a separar problema crônico de evento concentrado. Essa distinção é decisiva para definir fiscalização,
                        plano de contingência e prioridade de investimento.
                      </p>
                    </article>
                  </section>

                  <section className="analise-ia-card">
                    <span className="analise-ia-section-tag">Eventos relevantes e eventos imprevistos</span>
                    <h3>Marcos institucionais dão contexto; episódios imprevistos explicam a pressão operacional</h3>
                    <p>
                      A leitura cruza dois planos complementares. Os <strong>eventos relevantes</strong> do período — obras emergenciais,
                      transições operacionais, investimentos e renovação de frota — ajudam a interpretar o contexto institucional.
                      Já os <strong>eventos imprevistos</strong> registrados nas ocorrências mostram onde a operação perdeu confiabilidade
                      de forma súbita, concentrada e mensurável.
                    </p>
                    <div className="analise-ia-tabela-wrap">
                      <table className="analise-ia-tabela analise-ia-tabela--eventos">
                        <thead>
                          <tr>
                            <th>Natureza</th>
                            <th>Evento considerado</th>
                            <th>Como entra na análise</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Relevante / estrutural</td>
                            <td>Normalização da Linha 11-Coral em 19/05/2025 após obra emergencial na região de Suzano</td>
                            <td>É usada como marco de contexto para interpretar a pressão observada na linha antes da normalização.</td>
                          </tr>
                          <tr>
                            <td>Imprevisto / operacional</td>
                            <td>Linha 11-Coral em {concentracaoLinha11Abril.mesLabel}</td>
                            <td>{fmtHoras(concentracaoLinha11Abril.horas)} h de falha concentradas no mês, equivalentes a {fmtPct1(concentracaoLinha11Abril.participacaoLinhaPct)}% do total anual da própria linha.</td>
                          </tr>
                          <tr>
                            <td>Imprevisto / operacional</td>
                            <td>Linha 4-Amarela em {concentracaoLinha4Setembro.mesLabel}</td>
                            <td>{fmtHoras(concentracaoLinha4Setembro.horas)} h em {fmtInt(concentracaoLinha4Setembro.qtd)} registros, distribuídos em {fmtInt(concentracaoLinha4Setembro.dias)} dias.</td>
                          </tr>
                          <tr>
                            <td>Imprevisto / efeito de rede</td>
                            <td>Ocorrências multilinha em {eventoMultilinha20Abril.dataLabel}</td>
                            <td>{fmtInt(eventoMultilinha20Abril.qtd)} ocorrências somando {fmtHoras(eventoMultilinha20Abril.horas)} h, alcançando {eventoMultilinha20Abril.linhas.join(", ")}.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p>
                      A <strong>Linha 11-Coral</strong> reúne <strong>{fmtHoras(concentracaoLinha11Abril.horas)} h</strong> de falha em
                      <strong> {concentracaoLinha11Abril.mesLabel}</strong>, equivalentes a
                      <strong> {fmtPct1(concentracaoLinha11Abril.participacaoLinhaPct)}%</strong> das horas de falha da própria linha no ano.
                      Esse pico coincide com a restrição iniciada em 04/04/2025 na região de Suzano, posteriormente normalizada em 19/05/2025
                      com a construção de uma via emergencial. A correspondência temporal é forte e ajuda a explicar por que a Linha 11 aparece como
                      um dos principais vetores de deterioração do ano.
                    </p>
                    <p>
                      A <strong>Linha 4-Amarela</strong> apresenta outro caso de concentração: em
                      <strong> {concentracaoLinha4Setembro.mesLabel}</strong>, acumulou
                      <strong> {fmtHoras(concentracaoLinha4Setembro.horas)} h</strong> em
                      <strong> {fmtInt(concentracaoLinha4Setembro.qtd)} registros</strong>, distribuídos em
                      <strong> {fmtInt(concentracaoLinha4Setembro.dias)} dias</strong>.
                      O comportamento não deve ser diluído na média anual; ele merece leitura específica como episódio de pressão operacional concentrada.
                    </p>
                    <p>
                      Em <strong>{eventoMultilinha20Abril.dataLabel}</strong>, a rede registrou
                      <strong> {fmtInt(eventoMultilinha20Abril.qtd)} ocorrências</strong> que somaram
                      <strong> {fmtHoras(eventoMultilinha20Abril.horas)} h</strong>, alcançando
                      <strong> {eventoMultilinha20Abril.linhas.join(", ")}</strong>.
                      Além disso, a <strong>Linha 13-Jade</strong> acumula
                      <strong> {fmtHoras(efeitoCascataLinha13PorLinha11.horas)} h</strong> em registros associados a Linha 11 e sistema de energia,
                      reforçando a necessidade de tratar efeitos em cascata separadamente da origem do evento.
                    </p>
                    <div className="analise-ia-callout">
                      <strong>Leitura pública necessária:</strong> eventos concentrados não são “ruído estatístico”.
                      São justamente os episódios que mais afetam a confiança do passageiro e que mais exigem transparência sobre causa, resposta e prevenção.
                    </div>
                  </section>

                  <section className="analise-ia-card">
                    <span className="analise-ia-section-tag">Linhas em destaque</span>
                    <h3>O aumento de falhas se concentrou onde o impacto anual foi mais visível</h3>
                    <div className="analise-ia-tabela-wrap">
                      <table className="analise-ia-tabela">
                        <thead>
                          <tr>
                            <th>Linha</th>
                            <th>Falha 2024</th>
                            <th>Falha 2025</th>
                            <th>Δ horas</th>
                            <th>Δ manutenção programada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhasComMaiorAumentoBrutoFalha.map((linha) => (
                            <tr key={linha.nome}>
                              <td>{linha.nome}</td>
                              <td>{fmtHoras(linha.falha24)} h</td>
                              <td>{fmtHoras(linha.falha25)} h</td>
                              <td>{fmtHoras(linha.deltaFalhaHoras)} h</td>
                              <td>{fmtHoras(linha.deltaManutencaoHoras)} h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="analise-ia-observacao">
                      A comparação reforça a importância de não confundir manutenção programada com falha inesperada.
                      Em algumas linhas, as duas métricas sobem juntas; em outras, seguem trajetórias distintas. O sinal prioritário para o usuário é
                      o aumento da falha não programada, porque ela representa perda de previsibilidade durante a operação.
                    </p>
                  </section>

                  <section className="analise-ia-duas-colunas">
                    <article className="analise-ia-card">
                      <span className="analise-ia-section-tag">3. O que pode acontecer?</span>
                      <h3>Sem resposta focalizada, o risco é transformar episódios concentrados em padrão recorrente</h3>
                      <ul className="analise-ia-lista">
                        <li>
                          <strong>Persistência de picos mensais:</strong> meses críticos podem continuar concentrando parcela desproporcional das horas de falha,
                          mesmo quando a média anual parece controlada.
                        </li>
                        <li>
                          <strong>Pressão sobre linhas de integração:</strong> ocorrências em eixos como 11-Coral, 13-Jade, 7-Rubi e 10-Turquesa tendem a
                          repercutir além da linha de origem.
                        </li>
                        <li>
                          <strong>Subestimação política do problema:</strong> uma disponibilidade global elevada pode mascarar a degradação da experiência real
                          quando as falhas se acumulam em horários, dias e corredores sensíveis.
                        </li>
                        <li>
                          <strong>Dificuldade de responsabilização:</strong> descrições vagas, dados indisponíveis e cascatas mal separadas reduzem a capacidade
                          de fiscalização e de cobrança pública.
                        </li>
                      </ul>
                    </article>

                    <article className="analise-ia-card">
                      <span className="analise-ia-section-tag">4. O que fazer?</span>
                      <h3>Prioridades para autoridades, reguladores e operadores</h3>
                      <ol className="analise-ia-lista analise-ia-lista-ordenada">
                        <li>
                          <strong>Atacar os focos de maior peso:</strong> priorizar planos corretivos e fiscalização nas linhas e causas que mais contribuíram
                          para as horas de falha em 2025.
                        </li>
                        <li>
                          <strong>Investigar eventos concentrados como dossiês próprios:</strong> abril na Linha 11-Coral, setembro na Linha 4-Amarela e o
                          episódio multilinha de 20/04 merecem análise formal de causa, resposta, duração e medidas preventivas.
                        </li>
                        <li>
                          <strong>Separar origem e repercussão:</strong> cascatas entre linhas devem ter campo próprio, para que a linha afetada não carregue
                          sozinha um problema originado em outro ponto da rede.
                        </li>
                        <li>
                          <strong>Reduzir “dados indisponíveis” e descrições genéricas:</strong> a qualidade do registro precisa melhorar para permitir regulação
                          mais rápida e menos dependente de interpretação posterior.
                        </li>
                        <li>
                          <strong>Acompanhar marcos estruturais com janela antes/depois:</strong> a transição da Linha 7-Rubi para a TIC Trens, a modernização
                          de sinalização das Linhas 8 e 9 e a renovação de frota da Linha 15-Prata precisam ser monitoradas por efeito operacional observável,
                          e não apenas por anúncio institucional.
                        </li>
                      </ol>
                    </article>
                  </section>

                  <section className="analise-ia-duas-colunas">
                    <article className="analise-ia-card">
                      <span className="analise-ia-section-tag">Padrão temporal</span>
                      <h3>Dia e horário mais recorrentes das falhas inesperadas</h3>
                      <dl className="analise-ia-dl">
                        <div>
                          <dt>Dia mais comum em 2024</dt>
                          <dd>{estatisticas2024.diaMaisComum}</dd>
                        </div>
                        <div>
                          <dt>Dia mais comum em 2025</dt>
                          <dd>{estatisticas2025.diaMaisComum}</dd>
                        </div>
                        <div>
                          <dt>Hora mais comum em 2024</dt>
                          <dd>{estatisticas2024.horaMaisComum}</dd>
                        </div>
                        <div>
                          <dt>Hora mais comum em 2025</dt>
                          <dd>{estatisticas2025.horaMaisComum}</dd>
                        </div>
                      </dl>
                      <p className="analise-ia-observacao">
                        Frequência e severidade precisam ser acompanhadas em paralelo. O horário com mais registros mostra repetição; as horas acumuladas
                        revelam onde o dano operacional foi maior.
                      </p>
                    </article>

                    <article className="analise-ia-card">
                      <span className="analise-ia-section-tag">Leitura institucional</span>
                      <h3>Eventos relevantes ajudam a cobrar resultado, não a declarar causalidade automática</h3>
                      <p>
                        A operação da Linha 7-Rubi sob novo arranjo institucional, o aditivo de modernização das Linhas 8 e 9 e a chegada de novos trens
                        para a Linha 15-Prata são fatos relevantes para a avaliação do sistema. Eles não explicam sozinhos os resultados de 2025, mas criam
                        marcos objetivos para acompanhamento futuro.
                      </p>
                      <p className="analise-ia-observacao">
                        A pergunta pública correta não é apenas “o investimento foi anunciado?”, mas “o efeito apareceu na confiabilidade,
                        na regularidade e na redução de ocorrências ao longo do tempo?”.
                      </p>
                    </article>
                  </section>

                  <section className="analise-ia-card analise-ia-fontes">
                    <span className="analise-ia-section-tag">Fontes de contexto</span>
                    <h3>Documentos públicos usados para interpretar os eventos relevantes</h3>
                    <p>
                      Os números da análise vêm da base consolidada de ocorrências. As referências abaixo ajudam a contextualizar marcos operacionais,
                      obras, transições e investimentos que dialogam com os padrões observados.
                    </p>
                    <div className="analise-ia-fonte-lista">
                      {fontesContexto.map((fonte) => (
                        <a key={fonte.href} href={fonte.href} target="_blank" rel="noreferrer">
                          {fonte.rotulo}
                        </a>
                      ))}
                    </div>
                  </section>

                  <section className="analise-ia-card analise-ia-fecho">
                    <span className="analise-ia-section-tag">Conclusão</span>
                    <h3>O desafio de 2025 não foi a manutenção programada: foi a maior exposição a falhas operacionais inesperadas</h3>
                    <p>
                      A leitura consolidada aponta um ano de disponibilidade ainda alta, porém com aumento expressivo do tempo perdido em falhas
                      não programadas. O avanço dessas horas, a maior duração média das ocorrências e a concentração em poucos meses e linhas indicam
                      um problema que merece atenção regulatória e resposta operacional dirigida.
                    </p>
                    <p>
                      A Linha 11-Coral, a Linha 4-Amarela, a Linha 7-Rubi, a Linha 13-Jade e a Linha 10-Turquesa aparecem como eixos de maior pressão.
                      Entre as causas, sinalização e equipamentos de via, clima e alagamentos, além de energia e rede aérea, formam o núcleo mais pesado
                      das horas de falha em 2025. Os eventos relevantes e os eventos imprevistos ajudam a explicar o contexto e a orientar onde a apuração deve ser mais cuidadosa.
                    </p>
                    <p>
                      Para a sociedade, a medida de sucesso é simples: menos surpresa na plataforma, menos viagem interrompida e mais previsibilidade.
                      Para as autoridades, isso exige tratar falhas concentradas com profundidade, qualificar os registros e transformar anúncios de melhoria
                      em resultados verificáveis na operação.
                    </p>
                  </section>
                </div>
                )}                {abaAtiva === "claude" && (
                  <div className="analise-ia-body analise-ia-body--claude" role="tabpanel">

                    <section className="analise-ia-card analise-ia-sintese">
                      <span className="analise-ia-section-tag" style={{background:"#1e3a5f",color:"#fff"}}>Análise Aprofundada 2024–2025</span>
                      <h3>Falha operacional vs. manutenção programada: leituras completamente diferentes</h3>
                      <p style={{fontSize:"0.78rem",opacity:0.7,marginTop:"-0.5rem"}}>
                        Leitura direta dos registros sanitizados. Todas as métricas citadas derivam das bases
                        <em> ocorrencias_metro_2024_v3.xlsx</em> e <em>ocorrencias_metro_2025_v3.xlsx</em>.
                        Contextos externos têm fontes indicadas. Análise descritiva e imparcial — causas técnicas e responsabilidades dependem de apuração formal.
                      </p>
                      <div className="analise-ia-callout" style={{borderLeft:"4px solid #1e3a5f",background:"#f0f4ff"}}>
                        <strong>Distinção fundamental:</strong> Manutenção programada é planejada, comunicada ao regulador e esperada pelo passageiro — representa escolha operacional. Falha operacional é imprevista, não planejada e diretamente ligada à confiabilidade real do sistema. Analisá-las juntas mascara o risco real. Este painel separa os dois desde o início.
                      </div>
                    </section>

                    {/* EVENTOS ESTRUTURAIS */}
                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag" style={{background:"#1C2C8C",color:"#fff"}}>Eventos Estruturais — Leitura cruzada com os dados operacionais</span>
                      <h3>Cada evento estrutural deixou uma marca mensurável nos registros</h3>
                      <p>
                        Os 9 eventos estruturais registrados (2 em 2024, 7 em 2025) não são apenas contexto — cada um tem correspondência direta nos dados de falha e manutenção.
                        Cruzar os dois permite separar o que é consequência esperada de um programa de modernização do que é deterioração não planejada.
                      </p>
                      <div className="analise-ia-causas">

                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>📦 L15-Prata — 1º trem entregue na China (03/jul/2024) · chegada SP (27/nov/2024)</strong>
                            <span>
                              Em 2024, a L15-Prata acumulou <strong>64,8 h de falha</strong> — quase inteiramente de paralisações para testes de CBTC (sistema de controle).
                              Os meses de set/2024 (14,5 h) e jul/2024 (11,8 h) concentram os picos, antes da chegada do trem ao Brasil.
                              Após a chegada do 2º e 3º trens em <strong>fev/2025</strong>, o padrão inverte completamente:
                              jan–ago/2025 soma apenas <strong>5,5 h de falha total</strong>, enquanto a manutenção programada cresce — set/2025 (52,4 h), out/2025 (30,0 h), nov/2025 (27,5 h).
                              A chegada da frota nova deslocou o sistema de "paralisações por testes" para "manutenção planejada de integração". Evolução esperada e positiva.
                            </span>
                          </div>
                          <em style={{color:"#27ae60"}}>2024: 64,8 h falha · 2025: 22,3 h falha + 122,8 h manutenção programada — transição bem-sucedida</em>
                        </div>

                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>🚆 L8/L9 — Conclusão dos 36 trens (06/mar/2025) + Aditivo ETCS-N2 (29/mai/2025)</strong>
                            <span>
                              Em 2024, L8 e L9 tinham manutenção programada combinada de <strong>776 h</strong> — a maior do sistema.
                              A L9 em particular acumulou 65,2 h só em jan/2024 e 64,9 h em fev/2024, ritmo de obra intensíssimo.
                              Após a conclusão das entregas em mar/2025, a manutenção programada combinada caiu para <strong>418 h (−46%)</strong>.
                              A falha, contudo, manteve-se controlada: L8 passou de 15,1 h para 19,1 h (+27%), e L9 de 51,7 h para 25,7 h (−50%).
                              O aditivo ETCS-N2 de mai/2025 sinaliza que nova rodada de manutenção pesada está prevista — o pico de jul/2025 na L9 (63,5 h de manutenção) já reflete o início desse ciclo.
                            </span>
                          </div>
                          <em style={{color:"#27ae60"}}>Razão falha/manutenção: L8 0,04× (2024) → 0,10× (2025) · L9 0,14× → 0,11× — perfil saudável mantido</em>
                        </div>

                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>🔧 L11-Coral — Normalização da circulação (19/mai/2025, 2 meses antes do previsto)</strong>
                            <span>
                              A CPTM concluiu a via emergencial na região de Suzano antes do prazo — dado operacional positivo.
                              Os dados confirmam a narrativa: <strong>antes de 19/mai, a L11 acumulou 66,6 h de falha em apenas 10 eventos</strong> — média de 6,7 h por evento, sinal de paralisações longas ligadas às obras.
                              <strong>Depois de 19/mai, foram 48,3 h em 20 eventos</strong> — média de 2,4 h por evento, padrão mais fragmentado e de menor severidade individual.
                              A normalização reduziu a duração média por evento em 64%, mas o volume acumulado pós-maio ainda é relevante (48,3 h em 7 meses), indicando que a linha mantém pressão operacional mesmo após a obra.
                            </span>
                          </div>
                          <em style={{color:"#f39c12"}}>Antes 19/mai: 66,6 h (10 eventos, média 6,7 h) · Depois: 48,3 h (20 eventos, média 2,4 h)</em>
                        </div>

                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>🔄 L7-Rubi — Três fases de transição TIC Trens (28/ago e 26/nov/2025)</strong>
                            <span>
                              Os dados revelam um padrão contraintuitivo nas três fases:
                              <strong> Fase 1 (jan–27ago, CPTM): 68,9 h de falha em 30 eventos</strong> — maior volume, operação antiga sob gestão original.
                              <strong> Fase 2 (28ago–25nov, supervisionado TIC+CPTM): 12,1 h em 8 eventos</strong> — menor volume do ano, período de supervisão ativa.
                              <strong> Fase 3 (26nov–dez, TIC pleno): 17,1 h em 12 eventos</strong> — leve alta no primeiro mês de operação integral.
                              A redução na fase supervisionada sugere que a presença conjunta dos dois operadores criou disciplina operacional. O desafio para 2026 é manter esse padrão sem a supervisão da CPTM.
                              A manutenção programada registrada em 2025 foi de apenas <strong>17,6 h</strong> — muito baixa para uma linha recém-assumida com pacote de 21 mil dormentes e 10 km de trilhos anunciado.
                            </span>
                          </div>
                          <em style={{color:"#e67e22"}}>Fase supervisionada foi a melhor do ano — risco: regressão após autonomia plena em 2026</em>
                        </div>

                      </div>
                    </section>

                    {/* BLOCO CENTRAL: SEPARAÇÃO FALHA vs MANUTENÇÃO */}
                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">Premissa da análise — Por que separar?</span>
                      <h3>Disponibilidade declarada ≠ confiabilidade real</h3>
                      <p>
                        A disponibilidade declarada de <strong>99,106% em 2025</strong> inclui tanto o tempo em falha quanto o tempo em manutenção programada no denominador, mas computa apenas o tempo disponível no numerador. Isso significa que uma linha com muita manutenção planejada e poucas falhas parece idêntica a uma linha com pouca manutenção e muitas falhas — o que é uma distorção analítica grave para fins regulatórios.
                      </p>
                      <p>
                        A <strong>confiabilidade real</strong> — medida apenas pelo tempo em falha imprevista sobre o tempo total — conta uma história diferente:
                      </p>
                      <div className="analise-ia-comparativo">
                        <div>
                          <span>Falha operacional (imprevistos) 2024</span>
                          <strong>430,3 h · 0,2319% do tempo</strong>
                          <small>Confiabilidade real: 99,768%</small>
                        </div>
                        <div>
                          <span>Falha operacional (imprevistos) 2025</span>
                          <strong>723,9 h · 0,3912% do tempo</strong>
                          <small>Confiabilidade real: 99,609%</small>
                        </div>
                        <div>
                          <span>Variação de confiabilidade real</span>
                          <strong style={{color:"#c0392b"}}>−0,159 p.p.</strong>
                          <small>3,4× maior que o recuo da disponibilidade declarada (−0,047 p.p.)</small>
                        </div>
                      </div>
                      <p style={{marginTop:"0.75rem"}}>
                        A queda real de confiabilidade é <strong>3,4 vezes maior</strong> do que o recuo da disponibilidade declarada sugere. A métrica agregada suaviza o problema porque a manutenção programada <em>caiu</em> de 1.142 h para 931 h — ou seja, o sistema ficou mais confiável do ponto de vista planejado, mas <strong>piorou do ponto de vista imprevisível</strong>. Esses são movimentos opostos que se parcialmente cancelam no indicador composto.
                      </p>
                      <div className="analise-ia-comparativo analise-ia-comparativo-compacto">
                        <div><span>Manutenção programada 2024</span><strong>1.142,0 h</strong><small>0,615% do tempo</small></div>
                        <div><span>Manutenção programada 2025</span><strong>930,5 h</strong><small>0,503% do tempo · −18,5% ↓</small></div>
                        <div><span>Razão falha/manutenção 2024</span><strong>0,38×</strong><small>manutenção dominava</small></div>
                        <div><span>Razão falha/manutenção 2025</span><strong>0,78×</strong><small>falha se aproxima da manutenção</small></div>
                      </div>
                    </section>

                    {/* KPIs SEPARADOS */}
                    <section className="analise-ia-grid-resumo" aria-label="KPIs separados falha vs manutenção">
                      <article className="analise-ia-kpi-card" style={{borderTop:"3px solid #c0392b"}}>
                        <span>Falha imprevisível 2025</span>
                        <strong>723,9 h</strong>
                        <p>2024: 430,3 h · +68,2% ↑</p>
                      </article>
                      <article className="analise-ia-kpi-card" style={{borderTop:"3px solid #f39c12"}}>
                        <span>Manutenção programada 2025</span>
                        <strong>930,5 h</strong>
                        <p>2024: 1.142,0 h · −18,5% ↓</p>
                      </article>
                      <article className="analise-ia-kpi-card" style={{borderTop:"3px solid #1e3a5f"}}>
                        <span>Confiabilidade real 2025</span>
                        <strong>99,609%</strong>
                        <p>2024: 99,768% · −0,159 p.p.</p>
                      </article>
                      <article className="analise-ia-kpi-card" style={{borderTop:"3px solid #27ae60"}}>
                        <span>Razão falha/manutenção 2025</span>
                        <strong>0,78×</strong>
                        <p>2024: 0,38× — falha dobrou proporcionalmente</p>
                      </article>
                    </section>

                    {/* SEÇÃO 1 */}
                    <section className="analise-ia-card analise-ia-sintese">
                      <span className="analise-ia-section-tag">1. O que aconteceu?</span>
                      <h3>Manutenção caiu, mas falha imprevisível quase dobrou — perfis opostos por operador</h3>
                      <p>
                        Em 2025, o sistema reduziu manutenção programada em 211,5 h (−18,5%) e ao mesmo tempo acumulou 293,6 h a mais de falha imprevisível (+68,2%). São movimentos na direção oposta: o esforço planejado diminuiu, mas o imprevisível cresceu com força. Para fins de fiscalização, o dado relevante é o segundo.
                      </p>
                      <p>
                        A <strong>razão falha/manutenção</strong> é o indicador mais revelador: em 2024 era 0,38× (manutenção dominava amplamente). Em 2025 chegou a 0,78× — a falha imprevisível representa agora quase o dobro de sua proporção anterior em relação ao tempo planejado. Quando essa razão ultrapassa 1,0×, o sistema passa a ter mais horas de interrupção não planejada do que planejada — um limiar de alerta operacional.
                      </p>
                    </section>

                    {/* SEGMENTAÇÃO POR OPERADOR */}
                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">Segmentação 1 — Por operador: perfis completamente distintos</span>
                      <h3>Cada operador tem uma combinação diferente de risco</h3>
                      <div className="analise-ia-causas">
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>ViaMobilidade 8 e 9 — perfil "manutenção pesada, falha controlada"</strong>
                            <span>Falha: 44,8 h (0,315%) · Manutenção: 418,2 h (2,938%) · Razão: 0,11×</span>
                          </div>
                          <em style={{color:"#27ae60"}}>Confiabilidade real: 99,685%</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>ViaMobilidade 5 (L5-Lilás) — perfil "equilibrado"</strong>
                            <span>Falha: 24,3 h (0,341%) · Manutenção: 21,9 h (0,307%) · Razão: 1,11×</span>
                          </div>
                          <em style={{color:"#f39c12"}}>Confiabilidade real: 99,659% — razão próxima de 1, atenção crescente</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>Metrô SP (4 linhas) — perfil "manutenção moderada, falha relevante"</strong>
                            <span>Falha: 177,7 h (0,624%) · Manutenção: 308,5 h (1,084%) · Razão: 0,58×</span>
                          </div>
                          <em style={{color:"#f39c12"}}>Confiabilidade real: 99,376% — maior volume absoluto de falha</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>CPTM (4 linhas) — perfil "falha supera manutenção"</strong>
                            <span>Falha: 271,6 h (0,954%) · Manutenção: 164,3 h (0,577%) · Razão: 1,65×</span>
                          </div>
                          <em style={{color:"#c0392b"}}>Confiabilidade real: 99,046% — razão acima de 1: mais falha do que manutenção planejada</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>TIC Trens (L7-Rubi) — perfil "falha domina, manutenção quase ausente"</strong>
                            <span>Falha: 98,1 h (1,378%) · Manutenção: 17,6 h (0,248%) · Razão: 5,56×</span>
                          </div>
                          <em style={{color:"#c0392b"}}>Confiabilidade real: 98,622% — transição operacional visível nos dados</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>ViaQuatro (L4-Amarela) — perfil "falha total, manutenção zero registrada"</strong>
                            <span>Falha: 107,5 h (1,510%) · Manutenção: 0,0 h (0,000%) · Razão: ∞</span>
                          </div>
                          <em style={{color:"#c0392b"}}>Confiabilidade real: 98,490% — anomalia estrutural: 107,5 h de falha sem uma única hora de manutenção registrada</em>
                        </div>
                      </div>
                    </section>

                    {/* SEGMENTAÇÃO POR LINHA */}
                    <section className="analise-ia-duas-colunas">
                      <div className="analise-ia-card">
                        <span className="analise-ia-section-tag">Segmentação 2 — Linhas com maior falha imprevisível 2025</span>
                        <h4>Ranking por confiabilidade real (excluindo manutenção programada)</h4>
                        <ul className="analise-ia-lista">
                          <li><strong>L7-Rubi: 98,1 h falha · razão 5,56×</strong> — Transição TIC Trens. Falha predomina com larga margem sobre manutenção. Curva de aprendizado operacional esperada, mas razão 5,56× é o segundo maior do sistema.</li>
                          <li><strong>L4-Amarela: 107,5 h falha · razão ∞</strong> — Maior razão do sistema por definição. Zero manutenção registrada + 107,5 h de falha = estrutura de reporte incompatível com a operação real. Via única em set/2025 (96,3 h) sem registro de obra.</li>
                          <li><strong>L11-Coral: 114,9 h falha · razão 1,38×</strong> — Falha supera manutenção. 2024 tinha razão 14,14× (quase só falha, zero manutenção). Em 2025 a manutenção cresceu (obras formalizadas), mas a falha cresceu mais ainda.</li>
                          <li><strong>L13-Jade: 68,1 h falha · razão 3,32×</strong> — Falha domina. 27,6 h de energia (cascata L11) + 19 h em nov por problema na L11. Alta dependência de outra linha.</li>
                          <li><strong>L12-Safira: 36,2 h falha · razão 13,16×</strong> — Razão mais alta do sistema. Obras encerraram em 2024 (239,6 h de manutenção), restando apenas 2,8 h em 2025. O que sobrou é quase só falha imprevisível.</li>
                        </ul>
                      </div>
                      <div className="analise-ia-card">
                        <span className="analise-ia-section-tag">Segmentação 3 — Linhas com melhor separação planejado/imprevisível</span>
                        <h4>Perfis de referência positiva</h4>
                        <ul className="analise-ia-lista">
                          <li><strong>L8-Diamante: 19,1 h falha · razão 0,10×</strong> — Melhor razão do sistema. 194,6 h de manutenção programada para apenas 19,1 h de falha. Programa de modernização ativo e controlado.</li>
                          <li><strong>L9-Esmeralda: 25,7 h falha · razão 0,11×</strong> — Segunda melhor razão. 223,6 h de manutenção + apenas 25,7 h de falha. Em 2024, com 382,1 h de manutenção, havia 51,7 h de falha (razão 0,14×): melhorou em ambas as dimensões.</li>
                          <li><strong>L2-Verde: 37,9 h falha · razão 0,33×</strong> — 115,3 h de manutenção (obras de via), falha baixa. Padrão saudável de intervenção planejada com baixo vazamento para falha imprevisível.</li>
                          <li><strong>L15-Prata: 22,3 h falha · razão 0,18×</strong> — 122,8 h de manutenção (testes de novos trens), falha pequena. Melhora expressiva ante 2024 (64,8 h de falha, incluindo 51,8 h de falha total — todas ligadas a testes de CBTC).</li>
                        </ul>
                        <div className="analise-ia-callout" style={{marginTop:"1rem",borderLeft:"4px solid #27ae60",background:"#f0fdf4"}}>
                          <strong>Padrão de referência:</strong> L8 e L9 mostram que alta manutenção programada com baixa falha imprevisível é o perfil correto em programas de modernização. A manutenção deve preceder a falha — não substituí-la.
                        </div>
                      </div>
                    </section>

                    {/* SEÇÃO 2 */}
                    <section className="analise-ia-duas-colunas">
                      <div className="analise-ia-card">
                        <span className="analise-ia-section-tag">2. Por que isso aconteceu?</span>
                        <h4>Causas da piora de confiabilidade real</h4>
                        <ul className="analise-ia-lista">
                          <li><strong>Transição TIC Trens (L7):</strong> Assunção plena em nov/2025. Operador novo em infraestrutura antiga. 98,1 h de falha com apenas 17,6 h de manutenção registrada indica que o operador ainda não formalizou programa de manutenção preventiva. Sem manutenção que precede a falha, a razão falha/manutenção inevitavelmente sobe.</li>
                          <li><strong>ViaQuatro sem manutenção registrada:</strong> 107,5 h de falha em 2025, zero em manutenção — igual a 2024. Isso não é coincidência: é padrão de reporte. Ou a manutenção ocorre fora da janela operacional monitorada, ou não é registrada como tal. Em ambos os casos, o regulador não tem visibilidade sobre o estado preventivo da linha.</li>
                          <li><strong>CPTM com razão 1,65×:</strong> Das 4 linhas CPTM, L11-Coral (razão 1,38×), L13-Jade (3,32×) e L12-Safira (13,16×) puxam a razão para cima. As obras formalizadas em L11 e L12 em 2024 revelaram infraestrutura que, ao saírem da manutenção intensiva, passou a falhar mais.</li>
                          <li><strong>Falhas de energia crescem 83%:</strong> 30 → 55 eventos. Concentradas em linhas CPTM antigas (L10, L11, L12). Infraestrutura elétrica com sinais de desgaste — manutenção corretiva reativa, não preventiva.</li>
                        </ul>
                      </div>
                      <div className="analise-ia-card">
                        <span className="analise-ia-section-tag">Anomalias que a separação torna visíveis</span>
                        <h4>O que só aparece quando se separa os dados</h4>
                        <ul className="analise-ia-lista">
                          <li><strong>L4-Amarela / ViaQuatro — razão infinita:</strong> Sem a separação, a disponibilidade de 98,49% parece razoável. Com a separação, fica claro que 100% do tempo afetado é falha imprevisível. Um operador com programa real de manutenção preventiva deveria ter pelo menos alguma hora de manutenção registrada. A ausência é o sinal, não a falha em si.</li>
                          <li><strong>L12-Safira — razão 13,16×:</strong> Em 2024 havia 239,6 h de manutenção (obras intensas). Em 2025, apenas 2,8 h. O fim das obras deveria ter estabilizado a linha — mas resultou em 36,2 h de falha imprevisível, uma razão muito alta para uma linha recém-reformada. Sugere que as obras não endereçaram todas as causas raiz ou que novos problemas surgiram após a reforma.</li>
                          <li><strong>L11-Coral — inversão de 2024 para 2025:</strong> Em 2024, razão 14,14× (praticamente zero manutenção, só falha). Em 2025, razão 1,38× (manutenção cresceu para 83,1 h, mas falha cresceu ainda mais para 114,9 h). O aumento de manutenção formalizada é positivo, mas não foi suficiente para conter o crescimento da falha imprevisível.</li>
                          <li><strong>Cascata 20/abr — 69 h de falha pura:</strong> O evento multilinha de 20/abr não gerou nenhuma hora de manutenção programada — é 100% falha imprevisível distribuída em 4 linhas (L7, L10, L11, L13). Sem marcação de evento de alta severidade, esse volume some no agregado anual.</li>
                        </ul>
                      </div>
                    </section>

                    {/* SEÇÃO 3 */}
                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">3. O que pode acontecer?</span>
                      <h4>Tendências prospectivas com foco em confiabilidade real</h4>
                      <div className="analise-ia-duas-colunas" style={{margin:0,gap:"1rem"}}>
                        <div>
                          <ul className="analise-ia-lista">
                            <li><strong>Razão falha/manutenção continuará subindo em linhas sem programa preventivo:</strong> TIC Trens (L7) e ViaQuatro (L4) não têm histórico de manutenção programada registrada. Sem intervenção formal no dado, a razão tende a crescer — e a confiabilidade real, a cair.</li>
                            <li><strong>L8/L9 podem manter boa razão enquanto o ETCS-N2 estiver em implantação:</strong> A alta manutenção programada prevista para 2026 (aditivo contratual mai/2025) manterá a razão baixa — desde que a falha imprevisível não cresça junto. Se crescer, é sinal de problema na implantação.</li>
                            <li><strong>L12-Safira é candidata a deterioração:</strong> Razão 13,16× após reforma intensa. Se a manutenção não for retomada em patamar moderado, a tendência é de falhas crescentes em infraestrutura recém-reformada mas sem acompanhamento preventivo.</li>
                          </ul>
                        </div>
                        <div>
                          <ul className="analise-ia-lista">
                            <li><strong>Nó Brás–Luz permanece como risco de falha sistêmica:</strong> O evento de 20/abr gerou ~69 h de falha pura em 4 linhas. Não há manutenção planejada que previna isso — é risco de infraestrutura compartilhada. A única mitigação real é redundância de rota e protocolo de resposta rápida.</li>
                            <li><strong>Sazonalidade de chuvas em linhas de superfície:</strong> L1-Azul (46 eventos de chuva, 45,0 h) e L7-Rubi (17 eventos, 33,6 h) têm alta exposição. Manutenção de drenagem e proteção de via externa é o tipo de intervenção que, se feita preventivamente, reduz falha imprevisível em período chuvoso.</li>
                            <li><strong>Se a razão falha/manutenção do sistema ultrapassar 1,0× em 2026:</strong> Seria o primeiro ano em que o sistema como um todo teria mais horas imprevisíveis do que planejadas. Em 2025 estava em 0,78×. Para o regulador, esse limiar deve ser monitorado explicitamente.</li>
                          </ul>
                        </div>
                      </div>
                    </section>

                    {/* SEÇÃO 4 */}
                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">4. O que fazer?</span>
                      <h4>Recomendações baseadas na separação falha / manutenção</h4>
                      <div className="analise-ia-duas-colunas" style={{margin:0,gap:"1rem"}}>
                        <div>
                          <p><strong>Para o regulador (ARTESP):</strong></p>
                          <ul className="analise-ia-lista">
                            <li><strong>Adotar razão falha/manutenção como KPI regulatório:</strong> A disponibilidade declarada não distingue os dois. A razão falha/manutenção é simples de calcular, direta no significado e difícil de inflar artificialmente. Valor acima de 1,0× deve disparar revisão obrigatória do plano de manutenção preventiva do operador.</li>
                            <li><strong>Exigir publicação do PMME com horas planejadas por linha/trimestre:</strong> Se o operador declara um plano de manutenção, as horas executadas devem aparecer nos registros. ViaQuatro com zero hora em dois anos consecutivos e TIC Trens com 17,6 h no primeiro ano são dados que precisam de explicação formal, não tolerância silenciosa.</li>
                            <li><strong>Criar categoria "falha pós-obra":</strong> Quando uma linha sai de período intenso de manutenção (como L12-Safira em 2024→2025), os primeiros 12 meses deveriam ter monitoramento reforçado. A razão 13,16× da L12 em 2025 deveria ter gerado alerta automático.</li>
                            <li><strong>Separar no painel oficial os dois indicadores:</strong> Disponibilidade por manutenção programada e disponibilidade por falha imprevisível são métricas com significados e responsabilidades diferentes. Publicá-las juntas como "disponibilidade" cria ambiguidade regulatória.</li>
                          </ul>
                        </div>
                        <div>
                          <p><strong>Para os operadores:</strong></p>
                          <ul className="analise-ia-lista">
                            <li><strong>ViaQuatro — registrar toda intervenção como manutenção:</strong> Qualquer atividade que afete a capacidade operacional deve aparecer nos registros — programada ou corretiva. A via única de 5 dias em set/2025 sem nenhum registro de manutenção é o exemplo mais claro: seja uma obra emergencial, seja uma falha de via, ambos exigem classificação explícita.</li>
                            <li><strong>TIC Trens — construir programa de manutenção preventiva visível:</strong> A razão 5,56× no primeiro ano de operação é esperada em transições. O risco é ela se tornar estrutural. O pacote anunciado (21 mil dormentes, 10 km de trilhos) precisa aparecer como manutenção programada nos registros de 2026, não só como falhas evitadas.</li>
                            <li><strong>CPTM — priorizar manutenção preventiva em L11 e L13:</strong> Ambas têm razão falha/manutenção acima de 1,0×. O histórico de energia (L11: 33,7 h de falha elétrica; L13: 27,6 h por cascata de L11) indica infraestrutura elétrica que precisa de manutenção preventiva, não só corretiva.</li>
                            <li><strong>Todos — comunicar ao regulador quando manutenção programada for adiada:</strong> Manutenção postergada vira falha futura. Se um operador cancela ou adia intervenção planejada, o regulador precisa saber — não para punir, mas para antecipar o risco de falha imprevisível correspondente.</li>
                          </ul>
                        </div>
                      </div>
                    </section>

                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag" style={{background:"#7b2d00",color:"#fff"}}>Eventos Atípicos — Análise Estatística (Z-score)</span>
                      <h3>3 outliers em 2025 respondem por 28,5% de todo o volume anual de falha</h3>
                      <p>
                        Aplicando análise de Z-score sobre as horas de falha por linha/mês (média = 6,52 h, σ = 12,73 h),
                        emergem <strong>3 eventos estatisticamente atípicos em 2025</strong> — todos acima de 3σ.
                        Juntos, somam <strong>206,2 h = 28,5% do total anual de 723,9 h</strong>.
                        Sem esses 3 outliers, o crescimento de falhas de 2025 sobre 2024 seria de +20,3% — significativo, mas muito diferente do +68,2% que o número bruto mostra.
                        Isso tem implicação direta na interpretação regulatória: <strong>parte relevante da piora anual vem de episódios pontuais, não de degradação sistêmica uniforme</strong>.
                      </p>

                      <div className="analise-ia-causas">
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>🔴 Outlier 1 — L4-Amarela · setembro/2025 · 7,1σ · 96,3 h</strong>
                            <span>
                              Via única entre Vila Sônia e São Paulo-Morumbi por 5 dias consecutivos (10–14/set).
                              Cada dia operou praticamente a jornada inteira em capacidade reduzida (~19,3 h/dia).
                              <strong> Causa não declarada nos registros</strong> — apenas "opera em via única", sem obra, sem falha de equipamento identificada, sem manutenção programada registrada.
                              Representa 13,3% de toda a falha operacional da rede em 2025, gerada por uma única linha em 5 dias.
                            </span>
                          </div>
                          <em style={{color:"#c0392b"}}>13,3% do total anual · ViaQuatro · causa não documentada</em>
                        </div>

                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>🔴 Outlier 2 — L11-Coral · abril/2025 · 4,5σ · 63,4 h</strong>
                            <span>
                              Mês dominado por três causas independentes acumuladas:
                              (1) <strong>20/abr: interrupção Brás–Luz</strong> — 17,98 h de falha cascata com L7, L10, L13;
                              (2) <strong>07/abr e 04/abr: fortes chuvas</strong> — 14,98 h + 6,83 h + 3,98 h = 25,8 h acumuladas;
                              (3) <strong>11/abr: manutenção de ponte ferroviária</strong> — 13,22 h (registrada como falha parcial, não como manutenção programada).
                              A L11-Coral em abril é um caso de convergência de múltiplas causas distintas no mesmo período — não um evento único.
                            </span>
                          </div>
                          <em style={{color:"#c0392b"}}>8,8% do total anual · CPTM · 3 causas distintas convergentes</em>
                        </div>

                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>🟡 Outlier 3 — L1-Azul · janeiro/2025 · 3,1σ · 46,5 h</strong>
                            <span>
                              Inteiramente causado por <strong>alagamento de 24–26/jan</strong> na região Tucuruví–Jardim São Paulo/Ayrton Senna.
                              46 eventos registrados em apenas 3 dias, com o trecho operando em velocidade reduzida ou interrompido de forma intermitente.
                              Os registros descrevem explicitamente "avarias causadas pela chuva" persistindo por dois dias após o evento climático — indicando dano de infraestrutura residual, não apenas interrupção durante a chuva.
                              Contexto: CEMADEN registrou acumulado crítico na zona norte de SP em 24/jan/2025.
                            </span>
                          </div>
                          <em style={{color:"#e67e22"}}>6,4% do total anual · Metrô SP · dano residual de infraestrutura por chuva</em>
                        </div>
                      </div>

                      <h4 style={{marginTop:"1.25rem"}}>Comparação com outliers de 2024 — causas radicalmente diferentes</h4>
                      <p>Em 2024 também havia 3 outliers acima de 2σ (média = 4,30 h, σ = 5,55 h, limiar = 15,40 h). A natureza de cada um revela muito sobre o tipo de problema:</p>
                      <div className="analise-ia-causas">
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>🔴 L2-Verde · agosto/2024 · 6,5σ · 40,3 h</strong>
                            <span>36,9 h (92%) são "Dados/Status Indisponíveis" em dois dias separados (25/ago: 19,3 h e 11/ago: 17,6 h). <strong>Não é falha operacional — é falha de telemetria/reporte.</strong> O sistema de monitoramento não estava reportando o estado da linha. Esse outlier inflou o dado de 2024 com um problema de coleta, não de operação.</span>
                          </div>
                          <em style={{color:"#7f8c8d"}}>Causa: falha de sistema de dados, não falha de operação</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>🔴 L4-Amarela · setembro/2024 · 3,2σ · 22,2 h</strong>
                            <span>Fechamento de estações Higienópolis-Mackenzie, República e Luz por <strong>obras da Linha 6-Laranja</strong> — causa externa à operação da L4. A linha foi afetada por intervenção de outro empreendimento, não por falha própria.</span>
                          </div>
                          <em style={{color:"#7f8c8d"}}>Causa: obra externa (L6-Laranja), não falha interna da L4</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>🔴 L11-Coral · dezembro/2024 · 3,1σ · 21,6 h</strong>
                            <span><strong>Avaria de trem de carga em 18/dez</strong> — 19,07 h acumuladas. Intrusão de material ferroviário de carga na malha de passageiros. Causa externa à operação de passageiros, fora do controle direto da CPTM/concessionária.</span>
                          </div>
                          <em style={{color:"#7f8c8d"}}>Causa: trem de carga externo — interferência na malha compartilhada</em>
                        </div>
                      </div>

                      <div className="analise-ia-callout" style={{marginTop:"1rem",borderLeft:"4px solid #7b2d00",background:"#fff7f0"}}>
                        <strong>Conclusão sobre outliers:</strong> Os outliers de 2024 têm causas predominantemente externas ou de coleta (telemetria, obra de outra linha, trem de carga). Os de 2025 têm causas operacionais internas — via única sem documentação, infraestrutura danificada por chuva, convergência de falhas em abril. Isso muda o diagnóstico: em 2024 os picos eram ruído externo; em 2025 são sinais de vulnerabilidade operacional real. Remover os outliers de 2025 ainda deixa um crescimento de +20,3% na base regular — que também exige explicação.
                      </div>
                    </section>

                    <section className="analise-ia-card analise-ia-fecho">
                      <span className="analise-ia-section-tag">Conclusão</span>
                      <h3>O sistema piora em confiabilidade real 3,4× mais do que a disponibilidade declarada indica</h3>
                      <p>
                        Separar falha imprevisível de manutenção programada revela que a queda real de confiabilidade do sistema em 2025 foi de <strong>−0,159 p.p.</strong> — não os −0,047 p.p. que o indicador agregado mostra. A diferença existe porque manutenção programada caiu (positivo) enquanto falha imprevisível cresceu (negativo), e o indicador único mistura os dois.
                      </p>
                      <p>
                        Os perfis por operador contam histórias radicalmente diferentes: <strong>ViaMobilidade 8/9 tem manutenção pesada e falha controlada</strong> (razão 0,11×, o melhor do sistema); <strong>ViaQuatro e TIC Trens têm falha dominando com manutenção ausente ou irrisória</strong> (razões ∞ e 5,56×); <strong>CPTM ultrapassou o limiar de 1,0×</strong>, com mais horas imprevisíveis do que planejadas. Para fins regulatórios, essas diferenças têm implicações contratuais distintas.
                      </p>
                      <p>
                        A recomendação central é simples: <strong>publicar a razão falha/manutenção como KPI regulatório explícito</strong>, com limiar de alerta em 1,0× e exigência de plano de resposta quando ultrapassado. Com esse único número, o regulador tem uma medida que não pode ser inflada por mais manutenção planejada e que aponta diretamente para onde o sistema está falhando sem aviso.
                      </p>
                    </section>

                  </div>
                )}
                </div>{/* /analise-ia-panels-container */}

                <footer className="eventos-relevantes-footer analise-ia-footer">
                  <span>
                    Bases consideradas: {data2024.metadata.periodoLabel} e {data2025.metadata.periodoLabel}
                  </span>
                  <small>
                    Leitura descritiva dos registros sanitizados. Causas técnicas e responsabilidades dependem de apuração operacional,
                    relatórios de manutenção e documentação formal dos operadores e do poder concedente.
                  </small>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
