#!/usr/bin/env python3
"""Converte a extração CCM/ARTESP no contrato JSON consumido pelo Falhas SP.

O arquivo de entrada esperado é o JSON achatado produzido por
``baixar_ocorrencias_ccm_2024_2025_1sem2026.py``. O processamento é
determinístico e usa somente a biblioteca padrão do Python.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from statistics import mean
from typing import Any, Iterable, Sequence


HOURS_PER_OPERATION_DAY = 19.5
WINDOW_START = time(4, 30)
MAX_STATUS_GAP_HOURS = 72.0
COLORS = {
    "Disponível": "#007A5E",
    "Evento especial": "#1C2C8C",
    "Manutenção programada": "#FFD200",
    "Ocorrência operacional": "#F57C00",
    "Falha total / paralisação": "#EE2E3B",
    "Indefinido": "#9E9E9E",
    "Operação encerrada": "#64748B",
}
STATE_ORDER = list(COLORS)

# Estes registros encerram o ciclo anterior, mas não geram evento, contagem ou
# duração próprios. "Dados/Status Indisponíveis" (com barra) continua sendo a
# categoria auditável Indefinido já existente no painel.
CLOSURE_ONLY_STATUSES = {
    "dados indisponiveis",
    "status desconhecido",
    "status nao disponivel",
}

MAINTENANCE_TERMS = (
    "manutencao programada",
    "atividade programada",
    "atividades programadas",
    "servico de manutencao",
    "servicos de manutencao",
    "obras de melhoria",
    "obras de melhorias",
    "obras de modernizacao",
    "obra programada",
    "obras programadas",
)

SPECIAL_STATUSES = {"operacao especial", "operacao diferenciada"}
PARTIAL_STATUSES = {
    "velocidade reduzida",
    "operacao parcial",
    "operacao com impacto pontual",
    "circulacao de trens",
    "maiores intervalos",
}

MONTH_NAMES = ("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")


def normalize_text(value: Any) -> str:
    text_value = "" if value is None else str(value)
    normalized = unicodedata.normalize("NFKD", text_value)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", without_marks.lower()).strip()


def round3(value: float) -> float:
    # Evita -0.0 e mantém a mesma precisão usada pelo dashboard.
    result = round(float(value) + 1e-12, 3)
    return 0.0 if abs(result) < 0.0005 else result


def parse_datetime(value: Any) -> datetime:
    text_value = str(value or "").strip()
    if not text_value:
        raise ValueError("data_hora vazia")
    parsed = datetime.fromisoformat(text_value.replace("Z", "+00:00"))
    # A fonte é horário local sem offset na maior parte dos registros. Para o
    # cálculo civil da janela operacional, removemos apenas a informação de fuso.
    return parsed.replace(tzinfo=None)


def iso_seconds(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def format_label(value: datetime) -> str:
    return value.strftime("%d/%m/%Y %H:%M")


def contains_maintenance(text_value: str) -> bool:
    normalized = normalize_text(text_value)
    return any(term in normalized for term in MAINTENANCE_TERMS)


def classify_status(status: Any, description: Any, incident: Any = None) -> str | None:
    """Retorna o estado do painel; ``None`` significa somente fechar o ciclo."""
    status_key = normalize_text(status)
    description_text = "" if description is None else str(description)

    if status_key in CLOSURE_ONLY_STATUSES:
        return None
    if status_key == "operacao normal":
        return "Disponível"
    if status_key in SPECIAL_STATUSES:
        return "Evento especial"
    if status_key == "operacao encerrada":
        return "Operação encerrada"
    if status_key == "dados/status indisponiveis":
        return "Indefinido"
    if status_key == "atividade programada":
        return "Manutenção programada"
    if status_key == "paralisada":
        return "Manutenção programada" if contains_maintenance(description_text) else "Falha total / paralisação"
    if status_key in {"circulacao de trens", "maiores intervalos"}:
        # Regra editorial específica: nestes dois estados, a descrição decide.
        # Qualquer menção a manutenção é tratada como manutenção; os demais
        # motivos representam ocorrência operacional.
        description_key = normalize_text(description_text)
        return "Manutenção programada" if ("manutencao" in description_key or contains_maintenance(description_text)) else "Ocorrência operacional"
    if status_key in PARTIAL_STATUSES:
        return "Manutenção programada" if contains_maintenance(description_text) else "Ocorrência operacional"

    # Fallback conservador para novos estados da API: nunca transforma um texto
    # explicitamente programado em falha; incidentes desconhecidos viram
    # ocorrência e registros não incidentes viram disponibilidade.
    if contains_maintenance(description_text):
        return "Manutenção programada"
    if bool(incident):
        return "Ocorrência operacional"
    return "Disponível"


def split_operational_hours(start: datetime, end: datetime) -> dict[str, float]:
    """Recorta [start, end) na janela civil diária 04:30–00:00 e agrupa por mês."""
    if end <= start:
        return {}
    result: defaultdict[str, float] = defaultdict(float)
    cursor = start.date()
    last_day = (end - timedelta(microseconds=1)).date()
    while cursor <= last_day:
        window_start = datetime.combine(cursor, WINDOW_START)
        window_end = datetime.combine(cursor + timedelta(days=1), time.min)
        overlap_start = max(start, window_start)
        overlap_end = min(end, window_end)
        if overlap_end > overlap_start:
            key = overlap_start.strftime("%Y-%m")
            result[key] += (overlap_end - overlap_start).total_seconds() / 3600
        cursor += timedelta(days=1)
    return {key: round3(value) for key, value in sorted(result.items()) if value > 0}


def operational_hours_between(start: datetime, end: datetime) -> float:
    return round3(sum(split_operational_hours(start, end).values()))


def period_months(start: date, end: date) -> list[str]:
    months: list[str] = []
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        months.append(cursor.strftime("%Y-%m"))
        cursor = date(cursor.year + (cursor.month == 12), 1 if cursor.month == 12 else cursor.month + 1, 1)
    return months


def days_in_month_inside_period(month_key: str, start: date, end: date) -> int:
    year, month = (int(part) for part in month_key.split("-"))
    first = max(start, date(year, month, 1))
    next_month = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    last = min(end, next_month - timedelta(days=1))
    return max((last - first).days + 1, 0)


def canonical_operator(row: dict[str, Any]) -> str:
    value = row.get("operadora_final") or row.get("operadora_api_normalizada") or row.get("operadora_api") or "Não informado"
    normalized = normalize_text(value)
    if "cptm" in normalized:
        return "CPTM"
    if "metro de sao paulo" in normalized or normalized == "metro":
        return "Metrô de São Paulo"
    return str(value).strip() or "Não informado"


def line_sort_key(name: str) -> tuple[int, str]:
    match = re.search(r"\b(\d{1,2})\b", name)
    return (int(match.group(1)) if match else 999, name)


def detect_cascade(row: dict[str, Any]) -> tuple[bool, str | None]:
    text_value = normalize_text(row.get("descricao"))
    current_code = str(row.get("linha_codigo") or "").strip()
    if "linha" not in text_value or not any(marker in text_value for marker in ("devido", "ocorrencia", "intercorrencia", "problema")):
        return False, None
    mentioned = re.findall(r"\blinha\s*[-:]?\s*(\d{1,2})\b", text_value)
    cause = next((code for code in mentioned if code != current_code), None)
    if not cause:
        return False, None
    return True, f"Linha {cause}"


@dataclass(frozen=True)
class SourceRow:
    raw: dict[str, Any]
    dt: datetime
    line_code: str
    line_name: str


def deduplicate_rows(rows: Iterable[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    seen: set[tuple[Any, ...]] = set()
    output: list[dict[str, Any]] = []
    removed = 0
    for row in rows:
        source_id = row.get("id")
        if source_id not in (None, ""):
            key = ("id", str(source_id))
        else:
            key = (
                "content",
                row.get("data_hora"),
                row.get("linha_codigo"),
                row.get("situacao"),
                row.get("descricao"),
            )
        if key in seen:
            removed += 1
            continue
        seen.add(key)
        output.append(row)
    return output, removed


def prepare_rows(rows: Sequence[dict[str, Any]]) -> list[SourceRow]:
    prepared: list[SourceRow] = []
    for row in rows:
        dt = parse_datetime(row.get("data_hora"))
        line_code = str(row.get("linha_codigo") or "").strip()
        line_name = str(row.get("linha_nome") or "").strip()
        if not line_code or not line_name:
            raise ValueError(f"registro {row.get('id')!r} sem linha válida")
        prepared.append(SourceRow(row, dt, line_code, line_name))
    return sorted(prepared, key=lambda item: (line_sort_key(item.line_name), item.dt, str(item.raw.get("id", ""))))


def build_raw_sequences(prepared: Sequence[SourceRow]) -> dict[str, list[SourceRow]]:
    sequences: defaultdict[str, list[SourceRow]] = defaultdict(list)
    for item in prepared:
        sequences[item.line_code].append(item)
    return dict(sequences)


def find_cascade_end(
    item: SourceRow,
    default_end: datetime,
    cause_line: str | None,
    sequences: dict[str, list[SourceRow]],
) -> datetime:
    if not cause_line:
        return default_end
    match = re.search(r"(\d{1,2})", cause_line)
    if not match:
        return default_end
    for candidate in sequences.get(match.group(1), []):
        if candidate.dt <= item.dt or candidate.dt >= default_end:
            continue
        if classify_status(candidate.raw.get("situacao"), candidate.raw.get("descricao"), candidate.raw.get("conta_incidente")) == "Disponível":
            return candidate.dt
    return default_end


def build_events(
    year_rows: Sequence[SourceRow],
    period_start: date,
    period_end: date,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    sequences = build_raw_sequences(year_rows)
    events: list[dict[str, Any]] = []
    audit = {
        "registrosEntrada": len(year_rows),
        "registrosFechamentoSemContagem": 0,
        "statusFechamentoSemContagem": Counter(),
        "statusFallback": Counter(),
        "registrosIndefinidosPorGap": 0,
    }
    period_limit = datetime.combine(period_end + timedelta(days=1), time.min)

    for line_code, sequence in sequences.items():
        for index, item in enumerate(sequence):
            row = item.raw
            status = str(row.get("situacao") or "").strip()
            status_key = normalize_text(status)
            next_dt = sequence[index + 1].dt if index + 1 < len(sequence) else period_limit
            next_dt = min(max(next_dt, item.dt), period_limit)
            state = classify_status(status, row.get("descricao"), row.get("conta_incidente"))

            if state is None:
                audit["registrosFechamentoSemContagem"] += 1
                audit["statusFechamentoSemContagem"][status] += 1
                continue
            if status_key not in ({"operacao normal", "operacao encerrada", "dados/status indisponiveis", "atividade programada", "paralisada"} | SPECIAL_STATUSES | PARTIAL_STATUSES):
                audit["statusFallback"][status] += 1

            raw_gap_hours = max((next_dt - item.dt).total_seconds() / 3600, 0.0)
            is_collection_gap = raw_gap_hours > MAX_STATUS_GAP_HOURS
            if is_collection_gap:
                state = "Indefinido"
                audit["registrosIndefinidosPorGap"] += 1

            cascade, cause_line = detect_cascade(row) if not is_collection_gap else (False, None)
            event_end = find_cascade_end(item, next_dt, cause_line, sequences) if cascade else next_dt
            if state in {"Indefinido", "Operação encerrada"}:
                month_hours: dict[str, float] = {}
            else:
                month_hours = split_operational_hours(item.dt, event_end)
            hours = round3(sum(month_hours.values()))
            description = "" if row.get("descricao") is None else str(row.get("descricao"))
            classification = (
                "Indefinido (Gap de coleta)"
                if is_collection_gap
                else str(row.get("classificacao_label") or row.get("classificacao_tipo") or "")
            )

            event: dict[str, Any] = {
                "dataHora": iso_seconds(item.dt),
                "dataLabel": format_label(item.dt),
                "mes": item.dt.strftime("%Y-%m"),
                "linha": item.line_name,
                "operador": canonical_operator(row),
                "status": status,
                "estado": state,
                "classificacao": classification,
                "descricao": description,
                "horas": hours,
                "cor": COLORS[state],
                "meses": month_hours,
                "efeitoCascata": cascade,
                "fechamentoAte": iso_seconds(event_end),
                "fechamentoAteLabel": format_label(event_end),
                "horasAteProximoStatus": hours,
                "duracaoBrutaHoras": round3(raw_gap_hours),
                "idFonte": row.get("id"),
            }
            if cause_line:
                event["linhaCausaCascata"] = cause_line
            events.append(event)

    events.sort(key=lambda event: (event["dataHora"], line_sort_key(event["linha"]), str(event.get("idFonte", ""))))
    for event_id, event in enumerate(events, 1):
        event["id"] = event_id
    audit["statusFechamentoSemContagem"] = dict(audit["statusFechamentoSemContagem"])
    audit["statusFallback"] = dict(audit["statusFallback"])
    audit["registrosEmitidos"] = len(events)
    return events, audit


def empty_metrics(name: str, operator: str | None, total_hours: float, lines_operated: int = 1) -> dict[str, Any]:
    return {
        "nome": name,
        "operador": operator,
        "linhasOperadas": lines_operated,
        "horasTotaisOperacao": round3(total_hours),
        "horasDisponivel": 0.0,
        "horasEventoEspecial": 0.0,
        "horasManutencaoProgramada": 0.0,
        "horasFalhaParcial": 0.0,
        "horasFalhaTotal": 0.0,
        "horasIndefinidas": 0.0,
        "horasFalha": 0.0,
        "qtdRegistros": 0,
        "qtdDisponivel": 0,
        "qtdEventoEspecial": 0,
        "qtdManutencaoProgramada": 0,
        "qtdFalhaParcial": 0,
        "qtdFalhaTotal": 0,
        "qtdIndefinidos": 0,
        "qtdFalhas": 0,
        "qtdEncerramentos": 0,
        "disponibilidadePct": 0.0,
        "falhaParcialPct": 0.0,
        "falhaTotalPct": 0.0,
        "mediaHorasAteNovaFalha": 0.0,
    }


def apply_event(metrics: dict[str, Any], event: dict[str, Any]) -> None:
    metrics["qtdRegistros"] += 1
    state = event["estado"]
    hours = float(event.get("horas") or 0)
    if state == "Disponível":
        metrics["qtdDisponivel"] += 1
    elif state == "Evento especial":
        metrics["qtdEventoEspecial"] += 1
        metrics["horasEventoEspecial"] += hours
    elif state == "Manutenção programada":
        metrics["qtdManutencaoProgramada"] += 1
        metrics["horasManutencaoProgramada"] += hours
    elif state == "Ocorrência operacional":
        metrics["qtdFalhaParcial"] += 1
        metrics["horasFalhaParcial"] += hours
    elif state == "Falha total / paralisação":
        metrics["qtdFalhaTotal"] += 1
        metrics["horasFalhaTotal"] += hours
    elif state == "Indefinido":
        metrics["qtdIndefinidos"] += 1
        metrics["horasIndefinidas"] += hours
    elif state == "Operação encerrada":
        metrics["qtdEncerramentos"] += 1


def finalize_metrics(metrics: dict[str, Any], failure_intervals: Sequence[float] = ()) -> dict[str, Any]:
    for key in (
        "horasEventoEspecial", "horasManutencaoProgramada", "horasFalhaParcial",
        "horasFalhaTotal", "horasIndefinidas",
    ):
        metrics[key] = round3(metrics[key])
    metrics["horasFalha"] = round3(metrics["horasFalhaParcial"] + metrics["horasFalhaTotal"])
    metrics["qtdFalhas"] = metrics["qtdManutencaoProgramada"] + metrics["qtdFalhaParcial"] + metrics["qtdFalhaTotal"]
    metrics["horasDisponivel"] = round3(max(
        metrics["horasTotaisOperacao"] - metrics["horasManutencaoProgramada"]
        - metrics["horasFalhaParcial"] - metrics["horasFalhaTotal"] - metrics["horasIndefinidas"],
        0,
    ))
    denominator = max(float(metrics["horasTotaisOperacao"]), 1.0)
    metrics["disponibilidadePct"] = round3(metrics["horasDisponivel"] / denominator * 100)
    metrics["falhaParcialPct"] = round3(metrics["horasFalhaParcial"] / denominator * 100)
    metrics["falhaTotalPct"] = round3(metrics["horasFalhaTotal"] / denominator * 100)
    metrics["mediaHorasAteNovaFalha"] = round3(mean(failure_intervals)) if failure_intervals else 0.0
    return metrics


def failure_intervals_by_line(events: Sequence[dict[str, Any]]) -> dict[str, list[float]]:
    failures: defaultdict[str, list[datetime]] = defaultdict(list)
    for event in events:
        if event["estado"] in {"Ocorrência operacional", "Falha total / paralisação"}:
            failures[event["linha"]].append(parse_datetime(event["dataHora"]))
    result: dict[str, list[float]] = {}
    for line, dates in failures.items():
        dates.sort()
        result[line] = [operational_hours_between(a, b) for a, b in zip(dates, dates[1:]) if b > a]
    return result


def aggregate_payload(
    events: Sequence[dict[str, Any]],
    line_names: Sequence[str],
    period_start: date,
    period_end: date,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    days = (period_end - period_start).days + 1
    hours_per_line = days * HOURS_PER_OPERATION_DAY
    events_by_line: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        events_by_line[event["linha"]].append(event)
    intervals = failure_intervals_by_line(events)

    lines: list[dict[str, Any]] = []
    line_operator: dict[str, str] = {}
    for line in sorted(line_names, key=line_sort_key):
        line_events = events_by_line.get(line, [])
        operators = Counter(event["operador"] for event in line_events)
        operator = operators.most_common(1)[0][0] if operators else "Não informado"
        line_operator[line] = operator
        metrics = empty_metrics(line, operator, hours_per_line)
        for event in line_events:
            apply_event(metrics, event)
        lines.append(finalize_metrics(metrics, intervals.get(line, [])))
    lines.sort(key=lambda row: (row["disponibilidadePct"], line_sort_key(row["nome"])))

    operators_to_lines: defaultdict[str, list[str]] = defaultdict(list)
    for line, operator in line_operator.items():
        operators_to_lines[operator].append(line)
    operator_rows: list[dict[str, Any]] = []
    for operator, operator_lines in operators_to_lines.items():
        metrics = empty_metrics(operator, None, hours_per_line * len(operator_lines), len(operator_lines))
        for line in operator_lines:
            for event in events_by_line.get(line, []):
                apply_event(metrics, event)
        operator_rows.append(finalize_metrics(metrics))
    operator_rows.sort(key=lambda row: (row["disponibilidadePct"], row["nome"]))

    total_metrics = empty_metrics("Rede", None, hours_per_line * len(line_names), len(line_names))
    for event in events:
        apply_event(total_metrics, event)
    total_metrics = finalize_metrics(total_metrics, [value for values in intervals.values() for value in values])
    kpis = {key: value for key, value in total_metrics.items() if key not in {"nome", "operador", "linhasOperadas"}}

    problems: defaultdict[str, dict[str, float | int]] = defaultdict(lambda: {"qtd": 0, "horas": 0.0})
    for event in events:
        if event["estado"] not in {"Manutenção programada", "Ocorrência operacional", "Falha total / paralisação"}:
            continue
        category = (event.get("descricao") or event.get("status") or "Sem descrição").strip()[:100]
        problems[category]["qtd"] += 1
        problems[category]["horas"] += float(event.get("horas") or 0)
    problem_rows = [
        {"categoria": category, "qtd": int(values["qtd"]), "horas": round3(float(values["horas"]))}
        for category, values in problems.items()
    ]
    problem_rows.sort(key=lambda row: (-row["horas"], -row["qtd"], row["categoria"]))

    monthly: list[dict[str, Any]] = []
    for month_key in period_months(period_start, period_end):
        year, month = (int(part) for part in month_key.split("-"))
        row: dict[str, Any] = {
            "mes": month_key,
            "mesLabel": f"{MONTH_NAMES[month - 1]}/{year}",
            "horasEsperadasPorLinha": round3(days_in_month_inside_period(month_key, period_start, period_end) * HOURS_PER_OPERATION_DAY),
            "horasDisponivel": 0.0,
            "horasEventoEspecial": 0.0,
            "horasManutencaoProgramada": 0.0,
            "horasFalhaParcial": 0.0,
            "horasFalhaTotal": 0.0,
            "horasIndefinidas": 0.0,
            "qtdDisponivel": 0,
            "qtdEventoEspecial": 0,
            "qtdManutencaoProgramada": 0,
            "qtdFalhaParcial": 0,
            "qtdFalhaTotal": 0,
            "qtdIndefinidos": 0,
            "qtdEncerramentos": 0,
        }
        for event in events:
            hours = float(event.get("meses", {}).get(month_key, 0))
            state = event["estado"]
            hour_key = {
                "Evento especial": "horasEventoEspecial",
                "Manutenção programada": "horasManutencaoProgramada",
                "Ocorrência operacional": "horasFalhaParcial",
                "Falha total / paralisação": "horasFalhaTotal",
                "Indefinido": "horasIndefinidas",
            }.get(state)
            if hour_key:
                row[hour_key] += hours
            if event["mes"] == month_key:
                count_key = {
                    "Disponível": "qtdDisponivel",
                    "Evento especial": "qtdEventoEspecial",
                    "Manutenção programada": "qtdManutencaoProgramada",
                    "Ocorrência operacional": "qtdFalhaParcial",
                    "Falha total / paralisação": "qtdFalhaTotal",
                    "Indefinido": "qtdIndefinidos",
                    "Operação encerrada": "qtdEncerramentos",
                }[state]
                row[count_key] += 1
        for key in ("horasEventoEspecial", "horasManutencaoProgramada", "horasFalhaParcial", "horasFalhaTotal", "horasIndefinidas"):
            row[key] = round3(row[key])
        expected = row["horasEsperadasPorLinha"] * len(line_names)
        row["horasDisponivel"] = round3(max(expected - row["horasManutencaoProgramada"] - row["horasFalhaParcial"] - row["horasFalhaTotal"] - row["horasIndefinidas"], 0))
        monthly.append(row)

    rankings = {"linhas": lines, "operadores": operator_rows, "problemas": problem_rows}
    availability_series = []
    state_to_fields = {
        "Disponível": ("horasDisponivel", "qtdDisponivel"),
        "Evento especial": ("horasEventoEspecial", "qtdEventoEspecial"),
        "Manutenção programada": ("horasManutencaoProgramada", "qtdManutencaoProgramada"),
        "Ocorrência operacional": ("horasFalhaParcial", "qtdFalhaParcial"),
        "Falha total / paralisação": ("horasFalhaTotal", "qtdFalhaTotal"),
        "Indefinido": ("horasIndefinidas", "qtdIndefinidos"),
        "Operação encerrada": (None, "qtdEncerramentos"),
    }
    for state in STATE_ORDER:
        hours_key, count_key = state_to_fields[state]
        availability_series.append({
            "categoria": state,
            "horas": kpis[hours_key] if hours_key else 0.0,
            "quantidade": kpis[count_key],
            "cor": COLORS[state],
        })
    series = {"mensal": monthly, "disponibilidadeGeral": availability_series}
    return kpis, rankings, series


def build_summary(
    rows: Sequence[dict[str, Any]],
    period_label: str,
    source_name: str,
    generated_at: str | None = None,
) -> dict[str, Any]:
    period_specs = {
        "2024": ("2024", date(2024, 1, 1), date(2024, 12, 31), "2024", False),
        "2025": ("2025", date(2025, 1, 1), date(2025, 12, 31), "2025", False),
        "2024_1sem": ("2024", date(2024, 1, 1), date(2024, 6, 30), "2024", True),
        "2025_1sem": ("2025", date(2025, 1, 1), date(2025, 6, 30), "2025", True),
        "2026_1sem": ("2026_1sem", date(2026, 1, 1), date(2026, 6, 30), "2026", True),
    }
    source_period, period_start, period_end, display_year, is_semester = period_specs[period_label]

    selected = [
        row
        for row in rows
        if str(row.get("periodo")) == source_period
        and period_start <= datetime.fromisoformat(str(row.get("data_hora")).replace("Z", "+00:00")).date() <= period_end
    ]
    prepared = prepare_rows(selected)
    events, audit = build_events(prepared, period_start, period_end)
    line_names = sorted({item.line_name for item in prepared}, key=line_sort_key)
    kpis, rankings, series = aggregate_payload(events, line_names, period_start, period_end)
    operators = sorted({event["operador"] for event in events})
    days = (period_end - period_start).days + 1
    last_dt = max((item.dt for item in prepared), default=datetime.combine(period_end, time.min))

    metadata = {
        "fonte": source_name,
        "fonteFormato": "CCM/ARTESP - API Trilhos",
        "geradoEm": generated_at,
        "periodoInicio": period_start.isoformat(),
        "periodoFim": period_end.isoformat(),
        "periodoFimDataHora": iso_seconds(last_dt),
        "periodoLabel": f"{period_start.strftime('%d/%m/%Y')} a {period_end.strftime('%d/%m/%Y')}",
        "periodoParcial": is_semester,
        "mensagemParcial": f"Recorte comparável do primeiro semestre de {display_year}." if is_semester else f"Base CCM reprocessada para o ano completo de {display_year}.",
        "registrosOriginais": len(selected),
        "registrosNormalizados": len(events),
        "duplicidadesRemovidasLinhaHorario": 0,
        "linhas": len(line_names),
        "operadores": len(operators),
        "jornadaOperacionalPadrao": "04:30 às 00:00",
        "horasOperacaoDiaPorLinha": HOURS_PER_OPERATION_DAY,
        "horasOperacaoAnoPorLinha": round3(days * HOURS_PER_OPERATION_DAY),
        "horasOperacaoPeriodoPorLinha": round3(days * HOURS_PER_OPERATION_DAY),
        "metodoDuracao": f"Cada status termina no próximo registro da mesma linha; a duração é recortada diariamente na janela 04:30–00:00. Intervalos acima de {MAX_STATUS_GAP_HOURS:.0f} h são gaps de coleta e não somam horas.",
        "regraDisponibilidade": "Disponibilidade = tempo esperado menos manutenção programada, ocorrência operacional, falha total e horas indefinidas.",
        "observacaoDenominador": f"Denominador de {HOURS_PER_OPERATION_DAY:.2f} h por linha/dia dentro do período.",
        "cores": {
            "disponivel": COLORS["Disponível"],
            "eventoEspecial": COLORS["Evento especial"],
            "falhaParcial": COLORS["Ocorrência operacional"],
            "manutencaoProgramada": COLORS["Manutenção programada"],
            "falhaTotal": COLORS["Falha total / paralisação"],
            "indefinido": COLORS["Indefinido"],
            "operacaoEncerrada": COLORS["Operação encerrada"],
        },
        "cascatasIdentificadas": sum(bool(event.get("efeitoCascata")) for event in events),
        "cascatasComLinhaCausadora": sum(bool(event.get("linhaCausaCascata")) for event in events),
        "regraCascata": "Menções explícitas a outra linha são marcadas como cascata; um retorno normal anterior pode encerrar a duração.",
        "regraManutencaoProgramadaResidual": "Circulação de Trens e Maiores Intervalos dependem da descrição; termos explicitamente programados prevalecem.",
        "regraIndefinidos": "Dados/Status Indisponíveis permanece auditável sem horas. Dados Indisponíveis, Status Desconhecido e Status não disponível somente fecham o ciclo anterior.",
        "auditoriaGeracao": audit,
    }
    options = {
        "linhas": line_names,
        "operadores": operators,
        "estados": STATE_ORDER,
        "status": sorted({event["status"] for event in events}),
    }
    return {
        "metadata": metadata,
        "kpis": kpis,
        "options": options,
        "rankings": rankings,
        "series": series,
        "events": events,
        "amostraRegistros": list(reversed(events[-25:])),
    }


def output_filename(period_label: str) -> str:
    return {
        "2024": "ocorrencias-summary-2024.json",
        "2025": "ocorrencias-summary.json",
        "2024_1sem": "ocorrencias-summary-2024-1sem.json",
        "2025_1sem": "ocorrencias-summary-2025-1sem.json",
        "2026_1sem": "ocorrencias-summary-2026.json",
    }[period_label]


def load_source(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, dict) or not isinstance(payload.get("ocorrencias"), list):
        raise ValueError("entrada deve ser um objeto JSON com a lista 'ocorrencias'")
    rows, removed = deduplicate_rows(payload["ocorrencias"])
    meta = dict(payload.get("meta") or {})
    meta["duplicidadesRemovidasNoGerador"] = removed
    return rows, meta


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="JSON consolidado da extração CCM")
    parser.add_argument("--output-dir", type=Path, required=True, help="Diretório para os summaries gerados")
    parser.add_argument(
        "--periods",
        nargs="+",
        choices=("2024", "2025", "2024_1sem", "2025_1sem", "2026_1sem"),
        default=("2024", "2025", "2024_1sem", "2025_1sem", "2026_1sem"),
    )
    args = parser.parse_args(argv)

    rows, source_meta = load_source(args.input)
    source_name = args.input.name
    generated_at = source_meta.get("gerado_em")
    manifest: dict[str, Any] = {"fonte": str(args.input.resolve()), "periodos": {}}
    for period in args.periods:
        summary = build_summary(rows, period, source_name, generated_at)
        filename = output_filename(period)
        destination = args.output_dir / filename
        write_json(destination, summary)
        manifest["periodos"][period] = {
            "arquivo": filename,
            "registrosEntrada": summary["metadata"]["registrosOriginais"],
            "registrosEmitidos": len(summary["events"]),
            "kpis": summary["kpis"],
        }
        print(f"[CCM] {period}: {len(summary['events'])} eventos -> {destination}")
    write_json(args.output_dir / "manifest.json", manifest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
