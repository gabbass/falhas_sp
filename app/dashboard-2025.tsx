"use client";

import data from "../data/ocorrencias-summary.json";
import data2024Comparacao from "../data/ocorrencias-summary-2024.json";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Clock3,
  Filter,
  Gauge,
  ListChecks,
  Search,
  TrainFront,
  Trophy,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EventosRelevantesPopup from "./eventos-relevantes-popup";
import DocumentacaoPopup from "./documentacao-popup";
import AnaliseIaPopup from "./analise-ia-popup";

const data2025Comparacao = data;


type AnoDados = "2024" | "2025" | "comparativo";
const ANO_ATIVO: "2025" = "2025";

type EstadoOperacional =
  | "Disponível"
  | "Evento especial"
  | "Ocorrência operacional"
  | "Manutenção programada"
  | "Com falha ou parcial"
  | "Falha total / paralisação"
  | "Indefinido"
  | "Operação encerrada";
type Ordenacao = "tempo" | "quantidade" | "disponibilidade" | "paralisacao";
type RecorteDiasMapa = "todos" | "uteis";

type Evento = {
  id: number;
  dataHora: string;
  dataLabel: string;
  mes: string;
  linha: string;
  operador: string;
  status: string;
  estado: EstadoOperacional;
  classificacao: string;
  descricao: string;
  horas: number;
  cor: string;
  fechamentoAte?: string;
  fechamentoAteLabel?: string;
  horasAteProximoStatus?: number;
  efeitoCascata?: boolean;
  linhaCausaCascata?: string;
  cascataFechamentoEncontrado?: boolean;
  cascataDuracaoAjustada?: boolean;
  eventoCausaCascataId?: number;
  fechamentoCausaCascata?: string;
  fechamentoCausaCascataLabel?: string;
  meses: Record<string, number>;
};

type LinhaRanking = {
  nome: string;
  operador?: string;
  linhasOperadas?: number;
  horasTotaisOperacao: number;
  horasDisponivel: number;
  horasEventoEspecial: number;
  horasManutencaoProgramada: number;
  horasFalhaParcial: number;
  horasFalhaTotal: number;
  horasIndefinidas: number;
  horasFalha: number;
  qtdRegistros: number;
  qtdDisponivel: number;
  qtdEventoEspecial: number;
  qtdManutencaoProgramada: number;
  qtdFalhaParcial: number;
  qtdFalhaTotal: number;
  qtdIndefinidos: number;
  qtdFalhas: number;
  qtdEncerramentos: number;
  disponibilidadePct: number;
  falhaParcialPct: number;
  falhaTotalPct: number;
  mediaHorasAteNovaFalha: number;
};

type Problema = {
  categoria: string;
  qtd: number;
  horas: number;
};

type PalavraNuvem = {
  palavra: string;
  qtd: number;
  estadoMaisComum: EstadoOperacional;
  cor: string;
};

type EventoComTipo = Evento & {
  tipoFalha: string;
  descricaoBase: string;
  timestamp: number;
};

type EventoComTimestamp = Evento & {
  timestamp: number;
};

type Mensal = {
  mes: string;
  mesLabel: string;
  horasDisponivel: number;
  horasEventoEspecial: number;
  horasManutencaoProgramada: number;
  horasFalhaParcial: number;
  horasFalhaTotal: number;
  horasIndefinidas: number;
  qtdDisponivel: number;
  qtdEventoEspecial: number;
  qtdManutencaoProgramada: number;
  qtdFalhaParcial: number;
  qtdFalhaTotal: number;
  qtdIndefinidos: number;
  qtdEncerramentos: number;
  horasEsperadasPorLinha: number;
};

type Distribuicao = {
  categoria: EstadoOperacional;
  horas: number;
  quantidade: number;
  cor: string;
};

type Agregado = {
  kpis: {
    horasTotaisOperacao: number;
    horasDisponivel: number;
    horasEventoEspecial: number;
    horasManutencaoProgramada: number;
    horasFalhaParcial: number;
    horasFalhaTotal: number;
    horasIndefinidas: number;
    horasFalha: number;
    qtdDisponivel: number;
    qtdEventoEspecial: number;
    qtdManutencaoProgramada: number;
    qtdFalhaParcial: number;
    qtdFalhaTotal: number;
    qtdIndefinidos: number;
    qtdFalhas: number;
    qtdEncerramentos: number;
    disponibilidadePct: number;
      mediaHorasDisponivel: number;
    mediaHorasEventoEspecial: number;
    mediaHorasFalhaParcial: number;
    mediaHorasIndisponibilidade: number;
    mediaHorasAteNovaFalha: number;
    mediaHorasEntreManutencaoFalha: number;
    mediaHorasEntreManutencoes: number;
    falhaMaisComum: string;
    falhaMaisComumQtd: number;
    falhaMenosComum: string;
    falhaMenosComumQtd: number;
  };
  linhas: LinhaRanking[];
  operadores: LinhaRanking[];
  problemas: Problema[];
  palavras: PalavraNuvem[];
  mensal: Mensal[];
  disponibilidadeGeral: Distribuicao[];
  eventosFiltrados: Evento[];
  linhasSelecionadas: string[];
};

const CORES: Record<EstadoOperacional, string> = {
  Disponível: "#007A5E",
  "Evento especial": "#1C2C8C",
  "Ocorrência operacional": "#F57C00",
  "Manutenção programada": "#FFD200",
  "Com falha ou parcial": "#F57C00",
  "Falha total / paralisação": "#EE2E3B",
  "Indefinido": "#9E9E9E",
  "Operação encerrada": "#64748B",
};

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

const JANELA_OPERACIONAL_INICIO_MINUTOS = 4 * 60 + 30;
const JANELA_OPERACIONAL_FIM_MINUTOS = 24 * 60;
const JANELA_OPERACIONAL_LABEL = "04:30 às 00:00";
const HORAS_DIA = round3(
  (JANELA_OPERACIONAL_FIM_MINUTOS - JANELA_OPERACIONAL_INICIO_MINUTOS) / 60,
);
const HORAS_ANO_LINHA = round3(
  calcularDiasPeriodo(data.metadata.periodoInicio, data.metadata.periodoFim) *
    HORAS_DIA,
);
const EVENTOS = data.events as Evento[];
const LINHAS = data.options.linhas as string[];
const OPERADORES = data.options.operadores as string[];
const ESTADOS = data.options.estados as EstadoOperacional[];
const ESTADOS_FILTRO_GLOBAL = ESTADOS.filter(
  (estado) => estado !== "Disponível" && estado !== "Evento especial",
);
const ESTADOS_CLASSIFICADOS = ESTADOS.filter(
  (estado) => estado !== "Disponível" && estado !== "Evento especial",
);
const LINHAS_POR_PAGINA = 20;
const MESES = (data.series.mensal as Mensal[]).map((mes) => ({
  key: mes.mes,
  label: mes.mesLabel,
  horasEsperadasPorLinha: horasEsperadasMesPorLinha(mes.mes),
}));

const fmtHoras = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);

const fmtPctNumero = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);

const fmtPct = (n: number) =>
  `${fmtPctNumero(n)}%`;

const fmtInt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);

type NarrativaComparativa = "maior-melhor" | "menor-melhor" | "contextual";

type MetricaComparativa = {
  label: string;
  valor2025: number;
  valor2024: number;
  formato: "pct" | "horas" | "int";
  sentidoNarrativo: NarrativaComparativa;
  detalhe: string;
};

type ChaveMetricaLinhaComparativa =
  | "disponibilidadePct"
  | "horasManutencaoProgramada"
  | "horasFalhaParcial"
  | "horasFalhaTotal";

type MetricaLinhaComparativa = {
  label: string;
  chave: ChaveMetricaLinhaComparativa;
  formato: MetricaComparativa["formato"];
  sentidoNarrativo: NarrativaComparativa;
};

type LinhaComparativaAno = {
  nome: string;
  operador?: string;
  disponibilidadePct: number;
  horasManutencaoProgramada: number;
  horasFalhaParcial: number;
  horasFalhaTotal: number;
};

type LinhaComparativa = {
  nome: string;
  operador: string;
  linha2025?: LinhaComparativaAno;
  linha2024?: LinhaComparativaAno;
};

const COMPARATIVO_2025_2024: MetricaComparativa[] = [
  {
    label: "Disponibilidade",
    valor2025: data2025Comparacao.kpis.disponibilidadePct,
    valor2024: data2024Comparacao.kpis.disponibilidadePct,
    formato: "pct",
    sentidoNarrativo: "maior-melhor",
    detalhe: "Quando sobe, a leitura é favorável; quando cai, a disponibilidade piorou.",
  },
  {
    label: "Ocorrência operacional",
    valor2025: data2025Comparacao.kpis.horasFalhaParcial,
    valor2024: data2024Comparacao.kpis.horasFalhaParcial,
    formato: "horas",
    sentidoNarrativo: "menor-melhor",
    detalhe: "Horas de operação degradada por ocorrências operacionais. Não inclui manutenção programada nem paralisação total.",
  },
  {
    label: "Paralisação total",
    valor2025: data2025Comparacao.kpis.horasFalhaTotal,
    valor2024: data2024Comparacao.kpis.horasFalhaTotal,
    formato: "horas",
    sentidoNarrativo: "menor-melhor",
    detalhe: "Horas associadas à indisponibilidade ou paralisação total. Crescimento é negativo.",
  },
  {
    label: "Manutenção programada",
    valor2025: data2025Comparacao.kpis.horasManutencaoProgramada,
    valor2024: data2024Comparacao.kpis.horasManutencaoProgramada,
    formato: "horas",
    sentidoNarrativo: "menor-melhor",
    detalhe: "Mesmo planejada, reduz o tempo operacional disponível; por isso, aumento pede atenção.",
  },
  {
    label: "Eventos especiais",
    valor2025: data2025Comparacao.kpis.horasEventoEspecial,
    valor2024: data2024Comparacao.kpis.horasEventoEspecial,
    formato: "horas",
    sentidoNarrativo: "contextual",
    detalhe: "Horas de operação/serviço adicional. A cor fica neutra porque o sentido depende do contexto.",
  },
];

const METRICAS_COMPARATIVO_LINHA: MetricaLinhaComparativa[] = [
  {
    label: "Disponibilidade",
    chave: "disponibilidadePct",
    formato: "pct",
    sentidoNarrativo: "maior-melhor",
  },
  {
    label: "Manutenção programada",
    chave: "horasManutencaoProgramada",
    formato: "horas",
    sentidoNarrativo: "menor-melhor",
  },
  {
    label: "Ocorrência operacional",
    chave: "horasFalhaParcial",
    formato: "horas",
    sentidoNarrativo: "menor-melhor",
  },
  {
    label: "Paralisação total",
    chave: "horasFalhaTotal",
    formato: "horas",
    sentidoNarrativo: "menor-melhor",
  },
];

const LINHAS_COMPARATIVO_2025 = new Map(
  (data2025Comparacao.rankings.linhas as LinhaComparativaAno[]).map((linha) => [linha.nome, linha]),
);

const LINHAS_COMPARATIVO_2024 = new Map(
  (data2024Comparacao.rankings.linhas as LinhaComparativaAno[]).map((linha) => [linha.nome, linha]),
);

const COMPARATIVO_POR_LINHA: LinhaComparativa[] = Array.from(
  new Set([...LINHAS_COMPARATIVO_2025.keys(), ...LINHAS_COMPARATIVO_2024.keys()]),
)
  .map((nome) => {
    const linha2025 = LINHAS_COMPARATIVO_2025.get(nome);
    const linha2024 = LINHAS_COMPARATIVO_2024.get(nome);
    return {
      nome,
      operador: displayOperadorName(linha2025?.operador ?? linha2024?.operador ?? "Não informado"),
      linha2025,
      linha2024,
    };
  })
  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

const fmtComparativoValor = (valor: number, formato: MetricaComparativa["formato"]) => {
  if (formato === "pct") return fmtPct(valor);
  if (formato === "horas") return `${fmtHoras(valor)} h`;
  return fmtInt(valor);
};

const fmtComparativoVariacao = (
  valor2025: number,
  valor2024: number,
  formato: MetricaComparativa["formato"],
) => {
  const delta = valor2025 - valor2024;
  const prefixo = delta > 0 ? "+" : delta < 0 ? "−" : "";

  const percentual = valor2024 === 0
    ? null
    : (delta / valor2024) * 100;

  if (formato === "pct") {
    if (percentual === null) return `${prefixo}${fmtPctNumero(Math.abs(delta))}%`;
    return `${prefixo}${fmtPctNumero(Math.abs(percentual))}%`;
  }
  const deltaValor = formato === "horas"
    ? `${fmtHoras(Math.abs(delta))} h`
    : fmtInt(Math.abs(delta));

  if (percentual === null) return `${prefixo}${deltaValor}`;
  return `${prefixo}${deltaValor} · ${prefixo}${fmtPctNumero(Math.abs(percentual))}%`;
};

const fmtComparativoDelta = (metrica: MetricaComparativa) =>
  fmtComparativoVariacao(metrica.valor2025, metrica.valor2024, metrica.formato);

const classificarDeltaNarrativo = (
  valor2025: number,
  valor2024: number,
  sentidoNarrativo: NarrativaComparativa,
) => {
  const delta = valor2025 - valor2024;
  if (delta === 0 || sentidoNarrativo === "contextual") return "is-neutral";
  const melhorou = sentidoNarrativo === "maior-melhor" ? delta > 0 : delta < 0;
  return melhorou ? "is-favorable" : "is-unfavorable";
};

const getValorComparativoLinha = (
  linha: LinhaComparativaAno | undefined,
  chave: ChaveMetricaLinhaComparativa,
) => linha?.[chave] ?? 0;

function parseDataKey(value: string): Date {
  const [ano, mes, dia] = value.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1, 0, 0, 0, 0);
}

function diasInclusivos(inicio: Date, fim: Date): number {
  const inicioUtc = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const fimUtc = Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate());
  return Math.max(0, Math.floor((fimUtc - inicioUtc) / 86400000) + 1);
}

function calcularDiasPeriodo(inicioISO: string, fimISO: string): number {
  return diasInclusivos(parseDataKey(inicioISO), parseDataKey(fimISO));
}

function horasEsperadasMesPorLinha(mesKey: string): number {
  const [ano, mes] = mesKey.split("-").map(Number);
  const inicioMes = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const fimMes = new Date(ano, mes, 0, 0, 0, 0, 0);
  const inicioPeriodo = parseDataKey(data.metadata.periodoInicio);
  const fimPeriodo = parseDataKey(data.metadata.periodoFim);
  const inicio = inicioMes > inicioPeriodo ? inicioMes : inicioPeriodo;
  const fim = fimMes < fimPeriodo ? fimMes : fimPeriodo;
  return round3(diasInclusivos(inicio, fim) * HORAS_DIA);
}

function normalizarDataHora(value?: string): Date | null {
  if (!value) return null;
  const dataHora = new Date(value);
  if (Number.isNaN(dataHora.getTime())) return null;
  return dataHora;
}

function calcularSobreposicoesJanelaOperacional(
  inicio: Date,
  fim: Date,
): { mes: string; horas: number }[] {
  if (fim <= inicio) return [];

  const resultado: { mes: string; horas: number }[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 0, 0, 0, 0);
  const ultimoDia = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate(), 0, 0, 0, 0);

  while (cursor <= ultimoDia) {
    const janelaInicio = new Date(cursor);
    janelaInicio.setHours(0, JANELA_OPERACIONAL_INICIO_MINUTOS, 0, 0);

    const janelaFim = new Date(cursor);
    janelaFim.setDate(janelaFim.getDate() + 1);
    janelaFim.setHours(0, 0, 0, 0);

    const inicioEfetivo = inicio > janelaInicio ? inicio : janelaInicio;
    const fimEfetivo = fim < janelaFim ? fim : janelaFim;

    if (fimEfetivo > inicioEfetivo) {
      const mes = `${inicioEfetivo.getFullYear()}-${String(inicioEfetivo.getMonth() + 1).padStart(2, "0")}`;
      resultado.push({
        mes,
        horas: round3((fimEfetivo.getTime() - inicioEfetivo.getTime()) / 36e5),
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return resultado;
}

function calcularHorasOperacionaisEntreInstantes(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0;
  return round3(
    calcularSobreposicoesJanelaOperacional(inicio, fim).reduce(
      (total, item) => total + item.horas,
      0,
    ),
  );
}

function getHorasPorMesContabilizadas(evento: Evento): Record<string, number> {
  if (evento.estado === "Evento especial") return evento.meses ?? {};
  if (evento.estado === "Operação encerrada") return {};

  const inicio = normalizarDataHora(evento.dataHora);
  if (!inicio || evento.horas <= 0) return {};

  const fimPorFechamento = normalizarDataHora(evento.fechamentoAte);
  const fim =
    fimPorFechamento && fimPorFechamento > inicio
      ? fimPorFechamento
      : new Date(inicio.getTime() + evento.horas * 36e5);

  const porMes: Record<string, number> = {};
  calcularSobreposicoesJanelaOperacional(inicio, fim).forEach((item) => {
    porMes[item.mes] = round3((porMes[item.mes] ?? 0) + item.horas);
  });

  return porMes;
}

function getHorasContabilizadas(evento: Evento): number {
  if (evento.estado === "Evento especial") return round3(evento.horas);
  return round3(
    Object.values(getHorasPorMesContabilizadas(evento)).reduce(
      (total, horas) => total + horas,
      0,
    ),
  );
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function displayOperadorName(value: string): string {
  const normalized = normalizeText(value);
  if (normalized === "viamobilidade 8 e 9") return "ViaMobilidade";
  if (normalized === "cptm companhia paulista de trens metropolitanos") return "CPTM";
  if (normalized === "metro de sao paulo") return "Metrô";
  return value;
}

function horasRegistrosClassificadosTotal(row: LinhaRanking): number {
  return round3(
    row.horasManutencaoProgramada +
      row.horasFalhaParcial +
      row.horasFalhaTotal,
  );
}

function qtdRegistrosClassificadosTotal(row: LinhaRanking): number {
  return (
    row.qtdManutencaoProgramada +
    row.qtdFalhaParcial +
    row.qtdFalhaTotal
  );
}

function horasRegistrosClassificados(row: LinhaRanking): number {
  return horasRegistrosClassificadosTotal(row);
}

function qtdRegistrosClassificadosOperacionais(row: LinhaRanking): number {
  return qtdRegistrosClassificadosTotal(row);
}

function limparDadosIndisponiveisParaGrafico<T extends LinhaRanking>(
  row: T,
  incluirDados: boolean,
): T {
  const base = {
    ...row,
    // Rankings e mapas analíticos não exibem Disponível nem Evento especial.
    // Essas categorias ficam reservadas aos cartões, distribuições, evolução mensal
    // e tabela analítica por linha.
    horasDisponivel: 0,
    qtdDisponivel: 0,
    horasEventoEspecial: 0,
    qtdEventoEspecial: 0,
  };

  if (incluirDados) return base;
  return {
    ...base,
    horasIndefinidas: 0,
    qtdIndefinidos: 0,
  };
}

type RegraTipoFalha = {
  tipo: string;
  termos: string[];
};

const REGRAS_TIPO_FALHA: RegraTipoFalha[] = [
  {
    tipo: "Indefinido",
    termos: [
      "dados indisponiveis",
      "status indisponivel",
      "status indisponiveis",
    ],
  },
  { tipo: "Descarrilamento", termos: ["descarrilamento", "descarrilou"] },
  {
    tipo: "Alagamento / clima",
    termos: [
      "alagamento",
      "condicoes climaticas",
      "chuva",
      "chuvas",
      "ventos fortes",
      "queda de arvore",
      "arvore",
    ],
  },
  {
    tipo: "Rede aérea / energia",
    termos: [
      "rede aerea",
      "sistema de energia",
      "energia",
      "alimentacao eletrica",
      "subestacao",
    ],
  },
  {
    tipo: "Sinalização / controle",
    termos: [
      "sinalizacao",
      "controle",
      "cbtc",
      "atc",
      "sistema de sinalizacao",
    ],
  },
  {
    tipo: "Equipamento de via",
    termos: [
      "equipamento de via",
      "equipamentos de via",
      "via permanente",
      "aparelho de mudanca",
      "amv",
    ],
  },
  {
    tipo: "Material rodante / trem",
    termos: [
      "falha em trem",
      "problema com trem",
      "intercorrencia com um trem",
      "carro de um trem",
      "material rodante",
      "composicao",
    ],
  },
  {
    tipo: "Interferência externa / vandalismo",
    termos: [
      "terceiros",
      "vandalismo",
      "interferencia externa",
      "interferencia por terceiros",
    ],
  },
  {
    tipo: "Pessoa ou objeto na via",
    termos: [
      "pessoa na via",
      "objeto na via",
      "usuario na via",
      "presenca de pessoa",
      "presenca de objeto",
    ],
  },
  {
    tipo: "Manutenção / atividade programada",
    termos: [
      "manutencao programada",
      "servicos de manutencao",
      "servico de manutencao",
      "atividade programada",
      "obras programadas",
      "servicos programados",
      "obras de melhoria na via",
      "obra de melhoria na via",
      "obras de melhoria",
      "obras de modernizacao",
      "obra de modernizacao",
      "modernizacao na via",
      "melhoria na via",
    ],
  },
  {
    tipo: "Operação parcial / trecho interrompido",
    termos: [
      "operacao parcial",
      "circulacao interrompida",
      "interrompida",
      "interrompido",
      "sem circulacao",
      "temporariamente suspensa",
      "suspensa",
      "via unica",
      "paese",
    ],
  },
  {
    tipo: "Velocidade reduzida / maior parada",
    termos: [
      "velocidade reduzida",
      "maior tempo de parada",
      "tempo de parada",
      "maiores intervalos",
      "maior intervalo",
    ],
  },
  {
    tipo: "Problemas técnicos",
    termos: [
      "problemas tecnicos",
      "problema tecnico",
      "intercorrencia",
      "falha",
    ],
  },
];

function inferTipoFalha(evento: Evento): string {
  const descricaoBase = (evento.descricao || evento.status || "").trim();
  const texto = normalizeText(`${descricaoBase} ${evento.status ?? ""} ${evento.estado ?? ""}`);

  // Evento especial não é falha. Ele representa reforço, extensão ou diferenciação
  // da operação, mesmo quando a descrição não traz uma causa detalhada.
  if (evento.estado === "Evento especial") {
    if (
      texto.includes("24h") ||
      texto.includes("24 horas") ||
      texto.includes("madrugada") ||
      texto.includes("abertas") ||
      texto.includes("abertos") ||
      texto.includes("desembarque") ||
      texto.includes("transferencia") ||
      texto.includes("transferencias")
    ) {
      return "Evento especial / operação estendida";
    }

    if (
      texto.includes("trem extra") ||
      texto.includes("trens extras") ||
      texto.includes("servico extra") ||
      texto.includes("servicos extras") ||
      texto.includes("reforco operacional") ||
      texto.includes("reforco de operacao")
    ) {
      return "Evento especial / reforço de serviço";
    }

    if (
      texto.includes("festival") ||
      texto.includes("carnaval") ||
      texto.includes("the town") ||
      texto.includes("cena") ||
      texto.includes("neo quimica") ||
      texto.includes("arena") ||
      texto.includes("evento")
    ) {
      return "Evento especial / atendimento a evento";
    }

    return "Evento especial";
  }

  for (const regra of REGRAS_TIPO_FALHA) {
    if (regra.termos.some((termo) => texto.includes(termo))) return regra.tipo;
  }

  return evento.estado === "Falha total / paralisação"
    ? "Paralisação sem causa detalhada"
    : "Ocorrência sem causa detalhada";
}

function corProblema(categoria: string): string {
  const texto = normalizeText(categoria);
  if (texto.includes("dados") || texto.includes("status indispon")) {
    return CORES["Indefinido"];
  }
  if (texto.includes("evento especial") || texto.includes("operacao especial")) {
    return CORES["Evento especial"];
  }
  if (texto.includes("manutencao") || texto.includes("programada")) {
    return CORES["Manutenção programada"];
  }
  if (texto.includes("paralisacao") || texto.includes("interromp")) {
    return CORES["Falha total / paralisação"];
  }
  return CORES["Ocorrência operacional"];
}

function labelOrigemEvento(evento: Evento): string {
  return evento.efeitoCascata
    ? `Efeito cascata · origem: ${evento.linhaCausaCascata ?? "linha não identificada"}`
    : "Evento originário";
}

function getDescricaoBase(evento: Evento): string {
  const descricao = (evento.descricao || "").trim();
  return descricao || evento.status || "Sem descrição informada";
}

function isDadosStatusIndisponiveis(evento: Evento): boolean {
  const texto = normalizeText(
    `${evento.status ?? ""} ${evento.descricao ?? ""}`,
  );
  return (
    texto.includes("dados indisponiveis") ||
    texto.includes("status indisponivel") ||
    texto.includes("status indisponiveis")
  );
}



const STOPWORDS_NUVEM = new Set([
  "a", "ao", "aos", "as", "às", "ate", "até", "com", "como", "da", "das", "de", "do", "dos", "e", "em", "entre", "foi", "ha", "há", "na", "nas", "no", "nos", "o", "os", "ou", "para", "pela", "pelo", "por", "que", "sem", "sob", "sua", "suas", "seu", "seus", "uma", "um", "às", "sera", "será", "estao", "estão", "esta", "está", "esse", "essa", "este", "esta", "mais", "maior", "menor", "tempo", "linha", "linhas", "trem", "trens", "circulacao", "circulação", "operacao", "operação", "normal", "normalizacao", "normalização", "normalizada", "normalizado", "devido", "pedimos", "atente", "antes", "embarcar", "estacao", "estação", "estacoes", "estações", "usuarios", "usuários", "viagens", "sentido", "destino", "origem", "plataforma", "sistema", "dados", "indisponiveis", "indisponíveis", "status"
]);

function tokenizarDescricao(texto: string): string[] {
  return normalizeText(texto)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOPWORDS_NUVEM.has(token));
}

function buildWordCloud(eventos: Evento[]): PalavraNuvem[] {
  const palavras = new Map<string, { qtd: number; estados: Map<EstadoOperacional, number> }>();

  eventos
    .filter((evento) => entraEmRankingDeTipo(evento))
    .filter((evento) => evento.estado !== "Indefinido")
    .filter((evento) => temDescricaoUtil(evento))
    .forEach((evento) => {
      const tokensUnicos = new Set(tokenizarDescricao(getDescricaoBase(evento)));
      tokensUnicos.forEach((token) => {
        const atual = palavras.get(token) ?? { qtd: 0, estados: new Map<EstadoOperacional, number>() };
        atual.qtd += 1;
        atual.estados.set(evento.estado, (atual.estados.get(evento.estado) ?? 0) + 1);
        palavras.set(token, atual);
      });
    });

  return [...palavras.entries()]
    .map(([palavra, info]) => {
      const estadoMaisComum = [...info.estados.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Ocorrência operacional";
      return {
        palavra,
        qtd: info.qtd,
        estadoMaisComum,
        cor: CORES[estadoMaisComum],
      };
    })
    .filter((item) => item.qtd >= 2)
    .sort((a, b) => b.qtd - a.qtd || a.palavra.localeCompare(b.palavra, "pt-BR"))
    .slice(0, 70);
}

function calcMediaEntreFalhasPorLinha(eventos: Evento[]): Map<string, number> {
  const falhasPorLinha = new Map<string, Evento[]>();

  eventos.filter(isFalha).forEach((evento) => {
    falhasPorLinha.set(evento.linha, [
      ...(falhasPorLinha.get(evento.linha) ?? []),
      evento,
    ]);
  });

  const resultado = new Map<string, number>();
  falhasPorLinha.forEach((falhas, linha) => {
    const ordenadas = [...falhas].sort(
      (a, b) => (Date.parse(a.dataHora) || 0) - (Date.parse(b.dataHora) || 0),
    );
    const intervalos: number[] = [];
    for (let i = 1; i < ordenadas.length; i += 1) {
      const anterior = normalizarDataHora(ordenadas[i - 1].dataHora);
      const atual = normalizarDataHora(ordenadas[i].dataHora);
      if (!anterior || !atual) continue;
      const horas = calcularHorasOperacionaisEntreInstantes(anterior, atual);
      if (Number.isFinite(horas) && horas > 0) intervalos.push(horas);
    }

    resultado.set(
      linha,
      intervalos.length
        ? round3(intervalos.reduce((sum, item) => sum + item, 0) / intervalos.length)
        : 0,
    );
  });

  return resultado;
}

const DIAS_SEMANA_LONGOS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const CALENDARIO_ESPECIAL_2025: Record<string, { tipo: "feriado" | "emenda" | "ponto_facultativo"; nome: string }> = {
  "2024-01-01": { tipo: "feriado", nome: "Confraternização Universal" },
  "2024-01-25": { tipo: "feriado", nome: "Aniversário de São Paulo" },
  "2024-02-12": { tipo: "ponto_facultativo", nome: "Carnaval / ponto facultativo" },
  "2024-02-13": { tipo: "ponto_facultativo", nome: "Carnaval / ponto facultativo" },
  "2024-02-14": { tipo: "ponto_facultativo", nome: "Quarta-feira de Cinzas / ponto facultativo parcial" },
  "2024-03-29": { tipo: "feriado", nome: "Paixão de Cristo" },
  "2024-04-21": { tipo: "feriado", nome: "Tiradentes" },
  "2024-05-01": { tipo: "feriado", nome: "Dia do Trabalho" },
  "2024-05-30": { tipo: "feriado", nome: "Corpus Christi" },
  "2024-05-31": { tipo: "emenda", nome: "possível emenda do feriado de Corpus Christi" },
  "2024-09-07": { tipo: "feriado", nome: "Independência do Brasil" },
  "2024-10-12": { tipo: "feriado", nome: "Nossa Senhora Aparecida" },
  "2024-11-02": { tipo: "feriado", nome: "Finados" },
  "2024-11-15": { tipo: "feriado", nome: "Proclamação da República" },
  "2024-11-20": { tipo: "feriado", nome: "Consciência Negra" },
  "2024-12-25": { tipo: "feriado", nome: "Natal" },
  "2025-01-01": { tipo: "feriado", nome: "Confraternização Universal" },
  "2025-01-25": { tipo: "feriado", nome: "Aniversário de São Paulo" },
  "2025-03-03": { tipo: "ponto_facultativo", nome: "Carnaval / ponto facultativo" },
  "2025-03-04": { tipo: "ponto_facultativo", nome: "Carnaval / ponto facultativo" },
  "2025-03-05": { tipo: "ponto_facultativo", nome: "Quarta-feira de Cinzas / ponto facultativo parcial" },
  "2025-04-18": { tipo: "feriado", nome: "Paixão de Cristo" },
  "2025-04-21": { tipo: "feriado", nome: "Tiradentes" },
  "2025-05-01": { tipo: "feriado", nome: "Dia do Trabalho" },
  "2025-05-02": { tipo: "emenda", nome: "possível emenda do feriado do Dia do Trabalho" },
  "2025-06-19": { tipo: "feriado", nome: "Corpus Christi" },
  "2025-06-20": { tipo: "emenda", nome: "possível emenda do feriado de Corpus Christi" },
  "2025-09-07": { tipo: "feriado", nome: "Independência do Brasil" },
  "2025-10-12": { tipo: "feriado", nome: "Nossa Senhora Aparecida" },
  "2025-11-02": { tipo: "feriado", nome: "Finados" },
  "2025-11-15": { tipo: "feriado", nome: "Proclamação da República" },
  "2025-11-20": { tipo: "feriado", nome: "Consciência Negra" },
  "2025-11-21": { tipo: "emenda", nome: "possível emenda do feriado de Consciência Negra" },
  "2025-12-25": { tipo: "feriado", nome: "Natal" },
  "2025-12-26": { tipo: "emenda", nome: "possível emenda do feriado de Natal" },
};

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getContextoCalendario(dataHora: string): { diaSemana: string; calendarioLabel: string; calendarioDetalhe: string } {
  const date = new Date(dataHora);
  const diaSemana = DIAS_SEMANA_LONGOS[date.getDay()] ?? "dia não identificado";
  const item = CALENDARIO_ESPECIAL_2025[getDateKey(date)];

  if (!item) {
    const fimDeSemana = date.getDay() === 0 || date.getDay() === 6;
    return {
      diaSemana,
      calendarioLabel: fimDeSemana ? "Fim de semana" : "Dia comum",
      calendarioDetalhe: fimDeSemana
        ? "sem faixa de pico declarada no painel"
        : "sem feriado ou emenda marcada na base do painel",
    };
  }

  const calendarioLabel =
    item.tipo === "feriado"
      ? "Feriado"
      : item.tipo === "emenda"
        ? "Emenda de feriado"
        : "Ponto facultativo";

  return {
    diaSemana,
    calendarioLabel,
    calendarioDetalhe: item.nome,
  };
}

const OPERACAO_INICIO_MIN = 4 * 60;
const OPERACAO_FIM_MIN = 24 * 60;
const OPERACAO_DURACAO_MIN = OPERACAO_FIM_MIN - OPERACAO_INICIO_MIN;

const FAIXAS_PICO = [
  { id: "pico_manha", label: "Pico da manhã", inicio: "06:00", fim: "09:00" },
  { id: "pico_estudantil_meio_dia", label: "Pico estudantil / almoço", inicio: "11:00", fim: "14:00" },
  { id: "pico_tarde_noite", label: "Pico tarde/noite", inicio: "16:30", fim: "20:00" },
  { id: "pico_estudantil_noturno", label: "Pico estudantil noturno", inicio: "22:00", fim: "23:30" },
];

const MARCADORES_HORARIO = [
  { label: "00h", minutos: 24 * 60 },
  { label: "23h30", minutos: 23 * 60 + 30 },
  { label: "22h", minutos: 22 * 60 },
  { label: "20h", minutos: 20 * 60 },
  { label: "16h30", minutos: 16 * 60 + 30 },
  { label: "14h", minutos: 14 * 60 },
  { label: "11h", minutos: 11 * 60 },
  { label: "09h", minutos: 9 * 60 },
  { label: "06h", minutos: 6 * 60 },
  { label: "04h", minutos: 4 * 60 },
];

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

function topHorarioPct(minutos: number): number {
  return 100 - ((minutos - OPERACAO_INICIO_MIN) / OPERACAO_DURACAO_MIN) * 100;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatDiaCurto(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
}

function isDiaUtil(dataHora: string): boolean {
  const dataEvento = new Date(dataHora);
  const diaSemana = dataEvento.getDay();
  return diaSemana >= 1 && diaSemana <= 5;
}

function filtraEventoPorRecorteDias(evento: Evento, recorte: RecorteDiasMapa): boolean {
  if (recorte === "uteis") return isDiaUtil(evento.dataHora);
  return true;
}

function TimeScatterChart({
  eventos,
  incluirDadosIndisponiveis,
  recorteDias,
}: {
  eventos: Evento[];
  incluirDadosIndisponiveis: boolean;
  recorteDias: RecorteDiasMapa;
}) {
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState<number | null>(null);
  const inicioPeriodo = Date.parse(`${data.metadata.periodoInicio}T00:00:00`);
  const fimPeriodo = Date.parse(
    data.metadata.periodoFimDataHora ?? `${data.metadata.periodoFim}T23:59:59`,
  );
  const duracaoPeriodo = Math.max(fimPeriodo - inicioPeriodo, 1);

  const pontos = eventos
    .filter((evento) => entraEmRankingDeTipo(evento))
    .filter((evento) => filtraEventoPorRecorteDias(evento, recorteDias))
    .filter(
      (evento) =>
        incluirDadosIndisponiveis ||
        evento.estado !== "Indefinido",
    )
    .map((evento) => {
      const timestamp = Date.parse(evento.dataHora);
      if (!Number.isFinite(timestamp)) return null;

      const dataEvento = new Date(evento.dataHora);
      const minutos = dataEvento.getHours() * 60 + dataEvento.getMinutes();

      if (minutos < OPERACAO_INICIO_MIN || minutos > OPERACAO_FIM_MIN) {
        return null;
      }

      const xPct = clampPct(((timestamp - inicioPeriodo) / duracaoPeriodo) * 100);
      const yPct = clampPct(topHorarioPct(minutos));
      const tamanho = Math.max(7, Math.min(20, 7 + Math.sqrt(Math.max(getHorasContabilizadas(evento), 0.1)) * 3));

      return {
        ...evento,
        xPct,
        yPct,
        tamanho,
        cor: CORES[evento.estado] ?? evento.cor,
      };
    })
    .filter(Boolean) as Array<Evento & { xPct: number; yPct: number; tamanho: number }>;

  const marcadoresMes = MESES.map((mes) => {
    const timestamp = Date.parse(`${mes.key}-01T00:00:00`);
    return {
      label: mes.label,
      xPct: clampPct(((timestamp - inicioPeriodo) / duracaoPeriodo) * 100),
    };
  });

  const eventoSelecionado = pontos.find((evento) => evento.id === eventoSelecionadoId) ?? null;
  const contextoEventoSelecionado = eventoSelecionado
    ? getContextoCalendario(eventoSelecionado.dataHora)
    : null;
  const eventosNoMesmoHorario = eventoSelecionado
    ? pontos
        .filter((evento) => evento.dataHora === eventoSelecionado.dataHora)
        .sort((a, b) => {
          const linha = a.linha.localeCompare(b.linha, "pt-BR");
          if (linha !== 0) return linha;
          return b.horas - a.horas;
        })
    : [];

  return (
    <div className="time-scatter-wrap">
      <div className="time-scatter-y-axis" aria-hidden="true">
        {MARCADORES_HORARIO.map((item) => (
          <span key={item.label} style={{ top: `${topHorarioPct(item.minutos)}%` }}>
            {item.label}
          </span>
        ))}
      </div>
      <div className="time-scatter-plot">
        {FAIXAS_PICO.map((faixa) => {
          const inicio = horaParaMinutos(faixa.inicio);
          const fim = horaParaMinutos(faixa.fim);
          const top = topHorarioPct(fim);
          const height = ((fim - inicio) / OPERACAO_DURACAO_MIN) * 100;
          return (
            <div
              key={faixa.id}
              className={`peak-band${recorteDias === "uteis" ? " peak-band-strong" : ""}`}
              style={{ top: `${top}%`, height: `${height}%` }}
            >
              <span>{faixa.label}</span>
            </div>
          );
        })}

        {MARCADORES_HORARIO.map((item) => (
          <div
            key={`grid-${item.label}`}
            className="time-grid-line"
            style={{ top: `${topHorarioPct(item.minutos)}%` }}
          />
        ))}

        {marcadoresMes.map((item) => (
          <div
            key={`mes-${item.label}`}
            className="time-month-line"
            style={{ left: `${item.xPct}%` }}
          >
            <span>{item.label}</span>
          </div>
        ))}

        {pontos.map((evento) => (
          <button
            key={`scatter-${evento.id}`}
            type="button"
            className={`scatter-point${eventoSelecionadoId === evento.id ? " scatter-point-selected" : ""}`}
            style={{
              left: `${evento.xPct}%`,
              top: `${evento.yPct}%`,
              width: evento.tamanho,
              height: evento.tamanho,
              background: evento.cor,
            }}
            aria-label={`${evento.dataLabel}, ${evento.linha}, ${evento.estado}, ${fmtHoras(getHorasContabilizadas(evento))} horas`}
            title={`${evento.dataLabel} • ${evento.linha} • ${displayOperadorName(evento.operador)} • ${evento.estado} • ${labelOrigemEvento(evento)} • ${fmtHoras(getHorasContabilizadas(evento))} h • ${getDescricaoBase(evento)}`}
            onClick={() => setEventoSelecionadoId(evento.id)}
          />
        ))}
      </div>
      <div className="time-scatter-footer">
        <span>{formatDiaCurto(inicioPeriodo)}</span>
        <span>{formatDiaCurto(fimPeriodo)}</span>
      </div>

      {eventoSelecionado && (
        <div className="scatter-selection-card">
          <div className="scatter-selection-header">
            <div>
              <strong>Evento selecionado</strong>
              <span>{eventoSelecionado.dataLabel} · {contextoEventoSelecionado?.diaSemana} · horário de início do evento</span>
              {contextoEventoSelecionado && (
                <em className="scatter-calendar-badge">
                  {contextoEventoSelecionado.calendarioLabel}: {contextoEventoSelecionado.calendarioDetalhe}
                </em>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEventoSelecionadoId(null)}
              aria-label="Fechar detalhes do evento"
            >
              Fechar
            </button>
          </div>

          <p className="scatter-selection-note">
            A duração usa uma regra geral: horários explícitos na descrição prevalecem; depois vale o próximo retorno operacional da mesma linha no mesmo dia. Quando a descrição identifica efeito cascata causado por outra linha, o encerramento usa o retorno operacional da linha causadora sempre que ele estiver disponível. Em evento especial, as horas representam acréscimo estimado de operação/atendimento fora da jornada padrão, não falha. A indicação de feriado/emenda é referência de calendário para leitura do padrão horário.
          </p>

          <div className="scatter-selection-list">
            {eventosNoMesmoHorario.map((evento) => (
              <div
                key={`selected-${evento.id}`}
                className={`scatter-selection-item${evento.id === eventoSelecionado.id ? " is-selected" : ""}`}
              >
                <span className="legend-dot" style={{ background: evento.cor }} />
                <div className="scatter-selection-main">
                  <strong>{evento.linha}</strong>
                  <span>{displayOperadorName(evento.operador)} · {evento.estado}</span>
                  {evento.efeitoCascata ? (
                    <em className="cascade-badge">{labelOrigemEvento(evento)}</em>
                  ) : null}
                  <small>{getDescricaoBase(evento)}</small>
                </div>
                <div className="scatter-selection-duration">
                  <strong>{fmtHoras(getHorasContabilizadas(evento))} h</strong>
                  <span>duração</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function temDescricaoUtil(evento: Evento): boolean {
  const descricao = (evento.descricao || "").trim();
  const descricaoNormalizada = normalizeText(descricao);
  if (!descricaoNormalizada) return false;
  if (descricaoNormalizada === "operacao normal") return false;
  if (descricaoNormalizada === "operacao encerrada") return false;
  return true;
}

const lineToOperator = new Map<string, string>(
  (data.rankings.linhas as LinhaRanking[]).map((linha) => [
    linha.nome,
    linha.operador ?? "Não informado",
  ]),
);

function createEmptyRow(
  nome: string,
  operador?: string,
  linhasOperadas = 1,
): LinhaRanking {
  return {
    nome,
    operador,
    linhasOperadas,
    horasTotaisOperacao: linhasOperadas * HORAS_ANO_LINHA,
    horasDisponivel: 0,
    horasEventoEspecial: 0,
    horasManutencaoProgramada: 0,
    horasFalhaParcial: 0,
    horasFalhaTotal: 0,
    horasIndefinidas: 0,
    horasFalha: 0,
    qtdRegistros: 0,
    qtdDisponivel: 0,
    qtdEventoEspecial: 0,
    qtdManutencaoProgramada: 0,
    qtdFalhaParcial: 0,
    qtdFalhaTotal: 0,
    qtdIndefinidos: 0,
    qtdFalhas: 0,
    qtdEncerramentos: 0,
    disponibilidadePct: 0,
    falhaParcialPct: 0,
    falhaTotalPct: 0,
    mediaHorasAteNovaFalha: 0,
  };
}

function isFalha(evento: Evento): boolean {
  return (
    evento.estado === "Ocorrência operacional" ||
    evento.estado === "Com falha ou parcial" ||
    evento.estado === "Falha total / paralisação"
  );
}

function entraEmRankingDeTipo(evento: Evento): boolean {
  // Tipos de registro operacional não incluem evento especial nem dados indisponíveis.
  // Evento especial é serviço ofertado; dados indisponíveis medem qualidade da fonte.
  return (
    evento.estado === "Manutenção programada" ||
    evento.estado === "Ocorrência operacional" ||
    evento.estado === "Com falha ou parcial" ||
    evento.estado === "Falha total / paralisação"
  );
}

function entraEmFalhaComum(evento: Evento): boolean {
  // Para os cartões de tipo mais/menos comum, consideramos apenas eventos que
  // representem ocorrência operacional, paralisação total ou manutenção programada. Evento especial
  // é serviço ofertado, e dados indisponíveis são qualidade da fonte, não falha.
  return (
    (isFalha(evento) || evento.estado === "Manutenção programada") &&
    !isDadosStatusIndisponiveis(evento) &&
    temDescricaoUtil(evento)
  );
}

function applyEventToRow(row: LinhaRanking, evento: Evento) {
  row.qtdRegistros += 1;
  const horas = getHorasContabilizadas(evento);

  if (evento.estado === "Disponível") {
    row.qtdDisponivel += 1;
    row.horasDisponivel += horas;
    return;
  }

  if (evento.estado === "Evento especial") {
    row.qtdEventoEspecial += 1;
    row.horasEventoEspecial += horas;
    return;
  }

  if (evento.estado === "Manutenção programada") {
    row.qtdManutencaoProgramada += 1;
    row.horasManutencaoProgramada += horas;
    return;
  }

  if (evento.estado === "Ocorrência operacional" || evento.estado === "Com falha ou parcial") {
    row.qtdFalhaParcial += 1;
    row.horasFalhaParcial += horas;
    return;
  }

  if (evento.estado === "Falha total / paralisação") {
    row.qtdFalhaTotal += 1;
    row.horasFalhaTotal += horas;
    return;
  }

  if (evento.estado === "Indefinido") {
    row.qtdIndefinidos += 1;
    row.horasIndefinidas += horas;
    return;
  }

  row.qtdEncerramentos += 1;
}

function finalizeRow(
  row: LinhaRanking,
  statusSelecionado: string,
): LinhaRanking {
  const total = Math.max(row.horasTotaisOperacao, 1);

  if (statusSelecionado === "todos") {
    row.horasDisponivel = Math.max(
      row.horasTotaisOperacao -
        row.horasManutencaoProgramada -
        row.horasFalhaParcial -
        row.horasFalhaTotal -
        row.horasIndefinidas,
      0,
    );
  }

  if (statusSelecionado === "Disponível") {
    row.horasDisponivel = row.horasTotaisOperacao;
    row.horasEventoEspecial = 0;
    row.horasManutencaoProgramada = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasIndefinidas = 0;
  }

  if (statusSelecionado === "Evento especial") {
    row.horasDisponivel = 0;
    row.horasManutencaoProgramada = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasIndefinidas = 0;
  }

  if (statusSelecionado === "Manutenção programada") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasIndefinidas = 0;
  }

  if (statusSelecionado === "Ocorrência operacional" || statusSelecionado === "Com falha ou parcial") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasFalhaTotal = 0;
    row.horasIndefinidas = 0;
  }

  if (statusSelecionado === "Falha total / paralisação") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasManutencaoProgramada = 0;
    row.horasManutencaoProgramada = 0;
    row.horasFalhaParcial = 0;
    row.horasIndefinidas = 0;
  }

  if (statusSelecionado === "Indefinido") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasManutencaoProgramada = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
  }

  if (statusSelecionado === "Operação encerrada") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasManutencaoProgramada = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasIndefinidas = 0;
  }

  row.horasDisponivel = round3(row.horasDisponivel);
  row.horasEventoEspecial = round3(row.horasEventoEspecial);
  row.horasManutencaoProgramada = round3(row.horasManutencaoProgramada);
  row.horasFalhaParcial = round3(row.horasFalhaParcial);
  row.horasFalhaTotal = round3(row.horasFalhaTotal);
  row.horasIndefinidas = round3(row.horasIndefinidas);
  row.horasFalha = round3(row.horasFalhaParcial + row.horasFalhaTotal);
  row.qtdFalhas = qtdRegistrosClassificadosTotal(row);
  row.disponibilidadePct = round3(
    (row.horasDisponivel / total) * 100,
  );
  row.falhaParcialPct = round3((row.horasFalhaParcial / total) * 100);
  row.falhaTotalPct = round3((row.horasFalhaTotal / total) * 100);

  return row;
}

function calcMediaEntreFalhas(eventos: Evento[]): number {
  const falhasPorLinha = new Map<string, Evento[]>();

  eventos.filter(isFalha).forEach((evento) => {
    falhasPorLinha.set(evento.linha, [
      ...(falhasPorLinha.get(evento.linha) ?? []),
      evento,
    ]);
  });

  const intervalos: number[] = [];
  falhasPorLinha.forEach((falhas) => {
    const ordenadas = [...falhas].sort(
      (a, b) => (Date.parse(a.dataHora) || 0) - (Date.parse(b.dataHora) || 0),
    );
    for (let i = 1; i < ordenadas.length; i += 1) {
      const anterior = normalizarDataHora(ordenadas[i - 1].dataHora);
      const atual = normalizarDataHora(ordenadas[i].dataHora);
      if (!anterior || !atual) continue;
      const horas = calcularHorasOperacionaisEntreInstantes(anterior, atual);
      if (Number.isFinite(horas) && horas > 0) intervalos.push(horas);
    }
  });

  if (!intervalos.length) return 0;
  return round3(
    intervalos.reduce((sum, item) => sum + item, 0) / intervalos.length,
  );
}

function tipoIntervaloOperacional(evento: Evento): "falha" | "manutencao" | null {
  if (isFalha(evento)) return "falha";
  if (evento.estado === "Manutenção programada") return "manutencao";
  return null;
}

function calcMediaEntreManutencoes(eventos: Evento[]): number {
  const manutencoesPorLinha = new Map<string, Evento[]>();

  eventos
    .filter((evento) => evento.estado === "Manutenção programada")
    .forEach((evento) => {
      manutencoesPorLinha.set(evento.linha, [
        ...(manutencoesPorLinha.get(evento.linha) ?? []),
        evento,
      ]);
    });

  const intervalos: number[] = [];
  manutencoesPorLinha.forEach((manutencoes) => {
    const ordenadas = [...manutencoes].sort(
      (a, b) => (Date.parse(a.dataHora) || 0) - (Date.parse(b.dataHora) || 0),
    );

    for (let i = 1; i < ordenadas.length; i += 1) {
      const anterior = normalizarDataHora(ordenadas[i - 1].dataHora);
      const atual = normalizarDataHora(ordenadas[i].dataHora);
      if (!anterior || !atual) continue;
      const horas = calcularHorasOperacionaisEntreInstantes(anterior, atual);
      if (Number.isFinite(horas) && horas > 0) intervalos.push(horas);
    }
  });

  if (!intervalos.length) return 0;
  return round3(
    intervalos.reduce((sum, item) => sum + item, 0) / intervalos.length,
  );
}

function calcMediaEntreManutencaoEFalha(eventos: Evento[]): number {
  const eventosPorLinha = new Map<string, Evento[]>();

  eventos
    .filter((evento) => tipoIntervaloOperacional(evento) !== null)
    .forEach((evento) => {
      eventosPorLinha.set(evento.linha, [
        ...(eventosPorLinha.get(evento.linha) ?? []),
        evento,
      ]);
    });

  const intervalos: number[] = [];
  eventosPorLinha.forEach((eventosDaLinha) => {
    const ordenados = [...eventosDaLinha].sort(
      (a, b) => (Date.parse(a.dataHora) || 0) - (Date.parse(b.dataHora) || 0),
    );

    for (let i = 1; i < ordenados.length; i += 1) {
      const anterior = ordenados[i - 1];
      const atual = ordenados[i];
      const tipoAnterior = tipoIntervaloOperacional(anterior);
      const tipoAtual = tipoIntervaloOperacional(atual);

      if (!tipoAnterior || !tipoAtual || tipoAnterior === tipoAtual) continue;

      const horaAnterior = normalizarDataHora(anterior.dataHora);
      const horaAtual = normalizarDataHora(atual.dataHora);
      if (!horaAnterior || !horaAtual) continue;
      const horas = calcularHorasOperacionaisEntreInstantes(horaAnterior, horaAtual);
      if (Number.isFinite(horas) && horas > 0) intervalos.push(horas);
    }
  });

  if (!intervalos.length) return 0;
  return round3(
    intervalos.reduce((sum, item) => sum + item, 0) / intervalos.length,
  );
}

function aggregateData(filtros: {
  linha: string;
  operador: string;
  status: string;
}): Agregado {
  const linhasPermitidas = LINHAS.filter((linha) => {
    const operadorLinha = lineToOperator.get(linha) ?? "Não informado";
    return (
      (filtros.linha === "todas" || filtros.linha === linha) &&
      (filtros.operador === "todos" || filtros.operador === operadorLinha)
    );
  });

  const linhasSet = new Set(linhasPermitidas);
  const eventosFiltrados = EVENTOS.filter((evento) => {
    return (
      linhasSet.has(evento.linha) &&
      (filtros.status === "todos" || filtros.status === evento.estado)
    );
  });

  const linhasMap = new Map<string, LinhaRanking>();
  linhasPermitidas.forEach((linha) => {
    linhasMap.set(
      linha,
      createEmptyRow(linha, lineToOperator.get(linha) ?? "Não informado"),
    );
  });

  const operadoresMap = new Map<string, LinhaRanking>();
  const linhasPorOperador = new Map<string, string[]>();
  linhasPermitidas.forEach((linha) => {
    const operadorLinha = lineToOperator.get(linha) ?? "Não informado";
    linhasPorOperador.set(operadorLinha, [
      ...(linhasPorOperador.get(operadorLinha) ?? []),
      linha,
    ]);
  });
  linhasPorOperador.forEach((linhas, operador) => {
    operadoresMap.set(
      operador,
      createEmptyRow(operador, undefined, linhas.length),
    );
  });

  const problemasMap = new Map<string, Problema>();
  const falhasComunsMap = new Map<string, Problema>();
  const mensalMap = new Map<string, Mensal>();
  MESES.forEach((mes) => {
    mensalMap.set(mes.key, {
      mes: mes.key,
      mesLabel: mes.label,
      horasEsperadasPorLinha: mes.horasEsperadasPorLinha,
      horasDisponivel: 0,
      horasEventoEspecial: 0,
      horasManutencaoProgramada: 0,
      horasFalhaParcial: 0,
      horasFalhaTotal: 0,
      horasIndefinidas: 0,
      qtdDisponivel: 0,
      qtdEventoEspecial: 0,
      qtdManutencaoProgramada: 0,
      qtdFalhaParcial: 0,
      qtdFalhaTotal: 0,
      qtdIndefinidos: 0,
      qtdEncerramentos: 0,
    });
  });

  eventosFiltrados.forEach((evento) => {
    const linha = linhasMap.get(evento.linha);
    if (linha) applyEventToRow(linha, evento);

    const operador = operadoresMap.get(
      lineToOperator.get(evento.linha) ?? evento.operador,
    );
    if (operador) applyEventToRow(operador, evento);

    if (entraEmRankingDeTipo(evento) && temDescricaoUtil(evento)) {
      const categoria = inferTipoFalha(evento);
      const problema = problemasMap.get(categoria) ?? {
        categoria,
        qtd: 0,
        horas: 0,
      };
      problema.qtd += 1;
      problema.horas += getHorasContabilizadas(evento);
      problemasMap.set(categoria, problema);

      if (entraEmFalhaComum(evento)) {
        const falhaComum = falhasComunsMap.get(categoria) ?? {
          categoria,
          qtd: 0,
          horas: 0,
        };
        falhaComum.qtd += 1;
        falhaComum.horas += getHorasContabilizadas(evento);
        falhasComunsMap.set(categoria, falhaComum);
      }
    }

    Object.entries(getHorasPorMesContabilizadas(evento)).forEach(([mes, horas]) => {
      const row = mensalMap.get(mes);
      if (!row) return;
      if (evento.estado === "Disponível") row.horasDisponivel += horas;
      if (evento.estado === "Evento especial") row.horasEventoEspecial += horas;
      if (evento.estado === "Manutenção programada") row.horasManutencaoProgramada += horas;
      if (evento.estado === "Ocorrência operacional" || evento.estado === "Com falha ou parcial")
        row.horasFalhaParcial += horas;
      if (evento.estado === "Falha total / paralisação")
        row.horasFalhaTotal += horas;
      if (evento.estado === "Indefinido")
        row.horasIndefinidas += horas;
    });

    const rowMes = mensalMap.get(evento.mes);
    if (rowMes) {
      if (evento.estado === "Disponível") rowMes.qtdDisponivel += 1;
      if (evento.estado === "Evento especial") rowMes.qtdEventoEspecial += 1;
      if (evento.estado === "Manutenção programada") rowMes.qtdManutencaoProgramada += 1;
      if (evento.estado === "Ocorrência operacional" || evento.estado === "Com falha ou parcial") rowMes.qtdFalhaParcial += 1;
      if (evento.estado === "Falha total / paralisação")
        rowMes.qtdFalhaTotal += 1;
      if (evento.estado === "Indefinido")
        rowMes.qtdIndefinidos += 1;
      if (evento.estado === "Operação encerrada") rowMes.qtdEncerramentos += 1;
    }
  });

  const mediaEntreFalhasPorLinha = calcMediaEntreFalhasPorLinha(eventosFiltrados);
  const linhas = [...linhasMap.values()].map((row) => {
    row.mediaHorasAteNovaFalha = mediaEntreFalhasPorLinha.get(row.nome) ?? 0;
    return finalizeRow(row, filtros.status);
  });
  const operadores = [...operadoresMap.values()].map((row) =>
    finalizeRow(row, filtros.status),
  );

  const horasTotaisOperacao = linhasPermitidas.length * HORAS_ANO_LINHA;
  const horasEventoEspecial = round3(
    linhas.reduce((total, linha) => total + linha.horasEventoEspecial, 0),
  );
  const horasManutencaoProgramada = round3(
    linhas.reduce((total, linha) => total + linha.horasManutencaoProgramada, 0),
  );
  const horasFalhaParcial = round3(
    linhas.reduce((total, linha) => total + linha.horasFalhaParcial, 0),
  );
  const horasFalhaTotal = round3(
    linhas.reduce((total, linha) => total + linha.horasFalhaTotal, 0),
  );
  const horasIndefinidas = round3(
    linhas.reduce((total, linha) => total + linha.horasIndefinidas, 0),
  );
  let horasDisponivel = round3(
    linhas.reduce((total, linha) => total + linha.horasDisponivel, 0),
  );

  if (filtros.status === "todos") {
    horasDisponivel = round3(
      Math.max(
        horasTotaisOperacao -
          horasManutencaoProgramada -
          horasFalhaParcial -
          horasFalhaTotal -
          horasIndefinidas,
        0,
      ),
    );
  }

  if (filtros.status === "Disponível") horasDisponivel = horasTotaisOperacao;
  if (filtros.status !== "todos" && filtros.status !== "Disponível")
    horasDisponivel = linhas.reduce(
      (total, linha) => total + linha.horasDisponivel,
      0,
    );

  const qtdDisponivel = eventosFiltrados.filter(
    (evento) => evento.estado === "Disponível",
  ).length;
  const qtdEventoEspecial = eventosFiltrados.filter(
    (evento) => evento.estado === "Evento especial",
  ).length;
  const qtdManutencaoProgramada = eventosFiltrados.filter(
    (evento) => evento.estado === "Manutenção programada",
  ).length;
  const qtdFalhaParcial = eventosFiltrados.filter(
    (evento) => evento.estado === "Ocorrência operacional" || evento.estado === "Com falha ou parcial",
  ).length;
  const qtdFalhaTotal = eventosFiltrados.filter(
    (evento) => evento.estado === "Falha total / paralisação",
  ).length;
  const qtdIndefinidos = eventosFiltrados.filter(
    (evento) => evento.estado === "Indefinido",
  ).length;
  const qtdEncerramentos = eventosFiltrados.filter(
    (evento) => evento.estado === "Operação encerrada",
  ).length;
  const horasFalha = round3(horasFalhaParcial + horasFalhaTotal);

  const mensal = [...mensalMap.values()].map((row) => {
    const mesInfo = MESES.find((mes) => mes.key === row.mes);
    const esperadoMes =
      (mesInfo?.horasEsperadasPorLinha ?? HORAS_ANO_LINHA) *
      linhasPermitidas.length;

    if (filtros.status === "todos") {
      row.horasDisponivel = Math.max(
        esperadoMes -
          row.horasManutencaoProgramada -
          row.horasFalhaParcial -
          row.horasFalhaTotal -
          row.horasIndefinidas,
        0,
      );
    }

    if (filtros.status === "Disponível") {
      row.horasDisponivel = esperadoMes;
      row.horasEventoEspecial = 0;
      row.horasManutencaoProgramada = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasIndefinidas = 0;
    }

    if (filtros.status === "Evento especial") {
      row.horasDisponivel = 0;
      row.horasManutencaoProgramada = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasIndefinidas = 0;
    }

    if (filtros.status === "Manutenção programada") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasIndefinidas = 0;
    }

    if (filtros.status === "Ocorrência operacional" || filtros.status === "Com falha ou parcial") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasFalhaTotal = 0;
      row.horasIndefinidas = 0;
    }

    if (filtros.status === "Falha total / paralisação") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasManutencaoProgramada = 0;
      row.horasFalhaParcial = 0;
      row.horasIndefinidas = 0;
    }

    if (filtros.status === "Indefinido") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasManutencaoProgramada = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
    }

    if (filtros.status === "Operação encerrada") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasManutencaoProgramada = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasIndefinidas = 0;
    }

    row.horasDisponivel = round3(row.horasDisponivel);
    row.horasEventoEspecial = round3(row.horasEventoEspecial);
    row.horasManutencaoProgramada = round3(row.horasManutencaoProgramada);
    row.horasFalhaParcial = round3(row.horasFalhaParcial);
    row.horasFalhaTotal = round3(row.horasFalhaTotal);
    row.horasIndefinidas = round3(row.horasIndefinidas);
    return row;
  });

  const disponibilidadeBase: Distribuicao[] = [
    {
      categoria: "Disponível",
      horas: round3(horasDisponivel),
      quantidade: qtdDisponivel,
      cor: CORES["Disponível"],
    },
    {
      categoria: "Evento especial",
      horas: horasEventoEspecial,
      quantidade: qtdEventoEspecial,
      cor: CORES["Evento especial"],
    },
    {
      categoria: "Manutenção programada",
      horas: horasManutencaoProgramada,
      quantidade: qtdManutencaoProgramada,
      cor: CORES["Manutenção programada"],
    },
    {
      categoria: "Ocorrência operacional",
      horas: horasFalhaParcial,
      quantidade: qtdFalhaParcial,
      cor: CORES["Ocorrência operacional"],
    },
    {
      categoria: "Falha total / paralisação",
      horas: horasFalhaTotal,
      quantidade: qtdFalhaTotal,
      cor: CORES["Falha total / paralisação"],
    },
    {
      categoria: "Indefinido",
      horas: horasIndefinidas,
      quantidade: qtdIndefinidos,
      cor: CORES["Indefinido"],
    },
  ];

  const disponibilidadeGeral = disponibilidadeBase.filter(
    (item) => filtros.status === "todos" || item.categoria === filtros.status,
  );
  const problemas = [...problemasMap.values()]
    .map((item) => ({ ...item, horas: round3(item.horas) }))
    .sort((a, b) => b.horas - a.horas || b.qtd - a.qtd);
  const falhasComuns = [...falhasComunsMap.values()]
    .map((item) => ({ ...item, horas: round3(item.horas) }))
    .sort((a, b) => b.qtd - a.qtd || b.horas - a.horas);
  const problemaMaisComum = falhasComuns[0];
  const problemaMenosComum = [...falhasComuns]
    .filter((item) => item.categoria !== problemaMaisComum?.categoria)
    .sort((a, b) => a.qtd - b.qtd || a.horas - b.horas)[0];
  const mediaHorasAteNovaFalha = calcMediaEntreFalhas(eventosFiltrados);
  const mediaHorasEntreManutencaoFalha = calcMediaEntreManutencaoEFalha(eventosFiltrados);
  const mediaHorasEntreManutencoes = calcMediaEntreManutencoes(eventosFiltrados);
  const palavras = buildWordCloud(eventosFiltrados);

  return {
    kpis: {
      horasTotaisOperacao: round3(horasTotaisOperacao),
      horasDisponivel,
      horasEventoEspecial,
      horasManutencaoProgramada,
      horasFalhaParcial,
      horasFalhaTotal,
      horasIndefinidas,
      horasFalha,
      qtdDisponivel,
      qtdEventoEspecial,
      qtdManutencaoProgramada,
      qtdFalhaParcial,
      qtdFalhaTotal,
      qtdIndefinidos,
      qtdFalhas: qtdManutencaoProgramada + qtdFalhaParcial + qtdFalhaTotal,
      qtdEncerramentos,
      disponibilidadePct: round3(
        (horasDisponivel / Math.max(horasTotaisOperacao, 1)) * 100,
      ),
      mediaHorasDisponivel: round3(
        horasDisponivel / Math.max(qtdDisponivel, 1),
      ),
      mediaHorasEventoEspecial: round3(
        horasEventoEspecial / Math.max(qtdEventoEspecial, 1),
      ),
      mediaHorasFalhaParcial: round3(
        horasFalhaParcial / Math.max(qtdFalhaParcial, 1),
      ),
      mediaHorasIndisponibilidade: round3(
        horasFalhaTotal / Math.max(qtdFalhaTotal, 1),
      ),
      mediaHorasAteNovaFalha,
      mediaHorasEntreManutencaoFalha,
      mediaHorasEntreManutencoes,
      falhaMaisComum: problemaMaisComum?.categoria ?? "Sem tipos identificados",
      falhaMaisComumQtd: problemaMaisComum?.qtd ?? 0,
      falhaMenosComum: problemaMenosComum?.categoria ?? "Sem segundo tipo",
      falhaMenosComumQtd: problemaMenosComum?.qtd ?? 0,
    },
    linhas,
    operadores,
    problemas,
    palavras,
    mensal,
    disponibilidadeGeral,
    eventosFiltrados,
    linhasSelecionadas: linhasPermitidas,
  };
}

function KpiCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="kpi">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
      <div className="kpi-icon">{icon}</div>
    </div>
  );
}

function AvailabilityBar({ row }: { row: LinhaRanking }) {
  const total = Math.max(row.horasTotaisOperacao, 1);
  const disp = Math.max((row.horasDisponivel / total) * 100, 0);
  const manutencao = Math.max((row.horasManutencaoProgramada / total) * 100, 0);
  const parcial = Math.max((row.horasFalhaParcial / total) * 100, 0);
  const totalFalha = Math.max((row.horasFalhaTotal / total) * 100, 0);

  return (
    <div className="availability-bar" aria-label="Barra de disponibilidade">
      <span
        style={{ width: `${disp}%`, background: CORES["Disponível"] }}
        title={`Disponível + evento especial: ${fmtPct(disp)}`}
      />
      <span
        style={{
          width: `${manutencao}%`,
          background: CORES["Manutenção programada"],
        }}
        title={`Manutenção programada: ${fmtPct(manutencao)}`}
      />
      <span
        style={{
          width: `${parcial}%`,
          background: CORES["Ocorrência operacional"],
        }}
        title={`Ocorrência operacional: ${fmtPct(parcial)}`}
      />
      <span
        style={{
          width: `${totalFalha}%`,
          background: CORES["Falha total / paralisação"],
        }}
        title={`Falha total: ${fmtPct(totalFalha)}`}
      />

    </div>
  );
}

function RankingTable({ rows }: { rows: LinhaRanking[] }) {
  const [paginaAtual, setPaginaAtual] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(rows.length / LINHAS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaSegura - 1) * LINHAS_POR_PAGINA;
  const linhasDaPagina = rows.slice(inicio, inicio + LINHAS_POR_PAGINA);

  const irParaPaginaAnterior = () => setPaginaAtual((pagina) => Math.max(1, pagina - 1));
  const irParaProximaPagina = () => setPaginaAtual((pagina) => Math.min(totalPaginas, pagina + 1));

  return (
    <div>
      <div className="table-pagination table-pagination-top">
        <span>
          Exibindo {rows.length ? inicio + 1 : 0}–{Math.min(inicio + LINHAS_POR_PAGINA, rows.length)} de {fmtInt(rows.length)} linha(s)
        </span>
        <div>
          <button type="button" onClick={irParaPaginaAnterior} disabled={paginaSegura === 1}>
            Anterior
          </button>
          <strong>Página {paginaSegura} de {totalPaginas}</strong>
          <button type="button" onClick={irParaProximaPagina} disabled={paginaSegura === totalPaginas}>
            Próxima
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="line-analytics-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Linha</th>
              <th>Operador</th>
              <th>Disponibilidade</th>
              <th>Disponível</th>
              <th>Especial</th>
              <th>Manutenção</th>
              <th>Ocorrência</th>
              <th>Falha total</th>
              <th>Dados indisponíveis</th>
              <th>Até nova ocorrência</th>
              <th>Registros classificados</th>
            </tr>
          </thead>
          <tbody>
            {linhasDaPagina.map((item, index) => (
              <tr key={item.nome}>
                <td>
                  <span className="rank">{inicio + index + 1}</span>
                </td>
                <td>{item.nome}</td>
                <td className="muted">{displayOperadorName(item.operador ?? "—")}</td>
                <td>
                  <strong>{fmtPct(item.disponibilidadePct)}</strong>
                  <AvailabilityBar row={item} />
                </td>
                <td>{fmtHoras(item.horasDisponivel)} h</td>
                <td>
                  <strong>{fmtHoras(item.horasEventoEspecial)} h</strong>
                  <span className="table-subvalue">{fmtInt(item.qtdEventoEspecial)} evento(s)</span>
                </td>
                <td>
                  <strong>{fmtHoras(item.horasManutencaoProgramada)} h</strong>
                  <span className="table-subvalue">{fmtInt(item.qtdManutencaoProgramada)} registro(s)</span>
                </td>
                <td>
                  <strong>{fmtHoras(item.horasFalhaParcial)} h</strong>
                  <span className="table-subvalue">{fmtInt(item.qtdFalhaParcial)} registro(s)</span>
                </td>
                <td>
                  <strong>{fmtHoras(item.horasFalhaTotal)} h</strong>
                  <span className="table-subvalue">{fmtInt(item.qtdFalhaTotal)} registro(s)</span>
                </td>
                <td>
                  <strong>{fmtInt(item.qtdIndefinidos)} registro(s)</strong>
                  <span className="table-subvalue">sem conversão em horas</span>
                </td>
                <td>
                  <strong>{fmtHoras(item.mediaHorasAteNovaFalha)} h</strong>
                  <span className="table-subvalue">média entre ocorrências</span>
                </td>
                <td>
                  <strong>{fmtInt(qtdRegistrosClassificadosTotal(item))}</strong>
                  <span className="table-subvalue">{fmtHoras(horasRegistrosClassificadosTotal(item))} h</span>
                </td>
              </tr>
            ))}
            {!linhasDaPagina.length ? (
              <tr>
                <td colSpan={12} className="empty-cell">
                  Nenhuma linha encontrada com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="table-pagination table-pagination-bottom">
        <span>20 linhas por página</span>
        <div>
          <button type="button" onClick={irParaPaginaAnterior} disabled={paginaSegura === 1}>
            Anterior
          </button>
          <strong>Página {paginaSegura} de {totalPaginas}</strong>
          <button type="button" onClick={irParaProximaPagina} disabled={paginaSegura === totalPaginas}>
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}


function PaginatedOccurrenceTable<T>({
  rows,
  columns,
  renderRow,
  emptyMessage,
  emptyColSpan,
  label = "registro(s)",
}: {
  rows: T[];
  columns: ReactNode;
  renderRow: (item: T) => ReactNode;
  emptyMessage: string;
  emptyColSpan: number;
  label?: string;
}) {
  const [paginaAtual, setPaginaAtual] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(rows.length / LINHAS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaSegura - 1) * LINHAS_POR_PAGINA;
  const linhasDaPagina = rows.slice(inicio, inicio + LINHAS_POR_PAGINA);

  const irParaPaginaAnterior = () => setPaginaAtual((pagina) => Math.max(1, pagina - 1));
  const irParaProximaPagina = () => setPaginaAtual((pagina) => Math.min(totalPaginas, pagina + 1));

  return (
    <div>
      <div className="table-pagination table-pagination-top">
        <span>
          Exibindo {rows.length ? inicio + 1 : 0}–{Math.min(inicio + LINHAS_POR_PAGINA, rows.length)} de {fmtInt(rows.length)} {label}
        </span>
        <div>
          <button type="button" onClick={irParaPaginaAnterior} disabled={paginaSegura === 1}>
            Anterior
          </button>
          <strong>Página {paginaSegura} de {totalPaginas}</strong>
          <button type="button" onClick={irParaProximaPagina} disabled={paginaSegura === totalPaginas}>
            Próxima
          </button>
        </div>
      </div>

      <div className="table-wrap occurrence-table">
        <table>
          <thead>{columns}</thead>
          <tbody>
            {linhasDaPagina.map(renderRow)}
            {!linhasDaPagina.length ? (
              <tr>
                <td colSpan={emptyColSpan} className="empty-cell">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="table-pagination table-pagination-bottom">
        <span>20 registros por página</span>
        <div>
          <button type="button" onClick={irParaPaginaAnterior} disabled={paginaSegura === 1}>
            Anterior
          </button>
          <strong>Página {paginaSegura} de {totalPaginas}</strong>
          <button type="button" onClick={irParaProximaPagina} disabled={paginaSegura === totalPaginas}>
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}



type HeatmapCell = {
  estado: EstadoOperacional;
  cor: string;
  tooltip: string;
  prioridade: number;
  ocorrencias: number;
  linha: string;
  slotLabel: string;
  diaLabel: string;
};

type HeatmapSlot = {
  id: string;
  label: string;
  inicioMinutos: number;
  fimMinutos: number;
};

type HeatmapDia = {
  key: string;
  label: string;
  data: Date;
};

const HEATMAP_SLOTS: HeatmapSlot[] = [
  {
    id: "slot-1",
    label: "04:30–09:00",
    inicioMinutos: 4 * 60 + 30,
    fimMinutos: 9 * 60,
  },
  {
    id: "slot-2",
    label: "09:00–14:00",
    inicioMinutos: 9 * 60,
    fimMinutos: 14 * 60,
  },
  {
    id: "slot-3",
    label: "14:00–19:30",
    inicioMinutos: 14 * 60,
    fimMinutos: 19 * 60 + 30,
  },
  {
    id: "slot-4",
    label: "19:30–00:00",
    inicioMinutos: 19 * 60 + 30,
    fimMinutos: 24 * 60,
  },
];

const PRIORIDADE_HEATMAP: Record<EstadoOperacional, number> = {
  "Falha total / paralisação": 70,
  "Ocorrência operacional": 60,
  "Com falha ou parcial": 60,
  "Manutenção programada": 50,
  "Indefinido": 40,
  "Evento especial": 30,
  "Disponível": 20,
  "Operação encerrada": 10,
};

const ESTADOS_SEM_SOBREPOSICAO_HEATMAP = new Set<EstadoOperacional>([
  "Disponível",
  "Operação encerrada",
]);

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function minutosParaHoraLabel(minutos: number): string {
  const minutosNormalizados = minutos >= 24 * 60 ? 0 : minutos;
  const horas = Math.floor(minutosNormalizados / 60);
  const resto = minutosNormalizados % 60;
  return `${pad2(horas)}:${pad2(resto)}`;
}

function fimEventoHeatmap(evento: Evento): number {
  const fechamento = evento.fechamentoAte ? Date.parse(evento.fechamentoAte) : NaN;
  if (Number.isFinite(fechamento) && fechamento > Date.parse(evento.dataHora)) {
    return fechamento;
  }
  return Date.parse(evento.dataHora) + Math.max(evento.horas, 0) * 60 * 60 * 1000;
}

function diasPeriodoHeatmap(): HeatmapDia[] {
  const inicio = parseDataKey(data.metadata.periodoInicio);
  const fim = parseDataKey(data.metadata.periodoFim);
  const dias: HeatmapDia[] = [];
  const cursor = new Date(inicio);

  while (cursor <= fim) {
    const dataDia = new Date(cursor);
    const key = getDateKey(dataDia);
    dias.push({
      key,
      data: dataDia,
      label: `${pad2(dataDia.getDate())}/${pad2(dataDia.getMonth() + 1)}`,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return dias;
}

function inicioDiaHeatmap(dia: HeatmapDia): number {
  const dataDia = new Date(dia.data);
  dataDia.setHours(0, 0, 0, 0);
  return dataDia.getTime();
}

function eventoCruzaCelulaHeatmap(evento: Evento, dia: HeatmapDia, slot: HeatmapSlot): boolean {
  const inicio = Date.parse(evento.dataHora);
  const fim = fimEventoHeatmap(evento);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio) return false;

  const baseDia = inicioDiaHeatmap(dia);
  const inicioSlot = baseDia + slot.inicioMinutos * 60 * 1000;
  const fimSlot = baseDia + slot.fimMinutos * 60 * 1000;
  return fim > inicioSlot && inicio < fimSlot;
}

function criarCelulaHeatmap(
  linha: string,
  slot: HeatmapSlot,
  dia: HeatmapDia,
): HeatmapCell {
  return {
    estado: "Disponível",
    cor: CORES["Disponível"],
    prioridade: PRIORIDADE_HEATMAP["Disponível"],
    ocorrencias: 0,
    linha,
    slotLabel: slot.label,
    diaLabel: dia.label,
    tooltip: [
      linha,
      dia.label,
      slot.label,
      "Operação normal / disponível",
      "Sem ocorrência no recorte filtrado",
    ].join(" · "),
  };
}

function HeatmapDisponibilidade({
  eventos,
  linhaSelecionada,
}: {
  eventos: Evento[];
  linhaSelecionada: string;
}) {
  const resultado = useMemo(() => {
    const eventosBase = eventos.filter(
      (evento) => linhaSelecionada === "todas" || evento.linha === linhaSelecionada,
    );

    const linhas = Array.from(new Set(eventosBase.map((evento) => evento.linha))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );

    if (linhaSelecionada !== "todas" && !linhas.includes(linhaSelecionada)) {
      linhas.unshift(linhaSelecionada);
    }

    const dias = diasPeriodoHeatmap();
    const celulas = new Map<string, HeatmapCell>();
    const linhaIndice = new Map(linhas.map((linha, index) => [linha, index]));

    linhas.forEach((linha, linhaIndex) => {
      HEATMAP_SLOTS.forEach((slot, slotIndex) => {
        dias.forEach((dia, diaIndex) => {
          celulas.set(
            `${linhaIndex}-${slotIndex}-${diaIndex}`,
            criarCelulaHeatmap(linha, slot, dia),
          );
        });
      });
    });

    const eventosQueSobrepoem = eventosBase
      .filter((evento) => evento.estado !== "Indefinido")
      .filter((evento) => !ESTADOS_SEM_SOBREPOSICAO_HEATMAP.has(evento.estado))
      .filter((evento) => getHorasContabilizadas(evento) > 0);

    for (const evento of eventosQueSobrepoem) {
      const linhaIndex = linhaIndice.get(evento.linha);
      if (linhaIndex === undefined) continue;

      HEATMAP_SLOTS.forEach((slot, slotIndex) => {
        dias.forEach((dia, diaIndex) => {
          if (!eventoCruzaCelulaHeatmap(evento, dia, slot)) return;

          const chaveCelula = `${linhaIndex}-${slotIndex}-${diaIndex}`;
          const celulaAtual = celulas.get(chaveCelula);
          if (!celulaAtual) return;

          const prioridade = PRIORIDADE_HEATMAP[evento.estado] ?? 0;
          const cor = CORES[evento.estado] ?? evento.cor ?? "#CBD5E1";
          const proximaCelula: HeatmapCell = {
            ...celulaAtual,
            ocorrencias: celulaAtual.ocorrencias + 1,
          };

          if (prioridade >= celulaAtual.prioridade) {
            proximaCelula.estado = evento.estado;
            proximaCelula.cor = cor;
            proximaCelula.prioridade = prioridade;
          }

          celulas.set(chaveCelula, proximaCelula);
        });
      });
    }

    celulas.forEach((celula, chave) => {
      const explicacao = celula.ocorrencias > 0
        ? `${fmtInt(celula.ocorrencias)} ocorrência(s) atravessando este dia e faixa horária; a cor representa o estado dominante de maior criticidade.`
        : "Sem ocorrência neste dia e faixa horária; operação normal é o padrão e o fallback.";
      celulas.set(chave, {
        ...celula,
        tooltip: [
          celula.linha,
          celula.diaLabel,
          celula.slotLabel,
          celula.estado === "Disponível" ? "Operação normal / disponível" : celula.estado,
          explicacao,
        ].join(" · "),
      });
    });

    let operacaoNormal = 0;
    let comOcorrencia = 0;
    let criticas = 0;

    celulas.forEach((celula) => {
      if (celula.ocorrencias > 0) comOcorrencia += 1;
      else operacaoNormal += 1;
      if (
        celula.estado === "Falha total / paralisação" ||
        celula.estado === "Ocorrência operacional" ||
        celula.estado === "Com falha ou parcial"
      ) {
        criticas += 1;
      }
    });

    const marcadoresMes = dias
      .map((dia, diaIndex) => ({ dia, diaIndex }))
      .filter(({ dia }) => dia.data.getDate() === 1)
      .map(({ dia, diaIndex }) => ({
        diaIndex,
        label: MESES[dia.data.getMonth()]?.label ?? dia.label,
      }));

    return {
      celulas,
      linhas,
      dias,
      marcadoresMes,
      operacaoNormal,
      comOcorrencia,
      criticas,
      totalCelulas: linhas.length * HEATMAP_SLOTS.length * dias.length,
    };
  }, [eventos, linhaSelecionada]);

  const larguraCelula = 5;
  const alturaCelula = 16;
  // Reserva duas colunas legíveis antes da malha: linha à esquerda e faixas horárias à direita.
  // Isso evita que nomes compridos encostem nos horários do eixo Y.
  const margemEsquerda = 360;
  const colunaRotuloLinhaX = 24;
  const colunaFaixaHorariaX = margemEsquerda - 24;
  const margemTopo = 52;
  const alturaBlocoLinha = HEATMAP_SLOTS.length * alturaCelula + 10;
  const larguraGrafico = margemEsquerda + resultado.dias.length * larguraCelula + 34;
  const alturaGrafico = margemTopo + resultado.linhas.length * alturaBlocoLinha + 42;

  if (resultado.linhas.length === 0) {
    return (
      <div className="availability-heatmap-card">
        <div className="availability-heatmap-meta">
          <span><strong>0</strong> linha(s)</span>
          <span><strong>{fmtInt(diasPeriodoHeatmap().length)}</strong> dia(s) do período</span>
        </div>
        <div className="empty-filter-state">
          Não há linhas disponíveis para montar o histograma temporal no recorte aplicado.
        </div>
      </div>
    );
  }

  return (
    <div className="availability-heatmap-card">
      <div className="availability-heatmap-meta">
        <span><strong>{fmtInt(resultado.linhas.length)}</strong> linha(s)</span>
        <span><strong>{fmtInt(resultado.dias.length)}</strong> dia(s) do ano/período no eixo X</span>
        <span><strong>{fmtInt(HEATMAP_SLOTS.length)}</strong> faixas horárias por linha no eixo Y</span>
        <span><strong>{fmtInt(resultado.totalCelulas)}</strong> células classificadas</span>
        <span><strong>{fmtInt(resultado.operacaoNormal)}</strong> células em operação normal</span>
        <span><strong>{fmtInt(resultado.comOcorrencia)}</strong> células com ocorrência</span>
        <span><strong>{fmtInt(resultado.criticas)}</strong> células críticas</span>
      </div>
      <div className="availability-heatmap-scroll">
        <svg
          className="availability-heatmap-svg availability-heatmap-svg--dias"
          viewBox={`0 0 ${larguraGrafico} ${alturaGrafico}`}
          width={larguraGrafico}
          height={alturaGrafico}
          role="img"
          aria-label={`Histograma temporal de disponibilidade por linha para ${linhaSelecionada === "todas" ? "todas as linhas filtradas" : linhaSelecionada}`}
        >
          <rect x="0" y="0" width={larguraGrafico} height={alturaGrafico} rx="18" className="availability-heatmap-bg" />
          {resultado.marcadoresMes.map((item) => (
            <g key={`heatmap-mes-${item.diaIndex}`}>
              <line
                x1={margemEsquerda + item.diaIndex * larguraCelula}
                x2={margemEsquerda + item.diaIndex * larguraCelula}
                y1={margemTopo - 12}
                y2={margemTopo + resultado.linhas.length * alturaBlocoLinha}
                className="availability-heatmap-month-line"
              />
              <text
                x={margemEsquerda + item.diaIndex * larguraCelula + 4}
                y={24}
                textAnchor="start"
                className="availability-heatmap-month-label"
              >
                {item.label}
              </text>
            </g>
          ))}
          {resultado.linhas.map((linha, linhaIndex) => {
            const yBase = margemTopo + linhaIndex * alturaBlocoLinha;
            return (
              <g key={`heatmap-linha-${linha}`}>
                <line
                  x1={margemEsquerda}
                  x2={margemEsquerda + resultado.dias.length * larguraCelula}
                  y1={yBase - 4}
                  y2={yBase - 4}
                  className="availability-heatmap-hour-line"
                />
                <text
                  x={colunaRotuloLinhaX}
                  y={yBase + Math.max(14, HEATMAP_SLOTS.length * alturaCelula / 2)}
                  textAnchor="start"
                  className="availability-heatmap-line-label"
                >
                  {linha}
                </text>
                {HEATMAP_SLOTS.map((slot, slotIndex) => (
                  <text
                    key={`heatmap-slot-label-${linha}-${slot.id}`}
                    x={colunaFaixaHorariaX}
                    y={yBase + slotIndex * alturaCelula + 12}
                    textAnchor="end"
                    className="availability-heatmap-hour-label"
                  >
                    {slot.label}
                  </text>
                ))}
              </g>
            );
          })}
          {resultado.linhas.flatMap((linha, linhaIndex) =>
            HEATMAP_SLOTS.flatMap((slot, slotIndex) =>
              resultado.dias.map((dia, diaIndex) => {
                const chave = `${linhaIndex}-${slotIndex}-${diaIndex}`;
                const celula = resultado.celulas.get(chave) ?? criarCelulaHeatmap(linha, slot, dia);
                const yBase = margemTopo + linhaIndex * alturaBlocoLinha + slotIndex * alturaCelula;
                return (
                  <rect
                    key={`heatmap-cell-${chave}`}
                    x={margemEsquerda + diaIndex * larguraCelula}
                    y={yBase}
                    width={larguraCelula - 0.8}
                    height={alturaCelula - 1.2}
                    rx="1"
                    fill={celula.cor}
                  >
                    <title>{celula.tooltip}</title>
                  </rect>
                );
              }),
            ),
          )}
        </svg>
      </div>
      <div className="availability-heatmap-footnote">
        <span>O eixo X percorre todos os dias do período; o eixo Y é composto por linha e, dentro de cada linha, pelas quatro faixas horárias da jornada.</span>
        <span>Operação normal é o padrão; havendo ocorrência na célula dia × horário, prevalece a cor do evento de maior criticidade.</span>
      </div>
    </div>
  );
}

export default function DashboardOcorrencias2025({ modo = "painel" }: { modo?: "painel" | "comparativo" }) {
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("tempo");
  const [linha, setLinha] = useState("todas");
  const [operador, setOperador] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [buscaTabela, setBuscaTabela] = useState("");
  const [operadorTabela, setOperadorTabela] = useState("todos");
  const [statusTabela, setStatusTabela] = useState("todos");
  const [buscaOcorrencia, setBuscaOcorrencia] = useState("");
  const [linhaOcorrencia, setLinhaOcorrencia] = useState("todas");
  const [operadorOcorrencia, setOperadorOcorrencia] = useState("todos");
  const [estadoOcorrencia, setEstadoOcorrencia] = useState("todos");
  const [tipoOcorrencia, setTipoOcorrencia] = useState("todos");
  const [origemOcorrencia, setOrigemOcorrencia] = useState("todas");
  const [recorteDiasMapa, setRecorteDiasMapa] = useState<RecorteDiasMapa>("todos");
  const [linhaMapa, setLinhaMapa] = useState("todas");
  const [linhaHistograma, setLinhaHistograma] = useState("todas");
  const [operadorMapa, setOperadorMapa] = useState("todos");
  const [estadoMapa, setEstadoMapa] = useState("todos");
  const [origemMapa, setOrigemMapa] = useState("todas");
  const [anoSelecionado, setAnoSelecionado] = useState<AnoDados>(modo === "comparativo" ? "comparativo" : ANO_ATIVO);
  const [isAnoPendente, iniciarTransicaoAno] = useTransition();
  const router = useRouter();

  const trocarAno = (novoAno: AnoDados) => {
    if (novoAno === anoSelecionado) return;
    setAnoSelecionado(novoAno);
    iniciarTransicaoAno(() => {
      router.push(`/?ano=${novoAno}`, { scroll: false });
    });
  };

  const agregado = useMemo(
    () => aggregateData({ linha, operador, status }),
    [linha, operador, status],
  );

  const operadoresTabelaDisponiveis = useMemo(() => {
    return Array.from(
      new Set(agregado.linhas.map((item) => item.operador ?? "Não informado")),
    ).sort();
  }, [agregado.linhas]);

  const linhasFiltradas = useMemo(() => {
    const termo = normalizeText(buscaTabela);

    return [...agregado.linhas]
      .filter((item) => {
        const bateBusca =
          !termo ||
          normalizeText(`${item.nome} ${item.operador ?? ""}`).includes(termo);
        const bateOperador =
          operadorTabela === "todos" ||
          (item.operador ?? "Não informado") === operadorTabela;
        const bateStatus =
          statusTabela === "todos" ||
          (statusTabela === "com_falhas" && item.qtdFalhas > 0) ||
          (statusTabela === "com_paralisacao" && item.qtdFalhaTotal > 0) ||
          (statusTabela === "sem_falhas" && item.qtdFalhas === 0) ||
          (statusTabela === "com_dados_indisponiveis" &&
            item.qtdIndefinidos > 0);

        return bateBusca && bateOperador && bateStatus;
      })
      .sort((a, b) => {
        if (ordenacao === "quantidade") return qtdRegistrosClassificadosTotal(b) - qtdRegistrosClassificadosTotal(a);
        if (ordenacao === "disponibilidade")
          return a.disponibilidadePct - b.disponibilidadePct;
        if (ordenacao === "paralisacao")
          return b.horasFalhaTotal - a.horasFalhaTotal;
        return horasRegistrosClassificadosTotal(b) - horasRegistrosClassificadosTotal(a);
      });
  }, [agregado.linhas, buscaTabela, operadorTabela, statusTabela, ordenacao]);

  const incluirDadosIndisponiveisNosGraficos = status === "Indefinido";

  const eventosBaseMapa = useMemo(() => {
    return agregado.eventosFiltrados.filter((evento) => entraEmRankingDeTipo(evento));
  }, [agregado.eventosFiltrados]);

  const linhasTemporaisDisponiveis = useMemo(() => {
    return Array.from(
      new Set(agregado.eventosFiltrados.map((evento) => evento.linha)),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [agregado.eventosFiltrados]);

  useEffect(() => {
    if (
      linhaMapa !== "todas" &&
      !linhasTemporaisDisponiveis.includes(linhaMapa)
    ) {
      setLinhaMapa("todas");
    }

    if (
      linhaHistograma !== "todas" &&
      !linhasTemporaisDisponiveis.includes(linhaHistograma)
    ) {
      setLinhaHistograma("todas");
    }
  }, [linhaMapa, linhaHistograma, linhasTemporaisDisponiveis]);

  const operadoresMapaDisponiveis = useMemo(() => {
    return Array.from(new Set(eventosBaseMapa.map((evento) => evento.operador))).sort(
      (a, b) => displayOperadorName(a).localeCompare(displayOperadorName(b), "pt-BR"),
    );
  }, [eventosBaseMapa]);

  const estadosMapaDisponiveis = useMemo(() => {
    return ESTADOS_CLASSIFICADOS.filter((estadoItem) =>
      eventosBaseMapa.some((evento) => evento.estado === estadoItem),
    );
  }, [eventosBaseMapa]);

  const eventosMapaHorario = useMemo(() => {
    return eventosBaseMapa.filter((evento) => {
      const bateLinha = linhaMapa === "todas" || evento.linha === linhaMapa;
      const bateOperador = operadorMapa === "todos" || evento.operador === operadorMapa;
      const bateEstado = estadoMapa === "todos" || evento.estado === estadoMapa;
      const bateDia = filtraEventoPorRecorteDias(evento, recorteDiasMapa);
      const bateOrigem =
        origemMapa === "todas" ||
        (origemMapa === "cascata" && Boolean(evento.efeitoCascata)) ||
        (origemMapa === "originario" && !evento.efeitoCascata);
      const bateDados =
        incluirDadosIndisponiveisNosGraficos ||
        evento.estado !== "Indefinido";

      return bateLinha && bateOperador && bateEstado && bateDia && bateOrigem && bateDados;
    });
  }, [
    eventosBaseMapa,
    linhaMapa,
    operadorMapa,
    estadoMapa,
    origemMapa,
    recorteDiasMapa,
    incluirDadosIndisponiveisNosGraficos,
  ]);

  const recorrenciaFalhas = useMemo(() => {
    const falhas = agregado.eventosFiltrados.filter(
      (evento) =>
        evento.estado === "Ocorrência operacional" ||
        evento.estado === "Com falha ou parcial" ||
        evento.estado === "Falha total / paralisação",
    );

    const porDiaSemana = new Map<number, number>();
    const porHora = new Map<number, number>();

    falhas.forEach((evento) => {
      const dataEvento = new Date(evento.dataHora);
      if (Number.isNaN(dataEvento.getTime())) return;

      porDiaSemana.set(
        dataEvento.getDay(),
        (porDiaSemana.get(dataEvento.getDay()) ?? 0) + 1,
      );

      porHora.set(
        dataEvento.getHours(),
        (porHora.get(dataEvento.getHours()) ?? 0) + 1,
      );
    });

    const diaMaisComum = [...porDiaSemana.entries()].sort(
      (a, b) => b[1] - a[1] || a[0] - b[0],
    )[0];

    const horaMaisComum = [...porHora.entries()].sort(
      (a, b) => b[1] - a[1] || a[0] - b[0],
    )[0];

    return {
      diaLabel:
        diaMaisComum === undefined
          ? "Sem falhas"
          : DIAS_SEMANA_LONGOS[diaMaisComum[0]] ?? "Dia não identificado",
      diaQtd: diaMaisComum?.[1] ?? 0,
      horaLabel:
        horaMaisComum === undefined
          ? "Sem falhas"
          : `${pad2(horaMaisComum[0])}h–${pad2(horaMaisComum[0] + 1)}h`,
      horaQtd: horaMaisComum?.[1] ?? 0,
    };
  }, [agregado.eventosFiltrados]);

  const dadosGraficoDisponibilidade = agregado.disponibilidadeGeral.filter(
    (item) =>
      incluirDadosIndisponiveisNosGraficos ||
      item.categoria !== "Indefinido",
  );

  const chartLinhasTempo = [...agregado.linhas]
    .sort(
      (a, b) =>
        horasRegistrosClassificados(b) - horasRegistrosClassificados(a) ||
        b.horasFalhaParcial - a.horasFalhaParcial ||
        b.horasFalhaTotal - a.horasFalhaTotal,
    )
    .slice(0, 10)
    .map((item) =>
      limparDadosIndisponiveisParaGrafico(
        item,
        incluirDadosIndisponiveisNosGraficos,
      ),
    );
  const chartLinhasQtd = [...agregado.linhas]
    .sort(
      (a, b) =>
        qtdRegistrosClassificadosOperacionais(b) - qtdRegistrosClassificadosOperacionais(a) ||
        b.qtdManutencaoProgramada - a.qtdManutencaoProgramada ||
        b.qtdFalhaParcial - a.qtdFalhaParcial ||
        b.qtdFalhaTotal - a.qtdFalhaTotal,
    )
    .slice(0, 10)
    .map((item) =>
      limparDadosIndisponiveisParaGrafico(
        item,
        incluirDadosIndisponiveisNosGraficos,
      ),
    );
  const chartOperadoresTempo = [...agregado.operadores]
    .sort((a, b) => horasRegistrosClassificados(b) - horasRegistrosClassificados(a))
    .slice(0, 8)
    .map((item) => ({
      ...limparDadosIndisponiveisParaGrafico(
        item,
        incluirDadosIndisponiveisNosGraficos,
      ),
      nomeLabel: displayOperadorName(item.nome),
    }));
  const chartOperadoresQtd = [...agregado.operadores]
    .sort((a, b) => qtdRegistrosClassificadosOperacionais(b) - qtdRegistrosClassificadosOperacionais(a))
    .slice(0, 8)
    .map((item) => ({
      ...limparDadosIndisponiveisParaGrafico(
        item,
        incluirDadosIndisponiveisNosGraficos,
      ),
      nomeLabel: displayOperadorName(item.nome),
    }));
  const operadorTempoChartHeight = Math.max(330, chartOperadoresTempo.length * 46 + 96);
  const operadorQtdChartHeight = Math.max(330, chartOperadoresQtd.length * 46 + 96);
  const chartProblemas = agregado.problemas.slice(0, 10);

  const eventosProblemaBase = useMemo<EventoComTipo[]>(() => {
    return agregado.eventosFiltrados
      .filter((evento) => entraEmRankingDeTipo(evento) && temDescricaoUtil(evento))
      .map((evento) => {
        const tipoFalha = inferTipoFalha(evento);
        const descricaoBase = getDescricaoBase(evento);

        return {
          ...evento,
          tipoFalha,
          descricaoBase,
          timestamp: Date.parse(evento.dataHora) || 0,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [agregado.eventosFiltrados]);

  const linhasOcorrenciaDisponiveis = useMemo(() => {
    return Array.from(
      new Set(eventosProblemaBase.map((evento) => evento.linha)),
    ).sort();
  }, [eventosProblemaBase]);

  const operadoresOcorrenciaDisponiveis = useMemo(() => {
    return Array.from(
      new Set(eventosProblemaBase.map((evento) => evento.operador)),
    ).sort();
  }, [eventosProblemaBase]);

  const estadosOcorrenciaDisponiveis = useMemo(() => {
    return Array.from(
      new Set(eventosProblemaBase.map((evento) => evento.estado)),
    ).sort();
  }, [eventosProblemaBase]);

  const tiposOcorrenciaDisponiveis = useMemo(() => {
    return Array.from(
      new Set(eventosProblemaBase.map((evento) => evento.tipoFalha)),
    ).sort();
  }, [eventosProblemaBase]);

  const eventosProblema = useMemo<EventoComTipo[]>(() => {
    const termo = normalizeText(buscaOcorrencia);

    return eventosProblemaBase
      .filter((evento) => {
        const bateBusca =
          !termo ||
          normalizeText(
            [
              evento.dataLabel,
              evento.linha,
              evento.operador,
              evento.estado,
              evento.status,
              evento.tipoFalha,
              labelOrigemEvento(evento),
              evento.descricaoBase,
            ].join(" "),
          ).includes(termo);

        const bateLinha =
          linhaOcorrencia === "todas" || evento.linha === linhaOcorrencia;
        const bateOperador =
          operadorOcorrencia === "todos" ||
          evento.operador === operadorOcorrencia;
        const bateEstado =
          estadoOcorrencia === "todos" || evento.estado === estadoOcorrencia;
        const bateTipo =
          tipoOcorrencia === "todos" || evento.tipoFalha === tipoOcorrencia;
        const bateOrigem =
          origemOcorrencia === "todas" ||
          (origemOcorrencia === "cascata" && Boolean(evento.efeitoCascata)) ||
          (origemOcorrencia === "originario" && !evento.efeitoCascata);

        return bateBusca && bateLinha && bateOperador && bateEstado && bateTipo && bateOrigem;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [
    eventosProblemaBase,
    buscaOcorrencia,
    linhaOcorrencia,
    operadorOcorrencia,
    estadoOcorrencia,
    tipoOcorrencia,
    origemOcorrencia,
  ]);

  const eventosEncerramento = useMemo(() => {
    return agregado.eventosFiltrados
      .filter((evento) => evento.estado === "Operação encerrada")
      .map((evento) => ({
        ...evento,
        timestamp: Date.parse(evento.dataHora) || 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [agregado.eventosFiltrados]);

  const eventosEspeciais = useMemo(() => {
    return agregado.eventosFiltrados
      .filter((evento) => evento.estado === "Evento especial")
      .map((evento) => ({
        ...evento,
        timestamp: Date.parse(evento.dataHora) || 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [agregado.eventosFiltrados]);

  const filtrosAtivos = [
    linha !== "todas",
    operador !== "todos",
    status !== "todos",
  ].filter(Boolean).length;

  const limparFiltros = () => {
    setLinha("todas");
    setOperador("todos");
    setStatus("todos");
    setBuscaTabela("");
    setOperadorTabela("todos");
    setStatusTabela("todos");
    setBuscaOcorrencia("");
    setLinhaOcorrencia("todas");
    setOperadorOcorrencia("todos");
    setEstadoOcorrencia("todos");
    setTipoOcorrencia("todos");
    setLinhaMapa("todas");
    setLinhaHistograma("todas");
  };

  if (modo === "comparativo") {
    return (
      <main className={`page dashboard-page comparison-only-page ${isAnoPendente ? "is-route-changing" : ""}`}>
      <section className="panel comparison-year-controls" aria-label="Base analisada">
          <div className="hero-actions">
            <div className="hero-control-stack">
              <span className="hero-control-label">Base analisada</span>
              <div className="hero-tabbar" aria-label="Base analisada e atalhos do painel">
                <button
                  type="button"
                  className={anoSelecionado === "2025" ? "is-active" : ""}
                  onClick={() => trocarAno("2025")}
                  aria-pressed={anoSelecionado === "2025"}
                >
                  2025
                </button>
                <button
                  type="button"
                  className={anoSelecionado === "2024" ? "is-active" : ""}
                  onClick={() => trocarAno("2024")}
                  aria-pressed={anoSelecionado === "2024"}
                >
                  2024
                </button>
                <button
                  type="button"
                  className={anoSelecionado === "comparativo" ? "is-active" : ""}
                  onClick={() => trocarAno("comparativo")}
                  aria-pressed={anoSelecionado === "comparativo"}
                >
                  Comparativo 2025 × 2024
                </button>
                <DocumentacaoPopup />
                <EventosRelevantesPopup anoInicial="todos" />
                <AnaliseIaPopup />
              </div>
            </div>
          </div>
      </section>

      <section className="panel comparison-panel" aria-labelledby="comparativo-anos-title">
        <div className="comparison-heading">
          <div>
            <h2 id="comparativo-anos-title">Comparativo 2025 em relação a 2024</h2>
            <p>
              Leitura consolidada das duas bases completas, sem aplicação dos filtros do painel.
              A cor agora segue a narrativa operacional: verde indica melhora, vermelho indica piora
              e azul marca estabilidade ou leitura contextual.
            </p>
          </div>
          <span className="comparison-badge">2025 × 2024</span>
        </div>
        <div className="comparison-grid">
          {COMPARATIVO_2025_2024.map((metrica) => {
            const classeDelta = classificarDeltaNarrativo(
              metrica.valor2025,
              metrica.valor2024,
              metrica.sentidoNarrativo,
            );
            return (
              <article className="comparison-card" key={metrica.label}>
                <span>{metrica.label}</span>
                <strong>{fmtComparativoValor(metrica.valor2025, metrica.formato)}</strong>
                <small>2024: {fmtComparativoValor(metrica.valor2024, metrica.formato)}</small>
                <em className={classeDelta}>{fmtComparativoDelta(metrica)}</em>
                <p>{metrica.detalhe}</p>
              </article>
            );
          })}
        </div>

        <div className="comparison-lines-block" aria-labelledby="comparativo-linhas-title">
          <div className="comparison-subheading">
            <h3 id="comparativo-linhas-title">Comparativo por linha</h3>
            <p>
              A mesma leitura narrativa aplicada linha a linha. Os valores principais são de 2025;
              logo abaixo aparece a referência de 2024 e a variação relativa.
            </p>
          </div>
          <div className="table-wrap comparison-lines-table-wrap">
            <table className="comparison-lines-table">
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Operador</th>
                  {METRICAS_COMPARATIVO_LINHA.map((metrica) => (
                    <th key={`comparativo-linha-coluna-${metrica.chave}`}>{metrica.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARATIVO_POR_LINHA.map((item) => (
                  <tr key={`comparativo-linha-${item.nome}`}>
                    <td><strong>{item.nome}</strong></td>
                    <td className="muted">{item.operador}</td>
                    {METRICAS_COMPARATIVO_LINHA.map((metrica) => {
                      const valor2025 = getValorComparativoLinha(item.linha2025, metrica.chave);
                      const valor2024 = getValorComparativoLinha(item.linha2024, metrica.chave);
                      const classeDelta = classificarDeltaNarrativo(
                        valor2025,
                        valor2024,
                        metrica.sentidoNarrativo,
                      );
                      return (
                        <td key={`comparativo-linha-${item.nome}-${metrica.chave}`}>
                          <strong className="comparison-line-main-value">
                            {fmtComparativoValor(valor2025, metrica.formato)}
                          </strong>
                          <span className="comparison-line-reference">
                            2024: {fmtComparativoValor(valor2024, metrica.formato)}
                          </span>
                          <em className={`comparison-line-delta ${classeDelta}`}>
                            {fmtComparativoVariacao(valor2025, valor2024, metrica.formato)}
                          </em>
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

  return (
    <main className={`page dashboard-page ${isAnoPendente ? "is-route-changing" : ""}`}>
      {isAnoPendente ? (
        <div className="year-transition-shield" role="status" aria-live="polite">
          <div className="year-transition-card">
            <span className="route-loading-pill">Trocando base</span>
            <strong>Abrindo a visão de {anoSelecionado}…</strong>
            <p>Os indicadores serão recarregados no mesmo método de cálculo e na mesma janela operacional.</p>
            <div className="route-loading-bar" aria-hidden="true"><span /></div>
          </div>
        </div>
      ) : null}
      <section className="hero">
        <div className="hero-card">
          <span className="badge">
            Ocorrências metroferroviárias · base {ANO_ATIVO}
          </span>
          <h1>Painel de disponibilidade e ocorrências nas linhas metroferroviárias</h1>
          <p>
            Este painel resume, em linguagem operacional, quanto tempo as linhas
            ficaram disponíveis, quanto tempo tiveram eventos programados,
            ocorrências, paralisações ou falta de dados do sistema. Período analisado: {data.metadata.periodoLabel}.
            A comparação usa {fmtHoras(HORAS_DIA)} horas
            de operação por dia, na janela padrão de {JANELA_OPERACIONAL_LABEL}.
            Fonte dos dados:{" "}
            <a href="https://ccm.artesp.sp.gov.br" target="_blank" rel="noreferrer">
              ccm.artesp.sp.gov.br
            </a>.
          </p>
        </div>
        <div className="hero-side hero-card">
          <strong>Legenda operacional</strong>
          <p className="legend-intro">Cada cor representa uma situação operacional monitorada. Disponível e eventos especiais ficam concentrados nos cartões, distribuições, evolução mensal e tabela analítica.</p>
          <div className="legend-block">
            <span style={{ background: CORES["Manutenção programada"] }} /> Manutenção
            programada
          </div>
          <div className="legend-block">
            <span style={{ background: CORES["Ocorrência operacional"] }} /> Ocorrência
            operacional
          </div>
          <div className="legend-block">
            <span style={{ background: CORES["Falha total / paralisação"] }} />{" "}
            Falha total / paralisação
          </div>
          <div className="legend-block">
            <span style={{ background: CORES["Indefinido"] }} />{" "}
            Indefinido
          </div>
          <div className="legend-block">
            <span style={{ background: CORES["Evento especial"] }} /> Eventos especiais
          </div>
        </div>
      </section>


      <section className="panel comparison-year-controls" aria-label="Base analisada">
          <div className="hero-actions">
            <div className="hero-control-stack">
              <span className="hero-control-label">Base analisada</span>
              <div className="hero-tabbar" aria-label="Base analisada e atalhos do painel">
                <button
                  type="button"
                  className={anoSelecionado === "2025" ? "is-active" : ""}
                  onClick={() => trocarAno("2025")}
                  aria-pressed={anoSelecionado === "2025"}
                >
                  2025
                </button>
                <button
                  type="button"
                  className={anoSelecionado === "2024" ? "is-active" : ""}
                  onClick={() => trocarAno("2024")}
                  aria-pressed={anoSelecionado === "2024"}
                >
                  2024
                </button>
                <button
                  type="button"
                  className={anoSelecionado === "comparativo" ? "is-active" : ""}
                  onClick={() => trocarAno("comparativo")}
                  aria-pressed={anoSelecionado === "comparativo"}
                >
                  Comparativo 2025 × 2024
                </button>
                <DocumentacaoPopup />
                <EventosRelevantesPopup anoInicial={ANO_ATIVO} />
              </div>
            </div>
          </div>
      </section>

      <section className="filters-panel">
        <div className="filters-title">
          <div>
            <strong>
              <Filter size={18} /> Filtros globais
            </strong>
            <span>
              {filtrosAtivos
                ? `${filtrosAtivos} filtro(s) ativo(s). Eles afetam todos os números do painel.`
                : "Sem filtro global: todos os dados do período selecionado estão ativos."}
            </span>
          </div>
          <button
            type="button"
            onClick={limparFiltros}
            disabled={!filtrosAtivos}
          >
            <X size={16} /> Limpar filtros
          </button>
        </div>

        <div className="filters-grid">
          <label>
            Linha
            <select
              value={linha}
              onChange={(event) => setLinha(event.target.value)}
            >
              <option value="todas">Todas as linhas</option>
              {LINHAS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            Operador
            <select
              value={operador}
              onChange={(event) => setOperador(event.target.value)}
            >
              <option value="todos">Todos os operadores</option>
              {OPERADORES.map((item) => (
                <option key={item} value={item}>
                  {displayOperadorName(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Estado operacional
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="todos">Todos os status</option>
              {ESTADOS_FILTRO_GLOBAL.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid-kpis">
        <KpiCard
          label="Tempo total esperado"
          value={`${fmtHoras(agregado.kpis.horasTotaisOperacao)} h`}
          detail={`Base de comparação: ${agregado.linhasSelecionadas.length} linha(s) × ${fmtHoras(HORAS_DIA)} h/dia`}
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Tempo disponível"
          value={`${fmtHoras(agregado.kpis.horasDisponivel)} h`}
          detail={`${fmtPct(agregado.kpis.disponibilidadePct)} do tempo esperado permaneceu disponível pela regra reconciliada`}
          icon={<TrainFront size={22} />}
        />
        <KpiCard
          label="Eventos especiais"
          value={`${fmtHoras(agregado.kpis.horasEventoEspecial)} h`}
          detail={`${fmtInt(agregado.kpis.qtdEventoEspecial)} registro(s); horas = operação/serviço adicional`}
          icon={<Trophy size={22} />}
        />
        <KpiCard
          label="Manutenção programada"
          value={`${fmtHoras(agregado.kpis.horasManutencaoProgramada)} h`}
          detail={`${fmtInt(agregado.kpis.qtdManutencaoProgramada)} intervenção(ões) planejada(s)`}
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Ocorrências operacionais"
          value={`${fmtHoras(agregado.kpis.horasFalhaParcial)} h`}
          detail={`${fmtInt(agregado.kpis.qtdFalhaParcial)} registro(s) de operação degradada`}
          icon={<AlertTriangle size={22} />}
        />
        <KpiCard
          label="Indisponível/paralisado"
          value={`${fmtHoras(agregado.kpis.horasFalhaTotal)} h`}
          detail={`${fmtInt(agregado.kpis.qtdFalhaTotal)} registro(s) em que a operação parou`}
          icon={<Gauge size={22} />}
        />
        <KpiCard
          label="Dados indisponíveis"
          value={fmtInt(agregado.kpis.qtdIndefinidos)}
          detail="registro(s) com lacuna de coleta; este indicador é apresentado apenas como quantidade"
          icon={<Gauge size={22} />}
        />
        <KpiCard
          label="Registros classificados"
          value={fmtInt(agregado.kpis.qtdFalhas)}
          detail="manutenções programadas, ocorrências operacionais e paralisações"
          icon={<ListChecks size={22} />}
        />
        <KpiCard
          label="Dia mais comum para falha"
          value={recorrenciaFalhas.diaLabel}
          detail={`${fmtInt(recorrenciaFalhas.diaQtd)} ocorrência(s) de falha no recorte atual`}
          icon={<AlertTriangle size={22} />}
        />
        <KpiCard
          label="Horário mais comum para falha"
          value={recorrenciaFalhas.horaLabel}
          detail={`${fmtInt(recorrenciaFalhas.horaQtd)} ocorrência(s) de falha no recorte atual`}
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Média disponível"
          value={`${fmtHoras(agregado.kpis.mediaHorasDisponivel)} h`}
          detail="média das janelas classificadas como operação normal"
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Média de operação degradada"
          value={`${fmtHoras(agregado.kpis.mediaHorasFalhaParcial)} h`}
          detail="duração média dos registros de operação degradada"
          icon={<AlertTriangle size={22} />}
        />
        <KpiCard
          label="Média de paralisação total"
          value={`${fmtHoras(agregado.kpis.mediaHorasIndisponibilidade)} h`}
          detail="duração média dos registros em que a operação parou"
          icon={<Gauge size={22} />}
        />
        <KpiCard
          label="Falha → falha"
          value={`${fmtHoras(agregado.kpis.mediaHorasAteNovaFalha)} h`}
          detail="tempo operacional médio entre uma ocorrência/falha e a próxima, na mesma linha"
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Manutenção ↔ falha"
          value={`${fmtHoras(agregado.kpis.mediaHorasEntreManutencaoFalha)} h`}
          detail="tempo operacional médio entre manutenção e ocorrência/falha, em qualquer sentido, na mesma linha"
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Manutenção → manutenção"
          value={`${fmtHoras(agregado.kpis.mediaHorasEntreManutencoes)} h`}
          detail="tempo operacional médio entre uma manutenção programada e a próxima, na mesma linha"
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Tipo mais comum"
          value={agregado.kpis.falhaMaisComum}
          detail={`${fmtInt(agregado.kpis.falhaMaisComumQtd)} ocorrência(s)`}
          icon={<ListChecks size={22} />}
        />
        <KpiCard
          label="Tipo menos comum"
          value={agregado.kpis.falhaMenosComum}
          detail={agregado.kpis.falhaMenosComumQtd ? `${fmtInt(agregado.kpis.falhaMenosComumQtd)} ocorrência(s)` : "não há outro tipo no recorte"}
          icon={<ListChecks size={22} />}
        />
      </section>

      <section className="grid-2">
        <div className="panel panel-focus">
          <h2>Distribuição do tempo operacional</h2>
          <p>
            Mostra a divisão das horas esperadas de operação. É a melhor leitura para entender a gravidade temporal: um evento longo pesa mais que um evento curto.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dadosGraficoDisponibilidade}
                dataKey="horas"
                nameKey="categoria"
                innerRadius={72}
                outerRadius={112}
                paddingAngle={2}
              >
                {dadosGraficoDisponibilidade.map((item) => (
                  <Cell key={item.categoria} fill={item.cor} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${fmtHoras(value)} h`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="panel panel-focus">
          <h2>Distribuição por quantidade</h2>
          <p>
            Mostra quantos registros ocorreram em cada categoria operacional. É útil para frequência, mas não mede gravidade: muitos eventos curtos podem somar menos horas que poucos eventos longos. Dados indisponíveis ficam separados para não distorcer a comparação entre operadores.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dadosGraficoDisponibilidade}
                dataKey="quantidade"
                nameKey="categoria"
                innerRadius={72}
                outerRadius={112}
                paddingAngle={2}
              >
                {dadosGraficoDisponibilidade.map((item) => (
                  <Cell key={item.categoria} fill={item.cor} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${fmtInt(value)} registro(s)`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <div className="panel">
          <h2>Ranking por linha · tempo</h2>
          <p>Ordena as linhas pelo maior tempo acumulado de manutenção programada, ocorrências operacionais e paralisações. Disponível e eventos especiais ficam fora desta leitura.</p>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart
              data={chartLinhasTempo}
              layout="vertical"
              margin={{ left: 95, right: 20, top: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(15, 23, 42, .12)"
              />
              <XAxis type="number" stroke="#475569" />
              <YAxis
                dataKey="nome"
                type="category"
                stroke="#475569"
                width={130}
              />
              <Tooltip formatter={(value: number) => `${fmtHoras(value)} h`} />
              <Legend />
              <Bar
                dataKey="horasManutencaoProgramada"
                stackId="a"
                name="Manutenção programada"
                fill={CORES["Manutenção programada"]}
              />
              <Bar
                dataKey="horasFalhaParcial"
                stackId="a"
                name="Ocorrências"
                fill={CORES["Ocorrência operacional"]}
              />
              <Bar
                dataKey="horasFalhaTotal"
                stackId="a"
                name="Falha total"
                fill={CORES["Falha total / paralisação"]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2>Ranking por linha · quantidade</h2>
          <p>Ordena as linhas pelo número de registros operacionais. Use junto com o ranking por tempo para separar frequência de gravidade.</p>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart
              data={chartLinhasQtd}
              layout="vertical"
              margin={{ left: 95, right: 20, top: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(15, 23, 42, .12)"
              />
              <XAxis type="number" stroke="#475569" />
              <YAxis
                dataKey="nome"
                type="category"
                stroke="#475569"
                width={130}
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="qtdManutencaoProgramada"
                stackId="q"
                name="Qtd. manutenção programada"
                fill={CORES["Manutenção programada"]}
              />
              <Bar
                dataKey="qtdFalhaParcial"
                stackId="q"
                name="Qtd. ocorrência operacional"
                fill={CORES["Ocorrência operacional"]}
              />
              <Bar
                dataKey="qtdFalhaTotal"
                stackId="q"
                name="Qtd. falha total"
                fill={CORES["Falha total / paralisação"]}
              />
              {incluirDadosIndisponiveisNosGraficos && (
                <Bar
                  dataKey="qtdIndefinidos"
                  stackId="q"
                  name="Qtd. dados indisponíveis"
                  fill={CORES["Indefinido"]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <div className="panel">
          <h2>Ranking por operador · tempo</h2>
          <p>Compara operadores pelo tempo acumulado de manutenção programada, ocorrências operacionais e paralisações. Dados indisponíveis ficam fora desta comparação principal; o nome completo aparece ao passar o mouse.</p>
          <ResponsiveContainer width="100%" height={operadorTempoChartHeight}>
            <BarChart
              data={chartOperadoresTempo}
              layout="vertical"
              margin={{ left: 24, right: 28, top: 10, bottom: 10 }}
              barCategoryGap={12}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(15, 23, 42, .12)"
              />
              <XAxis type="number" stroke="#475569" />
              <YAxis
                dataKey="nomeLabel"
                type="category"
                stroke="#475569"
                width={150}
                interval={0}
                tick={{ fontSize: 13, fontWeight: 650 }}
              />
              <Tooltip
                formatter={(value: number) => `${fmtHoras(value)} h`}
                labelFormatter={(_label, payload) =>
                  payload?.[0]?.payload?.nome ?? String(_label)
                }
              />
              <Legend />
              <Bar
                dataKey="horasManutencaoProgramada"
                stackId="tempoOperador"
                name="Manutenção programada"
                fill={CORES["Manutenção programada"]}
              />
              <Bar
                dataKey="horasFalhaParcial"
                stackId="tempoOperador"
                name="Ocorrências"
                fill={CORES["Ocorrência operacional"]}
              />
              <Bar
                dataKey="horasFalhaTotal"
                stackId="tempoOperador"
                name="Falha total"
                fill={CORES["Falha total / paralisação"]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2>Ranking por operador · quantidade</h2>
          <p>Compara operadores pela quantidade de registros operacionais. Essa visão mede frequência, não necessariamente duração.</p>
          <ResponsiveContainer width="100%" height={operadorQtdChartHeight}>
            <BarChart
              data={chartOperadoresQtd}
              layout="vertical"
              margin={{ left: 24, right: 28, top: 10, bottom: 10 }}
              barCategoryGap={12}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(15, 23, 42, .12)"
              />
              <XAxis type="number" stroke="#475569" allowDecimals={false} />
              <YAxis
                dataKey="nomeLabel"
                type="category"
                stroke="#475569"
                width={150}
                interval={0}
                tick={{ fontSize: 13, fontWeight: 650 }}
              />
              <Tooltip
                labelFormatter={(_label, payload) =>
                  payload?.[0]?.payload?.nome ?? String(_label)
                }
              />
              <Legend />
              <Bar
                dataKey="qtdManutencaoProgramada"
                stackId="qtdOperador"
                name="Qtd. manutenção programada"
                fill={CORES["Manutenção programada"]}
              />
              <Bar
                dataKey="qtdFalhaParcial"
                stackId="qtdOperador"
                name="Qtd. ocorrência operacional"
                fill={CORES["Ocorrência operacional"]}
              />
              <Bar
                dataKey="qtdFalhaTotal"
                stackId="qtdOperador"
                name="Qtd. falha total"
                fill={CORES["Falha total / paralisação"]}
              />
              {incluirDadosIndisponiveisNosGraficos && (
                <Bar
                  dataKey="qtdIndefinidos"
                  stackId="qtdOperador"
                  name="Qtd. dados indisponíveis"
                  fill={CORES["Indefinido"]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel time-scatter-panel" style={{ marginTop: 18 }}>
        <div className="panel-heading-row">
          <div>
            <h2>Mapa horário das ocorrências</h2>
            <p>
              Cada ponto representa um evento já submetido aos Filtros globais da página. O eixo horizontal mostra o dia do período; o eixo vertical mostra o horário de início dentro da janela operacional de 04h30 à meia-noite. As faixas destacadas indicam horários de maior sensibilidade: pico da manhã, pico estudantil/intermediário, pico da tarde/noite e pico estudantil noturno.
            </p>
          </div>
          <div className="occurrence-summary">
            <strong>{fmtInt(eventosMapaHorario.length)}</strong> evento(s)
          </div>
        </div>

        <div className="map-controls" aria-label="Filtros próprios do mapa horário">
          <div className="map-recorte-control">
            <span>Recorte de dias</span>
            <div className="segmented-control">
              <button
                type="button"
                className={recorteDiasMapa === "todos" ? "is-active" : ""}
                onClick={() => setRecorteDiasMapa("todos")}
              >
                Todos os dias
              </button>
              <button
                type="button"
                className={recorteDiasMapa === "uteis" ? "is-active" : ""}
                onClick={() => setRecorteDiasMapa("uteis")}
              >
                Somente dias úteis
              </button>
            </div>
          </div>

          <div className="local-filters-grid map-local-filters">
            <label>
              Linha
              <select value={linhaMapa} onChange={(event) => setLinhaMapa(event.target.value)}>
                <option value="todas">Todas as linhas do recorte global</option>
                {linhasTemporaisDisponiveis.map((item) => (
                  <option key={`mapa-linha-${item}`} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label>
              Operador
              <select value={operadorMapa} onChange={(e) => setOperadorMapa(e.target.value)}>
                <option value="todos">Todos os operadores</option>
                {operadoresMapaDisponiveis.map((item) => (
                  <option key={`map-operador-${item}`} value={item}>
                    {displayOperadorName(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Evento
              <select value={estadoMapa} onChange={(e) => setEstadoMapa(e.target.value)}>
                <option value="todos">Todos os eventos</option>
                {estadosMapaDisponiveis.map((item) => (
                  <option key={`map-estado-${item}`} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Origem
              <select value={origemMapa} onChange={(e) => setOrigemMapa(e.target.value)}>
                <option value="todas">Originários e cascatas</option>
                <option value="originario">Somente originários</option>
                <option value="cascata">Somente efeito cascata</option>
              </select>
            </label>
          </div>

          <small>Estes filtros refinam apenas o mapa horário. O histograma temporal abaixo tem seu próprio filtro de linha. Em toda a página, os Filtros globais são aplicados primeiro.</small>
        </div>

        <TimeScatterChart
          eventos={eventosMapaHorario}
          incluirDadosIndisponiveis={incluirDadosIndisponiveisNosGraficos}
          recorteDias={recorteDiasMapa}
        />
        <div className="chart-footnote scatter-footnote">
          <span className="legend-dot" style={{ background: CORES["Ocorrência operacional"] }} />
          Cor = categoria operacional. Tamanho do ponto = duração aproximada. Clique em um ponto para ver a ocorrência, a duração calculada e, quando houver, o efeito cascata associado a outra linha.
        </div>
        <div className="chart-footnote scatter-footnote scatter-disclaimer">
          <span className="legend-dot" style={{ background: CORES["Evento especial"] }} />
          As faixas de pico são referência de leitura: janeiro não considera pico estudantil e sábados/domingos não têm pico declarado. Em “Somente dias úteis”, as faixas ficam mais fortes para destacar os períodos críticos. O posicionamento do ponto usa sempre o horário de início do evento. Dados indisponíveis aparecem apenas quando esse status é selecionado no filtro global ou no filtro local de evento.
        </div>
      </section>

      <section className="panel availability-heatmap-panel" style={{ marginTop: 18 }}>
        <div className="panel-heading-row">
          <div>
            <h2>Histograma temporal de disponibilidade por linha</h2>
            <p>
              O eixo X percorre todos os dias do ano/período analisado. No eixo Y, cada linha metroferroviária é desdobrada em quatro faixas horárias da jornada operacional aberta de 04h30 à meia-noite. Operação normal é o padrão; se houver ocorrência no cruzamento dia × faixa horária, a célula assume a cor do evento dominante de maior criticidade.
            </p>
          </div>
        </div>
        <div className="local-filters-grid compact heatmap-local-filters">
          <label>
            Linha do histograma
            <select value={linhaHistograma} onChange={(event) => setLinhaHistograma(event.target.value)}>
              <option value="todas">Todas as linhas do recorte global</option>
              {linhasTemporaisDisponiveis.map((item) => (
                <option key={`histograma-linha-${item}`} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <small>
          Este filtro atua somente no histograma temporal. O mapa horário possui controle próprio logo acima.
        </small>
        <HeatmapDisponibilidade
          eventos={agregado.eventosFiltrados}
          linhaSelecionada={linhaHistograma}
        />
        <div className="chart-footnote scatter-footnote availability-heatmap-legend">
          <span className="legend-dot" style={{ background: CORES["Disponível"] }} /> Disponível
          <span className="legend-dot" style={{ background: CORES["Manutenção programada"] }} /> Manutenção
          <span className="legend-dot" style={{ background: CORES["Ocorrência operacional"] }} /> Ocorrência operacional
          <span className="legend-dot" style={{ background: CORES["Falha total / paralisação"] }} /> Falha total
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <div className="panel">
          <h2>Evolução mensal</h2>
          <p>Mostra a evolução mês a mês dos estados operacionais principais. Maio aparece menor porque a base vai somente até a data parcial informada, não até o fim do mês.</p>
          <ResponsiveContainer width="100%" height={310}>
            <LineChart
              data={agregado.mensal}
              margin={{ left: 10, right: 20, top: 10, bottom: 15 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(15, 23, 42, .12)"
              />
              <XAxis dataKey="mesLabel" stroke="#475569" />
              <YAxis stroke="#475569" />
              <Tooltip formatter={(value: number) => `${fmtHoras(value)} h`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="horasDisponivel"
                name="Disponível"
                stroke={CORES["Disponível"]}
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="horasEventoEspecial"
                name="Eventos especiais"
                stroke={CORES["Evento especial"]}
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="horasManutencaoProgramada"
                name="Manutenção programada"
                stroke={CORES["Manutenção programada"]}
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="horasFalhaParcial"
                name="Ocorrências"
                stroke={CORES["Ocorrência operacional"]}
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="horasFalhaTotal"
                name="Falha total"
                stroke={CORES["Falha total / paralisação"]}
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel-pro">
          <h2>Tipos de registro por tempo acumulado</h2>
          <p>Classifica somente manutenções programadas, ocorrências operacionais e paralisações. Evento especial e dados indisponíveis ficam fora desta leitura para não confundir serviço ofertado com interrupções ou restrições.</p>
          <div className="problem-ranking problem-ranking--hours" role="list">
            {chartProblemas.map((item) => {
              const maxHoras = Math.max(
                ...chartProblemas.map((problema) => problema.horas),
                1,
              );
              const width = Math.max((item.horas / maxHoras) * 100, 2);
              return (
                <div
                  className="problem-row"
                  role="listitem"
                  key={item.categoria}
                >
                  <div className="problem-label" title={item.categoria}>
                    {item.categoria}
                  </div>
                  <div
                    className="problem-bar-wrap"
                    aria-label={`${item.categoria}: ${fmtHoras(item.horas)} horas e ${fmtInt(item.qtd)} ocorrência(s)`}
                  >
                    <span
                      className="problem-bar"
                      style={{
                        width: `${width}%`,
                        background: corProblema(item.categoria),
                      }}
                    />
                    <strong>{fmtHoras(item.horas)} h</strong>
                  </div>
                  <div className="problem-hours">{fmtInt(item.qtd)} ocorrência(s)</div>
                </div>
              );
            })}
          </div>
          <div className="chart-footnote">
            <span
              className="legend-dot"
              style={{ background: CORES["Ocorrência operacional"] }}
            />
            Barra = horas acumuladas do tipo de registro. Texto à direita = quantidade de registros daquele tipo.
          </div>
        </div>
      </section>

      <section className="panel word-cloud-panel" style={{ marginTop: 18 }}>
        <div className="panel-heading-row">
          <div>
            <h2>Nuvem de palavras</h2>
            <p>
              Mostra os termos que mais aparecem nas descrições úteis dos eventos. O tamanho indica frequência; a cor indica o estado operacional em que a palavra mais apareceu.
            </p>
          </div>
          <div className="occurrence-summary">
            <strong>{fmtInt(agregado.palavras.length)}</strong> termo(s)
          </div>
        </div>
        <div className="word-cloud" aria-label="Nuvem de palavras das ocorrências">
          {agregado.palavras.map((item, index) => {
            const maiorQtd = Math.max(...agregado.palavras.map((palavra) => palavra.qtd), 1);
            const size = 14 + Math.round((item.qtd / maiorQtd) * 24);
            return (
              <span
                key={`${item.palavra}-${index}`}
                style={{ color: item.cor, fontSize: `${size}px` }}
                title={`${item.palavra}: ${fmtInt(item.qtd)} ocorrência(s). Estado mais comum: ${item.estadoMaisComum}`}
              >
                {item.palavra}
              </span>
            );
          })}
        </div>
        <div className="chart-footnote word-cloud-footnote">
          <span className="legend-dot" style={{ background: CORES["Ocorrência operacional"] }} />
          A nuvem ignora palavras muito comuns, operação normal, operação encerrada e dados indisponíveis, para destacar termos com significado operacional.
        </div>
      </section>

      <section
        className="panel analytics-table-panel"
        style={{ marginTop: 18 }}
      >
        <div className="panel-heading-row">
          <div>
            <h2>Tabela analítica por linha</h2>
            <p>
              Resume cada linha em uma só tabela: tempo disponível, eventos especiais, manutenções, ocorrências, paralisações, dados indisponíveis, média até uma nova ocorrência e total de registros classificados. Primeiro entram os filtros globais; depois entram os filtros próprios desta tabela.
            </p>
          </div>
          <div className="occurrence-summary">
            <strong>{fmtInt(linhasFiltradas.length)}</strong> linha(s)
            exibida(s)
          </div>
        </div>

        <div className="local-filters-grid table-local-filters">
          <label>
            Pesquisar na tabela
            <input
              value={buscaTabela}
              onChange={(event) => setBuscaTabela(event.target.value)}
              placeholder="Linha ou operador..."
            />
          </label>
          <label>
            Operador da tabela
            <select
              value={operadorTabela}
              onChange={(event) => setOperadorTabela(event.target.value)}
            >
              <option value="todos">Todos no recorte global</option>
              {operadoresTabelaDisponiveis.map((item) => (
                <option key={item} value={item}>
                  {displayOperadorName(item)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Recorte da tabela
            <select
              value={statusTabela}
              onChange={(event) => setStatusTabela(event.target.value)}
            >
              <option value="todos">Todas as linhas do recorte global</option>
              <option value="com_falhas">Somente linhas com registros classificados</option>
              <option value="com_paralisacao">
                Somente linhas com paralisação
              </option>
              <option value="sem_falhas">Somente linhas sem falhas</option>
              <option value="com_dados_indisponiveis">
                Somente linhas com dados indisponíveis
              </option>
            </select>
          </label>
          <label>
            Ordenação da tabela
            <select
              value={ordenacao}
              onChange={(event) =>
                setOrdenacao(event.target.value as Ordenacao)
              }
            >
              <option value="tempo">Maior tempo com falha</option>
              <option value="quantidade">Quantidade absoluta de registros classificados</option>
              <option value="disponibilidade">Menor disponibilidade</option>
              <option value="paralisacao">Maior tempo parado</option>
            </select>
          </label>
        </div>

        <RankingTable rows={linhasFiltradas} />
      </section>


      <section className="panel occurrence-panel" style={{ marginTop: 18 }}>
        <div className="panel-heading-row occurrence-heading-row">
          <div>
            <h2>Lista pesquisável de falhas e paralisações</h2>
            <p>
              Lista detalhada dos registros classificados, do mais recente para o mais antigo. Os filtros abaixo atuam somente nesta lista, sempre dentro do recorte definido pelos filtros globais.
            </p>
          </div>
        </div>
        <div className="occurrence-tools occurrence-tools-wide">
          <label className="occurrence-search">
            <Search size={16} />
            <input
              value={buscaOcorrencia}
              onChange={(event) => setBuscaOcorrencia(event.target.value)}
              placeholder="Pesquisar por descrição, tipo, linha, operador ou status..."
            />
          </label>
          <div className="local-filters-grid occurrence-local-filters">
            <label>
              Linha
              <select
                value={linhaOcorrencia}
                onChange={(event) => setLinhaOcorrencia(event.target.value)}
              >
                <option value="todas">Todas no recorte global</option>
                {linhasOcorrenciaDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Operador
              <select
                value={operadorOcorrencia}
                onChange={(event) =>
                  setOperadorOcorrencia(event.target.value)
                }
              >
                <option value="todos">Todos no recorte global</option>
                {operadoresOcorrenciaDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {displayOperadorName(item)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select
                value={estadoOcorrencia}
                onChange={(event) => setEstadoOcorrencia(event.target.value)}
              >
                <option value="todos">Todos no recorte global</option>
                {estadosOcorrenciaDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo identificado
              <select
                value={tipoOcorrencia}
                onChange={(event) => setTipoOcorrencia(event.target.value)}
              >
                <option value="todos">Todos os tipos</option>
                {tiposOcorrenciaDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Origem
              <select
                value={origemOcorrencia}
                onChange={(event) => setOrigemOcorrencia(event.target.value)}
              >
                <option value="todas">Originários e cascatas</option>
                <option value="originario">Somente originários</option>
                <option value="cascata">Somente efeito cascata</option>
              </select>
            </label>
          </div>
        </div>
        <div className="occurrence-summary">
          <strong>{fmtInt(eventosProblema.length)}</strong> ocorrência(s)
          encontrada(s)
          {buscaOcorrencia ? <span> para “{buscaOcorrencia}”</span> : null}
          <span> · filtros locais aplicados depois dos filtros globais</span>
        </div>
        <PaginatedOccurrenceTable
          rows={eventosProblema}
          label="ocorrência(s)"
          emptyColSpan={8}
          emptyMessage="Nenhum registro encontrado com os filtros atuais."
          columns={(
            <tr>
              <th>Data/hora</th>
              <th>Linha</th>
              <th>Operador</th>
              <th>Estado</th>
              <th>Tipo identificado</th>
              <th>Status original</th>
              <th>Duração</th>
              <th>Descrição</th>
            </tr>
          )}
          renderRow={(evento: EventoComTipo) => (
            <tr key={`${evento.id}-${evento.dataHora}-${evento.linha}`}>
              <td className="nowrap">{evento.dataLabel}</td>
              <td>
                <strong>{evento.linha}</strong>
              </td>
              <td className="muted">{displayOperadorName(evento.operador)}</td>
              <td>
                <span
                  className="state-chip"
                  style={{
                    borderColor: CORES[evento.estado] ?? evento.cor,
                    background: `${CORES[evento.estado] ?? evento.cor}22`,
                  }}
                >
                  {evento.estado}
                </span>
              </td>
              <td>
                <strong>{evento.tipoFalha}</strong>
                {evento.efeitoCascata ? (
                  <span className="table-subvalue cascade-table-note">{labelOrigemEvento(evento)}</span>
                ) : null}
              </td>
              <td className="muted">{evento.status}</td>
              <td className="nowrap">{fmtHoras(getHorasContabilizadas(evento))} h</td>
              <td className="description-cell">{evento.descricaoBase}</td>
            </tr>
          )}
        />
      </section>
      <details className="panel occurrence-panel collapsed-panel" style={{ marginTop: 18 }}>
        <summary className="collapsed-summary">
          <div>
            <h2>Operações encerradas</h2>
            <p>
              Registros usados para identificar quando a linha encerrou a operação. Eles ficam separados porque não representam, por si só, uma falha operacional.
            </p>
          </div>
          <div className="occurrence-summary">
            <strong>{fmtInt(eventosEncerramento.length)}</strong>{" "}
            encerramento(s) encontrado(s)
          </div>
        </summary>
        <div className="collapsed-content">
          <PaginatedOccurrenceTable
            rows={eventosEncerramento}
            label="encerramento(s)"
            emptyColSpan={7}
            emptyMessage="Nenhum registro de operação encerrada encontrado com os filtros atuais."
            columns={(
              <tr>
                <th>Data/hora</th>
                <th>Linha</th>
                <th>Operador</th>
                <th>Status</th>
                <th>Próximo status estimado</th>
                <th>Intervalo até próximo status</th>
                <th>Descrição</th>
              </tr>
            )}
            renderRow={(evento: EventoComTimestamp) => (
              <tr key={`enc-${evento.id}-${evento.dataHora}-${evento.linha}`}>
                <td className="nowrap">{evento.dataLabel}</td>
                <td>
                  <strong>{evento.linha}</strong>
                </td>
                <td className="muted">{displayOperadorName(evento.operador)}</td>
                <td>
                  <span
                    className="state-chip"
                    style={{
                      borderColor: CORES["Operação encerrada"],
                      background: `${CORES["Operação encerrada"]}22`,
                    }}
                  >
                    {evento.status}
                  </span>
                </td>
                <td className="nowrap">{evento.fechamentoAteLabel ?? "—"}</td>
                <td className="nowrap">
                  {fmtHoras(evento.horasAteProximoStatus ?? 0)} h
                </td>
                <td className="description-cell">
                  {getDescricaoBase(evento)}
                </td>
              </tr>
            )}
          />
        </div>
      </details>

      <details className="panel occurrence-panel collapsed-panel" style={{ marginTop: 18 }}>
        <summary className="collapsed-summary">
          <div>
            <h2>Eventos especiais</h2>
            <p>
              Registros de operação especial, reforço de serviço ou atendimento a eventos. Eles ficam separados porque representam serviço ofertado, não falha operacional.
            </p>
          </div>
          <div className="occurrence-summary">
            <strong>{fmtInt(eventosEspeciais.length)}</strong>{" "}
            evento(s) especial(is) encontrado(s)
          </div>
        </summary>
        <div className="collapsed-content">
          <PaginatedOccurrenceTable
            rows={eventosEspeciais}
            label="evento(s) especial(is)"
            emptyColSpan={6}
            emptyMessage="Nenhum evento especial encontrado com os filtros atuais."
            columns={(
              <tr>
                <th>Data/hora</th>
                <th>Linha</th>
                <th>Operador</th>
                <th>Status</th>
                <th>Duração</th>
                <th>Descrição</th>
              </tr>
            )}
            renderRow={(evento: EventoComTimestamp) => (
              <tr key={`esp-${evento.id}-${evento.dataHora}-${evento.linha}`}>
                <td className="nowrap">{evento.dataLabel}</td>
                <td>
                  <strong>{evento.linha}</strong>
                </td>
                <td className="muted">{displayOperadorName(evento.operador)}</td>
                <td>
                  <span
                    className="state-chip"
                    style={{
                      borderColor: CORES["Evento especial"],
                      background: `${CORES["Evento especial"]}22`,
                    }}
                  >
                    {evento.status}
                  </span>
                </td>
                <td className="nowrap">{fmtHoras(getHorasContabilizadas(evento))} h</td>
                <td className="description-cell">
                  {getDescricaoBase(evento)}
                </td>
              </tr>
            )}
          />
        </div>
      </details>


    </main>
  );
}
