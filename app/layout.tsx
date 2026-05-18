import type { Metadata } from "next";
import "./globals.css";

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Painel de disponibilidade e ocorrências no metrô e trens de São Paulo",
  description:
    "Explore, de forma simples, a disponibilidade, as ocorrências, as manutenções e as paralisações do metrô e dos trens de São Paulo.",
  icons: {
    icon: `${assetBase}/images/painel_1.svg`,
    shortcut: `${assetBase}/images/painel_1.svg`,
    apple: `${assetBase}/images/painel_1.svg`,
  },
  openGraph: {
    title: "Painel de disponibilidade e ocorrências no metrô e trens de São Paulo",
    description:
      "Explore, de forma simples, a disponibilidade, as ocorrências, as manutenções e as paralisações do metrô e dos trens de São Paulo.",
    images: [
      {
        url: `${assetBase}/images/thumb-disponibilidade.jpg`,
        width: 2048,
        height: 1365,
        alt: "Multidão em estação metroferroviária de São Paulo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Painel de disponibilidade e ocorrências no metrô e trens de São Paulo",
    description:
      "Explore, de forma simples, a disponibilidade, as ocorrências, as manutenções e as paralisações do metrô e dos trens de São Paulo.",
    images: [`${assetBase}/images/thumb-disponibilidade.jpg`],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
