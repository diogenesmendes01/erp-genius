# #311 — ledger DEV B

Base103a507d8a8fda7a6758a4eee46177d4c3ce7a67; branchcodex/inbox-e1-311. Task6/índice aprovados, corpo lido no root. Ownership: servidor/API/sharedSSE/store/selo/navegação/layoutcount/demo; InboxNovo sófinally da leitura. Casca e CLI visual principal pertencem ao DEV A308.

Ruling: trigger20261017100000 já publica mensagem.nova ao INSERT pós-commit; --entrada não emitirá NOTIFY manual. Store não terá singleton no servidor nem fetch em render. Transporte mantém reconexão nativa/EventSource e API anterior por compatibilidade.

## Fonte e contratos

Implementação no worktree B apenas, Node22.23.2 local. Base103a507d inclui #299/#310/#309 aprovadas. Extração da condição pessoal preserva SQL/OR; API aplica escopo/sessão/papel e no-store. SharedSSE concentra useEventosInbox e consumidores do selo, sem alterar assinatura do hook. Loja browser só inicia no subscribe, nunca em render/SSR; GET único com pendente, geração/dispose/StrictMode, auth e erro. InboxNovo delta restrito ao finally; Sidebar224 intacta.

Demo --entrada valida chave/fixture desconectada, transação local e trigger existente: uma mensagem.nova, sem NOTIFY duplicado/transportes. Harness dedicado permite somente dev-gravacoes/localhost54329/banco exato e fixture fictícia; não altera scripts de captura/espera pertencentes ao DEV A.

## TDD e gates observados

- RED módulos store/transporte ausentes0fe957 exit1; GREENc57172 3arquivos10testes0.
- REDbackend e2e576 exit1 (módulo ausente); REDconsumidores/API ff596d exit1. Extração incorreta por CRLF gerou parse f5b4cf e TSC44668 exit1; lint3be429 detectou mutação global em render. Corrigidos antes dos resultados abaixo, sem relaxar testes.
- Integração67611/aec28c exit0:2arquivos27testes (nao-lidas.int e consultas-pagina.int com chips310). O caminho contagens.int informado não existia e não contou como executado. Sem ignorados. Exclusivamente dev-gravacoes; não suíte inteira de integração.
- Unit67440/952be3 exit0:31arquivos297testes. TSC3100/d9de51 e lint5bb62b exit0 nessa etapa.
- Demo parser RED542fa0, funçãoentrada REDb016e5 exit1. GREENunit2arquivos15testes; integração9095/a07b82 exit0:2arquivos2testes (visual-inbox-entrada.int + visual-inbox.int reparo307), sem ignorados. Prova trigger exatamente uma mensagem.nova. Janela DB encerrada e comunicada antes da preparação do preview; nenhuma suíte DB durante captura.
- Resync para assinante tardio REDd4775f exit1; GREEN871ee0 4arquivos11testes0. Auth/store162ee0 2arquivos9testes0. PropSSR com consumidor já montado REDaf3934 exit1 e GREEN56619a 3arquivos10testes0.
- TSC31825/49abbe exit0; lintdelta8b184c exit0 antes das últimas esperas do harness.
- Recorte final pré-simplificação55fee0:29arquivos282testes exit0; dois caminhos de guards estavam incorretos, não contados como executados. Complemento com nomes reais acfdea exit1:1falha/76passaram em3arquivos.
- Fullunit21392/d8a070 (vitest run --maxWorkers=2, sem filtro/ignorados): exit1,855arquivos854pass/1fail;6647testes6646pass/1fail. Única falha botoes.test.ts:1255: literal /inbox na condição do filho foi considerado nome do botão. Não é full verde. Lintglobal1345/4b154c exit0,0erros40avisos; TSC97388/9c9792 exit0 nessa fonte.
- Fix posterior simplifica JSX mobile sem alterar guard: temInbox fora da árvore do botão e prop inicial com alias, total vivo mantendo o nome esperado. Mesmos argumentos/condições/pixels. GREENfinal42967/805c31 exit0:32arquivos359testes; lintdirigido23arquivos f67aaf exit0,0avisos. Global final com #308 será do integrador, nenhum novo fullDEV.

Comando do recorte final:
```text
Node22 node_modules/vitest/vitest.mjs run "src/app/(app)/inbox" src/lib/eventos-inbox.test.ts src/components/SeloNaoLidasInbox.test.ts src/components/SeloNaoLidasInbox.interacao.test.ts src/components/Sidebar.test.ts src/components/BarraMobile.test.ts "src/app/(app)/layout.test.ts" src/app/api/inbox/nao-lidas/route.test.ts src/test/visual-inbox-entrada.test.ts src/app/identificacao-registro.test.ts src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts src/app/botoes.test.ts --maxWorkers=2
```

## Capturas e decisões de prova

Preview3111 sessão67879, Node22/perfilB/transporte vazio, preparado e parado pelo integrador. Sessão95056/05a2dc exit0:24PNG reais,0falhas0diagnósticos. Manifesto original e pranchas em output/inbox-311-visual. Inspecionados os24PNG via três pranchas: selo2/1/2/1 legível nos dois temas/3tamanhos, gaveta completa, Sidebar224, sem texto fantasma. Seis referências offline protótipo18038/125017 exit0 (chamada inicial sem PW_CHROMIUM cd8da5 exit1 antes do browser). Referências também inspecionadas: verde/tokens compatíveis, casca diferente prevista #308, sem afirmar paridade integral.

Monitor real de duas abas: cada uma SSEativa1/máxima1, GETmáximo1. StrictMode cria2 fontes sequenciais. Após abrirThiago, total1. NavegarHome sem reload desmonta seleção, CLIentrada sobe2 nas duas abas. SelecionarThiago e novaentrada comchataberto reconciliam1, no máximo2 ações de leitura desde a entrada, sem loops. Step5 original exigia subida enquanto selecionado; ruling do integrador preservou auto-leitura299/310 e adicionou desmontagem verdadeira antes da subida.

Tentativa1 sessão52885/6b9513 exit1:12PNG preservados em visual-tentativa1; asserção da segundaaba antes da hidratação, nenhum CLIentrada, sem manifesto gerado. Ajuste do harness espera SSE+GET. Tentativa2 sessão34735/fc4e40 exit1 antes de fotosnovas: somenteVentura1 porque sharedThiago0 após leitura e resetpessoal marcoufalse. DBleitura c422e9 comprovouestado. Ruling: preparar Thiago/Ventura marcadaNaoLida=true/lidaAte=null, preservar compartilhados e demaispreferências. README preservado; não há manifesto original a reconstruir. Espera global de transições finitas acrescentada ao framework de captura, sem mudança produtiva. Manifestos negativos inexistentes foram documentados como limite, sem fabricar.

## Entrega

SPEC e quadro atualizados; revisão TESTER e gate global integrado pendentes. Sem push/PR/merge/deploy pelo DEV. Sem schema/instalação/pacote/lock/credencialreal/transporteexterno. Bloco Next gerado no AGENTS removido após preview parado; regra aprovada permanece intacta.

TypeScript final após simplificação: Node22, NODE_OPTIONS=--max-old-space-size=8192, tsc --noEmit sessão39406/7da5f0 exit0. Nenhuma alteração produtiva após recorte359/TSC/lintdirigido. Preview67879 foi encerrado pelo integrador com CtrlC/exit1 após a prova, sem atribuir esse código à captura95056exit0.
