# PR447 R1 — QA DEV C1/C2 e qualificação C5/C6

Review real https://github.com/diogenesmendes01/erp-genius/pull/447#pullrequestreview-5645724674 lido na timeline; submissão COMMENTED, não ID de comentário inline. Base própria76cbafc8 (#371 congelada), branch codex/inbox-447-review-r1. Publicar apenas delta desta revisão, não pais privados/grant/schema/#371.

RED aed2f0 EXIT1:3arquivos136casos,6falhas130pass (quatro mensagens de alvo não encaminhadas, callback Inbox ausente, rawstatus invalida identidade). Produção foi alterada depois do RED.

GREEN final e9eb6c EXIT0:8arquivos180casos, UTC/w1/1024/no-fileparallel, diretório transferir completo + ConversaAberta.mencoes.interacao + InboxNovo.interacao; sem filtro de caso/skips. Intermediário81664/44adb9 EXIT0 8/173, não somar. Consumidor ampliado2eb5a5 EXIT0 1/7, sobreposto ao final. Lint08c6f4 EXIT0 oito SRC, stdout ESLint vazio; avisos Git de CRLF não são ESLint.

Testes reais de Controller/hook/Popover e consumidor ConversaAberta provam formulário/contexto/chave retry preservados em AGUARDANDO_CLIENTE→EM_ATENDIMENTO, com owner/ENCERRADO/cap revogados continuando a invalidar. Mocks limitados a Header/rodapé/mensagens e fronteiras de servidor; formulário e núcleo de geração não são mockados. Callback de sucesso passa pelo consumidor real, antes aoMudar.

C1 quatro alvos com rótulos fechados; erro/incerto/velha abertura/A→B→A/revogação/unmount não anunciam. Pai React real monta MensagemStatus e Controller, confirma setor, desmonta Controller e verifica região status e texto visível sobreviventes no DOM. InboxNovo é executado no harness já existente de hooks (sem DOM real) e comprova que limpar seleção remove ConversaAberta preservando props do MensagemStatus; não declarar esse último como captura ou navegador. Mesma região permanece montada antes do texto, conforme contrato acessível canônico.

Primeiro GREEN4d8b54 falhou por introduzir Fragment externo que mudou a forma da raiz observada em7 testes antigos e por uma asserção nova antes do render de reconciliação. Corrigida estrutura para conservar raiz data-vista e colunas internas, mantendo asserções antigas; nova asserção observa render final após reconciliação. Log negativo preservado, sem alegar verde nessa tentativa.

Backend/ACL/kernels, schema/migration/client, configurações/deps, Header/PopoverFluxo e fonte371 sem delta. Nenhuma SQL/DDL/Node pesado/TSC/global/browser/build nesta revisão. Sem leaseSQL. #370 continua bloqueada aguardando autorização humana específica e stash preservado.

C5/C6 detalhados na SPEC: contexto opcional369 opt-in, histórico min12, configuração planejada inexistente; breakpoint shared sm literal, visual639/640/767/768 pendente. QA independente do SHA, gates compostos e aceite visual continuam pendentes.
