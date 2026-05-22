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


## Regra de classificação
Descrições com **“Serviços de Manutenção”**, **“obras de melhoria”** e **“obras de modernização”** são classificadas como **Manutenção programada**. Para obras de melhoria e modernização, a regra prevalece mesmo quando o status bruto da fonte indicar paralisação, pois o painel interpreta o evento como intervenção programada.

## Correção de hidratação por ano
A rota raiz agora lê `?ano=2024` no componente servidor e renderiza a visão anual correspondente desde o primeiro HTML. Isso evita divergência entre SSR e cliente ao alternar 2024/2025.

- Eventos de **efeito cascata** são marcados quando a descrição indica restrições operacionais causadas por outra linha. Quando há retorno causal compatível no mesmo dia, a duração da cascata é encerrada nesse retorno para evitar superestimação.

- **Manutenção programada:** registros textuais com manutenção programada, atividade programada, obras de melhoria, obras de modernização ou serviços de manutenção são classificados nesta categoria. A expressão “falha em veículo de manutenção” continua como ocorrência operacional.


## Classe de qualidade do dado

- **Indefinido:** evento com `Duração_Indefinida = true` na base v3.
- Cor adotada: `#9E9E9E`.
- Esses registros permanecem auditáveis no painel, aparecem em filtros e contagens, mas **não somam horas** nas classes operacionais.
- Status brutos como `Dados/Status Indisponíveis` seguem pertencendo à classificação operacional definida pela base; a nova classe cinza é exclusiva para **duração indefinida por gap de coleta**.


