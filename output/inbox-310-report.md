# Relatório DEV A — Inbox #310

## Estado

Implementação no worktree exclusivo inbox-dev-a, branch codex/inbox-e1-310 sobre bcc3d27a (E0). SPEC: docs/specs/inbox-contagens-saude.md. Fonte #306 b7ed31d1 preservada. Entrega preparada para TESTER; aprovação independente, regressão global combinada e publicação pelo integrador pendentes.

## Mudança

Contratos centrais dos cinco chips; agregados autorizados sobre todo o conjunto filtrado; rota opt-in sem cursor, com escopo de envio preservado; SSR após guarda; estado cliente com proteção contra respostas antigas, troca de filtro e leitura em voo. Saúde por enum/sessão/ativo com projeção pública id/rótulo/saúde. Nenhuma UI adicional antes da consumidora #313.

Decisões coordenadas: SIMULADO inexistente no schema não implementado; enums legados tipados sem reintroduzir adapters/literais proibidos; opção enviar no agregado para não alargar acesso; #310 antecede #308 por coordenação de contratos, não dependência funcional obrigatória.

## TDD e gates observados

Todos os scripts JS usam C:/Users/Mendes/AppData/Local/hermes/node/node.exe (Node 22.23.2). Sem instalação, troca de pacote ou lock. Integração usa vitest.integration.config.ts e perfil local dev-email, uma suíte por vez.

- RED unitário inicial: chunk b67e5e, exit1, 25 falhas esperadas/5 passes (saúde ausente e campo ausente na API). RED de parâmetros/SSR: chunks 993137 e92ebc3; corrigido setup do mock SSR para isolar ausência da consulta, sem alterar produção. RED cliente: chunk5200c1, exit1, quatro testes novos falhando pela ausência do estado agregado.
- RED integração: sessão18253/chunk9c44c2, exit1; detectou também duas fixtures novas incompatíveis com CHECK status_encerrado. Fixtures corrigidas para ENCERRADO, sem tocar schema. Reexecução89328/chunk319bb9: quatro falhas funcionais esperadas por contarChipsInbox ausente,20 testes fora do filtro. Falha das opções por saúde ausente observada em18253.
- GREEN unitário dirigido: chunk03865f, exit0,5 arquivos/82 testes, sem ignorados. Saúde24, rota6, SSR13, parâmetros14, interação25. Proteções #299 existentes preservadas; quatro testes novos observam o estado produtor pelo formato público, sem índice de hook/atributo de teste na UI. Não se trata de teste DOM visual.
- Integração completa dos dois arquivos: sessão56956/chunkbd3a51, exit0,2 arquivos/26 testes, sem ignorados,118,56s. Inclui consultas anteriores, cinco agregados/filtros, prazo estrito, pessoal/escopo, número ativo/encerrado e projeção exata de saúde sem telefone/provedor. Teste adicional de opções foi incluído antes de o arquivo ser carregado, e consta no total2.
- Complemento após ampliar asserções existentes: sessão51657/chunk3457da, exit0,3 testes/21 fora do filtro,13,63s. Filtro: cursor estável|C4: naoLidas com leitura|convite sem envio. Demonstra123 atendimentos além da página50, entrada após lidaAte versus saída/leitura de outro usuário e3 convites visíveis→1 com envio.
- TypeScript --noEmit com heap8192: primeira sessão84387/chunk4a753c, exit1 por tipos novos dos testes (conversaId de AvisoInbox e inferência estreita do helper). Corrigidos somente os testes. Sessão93695/chunkcc0a2a: exit0.
- ESLint dos13 arquivos de código/teste alterados --max-warnings0: chunkb0dc9c, exit0, sem novos avisos. Revalidação final dos testes/guardas e lint será registrada abaixo.

## Limites e pendências

Sem captura própria por ruling Task5Step5; chips e saúde visual entram na #313. Não iniciar servidor ou semear ambiente para fotografar uma UI ainda não consumidora. API/SSR e banco demonstrados por testes reais; transporte externo não executado. Não alterar escopo de números/permissionamento para fins de apresentação.

Full global próprio não executado por coordenação explícita: integrador combinará #309+#310 e observará um global final. TESTER ainda precisa inspecionar o SHA congelado. Nenhuma aprovação visual, merge, push, PR ou deploy alegados. Artefatos privados antigos, seeds, credenciais e logs não entram neste commit.

## Congelamento para revisão

Recorte final com as guardas pertinentes: chunk a0b1e7, exit0,10 arquivos/161 testes sem ignorados (os5 arquivos/82 testes acima + sem-polling, sem-provedores-legados, paleta, responsivo e botões). ESLint final dos13 arquivos --max-warnings0: chunk264633 exit0. TypeScript final heap8192: sessão11852/chunk1c666d exit0. Runtime confirmado em355125: v22.23.2. Diff-check5d3012 exit0. Esses gates antecedem somente a consolidação documental; nenhuma fonte mudou depois deles. O full integrado permanece pendente do integrador e não foi imputado a este SHA.
