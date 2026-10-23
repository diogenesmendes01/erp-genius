# QA independente da composição #393

**Commit exato:** 04d27fd83e63e51e04038be9dc34b33b78c32d9d. Base do merge: 67e6cc60f5e26dce91af5284cb6c0b2ced41282a; fonte funcional #309: a1a791962daf3d4dd5faf7b44e31213e324afe1f. **Parecer favorável** à composição estática e ao recorte dirigido; sem nova homologação visual ou de banco.

A comparação contra a base revelou exatamente nove caminhos em src/: BadgeEstado.tsx/test, estado-visual.ts/test/servidor.test, prazo-atendimento.ts, prazo-vivo.ts e Avatar.tsx/test. Os nove objetos Git do head são idênticos aos da fonte a1, sem conflito ou edição de produto no merge. Fora desses caminhos, src/scripts/package.json/package-lock.json/eslint.config.mjs permanecem como na base. O diff check do recorte terminou com código 0.

A inspeção confirmou prazoEstourado movido para helper puro e reexportado pelo relógio cliente, sem mudança da condição de grupo/encerrado/limiar. BadgeEstado usa os tons compartilhados e o avatar comum permanece decorativo; apenas selo IA atribui role img e nome acessível Aria atendendo. Iniciais são capitalizadas por letra e cortadas por code point; FNV-1a preserva tom estável. A função de estado da lista respeita responsável, grupo, encerrado, fila e prazo, sem alterar consulta, SSE, autorização, envio ou comportamento da aplicação.

**Execução própria:** Node v22.23.2, Vitest local com maxWorkers2 nos seis arquivos BadgeEstado.test, estado-visual.test, estado-visual.servidor.test, prazo-vivo.test, prazo-vivo.interacao.test e Avatar.test. Chunk a4383f, terminal **exit 0**, 6 arquivos/75 testes, sem skips reportados. O número 75 é desta fonte/recorte próprio; não reatribuo o recorte 6/73 do integrador.

**Limites:** não rodei integração, PostgreSQL, browser, captura, build Next, suíte global ou instalação. A fonte #393 adiciona produtores visuais e helper; aceites de telas consumidoras permanecem com as funcionalidades que os integrarem. Meu worktree rastreado não foi modificado.
