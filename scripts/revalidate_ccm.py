#!/usr/bin/env python3
"""Revalida summaries CCM de 2024/2025 e compara com as bases publicadas."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any, Sequence

from ccm_summary import (
    CLOSURE_ONLY_STATUSES,
    HOURS_PER_OPERATION_DAY,
    MAX_STATUS_GAP_HOURS,
    normalize_text,
    round3,
    write_json,
)


FILES = {"2024": "ocorrencias-summary-2024.json", "2025": "ocorrencias-summary.json"}
HOUR_KPIS = (
    "horasTotaisOperacao", "horasDisponivel", "horasEventoEspecial",
    "horasManutencaoProgramada", "horasFalhaParcial", "horasFalhaTotal",
    "horasIndefinidas", "horasFalha",
)
COUNT_KPIS = (
    "qtdRegistros", "qtdDisponivel", "qtdEventoEspecial",
    "qtdManutencaoProgramada", "qtdFalhaParcial", "qtdFalhaTotal",
    "qtdIndefinidos", "qtdFalhas", "qtdEncerramentos",
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def diff_value(current: float, baseline: float, revalidated_baseline: float | None = None) -> dict[str, float | None]:
    comparison_baseline = baseline if revalidated_baseline is None else revalidated_baseline
    delta = round3(current - comparison_baseline)
    pct = None if comparison_baseline == 0 else round3(delta / comparison_baseline * 100)
    return {
        "publicado": baseline,
        "publicadoRevalidado": comparison_baseline,
        "gerado": current,
        "delta": delta,
        "deltaPct": pct,
    }


def event_key(event: dict[str, Any]) -> tuple[str, str, str]:
    return (str(event.get("dataHora")), str(event.get("linha")), str(event.get("status")))


def structural_checks(payload: dict[str, Any], year: str) -> list[dict[str, Any]]:
    checks: list[dict[str, Any]] = []
    required = {"metadata", "kpis", "options", "rankings", "series", "events", "amostraRegistros"}
    missing = sorted(required - payload.keys())
    checks.append({"nome": "contrato_top_level", "ok": not missing, "detalhe": missing})
    if missing:
        return checks

    events = payload["events"]
    invalid_hours = [event.get("id") for event in events if float(event.get("horas") or 0) < 0]
    checks.append({"nome": "duracoes_nao_negativas", "ok": not invalid_hours, "detalhe": invalid_hours[:20]})

    leaked_closures = [event.get("id") for event in events if normalize_text(event.get("status")) in CLOSURE_ONLY_STATUSES]
    checks.append({"nome": "fechamentos_sem_contagem_omitidos", "ok": not leaked_closures, "detalhe": leaked_closures[:20]})

    unsafe_gaps = [
        event.get("id") for event in events
        if float(event.get("duracaoBrutaHoras") or 0) > MAX_STATUS_GAP_HOURS
        and event.get("estado") != "Indefinido"
    ]
    checks.append({"nome": "gaps_longos_sem_horas_artificiais", "ok": not unsafe_gaps, "detalhe": unsafe_gaps[:20]})

    start = date.fromisoformat(payload["metadata"]["periodoInicio"])
    end = date.fromisoformat(payload["metadata"]["periodoFim"])
    expected = round3(((end - start).days + 1) * len(payload["options"]["linhas"]) * HOURS_PER_OPERATION_DAY)
    checks.append({
        "nome": "denominador_periodo",
        "ok": abs(float(payload["kpis"]["horasTotaisOperacao"]) - expected) <= 0.001,
        "detalhe": {"esperado": expected, "informado": payload["kpis"]["horasTotaisOperacao"]},
    })

    kpis = payload["kpis"]
    expected_available = round3(max(
        float(kpis["horasTotaisOperacao"]) - float(kpis["horasManutencaoProgramada"])
        - float(kpis["horasFalhaParcial"]) - float(kpis["horasFalhaTotal"])
        - float(kpis["horasIndefinidas"]), 0,
    ))
    checks.append({
        "nome": "formula_disponibilidade",
        "ok": abs(float(kpis["horasDisponivel"]) - expected_available) <= 0.001,
        "detalhe": {"esperado": expected_available, "informado": kpis["horasDisponivel"]},
    })

    monthly = payload["series"]["mensal"]
    monthly_fields = {
        "horasEventoEspecial": "horasEventoEspecial",
        "horasManutencaoProgramada": "horasManutencaoProgramada",
        "horasFalhaParcial": "horasFalhaParcial",
        "horasFalhaTotal": "horasFalhaTotal",
        "horasIndefinidas": "horasIndefinidas",
    }
    monthly_diffs = {}
    for monthly_key, kpi_key in monthly_fields.items():
        total = round3(sum(float(row[monthly_key]) for row in monthly))
        if abs(total - float(kpis[kpi_key])) > 0.001:
            monthly_diffs[monthly_key] = {"mensal": total, "kpi": kpis[kpi_key]}
    checks.append({"nome": "series_mensais_reconciliadas", "ok": not monthly_diffs, "detalhe": monthly_diffs})

    status_counts = Counter(event["status"] for event in events)
    fallback = payload["metadata"].get("auditoriaGeracao", {}).get("statusFallback", {})
    checks.append({"nome": "status_fallback_auditado", "ok": True, "detalhe": fallback})
    checks.append({"nome": "eventos_por_status", "ok": True, "detalhe": dict(status_counts)})
    return checks


def compare_payloads(generated: dict[str, Any], baseline: dict[str, Any]) -> dict[str, Any]:
    baseline_start = date.fromisoformat(baseline["metadata"]["periodoInicio"])
    baseline_end = date.fromisoformat(baseline["metadata"]["periodoFim"])
    baseline_expected = round3(
        ((baseline_end - baseline_start).days + 1)
        * len(baseline["options"]["linhas"])
        * HOURS_PER_OPERATION_DAY
    )
    baseline_available = round3(max(
        baseline_expected
        - float(baseline["kpis"].get("horasManutencaoProgramada", 0))
        - float(baseline["kpis"].get("horasFalhaParcial", 0))
        - float(baseline["kpis"].get("horasFalhaTotal", 0))
        - float(baseline["kpis"].get("horasIndefinidas", 0)),
        0,
    ))
    normalized_baseline = {
        "horasTotaisOperacao": baseline_expected,
        "horasDisponivel": baseline_available,
        "disponibilidadePct": round3(baseline_available / max(baseline_expected, 1) * 100),
    }
    kpi_diffs = {}
    for key in HOUR_KPIS + COUNT_KPIS + ("disponibilidadePct",):
        kpi_diffs[key] = diff_value(
            float(generated["kpis"].get(key, 0)),
            float(baseline["kpis"].get(key, 0)),
            normalized_baseline.get(key),
        )

    generated_keys = Counter(event_key(event) for event in generated["events"])
    baseline_keys = Counter(event_key(event) for event in baseline["events"])
    common = sum((generated_keys & baseline_keys).values())
    operator_generated = Counter(event.get("operador") for event in generated["events"])
    operator_baseline = Counter(event.get("operador") for event in baseline["events"])
    return {
        "kpis": kpi_diffs,
        "eventos": {
            "publicados": len(baseline["events"]),
            "gerados": len(generated["events"]),
            "correspondenciasDataLinhaStatus": common,
            "somentePublicados": len(baseline["events"]) - common,
            "somenteGerados": len(generated["events"]) - common,
        },
        "operadores": {
            "publicado": dict(operator_baseline),
            "gerado": dict(operator_generated),
        },
    }


def markdown_report(report: dict[str, Any]) -> str:
    lines = ["# Revalidação CCM 2024–2025", ""]
    lines.append(f"Resultado dos arquivos gerados: **{'APROVADO' if report['aprovado'] else 'REPROVADO'}**")
    for year, result in report["anos"].items():
        lines.extend(["", f"## {year}", "", "### Verificações", ""])
        for check in result["verificacoes"]:
            lines.append(f"- {'OK' if check['ok'] else 'ERRO'} — {check['nome']}")
        lines.extend(["", f"Base publicada historicamente consistente: **{'SIM' if result['baselineAprovada'] else 'NÃO'}**"])
        for check in result["verificacoesBaseline"]:
            if not check["ok"]:
                lines.append(f"- ERRO NA BASE PUBLICADA — {check['nome']}: `{check['detalhe']}`")
        comparison = result["comparacao"]
        lines.extend(["", "### Eventos", ""])
        for key, value in comparison["eventos"].items():
            lines.append(f"- {key}: {value}")
        lines.extend(["", "### KPIs principais", "", "O delta usa a coluna revalidada como referência.", "", "| KPI | Publicado bruto | Publicado revalidado | Gerado | Delta | Delta % |", "|---|---:|---:|---:|---:|---:|"])
        for key in ("horasDisponivel", "horasManutencaoProgramada", "horasFalhaParcial", "horasFalhaTotal", "qtdRegistros", "disponibilidadePct"):
            item = comparison["kpis"][key]
            pct = "—" if item["deltaPct"] is None else item["deltaPct"]
            lines.append(f"| {key} | {item['publicado']} | {item['publicadoRevalidado']} | {item['gerado']} | {item['delta']} | {pct} |")
    return "\n".join(lines) + "\n"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generated-dir", type=Path, required=True)
    parser.add_argument("--baseline-dir", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True, help="Relatório JSON")
    parser.add_argument("--markdown", type=Path, help="Relatório Markdown opcional")
    args = parser.parse_args(argv)

    report: dict[str, Any] = {"aprovado": True, "anos": {}}
    for year, filename in FILES.items():
        generated = load_json(args.generated_dir / filename)
        baseline = load_json(args.baseline_dir / filename)
        checks = structural_checks(generated, year)
        baseline_checks = structural_checks(baseline, year)
        approved = all(check["ok"] for check in checks)
        report["aprovado"] = report["aprovado"] and approved
        report["anos"][year] = {
            "aprovado": approved,
            "verificacoes": checks,
            "baselineAprovada": all(check["ok"] for check in baseline_checks),
            "verificacoesBaseline": baseline_checks,
            "comparacao": compare_payloads(generated, baseline),
        }
        print(f"[REVALIDAÇÃO] {year}: {'APROVADO' if approved else 'REPROVADO'}")

    write_json(args.report, report)
    if args.markdown:
        args.markdown.parent.mkdir(parents=True, exist_ok=True)
        args.markdown.write_text(markdown_report(report), encoding="utf-8")
    return 0 if report["aprovado"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
