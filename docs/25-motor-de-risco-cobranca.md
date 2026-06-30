# 25 — Motor de risco de cobrança (spec para implementação futura · V2)

> **Status: NÃO implementado — design pronto para construir.** É a evolução natural do "sinal de
> reincidência" da V1 (doc 24). Deliberadamente fora da V1 ("a régua começa burra"). Este doc tem
> o máximo de informação para que a implementação seja direta, sem redescobrir o desenho.
>
> Pré-leitura: [`24-cobrancas-regua-fluxo.md`](24-cobrancas-regua-fluxo.md) (a régua + o padrão
> cérebro/braço) · [`12-catalogo-de-eventos.md`](12-catalogo-de-eventos.md) (os eventos que
> alimentam o score) · [`10-regras-sistema.md`](10-regras-sistema.md) §Métricas.

## 1. Problema e objetivo
Hoje a régua trata **todo aluno igual**: um bom pagador que esqueceu uma mensalidade recebe a
mesma sequência de um reincidente crônico. Isso é burro de propósito na V1 — mas no volume vira
desperdício (cobra-se demais o confiável) e risco (cobra-se de menos o problemático).

O **motor de risco** classifica cada aluno por **comportamento de pagamento** (não por quem ele é)
e deixa a operação:
- **priorizar** quem realmente importa (risco alto sobe na fila);
- **adaptar o tom/cadência** (bom pagador = gentil e com folga; risco = escala rápido);
- **explicar** a classificação (por que esse aluno é risco), para o humano confiar e poder corrigir.

Princípio inegociável (herdado da régua): **determinístico, sem IA, explicável**. Score é uma
**função pura** sobre o histórico — não uma caixa-preta. A V2.3 (ML) só entra com volume real e
mantendo explicabilidade.

## 2. Onde aparece (o que o usuário vê)
| Tela | O que mostra |
|---|---|
| **Fila** (`/financeiro`) | Chip de tier por linha (Bom pagador · Atenção · Risco alto · Sem histórico) + reordenação da fila por risco × urgência × valor. |
| **Ficha financeira** (`/alunos/[id]/financeiro`) | Badge de tier no topo + os **fatores** que pesaram (lista explicável). |
| **Drawer / detalhe** | "Por que esse score": fatores positivos/negativos com peso, e a janela considerada. |

> Na V1 já existe a semente: o chip **"Nª cobrança"** (reincidência) na fila e na ficha. O score
> **generaliza** esse sinal — reincidência vira só **um** dos fatores.

## 3. Sinais que alimentam o score (todos já existem no event log)
**Nenhum dado novo precisa ser capturado** — tudo é derivável do que já é gravado (doc 12). Esta é
a maior alavanca: o motor é "só consumir".

| Fator | Como derivar | Fonte | Direção |
|---|---|---|---|
| **Pontualidade histórica** | % de cobranças quitadas **em dia** (`pagoEm ≤ vencimento`) | `Cobranca` PAGO + `pagoEm` vs `vencimento` | + bom |
| **Atraso médio** | média de `pagoEm − vencimento` (dias) das quitadas | `Cobranca` | − |
| **Reincidência** | nº médio de `CobrancaEnviadaWhatsApp` por mensalidade (o sinal V1) | `Evento` | − |
| **Promessas quebradas** | nº de `PromessaPagamento` cujo `ate` passou **sem** `PagamentoRegistrado` até a data | `Evento` | −− (forte) |
| **Atraso atual** | maior `diasAtraso` entre as cobranças abertas | `Cobranca` (régua) | − |
| **Saldo em aberto** | razão valor-em-aberto ÷ valor-do-contrato (por moeda) | `Cobranca` | − |
| **Bloqueios anteriores** | nº de `AcessoBloqueado` na matrícula | `Evento` | −− |
| **Fidelidade / antiguidade** | nº de mensalidades já quitadas · tempo de casa | `Cobranca` / `Matricula.criadoEm` | + |
| **Tendência** | atraso recente (últimos N meses) vs antigo — melhorando ou piorando | `Cobranca` ordenado | ± |

Observações:
- **Pagamento parcial** conta como sinal fraco-positivo (intenção de pagar) — usar
  `PagamentoRegistrado {valorRecebido}` mesmo quando a cobrança fica PENDENTE.
- **Promessa cumprida** (pagou até a data prometida) é forte-positivo; **quebrada** é forte-negativo.
- A reincidência V1 (`tentativas`) já é montada em `montarReguaPorCobranca` — reaproveitar.

## 4. Modelo de score (V2.1 — regra ponderada, explicável)
- **Score 0–100** (100 = melhor pagador). Soma ponderada dos fatores, normalizada.
- **Tiers** (calibrar thresholds com dados reais):
  - **≥ 70 — Bom pagador** (verde)
  - **40–69 — Atenção** (amber)
  - **< 40 — Risco alto** (vermelho)
  - **Sem histórico** (neutro/cinza) — aluno sem mensalidades quitadas suficientes (ex.: < 2). Não
    pontua e **não** escala a régua.
- **Output explicável:** além do número/tier, retornar a lista de **fatores** com a contribuição de
  cada um (`{ chave, label, contribuicao: +/−N }`), ordenada por peso. É o "porquê" na UI.
- **Janela:** considerar os últimos **12 meses** (parametrizável) — comportamento antigo decai.

> Comece com **pesos simples e redondos** e thresholds redondos; calibre depois com dados reais. O
> valor está na **estrutura explicável**, não na precisão dos pesos no dia 1.

## 5. Como o risco afeta a operação (faseado)
- **V2.1 — só exibição + priorização.** Mostra tier/fatores e **reordena** a fila (risco alto
  primeiro, dentro da urgência). **NÃO** muda a régua. Baixo risco, alto valor — fazer primeiro.
- **V2.2 — a régua dobra pelo risco.** O tier vira **parâmetro de `proximaAcao`**, ajustando
  offsets/templates por perfil (manter determinístico). Tabela-alvo (a definir/calibrar):

  | Tier | Ajuste na régua |
  |---|---|
  | Bom pagador | Mais folga: pula o D+3, tom sempre amigável até D+7, bloqueio adiado. |
  | Atenção | Régua padrão (doc 24). |
  | Risco alto | Escala rápido: pula lembretes preventivos (D-7/D-3), tom firme já no D0/D+3, bloqueio antecipado **(sempre com aprovação humana — nunca automático)**. |

- **V2.3 — modelo estatístico (longe).** Só com volume real e mantendo explicabilidade (ex.:
  regressão logística sobre os mesmos fatores, não black-box). Opcional.

## 6. Arquitetura (mantém cérebro/braço da régua)
- **`src/server/cobrancas/risco.ts`** — função **pura** `calcularRisco(historico, hoje) → ResultadoRisco`.
  Determinística, testável, sem I/O. Espelha `regua.ts`.
  ```ts
  interface HistoricoRiscoAluno {
    mensalidadesQuitadas: { vencimento: Date; pagoEm: Date }[];
    cobrancasAbertas: { vencimento: Date; valorNegociado: number; moeda: string }[];
    enviosCobranca: number;                 // total de CobrancaEnviadaWhatsApp
    promessas: { ate: Date; cumprida: boolean }[];
    bloqueiosAnteriores: number;
    contratoDesde: Date | null;
    valorContrato?: number;
  }
  interface ResultadoRisco {
    semHistorico: boolean;
    score: number;                          // 0–100
    tier: "bom" | "atencao" | "risco" | "sem_historico";
    fatores: { chave: string; label: string; contribuicao: number }[]; // explicável
  }
  ```
- **Montagem em lote (evita N+1):** `montarRiscoPorAluno(alunoIds, hoje): Promise<Map<id, ResultadoRisco>>`,
  no mesmo molde de `montarReguaPorCobranca` (`cobrancas/consultas.ts`). Lê eventos + cobranças em
  poucas queries e roda `calcularRisco` por aluno. **Fila e ficha reusam o mesmo cérebro** — fonte
  única, sem duplicar (foi exatamente o que fizemos com a régua, doc 24 §Consistência).
- **Serialização Server→Client:** `ResultadoRisco` já é plano (sem `Date` cru, sem `Decimal`). Os
  `fatores` viajam para o drawer/ficha mostrarem o "porquê".

## 7. Dados / schema
- **V2.1 — zero migration.** Tudo on-the-fly do event log + `Cobranca` (consistente com a Fase 0,
  doc 10 §4: sem cron, cálculo na leitura). Igual à régua.
- **Performance (só quando escalar):** se calcular o score de todos na fila pesar, materializar um
  **`RiscoSnapshot`** (`alunoId · score · tier · calculadoEm`) atualizado por cron (Fase 1+) ou
  cache. **Não** começar por aqui — medir primeiro.
- **Override humano (recomendado):** um campo/flag para o gerente **fixar** um tier ("tratar como
  bom pagador apesar do score") — evita que o algoritmo atropele uma exceção conhecida. Pode ser
  uma coluna em `Aluno`/`Matricula` (`riscoOverride`) + evento `RiscoAjustadoManual {de, para, motivo}`.
- **Evento opcional `RiscoRecalculado {score, tier}`** se quiser auditar/notificar mudança de tier
  (ex.: alertar quando um aluno **vira** "risco alto"). Não obrigatório na V2.1.

## 8. Ética e produto (não pular)
- **Score de pessoas exige cuidado.** Usar **apenas comportamento de pagamento** — **nunca**
  fatores sensíveis (nacionalidade, gênero, idade, país, escolaridade). O `Aluno` tem esses campos;
  o motor **não** pode lê-los.
- **Explicável sempre** — a UI mostra os fatores. Sem "score mágico".
- **Decisão crítica continua humana** — o score **informa**, não age sozinho. Bloqueio segue
  exigindo aprovação humana (doc 24). Nada de bloquear/encerrar automático por score.
- **Override humano** como válvula de escape (item 7).

## 9. Casos de borda
- **Aluno novo** (0–1 mensalidade quitada) → `sem_historico`. Neutro; não escala a régua.
- **Carga Q10** (histórico importado, sem eventos reais de envio/pagamento) → score nasce pobre;
  documentar que o histórico **real** começa a partir do uso do sistema. Considerar seed neutro
  para os importados (não penalizar por falta de evento).
- **Pagador B2B/empresa** → risco é da **empresa** (agregar por pagador), não do aluno. Fora do
  escopo inicial; alinhar com o faturamento corporativo (doc 08 §B2B, também Fase 2).
- **Bolsa/desconto** → não confundir valor menor com inadimplência; o desconto é legítimo.
- **Moeda** → razão saldo/contrato deve ser **por moeda** (reaproveitar `formatarMoeda`/`somarPorMoeda`).

## 10. Verificação (como testar)
Função pura ⇒ testes **golden por perfil** (rápidos, sem banco):
- Bom pagador (sempre em dia, 0 promessas quebradas) → `tier="bom"`, score ≥ 70.
- Reincidente com promessa quebrada + bloqueio anterior → `tier="risco"`, score < 40.
- Aluno novo (1 mensalidade) → `tier="sem_historico"`.
- Tendência: mesmo histórico, mas atrasos só no passado → score melhor que atrasos recentes.
- Cada caso valida também os `fatores` (a explicação bate com a entrada).

## 11. Decisões em aberto (para quem implementar)
1. **Pesos e thresholds** exatos dos tiers — calibrar com dados reais (começar redondo).
2. **V2.1 só exibe** ou **já reprioriza** a fila? (recomendo reordenar — é barato e útil).
3. **A régua dobra pelo risco (V2.2)** — quanto? Fechar a tabela tier × ajuste do item 5.
4. **Janela** de histórico (12 meses? tudo com decaimento?).
5. **Override humano** — coluna + evento, ou só evento?
6. **Materialização** (`RiscoSnapshot`) — só se a leitura on-the-fly pesar.

## 12. O que já está pronto para reusar (ganchos)
- **Event log completo:** `PagamentoRegistrado` (valor/quitada), `CobrancaEnviadaWhatsApp` (passo),
  `PromessaPagamento` (ate), `AcessoBloqueado`. **Todo o insumo do score já é gravado** — só falta
  consumir. Esta é a razão de o motor ser barato.
- **Padrão cérebro/braço + `montarReguaPorCobranca`** (`cobrancas/consultas.ts`) — molde direto para
  `risco.ts` + `montarRiscoPorAluno`.
- **Sinal V1 de reincidência** (`tentativas`) — já calculado; é o "fator 0" do score.
- **Consistência fila↔ficha** já resolvida (doc 24 §Consistência) — o risco entra pelos mesmos dois
  pontos, sem retrabalho.

## Relacionados
[`24-cobrancas-regua-fluxo.md`](24-cobrancas-regua-fluxo.md) (régua + cérebro/braço, do qual isto é
a evolução) · [`12-catalogo-de-eventos.md`](12-catalogo-de-eventos.md) (sinais) ·
[`10-regras-sistema.md`](10-regras-sistema.md) (métricas, jobs Fase 1+) ·
[`08-comercial-crm-whatsapp.md`](08-comercial-crm-whatsapp.md) (B2B/pagador-empresa, Fase 2).
