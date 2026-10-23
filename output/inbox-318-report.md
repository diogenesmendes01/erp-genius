# Relatório DEV A — #318, checkpoint exclusivo

Base243c9348454b6cca5795a6afa747efa25ed3eef1; branch codex/inbox-e1-318. Investigação GitHub/Task13 em output/inbox-318-investigacao.md aprovada pelo integrador antes de implementar. SPEC docs/specs/inbox-painel-contato-abas.md. Fonte314 permanece na ref congelada. Sem alteração de InboxNovo/ConversaAberta/dialogo/BotaoIcone/harness/quadro. Nenhuma instalação/package/lock/schema/migration/envio/PR/push ou preview.

## Escopo implementado

PainelContato aditivo, fallback308 e uma montagem/foco/inert/Escape/cleanup preservados; cabeçalho132/nome/tags, uma rolagem local, único fechar/ref. ABAS_ENTREGUES só Detalhes, abas controladas com teclado/ARIA e contagem mono. LinhaCampo puro; PainelSetor sem padding externo. Tags mínimas e ordenadas apenas após pessoa comercial autorizada/não legal; marca pela associação sem autor, sem nova regra de ativo. Quatro registros específicos de guardas autorizados depois, sem alterar algoritmos ou registros alheios.

## TDD e execuções observadas — Node22.23.2

- RED6d16db exit1:14 novos falharam,8 antigos verdes e módulo LinhaCampo ausente. Cabeçalho/abas/tags não existiam; unidade server prova que tags faltavam e não relaxa guarda.
- Primeiro GREEN parcial c35c64 exit1:29 passaram/1 antiga asserção de dt literal falhou porque o novo tamanho12,5 foi acrescentado. Atualizada a asserção para manter a mesma cor text-gray-600 e incluir tamanho exigido, sem afrouxar contraste.
- REDf94d04 exit1: teclado de abas falhou,8 interações de casca passaram. GREEN955a98 exit0:5 arquivos33 testes, incluindo9 interações reais ReactDOM e9 unidades de tags. Lint dos10 arquivos afetados da mesma chamada terminou0/0avisos. DOM mínimo não implementa SVG: mock local de três ícones decorativos, nenhum utilitário global alterado.
- TSCheap8192 e recorte77973/499cc8 exit0:29 arquivos316 testes, todos os testes unitários da pasta Inbox + Avatar.test.ts + paineis-tags.test.ts, maxWorkers2, sem ignorados. Não é global.
- Antes de executar DB, identificado beforeEach truncarBanco no arquivo autorizado. Integrador fez snapshot completo em schema privado fora de public,424 tabelas/551 registros e roundtrip com hashes424/424. Só após confirmação foi usada a janela dev-email; perfil fixo conferido, sem outro banco/servidor/suíteDB.
- Integração19403/5e7b32 exit1:11/12 passaram. Fixture nova financeira sem matrícula explícita foi rejeitada pelo trigger existente. Corrigida a fixture com seedCobranca já importado e vínculo aluno/matrícula; nenhum domínio/trigger alterado.
- Integração final52198/5de25e EXIT0:1 arquivo12 testes, vitest.integration.config.ts, src/server/inbox/paineis.int.test.ts, maxWorkers1, perfildev-email; nenhum ignorado. Cobre novas tags ordenadas/sem autor/inativa já vinculada, outra carteira/linha, responsável legal, outro setor e convite revogado, além dos nove casos antigos. Exatamente esse arquivo foi executado; não paineis-envio ou outra suíte DB. Banco liberado e integrador informou restauração a33eba exit0,424 assinaturas idênticas,307/314 normal9mensagens4notas preservada.
- TSCheap8192+lint afetados37893/9016c0 exit0 após correção da fixture. Guardas a7bdd8 exit1:4 registros ainda ausentes/95 testes verdes (7 arquivos99testes): aba1, key a.id, aria-selected e tag1 em superfície. Integrador autorizou somente esses quatro registros; nenhum algoritmo/regex/limite geral ou componente alheio mudou.

Gates finais após os quatro registros autorizados:80530/fe07f5 EXIT0,36 arquivos415 testes (pasta Inbox+Avatar+paineis-tags e sete guardas listadas), maxWorkers2, sem ignorados; TSCheap8192+lint dirigido1172/8fa94a EXIT0/0avisos. Node22.23.2. Fonte sem mudança após esses gates, só documentação. Não é full global.

## Pendências

Integração com composição do Inbox/triagem/estado da aba após handoff313; BotaoIcone real36/rótulo responsivo, preservando um fechar e a ref; normalização de padding/divisórias de filhos sem perder aprovação Aria/ações/opt-out; CLI painel-detalhes + estados atuais, esperas/hidratação/anonDOM392, capturas app×protótipo e provas de altura500/nomes/tags longas/resize/foco. Sem teste real de geometria ainda. TESTER e global coordenado pendentes. Quadro global reservado ao integrador, não editado nesta fase. Não chamar checkpoint parcial de funcionalidade pronta.

Checkpoint exclusivo será integrado à fonte313585753da por autorização do integrador. Composição ainda exige liberação posterior; scripts/visual permanecem comB durante formal313. Banco dev-email restaurado pelo integrador, nenhuma nova suíteDB/preview permitida neste intervalo.

## Checkpoint e integração de contratos313

Checkpoint exclusivo64e67072f17efdbf8e781798eb7b07adaab4cd02. Merge313585753da concluído em9292dcbc58497461a13a78bb246b3033bcbc0081; nenhum conflito produtivo. Conflitos só em inserções adjacentes dos registros de guardas; preservadas todas as entradas313 e quatro318, nenhum algoritmo alterado. Contrato real BotaoIcone aceita rotulo/ref/tamanho36; ainda não consumido pela casca318 neste checkpoint. Harness313 foi apenas recebido pelo merge e permanece exclusivo doB durante captura, sem edição autoral318.

Após merge: Node22.23.2,92538/704135 EXIT0,45 arquivos448 testes, pastaInbox+Avatar/BotaoIcone/dialogo-retorno+paineis-tags+sete guardas; sem ignorados/maxWorkers2. TSCheap8192 82958/cc7763 EXIT0; lint dirigido9906b1 EXIT0/0avisos. Sem nova suíteDB ou preview. Integração12/12 refere-se ao checkpoint64 com paineis/teste inalterados no merge; não foi repetida na base9292 após restauração do banco. Não é full global.

Composição de InboxNovo/ConversaAberta e consumo doBotaoIcone real aguardam a liberação posterior anunciada pelo integrador. scripts/visual continuam reservados aoB, assim como sua captura3111/DB, que não foram tocados. Fonte combinada sem alteração depois desses gates; apenas esta anotação.


## Composição autorizada sobre4f1c2049 — checkpoint parcial

InboxNovo/ConversaAberta liberados pelo integrador apenas para painel/dados/abas/triagem, preservando abrir()/NovaConversa para fix313 separado. Montados contato/tags guardados por seleção, abasDoPainel/Detalhes com estado associado ao atendimento e callback que recusa abas não entregues. Telefone somente quando recebido; ordem WhatsApp→setor→Aria→ações→opt-out(não grupo)→triagem/revisões. Triagem não duplica na thread; ponte sem seleção mantida. Wrappers locais normalizam padding/bordas sem editar regras dos blocos. Uma instância PainelContato, mesmo ciclo308 e controle/ref382. BotaoIcone36 REAL313 consumido sem alterar compartilhado/helper: wrapper absoluto e rótulos responsivos aria-labelledby. Nome acessível computado/geometria ainda não provados no browser.

Node22.23.2: RED inicial dbfe2c exit1,5falhas/62verdes; duas expectativas corrigidas antes da implementação (classe36 real e triagem vazia significa ausência). RED correto d71627 exit1,4arquivos94testes,5falhas/89verdes; novo teste de remoção da triagem confirma a duplicata antiga. GREEN e0e7b0 EXIT0,5arquivos103testes incluindo9interaçõesReactDOM da casca. Lint7afetados d87994 EXIT0/0avisos; TSCheap8192 sessão68740/chunk3cb56b EXIT0.

Recorte amplo sessão71542/c69f92 exit1:41arquivos495testes,493verdes/2falhas. Mock SVG de InboxNovo.foco.test.ts não exportava Phone/ChevronLeft usados pelo novo cabeçalho; adicionadas apenas essas duas exportações decorativas locais. Outra falha herdada: confirmacoes.test.ts:582 rejeita todo caminho .test., mas helper313 dialogo-retorno.test.fixture.tsx continua corretamente varrido por ehFonteVarrida. Integrador coordena renome noB, sem mudar algoritmo/asserção/whitelist; não houve edição dessa guarda/fixture noA.

Após mock: sessão15776/chunk3a18c3 EXIT0,44arquivos463testes. Filtros reais: pasta src/app/(app)/inbox, Avatar.test.ts, BotaoIcone.test.ts, dialogo-retorno.test.ts, paineis-tags.test.ts e guardas botoes/fundo-sobre-pagina/contraste/contraste-elementos/design-system/responsivo/dialogos. maxWorkers2, sem ignorados nesses filtros. A guarda confirmacoes não integra esse segundo comando e permanece explicitamente pendente do renome313. Não é full global. No comando anterior foram também passados filtros sem arquivo src/app/alternancias.test.ts e src/app/sem-polling.test.ts; a guarda Inbox sem-polling real foi coberta pela pasta Inbox, sem criar arquivos ou mudar configuração.

Sem DB/preview/ações/harness/quadro nesta fase. Integração12/12 continua histórica sobre64 (serverpaineis inalterado). Próximo: checkpoint limpo, merge normal359a23fd (P2Novo), depois renome de fixture313; repetir recorte/TSC/lint na fonte combinada e coordenar janela visual. Não há conclusão presumida.
