# Inbox E1.2 — harness visual (#307)

Estado em 22/10/2026: núcleo, guarda, fixture e protótipo offline implementados.
Aceite de app × protótipo e gates globais ainda dependem do servidor e da janela
coordenados pelo integrador.

## Contrato

- `demo-inbox.ts` aceita somente as URLs dos cinco bancos de teste definidos
  em `scripts/test-profile.mjs`, no host `localhost` ou `127.0.0.1` e porta
  `54329`. Protocolo deve ser PostgreSQL; query/fragmento e nome semelhante
  são recusados antes da conexão. A fixture usa IDs fixos, número BAILEYS
  desconectado e sete atendimentos individuais. Reexecução não duplica; a
  criação parcial é completada por upserts no próprio cenário.
- `nucleo-captura.mjs` fornece viewports, temas, estados, nomes e combinações.
  `caminhoNoNpm` mapeia URLs de `unpkg.com` para `node_modules`, retirando a
  versão do pacote e a query de fonte Lucide. O caminho final é conferido
  dentro de `node_modules` antes da leitura.
- `capturar-inbox.mjs` admite `--alvo app|prototipo|ambos`, `--estado nome|todos`
  e base HTTP local. O app faz login com conta fictícia, usa os IDs do perfil
  correspondente e captura a conversa. O protótipo abre via `file://`, usa
  recursos npm locais e Google Fonts vazio; tráfego inesperado é bloqueado.
  Cada contexto registra requisições falhas, 404 e exceções da página.
- `tmp/visual/` contém PNGs e manifesto. `conversa` produz exatamente 12 PNGs
  nos dois alvos, três tamanhos e dois temas; o protótipo isolado produz seis.
  A referência offline pode ter tipografia de reserva diferente da imagem
  original com Google Fonts. Nenhuma operação aciona transporte WhatsApp.

## Prova exigida

Unitários para guarda, nomes, MIME, recursos e CLI; integração real para os
sete registros, repetição, reparo parcial e preservação de outro número.
Depois, captura de app × protótipo com 12 PNGs, inspeção de desktop escuro e
celular, TypeScript, Vitest completo e lint global com saída 0. Evidências e
pendências ficam no [quadro único](../planejamento/quadro-entregas.md).
