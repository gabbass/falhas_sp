# Falhas SP — Dashboard de Ocorrências Metroferroviárias

> **Documento elaborado com apoio de inteligência artificial e supervisão humana.**  
> A organização, revisão conceitual e validação interpretativa foram realizadas com supervisão humana de **Gabriel Bassotto Quintiliano**.

Dashboard público em **Next.js** para visualização, análise e documentação das ocorrências metroferroviárias da Região Metropolitana de São Paulo.

O painel apresenta indicadores de disponibilidade operacional, manutenção programada, ocorrências operacionais, falhas/paralisações, eventos especiais, registros indefinidos e comparativos semestrais de 2024, 2025 e 2026.

O objetivo do projeto é tornar os dados mais compreensíveis ao público, preservando rastreabilidade metodológica e separando claramente:

- operação normal;
- manutenção programada;
- ocorrência operacional;
- falha parcial;
- falha total/paralisação;
- eventos especiais;
- dados indefinidos por falha de coleta;
- registros de operação encerrada.

---

## 1. Visão geral do aplicativo

O **Falhas SP** é um dashboard estático em Next.js. Ele não depende de backend, banco de dados ou API externa em tempo de execução.

A aplicação consome arquivos JSON já tratados e gera visualizações interativas no navegador.

### Stack principal

| Item | Tecnologia |
|---|---|
| Framework | Next.js |
| Interface | React |
| Linguagem | TypeScript |
| Gráficos | Recharts |
| Ícones | lucide-react |
| Estilo | CSS global em `app/globals.css` |
| Publicação | GitHub Pages via export estático |

---

## 2. Como rodar localmente

Instale as dependências:

```powershell
npm install
```

Execute em modo desenvolvimento:

```powershell
npm run dev
```

Acesse:

```text
http://localhost:3000
```

---

## 3. Build local estático

Para gerar a versão estática compatível com GitHub Pages:

```powershell
$env:GITHUB_PAGES="true"
npm run build
```

A saída será gerada em:

```text
out/
```

O projeto usa:

```ts
output: "export"
```

Portanto, o resultado final é uma aplicação estática.

---

## 4. Publicação no GitHub Pages

Este projeto está configurado para o repositório:

```text
https://github.com/gabbass/falhas_sp.git
```

Quando publicado pelo GitHub Actions, o painel fica em:

```text
https://gabbass.github.io/falhas_sp/
```

No GitHub, confirmar:

```text
Settings → Pages → Source → GitHub Actions
```

O arquivo `next.config.ts` detecta a variável:

```text
GITHUB_PAGES=true
```

Quando ela está ativa, o projeto usa:

```text
basePath: /falhas_sp
assetPrefix: /falhas_sp/
NEXT_PUBLIC_BASE_PATH=/falhas_sp
```

Isso permite que os assets funcionem corretamente dentro do subdiretório do GitHub Pages.

---

## 5. Estrutura principal do projeto

```text
falhas_sp-main/
│
├─ app/
│  ├─ page.tsx
│  ├─ layout.tsx
│  ├─ home-dashboard-router.tsx
│  ├─ dashboard-2026.tsx
│  ├─ dashboard-2025.tsx
│  ├─ dashboard-2024.tsx
│  ├─ comparativo-primeiro-semestre.tsx
│  ├─ documentacao-popup.tsx
│  ├─ eventos-relevantes-popup.tsx
│  ├─ analise-humana-popup.tsx
│  ├─ analise-ia-popup.tsx
│  ├─ loading.tsx
│  └─ globals.css
│
├─ data/
│  ├─ ocorrencias-summary.json
│  ├─ ocorrencias-summary-2024.json
│  ├─ ocorrencias-summary-2026.json
│  ├─ ocorrencias-summary-2025-1sem.json
│  ├─ ocorrencias-summary-2024-1sem.json
│  └─ eventos-relevantes.json
│
├─ lib/
│  └─ types.ts
│
├─ public/
│  └─ .nojekyll
│
├─ next.config.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## 6. Rotas e seleção de ano

A rota principal é:

```text
/
```

Por padrão, ela abre o painel do **primeiro semestre de 2026**. A mesma visão
também pode ser acessada explicitamente por `/?ano=2026`.

Também é possível acessar:

```text
/?ano=2024
```

para abrir a visão de 2024.

Use `/?ano=2025` para abrir a visão anual de 2025.

O comparativo faz parte do carrossel e pode ser aberto diretamente por:

```text
/?tela=comparativo
```

Nessa tela, primeiros semestres só podem ser comparados com primeiros semestres;
segundos semestres de 2024 e 2025 só podem ser comparados entre si.

O roteamento é feito em:

```text
app/home-dashboard-router.tsx
```

Esse componente lê o parâmetro `ano` da URL e escolhe qual dashboard renderizar.

---

## 7. Fontes de dados

### 7.1. Dados consumidos pelo aplicativo

O aplicativo **não lê diretamente os arquivos Excel em tempo de execução**.

Ele consome arquivos JSON já tratados:

```text
data/ocorrencias-summary.json
data/ocorrencias-summary-2024.json
data/ocorrencias-summary-2026.json
data/ocorrencias-summary-2025-1sem.json
data/ocorrencias-summary-2024-1sem.json
data/eventos-relevantes.json
```

Esses arquivos são importados diretamente pelos componentes React.

---

### 7.2. Base de 2025

Arquivo operacional consumido:

```text
data/ocorrencias-summary.json
```

Fonte tratada indicada no metadata:

```text
ocorrencias_metro_2025_v3.xlsx
```

Resumo da base:

| Indicador | Valor |
|---|---:|
| Período | 01/01/2025 a 31/12/2025 |
| Registros originais | 3.030 |
| Registros normalizados | 3.030 |
| Duplicidades removidas | 0 |
| Linhas | 13 |
| Operadores | 6 |
| Jornada operacional padrão | 04:30 às 00:00 |
| Horas por dia por linha | 19,50 h |
| Horas por ano por linha | 7.117,50 h |
| Horas totais esperadas | 185.055,00 h |

Indicadores consolidados de 2025:

| Categoria | Horas | Registros |
|---|---:|---:|
| Disponível | 183.400,536 h | 1.958 |
| Evento especial | 46,431 h | 37 |
| Manutenção programada | 930,519 h | 202 |
| Ocorrência operacional / falha parcial | 720,928 h | 501 |
| Falha total / paralisação | 3,017 h | 5 |
| Indefinido | 0,000 h | 37 |
| Operação encerrada | 0,000 h | 290 |

Disponibilidade geral de 2025:

```text
99,106%
```

---

### 7.3. Base de 2024

Arquivo operacional consumido:

```text
data/ocorrencias-summary-2024.json
```

Fonte tratada indicada no metadata:

```text
ocorrencias_metro_2024_v3.xlsx
```

Resumo da base:

| Indicador | Valor |
|---|---:|
| Período | 01/01/2024 a 31/12/2024 |
| Registros originais | 2.946 |
| Registros normalizados | 2.946 |
| Duplicidades removidas | 0 |
| Linhas | 13 |
| Operadores | 6 |
| Jornada operacional padrão | 04:30 às 00:00 |
| Horas por dia por linha | 19,50 h |
| Horas por ano por linha | 7.137,00 h |
| Horas totais esperadas | 185.562,00 h |

Indicadores consolidados de 2024:

| Categoria | Horas | Registros |
|---|---:|---:|
| Disponível | 183.989,702 h | 2.264 |
| Evento especial | 11,350 h | 2 |
| Manutenção programada | 1.142,006 h | 234 |
| Ocorrência operacional / falha parcial | 378,459 h | 419 |
| Falha total / paralisação | 51,833 h | 10 |
| Indefinido | 0,000 h | 14 |
| Operação encerrada | 0,000 h | 3 |

Disponibilidade geral de 2024:

```text
99,153%
```

---

### 7.4. Eventos relevantes

Arquivo consumido:

```text
data/eventos-relevantes.json
```

Fontes consolidadas:

```text
Base histórica 2024-2025 e fontes públicas vinculadas para o primeiro semestre de 2026
```

Resumo:

| Indicador | Valor |
|---|---:|
| Total de eventos relevantes | 12 |
| Eventos de 2024 | 2 |
| Eventos de 2025 | 7 |
| Eventos do 1º semestre de 2026 | 3 |

Esses eventos aparecem em popup próprio e servem para contextualizar mudanças institucionais, operacionais ou estruturais relevantes no período. Para 2026, entram apenas fatos datados entre janeiro e junho; cada registro mantém o link da publicação pública usada como fonte.

---

## 8. Modelo de dados

Cada ocorrência no JSON possui campos como:

| Campo | Função |
|---|---|
| `id` | Identificador interno do registro |
| `dataHora` | Data e hora inicial em formato ISO |
| `dataLabel` | Data formatada para exibição |
| `mes` | Mês de referência, no formato `YYYY-MM` |
| `linha` | Linha afetada |
| `operador` | Operador responsável |
| `status` | Status bruto ou status tratado |
| `estado` | Categoria operacional padronizada |
| `classificacao` | Classificação auxiliar da ocorrência |
| `descricao` | Descrição textual do evento |
| `horas` | Duração original ou sanitizada |
| `cor` | Cor da categoria |
| `meses` | Distribuição das horas por mês |
| `fechamentoAte` | Horário de encerramento/retorno, quando disponível |
| `fechamentoAteLabel` | Horário de encerramento formatado |
| `horasAteProximoStatus` | Intervalo até o próximo status |
| `efeitoCascata` | Indica se o evento foi causado por outra linha |
| `linhaCausaCascata` | Linha causadora, quando identificada |

---

## 9. Categorias operacionais

O painel usa uma classificação padronizada chamada `estado`.

| Categoria | Cor | Como interpretar |
|---|---|---|
| Disponível | `#007A5E` | Tempo operacional esperado sem falha, manutenção ou restrição relevante |
| Evento especial | `#1C2C8C` | Acréscimo ou diferenciação de operação; não reduz disponibilidade |
| Manutenção programada | `#FFD200` | Intervenção planejada; reduz disponibilidade, mas não é falha |
| Ocorrência operacional | `#F57C00` | Restrição, lentidão, operação parcial ou degradação não total |
| Com falha ou parcial | `#F57C00` | Equivalente operacional de falha parcial/degradação |
| Falha total / paralisação | `#EE2E3B` | Interrupção total ou paralisação de linha/trecho |
| Indefinido | `#9E9E9E` | Evento com duração indefinida por gap de coleta |
| Operação encerrada | `#64748B` | Registro de encerramento/fora de operação; auditável, mas não soma horas |

---

## 10. Regras de tratamento dos dados

### 10.1. Janela operacional

O painel não usa 24 horas como denominador.

A janela operacional padrão é:

```text
04:30 às 00:00
```

Ou seja:

```text
19,50 horas por dia por linha
```

A madrugada fora da janela operacional é excluída dos cálculos de duração e dos intervalos médios entre eventos.

---

### 10.2. Duração contabilizada

Um evento pode ter uma duração original maior do que a duração efetivamente contabilizada no painel.

A duração contabilizada é apenas a parte do evento que cruza a janela operacional padrão.

Exemplo conceitual:

```text
Evento: 23:00 às 02:00
Janela operacional: 04:30 às 00:00
Horas contabilizadas: 1h
```

O trecho entre 00:00 e 02:00 não entra, porque está fora da janela operacional adotada.

---

### 10.3. Encerramento do evento

O fim de um evento é calculado assim:

```text
fim_evento = fechamentoAte válido
```

Caso não exista `fechamentoAte`, usa-se:

```text
fim_evento = início_evento + horas_original_do_evento
```

Quando há efeito cascata com retorno causal compatível, a duração pode ser encerrada no retorno da linha causadora para evitar superestimação.

---

### 10.4. Eventos em cascata

Eventos de **efeito cascata** são ocorrências em uma linha causadas por restrições operacionais de outra linha.

Na base atual:

| Ano | Cascatas identificadas |
|---|---:|
| 2024 | 41 |
| 2025 | 23 |

Quando a linha causadora possui retorno operacional compatível no mesmo dia, a duração da cascata é encerrada nesse retorno, evitando que a ocorrência derivada seja prolongada artificialmente até o fim da operação.

---

### 10.5. Manutenção programada

Registros textuais contendo termos como:

```text
manutenção programada
atividade programada
serviços de manutenção
obras de melhoria
obras de modernização
```

são tratados como:

```text
Manutenção programada
```

Essa regra prevalece mesmo quando o status bruto da fonte indicar paralisação, porque o painel interpreta o evento como intervenção planejada.

Importante:

```text
falha em veículo de manutenção
```

continua sendo ocorrência operacional, pois se trata de falha ou intercorrência não planejada.

---

### 10.6. Indefinido

A categoria **Indefinido** representa eventos com duração indefinida por gap de coleta.

Esses registros:

- permanecem auditáveis;
- aparecem em filtros;
- aparecem em contagens;
- aparecem na tabela;
- não somam horas operacionais;
- não entram como tipo de falha;
- não entram como manutenção;
- não entram como disponibilidade.

A cor usada é:

```text
#9E9E9E
```

---

### 10.7. Operação encerrada

Registros de operação encerrada são preservados para auditoria.

Eles:

- não entram como falha;
- não entram como manutenção;
- não entram como tempo disponível;
- não somam horas;
- aparecem em bloco recolhível próprio.

---

### 10.8. Eventos especiais

Eventos especiais representam acréscimos, extensões ou condições diferenciadas de atendimento.

Eles:

- aparecem em cartões;
- aparecem em distribuições;
- aparecem na evolução mensal;
- aparecem na tabela analítica;
- aparecem em bloco próprio;
- não reduzem a disponibilidade;
- não inflacionam o numerador da disponibilidade-base.

Ou seja, evento especial é tratado separadamente da operação normal.

---

## 11. Fórmulas principais

### 11.1. Horas operacionais por dia

```text
horas_dia = (00:00 - 04:30) / 60
```

Como 00:00 equivale a 1440 minutos e 04:30 equivale a 270 minutos:

```text
horas_dia = (1440 - 270) / 60
horas_dia = 19,50
```

---

### 11.2. Dias do período

```text
dias = floor((data_fim_UTC - data_inicio_UTC) / 86.400.000) + 1
```

A contagem é inclusiva.

---

### 11.3. Horas esperadas por linha

```text
horas_esperadas_linha = dias_do_período × 19,50
```

Para 2025:

```text
365 × 19,50 = 7.117,50 h por linha
```

Para 2024, por ser ano bissexto:

```text
366 × 19,50 = 7.137,00 h por linha
```

---

### 11.4. Horas esperadas totais

```text
horas_esperadas_total = quantidade_de_linhas_filtradas × horas_esperadas_linha
```

Esse é o denominador usado nos cartões principais e nos percentuais gerais.

---

### 11.5. Recorte de ocorrência na janela operacional

```text
horas_contadas_dia =
max(
  0,
  min(fim_evento, fim_janela) - max(início_evento, início_janela)
) / 3.600.000
```

Cada ocorrência é cortada dia a dia dentro da janela:

```text
04:30–00:00
```

---

### 11.6. Horas disponíveis

No modo geral:

```text
horas_disponíveis =
max(
  horas_esperadas_total
  - manutenção_programada
  - ocorrência_operacional
  - falha_total
  - horas_indefinidas,
  0
)
```

Evento especial não é subtraído, porque representa acréscimo ou diferenciação de atendimento.

---

### 11.7. Disponibilidade total percentual

```text
disponibilidade_% =
horas_disponíveis / horas_esperadas_total × 100
```

Esse é o principal indicador de disponibilidade do painel.

---

### 11.8. Disponibilidade por linha

```text
disponibilidade_linha_% =
horas_disponíveis_da_linha / horas_totais_da_linha × 100
```

Evento especial continua em coluna própria e não entra como disponibilidade.

---

### 11.9. Tempo em manutenção programada

```text
manutenção_h =
soma das horas de manutenção programada recortadas na janela operacional
```

Esse indicador mede perda de janela operacional por intervenção planejada, sem confundir manutenção com falha.

---

### 11.10. Tempo em ocorrência operacional

```text
ocorrência_h =
soma das horas de ocorrência operacional recortadas na janela operacional
```

Representa degradação de serviço por eventos não classificados como manutenção programada ou paralisação total.

---

### 11.11. Tempo em falha total/paralisação

```text
falha_total_h =
soma das horas de falha total ou paralisação recortadas na janela operacional
```

Representa interrupção total de operação na linha ou trecho classificado.

---

### 11.12. Horas de falha

```text
horas_falha =
horas_ocorrência_operacional + horas_falha_total
```

No painel, manutenção programada não deve ser lida como falha.

---

### 11.13. Registros classificados

O indicador de registros classificados reúne:

```text
manutenção_programada + ocorrência_operacional + falha_total/paralisação
```

Por isso, ele não deve ser interpretado como “quantidade de falhas puras”.

É melhor ler como:

```text
registros classificados com restrição, intervenção ou ocorrência operacional
```

---

### 11.14. Médias por categoria

```text
média_categoria =
horas_categoria / max(quantidade_categoria, 1)
```

O uso de `max(..., 1)` evita divisão por zero.

---

### 11.15. Média entre novas falhas

```text
média_entre_falhas =
média dos intervalos em horas operacionais entre falhas consecutivas da mesma linha
```

A conta:

1. filtra apenas falhas operacionais;
2. agrupa por linha;
3. ordena por data/hora;
4. calcula o intervalo entre falhas consecutivas;
5. desconta a madrugada fora da janela 04:30–00:00;
6. calcula a média dos intervalos válidos.

---

### 11.16. Média entre manutenções

```text
média_entre_manutenções =
média dos intervalos operacionais entre manutenções consecutivas da mesma linha
```

---

### 11.17. Média entre manutenção e falha

```text
média_manutencao_falha =
média dos intervalos operacionais entre uma manutenção programada e a falha subsequente da mesma linha:
manutenção → falha
```

O sentido inverso, falha → manutenção, não entra nessa métrica. O indicador é exploratório: ajuda a observar proximidade temporal, mas não prova causalidade.

---

## 12. Por que a mediana não é usada como indicador principal

A mediana não foi adotada como indicador principal porque ela representa o comportamento central da distribuição, mas não expressa bem o impacto agregado da rede.

Em sistemas metroferroviários, eventos extremos não são meras distorções estatísticas. Uma falha longa em uma linha estrutural pode afetar grande volume de passageiros e comprometer conexões em cadeia.

Usar a mediana poderia suavizar justamente os episódios mais relevantes do ponto de vista operacional e social.

Por isso, a análise prioriza:

- médias agregadas;
- horas afetadas;
- disponibilidade operacional;
- totais por linha;
- totais por operador;
- evolução temporal.

Quando disponíveis, métricas ponderadas por:

- demanda;
- trem-km;
- carro-km;
- passageiro-km;

seriam ainda mais adequadas.

---

## 13. Elementos do dashboard

### 13.1. Cabeçalho principal

O painel possui uma área inicial com:

- título do dashboard;
- período analisado;
- botões de ano;
- atalhos para popups;
- acesso à documentação;
- acesso à análise humana;
- acesso à análise IA;
- acesso aos eventos relevantes.

---

### 13.2. Base analisada

O usuário pode alternar entre:

```text
1º semestre de 2026
2025
2024
Comparativo semestral
```

A troca de ano atualiza a URL e evita divergência entre a renderização inicial e o estado do cliente. Dentro de cada painel, o conteúdo é organizado em oito telas: Abertura, Resumo, Rankings, Tempo, Diagnósticos, Comparativo, Linhas e Registros. A tela ativa é persistida no parâmetro `tela` da URL e pode ser trocada pelos controles, setas do teclado ou gesto horizontal.

---

### 13.3. Filtros globais

O painel possui filtros por:

- linha;
- operador;
- status/categoria operacional;
- data inicial e data final.

Esses filtros afetam:

- cartões;
- gráficos;
- rankings;
- evolução mensal;
- mapa horário;
- histograma temporal;
- nuvem de palavras;
- tabelas.

Os filtros são únicos para todo o dashboard: mapa horário, histograma, distribuições e rankings não mantêm seletores locais concorrentes. Um controle flutuante mostra quantidade e resumo dos filtros ativos e permite limpar todos de uma vez. Distribuições e rankings preservam o mesmo recorte ao alternar entre as abas de horas e quantidade.

---

### 13.4. Cards principais

Os cards principais exibem:

- tempo total esperado;
- tempo disponível;
- eventos especiais;
- manutenção programada;
- ocorrências operacionais;
- indisponível/paralisado;
- dados indisponíveis;
- registros classificados.

---

### 13.5. Cards analíticos

O painel também mostra indicadores como:

- dia mais comum para falha;
- horário mais comum para falha;
- média disponível;
- média de operação degradada;
- média de paralisação total;
- intervalo falha → falha;
- intervalo manutenção → falha;
- intervalo manutenção → manutenção;
- tipo mais comum;
- tipo menos comum.

---

### 13.6. Legenda operacional

A legenda apresenta as categorias e suas cores:

| Categoria | Cor |
|---|---|
| Disponível | Verde |
| Evento especial | Azul |
| Manutenção programada | Amarelo |
| Ocorrência operacional | Laranja |
| Falha total/paralisação | Vermelho |
| Indefinido | Cinza |
| Operação encerrada | Cinza azulado |

---

### 13.7. Distribuição do tempo operacional

Mostra a participação de cada categoria em horas acumuladas.

Categorias consideradas:

- disponível;
- evento especial;
- manutenção programada;
- ocorrência operacional;
- falha total/paralisação;
- indefinido.

---

### 13.8. Distribuição por quantidade

Mostra a distribuição de registros por categoria.

Essa leitura é diferente da distribuição por horas.

Exemplo: uma categoria pode ter poucos registros, mas muitas horas acumuladas.

---

### 13.9. Ranking por linha

O painel possui rankings por linha em duas leituras:

```text
Ranking por linha · tempo
Ranking por linha · quantidade
```

Eles permitem identificar linhas com mais horas ou mais registros classificados.

---

### 13.10. Ranking por operador

O painel também agrega as linhas por operador.

O denominador é:

```text
número de linhas do operador × horas esperadas por linha
```

Leituras disponíveis:

```text
Ranking por operador · tempo
Ranking por operador · quantidade
```

---

### 13.11. Mapa horário das ocorrências

Mostra ocorrências distribuídas no tempo, permitindo observar padrões por:

- linha;
- operador;
- categoria;
- dia;
- horário;
- tipo de ocorrência.

Usa diretamente os filtros globais de linha, operador, status e período.

---

### 13.12. Histograma temporal de disponibilidade por linha

O histograma temporal usa uma lógica de grade/heatmap.

A malha nasce como:

```text
Disponível
```

Depois, eventos restritivos sobrepõem as células afetadas.

Quando mais de um estado cruza a mesma célula, prevalece o estado mais crítico para leitura operacional.

A visualização usa diretamente os filtros globais, sem um seletor local de linha.

---

### 13.13. Evolução mensal

Mostra a evolução mensal de horas por categoria.

Permite observar sazonalidade, concentração de falhas ou concentração de manutenções em determinados meses.

---

### 13.14. Nuvem de palavras

A nuvem de palavras destaca termos recorrentes nas descrições das ocorrências.

Ela ignora:

- termos muito comuns;
- operação normal;
- operação encerrada;
- dados indisponíveis;
- palavras sem significado operacional relevante.

O tamanho da palavra representa frequência.

---

### 13.15. Tipos de registro por tempo acumulado

O painel infere tipos de ocorrência a partir de termos encontrados em status e descrições.

Exemplos de grupos:

- Descarrilamento;
- Alagamento / clima;
- Rede aérea / energia;
- Sinalização / controle;
- Equipamento de via;
- Material rodante / trem;
- Interferência externa / vandalismo;
- Pessoa ou objeto na via;
- Manutenção / atividade programada;
- Operação parcial / trecho interrompido;
- Velocidade reduzida / maior parada;
- Problemas técnicos;
- Indefinido.

Essa inferência serve para visualização analítica, não para substituir a classificação operacional principal.

---

### 13.16. Tabela analítica por linha

A tabela por linha mostra:

- linha;
- operador;
- horas totais;
- horas disponíveis;
- horas em manutenção;
- horas em ocorrência operacional;
- horas em falha total;
- horas indefinidas;
- quantidade de registros;
- disponibilidade percentual;
- média de horas até nova falha.

---

### 13.17. Lista pesquisável de falhas e paralisações

A lista pesquisável considera registros classificados como:

- manutenção programada;
- ocorrência operacional;
- com falha ou parcial;
- falha total/paralisação.

Ela permite buscar por termos, linhas, operadores, descrições e tipos inferidos.

---

### 13.18. Operações encerradas

Registros de operação encerrada ficam em seção própria, minimizada por padrão.

Eles são mantidos por rastreabilidade, mas não entram como falhas nem somam horas.

---

### 13.19. Eventos especiais

Eventos especiais ficam em seção própria.

Eles são mantidos separados porque representam acréscimo ou diferenciação de atendimento, e não falha operacional.

---

### 13.20. Comparativo semestral

A visão comparativa mostra:

- primeiros semestres de 2024, 2025 e 2026, comparáveis entre si;
- segundos semestres de 2024 e 2025, comparáveis entre si;
- um período analisado e uma ou duas referências do mesmo semestre;
- variação absoluta e percentual calculada como analisado menos referência;
- comparação por linha.

O comparativo integra o carrossel e recebe os filtros globais de linha, operador, status e datas. Quando há recorte de datas, o sistema aplica a cada base o intervalo proporcional equivalente. Com duas referências selecionadas, é possível usar a média aritmética de horas e quantidades; a disponibilidade usa média ponderada pelo tempo operacional. Disponibilidade maior é favorável, enquanto manutenção, ocorrências e paralisações menores são favoráveis; eventos especiais e quantidade de registros são contextuais.

---

## 14. Popups do painel

### 14.1. Documentação

Arquivo:

```text
app/documentacao-popup.tsx
```

Contém:

- premissas;
- categorias operacionais;
- fórmulas;
- tratamento de duração;
- agregações;
- filtros;
- regras de exibição;
- rastreabilidade da base.

---

### 14.2. Eventos relevantes

Arquivo:

```text
app/eventos-relevantes-popup.tsx
```

Exibe eventos estruturais ou institucionais relevantes para interpretação de 2024, 2025 e do primeiro semestre de 2026.

Permite filtrar por ano, informa a quantidade por recorte e abre a fonte pública de cada evento em nova aba.

---

### 14.3. Análise humana

Arquivo:

```text
app/analise-humana-popup.tsx
```

Contém interpretação autoral sobre:

- disponibilidade agregada;
- manutenção programada;
- relação entre manutenção e falhas;
- impacto percebido pelo passageiro;
- estrutura radial/diametral da rede;
- dependência de contingência por PAESE;
- lacunas de dados;
- justificativa para não usar mediana como métrica principal.

Assinatura:

```text
Gabriel Bassotto Quintiliano
https://www.linkedin.com/in/gabriel-bassotto/
```

---

### 14.4. Análise IA

Arquivo:

```text
app/analise-ia-popup.tsx
```

Exibe leitura analítica automatizada ou assistida por IA sobre os indicadores do painel.

A análise IA aparece depois da Análise humana.

---

## 15. Tratamentos textuais e padronizações

### 15.1. Normalização de texto

O painel normaliza textos para alguns tratamentos internos:

- converte para minúsculas;
- remove acentos;
- remove espaços extras;
- compara termos de forma mais robusta.

---

### 15.2. Padronização de operadores

Alguns nomes são simplificados para exibição:

| Original | Exibição |
|---|---|
| ViaMobilidade 8 e 9 | ViaMobilidade |
| CPTM Companhia Paulista de Trens Metropolitanos | CPTM |
| Metrô de São Paulo | Metrô |

---

### 15.3. Inferência de tipo de ocorrência

O painel usa regras por termos para agrupar descrições em tipos analíticos.

Exemplo:

```text
"rede aérea", "energia", "subestação"
```

vira:

```text
Rede aérea / energia
```

Outro exemplo:

```text
"sinalização", "controle", "CBTC", "ATC"
```

vira:

```text
Sinalização / controle
```

Essa inferência ajuda a leitura, mas a categoria operacional principal continua sendo o campo `estado`.

---

## 16. Paginação e exibição

Tabelas extensas usam paginação de:

```text
20 registros por página
```

Isso vale para:

- ranking por linha;
- lista de ocorrências;
- operações encerradas;
- eventos especiais;
- tabelas minimizadas.

---

## 17. Arredondamento e formatação

O painel usa arredondamento interno com até 3 casas em várias contas:

```text
round3
```

Na interface, percentuais são exibidos com até:

```text
2 casas decimais
```

Horas são exibidas com formatação brasileira.

---

## 18. Interpretações importantes

### 18.1. Disponibilidade não é pontualidade

A disponibilidade calculada no painel mede proporção de tempo operacional sem restrição relevante registrada.

Ela não mede:

- pontualidade real dos trens;
- headway real;
- velocidade comercial;
- lotação;
- atraso acumulado;
- número de viagens canceladas;
- passageiros afetados.

---

### 18.2. Manutenção programada não é falha

Manutenção programada reduz a disponibilidade plena da linha, mas não deve ser interpretada como falha operacional.

A separação é essencial para evitar leitura equivocada.

---

### 18.3. Evento especial não aumenta artificialmente a disponibilidade

Evento especial é exibido separadamente.

Ele não reduz a disponibilidade, mas também não é usado para inflar a operação disponível.

---

### 18.4. Indefinido é qualidade do dado

Indefinido não representa necessariamente falha.

Representa ausência de duração confiável por gap de coleta.

---

### 18.5. Registros classificados não são apenas falhas

O painel usa o conceito de registros classificados para reunir:

- manutenção programada;
- ocorrência operacional;
- falha total/paralisação.

Esse número deve ser lido como registros relevantes para análise operacional, não como quantidade pura de falhas.

---

## 19. Limitações conhecidas

O painel ainda não possui dados públicos suficientes para calcular:

- falhas por trem-km;
- falhas por carro-km;
- falhas por composição;
- falhas por série/frota;
- idade exata dos trens por ocorrência;
- passageiros afetados;
- viagens canceladas;
- atrasos acumulados;
- velocidade operacional;
- headway real;
- lotação por evento;
- impacto por estação;
- impacto por OD.

Essas informações seriam fundamentais para transformar a análise de disponibilidade em diagnóstico técnico completo de confiabilidade metroferroviária.

---

## 20. Como ler o painel corretamente

A leitura correta é:

```text
O painel mostra disponibilidade operacional agregada e impactos registrados por categoria.
```

Não é correto ler o painel como:

```text
medição oficial de pontualidade
```

nem como:

```text
medição oficial de falhas por quilômetro rodado
```

A interpretação mais segura é:

> O Falhas SP organiza dados públicos e tratados de ocorrências metroferroviárias, separando disponibilidade, manutenção, falhas, eventos especiais e gaps de coleta, para permitir leitura pública e comparativa da operação ao longo do tempo.

---

## 21. Comandos úteis

Instalar dependências:

```powershell
npm install
```

Rodar localmente:

```powershell
npm run dev
```

Gerar build estático local:

```powershell
npm run build
```

Gerar build para GitHub Pages:

```powershell
$env:GITHUB_PAGES="true"
npm run build
```

Checar TypeScript:

```powershell
npx tsc --noEmit
```

---

## 22. Resumo metodológico curto

O painel adota uma janela operacional padrão de **04:30 a 00:00**, totalizando **19,50 horas por dia por linha**. A disponibilidade é calculada pela razão entre horas disponíveis e horas esperadas dentro dessa janela. Manutenções programadas, ocorrências operacionais e falhas totais reduzem a disponibilidade plena, enquanto eventos especiais são tratados separadamente como acréscimos de atendimento. Registros indefinidos permanecem auditáveis, mas não somam horas. As análises por linha, operador e mês respeitam os filtros aplicados e distribuem as durações conforme a sobreposição efetiva dos eventos na janela operacional.

---

## 23. Nota sobre supervisão humana e uso de IA

Este documento e parte das análises textuais do projeto foram produzidos com apoio de ferramentas de inteligência artificial, sempre com **supervisão humana**.

A supervisão humana envolveu:

- definição do escopo da análise;
- revisão dos conceitos operacionais;
- validação da separação entre falha, manutenção e evento especial;
- correção de interpretações inadequadas;
- inclusão de justificativas metodológicas;
- revisão final de linguagem e coerência.

A responsabilidade editorial, interpretativa e metodológica da análise humana é de:

```text
Gabriel Bassotto Quintiliano
```

---

## 24. Assinatura da análise humana

**Gabriel Bassotto Quintiliano**  
<https://www.linkedin.com/in/gabriel-bassotto/>

---

## 25. Atualização a partir da CCM/ARTESP

O repositório possui um pipeline versionado para transformar a extração
consolidada da CCM no contrato JSON consumido pelo dashboard.

### 25.1. Gerar arquivos de prévia

```powershell
npm run data:generate
```

Os arquivos são escritos em `data/generated/`, que não é versionado. O comando
gera as bases anuais de 2024 e 2025, os recortes dos dois semestres de 2024 e
2025 e o primeiro semestre de 2026, mas não substitui
automaticamente os dados publicados.

O gerador:

- ordena os registros por linha e data;
- encerra cada estado no próximo registro da mesma linha;
- recorta durações na janela 04:30–00:00;
- transforma intervalos superiores a 72 horas em `Indefinido`, sem horas;
- classifica `Circulação de Trens` e `Maiores Intervalos` pela descrição;
- classifica `Operação Diferenciada` como evento especial;
- usa `Dados Indisponíveis`, `Status Desconhecido` e
  `Status não disponível` apenas para fechar o ciclo anterior;
- recalcula KPIs, rankings, séries mensais e amostras.

### 25.2. Revalidar 2024 e 2025

```powershell
npm run data:revalidate
```

São gerados:

```text
data/generated/revalidation.json
data/generated/revalidation.md
```

A revalidação confere contrato, durações negativas, fechamento sem contagem,
gaps de coleta, denominador, fórmula de disponibilidade e reconciliação mensal.
Ela também compara cada KPI e cada chave `data + linha + status` com os arquivos
publicados.

### 25.3. Testes das regras

```powershell
npm run test:data
```

O launcher procura Python 3 em `PYTHON`, no runtime local do Codex e nos comandos
usuais `python3`, `python` e `py -3`.

### 25.4. Publicação

Os summaries em `data/generated/` devem ser revisados antes da publicação. Após
aprovação do relatório, copie explicitamente os arquivos anuais aprovados para
`data/`, execute os testes, a checagem TypeScript e o build estático.

