# Modelo de Dados — referência do schema

> Descrição **fiel** de [`prisma/schema.prisma`](../prisma/schema.prisma). Fonte da verdade é o
> schema; este doc o explica. Em divergência, vale o schema (e atualiza-se este doc).
>
> ⚠️ As seções "Modelo de dados" dos docs [`02`](02-arquitetura.md) e [`04`](04-fase1-dominio.md)
> são **rascunhos antigos** (citam entidades que não existem mais, ex.: `Mensalidade`,
> `Disciplina`, `Nota`, `LinhaCobranca`, `NegociacaoLog`). **Este doc 11 é a referência atual.**

## Princípio: estado + log de eventos
O banco combina **entidades de estado** (consulta rápida) com uma tabela **`Evento`**
append-only (auditoria + projeções). Não é event sourcing puro — é o meio-termo
**estado + log** (ver [`02-arquitetura.md`](02-arquitetura.md)). Detalhe dos eventos:
[`12-catalogo-de-eventos.md`](12-catalogo-de-eventos.md).

## Mapa dos módulos (domínios)
| Domínio | Entidades |
|---|---|
| **acesso** | `Usuario` (+ enum `Papel`) |
| **país/mercado** | `Pais`, `TipoDocumento` |
| **catálogo** | `Idioma`, `Modalidade`, `Nivel`, `Produto`, `ProdutoPais`, `PrecoReferencia` |
| **turmas** | `Turma` |
| **alunos** | `Aluno`, `Responsavel`, `AlunoResponsavel`, `AlocacaoTurma` |
| **comercial** | `Lead` |
| **matrícula/financeiro** | `Matricula`, `Cobranca`, `Comissao`, `AjusteFinanceiro`, `Aprovacao`, `TaxaCambio` |
| **transversal** | `Evento` (auditoria), `Contador` (códigos legíveis) |

---

## Acesso

### `Usuario`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | cuid (PK) | |
| `nome`, `email` (unique), `senhaHash` | String | senha com hash (bcrypt) |
| `ativo` | Boolean | soft-delete = `false` (nunca apaga — doc 10 §6) |
| `papeis` | `Papel[]` | multi-papel. **V2:** migrar p/ tabela `UsuarioPapel` (escopo por país) |
| `limiteDescontoPct` | Float? | `null` = sem limite (Admin). Gancho de aprovação (doc 07) |
| `telefoneE164`, `documento`, `nascimento`, `genero` | opcionais | dados pessoais (ex.: professores importados — doc 23) |
| `ultimoAcesso` | DateTime? | exibido em Config → Usuários |
| `criadoEm` | DateTime | |

**Relações:** `leads` (vendedor dono), `turmas` (professor), `comissoes`, `eventos` (autor),
`aprovacoes`/`aprovadasPor`, `ajustes`.

**enum `Papel`:** `ADMINISTRADOR · GERENTE_COMERCIAL · VENDEDOR · GERENTE_PEDAGOGICO ·
PROFESSOR · FINANCEIRO · SECRETARIA_ACADEMICA`.

---

## País / Mercado (espinha dorsal multi-país)

### `Pais`
`id · nome · codigoISO (unique) · moedaLocal (ex.: CRC, USD, MXN) · ddi (ex.: +506) ·
fuso (default America/Sao_Paulo) · idioma (default es) · status · criadoEm`.
- **enum `StatusPais`:** `RASCUNHO · ATIVO · PAUSADO · ENCERRADO` (ciclo de vida do mercado, doc 04).
- **Relações:** `tiposDocumento`, `produtosPais`, `alunos`, `leads`, `matriculas`.

### `TipoDocumento`
`id · paisId → Pais · nome (CPF, DNI, CURP, Cédula, Passaporte…) · validador` (nome do
validador nomeado: `cpf`, `curp`, `cedula_cr`, `passaporte`… — ver doc 04).

---

## Catálogo

### `Idioma`
`id · nome (Português, Inglês…) · ativo`. Relações: `niveis`, `produtos`.

### `Modalidade`
`id · nome · segmento · frequencia · horasAula (2) · duracaoPorNivel · aulasPorNivel? ·
minimoAbrir (1)`. Relações: `produtos`, `turmas`.
- **enum `Segmento`:** `ADULTO · KIDS · TEENS · EMPRESA`.
- **Regra-chave:** o **mínimo para abrir vive na modalidade** (a turma herda) — doc 06/09.

### `Nivel`
`id · idiomaId → Idioma · codigo (Pré A1, A1…C2) · ordem`. Relação: `turmas`.

### `Produto` (vendável = idioma + modalidade)
`id · idiomaId → Idioma · modalidadeId → Modalidade`. Relações: `produtosPais`, `matriculas`.

### `ProdutoPais` (disponibilidade por país)
`id · produtoId · paisId · moeda · oferecido` · **unique(`produtoId`, `paisId`)**.
Define **se** o produto é oferecido no país (catálogo global → país habilita subconjunto).
O **preço** mora em `PrecoReferencia` (não aqui).

### `PrecoReferencia` — preço **tipado** (decisão P5)
`id · paisId → Pais · produtoId → Produto · modalidadeId → Modalidade · tipoCobranca ·
valor · moeda · ativo · versaoEstudo? · vigenteDesde · criadoEm`.
- **Chave conceitual:** `País + Produto + Modalidade + TipoCobrança = preço`.
- `modalidadeId` é **explícito** (apesar de derivável de `Produto`) p/ relatório/seed simples;
  `moeda` gravada aqui (vem do país) p/ fidelidade histórica; `ativo` versiona sem apagar.
- **enum `TipoCobranca`:** `MATRICULA · MENSALIDADE · HORA_PARTICULAR · MATERIAL · CERTIFICADO`.
  (Regular/Intensivo/Kids usam `MENSALIDADE`; Particular usa `HORA_PARTICULAR`; `MATRICULA`
  pode existir p/ todos; `CERTIFICADO` fixo, só Costa Rica.)
- **Índices:** `(paisId, produtoId, modalidadeId, tipoCobranca)`, `ativo`.
- Preço **fixo por estudo de mercado**, versionado; é referência (negociável na matrícula).

---

## Turmas

### `Turma`
`id · codigo? (T-000001, unique) · nome? (livre, a escola batiza como quiser) · modalidadeId ·
nivelId · professorId? → Usuario · online (true) · diasSemana (Int[], 0=Dom…6=Sáb) ·
horarioInicio? · horarioFim? ("HH:MM") · diasHorario? (rótulo DERIVADO, ex.: "Seg, Qua, Sex · 19:00–21:00") ·
dataInicio? · dataFim? · cronograma? ·
capacidade (16) · status · rolling (Pré A1) · criadoEm`. Relação: `alocacoes`.
- **enum `StatusTurma`:** `PLANEJADA · ABERTA · EM_ANDAMENTO · CONCLUIDA` (mantido no banco para
  histórico; a **situação operativa é derivada das datas** — ver abaixo).
- **`online`:** hoje todas online; presencial é futuro. **Não há "sede" física**.
- **Agenda (calendário real, doc 06/09):** `diasSemana` + `horarioInicio`/`horarioFim` (intervalo da
  aula, ex.: 19:00–21:00) são a fonte; `diasHorario` é só o rótulo derivado para exibição.
  **O nº de dias deve casar com a frequência da modalidade**
  (1x/2x/3x/5x por semana); Particular ("critério do aluno") = sem nº fixo. Validado na criação/edição.
- **Início e fim obrigatórios** na criação/edição (`dataFim > dataInicio`). Turmas legadas (carga Q10)
  podem ter datas/agenda incompletas — a UI exibe "a definir"/"Sem datas" até serem editadas.
- **"Aceitando matrícula" = `dataInicio` no FUTURO** (derivado por data, sem cron): a turma aceita
  matrícula até começar; depois sai automaticamente. **É esse o filtro do wizard de matrícula**
  (doc 09) — não mais `status = ABERTA`. Situação na UI: Aceitando matrícula → Em andamento → Encerrada.

---

## Alunos

### `Aluno`
Cadastro de pessoa **guiado pelo país** (doc 04). Blocos (doc 09 §Cadastro de aluno):
- **Identificação:** `primeiroNome · sobrenome? · nomePreferido? · nascimento? · genero?`.
  (O campo único `nome` foi **dividido** em `primeiroNome` + `sobrenome` na migration
  `aluno_cadastro_completo` — backfill por split no 1º espaço.)
- **Documentação:** `paisId → Pais` (país-base/mercado: dirige tipo de documento, DDI e moeda) ·
  `tipoDocumentoId? → TipoDocumento` · `documento?` (número) · `documentoValido (false)` ·
  `documentoPaisEmissor?` · `nacionalidade?` · `segundaNacionalidade?`.
- **Contato:** `email? · telefoneE164? · whatsapp (false) · aceitaComunicacoes (true)`.
- **Residência:** `paisResidencia? · cep? · rua? · numero? · complemento? · bairro? · cidade? · regiao?`.
- **Acadêmico:** `escolaridade? · idiomaNativo?`. **Operacional:** `fuso? · observacoes?`.
- **Estado:** `id · codigo? (A-000001) · status · criadoEm`.
- **enum `StatusAluno`:** `ATIVO · PAUSADO · ENCERRADO` (ciclo no doc 09; encerrar exige motivo).
- **enum `Genero`:** `MASCULINO · FEMININO · NAO_INFORMADO` (rótulo "Prefiro não informar"; `OUTRO`
  foi removido na migration `aluno_cadastro_completo`).
- **enum `Escolaridade`:** `FUNDAMENTAL_INCOMPLETO · FUNDAMENTAL_COMPLETO · MEDIO_INCOMPLETO ·
  MEDIO_COMPLETO · TECNICO · SUPERIOR_INCOMPLETO · SUPERIOR_COMPLETO · POS_GRADUACAO · MESTRADO · DOUTORADO`.
- **Códigos ISO:** `nacionalidade · segundaNacionalidade · paisResidencia · documentoPaisEmissor` são
  **ISO 3166-1 alpha-2** (`lib/paises-iso.ts`), **não** FK de `Pais` — aceitam qualquer país
  (ex.: venezuelano residente no Panamá, comum na AC; doc 04). `Pais` modela só os mercados.
- **Relações:** `responsaveis` (N:N), `tipoDocumento` (opcional), `matriculas`, `alocacoes`, `movimentacoes`.

### `Responsavel`
`id · nome · parentesco? · telefoneE164? · email?`. Relação: `alunos` (N:N).

### `AlunoResponsavel` (vínculo N:N)
`id · alunoId · responsavelId · papel`. **enum `PapelResponsavel`:** `PEDAGOGICO · FINANCEIRO · EMERGENCIA`.
- `FINANCEIRO` = o pagador (o próprio aluno / responsável / empresa).
- `EMERGENCIA` = contato de emergência (nome/parentesco/telefone — doc 09 §Operacional).

### `AlocacaoTurma`
`id · alunoId · turmaId · ativa (true) · criadoEm`. O aluno é alocado por nível e avança.

### `MovimentacaoAluno` — tabela **tipada** (decisão P6)
Fonte do histórico da Ficha do Aluno e dos indicadores ("quantos pausaram/encerraram este
mês", "por que está nessa turma"). Mesmo princípio do financeiro: **Evento = auditoria;
tabela tipada = relatório/operação** (os dois coexistem).
`id · alunoId → Aluno · tipo · turmaOrigemId? · turmaDestinoId? · statusOrigem? ·
statusDestino? · motivo? · observacao? · usuarioId? → Usuario · criadoEm`.
- **enum `TipoMovimentacao`:** `MATRICULA · TROCA_TURMA · PAUSA · REATIVACAO · ENCERRAMENTO`.
- `turmaOrigemId`/`turmaDestinoId` são IDs simples (é um log); `aluno` e `usuario` têm relação.
- `statusOrigem`/`statusDestino` reusam o enum `StatusAluno`.
- **Índices:** `alunoId`, `tipo`, `criadoEm`.

---

## Comercial

### `Lead`
| Bloco | Campos |
|---|---|
| Identidade | `id · codigo? (L-000001) · nome · telefoneE164? · paisId? → Pais` |
| Classificação | `segmento · temperatura · etapa · b2b` |
| Dono | `vendedorDonoId? → Usuario` (define a visibilidade row-level do vendedor) |
| Origem | `origemCampanha? · origemConjunto? · origemAnuncio? · origemPalavra?` |
| Resumo executivo | `interesse? · objetivo? · urgencia? · orcamento? · objecao? · proximaAcao?` (manual no V0, IA na Fase 1) |
| Datas (alimentam a fila da Home) | `proximoFollowUp? · dataExperimental? · dataProposta?` |
| Valor da oportunidade (doc 09) | `valorPrevisto? (Float) · planoPrevisto? · comissaoPrevista? (Float)` |
| Outros | `motivoPerda? · ultimaCobranca? · criadoEm` · `matricula` (1:1) · `documentos` (1:N) |

- **enum `Temperatura`:** `QUENTE · MORNO · FRIO`.
- **enum `EtapaLead`:** `NOVO · EM_ATENDIMENTO · QUALIFICADO · EXPERIMENTAL_AGENDADA ·
  EXPERIMENTAL_REALIZADA · PROPOSTA · AGUARDANDO_MATRICULA · MATRICULADO · NO_SHOW · PERDIDO`.
- **enum `MotivoPerda`:** `NAO_RESPONDEU · PRECO · TEMPO · CONCORRENCIA · INTERESSE ·
  LOCALIZACAO · EMPRESA · QUALIFICACAO · OUTRO` (lista fechada — doc 08).

### `Documento` (anexos do lead — doc 09)
`id · leadId → Lead · categoria · nome · url · arquivado (false) · criadoEm`. Índice: `leadId`.
- `arquivado` = **soft-delete** (doc 10 §6: ninguém apaga; arquivar em vez de deletar).
- **enum `CategoriaDocumento`:** `PROPOSTA · CONTRATO · COMPROVANTE · TESTE_NIVEL · OUTRO`.
- `url` aponta para o arquivo no storage (`/uploads/...` via `POST /api/upload`; local em V0,
  trocável por S3/Supabase — ver [`15`](15-decisoes-adr.md) §P11).

---

## Matrícula / Financeiro

### `Matricula` (contrato composto)
`id · alunoId → Aluno · leadId? → Lead (unique) · produtoId → Produto · paisId → Pais ·
codigo? (M-000001) · moeda · status · diaVencimento (5) · mesesPlano (12) · contratoOk ·
pagamentoTaxaOk · primeiraMensalidadeOk · ativadaComPendencia · nivelInicialId? · origemNivel? ·
dataAvaliacaoNivel? · criadoEm · ativadaEm?`.
Relações: `cobrancas`, `comissoes`, `ajustes`.
- **enum `StatusMatricula`:** `RASCUNHO · AGUARDANDO · ATIVA · ENCERRADA · CANCELADA`.
- **enum `OrigemNivel`:** `AVALIACAO · MANUAL` (de onde veio o nível inicial — doc 09).
- **Gatilho de ativação (decisão P7):** vira `ATIVA` só quando
  `contratoOk && pagamentoTaxaOk && primeiraMensalidadeOk` → gera cronograma e comissão
  (docs 05, 10). Evita aluno ativo nascendo devedor.
- **Exceção:** `ativadaComPendencia = true` permite Admin/Gerente ativar sem os três flags
  (registra o porquê em `Evento`).
- `CANCELADA` antes de 30 dias → estorno de comissão.

### `Cobranca` (linha do contrato / conta a receber)
`id · codigo? (C-000001) · matriculaId → Matricula · tipo (TipoCobranca) · competencia?
("2026-06") · valorOriginal · valorNegociado · valorRecebido? · saldo? · moeda ·
vencimento · status · pagoEm? · formaPagamento? · comprovanteUrl? · comentario? · criadoEm`.
- **enum `StatusCobranca`:** `PENDENTE · PAGO · ATRASADO · CANCELADA`.
- **enum `FormaPagamento`:** `TRANSFERENCIA · GREENPAY · DINHEIRO · CARTAO`.
- Parciais modelados desde já (`valorRecebido`/`saldo`).

### `Comissao`
`id · matriculaId → Matricula · vendedorId → Usuario · percentual · valor · moeda · status ·
dataPrevistaPagamento? · pagaEm? · criadoEm`.
- **enum `StatusComissao`:** `PENDENTE · APROVADA · PAGA · ESTORNADA`.
- Comissão = `taxa de matrícula × percentual`; fechamento mensal (doc 10 §3).

### `AjusteFinanceiro` (tabela **tipada** = relatório)
Responde "total de desconto concedido · por vendedor/país/modalidade" sem ler Json.
`id · matriculaId · cobrancaId? · tipo · valorDe · valorPara · descontoValor · descontoPct? ·
moeda · vigencia? · motivo · autorId → Usuario · aprovacaoId? ·
[denormalizados p/ group by] vendedorId? · paisId? · modalidadeId? · criadoEm`.
- **enum `TipoAjuste`:** `DESCONTO · BOLSA · ALTERACAO_VALOR · PERDAO · RENEGOCIACAO`.
- **Índices:** `vendedorId`, `paisId`, `modalidadeId`, `criadoEm`.

### `Aprovacao` (engine genérica de aprovação)
`id · tipo · status · solicitanteId → Usuario · aprovadorId? → Usuario · alvoTipo (ex.:
"Cobranca") · alvoId? · payload? (Json) · vigencia? · motivo? · impactoMensal? · criadoEm ·
decididoEm?`.
- **enum `TipoAprovacao`:** `DESCONTO · BOLSA · ALTERACAO_VALOR · PERDAO_DIVIDA ·
  COMISSAO_EXCEPCIONAL`.
- **enum `StatusAprovacao`:** `PENDENTE · APROVADA · REJEITADA`.
- **enum `Vigencia`** (compartilhado com AjusteFinanceiro): `ESTA_COBRANCA · PROXIMOS_MESES ·
  CONTRATO_INTEIRO`.

### `TaxaCambio` (cotação de referência — Fase B, reporting-only)
Alimenta **só** a consolidação gerencial multi-moeda (doc 04 §Câmbio); **nunca** toca a conta do
aluno. Pivô único **USD**: `unidadesPorUsd` = quantas unidades da moeda equivalem a 1 US$ (USD não
é gravado, é sempre 1). **Append-only** por `(moeda, vigenteEm)` — a leitura usa a cotação mais
recente por moeda; o histórico permite reconstruir a taxa usada em cada relatório.
`id · moeda · unidadesPorUsd · vigenteEm · criadoEm`.
- **Origem da cotação:** manual (tela Câmbio, Admin/Financeiro) **ou** automática (botão que busca de
  fonte pública `open.er-api.com`, base USD, grátis/sem chave). Override manual sempre prevalece.
- **Índice:** `(moeda, vigenteEm)`.

---

## Transversal

### `Evento` (espinha dorsal — audit/event log append-only)
`id · tipo (LeadCriado, MatriculaAtivada…) · agregadoTipo ("Lead", "Matricula"…) ·
agregadoId · autorId? → Usuario · versao (1) · payload? (Json, o antes→depois) · criadoEm`.
- **Índices:** `(agregadoTipo, agregadoId)`, `tipo`, `criadoEm`.
- **Regra:** Evento = auditoria (Json flexível); indicador-chave ganha **tabela tipada**
  (ex.: `AjusteFinanceiro`). Toda mutação relevante grava um `Evento` (doc 10 §9, doc 12).

### `Contador` (códigos legíveis sem corrida)
`chave (PK: "lead"|"aluno"|"matricula"|"cobranca"|"turma") · valor (Int)`. Incremento
transacional gera `L-/A-/M-/C-/T-000001`. PK das entidades continua `cuid`.

---

## Notas de evolução (NÃO V0)
- `Papel enum[]` → tabela **`UsuarioPapel`** (escopo por país).
- Unificar `Lead/Aluno/Responsavel/Contato-RH` sob uma entidade **`Pessoa/Contato`**.
- `Evento.versao` já versiona o payload desde o início.
