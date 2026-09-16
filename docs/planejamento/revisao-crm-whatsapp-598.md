# Revisão CRM e WhatsApp — 598

Data da revisão: 16/09/2026.

Esta é uma auditoria de leitura da especificação e do código atual. Ela corrige
um diagnóstico anterior de Q120 e registra um achado concreto no atendimento
financeiro. Não altera banco, serviços ou testes.

## Q120: diagnóstico anterior corrigido

A afirmação de que a venda sempre cria uma nova pessoa está desatualizada. Ela
descrevia o caminho legado `criarMatriculaTx`, mas não a preparação comercial
atual.

`src/server/matricula/preparacao-comercial.ts` só expõe a identidade existente
para seleção quando o telefone E.164 confere. `preparacao-comercial-tx.ts`
recebe `alunoId` ou `novoCadastro` de forma exclusiva, registra a nova
`Matricula` no lead da nova venda e conserva a fotografia do vendedor. Assim,
`Matricula.leadId @unique` significa uma matrícula por lead; não significa que
um aluno não possa ter leads e matrículas de vendas distintas.

O cenário está coberto em
`src/server/matricula/reserva-vaga.int.test.ts`, no caso de preparação que
exige a seleção explícita entre candidatos do contato autorizado. Ele verifica
uma nova matrícula para o mesmo aluno, lead novo, preservação do contrato
anterior e repetição idempotente. Portanto, Q120 não é uma lacuna confirmada
nesse fluxo.

Essa correção não conclui que todas as lacunas históricas do módulo estejam
resolvidas. O caminho legado, seus consumidores e os demais itens da
especificação devem ser avaliados separadamente.

## Achado confirmado: atendimento financeiro não identifica a matrícula

O contrato funcional estabelece que `Aluno` representa cadastro/identidade e
que `Matricula` é a referência do serviço contratado. Também requer referências
de matrícula nos atendimentos quando pertinentes. Ver
`docs/specs/erp-educacional.md` (INV-01 e WhatsApp) e
`docs/specs/matricula-como-unidade-operacional.md` (Atendimento / aviso).

No modelo atual, `AtendimentoWhatsApp` tem `leadId`, `alunoId` e `turmaId`, mas
não tem `matriculaId`. Em `src/server/whatsapp/atendimentos.ts`, a chave de
contexto de atendimento usa somente finalidade, lead, aluno e turma. Para o
atendimento `FINANCEIRO`, `src/server/whatsapp/escopo.ts` concede escopo pelo
`alunoId`; em `src/server/whatsapp/consultas-inbox.ts`,
`cobrancaAtivaDoAtendimento` seleciona a primeira cobrança pendente ou atrasada
cuja matrícula pertença àquele aluno.

Consequentemente, um aluno com mais de uma matrícula pode abrir um atendimento
financeiro que apresenta ou direciona a cobrança de outro contrato do mesmo
aluno. Isso contradiz a separação entre identidade e contrato aprovada pela
especificação.

Um pacote de correção precisa transportar a matrícula pertinente para o
atendimento financeiro e usá-la na chave, no escopo e na consulta de cobrança.
Seu aceite deve demonstrar que duas matrículas do mesmo aluno mantêm
atendimentos e cobranças independentes, sem alterar o resultado de um
atendimento que já possua uma única matrícula válida.

## Limite desta auditoria

A especificação determina que quem sucede no atendimento receba apenas o
histórico necessário e autorizado, mas não define uma regra temporal para
ocultar todo conteúdo anterior à transferência. Não há evidência para propor
esse corte temporal nesta revisão.

Q155, Q161, Q162, Q164 e Q165 não foram declarados resolvidos ou pendentes por
este documento; cada um permanece dependente de sua própria especificação e
evidência de implementação.


## Tratamento posterior

O [incremento 599](validacao-incremento-599.md) implementou o contexto explícito de matrícula, seleção de cobrança e conferência no despacho. Este achado descreve o estado anterior; a validação posterior e os limites remanescentes estão no relatório vinculado.
