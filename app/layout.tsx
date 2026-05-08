import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ocorrências Metroferroviárias 2025",
  description: "Dashboard de falhas, indisponibilidade e recorrência por linha e operador"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
