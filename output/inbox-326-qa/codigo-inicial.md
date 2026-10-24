# QA independente #326 — código congelado 2b43

Parecer favorável à fonte estática e aos recortes próprios executados em `2b43b38fc7928bb11555949ea769080459570635`, árvore `81759fa8e8fd10dbc3da358442f12d0834ff74f0`. Nenhum bloqueador de código encontrado nesta revisão. Visual/nova prova de Save, composição final sobre main, CI, publicação e homologação permanecem pendentes. Não atribuo fotos bec9/a540 ao novo freeze.

## Preflight e escopo exato

Worktree exclusivo TESTER, checkout detached feito sem reset/limpeza alheia. Executor `a3e6a9` EXIT0 preservou os1.045 privados anteriores por hash e inventariou1.578 arquivos output totais, incluindo ignored. HEAD permaneceu congelado/tracked limpo até todos os terminais; conferência final `fae352` EXIT0 preservou os1.578 hashes. Perfil `integracao`, schema487 OID `1f575691cde242124c1493b8406121e8830a6f7e`, cliente físico SHA `e24658b28818cf2bd124071f3ea41c7682b03581de9bb27a1ea122388e297200`.

ROOT READY `dbaf7c` EXIT0 confirmou Nexttypegen próprio após checkout/client/perfil e lease exclusiva de `erp_genius_test`, local54329, snapshot494 restaurado0ad146 sem uso posterior. Só iniciei gates após READY. B executou em ciint distinto; ROOT não ocupou este banco. Nenhum Prisma/generate/install/DDL/cluster/HTTP manual/browser/UI/Save/nota/envio pelo TESTER. O globalSetup padrão da configuração integration pode validar status de migração em leitura; não apliquei migração.

Diff contra pai `d775a140b824e56307d50d95d7bb0ad5284a5f6e`:20 paths=17SRC/testes+3MD. Sem delta de schema/SQL/deps/harness/workflows. Hook/teste já presentes na325 permanecem blobs originais09498. Painel/Gaveta/form, núcleosCRM e actions/testesINT selecionados conservam as fontes09498/bec9; InboxNovo e seus dois testes são composição com325. Manifesto `inbox-326-2b43-fontes-tester.json` registra17 blobs/hashLF,16 identidades selecionadas e8 preservações325/336/C5; sessão11323/`ac0bf2` EXIT0, SHA `be17c1a5ddf3618850546dd7a230ff8194d7a2afb27205ac738f0b77465c3b0a`. Não afirmo diretórios inteiros iguais ao freeze antigo, cuja base é diferente.

## Gates próprios até saída terminal

Node22.23.2 local/Vitest4.1.11 e dependências fornecidas pelo integrador. Configuração unitária exclui *.int.test.ts. Nenhum filtro por nome ou skip imposto. Os dois recortes são completos para os arquivos listados, não globais do ERP.

| Gate | Sessão/inicial → terminal | Resultado |
| --- | --- | --- |
| UNIT22 arquivos completos | 20161/128611 → f35999 | EXIT0,504 testes,32,49s,maxWorkers2 |
| INT4 arquivos completos | 46512/80b16a → 58ae7e | EXIT0,44 testes,190,65s,maxWorkers1 |
| TypeScript | 79516/e76ef9 → 70f11d | EXIT0,sem diagnóstico |
| ESLint17 paths reais do diff | 3f325e | EXIT0,zero avisos,teto0 |
| diff-check d775..HEAD | a8c8e9 | EXIT0 |

A mesma sessão46512 foi acompanhada até terminal, incluindo períodos sem log; silêncio não foi tratado como aprovação. Banco liberado ao ROOT somente após58ae7e. Restauro posterior é responsabilidade ROOT e não foi presumido ou executado por mim.

Comandos, com `node` representando `C:/Users/Mendes/AppData/Local/hermes/node/node.exe`:

```powershell
node node_modules/vitest/vitest.mjs run 'src/app/(app)/inbox/InboxNovo.foco.test.ts' 'src/app/(app)/inbox/InboxNovo.interacao.test.ts' 'src/app/(app)/inbox/InboxNovo.test.ts' 'src/app/(app)/inbox/PainelContato.test.ts' 'src/app/(app)/inbox/PainelContato.interacao.test.ts' 'src/app/(app)/inbox/LinhaCampo.test.ts' 'src/app/(app)/inbox/abas/GavetaContato.test.ts' 'src/app/(app)/inbox/abas/form-contato.test.ts' 'src/app/(app)/inbox/abas/useAbaPainel.test.ts' 'src/app/(app)/inbox/abas/AbaDetalhes.test.ts' src/components/Drawer.inert.test.ts src/components/Campo.test.ts src/lib/dialogo.test.ts src/lib/dialogo.interacao.test.ts src/server/crm/campos.test.ts src/server/inbox/painel-detalhes.test.ts src/app/botoes.test.ts src/app/campos.test.ts src/app/identificacao-registro.test.ts src/app/feedback-separado.test.ts src/app/estados-vazios.test.ts src/components/EstadoVazio.test.ts --maxWorkers=2
node node_modules/vitest/vitest.mjs run -c vitest.integration.config.ts src/server/inbox/acoes-painel-contato.int.test.ts src/server/inbox/acoes-painel-contato-pool1.int.test.ts src/server/crm/ficha-contato.int.test.ts src/server/crm/campos.int.test.ts --maxWorkers=1
# NODE_OPTIONS=--max-old-space-size=8192, somente nesta shell:
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
# qaPaths =17 TS/TSX reais de git diff --name-only d775 HEAD:
node node_modules/eslint/bin/eslint.js @qaPaths --max-warnings=0
```

Os17 paths de lint estão enumerados no manifesto de fontes. Logs privados UNIT/INT: `inbox-326-2b43-unit-tester.log`488B/SHA `23770ac0c5ccd63684e35b176e6e5587b11f0bae0f5f1ede4d973d2997861edf`; `inbox-326-2b43-int-tester.log`812B/SHA `9905270083c6a113def1e9591db2b90fd10a3a32bb66f77c0cb42afc197b2e94`. Avisos existentes Vite/config mixed exports não foram erros de teste. TSC/lint sem stdout não produziram arquivo Tee: seus terminais0 são a prova, registrada no recibo `inbox-326-2b43-execucoes-tester.json`, SHA `b6f1336e5b1e5a425596e157dc6eadf75221c2388544a0161aeb58294106749d`.

## Fonte e oráculos revisados

A composição mantém uma instância de useAbaPainel, ativa por Detalhes OU editor; abrir o lápis não dispara outra aquisição e painel/editor compartilham o mesmo DTO. O teste de interação325+326 conta um GET antes/depois do lápis e verifica identidade do objeto. AbaDetalhes/B2B, subtítulo/avatar, hrefs336, campos/DTO e guardas953 permanecem preservados. Não inclui editor de Empresa, abas327/328 ou CPF/nascimento340.

Gate do lápis exige contextoCOMERCIAL, Pessoa resolvida, capacidade editarContato e ações disponíveis. Convite D13 não cria escrita nem acesso global; verContato controla ficha.404 retira novos controles/editor, sem promover snapshot de leitura a permissão. Troca de atendimento fecha a edição e cria sessão nova. Hook conserva abort/identidade/chave/StrictMode e SSR neutro.

Drawer é o único modal enquanto editor aberto; PainelContato mantém montagem e cede sobreposição. Foco2de9 só recupera para lápis/gatilho/região visíveis quando o foco atual não é utilizável. Retrybec9 foca Fechar persistente antes de recarregar; o teste real mantém esse foco no loading e na chegada do formulário, sem submit. Drawer.inert/diálogo/Inbox/foco exercitam posse modal e resize no DOM mínimo. Não calculam CSS/geometria nem substituem browser nativo.

Form preserva seis básicos/cinco tipos, normaliza opcionais emnull, nome/email e espaços como domínio, mantém0/false, envia só campos da leitura e somente o diff. NUMERO usa stepany; teste envia2.75 sem arredondar. Snapshot/draft ficam estáveis sob SSE/erro; inputs e duplicação são bloqueados durante ação. ACK de sessão desmontada não fecha/reconcilia a sessão nova; testes cobrem outro atendimento, fechamento/reabertura e snapshotSSE.

Servidor resolve Pessoa do atendimento autorizado; pessoaIdEsperada é CAS obrigatório, nunca alvoWHERE. Revalida atorativo/papéis/permissões/contexto/Pessoa/lead após locks pela mesmaTX. Todos os campos são validados antes das escritas; só alvoPESSOA, sem IDs duplicados/Empresa/telefone arbitrários. Núcleos internosCRM mantêm fachadas atuais e sameTX Pessoa+campos+Eventos+aviso. INT observa atualização e repetição sem novosEventos/avisos, email redigido, segundo campo inválido sem escrita parcial, D13leitor sem edição, identidade antiga/ausente, quatro corridas reais com outra conexão e pool1 sem acesso global dentro da transação. Rollback após aviso é verificado por sentinelaLISTEN posterior e ausência deNOTIFY do atendimento revertido, além de dados/Eventos restaurados.

As quatro INT incluem regressõesCRM ficha/campos e não incluem perda328, poolperda, experimental-perda-idempotencia ou comercial/leads. Não fecham328 nem validam todas as ações do ERP. Não somei testes repetidos ou gates antigos/DEV como casos próprios novos.

## Negativos e limites para o próximo aceite

DEV `58097/0154ce` EXIT1 por IconMail ausente no mock antigo permanece nominalDEV; o mock adaptado renderiza AbaDetalhes325 sem enfraquecer guarda. Mutação dirigida `9b2bc8`/filtro tem seu próprio limite e não é minha suíte completa. Nesta QA não houve falha de produto. Leitura administrativa `03bb45` tentou consultar logs TeeTSC/lint que não existiam por saída vazia e gerou FileNotFound; isso foi corrigido no recibo separado, sem fabricar arquivos brutos ou chamar a leitura administrativa de gate aprovado.

Histórico Save2588/2bca76 continua EXIT1: duas persistências200 e asserts pontuais favoráveis não dão cronologia aos dois GETabortados. Não há falha de persistência demonstrada, mas falta evidência para considerar benignos aqueles eventos específicos. Diagnóstico847139, revogação10b6a0 e POST503 interceptado são provas separadas, sem correlação retroativa. As39 imagens antigas/27positivos continuam bec9/a540. Nenhum novo Save, probe, captura, inspeção de imagens326 atuais ou aceite funcional de protótipo foi executado nesta rodada.

Plano anterior `inbox-326-proximo-freeze-plano-tester.md` continua aplicável: eventual novo Save máximo1 requer aval concreto ROOT e cronologia START→settled/failure/body/hash/fase/identidade, incluindo novosSTARTs durante await, fechamento/selo e falhas tardias. Prova de resposta.finished+doisRAF não deve ser chamada de commitReact. Futuro parecer visual deve inspecionar originais do freeze e separar comportamento observado, limites e negativos. Esta aprovação de código não é autorização UI nem homologação plena.
