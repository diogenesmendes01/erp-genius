# Inbox E1.2 — harness visual (#307)

Estado em 22/10/2026: núcleo, guarda, fixture e protótipo offline implementados.
Rodada4 DEV validou34PNGs app × protótipo, incluindo painéis celular/tablet nos
dois temas. Revisão independente e gates globais combinados seguem pendentes
com integrador/TESTER.

## Contrato

- `demo-inbox.ts` aceita somente as URLs dos cinco bancos de teste definidos
  em `scripts/test-profile.mjs`, no host `localhost` ou `127.0.0.1` e porta
  `54329`. Protocolo deve ser PostgreSQL; query/fragmento e nome semelhante
  são recusados antes da conexão. A fixture usa IDs fixos, número BAILEYS
  desconectado e sete atendimentos individuais. Reexecução não duplica; a
  criação parcial é completada por upserts no próprio cenário.
  A linha usa `+5500000000300`; contatos/oportunidades usam `0301` a `0307`
  no mesmo prefixo fictício. Ao reexecutar a versão antiga, repara somente os
  telefones legados reconhecidos dos IDs fixos, em uma transação. Exige linha
  BAILEYS desconectada e vínculos contato/oportunidade/conversa da demo;
  telefone modificado, vínculo inesperado ou colisão com terceiro aborta tudo.
  Não restaura outros campos mutados durante o QA.
- `nucleo-captura.mjs` fornece viewports, temas, estados, nomes e combinações.
  `caminhoNoNpm` mapeia URLs de `unpkg.com` para `node_modules`, retirando a
  versão do pacote e a query de fonte Lucide. O caminho final é conferido
  dentro de `node_modules` antes da leitura.
- `capturar-inbox.mjs` admite `--alvo app|prototipo|ambos`, `--estado nome|todos`
  e base HTTP local. O app autentica a conta fictícia por CSRF/credentials no
  contexto HTTP do navegador, confirma a sessão, usa os IDs do perfil e aguarda
  mensagem específica da fixture antes da captura. No estado de Beatriz também
  aguarda a nota; painel desktop/Drawer exige o conteúdo do painel. O clique no
  Drawer ocorre após a mensagem renderizar, provando a hidratação da tela.
  Depois do clique, a região da conversa fica oculta e a segunda espera exige
  o Painel Comercial visível, o `aside` móvel inteiro no viewport e nenhuma
  transição em execução. A região só visível no DOM não basta para a foto.
  Nenhuma dessas esperas depende de atraso fixo. O protótipo abre via `file://`, usa
  recursos npm locais e Google Fonts vazio; tráfego inesperado é bloqueado.
  Cada contexto registra requisições falhas, 404 e exceções da página. Somente
  GET local de mensagens abortado, substituído por GET idêntico 2xx e conteúdo
  confirmado, fica em `diagnosticos`; qualquer outro aborto continua falha.
  O estilo transitório da screenshot oculta só o toast Next sem issues, mantendo
  indicadores com issues e listeners de erros. Nenhum componente produtivo muda.
- `tmp/visual/` contém PNGs e manifesto. `conversa` produz exatamente 12 PNGs
  nos dois alvos, três tamanhos e dois temas; o protótipo isolado produz seis.
  A referência offline pode ter tipografia de reserva diferente da imagem
  original com Google Fonts. `--estado todos` exige 34 PNGs (18 app, 16 protótipo),
  incluindo os painéis celular/tablet nos dois temas. O painel do protótipo exige
  comando e superfície visível. Nenhuma operação aciona transporte WhatsApp.

## Prova exigida

Unitários para guarda, nomes, MIME, recursos e CLI; integração real para os
sete registros, repetição, reparo parcial e preservação de outro número.
Depois, captura de app × protótipo com 12 PNGs, inspeção de desktop escuro e
celular, TypeScript, Vitest completo e lint global com saída 0. Evidências e
pendências ficam no [quadro único](../planejamento/quadro-entregas.md).

## Aceite final

DEV fonte6a8ab794 e TESTER18testes0. Na combinação com306, fonte visual7e236e64: integrador51505 e TESTER76466, ambosexit0 com34PNGs/0falhas/14diagnósticos e gavetas inspecionadas. Fontes306400/500+Roboto6/6 confirmadas independentemente. Global final76a08316 sessão95778exit0:846arquivos/6547testes semfiltros/ignorados, TSCheap8192 e lintglobal0erros40avisos. O delta após pixels tipa o enum no teste de integração307 sem alterar valor; guarda legado,19testes dirigidos e integração1teste passaram, revisão independente favorável. Não houve mudança de pixels/produção.

Evidências em `output/inbox-307-combinado/` e `output/inbox-307-qa/`. As pastas r3/primeiraR4 preservam negativos, sem contar como aceite. Limites: fonte de reserva no protótipo offline; contadores pessoais mudam ao abrir conversas sequencialmente, e o seed idempotente não restaura todos os campos mutados; Nextdev tem toast semissues ocultado apenas na foto. O aceite é de estados/estrutura, não comparação pixel a pixel de contadores nem redesenho final do Inbox. Próximas tasks podem ampliar estados e exigências de prontidão.
