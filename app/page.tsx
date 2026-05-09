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
import { type ReactNode, useMemo, useState } from "react";

type EstadoOperacional =
  | "Disponível"
  | "Evento especial"
  | "Ocorrência operacional"
  | "Manutenção programada"
  | "Com falha ou parcial"
  | "Falha total / paralisação"
  | "Dados/Status indisponíveis"
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
  horasDadosIndisponiveis: number;
  horasFalha: number;
  qtdRegistros: number;
  qtdDisponivel: number;
  qtdEventoEspecial: number;
  qtdManutencaoProgramada: number;
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
  horasManutencaoProgramada: number;
  horasFalhaParcial: number;
  horasFalhaTotal: number;
  horasDadosIndisponiveis: number;
  qtdDisponivel: number;
  qtdEventoEspecial: number;
  qtdManutencaoProgramada: number;
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
    horasManutencaoProgramada: number;
    horasFalhaParcial: number;
    horasFalhaTotal: number;
    horasDadosIndisponiveis: number;
    horasFalha: number;
    qtdDisponivel: number;
    qtdEventoEspecial: number;
    qtdManutencaoProgramada: number;
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
  "Ocorrência operacional": "#F57C00",
  "Manutenção programada": "#FFD200",
  "Com falha ou parcial": "#F57C00",
  "Falha total / paralisação": "#EE2E3B",
  "Dados/Status indisponíveis": "#9E9E9E",
  "Operação encerrada": "#64748B",
};

const HORAS_DIA = data.metadata.horasOperacaoDiaPorLinha;
const HORAS_ANO_LINHA =
  data.metadata.horasOperacaoPeriodoPorLinha ??
  data.metadata.horasOperacaoAnoPorLinha;
const EVENTOS = data.events as Evento[];
const LINHAS = data.options.linhas as string[];
const OPERADORES = data.options.operadores as string[];
const ESTADOS = data.options.estados as EstadoOperacional[];
const MESES = (data.series.mensal as Mensal[]).map((mes) => ({
  key: mes.mes,
  label: mes.mesLabel,
  horasEsperadasPorLinha: mes.horasEsperadasPorLinha,
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

function displayOperadorName(value: string): string {
  const normalized = normalizeText(value);
  if (normalized === "viamobilidade 8 e 9") return "ViaMobilidade";
  if (normalized === "cptm companhia paulista de trens metropolitanos") return "CPTM";
  if (normalized === "metro de sao paulo") return "Metrô";
  return value;
}

function horasImpacto(row: LinhaRanking): number {
  return round3(
    row.horasEventoEspecial +
      row.horasManutencaoProgramada +
      row.horasFalhaParcial +
      row.horasFalhaTotal +
      row.horasDadosIndisponiveis,
  );
}

function qtdImpacto(row: LinhaRanking): number {
  return (
    row.qtdEventoEspecial +
    row.qtdManutencaoProgramada +
    row.qtdFalhaParcial +
    row.qtdFalhaTotal +
    row.qtdDadosIndisponiveis
  );
}

function horasImpactoOperacional(row: LinhaRanking): number {
  return round3(
    row.horasEventoEspecial +
      row.horasManutencaoProgramada +
      row.horasFalhaParcial +
      row.horasFalhaTotal,
  );
}

function qtdImpactoOperacional(row: LinhaRanking): number {
  return (
    row.qtdEventoEspecial +
    row.qtdManutencaoProgramada +
    row.qtdFalhaParcial +
    row.qtdFalhaTotal
  );
}

function limparDadosIndisponiveisParaGrafico<T extends LinhaRanking>(
  row: T,
  incluirDados: boolean,
): T {
  if (incluirDados) return row;
  return {
    ...row,
    horasDadosIndisponiveis: 0,
    qtdDadosIndisponiveis: 0,
  };
}

type RegraTipoFalha = {
  tipo: string;
  termos: string[];
};

const REGRAS_TIPO_FALHA: RegraTipoFalha[] = [
  {
    tipo: "Dados/Status indisponíveis",
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
      "atividade programada",
      "obras programadas",
      "servicos programados",
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
    termos: ["velocidade reduzida", "maior tempo de parada", "tempo de parada"],
  },
  {
    tipo: "Maiores intervalos",
    termos: ["maiores intervalos", "maior intervalo"],
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
  const texto = normalizeText(`${descricaoBase} ${evento.status ?? ""}`);

  for (const regra of REGRAS_TIPO_FALHA) {
    if (regra.termos.some((termo) => texto.includes(termo))) return regra.tipo;
  }

  return evento.estado === "Falha total / paralisação"
    ? "Paralisação sem causa detalhada"
    : "Falha sem causa detalhada";
}

function corProblema(categoria: string): string {
  const texto = normalizeText(categoria);
  if (texto.includes("dados") || texto.includes("status indispon")) {
    return CORES["Dados/Status indisponíveis"];
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


const DIAS_SEMANA_LONGOS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const CALENDARIO_ESPECIAL_2026: Record<string, { tipo: "feriado" | "emenda" | "ponto_facultativo"; nome: string }> = {
  "2026-01-01": { tipo: "feriado", nome: "Confraternização Universal" },
  "2026-01-02": { tipo: "emenda", nome: "possível emenda do feriado de Ano Novo" },
  "2026-01-25": { tipo: "feriado", nome: "Aniversário de São Paulo" },
  "2026-02-16": { tipo: "ponto_facultativo", nome: "Carnaval / ponto facultativo" },
  "2026-02-17": { tipo: "ponto_facultativo", nome: "Carnaval / ponto facultativo" },
  "2026-02-18": { tipo: "ponto_facultativo", nome: "Quarta-feira de Cinzas / ponto facultativo parcial" },
  "2026-04-03": { tipo: "feriado", nome: "Paixão de Cristo" },
  "2026-04-20": { tipo: "emenda", nome: "possível emenda do feriado de Tiradentes" },
  "2026-04-21": { tipo: "feriado", nome: "Tiradentes" },
  "2026-05-01": { tipo: "feriado", nome: "Dia do Trabalho" },
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
  const item = CALENDARIO_ESPECIAL_2026[getDateKey(date)];

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
        evento.estado !== "Dados/Status indisponíveis",
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
      const tamanho = Math.max(7, Math.min(20, 7 + Math.sqrt(Math.max(evento.horas, 0.1)) * 3));

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
            aria-label={`${evento.dataLabel}, ${evento.linha}, ${evento.estado}, ${fmtHoras(evento.horas)} horas`}
            title={`${evento.dataLabel} • ${evento.linha} • ${displayOperadorName(evento.operador)} • ${evento.estado} • ${fmtHoras(evento.horas)} h • ${getDescricaoBase(evento)}`}
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
            A duração considera a regra operacional do painel: o tempo é contado a partir do início do evento até a mesma linha voltar a um status operacional novamente. A indicação de feriado/emenda é uma referência de calendário para leitura do padrão horário.
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
                  <small>{getDescricaoBase(evento)}</small>
                </div>
                <div className="scatter-selection-duration">
                  <strong>{fmtHoras(evento.horas)} h</strong>
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
    horasDadosIndisponiveis: 0,
    horasFalha: 0,
    qtdRegistros: 0,
    qtdDisponivel: 0,
    qtdEventoEspecial: 0,
    qtdManutencaoProgramada: 0,
    qtdFalhaParcial: 0,
    qtdFalhaTotal: 0,
    qtdDadosIndisponiveis: 0,
    qtdFalhas: 0,
    qtdEncerramentos: 0,
    disponibilidadePct: 0,
    falhaParcialPct: 0,
    falhaTotalPct: 0,
    impactoPct: 0,
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
  return (
    evento.estado === "Evento especial" ||
    evento.estado === "Manutenção programada" ||
    evento.estado === "Ocorrência operacional" ||
    evento.estado === "Com falha ou parcial" ||
    evento.estado === "Falha total / paralisação" ||
    evento.estado === "Dados/Status indisponíveis"
  );
}

function entraEmFalhaComum(evento: Evento): boolean {
  return entraEmRankingDeTipo(evento) && !isDadosStatusIndisponiveis(evento);
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

  if (evento.estado === "Manutenção programada") {
    row.qtdManutencaoProgramada += 1;
    row.horasManutencaoProgramada += evento.horas;
    return;
  }

  if (evento.estado === "Ocorrência operacional" || evento.estado === "Com falha ou parcial") {
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

function finalizeRow(
  row: LinhaRanking,
  statusSelecionado: string,
): LinhaRanking {
  const total = Math.max(row.horasTotaisOperacao, 1);

  if (statusSelecionado === "todos") {
    row.horasDisponivel = Math.max(
      row.horasTotaisOperacao -
        row.horasEventoEspecial -
        row.horasManutencaoProgramada -
        row.horasFalhaParcial -
        row.horasFalhaTotal -
        row.horasDadosIndisponiveis,
      0,
    );
  }

  if (statusSelecionado === "Disponível") {
    row.horasDisponivel = row.horasTotaisOperacao;
    row.horasEventoEspecial = 0;
    row.horasManutencaoProgramada = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasDadosIndisponiveis = 0;
  }

  if (statusSelecionado === "Evento especial") {
    row.horasDisponivel = 0;
    row.horasManutencaoProgramada = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasDadosIndisponiveis = 0;
  }

  if (statusSelecionado === "Manutenção programada") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasFalhaParcial = 0;
    row.horasFalhaTotal = 0;
    row.horasDadosIndisponiveis = 0;
  }

  if (statusSelecionado === "Ocorrência operacional" || statusSelecionado === "Com falha ou parcial") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasFalhaTotal = 0;
    row.horasDadosIndisponiveis = 0;
  }

  if (statusSelecionado === "Falha total / paralisação") {
    row.horasDisponivel = 0;
    row.horasEventoEspecial = 0;
    row.horasManutencaoProgramada = 0;
    row.horasManutencaoProgramada = 0;
    row.horasFalhaParcial = 0;
    row.horasDadosIndisponiveis = 0;
  }

  if (statusSelecionado === "Dados/Status indisponíveis") {
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
    row.horasDadosIndisponiveis = 0;
  }

  row.horasDisponivel = round3(row.horasDisponivel);
  row.horasEventoEspecial = round3(row.horasEventoEspecial);
  row.horasManutencaoProgramada = round3(row.horasManutencaoProgramada);
  row.horasFalhaParcial = round3(row.horasFalhaParcial);
  row.horasFalhaTotal = round3(row.horasFalhaTotal);
  row.horasDadosIndisponiveis = round3(row.horasDadosIndisponiveis);
  row.horasFalha = round3(row.horasFalhaParcial + row.horasFalhaTotal);
  row.qtdFalhas = qtdImpacto(row);
  row.disponibilidadePct = round3(
    ((row.horasDisponivel + row.horasEventoEspecial) / total) * 100,
  );
  row.falhaParcialPct = round3((row.horasFalhaParcial / total) * 100);
  row.falhaTotalPct = round3((row.horasFalhaTotal / total) * 100);
  row.impactoPct = round3((row.horasFalha / total) * 100);

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
      const anterior = Date.parse(ordenadas[i - 1].dataHora) || 0;
      const atual = Date.parse(ordenadas[i].dataHora) || 0;
      const horas = (atual - anterior) / 36e5;
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
      horasDadosIndisponiveis: 0,
      qtdDisponivel: 0,
      qtdEventoEspecial: 0,
      qtdManutencaoProgramada: 0,
      qtdFalhaParcial: 0,
      qtdFalhaTotal: 0,
      qtdDadosIndisponiveis: 0,
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
      problema.horas += evento.horas;
      problemasMap.set(categoria, problema);

      if (entraEmFalhaComum(evento)) {
        const falhaComum = falhasComunsMap.get(categoria) ?? {
          categoria,
          qtd: 0,
          horas: 0,
        };
        falhaComum.qtd += 1;
        falhaComum.horas += evento.horas;
        falhasComunsMap.set(categoria, falhaComum);
      }
    }

    Object.entries(evento.meses).forEach(([mes, horas]) => {
      const row = mensalMap.get(mes);
      if (!row) return;
      if (evento.estado === "Disponível") row.horasDisponivel += horas;
      if (evento.estado === "Evento especial") row.horasEventoEspecial += horas;
      if (evento.estado === "Manutenção programada") row.horasManutencaoProgramada += horas;
      if (evento.estado === "Ocorrência operacional" || evento.estado === "Com falha ou parcial")
        row.horasFalhaParcial += horas;
      if (evento.estado === "Falha total / paralisação")
        row.horasFalhaTotal += horas;
      if (evento.estado === "Dados/Status indisponíveis")
        row.horasDadosIndisponiveis += horas;
    });

    const rowMes = mensalMap.get(evento.mes);
    if (rowMes) {
      if (evento.estado === "Disponível") rowMes.qtdDisponivel += 1;
      if (evento.estado === "Evento especial") rowMes.qtdEventoEspecial += 1;
      if (evento.estado === "Manutenção programada") rowMes.qtdManutencaoProgramada += 1;
      if (evento.estado === "Ocorrência operacional" || evento.estado === "Com falha ou parcial") rowMes.qtdFalhaParcial += 1;
      if (evento.estado === "Falha total / paralisação")
        rowMes.qtdFalhaTotal += 1;
      if (evento.estado === "Dados/Status indisponíveis")
        rowMes.qtdDadosIndisponiveis += 1;
      if (evento.estado === "Operação encerrada") rowMes.qtdEncerramentos += 1;
    }
  });

  const linhas = [...linhasMap.values()].map((row) =>
    finalizeRow(row, filtros.status),
  );
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
  const horasDadosIndisponiveis = round3(
    linhas.reduce((total, linha) => total + linha.horasDadosIndisponiveis, 0),
  );
  let horasDisponivel = round3(
    linhas.reduce((total, linha) => total + linha.horasDisponivel, 0),
  );

  if (filtros.status === "todos") {
    horasDisponivel = round3(
      Math.max(
        horasTotaisOperacao -
          horasEventoEspecial -
          horasManutencaoProgramada -
          horasFalhaParcial -
          horasFalhaTotal -
          horasDadosIndisponiveis,
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
  const qtdDadosIndisponiveis = eventosFiltrados.filter(
    (evento) => evento.estado === "Dados/Status indisponíveis",
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
          row.horasEventoEspecial -
          row.horasManutencaoProgramada -
          row.horasFalhaParcial -
          row.horasFalhaTotal -
          row.horasDadosIndisponiveis,
        0,
      );
    }

    if (filtros.status === "Disponível") {
      row.horasDisponivel = esperadoMes;
      row.horasEventoEspecial = 0;
      row.horasManutencaoProgramada = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasDadosIndisponiveis = 0;
    }

    if (filtros.status === "Evento especial") {
      row.horasDisponivel = 0;
      row.horasManutencaoProgramada = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasDadosIndisponiveis = 0;
    }

    if (filtros.status === "Manutenção programada") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasFalhaParcial = 0;
      row.horasFalhaTotal = 0;
      row.horasDadosIndisponiveis = 0;
    }

    if (filtros.status === "Ocorrência operacional" || filtros.status === "Com falha ou parcial") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasFalhaTotal = 0;
      row.horasDadosIndisponiveis = 0;
    }

    if (filtros.status === "Falha total / paralisação") {
      row.horasDisponivel = 0;
      row.horasEventoEspecial = 0;
      row.horasManutencaoProgramada = 0;
      row.horasFalhaParcial = 0;
      row.horasDadosIndisponiveis = 0;
    }

    if (filtros.status === "Dados/Status indisponíveis") {
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
      row.horasDadosIndisponiveis = 0;
    }

    row.horasDisponivel = round3(row.horasDisponivel);
    row.horasEventoEspecial = round3(row.horasEventoEspecial);
    row.horasManutencaoProgramada = round3(row.horasManutencaoProgramada);
    row.horasFalhaParcial = round3(row.horasFalhaParcial);
    row.horasFalhaTotal = round3(row.horasFalhaTotal);
    row.horasDadosIndisponiveis = round3(row.horasDadosIndisponiveis);
    return row;
  });

  const disponibilidadeBase: Distribuicao[] = [
    {
      categoria: "Disponível",
      horas: horasDisponivel,
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
      categoria: "Dados/Status indisponíveis",
      horas: horasDadosIndisponiveis,
      quantidade: qtdDadosIndisponiveis,
      cor: CORES["Dados/Status indisponíveis"],
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
  const problemaMenosComum = [...falhasComuns].sort(
    (a, b) => a.qtd - b.qtd || a.horas - b.horas,
  )[0];
  const problemaMaisComum = falhasComuns[0];
  const mediaHorasAteNovaFalha = calcMediaEntreFalhas(eventosFiltrados);

  return {
    kpis: {
      horasTotaisOperacao: round3(horasTotaisOperacao),
      horasDisponivel,
      horasEventoEspecial,
      horasManutencaoProgramada,
      horasFalhaParcial,
      horasFalhaTotal,
      horasDadosIndisponiveis,
      horasFalha,
      qtdDisponivel,
      qtdEventoEspecial,
      qtdManutencaoProgramada,
      qtdFalhaParcial,
      qtdFalhaTotal,
      qtdDadosIndisponiveis,
      qtdFalhas: qtdEventoEspecial + qtdManutencaoProgramada + qtdFalhaParcial + qtdFalhaTotal + qtdDadosIndisponiveis,
      qtdEncerramentos,
      disponibilidadePct: round3(
        ((horasDisponivel + horasEventoEspecial) /
          Math.max(horasTotaisOperacao, 1)) *
          100,
      ),
      impactoPct: round3((horasFalha / Math.max(horasTotaisOperacao, 1)) * 100),
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
      falhaMaisComum: problemaMaisComum?.categoria ?? "Sem falhas",
      falhaMaisComumQtd: problemaMaisComum?.qtd ?? 0,
      falhaMenosComum: problemaMenosComum?.categoria ?? "Sem falhas",
      falhaMenosComumQtd: problemaMenosComum?.qtd ?? 0,
    },
    linhas,
    operadores,
    problemas,
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
  const especial = Math.max((row.horasEventoEspecial / total) * 100, 0);
  const manutencao = Math.max((row.horasManutencaoProgramada / total) * 100, 0);
  const parcial = Math.max((row.horasFalhaParcial / total) * 100, 0);
  const totalFalha = Math.max((row.horasFalhaTotal / total) * 100, 0);
  const dados = Math.max((row.horasDadosIndisponiveis / total) * 100, 0);

  return (
    <div className="availability-bar" aria-label="Barra de disponibilidade">
      <span
        style={{ width: `${disp}%`, background: CORES["Disponível"] }}
        title={`Disponível: ${fmtPct(disp)}`}
      />
      <span
        style={{ width: `${especial}%`, background: CORES["Evento especial"] }}
        title={`Evento especial: ${fmtPct(especial)}`}
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
      <span
        style={{
          width: `${dados}%`,
          background: CORES["Dados/Status indisponíveis"],
        }}
        title={`Dados indisponíveis: ${fmtPct(dados)}`}
      />
    </div>
  );
}

function RankingTable({ rows }: { rows: LinhaRanking[] }) {
  return (
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
            <th>Impactos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={item.nome}>
              <td>
                <span className="rank">{index + 1}</span>
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
                <span className="table-subvalue">{fmtInt(item.qtdManutencaoProgramada)} evento(s)</span>
              </td>
              <td>
                <strong>{fmtHoras(item.horasFalhaParcial)} h</strong>
                <span className="table-subvalue">{fmtInt(item.qtdFalhaParcial)} evento(s)</span>
              </td>
              <td>
                <strong>{fmtHoras(item.horasFalhaTotal)} h</strong>
                <span className="table-subvalue">{fmtInt(item.qtdFalhaTotal)} evento(s)</span>
              </td>
              <td>
                <strong>{fmtHoras(item.horasDadosIndisponiveis)} h</strong>
                <span className="table-subvalue">{fmtInt(item.qtdDadosIndisponiveis)} evento(s)</span>
              </td>
              <td>
                <strong>{fmtInt(qtdImpacto(item))}</strong>
                <span className="table-subvalue">{fmtHoras(horasImpacto(item))} h</span>
              </td>
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
  const [buscaTabela, setBuscaTabela] = useState("");
  const [operadorTabela, setOperadorTabela] = useState("todos");
  const [statusTabela, setStatusTabela] = useState("todos");
  const [buscaOcorrencia, setBuscaOcorrencia] = useState("");
  const [linhaOcorrencia, setLinhaOcorrencia] = useState("todas");
  const [operadorOcorrencia, setOperadorOcorrencia] = useState("todos");
  const [estadoOcorrencia, setEstadoOcorrencia] = useState("todos");
  const [tipoOcorrencia, setTipoOcorrencia] = useState("todos");
  const [recorteDiasMapa, setRecorteDiasMapa] = useState<RecorteDiasMapa>("todos");
  const [linhaMapa, setLinhaMapa] = useState("todas");
  const [operadorMapa, setOperadorMapa] = useState("todos");
  const [estadoMapa, setEstadoMapa] = useState("todos");

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
            item.qtdDadosIndisponiveis > 0);

        return bateBusca && bateOperador && bateStatus;
      })
      .sort((a, b) => {
        if (ordenacao === "quantidade") return qtdImpacto(b) - qtdImpacto(a);
        if (ordenacao === "disponibilidade")
          return a.disponibilidadePct - b.disponibilidadePct;
        if (ordenacao === "paralisacao")
          return b.horasFalhaTotal - a.horasFalhaTotal;
        return horasImpacto(b) - horasImpacto(a);
      });
  }, [agregado.linhas, buscaTabela, operadorTabela, statusTabela, ordenacao]);

  const incluirDadosIndisponiveisNosGraficos =
    status === "Dados/Status indisponíveis" ||
    estadoMapa === "Dados/Status indisponíveis";

  const eventosBaseMapa = useMemo(() => {
    return agregado.eventosFiltrados.filter((evento) => entraEmRankingDeTipo(evento));
  }, [agregado.eventosFiltrados]);

  const linhasMapaDisponiveis = useMemo(() => {
    return Array.from(new Set(eventosBaseMapa.map((evento) => evento.linha))).sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    );
  }, [eventosBaseMapa]);

  const operadoresMapaDisponiveis = useMemo(() => {
    return Array.from(new Set(eventosBaseMapa.map((evento) => evento.operador))).sort(
      (a, b) => displayOperadorName(a).localeCompare(displayOperadorName(b), "pt-BR"),
    );
  }, [eventosBaseMapa]);

  const estadosMapaDisponiveis = useMemo(() => {
    return ESTADOS.filter((estadoItem) =>
      eventosBaseMapa.some((evento) => evento.estado === estadoItem),
    );
  }, [eventosBaseMapa]);

  const eventosMapaHorario = useMemo(() => {
    return eventosBaseMapa.filter((evento) => {
      const bateLinha = linhaMapa === "todas" || evento.linha === linhaMapa;
      const bateOperador = operadorMapa === "todos" || evento.operador === operadorMapa;
      const bateEstado = estadoMapa === "todos" || evento.estado === estadoMapa;
      const bateDia = filtraEventoPorRecorteDias(evento, recorteDiasMapa);
      const bateDados =
        incluirDadosIndisponiveisNosGraficos ||
        evento.estado !== "Dados/Status indisponíveis";

      return bateLinha && bateOperador && bateEstado && bateDia && bateDados;
    });
  }, [
    eventosBaseMapa,
    linhaMapa,
    operadorMapa,
    estadoMapa,
    recorteDiasMapa,
    incluirDadosIndisponiveisNosGraficos,
  ]);

  const dadosGraficoDisponibilidade = agregado.disponibilidadeGeral.filter(
    (item) =>
      incluirDadosIndisponiveisNosGraficos ||
      item.categoria !== "Dados/Status indisponíveis",
  );

  const chartLinhasTempo = [...agregado.linhas]
    .sort(
      (a, b) =>
        horasImpactoOperacional(b) - horasImpactoOperacional(a) ||
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
        qtdImpactoOperacional(b) - qtdImpactoOperacional(a) ||
        b.qtdEventoEspecial - a.qtdEventoEspecial ||
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
    .sort((a, b) => horasImpactoOperacional(b) - horasImpactoOperacional(a))
    .slice(0, 8)
    .map((item) => ({
      ...limparDadosIndisponiveisParaGrafico(
        item,
        incluirDadosIndisponiveisNosGraficos,
      ),
      nomeLabel: displayOperadorName(item.nome),
    }));
  const chartOperadoresQtd = [...agregado.operadores]
    .sort((a, b) => qtdImpactoOperacional(b) - qtdImpactoOperacional(a))
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

        return bateBusca && bateLinha && bateOperador && bateEstado && bateTipo;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [
    eventosProblemaBase,
    buscaOcorrencia,
    linhaOcorrencia,
    operadorOcorrencia,
    estadoOcorrencia,
    tipoOcorrencia,
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
  };

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-card">
          <span className="badge">
            Ocorrências metroferroviárias · 2026
          </span>
          <h1>Painel de disponibilidade e ocorrências nas linhas metroferroviárias</h1>
          <p>
            Este painel resume, em linguagem operacional, quanto tempo as linhas
            ficaram disponíveis, quanto tempo tiveram eventos programados,
            ocorrências, paralisações ou falta de dados do sistema. Período analisado: {data.metadata.periodoLabel}.
            A comparação usa {data.metadata.horasOperacaoDiaPorLinha} horas
            de operação por dia, na janela padrão de 04h00 à meia-noite.
            Fonte dos dados:{" "}
            <a href="https://ccm.artesp.sp.gov.br" target="_blank" rel="noreferrer">
              ccm.artesp.sp.gov.br
            </a>.
          </p>
        </div>
        <div className="hero-side hero-card">
          <strong>Legenda operacional</strong>
          <p className="legend-intro">Cada cor representa uma situação da operação. Nos gráficos principais, dados indisponíveis ficam fora da comparação operacional para não distorcer a leitura; eles seguem visíveis nos cartões, tabelas e lista detalhada.</p>
          <div className="legend-block">
            <span style={{ background: CORES["Disponível"] }} /> Disponível
          </div>
          <div className="legend-block">
            <span style={{ background: CORES["Evento especial"] }} /> Evento
            especial
          </div>
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
            <span style={{ background: CORES["Dados/Status indisponíveis"] }} />{" "}
            Dados/Status indisponíveis
          </div>
          <div className="note disclaimer-note">
            <strong>
              {data.metadata.periodoParcial ? "Base parcial" : "Base completa"}
            </strong>
            <br />
            {data.metadata.mensagemParcial ??
              data.metadata.observacaoDenominador}
          </div>
        </div>
      </section>

      <section className="grid-3 methodology-grid">
        <div className="note explain-card">
          <strong>Como o tempo é calculado</strong>
          <br />
          {data.metadata.metodoDuracao} Em termos simples: cada registro ocupa uma quantidade de horas e essas horas entram na cor correspondente.
        </div>
        <div className="note explain-card">
          <strong>Como ler a classificação</strong>
          <br />
          {data.metadata.regraDisponibilidade} Manutenção programada é separada de ocorrência operacional para não misturar evento planejado com falha.
        </div>
        <div className="note explain-card">
          <strong>Qual base foi usada</strong>
          <br />
          {fmtInt(data.metadata.registrosOriginais)} registros originais; {fmtInt(data.metadata.registrosNormalizados)} após remover duplicidades da mesma linha no mesmo horário.
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
                : "Sem filtro global: todos os dados do período parcial estão selecionados."}
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
              {ESTADOS.map((item) => (
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
          detail={`Base de comparação: ${agregado.linhasSelecionadas.length} linha(s) × 20 h/dia`}
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Tempo disponível"
          value={`${fmtHoras(agregado.kpis.horasDisponivel)} h`}
          detail={`${fmtPct(agregado.kpis.disponibilidadePct)} do tempo esperado ficou sem impacto registrado`}
          icon={<TrainFront size={22} />}
        />
        <KpiCard
          label="Eventos especiais"
          value={`${fmtHoras(agregado.kpis.horasEventoEspecial)} h`}
          detail={`${fmtInt(agregado.kpis.qtdEventoEspecial)} registro(s) de operação especial`}
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
          value={`${fmtHoras(agregado.kpis.horasDadosIndisponiveis)} h`}
          detail={`${fmtInt(agregado.kpis.qtdDadosIndisponiveis)} registro(s) sem status operacional confiável`}
          icon={<Gauge size={22} />}
        />
        <KpiCard
          label="Eventos de impacto"
          value={fmtInt(agregado.kpis.qtdFalhas)}
          detail="tudo que não é operação normal: especial, manutenção, ocorrência, falha total e dados"
          icon={<ListChecks size={22} />}
        />
        <KpiCard
          label="Média disponível"
          value={`${fmtHoras(agregado.kpis.mediaHorasDisponivel)} h`}
          detail="média das janelas classificadas como operação normal"
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Média com falha"
          value={`${fmtHoras(agregado.kpis.mediaHorasFalhaParcial)} h`}
          detail="duração média de cada ocorrência operacional"
          icon={<AlertTriangle size={22} />}
        />
        <KpiCard
          label="Média indisponível"
          value={`${fmtHoras(agregado.kpis.mediaHorasIndisponibilidade)} h`}
          detail="duração média dos registros de falha total"
          icon={<Gauge size={22} />}
        />
        <KpiCard
          label="Até nova falha"
          value={`${fmtHoras(agregado.kpis.mediaHorasAteNovaFalha)} h`}
          detail="tempo médio entre uma falha e a próxima, na mesma linha"
          icon={<Clock3 size={22} />}
        />
        <KpiCard
          label="Falha mais comum"
          value={agregado.kpis.falhaMaisComum}
          detail={`${fmtInt(agregado.kpis.falhaMaisComumQtd)} ocorrência(s)`}
          icon={<ListChecks size={22} />}
        />
        <KpiCard
          label="Falha menos comum"
          value={agregado.kpis.falhaMenosComum}
          detail={`${fmtInt(agregado.kpis.falhaMenosComumQtd)} ocorrência(s)`}
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
          <p>Ordena as linhas pelo maior tempo de impacto operacional. A parte verde mostra o tempo sem impacto; as demais cores mostram eventos especiais, manutenções, ocorrências e paralisações.</p>
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
                dataKey="horasDisponivel"
                stackId="a"
                name="Disponível"
                fill={CORES["Disponível"]}
              />
              <Bar
                dataKey="horasEventoEspecial"
                stackId="a"
                name="Evento especial"
                fill={CORES["Evento especial"]}
              />
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
              {incluirDadosIndisponiveisNosGraficos && (
                <Bar
                  dataKey="horasDadosIndisponiveis"
                  stackId="a"
                  name="Dados indisponíveis"
                  fill={CORES["Dados/Status indisponíveis"]}
                />
              )}
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
                dataKey="qtdEventoEspecial"
                stackId="q"
                name="Qtd. evento especial"
                fill={CORES["Evento especial"]}
              />
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
                  dataKey="qtdDadosIndisponiveis"
                  stackId="q"
                  name="Qtd. dados indisponíveis"
                  fill={CORES["Dados/Status indisponíveis"]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: 18 }}>
        <div className="panel">
          <h2>Ranking por operador · tempo</h2>
          <p>Compara operadores pelo total de horas de impacto operacional. Dados indisponíveis ficam fora desta comparação principal; o nome completo aparece ao passar o mouse.</p>
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
                dataKey="horasEventoEspecial"
                stackId="tempoOperador"
                name="Evento especial"
                fill={CORES["Evento especial"]}
              />
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
              {incluirDadosIndisponiveisNosGraficos && (
                <Bar
                  dataKey="horasDadosIndisponiveis"
                  stackId="tempoOperador"
                  name="Dados indisponíveis"
                  fill={CORES["Dados/Status indisponíveis"]}
                />
              )}
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
                dataKey="qtdEventoEspecial"
                stackId="qtdOperador"
                name="Qtd. evento especial"
                fill={CORES["Evento especial"]}
              />
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
                  dataKey="qtdDadosIndisponiveis"
                  stackId="qtdOperador"
                  name="Qtd. dados indisponíveis"
                  fill={CORES["Dados/Status indisponíveis"]}
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
              Cada ponto representa um evento. O eixo horizontal mostra o dia do período; o eixo vertical mostra o horário de início dentro da janela operacional de 04h00 à meia-noite. As faixas destacadas indicam horários de maior sensibilidade: pico da manhã, pico estudantil/intermediário, pico da tarde/noite e pico estudantil noturno.
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
              <select value={linhaMapa} onChange={(e) => setLinhaMapa(e.target.value)}>
                <option value="todas">Todas as linhas</option>
                {linhasMapaDisponiveis.map((item) => (
                  <option key={`map-linha-${item}`} value={item}>
                    {item}
                  </option>
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
          </div>

          <small>Estes filtros afetam apenas o mapa horário. Primeiro valem os filtros globais da página; depois este recorte local refina a leitura do gráfico.</small>
        </div>

        <TimeScatterChart
          eventos={eventosMapaHorario}
          incluirDadosIndisponiveis={incluirDadosIndisponiveisNosGraficos}
          recorteDias={recorteDiasMapa}
        />
        <div className="chart-footnote scatter-footnote">
          <span className="legend-dot" style={{ background: CORES["Ocorrência operacional"] }} />
          Cor = categoria operacional. Tamanho do ponto = duração aproximada. Clique em um ponto para ver a ocorrência e a duração calculada.
        </div>
        <div className="chart-footnote scatter-footnote scatter-disclaimer">
          <span className="legend-dot" style={{ background: CORES["Evento especial"] }} />
          As faixas de pico são referência de leitura: janeiro não considera pico estudantil e sábados/domingos não têm pico declarado. Em “Somente dias úteis”, as faixas ficam mais fortes para destacar os períodos críticos. O posicionamento do ponto usa sempre o horário de início do evento. Dados indisponíveis aparecem apenas quando esse status é selecionado no filtro global ou no filtro local de evento.
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
                name="Evento especial"
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
              {incluirDadosIndisponiveisNosGraficos && (
                <Line
                  type="monotone"
                  dataKey="horasDadosIndisponiveis"
                  name="Dados indisponíveis"
                  stroke={CORES["Dados/Status indisponíveis"]}
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel-pro">
          <h2>Tipos identificados por tempo acumulado</h2>
          <p>Classifica a descrição dos registros em tipos mais fáceis de ler. A barra mostra as horas acumuladas; ao lado aparece a quantidade de ocorrências daquele tipo.</p>
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
            Barra = horas acumuladas. Texto à direita = quantidade de registros daquele tipo.
          </div>
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
              Resume cada linha em uma só tabela: tempo disponível, eventos especiais, manutenções, ocorrências, paralisações, dados indisponíveis e total de impactos. Primeiro entram os filtros globais; depois entram os filtros próprios desta tabela.
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
              <option value="com_falhas">Somente linhas com impactos</option>
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
              <option value="quantidade">Quantidade absoluta de impactos</option>
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
              Lista detalhada dos registros de impacto, do mais recente para o mais antigo. Os filtros abaixo atuam somente nesta lista, sempre dentro do recorte definido pelos filtros globais.
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
          </div>
        </div>
        <div className="occurrence-summary">
          <strong>{fmtInt(eventosProblema.length)}</strong> ocorrência(s)
          encontrada(s)
          {buscaOcorrencia ? <span> para “{buscaOcorrencia}”</span> : null}
          <span> · filtros locais aplicados depois dos filtros globais</span>
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
                  </td>
                  <td className="muted">{evento.status}</td>
                  <td className="nowrap">{fmtHoras(evento.horas)} h</td>
                  <td className="description-cell">{evento.descricaoBase}</td>
                </tr>
              ))}
              {!eventosProblema.length ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    Nenhum registro encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
              ))}
              {!eventosEncerramento.length ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    Nenhum registro de operação encerrada encontrado com os
                    filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      </details>


    </main>
  );
}
