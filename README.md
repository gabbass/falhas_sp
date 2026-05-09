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
