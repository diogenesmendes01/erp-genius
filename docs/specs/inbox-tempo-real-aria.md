# Inbox #345 — tempo real da Aria

O servidor publica invalidações por IDs após o commit das ações e do estado global da Aria. Lista e painel recarregam pelos mecanismos existentes; a thread preserva seu aviso de mensagem. A autorização e o conteúdo continuam nas consultas HTTP atuais. Esta entrega não acrescenta alçadas, ações de negócio, filtros ou polling.

## Produtores transacionais

A migration reservada pelo ROOT é `20261025020000_inbox_aria_tempo_real`; o ID histórico `20261023210000` não foi reutilizado. Duas funções e dois triggers são novos, dentro de BEGIN/COMMIT. A função `notificar_inbox` e sua migration original permanecem intactas. Aplicação e snapshot pertencem ao integrador.

`AcaoAgenteIA` avisa `atendimento.atualizado` em INSERT ou mudança real de status. Atendimento nulo e status igual não emitem. O aviso contém somente tipo, atendimentoId, mensagemId:null e conversaId lido do atendimento. Confiança/payload isolados não disparam esse contrato. `AgenteIA` avisa `aria.global` em UPDATE que muda estado ou pausadoEm; INSERT, upsert sem efeito, motivo ou supervisão isolados não emitem.

NOTIFY é entregue no commit, não antes nem no rollback. Avisos SQL idênticos podem coalescer na mesma transação. Os produtores manuais existentes foram preservados e podem gerar strings distintas; não se promete dedup universal. O cliente tolera invalidações repetidas pelo coalescedor atual. Nenhum texto, motivo, payload, ação, ator ou intenção é enviado pelo novo trigger.

## SSE e cliente

`aria.global` tem exatamente quatro campos próprios e enumeráveis: tipo:"aria.global", atendimentoId:null, mensagemId:null, conversaId:"". O filtro recusa campos extras, inclusive payload, paraUsuarioId, símbolos e propriedades não enumeráveis. Global canônico dispensa consulta de escopo porque não carrega IDs/conteúdo, mas continua sujeito aos gates de sessão/PAPEIS, revalidação e expiração da rota. Tipos antigos, cache de escopo, avisos direcionados e remoção de paraUsuarioId do quadro preservam o contrato anterior.

A whitelist continua única em `src/lib/eventos-inbox.ts`; o hook é wrapper/reexport. A fonte compartilhada conserva descarte, CLOSED/CONNECTING e recuperação/resync da #396. O selo pessoal de não lidas ignora global.

`avisoRecarregaPainel` retorna true para resync, global e atendimento.atualizado do selecionado; false para outros atendimentos/mensagens. Global solicita lista/painel preservando os dados conhecidos durante a recarga. Não altera eventoRecente: React pode agrupar mensagem.nova seguida de global e a thread precisa receber a mensagem. HistoricoConversa também ignora global defensivamente; resync e reconciliação dos demais avisos continuam iguais. Leitura automática continua exclusiva das entradas do atendimento aberto.

A primeira página já usa filtros e contagens=1; nenhuma segunda busca, router.refresh ou controle de #346/#347 foi criado. A issue é independente da #344. ROOT unirá somente os hunks necessários com #328/#344, preservando fusoEscola, assumir, editor, rascunhos, foco e OR.

## Limites e verificação

Passagem do relógio, orçamento/ConfigIA e publicação de versão não disparam esses dois triggers por si. O cron de expiração deve mudar status para gerar o aviso. Não foram adicionados timers ou triggers extras. As decisões D1–D4 orientam futuras ações/alçadas, sem antecipá-las aqui.

Os testes cobrem contrato fechado, sessão/ACL, fonte/reconexão, histórico sem busca global, batching com ReactDOM/useConversa/Historico reais e fonte fake, coalescimento, commit/rollback e no-ops. DOM mínimo não é prova de navegador/layout. Os executores de integração completos passaram em recortes separados de um arquivo/26 casos e cinco arquivos/48 casos; UNIT final 14/354, lint de 14 arquivos e TSC auxiliar qualificado também passaram. Negativos, hashes, namespaces físico/GitLF e constância ROOT estão no relatório. QA independente, união/CI e publicação permanecem pendentes.
