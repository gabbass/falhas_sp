import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel de disponibilidade e ocorrências no metrô e trens de São Paulo",
  description:
    "Explore, de forma simples, a disponibilidade, as ocorrências, as manutenções e as paralisações do metrô e dos trens de São Paulo.",
  icons: {
    icon: "/images/painel_1.svg",
    shortcut: "/images/painel_1.svg",
    apple: "/images/painel_1.svg",
  },
  openGraph: {
    title: "Painel de disponibilidade e ocorrências no metrô e trens de São Paulo",
    description:
      "Explore, de forma simples, a disponibilidade, as ocorrências, as manutenções e as paralisações do metrô e dos trens de São Paulo.",
    images: [
      {
        url: "/images/thumb-disponibilidade.jpg",
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
    images: ["/images/thumb-disponibilidade.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
