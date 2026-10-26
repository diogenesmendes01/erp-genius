# QA da correção de lock do cancelamento333 — rodada27

Este relatório é exclusivo da correção PR443 → dependência362. Não substitui o relatório histórico da candidata333 nem a QA da implementação362. A fonte DEV parte do HEAD `b76c94e543ba7c25be2f13bddbe53ee337292548`; o candidato público exato da443 ainda será preparado pelo ROOT e testado independentemente no banco TESTER sem502.

A mudança produtiva é uma linha em `agendadas-cancelamento.ts`: lock do atendimento de `FOR NO KEY UPDATE` para `FOR SHARE`. Fonte anterior SHA256 `ca4a2b0725f3b59bd67f39d41f1398531389a3e36cdd92381f27e94d47d42107`; corrigida `35cbb13c61d07f02ed2bb1473c914a206acb0101435d788742e9984d731a1de2`. A inversa reconstrói o arquivo anterior inteiro, confirmado também por revisão FS do TESTER contra a fonte pública443. Não houve mudança de permissão, políticaGP, Assumir, schema, gatilhos264/265,501/502, timeout ou retry.

## Prova causal e correção

O arquivo próprio `agendadas-cancelamento-claim362.int.test.ts` é autocontido e usa `cenarioPerda328`, já disponível na443; não importa módulos362 nem fixture340/499. O vendedor possui `tarefas.ver`, autoria da intenção HUMANO/PENDENTE e leitura do atendimento, que permanece sem responsável. Holder trava a intenção; worker333 real captura seu PID e espera nela depois do pai; holder atualiza para `ENVIANDO`.

No RED `8a9591 EXIT1`, worker480592 e holder481036 formaram bloqueio recíproco aos33ms, observado pelo PID480268. Holder foi vítima `40P01`; após rollback do claim não confirmado, o cancelamento prosseguiu. Isso prova o ciclo de locks, não sobrescrita de claim confirmado. Artefato SHA256 `b95d866c362741f9f5229919da2d74e8431761e4315f99d3135b34d0a8aac190`; recibo `c090d59748abbefa65ffb0fa2b4ec3b2a006fde19daa1338b99c08b6ea7ea030`.

No GREEN do mesmo arquivo SHA256 `15c849d7a01cb4c91ac24c27b438d5c7936449073ae5b05daa920b3c41bb9691`, terminal `600a31 EXIT0`,1/1,4,84s: holder501084 confirmou o claim; worker500308 recusou com `ErroRegra` exata “A mensagem já foi despachada ou não pode mais ser cancelada.”, code/sqlState nulos, intenção `ENVIANDO` e zero Evento de cancelamento. Observer501120, cleanupfulfilled. Artefato `e9e4b9615c02f1f0c033ff3dff1c46e1ab2cf70f9aa9e59d5333945feddc6f15`; recibo `f5e034c414219e71172fe9d03060fc7fd31dbf80c4b8eb006f7877a4feb012eb`.

## Regressões e baseline de rollback

| Recorte completo | Executor/sessão → terminal | Resultado |
|---|---|---|
| Política pura333 | `78d640` | EXIT0,10/10 |
| Lint produção/claim1 | `ae6c4f` | EXIT0,sem avisos |
| Suíte333 anterior à adaptação do setup | `b97a33`/58241 → `264ad9` | EXIT1,19/20; único erro esperava1 aviso e recebeu2 no casoNOTIFY |
| Lint casoNOTIFY adaptado | `a142b4` | EXIT0,sem avisos |
| TSC final original8192 | `98fa84`/66378 → `2a5609` | EXIT0,noEmit/incrementalfalse |
| Suíte333 com baseline medida | `13fc4c`/65724 → `00ed68` | EXIT0,20/20,77,57s |
| KEY SHARE | `fdefde` | EXIT0,1/1,5,46s |
| LISTEN7 original | `da1727`/95116 → `0aa2d9` | EXIT0,7/7,29,56s |
| Genérico11 original | `f77403`/2274 → `95935c` | EXIT0,11/11,45,57s |

A única adaptação da suíte existente foi no casoNOTIFY32 e nos imports de artefato numérico. Cancel1/replay1 permanecem fixos. Após o rawUPDATE de setup paraPENDENTE, o listener é drenado e a baseline é capturada; depois do rollback, o delta precisa ser zero. Outros casos permanecem literais, por comparação FS com normalização apenas de EOL/EOF.

A medição real no A502 foi **avisos2 →2,delta0; Eventos1 →1,delta0; statusPENDENTE**. Não se presumiu a baseline2 no teste. Artefato numérico `7b4bdb35c271f35cfe6421a974a2997330ac4517a404b2ff96870fa23c7489c4`; recibo conjunto da suíte20/KEYSHARE `08f9fb15a16bbc19c28f93ee0642eafb105bffb0198841e8fd338ff1f1cfe835`. KEYSHARE confirmou commit/statusCANCELADA/Evento1 antes da liberação do holder530224,sem tentativa observada de upgrade do pai.

LISTEN7 e genérico11 permaneceram byteiguais (`e943e7c0...` e `3e2344a6...`). Dezessete artefatos reais foram preservados byte a byte no diretório privadooutput; recibo de compatibilidade `2bd90e934fc8808ed377cf117ef73c2c9460a68b2174859fc8ea572533a7db02`. Mantiveram cancel333 com um aviso, replay/rollback zero, wire compacto e OLD/NEW,sem mudança produtiva da362.

## Fonte e limites

Produção333 SHA35cbb13c; claim1 SHA15c849d7; suíte333 adaptada SHA2564f751bf8bae58cbd60ca232f7bcc6f5e5117c02187e0c941dbd76340aab11. Fixture328 e políticas333/CRM permanecem originais. O teste novo e os imports Node de evidência numérica não exigem helpers340/499/362; o nome do arquivo identifica a coordenação da contraprova, não dependência de implementação.

Todos os nativos acima são nominais ao DEV A502:500migrações,427tabelas,566linhas baseline. Configuração original de integração, perfildev-email/clienteDF,UTC,sete provedores vazios,Hermes1024,umworker/sem arquivos paralelos,sem filtros/skips/retries. Não são integração global, prova fim a fim de dispatcher/provider ou garantia global contra deadlocks. Os dois avisos medidos no setup são um fato pós502; a baseline pré502 ainda não foi medida nesta rodada.

O ROOT restaurou d89470 EXIT0 após as últimas regressões. O restaurador exclusivo éROOT/output/preservar-banco-devemail-a502-r27-private.mjs; nenhum restauro ouDDL foi executado pelo DEV. QA independente no exato candidato público443/T500 sem502, incluindo baseline pré502 e claim estrito, permanece pendente. GP cancel semtarefas.ver aguarda decisão humana. Sem commit/publicação presumidos por este relatório.
