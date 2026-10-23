# PR #398 — revisão R1 C1–C6 / DEV A

Base EXATA ffddfdae6969e93f865be73357c95816d6b090aa, branch codex/inbox-pr398-review-todos. Fonte da solicitação: revisão5623403773 (head antigoaa366a0c) e comentário posterior6360027518, inventário ROOT output/inbox-pr-reviews-20261023.json. Implementação324 interrompida antes de código/testes, investigação privada preservada em output/inbox-324-investigacao-dev-a.md (SHA256eddf4077c38dc553726dad3071fb333c2efd8a0c3f4a7ac41f5677c43953d690).

| Comentário | Situação neste patch | Evidência / pendência |
|---|---|---|
| C1 MEDIUM conflitos com main/base | ANTECEDENTE ffdd preservado, integração futura PENDENTE | Comentário6360027518 documenta composição anterior; esta tarefa não integra main/base407 nemQA280, não altera pais publicados. Retarget/composição final após397 pertencem ao outro integrador. Não revalidado remoto pelo DEV |
| C2 MEDIUM CI ausente no PR empilhado | PENDENTE integrador/CI remota | Gates locais abaixo não são check runs do GitHub; typecheck/lint/testUTC/testAmericaSaoPaulo precisam executar no head/target final. Nenhum push/comentárioGitHub/retarget peloDEV |
| C3 LOW key dia duplicada após data inválida | CORRIGIDO localmente com RED/GREEN | Apenas atualiza diaAnterior quando dia é válido; mantém item inválido e não inventa separador; mudança civil real continua criando dia distinto. Duas regressões para mensagem/nota inválida e controle positivo inicial/mudança civil |
| C4 LOW nota com autor vazio/branco | CORRIGIDO localmente com RED/GREEN | nota.autorNome?.trim() ou Autor não informado. Casos vazia/whitespace antes falhavam; autores válidos/null/origem/horário/XSS e nota sem comandos/status/mídia permanecem nos testes existentes |
| C5 LOW Hoje/Ontem em tela parada à meia-noite | JUSTIFICADO, limite de escopo mantido | Snapshot estável até assinatura/revisão de conteúdo/notas/seleção/epochSSR. Hidratação preserva referênciaSSR e depois adota relógio real; nova mensagem atualiza calendário. Nenhum timer/polling/escuta extra. Teste existente confirma explicitamente ociosidade sem atualização e timerCount0; não afirmar virada automática |
| C6 LOW nomes de testes diferentes do plano | DOCUMENTADO com mapa nominal | SPEC docs/specs/inbox-thread-autoria-dias.md contém as12correspondências Task9→arquivo/título real, mais relógio/virtualização. Não renomeia artificialmente testes e delimita cobertura por composição, sem alegar nova prova E2E/visual |

## Mudanças e fronteiras

Produção alterada só em src/components/conversa/itens-thread.ts e BalaoMensagem.tsx, dois pontos lógicos. Cinco casos adicionados nos respectivos testes (doisC3, controlepositivoC3, doisC4); todos os testes anteriores preservados. SPEC e quadro recebem registro da revisão. Não muda API, VirtualList, agora-thread, ConversaAberta, SSR, escopo/permissões, consultas, banco, backend, SSE, transporte, main/base407, scripts/harness/PNG ou dependências.

C3 é proteção de entrada malformada de UI/import/fixture: datas do banco normalmente válidas. Tests chamam decoração sobre janela já ordenada, preservando IDs e ordem; não substituem ordenação/cursores. C4 normaliza apenas exibição da autoria de nota, não grava nome nem autorId. Não houve browser/DB/preview/envio.

## TDD / gates locais observados

- RED92ab90 terminal1:2arquivos44testes,4novasfalhas/40pass. Mensagem e nota inválidas geravam duas keys dia:2026-10-22; nota vazia/branca não exibia fallback. Controle de data inválida inicial e mudança civil real jápassava. O logRED inclui warningSSRuseLayoutEffect do renderSSR existente; não houve mudança de hook nem supressão de warning.
- GREENbad316 terminal0:9arquivos88testes,1.76s,maxWorkers2. Recorte completo dos arquivos: itens-thread.test.ts,BalaoMensagem.test.ts,EventoSistema.test.ts,SeparadorDia.test.ts,agora-thread.test.ts,VirtualList.test.ts,VirtualList.estavel.test.ts,src/app/(app)/inbox/ConversaAberta.test.ts,sem-polling.test.ts. Sem -t/skips novos; configuração unitária exclui INT.
- TZ=UTC34b6fe terminal0:mesmos9arquivos88testes,1.95s. TZ=America/Sao_Paulo275459 terminal0:mesmos9arquivos88testes,1.79s. Essas duas rodadas dirigidas são locais, não os jobsCI nem suíteglobal.
- Lint92a338 terminal0:4fontes alteradas,max-warnings0. Nenhum detector/registro de guarda modificado.
- TSC26902/a11458 terminal1 e repetição3527af terminal1:único erro em cache ignorado .next/dev/types/validator.ts que ainda importava rota323 painel/[aba] ausente na baseffdd. Nenhuma falha foi ocultada. typegenlocal0d8d6a terminou0, mas gera.next/types e não substitui.next/dev/types. Cache residual foi removido SOMENTE após caminho absoluto sob.next próprio/reparse=false/gitcheck-ignore e previewjáparado, sem alterar tsconfig/deps/código; TSCfinal session73649/bac043 heap8192 TERMINAL0, fonte produtiva inalterada após os recortes.

Runtime local conferido7914ac:Node22.23.2,React18.3.1/ReactDOM18.3.1,Vitest4.1.11. Dependências físicas/manifests não alterados. A composição futura comQA280 pertence ao integrador e não foi antecipada. Nenhuma suíte global/integração/browser foi executada nesta tarefa por não haver mudança de banco/fluxo.

## Pendências

TSCfinal terminal0 observado; diffcheck e commit exato registrados no handoff. QA independente e composição com pais/main/QA280/CI/retarget pelo integrador ainda pendentes. Sem publicação peloDEV. Nenhuma homologação ou checkGitHub presumido.
