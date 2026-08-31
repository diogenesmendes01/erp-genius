# Log de Decisões e Pendências (ADR)

> Registro leve de decisões arquiteturais/de produto e das pendências em aberto.
> Formato ADR simplificado. Decisões já travadas vivem nos docs de origem; aqui ficam o
> **resumo rastreável** e tudo o que **ainda falta decidir**.

## Como usar
- Cada decisão: contexto curto → decisão → consequência. Status: ✅ Decidido · 🟡 Em aberto · ⛔ Revertido.
- Pendência que vira decisão: mude o status e aponte o doc onde o detalhe passou a morar.

---

## Decisões travadas (resumo)
| # | Decisão | Status | Detalhe em |
|---|---|---|---|
| D1 | **Monólito modular** por domínio (não microserviços) | ✅ | [02](02-arquitetura.md) |
| D2 | Modelagem **estado + log de eventos** (não event sourcing puro) | ✅ | [02](02-arquitetura.md), [11](11-modelo-de-dados.md), [12](12-catalogo-de-eventos.md) |
| D3 | **País é a espinha dorsal** (documento, moeda, DDI, fuso derivam do país) | ✅ | [04](04-fase1-dominio.md) |
| D4 | Preço **fixo por estudo de mercado**, versionado (não câmbio) | ✅ | [04](04-fase1-dominio.md) |
| D5 | Documento **avisa, não bloqueia**; telefone/e-mail **bloqueiam** | ✅ | [04](04-fase1-dominio.md) |
| D6 | **Pipelines PF e B2B separados** | ✅ | [08](08-comercial-crm-whatsapp.md) |
| D7 | Funil PF de **8 etapas** + Perdido como coluna visível; Experimental Agendada × Realizada | ✅ | [09](09-fase0-telas.md) |
| D8 | **WhatsApp Cloud API direto da Meta** (sem BSP) — Fase 1 | ✅ | [08](08-comercial-crm-whatsapp.md) |
| D9 | Comissão = **% da taxa de matrícula**; estorno se cancelar <30d | ✅ | [08](08-comercial-crm-whatsapp.md), [10](10-regras-sistema.md) |
| D10 | **Limite de desconto em % por usuário** (`limiteDescontoPct`); acima → aprovação | ✅ | [07](07-papeis-permissoes.md) |
| D11 | **Ninguém apaga nada** — soft-delete via status | ✅ | [10](10-regras-sistema.md) |
| D12 | **Mínimo para abrir turma vive na modalidade** (turma herda) | ✅ | [06](06-fase1-catalogo-cursos.md) |
| D13 | **Criar × alocar:** vendedor só aloca; criar produto/preço/turma é em Configuração | ✅ | [09](09-fase0-telas.md) |
| D14 | Matrícula ativa só com **pagamento + contrato** (paga primeiro, contrato depois) | ✅ | [05](05-fase1-fluxo-matricula.md) |
| D15 | **Cronograma inteiro gerado na ativação** (não mês a mês) | ✅ | [09](09-fase0-telas.md) |
| D16 | Fase 0 = **operação 100% manual**, sem automação/IA/integração | ✅ | [03](03-roadmap.md) |
| D25 | **Carga Q10 executada** (95 alunos CR) + campos `Aluno.genero`/`email` (migration `aluno_genero_email`) + telefone normalizado p/ E.164 no submit (matrícula + lead) | ✅ | [19](19-carga-alunos-q10.md) |
| D26 | **Carga Q10 turmas** (27 turmas + 8 professores) + `Turma.nome`/`online`/`dataFim`, `diasHorario` opcional, `capacidade` default 16 (migration `turma_nome_online_datafim`). Sem "sede" (online×presencial). Status por data (A1=1 mês/rolling, demais 2 semanas) | ✅ | [20](20-carga-turmas-q10.md) |
| D27 | **Carga Q10 rosters** (EstudiantesCurso): 106 alocações aluno↔turma, +12 alunos novos (país por DDI), 26 contatos atualizados. Pulados Alemanha (+49) e linhas de teste. Match por documento; alocação `ativa=false` se turma CONCLUIDA | ✅ | [21](21-carga-rosters-q10.md) |
| D28 | **Carga Q10 acadêmica + financeira:** enriquece alunos (gênero/nascimento + status por Estado, branco=inativo→PAUSADO) e cria +87 faltantes → **190 alunos**; cria **56 Matrícula+Cobrança** (match por nome) da Planilha de cobrança. Horários adiados; 30 linhas de cobrança sem aluno na base (ignoradas) | ✅ | [22](22-carga-academica-financeira-q10.md) |
| D29 | **Carga Q10 docentes + vendedor:** `Usuario` ganha `telefoneE164/documento/nascimento/genero` (migration `usuario_dados_professor`); 8 professores atualizados + 3 criados (12 total); vendedor **Henrique** criado + **56 comissões PAGA** (valor não consta na fonte → 0) | ✅ | [23](23-carga-docentes-vendedor-q10.md) |
| D30 | **`Turma.diasHorario` opcional no domínio** (Zod alinhado ao Prisma/banco): turma pode entrar "a definir" sem bloquear criação/edição; vazio → `null`; UI mostra "a definir" | ✅ | [11](11-modelo-de-dados.md), [20](20-carga-turmas-q10.md) |
| D24 | **Next.js 16** (era 14, EOL de segurança) + React 18 mantido + `overrides.postcss ≥8.5.10` → `npm audit` **0 vulnerabilidades** | ✅ | [13](13-convencoes-codigo.md) |
| D17 | **Preço tipado** (`PrecoReferencia` = País+Produto+Modalidade+TipoCobrança, com moeda+ativo) | ✅ | [11](11-modelo-de-dados.md) |
| D32 | **Dinheiro em `DECIMAL`** — campos monetários migrados de `Float` para `Decimal(12,2)` (percentuais `5,2`; câmbio `14,6`), migration `dinheiro_decimal` (jul/2026); domínio TS segue em `number` via conversão na borda de leitura (`_shared/decimal`). Fecha a P19 (era D30 duplicado) | ✅ | [11](11-modelo-de-dados.md), (este doc §P19) |
| D31 | **Integridade de dados (issue #1):** índices únicos PARCIAIS — 1 alocação ATIVA por aluno · 1 preço ATIVO por país+produto+modalidade+tipoCobrança (migration `integridade_alocacao_preco`) | ✅ | [11](11-modelo-de-dados.md) |
| D18 | **`MovimentacaoAluno` tipada** criada na Fase 0 (coexiste com `Evento`) | ✅ | [11](11-modelo-de-dados.md), [12](12-catalogo-de-eventos.md) |
| D19 | **Ativação** exige `contratoOk + pagamentoTaxaOk + primeiraMensalidadeOk`; exceção "com pendência" (Admin/Gerente) | ✅ | [11](11-modelo-de-dados.md), [12](12-catalogo-de-eventos.md) |
| D34 | **Exceção comercial à trava S1 (B5, doc 32):** as cadências COMERCIAIS (C1/C2) e a saudação reativa disparam automaticamente **no Baileys** (número de vendas), abrindo exceção à lei "régua automática exige driver oficial" — que segue valendo para a COBRANÇA. Limites da exceção: cohort explícito em modo piloto (B1) · teto/janela/pacing próprios da política · kill switch global · validade por degrau (B3/B4) · revalidação de estado no despacho (B7). **Risco aceito e monitorado:** sessão não oficial pode cair/ser banida — rollout gradual + stop imediato (doc 32 §4/§6); homologação definitiva só na WABA (doc 31) | ✅ | [30](30-whatsapp-spec-implementacao.md) §S1, [32](32-comercial-c1-c2-piloto-baileys.md) |
| D33 | **Deploy = VPS + Docker Compose** (Postgres interno sem porta pública · app Next standalone · Evolution só na rede interna · Caddy TLS como única borda); processo sempre-vivo exigido pelo canal (webhook + sessão Baileys) descarta serverless; mídia segue em disco/volume (S9) com backup diário testado (`scripts/backup-producao.sh`); banco por ambiente fecha o gap A5 | ✅ | [31](31-whatsapp-go-live.md) |

---

## Pendências em aberto (decidir antes de tocar a fase correspondente)

### P1 — Gateway de pagamento multi-país 🟡 (Fase 2)
GreenPay (Costa Rica, link) + transferência manual (demais países). Estratégia de gateway
único (Stripe/dLocal/etc.) por definir. Fora da Fase 0 (lá a baixa é manual).
→ origem: [05](05-fase1-fluxo-matricula.md), [06](06-fase1-catalogo-cursos.md).

### P2 — Conta WhatsApp Business API 🟡 (Fase 1)
Confirmar se já existe WABA + número comercial verificado. Custo per-message.
→ origem: [01](01-escopo-requisitos.md), [08](08-comercial-crm-whatsapp.md).

### P3 — Volume de alunos/usuários 🟡
Dimensiona infraestrutura/hospedagem. Sem número fechado.
→ origem: [01](01-escopo-requisitos.md).

### P4 — Migração de base existente 🟡
Há planilha/sistema atual a importar? Afeta validação (por isso documento não bloqueia).
→ origem: [01](01-escopo-requisitos.md), [04](04-fase1-dominio.md).

### P5 — Estrutura de preço ✅ (decidido) / Matriz de valores 🟡 (falta o dado)
**Decidido (D17):** `PrecoReferencia` tipada = País + Produto + Modalidade + TipoCobrança,
com `valor · moeda · ativo`. Tipos: `MATRICULA · MENSALIDADE · HORA_PARTICULAR · MATERIAL`
(+ `CERTIFICADO` mantido por estar no doc 04 — remover se o usuário pedir).
**Ainda em aberto:** a **matriz de valores** completa (mensalidade × modalidade × país, taxa,
hora do Particular). O seed usa os exemplos do doc 04 (CR ₡25.000 · PA US$50 · SV US$30) até
o usuário fornecer a tabela definitiva.
→ origem: [04](04-fase1-dominio.md), [05](05-fase1-fluxo-matricula.md), [06](06-fase1-catalogo-cursos.md).

### P6 — Entidade `MovimentacaoAluno` tipada ✅ (decidido — D18)
Criada na Fase 0. Tipos: `MATRICULA · TROCA_TURMA · PAUSA · REATIVACAO · ENCERRAMENTO`.
Coexiste com `Evento` (tabela tipada = relatório/operação; Evento = auditoria).
→ detalhe: [11](11-modelo-de-dados.md), [12](12-catalogo-de-eventos.md).

### P7 — Gatilho de ativação ✅ (decidido — D19)
ATIVA exige `contratoOk + pagamentoTaxaOk + primeiraMensalidadeOk` (taxa **+** 1ª mensalidade,
para não criar aluno ativo já devedor). Exceção "ativar com pendência" só Admin/Gerente
(`ativadaComPendencia`, registra motivo em Evento).
→ detalhe: [11](11-modelo-de-dados.md), [12](12-catalogo-de-eventos.md).

### P8 — Clawback de comissão já paga 🟡 (Fase 2)
Matrícula cancelada **após** comissão "Paga" — reverter como? (estorno <30d já decidido para
comissão não paga).
→ origem: [08](08-comercial-crm-whatsapp.md).

### P9 — Ferramenta de teste (Vitest) ✅
Instalada e configurada; 19 testes unitários das regras puras (comissão, cronograma, etapa,
validadores, permissões, `executarAcao`). Integração contra DB de teste segue pendente. Ver [14](14-estrategia-de-testes.md).

### P10 — Critérios de gestão em aberto 🟡
Ranking justo do gerente · "X dias" de proposta parada (default 5) · SLA em minutos (default 60).
→ origem: [09](09-fase0-telas.md). Defaults aplicados no código (`home/consultas.ts`).

### P11 — Upload de arquivos (documentos/comprovantes) ✅ (D20)
Storage **local** em `public/uploads` via `POST /api/upload` (PDF/JPG/PNG, ≤10MB, autenticado).
Documentos do lead (modelo `Documento` + categorias) e comprovante de pagamento usam isso.
**Nota:** para produção serverless, trocar o backend por S3/Supabase (mesma interface de URL).

### P12 — Nível inicial + origem do nível na matrícula ✅ (D21)
Campos `Matricula.nivelInicialId · origemNivel · dataAvaliacaoNivel` adicionados e ligados na
tela de matrícula (seleção de nível + Avaliação/Manual + data).

### P13 — Valor da oportunidade numérico no Lead ✅ (D22)
Campos `Lead.valorPrevisto · planoPrevisto · comissaoPrevista` adicionados; aparecem no
formulário do lead, no bloco "Valor da oportunidade" e como **valor total por coluna** no Kanban.

### P14 — Responsável financeiro (pagador) na matrícula ✅
Implementado via `Responsavel` + `AlunoResponsavel` (papel FINANCEIRO) — UI na matrícula
(Próprio aluno / Responsável / Empresa).

### P15 — Drag-and-drop no Kanban ✅ (D23)
**dnd-kit** instalado; cards arrastáveis entre colunas; soltar em Matriculado abre matrícula,
em Perdido pede motivo.

### P16 — Idiomas/modalidades habilitados por país ✅
UI na tela de País ("Catálogo") alterna `ProdutoPais.oferecido` por produto (idioma×modalidade).

### P18 — Cronograma gerado na ativação ✅ (alinhado ao doc 09)
`Matricula.mesesPlano` adicionado. `criarMatricula` cria só **taxa + 1ª mensalidade**;
`ativarMatricula` gera o restante (meses 2..N) e emite `CobrancaGerada`. Código agora 100%
fiel à spec do doc 09.

### P19 — Dinheiro em `Float` vs. `Decimal` ✅ (fechada — D32, jul/2026)
**Contexto.** Os campos monetários (`Cobranca.valorOriginal/valorNegociado/valorRecebido/saldo`,
`Comissao.valor`, `PrecoReferencia.valor`, `AjusteFinanceiro.valorDe/valorPara/descontoValor`,
além de `Lead.valorPrevisto/comissaoPrevista` e `Aprovacao.impactoMensal`) usavam `Float`. Float é
binário (IEEE-754) e acumula erro de arredondamento — não é o tipo ideal para dinheiro.

**Decisão (executada em 2026-07-02).** Migrado para `DECIMAL` enquanto o volume era pequeno
(56 cobranças/comissões) — quanto mais tarde, mais cara a conversão. Exatamente o plano previsto
na versão anterior desta pendência:
- **Banco:** migration `20260702100000_dinheiro_decimal` — `ALTER COLUMN ... TYPE DECIMAL USING
  ROUND(col::numeric, N)`. Monetários `12,2` · percentuais (`limiteDescontoPct`, `percentual`,
  `descontoPct`) `5,2` · `TaxaCambio.unidadesPorUsd` `14,6`. `Modalidade.horasAula` segue `Float`
  (duração, não dinheiro). Verificação por checksum (COUNT/SUM/MIN/MAX por coluna) antes/depois:
  contagens idênticas, somas com diferença zero.
- **Domínio TS:** segue em `number` — conversão na **borda de leitura**, o mais perto do Prisma
  (`src/server/_shared/decimal.ts`: `numero`/`numeroOuNull` campo a campo; `semDecimais`
  recursivo p/ retornos crus que cruzam Server → Client). Escritas aceitam `number` sem mudança.
- **Testes:** unitários do helper + integração provando que a ficha financeira devolve `number`
  puro e somas por moeda corretas (`ficha.int.test.ts`).

**Consequência.** O banco é a fonte de verdade EXATA (SUM/agregações no Postgres sem erro binário);
`payload` de Evento e props de Client Components seguem números JSON como antes. Regra nova de
código: ao LER campo monetário do Prisma, converta na borda (ver `_shared/decimal`).
→ origem: issue #1 (endurecer regras financeiras).

### P17 — Micro-detalhes do Kanban/matrícula ✅
Fechados: card do Kanban com **última ação**, **idade da etapa** e **SLA** (projeção de eventos
via `listarLeads`); **Perdido filtrável por período** (30/90/todos); linha de **certificado**
(Costa Rica) na matrícula; botão **"solicitar abertura de turma"** (evento `AberturaTurmaSolicitada`).
