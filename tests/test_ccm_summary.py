from __future__ import annotations

import unittest
from datetime import datetime

from scripts.ccm_summary import build_summary, classify_status, split_operational_hours


class ClassificationTests(unittest.TestCase):
    def test_circulacao_de_trens_uses_description(self) -> None:
        self.assertEqual(
            classify_status("Circulação de Trens", "Devido à manutenção programada, os trens circulam com maiores intervalos"),
            "Manutenção programada",
        )
        self.assertEqual(
            classify_status("Circulação de Trens", "Devido à falha em equipamento de via, há velocidade reduzida"),
            "Ocorrência operacional",
        )
        self.assertEqual(
            classify_status("Circulação de Trens", "Devido à atividade de manutenção na via"),
            "Manutenção programada",
        )

    def test_operacao_diferenciada_is_special(self) -> None:
        self.assertEqual(classify_status("Operação Diferenciada", "Operação estendida"), "Evento especial")

    def test_maiores_intervalos_uses_description(self) -> None:
        self.assertEqual(classify_status("Maiores Intervalos", "Devido à atividade programada"), "Manutenção programada")
        self.assertEqual(classify_status("Maiores Intervalos", "Equipes de manutenção estão no local"), "Manutenção programada")
        self.assertEqual(classify_status("Maiores Intervalos", "Devido à interferência externa"), "Ocorrência operacional")

    def test_closure_only_statuses_are_not_emitted(self) -> None:
        for status in ("Dados Indisponíveis", "Status Desconhecido", "Status não disponível"):
            with self.subTest(status=status):
                self.assertIsNone(classify_status(status, "Paralisada"))

    def test_legacy_unavailable_status_remains_auditable(self) -> None:
        self.assertEqual(classify_status("Dados/Status Indisponíveis", ""), "Indefinido")


class OperationalWindowTests(unittest.TestCase):
    def test_clips_before_and_after_window(self) -> None:
        result = split_operational_hours(datetime(2026, 1, 1, 2), datetime(2026, 1, 2, 2))
        self.assertEqual(result, {"2026-01": 19.5})

    def test_splits_across_months(self) -> None:
        result = split_operational_hours(datetime(2025, 1, 31, 23), datetime(2025, 2, 1, 6))
        self.assertEqual(result, {"2025-01": 1.0, "2025-02": 1.5})


def source_row(source_id: int, timestamp: str, status: str, description: str = "", period: str = "2026_1sem") -> dict:
    return {
        "periodo": period,
        "id": source_id,
        "data_hora": timestamp,
        "linha_codigo": "1",
        "linha_nome": "Linha 1-Azul",
        "operadora_final": "Metrô de São Paulo",
        "situacao": status,
        "descricao": description,
        "classificacao_label": "Operacional (Online)",
        "conta_incidente": status != "Operação Normal",
    }


class SummaryIntegrationTests(unittest.TestCase):
    def test_first_semester_uses_full_year_source_and_excludes_second_semester(self) -> None:
        rows = [
            source_row(1, "2025-06-30T05:00:00", "Operação Normal", period="2025"),
            source_row(2, "2025-07-01T05:00:00", "Operação Parcial", "Falha em trem", period="2025"),
        ]
        summary = build_summary(rows, "2025_1sem", "fixture.json")
        self.assertEqual(summary["metadata"]["periodoFim"], "2025-06-30")
        self.assertEqual(summary["metadata"]["registrosOriginais"], 1)
        self.assertEqual(summary["metadata"]["mensagemParcial"], "Recorte comparável do primeiro semestre de 2025.")
        self.assertNotIn("2025-07", {event["mes"] for event in summary["events"]})

    def test_second_semester_uses_full_year_source_and_excludes_first_semester(self) -> None:
        rows = [
            source_row(1, "2024-06-30T05:00:00", "Operação Normal", period="2024"),
            source_row(2, "2024-07-01T05:00:00", "Operação Parcial", "Falha em trem", period="2024"),
        ]
        summary = build_summary(rows, "2024_2sem", "fixture.json")
        self.assertEqual(summary["metadata"]["periodoInicio"], "2024-07-01")
        self.assertEqual(summary["metadata"]["registrosOriginais"], 1)
        self.assertEqual(summary["metadata"]["mensagemParcial"], "Recorte comparável do segundo semestre de 2024.")
        self.assertNotIn("2024-06", {event["mes"] for event in summary["events"]})

    def test_closure_only_record_closes_previous_event_and_is_omitted(self) -> None:
        rows = [
            source_row(1, "2026-01-01T04:30:00", "Operação Normal"),
            source_row(2, "2026-01-01T05:30:00", "Dados Indisponíveis"),
            source_row(3, "2026-01-01T06:30:00", "Operação Normal"),
            source_row(4, "2026-01-01T07:30:00", "Operação Encerrada"),
        ]
        summary = build_summary(rows, "2026_1sem", "fixture.json")
        self.assertEqual(len(summary["events"]), 3)
        self.assertEqual(summary["events"][0]["horas"], 1.0)
        self.assertNotIn("Dados Indisponíveis", summary["options"]["status"])
        self.assertEqual(summary["metadata"]["auditoriaGeracao"]["registrosFechamentoSemContagem"], 1)

    def test_long_collection_gap_becomes_indefinite(self) -> None:
        rows = [
            source_row(1, "2026-01-01T05:00:00", "Operação Parcial", "Falha em trem"),
            source_row(2, "2026-01-05T05:00:00", "Operação Normal"),
        ]
        summary = build_summary(rows, "2026_1sem", "fixture.json")
        first = summary["events"][0]
        self.assertEqual(first["estado"], "Indefinido")
        self.assertEqual(first["horas"], 0.0)
        self.assertEqual(first["classificacao"], "Indefinido (Gap de coleta)")


if __name__ == "__main__":
    unittest.main()
