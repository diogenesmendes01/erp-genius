# QA independente #403 C3 — f896c306d474f76038c3b6c4425c4b0a214a4b6c

**Parecer:** favorável ao fix local do RED A→B→A sem edição, na fonte exata acima. Pai `a7ebf56b4fb3391d1013ff776086616c46bb13c1`; o delta produtivo limita-se a `src/components/conversa/Compositor.tsx` e `rascunhos-conversa.ts`. Mudaram também o teste ReactDOM e três documentos; menu C2, servidor, schema, scripts e dependências não mudaram.

## Verificação própria

Node 22.23.2, Vitest local, `Compositor.rascunho.interacao.test.ts` + `Compositor.test.ts`, **2 arquivos/62 testes, exit 0**, chunk `d60052`, `--maxWorkers=2`, sem filtros de nome/ignorados. `git diff --check` A7..f896 saiu 0 e o worktree rastreado permaneceu limpo. Os gates DEV 14 arquivos/325 testes, TSC e lint são evidência do autor, não execução minha. Não executei banco, preview, navegador ERP ou suíte global.

## Raciocínio do contrato

- A intenção agora é um token por chave de contato+modo, separado do `dono` físico. `registrar` troca o owner/callback ao remontar A, mas conserva o token; `alterar` cria token novo só em intenção deliberada. Isso resolve A→B→A sem edição, preservando a revogação ao editar e voltar ao mesmo texto, inserir emoji ou selecionar arquivo.
- O envio captura o token antes da promessa. Só `ok`, token ainda atual e comparação do valor bruto no `localStorage` autorizam remover a chave. `confirmar` gira o token e chama o callback do owner **atualmente montado** daquela chave; o callback limpa o campo e arquivo e incrementa a revisão local. A volta seguinte B→A lê vazio. B e outro modo têm chaves distintas.
- A assinatura do owner nasce no `useLayoutEffect` após commit e seu cleanup só remove o callback se ainda é o mesmo owner. `invalidar` da desmontagem integral do Inbox limpa o mapa; callbacks antigos deixam de autorizar limpeza. Hooks permanecem chamados antes dos retornos condicionais do compositor. O coordenador compartilhado continua acima da montagem por contato em `ConversaAberta`/`RodapeConversa`.
- Erro e resultado incerto não entram na confirmação. Valor externo divergente não é apagado; armazenamento indisponível permite limpar apenas a intenção visual confirmada, sem prometer persistência. Os testes ReactDOM reais/StrictMode cobrem responder e nota sem edição, retorno vazio, edição→mesmo texto, arquivo posterior, storage externo, erro/incerto e desmontagem integral.

## Limites

Não houve envio nem sucesso ERP fabricado nesta revisão; os desfechos foram promessas controladas nos testes. O teste de mídia cobre a ação já despachada; upload ainda pendente conserva a guarda local existente e não é novo comportamento deste delta. A prova visual independente do menu C2 em A7 (`output/inbox-403-a7-browser-review-tester.md`) permanece válida **somente** para menu/rodapé/diálogo e não comprova esta reconciliação C3. Publicação, regressão global agregada e eventual prova ERP são coordenadas pelo integrador.
