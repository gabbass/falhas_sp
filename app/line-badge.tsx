"use client";

import type { CSSProperties } from "react";

const CORES_LINHAS: Record<number, string> = {
  1: "#0063BA",
  2: "#097A5E",
  3: "#F02137",
  4: "#FCC917",
  5: "#884DBF",
  7: "#AB0450",
  8: "#A5A596",
  9: "#64B396",
  10: "#007687",
  11: "#F55F1A",
  12: "#262670",
  13: "#00B052",
  15: "#8D8F8C",
};

type LineBadgeStyle = CSSProperties & {
  "--line-color": string;
  "--line-contrast": "#000000" | "#FFFFFF";
};

export function numeroDaLinha(nome: string): string | null {
  return nome.match(/linha\s*0*(\d+)/i)?.[1] ?? null;
}

export function corDaLinha(nome: string): string | null {
  const numero = Number(numeroDaLinha(nome));
  if (Number.isFinite(numero) && CORES_LINHAS[numero]) return CORES_LINHAS[numero];
  return null;
}

function contrasteDaCor(hex: string): "#000000" | "#FFFFFF" {
  const valor = hex.replace("#", "");
  const r = Number.parseInt(valor.slice(0, 2), 16);
  const g = Number.parseInt(valor.slice(2, 4), 16);
  const b = Number.parseInt(valor.slice(4, 6), 16);
  const luminancia = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminancia > 0.58 ? "#000000" : "#FFFFFF";
}

export default function LineBadge({ nome, className = "" }: { nome: string; className?: string }) {
  const cor = corDaLinha(nome);
  const numero = numeroDaLinha(nome);
  if (!cor || !numero) return <span>{nome}</span>;
  const style: LineBadgeStyle = {
    "--line-color": cor,
    "--line-contrast": contrasteDaCor(cor),
  };

  return (
    <span
      className={`line-number-badge ${className}`.trim()}
      style={style}
      tabIndex={0}
      aria-label={nome}
      title={nome}
    >
      <span aria-hidden="true">{numero}</span>
      <span className="line-number-tooltip" role="tooltip">{nome}</span>
    </span>
  );
}

export function LineBadgeTick({ x = 0, y = 0, payload }: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const nome = String(payload?.value ?? "");
  return (
    <foreignObject x={x - 36} y={y - 14} width="28" height="48" overflow="visible">
      <div className="line-badge-svg-host line-badge-svg-host--chart">
        <LineBadge nome={nome} className="line-number-badge--chart" />
      </div>
    </foreignObject>
  );
}

export function nomesDeLinhaNoTexto(texto: string): string[] {
  return Array.from(texto.matchAll(/(?:Linhas?\s+)?(\d+)\s*-\s*([\p{L}]+)/giu)).map(
    (match) => `Linha ${match[1]}-${match[2]}`,
  );
}

export function LineBadgesInText({ texto }: { texto: string }) {
  const regex = /(?:Linhas?\s+)?(\d+)\s*-\s*([\p{L}]+)/giu;
  const partes = [];
  let inicio = 0;
  let indice = 0;

  for (const match of texto.matchAll(regex)) {
    const posicao = match.index ?? 0;
    if (posicao > inicio) partes.push(texto.slice(inicio, posicao));
    partes.push(<LineBadge key={`${match[0]}-${indice}`} nome={`Linha ${match[1]}-${match[2]}`} />);
    inicio = posicao + match[0].length;
    indice += 1;
  }

  if (inicio < texto.length) partes.push(texto.slice(inicio));
  return <>{partes}</>;
}
