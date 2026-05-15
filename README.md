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

- Fonte do arquivo tratado: `ocorrencias_metro_2025_v3.xlsx`.
- Período: `01/01/2025` a `31/12/2025`.
- Registros sanitizados consumidos pelo painel: 3.030.
- Janela operacional usada no cálculo: `04:30 às 00:00`, ou seja, 19,50 horas/dia por linha.
- As **distâncias médias entre eventos** usam **tempo operacional acumulado** dentro dessa mesma janela; a madrugada fora de operação é excluída dos intervalos.


## Regra de classificação atualizada

Descrições com **“Serviços de Manutenção”**, **“obras de melhoria”** e **“obras de modernização”** são classificadas como **Manutenção programada**. Para obras de melhoria e modernização, a regra prevalece mesmo quando o status bruto da fonte indicar paralisação, pois o painel interpreta o evento como intervenção programada.

## Correção de hidratação por ano
A rota raiz agora lê `?ano=2024` no componente servidor e renderiza a visão anual correspondente desde o primeiro HTML. Isso evita divergência entre SSR e cliente ao alternar 2024/2025.

- Eventos de **efeito cascata** são marcados quando a descrição indica restrições operacionais causadas por outra linha. Quando há retorno causal compatível no mesmo dia, a duração da cascata é encerrada nesse retorno para evitar superestimação.

- **Manutenção programada:** registros textuais com manutenção programada, atividade programada, obras de melhoria, obras de modernização ou serviços de manutenção são classificados nesta categoria. A expressão “falha em veículo de manutenção” continua como ocorrência operacional.


## Nova classe de qualidade do dado

- **Indefinido:** evento com `Duração_Indefinida = true` na base v3.
- Cor adotada: `#9E9E9E`.
- Esses registros permanecem auditáveis no painel, aparecem em filtros e contagens, mas **não somam horas** nas classes operacionais.
- Status brutos como `Dados/Status Indisponíveis` seguem pertencendo à classificação operacional definida pela base; a nova classe cinza é exclusiva para **duração indefinida por gap de coleta**.


- A documentação metodológica agora é aberta em popup próprio, no mesmo padrão de “Eventos relevantes”, preservando Base analisada apenas para 2025, 2024 e Comparativo.
- Percentuais exibidos no painel e nas variações comparativas usam até 2 casas decimais.


- Foi incorporado o popup **Análise IA**, exibindo a leitura analítica revisada do painel no mesmo padrão visual dos demais modais.
- Foi incorporado o popup **Eventos relevantes**, alimentado pela planilha `ocorrencias_relevantes_metro_cptm_privadas_2024_2025_atualizado.xlsx`, com filtros internos por ano e abertura dos links das matérias em nova aba.

- A modal de Documentação exibe as seções metodológicas em cartões próprios, sem colapso indevido de conteúdo.
- O histograma temporal mantém o estilo visual original de grade/heatmap, mas agora resume linhas no eixo Y e 4 slots da jornada operacional de 19h30 no eixo X. Operação normal é o padrão/fallback; ocorrências sobrepõem a célula com a cor do evento dominante.
