# Contexto — Falhas SP

Levantamento local em 24/10/2026. Este arquivo orienta a manutenção do projeto; não substitui a metodologia detalhada nem uma auditoria dos dados.

## Objetivo e relação com os demais projetos

Dashboard público de ocorrências metroferroviárias da Região Metropolitana de São Paulo: disponibilidade, manutenção, restrições operacionais, paralisações e comparação de períodos. Abrange 2024, 2025 e o primeiro semestre de 2026.

- `../caminhos_sp` fornece a base bruta CCM usada pelo gerador Python.
- `../demanda_sp` é um painel independente derivado da interface deste projeto, dedicado a passageiros. Suas métricas não devem ser confundidas com disponibilidade.
- A consulta ao painel funciona com JSONs locais incorporados ao build, sem backend ou banco em tempo de execução.

## Arquitetura e arquivos de entrada

Stack declarada: Next.js 15, React 19, TypeScript, Recharts, lucide-react e fonte Inter. As versões no `package.json` usam intervalos; consulte o lockfile para versões resolvidas.

| Caminho | Responsabilidade |
|---|---|
| `app/page.tsx` | Entrada da página, com Suspense |
| `app/home-dashboard-router.tsx` | Seleção por `?ano=2024`, `?ano=2025` ou 2026 como padrão |
| `app/dashboard-2024.tsx`, `dashboard-2025.tsx`, `dashboard-2026.tsx` | Painéis por período e importação das bases |
| `app/dashboard-carousel.tsx` | Navegação entre telas |
| `app/comparativo-primeiro-semestre.tsx` | Comparações semestrais, incluindo segundos semestres de 2024/2025 |
| `app/*popup.tsx` | Metodologia, eventos relevantes e análises humana/IA |
| `app/globals.css` | Estilos compartilhados |
| `lib/types.ts` | Contratos TypeScript dos dados |
| `scripts/ccm_summary.py` | Normalização e geração dos resumos CCM |
| `scripts/revalidate_ccm.py` | Checagens estruturais e comparação com a base publicada |
| `tests/test_ccm_summary.py` | Testes unitários do tratamento dos dados |

O comparativo também é documentado em `/?tela=comparativo`; o roteador reconhece `?comparativo=1` e `?ano=comparativo` para abertura do comparativo.

## Fluxo de dados

1. O comando `data:generate` lê, por padrão, `../caminhos_sp/data_raw/saida_ccm_20260818_213615/ocorrencias_ccm_2024_2025_1sem2026.json`.
2. O gerador escreve em `data/generated/`, diretório ignorado pelo Git.
3. `data:revalidate` compara essa geração com `data/` e grava `revalidation.json` e `revalidation.md` em `data/generated/`.
4. Os componentes importam os arquivos diretamente de `data/`, não de `data/generated/`. Gerar uma base nova não a publica automaticamente: a promoção precisa ser revisada e feita explicitamente.

Arquivos consumidos: `ocorrencias-summary.json` (2025), `ocorrencias-summary-2024.json`, `ocorrencias-summary-2026.json`, recortes `*-1sem.json` e `*-2sem.json` de 2024/2025, além de `eventos-relevantes.json`. `data/manifest.json` registra procedência e indicadores da geração. `data/old/` guarda material histórico.

## Regras que precisam ser preservadas

- A janela operacional padrão é 04:30–00:00, ou 19,5 horas por dia por linha; não usar 24 horas como denominador.
- O gerador recorta durações nessa janela e distribui horas pelos meses correspondentes.
- Intervalos de coleta acima de 72 horas são tratados como lacunas, sem somar toda a duração como falha.
- Manutenção, ocorrência operacional, falha total, evento especial, indefinido e encerramento têm significados distintos.
- Evento especial não representa falha; registros de encerramento preservam rastreabilidade sem acrescentar horas de falha.
- Cascatas e mudanças de operador precisam respeitar causalidade e período histórico.
- Comparar primeiros semestres entre si e segundos semestres entre si; não equiparar 2026 parcial a um ano completo.

## Execução e validação

Execute na raiz do projeto. O CI usa Node.js 20; a geração e os testes de dados requerem Python 3.

```powershell
npm install
npm run dev
npm run test:data
npm run data:generate
npm run data:revalidate
npm run build
```

`scripts/python-runner.mjs` procura o executável indicado em `PYTHON`, um runtime local do Codex e os comandos Python disponíveis. Defina `PYTHON` se precisar selecionar um ambiente específico.

Para gerar o site com prefixo do GitHub Pages:

```powershell
$env:GITHUB_PAGES = "true"
npm run build
Remove-Item Env:GITHUB_PAGES
```

`next.config.ts` configura export estático em `out/`, trailing slash e imagens sem otimização. Com a variável ativa, usa `/falhas_sp` como base. O script `start` existe, mas a entrega deste projeto é o diretório estático `out/`; para desenvolvimento, use `dev`.

## Estado observado e pontos de atenção

- Git estava sem alterações locais no início do levantamento; último commit observado: `03b3d9c`.
- Há dois workflows de publicação, `.github/workflows/deploy.yml` e `nextjs.yml`, com gatilhos para `main` e o mesmo grupo de concorrência. Revisar essa duplicação antes de alterar o deploy.
- Existem `package-lock.json` e `pnpm-lock.yaml`; os workflows usam npm. Evitar atualizar os dois gerenciadores inadvertidamente.
- O README contém números históricos que divergem do manifesto atual: por exemplo, lista 2.946 registros para 2024, enquanto o manifesto registra 8.937 emitidos. Para análises atuais, conferir JSON consumido, manifesto e metodologia juntos.
- Não foi encontrado `AGENTS.md` na árvore de código inspecionada.

## Como retomar o trabalho

Comece pelo componente do período e pelo JSON que ele importa. Para mudanças de classificação ou duração, examine o gerador e os testes antes de alterar a interface. Para mudanças nos dados, gere em separado, revalide, revise diferenças e só então promova os arquivos para `data/`. Atualize documentação e análises textuais quando os indicadores mudarem.

Este levantamento verificou código, configuração, documentação e estado Git. Não executou builds, testes ou regeneração de bases; não certifica o funcionamento integral da aplicação.
