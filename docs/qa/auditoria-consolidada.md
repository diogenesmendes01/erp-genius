# Auditoria consolidada: código × documentação (base para o UAT v1)

> Data: 2026-10-21 · Commit auditado: `bc858aff` (`main`) · Método: 6 varreduras independentes
> (uma por área), cada uma lendo os docs na íntegra e cruzando com o código, arquivo e linha.
> Os relatórios completos estão em [`auditoria/`](auditoria/). Nada no código foi alterado.

## 1. Resumo executivo

| Área | Relatório | Itens | Conforme | Divergente | Não impl. | Parcial | Sem doc |
|---|---|---|---|---|---|---|---|
| Papéis e permissões | [01](auditoria/01-papeis-permissoes.md) | 42 | 19 | 9 | 4 | 6 | 4 |
| Telas da Fase 0 | [02](auditoria/02-telas-fase0.md) | 71 | 28 | 5 | 2 | 29 | 7 |
| Dados, eventos e regras | [03](auditoria/03-dados-eventos-regras.md) | 27 regras | 15 | 2 | 3 | 8 | 22 models/enums |
| Matrícula, catálogo, alunos | [04](auditoria/04-matricula-catalogo-alunos.md) | 41 | 12 | 9 | 7 | 11 | 2 |
| Financeiro e cobranças | [05](auditoria/05-financeiro-cobrancas.md) | 42 | 18 | 7 | 5 | 9 | 3 |
| CRM e WhatsApp | [06](auditoria/06-crm-whatsapp.md) | 52 | 30 | 6 | 4 | 11 | 1 |

Leitura geral:

- **A fundação está sólida.** Os 7 papéis batem com o enum, toda mutação tem guard de papel, o
  escopo por linha de Vendedor/Professor é fail-closed, o catálogo e o versionamento de preço
  estão conformes e testados, a régua de cobrança segue o doc 24, e o canal WhatsApp bimotor com
  modo simulado cobre quase todo o UAT sem enviar mensagem real.
- **Os docs estão desatualizados em pontos que o QA vai tropeçar.** O doc 10 §2 contradiz o doc 09
  em várias regras de papel (o código segue o doc 09). Os docs 05/10/16 descrevem um gatilho de
  ativação de matrícula (P7) que o código não usa. O doc 11 não cobre 11 models e 11 enums (todo o
  WhatsApp) e o doc 12 lista 20 eventos como "planejados" que já são emitidos.
- **Há 2 bloqueadores reais de UAT** e um conjunto de brechas de permissão que precisam de decisão
  sua antes de o QA começar (ver §2 e §3).

## 2. Bloqueadores do UAT (resolver antes de o QA entrar)

| # | Problema | Evidência | Efeito no UAT | Ação sugerida |
|---|---|---|---|---|
| B1 | **Matrícula com turma falha sempre.** O wizard lista turmas por `dataInicio` futuro, mas o servidor exige `status = ABERTA`. Turmas nascem `PLANEJADA` e nenhuma tela chama `alterarStatusTurma`. | `src/server/matricula/consultas.ts:391-402`, `src/server/matricula/validacao.ts:62`, `src/server/turmas/acoes.ts:90,155-175` | Nenhuma matrícula com turma pode ser concluída pela interface. | Ou expor "Abrir turma" na UI, ou alinhar o filtro do wizard com a validação. Enquanto não houver fix, abrir turmas direto no banco de UAT. |
| B2 | **Matrícula salva como "Aguardando" não pode ser ativada depois.** `ativarMatricula` existe mas nenhum componente a chama; só existe o botão atômico "Receber pagamento e ativar" na criação, visível apenas para Admin. | `src/server/matricula/acoes.ts:604-624`, `src/app/(app)/matriculas/nova/MatriculaFormulario.tsx:737-755`, `src/server/matricula/permissoes.ts:10-11` | O fluxo "Vendedor salva, Financeiro ativa" descrito no doc 09 não é testável. | Expor "Ativar matrícula" na ficha do aluno para Financeiro/Secretaria/Admin. |
| B3 | **Seed não cobre todos os papéis.** Não existe usuário Gerente Pedagógico, nem usuários "puros" de Gerente Comercial, Financeiro e Secretaria. Mariana (GC+Vendedor) mascara bugs de GC puro. | `prisma/seed.ts` | QA não consegue testar 4 papéis isoladamente. | Criar em UAT: 1 usuário puro por papel (7) + os combinados do seed. Ver matriz no relatório 01. |

## 3. Brechas de permissão e regra (decidir: é bug ou é a regra nova?)

Itens em que o código faz algo diferente do que os docs dizem. Para cada um, você precisa dizer ao
QA qual é o comportamento esperado, senão ele vai abrir bug ou deixar passar.

| # | O que o código faz hoje | O que os docs dizem | Arquivo:linha |
|---|---|---|---|
| R1 | Matrícula **ativa só com a taxa quitada**; `contratoOk` é gravado `true` automaticamente; `primeiraMensalidadeOk` fica `false`; `ativadaComPendencia` nunca é `true`. | Docs 05/10/16 (P7): taxa + 1ª mensalidade + contrato. | `src/server/matricula/acoes.ts:416-427,485-496` |
| R2 | **Vendedor aumenta valor e adia vencimento sem aprovação.** Só desconto acima do limite vai para aprovação. Vendedor também ajusta cobrança de aluno fora do seu escopo. | Doc 09: Vendedor só desconto até o limite. Doc 10: Vendedor não altera cobrança. | `src/server/_shared/regras.ts:332-342`, `src/server/ajustes/acoes.ts:192-224` |
| R3 | **Gerente Comercial pode aprovar o próprio pedido** de desconto (não compara solicitante com aprovador). | Doc 07: GC aprova pedidos do Vendedor. | `src/server/ajustes/acoes.ts` (`decidirAprovacao`) |
| R4 | **Gerente Comercial puro não consegue conceder desconto** nem renegociar (só aprovar). | Doc 07: exemplo "GC 20%". | `src/server/ajustes/acoes.ts:195` |
| R5 | **Leituras sem guard de papel**: qualquer usuário autenticado abre `/configuracao/{paises,catalogo,turmas}`, `/pipeline`, `/leads`, `/matriculas/nova` por URL e lê preços de referência. Mutações continuam protegidas. | Doc 09: Configuração é do Admin (Turmas: Admin + GP). | `src/app/(app)/configuracao/*/page.tsx`, `(app)/layout.tsx:8` |
| R6 | Ajuste e aprovação **não verificam o status da cobrança**: pedido aprovado depois da quitação reescreve `valorNegociado` de cobrança `PAGO`. | Implícito: cobrança paga é terminal. | `src/server/ajustes/acoes.ts:198,312` |
| R7 | **Secretaria não entra em `/financeiro`** (só registra pagamento pela ficha do aluno). | Doc 09: Secretaria vê e registra pagamento. | `src/app/(app)/financeiro/page.tsx:16`, `src/lib/nav.ts:51-56` |
| R8 | **Editar um país apaga o tipo de documento de todos os alunos daquele país** (deleteMany + FK SET NULL). | Não documentado. | `src/server/paises/acoes.ts:114-125` |
| R9 | **Lead em `NO_SHOW` some do Kanban** (enum tem a etapa, o board não tem a coluna). | Doc 09: No-show é saída paralela, Perdido é coluna. | `src/app/(app)/pipeline/KanbanBoard.tsx:46-56,152-157` |
| R10 | **Pausar aluno não libera vaga** nem o tira da visão do professor. | Doc 09: Pausado não ocupa vaga. | `src/server/alunos/acoes.ts:176-197` |
| R11 | Aluno nasce `ATIVO` mesmo com matrícula `AGUARDANDO`. | Doc 09: aluno em rascunho até ativar. | `prisma/schema.prisma:332`, `src/server/matricula/acoes.ts:141` |
| R12 | Telefone não valida E.164: "123" vira "+506123" e salva. | Doc 04: telefone inválido bloqueia. | `src/server/_shared/validacao.ts:102-112` |
| R13 | Vigência `PROXIMOS_MESES` e `CONTRATO_INTEIRO` fazem a mesma coisa; impacto anual é mensal × 12 sem olhar vigência. | Doc 09/11: "próximos N meses". | `src/server/ajustes/acoes.ts:61-78,236` |
| R14 | Matrícula sem preço de referência exige justificativa **e** papel GC/Admin. | Doc 10 §3.1: basta justificativa. | `src/server/matricula/validacao.ts:107-135` |
| R15 | Certificado profissional com valor livre em qualquer país. | Doc 04: fixo, em colones, só Costa Rica. | `src/server/matricula/schema.ts:80` |
| R16 | Régua comercial: resposta do vendedor pelo celular (`fromMe`) **não para a cadência**; `REAGENDAR` não pausa; despacho não revalida etapa/aula antes de enviar. | Doc 27 e doc 32 (B2, B7, B8). | `src/server/whatsapp/cron-comercial.ts:165-179`, `despachante.ts:226-246`, `captura.ts:189-196` |

## 4. Não implementado (o QA não deve testar nem abrir bug)

Lista do que os docs descrevem mas não existe no código. Serve para o QA não perder tempo.

- Notificações (doc 10 §5): lead novo, desconto aprovado, cobrança vencida, comissão aprovada.
- Busca global (doc 10 §8).
- Motor de risco de cobrança (doc 25): só documentação.
- Estorno de comissão, cancelamento e encerramento de matrícula: `ESTORNADA`, `CANCELADA`,
  `ENCERRADA`, `RASCUNHO` nunca são gravados.
- Regra dos 90 dias de posse do lead.
- Pipeline B2B separado: é só o funil PF filtrado por flag.
- IA copiloto (doc 27 C3): nenhum provedor LLM no código. Só palavras-chave exatas.
- Progressão de nível A1 → A2: só via troca manual de turma.
- Rematrícula reaproveitando cadastro de ex-aluno: gera aluno duplicado.
- Moeda USD na matrícula fora de país dolarizado.
- Bloqueio de aluno novo em país pausado/rascunho/encerrado.
- Edição de dados do lead pela ficha e transferência de dono pela UI (`editarLead` e
  `atribuirDono` existem no servidor, sem tela).
- Filtros do Kanban por vendedor/segmento/temperatura.
- Histórico de movimentações registrando a própria matrícula.
- Cargas Q10 (docs 19 a 23): foram one-shot, scripts removidos. O que existe são 2 importadores
  XLSX (alunos e turmas, só Admin), sem doc próprio.
- Integrações de pagamento/contrato (DocuSign, gateway, conferência de comprovante).

## 5. Comportamentos que o QA precisa saber (não são bugs)

- **Status derivados.** `StatusCobranca.ATRASADO` e `StatusComissao.ESTORNADA` nunca são gravados.
  "Em atraso" é calculado por `vencimento < hoje` na leitura. Conferências de dados devem olhar a
  data, não o status. A coluna Status da ficha mostra "Pendente" para cobrança vencida.
- **Régua e cron em UAT.** A política de cobrança é semeada DESLIGADA e o cron só roda com número
  `META_CLOUD`. Nada dispara sozinho até o Admin ligar. O modo simulado (sem `WHATSAPP_LIVE`)
  registra o envio na outbox sem mandar mensagem real.
- **"SIM" não confirma experimental em modo simulado** (`captura.ts:158-174` exige envio real).
- **Critério "Bloquear" usa 15 dias fixos**, não o offset do degrau D+15 da política.
- **Login:** 5 falhas em 15 minutos bloqueiam o e-mail (em memória, reinicia com o servidor).
  Sessão JWT dura 30 dias. Não existe troca de senha pelo próprio usuário.
- **Códigos legíveis** (L-/A-/M-/C-/T-) podem ter buracos na sequência: a geração roda fora da
  transação.
- **Gerente Comercial** vê Configuração › WhatsApp só com os painéis comerciais (régua e config);
  números, QR e templates são do Admin.

## 6. Docs que precisam de atualização

| Doc | O que está desatualizado |
|---|---|
| 05, 10 §1, 16 §B3 | Gatilho de ativação P7 (código ativa só com a taxa). |
| 10 §2 | Tabela de papéis contradiz doc 09 em: Vendedor altera cobrança até o limite; Secretaria não cria aluno; GC não aprova comissão; GC configura WhatsApp comercial. |
| 11 | Faltam 11 models e 11 enums (WhatsApp, PoliticaRegua, ConfigComercial), 7 campos de `Lead`, 4 de `Matricula`, 18 migrations. |
| 12 | 20 eventos listados como "planejados" já são emitidos; `ExperimentalAtribuida` não está no doc. |
| 09 §Turmas | Ciclo de status da turma não existe na UI; situação é derivada das datas. |
| 09 §Pipeline | Coluna No-show. Filtros do Kanban. |
| 18 | Não define estados vazio/erro/confirmação; ações como Enviar proposta e Desativar usuário executam sem confirmação. |
| 30 S1 | Trava "automático ⇒ oficial" foi liberada para comercial/reativa sem ADR. |
| 28, 32 | 7 gaps do doc 28 abertos; os 9 bloqueadores B1 a B9 do doc 32 abertos. |

## 7. Como isso vira o roteiro de QA

Cada relatório em `auditoria/` termina com uma lista de cenários de teste por tela ou fluxo
(20 a 30 por área, cerca de 150 no total), já escritos para serem executados em UAT pela
interface. O roteiro do QA será montado a partir deles, marcando para cada cenário qual é o
comportamento esperado segundo a decisão tomada no §3.
