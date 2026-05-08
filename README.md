# Falhas SP

Dashboard público de ocorrências metroferroviárias de São Paulo, preparado para publicação no GitHub Pages do repositório:

```text
https://github.com/gabbass/falhas_sp
```

## Rodar localmente

```powershell
npm install
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Publicar no GitHub Pages

Este projeto já está configurado para exportação estática do Next.js e publicação via GitHub Actions.

No GitHub, faça:

1. Abra o repositório `gabbass/falhas_sp`.
2. Vá em **Settings**.
3. Entre em **Pages**.
4. Em **Source**, selecione **GitHub Actions**.
5. Salve.
6. Faça push na branch `main`.

O site público ficará em:

```text
https://gabbass.github.io/falhas_sp/
```

## Observação técnica

O arquivo `next.config.ts` aplica `basePath` e `assetPrefix` somente quando a variável `GITHUB_PAGES=true` estiver ativa. Assim:

- localmente roda em `/`;
- no GitHub Pages roda em `/falhas_sp/`.

O workflow `.github/workflows/deploy.yml` já define essa variável durante o build.
