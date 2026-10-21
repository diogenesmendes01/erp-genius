# Mudanças acadêmicas com aprovação

**Decisão D14 detalhada, implementada e validada localmente em 08/09/2026.**

A transferência equivalente continua sendo uma operação direta da Secretaria, Gerência Pedagógica ou Administração. A mudança excepcional de nível passa por solicitação, parecer, aprovação independente e execução. A aprovação sozinha não altera a turma do aluno.

## Definições confirmadas

| Etapa | Quem atua | Condições |
|---|---|---|
| Solicitar | Secretaria, Gerência Pedagógica ou Administração | Aluno ativo, origem identificada, destino, motivo e confirmação do horário com aluno/responsável |
| Emitir parecer | Professor que atende atualmente o aluno na turma de origem | Parecer registrado com autoria e data; não altera a alocação nem aprova a solicitação |
| Aprovar ou rejeitar | Outra pessoa da Gerência Pedagógica ou Administração | Fundamentação obrigatória; para aprovar, parecer docente ou justificativa da dispensa quando indisponível |
| Executar | Secretaria ou Administração | Solicitação aprovada e ainda válida, horário reconfirmado, vaga e permissões revalidadas |
| Cancelar solicitação aberta | Secretaria, Gerência Pedagógica ou Administração | Motivo obrigatório; libera a apresentação de uma nova solicitação sem alterar a turma atual |

Solicitante e aprovador devem ser pessoas diferentes, inclusive com papéis acumulados ou Administração. Outro gerente pedagógico pode analisar o pedido aberto por um gerente; a direção também pode decidir. Não se exige uma terceira pessoa para executar: o solicitante pode executar depois da aprovação independente; quem acumula Gerência Pedagógica e Secretaria pode aprovar e executar um pedido de outra pessoa.

## Alcance desta entrega

O fluxo altera a alocação de turma e nível, preservando idioma, modalidade e formato online/presencial. Não modifica preço, produto contratado, parcelas, pagamentos, comissões ou nível inicial histórico da matrícula. Troca de curso/contrato exige fluxo próprio. Não implementa progressão automática, avaliação por habilidade, dispensa de pré-requisito curricular nem alteração retroativa de aulas.

O modelo atual mantém uma única alocação ativa por aluno. Cadastros legados ativos, já alocados e sem matrícula formal, continuam podendo ser movimentados sem inventar matrícula. Quando existem matrículas, as condições do curso ativo compatível são revalidadas. Não há conversão automática para múltiplos cursos simultâneos.

## Estado, concorrência e histórico

- Estados: `PENDENTE`, `APROVADA`, `REJEITADA`, `EXECUTADA` e `CANCELADA`. No máximo uma solicitação pendente ou aprovada por aluno.
- Solicitar, emitir parecer ou aprovar não reserva vaga, altera turma ou produz movimentação efetiva. A execução reconta a ocupação e aplica tudo em uma transação.
- A decisão se refere à alocação e às condições registradas na proposta. Mudança de turma, pausa/retomada, alteração de agenda/curso ou perda de autorização pode invalidar a proposta; cancela-se a solicitação obsoleta e abre-se outra.
- A transferência encerra a alocação antiga com data e cria outra. O diário e os registros das aulas anteriores são preservados. O professor anterior perde o acesso operacional atual, mantendo o histórico das próprias aulas em leitura.
- Conversas e arquivos institucionais também seguem o vínculo atual. O envio pendente do professor anterior perde a autorização; uma chamada já entregue ao provedor externo não pode ser recolhida por essa mudança.
- Edição do nível ou da modalidade de turma com alocações, inclusive históricas, não contorna esse fluxo. Usa-se uma nova turma para preservar o histórico. Capacidade não pode ficar abaixo da ocupação atual.
- Horário compatível é uma conferência humana registrada. Ainda não existe disponibilidade completa do aluno nem detecção automática de conflitos de agenda.

## Uso nas telas

1. Ficha do aluno → **Turma, nível e solicitações acadêmicas**. Selecionar destino, informar motivo e confirmar horário.
2. Destino equivalente permite **Transferir para turma equivalente**. Destino em outro nível permite **Enviar para aprovação pedagógica**.
3. Professor consulta **Mudanças acadêmicas** e registra o parecer dos alunos que atende.
4. Gerência Pedagógica/Administração fundamenta e decide. Sem parecer disponível, a aprovação exige justificar a dispensa.
5. Secretaria reconfirma horário e executa a mudança aprovada. A fila também permite consultar o histórico e cancelar solicitações abertas com motivo.

## Código e validação

[Ações e autorização no servidor](../src/server/academico/acoes.ts), [validação das condições da proposta](../src/server/academico/estado.ts), [consultas por papel e vínculo](../src/server/academico/consultas.ts) e [interface acadêmica](../src/app/(app)/academico/MudancasAcademicasPainel.tsx). A [migração D14](../prisma/migrations/20260908060000_mudanca_academica_aprovada/migration.sql) cria solicitações, pareceres, referências e restrições de integridade.

| Verificação local | Resultado |
|---|---|
| Testes unitários globais | 571/571, em 50 arquivos |
| Testes de integração globais com PostgreSQL | 390/390, em 34 arquivos |
| TypeScript e build Next.js 16.2.9 | Aprovados; 34 páginas estáticas geradas |
| ESLint global | 0 erros; 9 avisos preexistentes fora do domínio acadêmico |
| ESLint dos scripts de validação desta entrega | 0 erros e 0 avisos |
| Acesso HTTP e conteúdo retornado por papel | 32/32 verificações |
| Migrações aplicadas no banco descartável | 45/45 checksums conferidos |
| Jornada no navegador | Solicitação → parecer → aprovação → execução → consulta do histórico |
| Persistência nas três etapas da jornada | 9/9 verificações por etapa: pendente, aprovada e executada |

Os totais globais incluem [34 casos unitários novos de regras acadêmicas](../src/server/academico/regras.test.ts) e 77 casos de integração novos: [53 do fluxo de aprovação](../src/server/academico/fluxo.int.test.ts), [18 de integridade das turmas](../src/server/turmas/integridade-academica.int.test.ts) e [6 de visibilidade e concorrência](../src/server/academico/visibilidade.int.test.ts). Esses casos são subconjuntos dos totais, não testes adicionais a somar.

A jornada no navegador usou contas fictícias de Secretaria, Professor e Gerência Pedagógica. Tanto após solicitar quanto após aprovar, o aluno continuou na origem. Somente a execução pela Secretaria criou a alocação de destino e encerrou a anterior; contrato, cobranças, recebimentos e diário permaneceram iguais. O histórico apresentou autoria de cada etapa e o console não registrou erros nessa jornada. Dispensa justificada, autoaprovação negada, revogação de vínculo e disputas simultâneas foram verificadas nos testes automatizados; não foram repetidas integralmente no navegador.

O [registro consolidado da validação](validacao-academico-2026-09-08.json) contém casos, resultados e hashes do código verificado. O [roteiro reproduzível](../scripts/validacao/README.md) usa apenas banco e usuários locais e fictícios. Esta entrega não implanta nem altera dados de produção e não valida provedores reais de WhatsApp ou plataformas externas de aula. A homologação pela equipe da escola e a implantação continuam sendo etapas operacionais. Os [resultados D01–D12](38-implementacao-acesso-validacao.md) e da [retomada D13](39-retomada-com-aprovacao.md) permanecem históricos.
