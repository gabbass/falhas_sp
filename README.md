# Falhas SP — Dashboard de Ocorrências Metroferroviárias

Dashboard público em Next.js para visualização das ocorrências metroferroviárias da RMSP.

## Rodar localmente

```powershell
npm install
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Publicação no GitHub Pages

Este projeto está configurado para o repositório:

```text
https://github.com/gabbass/falhas_sp.git
```

Quando publicado pelo GitHub Actions, o painel fica em:

```text
https://gabbass.github.io/falhas_sp/
```

No GitHub, confirme em:

```text
Settings → Pages → Source → GitHub Actions
```

## Build local estático

```powershell
$env:GITHUB_PAGES="true"
npm run build
```

A saída estática será gerada em:

```text
out/
```

## Base de dados atual

- Fonte do arquivo tratado: `ocorrencias_metro_20250101_20251231.xlsx`.
- Período: `01/01/2025` a `31/12/2025`.
- Registros originais: 8.305.
- Registros normalizados após deduplicação por linha/horário: 8.117.
- Janela operacional usada no cálculo: `04:00 às 24:00`, ou seja, 20 horas/dia por linha.
