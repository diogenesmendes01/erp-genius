# #319 — composição, gates e validação visual concluídos; publicação pendente

## Estado atual em 23/10, após 08:39 UTC

Composição final ROOT `b8edd5d39298dac617f65060098f6a5d66786159`: merge de
403 moderno `741f595e1f9f32cd3511cbba6808bcd005e1c9c8` sobre319 `4fade899`.
Somente o quadro documental teve conflito, resolvido preservando as duas
frentes. Verificação432b87 saiu0: scripts/visual idênticos a4fade; compositor,
coordenador de rascunhos e teste React C3 idênticos a741/f896.

Gates ROOT observados até término, Node22.23.2 e executáveis locais:

- Global unitário36316, saída0 confirmada3bed4e:903arquivos/7.101testes,
  272,01s,maxWorkers2, sem filtros de nome ou skips adicionais. Log privado
  output/inbox-319-b8-global-unit.log. Testes de integração ficam excluídos
  pela configuração unitária; não se trata de suíte de banco.
- Next typegen seguido de TSC heap8192/--noEmit/--pretty false,15978 saída0.
- Lint global92079, saída0 confirmada94f379:0erros/42avisos locais, sendo
  40 herdados emsrc e2 em staging privado318. Regras e limiteCI40 intactos;
  isso não substitui o gate do checkout CI rastreado.

TESTER aprovou C3f896 em62testes própriosd60052 e a composição403741 em
85testes63aaeb; não executou este global ROOT. Pareceres específicos em
output/pr403-qa/tester-c3-f896.md e
output/pr403-qa/tester-composicao-741.md, herdados do PR403.

DEV B concluiu a matriz normal319 em4fade:42PNG formais3127 e12mobile22954,
ambos saída0,54imagens inspecionadas e com hashes na allowlist explícita.
As imagens do vazio a320×500 mostram acesso após rolagem local real, sem
deslocamento do documento; não alegam cabimento inicial de todo o painel.
Negativos51674/85691 permanecem excluídos integralmente. TESTER aprovou o
harness4fade em36testes próprios92623a; zeroGET da thread em um estado de
painel é N/A previsto, não prova de recuperação200.

O head documental176903280c3007c3b839735a16090f408419b016 integrou403
publicada68e95d8e, preservando executáveis de b8 (dae829/13e189, saída0).
TESTER confirmou a composição em13arquivos/212testes,137c14 saída0, e
identidade executável1769 por06f378. Parecer próprio específico acompanha
as provas históricas5e9 e o harness4fade, sem reatribuir o global ROOT.

DEV B concluiu também longa56958 (6contextos/30PNG), corrida66806
(6contextos/12PNG) e Triagem66205 (6contextos/6PNG), todos saída0,
imagens inspecionadas e allowlists explícitas:102PNG DEV no total. A corrida
usou GETs200 nativos sob CDP/finished/body; resposta tardia de A não troca B.
A janela móvel de61px limita a visibilidade simultânea de nota/alerta;
Tab real alcança retry. Não se afirma cabimento inicial de todo o conteúdo.
Negativos10159/92223/83659 e preflights ficam inteiramente fora do pacote.

TESTER executou Triagem INDEPENDENTE na composição1769:726635 saída0,
6contextos/6PNG inspecionadas, hashes67c88e conferidos. Documento200 real,
triagem1 acima do vazio em1440/1024;320×500 mantém lista e oculta centro.
Nenhum submit/POST, externo, erro React ou pageerror; SSE máximo1.
Essa prova atual é separada das32PNG históricas5e9, que têm limite explícito
de não comprovar o loading visual. Total previsto do pacote:140PNG.

Todos os browsers e previews B/TESTER foram encerrados. ROOT restaurou
integralmente424tabelas/hashes originais em ambos os bancos: B4f3b20 saída0
(1.372linhas) e TESTER322fb1 saída0 (1.386linhas). Nenhum dado privado desta
fase permanece nas fixtures. Fontes visuais4fade/5e9/1769 e testes C3 são
declarados separadamente; nenhum envio ou integração externa foi ativado.
Pacote positivo remoto confirmado: inbox-319-evidencias-b8.zip,149arquivos/
140PNG/12.106.367bytes, SHA0972487e1b482aaf5058dff7482585b2404bd09751be7de9c90503f1a37b68c5.
Packer4dcaa4, upload92c045 e download/SHA17c576 terminaram0; release5fbb67
permaneceDRAFT. Metadados em output/inbox-319-evidencias-remotas.json.
O ZIP preserva o relatório de regressão do checkpoint anterior ao upload;
este registro Git posterior documenta o roundtrip sem alterar o arquivo selado.
TESTER auditou independentemente o ZIP LOCAL, e4b75e saída0:149entradas,
140PNG+8MD+manifesto,148/148tamanhos/SHA, cinco allowlists/fontes e sidecar
conferidos, sem extras, duplicatas, traversal ou arquivos proibidos. Parecer
output/inbox-319-pacote-review-tester.md. O roundtrip remoto17c576 foi do
integrador, sem atribuição ao TESTER. CI, revisão GitHub e merge319 seguem
como gates separados após a abertura do PR individual.

## Histórico 4fade — anterior à composição b8 e aos gates acima

ROOT está em `4fade8995573d1a9abaa343e9fa25295506f0cbf`, após avanço direto
de `afd08c1aca5e08d5715836ce50e1f72d2562d3eb`. O último delta altera somente
sete arquivos de harness, testes e documentação. DEV B verificou 15 arquivos/
260 testes (40409), TSC (21486) e lint dirigido (39df56), todos com saída 0.
O contrato de falha500 controlada exige requisições realmente injetadas,
resposta posterior500 observada e estado público revalidado, sem afirmar
consumo do corpo que o aplicativo rejeita ao verificar HTTP !ok. A barreira
de conclusão200 e o classificador global permanecem inalterados.

O global ROOT anterior, fonte afd08, terminou com saída 0: executor7442,
902 arquivos/7.091 testes,246,40s,maxWorkers2, sem filtros ou skips adicionais.
Typegen/TSC36230 e lint30533 também terminaram0, lint com42avisos locais
(40 herdados e2 em probes privados). Esses gates não são atribuídos a4fade
nem ao novo ajuste C3 em desenvolvimento no worktree A.

Preview DEV B3111 ativo em4fade, executor35413, banco descartável original
conferido18eac1 (424 hashes/1.372 linhas,3mensagens/1nota canônicas), provedores
externos vazios. Preflight84121 terminou0 nos três estados restantes:
thread-erro/painel-vazio/lista-vazia. O DEV iniciou nova matriz42+12; ainda
não há aprovação dessa matriz. Rodadas84095/96724/88639 e demais negativos
permanecem excluídos integralmente das evidências positivas.

TESTER já entregou32PNG positivas ERP na fonte5e9, com limites explícitos em
output/inbox-319-5e9-browser-review-tester.md: não comprova o loading visual.
Seu banco foi restaurado e o preview3109 está parado. A correção C3 residual
de #317 (A→B→A sem edição antes do OK) está sendo implementada separadamente;
PR403 remoto32f continua congelado. Publicação319 aguarda validação visual,
nova composição coordenada com403 e gates finais. Não há PR319 ainda.

## Histórico abaixo — estados de execução não representam o estado atual

Fonte executável5e9aa0a92f6e7ad9f98d0614069ff6458f45f067, DEV B físico,
Node22.23.2. ROOT incorporou PR403/#317 por merge normal d88bddc9; conflito
somente documental no quadro, ambas as evidências preservadas. Conferência
b98709 exit0: src/scripts/prisma/package/lock/.gitattributes idênticos a5e9.

- Unidade global integrador51152: terminal exit0,899arquivos/7.054testes,
  269,26s,maxWorkers2, sem filtro de nome ou skips adicionais. Log privado
  no worktree B output/inbox-319-5e9-global-unit.log.
- Next typegen seguido de TSC --noEmit --pretty false,heap8192,80400 exit0.
- ESLint global51601 exit0,0erros/55avisos:40nas fontes herdadas e15nos probes
  privados não versionados do worktree B. O script lint é eslint .; não houve
  alteração de regra/detector/limite. CI no checkout rastreado é gate separado.
- DEV C6 recorte15393 exit0,63arquivos/577testes; TESTER5e9 recorte próprio
  617f17 exit0,16arquivos/257testes. SSE fonte/testes iguais01a; C2 igual7a;
  CLI LF/zeroCRLF. Parecer output/inbox-319-5e9-static-plan-tester.md.

Limite atual: primeira rodada formal84095 terminou exit1 após semseleção6/6;
estado carregando não satisfez semanticaEstado319Pronto em30s, antes da captura.
Rodada completa ainda não aprovada. DEV investiga fallback/medidas/timing com
DOM real, sem fabricar HTML/RSC ou respostas200. Não atribuir seis imagens
parciais à matriz formal42+12mobile completa. Negativos preservados privados.

Previews atualmente autorizados em bancos exclusivos: DEV B3111,fonte5e9,
banco original1372; TESTER3109,mesma fonte,424hashes originais1386 preservados
mais150mensagens/1nota privadas de teste. Nenhuma integração externa. Browsers
e preview devem parar antes de restaurar snapshots ou iniciar nova fase.
QA browser/inspeção/matriz/pacote/publicação/CI/merge ainda pendentes.

## Diagnóstico causal da captura de carregamento

DEV executou o helper real em dois contextos, mudando somente waitUntil da
navegação anterior para Home. Executor64168 terminou0 e encerrou os browsers.
Com domcontentloaded, readyStateinteractive e GET RSC200, nenhum fallback foi
observado; URL continuouHome e o Next avisou atualização antes da montagem.
Com load, readyStatecomplete, mesmo GET RSC200 e latência3000ms, o fallback
real foi observado: um anúncio/um título, rect x224/y0/w1216/h900, sem falhas.
Não houve conteúdo HTML/RSC/API200 fabricado. ROOT autorizou ajuste mínimo do
preparador após parar o preview94575; snapshotB restaurado812dc3 exit0,
424tabelas/hashes,1372originais e thread canônica3mensagens/1nota.

O patch ainda precisa TDD/recorte/TSC/lint, novoReady e nova rodada formal;
não reatribuir a unidade global5e9 ao preparador ainda não congelado. O status
500exato do harness formal é preservado; o TESTER usa503exato em probe próprio
e remove a interceptação antes do retry real200, sem route.fetch/fulfill200.
