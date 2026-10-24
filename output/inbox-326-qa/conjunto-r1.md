# QA independente #326 — composição conjunta 6f92 e fidelidade de publicação

Favorável à fonte `6f92673dfb526e11ad1e349bea484d135819e849` e à fidelidade dos21blobsSRC selecionados da publicação `8b91bab362416ba3dd42a99831d5898356e99479`. UNIT24/656, lint21 eTSC próprios terminaram0; nenhum novo bloqueador identificado. Não é homologação visual/Save nem autorização para executar o observador privado em browser. CI, publicação final e decisão humana continuam separados.

## Fonte, preparo e comparação independente

Preflight/checkout próprio `34fe09` EXIT0, detached/tracked limpo.1.076 privados anteriores preservados; inventário1.082 arquivos não tracked incluindo ignored. Perfilintegracao/schema487 OID `1f575691cde242124c1493b8406121e8830a6f7e`/client físicoE246 preservados. Só iniciei runtime após Next/READY ROOT `942720` EXIT0. Fonte permaneceu congelada e1.082 hashes privados conferiram novamente após os terminais (`7d7609` EXIT0).

A composição6f recebe quatro SRCfd1+3MD sobre08852. Hook/teste e InboxNovo.detalhes.test são blobs exatosfd1ea7e; InboxNovo recebe somente a linha condicional de fallbackWhatsApp, conservando os blocos de editor/foco/ação única. Gaveta/Retry/form/foco e src/server/lib/components/Prisma/deps são iguais2b43; guardaenums é exatamente08852, sem exceçãoCSS327. Não altera permissões, schema, transporte ou dependências.

Prova própria `74031/dade9b` EXIT0, sem checkoutROOT: resolvi8b91 para40 caracteres e comparei por ls-tree/OID os21paths obtidos de `git diff --name-only d775a140 6f926 -- src`. Todos são iguais na publicação. O diff da publicação contra main `ae56c00f053e864a3efea35d2f640afe48716cc4` contém21paths=18SRC+3MD, sem delta de scripts/harness, Prisma/SQL, package/locks ou workflows. Três dos21SRC selecionados já estavam na base; não confundi essa lista de identidade com18SRC efetivamente alterados. Não herdei resultado da provaROOT42004 que estava emcurso.

Manifesto independente `inbox-326-6f92-publicacao-fontes-tester.json`, SHA `b9d99c6b8aadf72fd5a2f0778be0198e0999b76a3dfacaf6f28c4b4d2642e88c`, enumera os21blobs e hashesGitLF,24pathsUNIT, escopo e fonte da publicação. A igualdade é dos paths selecionados; não afirmo árvore inteira6f igualmain/publicação. Quadros/relatórios mantêm suas fontes nominais e podem receber composição documental posterior sem alterar esses SRC.

## Gates próprios

Node22.23.2/Vitest4.1.11/executáveis locais, sem instalação/Prisma/generate. Escolhi a união aprovada22 arquivos anteriores+InboxNovo.detalhesR1+enums-rotulos completo:24 únicos/reais, sem.int/browser. Não inferi os74 arquivosDEV só pelo total. Sem filtro de nome ou skip imposto, configuração unitária exclui integração.

| Gate | Sessão/inicial → terminal | Resultado |
| --- | --- | --- |
| UNIT24 arquivos completos | 75785/021dd6 → fc7e22 | EXIT0,656 testes,42,92s,maxWorkers2 |
| Lintunião21SRC d775..6f | 307122 | EXIT0,zero avisos,teto0 |
| TypeScript | 8187/30da01 → bd749d | EXIT0,sem diagnóstico,heap8192/incrementalfalse |
| Identidade/publicação +diff-check08852..6f | 74031/dade9b | EXIT0 |

As mesmas sessões foram acompanhadas até saída terminal. Isso não é globalERP, execuçãoDEV74/711 ou uma soma de execuções repetidas. O avisoVite existente não foi erro. Comandos (`node` = executável local fornecido pelo ROOT):

```powershell
$qaPaths=@(Get-Content -Raw output/inbox-326-6f92-unit-lista-tester.json | ConvertFrom-Json) #24 nomes abaixo
node node_modules/vitest/vitest.mjs run @qaPaths --maxWorkers=2
$qaLint=@(git diff --name-only d775a140b824e56307d50d95d7bb0ad5284a5f6e HEAD -- src) #21SRC listados no manifesto
node node_modules/eslint/bin/eslint.js @qaLint --max-warnings=0
# NODE_OPTIONS=--max-old-space-size=8192 somente shellTSC:
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

ListaUNIT explícita, SHA `4ef6f99722c8d4fe81aa1536b27536efa8503fbf8553b0344fec2d3f7794dab2`:

```text
src/app/(app)/inbox/InboxNovo.foco.test.ts
src/app/(app)/inbox/InboxNovo.interacao.test.ts
src/app/(app)/inbox/InboxNovo.test.ts
src/app/(app)/inbox/PainelContato.test.ts
src/app/(app)/inbox/PainelContato.interacao.test.ts
src/app/(app)/inbox/LinhaCampo.test.ts
src/app/(app)/inbox/abas/GavetaContato.test.ts
src/app/(app)/inbox/abas/form-contato.test.ts
src/app/(app)/inbox/abas/useAbaPainel.test.ts
src/app/(app)/inbox/abas/AbaDetalhes.test.ts
src/components/Drawer.inert.test.ts
src/components/Campo.test.ts
src/lib/dialogo.test.ts
src/lib/dialogo.interacao.test.ts
src/server/crm/campos.test.ts
src/server/inbox/painel-detalhes.test.ts
src/app/botoes.test.ts
src/app/campos.test.ts
src/app/identificacao-registro.test.ts
src/app/feedback-separado.test.ts
src/app/estados-vazios.test.ts
src/components/EstadoVazio.test.ts
src/app/(app)/inbox/InboxNovo.detalhes.test.ts
src/app/enums-rotulos.test.ts
```

Log privadoUNIT `inbox-326-6f92-unit24-tester.log`488B/SHA `a6fc5af78b9c931bd8c8f2061c6721b033c8c4889d70b35b97ba8e1e09da8891`. Recibo `inbox-326-6f92-execucoes-tester.json` SHA `51885c99547b0449d2149fdda5db884ab6d04542bdb823865b71ebf532838349`. Lint/TSC são comprovados pelos terminais, sem inventar log bruto por saída vazia.

## Combinação cache, rascunho e foco

A aquisição é uma única instância useAbaPainel ativa por Detalhes OU editor. O teste de composição conta umGET antes/depois do lápis e compara o mesmo DTO compartilhado. Versão/retry do mesmo contexto conservam DTO/nó/foco;500/rede/JSON após sucesso não viram skeleton/ausência. ID/aba/inativação limpam leitura no render atual e cleanup/identidade impedem respostaobsoleta.403/404 revogam o cache; a análise composta403/404→500 é estática do fluxo, sem atribuir asserção encadeada que a suíte não contém.

Snapshot da Gaveta é da sessão de abertura e não é substituído pelo novo DTO recebido duranteSSE. Os testes reais de Gaveta preservam rascunho/Pessoaesperada, bloqueiam edição/duplicação em curso e ignoramACK de contexto desmontado, incluindo fechamento/reabertura. InboxNovo retira sessão na troca de atendimento; a chave e referências de vida impedem reconciliação de ACK antigo sobre outra sessão nos oráculos executados. A correção de cache não reescreveu esse mecanismo.

As provasSSE/foco no Inbox usam callback de transporte mockado com ReactDOM/casca/abas/hook reais; as provas de rascunho/ACK têm seus cenários próprios na Gaveta. Não afirmo uma única prova nativa end-to-end de todos os eventos combinados. Drawer/inert, resize/foco e RetryFechar foram executados no DOM mínimo: Retry entrega foco ao controle persistente antes de loading e não dispara Save. Não calculam CSS ou timing nativo de browser.

O fallbackWhatsApp usa telefone já autorizado e somente Pessoa:null conhecido na aba comercial; loadingundefined não é ausência legítima. Ficha/edição continuam por capacidade; D13não cria escrita/globalCRM. GuardaHTMLinput.type permanece restrita à expressão nativa direta e folhasnumber/date/text, com os sete negativos ativos. BackendCAS/freshACL/atomicidade/pool1 não mudou.

## Atribuição, negativos e próximos passos

Não repetiINT: meu gate anterior2b43 `46512/58ae7e` foi4arquivos completos/44testes/EXIT0 e o backend/quatro arquivos permanecem idênticos. T não acessou banco nesta rodada e não recebeu leaseDB; restauroROOT3e3048 é informação do integrador, não minha operação. SemDB/HTTP/browser/UI/Save/nota, motor real ou envio externo.

DEV74/711/TSC/lint4 e18harness/guard288 são provasDEV; meu recorte24 é de arquivosAPP/guardas, não os24 casos offline de observador privado. Não atribuo esse observador, sua preparação ou saídasunitárias ao browser. Scripts96c permanecem semdelta na publicação; o teste local de composição não é nova QA visual do harness ou captura.

Histórico Save2588/2bca76 continua EXIT1 por doisGETabortados sem cronologia correlacionada; doisSaves200 pontuais não tornam o agregado verde. Diagnóstico847139,39imagensbec9/a540 e demais negativos permanecem nominais, sem recaptura/reatribuição. Não houve falha própria de teste nesta composição. Pareceres2b43,08852 eR1fd1 foram preservados integralmente.

Nova provaSave máxima1 continua dependente de helper/bridge/executor concretos, auditoria de todosSTARTs/fases/respostas/body/hash/finalização e GO explícitoROOT. Aprovar este código/publicaçãofiel não autoriza escrita nem comprova rollbackexterno/timingReact/Save nativo. Formal/visual, regressão global integrada, CI e homologação permanecempendentes sob coordenaçãoROOT.
