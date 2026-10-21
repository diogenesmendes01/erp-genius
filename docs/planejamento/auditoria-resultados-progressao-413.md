# Revisão Q143, Q153 e Q154 — pendências de implementação

2026-09-14. Revisão de código e SPEC; não é comprovação de conclusão por ausência de falhas em testes.

## Q143 — resultados do próprio aluno

O portal possui reposições, mas ainda não apresenta avaliações oficiais e consolidado acadêmico. O serviço de acompanhamento da equipe exige papel docente/gestão; não deve ser exposto ao aluno apenas ampliando os papéis aceitos. Nova projeção por sessão → aluno → matrícula/alocação deve retornar somente notas oficializadas, comentários destinados ao aluno, frequência e pendências. Implementação iniciada em paralelo. Até existir Q154, o resultado deve ser identificado como parcial.

## Q153 — aproveitamento em transferência

Ainda falta proposta e aprovação independente do mapeamento de avaliações/habilidades entre origem e destino. A troca de turma do mesmo nível em `src/server/alunos/acoes.ts` não equivale à análise de equivalência. A implementação deve preservar fontes, identificar exigências restantes e impedir dupla ponderação, sem alterar regras de outros alunos.

## Q154 — fechamento e progressão

Falta fechamento acadêmico versionado com fontes e pendências. Leitura direta de `src/server/academico/acoes.ts` confirma que a decisão e a execução de mudança validam estado e parecer/dispensa, mas ainda não consultam o consolidado de notas/frequência ou fechamento. Portanto, os testes de avaliações e mudança acadêmica existentes não comprovam os requisitos de progressão aprovados em Q130/Q131/Q138/Q154.

Próxima implementação deve unir o fechamento às fontes oficiais e ao aproveitamento, revalidar pendências sob transação e impedir progressão sem requisitos, preservando o fluxo de aprovação e execução pela Secretaria. Não basta acrescentar um bloqueio permanente ou chamar todo resultado de final.

Esses itens permanecem no escopo integral; não foram adiados por decisão do usuário nem considerados entregues.
