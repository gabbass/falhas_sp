"use client";

import data from "../data/ocorrencias-summary.json";
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
  YAxis
} from "recharts";
import { AlertTriangle, Clock3, Filter, Gauge, ListChecks, Search, TrainFront, Trophy, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

type EstadoOperacional = "Disponível" | "Evento especial" | "Com falha ou parcial" | "Falha total / paralisação" | "Dados/Status indisponíveis" | "Operação encerrada";
type Ordenacao = "tempo" | "quantidade" | "disponibilidade" | "paralisacao";

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
  meses: Record<string, number>;
};

type LinhaRanking = {
  nome: string;
  operador?: string;
  linhasOperadas?: number;
  horasTotaisOperacao: number;
  horasDisponivel: number;
  horasEventoEspecial: number;
  horasFalhaParcial: number;
  horasFalhaTotal: number;
  horasDadosIndisponiveis: number;
  horasFalha: number;
  qtdRegistros: number;
  qtdDisponivel: number;
  qtdEventoEspecial: number;
  qtdFalhaParcial: number;
  qtdFalhaTotal: number;
  qtdDadosIndisponiveis: number;
  qtdFalhas: number;
  qtdEncerramentos: number;
  disponibilidadePct: number;
  falhaParcialPct: number;
  falhaTotalPct: number;
  impactoPct: number;
};

type Problema = {
  categoria: string;
  qtd: number;
  horas: number;
};

type EventoComTipo = Evento & {
  tipoFalha: string;
  descricaoBase: string;
  timestamp: number;
};

type Mensal = {
  mes: string;
  mesLabel: string;
  horasDisponivel: number;
  horasEventoEspecial: number;
  horasFalhaParcial: number;
  horasFalhaTotal: number;
  horasDadosIndisponiveis: number;
  qtdDisponivel: number;
  qtdEventoEspecial: number;
  qtdFalhaParcial: number;
  qtdFalhaTotal: number;
  qtdDadosIndisponiveis: number;
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
    horasFalhaParcial: number;
    horasFalhaTotal: number;
    horasDadosIndisponiveis: number;
    horasFalha: number;
    qtdDisponivel: number;
    qtdEventoEspecial: number;
    qtdFalhaParcial: number;
    qtdFalhaTotal: number;
    qtdDadosIndisponiveis: number;
    qtdFalhas: number;
    qtdEncerramentos: number;
    disponibilidadePct: number;
    impactoPct: number;
    mediaHorasDisponivel: number;
    mediaHorasEventoEspecial: number;
    mediaHorasFalhaParcial: number;
    mediaHorasIndisponibilidade: number;
    mediaHorasAteNovaFalha: number;
    falhaMaisComum: string;
    falhaMaisComumQtd: number;
    falhaMenosComum: string;
    falhaMenosComumQtd: number;
  };
  linhas: LinhaRanking[];
  operadores: LinhaRanking[];
  problemas: Problema[];
  mensal: Mensal[];
  disponibilidadeGeral: Distribuicao[];
  eventosFiltrados: Evento[];
  linhasSelecionadas: string[];
};

const CORES: Record<EstadoOperacional, string> = {
  Disponível: "#007A5E",
  "Evento especial": "#1C2C8C",
  "Com falha ou parcial": "#FFD200",
  "Falha total / paralisação": "#EE2E3B",
  "Dados/Status indisponíveis": "#94A3B8",
  "Operação encerrada": "#64748B"
};

const HORAS_DIA = data.metadata.horasOperacaoDiaPorLinha;
const HORAS_ANO_LINHA = data.metadata.horasOperacaoPeriodoPorLinha ?? data.metadata.horasOperacaoAnoPorLinha;
const EVENTOS = data.events as Evento[];
const LINHAS = data.options.linhas as string[];
const OPERADORES = data.options.operadores as string[];
const ESTADOS = data.options.estados as EstadoOperacional[];
const MESES = (data.series.mensal as Mensal[]).map((mes) => ({
  key: mes.mes,
  label: mes.mesLabel,
  horasEsperadasPorLinha: mes.horasEsperadasPorLinha
}));

const fmtHoras = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);

const fmtPct = (n: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n)}%`;

const fmtInt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

type RegraTipoFalha = {
  tipo: string;
  termos: string[];
};

const REGRAS_TIPO_FALHA: RegraTipoFalha[] = [
  { tipo: "Dados/Status indisponíveis", termos: ["dados indisponiveis", "status indisponivel", "status indisponiveis"] },
  { tipo: "Descarrilamento", termos: ["descarrilamento", "descarrilou"] },
  { tipo: "Alagamento / clima", termos: ["alagamento", "condicoes climaticas", "chuva", "chuvas", "ventos fortes", "queda de arvore", "arvore"] },
  { tipo: "Rede aérea / energia", termos: ["rede aerea", "sistema de energia", "energia", "alimentacao eletrica", "subestacao"] },
  { tipo: "Sinalização / controle", termos: ["sinalizacao", "controle", "cbtc", "atc", "sistema de sinalizacao"] },
  { tipo: "Equipamento de via", termos: ["equipamento de via", "equipamentos de via", "via permanente", "aparelho de mudanca", "amv"] },
  { tipo: "Material rodante / trem", termos: ["falha em trem", "problema com trem", "intercorrencia com um trem", "carro de um trem", "material rodante", "composicao"] },
  { tipo: "Interferência externa / vandalismo", termos: ["terceiros", "vandalismo", "interferencia externa", "interferencia por terceiros"] },
  { tipo: "Pessoa ou objeto na via", termos: ["pessoa na via", "objeto na via", "usuario na via", "presenca de pessoa", "presenca de objeto"] },
  { tipo: "Manutenção / atividade programada", termos: ["manutencao programada", "atividade programada", "obras programadas", "servicos programados"] },
  { tipo: "Operação parcial / trecho interrompido", termos: ["operacao parcial", "circulacao interrompida", "interrompida", "interrompido", "sem circulacao", "temporariamente suspensa", "suspensa", "via unica", "paese"] },
  { tipo: "Velocidade reduzida / maior parada", termos: ["velocidade reduzida", "maior tempo de parada", "tempo de parada"] },
  { tipo: "Maiores intervalos", termos: ["maiores intervalos", "maior intervalo"] },
  { tipo: "Problemas técnicos", termos: ["problemas tecnicos", "problema tecnico", "intercorrencia", "falha"] }
];

function inferTipoFalha(evento: Evento): string {
  const descricaoBase = (evento.descricao || evento.status || "").trim();
  const texto = normalizeText(`${descricaoBase} ${evento.status ?? ""}`);

  for (const regra of REGRAS_TIPO_FALHA) {
    if (regra.termos.some((termo) => texto.includes(termo))) return regra.tipo;
  }

  return evento.estado === "Falha total / paralisação" ? "Paralisação sem causa detalhada" : "Falha sem causa detalhada";
}

function getDescricaoBase(evento: Evento): string {
  const descricao = (evento.descricao || "").trim();
  return descricao || evento.status || "Sem descrição informada";
}

function isDadosStatusIndisponiveis(evento: Evento): boolean {
  const texto = normalizeText(`${evento.status ?? ""} ${evento.descricao ?? ""}`);
  return texto.includes("dados indisponiveis") || texto.includes("status indisponivel") || texto.includes("status indisponiveis");
}

function temDescricaoUtil(evento: Evento): boolean {
  const descricao = (evento.descricao || "").trim();
  const descricaoNormalizada = normalizeText(descricao);
  if (!descricaoNormalizada) return false;
  if (descricaoNormalizada === "operacao normal") return false;
  if (descricaoNormalizada === "operacao encerrada") return false;
  if (isDadosStatusIndisponiveis(evento)) return false;
  return true;
}


const lineToOperator = new Map<string, string>(
  (data.rankings.linhas as LinhaRanking[]).map((linha) => [linha.nome, linha.operador ?? "Não informado"])
);

function createEmptyRow(nome: string, operador?: string, linhasOperadas = 1): LinhaRanking {
  return {
    nome,
    operador,
    linhasOperadas,
    horasTotaisOperacao: linhasOperadas * HORAS_ANO_LINHA,
    horasDisponivel: 0,
    horasEventoEspecial: 0,
    horasFalhaParcial: 0,
    horasFalhaTotal: 0,
    horasDadosIndisponiveis: 0,
    horasFalha: 0,
    qtdRegistros: 0,
    qtdDisponivel: 0,
    qtdEventoEspecial: 0,
    qtdFalhaParcial: 0,
    qtdFalhaTotal: 0,
    qtdDadosIndisponiveis: 0,
    qtdFalhas: 0,
    qtdEncerramentos: 0,
    disponibilidadePct: 0,
    falhaParcialPct: 0,
    falhaTotalPct: 0,
    impactoPct: 0
  };
}

function isFalha(evento: Evento): boolean {
  return evento.estado === "Com falha ou parcial" || evento.estado === "Falha total / paralisação";
}

function applyEventToRow(row: LinhaRanking, evento: Evento) {
  row.qtdRegistros += 1;

  if (evento.estado === "Disponível") {
    row.qtdDisponivel += 1;
    row.horasDisponivel += evento.horas;
    return;
  }

  if (evento.estado === "Evento especial") {
    row.qtdEventoEspecial += 1;
    row.horasEventoEspecial += evento.horas;
    return;
  }

  if (evento.estado === "Com falha ou parcial") {
    row.qtdFalhaParcial += 1;
    row.horasFalhaParcial += evento.horas;
    return;
  }

  if (evento.estado === "Falha total / paralisação") {
    row.qtdFalhaTotal += 1;
    row.horasFalhaTotal += evento.horas;
    return;
  }

  if (evento.estado === "Dados/Status indisponíveis") {
    row.qtdDadosIndisponiveis += 1;
    row.horasDadosIndisponiveis += evento.horas;
    return;
  }

  row.qtdEncerramentos += 1;
}

function finalizeRow(row: LinhaRanking, statusSelecionado: string): LinhaRanking {
  const total = Math.max(row.horasTotaisOperacao, 1);

  if (statusSelecionado === "todos") {
    row.horasDisponivel = Math.max(row.horasTotaisOperacao - row.horasEventoEspecial - row.horasFalhaParcial - row.horasFalhaTotal - row.horasDadosIndisponiveis, 0);
  }

  if (statusSelecionado === "Disponível") {
    row.horasDisponivel = row.horasTotaisOperacao;
    row.horasEventoEspecial = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasDadosIndisponiveis = 0;
  }

  if (statusSelecionado === "Evento especial") {
    row.horasDisponivel = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasDadosIndisponiveis = 0;
  }

  if (statusSelecionado === "Com falha ou parcial") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasFalhaTotal = 0;
    row.horasDadosIndisponiveis = 0;
  }

  if (statusSelecionado === "Falha total / paralisação") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasFalhaParcial = 0;
    row.horasDadosIndisponiveis = 0;
  }

  if (statusSelecionado === "Dados/Status indisponíveis") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
  }

  if (statusSelecionado === "Operação encerrada") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasDadosIndisponiveis = 0;
  }

  row.horasDisponivel = round3(row.horasDisponivel);
  row.horasEventoEspecial = round3(row.horasEventoEspecial);
  row.horasFalhaParcial = round3(row.horasFalhaParcial);
  row.horasFalhaTotal = round3(row.horasFalhaTotal);
  row.horasDadosIndisponiveis = round3(row.horasDadosIndisponiveis);
  row.horasFalha = round3(row.horasFalhaParcial + row.horasFalhaTotal);
  row.qtdFalhas = row.qtdFalhaParcial + row.qtdFalhaTotal;
  row.disponibilidadePct = round3(((row.horasDisponivel + row.horasEventoEspecial) / total) * 100);
  row.falhaParcialPct = round3((row.horasFalhaParcial / total) * 100);
  row.falhaTotalPct = round3((row.horasFalhaTotal / total) * 100);
  row.impactoPct = round3((row.horasFalha / total) * 100);

  return row;
}

function calcMediaEntreFalhas(eventos: Evento[]): number {
  const falhasPorLinha = new Map<string, Evento[]>();

  eventos.filter(isFalha).forEach((evento) => {
    falhasPorLinha.set(evento.linha, [...(falhasPorLinha.get(evento.linha) ?? []), evento]);
  });

  const intervalos: number[] = [];
  falhasPorLinha.forEach((falhas) => {
    const ordenadas = [...falhas].sort((a, b) => (Date.parse(a.dataHora) || 0) - (Date.parse(b.dataHora) || 0));
    for (let i = 1; i < ordenadas.length; i += 1) {
      const anterior = Date.parse(ordenadas[i - 1].dataHora) || 0;
      const atual = Date.parse(ordenadas[i].dataHora) || 0;
      const horas = (atual - anterior) / 36e5;
      if (Number.isFinite(horas) && horas > 0) intervalos.push(horas);
    }
  });

  if (!intervalos.length) return 0;
  return round3(intervalos.reduce((sum, item) => sum + item, 0) / intervalos.length);
}

function aggregateData(filtros: { linha: string; operador: string; status: string }): Agregado {
  const linhasPermitidas = LINHAS.filter((linha) => {
    const operadorLinha = lineToOperator.get(linha) ?? "Não informado";
    return (filtros.linha === "todas" || filtros.linha === linha) &&
      (filtros.operador === "todos" || filtros.operador === operadorLinha);
  });

  const linhasSet = new Set(linhasPermitidas);
  const eventosFiltrados = EVENTOS.filter((evento) => {
    return linhasSet.has(evento.linha) &&
      (filtros.status === "todos" || filtros.status === evento.estado);
  });

  const linhasMap = new Map<string, LinhaRanking>();
  linhasPermitidas.forEach((linha) => {
    linhasMap.set(linha, createEmptyRow(linha, lineToOperator.get(linha) ?? "Não informado"));
  });

  const operadoresMap = new Map<string, LinhaRanking>();
  const linhasPorOperador = new Map<string, string[]>();
  linhasPermitidas.forEach((linha) => {
    const operadorLinha = lineToOperator.get(linha) ?? "Não informado";
    linhasPorOperador.set(operadorLinha, [...(linhasPorOperador.get(operadorLinha) ?? []), linha]);
  });
  linhasPorOperador.forEach((linhas, operador) => {
    operadoresMap.set(operador, createEmptyRow(operador, undefined, linhas.length));
  });

  const problemasMap = new Map<string, Problema>();
  const mensalMap = new Map<string, Mensal>();
  MESES.forEach((mes) => {
    mensalMap.set(mes.key, {
      mes: mes.key,
      mesLabel: mes.label,
      horasEsperadasPorLinha: mes.horasEsperadasPorLinha,
      horasDisponivel: 0,
      horasEventoEspecial: 0,
      horasFalhaParcial: 0,
      horasFalhaTotal: 0,
      horasDadosIndisponiveis: 0,
      qtdDisponivel: 0,
      qtdEventoEspecial: 0,
      qtdFalhaParcial: 0,
      qtdFalhaTotal: 0,
      qtdDadosIndisponiveis: 0,
      qtdEncerramentos: 0
    });
  });

  eventosFiltrados.forEach((evento) => {
    const linha = linhasMap.get(evento.linha);
    if (linha) applyEventToRow(linha, evento);

    const operador = operadoresMap.get(lineToOperator.get(evento.linha) ?? evento.operador);
    if (operador) applyEventToRow(operador, evento);

    if (isFalha(evento) && temDescricaoUtil(evento)) {
      const categoria = inferTipoFalha(evento);
      if (categoria === "Dados/Status indisponíveis") return;
      const problema = problemasMap.get(categoria) ?? { categoria, qtd: 0, horas: 0 };
      problema.qtd += 1;
      problema.horas += evento.horas;
      problemasMap.set(categoria, problema);
    }

    Object.entries(evento.meses).forEach(([mes, horas]) => {
      const row = mensalMap.get(mes);
      if (!row) return;
      if (evento.estado === "Disponível") row.horasDisponivel += horas;
      if (evento.estado === "Evento especial") row.horasEventoEspecial += horas;
      if (evento.estado === "Com falha ou parcial") row.horasFalhaParcial += horas;
      if (evento.estado === "Falha total / paralisação") row.horasFalhaTotal += horas;
      if (evento.estado === "Dados/Status indisponíveis") row.horasDadosIndisponiveis += horas;
    });

    const rowMes = mensalMap.get(evento.mes);
    if (rowMes) {
      if (evento.estado === "Disponível") rowMes.qtdDisponivel += 1;
      if (evento.estado === "Evento especial") rowMes.qtdEventoEspecial += 1;
      if (evento.estado === "Com falha ou parcial") rowMes.qtdFalhaParcial += 1;
      if (evento.estado === "Falha total / paralisação") rowMes.qtdFalhaTotal += 1;
      if (evento.estado === "Dados/Status indisponíveis") rowMes.qtdDadosIndisponiveis += 1;
      if (evento.estado === "Operação encerrada") rowMes.qtdEncerramentos += 1;
    }
  });

  const linhas = [...linhasMap.values()].map((row) => finalizeRow(row, filtros.status));
  const operadores = [...operadoresMap.values()].map((row) => finalizeRow(row, filtros.status));

  const horasTotaisOperacao = linhasPermitidas.length * HORAS_ANO_LINHA;
  const horasEventoEspecial = round3(linhas.reduce((total, linha) => total + linha.horasEventoEspecial, 0));
  const horasFalhaParcial = round3(linhas.reduce((total, linha) => total + linha.horasFalhaParcial, 0));
  const horasFalhaTotal = round3(linhas.reduce((total, linha) => total + linha.horasFalhaTotal, 0));
  const horasDadosIndisponiveis = round3(linhas.reduce((total, linha) => total + linha.horasDadosIndisponiveis, 0));
  let horasDisponivel = round3(linhas.reduce((total, linha) => total + linha.horasDisponivel, 0));

  if (filtros.status === "todos") {
    horasDisponivel = round3(Math.max(horasTotaisOperacao - horasEventoEspecial - horasFalhaParcial - horasFalhaTotal - horasDadosIndisponiveis, 0));
  }

  if (filtros.status === "Disponível") horasDisponivel = horasTotaisOperacao;
  if (filtros.status !== "todos" && filtros.status !== "Disponível") horasDisponivel = linhas.reduce((total, linha) => total + linha.horasDisponivel, 0);

  const qtdDisponivel = eventosFiltrados.filter((evento) => evento.estado === "Disponível").length;
  const qtdEventoEspecial = eventosFiltrados.filter((evento) => evento.estado === "Evento especial").length;
  const qtdFalhaParcial = eventosFiltrados.filter((evento) => evento.estado === "Com falha ou parcial").length;
  const qtdFalhaTotal = eventosFiltrados.filter((evento) => evento.estado === "Falha total / paralisação").length;
  const qtdDadosIndisponiveis = eventosFiltrados.filter((evento) => evento.estado === "Dados/Status indisponíveis").length;
  const qtdEncerramentos = eventosFiltrados.filter((evento) => evento.estado === "Operação encerrada").length;
  const horasFalha = round3(horasFalhaParcial + horasFalhaTotal);

  const mensal = [...mensalMap.values()].map((row) => {
    const mesInfo = MESES.find((mes) => mes.key === row.mes);
    const esperadoMes = (mesInfo?.horasEsperadasPorLinha ?? HORAS_ANO_LINHA) * linhasPermitidas.length;

    if (filtros.status === "todos") {
      row.horasDisponivel = Math.max(esperadoMes - row.horasEventoEspecial - row.horasFalhaParcial - row.horasFalhaTotal - row.horasDadosIndisponiveis, 0);
    }

    if (filtros.status === "Disponível") {
      row.horasDisponivel = esperadoMes;
      row.horasEventoEspecial = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasDadosIndisponiveis = 0;
    }

    if (filtros.status === "Evento especial") {
      row.horasDisponivel = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasDadosIndisponiveis = 0;
    }

    if (filtros.status === "Com falha ou parcial") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasFalhaTotal = 0;
      row.horasDadosIndisponiveis = 0;
    }

    if (filtros.status === "Falha total / paralisação") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasFalhaParcial = 0;
      row.horasDadosIndisponiveis = 0;
    }

    if (filtros.status === "Dados/Status indisponíveis") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
    }

    if (filtros.status === "Operação encerrada") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasDadosIndisponiveis = 0;
    }

    row.horasDisponivel = round3(row.horasDisponivel);
    row.horasEventoEspecial = round3(row.horasEventoEspecial);
    row.horasFalhaParcial = round3(row.horasFalhaParcial);
    row.horasFalhaTotal = round3(row.horasFalhaTotal);
    row.horasDadosIndisponiveis = round3(row.horasDadosIndisponiveis);
    return row;
  });

  const disponibilidadeBase: Distribuicao[] = [
    { categoria: "Disponível", horas: horasDisponivel, quantidade: qtdDisponivel, cor: CORES["Disponível"] },
    { categoria: "Evento especial", horas: horasEventoEspecial, quantidade: qtdEventoEspecial, cor: CORES["Evento especial"] },
    { categoria: "Com falha ou parcial", horas: horasFalhaParcial, quantidade: qtdFalhaParcial, cor: CORES["Com falha ou parcial"] },
    { categoria: "Falha total / paralisação", horas: horasFalhaTotal, quantidade: qtdFalhaTotal, cor: CORES["Falha total / paralisação"] },
    { categoria: "Dados/Status indisponíveis", horas: horasDadosIndisponiveis, quantidade: qtdDadosIndisponiveis, cor: CORES["Dados/Status indisponíveis"] }
  ];

  const disponibilidadeGeral = disponibilidadeBase.filter((item) => filtros.status === "todos" || item.categoria === filtros.status);
  const problemas = [...problemasMap.values()].map((item) => ({ ...item, horas: round3(item.horas) })).sort((a, b) => b.qtd - a.qtd || b.horas - a.horas);
  const problemaMenosComum = [...problemas].sort((a, b) => a.qtd - b.qtd || a.horas - b.horas)[0];
  const problemaMaisComum = problemas[0];
  const mediaHorasAteNovaFalha = calcMediaEntreFalhas(eventosFiltrados);

  return {
    kpis: {
      horasTotaisOperacao: round3(horasTotaisOperacao),
      horasDisponivel,
      horasEventoEspecial,
      horasFalhaParcial,
      horasFalhaTotal,
      horasDadosIndisponiveis,
      horasFalha,
      qtdDisponivel,
      qtdEventoEspecial,
      qtdFalhaParcial,
      qtdFalhaTotal,
      qtdDadosIndisponiveis,
      qtdFalhas: qtdFalhaParcial + qtdFalhaTotal,
      qtdEncerramentos,
      disponibilidadePct: round3(((horasDisponivel + horasEventoEspecial) / Math.max(horasTotaisOperacao, 1)) * 100),
      impactoPct: round3((horasFalha / Math.max(horasTotaisOperacao, 1)) * 100),
      mediaHorasDisponivel: round3(horasDisponivel / Math.max(qtdDisponivel, 1)),
      mediaHorasEventoEspecial: round3(horasEventoEspecial / Math.max(qtdEventoEspecial, 1)),
      mediaHorasFalhaParcial: round3(horasFalhaParcial / Math.max(qtdFalhaParcial, 1)),
      mediaHorasIndisponibilidade: round3(horasFalhaTotal / Math.max(qtdFalhaTotal, 1)),
      mediaHorasAteNovaFalha,
      falhaMaisComum: problemaMaisComum?.categoria ?? "Sem falhas",
      falhaMaisComumQtd: problemaMaisComum?.qtd ?? 0,
      falhaMenosComum: problemaMenosComum?.categoria ?? "Sem falhas",
      falhaMenosComumQtd: problemaMenosComum?.qtd ?? 0
    },
    linhas,
    operadores,
    problemas,
    mensal,
    disponibilidadeGeral,
    eventosFiltrados,
    linhasSelecionadas: linhasPermitidas
  };
}

function KpiCard({
  label,
  value,
  detail,
  icon
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
  const especial = Math.max((row.horasEventoEspecial / total) * 100, 0);
  const parcial = Math.max((row.horasFalhaParcial / total) * 100, 0);
  const totalFalha = Math.max((row.horasFalhaTotal / total) * 100, 0);
  const dados = Math.max((row.horasDadosIndisponiveis / total) * 100, 0);

  return (
    <div className="availability-bar" aria-label="Barra de disponibilidade">
      <span style={{ width: `${disp}%`, background: CORES["Disponível"] }} title={`Disponível: ${fmtPct(disp)}`} />
      <span style={{ width: `${especial}%`, background: CORES["Evento especial"] }} title={`Evento especial: ${fmtPct(especial)}`} />
      <span style={{ width: `${parcial}%`, background: CORES["Com falha ou parcial"] }} title={`Falha parcial: ${fmtPct(parcial)}`} />
      <span style={{ width: `${totalFalha}%`, background: CORES["Falha total / paralisação"] }} title={`Falha total: ${fmtPct(totalFalha)}`} />
      <span style={{ width: `${dados}%`, background: CORES["Dados/Status indisponíveis"] }} title={`Dados indisponíveis: ${fmtPct(dados)}`} />
    </div>
  );
}

function RankingTable({ rows }: { rows: LinhaRanking[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Linha</th>
            <th>Operador</th>
            <th>Disponibilidade</th>
            <th>Disponível</th>
            <th>Evento especial</th>
            <th>Falha parcial</th>
            <th>Falha total</th>
            <th>Dados indisponíveis</th>
            <th>Qtd. falhas</th>
            <th>Qtd. paralisações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={item.nome}>
              <td><span className="rank">{index + 1}</span></td>
              <td>{item.nome}</td>
              <td className="muted">{item.operador ?? "—"}</td>
              <td>
                <strong>{fmtPct(item.disponibilidadePct)}</strong>
                <AvailabilityBar row={item} />
              </td>
              <td>{fmtHoras(item.horasDisponivel)} h</td>
              <td>{fmtHoras(item.horasEventoEspecial)} h</td>
              <td>{fmtHoras(item.horasFalhaParcial)} h</td>
              <td>{fmtHoras(item.horasFalhaTotal)} h</td>
              <td>{fmtHoras(item.horasDadosIndisponiveis)} h</td>
              <td>{fmtInt(item.qtdFalhas)}</td>
              <td>{fmtInt(item.qtdFalhaTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardOcorrencias() {
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("tempo");
  const [linha, setLinha] = useState("todas");
  const [operador, setOperador] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [buscaOcorrencia, setBuscaOcorrencia] = useState("");

  const agregado = useMemo(() => aggregateData({ linha, operador, status }), [linha, operador, status]);

  const linhasFiltradas = useMemo(() => {
    return [...agregado.linhas].sort((a, b) => {
      if (ordenacao === "quantidade") return b.qtdFalhas - a.qtdFalhas;
      if (ordenacao === "disponibilidade") return a.disponibilidadePct - b.disponibilidadePct;
      if (ordenacao === "paralisacao") return b.horasFalhaTotal - a.horasFalhaTotal;
      return b.horasFalha - a.horasFalha;
    });
  }, [agregado.linhas, ordenacao]);

  const chartLinhasTempo = [...agregado.linhas]
    .sort((a, b) => b.horasFalha - a.horasFalha || b.horasFalhaParcial - a.horasFalhaParcial || b.horasFalhaTotal - a.horasFalhaTotal)
    .slice(0, 10);
  const chartLinhasQtd = [...agregado.linhas]
    .sort((a, b) => b.qtdFalhas - a.qtdFalhas || b.qtdFalhaParcial - a.qtdFalhaParcial || b.qtdFalhaTotal - a.qtdFalhaTotal)
    .slice(0, 10);
  const chartOperadoresTempo = [...agregado.operadores].sort((a, b) => b.horasFalha - a.horasFalha).slice(0, 8);
  const chartOperadoresQtd = [...agregado.operadores].sort((a, b) => b.qtdFalhas - a.qtdFalhas).slice(0, 8);
  const chartProblemas = agregado.problemas.slice(0, 10);

  const eventosProblema = useMemo<EventoComTipo[]>(() => {
    const termo = normalizeText(buscaOcorrencia);

    return agregado.eventosFiltrados
      .filter((evento) => isFalha(evento) && temDescricaoUtil(evento))
      .map((evento) => {
        const tipoFalha = inferTipoFalha(evento);
        const descricaoBase = getDescricaoBase(evento);

        return {
          ...evento,
          tipoFalha,
          descricaoBase,
          timestamp: Date.parse(evento.dataHora) || 0
        };
      })
      .filter((evento) => {
        if (!termo) return true;
        return normalizeText([
          evento.dataLabel,
          evento.linha,
          evento.operador,
          evento.estado,
          evento.status,
          evento.tipoFalha,
          evento.descricaoBase
        ].join(" ")).includes(termo);
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [agregado.eventosFiltrados, buscaOcorrencia]);



  const eventosEncerramento = useMemo(() => {
    return agregado.eventosFiltrados
      .filter((evento) => evento.estado === "Operação encerrada")
      .map((evento) => ({ ...evento, timestamp: Date.parse(evento.dataHora) || 0 }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [agregado.eventosFiltrados]);

  const filtrosAtivos = [linha !== "todas", operador !== "todos", status !== "todos"].filter(Boolean).length;

  const limparFiltros = () => {
    setLinha("todas");
    setOperador("todos");
    setStatus("todos");
    setBuscaOcorrencia("");
  };

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-card">
          <span className="badge">Ocorrências metroferroviárias · 2026 parcial</span>
          <h1>Disponibilidade, falhas e paralisações por linha e operador</h1>
          <p>
            Painel recalculado a partir da base de 2026. Os filtros de linha, operador e estado operacional
            afetam todos os KPIs, rankings, gráficos e tabelas. O período é parcial: {data.metadata.periodoLabel}.
            O denominador usa {data.metadata.horasOperacaoDiaPorLinha} horas por dia, na janela padrão de {data.metadata.jornadaOperacionalPadrao}.
          </p>
        </div>
        <div className="hero-side hero-card">
          <strong>Legenda operacional</strong>
          <div className="legend-block"><span style={{ background: CORES["Disponível"] }} /> Disponível</div>
          <div className="legend-block"><span style={{ background: CORES["Evento especial"] }} /> Evento especial</div>
          <div className="legend-block"><span style={{ background: CORES["Com falha ou parcial"] }} /> Com falha ou parcial</div>
          <div className="legend-block"><span style={{ background: CORES["Falha total / paralisação"] }} /> Falha total / paralisação</div>
          <div className="legend-block"><span style={{ background: CORES["Dados/Status indisponíveis"] }} /> Dados/Status indisponíveis</div>
          <div className="note"><strong>{data.metadata.periodoParcial ? "Base parcial" : "Base completa"}</strong><br />{data.metadata.mensagemParcial ?? data.metadata.observacaoDenominador}</div>
        </div>
      </section>

      <section className="filters-panel">
        <div className="filters-title">
          <div>
            <strong><Filter size={18} /> Filtros globais</strong>
            <span>{filtrosAtivos ? `${filtrosAtivos} filtro(s) ativo(s)` : "Todos os dados selecionados"}</span>
          </div>
          <button type="button" onClick={limparFiltros} disabled={!filtrosAtivos}>
            <X size={16} /> Limpar filtros
          </button>
        </div>

        <div className="filters-grid">
          <label>
            Linha
            <select value={linha} onChange={(event) => setLinha(event.target.value)}>
              <option value="todas">Todas as linhas</option>
              {LINHAS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label>
            Operador
            <select value={operador} onChange={(event) => setOperador(event.target.value)}>
              <option value="todos">Todos os operadores</option>
              {OPERADORES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label>
            Estado operacional
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="todos">Todos os status</option>
              {ESTADOS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label>
            Ordenação da tabela
            <select value={ordenacao} onChange={(event) => setOrdenacao(event.target.value as Ordenacao)}>
              <option value="tempo">Maior tempo com falha</option>
              <option value="quantidade">Quantidade absoluta de falhas</option>
              <option value="disponibilidade">Menor disponibilidade</option>
              <option value="paralisacao">Maior tempo parado</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid-kpis">
        <KpiCard label="Tempo total esperado" value={`${fmtHoras(agregado.kpis.horasTotaisOperacao)} h`} detail={`${agregado.linhasSelecionadas.length} linha(s) × 20 h/dia · ${data.metadata.periodoLabel}`} icon={<Clock3 size={22} />} />
        <KpiCard label="Tempo disponível" value={`${fmtHoras(agregado.kpis.horasDisponivel)} h`} detail={fmtPct(agregado.kpis.disponibilidadePct)} icon={<TrainFront size={22} />} />
        <KpiCard label="Eventos especiais" value={`${fmtHoras(agregado.kpis.horasEventoEspecial)} h`} detail={`${fmtInt(agregado.kpis.qtdEventoEspecial)} ocorrência(s)`} icon={<Trophy size={22} />} />
        <KpiCard label="Com falha/parcial" value={`${fmtHoras(agregado.kpis.horasFalhaParcial)} h`} detail={`${fmtInt(agregado.kpis.qtdFalhaParcial)} ocorrências`} icon={<AlertTriangle size={22} />} />
        <KpiCard label="Indisponível/paralisado" value={`${fmtHoras(agregado.kpis.horasFalhaTotal)} h`} detail={`${fmtInt(agregado.kpis.qtdFalhaTotal)} paralisações explícitas`} icon={<Gauge size={22} />} />
        <KpiCard label="Dados indisponíveis" value={`${fmtHoras(agregado.kpis.horasDadosIndisponiveis)} h`} detail={`${fmtInt(agregado.kpis.qtdDadosIndisponiveis)} registro(s) fora das falhas`} icon={<Gauge size={22} />} />
        <KpiCard label="Falhas absolutas" value={fmtInt(agregado.kpis.qtdFalhas)} detail="falha parcial + falha total" icon={<ListChecks size={22} />} />
        <KpiCard label="Média disponível" value={`${fmtHoras(agregado.kpis.mediaHorasDisponivel)} h`} detail="média por janela disponível" icon={<Clock3 size={22} />} />
        <KpiCard label="Média com falha" value={`${fmtHoras(agregado.kpis.mediaHorasFalhaParcial)} h`} detail="média por ocorrência parcial" icon={<AlertTriangle size={22} />} />
        <KpiCard label="Média indisponível" value={`${fmtHoras(agregado.kpis.mediaHorasIndisponibilidade)} h`} detail="média por paralisação/indisponibilidade" icon={<Gauge size={22} />} />
        <KpiCard label="Até nova falha" value={`${fmtHoras(agregado.kpis.mediaHorasAteNovaFalha)} h`} detail="intervalo médio entre falhas da mesma linha" icon={<Clock3 size={22} />} />
        <KpiCard label="Falha mais comum" value={agregado.kpis.falhaMaisComum} detail={`${fmtInt(agregado.kpis.falhaMaisComumQtd)} ocorrência(s)`} icon={<ListChecks size={22} />} />
        <KpiCard label="Falha menos comum" value={agregado.kpis.falhaMenosComum} detail={`${fmtInt(agregado.kpis.falhaMenosComumQtd)} ocorrência(s)`} icon={<ListChecks size={22} />} />
      </section>

      <section className="grid-2" style={{ gridTemplateColumns: "1fr" }}>
        <div className="panel panel-focus">
          <h2>Distribuição do tempo operacional</h2>
          <p>Do total que as linhas selecionadas deveriam operar, quanto ficou disponível, parcial ou paralisado.</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={agregado.disponibilidadeGeral} dataKey="horas" nameKey="categoria" innerRadius={72} outerRadius={112} paddingAngle={2}>
                {agregado.disponibilidadeGeral.map((item) => <Cell key={item.categoria} fill={item.cor} />)}
              </Pie>
              <Tooltip formatter={(value: number) => `${fmtHoras(value)} h`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <div className="panel">
          <h2>Ranking por linha · tempo</h2>
          <p>Barras empilhadas: disponível, falha parcial e falha total.</p>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={chartLinhasTempo} layout="vertical" margin={{ left: 95, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, .12)" />
              <XAxis type="number" stroke="#475569" />
              <YAxis dataKey="nome" type="category" stroke="#475569" width={130} />
              <Tooltip formatter={(value: number) => `${fmtHoras(value)} h`} />
              <Legend />
              <Bar dataKey="horasDisponivel" stackId="a" name="Disponível" fill={CORES["Disponível"]} />
              <Bar dataKey="horasEventoEspecial" stackId="a" name="Evento especial" fill={CORES["Evento especial"]} />
              <Bar dataKey="horasFalhaParcial" stackId="a" name="Com falha/parcial" fill={CORES["Com falha ou parcial"]} />
              <Bar dataKey="horasFalhaTotal" stackId="a" name="Falha total" fill={CORES["Falha total / paralisação"]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2>Ranking por linha · quantidade</h2>
          <p>Quantidade absoluta de ocorrências com falha parcial e falha total.</p>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={chartLinhasQtd} layout="vertical" margin={{ left: 95, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, .12)" />
              <XAxis type="number" stroke="#475569" />
              <YAxis dataKey="nome" type="category" stroke="#475569" width={130} />
              <Tooltip />
              <Legend />
              <Bar dataKey="qtdFalhaParcial" stackId="q" name="Qtd. falha/parcial" fill={CORES["Com falha ou parcial"]} />
              <Bar dataKey="qtdFalhaTotal" stackId="q" name="Qtd. falha total" fill={CORES["Falha total / paralisação"]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <div className="panel">
          <h2>Ranking por operador · tempo</h2>
          <p>Horas de evento especial, falha parcial e falha total por operador/concessionária.</p>
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={chartOperadoresTempo} margin={{ left: 20, right: 20, top: 10, bottom: 45 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, .12)" />
              <XAxis dataKey="nome" stroke="#475569" angle={-18} textAnchor="end" height={80} />
              <YAxis stroke="#475569" />
              <Tooltip formatter={(value: number) => `${fmtHoras(value)} h`} />
              <Legend />
              <Bar dataKey="horasEventoEspecial" name="Evento especial" fill={CORES["Evento especial"]} radius={[8, 8, 0, 0]} />
              <Bar dataKey="horasFalhaParcial" name="Falha/parcial" fill={CORES["Com falha ou parcial"]} radius={[8, 8, 0, 0]} />
              <Bar dataKey="horasFalhaTotal" name="Falha total" fill={CORES["Falha total / paralisação"]} radius={[8, 8, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <h2>Ranking por operador · quantidade</h2>
          <p>Quantidade absoluta de falhas por operador/concessionária.</p>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={chartOperadoresQtd} margin={{ left: 20, right: 20, top: 10, bottom: 45 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, .12)" />
              <XAxis dataKey="nome" stroke="#475569" angle={-18} textAnchor="end" height={80} />
              <YAxis stroke="#475569" />
              <Tooltip />
              <Legend />
              <Bar dataKey="qtdFalhaParcial" name="Qtd. falha/parcial" fill={CORES["Com falha ou parcial"]} radius={[8, 8, 0, 0]} />
              <Bar dataKey="qtdFalhaTotal" name="Qtd. falha total" fill={CORES["Falha total / paralisação"]} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <div className="panel">
          <h2>Evolução mensal</h2>
          <p>Horas disponíveis, eventos especiais, falhas parciais e paralisações ao longo do período parcial.</p>
          <ResponsiveContainer width="100%" height={310}>
            <LineChart data={agregado.mensal} margin={{ left: 10, right: 20, top: 10, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, .12)" />
              <XAxis dataKey="mesLabel" stroke="#475569" />
              <YAxis stroke="#475569" />
              <Tooltip formatter={(value: number) => `${fmtHoras(value)} h`} />
              <Legend />
              <Line type="monotone" dataKey="horasDisponivel" name="Disponível" stroke={CORES["Disponível"]} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="horasEventoEspecial" name="Evento especial" stroke={CORES["Evento especial"]} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="horasFalhaParcial" name="Com falha/parcial" stroke={CORES["Com falha ou parcial"]} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="horasFalhaTotal" name="Falha total" stroke={CORES["Falha total / paralisação"]} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="horasDadosIndisponiveis" name="Dados indisponíveis" stroke={CORES["Dados/Status indisponíveis"]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel-pro">
          <h2>Tipos de falha/paralisação mais recorrentes</h2>
          <p>Ranking identificado pela descrição da ocorrência. A barra mostra quantidade; as horas aparecem como apoio textual.</p>
          <div className="problem-ranking" role="list">
            {chartProblemas.map((item) => {
              const maxQtd = Math.max(...chartProblemas.map((problema) => problema.qtd), 1);
              const width = Math.max((item.qtd / maxQtd) * 100, 2);
              return (
                <div className="problem-row" role="listitem" key={item.categoria}>
                  <div className="problem-label" title={item.categoria}>{item.categoria}</div>
                  <div className="problem-bar-wrap" aria-label={`${item.categoria}: ${fmtInt(item.qtd)} ocorrências`}>
                    <span className="problem-bar" style={{ width: `${width}%`, background: CORES["Com falha ou parcial"] }} />
                    <strong>{fmtInt(item.qtd)}</strong>
                  </div>
                  <div className="problem-hours">{fmtHoras(item.horas)} h</div>
                </div>
              );
            })}
          </div>
          <div className="chart-footnote">
            <span className="legend-dot" style={{ background: CORES["Com falha ou parcial"] }} />
            Barra = quantidade de ocorrências; texto à direita = horas associadas.
          </div>
        </div>
      </section>

      <section className="panel occurrence-panel" style={{ marginTop: 18 }}>
        <div className="occurrence-header">
          <div>
            <h2>Lista pesquisável de falhas e paralisações</h2>
            <p>
              Eventos com falha parcial ou falha total, ordenados do mais recente para o mais antigo. O tipo é inferido pela descrição da ocorrência.
            </p>
          </div>
          <label className="occurrence-search">
            <Search size={16} />
            <input
              value={buscaOcorrencia}
              onChange={(event) => setBuscaOcorrencia(event.target.value)}
              placeholder="Pesquisar por descrição, tipo, linha, operador ou status..."
            />
          </label>
        </div>
        <div className="occurrence-summary">
          <strong>{fmtInt(eventosProblema.length)}</strong> ocorrência(s) encontrada(s)
          {buscaOcorrencia ? <span> para “{buscaOcorrencia}”</span> : null}
        </div>
        <div className="table-wrap occurrence-table">
          <table>
            <thead>
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
            </thead>
            <tbody>
              {eventosProblema.map((evento) => (
                <tr key={`${evento.id}-${evento.dataHora}-${evento.linha}`}>
                  <td className="nowrap">{evento.dataLabel}</td>
                  <td><strong>{evento.linha}</strong></td>
                  <td className="muted">{evento.operador}</td>
                  <td>
                    <span className="state-chip" style={{ borderColor: evento.cor, background: `${evento.cor}22` }}>
                      {evento.estado}
                    </span>
                  </td>
                  <td><strong>{evento.tipoFalha}</strong></td>
                  <td className="muted">{evento.status}</td>
                  <td className="nowrap">{fmtHoras(evento.horas)} h</td>
                  <td className="description-cell">{evento.descricaoBase}</td>
                </tr>
              ))}
              {!eventosProblema.length ? (
                <tr>
                  <td colSpan={8} className="empty-cell">Nenhuma falha ou paralisação encontrada com os filtros atuais.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel occurrence-panel" style={{ marginTop: 18 }}>
        <div className="occurrence-header">
          <div>
            <h2>Horários de operação encerrada</h2>
            <p>
              Registros usados para enxergar quando a linha fechou ou saiu da janela operacional. Eles não entram como falha no denominador de disponibilidade.
            </p>
          </div>
          <div className="occurrence-summary">
            <strong>{fmtInt(eventosEncerramento.length)}</strong> encerramento(s) encontrado(s)
          </div>
        </div>
        <div className="table-wrap occurrence-table">
          <table>
            <thead>
              <tr>
                <th>Data/hora</th>
                <th>Linha</th>
                <th>Operador</th>
                <th>Status</th>
                <th>Próximo status estimado</th>
                <th>Intervalo até próximo status</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {eventosEncerramento.slice(0, 300).map((evento) => (
                <tr key={`enc-${evento.id}-${evento.dataHora}-${evento.linha}`}>
                  <td className="nowrap">{evento.dataLabel}</td>
                  <td><strong>{evento.linha}</strong></td>
                  <td className="muted">{evento.operador}</td>
                  <td>
                    <span className="state-chip" style={{ borderColor: CORES["Operação encerrada"], background: `${CORES["Operação encerrada"]}22` }}>
                      {evento.status}
                    </span>
                  </td>
                  <td className="nowrap">{evento.fechamentoAteLabel ?? "—"}</td>
                  <td className="nowrap">{fmtHoras(evento.horasAteProximoStatus ?? 0)} h</td>
                  <td className="description-cell">{getDescricaoBase(evento)}</td>
                </tr>
              ))}
              {!eventosEncerramento.length ? (
                <tr>
                  <td colSpan={7} className="empty-cell">Nenhum registro de operação encerrada encontrado com os filtros atuais.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Tabela analítica por linha</h2>
        <p>Tempo total esperado, horas disponíveis, horas com falha e quantidade absoluta por linha. A tabela também respeita os filtros globais.</p>
        <RankingTable rows={linhasFiltradas} />
      </section>

      <section className="grid-3" style={{ marginTop: 18 }}>
        <div className="note">
          <strong>Regra de tempo:</strong><br />
          {data.metadata.metodoDuracao}
        </div>
        <div className="note">
          <strong>Classificação:</strong><br />
          {data.metadata.regraDisponibilidade}
        </div>
        <div className="note">
          <strong>Base:</strong><br />
          {fmtInt(data.metadata.registrosOriginais)} registros originais; {fmtInt(data.metadata.registrosNormalizados)} após deduplicação.
          <br />{data.metadata.mensagemParcial}
        </div>
      </section>
    </main>
  );
}
