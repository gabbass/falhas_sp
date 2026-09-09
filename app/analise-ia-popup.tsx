"use client";

import data2025Raw from "../data/ocorrencias-summary.json";
import data2024Raw from "../data/ocorrencias-summary-2024.json";
import data2026H1Raw from "../data/ocorrencias-summary-2026.json";
import { Bot, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LineBadge, { LineBadgesInText } from "./line-badge";

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
const data2026H1 = data2026H1Raw as SummaryPayload;

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

export default function AnaliseIaPopup({ embedded = false }: { embedded?: boolean }) {
  const [aberto, setAberto] = useState(embedded);
  const [portalPronto, setPortalPronto] = useState(false);
  const embedHost = useRef<HTMLDivElement>(null);
  const [abaAtiva, setAbaAtiva] = useState<"tecnica" | "claude">("tecnica");

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
        className="hero-tab-action analise-ia-trigger"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
      >
        Análise IA
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
                className={`eventos-relevantes-modal analise-ia-modal ${embedded ? "analysis-embedded-modal" : ""}`}
                role={embedded ? "region" : "dialog"}
                aria-modal={embedded ? undefined : "true"}
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
                  {!embedded ? <button
                    type="button"
                    className="eventos-relevantes-close"
                    onClick={() => setAberto(false)}
                    aria-label="Fechar análise IA"
                  >
                    <X size={20} aria-hidden="true" />
                  </button> : null}
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
                              <td><LineBadge nome={linha.nome} /></td>
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
                      As linhas com maior deterioração de disponibilidade em 2025 foram <LineBadge nome="Linha 11-Coral" />, <LineBadge nome="Linha 10-Turquesa" />,
                      <LineBadge nome="Linha 7-Rubi" />, <LineBadge nome="Linha 13-Jade" /> e <LineBadge nome="Linha 4-Amarela" />. Essa hierarquia reforça que a piora anual não foi homogênea:
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
                            <td>Normalização da <LineBadge nome="Linha 11-Coral" /> em 19/05/2025 após obra emergencial na região de Suzano</td>
                            <td>É usada como marco de contexto para interpretar a pressão observada na linha antes da normalização.</td>
                          </tr>
                          <tr>
                            <td>Imprevisto / operacional</td>
                            <td><LineBadge nome="Linha 11-Coral" /> em {concentracaoLinha11Abril.mesLabel}</td>
                            <td>{fmtHoras(concentracaoLinha11Abril.horas)} h de falha concentradas no mês, equivalentes a {fmtPct1(concentracaoLinha11Abril.participacaoLinhaPct)}% do total anual da própria linha.</td>
                          </tr>
                          <tr>
                            <td>Imprevisto / operacional</td>
                            <td><LineBadge nome="Linha 4-Amarela" /> em {concentracaoLinha4Setembro.mesLabel}</td>
                            <td>{fmtHoras(concentracaoLinha4Setembro.horas)} h em {fmtInt(concentracaoLinha4Setembro.qtd)} registros, distribuídos em {fmtInt(concentracaoLinha4Setembro.dias)} dias.</td>
                          </tr>
                          <tr>
                            <td>Imprevisto / efeito de rede</td>
                            <td>Ocorrências multilinha em {eventoMultilinha20Abril.dataLabel}</td>
                            <td>{fmtInt(eventoMultilinha20Abril.qtd)} ocorrências somando {fmtHoras(eventoMultilinha20Abril.horas)} h, alcançando {eventoMultilinha20Abril.linhas.map((nome, index) => <span key={nome}>{index ? ", " : ""}<LineBadge nome={nome} /></span>)}.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p>
                      A <LineBadge nome="Linha 11-Coral" /> reúne <strong>{fmtHoras(concentracaoLinha11Abril.horas)} h</strong> de falha em
                      <strong> {concentracaoLinha11Abril.mesLabel}</strong>, equivalentes a
                      <strong> {fmtPct1(concentracaoLinha11Abril.participacaoLinhaPct)}%</strong> das horas de falha da própria linha no ano.
                      Esse pico coincide com a restrição iniciada em 04/04/2025 na região de Suzano, posteriormente normalizada em 19/05/2025
                      com a construção de uma via emergencial. A correspondência temporal é forte e ajuda a explicar por que a <LineBadge nome="Linha 11-Coral" /> aparece como
                      um dos principais vetores de deterioração do ano.
                    </p>
                    <p>
                      A <LineBadge nome="Linha 4-Amarela" /> apresenta outro caso de concentração: em
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
                      <strong> {eventoMultilinha20Abril.linhas.map((nome, index) => <span key={nome}>{index ? ", " : ""}<LineBadge nome={nome} /></span>)}</strong>.
                      Além disso, a <LineBadge nome="Linha 13-Jade" /> acumula
                      <strong> {fmtHoras(efeitoCascataLinha13PorLinha11.horas)} h</strong> em registros associados à <LineBadge nome="Linha 11-Coral" /> e sistema de energia,
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
                              <td><LineBadge nome={linha.nome} /></td>
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
                          <strong>Investigar eventos concentrados como dossiês próprios:</strong> abril na <LineBadge nome="Linha 11-Coral" />, setembro na <LineBadge nome="Linha 4-Amarela" /> e o
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
                          <strong>Acompanhar marcos estruturais com janela antes/depois:</strong> a transição da <LineBadge nome="Linha 7-Rubi" /> para a TIC Trens, a modernização
                          de sinalização das <LineBadge nome="Linha 8-Diamante" /> e <LineBadge nome="Linha 9-Esmeralda" /> e a renovação de frota da <LineBadge nome="Linha 15-Prata" /> precisam ser monitoradas por efeito operacional observável,
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
                        A operação da <LineBadge nome="Linha 7-Rubi" /> sob novo arranjo institucional, o aditivo de modernização das <LineBadge nome="Linha 8-Diamante" /> e <LineBadge nome="Linha 9-Esmeralda" /> e a chegada de novos trens
                        para a <LineBadge nome="Linha 15-Prata" /> são fatos relevantes para a avaliação do sistema. Eles não explicam sozinhos os resultados de 2025, mas criam
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
                          <LineBadgesInText texto={fonte.rotulo} />
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
                      A <LineBadge nome="Linha 11-Coral" />, a <LineBadge nome="Linha 4-Amarela" />, a <LineBadge nome="Linha 7-Rubi" />, a <LineBadge nome="Linha 13-Jade" /> e a <LineBadge nome="Linha 10-Turquesa" /> aparecem como eixos de maior pressão.
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
                      <span className="analise-ia-section-tag" style={{background:"#1e3a5f",color:"#fff"}}>Análise Aprofundada 2024–2026 (1º semestre)</span>
                      <h3>Falha operacional vs. manutenção programada: a leitura por semestre muda a conclusão</h3>
                      <p style={{fontSize:"0.78rem",opacity:0.7,marginTop:"-0.5rem"}}>
                        Leitura direta e recalculada a partir da base normalizada atual (2024 e 2025 completos, mais o 1º semestre de 2026 — {data2026H1.metadata.periodoLabel},
                        recorte parcial). Os números substituem uma versão anterior desta análise, feita sobre uma base ainda não reprocessada — os totais de falha e manutenção
                        de 2024/2025 mudaram de forma relevante desde então. Análise descritiva e imparcial: causas técnicas e responsabilidades dependem de apuração formal.
                      </p>
                      <div className="analise-ia-callout" style={{borderLeft:"4px solid #1e3a5f",background:"#f0f4ff"}}>
                        <strong>Distinção fundamental:</strong> Manutenção programada é planejada, comunicada ao regulador e esperada pelo passageiro — representa escolha operacional. Falha operacional é imprevista, não planejada e diretamente ligada à confiabilidade real do sistema. Analisá-las juntas mascara o risco real. Este painel separa os dois desde o início e agora acompanha três semestres consecutivos (1S24, 1S25 e 1S26) para julgar se a piora de 2025 foi um pico passageiro ou um novo patamar.
                      </div>
                    </section>

                    {/* PREMISSA */}
                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">Premissa da análise — Por que comparar semestre com semestre?</span>
                      <h3>2025 inteiro mistura um 1º semestre crítico com um 2º semestre de acomodação</h3>
                      <p>
                        Comparar ano fechado com ano fechado esconde uma virada dentro do próprio 2025. Isolando os primeiros semestres — a única janela em que já existem três anos
                        comparáveis (2024, 2025 e 2026) — fica visível que o 1º semestre de 2025 foi o ponto mais grave da série, e que o 1º semestre de 2026 recuou de forma
                        expressiva, ainda que sem voltar ao patamar de 2024.
                      </p>
                      <div className="analise-ia-comparativo">
                        <div>
                          <span>Falha imprevisível — 1º semestre</span>
                          <strong>2024: 280,1 h · 2025: 774,4 h · 2026: 425,0 h</strong>
                          <small>2025 vs. 2024: +176,5% · 2026 vs. 2025: −45,1% · 2026 vs. 2024: +51,7%</small>
                        </div>
                        <div>
                          <span>Manutenção programada — 1º semestre</span>
                          <strong>2024: 1.917,6 h · 2025: 508,5 h · 2026: 1.304,8 h</strong>
                          <small>2025 vs. 2024: −73,5% · 2026 vs. 2025: +156,6% · 2026 vs. 2024: −32,0%</small>
                        </div>
                        <div>
                          <span>Razão falha/manutenção — 1º semestre</span>
                          <strong style={{color:"#c0392b"}}>2024: 0,15× · 2025: 1,52× · 2026: 0,33×</strong>
                          <small>Em 2025 o 1º semestre sozinho já havia rompido o limiar de 1,0× (mais falha do que manutenção); em 2026 a razão volta a ser a melhor dos três anos.</small>
                        </div>
                      </div>
                      <p style={{marginTop:"0.75rem"}}>
                        No ano fechado, o quadro fica mais ameno porque o 2º semestre de 2025 compensou parte do estrago: a razão falha/manutenção do ano inteiro foi de <strong>0,168×</strong> em 2024
                        para <strong>0,937×</strong> em 2025 — perto do limiar de 1,0×, mas sem ultrapassá-lo no agregado anual. A disponibilidade agregada, aliás, <em>subiu</em> de
                        <strong> 95,392%</strong> em 2024 para <strong>97,309%</strong> em 2025 (+1,917 p.p.), porque a manutenção programada caiu mais (−64,9%, de 3.659,5 h para 1.285,5 h)
                        do que a falha subiu (+95,6%, de 615,6 h para 1.204,0 h). Isso confirma o ponto central desta análise: <strong>a disponibilidade agregada mede o resultado líquido
                        de dois movimentos opostos</strong> — menos tempo planejado fora do ar, mais tempo imprevisto fora do ar — e sozinha não avisa qual dos dois está piorando.
                      </p>
                    </section>

                    {/* KPIs 1S */}
                    <section className="analise-ia-grid-resumo" aria-label="KPIs separados falha vs manutenção, por 1º semestre">
                      <article className="analise-ia-kpi-card" style={{borderTop:"3px solid #c0392b"}}>
                        <span>Falha imprevisível — 1S 2026</span>
                        <strong>425,0 h</strong>
                        <p>1S 2025: 774,4 h (−45,1%) · 1S 2024: 280,1 h</p>
                      </article>
                      <article className="analise-ia-kpi-card" style={{borderTop:"3px solid #f39c12"}}>
                        <span>Manutenção programada — 1S 2026</span>
                        <strong>1.304,8 h</strong>
                        <p>1S 2025: 508,5 h (+156,6%) · 1S 2024: 1.917,6 h</p>
                      </article>
                      <article className="analise-ia-kpi-card" style={{borderTop:"3px solid #1e3a5f"}}>
                        <span>Disponibilidade agregada — 1S 2026</span>
                        <strong>96,230%</strong>
                        <p>1S 2025: 97,204% · 1S 2024: 95,237%</p>
                      </article>
                      <article className="analise-ia-kpi-card" style={{borderTop:"3px solid #27ae60"}}>
                        <span>Razão falha/manutenção — 1S 2026</span>
                        <strong>0,33×</strong>
                        <p>1S 2025: 1,52× (pico da série) · 1S 2024: 0,15×</p>
                      </article>
                    </section>

                    {/* SEÇÃO 1 */}
                    <section className="analise-ia-card analise-ia-sintese">
                      <span className="analise-ia-section-tag">1. O que aconteceu?</span>
                      <h3>A rede recuperou o equilíbrio médio, mas trocou de vilão: de "CPTM/L11" para "TIC Trens/L7-Rubi"</h3>
                      <p>
                        A leitura de conjunto do 1º semestre de 2026 é, no agregado, uma recuperação real: a falha imprevisível caiu 45,1% frente ao mesmo período de 2025 e a manutenção
                        programada mais que dobrou (+156,6%), levando a razão falha/manutenção de volta a um patamar saudável (0,33×, melhor que os 0,15× de 2024 e muito abaixo do
                        1,52× de 2025). Isso é evidência de que boa parte da crise de 2025 foi mesmo concentrada e reversível — não uma degradação estrutural permanente da rede como um todo.
                      </p>
                      <p>
                        Só que a recuperação não é uniforme. Enquanto a <LineBadge nome="Linha 11-Coral" /> — a maior responsável pela piora de 2025 — praticamente normalizou, a
                        <LineBadge nome="Linha 7-Rubi" /> (TIC Trens) fez o caminho inverso: acumulou <strong>172,2 h de falha em apenas 6 meses</strong>, mais do que os
                        <strong> 165,0 h de todo o ano de 2025</strong> e mais de cinco vezes as <strong>32,7 h</strong> de 2024. O risco que a análise anterior já havia sinalizado
                        para a TIC Trens — "regressão após autonomia plena" — se materializou, só que em outra linha se tornou o novo problema mais visível do sistema.
                      </p>
                    </section>

                    {/* RECUPERAÇÃO L11 vs DETERIORAÇÃO L7 */}
                    <section className="analise-ia-duas-colunas">
                      <article className="analise-ia-card">
                        <span className="analise-ia-section-tag" style={{background:"#166534",color:"#fff"}}>A recuperação — Linha 11-Coral</span>
                        <h4>De 560 h de falha em 2025 para 17,1 h em 6 meses de 2026</h4>
                        <p>
                          O recálculo mostra que a crise de 2025 na L11-Coral foi maior do que o descrito anteriormente: <strong>560,0 h de falha no ano</strong>, quase toda ela
                          concentrada em quatro meses — abril (326,3 h, o maior desvio estatístico de toda a série, 8,9 desvios-padrão acima da média), maio (117,0 h),
                          novembro (47,9 h) e dezembro (62,0 h). Juntos, esses quatro meses somam <strong>98,8% de toda a falha da linha no ano</strong>.
                        </p>
                        <p>
                          Em 2026, a manutenção programada da linha saltou para <strong>190,4 h</strong> em seis meses (ante 56,7 h em todo 2025) e a falha caiu para <strong>17,1 h</strong>
                          — razão falha/manutenção de <strong>0,09×</strong>, uma das melhores do sistema. É o exemplo mais claro da série de que manutenção formalizada, quando
                          de fato executada, reduz falha imprevisível de forma mensurável.
                        </p>
                      </article>
                      <article className="analise-ia-card">
                        <span className="analise-ia-section-tag" style={{background:"#c0392b",color:"#fff"}}>A deterioração — Linha 7-Rubi</span>
                        <h4>172,2 h de falha em 6 meses, com quatro dos seis meses fora do padrão estatístico</h4>
                        <p>
                          Diferente da L11 em 2025, o problema da L7-Rubi em 2026 não é um evento único: é <strong>recorrente</strong>. Fevereiro (65,2 h, 5,8 desvios-padrão acima
                          da média da rede), maio (39,7 h, 3,3σ), março (31,7 h, 2,5σ) e janeiro (23,1 h, 1,7σ) aparecem todos como desvios estatísticos — quatro de seis meses
                          analisados. Em 2025, por comparação, a linha já havia saltado de 32,7 h (2024) para 165,0 h.
                        </p>
                        <p>
                          A manutenção programada da linha também cresceu (144,8 h em 6 meses, ante 7,8 h em todo 2025), o que derruba a razão falha/manutenção de 21,15× para
                          <strong> 1,19×</strong> — melhora relativa real, mas ainda acima do limiar de 1,0×, e com volume absoluto de falha que já superou o ano inteiro anterior.
                          O pacote de modernização anunciado (dormentes e trilhos) parece estar sendo executado — mas a falha ainda cresce mais rápido do que a manutenção consegue conter.
                        </p>
                      </article>
                    </section>

                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">O que está por trás da falha na L7-Rubi em 2026</span>
                      <h3>Chuva, obra registrada como falha e furto de cabos — não uma causa única</h3>
                      <p>
                        Olhando as descrições dos 48 eventos de falha da L7-Rubi no 1º semestre de 2026, três padrões se repetem: <strong>chuva e alagamento</strong> provocando
                        falha de sinalização ou redução de velocidade (ex.: 09/fev e 14/fev, 19,5 h cada, ambos atribuídos a fortes chuvas do fim de semana); <strong>obras e
                        intervenções de modernização registradas como falha</strong> em vez de manutenção programada (29/mar e 10/mai, 19,5 h cada, via única entre Perus e
                        Caieiras "devido a manutenção" e "para intervenções de infraestrutura para a modernização da linha" — ambas contabilizadas como ocorrência operacional,
                        não como manutenção); e <strong>interferência externa</strong>, incluindo furto de cabos causando falha de sinalização (05/mai, 10,8 h) e um incêndio
                        próximo à via (23/jun, 8,8 h).
                      </p>
                      <p className="analise-ia-observacao">
                        O segundo padrão é o mais relevante para o regulador: se intervenções de modernização estão sendo lançadas como "ocorrência operacional" em vez de
                        "manutenção programada", parte da falha reportada da L7-Rubi em 2026 é, na prática, obra planejada mal classificada — o que infla artificialmente o
                        indicador de falha da linha e, ao mesmo tempo, esconde o volume real de manutenção em execução.
                      </p>
                    </section>

                    {/* SEGMENTAÇÃO POR OPERADOR */}
                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">Segmentação por operador — evolução 2024 → 2025 → 1S 2026</span>
                      <h3>Cada operador troca de posição no ranking de risco de um período para o outro</h3>
                      <div className="analise-ia-causas">
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>CPTM (L10, L11, L12, L13) — de pior para melhor recuperação</strong>
                            <span>Razão falha/manutenção: 0,15× (2024) → 4,76× (2025) → 0,22× (1S 2026). Falha: 128,2 h → 868,4 h → 94,4 h. Manutenção: 835,4 h → 182,6 h → 420,5 h.</span>
                          </div>
                          <em style={{color:"#27ae60"}}>A recuperação da L11-Coral puxa quase sozinha essa reversão — mas as demais linhas CPTM também melhoraram em conjunto.</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>TIC Trens (L7-Rubi) — nova linha de maior risco absoluto</strong>
                            <span>Razão: sem manutenção registrada em 2024 → 21,15× em 2025 (14,0 h de falha sob operação parcial) → 1,19× em 1S 2026 (172,2 h de falha, 144,8 h de manutenção).</span>
                          </div>
                          <em style={{color:"#c0392b"}}>A razão melhora, mas o volume absoluto de falha em 6 meses já supera o de qualquer operador em qualquer ano completo da série.</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>ViaMobilidade 8 e 9 (L8, L9) — único perfil estável nos três períodos</strong>
                            <span>Razão: 0,10× (2024) → 0,05× (2025) → 0,05× (1S 2026). Falha: 283,0 h → 44,8 h → 33,6 h. Manutenção: 2.705,7 h → 818,3 h → 739,5 h.</span>
                          </div>
                          <em style={{color:"#27ae60"}}>Continua sendo o padrão de referência do sistema: manutenção alta e sustentada, falha baixa e decrescente.</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>Metrô de São Paulo (L1, L2, L3, L15) — falha em queda, mas manutenção zerada em 2026</strong>
                            <span>Razão: 1,42× (2024) → 0,59× (2025) → sem manutenção registrada em 1S 2026. Falha: 148,8 h → 155,4 h → 84,3 h. Manutenção: 104,7 h → 262,7 h → 0,0 h.</span>
                          </div>
                          <em style={{color:"#f39c12"}}>A queda de falha é positiva, mas a ausência total de manutenção programada registrada em seis meses é um ponto novo a acompanhar — pode ser real (menos obras no período) ou lacuna de registro.</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div>
                            <strong>ViaQuatro (L4-Amarela) — melhora de volume, anomalia de registro inalterada</strong>
                            <span>Falha: 28,7 h (2024) → 97,1 h (2025, quase toda em setembro) → 9,3 h (1S 2026). Manutenção: 0,0 h nos três períodos.</span>
                          </div>
                          <em style={{color:"#f39c12"}}>Segue sendo o único operador com zero hora de manutenção programada registrada em três anos consecutivos — independentemente do volume de falha.</em>
                        </div>
                      </div>
                    </section>

                    {/* OUTLIERS */}
                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag" style={{background:"#7b2d00",color:"#fff"}}>Eventos atípicos — Análise estatística (Z-score), recalculada</span>
                      <h3>2025 teve um evento catastrófico isolado; 2026 tem um problema crônico em uma linha</h3>
                      <p>
                        Aplicando a mesma análise de desvio-padrão sobre horas de falha por linha/mês: em <strong>2025</strong> (média 10,9 h, desvio 35,6 h, 110 combinações
                        linha/mês), o maior outlier da série inteira é <strong>Linha 11-Coral em abril/2025, com 326,3 h — 8,9 desvios-padrão acima da média e sozinho
                        responsável por 27,1% de toda a falha da rede no ano</strong>. Nenhum outro mês de nenhuma linha, em nenhum dos três períodos analisados, chega perto
                        desse valor.
                      </p>
                      <div className="analise-ia-causas">
                        <div className="analise-ia-causa-item">
                          <div><strong>🔴 L11-Coral · abril/2025 · 8,9σ · 326,3 h</strong></div>
                          <em style={{color:"#c0392b"}}>27,1% do total anual da rede em um único mês de uma única linha</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div><strong>🔴 L11-Coral · maio/2025 · 3,0σ · 117,0 h</strong></div>
                          <em style={{color:"#c0392b"}}>Continuação do mesmo episódio — abril e maio somam 443,3 h, 79% da falha anual da linha</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div><strong>🟠 L7-Rubi · fevereiro/2025 · 2,5σ · 99,7 h</strong></div>
                          <em style={{color:"#e67e22"}}>Primeiro sinal do que se tornaria o padrão recorrente de 2026</em>
                        </div>
                        <div className="analise-ia-causa-item">
                          <div><strong>🟠 L4-Amarela · setembro/2025 · 2,4σ · 96,3 h</strong></div>
                          <em style={{color:"#e67e22"}}>Praticamente toda a falha anual da linha (97,1 h) concentrada em um mês</em>
                        </div>
                      </div>
                      <p style={{marginTop:"1rem"}}>
                        Em <strong>2026 (1º semestre)</strong> (média 6,3 h, desvio 10,1 h, 67 combinações linha/mês), não há nenhum mês isolado comparável ao de abril/2025 — mas
                        há uma concentração diferente e potencialmente mais preocupante: <strong>quatro dos seis meses analisados aparecem como desvio estatístico, e todos
                        pertencem à mesma linha, a L7-Rubi</strong> (fevereiro 65,2 h/5,8σ, maio 39,7 h/3,3σ, março 31,7 h/2,5σ, janeiro 23,1 h/1,7σ). Um evento único e catastrófico,
                        como o de 2025, tende a ser mais fácil de isolar, investigar e corrigir. Um padrão que se repete mês após mês na mesma linha é o sinal mais forte de
                        problema estrutural ainda não resolvido.
                      </p>
                    </section>

                    {/* CAUSAS */}
                    <section className="analise-ia-card">
                      <span className="analise-ia-section-tag">Causas da falha — evolução por família, recalculada</span>
                      <h3>Sinalização e energia ganham peso relativo em 2026; "obra registrada como falha" praticamente desaparece</h3>
                      <p>
                        Reclassificando as descrições de todos os eventos de falha pelo mesmo esquema de causas usado na aba técnica, três movimentos se destacam entre 2024,
                        2025 e o 1º semestre de 2026:
                      </p>
                      <div className="analise-ia-mini-ranking">
                        <div className="analise-ia-mini-ranking-item">
                          <strong>Sinalização, controle e via</strong>
                          <span>2024: 13,8% · 2025: 13,8% · 1S 2026: 25,2% — quase dobra de peso relativo, puxada pela L7-Rubi</span>
                        </div>
                        <div className="analise-ia-mini-ranking-item">
                          <strong>Energia e rede aérea</strong>
                          <span>2024: 12,5% · 2025: 12,9% · 1S 2026: 19,5% — em alta constante nos três períodos</span>
                        </div>
                        <div className="analise-ia-mini-ranking-item">
                          <strong>Clima, chuva e alagamento</strong>
                          <span>2024: 4,4% · 2025: 18,5% · 1S 2026: 15,7% — saltou em 2025 e não voltou ao patamar de 2024</span>
                        </div>
                        <div className="analise-ia-mini-ranking-item">
                          <strong>Obras/manutenção registrada como falha</strong>
                          <span>2024: 30,3% · 2025: 29,0% · 1S 2026: 0,4% — queda abrupta (parte migrou para a categoria "sinalização/via", como no caso da L7-Rubi)</span>
                        </div>
                        <div className="analise-ia-mini-ranking-item">
                          <strong>Registros sem enquadramento claro</strong>
                          <span>2024: 15,6% · 2025: 18,6% · 1S 2026: 28,1% — problema de qualidade de descrição que piora, não melhora</span>
                        </div>
                      </div>
                      <p className="analise-ia-observacao">
                        O crescimento da fatia "sem enquadramento claro" em 2026 é o dado mais preocupante desta seção: quase 3 em cada 10 horas de falha do semestre não têm
                        descrição suficiente para classificação automática de causa. Isso reduz a capacidade de fiscalização exatamente no período em que a atenção deveria
                        estar mais concentrada na L7-Rubi.
                      </p>
                    </section>

                    {/* CONCLUSÃO */}
                    <section className="analise-ia-card analise-ia-fecho">
                      <span className="analise-ia-section-tag">Conclusão</span>
                      <h3>A rede se recuperou na média — mas o risco não desapareceu, só trocou de endereço</h3>
                      <p>
                        Olhando só o agregado, 2026 conta uma história positiva: a razão falha/manutenção do 1º semestre caiu de 1,52× (o pico da série, em 2025) para 0,33× —
                        a melhor marca dos três anos comparáveis, melhor até que 2024. A recuperação da <LineBadge nome="Linha 11-Coral" />, de longe a maior responsável pela
                        piora de 2025 (560,0 h de falha, 98,8% concentrada em quatro meses), para apenas 17,1 h em seis meses de 2026, é a evidência mais forte de que boa parte
                        da crise anterior era reversível com manutenção formal.
                      </p>
                      <p>
                        Mas a recuperação não é generalizada: a <LineBadge nome="Linha 7-Rubi" /> sob a TIC Trens acumulou em seis meses de 2026 mais falha do que em todo o ano
                        de 2025, com quatro dos seis meses aparecendo como desvio estatístico — um padrão crônico, não um evento isolado. Parte dessa falha, além disso, parece
                        ser obra de modernização lançada como ocorrência operacional em vez de manutenção programada, o que dificulta separar o problema real do problema de
                        registro. Some-se a isso um recuo geral na qualidade das descrições (28,1% da falha de 2026 ficou "sem enquadramento claro", o maior valor da série) e o
                        quadro é de uma rede que corrigiu seu maior problema de 2025 mas abriu um novo foco de risco, com menos visibilidade sobre a causa do que antes.
                      </p>
                      <p>
                        A recomendação da análise anterior segue válida e agora tem um caso concreto para testar: <strong>publicar a razão falha/manutenção como KPI regulatório
                        explícito, por linha e por operador</strong>, com limiar de alerta em 1,0×. Aplicado hoje, esse único número apontaria imediatamente a L7-Rubi (1,19×) e a
                        L12-Safira (1,94×) como as duas linhas que exigem acompanhamento prioritário no 2º semestre de 2026 — exatamente o tipo de sinal que a disponibilidade
                        agregada, sozinha, não teria mostrado a tempo.
                      </p>
                    </section>

                  </div>
                )}
                </div>{/* /analise-ia-panels-container */}

                <footer className="eventos-relevantes-footer analise-ia-footer">
                  <span>
                    Bases consideradas: {data2024.metadata.periodoLabel}, {data2025.metadata.periodoLabel} e {data2026H1.metadata.periodoLabel} (parcial)
                  </span>
                  <small>
                    Leitura descritiva dos registros sanitizados. Causas técnicas e responsabilidades dependem de apuração operacional,
                    relatórios de manutenção e documentação formal dos operadores e do poder concedente.
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
