# Arquitetura Técnica — ERP Genius

> Proposta inicial. Tudo aqui é ajustável; a ideia é ter uma base sólida e moderna.

## Stack proposta

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend + Backend | **Next.js (React + TypeScript)** | Um só projeto para telas e API; rápido de desenvolver |
| Estilo | **Tailwind CSS** | Visual consistente e produtivo |
| Banco de dados | **PostgreSQL** | Robusto, ideal para dados relacionais (alunos, matrículas, financeiro) |
| ORM (acesso ao banco) | **Prisma** | Modela os dados de forma segura e legível |
| Autenticação | **Auth.js (NextAuth)** | Login + sessão + JWT + papéis/permissões (nada na mão) |
| Validação | **Zod** | Um **esquema só** compartilhado frontend ↔ backend (Lead, Aluno, Matrícula, Cobrança…) |
| Formulários | **React Hook Form** (+ `@hookform/resolvers` com Zod) | Dezenas de formulários com menos código e re-render |
| WhatsApp | **WhatsApp Cloud API (Meta)** | Oficial; necessário para automação de mensagens |
| Hospedagem (futuro) | Vercel + banco gerenciado (Neon/Supabase) | Simples de publicar e escalar |

### Por que essa escolha

Next.js permite construir telas e a lógica de servidor no mesmo lugar, o que
acelera muito o desenvolvimento de um ERP feito por uma equipe pequena.
PostgreSQL é o padrão para sistemas com muitos relacionamentos (um aluno tem
matrículas, que têm mensalidades, etc.). Prisma deixa o código do banco claro
e menos sujeito a erros.

## Arquitetura de aplicação (decisões travadas)

### Monólito modular (NÃO microserviços)
Um código só (Next.js full-stack), **organizado por domínio** com fronteiras claras:
`comercial · financeiro · alunos · catalogo · acesso`. Microserviços resolveriam escala/time
grande — temos o oposto (produto novo, time pequeno). O monólito modular dá a **organização**
sem o **custo operacional** (deploys múltiplos, rede, dados distribuídos). Fronteiras desenhadas
permitem extrair um módulo em serviço **se** um dia precisar.

### Modelagem orientada a EVENTOS (não a telas)
Telas mudam; **eventos de negócio não**. O banco é **estado + log de eventos append-only**:
- **Entidades de estado** (Aluno, Matricula, Cobranca, Lead…) para consulta rápida.
- **`Evento`** (append-only) registra **cada evento de negócio** que muda estado.
- Não é *event sourcing* puro (overkill p/ V0) — é o meio-termo **estado + log**.
- Timeline do lead, histórico de movimentações, log de negociação e tentativas de cobrança
  são **projeções do mesmo log de eventos**.

### Audit log desde o primeiro commit
O `Evento` **é** a trilha de auditoria: **autor · ação · agregado (tipo+id) · antes→depois · quando**.
Toda mudança de estado grava um evento. De brinde, é a fonte dos **indicadores**
(motivos de perda, motivos de encerramento, "por que está nessa turma").

### Eventos de domínio (principais)
- **Comercial:** `LeadCriado · LeadAtribuido · EtapaAlterada · ExperimentalAgendada · ExperimentalRealizada · NoShow · PropostaEnviada · LeadPerdido`
- **Matrícula:** `MatriculaCriada · ValorNegociado · MatriculaAtivada`
- **Financeiro:** `CobrancaGerada · PagamentoRegistrado · CobrancaRenegociada · DescontoSolicitado · AprovacaoDecidida · ComissaoGerada/Aprovada/Paga · ComissaoEstornada · CobrancaEnviadaWhatsApp`
- **Alunos:** `AlunoMatriculado · TrocaTurma · AlunoPausado · AlunoReativado · AlunoEncerrado · AvancoNivel`

### Notas arquiteturais (evolução futura, não-V0)
- **Auditoria vs. relatório:** `Evento` = auditoria (Json flexível). Indicador-chave ganha **tabela tipada** —
  ex.: **`AjusteFinanceiro`** (desconto/bolsa/renegociação) responde "total concedido · por vendedor/país/modalidade"
  sem ler Json. Regra: *Evento = auditoria; tabela tipada = relatório*.
- **`Evento.versao`:** payload **versionado** desde já — o formato evolui ao longo dos anos.
- **Papel `enum[]` → `UsuarioPapel` (V2):** quando surgir **escopo por país** (ex.: Professor só na Costa Rica).
- **`Pessoa/Contato` (V2+):** unificar Lead / Aluno / Responsável / Contato-RH sob uma entidade de pessoa.

## Estrutura de pastas (planejada)

```
erp-genius/
├── docs/                  # Documentação (escopo, arquitetura, roadmap)
├── prisma/
│   └── schema.prisma      # Modelo de dados
├── src/
│   ├── app/               # Páginas e rotas (Next.js App Router)
│   │   ├── alunos/
│   │   ├── matriculas/
│   │   ├── financeiro/
│   │   ├── academico/
│   │   ├── equipe/
│   │   └── vendas/
│   ├── components/        # Componentes de interface reutilizáveis
│   ├── lib/               # Funções utilitárias, conexão com banco
│   └── server/            # Lógica de negócio / serviços
├── public/                # Imagens e estáticos
└── package.json
```

## Modelo de dados inicial (entidades principais)

```
Aluno         (id, nome, nascimento, cpf, foto, status)
Responsavel   (id, nome, parentesco, telefone, email)
AlunoResponsavel (alunoId, responsavelId)   # vínculo N:N
Turma         (id, nome, serie, turno, anoLetivo, capacidade)
Matricula     (id, alunoId, turmaId, data, status)
Mensalidade   (id, matriculaId, valor, vencimento, status, pagoEm)
Professor     (id, nome, disciplinas, contato)
Disciplina    (id, nome)
Nota          (id, alunoId, disciplinaId, periodo, valor)
Frequencia    (id, alunoId, turmaId, data, presente)
Lead          (id, nome, contato, etapa, vendedorId, origem)
Interacao     (id, leadId, tipo, mensagem, data)
Usuario       (id, nome, email, senhaHash, papel)
```

## Integração WhatsApp (visão geral)

1. Conta **WhatsApp Business** + acesso à **Cloud API** da Meta.
2. Número comercial verificado.
3. O ERP envia/recebe mensagens via webhook.
4. Templates de mensagem aprovados pela Meta (boas-vindas, follow-up).

> Requer cadastro na Meta e tem custo por conversa. Detalhamos na Fase 4.

## Segurança

- Senhas com hash (bcrypt/argon2).
- Permissões por papel em cada tela e ação.
- Backup automático do banco.
