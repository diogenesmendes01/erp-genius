# Incremento 454 — histórico completo e núcleo de projeção Q23

Data: 15/09/2026. Meta integral ativa.

## Entrega

- Nova consulta `consultarHistoricoCorrecaoAula` permite ao professor ativo ler as propostas das aulas que ele ministrou, mesmo após o fim do vínculo com a turma. Professor de outra aula e papéis sem escopo não recebem esses dados. A leitura não reabre a ação de preparar/rejeitar correção.
- O histórico do diário oferece o acesso em leitura; a página de correções oculta o formulário quando `podePropor` é falso. Gestão e professor ainda autorizado conservam suas funções anteriores.
- Histórico paginado por versão, vinte propostas por página, cursor exclusivo e ordenação estável. A versão atual do encontro é consultada separadamente da página; uma página antiga nunca concede rejeição como se fosse atual. Nova proposta entre páginas não duplica nem omite versões do intervalo consultado. A interface sinaliza a necessidade de atualizar a fonte quando identifica nova versão.
- `correcao-aula-projecao.ts` centraliza a validação estrita de snapshots e a projeção não mutável de participação. Comparação Q23 e simulação de frequência usam esse núcleo. Preserva encontro, diário, fonte de gravação, registro, aluno, matrícula e nome capturado; recusa duplicidades e normaliza a ordem da proposta conforme a fonte.

## Verificação

- 19 testes de integração aprovados em Q23 e frequência do nível, incluindo professor desvinculado, acesso alheio, revogação, paginação e chegada concorrente de nova versão: `docs/validacao-historico-projecao-454-2026-09-15.json`.
- Dez unitários aprovados nos arquivos de projeção, comparação e schema Q23.
- Lint direcionado, TypeScript/build e diff check conferidos. Sem validação visual em navegador.

## Limites

O núcleo compartilhado ainda não é a publicação de uma correção aprovada. As ações oficiais continuam lendo o original até a implementação da aprovação, projeção efetiva persistida, efeitos em reposições/financeiro e casos de progressão. A leitura histórica continua exigindo identidade ativa e papel acadêmico autorizado; não dá acesso a contas desativadas.

Nenhuma migration nova, deploy, alteração de produção ou envio externo neste incremento.
