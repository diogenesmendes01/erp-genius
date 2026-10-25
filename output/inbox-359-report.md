# Inbox #359 — entrega DEV B

Base c8e89565c2f2a3d85acc1b15be5b8d32287e109a, branch codex/inbox-e4-359-interruptor. D4/issue359 reais lidas; GO ROOT para ATIVA/SHADOW, checked=!pausada, DESLIGADA null, motivo obrigatório e idempotência estrita. Sem ampliação de papéis, modo global ou pausa por conversa.

## Implementação

InterruptorAria local reutiliza Botao/Campo/Modal/FeedbackAcao/useAcaoCliente. Trilha36×20, alvo canônico mínimo44px, role switch, estado anunciado. Diálogo e retry preservam motivo; token vivo por geração global impede efeitos de ACK antigo/capacidade revogada. Faixa preserva textos/contagens/region/status/NextLink. InboxNovo fornece somente callback da recarga existente. /aria muda apenas idempotente false→true.

Estado: TX singletonAgenteIA conserva lock/upsert; releitura db-aware do ator após espera, sem sessão stale ou nova política. Último Evento por tipo/agregado/autor +motivo trim controla repetição; retorno idempotente sem escrita/Eventos. Não toca Config/Atendimentos/cancelamentos, núcleos354/331, schema/deps/configs.

## TDD e gates observados

- RED estado completo sessão20972/0c648b EXIT1:19casos14pass5fail. Falhas de retry pausa/reativa/concorrência e duas revogações pós-lock provaram o precheck antigo. stderr de NextAuth no paralelo preservado; não foi contado como prova da regra.
- Primeira verificação91347/c40498 EXIT1:18/19; único erro do importNextAuth concorrente. Fixture passou a adaptar exigirSessao na fronteira como nos testes nativos existentes, mantendo authMock +carregarUsuarioFresco e todo SQL/locks/ACL reais. Replay82158/90b4f6 EXIT0:19/19.
- RED UI d94f0a era infraestrutura self ausente, não RED de produto. Após fornecer self/timers reais do DOM mínimo, e2e794 EXIT1:10casos1pass9fail por interruptor ausente. Produção só veio depois desse RED.
- Primeiro UI+guard8aedc1 EXIT1:110pass/1falha pelo mapa declarativo ausente. Mapa adicionado com exatamente3botões; parser/guarda genéricos intactos. Mutantes nome vazio (texto E aria-label removidos), variante errada e quarto botão. Primeiro mutante mantinha aria-label válido e falhou9700f4:236pass/1fail; corrigido o mutante, sem mudar parser.
- INT FINAL sessão48274/05a045 EXIT0:2arquivosCOMPLETOS46/46,206,57s: estado20 +barramento26. Sem filtro de caso ou skips adicionais. Inclui espera REAL pelo singleton observada com pg_blocking_pids antes de desativar o ator, concorrência/reenvio/evento único, motivo500/501, papéis e avisoscommit/rollback. Worker1/heap1024/config integração original, sete provedores vazios apenas no executor.
- UNIT pasta Inbox completa +/aria page +Botao/Modal +guardas botoes/confirmacoes/estados-vazios +acao-cliente/permissoes-tela: sessão6028/a50a86 EXIT0,93arquivos/1.177casos,70,43s,w1/heap1024. Rodada anterior50313/c271e3 tinha93/1172 mas revisão FS detectou remoção acidental de testes vizinhos na troca de linha sem_interruptor por CRLF/LF; todos restaurados e repetidos na6028. Não usar a rodada menor como cobertura final.
- Depois, somente novo controle de consumidor aviso→faixa pausada/503: cb79e1 EXIT0,3arquivos/45casos completos (InboxNovo.aria-eventos/FaixaSSR/interação). Inclui ACK→callback real de recarga, sem SSE paralelo e preserva thread/leitura.
- ESLint focal11arquivos dd936f EXIT0 --max-warnings=0, antes apenas do último teste consumidor; replay final a51e30 EXIT0 nos mesmos11arquivos, --max-warnings=0. Diff check a85e2f EXIT0.

Os testes de interação usam ReactDOM, Modal e hook reais sobre DOM mínimo; fontes/ações fake somente na fronteira. Não são prova visual/browser. Componentes357/355 não implementados.

## Entrega e pendências

Leaseci-integracao492 exclusiva concedida após restoreROOT28dd36; liberada após terminal05a045. Banco contém fixtures finais, sem restore presumido. Nenhum servidor/worker/motor/provedor/integração externa disparado; sete variáveis vazias: MOTOR_URL/MOTOR_API_KEY/MOTOR_WEBHOOK_SECRET/WHATSAPP_LIVE/OPENAI_API_KEY/ANTHROPIC_API_KEY/RESEND_API_KEY. Não foram lidos/impressos valores existentes nem editado .env.

Pendentes QA independente, TypeScript/gates globais originais e build/visual coordenados. Não atribuir gates354c8e a359. Sem install/package/lock/schema/config/env/client/generate/build/browser/HTTP/PR/push. Whitelist funcional/docs e hashes ficam em output/inbox-359-freeze-private.json.
