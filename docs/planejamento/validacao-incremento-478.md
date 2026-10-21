# Incremento 478 — retomada após disponibilidade conferida

Data: 15/09/2026. Turno anterior foi progresso comprovado em código e testes. Meta integral permanece ativa. Revisão de concorrência pelo Terra; implementação e validação pelo orquestrador.

## Problema e mudança

Q58 determina que o tempo restante volta a correr quando o material retorna. A ação anterior encerrava a indisponibilidade apenas com decisão do gestor, sem conferir se o arquivo estava acessível.

A retomada agora captura a pausa e a fonte autorizada em transação curta, exige material publicado no Google Drive e confere a publicação original quando vinculada. Fora da transação, verifica metadados, Drive institucional e leitura de um byte com prazo limitado. Depois, uma nova transação reconfere gestão ativa, pausa aberta e a mesma fonte antes de registrar o fim e o evento. A consulta remota não mantém trava do banco. Falha técnica mantém a pausa; resultado alterado durante a conferência exige nova revisão.

O evento registra material, publicação vinculada quando existente e que a disponibilidade foi conferida. Não inclui credenciais ou endereço externo. A regra existente de cálculo do tempo restante permanece.

## Evidências

- 19 testes de integração operacionais aprovados. Cinco novos cenários cobrem falha do Drive, desativação do gestor, retirada do material, mudança do Drive configurado e outra retomada durante a conferência. A decisão concorrente produz somente um evento; as demais recusas preservam a pausa aberta.
- Três testes do preflight aprovados, cobrindo leitura limitada e falhas/limite de tempo do adaptador.
- Relatórios: `docs/validacao-retomada-material-478-2026-09-15.json` e `docs/validacao-preflight-retomada-478-2026-09-15.json`.
- TypeScript e lint direcionado aprovados. Integração executada em banco descartável por um único processo.

## Limites

Sem acesso real ao Drive, validação visual ou novo build nesta rodada; último build aprovado no incremento 477. A propagação de indisponibilidade entre diferentes materiais da mesma fonte e a substituição de gravação por Q23 continuam pendentes. Não comprova conclusão da SPEC integral e não altera produção.
