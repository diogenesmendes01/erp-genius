# Incremento 386 — reavaliação após correção de conclusão

Data: 14/09/2026.

A fila docente passou a considerar a última conclusão e sua última correção aprovada. Uma conclusão retirada volta à fila do professor designado, mantendo a versão anterior para controle de concorrência. Entregas já usadas em conclusão ou correção não são reutilizadas automaticamente.

Foi ampliado o teste da correção para verificar: fila vazia enquanto a conclusão ainda vale; retorno à fila depois da correção independente; entrega anterior indisponível; nova entrega selecionada quando registrada. Esse teste passou na execução de integração.

Resultado integral da execução: sete testes passaram e um falhou em `reposicao-permissoes.int.test.ts`. A falha está na nova solicitação após rejeição, após a ação ganhar dependência de `AgendaReposicaoIndividual`, cuja migração 177 continua em rascunho. Relatório: `../validacao-consulta-reposicoes-386-2026-09-14.json`. É necessário integrar e validar a migração antes de declarar a suíte novamente aprovada; o resultado verde anterior não representa o estado atual dessas alterações.

Também passaram cinco testes unitários em `portal-aluno/politica.test.ts` e `portal-aluno/sessao.test.ts`. São testes locais de política/sessão com substitutos de dependências: não comprovam autenticação completa, envio de e-mail nem integração com banco. A identidade permanece em revisão, inclusive relações do schema e consistência das conclusões exibidas ao aluno.
