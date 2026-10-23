# QA independente #403 — fonte a7ebf56b4fb3391d1013ff776086616c46bb13c1

**Parecer:** favorável ao contrato C2 observado na fonte exata. Esta prova é um recorte de Lucas ENCERRADO, não homologação do fluxo de registro de notas ou de envio.

## Ambiente e execução própria

- Worktree TESTER isolado, Node 22.23.2, Next dev `http://localhost:3109`, perfil/banco tester original preparado pelo integrador; provedores externos vazios. Nenhuma seed, SQL, envio ou submit executado por este QA.
- Capturador privado: `output/qa-403-menu-tester.mjs`. Execução final `586a23`, **exit 0**, 390×844 claro e 1440×900 escuro; seis PNGs e dois manifestos. Sem testes ignorados. A revisão estática/recorte anterior `30b27a` concluiu 8 arquivos/123 testes, exit 0 no mesmo SHA.
- O GET real `/api/inbox/atendimentos?busca=Lucas` retornou 200 e identificou `inbox-demo-lucas-origem-307` como `ENCERRADO`, `grupo=false`; GET real do painel retornou 200 e `podeEnviar=false`. URL selecionada manteve `c` do mesmo atendimento.

## Contratos observados

- Aba **Responder** mostra impedimento de envio; não apareceu agendamento no rodapé. Aba **Nota interna** permanece habilitada, mostra o aviso de que fica apenas com a equipe e deixa o envio vazio desabilitado.
- Menu **Mais ações** oferece Nota interna habilitada e não apresenta agendamento, convites, atribuição, devolução, encerramento ou bloqueio. Transferir/Assumir não aparecem no cabeçalho. A opção Nota abre diálogo acessível; **Registrar nota** permanece desabilitado vazio; Escape fecha e devolve foco ao gatilho.
- Instrumentação `EventSource` instalada antes da navegação observou duas instâncias criadas pela montagem/StrictMode, **máximo simultâneo 1 e 1 ativa** ao final em ambos os contextos. Houve 1 requisição SSE por contexto nesta execução, sem afirmar que a contagem total é invariável.
- `pageerror=[]`, avisos React/hidratação `[]`, hosts externos `[]`; nenhum POST de envio/registro. Os três POSTs `/inbox` de cada navegação possuíam apenas os IDs Next Action compilados `003270280141859209f62881b27c5a32e9b00c8f56` = `respostasRapidasDoCompositor` (2) e `4063707026298fb863149d9142d32515803081f355` = `marcarAtendimentoLidoAutomatico` (1), identificados em `.next/dev/server/chunks/ssr/_next-internal_server_app_(app)_inbox_page_actions_05tl899.js`. O oráculo rejeita outro ID, rota POST ou chamada fora da fase de navegação.

## Evidência e limites

- Allowlist positiva: `output/inbox-403-menu-tester/allowlist-positiva.json` (exclusivamente as 6 PNGs finais, todas inspecionadas e com SHA-256). Os 2 manifestos JSON ficam como apoio técnico fora da allowlist. Telefones foram substituídos no DOM por `[telefone fictício]` antes de cada captura. O estilo de screenshot oculta somente `[data-nextjs-toast]` sem `[data-has-issues="true"]`, preservando indicadores de problemas. O aplicativo e as respostas HTTP não foram alterados.
- Tentativa inicial `0595b8` exit 1 foi falso negativo do oráculo privado: classificava três Server Actions automáticas `/inbox` como ações de negócio. Preservada fora da allowlist em `output/inbox-403-negativos/390-light-oraculo-inicial.json`. A correção limitou a exceção aos dois IDs identificados acima; execuções posteriores `605733`, `256038`, `7f549c` e final `586a23` terminaram exit 0. Só os arquivos da execução final entram na allowlist.
- O diálogo ficou vazio e não houve gravação de nota. Não se provaram permissões de outros papéis, persistência de rascunhos, nem retorno de foco após outros comandos. O integrador confirmou leitura transacional adicional `706b31` exit 0: 4 notas internas, 245 mensagens e 0 intenções com hashes idênticos ao snapshot antes da restauração; depois restaurou as 424 tabelas/1.386 linhas originais, hashes idênticos, exit 0.
- O C3 tem prova própria de testes ReactDOM reais no recorte estático; esta prova ERP cobriu o C2 encerrado sem forjar sucesso de API, sem submeter notas e sem validar persistência de intenção C3. O global comunicado pelo integrador (`7442`, 902 arquivos/7091 testes, TypeScript e lint) não foi executado pelo TESTER e não é atribuído a este parecer.
