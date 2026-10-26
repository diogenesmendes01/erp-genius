# PR #443 C5 — evidência temporária do teste KEY SHARE

O teste nativo passa a criar uma pasta exclusiva com `fs.mkdtemp` sob `os.tmpdir()`. O JSON de diagnóstico fica nessa pasta, e seu caminho é informado pelo teste. As asserções e a mutação permanecem iguais. O relatório Markdown curado da #352 continua versionado como registro de proveniência; este JSON é um artefato por execução.

Validação ROOT em 26/10/2026: arquivo `src/server/inbox/agendadas-keyshare.int.test.ts` completo, um caso, **EXIT0** (sessão29186, terminala2a8b5,14.40s). Configuração original de integração, Node22/UTC, um worker, heap1024, sem filtro de caso ou novo skip, banco descartável ROOT496 e sete provedores desativados antes dos imports. Avisos originais de configuração preservados. Lint do arquivo: sessão19571/terminal4e6aeb, EXIT0, zero saída.

O JSON temporário foi inspecionado: conclusão antes de liberar o holder, status CANCELADA, um Evento, nenhum bloqueio observado e resultado ok. SHA256 do núcleo produtivo preservado: `ca4a2b0725f3b59bd67f39d41f1398531389a3e36cdd92381f27e94d47d42107`. O banco foi restaurado ao snapshot ROOT496 após a execução, com hashes conferidos.

Fonte-base: `fa1c9fb5d92bb18e7b9ccab430c2d33682633721`. Os quatro gates globais dessa fonte conservam sua atribuição; este ajuste altera somente o destino de evidência no teste e documentação. Backport à PR #443 e propagação de dependências permanecem etapas de publicação. Visual e CI específicos continuam pendentes.
