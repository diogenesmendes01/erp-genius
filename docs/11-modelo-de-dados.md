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
| **matrícula/financeiro** | `Matricula`, `Cobranca`, `Comissao`, `AjusteFinanceiro`, `Aprovacao` |
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
nivelId · professorId? → Usuario · online (true) · diasHorario? (ex.: "Ter/Qui 20h") ·
dataInicio? · dataFim? · cronograma? · capacidade (16) · status · rolling (Pré A1) · criadoEm`.
Relação: `alocacoes`.
- **enum `StatusTurma`:** `PLANEJADA · ABERTA · EM_ANDAMENTO · CONCLUIDA`.
- **`online`:** hoje todas online; presencial é futuro. **Não há "sede" física** (o nome da turma
  pode até ser uma cidade, mas é só rótulo).
- **`diasHorario` opcional:** turmas importadas entram sem dia/horário (a preencher).
  Opcional em **todas** as camadas (Prisma, banco, Zod, UI): criar/editar **não** bloqueia
  por horário; vazio é gravado como `null` e a UI exibe "a definir".
- **Regra de status na carga (doc 20):** ABERTA por 2 semanas após o início; **A1 = 1 mês**
  (entrada contínua do Pré A1, `rolling=true`); depois EM_ANDAMENTO até `dataFim`, então CONCLUIDA.
- **Regra:** só turma **ABERTA com vaga** aparece no seletor da matrícula (doc 09).

---

## Alunos

### `Aluno`
`id · codigo? (A-000001) · nome · nascimento? · paisId → Pais · documento? ·
documentoValido (false) · telefoneE164? · status · criadoEm`.
- **enum `StatusAluno`:** `ATIVO · PAUSADO · ENCERRADO` (ciclo no doc 09; encerrar exige motivo).
- **Relações:** `responsaveis` (N:N), `matriculas`, `alocacoes`.

### `Responsavel`
`id · nome · parentesco? · telefoneE164? · email?`. Relação: `alunos` (N:N).

### `AlunoResponsavel` (vínculo N:N)
`id · alunoId · responsavelId · papel`. **enum `PapelResponsavel`:** `PEDAGOGICO · FINANCEIRO`
(o financeiro = o pagador: o próprio aluno / responsável / empresa).

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
